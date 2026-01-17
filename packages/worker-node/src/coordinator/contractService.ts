/**
 * Contract Service
 * 
 * Provides a unified interface for interacting with on-chain contracts:
 * - NativeEscrow: Task deposits, work submission, task queries
 * - WorkerRegistry: Worker status checks
 * - AgentPaymaster: Gasless transaction support
 */

import { ethers } from 'ethers';
import { getProvider, getWorkerWallet, getWorkerAddress, cronosConfig } from '../config/cronos';
import { getContractAddresses } from '../config/contracts';
import { logger } from '../utils/logger';

/**
 * NativeEscrow ABI (minimal interface for worker operations)
 */
const ESCROW_ABI = [
    'event TaskCreated(bytes32 indexed taskId, address master, address worker, uint256 amount)',
    'event TaskCompleted(bytes32 indexed taskId, string result)',
    'event TaskRefunded(bytes32 indexed taskId)',
    'function tasks(bytes32) view returns (address master, address worker, uint256 amount, uint256 deadline, uint8 status)',
    'function submitWork(bytes32 _taskId, string calldata _resultHash) external',
];

/**
 * WorkerRegistry ABI (minimal interface)
 */
const REGISTRY_ABI = [
    'function isWorkerActive(address _worker) view returns (bool)',
    'function workers(address) view returns (address walletAddress, bytes32 metadataPointer, uint8 reputation, bool isActive, uint256 registrationTime)',
];

/**
 * Task status enum matching contract
 */
export enum OnChainTaskStatus {
    OPEN = 0,
    COMPLETED = 1,
    DISPUTED = 2,
    REFUNDED = 3,
}

/**
 * On-chain task data
 */
export interface OnChainTask {
    master: string;
    worker: string;
    amount: bigint;
    deadline: number;
    status: OnChainTaskStatus;
}

/**
 * TaskCreated event data
 */
export interface TaskCreatedEvent {
    taskId: string;
    master: string;
    worker: string;
    amount: bigint;
}

/**
 * Contract Service
 * 
 * Handles all interactions with on-chain contracts.
 */
export class ContractService {
    private provider: ethers.JsonRpcProvider;
    private escrowContract: ethers.Contract;
    private escrowContractSigner: ethers.Contract;
    private registryContract: ethers.Contract;
    private workerAddress: string;

    constructor() {
        const addresses = getContractAddresses();
        this.provider = getProvider();
        this.workerAddress = getWorkerAddress();

        // Read-only contracts
        this.escrowContract = new ethers.Contract(
            addresses.nativeEscrow,
            ESCROW_ABI,
            this.provider
        );
        this.registryContract = new ethers.Contract(
            addresses.workerRegistry,
            REGISTRY_ABI,
            this.provider
        );

        // Signer contract for write operations
        const wallet = getWorkerWallet();
        this.escrowContractSigner = new ethers.Contract(
            addresses.nativeEscrow,
            ESCROW_ABI,
            wallet
        );
    }

    /**
     * Get task data from escrow contract
     */
    async getTask(taskIdBytes32: string): Promise<OnChainTask | null> {
        try {
            const result = await this.escrowContract.tasks(taskIdBytes32);

            // Check if task exists (amount > 0)
            if (result.amount === 0n) {
                return null;
            }

            return {
                master: result.master,
                worker: result.worker,
                amount: result.amount,
                deadline: Number(result.deadline),
                status: Number(result.status) as OnChainTaskStatus,
            };
        } catch (error) {
            logger.error('Failed to get task from chain', { taskId: taskIdBytes32, error });
            return null;
        }
    }

    /**
     * Check if a task is open and not expired
     */
    async isTaskValid(taskIdBytes32: string): Promise<boolean> {
        const task = await this.getTask(taskIdBytes32);
        if (!task) return false;

        const now = Math.floor(Date.now() / 1000);
        return (
            task.status === OnChainTaskStatus.OPEN &&
            task.deadline > now &&
            task.worker.toLowerCase() === this.workerAddress.toLowerCase()
        );
    }

    /**
     * Submit work result to escrow contract
     * 
     * Note: In production, this would use the AgentPaymaster for gasless transactions.
     * For now, we submit directly from the worker wallet.
     */
    async submitWork(taskIdBytes32: string, resultHash: string): Promise<string> {
        logger.info('Submitting work on-chain', { taskId: taskIdBytes32, resultHash });

        try {
            const tx = await this.escrowContractSigner.submitWork(taskIdBytes32, resultHash);

            logger.info('submitWork transaction sent', { txHash: tx.hash });

            // Wait for confirmation
            const receipt = await tx.wait(cronosConfig.blockConfirmations);

            logger.info('submitWork confirmed', {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
            });

            return receipt.hash;
        } catch (error) {
            logger.error('Failed to submit work', { taskId: taskIdBytes32, error });
            throw error;
        }
    }

    /**
     * Check if this worker is active in the registry
     */
    async isWorkerActive(): Promise<boolean> {
        try {
            return await this.registryContract.isWorkerActive(this.workerAddress);
        } catch (error) {
            logger.error('Failed to check worker status', { error });
            return false;
        }
    }

    /**
     * Subscribe to TaskCreated events for this worker
     * 
     * @returns Cleanup function to unsubscribe
     */
    onTaskCreated(callback: (event: TaskCreatedEvent) => void): () => void {
        const filter = this.escrowContract.filters.TaskCreated(null, null, this.workerAddress);

        const handler = (
            taskId: string,
            master: string,
            worker: string,
            amount: bigint
        ) => {
            // Double-check worker matches (filter should handle this)
            if (worker.toLowerCase() === this.workerAddress.toLowerCase()) {
                callback({ taskId, master, worker, amount });
            }
        };

        this.escrowContract.on(filter, handler);

        logger.info('Subscribed to TaskCreated events', { worker: this.workerAddress });

        return () => {
            this.escrowContract.off(filter, handler);
            logger.info('Unsubscribed from TaskCreated events');
        };
    }

    /**
     * Subscribe to TaskCompleted events
     */
    onTaskCompleted(callback: (taskId: string, resultHash: string) => void): () => void {
        const handler = (taskId: string, result: string) => {
            callback(taskId, result);
        };

        this.escrowContract.on('TaskCompleted', handler);

        return () => {
            this.escrowContract.off('TaskCompleted', handler);
        };
    }

    /**
     * Get escrow contract address
     */
    getEscrowAddress(): string {
        return this.escrowContract.target as string;
    }

    /**
     * Get worker address
     */
    getWorkerAddress(): string {
        return this.workerAddress;
    }
}

// Singleton instance
let contractServiceInstance: ContractService | null = null;

/**
 * Get the singleton ContractService instance
 */
export function getContractService(): ContractService {
    if (!contractServiceInstance) {
        contractServiceInstance = new ContractService();
    }
    return contractServiceInstance;
}

/**
 * Convert a task ID string to bytes32
 */
export function toBytes32(taskId: string): string {
    // If already bytes32 format, return as-is
    if (taskId.startsWith('0x') && taskId.length === 66) {
        return taskId;
    }
    // Otherwise, hash the string to get bytes32
    return ethers.keccak256(ethers.toUtf8Bytes(taskId));
}
