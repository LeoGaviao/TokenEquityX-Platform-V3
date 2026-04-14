// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./AssetToken.sol";
import "./ComplianceManager.sol";
import "./MarketController.sol";

/**
 * @title ExchangeSettlement
 * @notice Atomic DVP (Delivery vs Payment) settlement for TokenEquityX V2.
 *         Off-chain: order book + matching engine (Node.js backend).
 *         On-chain: atomic settlement only — tokens and USDC swap simultaneously.
 *         Integrates with MarketController for circuit breakers and trade limits.
 *         Only the EXCHANGE_ROLE (held by backend) can trigger settlement.
 */
contract ExchangeSettlement is AccessControl, ReentrancyGuard, Pausable {

    // ─── ROLES ────────────────────────────────────────────────────
    bytes32 public constant EXCHANGE_ROLE   = keccak256("EXCHANGE_ROLE");
    bytes32 public constant FEE_MANAGER     = keccak256("FEE_MANAGER");

    // ─── ENUMS ────────────────────────────────────────────────────
    enum TradeStatus {
        PENDING,
        SETTLED,
        CANCELLED,
        FAILED
    }

    // ─── STRUCTS ──────────────────────────────────────────────────
    struct Trade {
        bytes32     tradeId;
        address     token;
        address     seller;
        address     buyer;
        uint256     tokenAmount;
        uint256     pricePerToken;   // USDC per token (6 decimals)
        uint256     totalUSDC;
        uint256     platformFee;
        uint256     netSellerAmount;
        TradeStatus status;
        uint256     settledAt;
    }

    // ─── STATE ────────────────────────────────────────────────────
    IERC20             public immutable usdc;
    ComplianceManager  public immutable compliance;
    MarketController   public           marketController;

    uint256 public platformFeeBps  = 50;    // 0.50% default
    address public feeCollector;
    address public treasury;

    mapping(bytes32 => Trade)   public trades;
    mapping(address => uint256) public totalVolumeByToken; // USDC volume per token
    mapping(address => uint256) public totalTradesByToken;

    uint256 public totalPlatformFees;
    uint256 public totalSettledTrades;

    // ─── EVENTS ───────────────────────────────────────────────────
    event TradeSettled(
        bytes32 indexed tradeId,
        address indexed token,
        address indexed seller,
        address         buyer,
        uint256         tokenAmount,
        uint256         totalUSDC,
        uint256         platformFee
    );
    event TradeFailed(
        bytes32 indexed tradeId,
        string          reason
    );
    event FeeUpdated(uint256 newFeeBps);
    event MarketControllerUpdated(address newController);

    // ─── CONSTRUCTOR ──────────────────────────────────────────────
    constructor(
        address _usdc,
        address _compliance,
        address _feeCollector,
        address _treasury
    ) {
        require(_usdc         != address(0), "Invalid USDC");
        require(_compliance   != address(0), "Invalid compliance");
        require(_feeCollector != address(0), "Invalid fee collector");
        require(_treasury     != address(0), "Invalid treasury");

        usdc         = IERC20(_usdc);
        compliance   = ComplianceManager(_compliance);
        feeCollector = _feeCollector;
        treasury     = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EXCHANGE_ROLE,      msg.sender);
        _grantRole(FEE_MANAGER,        msg.sender);
    }

    // ─── SETTLEMENT ───────────────────────────────────────────────

    /**
     * @notice Atomically settle a matched trade.
     *         Both parties must have pre-approved this contract:
     *         - Seller: assetToken.approve(settlement, tokenAmount)
     *         - Buyer:  usdc.approve(settlement, totalUSDC)
     *
     * @param tradeId       Unique trade ID (keccak256 from backend order IDs)
     * @param token         AssetToken address being traded
     * @param seller        Seller wallet address
     * @param buyer         Buyer wallet address
     * @param tokenAmount   Number of tokens being sold
     * @param pricePerToken USDC price per token (6 decimal precision)
     */
    function settleTrade(
        bytes32 tradeId,
        address token,
        address seller,
        address buyer,
        uint256 tokenAmount,
        uint256 pricePerToken
    ) external onlyRole(EXCHANGE_ROLE) nonReentrant whenNotPaused {
        require(trades[tradeId].tradeId == bytes32(0), "Trade already processed");
        require(token       != address(0),              "Invalid token");
        require(seller      != address(0),              "Invalid seller");
        require(buyer       != address(0),              "Invalid buyer");
        require(seller      != buyer,                   "Self-trade not allowed");
        require(tokenAmount >  0,                       "Zero token amount");
        require(pricePerToken > 0,                      "Zero price");

        // Compliance check
        compliance.canTransfer(seller, buyer, tokenAmount);

        // Market controller check (if set)
        if (address(marketController) != address(0)) {
            require(
                marketController.canTrade(token, tokenAmount, pricePerToken),
                "Market controller: trade blocked"
            );
        }

        // Check asset market state allows trading
        AssetToken asset = AssetToken(token);
        AssetToken.MarketState state = asset.marketState();
        require(
            state == AssetToken.MarketState.FULL_TRADING ||
            state == AssetToken.MarketState.LIMITED_TRADING,
            "Token not in trading state"
        );

        // Calculate amounts
        uint256 totalUSDC      = (tokenAmount * pricePerToken) / 1e18;
        uint256 platformFee    = (totalUSDC * platformFeeBps) / 10000;
        uint256 sellerReceives = totalUSDC - platformFee;

        // Verify balances and allowances
        require(
            asset.balanceOf(seller) >= tokenAmount,
            "Seller: insufficient token balance"
        );
        require(
            asset.allowance(seller, address(this)) >= tokenAmount,
            "Seller: insufficient token allowance"
        );
        require(
            usdc.balanceOf(buyer) >= totalUSDC,
            "Buyer: insufficient USDC balance"
        );
        require(
            usdc.allowance(buyer, address(this)) >= totalUSDC,
            "Buyer: insufficient USDC allowance"
        );

        // Record trade BEFORE transfers (checks-effects-interactions)
        trades[tradeId] = Trade({
            tradeId:         tradeId,
            token:           token,
            seller:          seller,
            buyer:           buyer,
            tokenAmount:     tokenAmount,
            pricePerToken:   pricePerToken,
            totalUSDC:       totalUSDC,
            platformFee:     platformFee,
            netSellerAmount: sellerReceives,
            status:          TradeStatus.SETTLED,
            settledAt:       block.timestamp
        });

        // Update analytics
        totalVolumeByToken[token]  += totalUSDC;
        totalTradesByToken[token]  += 1;
        totalPlatformFees          += platformFee;
        totalSettledTrades         += 1;

        // Atomic settlement — all or nothing
        // 1. Transfer tokens: seller → buyer
        require(
            asset.transferFrom(seller, buyer, tokenAmount),
            "Token transfer failed"
        );

        // 2. Transfer USDC: buyer → seller (minus fee)
        require(
            usdc.transferFrom(buyer, seller, sellerReceives),
            "USDC to seller failed"
        );

        // 3. Transfer fee: buyer → feeCollector
        if (platformFee > 0) {
            require(
                usdc.transferFrom(buyer, feeCollector, platformFee),
                "Fee transfer failed"
            );
        }

        // Notify market controller of volume
        if (address(marketController) != address(0)) {
            marketController.recordTrade(token, totalUSDC);
        }

        emit TradeSettled(
            tradeId, token, seller, buyer,
            tokenAmount, totalUSDC, platformFee
        );
    }

    /**
     * @notice Batch settle multiple trades in one transaction.
     *         More gas efficient for high-volume periods.
     */
    function batchSettle(
        bytes32[] calldata tradeIds,
        address[] calldata tokens,
        address[] calldata sellers,
        address[] calldata buyers,
        uint256[] calldata tokenAmounts,
        uint256[] calldata pricePerTokens
    ) external onlyRole(EXCHANGE_ROLE) whenNotPaused {
        require(
            tradeIds.length == tokens.length &&
            tokens.length   == sellers.length &&
            sellers.length  == buyers.length &&
            buyers.length   == tokenAmounts.length &&
            tokenAmounts.length == pricePerTokens.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < tradeIds.length; i++) {
            // Use try-catch pattern for batch — one failure doesn't block others
            try this.settleTrade(
                tradeIds[i], tokens[i], sellers[i], buyers[i],
                tokenAmounts[i], pricePerTokens[i]
            ) {
                // settled successfully
            } catch Error(string memory reason) {
                trades[tradeIds[i]].status = TradeStatus.FAILED;
                emit TradeFailed(tradeIds[i], reason);
            }
        }
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────────────

    function getTrade(bytes32 tradeId)
        external view returns (Trade memory)
    {
        return trades[tradeId];
    }

    function getTokenVolume(address token)
        external view returns (uint256 volume, uint256 tradeCount)
    {
        return (totalVolumeByToken[token], totalTradesByToken[token]);
    }

    // ─── ADMIN ────────────────────────────────────────────────────

    function setFeeBps(uint256 bps)
        external onlyRole(FEE_MANAGER)
    {
        require(bps <= 500, "Max 5%");
        platformFeeBps = bps;
        emit FeeUpdated(bps);
    }

    function setFeeCollector(address newCollector)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newCollector != address(0), "Invalid address");
        feeCollector = newCollector;
    }

    function setMarketController(address newController)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        marketController = MarketController(newController);
        emit MarketControllerUpdated(newController);
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}