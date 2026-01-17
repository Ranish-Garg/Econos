// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface IWorkerRegistry {
    function isWorkerActive(address) external view returns (bool);
    function slashReputation(address, address) external;
}

contract NativeEscrow is ReentrancyGuard {
    IWorkerRegistry public registry;

    enum TaskStatus { OPEN, COMPLETED, DISPUTED, REFUNDED }

    struct Task {
        address master;
        address worker;
        uint256 amount;     // Native zkTCRO (Wei)
        uint256 deadline;
        TaskStatus status;
    }

    mapping(bytes32 => Task) public tasks;

    event TaskCreated(bytes32 indexed taskId, address master, address worker, uint256 amount);
    event TaskCompleted(bytes32 indexed taskId, bytes result);
    event TaskRefunded(bytes32 indexed taskId);
    event TaskDisputed(bytes32 indexed taskId);

    constructor(address _registry) {
        registry = IWorkerRegistry(_registry);
    }

    /**
     * @notice Master deposits zkTCRO to hire a worker
     */
    function depositTask(bytes32 _taskId, address _worker, uint256 _duration) external payable {
        require(msg.value > 0, "Deposit required");
        require(tasks[_taskId].amount == 0, "Task ID exists");
        require(registry.isWorkerActive(_worker), "Worker is banned or invalid");

        tasks[_taskId] = Task({
            master: msg.sender,
            worker: _worker,
            amount: msg.value,
            deadline: block.timestamp + _duration,
            status: TaskStatus.OPEN
        });

        emit TaskCreated(_taskId, msg.sender, _worker, msg.value);
    }

    /**
     * @notice Worker submits result. 
     * IMPORTANT: This is the target for Gasless Paymaster calls.
     */
    function submitWork(bytes32 _taskId, bytes calldata _result) external nonReentrant {
        Task storage t = tasks[_taskId];
        
        require(t.status == TaskStatus.OPEN, "Task not open");
        require(block.timestamp <= t.deadline, "Task expired");
        require(msg.sender == t.worker, "Not authorized worker");

        t.status = TaskStatus.COMPLETED;

        // Pay the worker
        (bool success, ) = payable(t.worker).call{value: t.amount}("");
        require(success, "Transfer failed");

        emit TaskCompleted(_taskId, _result);
    }

    /**
     * @notice Master recovers funds if deadline passes.
     * Triggers a Slash on the worker's reputation.
     */
    function refundAndSlash(bytes32 _taskId) external nonReentrant {
        Task storage t = tasks[_taskId];
        
        require(t.status == TaskStatus.OPEN, "Task not open");
        require(block.timestamp > t.deadline, "Not expired yet");
        require(msg.sender == t.master, "Not task master");

        t.status = TaskStatus.REFUNDED;

        // Punish the worker for failing to deliver
        registry.slashReputation(t.worker, msg.sender);

        // Refund the master
        (bool success, ) = payable(t.master).call{value: t.amount}("");
        require(success, "Refund failed");

        emit TaskRefunded(_taskId);
    }
}