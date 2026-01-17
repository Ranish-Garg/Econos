// WorkerRegistry Contract ABI
export const WORKER_REGISTRY_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "OwnableInvalidOwner",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "OwnableUnauthorizedAccount",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "worker",
                "type": "address"
            }
        ],
        "name": "WorkerBanned",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "worker",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "bytes32",
                "name": "metadata",
                "type": "bytes32"
            }
        ],
        "name": "WorkerRegistered",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "worker",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "slasher",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint8",
                "name": "newScore",
                "type": "uint8"
            }
        ],
        "name": "WorkerSlashed",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "escrowContract",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_worker",
                "type": "address"
            }
        ],
        "name": "isWorkerActive",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "_metadataPointer",
                "type": "bytes32"
            }
        ],
        "name": "register",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_escrow",
                "type": "address"
            }
        ],
        "name": "setEscrowContract",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_worker",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "_slasher",
                "type": "address"
            }
        ],
        "name": "slashReputation",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "workers",
        "outputs": [
            {
                "internalType": "address",
                "name": "walletAddress",
                "type": "address"
            },
            {
                "internalType": "bytes32",
                "name": "metadataPointer",
                "type": "bytes32"
            },
            {
                "internalType": "uint8",
                "name": "reputation",
                "type": "uint8"
            },
            {
                "internalType": "bool",
                "name": "isActive",
                "type": "bool"
            },
            {
                "internalType": "uint256",
                "name": "registrationTime",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const

export const WORKER_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_WORKER_REGISTRY_ADDRESS || "0x41782A9EC58d7F3BA951E6ce5bf2De36077026E2") as `0x${string}`

export type WorkerMetadata = {
    name: string
    description: string
    category: string
    endpoint: string
    capabilities: string
    price: string
}
