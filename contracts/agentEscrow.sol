// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentEscrow is Ownable {
    mapping(string => bool) public processedDeliveries;
    uint256 public maxPaymentLimit = 50 * 10**18; // $50 limit

    event PaymentSettled(string deliveryId, address recipient, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function settlePayment(
        string memory _deliveryId,
        address payable _recipient,
        uint256 _amount,
        address _tokenAddress
    ) external onlyOwner {
        require(!processedDeliveries[_deliveryId], "Already paid");
        require(_amount <= maxPaymentLimit, "Exceeds agent threshold");

        processedDeliveries[_deliveryId] = true;

        if (_tokenAddress == address(0)) {
            require(address(this).balance >= _amount, "Insufficient ETH");
            _recipient.transfer(_amount);
        } else {
            IERC20 token = IERC20(_tokenAddress);
            require(token.balanceOf(address(this)) >= _amount, "Insufficient Tokens");
            token.transfer(_recipient, _amount);
        }

        emit PaymentSettled(_deliveryId, _recipient, _amount);
    }

    receive() external payable {}
}