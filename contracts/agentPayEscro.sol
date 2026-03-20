// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentPayEscrow is Ownable {
    IERC20 public usdt;
    uint256 public maxTxLimit = 100 * 10**6; // $100 Limit for autonomy

    struct Payment {
        address recipient;
        uint256 amount;
        bool settled;
        string deliveryId;
    }

    mapping(string => bool) public processedDeliveries;

    event PaymentReleased(string indexed deliveryId, address recipient, uint256 amount);

    constructor(address _usdt) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
    }

    function releasePayment(
        string memory _deliveryId,
        address _recipient,
        uint256 _amount
    ) external onlyOwner {
        require(!processedDeliveries[_deliveryId], "Already settled");
        require(_amount <= maxTxLimit, "Exceeds agent threshold");
        require(usdt.balanceOf(address(this)) >= _amount, "Insufficient escrow funds");

        processedDeliveries[_deliveryId] = true;
        require(usdt.transfer(_recipient, _amount), "Transfer failed");

        emit PaymentReleased(_deliveryId, _recipient, _amount);
    }
}