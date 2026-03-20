// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDT
 * @notice Mintable ERC-20 with 6 decimals — mirrors real USDT for local/testnet demos.
 */
contract MockUSDT is ERC20, Ownable {
    constructor(address initialOwner)
        ERC20("Mock USD Tether", "mUSDT")
        Ownable(initialOwner)
    {
        // Mint 1,000,000 USDT to deployer for demo funding
        _mint(initialOwner, 1_000_000 * 1e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Faucet — lets anyone mint for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
