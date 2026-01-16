import { ethers } from 'ethers';
import { Task, TaskStatus, CreateTaskInput } from '../types/task';
import { TaskStore } from './taskStore';
import { CreateTaskInputSchema, getInputSchemaForTaskType, TaskType } from './schema';
import { generateTaskId, getCurrentTimestamp, calculateDeadline } from '../utils/hash';
import { logger, logTaskEvent } from '../utils/logger';

/**
 * Task Formation Manager
 * 
 * Responsible for:
 * - Accepting incoming workload requests
 * - Normalizing inputs into canonical task objects
 * - Validating taskType and inputParameters
 * - Storing tasks until dispatched
 */
export class TaskManager {
    private taskStore: TaskStore;

    constructor(taskStore?: TaskStore) {
        this.taskStore = taskStore || new TaskStore();
    }

    /**
     * Create a new task from input
     * 
     * @param input - The task creation input
     * @returns The created task object
     */
    async createTask(input: CreateTaskInput): Promise<Task> {
        // Validate the top-level input
        const validatedInput = CreateTaskInputSchema.parse(input);

        // Validate task-specific input parameters
        const inputSchema = getInputSchemaForTaskType(validatedInput.taskType as TaskType);
        const parsedInputParams = inputSchema.parse(validatedInput.inputParameters);

        // Generate unique task ID
        const taskId = generateTaskId();
        const now = getCurrentTimestamp();

        // Calculate deadline and budget
        const deadline = calculateDeadline(validatedInput.durationSeconds);
        const budgetWei = ethers.parseEther(validatedInput.budgetEther);

        // Create canonical task object
        const task: Task = {
            taskId,
            taskType: validatedInput.taskType,
            inputParameters: parsedInputParams,
            desiredWorkerGroup: validatedInput.desiredWorkerGroup,
            requiredCapabilities: validatedInput.requiredCapabilities,
            deadline,
            budget: budgetWei.toString(),
            status: TaskStatus.PENDING,
            createdAt: now,
            updatedAt: now,
        };

        // Store the task
        await this.taskStore.save(task);

        logTaskEvent(taskId, 'created', 'info', {
            taskType: task.taskType,
            deadline,
            budget: validatedInput.budgetEther,
        });

        return task;
    }

    /**
     * Get a task by ID
     */
    async getTask(taskId: string): Promise<Task | null> {
        return this.taskStore.get(taskId);
    }

    /**
     * Update a task
     */
    async updateTask(task: Task): Promise<void> {
        task.updatedAt = getCurrentTimestamp();
        await this.taskStore.update(task);

        logTaskEvent(task.taskId, 'updated', 'debug', { status: task.status });
    }

    /**
     * Update task status
     */
    async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
        await this.taskStore.updateStatus(taskId, status);

        logTaskEvent(taskId, 'status_changed', 'info', { status });
    }

    /**
     * Set assigned worker for a task
     */
    async assignWorker(taskId: string, workerAddress: string): Promise<Task> {
        const task = await this.taskStore.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        task.assignedWorker = workerAddress;
        task.updatedAt = getCurrentTimestamp();

        await this.taskStore.update(task);

        logTaskEvent(taskId, 'worker_assigned', 'info', { worker: workerAddress });

        return task;
    }

    /**
     * Record escrow deposit for a task
     */
    async recordEscrowDeposit(taskId: string, txHash: string): Promise<Task> {
        const task = await this.taskStore.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        task.escrowTxHash = txHash;
        task.status = TaskStatus.CREATED;
        task.updatedAt = getCurrentTimestamp();

        await this.taskStore.update(task);

        logTaskEvent(taskId, 'escrow_deposited', 'info', { txHash });

        return task;
    }

    /**
     * Record authorization signature for a task
     */
    async recordAuthorization(
        taskId: string,
        signature: string,
        nonce: number,
        expiresAt: number
    ): Promise<Task> {
        const task = await this.taskStore.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        task.authorizationSignature = signature;
        task.authorizationNonce = nonce;
        task.authorizationExpiresAt = expiresAt;
        task.status = TaskStatus.AUTHORIZED;
        task.updatedAt = getCurrentTimestamp();

        await this.taskStore.update(task);

        logTaskEvent(taskId, 'authorized', 'info', { expiresAt });

        return task;
    }

    /**
     * Record task completion
     */
    async recordCompletion(taskId: string, resultHash: string): Promise<Task> {
        const task = await this.taskStore.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        task.resultHash = resultHash;
        task.status = TaskStatus.COMPLETED;
        task.updatedAt = getCurrentTimestamp();

        await this.taskStore.update(task);

        logTaskEvent(taskId, 'completed', 'info', { resultHash });

        return task;
    }

    /**
     * Get pending tasks (ready for worker selection)
     */
    async getPendingTasks(): Promise<Task[]> {
        return this.taskStore.getByStatus(TaskStatus.PENDING);
    }

    /**
     * Get tasks by status
     */
    async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
        return this.taskStore.getByStatus(status);
    }

    /**
     * Get expired tasks that need refund
     */
    async getExpiredTasks(): Promise<Task[]> {
        return this.taskStore.getExpiredTasks();
    }

    /**
     * Validate that a task type is supported
     */
    isValidTaskType(taskType: string): boolean {
        try {
            const schema = getInputSchemaForTaskType(taskType as TaskType);
            return schema !== undefined;
        } catch {
            return false;
        }
    }
}
