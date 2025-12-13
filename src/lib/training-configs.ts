/**
 * Training Configs (Client-Safe)
 * 
 * Machine and GPU configurations that can be safely imported
 * in both client and server components.
 * 
 * Note: Actual training execution is in compute-training.ts and
 * runpod-training.ts (server-only).
 */

import { SubscriptionTier } from './resource-policy';

/**
 * Compute Engine machine configurations per tier
 */
export const COMPUTE_ENGINE_CONFIGS: Record<SubscriptionTier, {
    machineType: string;
    specs: string;
    maxDatasetMB: number;
    costPerHour: number;
    maxHours: number;
}> = {
    free: {
        machineType: 'e2-medium',
        specs: '2 vCPU, 4 GB RAM',
        maxDatasetMB: 10,
        costPerHour: 0.07,
        maxHours: 1
    },
    silver: {
        machineType: 'e2-standard-4',
        specs: '4 vCPU, 16 GB RAM',
        maxDatasetMB: 100,
        costPerHour: 0.13,
        maxHours: 4
    },
    gold: {
        machineType: 'e2-highmem-8',
        specs: '8 vCPU, 64 GB RAM',
        maxDatasetMB: 500,
        costPerHour: 0.36,
        maxHours: 24
    }
};

/**
 * RunPod GPU configurations
 */
export const RUNPOD_GPU_CONFIGS: Record<string, {
    id: string;
    name: string;
    vram: number;
    costPerHour: number;
    specs: string;
}> = {
    'RTX 4000 Ada': {
        id: 'NVIDIA RTX 4000 Ada Generation',
        name: 'RTX 4000 Ada',
        vram: 20,
        costPerHour: 0.26,
        specs: '8 vCPU, 50 GB RAM, 20 GB VRAM'
    },
    'RTX 3090': {
        id: 'NVIDIA GeForce RTX 3090',
        name: 'RTX 3090',
        vram: 24,
        costPerHour: 0.44,
        specs: '8 vCPU, 32 GB RAM, 24 GB VRAM'
    },
    'RTX 4090': {
        id: 'NVIDIA GeForce RTX 4090',
        name: 'RTX 4090',
        vram: 24,
        costPerHour: 0.59,
        specs: '16 vCPU, 41 GB RAM, 24 GB VRAM'
    },
    'A40': {
        id: 'NVIDIA A40',
        name: 'A40',
        vram: 48,
        costPerHour: 0.40,
        specs: '14 vCPU, 48 GB RAM, 48 GB VRAM'
    }
};

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
 * Detect dataset type from file extension
 */
export function detectDatasetType(
    filename: string,
    mimeType?: string
): DatasetType {
    const ext = filename.toLowerCase().split('.').pop() || '';

    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'];
    const imageArchivePatterns = ['images', 'img', 'photos', 'pics'];

    if (imageExtensions.includes(ext)) {
        return 'image';
    }

    if (ext === 'zip' || ext === 'tar' || ext === 'gz') {
        const nameLower = filename.toLowerCase();
        if (imageArchivePatterns.some(p => nameLower.includes(p))) {
            return 'image';
        }
    }

    const tabularExtensions = ['csv', 'xlsx', 'xls', 'parquet', 'json', 'tsv'];
    if (tabularExtensions.includes(ext)) {
        return 'tabular';
    }

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
 * Route training to appropriate backend (client-safe version)
 */
export function routeTraining(params: {
    tier: SubscriptionTier;
    datasetType: DatasetType;
    taskType: string;
    datasetSizeMB: number;
    userPreference?: 'cpu' | 'gpu';
}): TrainingRouteDecision {
    const { tier, datasetType, taskType, datasetSizeMB, userPreference } = params;

    const ceConfig = COMPUTE_ENGINE_CONFIGS[tier];

    const needsGPU =
        userPreference === 'gpu' ||
        datasetType === 'image' ||
        requiresGPU(taskType);

    const canUseGPU = tier === 'gold' && needsGPU;

    if (canUseGPU) {
        return {
            backend: 'runpod',
            machineType: 'RTX 4000 Ada',
            specs: '8 vCPU, 50 GB RAM, 20 GB VRAM',
            estimatedCostPerHour: 0.26,
            maxDurationHours: 8,
            gpuEnabled: true,
            gpuType: 'RTX 4000 Ada',
            reason: 'GPU training for image/deep learning workload (Gold tier)'
        };
    }

    return {
        backend: 'gcp-compute-engine',
        machineType: ceConfig.machineType,
        specs: ceConfig.specs,
        estimatedCostPerHour: ceConfig.costPerHour,
        maxDurationHours: ceConfig.maxHours,
        gpuEnabled: false,
        reason: tier === 'gold' && datasetType === 'image'
            ? 'CPU training (upgrade to Gold for GPU)'
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
            message: `Dataset size (${datasetSizeMB} MB) exceeds ${tier} tier limit (${config.maxDatasetMB} MB).`
        };
    }

    return { valid: true, maxAllowed: config.maxDatasetMB };
}

/**
 * Estimate training time
 */
export function estimateTrainingTime(params: {
    datasetSizeMB: number;
    datasetType: DatasetType;
    backend: TrainingBackend;
    epochs?: number;
}): { minMinutes: number; maxMinutes: number } {
    const { datasetSizeMB, datasetType, backend, epochs = 50 } = params;

    const setupTime = 3;

    if (datasetType === 'image') {
        const perEpochTime = (datasetSizeMB / 50) * (backend === 'runpod' ? 0.5 : 2);
        const trainingTime = perEpochTime * Math.min(epochs, 50);
        return {
            minMinutes: Math.ceil(setupTime + trainingTime * 0.7),
            maxMinutes: Math.ceil(setupTime + trainingTime * 1.5)
        };
    } else {
        const trainingTime = (datasetSizeMB / 10) + (epochs / 20);
        return {
            minMinutes: Math.ceil(setupTime + trainingTime * 0.5),
            maxMinutes: Math.ceil(setupTime + trainingTime * 2)
        };
    }
}
