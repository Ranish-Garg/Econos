// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "@matterlabs/zksync-contracts/interfaces/IPaymaster.sol";
import {Transaction} from "@matterlabs/zksync-contracts/libraries/TransactionHelper.sol";

interface IEscrowReader {
    function tasks(bytes32) external view returns (address, address, uint256, uint256, uint8);
}

contract AgentPaymaster is IPaymaster {
    address public escrowContract;
    address public owner;
    address constant BOOTLOADER_ADDRESS = 0x0000000000000000000000000000000000008001;

    constructor(address _escrow) {
        escrowContract = _escrow;
        owner = msg.sender;
    }

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_ADDRESS, "Only bootloader can call this");
        _;
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader returns (bytes4 magic, bytes memory context) {
        // 1. SECURITY: Check Target
        require(address(uint160(_transaction.to)) == escrowContract, "Paymaster: Invalid target");

        // 2. LOGIC: Check Selector 
        // Must match 'submitWork(bytes32,string)' or 'submitWork(bytes32,bytes)'
        // Based on your trace, it is 0xcfdf46c7 (bytes32, bytes)
        // If you change the Escrow function signature, update this!
        require(_transaction.data.length >= 4, "Paymaster: Data too short");
        bytes4 selector = bytes4(_transaction.data[0:4]);
        require(selector == 0xcfdf46c7, "Paymaster: Only submitWork allowed");

        // 3. LOGIC: Decode TaskID
        require(_transaction.data.length >= 36, "Paymaster: Data too short for taskId");
        bytes32 taskId;
        bytes calldata data = _transaction.data;
        assembly {
            taskId := calldataload(add(data.offset, 4))
        }

        // 4. VERIFICATION: Check Worker Assignment
        (, address assignedWorker, , , ) = IEscrowReader(escrowContract).tasks(taskId);
        address sender = address(uint160(_transaction.from));
        require(sender == assignedWorker, "Paymaster: Sender is not the assigned worker");

        // 5. PAYMENT
        uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;
        (bool success, ) = payable(BOOTLOADER_ADDRESS).call{value: requiredETH}("");
        require(success, "Paymaster: Failed to pay bootloader");

        return (PAYMASTER_VALIDATION_SUCCESS_MAGIC, new bytes(0));
    }

    function postTransaction(bytes calldata, Transaction calldata, bytes32, bytes32, ExecutionResult, uint256) external payable override onlyBootloader {}
    receive() external payable {}
}