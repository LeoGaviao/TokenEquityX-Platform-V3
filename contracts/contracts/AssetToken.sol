// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ComplianceManager.sol";
import "./PriceOracle.sol";

/**
 * @title AssetToken
 * @notice UUPS Upgradeable ERC-20 representing a tokenized asset on TokenEquityX V2.
 *         Supports: equity, real estate, mining rights, infrastructure, bonds.
 *         Every transfer is validated by ComplianceManager.
 *         Includes ticker symbol, asset type, market state machine.
 */
contract AssetToken is
    Initializable,
    ERC20Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // ─── ROLES ────────────────────────────────────────────────────
    bytes32 public constant ISSUER_ROLE       = keccak256("ISSUER_ROLE");
    bytes32 public constant OPERATOR_ROLE     = keccak256("OPERATOR_ROLE");
    bytes32 public constant MARKET_MAKER_ROLE = keccak256("MARKET_MAKER_ROLE");

    // ─── ENUMS ────────────────────────────────────────────────────
    enum AssetType {
        EQUITY,
        REAL_ESTATE,
        MINING,
        INFRASTRUCTURE,
        REIT,
        BOND,
        OTHER
    }

    enum MarketState {
        PRE_LAUNCH,
        P2P_ONLY,
        LIMITED_TRADING,
        FULL_TRADING,
        HALTED
    }

    // ─── STRUCTS ──────────────────────────────────────────────────
    struct AssetMetadata {
        string    ticker;
        AssetType assetType;
        string    jurisdiction;
        string    spvRegistrationNo;
        string    ipfsDocHash;
        uint256   authorisedSupply;
        uint256   nominalValueCents;
        uint256   issuanceDate;
    }

    // ─── STATE ────────────────────────────────────────────────────
    ComplianceManager public compliance;
    PriceOracle       public oracle;

    AssetMetadata public metadata;
    MarketState   public marketState;

    mapping(address => uint256) public lockupExpiry;
    address[]                   private _holders;
    mapping(address => bool)    private _isHolder;

    bool public transfersLocked;

    // ─── EVENTS ───────────────────────────────────────────────────
    event TokensIssued(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount, string reason);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount, string reason);
    event LockupSet(address indexed holder, uint256 expiry);
    event MarketStateChanged(MarketState oldState, MarketState newState);
    event TransferLockToggled(bool locked);
    event MetadataUpdated(string ipfsDocHash);

    // ─── INITIALIZER ──────────────────────────────────────────────
    function initialize(
        string memory name_,
        string memory symbol_,
        string memory ticker_,
        AssetType     assetType_,
        string memory jurisdiction_,
        string memory spvRegNo_,
        string memory ipfsDocHash_,
        uint256       authorisedSupply_,
        uint256       nominalValueCents_,
        address       complianceAddress_,
        address       oracleAddress_,
        address       issuer_
    ) public initializer {
        __ERC20_init(name_, symbol_);
        __AccessControl_init();
        __Pausable_init();

        require(complianceAddress_ != address(0), "Invalid compliance address");
        require(oracleAddress_     != address(0), "Invalid oracle address");
        require(issuer_            != address(0), "Invalid issuer address");

        compliance = ComplianceManager(complianceAddress_);
        oracle     = PriceOracle(oracleAddress_);

        metadata = AssetMetadata({
            ticker:            ticker_,
            assetType:         assetType_,
            jurisdiction:      jurisdiction_,
            spvRegistrationNo: spvRegNo_,
            ipfsDocHash:       ipfsDocHash_,
            authorisedSupply:  authorisedSupply_,
            nominalValueCents: nominalValueCents_,
            issuanceDate:      block.timestamp
        });

        marketState     = MarketState.PRE_LAUNCH;
        transfersLocked = false;

        _grantRole(DEFAULT_ADMIN_ROLE, issuer_);
        _grantRole(ISSUER_ROLE,        issuer_);
        _grantRole(OPERATOR_ROLE,      msg.sender);
    }

    // ─── ISSUANCE ─────────────────────────────────────────────────

    function issueTokens(
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(ISSUER_ROLE) whenNotPaused {
        require(
            totalSupply() + amount <= metadata.authorisedSupply,
            "Exceeds authorised supply"
        );
        require(compliance.isApproved(to), "Recipient not KYC approved");

        _addHolder(to);
        _mint(to, amount);
        emit TokensIssued(to, amount, reason);
    }

    function burnTokens(
        address from,
        uint256 amount,
        string calldata reason
    ) external onlyRole(ISSUER_ROLE) {
        _burn(from, amount);
        emit TokensBurned(from, amount, reason);
    }

    // ─── FORCED TRANSFER ──────────────────────────────────────────

    function forcedTransfer(
        address from,
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) {
        _transfer(from, to, amount);
        _addHolder(to);
        emit ForcedTransfer(from, to, amount, reason);
    }

    // ─── LOCKUP ───────────────────────────────────────────────────

    function setLockup(address holder, uint256 expiryTimestamp)
        external onlyRole(ISSUER_ROLE)
    {
        lockupExpiry[holder] = expiryTimestamp;
        emit LockupSet(holder, expiryTimestamp);
    }

    // ─── MARKET STATE MACHINE ─────────────────────────────────────

    function setMarketState(MarketState newState)
        external onlyRole(OPERATOR_ROLE)
    {
        emit MarketStateChanged(marketState, newState);
        marketState = newState;
    }

    function setTransferLock(bool locked)
        external onlyRole(OPERATOR_ROLE)
    {
        transfersLocked = locked;
        emit TransferLockToggled(locked);
    }

    // ─── METADATA ─────────────────────────────────────────────────

    function updateIpfsDocHash(string calldata newHash)
        external onlyRole(ISSUER_ROLE)
    {
        metadata.ipfsDocHash = newHash;
        emit MetadataUpdated(newHash);
    }

    // ─── TRANSFER OVERRIDE ────────────────────────────────────────

    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        if (from != address(0) && to != address(0)) {
            require(!transfersLocked, "Transfers are locked");
            require(
                block.timestamp > lockupExpiry[from],
                "Sender tokens are locked"
            );

            if (marketState == MarketState.PRE_LAUNCH) {
                require(
                    hasRole(OPERATOR_ROLE, msg.sender) ||
                    hasRole(ISSUER_ROLE,   msg.sender),
                    "Market not open: PRE_LAUNCH"
                );
            } else if (marketState == MarketState.HALTED) {
                require(
                    hasRole(OPERATOR_ROLE, msg.sender),
                    "Market halted"
                );
            }

            compliance.canTransfer(from, to, value);
        }

        super._update(from, to, value);

        if (to != address(0)) _addHolder(to);
    }

    // ─── CAP TABLE ────────────────────────────────────────────────

    function getCapTable()
        external view
        returns (address[] memory holders, uint256[] memory balances)
    {
        holders  = _holders;
        balances = new uint256[](_holders.length);
        for (uint256 i = 0; i < _holders.length; i++) {
            balances[i] = balanceOf(_holders[i]);
        }
    }

    function holderCount() external view returns (uint256) {
        return _holders.length;
    }

    // ─── INTERNAL ─────────────────────────────────────────────────

    function _addHolder(address addr) private {
        if (!_isHolder[addr] && addr != address(0)) {
            _holders.push(addr);
            _isHolder[addr] = true;
        }
    }

    // ─── UUPS UPGRADE AUTH ────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation)
        internal override onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    // ─── ADMIN ────────────────────────────────────────────────────

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}