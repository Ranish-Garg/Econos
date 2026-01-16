import { ethers } from 'ethers';
import { Task, TaskStatus, CreateTaskInput } from '../types/task';
import { WorkerWithMetadata, WorkerSelectionStrategy } from '../types/worker';
import { SignedAuthorization } from '../types/authorization';
import {
    ExecutionPlan,
    PipelineExecutionResult,
    AnalyzeOptions,
    CapabilitySummary,
} from '../types/pipeline';
import { TaskManager } from '../task-formation/taskManager';
import { TaskStore } from '../task-formation/taskStore';
import { WorkerSelector, WorkerSelectorConfig } from '../worker-selection/selector';
import { EscrowService, DepositResult } from '../escrow/escrowService';
import { AuthorizationSigner } from '../authorization/signer';
import { LifecycleMonitor, MonitorConfig } from '../lifecycle/monitor';
import { CapabilityDiscovery } from '../task-analyzer/capabilityDiscovery';
import { TaskAnalyzer } from '../task-analyzer/taskAnalyzer';
import { PipelinePlanner } from '../task-analyzer/pipelinePlanner';
import { PipelineExecutor } from '../pipeline/pipelineExecutor';
import { ResultAggregator } from '../pipeline/resultAggregator';
import { logger, logTaskEvent } from '../utils/logger';

/**
 * Configuration for the Master Agent Orchestrator
 */
export interface OrchestratorConfig {
    /** Worker selector configuration */
    workerSelector?: Partial<WorkerSelectorConfig>;

    /** Lifecycle monitor configuration */
    monitor?: Partial<MonitorConfig>;

    /** Default authorization validity in seconds */
    authorizationValiditySeconds?: number;

    /** Whether to start lifecycle monitor automatically */
    autoStartMonitor?: boolean;

    /** Known workers for capability discovery */
    knownWorkers?: Array<{ address: string; endpoint: string }>;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
    authorizationValiditySeconds: 3600,
    autoStartMonitor: true,
};

/**
 * Result of submitting a task
 */
export interface SubmitTaskResult {
    task: Task;
    worker: WorkerWithMetadata;
    escrowResult: DepositResult;
    authorization: SignedAuthorization;
}

/**
 * Result of analyzing and submitting a task
 */
export interface AnalyzeAndSubmitResult {
    /** The execution plan created */
    plan: ExecutionPlan;

    /** Whether execution was successful */
    success: boolean;

    /** Full pipeline result (for multi-agent) or single task result */
    result: PipelineExecutionResult | SubmitTaskResult;

    /** Whether single or multi-agent was used */
    executionType: 'single' | 'multi';
}

/**
 * Master Agent Orchestrator
 *
 * The main entry point that ties together all components:
 * - Task Formation
 * - Worker Selection
 * - Economic Commitment (Escrow)
 * - Authorization
 * - Lifecycle Monitoring
 * - AI Task Analysis (NEW)
 * - Multi-Agent Pipeline Execution (NEW)
 */
export class MasterAgentOrchestrator {
    private taskManager: TaskManager;
    private workerSelector: WorkerSelector;
    private escrowService: EscrowService;
    private authorizationSigner: AuthorizationSigner;
    private lifecycleMonitor: LifecycleMonitor;
    private config: OrchestratorConfig;

    // New components for AI-powered orchestration
    private capabilityDiscovery: CapabilityDiscovery;
    private taskAnalyzer: TaskAnalyzer;
    private pipelinePlanner: PipelinePlanner;
    private pipelineExecutor: PipelineExecutor;
    private resultAggregator: ResultAggregator;

    constructor(config: OrchestratorConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Initialize components
        const taskStore = new TaskStore();
        this.taskManager = new TaskManager(taskStore);
        this.workerSelector = new WorkerSelector(config.workerSelector);
        this.escrowService = new EscrowService();
        this.authorizationSigner = new AuthorizationSigner();
        this.lifecycleMonitor = new LifecycleMonitor(
            this.taskManager,
            this.escrowService,
            config.monitor
        );

        // Initialize AI orchestration components
        this.capabilityDiscovery = new CapabilityDiscovery();
        this.taskAnalyzer = new TaskAnalyzer();
        this.pipelinePlanner = new PipelinePlanner(this.capabilityDiscovery);
        this.pipelineExecutor = new PipelineExecutor(
            this.escrowService,
            this.authorizationSigner
        );
        this.resultAggregator = new ResultAggregator();

        // Register known workers
        if (config.knownWorkers) {
            for (const worker of config.knownWorkers) {
                this.addKnownWorker(worker.address, worker.endpoint);
            }
        }

        // Auto-start monitor if configured
        if (this.config.autoStartMonitor) {
            this.lifecycleMonitor.start();
        }

        logger.info('MasterAgentOrchestrator initialized with AI task analysis');
    }

    /**
     * Analyze a task request and submit for execution
     *
     * This is the AI-powered entry point that:
     * 1. Discovers available worker capabilities
     * 2. Analyzes the task with Gemini to determine single vs multi-agent
     * 3. Creates an execution plan
     * 4. Executes (single task or multi-step pipeline)
     *
     * @param request - Natural language task request
     * @param options - Analysis options
     * @param input - Input parameters for the task
     */
    async analyzeAndSubmit(
        request: string,
        options: AnalyzeOptions = {},
        input: Record<string, unknown> = {}
    ): Promise<AnalyzeAndSubmitResult> {
        logger.info('Analyzing and submitting task', {
            requestLength: request.length,
            options,
        });

        // Step 1: Discover capabilities
        const capabilities = await this.capabilityDiscovery.discoverCapabilities();
        logger.info('Discovered capabilities', {
            serviceCount: capabilities.services.length,
            serviceTypes: capabilities.availableServiceTypes,
        });

        if (capabilities.services.length === 0) {
            throw new Error('No worker capabilities available. Please add known workers first.');
        }

        // Step 2: Analyze task with Gemini
        const analysis = await this.taskAnalyzer.analyzeTask(request, capabilities, options);
        logger.info('Task analysis complete', {
            isSingleAgent: analysis.isSingleAgent,
            stepCount: analysis.steps.length,
            reasoning: analysis.reasoning,
        });

        // Step 3: Create execution plan
        const plan = await this.pipelinePlanner.createPlan(request, analysis, options);
        logger.info('Execution plan created', {
            planId: plan.planId,
            estimatedBudget: plan.estimatedBudgetWei,
        });

        // Step 4: Execute
        if (plan.isSingleAgent) {
            // Single agent execution - use existing submitTask flow
            const step = plan.steps[0];
            const taskInput: CreateTaskInput = {
                taskType: step.serviceType,
                inputParameters: input,
                durationSeconds: 3600,
                budgetEther: (Number(plan.estimatedBudgetWei) / 1e18).toFixed(6),
            };

            const result = await this.submitTask(taskInput, 'direct', step.assignedWorker);

            return {
                plan,
                success: true,
                result,
                executionType: 'single',
            };
        } else {
            // Multi-agent pipeline execution
            const pipelineResult = await this.pipelineExecutor.executePipeline(plan, input);

            return {
                plan: pipelineResult.plan,
                success: pipelineResult.success,
                result: pipelineResult,
                executionType: 'multi',
            };
        }
    }

    /**
     * Just analyze a task without executing
     * Useful for preview/confirmation flows
     */
    async analyzeTask(
        request: string,
        options: AnalyzeOptions = {}
    ): Promise<ExecutionPlan> {
        const capabilities = await this.capabilityDiscovery.discoverCapabilities();
        const analysis = await this.taskAnalyzer.analyzeTask(request, capabilities, options);
        return this.pipelinePlanner.createPlan(request, analysis, options);
    }

    /**
     * Get available capabilities summary
     */
    async getCapabilities(): Promise<CapabilitySummary> {
        return this.capabilityDiscovery.discoverCapabilities();
    }

    /**
     * Submit a new task
     *
     * Full flow:
     * 1. Create task object
     * 2. Select worker
     * 3. Deposit escrow
     * 4. Generate authorization
     *
     * @param input - Task creation input
     * @param strategy - Worker selection strategy (optional)
     * @param directWorkerAddress - For direct strategy, the target worker
     */
    async submitTask(
        input: CreateTaskInput,
        strategy?: WorkerSelectionStrategy,
        directWorkerAddress?: string
    ): Promise<SubmitTaskResult> {
        // Step 1: Create task
        logger.info('Creating task', { taskType: input.taskType });
        const task = await this.taskManager.createTask(input);

        try {
            // Step 2: Select worker
            logger.info('Selecting worker', { taskId: task.taskId });
            const worker = await this.workerSelector.selectWorker(
                task,
                strategy,
                directWorkerAddress
            );

            if (!worker) {
                throw new Error('No suitable worker found for task');
            }

            // Update task with assigned worker
            await this.taskManager.assignWorker(task.taskId, worker.address);

            // Step 3: Deposit escrow
            logger.info('Depositing escrow', {
                taskId: task.taskId,
                worker: worker.address,
            });

            const budgetWei = BigInt(task.budget);
            const durationSeconds = task.deadline - Math.floor(Date.now() / 1000);

            const escrowResult = await this.escrowService.depositTask(
                task.taskId,
                worker.address,
                durationSeconds,
                budgetWei
            );

            // Record escrow deposit
            await this.taskManager.recordEscrowDeposit(task.taskId, escrowResult.txHash);

            // Step 4: Generate authorization
            logger.info('Generating authorization', { taskId: task.taskId });

            const authorization = await this.authorizationSigner.createSignedAuthorization(
                task.taskId,
                worker.address,
                this.config.authorizationValiditySeconds
            );

            // Record authorization
            await this.taskManager.recordAuthorization(
                task.taskId,
                authorization.signature,
                authorization.payload.nonce,
                authorization.payload.expiresAt
            );

            logTaskEvent(task.taskId, 'submitted', 'info', {
                worker: worker.address,
                escrowTx: escrowResult.txHash,
            });

            // Get updated task
            const updatedTask = await this.taskManager.getTask(task.taskId);

            return {
                task: updatedTask!,
                worker,
                escrowResult,
                authorization,
            };
        } catch (error) {
            // Mark task as failed
            await this.taskManager.updateTaskStatus(task.taskId, TaskStatus.FAILED);

            logTaskEvent(task.taskId, 'submission_failed', 'error', {
                error: String(error),
            });

            throw error;
        }
    }

    /**
     * Get task status
     */
    async getTaskStatus(taskId: string): Promise<Task | null> {
        return this.taskManager.getTask(taskId);
    }

    /**
     * Get tasks by status
     */
    async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
        return this.taskManager.getTasksByStatus(status);
    }

    /**
     * Cancel a task (if possible)
     *
     * Can only cancel tasks in PENDING status before escrow deposit
     */
    async cancelTask(taskId: string): Promise<boolean> {
        const task = await this.taskManager.getTask(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        // Can only cancel PENDING tasks
        if (task.status !== TaskStatus.PENDING) {
            logger.warn('Cannot cancel task - not in PENDING status', {
                taskId,
                status: task.status,
            });
            return false;
        }

        await this.taskManager.updateTaskStatus(taskId, TaskStatus.FAILED);
        logTaskEvent(taskId, 'cancelled', 'info');

        return true;
    }

    /**
     * Request refund for expired task
     */
    async requestRefund(taskId: string): Promise<DepositResult> {
        const task = await this.taskManager.getTask(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        const canRefund = await this.escrowService.canRefund(taskId);
        if (!canRefund) {
            throw new Error('Task cannot be refunded (not expired or already settled)');
        }

        return this.escrowService.refundAndSlash(taskId);
    }

    /**
     * Add a known worker (also registers for capability discovery)
     */
    addKnownWorker(address: string, endpoint?: string): void {
        this.workerSelector.addKnownWorker(address, endpoint);
        if (endpoint) {
            this.capabilityDiscovery.addWorker(address, endpoint);
        }
    }

    /**
     * Get available workers
     */
    async getAvailableWorkers(): Promise<WorkerWithMetadata[]> {
        return this.workerSelector.getAvailableWorkers();
    }

    /**
     * Start lifecycle monitor (if not auto-started)
     */
    startMonitor(): void {
        this.lifecycleMonitor.start();
    }

    /**
     * Stop lifecycle monitor
     */
    stopMonitor(): void {
        this.lifecycleMonitor.stop();
    }

    /**
     * Shutdown orchestrator
     */
    shutdown(): void {
        this.lifecycleMonitor.stop();
        logger.info('MasterAgentOrchestrator shutdown');
    }

    /**
     * Get components for advanced usage
     */
    getComponents() {
        return {
            taskManager: this.taskManager,
            workerSelector: this.workerSelector,
            escrowService: this.escrowService,
            authorizationSigner: this.authorizationSigner,
            lifecycleMonitor: this.lifecycleMonitor,
            capabilityDiscovery: this.capabilityDiscovery,
            taskAnalyzer: this.taskAnalyzer,
            pipelinePlanner: this.pipelinePlanner,
            pipelineExecutor: this.pipelineExecutor,
            resultAggregator: this.resultAggregator,
        };
    }
}
