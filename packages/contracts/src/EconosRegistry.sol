// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EconosReputation is Ownable {
    using ECDSA for bytes32;

    struct RepScore {
        uint256 totalInferences;
        uint256 successfulVerifications;
        int256 netScore; 
    }

    address public registryAddress;
    mapping(address => RepScore) public scores;

    event ReputationUpdated(address indexed worker, int256 newScore);
    event RegistryAddressUpdated(address indexed newRegistry);

    modifier onlyRegistry() {
        require(msg.sender == registryAddress, "Caller must be EconosRegistry");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function updateRegistryAddress(address _registry) external onlyOwner {
        registryAddress = _registry;
        emit RegistryAddressUpdated(_registry);
    }

    function initializeReputation(address _agent) external onlyRegistry {
        scores[_agent] = RepScore(0, 0, 100); // Start with 100 points
    }

    function verifyWorkerPerformance(
        address _worker,
        bytes32 _dataHash,
        bytes calldata _signature
    ) external {
        // 1. Recreate the signed message hash
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(_dataHash);
        
        // 2. Recover signer
        address recoveredSigner = ethSignedHash.recover(_signature);

        require(recoveredSigner == _worker, "Signature mismatch: Data not signed by worker");

        // 3. Update Score
        scores[_worker].totalInferences += 1;
        scores[_worker].successfulVerifications += 1;
        scores[_worker].netScore += 1;
        
        emit ReputationUpdated(_worker, scores[_worker].netScore);
    }

    function slashWorker(address _worker, uint256 _penalty) external onlyOwner {
        scores[_worker].netScore -= int256(_penalty);
        emit ReputationUpdated(_worker, scores[_worker].netScore);
    }

    function getReputation(address _worker) external view returns (int256) {
        return scores[_worker].netScore;
    }
}