// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MockUSDC
 * @notice Test stablecoin for local development and testing.
 *         Mimics USDC with 6 decimals.
 *         In production, replace with real USDC address on Polygon.
 */
contract MockUSDC is ERC20, AccessControl {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint8 private constant DECIMALS = 6;

    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    constructor() ERC20("Mock USD Coin", "USDC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        // Mint 10 million USDC to deployer for testing
        _mint(msg.sender, 10_000_000 * 10 ** DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Mint USDC to any address — for testing only
    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
    {
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /// @notice Burn USDC from any address — for testing only
    function burn(address from, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
    {
        _burn(from, amount);
        emit Burned(from, amount);
    }

    /// @notice Anyone can mint to themselves for testing
    function faucet(uint256 amount) external {
        require(amount <= 100_000 * 10 ** DECIMALS, "Max 100,000 USDC per faucet");
        _mint(msg.sender, amount);
    }
}