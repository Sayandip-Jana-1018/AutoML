import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateOptimizedImageScript } from '@/lib/image-training-script';

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
        let taskType = project?.inferredTaskType || 'unknown';
        const targetColumn = project?.targetColumnSuggestion || '';
        const columns = schema?.columns || [];
        const columnTypes = schema?.columnTypes || {};

        // Fallback: If columnTypes has 'image' type, force image_classification
        const hasImageColumn = Object.values(columnTypes).some(t => t === 'image');
        if (hasImageColumn && taskType !== 'image_classification') {
            console.log(`[AutoML] Detected image column in columnTypes. Overriding taskType to image_classification.`);
            taskType = 'image_classification';
        }

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

    // Image classification tasks
    const hasImageColumn = Object.values(columnTypes).some(t => t === 'image');
    if (hasImageColumn || taskType === 'image_classification') {
        return {
            algorithm: 'SimpleCNN',
            importStatement: 'import tensorflow as tf\nfrom tensorflow.keras import layers, models',
            reason: 'Deep Learning (CNN) is best suited for image classification tasks'
        };
    }

    // Classification tasks
    if (taskType === 'binary_classification' || taskType === 'multiclass_classification') {
        // ... existing classification logic ...
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
        // ... existing regression logic ...
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

    const hasImage = Object.values(columnTypes).some(t => t === 'image');
    if (hasImage) {
        steps.push('Resize images to 128x128');
        steps.push('Normalize pixel values (1/255)');
        steps.push('Data Augmentation (flip, rotate)');
        steps.push('Train/test split (80/20)');
        return steps;
    }

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

    // Delegate to Optimized Image Script Generator if SimpleCNN
    if (algorithm === 'SimpleCNN') {
        return generateOptimizedImageScript({ taskType, targetColumn, algorithm });
    }

    const numericCols = columns.filter(c => columnTypes[c] === 'numeric' && c !== targetColumn);
    const categoricalCols = columns.filter(c => (columnTypes[c] === 'categorical' || columnTypes[c] === 'text') && c !== targetColumn);

    // ... existing tabular script generation ...
    // FIXED: Check BOTH taskType AND algorithm name for classification
    const isClassification = taskType.includes('classification') || algorithm.includes('Classifier');
    const metricImport = isClassification
        ? 'from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_score, recall_score, f1_score, log_loss'
        : 'from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error';

    const metricCalc = isClassification
        ? `    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
    recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
    cm = confusion_matrix(y_test, y_pred)
    
    # Try to compute log_loss if model has predict_proba
    try:
        y_proba = model.predict_proba(X_test)
        logloss = log_loss(y_test, y_proba)
    except:
        logloss = None
    
    print(f"Accuracy: {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall: {recall:.4f}")
    print(f"F1-Score: {f1:.4f}")
    if logloss:
        print(f"Log Loss: {logloss:.4f}")
    print("\\nClassification Report:")
    print(classification_report(y_test, y_pred))
    print("\\nConfusion Matrix:")
    print(cm)`
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

import os
import json
import subprocess
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
${algorithmImport}
${metricImport}
import warnings
warnings.filterwarnings('ignore')

# Model output configuration from environment
MODEL_OUTPUT_PATH = os.environ.get('MODEL_OUTPUT_PATH', '/tmp/model')
GCS_OUTPUT_PATH = os.environ.get('GCS_OUTPUT_PATH', '')
DATASET_GCS_PATH = os.environ.get('DATASET_GCS_PATH', '')

# Training config from user overlay (environment variables override defaults)
MLFORGE_MAX_TREES = int(os.environ.get('MLFORGE_MAX_TREES', 100))  # For tree-based models
MLFORGE_LEARNING_RATE = float(os.environ.get('MLFORGE_LEARNING_RATE', 0.1))  # For boosting
print(f"Training Config: MAX_TREES={MLFORGE_MAX_TREES}, LEARNING_RATE={MLFORGE_LEARNING_RATE}")

# Configuration
TARGET_COLUMN = "${targetColumn || columns[columns.length - 1]}"
NUMERIC_FEATURES = ${JSON.stringify(numericCols.slice(0, 10))}  # First 10 numeric
CATEGORICAL_FEATURES = ${JSON.stringify(categoricalCols.slice(0, 5))}  # First 5 categorical
TEST_SIZE = 0.2
RANDOM_STATE = 42

def load_data():
    """Load dataset from GCS or local path"""
    print("Loading dataset...")
    
    # Try to load from GCS path passed via environment
    if DATASET_GCS_PATH:
        print(f"Dataset path: {DATASET_GCS_PATH}")
        # Download from GCS to local first
        local_path = '/tmp/dataset.csv'
        try:
            subprocess.run(['gsutil', 'cp', DATASET_GCS_PATH, local_path], check=True)
            df = pd.read_csv(local_path)
        except Exception as e:
            print(f"Error downloading from GCS: {e}")
            raise
    else:
        # Fallback paths - use ./dataset.csv which startup script creates
        try:
            df = pd.read_csv('./dataset.csv')
        except:
            df = pd.read_csv('/tmp/dataset.csv')
    
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    return df

def preprocess(df):
    """Preprocess the dataset - dynamically handles any target column"""
    print("\\nPreprocessing data...")
    
    # Separate features and target
    if TARGET_COLUMN not in df.columns:
        raise ValueError(f"Target column '{TARGET_COLUMN}' not found in dataset. Available columns: {list(df.columns)}")
    
    X = df.drop(columns=[TARGET_COLUMN])
    y = df[TARGET_COLUMN]
    
    # Handle target encoding for classification
    ${isClassification ? `if y.dtype == 'object':
        le = LabelEncoder()
        y = le.fit_transform(y)
        print(f"Encoded target classes: {le.classes_}")` : '# Regression - target should be numeric'}
    
    # DYNAMIC COLUMN DETECTION - auto-detect from actual DataFrame
    # This ensures we never reference columns that don't exist
    numeric_features = X.select_dtypes(include=['int64', 'float64', 'int32', 'float32']).columns.tolist()
    categorical_features = X.select_dtypes(include=['object', 'category', 'bool']).columns.tolist()
    
    # Optional: use schema hints if available (but filtered to existing columns)
    schema_numeric = [c for c in NUMERIC_FEATURES if c in X.columns]
    schema_categorical = [c for c in CATEGORICAL_FEATURES if c in X.columns]
    
    # If schema hints are reasonable, prefer them (they exclude ID columns etc.)
    if len(schema_numeric) >= len(numeric_features) * 0.5:
        numeric_features = schema_numeric
    if len(schema_categorical) >= len(categorical_features) * 0.5:
        categorical_features = schema_categorical
    
    print(f"Numeric features ({len(numeric_features)}): {numeric_features[:5]}{'...' if len(numeric_features) > 5 else ''}")
    print(f"Categorical features ({len(categorical_features)}): {categorical_features[:5]}{'...' if len(categorical_features) > 5 else ''}")
    
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
        remainder='drop'  # Drop other columns (datetime, text, etc.)
    )
    
    return X, y, preprocessor


def train_model(X, y, preprocessor):
    """Train multiple models and select the best one via cross-validation
    
    Smart features:
    - Dataset size heuristics: Skip complex models for small datasets
    - Class imbalance detection: Auto-apply class_weight='balanced' (classification only)
    - Early stopping: Prevent overfitting for boosting algorithms
    - Task-aware: Uses Classifiers or Regressors based on task type
    """
    from sklearn.model_selection import cross_val_score
    print("\\\\n" + "="*60)
    print("SMART AUTOML - Dataset-Aware Model Selection")
    print("="*60)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    n_samples = len(X_train)
    n_features = X.shape[1] if hasattr(X, 'shape') else len(X.columns)
    print(f"Train size: {n_samples}, Test size: {len(X_test)}, Features: {n_features}")
    
${isClassification ? `    # Detect class imbalance for classification
    is_imbalanced = False
    try:
        from collections import Counter
        class_counts = Counter(y_train)
        if len(class_counts) >= 2:
            counts = list(class_counts.values())
            imbalance_ratio = min(counts) / max(counts)
            is_imbalanced = imbalance_ratio < 0.3  # Less than 30% minority
            if is_imbalanced:
                print(f"⚠️ Class imbalance detected (ratio: {imbalance_ratio:.2f}) - using balanced weights")
    except:
        pass
    class_weight_param = 'balanced' if is_imbalanced else None` : `    # Regression task - no class imbalance check needed
    is_imbalanced = False`}
    
    # Dataset size categories
    is_tiny = n_samples < 200
    is_small = n_samples < 500
    is_medium = n_samples < 5000
    
    if is_tiny:
        print("📊 Tiny dataset (<200 rows) - using simple models only")
    elif is_small:
        print("📊 Small dataset (<500 rows) - skipping complex boosting models")
    elif is_medium:
        print("📊 Medium dataset - testing all available algorithms")
    else:
        print("📊 Large dataset (5000+ rows) - full model comparison")
    
    # Define candidate algorithms based on dataset size and task type
    candidates = {}
    
${isClassification ? `    # === CLASSIFICATION MODELS ===
    # TIER 1: Simple models (always included)
    try:
        from sklearn.linear_model import LogisticRegression
        candidates['LogisticRegression'] = LogisticRegression(
            max_iter=1000, random_state=RANDOM_STATE, class_weight=class_weight_param
        )
    except: pass
    
    # TIER 2: Tree-based (included for all but tiny datasets)
    if not is_tiny:
        try:
            from sklearn.ensemble import RandomForestClassifier
            candidates['RandomForest'] = RandomForestClassifier(
                n_estimators=min(MLFORGE_MAX_TREES, 50 if is_small else 100),
                max_depth=10 if is_small else None,
                random_state=RANDOM_STATE, class_weight=class_weight_param, n_jobs=-1
            )
        except: pass
        try:
            from sklearn.ensemble import GradientBoostingClassifier
            candidates['GradientBoosting'] = GradientBoostingClassifier(
                n_estimators=min(MLFORGE_MAX_TREES, 50 if is_small else 100), max_depth=3,
                learning_rate=MLFORGE_LEARNING_RATE,
                random_state=RANDOM_STATE, validation_fraction=0.1, n_iter_no_change=10
            )
        except: pass
    
    # TIER 3: Advanced boosting (only for medium+ datasets)
    if not is_small:
        try:
            from xgboost import XGBClassifier
            candidates['XGBoost'] = XGBClassifier(
                n_estimators=MLFORGE_MAX_TREES, max_depth=6, learning_rate=MLFORGE_LEARNING_RATE,
                use_label_encoder=False, eval_metric='logloss',
                random_state=RANDOM_STATE, verbosity=0
            )
            print("✓ XGBoost available")
        except ImportError:
            print("✗ XGBoost not installed")
        try:
            from lightgbm import LGBMClassifier
            candidates['LightGBM'] = LGBMClassifier(
                n_estimators=MLFORGE_MAX_TREES, max_depth=6, learning_rate=MLFORGE_LEARNING_RATE,
                random_state=RANDOM_STATE, verbose=-1, class_weight=class_weight_param
            )
            print("✓ LightGBM available")
        except ImportError:
            print("✗ LightGBM not installed")
    
    # TIER 4: SVM for small datasets
    if is_small and n_samples >= 50:
        try:
            from sklearn.svm import SVC
            candidates['SVM'] = SVC(kernel='rbf', probability=True, random_state=RANDOM_STATE, class_weight=class_weight_param)
        except: pass
    
    scoring_metric = 'accuracy'` : `    # === REGRESSION MODELS ===
    # TIER 1: Simple models (always included)
    try:
        from sklearn.linear_model import Ridge
        candidates['Ridge'] = Ridge(alpha=1.0, random_state=RANDOM_STATE)
    except: pass
    try:
        from sklearn.linear_model import Lasso
        candidates['Lasso'] = Lasso(alpha=1.0, random_state=RANDOM_STATE, max_iter=1000)
    except: pass
    
    # TIER 2: Tree-based (included for all but tiny datasets)
    if not is_tiny:
        try:
            from sklearn.ensemble import RandomForestRegressor
            candidates['RandomForest'] = RandomForestRegressor(
                n_estimators=min(MLFORGE_MAX_TREES, 50 if is_small else 100),
                max_depth=10 if is_small else None,
                random_state=RANDOM_STATE, n_jobs=-1
            )
        except: pass
        try:
            from sklearn.ensemble import GradientBoostingRegressor
            candidates['GradientBoosting'] = GradientBoostingRegressor(
                n_estimators=min(MLFORGE_MAX_TREES, 50 if is_small else 100), max_depth=3,
                learning_rate=MLFORGE_LEARNING_RATE,
                random_state=RANDOM_STATE, validation_fraction=0.1, n_iter_no_change=10
            )
        except: pass
    
    # TIER 3: Advanced boosting (only for medium+ datasets)
    if not is_small:
        try:
            from xgboost import XGBRegressor
            candidates['XGBoost'] = XGBRegressor(
                n_estimators=MLFORGE_MAX_TREES, max_depth=6, learning_rate=MLFORGE_LEARNING_RATE,
                random_state=RANDOM_STATE, verbosity=0
            )
            print("✓ XGBoost available")
        except ImportError:
            print("✗ XGBoost not installed")
        try:
            from lightgbm import LGBMRegressor
            candidates['LightGBM'] = LGBMRegressor(
                n_estimators=MLFORGE_MAX_TREES, max_depth=6, learning_rate=MLFORGE_LEARNING_RATE,
                random_state=RANDOM_STATE, verbose=-1
            )
            print("✓ LightGBM available")
        except ImportError:
            print("✗ LightGBM not installed")
    
    # TIER 4: SVR for small datasets
    if is_small and n_samples >= 50:
        try:
            from sklearn.svm import SVR
            candidates['SVR'] = SVR(kernel='rbf')
        except: pass
    
    scoring_metric = 'r2'`}
    
    print(f"\\\\nTesting {len(candidates)} algorithms: {', '.join(candidates.keys())}")
    
    # Determine CV folds based on dataset size
    cv_folds = 3 if is_small else 5
    print(f"Running {cv_folds}-fold cross-validation (metric: {scoring_metric})...")
    
    # Run cross-validation for each candidate
    results = {}
    for name, model in candidates.items():
        try:
            pipeline = Pipeline([
                ('preprocessor', preprocessor),
                ('model', model)
            ])
            scores = cross_val_score(pipeline, X_train, y_train, cv=cv_folds, scoring=scoring_metric, n_jobs=-1)
            mean_score = scores.mean()
            std_score = scores.std()
            results[name] = {'mean': mean_score, 'std': std_score, 'pipeline': pipeline}
            
            # Visual indicator of performance
            stars = "★" * max(1, int(mean_score * 5))
            print(f"  {name}: {mean_score:.4f} (+/- {std_score:.4f}) {stars}")
        except Exception as e:
            print(f"  {name}: Failed - {str(e)[:50]}")
    
    # Select best algorithm
    if not results:
        raise ValueError("All algorithms failed during cross-validation")
    
    best_name = max(results, key=lambda k: results[k]['mean'])
    best_result = results[best_name]
    
    print(f"\\\\n{'='*60}")
    print(f"🏆 BEST ALGORITHM: {best_name}")
    print(f"   CV {scoring_metric.upper()}: {best_result['mean']:.4f} (+/- {best_result['std']:.4f})")
${isClassification ? `    if is_imbalanced:
        print(f"   ℹ️  Using balanced class weights due to imbalance")` : ''}
    print(f"{'='*60}\\\\n")
    
    # Train best model on full training data
    model = best_result['pipeline']
    model.fit(X_train, y_train)
    print(f"Final model ({best_name}) trained successfully!")
    
    # Store comparison results for metrics
    model.algorithm_comparison = {name: {'cv_score': r['mean'], 'cv_std': r['std']} for name, r in results.items()}
    model.best_algorithm = best_name
    model.dataset_info = {'n_samples': n_samples, 'n_features': n_features, 'is_imbalanced': is_imbalanced, 'cv_folds': cv_folds}
    
    return model, X_test, y_test



def evaluate(model, X_test, y_test):
    """Evaluate model performance and return metrics"""
    print("\\nEvaluating model...")
    
    y_pred = model.predict(X_test)
    metrics = {}
    
${metricCalc}
    
${isClassification ? `    metrics['accuracy'] = float(accuracy)
    metrics['precision'] = float(precision)
    metrics['recall'] = float(recall)
    metrics['f1'] = float(f1)
    if logloss is not None:
        metrics['log_loss'] = float(logloss)
    metrics['confusion_matrix'] = cm.tolist()
    try:
        metrics['num_classes'] = len(np.unique(y_test))
    except:
        pass
    
    # Include algorithm comparison results
    if hasattr(model, 'algorithm_comparison'):
        metrics['algorithm_comparison'] = model.algorithm_comparison
        metrics['best_algorithm'] = model.best_algorithm` : `    metrics['rmse'] = float(rmse)
    metrics['r2'] = float(r2)
    metrics['mae'] = float(mae)`}
    
    return model, metrics

def save_model(model, metrics):
    """Save model to GCS for deployment"""
    print("\\nSaving model...")
    
    # Create local model directory
    os.makedirs(MODEL_OUTPUT_PATH, exist_ok=True)
    
    # Save model with joblib
    model_file = os.path.join(MODEL_OUTPUT_PATH, 'model.joblib')
    joblib.dump(model, model_file)
    print(f"Model saved locally to: {model_file}")
    
    # Save metrics as JSON
    metrics_file = os.path.join(MODEL_OUTPUT_PATH, 'metrics.json')
    with open(metrics_file, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"Metrics saved to: {metrics_file}")
    
    # Upload to GCS if path is provided
    if GCS_OUTPUT_PATH:
        print(f"Uploading to GCS: {GCS_OUTPUT_PATH}")
        try:
            # Upload all files in model directory
            subprocess.run(
                ['gsutil', '-m', 'cp', '-r', f'{MODEL_OUTPUT_PATH}/*', GCS_OUTPUT_PATH],
                check=True
            )
            print(f"Model uploaded to: {GCS_OUTPUT_PATH}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"Warning: Could not upload to GCS: {e}")
            return False
    else:
        print("No GCS_OUTPUT_PATH set, model saved locally only")
        return True

def main():
    """Main training pipeline"""
    print("=" * 50)
    print("AutoForgeML Training Pipeline")
    print("=" * 50)
    print(f"GCS Output Path: {GCS_OUTPUT_PATH or 'Not set'}")
    print(f"Dataset Path: {DATASET_GCS_PATH or 'Not set'}")
    print("=" * 50)
    
    try:
        # Load data
        df = load_data()
        
        # Preprocess
        X, y, preprocessor = preprocess(df)
        
        # Train
        model, X_test, y_test = train_model(X, y, preprocessor)
        
        # Evaluate
        model, metrics = evaluate(model, X_test, y_test)
        
        # Save model to GCS
        save_success = save_model(model, metrics)
        
        print("\\n" + "=" * 50)
        if save_success:
            print("SUCCESS: Training complete and model saved!")
        else:
            print("WARNING: Training complete but model save had issues")
        print("=" * 50)
        
        return model, metrics
        
    except Exception as e:
        print(f"\\nERROR: Training failed - {e}")
        raise

if __name__ == "__main__":
    main()
`;
}

function generateImageScript(config: ScriptConfig): string {
    const { taskType, targetColumn, columns, columnTypes, algorithm } = config;

    // Find image column - look for first column with type 'image' or guess based on name
    const imageColumn = columns.find(c => columnTypes[c] === 'image') || columns[0];

    return `# AutoML Generated Script
# Algorithm: ${algorithm} (Convolutional Neural Network)
# Task Type: ${taskType}
# Target Column: ${targetColumn}
# Image Column: ${imageColumn}
# Generated by AutoForgeML Studio

import os
import json
import subprocess
import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models, regularizers
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import warnings
warnings.filterwarnings('ignore')

# Set random seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

# GPU Configuration
gpus = tf.config.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        print(f"✅ GPU detected: {len(gpus)} device(s)")
    except RuntimeError as e:
        print(e)
else:
    print("ℹ️  No GPU detected, falling back to CPU")

# Model output configuration from environment
MODEL_OUTPUT_PATH = os.environ.get('MODEL_OUTPUT_PATH', '/tmp/model')
GCS_OUTPUT_PATH = os.environ.get('GCS_OUTPUT_PATH', '')
DATASET_GCS_PATH = os.environ.get('DATASET_GCS_PATH', '')

# Configuration
IMAGE_SIZE = (128, 128)
BATCH_SIZE = 32
EPOCHS = 20
TARGET_COLUMN = "${targetColumn}"
IMAGE_COLUMN = "${imageColumn}"

def load_data():
    """Load dataset from GCS or local path"""
    print("Loading dataset...")
    
    # Try to load from GCS path passed via environment
    if DATASET_GCS_PATH:
        print(f"Dataset path: {DATASET_GCS_PATH}")
        local_path = '/tmp/dataset.csv'
        try:
            subprocess.run(['gsutil', 'cp', DATASET_GCS_PATH, local_path], check=True)
            df = pd.read_csv(local_path)
        except Exception as e:
            print(f"Error downloading from GCS: {e}")
            raise
    else:
        # Fallback paths
        try:
            df = pd.read_csv('./dataset.csv')
        except:
            df = pd.read_csv('/tmp/dataset.csv')
    
    print(f"Loaded {len(df)} rows")
    return df

def create_model(num_classes):
    """Create a robust CNN for image classification"""
    print(f"Creating CNN model for {num_classes} classes...")
    
    model = models.Sequential([
        # Data Augmentation Layer (active only during training)
        layers.RandomFlip("horizontal", input_shape=(IMAGE_SIZE[0], IMAGE_SIZE[1], 3)),
        layers.RandomRotation(0.1),
        layers.RandomZoom(0.1),
        layers.Rescaling(1./255),
        
        # Convolutional Block 1
        layers.Conv2D(32, (3, 3), padding='same', activation='relu'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        
        # Convolutional Block 2
        layers.Conv2D(64, (3, 3), padding='same', activation='relu'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.2),
        
        # Convolutional Block 3
        layers.Conv2D(128, (3, 3), padding='same', activation='relu'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.3),
        
        # Dense Layers
        layers.Flatten(),
        layers.Dense(256, activation='relu', kernel_regularizer=regularizers.l2(0.001)),
        layers.BatchNormalization(),
        layers.Dropout(0.5),
        layers.Dense(num_classes, activation='softmax' if num_classes > 2 else 'sigmoid')
    ])
    
    loss = 'sparse_categorical_crossentropy' if num_classes > 2 else 'binary_crossentropy'
    
    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy', # using categorical from generator
        metrics=['accuracy']
    )
    
    model.summary()
    return model

def main():
    try:
        df = load_data()
        
        # Validate columns
        if IMAGE_COLUMN not in df.columns or TARGET_COLUMN not in df.columns:
            raise ValueError(f"Columns {IMAGE_COLUMN} or {TARGET_COLUMN} not found in dataset")
        
        # Get class names
        classes = df[TARGET_COLUMN].unique()
        num_classes = len(classes)
        print(f"Classes ({num_classes}): {classes}")
        
        # Convert target to string for flow_from_dataframe
        df[TARGET_COLUMN] = df[TARGET_COLUMN].astype(str)
        
        # Train/Test Split
        train_df, val_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df[TARGET_COLUMN])
        
        print(f"Training set: {len(train_df)} images")
        print(f"Validation set: {len(val_df)} images")
        
        train_datagen = ImageDataGenerator()
        val_datagen = ImageDataGenerator()
        
        print("Initializing Data Generators...")
        train_generator = train_datagen.flow_from_dataframe(
            dataframe=train_df,
            directory=None, 
            x_col=IMAGE_COLUMN,
            y_col=TARGET_COLUMN,
            target_size=IMAGE_SIZE,
            batch_size=BATCH_SIZE,
            class_mode='categorical',
            shuffle=True
        )
        
        val_generator = val_datagen.flow_from_dataframe(
            dataframe=val_df,
            directory=None,
            x_col=IMAGE_COLUMN,
            y_col=TARGET_COLUMN,
            target_size=IMAGE_SIZE,
            batch_size=BATCH_SIZE,
            class_mode='categorical',
            shuffle=False
        )
        
        # Create Model
        model = create_model(num_classes)
        
        # Callbacks
        callbacks = [
            EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True),
            ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, min_lr=1e-6)
        ]
        
        # Train
        print(f"\\\\nStarting training for {EPOCHS} epochs...")
        history = model.fit(
            train_generator,
            epochs=EPOCHS,
            validation_data=val_generator,
            callbacks=callbacks
        )
        
        # Evaluate
        print("\\\\nEvaluating best model...")
        val_loss, val_acc = model.evaluate(val_generator)
        print(f"Validation Accuracy: {val_acc:.4f}")
        print(f"Validation Loss: {val_loss:.4f}")
        
        # Detailed Metrics
        y_pred_prob = model.predict(val_generator)
        y_pred = np.argmax(y_pred_prob, axis=1)
        y_true = val_generator.classes
        
        print("\\\\nClassification Report:")
        print(classification_report(y_true, y_pred, target_names=list(val_generator.class_indices.keys())))
        
        # Save Model
        print("\\\\nSaving model...")
        os.makedirs(MODEL_OUTPUT_PATH, exist_ok=True)
        model.save(os.path.join(MODEL_OUTPUT_PATH, 'model.h5'))
        
        # Save Metrics
        metrics = {
            'accuracy': float(val_acc),
            'loss': float(val_loss),
            'history': history.history
        }
        with open(os.path.join(MODEL_OUTPUT_PATH, 'metrics.json'), 'w') as f:
            json.dump(metrics, f)
            
        print("SUCCESS: Training pipeline completed.")
        
        if GCS_OUTPUT_PATH:
             subprocess.run(['gsutil', '-m', 'cp', '-r', f'{MODEL_OUTPUT_PATH}/*', GCS_OUTPUT_PATH], check=True)

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == '__main__':
    main()
`;
}
