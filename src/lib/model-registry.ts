/**
 * Model Registry Service
 * Manages model versions, lineage tracking, and promotions
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { trackEvent } from './telemetry';

export interface ModelVersion {
    id: string;
    modelId: string;
    versionNumber: number;

    // Lineage
    datasetVersionId: string;
    scriptVersionId: string;
    jobId: string;

    // Metrics
    metrics: {
        accuracy?: number;
        precision?: number;
        recall?: number;
        f1Score?: number;
        rmse?: number;
        mae?: number;
        r2?: number;
        [key: string]: number | undefined;
    };
    primaryMetric: string;
    primaryMetricValue: number;

    // Vertex AI
    vertexModelPath?: string;
    deployedEndpointIds: string[];

    // Status
    status: 'training' | 'ready' | 'deployed' | 'archived';
    isProduction: boolean;

    // Timestamps
    createdAt: Date;
    promotedAt?: Date;
}

export interface ModelRegistryEntry {
    id: string;
    name: string;
    description: string;
    taskType: 'classification' | 'regression';
    projectId: string;
    ownerId: string;

    // Best version info
    bestVersionId?: string;
    bestMetricValue?: number;
    totalVersions: number;

    // Visibility
    visibility: 'private' | 'team' | 'public';
    collaborators: Collaborator[];

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

export interface Collaborator {
    uid: string;
    email: string;
    role: 'view' | 'edit' | 'run';
    addedAt: Date;
}

export interface LineageNode {
    id: string;
    type: 'dataset' | 'script' | 'job' | 'model' | 'endpoint';
    name: string;
    metadata: Record<string, unknown>;
}

export interface LineageEdge {
    from: string;
    to: string;
    label?: string;
}

/**
 * Register a new model
 */
export async function registerModel(data: {
    name: string;
    description?: string;
    taskType: 'classification' | 'regression' | string;
    projectId: string;
    ownerId: string;
    // Optional fields for auto-registration
    ownerEmail?: string;
    ownerName?: string;
    ownerPhotoURL?: string;
    version?: number | string;
    metrics?: Record<string, number>;
    gcsPath?: string;
    visibility?: 'private' | 'team' | 'public';
    status?: 'training' | 'ready' | 'deployed' | 'archived';
    trainedAt?: string;
    jobId?: string;
    // Feature columns for prediction forms
    feature_columns?: string[];
    target_column?: string;
    algorithm?: string;
}): Promise<string> {
    // Check for existing model with same projectId and jobId to prevent duplicates
    if (data.jobId && data.projectId) {
        const existingByJob = await adminDb.collection('models')
            .where('projectId', '==', data.projectId)
            .where('jobId', '==', data.jobId)
            .limit(1)
            .get();

        if (!existingByJob.empty) {
            console.log(`[Model Registry] Found existing model for project ${data.projectId} job ${data.jobId}`);
            return existingByJob.docs[0].id;
        }
    }

    // Also check for existing model with same name for same owner (optional but prevents UI duplicates)
    if (data.name && data.ownerId) {
        const existingByName = await adminDb.collection('models')
            .where('ownerId', '==', data.ownerId)
            .where('name', '==', data.name)
            .limit(1)
            .get();

        if (!existingByName.empty) {
            console.log(`[Model Registry] Found existing model with name "${data.name}" for owner ${data.ownerId}`);
            // Update the existing model instead of creating duplicate
            const existingId = existingByName.docs[0].id;
            await adminDb.collection('models').doc(existingId).update({
                metrics: data.metrics || existingByName.docs[0].data().metrics,
                gcsPath: data.gcsPath || existingByName.docs[0].data().gcsPath,
                jobId: data.jobId || existingByName.docs[0].data().jobId,
                trainedAt: data.trainedAt || existingByName.docs[0].data().trainedAt,
                version: (existingByName.docs[0].data().version || 1) + 1,
                updatedAt: FieldValue.serverTimestamp()
            });
            return existingId;
        }
    }

    const modelRef = await adminDb.collection('models').add({
        name: data.name,
        description: data.description || `Trained model for ${data.name}`,
        taskType: data.taskType,
        projectId: data.projectId,
        ownerId: data.ownerId,
        ownerEmail: data.ownerEmail || '',
        ownerName: data.ownerName || '',
        ownerPhotoURL: data.ownerPhotoURL || '',
        version: data.version || 1,
        metrics: data.metrics || {},
        gcsPath: data.gcsPath || '',
        jobId: data.jobId || '',
        trainedAt: data.trainedAt || new Date().toISOString(),
        bestVersionId: '',
        // Calculate bestMetricValue from multiple metric types (for marketplace display)
        // Priority: accuracy > silhouette > r2 > other metrics
        bestMetricValue: data.metrics?.accuracy ?? data.metrics?.silhouette ?? data.metrics?.r2 ?? 0,
        totalVersions: 1,
        visibility: data.visibility || 'private',
        status: data.status || 'ready',
        collaborators: [],
        // Feature columns for prediction forms
        feature_columns: data.feature_columns || [],
        target_column: data.target_column || 'target',
        algorithm: data.algorithm || 'Unknown',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    });

    return modelRef.id;
}

/**
 * Create a new model version
 */
export async function createModelVersion(
    modelId: string,
    data: {
        datasetVersionId: string;
        scriptVersionId: string;
        jobId: string;
        metrics: Record<string, number>;
        primaryMetric: string;
        vertexModelPath?: string;
    }
): Promise<string> {
    const modelRef = adminDb.collection('models').doc(modelId);
    const modelDoc = await modelRef.get();

    if (!modelDoc.exists) {
        throw new Error(`Model ${modelId} not found`);
    }

    const currentVersions = modelDoc.data()?.totalVersions || 0;
    const versionNumber = currentVersions + 1;
    const primaryMetricValue = data.metrics[data.primaryMetric] || 0;

    const versionRef = await modelRef.collection('versions').add({
        modelId,
        versionNumber,
        datasetVersionId: data.datasetVersionId,
        scriptVersionId: data.scriptVersionId,
        jobId: data.jobId,
        metrics: data.metrics,
        primaryMetric: data.primaryMetric,
        primaryMetricValue,
        vertexModelPath: data.vertexModelPath || null,
        deployedEndpointIds: [],
        status: 'ready',
        isProduction: false,
        createdAt: FieldValue.serverTimestamp()
    });

    // Update model with new version count
    const updateData: Record<string, unknown> = {
        totalVersions: versionNumber,
        updatedAt: FieldValue.serverTimestamp()
    };

    // Update best version if this one is better
    const currentBest = modelDoc.data()?.bestMetricValue || 0;
    if (primaryMetricValue > currentBest) {
        updateData.bestVersionId = versionRef.id;
        updateData.bestMetricValue = primaryMetricValue;
    }

    await modelRef.update(updateData);

    return versionRef.id;
}

/**
 * Promote a version to production
 */
export async function promoteToProduction(
    modelId: string,
    versionId: string,
    userId: string
): Promise<void> {
    const modelRef = adminDb.collection('models').doc(modelId);
    const versionsRef = modelRef.collection('versions');

    // Demote any existing production version
    const currentProd = await versionsRef.where('isProduction', '==', true).get();
    const batch = adminDb.batch();

    currentProd.docs.forEach(doc => {
        batch.update(doc.ref, { isProduction: false });
    });

    // Promote the new version
    batch.update(versionsRef.doc(versionId), {
        isProduction: true,
        promotedAt: FieldValue.serverTimestamp()
    });

    await batch.commit();

    // Track event
    await trackEvent('model_deployed', {
        userId,
        modelId,
        versionId,
        action: 'promote_to_production'
    });
}

/**
 * Get model lineage graph
 */
export async function getModelLineage(
    modelId: string,
    versionId: string
): Promise<{ nodes: LineageNode[]; edges: LineageEdge[] }> {
    const versionDoc = await adminDb
        .collection('models')
        .doc(modelId)
        .collection('versions')
        .doc(versionId)
        .get();

    if (!versionDoc.exists) {
        return { nodes: [], edges: [] };
    }

    const version = versionDoc.data()!;
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];

    // Dataset node
    const datasetVersionId = version.datasetVersionId;
    if (datasetVersionId) {
        // Find the dataset version
        const datasetVersions = await adminDb.collectionGroup('versions')
            .where('__name__', '==', datasetVersionId)
            .limit(1)
            .get();

        if (!datasetVersions.empty) {
            const dvDoc = datasetVersions.docs[0];
            nodes.push({
                id: `dataset-${datasetVersionId}`,
                type: 'dataset',
                name: `Dataset v${dvDoc.data().versionNumber || '?'}`,
                metadata: { versionId: datasetVersionId }
            });
        }
    }

    // Script node
    const scriptVersionId = version.scriptVersionId;
    if (scriptVersionId) {
        nodes.push({
            id: `script-${scriptVersionId}`,
            type: 'script',
            name: `Script v${scriptVersionId.slice(-4)}`,
            metadata: { versionId: scriptVersionId }
        });
        edges.push({
            from: `dataset-${datasetVersionId}`,
            to: `script-${scriptVersionId}`,
            label: 'used by'
        });
    }

    // Job node
    const jobId = version.jobId;
    if (jobId) {
        nodes.push({
            id: `job-${jobId}`,
            type: 'job',
            name: `Training Job`,
            metadata: { jobId }
        });
        edges.push({
            from: `script-${scriptVersionId}`,
            to: `job-${jobId}`,
            label: 'executed'
        });
    }

    // Model version node
    nodes.push({
        id: `model-${versionId}`,
        type: 'model',
        name: `Model v${version.versionNumber}`,
        metadata: {
            versionId,
            metrics: version.metrics,
            isProduction: version.isProduction
        }
    });
    edges.push({
        from: `job-${jobId}`,
        to: `model-${versionId}`,
        label: 'produced'
    });

    // Endpoint nodes
    const endpoints = version.deployedEndpointIds || [];
    endpoints.forEach((endpointId: string, i: number) => {
        nodes.push({
            id: `endpoint-${endpointId}`,
            type: 'endpoint',
            name: `Endpoint ${i + 1}`,
            metadata: { endpointId }
        });
        edges.push({
            from: `model-${versionId}`,
            to: `endpoint-${endpointId}`,
            label: 'deployed to'
        });
    });

    return { nodes, edges };
}

/**
 * List models for a user
 */
export async function listModels(userId: string): Promise<ModelRegistryEntry[]> {
    const snapshot = await adminDb
        .collection('models')
        .where('ownerId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
    })) as ModelRegistryEntry[];
}

/**
 * List model versions
 */
export async function listModelVersions(modelId: string): Promise<ModelVersion[]> {
    const snapshot = await adminDb
        .collection('models')
        .doc(modelId)
        .collection('versions')
        .orderBy('versionNumber', 'desc')
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        promotedAt: doc.data().promotedAt?.toDate()
    })) as ModelVersion[];
}
