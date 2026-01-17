// WorkerRegistry Contract ABI
export const WORKER_REGISTRY_ABI = [
    {
      "type": "constructor",
      "inputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "escrowContract",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getAllWorkers",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32[]",
          "internalType": "bytes32[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getWorker",
      "inputs": [
        {
          "name": "_worker",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "walletAddress",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "metadataPointer",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "reputation",
          "type": "uint8",
          "internalType": "uint8"
        },
        {
          "name": "isActive",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "registrationTime",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getWorkerCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isWorkerActive",
      "inputs": [
        {
          "name": "_worker",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "register",
      "inputs": [
        {
          "name": "_metadataPointer",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "renounceOwnership",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setEscrowContract",
      "inputs": [
        {
          "name": "_escrow",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "slashReputation",
      "inputs": [
        {
          "name": "_worker",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "_slasher",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "transferOwnership",
      "inputs": [
        {
          "name": "newOwner",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "workerAddresses",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "workers",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "walletAddress",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "metadataPointer",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "reputation",
          "type": "uint8",
          "internalType": "uint8"
        },
        {
          "name": "isActive",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "registrationTime",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "event",
      "name": "OwnershipTransferred",
      "inputs": [
        {
          "name": "previousOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newOwner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "WorkerBanned",
      "inputs": [
        {
          "name": "worker",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "WorkerRegistered",
      "inputs": [
        {
          "name": "worker",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "metadata",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "WorkerSlashed",
      "inputs": [
        {
          "name": "worker",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "slasher",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "newScore",
          "type": "uint8",
          "indexed": false,
          "internalType": "uint8"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "OwnableInvalidOwner",
      "inputs": [
        {
          "name": "owner",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "OwnableUnauthorizedAccount",
      "inputs": [
        {
          "name": "account",
          "type": "address",
          "internalType": "address"
        }
      ]
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

