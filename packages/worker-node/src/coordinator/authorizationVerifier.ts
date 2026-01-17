/**
 * Authorization Verifier
 * 
 * Verifies EIP-712 task authorization signatures from master agents.
 * Prevents replay attacks through nonce tracking.
 */

import { ethers } from 'ethers';
import { cronosConfig } from '../config/cronos';
import { getContractAddresses, getEIP712Config } from '../config/contracts';
import { logger } from '../utils/logger';

/**
 * EIP-712 TypedData types for task authorization
 */
const EIP712_TYPES = {
    TaskAuthorization: [
        { name: 'taskId', type: 'bytes32' },
        { name: 'worker', type: 'address' },
        { name: 'expiresAt', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
    ],
};

/**
 * Task authorization message structure
 */
export interface TaskAuthorizationMessage {
    taskId: string;
    worker: string;
    expiresAt: bigint;
    nonce: bigint;
}

/**
 * Authorization verification result
 */
export interface AuthorizationResult {
    valid: boolean;
    signer?: string;
    error?: string;
}

/**
 * Task payload included with authorization
 */
export interface TaskPayload {
    serviceName: string;
    params: unknown;
}

/**
 * Full authorization data from master agent
 */
export interface TaskAuthorization {
    message: TaskAuthorizationMessage;
    signature: string;
    payload: TaskPayload;
}

/**
 * Authorization Verifier
 * 
 * Handles EIP-712 signature verification and nonce tracking.
 */
export class AuthorizationVerifier {
    private usedNonces: Map<string, Set<bigint>> = new Map();

    /**
     * Get EIP-712 domain for verification
     */
    private getDomain(): ethers.TypedDataDomain {
        const config = getEIP712Config();
        const contracts = getContractAddresses();

        return {
            name: config.name,
            version: config.version,
            chainId: cronosConfig.chainId,
            verifyingContract: contracts.nativeEscrow,
        };
    }

    /**
     * Verify a task authorization signature
     * 
     * Checks:
     * 1. Signature is valid EIP-712
     * 2. Recovered signer is the expected master
     * 3. Authorization has not expired
     * 4. Nonce has not been used before
     */
    verifyAuthorization(
        auth: TaskAuthorization,
        expectedMaster: string,
        workerAddress: string
    ): AuthorizationResult {
        try {
            const { message, signature } = auth;

            // Check worker address matches
            if (message.worker.toLowerCase() !== workerAddress.toLowerCase()) {
                return {
                    valid: false,
                    error: `Worker mismatch: expected ${workerAddress}, got ${message.worker}`,
                };
            }

            // Check expiration
            const now = BigInt(Math.floor(Date.now() / 1000));
            if (message.expiresAt <= now) {
                return {
                    valid: false,
                    error: `Authorization expired at ${message.expiresAt}, current time is ${now}`,
                };
            }

            // Check nonce hasn't been used
            if (this.isNonceUsed(expectedMaster, message.nonce)) {
                return {
                    valid: false,
                    error: `Nonce ${message.nonce} has already been used by ${expectedMaster}`,
                };
            }

            // Recover signer from EIP-712 signature
            const domain = this.getDomain();
            const recoveredSigner = ethers.verifyTypedData(
                domain,
                EIP712_TYPES,
                message,
                signature
            );

            // Verify signer matches expected master
            if (recoveredSigner.toLowerCase() !== expectedMaster.toLowerCase()) {
                return {
                    valid: false,
                    error: `Signer mismatch: expected ${expectedMaster}, recovered ${recoveredSigner}`,
                    signer: recoveredSigner,
                };
            }

            // Mark nonce as used
            this.markNonceUsed(expectedMaster, message.nonce);

            logger.info('Authorization verified', {
                taskId: message.taskId,
                master: expectedMaster,
                nonce: message.nonce.toString(),
            });

            return {
                valid: true,
                signer: recoveredSigner,
            };
        } catch (error) {
            logger.error('Authorization verification failed', { error });
            return {
                valid: false,
                error: `Signature verification failed: ${error}`,
            };
        }
    }

    /**
     * Check if a nonce has been used by a master
     */
    private isNonceUsed(master: string, nonce: bigint): boolean {
        const masterNonces = this.usedNonces.get(master.toLowerCase());
        if (!masterNonces) return false;
        return masterNonces.has(nonce);
    }

    /**
     * Mark a nonce as used
     */
    private markNonceUsed(master: string, nonce: bigint): void {
        const key = master.toLowerCase();
        let masterNonces = this.usedNonces.get(key);
        if (!masterNonces) {
            masterNonces = new Set();
            this.usedNonces.set(key, masterNonces);
        }
        masterNonces.add(nonce);
    }

    /**
     * Clear all used nonces (for testing)
     */
    clearNonces(): void {
        this.usedNonces.clear();
    }

    /**
     * Get count of used nonces for a master
     */
    getNonceCount(master: string): number {
        const masterNonces = this.usedNonces.get(master.toLowerCase());
        return masterNonces ? masterNonces.size : 0;
    }
}

// Singleton instance
let verifierInstance: AuthorizationVerifier | null = null;

/**
 * Get the singleton AuthorizationVerifier instance
 */
export function getAuthorizationVerifier(): AuthorizationVerifier {
    if (!verifierInstance) {
        verifierInstance = new AuthorizationVerifier();
    }
    return verifierInstance;
}
