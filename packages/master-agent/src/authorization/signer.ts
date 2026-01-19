import { ethers } from 'ethers';
import { getMasterWallet, getMasterAddress } from '../config/cronos';
import {
    getEIP712Domain,
    EIP712_TYPE_DEFINITIONS,
    createAuthorizationMessage,
} from './eip712';
import { AuthorizationPayload, SignedAuthorization, NonceRecord } from '../types/authorization';
import { toBytes32, getCurrentTimestamp } from '../utils/hash';
import { logger, logTaskEvent } from '../utils/logger';

/**
 * Authorization Signer
 * * Generates and signs EIP-712 authorization payloads that authorize
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
     * Create a specific authorization with explicit parameters (Used by CLI/Demo)
     * This allows manual control over nonce and expiration.
     */
    async createAuthorization(
        taskId: string,
        workerAddress: string,
        expiresAt: number,
        nonce: number,
        taskPayload: { serviceName: string; params: unknown }
    ): Promise<{ signature: string; message: any; payload: any }> {
        const wallet = getMasterWallet();
        const domain = getEIP712Domain();

        // 1. Construct the EIP-712 Message
        // Note: We cast to BigInt here because EIP-712 signing expects it for uint256
        const message = {
            taskId: toBytes32(taskId),
            worker: workerAddress,
            expiresAt: BigInt(expiresAt),
            nonce: BigInt(nonce)
        };

        try {
            // 2. Sign the data
            const signature = await wallet.signTypedData(
                domain,
                EIP712_TYPE_DEFINITIONS,
                message
            );

            // 3. Record nonce usage locally
            this.recordNonce(taskId, nonce);

            logger.info('Created specific authorization', { 
                taskId, 
                worker: workerAddress,
                nonce 
            });

            return {
                signature,
                message,
                payload: taskPayload
            };
        } catch (error) {
            logger.error('Failed to create specific authorization', { taskId, error });
            throw error;
        }
    }

    /**
     * Sign an existing authorization payload
     */
    async signAuthorization(payload: AuthorizationPayload): Promise<SignedAuthorization> {
        const wallet = getMasterWallet();
        const domain = getEIP712Domain();

        const message = createAuthorizationMessage(
            payload.taskId,
            payload.worker,
            payload.expiresAt,
            payload.nonce
        );

        try {
            const signature = await wallet.signTypedData(
                domain,
                EIP712_TYPE_DEFINITIONS,
                message
            );

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
     * Get master agent address
     */
    getMasterAddress(): string {
        return getMasterAddress();
    }
}