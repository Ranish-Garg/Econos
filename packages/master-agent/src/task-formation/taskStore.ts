import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Task, TaskStatus } from '../types/task';
import { logger } from '../utils/logger';

/**
 * Database schema type for tasks table
 */
interface TaskRow {
    task_id: string;
    task_type: string;
    input_parameters: Record<string, unknown>;
    desired_worker_group: string | null;
    required_capabilities: string[] | null;
    deadline: number;
    budget: string;
    status: string;
    assigned_worker: string | null;
    created_at: number;
    escrow_tx_hash: string | null;
    result_hash: string | null;
    authorization_signature: string | null;
    authorization_nonce: number | null;
    authorization_expires_at: number | null;
    updated_at: number;
}

export class TaskStore {
    private supabase: SupabaseClient;
    private tableName = 'tasks';

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set');
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    /**
     * Convert Task object to database row
     */
    private taskToRow(task: Task): TaskRow {
        return {
            task_id: task.taskId,
            task_type: task.taskType,
            input_parameters: task.inputParameters,
            desired_worker_group: task.desiredWorkerGroup || null,
            required_capabilities: task.requiredCapabilities || null,
            deadline: task.deadline,
            budget: task.budget,
            status: task.status,
            assigned_worker: task.assignedWorker || null,
            created_at: task.createdAt,
            escrow_tx_hash: task.escrowTxHash || null,
            result_hash: task.resultHash || null,
            authorization_signature: task.authorizationSignature || null,
            authorization_nonce: task.authorizationNonce ?? null,
            authorization_expires_at: task.authorizationExpiresAt || null,
            updated_at: task.updatedAt,
        };
    }

    /**
     * Convert database row to Task object
     */
    private rowToTask(row: TaskRow): Task {
        return {
            taskId: row.task_id,
            taskType: row.task_type,
            inputParameters: row.input_parameters,
            desiredWorkerGroup: row.desired_worker_group || undefined,
            requiredCapabilities: row.required_capabilities || undefined,
            deadline: row.deadline,
            budget: row.budget,
            status: row.status as TaskStatus,
            assignedWorker: row.assigned_worker || undefined,
            createdAt: row.created_at,
            escrowTxHash: row.escrow_tx_hash || undefined,
            resultHash: row.result_hash || undefined,
            authorizationSignature: row.authorization_signature || undefined,
            authorizationNonce: row.authorization_nonce ?? undefined,
            authorizationExpiresAt: row.authorization_expires_at || undefined,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Save a new task
     */
    async save(task: Task): Promise<void> {
        const row = this.taskToRow(task);

        const { error } = await this.supabase
            .from(this.tableName)
            .insert(row);

        if (error) {
            logger.error('Failed to save task', { taskId: task.taskId, error: error.message });
            throw new Error(`Failed to save task: ${error.message}`);
        }

        logger.debug('Task saved', { taskId: task.taskId });
    }

    /**
     * Get a task by ID
     */
    async get(taskId: string): Promise<Task | null> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('task_id', taskId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            logger.error('Failed to get task', { taskId, error: error.message });
            throw new Error(`Failed to get task: ${error.message}`);
        }

        return this.rowToTask(data as TaskRow);
    }

    /**
     * Update a task
     */
    async update(task: Task): Promise<void> {
        const row = this.taskToRow(task);

        const { error } = await this.supabase
            .from(this.tableName)
            .update(row)
            .eq('task_id', task.taskId);

        if (error) {
            logger.error('Failed to update task', { taskId: task.taskId, error: error.message });
            throw new Error(`Failed to update task: ${error.message}`);
        }

        logger.debug('Task updated', { taskId: task.taskId, status: task.status });
    }

    /**
     * Update task status
     */
    async updateStatus(taskId: string, status: TaskStatus): Promise<void> {
        const updatedAt = Math.floor(Date.now() / 1000);

        const { error } = await this.supabase
            .from(this.tableName)
            .update({ status, updated_at: updatedAt })
            .eq('task_id', taskId);

        if (error) {
            logger.error('Failed to update task status', { taskId, status, error: error.message });
            throw new Error(`Failed to update task status: ${error.message}`);
        }

        logger.debug('Task status updated', { taskId, status });
    }

    /**
     * Get tasks by status
     */
    async getByStatus(status: TaskStatus): Promise<Task[]> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('status', status);

        if (error) {
            logger.error('Failed to get tasks by status', { status, error: error.message });
            throw new Error(`Failed to get tasks by status: ${error.message}`);
        }

        return (data as TaskRow[]).map(row => this.rowToTask(row));
    }

    /**
     * Get tasks by assigned worker
     */
    async getByWorker(workerAddress: string): Promise<Task[]> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('assigned_worker', workerAddress);

        if (error) {
            logger.error('Failed to get tasks by worker', { workerAddress, error: error.message });
            throw new Error(`Failed to get tasks by worker: ${error.message}`);
        }

        return (data as TaskRow[]).map(row => this.rowToTask(row));
    }

    /**
     * Get expired tasks (deadline passed but still CREATED or AUTHORIZED)
     */
    async getExpiredTasks(): Promise<Task[]> {
        const now = Math.floor(Date.now() / 1000);

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .lt('deadline', now)
            .in('status', [TaskStatus.CREATED, TaskStatus.AUTHORIZED, TaskStatus.RUNNING]);

        if (error) {
            logger.error('Failed to get expired tasks', { error: error.message });
            throw new Error(`Failed to get expired tasks: ${error.message}`);
        }

        return (data as TaskRow[]).map(row => this.rowToTask(row));
    }

    /**
     * Delete a task
     */
    async delete(taskId: string): Promise<void> {
        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('task_id', taskId);

        if (error) {
            logger.error('Failed to delete task', { taskId, error: error.message });
            throw new Error(`Failed to delete task: ${error.message}`);
        }

        logger.debug('Task deleted', { taskId });
    }
}
