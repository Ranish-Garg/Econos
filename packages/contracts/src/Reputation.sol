// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./EconosReputation.sol";

contract EconosRegistry is Ownable {
    struct AgentService {
        address provider;
        string manifestURI; // URL to JSON capabilities
        uint256 basePrice;  // Price in Wei
        bool isActive;
        uint256 stake;
    }

    EconosReputation public reputationContract;
    mapping(address => AgentService) public services;
    address[] public providerList;

    event ServiceRegistered(address indexed provider, string manifestURI, uint256 price);
    event ServiceUpdated(address indexed provider, uint256 newPrice, bool active);

    // Pass the address of the DEPLOYED EconosReputation contract here
    constructor(address _reputationContractAddress) Ownable(msg.sender) {
        reputationContract = EconosReputation(_reputationContractAddress);
    }

    function registerService(string calldata _manifestURI, uint256 _basePrice) external payable {
        // REQUIREMENT: Must stake at least 10 CRO (10 * 10^18 wei)
        require(msg.value >= 10 ether, "Minimum stake required: 10 CRO");
        require(services[msg.sender].provider == address(0), "Already registered");

        services[msg.sender] = AgentService({
            provider: msg.sender,
            manifestURI: _manifestURI,
            basePrice: _basePrice,
            isActive: true,
            stake: msg.value
        });

        providerList.push(msg.sender);

        // Calls the Reputation contract to initialize score
        reputationContract.initializeReputation(msg.sender);

        emit ServiceRegistered(msg.sender, _manifestURI, _basePrice);
    }

    function updatePrice(uint256 _newPrice) external {
        require(services[msg.sender].provider != address(0), "Not registered");
        services[msg.sender].basePrice = _newPrice;
        emit ServiceUpdated(msg.sender, _newPrice, services[msg.sender].isActive);
    }

    function getServiceCount() external view returns (uint256) {
        return providerList.length;
    }
    
    // Helper to withdraw stakes (for hackathon testing)
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}