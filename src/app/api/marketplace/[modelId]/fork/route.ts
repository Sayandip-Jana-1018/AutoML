/**
 * Fork Model Endpoint
 * POST /api/marketplace/{modelId}/fork
 * 
 * Clones public model metadata into user's project:
 * - Copies name, description, demoInputs, tags, taskType
 * - Does NOT copy private artifacts or endpoint
 * - Creates new project skeleton for user
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

interface RouteContext {
    params: { modelId: string };
}

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const { modelId } = context.params;

        // Authenticate
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email;

        // Fetch source model
        const modelDoc = await adminDb.collection('models').doc(modelId).get();

        if (!modelDoc.exists) {
            return NextResponse.json({ error: 'Model not found' }, { status: 404 });
        }

        const model = modelDoc.data();

        // Must be public
        if (model?.visibility !== 'public' && !model?.isPublic) {
            return NextResponse.json({ error: 'Only public models can be forked' }, { status: 403 });
        }

        // Get user info
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // Create new project skeleton
        const projectRef = await adminDb.collection('projects').add({
            name: `${model?.name} (forked)`,
            description: `Forked from ${model?.name} by ${model?.ownerName || model?.ownerEmail || 'community'}`,
            ownerId: userId,
            owner_email: userEmail,
            ownerName: userData?.displayName || userEmail?.split('@')[0],

            // Copy metadata from model
            inferredTaskType: model?.taskType || 'classification',
            targetColumn: model?.target_column || 'target',
            inferredColumns: model?.feature_columns || [],

            // Script template based on task type
            script: generateScriptTemplate(model?.taskType, model?.algorithm, model?.feature_columns),

            // Tags and demo inputs from source
            tags: model?.tags || [],
            demoInputs: model?.demoInputs || [],

            // Status
            datasetUploaded: false,
            status: 'draft',

            // Fork metadata
            forkedFrom: {
                modelId,
                modelName: model?.name,
                ownerId: model?.ownerId,
                ownerName: model?.ownerName,
                forkedAt: new Date().toISOString()
            },

            // Timestamps
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // Increment fork count on source model
        await modelDoc.ref.update({
            forkCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            success: true,
            projectId: projectRef.id,
            message: 'Model forked successfully. Upload your dataset to start training.',
            redirectUrl: `/studio/${projectRef.id}`
        });

    } catch (error: any) {
        console.error('[Fork] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Generate a script template based on model type
 */
function generateScriptTemplate(
    taskType: string = 'classification',
    algorithm: string = 'RandomForest',
    featureColumns: string[] = []
): string {
    const featuresStr = featureColumns.length > 0
        ? `["${featureColumns.join('", "')}"]`
        : '[]  # Add your feature columns';

    if (taskType === 'regression') {
        return `# Forked Model - ${algorithm} Regression
# Upload your dataset and customize this script

import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

# Load data
df = pd.read_csv('dataset.csv')

# Feature columns from original model
feature_columns = ${featuresStr}

# Split data
X = df[feature_columns] if feature_columns else df.drop(columns=['target'])
y = df['target']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train model
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# Evaluate
predictions = model.predict(X_test)
print(f"R² Score: {r2_score(y_test, predictions):.4f}")
print(f"RMSE: {mean_squared_error(y_test, predictions, squared=False):.4f}")
`;
    }

    return `# Forked Model - ${algorithm} Classification
# Upload your dataset and customize this script

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

# Load data
df = pd.read_csv('dataset.csv')

# Feature columns from original model
feature_columns = ${featuresStr}

# Split data
X = df[feature_columns] if feature_columns else df.drop(columns=['target'])
y = df['target']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train model
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# Evaluate
predictions = model.predict(X_test)
print(f"Accuracy: {accuracy_score(y_test, predictions):.4f}")
print(classification_report(y_test, predictions))
`;
}
