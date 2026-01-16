import { ethers } from 'ethers';
import {
    getEscrowContract,
    getEscrowContractWithSigner,
    parseOnChainTask,
    OnChainTask,
    OnChainTaskStatus,
    isTaskOpen,
    isTaskExpired,
} from './contractInterface';
import { Task, TaskStatus, mapOnChainStatus } from '../types/task';
import { logger, logTaskEvent, logContractCall } from '../utils/logger';
import { toBytes32 } from '../utils/hash';
import { cronosConfig } from '../config/cronos';

/**
 * Result of an escrow deposit
 */
export interface DepositResult {
    success: boolean;
    txHash: string;
    blockNumber: number;
    gasUsed: bigint;
    effectiveGasPrice: bigint;
}

/**
 * Escrow Service
 * 
 * Handles on-chain escrow operations:
 * - Deposit funds for tasks
 * - Query task status
 * - Trigger refunds for expired tasks
 */
export class EscrowService {
    private escrowContract: ethers.Contract;
    private escrowContractSigner: ethers.Contract;

    constructor() {
        this.escrowContract = getEscrowContract();
        this.escrowContractSigner = getEscrowContractWithSigner();
    }

    /**
     * Deposit funds into escrow for a task
     * 
     * @param taskId - Task ID (will be converted to bytes32)
     * @param workerAddress - Assigned worker's address
     * @param durationSeconds - Duration in seconds until deadline
     * @param amountWei - Amount to deposit in wei
     */
    async depositTask(
        taskId: string,
        workerAddress: string,
        durationSeconds: number,
        amountWei: bigint
    ): Promise<DepositResult> {
        const taskIdBytes32 = toBytes32(taskId);

        logContractCall('NativeEscrow', 'depositTask', {
            taskId,
            worker: workerAddress,
            duration: durationSeconds,
            amount: ethers.formatEther(amountWei),
        });

        try {
            // Send transaction
            const tx = await this.escrowContractSigner.depositTask(
                taskIdBytes32,
                workerAddress,
                durationSeconds,
                { value: amountWei }
            );

            logTaskEvent(taskId, 'escrow_deposit_sent', 'info', {
                txHash: tx.hash,
            });

            // Wait for confirmation
            const receipt = await tx.wait(cronosConfig.blockConfirmations);

            const result: DepositResult = {
                success: true,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed,
                effectiveGasPrice: receipt.gasPrice || 0n,
            };

            logTaskEvent(taskId, 'escrow_deposit_confirmed', 'info', {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
            });

            return result;
        } catch (error) {
            logger.error('Escrow deposit failed', {
                taskId,
                worker: workerAddress,
                error: String(error),
            });
            throw error;
        }
    }

    /**
     * Get on-chain task data
     */
    async getTaskOnChain(taskId: string): Promise<OnChainTask | null> {
        const taskIdBytes32 = toBytes32(taskId);

        try {
            const rawData = await this.escrowContract.tasks(taskIdBytes32);
            const task = parseOnChainTask(rawData);

            // Check if task exists (amount > 0)
            if (task.amount === 0n) {
                return null;
            }

            return task;
        } catch (error) {
            logger.error('Failed to get task from chain', { taskId, error });
            return null;
        }
    }

    /**
     * Check if a task exists on-chain
     */
    async taskExists(taskId: string): Promise<boolean> {
        const task = await this.getTaskOnChain(taskId);
        return task !== null;
    }

    /**
     * Get task status from chain
     */
    async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
        const task = await this.getTaskOnChain(taskId);
        if (!task) return null;

        return mapOnChainStatus(task.status);
    }

    /**
     * Check if a task can be refunded (expired and still open)
     */
    async canRefund(taskId: string): Promise<boolean> {
        const task = await this.getTaskOnChain(taskId);
        if (!task) return false;

        return isTaskOpen(task) && isTaskExpired(task);
    }

    /**
     * Trigger refund and slash for an expired task
     */
    async refundAndSlash(taskId: string): Promise<DepositResult> {
        const taskIdBytes32 = toBytes32(taskId);

        // Verify task can be refunded
        const canRefund = await this.canRefund(taskId);
        if (!canRefund) {
            throw new Error('Task cannot be refunded (not expired or not open)');
        }

        logContractCall('NativeEscrow', 'refundAndSlash', { taskId });

        try {
            const tx = await this.escrowContractSigner.refundAndSlash(taskIdBytes32);

            logTaskEvent(taskId, 'refund_sent', 'info', { txHash: tx.hash });

            const receipt = await tx.wait(cronosConfig.blockConfirmations);

            const result: DepositResult = {
                success: true,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed,
                effectiveGasPrice: receipt.gasPrice || 0n,
            };

            logTaskEvent(taskId, 'refund_confirmed', 'info', {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
            });

            return result;
        } catch (error) {
            logger.error('Refund failed', { taskId, error: String(error) });
            throw error;
        }
    }

    /**
     * Subscribe to TaskCreated events
     */
    onTaskCreated(
        callback: (taskId: string, master: string, worker: string, amount: bigint) => void
    ): () => void {
        const handler = (
            taskId: string,
            master: string,
            worker: string,
            amount: bigint
        ) => {
            callback(taskId, master, worker, amount);
        };

        this.escrowContract.on('TaskCreated', handler);

        return () => {
            this.escrowContract.off('TaskCreated', handler);
        };
    }

    /**
     * Subscribe to TaskCompleted events
     */
    onTaskCompleted(
        callback: (taskId: string, resultHash: string) => void
    ): () => void {
        const handler = (taskId: string, result: string) => {
            callback(taskId, result);
        };

        this.escrowContract.on('TaskCompleted', handler);

        return () => {
            this.escrowContract.off('TaskCompleted', handler);
        };
    }

    /**
     * Subscribe to TaskRefunded events
     */
    onTaskRefunded(callback: (taskId: string) => void): () => void {
        const handler = (taskId: string) => {
            callback(taskId);
        };

        this.escrowContract.on('TaskRefunded', handler);

        return () => {
            this.escrowContract.off('TaskRefunded', handler);
        };
    }

    /**
     * Get escrow contract address
     */
    getEscrowAddress(): string {
        return this.escrowContract.target as string;
    }
}
