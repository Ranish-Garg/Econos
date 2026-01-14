import { Response, NextFunction } from 'express';
import { getProvider, getWorkerAddress, cronosConfig } from '../config/cronos';
import { getService } from '../config/services';
import { X402Request } from './x402';
import { logger } from '../utils/logger';

/**
 * In-memory set to track used transaction hashes (replay protection)
 * In production, use Redis or a database for persistence
 */
const usedTxHashes = new Set<string>();

/**
 * Verify Payment Middleware
 * 
 * Verifies that the X-Payment transaction hash:
 * 1. Exists on Cronos zkEVM
 * 2. Is confirmed with sufficient block confirmations
 * 3. Recipient matches worker address
 * 4. Value is >= service price
 * 5. Has not been used before (replay protection)
 */
export async function verifyPaymentMiddleware(
    req: X402Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const txHash = req.paymentTxHash;
    const serviceName = req.serviceName;

    if (!txHash || !serviceName) {
        res.status(400).json({
            error: 'missing_context',
            message: 'Missing payment transaction hash or service name',
        });
        return;
    }

    const service = getService(serviceName);
    if (!service) {
        res.status(404).json({
            error: 'not_found',
            message: `Service '${serviceName}' not found`,
        });
        return;
    }

    try {
        // Check for replay attack
        if (usedTxHashes.has(txHash.toLowerCase())) {
            logger.warn(`Replay attack detected: ${txHash}`);
            res.status(402).json({
                error: 'payment_already_used',
                message: 'This transaction has already been used for a previous request',
            });
            return;
        }

        const provider = getProvider();
        const workerAddress = getWorkerAddress().toLowerCase();

        // Fetch transaction
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
            res.status(402).json({
                error: 'transaction_not_found',
                message: 'Transaction not found on Cronos zkEVM. Please ensure the transaction is confirmed.',
            });
            return;
        }

        // Fetch transaction receipt for confirmation status
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            res.status(402).json({
                error: 'transaction_pending',
                message: 'Transaction is still pending. Please wait for confirmation and retry.',
            });
            return;
        }

        // Check if transaction was successful
        if (receipt.status !== 1) {
            res.status(402).json({
                error: 'transaction_failed',
                message: 'Transaction failed on-chain. Please send a new payment.',
            });
            return;
        }

        // Check block confirmations
        const currentBlock = await provider.getBlockNumber();
        const confirmations = currentBlock - receipt.blockNumber;
        if (confirmations < cronosConfig.blockConfirmations) {
            res.status(402).json({
                error: 'insufficient_confirmations',
                message: `Transaction needs ${cronosConfig.blockConfirmations} confirmations. Current: ${confirmations}. Please wait and retry.`,
            });
            return;
        }

        // Verify recipient
        if (tx.to?.toLowerCase() !== workerAddress) {
            res.status(402).json({
                error: 'wrong_recipient',
                message: `Payment was sent to wrong address. Expected: ${workerAddress}`,
            });
            return;
        }

        // Verify amount
        if (tx.value < service.price) {
            res.status(402).json({
                error: 'insufficient_payment',
                message: `Insufficient payment. Required: ${service.priceDisplay}, Received: ${tx.value.toString()} wei`,
            });
            return;
        }

        // Mark transaction as used (replay protection)
        usedTxHashes.add(txHash.toLowerCase());

        logger.info(`Payment verified for service ${serviceName}: ${txHash}`);

        // Payment verified - proceed to service execution
        next();
    } catch (error) {
        logger.error('Payment verification error:', error);
        res.status(500).json({
            error: 'verification_error',
            message: 'Failed to verify payment transaction. Please try again.',
        });
    }
}

/**
 * Clear used transaction hashes (for testing purposes)
 */
export function clearUsedTxHashes(): void {
    usedTxHashes.clear();
}

/**
 * Check if a transaction hash has been used
 */
export function isTxHashUsed(txHash: string): boolean {
    return usedTxHashes.has(txHash.toLowerCase());
}
