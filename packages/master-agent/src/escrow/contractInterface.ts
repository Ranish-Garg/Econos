import { ethers } from 'ethers';
import { NATIVE_ESCROW_ABI, contractAddresses } from '../config/contracts';
import { getProvider, getMasterWallet } from '../config/cronos';

/**
 * Get NativeEscrow contract instance (read-only)
 */
export function getEscrowContract(): ethers.Contract {
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
export function getEscrowContractWithSigner(): ethers.Contract {
    if (!contractAddresses.nativeEscrow) {
        throw new Error('NATIVE_ESCROW_ADDRESS is not set');
    }
    return new ethers.Contract(
        contractAddresses.nativeEscrow,
        NATIVE_ESCROW_ABI,
        getMasterWallet()
    );
}

/**
 * On-chain task status enum matches NativeEscrow.sol
 */
export enum OnChainTaskStatus {
    OPEN = 0,
    COMPLETED = 1,
    DISPUTED = 2,
    REFUNDED = 3,
}

/**
 * Parsed on-chain task data
 */
export interface OnChainTask {
    master: string;
    worker: string;
    amount: bigint;
    deadline: bigint;
    status: OnChainTaskStatus;
}

/**
 * Parse raw task data from contract
 */
export function parseOnChainTask(rawData: unknown[]): OnChainTask {
    return {
        master: rawData[0] as string,
        worker: rawData[1] as string,
        amount: rawData[2] as bigint,
        deadline: rawData[3] as bigint,
        status: Number(rawData[4]) as OnChainTaskStatus,
    };
}

/**
 * Check if a task exists on-chain
 */
export function isTaskOnChain(task: OnChainTask): boolean {
    return task.amount > 0n;
}

/**
 * Check if a task is still open
 */
export function isTaskOpen(task: OnChainTask): boolean {
    return task.status === OnChainTaskStatus.OPEN;
}

/**
 * Check if a task has expired
 */
export function isTaskExpired(task: OnChainTask): boolean {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return now > task.deadline;
}
