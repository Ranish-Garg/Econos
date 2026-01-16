// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/WorkerRegistry.sol";
import "../src/NativeEscrow.sol";
import "../src/AgentPaymaster.sol";

contract DeployMarketplace is Script {
    function run() external {
        // Load Private Key from env
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy Registry
        WorkerRegistry registry = new WorkerRegistry();
        console.log("WorkerRegistry:", address(registry));

        // 2. Deploy Escrow (Linked to Registry)
        NativeEscrow escrow = new NativeEscrow(address(registry));
        console.log("NativeEscrow:", address(escrow));

        // 3. Link Registry to Escrow (So Escrow can slash reputation)
        registry.setEscrowContract(address(escrow));

        // 4. Deploy Paymaster (Linked to Escrow)
        AgentPaymaster paymaster = new AgentPaymaster(address(escrow));
        console.log("AgentPaymaster:", address(paymaster));

        // 5. Fund Paymaster (Gas Tank) - Send 1 zkTCRO
        // (bool success, ) = address(paymaster).call{value: 1 ether}("");
        // require(success, "Failed to fund paymaster");

        vm.stopBroadcast();
    }
}