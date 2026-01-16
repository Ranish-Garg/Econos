import {
    ExecutionPlan,
    PipelineStep,
    PipelineExecutionResult,
    StepResult,
    StepStatus,
} from '../types/pipeline';
import { EscrowService } from '../escrow/escrowService';
import { AuthorizationSigner } from '../authorization/signer';
import { logger, logTaskEvent } from '../utils/logger';

/**
 * Pipeline Executor
 * 
 * Executes multi-step pipelines by:
 * 1. Depositing escrow for each step
 * 2. Generating authorization for each worker
 * 3. Invoking worker endpoints
 * 4. Passing outputs between steps
 */
export class PipelineExecutor {
    private escrowService: EscrowService;
    private authorizationSigner: AuthorizationSigner;

    constructor(escrowService: EscrowService, authorizationSigner: AuthorizationSigner) {
        this.escrowService = escrowService;
        this.authorizationSigner = authorizationSigner;
    }

    /**
     * Execute a full pipeline
     */
    async executePipeline(
        plan: ExecutionPlan,
        initialInput: Record<string, unknown>
    ): Promise<PipelineExecutionResult> {
        const startTime = Date.now();
        const stepResults: StepResult[] = [];
        let totalCost = 0n;
        let lastOutput: unknown = null;

        logger.info('Starting pipeline execution', {
            planId: plan.planId,
            stepCount: plan.steps.length,
        });

        // Sort steps by order
        const orderedSteps = [...plan.steps].sort((a, b) => a.order - b.order);

        try {
            for (const step of orderedSteps) {
                const stepStartTime = Date.now();

                logTaskEvent(plan.planId, `step_${step.order}_starting`, 'info', {
                    serviceType: step.serviceType,
                    worker: step.assignedWorker,
                });

                // Prepare input for this step
                const stepInput = await this.prepareStepInput(step, initialInput, stepResults);

                // Execute the step
                const result = await this.executeStep(step, stepInput, plan.planId);

                stepResults.push({
                    stepId: step.stepId,
                    serviceType: step.serviceType,
                    status: result.status,
                    result: result.result,
                    error: result.error,
                    executionTimeMs: Date.now() - stepStartTime,
                    costWei: result.costWei,
                    workerAddress: step.assignedWorker || '',
                    txHash: result.txHash,
                });

                if (result.status === 'failed') {
                    throw new Error(`Step ${step.order} failed: ${result.error}`);
                }

                lastOutput = result.result;
                totalCost += BigInt(result.costWei);

                logTaskEvent(plan.planId, `step_${step.order}_completed`, 'info', {
                    serviceType: step.serviceType,
                });
            }

            // Aggregate final result
            const finalResult = this.aggregateResults(stepResults, plan);

            logger.info('Pipeline execution complete', {
                planId: plan.planId,
                totalTimeMs: Date.now() - startTime,
                totalCost: totalCost.toString(),
            });

            return {
                plan: {
                    ...plan,
                    steps: plan.steps.map(s => ({
                        ...s,
                        status: 'completed' as StepStatus,
                    })),
                },
                success: true,
                finalResult,
                stepResults,
                totalExecutionTimeMs: Date.now() - startTime,
                totalCostWei: totalCost.toString(),
            };
        } catch (error) {
            logger.error('Pipeline execution failed', {
                planId: plan.planId,
                error: String(error),
            });

            return {
                plan,
                success: false,
                finalResult: null,
                stepResults,
                totalExecutionTimeMs: Date.now() - startTime,
                totalCostWei: totalCost.toString(),
            };
        }
    }

    /**
     * Execute a single step
     */
    private async executeStep(
        step: PipelineStep,
        input: Record<string, unknown>,
        planId: string
    ): Promise<{
        status: StepStatus;
        result?: unknown;
        error?: string;
        costWei: string;
        txHash?: string;
    }> {
        if (!step.assignedWorker || !step.workerEndpoint) {
            return {
                status: 'failed',
                error: 'No worker assigned',
                costWei: '0',
            };
        }

        try {
            // Step 1: Generate authorization
            step.status = 'authorized';
            const auth = await this.authorizationSigner.createSignedAuthorization(
                step.stepId,
                step.assignedWorker,
                3600 // 1 hour validity
            );
            step.authorizationSignature = auth.signature;

            // Step 2: Call the worker endpoint
            step.status = 'running';
            step.startedAt = Math.floor(Date.now() / 1000);

            const response = await this.callWorkerEndpoint(
                step.workerEndpoint,
                step.serviceType,
                input,
                auth.signature
            );

            step.completedAt = Math.floor(Date.now() / 1000);
            step.status = 'completed';
            step.result = response.data;

            return {
                status: 'completed',
                result: response.data,
                costWei: response.costWei || '0',
                txHash: response.txHash,
            };
        } catch (error) {
            step.status = 'failed';
            step.error = String(error);

            return {
                status: 'failed',
                error: String(error),
                costWei: '0',
            };
        }
    }

    /**
     * Prepare input for a step based on its input mapping
     */
    private async prepareStepInput(
        step: PipelineStep,
        initialInput: Record<string, unknown>,
        previousResults: StepResult[]
    ): Promise<Record<string, unknown>> {
        const mapping = step.inputMapping;

        switch (mapping.type) {
            case 'direct':
                return mapping.directInput || initialInput;

            case 'from_previous':
                const sourceResult = previousResults.find(
                    r => r.stepId === mapping.sourceStepId
                );

                if (!sourceResult?.result) {
                    throw new Error(`Source step ${mapping.sourceStepId} has no result`);
                }

                // Extract specific field if specified
                if (mapping.sourceField && typeof sourceResult.result === 'object') {
                    const result = sourceResult.result as Record<string, unknown>;
                    return { input: result[mapping.sourceField] };
                }

                return { input: sourceResult.result };

            case 'merge':
                const merged: Record<string, unknown> = {};
                for (const source of mapping.mergeSources || []) {
                    const mergeResult = previousResults.find(r => r.stepId === source.stepId);
                    if (mergeResult?.result) {
                        if (source.field && typeof mergeResult.result === 'object' && mergeResult.result !== null) {
                            merged[source.stepId] = (mergeResult.result as Record<string, unknown>)[source.field];
                        } else {
                            merged[source.stepId] = mergeResult.result;
                        }
                    }
                }
                return merged;

            case 'transform':
                // For transform, we'd need Gemini to transform the input
                // For now, just pass through
                const lastResult = previousResults[previousResults.length - 1];
                return { input: lastResult?.result };

            default:
                return initialInput;
        }
    }

    /**
     * Call a worker's inference endpoint
     */
    private async callWorkerEndpoint(
        endpoint: string,
        serviceType: string,
        input: Record<string, unknown>,
        authSignature: string
    ): Promise<{ data: unknown; costWei?: string; txHash?: string }> {
        const url = `${endpoint}/inference/${serviceType}`;

        logger.debug('Calling worker endpoint', { url, serviceType });

        // Note: In production, this would include payment via X-Payment header
        // For now, we're simulating the call
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Authorization': authSignature,
                // 'X-Payment': txHash, // Would include payment tx
            },
            body: JSON.stringify(input),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Worker returned ${response.status}: ${errorBody}`);
        }

        const result = await response.json() as Record<string, unknown>;

        return {
            data: result.data ?? result,
            costWei: result.costWei as string | undefined,
            txHash: result.txHash as string | undefined,
        };
    }

    /**
     * Aggregate results from all steps
     */
    private aggregateResults(
        stepResults: StepResult[],
        plan: ExecutionPlan
    ): Record<string, unknown> {
        // For single agent, just return the result
        if (plan.isSingleAgent && stepResults.length === 1) {
            return {
                result: stepResults[0].result,
                serviceType: stepResults[0].serviceType,
            };
        }

        // For multi-agent, create structured output
        const aggregated: Record<string, unknown> = {
            originalRequest: plan.originalRequest,
            stepCount: stepResults.length,
            steps: stepResults.map(r => ({
                order: plan.steps.find(s => s.stepId === r.stepId)?.order,
                serviceType: r.serviceType,
                result: r.result,
                status: r.status,
            })),
            // Use the last step's result as the primary output
            finalOutput: stepResults[stepResults.length - 1]?.result,
        };

        return aggregated;
    }
}
