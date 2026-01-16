/**
 * Task status lifecycle states
 */
export enum TaskStatus {
    /** Task created and stored locally, not yet on-chain */
    PENDING = 'PENDING',
    /** Escrow deposited on-chain, task created */
    CREATED = 'CREATED',
    /** Authorization signature delivered to worker */
    AUTHORIZED = 'AUTHORIZED',
    /** Worker has picked up the task (sidecar running) */
    RUNNING = 'RUNNING',
    /** Task completed, result submitted, funds released */
    COMPLETED = 'COMPLETED',
    /** Task timed out, funds refunded to master */
    REFUNDED = 'REFUNDED',
    /** Task failed due to internal error */
    FAILED = 'FAILED',
}

/**
 * Canonical task object representing a compute job
 */
export interface Task {
    /** Unique identifier for the task */
    taskId: string;

    /** Capability label (e.g., 'image-generation', 'researcher') */
    taskType: string;

    /** Structured input payload */
    inputParameters: Record<string, unknown>;

    /** Optional: Desired worker group identifier */
    desiredWorkerGroup?: string;

    /** Optional: Required capabilities the worker must have */
    requiredCapabilities?: string[];

    /** Unix timestamp deadline for task completion */
    deadline: number;

    /** Maximum payment in wei (bigint serialized as string for storage) */
    budget: string;

    /** Current task status */
    status: TaskStatus;

    /** Assigned worker's address (set after selection) */
    assignedWorker?: string;

    /** Unix timestamp when task was created */
    createdAt: number;

    /** Transaction hash of escrow deposit */
    escrowTxHash?: string;

    /** Result hash from worker submission */
    resultHash?: string;

    /** Authorization signature delivered to worker */
    authorizationSignature?: string;

    /** Nonce used for authorization (for replay protection) */
    authorizationNonce?: number;

    /** Unix timestamp when authorization expires */
    authorizationExpiresAt?: number;

    /** Last updated timestamp */
    updatedAt: number;
}

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
    taskType: string;
    inputParameters: Record<string, unknown>;
    desiredWorkerGroup?: string;
    requiredCapabilities?: string[];
    /** Duration in seconds */
    durationSeconds: number;
    /** Budget in ether (e.g., "0.01") */
    budgetEther: string;
}

/**
 * On-chain task data from NativeEscrow contract
 */
export interface OnChainTaskData {
    master: string;
    worker: string;
    amount: bigint;
    deadline: bigint;
    status: number;
}

/**
 * Map on-chain status enum to TaskStatus
 */
export function mapOnChainStatus(status: number): TaskStatus {
    switch (status) {
        case 0: return TaskStatus.CREATED; // OPEN
        case 1: return TaskStatus.COMPLETED;
        case 2: return TaskStatus.FAILED; // DISPUTED
        case 3: return TaskStatus.REFUNDED;
        default: return TaskStatus.PENDING;
    }
}
