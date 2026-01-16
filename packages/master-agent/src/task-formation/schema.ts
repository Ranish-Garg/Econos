import { z } from 'zod';

/**
 * Supported task types (capability labels)
 * These should match the services available in the worker-node
 */
export const SUPPORTED_TASK_TYPES = [
    'image-generation',
    'summary-generation',
    'researcher',
    'writer',
    'market-research',
] as const;

/**
 * Task type schema
 */
export const TaskTypeSchema = z.enum(SUPPORTED_TASK_TYPES);
export type TaskType = z.infer<typeof TaskTypeSchema>;

/**
 * Schema for creating a new task
 */
export const CreateTaskInputSchema = z.object({
    /** Task type / capability label */
    taskType: TaskTypeSchema,

    /** Input parameters for the task */
    inputParameters: z.record(z.unknown()),

    /** Optional: Desired worker group */
    desiredWorkerGroup: z.string().optional(),

    /** Optional: Required capabilities */
    requiredCapabilities: z.array(z.string()).optional(),

    /** Duration in seconds (1 hour to 7 days) */
    durationSeconds: z.number().int().min(3600).max(604800),

    /** Budget in ether (e.g., "0.01") */
    budgetEther: z.string().refine(
        (val) => {
            try {
                const num = parseFloat(val);
                return num > 0 && num <= 100;
            } catch {
                return false;
            }
        },
        { message: 'Budget must be a positive number in ether (max 100)' }
    ),
});

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

/**
 * Schema for image generation task input
 */
export const ImageGenerationInputSchema = z.object({
    prompt: z.string().min(1).max(4000),
    numberOfImages: z.number().int().min(1).max(4).optional().default(1),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional(),
    style: z.enum(['photo', 'art', 'digital_art', 'sketch']).optional(),
    negativePrompt: z.string().max(1000).optional(),
});

/**
 * Schema for summary generation task input
 */
export const SummaryGenerationInputSchema = z.object({
    text: z.string().min(1).max(50000),
    maxSentences: z.number().int().min(1).max(20).optional().default(5),
    style: z.enum(['concise', 'detailed', 'bullet_points']).optional().default('concise'),
    language: z.string().optional().default('english'),
});

/**
 * Schema for researcher task input
 */
export const ResearcherInputSchema = z.object({
    topic: z.string().min(1).max(500),
    depth: z.enum(['quick', 'standard', 'deep']).optional().default('standard'),
    focusAreas: z.array(z.string()).optional(),
    excludeTopics: z.array(z.string()).optional(),
});

/**
 * Schema for writer task input
 */
export const WriterInputSchema = z.object({
    topic: z.string().min(1).max(500),
    contentType: z.enum(['article', 'blog_post', 'essay', 'report', 'creative']),
    wordCountTarget: z.number().int().min(100).max(10000).optional().default(500),
    tone: z.enum(['formal', 'casual', 'professional', 'creative']).optional().default('professional'),
    outline: z.string().optional(),
    keyPoints: z.array(z.string()).optional(),
});

/**
 * Schema for market research task input
 */
export const MarketResearchInputSchema = z.object({
    symbol: z.string().min(1).max(20),
    analysisType: z.enum(['price', 'volume', 'sentiment', 'technical', 'comprehensive']).optional().default('comprehensive'),
    timeframe: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
    includeNews: z.boolean().optional().default(true),
});

/**
 * Get the appropriate input schema for a task type
 */
export function getInputSchemaForTaskType(taskType: TaskType): z.ZodType {
    const schemas: Record<TaskType, z.ZodType> = {
        'image-generation': ImageGenerationInputSchema,
        'summary-generation': SummaryGenerationInputSchema,
        'researcher': ResearcherInputSchema,
        'writer': WriterInputSchema,
        'market-research': MarketResearchInputSchema,
    };

    return schemas[taskType];
}

/**
 * Validate task input parameters against the task type's schema
 */
export function validateTaskInput(taskType: TaskType, input: unknown): boolean {
    const schema = getInputSchemaForTaskType(taskType);
    const result = schema.safeParse(input);
    return result.success;
}
