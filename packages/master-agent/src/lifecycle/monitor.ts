import { EventListener } from './eventListener';
import { TaskStateMachine } from './stateMachine';
import { TaskManager } from '../task-formation/taskManager';
import { EscrowService } from '../escrow/escrowService';
import { Task, TaskStatus } from '../types/task';
import { logger, logTaskEvent } from '../utils/logger';
import { toBytes32 } from '../utils/hash';

/**
 * Monitor configuration
 */
export interface MonitorConfig {
    /** Interval in ms to check for expired tasks */
    expirationCheckInterval: number;

    /** Whether to auto-refund expired tasks */
    autoRefund: boolean;

    /** Callback when a task completes */
    onTaskComplete?: (task: Task, resultHash: string) => void | Promise<void>;

    /** Callback when a task is refunded */
    onTaskRefund?: (task: Task) => void | Promise<void>;

    /** Callback when a task fails */
    onTaskFail?: (task: Task, reason: string) => void | Promise<void>;
}

const DEFAULT_CONFIG: MonitorConfig = {
    expirationCheckInterval: 60000, // 1 minute
    autoRefund: true,
};

/**
 * Lifecycle Monitor
 * 
 * Monitors task lifecycle by:
 * - Subscribing to contract events
 * - Checking for expired tasks
 * - Triggering refunds when needed
 * - Updating task state based on events
 */
export class LifecycleMonitor {
    private eventListener: EventListener;
    private stateMachine: TaskStateMachine;
    private taskManager: TaskManager;
    private escrowService: EscrowService;
    private config: MonitorConfig;

    private isRunning: boolean = false;
    private expirationCheckTimer: NodeJS.Timeout | null = null;
    private unsubscribers: Array<() => void> = [];

    constructor(
        taskManager: TaskManager,
        escrowService: EscrowService,
        config: Partial<MonitorConfig> = {}
    ) {
        this.taskManager = taskManager;
        this.escrowService = escrowService;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.eventListener = new EventListener();
        this.stateMachine = new TaskStateMachine();
    }

    /**
     * Start monitoring
     */
    start(): void {
        if (this.isRunning) {
            logger.warn('Lifecycle monitor already running');
            return;
        }

        // Start event listener
        this.eventListener.start();

        // Subscribe to events
        this.subscribeToEvents();

        // Start expiration check timer
        if (this.config.autoRefund) {
            this.expirationCheckTimer = setInterval(
                () => this.checkExpiredTasks(),
                this.config.expirationCheckInterval
            );
        }

        this.isRunning = true;
        logger.info('Lifecycle monitor started');
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        // Stop event listener
        this.eventListener.stop();

        // Unsubscribe from events
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];

        // Stop expiration check timer
        if (this.expirationCheckTimer) {
            clearInterval(this.expirationCheckTimer);
            this.expirationCheckTimer = null;
        }

        this.isRunning = false;
        logger.info('Lifecycle monitor stopped');
    }

    /**
     * Subscribe to contract events
     */
    private subscribeToEvents(): void {
        // Handle TaskCreated
        const unsubCreated = this.eventListener.onTaskCreated(async (event) => {
            await this.handleTaskCreated(event.taskId, event.worker, event.amount);
        });
        this.unsubscribers.push(unsubCreated);

        // Handle TaskCompleted
        const unsubCompleted = this.eventListener.onTaskCompleted(async (event) => {
            await this.handleTaskCompleted(event.taskId, event.resultHash);
        });
        this.unsubscribers.push(unsubCompleted);

        // Handle TaskRefunded
        const unsubRefunded = this.eventListener.onTaskRefunded(async (event) => {
            await this.handleTaskRefunded(event.taskId);
        });
        this.unsubscribers.push(unsubRefunded);
    }

    /**
     * Handle TaskCreated event
     */
    private async handleTaskCreated(
        taskIdBytes32: string,
        worker: string,
        amount: bigint
    ): Promise<void> {
        // Find task by bytes32 ID
        const task = await this.findTaskByBytes32(taskIdBytes32);
        if (!task) {
            logger.debug('TaskCreated event for unknown task', { taskId: taskIdBytes32 });
            return;
        }

        try {
            // Transition to CREATED if valid
            if (this.stateMachine.isValidTransition(task.status, TaskStatus.CREATED)) {
                await this.taskManager.updateTaskStatus(task.taskId, TaskStatus.CREATED);
            }
        } catch (error) {
            logger.error('Failed to handle TaskCreated event', {
                taskId: task.taskId,
                error: String(error),
            });
        }
    }

    /**
     * Handle TaskCompleted event
     */
    private async handleTaskCompleted(
        taskIdBytes32: string,
        resultHash: string
    ): Promise<void> {
        const task = await this.findTaskByBytes32(taskIdBytes32);
        if (!task) {
            logger.debug('TaskCompleted event for unknown task', { taskId: taskIdBytes32 });
            return;
        }

        try {
            // Record completion
            await this.taskManager.recordCompletion(task.taskId, resultHash);

            logTaskEvent(task.taskId, 'completed', 'info', { resultHash });

            // Call callback if provided
            if (this.config.onTaskComplete) {
                await this.config.onTaskComplete(task, resultHash);
            }
        } catch (error) {
            logger.error('Failed to handle TaskCompleted event', {
                taskId: task.taskId,
                error: String(error),
            });
        }
    }

    /**
     * Handle TaskRefunded event
     */
    private async handleTaskRefunded(taskIdBytes32: string): Promise<void> {
        const task = await this.findTaskByBytes32(taskIdBytes32);
        if (!task) {
            logger.debug('TaskRefunded event for unknown task', { taskId: taskIdBytes32 });
            return;
        }

        try {
            await this.taskManager.updateTaskStatus(task.taskId, TaskStatus.REFUNDED);

            logTaskEvent(task.taskId, 'refunded', 'info');

            // Call callback if provided
            if (this.config.onTaskRefund) {
                await this.config.onTaskRefund(task);
            }
        } catch (error) {
            logger.error('Failed to handle TaskRefunded event', {
                taskId: task.taskId,
                error: String(error),
            });
        }
    }

    /**
     * Check for expired tasks and trigger refunds
     */
    private async checkExpiredTasks(): Promise<void> {
        try {
            const expiredTasks = await this.taskManager.getExpiredTasks();

            for (const task of expiredTasks) {
                if (this.stateMachine.canRefund(task.status)) {
                    await this.triggerRefund(task);
                }
            }
        } catch (error) {
            logger.error('Failed to check expired tasks', { error: String(error) });
        }
    }

    /**
     * Trigger refund for a task
     */
    private async triggerRefund(task: Task): Promise<void> {
        try {
            logTaskEvent(task.taskId, 'triggering_refund', 'info');

            await this.escrowService.refundAndSlash(task.taskId);

            // Status will be updated by event handler
        } catch (error) {
            logger.error('Failed to trigger refund', {
                taskId: task.taskId,
                error: String(error),
            });

            // Mark as failed if refund fails
            await this.taskManager.updateTaskStatus(task.taskId, TaskStatus.FAILED);

            if (this.config.onTaskFail) {
                await this.config.onTaskFail(task, String(error));
            }
        }
    }

    /**
     * Find a task by its bytes32 ID
     */
    private async findTaskByBytes32(taskIdBytes32: string): Promise<Task | null> {
        // The task store uses the original task ID, not bytes32
        // We need to search for tasks and match by bytes32 conversion
        // This is a limitation - in production, store bytes32 in task
        const statuses = this.stateMachine.getActiveStatuses();

        for (const status of statuses) {
            const tasks = await this.taskManager.getTasksByStatus(status);
            for (const task of tasks) {
                if (toBytes32(task.taskId) === taskIdBytes32) {
                    return task;
                }
            }
        }

        return null;
    }

    /**
     * Check if monitor is running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Get the state machine for external use
     */
    getStateMachine(): TaskStateMachine {
        return this.stateMachine;
    }

    /**
     * Manually trigger expiration check
     */
    async triggerExpirationCheck(): Promise<void> {
        await this.checkExpiredTasks();
    }
}
