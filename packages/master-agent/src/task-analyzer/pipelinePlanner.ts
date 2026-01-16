import { v4 as uuidv4 } from 'uuid';
import {
    ExecutionPlan,
    PipelineStep,
    TaskAnalysisResult,
    CapabilitySummary,
    InputMapping,
    AnalyzeOptions,
} from '../types/pipeline';
import { CapabilityDiscovery } from './capabilityDiscovery';
import { logger } from '../utils/logger';

/**
 * Pipeline Planner
 * 
 * Creates executable plans from task analysis results.
 * Assigns workers, estimates costs, and sets up input mappings.
 */
export class PipelinePlanner {
    private capabilityDiscovery: CapabilityDiscovery;

    constructor(capabilityDiscovery: CapabilityDiscovery) {
        this.capabilityDiscovery = capabilityDiscovery;
    }

    /**
     * Create an execution plan from analysis result
     */
    async createPlan(
        originalRequest: string,
        analysis: TaskAnalysisResult,
        options: AnalyzeOptions = {}
    ): Promise<ExecutionPlan> {
        const planId = uuidv4();

        logger.info('Creating execution plan', {
            planId,
            stepCount: analysis.steps.length,
            isSingleAgent: analysis.isSingleAgent,
        });

        // Create pipeline steps with worker assignments
        const steps: PipelineStep[] = [];
        let totalBudget = 0n;

        for (const analysisStep of analysis.steps) {
            // Find best worker for this service
            const worker = this.capabilityDiscovery.getCheapestWorkerForService(
                analysisStep.serviceType
            );

            if (!worker) {
                logger.error('No worker available for service', {
                    serviceType: analysisStep.serviceType,
                });
                throw new Error(`No worker available for service: ${analysisStep.serviceType}`);
            }

            // Create input mapping
            const inputMapping = this.createInputMapping(analysisStep, steps);

            const step: PipelineStep = {
                stepId: uuidv4(),
                order: analysisStep.order,
                serviceType: analysisStep.serviceType,
                description: analysisStep.description,
                inputMapping,
                assignedWorker: worker.workerAddress,
                workerEndpoint: worker.workerEndpoint,
                status: 'pending',
            };

            steps.push(step);
            totalBudget += BigInt(worker.priceWei);
        }

        // Check budget limit
        if (options.maxBudgetEther) {
            const maxBudgetWei = BigInt(parseFloat(options.maxBudgetEther) * 1e18);
            if (totalBudget > maxBudgetWei) {
                throw new Error(
                    `Estimated cost (${this.formatWei(totalBudget)}) exceeds max budget (${options.maxBudgetEther} zkTCRO)`
                );
            }
        }

        const plan: ExecutionPlan = {
            planId,
            originalRequest,
            isSingleAgent: analysis.isSingleAgent,
            reasoning: analysis.reasoning,
            steps,
            estimatedBudgetWei: totalBudget.toString(),
            createdAt: Math.floor(Date.now() / 1000),
        };

        logger.info('Execution plan created', {
            planId,
            stepCount: steps.length,
            estimatedBudget: this.formatWei(totalBudget),
        });

        return plan;
    }

    /**
     * Create input mapping for a step
     */
    private createInputMapping(
        analysisStep: TaskAnalysisResult['steps'][0],
        previousSteps: PipelineStep[]
    ): InputMapping {
        if (analysisStep.inputSource === 'user' || previousSteps.length === 0) {
            return {
                type: 'direct',
                directInput: {}, // Will be filled during execution
            };
        }

        // Input from previous step
        const previousStep = previousSteps[previousSteps.length - 1];

        return {
            type: 'from_previous',
            sourceStepId: previousStep.stepId,
            sourceField: analysisStep.inputField,
        };
    }

    /**
     * Validate that all services in a plan are available
     */
    async validatePlan(plan: ExecutionPlan): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];

        for (const step of plan.steps) {
            // Check service availability
            if (!this.capabilityDiscovery.isServiceAvailable(step.serviceType)) {
                errors.push(`Service not available: ${step.serviceType}`);
            }

            // Check worker assignment
            if (!step.assignedWorker) {
                errors.push(`No worker assigned for step ${step.order}: ${step.serviceType}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Estimate total cost of a plan
     */
    estimateCost(plan: ExecutionPlan): { totalWei: string; breakdown: Record<string, string> } {
        const breakdown: Record<string, string> = {};
        let total = 0n;

        for (const step of plan.steps) {
            const worker = this.capabilityDiscovery.getCheapestWorkerForService(step.serviceType);
            if (worker) {
                breakdown[`Step ${step.order}: ${step.serviceType}`] = this.formatWei(BigInt(worker.priceWei));
                total += BigInt(worker.priceWei);
            }
        }

        return {
            totalWei: total.toString(),
            breakdown,
        };
    }

    /**
     * Format wei to readable string
     */
    private formatWei(wei: bigint): string {
        const eth = Number(wei) / 1e18;
        return `${eth.toFixed(6)} zkTCRO`;
    }

    /**
     * Optimize a plan by reducing steps or using cheaper workers
     */
    async optimizePlan(plan: ExecutionPlan): Promise<ExecutionPlan> {
        // For now, just reassign to cheapest workers
        const optimizedSteps = plan.steps.map(step => {
            const cheapestWorker = this.capabilityDiscovery.getCheapestWorkerForService(
                step.serviceType
            );

            if (cheapestWorker) {
                return {
                    ...step,
                    assignedWorker: cheapestWorker.workerAddress,
                    workerEndpoint: cheapestWorker.workerEndpoint,
                };
            }

            return step;
        });

        // Recalculate budget
        let totalBudget = 0n;
        for (const step of optimizedSteps) {
            const worker = this.capabilityDiscovery.getCheapestWorkerForService(step.serviceType);
            if (worker) {
                totalBudget += BigInt(worker.priceWei);
            }
        }

        return {
            ...plan,
            steps: optimizedSteps,
            estimatedBudgetWei: totalBudget.toString(),
        };
    }
}
