import { cronosConfig } from '../config/cronos';

/**
 * EIP-712 Domain for Econos protocol
 */
export const EIP712_DOMAIN = {
    name: 'Econos Master Agent',
    version: '1',
    chainId: cronosConfig.chainId,
    // verifyingContract is optional for off-chain signatures
};

/**
 * EIP-712 Types for Task Authorization
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
 * Authorization payload to be signed
 */
export interface AuthorizationPayload {
    /** Task ID as bytes32 */
    taskId: string;

    /** Assigned worker's address */
    worker: string;

    /** Expiration timestamp (Unix) */
    expiresAt: number;

    /** Nonce for replay protection */
    nonce: number;
}

/**
 * Signed authorization ready for delivery
 */
export interface SignedAuthorization {
    /** The original payload */
    payload: AuthorizationPayload;

    /** EIP-712 signature */
    signature: string;

    /** Master agent's address (signer) */
    signer: string;

    /** Domain data for verification */
    domain: typeof EIP712_DOMAIN;

    /** Type data for verification */
    types: Record<string, Array<{ name: string; type: string }>>;
}

/**
 * Nonce tracking for replay protection
 */
export interface NonceRecord {
    taskId: string;
    nonce: number;
    usedAt: number;
}
