import { StepResult, PipelineExecutionResult } from '../types/pipeline';
import { logger } from '../utils/logger';

/**
 * Result Aggregator
 * 
 * Combines outputs from multiple pipeline steps into a unified result.
 * Handles different aggregation strategies based on step types.
 */
export class ResultAggregator {
    /**
     * Aggregate step results into a final output
     */
    aggregateResults(
        stepResults: StepResult[],
        originalRequest: string
    ): Record<string, unknown> {
        logger.debug('Aggregating results', { stepCount: stepResults.length });

        // Single step - just return the result
        if (stepResults.length === 1) {
            return {
                type: 'single',
                serviceType: stepResults[0].serviceType,
                result: stepResults[0].result,
            };
        }

        // Multiple steps - structured aggregation
        const successfulSteps = stepResults.filter(r => r.status === 'completed');
        const failedSteps = stepResults.filter(r => r.status === 'failed');

        // Determine aggregation strategy based on service types
        const serviceTypes = stepResults.map(r => r.serviceType);
        const strategy = this.determineStrategy(serviceTypes);

        return {
            type: 'pipeline',
            originalRequest,
            strategy,
            summary: this.createSummary(successfulSteps),
            steps: stepResults.map((r, i) => ({
                order: i + 1,
                serviceType: r.serviceType,
                status: r.status,
                result: r.result,
                executionTimeMs: r.executionTimeMs,
            })),
            finalOutput: this.extractFinalOutput(successfulSteps, strategy),
            stats: {
                totalSteps: stepResults.length,
                successful: successfulSteps.length,
                failed: failedSteps.length,
                totalExecutionTimeMs: stepResults.reduce((sum, r) => sum + r.executionTimeMs, 0),
            },
        };
    }

    /**
     * Determine aggregation strategy based on service types
     */
    private determineStrategy(
        serviceTypes: string[]
    ): 'research-to-content' | 'content-to-visual' | 'chain' | 'parallel' {
        // Research followed by writing
        if (
            serviceTypes.includes('researcher') &&
            (serviceTypes.includes('writer') || serviceTypes.includes('summary-generation'))
        ) {
            return 'research-to-content';
        }

        // Content followed by image
        if (
            (serviceTypes.includes('writer') || serviceTypes.includes('summary-generation')) &&
            serviceTypes.includes('image-generation')
        ) {
            return 'content-to-visual';
        }

        // Default to chain
        return 'chain';
    }

    /**
     * Create a summary of the pipeline execution
     */
    private createSummary(successfulSteps: StepResult[]): string {
        const parts = successfulSteps.map(step => {
            switch (step.serviceType) {
                case 'researcher':
                    return 'researched the topic';
                case 'writer':
                    return 'wrote content';
                case 'summary-generation':
                    return 'summarized information';
                case 'image-generation':
                    return 'generated images';
                case 'market-research':
                    return 'analyzed market data';
                default:
                    return `processed with ${step.serviceType}`;
            }
        });

        return `Pipeline ${parts.join(', then ')}.`;
    }

    /**
     * Extract the final output based on strategy
     */
    private extractFinalOutput(
        successfulSteps: StepResult[],
        strategy: string
    ): unknown {
        if (successfulSteps.length === 0) {
            return null;
        }

        const lastStep = successfulSteps[successfulSteps.length - 1];

        switch (strategy) {
            case 'research-to-content':
                // Return the written content
                const contentStep = successfulSteps.find(
                    s => s.serviceType === 'writer' || s.serviceType === 'summary-generation'
                );
                return contentStep?.result || lastStep.result;

            case 'content-to-visual':
                // Return both content and images
                const textStep = successfulSteps.find(
                    s => s.serviceType === 'writer' || s.serviceType === 'summary-generation'
                );
                const imageStep = successfulSteps.find(
                    s => s.serviceType === 'image-generation'
                );
                return {
                    content: textStep?.result,
                    images: imageStep?.result,
                };

            default:
                // Return last step result
                return lastStep.result;
        }
    }

    /**
     * Format pipeline result for display
     */
    formatForDisplay(result: PipelineExecutionResult): string {
        const lines: string[] = [];

        lines.push(`=== Pipeline Execution Result ===`);
        lines.push(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
        lines.push(`Steps: ${result.stepResults.length}`);
        lines.push(`Total Time: ${result.totalExecutionTimeMs}ms`);
        lines.push(`Total Cost: ${this.formatWei(result.totalCostWei)}`);
        lines.push('');

        for (const step of result.stepResults) {
            const icon = step.status === 'completed' ? '✓' : '✗';
            lines.push(`${icon} Step ${step.stepId.slice(0, 8)}: ${step.serviceType}`);
            lines.push(`  Status: ${step.status}`);
            lines.push(`  Time: ${step.executionTimeMs}ms`);
            if (step.error) {
                lines.push(`  Error: ${step.error}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Format wei to readable string
     */
    private formatWei(weiStr: string): string {
        const wei = BigInt(weiStr);
        const eth = Number(wei) / 1e18;
        return `${eth.toFixed(6)} zkTCRO`;
    }

    /**
     * Combine results for specific use cases
     */
    combineForReport(stepResults: StepResult[]): {
        research?: unknown;
        content?: unknown;
        visuals?: unknown;
        analysis?: unknown;
    } {
        const combined: Record<string, unknown> = {};

        for (const step of stepResults) {
            if (step.status !== 'completed') continue;

            switch (step.serviceType) {
                case 'researcher':
                    combined.research = step.result;
                    break;
                case 'writer':
                case 'summary-generation':
                    combined.content = step.result;
                    break;
                case 'image-generation':
                    combined.visuals = step.result;
                    break;
                case 'market-research':
                    combined.analysis = step.result;
                    break;
            }
        }

        return combined;
    }
}
