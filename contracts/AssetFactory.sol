// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./AssetToken.sol";
import "./ComplianceManager.sol";
import "./PriceOracle.sol";

/**
 * @title AssetFactory
 * @notice Deploys new AssetToken instances as UUPS proxies.
 *         Stores SPV registration, jurisdiction, and IPFS
 *         document hashes for every deployed asset.
 *         Acts as the central registry of all platform assets.
 */
contract AssetFactory is AccessControl, Pausable {

    // ─── ROLES ────────────────────────────────────────────────────
    bytes32 public constant FACTORY_ADMIN  = keccak256("FACTORY_ADMIN");
    bytes32 public constant AUDITOR_ROLE   = keccak256("AUDITOR_ROLE");

    // ─── STRUCTS ──────────────────────────────────────────────────
    struct AssetRecord {
        address tokenAddress;
        string  name;
        string  ticker;
        AssetToken.AssetType assetType;
        string  jurisdiction;
        string  spvRegistrationNo;
        string  ipfsDocHash;          // IPFS hash of incorporation + legal docs
        address issuer;
        uint256 deployedAt;
        bool    active;
    }

    // ─── STATE ────────────────────────────────────────────────────
    address public immutable implementation; // AssetToken logic contract
    address public complianceManager;
    address public priceOracle;

    mapping(address  => AssetRecord) public assets;       // token => record
    mapping(string   => address)     public tickerToToken; // ticker => token
    address[]                        public allTokens;

    uint256 public totalAssetsDeployed;

    // ─── EVENTS ───────────────────────────────────────────────────
    event AssetDeployed(
        address indexed tokenAddress,
        address indexed issuer,
        string          ticker,
        AssetToken.AssetType assetType,
        string          spvRegistrationNo,
        string          ipfsDocHash
    );
    event AssetDeactivated(address indexed tokenAddress, string reason);
    event AssetDocumentUpdated(address indexed tokenAddress, string newIpfsHash);
    event ImplementationSet(address implementation);

    // ─── CONSTRUCTOR ──────────────────────────────────────────────
    constructor(
        address _complianceManager,
        address _priceOracle
    ) {
        require(_complianceManager != address(0), "Invalid compliance");
        require(_priceOracle       != address(0), "Invalid oracle");

        complianceManager = _complianceManager;
        priceOracle       = _priceOracle;

        // Deploy the AssetToken implementation (logic contract)
        implementation = address(new AssetToken());

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FACTORY_ADMIN,      msg.sender);
        _grantRole(AUDITOR_ROLE,       msg.sender);

        emit ImplementationSet(implementation);
    }

    // ─── DEPLOY ASSET ─────────────────────────────────────────────

    /**
     * @notice Deploy a new tokenized asset as a UUPS proxy.
     * @param name_              Token name e.g. "Acme Corp Equity"
     * @param symbol_            Token symbol e.g. "ACME"
     * @param ticker_            Display ticker e.g. "ACME"
     * @param assetType_         Enum: EQUITY, REAL_ESTATE, MINING, etc.
     * @param jurisdiction_      ISO country code e.g. "ZW"
     * @param spvRegNo_          Off-chain SPV registration number
     * @param ipfsDocHash_       IPFS hash of legal documents
     * @param authorisedSupply_  Maximum tokens that can be minted
     * @param nominalValueCents_ Nominal value in USD cents
     * @param issuer_            Wallet that will control this token
     */
    function deployAsset(
        string memory name_,
        string memory symbol_,
        string memory ticker_,
        AssetToken.AssetType assetType_,
        string memory jurisdiction_,
        string memory spvRegNo_,
        string memory ipfsDocHash_,
        uint256       authorisedSupply_,
        uint256       nominalValueCents_,
        address       issuer_
    ) external onlyRole(FACTORY_ADMIN) whenNotPaused returns (address) {
        require(bytes(ticker_).length > 0,          "Empty ticker");
        require(tickerToToken[ticker_] == address(0),"Ticker already exists");
        require(issuer_ != address(0),              "Invalid issuer");
        require(authorisedSupply_ > 0,              "Zero supply");

        // Encode the initializer call
        bytes memory initData = abi.encodeWithSelector(
            AssetToken.initialize.selector,
            name_,
            symbol_,
            ticker_,
            assetType_,
            jurisdiction_,
            spvRegNo_,
            ipfsDocHash_,
            authorisedSupply_,
            nominalValueCents_,
            complianceManager,
            priceOracle,
            issuer_
        );

        // Deploy UUPS proxy pointing to implementation
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        address tokenAddress = address(proxy);

        // Register in compliance manager
        ComplianceManager(complianceManager).registerToken(tokenAddress);

        // Store record
        assets[tokenAddress] = AssetRecord({
            tokenAddress:      tokenAddress,
            name:              name_,
            ticker:            ticker_,
            assetType:         assetType_,
            jurisdiction:      jurisdiction_,
            spvRegistrationNo: spvRegNo_,
            ipfsDocHash:       ipfsDocHash_,
            issuer:            issuer_,
            deployedAt:        block.timestamp,
            active:            true
        });

        tickerToToken[ticker_] = tokenAddress;
        allTokens.push(tokenAddress);
        totalAssetsDeployed++;

        emit AssetDeployed(
            tokenAddress, issuer_, ticker_,
            assetType_, spvRegNo_, ipfsDocHash_
        );

        return tokenAddress;
    }

    // ─── ASSET MANAGEMENT ─────────────────────────────────────────

    function deactivateAsset(address tokenAddress, string calldata reason)
        external onlyRole(FACTORY_ADMIN)
    {
        require(assets[tokenAddress].active, "Already inactive");
        assets[tokenAddress].active = false;
        emit AssetDeactivated(tokenAddress, reason);
    }

    function updateAssetDocument(
        address tokenAddress,
        string calldata newIpfsHash
    ) external onlyRole(FACTORY_ADMIN) {
        require(assets[tokenAddress].tokenAddress != address(0), "Asset not found");
        assets[tokenAddress].ipfsDocHash = newIpfsHash;

        // Also update on the token contract itself
        AssetToken(tokenAddress).updateIpfsDocHash(newIpfsHash);

        emit AssetDocumentUpdated(tokenAddress, newIpfsHash);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────────────

    function getAsset(address tokenAddress)
        external view returns (AssetRecord memory)
    {
        return assets[tokenAddress];
    }

    function getTokenByTicker(string calldata ticker)
        external view returns (address)
    {
        return tickerToToken[ticker];
    }

    function getAllTokens()
        external view returns (address[] memory)
    {
        return allTokens;
    }

    function getActiveTokens()
        external view returns (address[] memory)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < allTokens.length; i++) {
            if (assets[allTokens[i]].active) count++;
        }
        address[] memory active = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allTokens.length; i++) {
            if (assets[allTokens[i]].active) {
                active[idx++] = allTokens[i];
            }
        }
        return active;
    }

    function isRegisteredAsset(address tokenAddress)
        external view returns (bool)
    {
        return assets[tokenAddress].tokenAddress != address(0);
    }

    // ─── ADMIN ────────────────────────────────────────────────────

    function setComplianceManager(address newCompliance)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newCompliance != address(0), "Invalid address");
        complianceManager = newCompliance;
    }

    function setPriceOracle(address newOracle)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newOracle != address(0), "Invalid address");
        priceOracle = newOracle;
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}