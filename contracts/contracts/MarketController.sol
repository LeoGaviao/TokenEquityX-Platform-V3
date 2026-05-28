// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./AssetToken.sol";

/**
 * @title MarketController
 * @notice Circuit breaker and market control system for TokenEquityX V2.
 *         Enforces:
 *         - Global platform pause
 *         - Per-token trading halts
 *         - Daily volume caps per token
 *         - Single trade size limits
 *         - Price movement circuit breakers
 *         - Designated Market Maker (DMM) tracking
 *         Called by ExchangeSettlement before every trade.
 */
contract MarketController is AccessControl, Pausable {

    // ─── ROLES ────────────────────────────────────────────────────
    bytes32 public constant MARKET_ADMIN_ROLE  = keccak256("MARKET_ADMIN_ROLE");
    bytes32 public constant CIRCUIT_BREAKER    = keccak256("CIRCUIT_BREAKER");
    bytes32 public constant AUDITOR_ROLE       = keccak256("AUDITOR_ROLE");

    // ─── STRUCTS ──────────────────────────────────────────────────
    struct TokenControls {
        bool    tradingEnabled;
        bool    halted;
        string  haltReason;
        uint256 dailyVolumeCapUSDC;   // max USDC volume per day (0 = no cap)
        uint256 dailyVolumeUsed;      // USDC traded today
        uint256 dailyVolumeReset;     // timestamp of last reset
        uint256 maxTradeSizeUSDC;     // max single trade size (0 = no limit)
        uint256 maxPriceMovementBps;  // max % price move per day (0 = disabled)
        uint256 referencePrice;       // price at start of day (8 decimals)
        uint256 referencePriceDate;   // date reference price was set
        uint256 totalVolume;          // all-time volume in USDC
        uint256 totalTrades;          // all-time trade count
    }

    struct MarketMaker {
        address wallet;
        address token;
        bool    active;
        uint256 assignedAt;
    }

    // ─── STATE ────────────────────────────────────────────────────
    bool    public globalTradingEnabled = true;
    bool    public globalEmergencyStop  = false;

    mapping(address => TokenControls)          public tokenControls;
    mapping(address => MarketMaker[])          public tokenMarketMakers;
    mapping(address => mapping(address => bool)) public isMarketMaker;

    address[] public registeredTokens;
    mapping(address => bool) public tokenRegistered;

    // ─── EVENTS ───────────────────────────────────────────────────
    event TokenRegistered(address indexed token);
    event TokenHalted(address indexed token, string reason);
    event TokenResumed(address indexed token);
    event GlobalEmergencyStop(bool activated, string reason);
    event CircuitBreakerTriggered(
        address indexed token,
        string          reason,
        uint256         value,
        uint256         limit
    );
    event VolumeLimitUpdated(address indexed token, uint256 newLimit);
    event TradeSizeLimitUpdated(address indexed token, uint256 newLimit);
    event MarketMakerAssigned(address indexed token, address indexed maker);
    event MarketMakerRemoved(address indexed token, address indexed maker);
    event TradeRecorded(address indexed token, uint256 usdcVolume);
    event ReferencePriceSet(address indexed token, uint256 price);

    // ─── CONSTRUCTOR ──────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MARKET_ADMIN_ROLE,  msg.sender);
        _grantRole(CIRCUIT_BREAKER,    msg.sender);
        _grantRole(AUDITOR_ROLE,       msg.sender);
    }

    // ─── TOKEN REGISTRATION ───────────────────────────────────────

    /**
     * @notice Register a token for market control.
     *         Must be called before trading can occur.
     */
    function registerToken(
        address token,
        uint256 dailyVolumeCapUSDC,
        uint256 maxTradeSizeUSDC,
        uint256 maxPriceMovementBps
    ) external onlyRole(MARKET_ADMIN_ROLE) {
        require(token != address(0),     "Invalid token");
        require(!tokenRegistered[token], "Already registered");

        tokenControls[token] = TokenControls({
            tradingEnabled:       true,
            halted:               false,
            haltReason:           "",
            dailyVolumeCapUSDC:   dailyVolumeCapUSDC,
            dailyVolumeUsed:      0,
            dailyVolumeReset:     block.timestamp,
            maxTradeSizeUSDC:     maxTradeSizeUSDC,
            maxPriceMovementBps:  maxPriceMovementBps,
            referencePrice:       0,
            referencePriceDate:   0,
            totalVolume:          0,
            totalTrades:          0
        });

        tokenRegistered[token] = true;
        registeredTokens.push(token);

        emit TokenRegistered(token);
    }

    // ─── TRADE VALIDATION ─────────────────────────────────────────

    /**
     * @notice Called by ExchangeSettlement before every trade.
     *         Returns true if trade is allowed, reverts if not.
     * @param token         AssetToken address
     * @param tokenAmount   Number of tokens
     * @param pricePerToken USDC price per token (6 decimals)
     */
    function canTrade(
        address token,
        uint256 tokenAmount,
        uint256 pricePerToken
    ) external view returns (bool) {
        // Global checks
        require(!globalEmergencyStop,     "Emergency stop active");
        require(globalTradingEnabled,     "Global trading disabled");

        // Token must be registered
        require(tokenRegistered[token],   "Token not registered");

        TokenControls storage c = tokenControls[token];

        // Token-level checks
        require(c.tradingEnabled,         "Token trading disabled");
        require(!c.halted,                "Token halted");

        // Trade size check
        uint256 tradeSizeUSDC = (tokenAmount * pricePerToken) / 1e18;

        if (c.maxTradeSizeUSDC > 0) {
            require(
                tradeSizeUSDC <= c.maxTradeSizeUSDC,
                "Trade size exceeds limit"
            );
        }

        // Daily volume check
        if (c.dailyVolumeCapUSDC > 0) {
            uint256 volumeUsed = c.dailyVolumeUsed;
            if (block.timestamp >= c.dailyVolumeReset + 1 days) {
                volumeUsed = 0; // reset for view purposes
            }
            require(
                volumeUsed + tradeSizeUSDC <= c.dailyVolumeCapUSDC,
                "Daily volume cap reached"
            );
        }

        // Price movement check
        if (c.maxPriceMovementBps > 0 && c.referencePrice > 0) {
            if (block.timestamp < c.referencePriceDate + 1 days) {
                uint256 priceDiffBps;
                if (pricePerToken > c.referencePrice) {
                    priceDiffBps = ((pricePerToken - c.referencePrice) * 10000)
                        / c.referencePrice;
                } else {
                    priceDiffBps = ((c.referencePrice - pricePerToken) * 10000)
                        / c.referencePrice;
                }
                require(
                    priceDiffBps <= c.maxPriceMovementBps,
                    "Price movement circuit breaker triggered"
                );
            }
        }

        return true;
    }

    // ─── TRADE RECORDING ──────────────────────────────────────────

    /**
     * @notice Record a completed trade — updates volume counters.
     *         Called by ExchangeSettlement after successful settlement.
     */
    function recordTrade(address token, uint256 usdcVolume)
        external
    {
        require(tokenRegistered[token], "Token not registered");

        TokenControls storage c = tokenControls[token];

        // Reset daily volume if new day
        if (block.timestamp >= c.dailyVolumeReset + 1 days) {
            c.dailyVolumeUsed  = 0;
            c.dailyVolumeReset = block.timestamp;
        }

        c.dailyVolumeUsed += usdcVolume;
        c.totalVolume     += usdcVolume;
        c.totalTrades     += 1;

        emit TradeRecorded(token, usdcVolume);
    }

    // ─── CIRCUIT BREAKERS ─────────────────────────────────────────

    /**
     * @notice Halt trading for a specific token.
     */
    function haltToken(address token, string calldata reason)
        external onlyRole(CIRCUIT_BREAKER)
    {
        require(tokenRegistered[token], "Not registered");
        tokenControls[token].halted     = true;
        tokenControls[token].haltReason = reason;

        // Also set market state on the token itself
        AssetToken(token).setMarketState(AssetToken.MarketState.HALTED);

        emit TokenHalted(token, reason);
    }

    /**
     * @notice Resume trading for a halted token.
     */
    function resumeToken(address token)
        external onlyRole(MARKET_ADMIN_ROLE)
    {
        require(tokenRegistered[token],        "Not registered");
        require(tokenControls[token].halted,   "Not halted");

        tokenControls[token].halted     = false;
        tokenControls[token].haltReason = "";

        AssetToken(token).setMarketState(AssetToken.MarketState.FULL_TRADING);

        emit TokenResumed(token);
    }

    /**
     * @notice Global emergency stop — halts ALL trading on the platform.
     */
    function setGlobalEmergencyStop(bool activate, string calldata reason)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        globalEmergencyStop = activate;
        emit GlobalEmergencyStop(activate, reason);
    }

    /**
     * @notice Enable or disable global trading.
     */
    function setGlobalTradingEnabled(bool enabled)
        external onlyRole(MARKET_ADMIN_ROLE)
    {
        globalTradingEnabled = enabled;
    }

    // ─── LIMIT MANAGEMENT ─────────────────────────────────────────

    function setDailyVolumeCap(address token, uint256 capUSDC)
        external onlyRole(MARKET_ADMIN_ROLE)
    {
        require(tokenRegistered[token], "Not registered");
        tokenControls[token].dailyVolumeCapUSDC = capUSDC;
        emit VolumeLimitUpdated(token, capUSDC);
    }

    function setMaxTradeSize(address token, uint256 maxUSDC)
        external onlyRole(MARKET_ADMIN_ROLE)
    {
        require(tokenRegistered[token], "Not registered");
        tokenControls[token].maxTradeSizeUSDC = maxUSDC;
        emit TradeSizeLimitUpdated(token, maxUSDC);
    }

    function setMaxPriceMovement(address token, uint256 bps)
        external onlyRole(MARKET_ADMIN_ROLE)
    {
        require(tokenRegistered[token], "Not registered");
        require(bps <= 10000,           "Max 100%");
        tokenControls[token].maxPriceMovementBps = bps;
    }

    function setReferencePrice(address token, uint256 price)
        external onlyRole(MARKET_ADMIN_ROLE)
    {
        require(tokenRegistered[token], "Not registered");
        tokenControls[token].referencePrice     = price;
        tokenControls[token].referencePriceDate = block.timestamp;
        emit ReferencePriceSet(token, price);
    }

    // ─── MARKET MAKERS ────────────────────────────────────────────

    /**
     * @notice Assign a Designated Market Maker to a token.
     */
    function assignMarketMaker(address token, address maker)
        external onlyRole(MARKET_ADMIN_ROLE)
    {
        require(tokenRegistered[token],          "Not registered");
        require(!isMarketMaker[token][maker],     "Already assigned");
        require(maker != address(0),             "Invalid maker");

        tokenMarketMakers[token].push(MarketMaker({
            wallet:     maker,
            token:      token,
            active:     true,
            assignedAt: block.timestamp
        }));

        isMarketMaker[token][maker] = true;

        emit MarketMakerAssigned(token, maker);
    }

    /**
     * @notice Remove a market maker.
     */
    function removeMarketMaker(address token, address maker)
        external onlyRole(MARKET_ADMIN_ROLE)
    {
        require(isMarketMaker[token][maker], "Not a market maker");

        isMarketMaker[token][maker] = false;

        MarketMaker[] storage makers = tokenMarketMakers[token];
        for (uint256 i = 0; i < makers.length; i++) {
            if (makers[i].wallet == maker) {
                makers[i].active = false;
                break;
            }
        }

        emit MarketMakerRemoved(token, maker);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────────────

    function getTokenControls(address token)
        external view returns (TokenControls memory)
    {
        return tokenControls[token];
    }

    function getMarketMakers(address token)
        external view returns (MarketMaker[] memory)
    {
        return tokenMarketMakers[token];
    }

    function getAllRegisteredTokens()
        external view returns (address[] memory)
    {
        return registeredTokens;
    }

    function getRemainingDailyVolume(address token)
        external view returns (uint256)
    {
        TokenControls storage c = tokenControls[token];
        if (c.dailyVolumeCapUSDC == 0) return type(uint256).max;

        uint256 used = c.dailyVolumeUsed;
        if (block.timestamp >= c.dailyVolumeReset + 1 days) used = 0;

        if (c.dailyVolumeCapUSDC <= used) return 0;
        return c.dailyVolumeCapUSDC - used;
    }

    function isTokenTradeable(address token)
        external view returns (bool)
    {
        if (globalEmergencyStop)           return false;
        if (!globalTradingEnabled)         return false;
        if (!tokenRegistered[token])       return false;
        TokenControls storage c = tokenControls[token];
        return c.tradingEnabled && !c.halted;
    }

    // ─── ADMIN ────────────────────────────────────────────────────

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}