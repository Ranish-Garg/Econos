import { GoogleGenAI } from '@google/genai';
import { CapabilitySummary, TaskAnalysisResult, AnalyzeOptions } from '../types/pipeline';
import { logger } from '../utils/logger';

/**
 * Task Analyzer
 * 
 * Uses Gemini AI to analyze incoming task requests and determine:
 * 1. Whether the task requires single or multiple agents
 * 2. Which services are needed
 * 3. The optimal execution order
 */
export class TaskAnalyzer {
    private ai: GoogleGenAI;
    private model = 'gemini-2.0-flash';

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set');
        }
        this.ai = new GoogleGenAI({ apiKey });
    }

    /**
     * Analyze a task request to determine execution strategy
     */
    async analyzeTask(
        request: string,
        capabilities: CapabilitySummary,
        options: AnalyzeOptions = {}
    ): Promise<TaskAnalysisResult> {
        logger.info('Analyzing task with Gemini', {
            requestLength: request.length,
            availableServices: capabilities.availableServiceTypes,
        });

        // Handle force options
        if (options.forceSingleAgent) {
            return this.createSingleAgentAnalysis(request, capabilities);
        }

        const prompt = this.buildAnalysisPrompt(request, capabilities, options);

        try {
            const response = await this.ai.models.generateContent({
                model: this.model,
                contents: prompt,
                config: {
                    temperature: 0.3, // Lower temperature for more consistent structured output
                    responseMimeType: 'application/json',
                },
            });

            const text = response.text || '';
            const analysis = this.parseAnalysisResponse(text, capabilities);

            logger.info('Task analysis complete', {
                isSingleAgent: analysis.isSingleAgent,
                stepCount: analysis.steps.length,
                confidence: analysis.confidence,
            });

            return analysis;
        } catch (error) {
            logger.error('Task analysis failed', { error: String(error) });
            // Fallback to single agent with best-guess service
            return this.createFallbackAnalysis(request, capabilities);
        }
    }

    /**
     * Build the analysis prompt for Gemini
     */
    private buildAnalysisPrompt(
        request: string,
        capabilities: CapabilitySummary,
        options: AnalyzeOptions
    ): string {
        const maxSteps = options.maxSteps || 5;

        return `You are an AI task orchestrator. Analyze the following user request and determine how to execute it using the available services.

USER REQUEST:
"${request}"

AVAILABLE SERVICES:
${capabilities.textSummary}

INSTRUCTIONS:
1. Analyze what the user wants to accomplish
2. Determine if this can be done with a SINGLE service or requires MULTIPLE services
3. If multiple services are needed, determine the optimal order of execution
4. Each step can use the output from previous steps as input

RULES:
- Use ONLY the services listed above
- Maximum ${maxSteps} steps allowed
- If a task cannot be accomplished with available services, use the closest match
- Prefer fewer steps when possible (simpler is better)

Respond with JSON in this exact format:
{
  "isSingleAgent": boolean,
  "reasoning": "Brief explanation of why single or multi-agent",
  "steps": [
    {
      "order": 1,
      "serviceType": "service-id from available services",
      "description": "What this step accomplishes",
      "inputSource": "user" or "previous",
      "inputField": "specific field from previous step output, if applicable"
    }
  ],
  "confidence": 0.0 to 1.0
}

EXAMPLES:
- "Summarize this article" → single agent (summary-generation)
- "Research AI trends and write a blog post" → multi-agent (researcher → writer)
- "Generate an image of a sunset" → single agent (image-generation)
- "Research crypto market and create a visual report" → multi-agent (market-research → image-generation)`;
    }

    /**
     * Parse the analysis response from Gemini
     */
    private parseAnalysisResponse(
        text: string,
        capabilities: CapabilitySummary
    ): TaskAnalysisResult {
        try {
            // Clean the response (remove markdown code blocks if present)
            let cleanText = text.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.slice(7);
            }
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.slice(3);
            }
            if (cleanText.endsWith('```')) {
                cleanText = cleanText.slice(0, -3);
            }

            const parsed = JSON.parse(cleanText.trim());

            // Validate and normalize the response
            const result: TaskAnalysisResult = {
                isSingleAgent: Boolean(parsed.isSingleAgent),
                reasoning: String(parsed.reasoning || 'No reasoning provided'),
                confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
                steps: [],
            };

            // Validate steps
            if (Array.isArray(parsed.steps)) {
                for (const step of parsed.steps) {
                    // Verify service type exists
                    if (!capabilities.availableServiceTypes.includes(step.serviceType)) {
                        logger.warn('Unknown service type in analysis', {
                            serviceType: step.serviceType,
                            available: capabilities.availableServiceTypes,
                        });
                        // Skip invalid steps
                        continue;
                    }

                    result.steps.push({
                        order: Number(step.order),
                        serviceType: String(step.serviceType),
                        description: String(step.description || ''),
                        inputSource: step.inputSource === 'previous' ? 'previous' : 'user',
                        inputField: step.inputField ? String(step.inputField) : undefined,
                    });
                }
            }

            // Ensure at least one step
            if (result.steps.length === 0) {
                return this.createFallbackAnalysis('', capabilities);
            }

            // Update isSingleAgent based on actual steps
            result.isSingleAgent = result.steps.length === 1;

            return result;
        } catch (error) {
            logger.error('Failed to parse analysis response', {
                text: text.slice(0, 200),
                error: String(error),
            });
            throw error;
        }
    }

    /**
     * Create a single-agent analysis (when forced)
     */
    private createSingleAgentAnalysis(
        request: string,
        capabilities: CapabilitySummary
    ): TaskAnalysisResult {
        // Use first available service as default
        const serviceType = capabilities.availableServiceTypes[0] || 'summary-generation';

        return {
            isSingleAgent: true,
            reasoning: 'Forced single-agent execution',
            confidence: 0.7,
            steps: [{
                order: 1,
                serviceType,
                description: 'Execute task with single agent',
                inputSource: 'user',
            }],
        };
    }

    /**
     * Create a fallback analysis when parsing fails
     */
    private createFallbackAnalysis(
        request: string,
        capabilities: CapabilitySummary
    ): TaskAnalysisResult {
        logger.warn('Using fallback analysis');

        // Try to guess the best service based on keywords
        const requestLower = request.toLowerCase();
        let serviceType = 'summary-generation'; // Default

        if (requestLower.includes('image') || requestLower.includes('picture') || requestLower.includes('photo')) {
            serviceType = 'image-generation';
        } else if (requestLower.includes('research') || requestLower.includes('investigate')) {
            serviceType = 'researcher';
        } else if (requestLower.includes('write') || requestLower.includes('article') || requestLower.includes('blog')) {
            serviceType = 'writer';
        } else if (requestLower.includes('market') || requestLower.includes('crypto') || requestLower.includes('price')) {
            serviceType = 'market-research';
        }

        // Verify service is available
        if (!capabilities.availableServiceTypes.includes(serviceType)) {
            serviceType = capabilities.availableServiceTypes[0] || 'summary-generation';
        }

        return {
            isSingleAgent: true,
            reasoning: 'Fallback analysis - using best-guess service',
            confidence: 0.3,
            steps: [{
                order: 1,
                serviceType,
                description: `Process request with ${serviceType}`,
                inputSource: 'user',
            }],
        };
    }
}
