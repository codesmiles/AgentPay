// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentPayEscrow
 * @notice Autonomous AI-agent-controlled USDT escrow.
 *         Only the owner (the AI agent wallet) can release, milestone, split, or freeze.
 *         Depositors fund escrows; couriers/recipients receive payment autonomously.
 */
contract AgentPayEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public usdtToken;
    uint256 public maxTxLimit = 10_000 * 1e6; // $10,000 USDT (6 decimals)

    enum EscrowStatus  { Active, PartiallyReleased, FullyReleased, Refunded, Frozen }
    enum PaymentType   { Full, Milestone, Split }

    struct Escrow {
        string   escrowId;
        address  depositor;
        address  recipient;
        uint256  totalAmount;
        uint256  releasedAmount;
        uint256  milestoneCount;
        uint256  milestonesCompleted;
        PaymentType  paymentType;
        EscrowStatus status;
        uint256  createdAt;
        string   metadataHash; // IPFS hash or off-chain ref
    }

    mapping(string => Escrow) public escrows;
    mapping(string => bool)   public processedDeliveries; // idempotency key

    // ── Events ────────────────────────────────────────────────────────────
    event EscrowCreated(
        string indexed escrowId,
        address indexed depositor,
        address indexed recipient,
        uint256 amount,
        PaymentType paymentType
    );
    event PaymentReleased(
        string indexed escrowId,
        string indexed deliveryId,
        address recipient,
        uint256 amount
    );
    event MilestoneReleased(
        string indexed escrowId,
        string indexed deliveryId,
        uint256 milestoneIndex,
        uint256 amount
    );
    event SplitPaymentReleased(
        string indexed escrowId,
        string indexed deliveryId,
        uint256 totalAmount
    );
    event EscrowRefunded(string indexed escrowId, address depositor, uint256 amount);
    event EscrowFrozen(string indexed escrowId, string reason);

    // ── Constructor ───────────────────────────────────────────────────────
    constructor(address _usdtToken, address _agentOwner) Ownable(_agentOwner) {
        usdtToken = IERC20(_usdtToken);
    }

    // ── Depositor: fund an escrow ─────────────────────────────────────────
    function deposit(
        string   calldata escrowId,
        address           recipient,
        uint256           amount,
        PaymentType       paymentType,
        uint256           milestoneCount,
        string   calldata metadataHash
    ) external nonReentrant {
        require(bytes(escrows[escrowId].escrowId).length == 0, "Escrow already exists");
        require(amount > 0 && amount <= maxTxLimit,             "Invalid amount");
        require(recipient != address(0),                        "Zero recipient");
        if (paymentType == PaymentType.Milestone) {
            require(milestoneCount > 0 && milestoneCount <= 20, "Bad milestone count");
        }

        usdtToken.safeTransferFrom(msg.sender, address(this), amount);

        escrows[escrowId] = Escrow({
            escrowId:            escrowId,
            depositor:           msg.sender,
            recipient:           recipient,
            totalAmount:         amount,
            releasedAmount:      0,
            milestoneCount:      milestoneCount,
            milestonesCompleted: 0,
            paymentType:         paymentType,
            status:              EscrowStatus.Active,
            createdAt:           block.timestamp,
            metadataHash:        metadataHash
        });

        emit EscrowCreated(escrowId, msg.sender, recipient, amount, paymentType);
    }

    // ── Agent: full or partial release ───────────────────────────────────
    function releasePayment(
        string calldata escrowId,
        string calldata deliveryId,
        uint256         amount
    ) external onlyOwner nonReentrant {
        require(!processedDeliveries[deliveryId], "Already settled");
        Escrow storage e = escrows[escrowId];
        require(_isActive(e.status),                                "Escrow not active");
        require(amount > 0 && e.releasedAmount + amount <= e.totalAmount, "Invalid amount");

        processedDeliveries[deliveryId] = true;
        e.releasedAmount += amount;
        e.status = (e.releasedAmount == e.totalAmount)
            ? EscrowStatus.FullyReleased
            : EscrowStatus.PartiallyReleased;

        usdtToken.safeTransfer(e.recipient, amount);
        emit PaymentReleased(escrowId, deliveryId, e.recipient, amount);
    }

    // ── Agent: release next milestone tranche ────────────────────────────
    function milestonePayment(
        string calldata escrowId,
        string calldata deliveryId
    ) external onlyOwner nonReentrant {
        require(!processedDeliveries[deliveryId], "Already settled");
        Escrow storage e = escrows[escrowId];
        require(_isActive(e.status),                              "Escrow not active");
        require(e.paymentType == PaymentType.Milestone,           "Not milestone escrow");
        require(e.milestonesCompleted < e.milestoneCount,         "All milestones done");

        uint256 amount          = e.totalAmount / e.milestoneCount;
        uint256 currentMilestone = e.milestonesCompleted;

        processedDeliveries[deliveryId] = true;
        e.milestonesCompleted++;
        e.releasedAmount += amount;
        e.status = (e.milestonesCompleted == e.milestoneCount)
            ? EscrowStatus.FullyReleased
            : EscrowStatus.PartiallyReleased;

        usdtToken.safeTransfer(e.recipient, amount);
        emit MilestoneReleased(escrowId, deliveryId, currentMilestone, amount);
    }

    // ── Agent: split payment across multiple recipients ───────────────────
    function splitPayment(
        string    calldata escrowId,
        string    calldata deliveryId,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        require(!processedDeliveries[deliveryId],          "Already settled");
        require(recipients.length == amounts.length && recipients.length > 0, "Invalid arrays");
        Escrow storage e = escrows[escrowId];
        require(_isActive(e.status), "Escrow not active");

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) total += amounts[i];
        require(e.releasedAmount + total <= e.totalAmount, "Exceeds balance");

        processedDeliveries[deliveryId] = true;
        e.releasedAmount += total;
        e.status = (e.releasedAmount == e.totalAmount)
            ? EscrowStatus.FullyReleased
            : EscrowStatus.PartiallyReleased;

        for (uint256 i = 0; i < recipients.length; i++) {
            usdtToken.safeTransfer(recipients[i], amounts[i]);
        }
        emit SplitPaymentReleased(escrowId, deliveryId, total);
    }

    // ── Depositor or agent: refund remaining ─────────────────────────────
    function refund(string calldata escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(msg.sender == e.depositor || msg.sender == owner(), "Unauthorized");
        require(_isActive(e.status), "Cannot refund");

        uint256 remaining = e.totalAmount - e.releasedAmount;
        require(remaining > 0, "Nothing to refund");

        e.status = EscrowStatus.Refunded;
        usdtToken.safeTransfer(e.depositor, remaining);
        emit EscrowRefunded(escrowId, e.depositor, remaining);
    }

    // ── Agent: freeze on fraud ────────────────────────────────────────────
    function freezeEscrow(string calldata escrowId, string calldata reason) external onlyOwner {
        Escrow storage e = escrows[escrowId];
        require(_isActive(e.status), "Cannot freeze");
        e.status = EscrowStatus.Frozen;
        emit EscrowFrozen(escrowId, reason);
    }

    // ── Admin ─────────────────────────────────────────────────────────────
    function setMaxTxLimit(uint256 newLimit) external onlyOwner { maxTxLimit = newLimit; }
    function setUsdtToken(address newToken)  external onlyOwner { usdtToken = IERC20(newToken); }

    // ── Views ─────────────────────────────────────────────────────────────
    function getEscrow(string calldata escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }

    function getContractBalance() external view returns (uint256) {
        return usdtToken.balanceOf(address(this));
    }

    function _isActive(EscrowStatus s) internal pure returns (bool) {
        return s == EscrowStatus.Active || s == EscrowStatus.PartiallyReleased;
    }
}
