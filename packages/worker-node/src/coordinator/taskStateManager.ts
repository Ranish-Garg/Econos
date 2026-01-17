/**
 * Task State Manager
 * 
 * Manages the lifecycle states of tasks being processed by the worker.
 * Provides in-memory tracking of task progress from PENDING to COMPLETED.
 */

import { logger } from '../utils/logger';

/**
 * Task lifecycle states
 */
export enum TaskState {
    /** Task event received, not yet verified */
    PENDING = 'PENDING',
    /** EIP-712 authorization verified */
    AUTHORIZED = 'AUTHORIZED',
    /** Compute execution in progress */
    RUNNING = 'RUNNING',
    /** submitWork transaction sent */
    SUBMITTED = 'SUBMITTED',
    /** TaskCompleted event observed, payment received */
    COMPLETED = 'COMPLETED',
    /** Task failed (auth, compute, or submission error) */
    FAILED = 'FAILED',
}

/**
 * Task record with full lifecycle data
 */
export interface TaskRecord {
    taskId: string;
    taskIdBytes32: string;
    state: TaskState;
    master: string;
    amount: bigint;
    deadline: number;
    serviceName?: string;
    payload?: unknown;
    resultHash?: string;
    submissionTxHash?: string;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    error?: string;
}

/**
 * Task statistics
 */
export interface TaskStats {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    totalEarnings: bigint;
}

/**
 * Task State Manager
 * 
 * Keeps track of all tasks processed by this worker instance.
 * Note: This is in-memory only. For production, use Redis or a database.
 */
export class TaskStateManager {
    private tasks: Map<string, TaskRecord> = new Map();

    /**
     * Create a new task record when TaskCreated event is received
     */
    createTask(
        taskId: string,
        taskIdBytes32: string,
        master: string,
        amount: bigint,
        deadline: number
    ): TaskRecord {
        const record: TaskRecord = {
            taskId,
            taskIdBytes32,
            state: TaskState.PENDING,
            master,
            amount,
            deadline,
            createdAt: Math.floor(Date.now() / 1000),
        };

        this.tasks.set(taskId, record);

        logger.debug('Task created', {
            taskId,
            master,
            amount: amount.toString(),
            deadline,
        });

        return record;
    }

    /**
     * Get a task record by ID
     */
    getTask(taskId: string): TaskRecord | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Update task state with optional additional data
     */
    updateState(
        taskId: string,
        newState: TaskState,
        data?: Partial<TaskRecord>
    ): TaskRecord | undefined {
        const task = this.tasks.get(taskId);
        if (!task) {
            logger.warn('Attempted to update non-existent task', { taskId });
            return undefined;
        }

        const oldState = task.state;
        task.state = newState;

        // Apply additional data
        if (data) {
            Object.assign(task, data);
        }

        // Set timestamps based on state
        if (newState === TaskState.RUNNING && !task.startedAt) {
            task.startedAt = Math.floor(Date.now() / 1000);
        }
        if (newState === TaskState.COMPLETED || newState === TaskState.FAILED) {
            task.completedAt = Math.floor(Date.now() / 1000);
        }

        logger.info('Task state updated', {
            taskId,
            from: oldState,
            to: newState,
            ...(data?.error && { error: data.error }),
        });

        return task;
    }

    /**
     * Mark task as authorized
     */
    markAuthorized(taskId: string, serviceName: string, payload: unknown): TaskRecord | undefined {
        return this.updateState(taskId, TaskState.AUTHORIZED, { serviceName, payload });
    }

    /**
     * Mark task as running (compute started)
     */
    markRunning(taskId: string): TaskRecord | undefined {
        return this.updateState(taskId, TaskState.RUNNING);
    }

    /**
     * Mark task as submitted with tx hash and result hash
     */
    markSubmitted(taskId: string, resultHash: string, txHash: string): TaskRecord | undefined {
        return this.updateState(taskId, TaskState.SUBMITTED, {
            resultHash,
            submissionTxHash: txHash,
        });
    }

    /**
     * Mark task as completed
     */
    markCompleted(taskId: string): TaskRecord | undefined {
        return this.updateState(taskId, TaskState.COMPLETED);
    }

    /**
     * Mark task as failed with error message
     */
    markFailed(taskId: string, error: string): TaskRecord | undefined {
        return this.updateState(taskId, TaskState.FAILED, { error });
    }

    /**
     * Get all tasks (for health endpoint)
     */
    getAllTasks(): TaskRecord[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Get tasks by state
     */
    getTasksByState(state: TaskState): TaskRecord[] {
        return Array.from(this.tasks.values()).filter(t => t.state === state);
    }

    /**
     * Get aggregate statistics
     */
    getStats(): TaskStats {
        const tasks = Array.from(this.tasks.values());

        return {
            total: tasks.length,
            pending: tasks.filter(t => t.state === TaskState.PENDING).length,
            running: tasks.filter(t => t.state === TaskState.RUNNING || t.state === TaskState.AUTHORIZED).length,
            completed: tasks.filter(t => t.state === TaskState.COMPLETED).length,
            failed: tasks.filter(t => t.state === TaskState.FAILED).length,
            totalEarnings: tasks
                .filter(t => t.state === TaskState.COMPLETED)
                .reduce((sum, t) => sum + t.amount, 0n),
        };
    }

    /**
     * Check if a task exists
     */
    hasTask(taskId: string): boolean {
        return this.tasks.has(taskId);
    }

    /**
     * Clear all tasks (for testing)
     */
    clear(): void {
        this.tasks.clear();
    }
}

// Singleton instance
let stateManagerInstance: TaskStateManager | null = null;

/**
 * Get the singleton TaskStateManager instance
 */
export function getTaskStateManager(): TaskStateManager {
    if (!stateManagerInstance) {
        stateManagerInstance = new TaskStateManager();
    }
    return stateManagerInstance;
}
