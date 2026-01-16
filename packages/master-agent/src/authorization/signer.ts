import { ethers } from 'ethers';
import { getMasterWallet, getMasterAddress } from '../config/cronos';
import {
    getEIP712Domain,
    EIP712_TYPE_DEFINITIONS,
    createAuthorizationMessage,
    TaskAuthorizationMessage,
    TypedDataDomain,
} from './eip712';
import { AuthorizationPayload, SignedAuthorization, NonceRecord } from '../types/authorization';
import { toBytes32, getCurrentTimestamp } from '../utils/hash';
import { logger, logTaskEvent } from '../utils/logger';

/**
 * Authorization Signer
 * 
 * Generates and signs EIP-712 authorization payloads that authorize
 * workers to execute tasks on behalf of the master agent.
 */
export class AuthorizationSigner {
    private nonceCounter: number = 0;
    private usedNonces: Map<string, NonceRecord> = new Map();

    /**
     * Get the next nonce for a task
     */
    private getNextNonce(taskId: string): number {
        this.nonceCounter++;
        return this.nonceCounter;
    }

    /**
     * Record a used nonce
     */
    private recordNonce(taskId: string, nonce: number): void {
        this.usedNonces.set(`${taskId}-${nonce}`, {
            taskId,
            nonce,
            usedAt: getCurrentTimestamp(),
        });
    }

    /**
     * Check if a nonce has been used
     */
    isNonceUsed(taskId: string, nonce: number): boolean {
        return this.usedNonces.has(`${taskId}-${nonce}`);
    }

    /**
     * Generate an authorization payload
     * 
     * @param taskId - Task ID (will be converted to bytes32)
     * @param workerAddress - The worker being authorized
     * @param validitySeconds - How long the authorization is valid (default: 1 hour)
     */
    generateAuthorization(
        taskId: string,
        workerAddress: string,
        validitySeconds: number = 3600
    ): AuthorizationPayload {
        const taskIdBytes32 = toBytes32(taskId);
        const expiresAt = getCurrentTimestamp() + validitySeconds;
        const nonce = this.getNextNonce(taskId);

        return {
            taskId: taskIdBytes32,
            worker: workerAddress,
            expiresAt,
            nonce,
        };
    }

    /**
     * Sign an authorization payload using EIP-712
     */
    async signAuthorization(payload: AuthorizationPayload): Promise<SignedAuthorization> {
        const wallet = getMasterWallet();
        const domain = getEIP712Domain();

        // Create the message for signing
        const message = createAuthorizationMessage(
            payload.taskId,
            payload.worker,
            payload.expiresAt,
            payload.nonce
        );

        try {
            // Sign using EIP-712 typed data
            const signature = await wallet.signTypedData(
                domain,
                EIP712_TYPE_DEFINITIONS,
                message
            );

            // Record the nonce as used
            this.recordNonce(payload.taskId, payload.nonce);

            logTaskEvent(payload.taskId, 'authorization_signed', 'info', {
                worker: payload.worker,
                expiresAt: payload.expiresAt,
                nonce: payload.nonce,
            });

            return {
                payload,
                signature,
                signer: wallet.address,
                domain,
                types: EIP712_TYPE_DEFINITIONS,
            };
        } catch (error) {
            logger.error('Failed to sign authorization', {
                taskId: payload.taskId,
                error: String(error),
            });
            throw error;
        }
    }

    /**
     * Generate and sign an authorization in one step
     */
    async createSignedAuthorization(
        taskId: string,
        workerAddress: string,
        validitySeconds: number = 3600
    ): Promise<SignedAuthorization> {
        const payload = this.generateAuthorization(taskId, workerAddress, validitySeconds);
        return this.signAuthorization(payload);
    }

    /**
     * Verify a signature is valid (for testing/debugging)
     */
    async verifySignature(signedAuth: SignedAuthorization): Promise<boolean> {
        try {
            const message = createAuthorizationMessage(
                signedAuth.payload.taskId,
                signedAuth.payload.worker,
                signedAuth.payload.expiresAt,
                signedAuth.payload.nonce
            );

            const recoveredAddress = ethers.verifyTypedData(
                signedAuth.domain,
                signedAuth.types,
                message,
                signedAuth.signature
            );

            return recoveredAddress.toLowerCase() === signedAuth.signer.toLowerCase();
        } catch (error) {
            logger.error('Signature verification failed', { error });
            return false;
        }
    }

    /**
     * Check if an authorization has expired
     */
    isExpired(signedAuth: SignedAuthorization): boolean {
        return getCurrentTimestamp() > signedAuth.payload.expiresAt;
    }

    /**
     * Serialize authorization for transmission
     */
    serializeAuthorization(signedAuth: SignedAuthorization): string {
        return JSON.stringify({
            payload: {
                taskId: signedAuth.payload.taskId,
                worker: signedAuth.payload.worker,
                expiresAt: signedAuth.payload.expiresAt,
                nonce: signedAuth.payload.nonce,
            },
            signature: signedAuth.signature,
            signer: signedAuth.signer,
            domain: signedAuth.domain,
            types: signedAuth.types,
        });
    }

    /**
     * Deserialize authorization from transmission
     */
    deserializeAuthorization(serialized: string): SignedAuthorization {
        const parsed = JSON.parse(serialized);
        return {
            payload: parsed.payload,
            signature: parsed.signature,
            signer: parsed.signer,
            domain: parsed.domain,
            types: parsed.types,
        };
    }

    /**
     * Get master agent address
     */
    getMasterAddress(): string {
        return getMasterAddress();
    }

    /**
     * Clear used nonces (for cleanup)
     */
    clearOldNonces(maxAgeSeconds: number = 86400): void {
        const cutoff = getCurrentTimestamp() - maxAgeSeconds;

        for (const [key, record] of this.usedNonces.entries()) {
            if (record.usedAt < cutoff) {
                this.usedNonces.delete(key);
            }
        }
    }
}
