import { cronosConfig } from '../config/cronos';
import { contractAddresses } from '../config/contracts';

/**
 * EIP-712 Domain Separator for Econos Master Agent
 * 
 * This domain uniquely identifies the signing context to prevent
 * cross-domain replay attacks.
 */
export const EIP712_DOMAIN = {
    name: 'Econos Master Agent',
    version: '1',
    chainId: cronosConfig.chainId,
    verifyingContract: contractAddresses.nativeEscrow || undefined,
};

/**
 * EIP-712 Types for Task Authorization
 * 
 * This structured data format ensures the authorization can be
 * verified both off-chain and potentially on-chain.
 */
export const EIP712_TYPES = {
    TaskAuthorization: [
        { name: 'taskId', type: 'bytes32' },
        { name: 'worker', type: 'address' },
        { name: 'expiresAt', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
    ],
};

/**
 * Type-safe EIP-712 domain for ethers.js
 */
export interface TypedDataDomain {
    name: string;
    version: string;
    chainId: number;
    verifyingContract?: string;
}

/**
 * Get the EIP-712 domain with current configuration
 */
export function getEIP712Domain(): TypedDataDomain {
    return {
        name: EIP712_DOMAIN.name,
        version: EIP712_DOMAIN.version,
        chainId: EIP712_DOMAIN.chainId,
        verifyingContract: EIP712_DOMAIN.verifyingContract,
    };
}

/**
 * EIP-712 type definitions for signing
 */
export const EIP712_TYPE_DEFINITIONS = {
    TaskAuthorization: EIP712_TYPES.TaskAuthorization,
};

/**
 * Authorization message structure matching EIP-712 types
 */
export interface TaskAuthorizationMessage {
    taskId: string;      // bytes32
    worker: string;      // address
    expiresAt: bigint;   // uint256
    nonce: bigint;       // uint256
}

/**
 * Create a TaskAuthorization message for signing
 */
export function createAuthorizationMessage(
    taskId: string,
    worker: string,
    expiresAt: number,
    nonce: number
): TaskAuthorizationMessage {
    return {
        taskId,
        worker,
        expiresAt: BigInt(expiresAt),
        nonce: BigInt(nonce),
    };
}
