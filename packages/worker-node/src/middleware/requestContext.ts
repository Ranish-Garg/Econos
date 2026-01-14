import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { X402Request } from './x402';

/**
 * Extended Request with full context
 */
export interface ContextualRequest extends X402Request {
    requestId: string;
    requestTimestamp: number;
}

/**
 * Request Context Middleware
 * 
 * Attaches:
 * - Unique requestId (UUID v4) for tracking
 * - Timestamp for the request
 * - Service name from route params
 */
export function requestContextMiddleware(
    req: ContextualRequest,
    res: Response,
    next: NextFunction
): void {
    // Generate unique request ID
    req.requestId = uuidv4();

    // Capture current timestamp
    req.requestTimestamp = Math.floor(Date.now() / 1000);

    // Add request ID to response headers for client tracking
    res.setHeader('X-Request-Id', req.requestId);

    next();
}
