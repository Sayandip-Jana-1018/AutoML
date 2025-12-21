/**
 * Training Router
 * 
 * Routes training jobs to the appropriate backend based on:
 * - User subscription tier
 * - Dataset type (tabular vs image)
 * - User preference (CPU vs GPU)
 */

import { SubscriptionTier } from './resource-policy';
import { COMPUTE_ENGINE_CONFIGS } from './compute-training';

export type DatasetType = 'tabular' | 'image' | 'unknown';
export type TrainingBackend = 'gcp-compute-engine' | 'runpod';

export interface TrainingRouteDecision {
    backend: TrainingBackend;
    machineType: string;
    specs: string;
    estimatedCostPerHour: number;
    maxDurationHours: number;
    gpuEnabled: boolean;
    gpuType?: string;
    reason: string;
}

/**
 * Detect dataset type from file extension or content
 */
export function detectDatasetType(
    filename: string,
    mimeType?: string
): DatasetType {
    const ext = filename.toLowerCase().split('.').pop() || '';

    // Image datasets
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'];
    const imageArchivePatterns = ['images', 'img', 'photos', 'pics'];

    if (imageExtensions.includes(ext)) {
        return 'image';
    }

    // Check for image archives
    if (ext === 'zip' || ext === 'tar' || ext === 'gz') {
        const nameLower = filename.toLowerCase();
        if (imageArchivePatterns.some(p => nameLower.includes(p))) {
            return 'image';
        }
    }

    // Tabular datasets
    const tabularExtensions = ['csv', 'xlsx', 'xls', 'parquet', 'json', 'tsv'];
    if (tabularExtensions.includes(ext)) {
        return 'tabular';
    }

    // Check mime type
    if (mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.includes('csv') || mimeType.includes('spreadsheet')) return 'tabular';
    }

    return 'unknown';
}

/**
 * Detect if task type requires GPU
 */
export function requiresGPU(taskType: string): boolean {
    const gpuTasks = [
        'cnn', 'convolutional',
        'deep_learning', 'deeplearning',
        'neural_network', 'neuralnetwork',
        'image_classification', 'imageclassification',
        'object_detection', 'objectdetection',
        'semantic_segmentation',
        'resnet', 'vgg', 'efficientnet', 'mobilenet',
        'transformer', 'bert', 'gpt'
    ];

    return gpuTasks.some(t => taskType.toLowerCase().includes(t));
}

/**
 * Route training to appropriate backend
 * 
 * ROUTING RULES:
 * - RunPod GPU: Only when Gold tier AND userPreference === 'gpu' (toggle ON)
 * - GCP Compute Engine: All other cases (default)
 */
export function routeTraining(params: {
    tier: SubscriptionTier;
    datasetType: DatasetType;
    taskType: string;
    datasetSizeMB: number;
    userPreference?: 'cpu' | 'gpu';
}): TrainingRouteDecision {
    const { tier, datasetType, taskType, datasetSizeMB, userPreference } = params;

    // Get base config for tier
    const ceConfig = COMPUTE_ENGINE_CONFIGS[tier];

    // RunPod GPU: ONLY when Gold tier AND user explicitly enables GPU toggle
    // Image datasets recommend GPU but don't auto-route to it
    const useGPU = tier === 'gold' && userPreference === 'gpu';

    if (useGPU) {
        return {
            backend: 'runpod',
            machineType: 'RTX 4000 Ada',
            specs: '8 vCPU, 50 GB RAM, 20 GB VRAM',
            estimatedCostPerHour: 0.26,
            maxDurationHours: 8,
            gpuEnabled: true,
            gpuType: 'RTX 4000 Ada',
            reason: 'GPU training enabled by user (Gold tier)'
        };
    }

    // Otherwise use Compute Engine (CPU)
    return {
        backend: 'gcp-compute-engine',
        machineType: ceConfig.machineType,
        specs: ceConfig.specs,
        estimatedCostPerHour: ceConfig.costPerHour,
        maxDurationHours: ceConfig.maxHours,
        gpuEnabled: false,
        reason: datasetType === 'image'
            ? 'CPU training for image dataset (enable GPU toggle for faster training)'
            : `Standard CPU training (${tier} tier)`
    };
}

/**
 * Validate dataset size against tier limits
 */
export function validateDatasetSize(
    tier: SubscriptionTier,
    datasetSizeMB: number
): { valid: boolean; maxAllowed: number; message?: string } {
    const config = COMPUTE_ENGINE_CONFIGS[tier];

    if (datasetSizeMB > config.maxDatasetMB) {
        return {
            valid: false,
            maxAllowed: config.maxDatasetMB,
            message: `Dataset size (${datasetSizeMB} MB) exceeds ${tier} tier limit (${config.maxDatasetMB} MB). Please upgrade your plan or reduce dataset size.`
        };
    }

    return { valid: true, maxAllowed: config.maxDatasetMB };
}

/**
 * Validate dataset type and model/algorithm compatibility
 * Prevents invalid combinations like LinearRegression on image data
 */
export function validateDatasetModelCompatibility(
    datasetType: DatasetType,
    taskType: string,
    algorithm?: string
): { valid: boolean; warning?: string; error?: string; suggestions?: string[] } {
    const taskLower = taskType.toLowerCase();
    const algoLower = (algorithm || '').toLowerCase();

    // Algorithms that only work with tabular data
    const tabularOnlyAlgorithms = [
        'linearregression', 'linear_regression', 'ridge', 'lasso', 'elasticnet',
        'logisticregression', 'logistic_regression',
        'randomforest', 'random_forest',
        'xgboost', 'lightgbm', 'catboost', 'gradientboosting', 'gradient_boosting',
        'decisiontree', 'decision_tree',
        'svm', 'svc', 'svr',
        'knn', 'k_neighbors', 'kneighbors',
        'naivebayes', 'naive_bayes', 'gaussiannb',
        'adaboost', 'bagging', 'extratrees',
        'kmeans', 'k_means', 'dbscan', 'hierarchicalclustering', 'agglomerativeclustering'
    ];

    // Algorithms that only work with image data
    const imageOnlyAlgorithms = [
        'cnn', 'convolutional', 'conv2d',
        'resnet', 'vgg', 'efficientnet', 'mobilenet', 'inception',
        'yolo', 'rcnn', 'faster_rcnn', 'mask_rcnn',
        'unet', 'segnet'
    ];

    // Task types that require image data
    const imageOnlyTasks = [
        'image_classification', 'imageclassification',
        'object_detection', 'objectdetection',
        'semantic_segmentation', 'segmentation',
        'image_segmentation'
    ];

    // Check: Image dataset with tabular-only algorithm
    if (datasetType === 'image') {
        const isTabularAlgo = tabularOnlyAlgorithms.some(a => algoLower.includes(a));
        if (isTabularAlgo) {
            return {
                valid: false,
                error: `${algorithm || 'This algorithm'} cannot be used with image datasets. It requires tabular (CSV/Excel) data.`,
                suggestions: [
                    'Use a CNN-based model for image classification',
                    'Use ResNet, VGG, or EfficientNet for image tasks',
                    'Upload a CSV/Excel file to use this algorithm'
                ]
            };
        }
    }

    // Check: Tabular dataset with image-only algorithm/task
    if (datasetType === 'tabular') {
        const isImageAlgo = imageOnlyAlgorithms.some(a => algoLower.includes(a));
        const isImageTask = imageOnlyTasks.some(t => taskLower.includes(t));

        if (isImageAlgo || isImageTask) {
            return {
                valid: false,
                error: `${algorithm || taskType} requires image data but you uploaded a tabular dataset.`,
                suggestions: [
                    'Upload an image dataset (ZIP of images or image files)',
                    'Use RandomForest, XGBoost, or LogisticRegression for tabular data',
                    'Select "classification" or "regression" as task type'
                ]
            };
        }
    }

    // Warning: Unknown dataset type
    if (datasetType === 'unknown') {
        return {
            valid: true,
            warning: 'Could not detect dataset type. Ensure your data format matches the selected algorithm.',
            suggestions: [
                'Use .csv, .xlsx for tabular data',
                'Use .jpg, .png, or .zip of images for image data'
            ]
        };
    }

    return { valid: true };
}

/**
 * Estimate training time based on dataset and config
 */
export function estimateTrainingTime(params: {
    datasetSizeMB: number;
    datasetType: DatasetType;
    backend: TrainingBackend;
    epochs?: number;
}): { minMinutes: number; maxMinutes: number } {
    const { datasetSizeMB, datasetType, backend, epochs = 50 } = params;

    // Base time: setup + data loading + teardown
    const setupTime = 3; // minutes

    if (datasetType === 'image') {
        // Image training is more complex
        const perEpochTime = (datasetSizeMB / 50) * (backend === 'runpod' ? 0.5 : 2); // GPU is 4x faster
        const trainingTime = perEpochTime * Math.min(epochs, 50);
        return {
            minMinutes: Math.ceil(setupTime + trainingTime * 0.7),
            maxMinutes: Math.ceil(setupTime + trainingTime * 1.5)
        };
    } else {
        // Tabular training
        const trainingTime = (datasetSizeMB / 10) + (epochs / 20);
        return {
            minMinutes: Math.ceil(setupTime + trainingTime * 0.5),
            maxMinutes: Math.ceil(setupTime + trainingTime * 2)
        };
    }
}

/**
 * Get human-readable backend description
 */
export function getBackendDescription(backend: TrainingBackend, gpuType?: string): string {
    if (backend === 'runpod') {
        return `RunPod GPU Cloud (${gpuType || 'RTX 4000 Ada'})`;
    }
    return 'Google Cloud Compute Engine';
}

export default {
    detectDatasetType,
    requiresGPU,
    routeTraining,
    validateDatasetSize,
    validateDatasetModelCompatibility,
    estimateTrainingTime,
    getBackendDescription
};
