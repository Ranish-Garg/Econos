import { Request, Response, NextFunction } from 'express';
import { getService } from '../config/services';
import { cronosConfig, getWorkerAddress } from '../config/cronos';
import { logger } from '../utils/logger';

/**
 * Extended Request with payment context
 */
export interface X402Request extends Request {
    paymentTxHash?: string;
    serviceName?: string;
}

/**
 * HTTP 402 Payment Required Response Body
 */
export interface PaymentRequiredResponse {
    error: 'payment_required';
    message: string;
    payment: {
        recipient: string;
        amount: string;
        amountWei: string;
        currency: string;
        chainId: number;
        network: string;
        rpcUrl: string;
        explorerUrl: string;
    };
    service: {
        name: string;
        description: string;
        endpoint: string;
    };
    instructions: string;
}

/**
 * x402 Middleware - Implements HTTP 402 Payment Required
 *
 * Checks for X-Payment header containing a transaction hash.
 * If missing, returns 402 with payment instructions.
 * If present, passes to verifyPayment middleware.
 */
export function x402Middleware(
    req: X402Request,
    res: Response,
    next: NextFunction
): void {
    const rawServiceName = req.params.serviceName;
    const serviceName: string | undefined = Array.isArray(rawServiceName)
        ? rawServiceName[0]
        : rawServiceName;
    const rawHeader = req.headers['x-payment'];
    const paymentHeader: string | undefined = Array.isArray(rawHeader)
        ? rawHeader[0]
        : rawHeader;

    // Get service configuration
    const service = getService(serviceName);
    if (!service) {
        res.status(404).json({
            error: 'not_found',
            message: `Service '${serviceName}' not found`,
            availableServices: Object.keys(require('../config/services').services),
        });
        return;
    }

    // Attach service name to request
    req.serviceName = serviceName;

    // Check for payment header
    if (!paymentHeader) {
        logger.info(`402 Payment Required for service: ${serviceName}`);

        const paymentRequired: PaymentRequiredResponse = {
            error: 'payment_required',
            message: 'Payment is required to access this service',
            payment: {
                recipient: getWorkerAddress(),
                amount: service.priceDisplay,
                amountWei: service.price.toString(),
                currency: cronosConfig.currencySymbol,
                chainId: cronosConfig.chainId,
                network: cronosConfig.networkName,
                rpcUrl: cronosConfig.rpcUrl,
                explorerUrl: cronosConfig.explorerUrl,
            },
            service: {
                name: service.name,
                description: service.description,
                endpoint: service.endpoint,
            },
            instructions: `Send ${service.priceDisplay} to ${getWorkerAddress()} on ${cronosConfig.networkName}, then retry with header: X-Payment: <txHash>`,
        };

        res.status(402).json(paymentRequired);
        return;
    }

    // Validate transaction hash format (0x + 64 hex chars)
    const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!txHashRegex.test(paymentHeader)) {
        res.status(400).json({
            error: 'invalid_payment',
            message:
                'Invalid transaction hash format. Expected: 0x followed by 64 hex characters',
        });
        return;
    }

    // Attach payment tx hash to request and proceed to verification
    req.paymentTxHash = paymentHeader;
    next();
}
