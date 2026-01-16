import { TaskStatus } from '../types/task';
import { logger, logTaskEvent } from '../utils/logger';

/**
 * Valid state transitions for tasks
 */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
    [TaskStatus.PENDING]: [TaskStatus.CREATED, TaskStatus.FAILED],
    [TaskStatus.CREATED]: [TaskStatus.AUTHORIZED, TaskStatus.REFUNDED, TaskStatus.FAILED],
    [TaskStatus.AUTHORIZED]: [TaskStatus.RUNNING, TaskStatus.REFUNDED, TaskStatus.FAILED],
    [TaskStatus.RUNNING]: [TaskStatus.COMPLETED, TaskStatus.REFUNDED, TaskStatus.FAILED],
    [TaskStatus.COMPLETED]: [], // Terminal state
    [TaskStatus.REFUNDED]: [], // Terminal state
    [TaskStatus.FAILED]: [], // Terminal state
};

/**
 * Task State Machine
 * 
 * Manages valid state transitions for tasks and provides
 * validation and transition execution.
 */
export class TaskStateMachine {
    /**
     * Check if a transition is valid
     */
    isValidTransition(fromStatus: TaskStatus, toStatus: TaskStatus): boolean {
        const validNextStates = VALID_TRANSITIONS[fromStatus];
        return validNextStates.includes(toStatus);
    }

    /**
     * Get valid next states for a given status
     */
    getValidNextStates(status: TaskStatus): TaskStatus[] {
        return VALID_TRANSITIONS[status];
    }

    /**
     * Check if a status is a terminal state
     */
    isTerminalState(status: TaskStatus): boolean {
        return VALID_TRANSITIONS[status].length === 0;
    }

    /**
     * Validate and return the new status if valid, throws if invalid
     */
    validateTransition(
        taskId: string,
        fromStatus: TaskStatus,
        toStatus: TaskStatus
    ): TaskStatus {
        if (!this.isValidTransition(fromStatus, toStatus)) {
            const error = new Error(
                `Invalid state transition for task ${taskId}: ${fromStatus} -> ${toStatus}`
            );
            logTaskEvent(taskId, 'invalid_transition', 'error', {
                from: fromStatus,
                to: toStatus,
            });
            throw error;
        }

        logTaskEvent(taskId, 'state_transition', 'debug', {
            from: fromStatus,
            to: toStatus,
        });

        return toStatus;
    }

    /**
     * Check if a task can be refunded based on current status
     */
    canRefund(status: TaskStatus): boolean {
        return VALID_TRANSITIONS[status].includes(TaskStatus.REFUNDED);
    }

    /**
     * Check if a task can be completed based on current status
     */
    canComplete(status: TaskStatus): boolean {
        // Only RUNNING tasks can be completed
        return status === TaskStatus.RUNNING;
    }

    /**
     * Check if a task is still active (not in terminal state)
     */
    isActive(status: TaskStatus): boolean {
        return !this.isTerminalState(status);
    }

    /**
     * Get a human-readable description of a status
     */
    getStatusDescription(status: TaskStatus): string {
        const descriptions: Record<TaskStatus, string> = {
            [TaskStatus.PENDING]: 'Task created locally, awaiting worker selection',
            [TaskStatus.CREATED]: 'Escrow deposited on-chain, awaiting authorization',
            [TaskStatus.AUTHORIZED]: 'Worker authorized, awaiting execution',
            [TaskStatus.RUNNING]: 'Worker executing task',
            [TaskStatus.COMPLETED]: 'Task completed successfully',
            [TaskStatus.REFUNDED]: 'Task refunded due to timeout',
            [TaskStatus.FAILED]: 'Task failed due to error',
        };
        return descriptions[status];
    }

    /**
     * Get all possible statuses
     */
    getAllStatuses(): TaskStatus[] {
        return Object.values(TaskStatus);
    }

    /**
     * Get all terminal statuses
     */
    getTerminalStatuses(): TaskStatus[] {
        return this.getAllStatuses().filter(s => this.isTerminalState(s));
    }

    /**
     * Get all active (non-terminal) statuses
     */
    getActiveStatuses(): TaskStatus[] {
        return this.getAllStatuses().filter(s => !this.isTerminalState(s));
    }
}
