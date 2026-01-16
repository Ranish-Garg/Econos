/**
 * Execution plan created by the task analyzer
 */
export interface ExecutionPlan {
    /** Unique identifier for this execution */
    planId: string;

    /** Original user request */
    originalRequest: string;

    /** Whether this can be handled by a single agent */
    isSingleAgent: boolean;

    /** Reasoning from Gemini about why single/multi-agent */
    reasoning: string;

    /** Ordered list of execution steps */
    steps: PipelineStep[];

    /** Total estimated budget in wei */
    estimatedBudgetWei: string;

    /** Created timestamp */
    createdAt: number;
}

/**
 * A single step in a multi-agent pipeline
 */
export interface PipelineStep {
    /** Unique step identifier */
    stepId: string;

    /** Execution order (1-indexed) */
    order: number;

    /** Service type to invoke (e.g., 'researcher', 'writer') */
    serviceType: string;

    /** Human-readable description of what this step does */
    description: string;

    /** How to construct input for this step */
    inputMapping: InputMapping;

    /** Assigned worker address (set during execution) */
    assignedWorker?: string;

    /** Worker endpoint URL */
    workerEndpoint?: string;

    /** Step execution status */
    status: StepStatus;

    /** Step result (set after completion) */
    result?: unknown;

    /** Error message if failed */
    error?: string;

    /** Escrow transaction hash for this step */
    escrowTxHash?: string;

    /** Authorization signature for this step */
    authorizationSignature?: string;

    /** Time when step started */
    startedAt?: number;

    /** Time when step completed */
    completedAt?: number;
}

/**
 * Step execution status
 */
export type StepStatus = 'pending' | 'selecting_worker' | 'depositing' | 'authorized' | 'running' | 'completed' | 'failed';

/**
 * How to map input for a pipeline step
 */
export interface InputMapping {
    /** Type of input mapping */
    type: 'direct' | 'from_previous' | 'transform' | 'merge';

    /** For 'direct': the raw input parameters */
    directInput?: Record<string, unknown>;

    /** For 'from_previous': which step to get data from */
    sourceStepId?: string;

    /** For 'from_previous': specific field from source output */
    sourceField?: string;

    /** For 'transform': natural language transformation instruction */
    transformInstruction?: string;

    /** For 'merge': multiple sources to combine */
    mergeSources?: Array<{
        stepId: string;
        field?: string;
    }>;
}

/**
 * Result of pipeline execution
 */
export interface PipelineExecutionResult {
    /** The execution plan that was run */
    plan: ExecutionPlan;

    /** Whether all steps succeeded */
    success: boolean;

    /** Aggregated final result */
    finalResult: unknown;

    /** Individual step results */
    stepResults: StepResult[];

    /** Total execution time in ms */
    totalExecutionTimeMs: number;

    /** Total actual cost in wei */
    totalCostWei: string;
}

/**
 * Result of a single step
 */
export interface StepResult {
    stepId: string;
    serviceType: string;
    status: StepStatus;
    result?: unknown;
    error?: string;
    executionTimeMs: number;
    costWei: string;
    workerAddress: string;
    txHash?: string;
}

/**
 * Available service capability from a worker
 */
export interface ServiceCapability {
    /** Service identifier */
    serviceId: string;

    /** Human-readable name */
    name: string;

    /** Description of what the service does */
    description: string;

    /** Price in wei */
    priceWei: string;

    /** Worker address offering this service */
    workerAddress: string;

    /** Worker endpoint URL */
    workerEndpoint: string;
}

/**
 * Aggregated capabilities from all workers
 */
export interface CapabilitySummary {
    /** All available services */
    services: ServiceCapability[];

    /** Service types available (deduplicated) */
    availableServiceTypes: string[];

    /** Human-readable summary for Gemini */
    textSummary: string;

    /** Last updated timestamp */
    updatedAt: number;
}

/**
 * Options for task analysis
 */
export interface AnalyzeOptions {
    /** Maximum budget in ether */
    maxBudgetEther?: string;

    /** Preferred workers (addresses) */
    preferredWorkers?: string[];

    /** Force single-agent execution */
    forceSingleAgent?: boolean;

    /** Force multi-agent execution */
    forceMultiAgent?: boolean;

    /** Maximum number of steps */
    maxSteps?: number;
}

/**
 * Result from Gemini task analysis
 */
export interface TaskAnalysisResult {
    /** Whether single agent is sufficient */
    isSingleAgent: boolean;

    /** Reasoning for the decision */
    reasoning: string;

    /** Planned steps */
    steps: Array<{
        order: number;
        serviceType: string;
        description: string;
        inputSource: 'user' | 'previous';
        inputField?: string;
    }>;

    /** Confidence score 0-1 */
    confidence: number;
}
