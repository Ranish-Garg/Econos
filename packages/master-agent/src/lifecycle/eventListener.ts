import { ethers } from 'ethers';
import { getNativeEscrowContract } from '../config/contracts';
import { logger, logTaskEvent } from '../utils/logger';

/**
 * Event types emitted by NativeEscrow contract
 */
export interface TaskCreatedEvent {
    taskId: string;
    master: string;
    worker: string;
    amount: bigint;
}

export interface TaskCompletedEvent {
    taskId: string;
    resultHash: string;
}

export interface TaskRefundedEvent {
    taskId: string;
}

export interface TaskDisputedEvent {
    taskId: string;
}

/**
 * Event handler types
 */
export type TaskCreatedHandler = (event: TaskCreatedEvent) => void | Promise<void>;
export type TaskCompletedHandler = (event: TaskCompletedEvent) => void | Promise<void>;
export type TaskRefundedHandler = (event: TaskRefundedEvent) => void | Promise<void>;
export type TaskDisputedHandler = (event: TaskDisputedEvent) => void | Promise<void>;

/**
 * Event Listener
 * 
 * Subscribes to NativeEscrow contract events and routes them to handlers.
 */
export class EventListener {
    private escrowContract: ethers.Contract;
    private isListening: boolean = false;

    private taskCreatedHandlers: TaskCreatedHandler[] = [];
    private taskCompletedHandlers: TaskCompletedHandler[] = [];
    private taskRefundedHandlers: TaskRefundedHandler[] = [];
    private taskDisputedHandlers: TaskDisputedHandler[] = [];

    constructor() {
        this.escrowContract = getNativeEscrowContract();
    }

    /**
     * Start listening to events
     */
    start(): void {
        if (this.isListening) {
            logger.warn('Event listener already started');
            return;
        }

        this.setupEventHandlers();
        this.isListening = true;
        logger.info('Event listener started');
    }

    /**
     * Stop listening to events
     */
    stop(): void {
        if (!this.isListening) {
            return;
        }

        this.escrowContract.removeAllListeners();
        this.isListening = false;
        logger.info('Event listener stopped');
    }

    /**
     * Setup contract event handlers
     */
    private setupEventHandlers(): void {
        // TaskCreated event
        this.escrowContract.on(
            'TaskCreated',
            (taskId: string, master: string, worker: string, amount: bigint) => {
                const event: TaskCreatedEvent = { taskId, master, worker, amount };
                logTaskEvent(taskId, 'event_created', 'debug', {
                    master,
                    worker,
                    amount: amount.toString(),
                });
                this.taskCreatedHandlers.forEach(h => h(event));
            }
        );

        // TaskCompleted event
        this.escrowContract.on(
            'TaskCompleted',
            (taskId: string, resultHash: string) => {
                const event: TaskCompletedEvent = { taskId, resultHash };
                logTaskEvent(taskId, 'event_completed', 'debug', { resultHash });
                this.taskCompletedHandlers.forEach(h => h(event));
            }
        );

        // TaskRefunded event
        this.escrowContract.on('TaskRefunded', (taskId: string) => {
            const event: TaskRefundedEvent = { taskId };
            logTaskEvent(taskId, 'event_refunded', 'debug');
            this.taskRefundedHandlers.forEach(h => h(event));
        });

        // TaskDisputed event
        this.escrowContract.on('TaskDisputed', (taskId: string) => {
            const event: TaskDisputedEvent = { taskId };
            logTaskEvent(taskId, 'event_disputed', 'debug');
            this.taskDisputedHandlers.forEach(h => h(event));
        });
    }

    /**
     * Register a handler for TaskCreated events
     */
    onTaskCreated(handler: TaskCreatedHandler): () => void {
        this.taskCreatedHandlers.push(handler);
        return () => {
            const index = this.taskCreatedHandlers.indexOf(handler);
            if (index > -1) {
                this.taskCreatedHandlers.splice(index, 1);
            }
        };
    }

    /**
     * Register a handler for TaskCompleted events
     */
    onTaskCompleted(handler: TaskCompletedHandler): () => void {
        this.taskCompletedHandlers.push(handler);
        return () => {
            const index = this.taskCompletedHandlers.indexOf(handler);
            if (index > -1) {
                this.taskCompletedHandlers.splice(index, 1);
            }
        };
    }

    /**
     * Register a handler for TaskRefunded events
     */
    onTaskRefunded(handler: TaskRefundedHandler): () => void {
        this.taskRefundedHandlers.push(handler);
        return () => {
            const index = this.taskRefundedHandlers.indexOf(handler);
            if (index > -1) {
                this.taskRefundedHandlers.splice(index, 1);
            }
        };
    }

    /**
     * Register a handler for TaskDisputed events
     */
    onTaskDisputed(handler: TaskDisputedHandler): () => void {
        this.taskDisputedHandlers.push(handler);
        return () => {
            const index = this.taskDisputedHandlers.indexOf(handler);
            if (index > -1) {
                this.taskDisputedHandlers.splice(index, 1);
            }
        };
    }

    /**
     * Check if listener is active
     */
    isActive(): boolean {
        return this.isListening;
    }

    /**
     * Query historical events
     */
    async queryPastEvents(
        eventName: 'TaskCreated' | 'TaskCompleted' | 'TaskRefunded' | 'TaskDisputed',
        fromBlock: number = 0,
        toBlock: number | 'latest' = 'latest'
    ): Promise<ethers.Log[]> {
        const filter = this.escrowContract.filters[eventName]();
        return await this.escrowContract.queryFilter(filter, fromBlock, toBlock);
    }
}
