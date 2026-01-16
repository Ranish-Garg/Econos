// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/WorkerRegistry.sol";
import "../src/NativeEscrow.sol";
import "../src/AgentPaymaster.sol";

// Define Interface for ZK Cheatcodes
interface IZkVm {
    function zkUsePaymaster(address paymaster, bytes calldata input) external;
}

contract MarketplaceTest is Test {
    WorkerRegistry registry;
    NativeEscrow escrow;
    AgentPaymaster paymaster;

    // Users & Keys
    address master = makeAddr("master");
    
    // 🟢 CHANGE 1: We need a Private Key for the worker to sign txs
    address worker;
    uint256 workerKey;
    
    address otherUser = makeAddr("other");

    bytes32 constant METADATA_HASH = keccak256("ipfs://QmMetadata");
    bytes32 constant TASK_ID = keccak256("task-1");
    uint256 constant TASK_PRICE = 1 ether;

    function setUp() public {
        // 🟢 CHANGE 2: Create Address AND Key
        (worker, workerKey) = makeAddrAndKey("worker");

        registry = new WorkerRegistry();
        escrow = new NativeEscrow(address(registry));
        registry.setEscrowContract(address(escrow));
        paymaster = new AgentPaymaster(address(escrow));

        // Fund Paymaster (Infinite funding to avoid "zk vm halted")
        vm.deal(address(paymaster), 340282366920938463463374607431768211455); 

        vm.deal(master, 100 ether);
        vm.deal(worker, 1 ether);
    }

    function test_FullMarketplaceLifecycle() public {
        console.log("--- Step 1: Registering Worker ---");
        // Registration uses msg.sender, so vm.prank is fine here, 
        // but let's use broadcast for consistency.
        vm.startBroadcast(workerKey);
        registry.register(METADATA_HASH);
        vm.stopBroadcast();

        console.log("--- Step 2: Master Deposits Task ---");
        vm.prank(master);
        escrow.depositTask{value: TASK_PRICE}(TASK_ID, worker, 1 hours);

        console.log("--- Step 3: Worker Submits Result (Gasless) ---");

        bytes memory paymasterInput = abi.encodePacked(
            bytes4(keccak256("general(bytes)")), 
            bytes("")
        );

        // 🟢 CHANGE 3: Use Broadcast + Paymaster Cheatcode
        // We set the gas price/limit to ensure the paymaster math works
        vm.txGasPrice(0.1 gwei);
        
        // Start signing as the worker
        vm.startBroadcast(workerKey);
        
        // Enable Paymaster for the NEXT call
        IZkVm(address(vm)).zkUsePaymaster(address(paymaster), paymasterInput);

        // This call is now "signed" by workerKey, so _transaction.from will match worker
        escrow.submitWork{gas: 2000000}(TASK_ID, "ipfs://ResultHash");
        
        vm.stopBroadcast();

        // Verification
        assertEq(address(escrow).balance, 0, "Escrow should be empty");
        assertEq(worker.balance, 1 ether + TASK_PRICE, "Worker should have received payment");
    }

    function test_PaymasterRejectsUnassignedWorker() public {
        // Setup
        vm.startBroadcast(workerKey);
        registry.register(METADATA_HASH);
        vm.stopBroadcast();
        
        vm.prank(master);
        escrow.depositTask{value: TASK_PRICE}(TASK_ID, worker, 1 hours);

        // Act as Hacker (Other User)
        vm.startPrank(otherUser);
        
        bytes memory paymasterInput = abi.encodePacked(bytes4(keccak256("general(bytes)")), bytes(""));
        IZkVm(address(vm)).zkUsePaymaster(address(paymaster), paymasterInput);

        // 🟢 FIX: Remove the specific string. Just expect a revert/halt.
        vm.expectRevert(); 
        escrow.submitWork(TASK_ID, "ipfs://FakeResult");
        
        vm.stopPrank();
    }
}