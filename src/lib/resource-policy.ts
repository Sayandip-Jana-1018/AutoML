/**
 * Resource Policy Configuration
 * Defines allowed resources per subscription tier
 */

export type SubscriptionTier = 'free' | 'silver' | 'gold';

export interface ResourceLimits {
    allowedMachineTypes: string[];
    maxTrainingHours: number;
    maxHpoTrials: number;
    maxEpochs: number;
    maxTrees: number;
    maxBatchSize: number;
    allowedAlgorithms: string[];
}

export const RESOURCE_POLICIES: Record<SubscriptionTier, ResourceLimits> = {
    free: {
        allowedMachineTypes: ['e2-highmem-2'],  // Cheapest supported type (2 vCPU, 16GB RAM)
        maxTrainingHours: 1,
        maxHpoTrials: 0,
        maxEpochs: 50,
        maxTrees: 100,
        maxBatchSize: 64,
        allowedAlgorithms: [
            'RandomForest',
            'LogisticRegression',
            'DecisionTree',
            'LinearRegression'
        ]
    },
    silver: {
        allowedMachineTypes: ['e2-highmem-2', 'e2-standard-4'],
        maxTrainingHours: 4,
        maxHpoTrials: 5,
        maxEpochs: 100,
        maxTrees: 500,
        maxBatchSize: 256,
        allowedAlgorithms: [
            'RandomForest',
            'LogisticRegression',
            'DecisionTree',
            'LinearRegression',
            'XGBoost',
            'GradientBoosting',
            'SVM',
            'KNN'
        ]
    },
    gold: {
        allowedMachineTypes: ['e2-highmem-2', 'e2-standard-4', 'e2-standard-8', 'e2-highmem-8', 'e2-standard-16'],
        maxTrainingHours: 24,
        maxHpoTrials: 50,
        maxEpochs: 500,
        maxTrees: 2000,
        maxBatchSize: 1024,
        allowedAlgorithms: [
            'RandomForest',
            'LogisticRegression',
            'DecisionTree',
            'LinearRegression',
            'XGBoost',
            'GradientBoosting',
            'SVM',
            'KNN',
            'NeuralNetwork',
            'DeepLearning',
            'LightGBM',
            'CatBoost'
        ]
    }
};

/**
 * Machine Type Descriptions for UI
 */
export const MACHINE_TYPE_INFO: Record<string, { name: string; specs: string; bestFor: string }> = {
    'e2-highmem-2': {
        name: 'Economy (2 vCPU)',
        specs: '2 vCPU, 16 GB RAM',
        bestFor: 'Small datasets, quick experiments (Free tier)'
    },
    'e2-standard-4': {
        name: 'Standard (4 vCPU)',
        specs: '4 vCPU, 16 GB RAM',
        bestFor: 'Medium datasets, tree-based models'
    },
    'e2-standard-8': {
        name: 'Standard (8 vCPU)',
        specs: '8 vCPU, 32 GB RAM',
        bestFor: 'Large datasets, complex models'
    },
    'e2-highmem-8': {
        name: 'High Memory (8 vCPU)',
        specs: '8 vCPU, 64 GB RAM',
        bestFor: 'Memory-intensive preprocessing'
    },
    'e2-standard-16': {
        name: 'Performance (16 vCPU)',
        specs: '16 vCPU, 64 GB RAM',
        bestFor: 'Very large datasets, neural networks'
    }
};

/**
 * Per-User Quotas (for multi-tenant SaaS)
 */
export interface UserQuota {
    maxDatasets: number;
    maxJobsPerDay: number;
    maxParallelJobs: number;
    maxStorageGB: number;
}

export const USER_QUOTAS: Record<SubscriptionTier, UserQuota> = {
    free: {
        maxDatasets: 5,
        maxJobsPerDay: 3,
        maxParallelJobs: 1,
        maxStorageGB: 1
    },
    silver: {
        maxDatasets: 20,
        maxJobsPerDay: 10,
        maxParallelJobs: 2,
        maxStorageGB: 10
    },
    gold: {
        maxDatasets: 100,
        maxJobsPerDay: 50,
        maxParallelJobs: 3,
        maxStorageGB: 100
    }
};

/**
 * Machine type hourly costs (approximate, for estimation)
 */
export const MACHINE_COSTS: Record<string, number> = {
    'e2-highmem-2': 0.09,
    'e2-standard-4': 0.13,
    'e2-standard-8': 0.27,
    'e2-highmem-8': 0.36,
    'e2-standard-16': 0.54
};

/**
 * Global hard limits (independent of tiers)
 * These are absolute maximums that cannot be exceeded even with highest tier
 */
export const GLOBAL_HARD_LIMITS = {
    maxTrainingHours: 48,       // Absolute max 48 hours
    maxHpoTrials: 100,          // Absolute max 100 HPO trials
    maxEpochs: 1000,            // Absolute max epochs
    maxTrees: 5000,             // Absolute max trees
    maxBatchSize: 4096,         // Absolute max batch size
    allowedGpuTypes: [          // Allowed GPU types (currently none for safety)
        // 'nvidia-tesla-t4',
        // 'nvidia-tesla-v100'
    ],
    maxConcurrentJobs: 3,       // Max jobs per user
    maxStorageGb: 100,          // Max storage per project
};

/**
 * Validates training configuration against resource limits
 */
export function validateTrainingConfig(
    tier: SubscriptionTier,
    config: {
        machineType?: string;
        epochs?: number;
        trees?: number;
        batchSize?: number;
        algorithm?: string;
        hpoTrials?: number;
    }
): { valid: boolean; errors: string[] } {
    const limits = RESOURCE_POLICIES[tier];
    const errors: string[] = [];

    // Check machine type
    if (config.machineType && !limits.allowedMachineTypes.includes(config.machineType)) {
        errors.push(`Machine type '${config.machineType}' not allowed on ${tier} plan. Allowed: ${limits.allowedMachineTypes.join(', ')}`);
    }

    // Check epochs
    if (config.epochs && config.epochs > limits.maxEpochs) {
        errors.push(`Epochs (${config.epochs}) exceeds limit (${limits.maxEpochs}) for ${tier} plan`);
    }

    // Check trees
    if (config.trees && config.trees > limits.maxTrees) {
        errors.push(`Trees (${config.trees}) exceeds limit (${limits.maxTrees}) for ${tier} plan`);
    }

    // Check batch size
    if (config.batchSize && config.batchSize > limits.maxBatchSize) {
        errors.push(`Batch size (${config.batchSize}) exceeds limit (${limits.maxBatchSize}) for ${tier} plan`);
    }

    // Check algorithm
    if (config.algorithm && !limits.allowedAlgorithms.includes(config.algorithm)) {
        errors.push(`Algorithm '${config.algorithm}' not available on ${tier} plan`);
    }

    // Check HPO trials
    if (config.hpoTrials && config.hpoTrials > limits.maxHpoTrials) {
        errors.push(`HPO trials (${config.hpoTrials}) exceeds limit (${limits.maxHpoTrials}) for ${tier} plan`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Gets the Vertex AI timeout duration in seconds based on tier
 */
export function getMaxTrainingTimeout(tier: SubscriptionTier): number {
    return RESOURCE_POLICIES[tier].maxTrainingHours * 3600;
}

/**
 * Estimates job cost based on machine type and duration
 */
export function estimateJobCost(machineType: string, durationHours: number): number {
    const hourlyRate = MACHINE_COSTS[machineType] || 0.20; // Default rate
    return hourlyRate * durationHours;
}

/**
 * Gets the default machine type for a tier
 */
export function getDefaultMachineType(tier: SubscriptionTier): string {
    return RESOURCE_POLICIES[tier].allowedMachineTypes[0];
}

/**
 * Developer Mode Toggle
 * When NODE_ENV is 'development', relaxes limits for easier testing
 */
export function isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development';
}

/**
 * Development-mode resource limits (relaxed for testing)
 */
export const DEV_MODE_LIMITS: ResourceLimits = {
    allowedMachineTypes: ['e2-highmem-2', 'e2-standard-4', 'e2-standard-8'],
    maxTrainingHours: 24,
    maxHpoTrials: 50,
    maxEpochs: 500,
    maxTrees: 2000,
    maxBatchSize: 1024,
    allowedAlgorithms: [
        'RandomForest',
        'LogisticRegression',
        'DecisionTree',
        'LinearRegression',
        'XGBoost',
        'GradientBoosting',
        'SVM',
        'KNN',
        'NeuralNetwork',
        'LightGBM',
        'CatBoost'
    ]
};

/**
 * Get effective limits (uses dev mode if in development)
 */
export function getEffectiveLimits(tier: SubscriptionTier): ResourceLimits {
    if (isDevelopmentMode()) {
        console.log('[Dev Mode] Using relaxed resource limits');
        return DEV_MODE_LIMITS;
    }
    return RESOURCE_POLICIES[tier];
}

/**
 * Standardized job failure fields for Firestore
 */
export interface JobFailureInfo {
    status: 'failed';
    errorMessage: string;
    errorCode?: string;
    logsPreview: string[];  // First 10 error lines
    failedAt: Date;
    retryable: boolean;
}

/**
 * Creates standardized failure info for job documents
 */
export function createJobFailureInfo(
    error: Error | string,
    logs: string[] = []
): JobFailureInfo {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorLogs = logs.filter(l =>
        l.toLowerCase().includes('error') ||
        l.toLowerCase().includes('exception') ||
        l.toLowerCase().includes('failed')
    );

    return {
        status: 'failed',
        errorMessage,
        errorCode: typeof error !== 'string' ? error.name : undefined,
        logsPreview: errorLogs.slice(0, 10),
        failedAt: new Date(),
        retryable: !errorMessage.includes('quota') && !errorMessage.includes('permission')
    };
}
