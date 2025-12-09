import { NextResponse } from 'next/server';
import { generateStructuredTrainScript, generateTaskSpecificCleaningCode, createCleaningMetadata, DEFAULT_CLEANING_CONFIG, type CleaningConfig } from '@/lib/data-cleaning';
import { RESOURCE_POLICIES, type SubscriptionTier } from '@/lib/resource-policy';

export const runtime = 'edge';

/**
 * Script generation options
 */
interface ScriptOptions {
    datasetPath: string;
    targetColumn: string;
    algorithm: string;
    taskType: 'classification' | 'regression';
    testSize: number;
    epochs?: number;
    trees?: number;
    learningRate?: number;
    cleaningConfig?: CleaningConfig;
    tier?: SubscriptionTier;
}

/**
 * Validates script config against resource limits and internal consistency
 */
function validateScriptConfig(options: ScriptOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const tier = options.tier || 'free';
    const limits = RESOURCE_POLICIES[tier];

    // Check epochs
    if (options.epochs && options.epochs > limits.maxEpochs) {
        errors.push(`Epochs (${options.epochs}) exceeds ${tier} tier limit (${limits.maxEpochs})`);
    }

    // Check trees
    if (options.trees && options.trees > limits.maxTrees) {
        errors.push(`Trees (${options.trees}) exceeds ${tier} tier limit (${limits.maxTrees})`);
    }

    // Check algorithm
    if (!limits.allowedAlgorithms.includes(options.algorithm)) {
        errors.push(`Algorithm '${options.algorithm}' is not available on ${tier} tier`);
    }

    // Check testSize bounds
    if (options.testSize < 0.05 || options.testSize > 0.5) {
        errors.push(`Test size (${options.testSize}) must be between 0.05 and 0.5`);
    }

    // Task-algorithm compatibility check
    const regressionOnlyAlgos = ['LinearRegression', 'Ridge'];
    const classificationOnlyAlgos = ['LogisticRegression'];

    if (options.taskType === 'classification' && regressionOnlyAlgos.includes(options.algorithm)) {
        errors.push(`Algorithm '${options.algorithm}' is only for regression tasks`);
    }
    if (options.taskType === 'regression' && classificationOnlyAlgos.includes(options.algorithm)) {
        errors.push(`Algorithm '${options.algorithm}' is only for classification tasks`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Generates a structured train.py script based on dataset and configuration
 * Also validates config against tier limits
 */
export async function POST(req: Request) {
    try {
        const {
            datasetPath,
            targetColumn,
            algorithm = 'RandomForest',
            taskType = 'classification',
            testSize = 0.2,
            epochs,
            trees,
            learningRate,
            cleaningConfig,
            tier = 'free'
        } = await req.json();

        if (!datasetPath || !targetColumn) {
            return NextResponse.json({
                error: "Missing required fields: datasetPath, targetColumn"
            }, { status: 400 });
        }

        // Build options
        const options: ScriptOptions = {
            datasetPath,
            targetColumn,
            algorithm,
            taskType: taskType === 'regression' ? 'regression' : 'classification',
            testSize,
            epochs,
            trees,
            learningRate,
            tier
        };

        // Validate tier type
        const validTier: SubscriptionTier = ['free', 'silver', 'gold'].includes(tier) ? tier : 'free';

        // Validate against tier limits
        const validation = validateScriptConfig(options);
        if (!validation.valid) {
            return NextResponse.json({
                error: "Script configuration validation failed",
                violations: validation.errors,
                suggestion: `Your ${validTier} tier allows: max ${RESOURCE_POLICIES[validTier].maxEpochs} epochs, ${RESOURCE_POLICIES[validTier].maxTrees} trees`
            }, { status: 403 });
        }

        // Merge with defaults
        const finalCleaningConfig: CleaningConfig = {
            ...DEFAULT_CLEANING_CONFIG,
            taskType: options.taskType,
            ...cleaningConfig
        };

        // Generate structured script
        const script = generateStructuredTrainScript({
            datasetPath,
            targetColumn,
            algorithm,
            taskType: options.taskType,
            testSize,
            cleaningConfig: finalCleaningConfig
        });

        // Generate task-specific cleaning code
        const taskSpecificCode = generateTaskSpecificCleaningCode(
            finalCleaningConfig,
            options.taskType,
            targetColumn
        );

        // Create cleaning metadata for job tracking
        const cleaningMetadata = createCleaningMetadata(finalCleaningConfig);

        // Construct response with full options for reproducibility
        const scriptOptions = {
            datasetPath,
            targetColumn,
            algorithm,
            taskType: options.taskType,
            testSize,
            epochs: epochs || null,
            trees: trees || null,
            learningRate: learningRate || null,
            cleaningConfig: finalCleaningConfig,
            validatedAt: new Date().toISOString(),
            tier
        };

        return NextResponse.json({
            script,
            taskSpecificCode,
            options: scriptOptions,
            cleaningMetadata,
            config: scriptOptions, // Alias for consistency
            generatedBy: 'generate-script-api',
            message: `Generated ${algorithm} training script for ${options.taskType} task`
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to generate script";
        console.error("Script Generation Error:", error);
        return NextResponse.json({
            error: errorMessage
        }, { status: 500 });
    }
}
