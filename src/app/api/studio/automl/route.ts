import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

/**
 * POST /api/studio/automl
 * 
 * AutoML automatically:
 * 1. Analyzes the dataset schema
 * 2. Selects the best algorithm based on task type
 * 3. Generates preprocessing steps
 * 4. Creates a complete training script
 * 5. Returns the script (training trigger is separate)
 */
export async function POST(req: Request) {
    try {
        const { projectId, datasetId } = await req.json();

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        // 1. Get project and dataset info
        const projectRef = adminDb.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();

        if (!projectDoc.exists) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const project = projectDoc.data();
        const schema = project?.dataset;
        const taskType = project?.inferredTaskType || 'unknown';
        const targetColumn = project?.targetColumnSuggestion || '';
        const columns = schema?.columns || [];
        const columnTypes = schema?.columnTypes || {};

        if (!columns.length) {
            return NextResponse.json({ error: 'No dataset schema found. Upload a dataset first.' }, { status: 400 });
        }

        // 2. Auto-select algorithm based on task type and data characteristics
        const algorithmSelection = selectBestAlgorithm(taskType, columns, columnTypes);

        // 3. Generate preprocessing steps based on column types
        const preprocessingSteps = generatePreprocessingSteps(columns, columnTypes);

        // 4. Generate complete training script
        const script = generateAutoMLScript({
            taskType,
            targetColumn,
            columns,
            columnTypes,
            algorithm: algorithmSelection.algorithm,
            algorithmImport: algorithmSelection.importStatement,
            preprocessing: preprocessingSteps
        });

        // 5. Update project with new script
        await projectRef.update({
            currentScript: script,
            'automl.algorithm': algorithmSelection.algorithm,
            'automl.taskType': taskType,
            'automl.targetColumn': targetColumn,
            'automl.generatedAt': FieldValue.serverTimestamp(),
            'workflow.step': 4,
            'workflow.status': 'success',
            'workflow.updatedAt': FieldValue.serverTimestamp()
        });

        console.log(`[AutoML] Generated script for ${projectId}: ${algorithmSelection.algorithm} for ${taskType}`);

        return NextResponse.json({
            success: true,
            algorithm: algorithmSelection.algorithm,
            algorithmReason: algorithmSelection.reason,
            taskType,
            targetColumn,
            preprocessingSteps: preprocessingSteps.length,
            script
        });

    } catch (error: unknown) {
        console.error('[AutoML] Error:', error);
        const message = error instanceof Error ? error.message : 'AutoML failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

interface AlgorithmSelection {
    algorithm: string;
    importStatement: string;
    reason: string;
}

function selectBestAlgorithm(
    taskType: string,
    columns: string[],
    columnTypes: Record<string, string>
): AlgorithmSelection {
    const numericCols = Object.values(columnTypes).filter(t => t === 'numeric').length;
    const categoricalCols = Object.values(columnTypes).filter(t => t === 'categorical' || t === 'text').length;
    const totalCols = columns.length;

    // Classification tasks
    if (taskType === 'binary_classification' || taskType === 'multiclass_classification') {
        if (categoricalCols > numericCols) {
            return {
                algorithm: 'RandomForestClassifier',
                importStatement: 'from sklearn.ensemble import RandomForestClassifier',
                reason: 'Dataset has many categorical features - Random Forest handles them well'
            };
        }
        if (totalCols > 20) {
            return {
                algorithm: 'GradientBoostingClassifier',
                importStatement: 'from sklearn.ensemble import GradientBoostingClassifier',
                reason: 'High-dimensional data benefits from gradient boosting'
            };
        }
        return {
            algorithm: 'LogisticRegression',
            importStatement: 'from sklearn.linear_model import LogisticRegression',
            reason: 'Good baseline classifier for medium-sized datasets'
        };
    }

    // Regression tasks
    if (taskType === 'regression') {
        if (numericCols > 10) {
            return {
                algorithm: 'GradientBoostingRegressor',
                importStatement: 'from sklearn.ensemble import GradientBoostingRegressor',
                reason: 'Many numeric features - gradient boosting provides strong performance'
            };
        }
        if (totalCols < 5) {
            return {
                algorithm: 'LinearRegression',
                importStatement: 'from sklearn.linear_model import LinearRegression',
                reason: 'Simple dataset benefits from interpretable linear model'
            };
        }
        return {
            algorithm: 'RandomForestRegressor',
            importStatement: 'from sklearn.ensemble import RandomForestRegressor',
            reason: 'Robust regressor that handles mixed feature types'
        };
    }

    // Clustering
    if (taskType === 'clustering') {
        return {
            algorithm: 'KMeans',
            importStatement: 'from sklearn.cluster import KMeans',
            reason: 'Standard clustering algorithm for exploratory analysis'
        };
    }

    // Default: Random Forest (works for most cases)
    return {
        algorithm: 'RandomForestClassifier',
        importStatement: 'from sklearn.ensemble import RandomForestClassifier',
        reason: 'Default robust algorithm that handles various data types'
    };
}

function generatePreprocessingSteps(columns: string[], columnTypes: Record<string, string>): string[] {
    const steps: string[] = [];

    const hasNumeric = Object.values(columnTypes).some(t => t === 'numeric');
    const hasCategorical = Object.values(columnTypes).some(t => t === 'categorical' || t === 'text');
    const hasDatetime = Object.values(columnTypes).some(t => t === 'datetime');

    if (hasNumeric) {
        steps.push('StandardScaler for numeric columns');
    }
    if (hasCategorical) {
        steps.push('OneHotEncoder for categorical columns');
    }
    if (hasDatetime) {
        steps.push('DateTime feature extraction (year, month, day, weekday)');
    }
    steps.push('Handle missing values with SimpleImputer');
    steps.push('Train/test split (80/20)');

    return steps;
}

interface ScriptConfig {
    taskType: string;
    targetColumn: string;
    columns: string[];
    columnTypes: Record<string, string>;
    algorithm: string;
    algorithmImport: string;
    preprocessing: string[];
}

function generateAutoMLScript(config: ScriptConfig): string {
    const { taskType, targetColumn, columns, columnTypes, algorithm, algorithmImport } = config;

    const numericCols = columns.filter(c => columnTypes[c] === 'numeric' && c !== targetColumn);
    const categoricalCols = columns.filter(c => (columnTypes[c] === 'categorical' || columnTypes[c] === 'text') && c !== targetColumn);

    const isClassification = taskType.includes('classification');
    const metricImport = isClassification
        ? 'from sklearn.metrics import accuracy_score, classification_report, confusion_matrix'
        : 'from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error';

    const metricCalc = isClassification
        ? `    accuracy = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {accuracy:.4f}")
    print("\\nClassification Report:")
    print(classification_report(y_test, y_pred))`
        : `    mse = mean_squared_error(y_test, y_pred)
    rmse = mean_squared_error(y_test, y_pred, squared=False)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    print(f"RMSE: {rmse:.4f}")
    print(f"R2 Score: {r2:.4f}")
    print(f"MAE: {mae:.4f}")`;

    return `# AutoML Generated Script
# Algorithm: ${algorithm}
# Task Type: ${taskType}
# Target Column: ${targetColumn || 'Auto-detected'}
# Generated by AutoForgeML Studio

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
${algorithmImport}
${metricImport}
import warnings
warnings.filterwarnings('ignore')

# Configuration
TARGET_COLUMN = "${targetColumn || columns[columns.length - 1]}"
NUMERIC_FEATURES = ${JSON.stringify(numericCols.slice(0, 10))}  # First 10 numeric
CATEGORICAL_FEATURES = ${JSON.stringify(categoricalCols.slice(0, 5))}  # First 5 categorical
TEST_SIZE = 0.2
RANDOM_STATE = 42

def load_data():
    """Load dataset from GCS or local path"""
    print("Loading dataset...")
    # In Vertex AI, data will be mounted at /gcs/
    # For local testing, provide a local path
    try:
        df = pd.read_csv("/gcs/autoforgeml-datasets/dataset.csv")
    except:
        df = pd.read_csv("dataset.csv")  # Fallback for local testing
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    return df

def preprocess(df):
    """Preprocess the dataset"""
    print("\\nPreprocessing data...")
    
    # Separate features and target
    if TARGET_COLUMN not in df.columns:
        raise ValueError(f"Target column '{TARGET_COLUMN}' not found in dataset")
    
    X = df.drop(columns=[TARGET_COLUMN])
    y = df[TARGET_COLUMN]
    
    # Handle target encoding for classification
    ${isClassification ? `if y.dtype == 'object':
        le = LabelEncoder()
        y = le.fit_transform(y)
        print(f"Encoded target classes: {le.classes_}")` : '# Regression - target should be numeric'}
    
    # Build preprocessing pipeline
    numeric_features = [c for c in NUMERIC_FEATURES if c in X.columns]
    categorical_features = [c for c in CATEGORICAL_FEATURES if c in X.columns]
    
    print(f"Numeric features: {len(numeric_features)}")
    print(f"Categorical features: {len(categorical_features)}")
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', Pipeline([
                ('imputer', SimpleImputer(strategy='median')),
                ('scaler', StandardScaler())
            ]), numeric_features),
            ('cat', Pipeline([
                ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
                ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
            ]), categorical_features)
        ],
        remainder='drop'  # Drop other columns
    )
    
    return X, y, preprocessor

def train_model(X, y, preprocessor):
    """Train the model"""
    print("\\nTraining model...")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    print(f"Train size: {len(X_train)}, Test size: {len(X_test)}")
    
    # Create full pipeline
    model = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', ${algorithm}(${algorithm.includes('Forest') ? 'n_estimators=100, ' : ''}random_state=RANDOM_STATE))
    ])
    
    # Fit model
    model.fit(X_train, y_train)
    print("Model trained successfully!")
    
    return model, X_test, y_test

def evaluate(model, X_test, y_test):
    """Evaluate model performance"""
    print("\\nEvaluating model...")
    
    y_pred = model.predict(X_test)
    
${metricCalc}
    
    return model

def main():
    """Main training pipeline"""
    print("=" * 50)
    print("AutoForgeML Training Pipeline")
    print("=" * 50)
    
    # Load data
    df = load_data()
    
    # Preprocess
    X, y, preprocessor = preprocess(df)
    
    # Train
    model, X_test, y_test = train_model(X, y, preprocessor)
    
    # Evaluate
    model = evaluate(model, X_test, y_test)
    
    print("\\n" + "=" * 50)
    print("Training complete!")
    print("=" * 50)
    
    return model

if __name__ == "__main__":
    main()
`;
}
