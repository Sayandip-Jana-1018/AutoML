/**
 * Sample Datasets & Playground
 * Pre-configured datasets for quick onboarding
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface SampleDataset {
    id: string;
    name: string;
    description: string;
    fileName: string;
    taskType: 'classification' | 'regression';
    rows: number;
    columns: number;
    targetColumn: string;
    features: string[];
    gcsPath: string; // Pre-uploaded sample file
}

export const SAMPLE_DATASETS: SampleDataset[] = [
    {
        id: 'iris',
        name: 'Iris Flower Classification',
        description: 'Classic dataset for multi-class classification. Predict flower species from petal/sepal measurements.',
        fileName: 'iris.csv',
        taskType: 'classification',
        rows: 150,
        columns: 5,
        targetColumn: 'species',
        features: ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'],
        gcsPath: 'samples/iris.csv'
    },
    {
        id: 'titanic',
        name: 'Titanic Survival Prediction',
        description: 'Predict passenger survival based on demographics and ticket information.',
        fileName: 'titanic.csv',
        taskType: 'classification',
        rows: 891,
        columns: 12,
        targetColumn: 'Survived',
        features: ['Pclass', 'Sex', 'Age', 'SibSp', 'Parch', 'Fare', 'Embarked'],
        gcsPath: 'samples/titanic.csv'
    },
    {
        id: 'housing',
        name: 'House Price Prediction',
        description: 'Predict house prices based on various features like size, location, and amenities.',
        fileName: 'housing.csv',
        taskType: 'regression',
        rows: 506,
        columns: 14,
        targetColumn: 'MEDV',
        features: ['CRIM', 'ZN', 'INDUS', 'CHAS', 'NOX', 'RM', 'AGE', 'DIS', 'RAD', 'TAX', 'PTRATIO', 'B', 'LSTAT'],
        gcsPath: 'samples/housing.csv'
    },
    {
        id: 'diabetes',
        name: 'Diabetes Prediction',
        description: 'Binary classification to predict diabetes onset based on diagnostic measurements.',
        fileName: 'diabetes.csv',
        taskType: 'classification',
        rows: 768,
        columns: 9,
        targetColumn: 'Outcome',
        features: ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness', 'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age'],
        gcsPath: 'samples/diabetes.csv'
    },
    {
        id: 'wine',
        name: 'Wine Quality Classification',
        description: 'Classify wine quality based on chemical properties.',
        fileName: 'wine.csv',
        taskType: 'classification',
        rows: 1599,
        columns: 12,
        targetColumn: 'quality',
        features: ['fixed_acidity', 'volatile_acidity', 'citric_acid', 'residual_sugar', 'chlorides', 'free_sulfur_dioxide', 'total_sulfur_dioxide', 'density', 'pH', 'sulphates', 'alcohol'],
        gcsPath: 'samples/wine.csv'
    }
];

/**
 * Get all sample datasets
 */
export function getSampleDatasets(): SampleDataset[] {
    return SAMPLE_DATASETS;
}

/**
 * Get sample dataset by ID
 */
export function getSampleDataset(id: string): SampleDataset | undefined {
    return SAMPLE_DATASETS.find(d => d.id === id);
}

/**
 * Create a playground project with sample data
 */
export async function createPlaygroundProject(
    userId: string,
    sampleDatasetId: string
): Promise<{ projectId: string; datasetId: string }> {
    const sample = getSampleDataset(sampleDatasetId);

    if (!sample) {
        throw new Error(`Sample dataset '${sampleDatasetId}' not found`);
    }

    // Create playground project
    const projectRef = await adminDb.collection('projects').add({
        name: `Playground: ${sample.name}`,
        description: `Learn ML with the ${sample.name} dataset`,
        ownerId: userId,
        type: 'playground',
        sampleDatasetId: sample.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    });

    // Create dataset reference (pointing to pre-uploaded sample)
    const datasetRef = await adminDb.collection('datasets').add({
        name: sample.name,
        fileName: sample.fileName,
        projectId: projectRef.id,
        ownerId: userId,
        status: 'ready',
        taskType: sample.taskType,
        taskTypeConfidence: 1.0,
        targetColumn: sample.targetColumn,
        schema: {
            columns: sample.features.map(f => ({
                name: f,
                type: 'number',
                nullable: true
            })).concat({
                name: sample.targetColumn,
                type: sample.taskType === 'classification' ? 'string' : 'number',
                nullable: false
            }),
            rowCount: sample.rows
        },
        gcsUri: `gs://${process.env.GCS_BUCKET || 'mlforge-datasets'}/${sample.gcsPath}`,
        visibility: 'private',
        collaborators: [],
        isSample: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    });

    // Create initial version
    await datasetRef.collection('versions').add({
        versionNumber: 1,
        gcsUri: `gs://${process.env.GCS_BUCKET || 'mlforge-datasets'}/${sample.gcsPath}`,
        status: 'ready',
        createdAt: FieldValue.serverTimestamp()
    });

    // Link dataset to project
    await projectRef.update({
        datasetId: datasetRef.id
    });

    return {
        projectId: projectRef.id,
        datasetId: datasetRef.id
    };
}

/**
 * Check if user has a playground project
 */
export async function getUserPlaygroundProjects(userId: string): Promise<string[]> {
    const snapshot = await adminDb
        .collection('projects')
        .where('ownerId', '==', userId)
        .where('type', '==', 'playground')
        .get();

    return snapshot.docs.map(doc => doc.id);
}
