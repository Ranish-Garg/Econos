/**
 * Contract Service (Gasless Edition)
 * * Provides a unified interface for interacting with on-chain contracts on Cronos zkEVM.
 * Uses zksync-ethers to enable Paymaster (gas sponsorship) support.
 */

import { Provider, Wallet, Contract, utils } from 'zksync-ethers'; // CRITICAL: Use zksync-ethers
import { ethers } from 'ethers'; // Keep for standard utilities
import { getWorkerAddress, cronosConfig } from '../config/cronos';
import { getContractAddresses } from '../config/contracts';
import { logger } from '../utils/logger';

/**
 * NativeEscrow ABI (minimal interface for worker operations)
 * Note: submitWork defined as taking 'bytes' to match Paymaster selector 0xcfdf46c7
 */
const ESCROW_ABI = [
    'event TaskCreated(bytes32 indexed taskId, address master, address worker, uint256 amount)',
    'event TaskCompleted(bytes32 indexed taskId, string result)',
    'event TaskRefunded(bytes32 indexed taskId)',
    'function tasks(bytes32) view returns (address master, address worker, uint256 amount, uint256 deadline, uint8 status)',
    // We use 'bytes' here to match the Paymaster's hardcoded selector (0xcfdf46c7).
    // Ensure your Solidity contract uses: function submitWork(bytes32 _taskId, bytes calldata _resultHash)
    'function submitWork(bytes32 _taskId, bytes calldata _resultHash) external',
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
 * * Handles all interactions with on-chain contracts using zkSync-specific features.
 */
export class ContractService {
    private provider: Provider;
    private wallet: Wallet;
    private escrowContract: Contract;
    private registryContract: Contract;
    private workerAddress: string;

    constructor() {
        const addresses = getContractAddresses();
        
        // 1. Initialize zkSync Provider
        this.provider = new Provider(cronosConfig.rpcUrl);

        // 2. Initialize zkSync Wallet
        // This is required to sign the EIP-712 transaction for the Paymaster
        const privateKey = process.env.WORKER_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('WORKER_PRIVATE_KEY is not set in environment variables');
        }
        this.wallet = new Wallet(privateKey, this.provider);
        this.workerAddress = this.wallet.address;

        // 3. Connect Escrow Contract to zkSync Wallet
        // This allows us to send write transactions
        this.escrowContract = new Contract(
            addresses.nativeEscrow,
            ESCROW_ABI,
            this.wallet 
        );

        // 4. Connect Registry Contract (Read-only is fine)
        this.registryContract = new Contract(
            addresses.workerRegistry,
            REGISTRY_ABI,
            this.provider
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
     * Submit work result to escrow contract via Paymaster
     * * This uses EIP-712 with customData to invoke the Paymaster, ensuring the
     * worker does not pay gas fees.
     */
    async submitWork(taskIdBytes32: string, resultHash: string): Promise<string> {
        logger.info('Submitting work on-chain (Gasless)', { taskId: taskIdBytes32, resultHash });

        const addresses = getContractAddresses();

        try {
            // 1. Construct Paymaster Params
            // The "General" flow is standard for sponsorship paymasters
            const paymasterParams = utils.getPaymasterParams(addresses.paymaster, {
                type: 'General',
                innerInput: new Uint8Array(),
            });

            // 2. Convert result string to bytes to match the Paymaster selector (0xcfdf46c7)
            const resultBytes = ethers.toUtf8Bytes(resultHash);

            // 3. Send the Gasless Transaction
            const tx = await this.escrowContract.submitWork(taskIdBytes32, resultBytes, {
                customData: {
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                    paymasterParams: paymasterParams,
                },
            });

            logger.info('submitWork transaction sent', { txHash: tx.hash });

            // 4. Wait for confirmation
            const receipt = await tx.wait();

            logger.info('submitWork confirmed', {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(), // Paid by Paymaster!
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
     */
    onTaskCreated(callback: (event: TaskCreatedEvent) => void): () => void {
        // Create filter for: TaskCreated(indexed taskId, address master, indexed worker, amount)
        // We filter by the 3rd topic (worker address)
        const filter = this.escrowContract.filters.TaskCreated(null, null, this.workerAddress);

        const handler = (
            taskId: string,
            master: string,
            worker: string,
            amount: bigint
        ) => {
            // Double-check worker matches
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
    if (taskId.startsWith('0x') && taskId.length === 66) {
        return taskId;
    }
    return ethers.keccak256(ethers.toUtf8Bytes(taskId));
}