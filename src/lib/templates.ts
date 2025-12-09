/**
 * Pipeline Templates
 * Pre-configured ML pipelines for common use cases
 */

import { CleaningConfig, DEFAULT_CLEANING_CONFIG } from './data-cleaning';
import type { SubscriptionTier } from './resource-policy';

export interface PipelineTemplate {
    id: string;
    name: string;
    description: string;
    taskType: 'classification' | 'regression';
    category: 'binary' | 'multiclass' | 'regression' | 'timeseries';

    // Recommended configuration
    algorithm: string;
    hyperparameters: {
        epochs?: number;
        trees?: number;
        learningRate?: number;
        testSize?: number;
        batchSize?: number;
    };
    cleaningConfig: CleaningConfig;

    // Requirements
    minTier: SubscriptionTier;
    estimatedDuration: string;

    // UI hints
    icon: string;
    color: string;
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
    // Classification Templates
    {
        id: 'binary-classification-basic',
        name: 'Binary Classification',
        description: 'Two-class prediction (yes/no, true/false, spam/not-spam)',
        taskType: 'classification',
        category: 'binary',
        algorithm: 'RandomForest',
        hyperparameters: {
            trees: 100,
            testSize: 0.2
        },
        cleaningConfig: {
            ...DEFAULT_CLEANING_CONFIG,
            taskType: 'classification',
            handleClassImbalance: true,
            encodeLabels: true
        },
        minTier: 'free',
        estimatedDuration: '10-30 min',
        icon: 'binary',
        color: 'blue'
    },
    {
        id: 'binary-classification-xgboost',
        name: 'Binary Classification (XGBoost)',
        description: 'High-accuracy binary prediction with gradient boosting',
        taskType: 'classification',
        category: 'binary',
        algorithm: 'XGBoost',
        hyperparameters: {
            trees: 200,
            learningRate: 0.1,
            testSize: 0.2
        },
        cleaningConfig: {
            ...DEFAULT_CLEANING_CONFIG,
            taskType: 'classification',
            handleClassImbalance: true,
            encodeLabels: true
        },
        minTier: 'silver',
        estimatedDuration: '20-60 min',
        icon: 'zap',
        color: 'yellow'
    },
    {
        id: 'multiclass-classification',
        name: 'Multi-Class Classification',
        description: 'Categorization into 3+ classes (product categories, sentiment levels)',
        taskType: 'classification',
        category: 'multiclass',
        algorithm: 'RandomForest',
        hyperparameters: {
            trees: 150,
            testSize: 0.2
        },
        cleaningConfig: {
            ...DEFAULT_CLEANING_CONFIG,
            taskType: 'classification',
            handleClassImbalance: true,
            encodeLabels: true
        },
        minTier: 'free',
        estimatedDuration: '15-45 min',
        icon: 'layers',
        color: 'purple'
    },
    {
        id: 'multiclass-neural',
        name: 'Multi-Class (Neural Network)',
        description: 'Deep learning for complex multi-class problems',
        taskType: 'classification',
        category: 'multiclass',
        algorithm: 'NeuralNetwork',
        hyperparameters: {
            epochs: 50,
            batchSize: 32,
            learningRate: 0.001,
            testSize: 0.2
        },
        cleaningConfig: {
            ...DEFAULT_CLEANING_CONFIG,
            taskType: 'classification',
            handleClassImbalance: false,
            encodeLabels: true
        },
        minTier: 'gold',
        estimatedDuration: '1-3 hours',
        icon: 'brain',
        color: 'pink'
    },

    // Regression Templates
    {
        id: 'regression-basic',
        name: 'Basic Regression',
        description: 'Predict continuous values (prices, scores, temperatures)',
        taskType: 'regression',
        category: 'regression',
        algorithm: 'LinearRegression',
        hyperparameters: {
            testSize: 0.2
        },
        cleaningConfig: {
            ...DEFAULT_CLEANING_CONFIG,
            taskType: 'regression',
            normalizeTarget: true,
            removeOutliers: true
        },
        minTier: 'free',
        estimatedDuration: '5-15 min',
        icon: 'trending-up',
        color: 'green'
    },
    {
        id: 'regression-ensemble',
        name: 'Ensemble Regression',
        description: 'High-accuracy value prediction with Random Forest',
        taskType: 'regression',
        category: 'regression',
        algorithm: 'RandomForest',
        hyperparameters: {
            trees: 100,
            testSize: 0.2
        },
        cleaningConfig: {
            ...DEFAULT_CLEANING_CONFIG,
            taskType: 'regression',
            normalizeTarget: false,
            removeOutliers: true
        },
        minTier: 'free',
        estimatedDuration: '15-45 min',
        icon: 'bar-chart',
        color: 'teal'
    },
    {
        id: 'regression-xgboost',
        name: 'Advanced Regression (XGBoost)',
        description: 'State-of-the-art regression with gradient boosting',
        taskType: 'regression',
        category: 'regression',
        algorithm: 'XGBoost',
        hyperparameters: {
            trees: 200,
            learningRate: 0.1,
            testSize: 0.2
        },
        cleaningConfig: {
            ...DEFAULT_CLEANING_CONFIG,
            taskType: 'regression',
            normalizeTarget: true,
            removeOutliers: true
        },
        minTier: 'silver',
        estimatedDuration: '30-90 min',
        icon: 'rocket',
        color: 'orange'
    }
];

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): PipelineTemplate | undefined {
    return PIPELINE_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Get templates for a task type
 */
export function getTemplatesForTaskType(
    taskType: 'classification' | 'regression'
): PipelineTemplate[] {
    return PIPELINE_TEMPLATES.filter(t => t.taskType === taskType);
}

/**
 * Get templates available for a tier
 */
export function getTemplatesForTier(tier: SubscriptionTier): PipelineTemplate[] {
    const tierLevel = { free: 0, silver: 1, gold: 2 };
    return PIPELINE_TEMPLATES.filter(t => tierLevel[t.minTier] <= tierLevel[tier]);
}

/**
 * Suggest best template based on dataset characteristics
 */
export function suggestTemplate(
    taskType: 'classification' | 'regression',
    tier: SubscriptionTier,
    datasetSize: number,
    numClasses?: number
): PipelineTemplate {
    const available = PIPELINE_TEMPLATES.filter(t => {
        const tierLevel = { free: 0, silver: 1, gold: 2 };
        return t.taskType === taskType && tierLevel[t.minTier] <= tierLevel[tier];
    });

    if (available.length === 0) {
        // Fallback to basic template
        return PIPELINE_TEMPLATES[0];
    }

    // For classification
    if (taskType === 'classification') {
        // Large dataset + premium tier = XGBoost
        if (datasetSize > 10000 && tier !== 'free') {
            return available.find(t => t.algorithm === 'XGBoost') || available[0];
        }
        // Multi-class
        if (numClasses && numClasses > 2) {
            return available.find(t => t.category === 'multiclass') || available[0];
        }
        // Default binary
        return available.find(t => t.category === 'binary') || available[0];
    }

    // For regression
    if (datasetSize > 10000 && tier !== 'free') {
        return available.find(t => t.algorithm === 'XGBoost') || available[0];
    }

    return available.find(t => t.algorithm === 'RandomForest') || available[0];
}

/**
 * Generate quick-start configuration from template
 */
export function getQuickStartConfig(template: PipelineTemplate) {
    return {
        algorithm: template.algorithm,
        ...template.hyperparameters,
        cleaningConfig: template.cleaningConfig,
        templateId: template.id,
        templateName: template.name
    };
}
