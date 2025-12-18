// Shared types for Studio components

export interface WorkflowState {
    stage: 'upload' | 'processing' | 'training' | 'ready' | 'error';
    step: number | null; // 0-7, null when error
    status: 'pending' | 'success' | 'error';
    error?: string; // Error message for failed workflows
    errorMessage?: string;
    updatedAt: any;
    datasetReused?: boolean; // True if dedupe detected same file
}

export interface DatasetInfo {
    filename: string;
    uploadedAt: any;
    columns: string[];
    columnTypes: Record<string, 'numeric' | 'categorical' | 'datetime'>;
    rowCount: number;
    fileSize: number;
    storageUrl: string;
    contentHash: string;
}

export interface Project {
    name: string;
    currentScript: string;
    owner_email: string;
    collaborators: string[];
    // Upload flow fields
    datasetUploaded?: boolean;
    dataset?: DatasetInfo;
    workflow?: WorkflowState;
    generatedCodeVersion?: string;
    // Versioning for lineage
    datasetVersionId?: string;
    // Schema detection
    inferredTaskType?: 'binary_classification' | 'multiclass_classification' | 'regression' | 'clustering' | 'unknown';
    taskTypeConfidence?: number;
    targetColumnSuggestion?: string;
}

export interface Message {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: any;
}

export interface Job {
    id: string;
    status: string;
    metrics?: {
        accuracy?: number;
        precision?: number;
        recall?: number;
        f1?: number;
        log_loss?: number;
        loss?: number;  // Legacy field
        rmse?: number;  // Regression
        r2?: number;    // Regression
        mae?: number;   // Regression
        mse?: number;   // Regression
        // Clustering metrics
        silhouette?: number;
        inertia?: number;
        davies_bouldin?: number;
        calinski_harabasz?: number;
        num_classes?: number;
        confusion_matrix?: number[][];
        extractedFrom?: string;  // Source of metrics extraction
    };
    createdAt: any;
    logs?: string[];
    scriptVersion?: number | string;
    scriptVersionId?: string;
    backend?: string;
    vmName?: string;
    podId?: string;
    consoleUrl?: string;
    // Dataset info
    originalFilename?: string;
    datasetFilename?: string;
    datasetRows?: number;
    datasetSizeMB?: number;
    taskType?: string;
    algorithm?: string;
    // Cost and runtime
    estimatedMinutes?: number;
    estimatedTotalCost?: number;
    actualRuntimeSeconds?: number;
    actualCostUsd?: number;
    actualCostInr?: number;
    // Phase tracking
    currentPhase?: string;
    phaseProgress?: number;
    // Config
    config?: {
        machineType?: string;
        tier?: string;
        algorithm?: string;
        [key: string]: any;
    };
}
