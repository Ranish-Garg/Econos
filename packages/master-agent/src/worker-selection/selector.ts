import { Task } from '../types/task';
import { Worker, WorkerWithMetadata, WorkerSelectionStrategy } from '../types/worker';
import { WorkerIndexer } from './indexer';
import {
    selectByReputation,
    selectByCheapest,
    selectRoundRobin,
    selectDirect,
    selectByCapabilityAndReputation,
    selectByWeightedScore,
    filterByCapabilities,
    filterByBudget,
    filterByReputation,
} from './strategies';
import { logger, logTaskEvent, logWorkerEvent } from '../utils/logger';

/**
 * Configuration for the worker selector
 */
export interface WorkerSelectorConfig {
    /** Minimum reputation threshold for workers */
    minReputation: number;

    /** Known worker addresses for indexing */
    knownWorkerAddresses: string[];

    /** Mapping of worker addresses to their endpoints */
    workerEndpoints: Record<string, string>;

    /** Default selection strategy */
    defaultStrategy: WorkerSelectionStrategy;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: WorkerSelectorConfig = {
    minReputation: 50,
    knownWorkerAddresses: [],
    workerEndpoints: {},
    defaultStrategy: 'reputation',
};

/**
 * Worker Selector
 * 
 * Orchestrates worker selection for tasks by:
 * 1. Querying the WorkerIndexer for available workers
 * 2. Filtering by capability, reputation, and budget
 * 3. Applying the selected strategy to choose the best worker
 */
export class WorkerSelector {
    private indexer: WorkerIndexer;
    private config: WorkerSelectorConfig;

    constructor(config: Partial<WorkerSelectorConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.indexer = new WorkerIndexer();
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<WorkerSelectorConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Add a known worker address
     */
    addKnownWorker(address: string, endpoint?: string): void {
        if (!this.config.knownWorkerAddresses.includes(address)) {
            this.config.knownWorkerAddresses.push(address);
        }
        if (endpoint) {
            this.config.workerEndpoints[address] = endpoint;
        }
    }

    /**
     * Get all active workers with metadata
     */
    async getAvailableWorkers(): Promise<WorkerWithMetadata[]> {
        return this.indexer.getWorkersWithMetadata(
            this.config.knownWorkerAddresses,
            this.config.workerEndpoints
        );
    }

    /**
     * Select the best worker for a task
     * 
     * @param task - The task to assign
     * @param strategy - Selection strategy (defaults to config)
     * @param directWorkerAddress - For 'direct' strategy, the target address
     */
    async selectWorker(
        task: Task,
        strategy?: WorkerSelectionStrategy,
        directWorkerAddress?: string
    ): Promise<WorkerWithMetadata | null> {
        const effectiveStrategy = strategy || this.config.defaultStrategy;

        logger.debug('Selecting worker for task', {
            taskId: task.taskId,
            taskType: task.taskType,
            strategy: effectiveStrategy,
        });

        // Get all available workers with metadata
        let workers = await this.getAvailableWorkers();

        if (workers.length === 0) {
            logger.warn('No available workers found');
            return null;
        }

        // Apply filters

        // 1. Filter by minimum reputation
        workers = filterByReputation(workers, this.config.minReputation);

        // 2. Filter by required capabilities
        if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
            workers = filterByCapabilities(workers, task.requiredCapabilities);
        } else {
            // Default: filter by task type capability
            workers = filterByCapabilities(workers, [task.taskType]);
        }

        // 3. Filter by budget
        const budgetWei = BigInt(task.budget);
        workers = filterByBudget(workers, task.taskType, budgetWei);

        if (workers.length === 0) {
            logger.warn('No workers match task requirements', {
                taskId: task.taskId,
                taskType: task.taskType,
                requiredCapabilities: task.requiredCapabilities,
            });
            return null;
        }

        // Apply selection strategy
        let selected: WorkerWithMetadata | null = null;

        switch (effectiveStrategy) {
            case 'reputation':
                selected = selectByReputation(workers) as WorkerWithMetadata;
                break;

            case 'cheapest':
                selected = selectByCheapest(workers, task.taskType);
                break;

            case 'round-robin':
                selected = selectRoundRobin(workers, task.taskType);
                break;

            case 'direct':
                if (!directWorkerAddress) {
                    logger.error('Direct strategy requires worker address');
                    return null;
                }
                selected = selectDirect(workers, directWorkerAddress);
                break;

            case 'fastest':
                // For now, use reputation as proxy for reliability
                selected = selectByWeightedScore(workers, task.taskType, {
                    reputation: 0.8,
                    price: 0.2,
                });
                break;

            default:
                selected = selectByReputation(workers) as WorkerWithMetadata;
        }

        if (selected) {
            logTaskEvent(task.taskId, 'worker_selected', 'info', {
                worker: selected.address,
                strategy: effectiveStrategy,
                reputation: selected.reputation,
            });
        }

        return selected;
    }

    /**
     * Get a specific worker by address
     */
    async getWorker(address: string): Promise<Worker | null> {
        return this.indexer.getWorkerByAddress(address);
    }

    /**
     * Check if a worker is active
     */
    async isWorkerActive(address: string): Promise<boolean> {
        return this.indexer.isWorkerActive(address);
    }

    /**
     * Subscribe to new worker registrations
     */
    onNewWorker(callback: (address: string) => void): () => void {
        return this.indexer.onWorkerRegistered((worker) => {
            // Auto-add to known workers
            this.addKnownWorker(worker);
            callback(worker);
        });
    }

    /**
     * Subscribe to worker bans
     */
    onWorkerBanned(callback: (address: string) => void): () => void {
        return this.indexer.onWorkerBanned(callback);
    }
}
