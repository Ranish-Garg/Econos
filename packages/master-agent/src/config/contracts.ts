import { ethers } from 'ethers';
import { getMasterWallet, getProvider } from './cronos';

/**
 * Contract addresses from environment
 */
export const contractAddresses = {
    workerRegistry: process.env.WORKER_REGISTRY_ADDRESS || '',
    nativeEscrow: process.env.NATIVE_ESCROW_ADDRESS || '',
    agentPaymaster: process.env.AGENT_PAYMASTER_ADDRESS || '',
};

/**
 * WorkerRegistry ABI - subset of functions we need
 */
export const WORKER_REGISTRY_ABI = [
    'function workers(address) view returns (address walletAddress, bytes32 metadataPointer, uint8 reputation, bool isActive, uint256 registrationTime)',
    'function isWorkerActive(address _worker) view returns (bool)',
    'event WorkerRegistered(address indexed worker, bytes32 metadata)',
    'event WorkerSlashed(address indexed worker, address indexed slasher, uint8 newScore)',
    'event WorkerBanned(address indexed worker)',
];

/**
 * NativeEscrow ABI - Updated to match the "Gasless" version
 */
export const NATIVE_ESCROW_ABI = [
    'function depositTask(bytes32 _taskId, address _worker, uint256 _duration) payable',
    // CHANGED: string -> bytes
    'function submitWork(bytes32 _taskId, bytes calldata _result)',
    'function refundAndSlash(bytes32 _taskId)',
    'function tasks(bytes32) view returns (address master, address worker, uint256 amount, uint256 deadline, uint8 status)',
    'event TaskCreated(bytes32 indexed taskId, address master, address worker, uint256 amount)',
    // CHANGED: string -> bytes
    'event TaskCompleted(bytes32 indexed taskId, bytes result)',
    'event TaskRefunded(bytes32 indexed taskId)',
    'event TaskDisputed(bytes32 indexed taskId)',
];

/**
 * Get WorkerRegistry contract instance (read-only)
 */
export function getWorkerRegistryContract(): ethers.Contract {
    if (!contractAddresses.workerRegistry) {
        throw new Error('WORKER_REGISTRY_ADDRESS is not set');
    }
    return new ethers.Contract(
        contractAddresses.workerRegistry,
        WORKER_REGISTRY_ABI,
        getProvider()
    );
}

/**
 * Get WorkerRegistry contract instance with signer
 */
export function getWorkerRegistryContractWithSigner(): ethers.Contract {
    if (!contractAddresses.workerRegistry) {
        throw new Error('WORKER_REGISTRY_ADDRESS is not set');
    }
    return new ethers.Contract(
        contractAddresses.workerRegistry,
        WORKER_REGISTRY_ABI,
        getMasterWallet()
    );
}

/**
 * Get NativeEscrow contract instance (read-only)
 */
export function getNativeEscrowContract(): ethers.Contract {
    if (!contractAddresses.nativeEscrow) {
        throw new Error('NATIVE_ESCROW_ADDRESS is not set');
    }
    return new ethers.Contract(
        contractAddresses.nativeEscrow,
        NATIVE_ESCROW_ABI,
        getProvider()
    );
}

/**
 * Get NativeEscrow contract instance with signer
 */
export function getNativeEscrowContractWithSigner(): ethers.Contract {
    if (!contractAddresses.nativeEscrow) {
        throw new Error('NATIVE_ESCROW_ADDRESS is not set');
    }
    return new ethers.Contract(
        contractAddresses.nativeEscrow,
        NATIVE_ESCROW_ABI,
        getMasterWallet()
    );
}