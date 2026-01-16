import winston from 'winston';

/**
 * Logger configuration for Master Agent
 */
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'master-agent' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        }),
    ],
});

/**
 * Log a task-related event
 */
export function logTaskEvent(
    taskId: string,
    event: string,
    level: 'info' | 'warn' | 'error' | 'debug' = 'info',
    metadata?: Record<string, unknown>
): void {
    logger.log(level, `Task ${event}`, {
        taskId,
        event,
        ...metadata,
    });
}

/**
 * Log a worker-related event
 */
export function logWorkerEvent(
    workerAddress: string,
    event: string,
    level: 'info' | 'warn' | 'error' | 'debug' = 'info',
    metadata?: Record<string, unknown>
): void {
    logger.log(level, `Worker ${event}`, {
        worker: workerAddress,
        event,
        ...metadata,
    });
}

/**
 * Log a contract interaction
 */
export function logContractCall(
    contract: string,
    method: string,
    metadata?: Record<string, unknown>
): void {
    logger.debug(`Contract call: ${contract}.${method}`, {
        contract,
        method,
        ...metadata,
    });
}
