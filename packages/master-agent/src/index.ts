/**
 * Econos Protocol - Master Agent
 *
 * Task orchestration, worker selection, escrow management, and lifecycle monitoring
 * for the Econos Agent Marketplace.
 */

import 'dotenv/config';

//contract config

export {getNativeEscrowContractWithSigner,
    getNativeEscrowContract
} from './config/contracts'
// Main Orchestrator
export {
    MasterAgentOrchestrator,
    OrchestratorConfig,
    SubmitTaskResult,
    AnalyzeAndSubmitResult,
} from './services/masterAgentOrchestrator';

// Task Formation
export { TaskManager } from './task-formation/taskManager';
export { TaskStore } from './task-formation/taskStore';
export {
    CreateTaskInputSchema,
    TaskTypeSchema,
    SUPPORTED_TASK_TYPES,
    type TaskType,
    type CreateTaskInput,
} from './task-formation/schema';

// Types
export {
    Task,
    TaskStatus,
    CreateTaskInput as TaskInput,
    OnChainTaskData,
    mapOnChainStatus,
} from './types/task';
export {
    Worker,
    WorkerWithMetadata,
    WorkerManifest,
    WorkerSelectionStrategy,
} from './types/worker';
export {
    AuthorizationPayload,
    SignedAuthorization,
    NonceRecord,
} from './types/authorization';
export {
    ExecutionPlan,
    PipelineStep,
    PipelineExecutionResult,
    StepResult,
    ServiceCapability,
    CapabilitySummary,
    AnalyzeOptions,
    TaskAnalysisResult,
} from './types/pipeline';

// Worker Selection
export { WorkerIndexer } from './worker-selection/indexer';
export { WorkerSelector, WorkerSelectorConfig } from './worker-selection/selector';
export {
    selectByReputation,
    selectByCheapest,
    selectRoundRobin,
    selectDirect,
    selectByCapabilityAndReputation,
    selectByWeightedScore,
    filterByReputation,
    filterByCapabilities,
    filterByBudget,
} from './worker-selection/strategies';

// Escrow
export { EscrowService, DepositResult } from './escrow/escrowService';
export {
    OnChainTask,
    OnChainTaskStatus,
    getEscrowContract,
    getEscrowContractWithSigner,
} from './escrow/contractInterface';

// Authorization
export { AuthorizationSigner } from './authorization/signer';
export {
    EIP712_DOMAIN,
    EIP712_TYPE_DEFINITIONS,
    getEIP712Domain,
    createAuthorizationMessage,
} from './authorization/eip712';

// Lifecycle
export { EventListener } from './lifecycle/eventListener';
export { TaskStateMachine } from './lifecycle/stateMachine';
export { LifecycleMonitor, MonitorConfig } from './lifecycle/monitor';

// Task Analyzer (NEW)
export { CapabilityDiscovery } from './task-analyzer/capabilityDiscovery';
export { TaskAnalyzer } from './task-analyzer/taskAnalyzer';
export { PipelinePlanner } from './task-analyzer/pipelinePlanner';

// Pipeline Execution (NEW)
export { PipelineExecutor } from './pipeline/pipelineExecutor';
export { ResultAggregator } from './pipeline/resultAggregator';

// Config
export { cronosConfig, getProvider, getMasterWallet, getMasterAddress } from './config/cronos';
export { contractAddresses, WORKER_REGISTRY_ABI, NATIVE_ESCROW_ABI } from './config/contracts';

// Utils
export { logger, logTaskEvent, logWorkerEvent, logContractCall } from './utils/logger';
export { hashObject, toBytes32, generateTaskId, getCurrentTimestamp, calculateDeadline } from './utils/hash';
