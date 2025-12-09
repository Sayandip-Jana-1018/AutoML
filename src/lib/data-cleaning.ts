/**
 * Data Cleaning Utilities
 * Provides auto-cleaning logic and generates cleaning code for train.py
 * Supports classification vs regression-specific rules
 */

export interface CleaningConfig {
    dropHighMissingCols: boolean;  // Drop columns with >50% missing
    dropHighMissingRows: boolean;  // Drop rows with >50% missing
    imputeNumeric: 'mean' | 'median' | 'zero' | 'none';
    imputeCategorical: 'mode' | 'unknown' | 'none';
    removeOutliers: boolean;
    outlierThreshold: number;  // IQR multiplier
    // Task-specific options
    taskType?: 'classification' | 'regression';
    handleClassImbalance?: boolean;  // Classification: use SMOTE/class weights
    normalizeTarget?: boolean;  // Regression: normalize target variable
    encodeLabels?: boolean;  // Classification: encode labels
}

export interface CleaningMetadata {
    outlierRemovalApplied: boolean;
    outlierMethod: string | null;
    rowsDroppedEstimate: number;
    columnsDropped: string[];
    imputationApplied: {
        numeric: string;
        categorical: string;
    };
}

export const DEFAULT_CLEANING_CONFIG: CleaningConfig = {
    dropHighMissingCols: true,
    dropHighMissingRows: false,
    imputeNumeric: 'median',
    imputeCategorical: 'mode',
    removeOutliers: false,
    outlierThreshold: 1.5,
    taskType: 'classification',
    handleClassImbalance: false,
    normalizeTarget: false,
    encodeLabels: true
};

/**
 * Creates cleaning metadata for job document
 */
export function createCleaningMetadata(config: CleaningConfig): CleaningMetadata {
    return {
        outlierRemovalApplied: config.removeOutliers,
        outlierMethod: config.removeOutliers ? `IQR (threshold: ${config.outlierThreshold})` : null,
        rowsDroppedEstimate: 0, // Will be updated by actual training
        columnsDropped: [],
        imputationApplied: {
            numeric: config.imputeNumeric,
            categorical: config.imputeCategorical
        }
    };
}

/**
 * Generates Python code for data preprocessing
 */
export function generateCleaningCode(config: CleaningConfig): string {
    const lines: string[] = [
        `def preprocess(df):`,
        `    """Auto-generated preprocessing function"""`,
        `    import pandas as pd`,
        `    import numpy as np`,
        `    `,
        `    print(f"Original shape: {df.shape}")`,
        `    original_rows = len(df)`,
    ];

    // Drop high-missing columns
    if (config.dropHighMissingCols) {
        lines.push(`    `);
        lines.push(`    # Drop columns with >50% missing values`);
        lines.push(`    missing_pct = df.isnull().sum() / len(df)`);
        lines.push(`    high_missing_cols = missing_pct[missing_pct > 0.5].index.tolist()`);
        lines.push(`    if high_missing_cols:`);
        lines.push(`        print(f"Dropping columns with >50% missing: {high_missing_cols}")`);
        lines.push(`        df = df.drop(columns=high_missing_cols)`);
    }

    // Drop high-missing rows
    if (config.dropHighMissingRows) {
        lines.push(`    `);
        lines.push(`    # Drop rows with >50% missing values`);
        lines.push(`    row_missing_pct = df.isnull().sum(axis=1) / len(df.columns)`);
        lines.push(`    df = df[row_missing_pct <= 0.5]`);
        lines.push(`    print(f"Dropped {original_rows - len(df)} rows with >50% missing")`);
    }

    // Impute numeric columns
    if (config.imputeNumeric !== 'none') {
        lines.push(`    `);
        lines.push(`    # Impute numeric columns`);
        lines.push(`    numeric_cols = df.select_dtypes(include=[np.number]).columns`);

        if (config.imputeNumeric === 'mean') {
            lines.push(`    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())`);
        } else if (config.imputeNumeric === 'median') {
            lines.push(`    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].median())`);
        } else if (config.imputeNumeric === 'zero') {
            lines.push(`    df[numeric_cols] = df[numeric_cols].fillna(0)`);
        }
        lines.push(`    print(f"Imputed {len(numeric_cols)} numeric columns with ${config.imputeNumeric}")`);
    }

    // Impute categorical columns
    if (config.imputeCategorical !== 'none') {
        lines.push(`    `);
        lines.push(`    # Impute categorical columns`);
        lines.push(`    cat_cols = df.select_dtypes(include=['object', 'category']).columns`);

        if (config.imputeCategorical === 'mode') {
            lines.push(`    for col in cat_cols:`);
            lines.push(`        df[col] = df[col].fillna(df[col].mode().iloc[0] if not df[col].mode().empty else 'Unknown')`);
        } else if (config.imputeCategorical === 'unknown') {
            lines.push(`    df[cat_cols] = df[cat_cols].fillna('Unknown')`);
        }
        lines.push(`    print(f"Imputed {len(cat_cols)} categorical columns")`);
    }

    // Remove outliers
    if (config.removeOutliers) {
        lines.push(`    `);
        lines.push(`    # Remove outliers using IQR method`);
        lines.push(`    numeric_cols = df.select_dtypes(include=[np.number]).columns`);
        lines.push(`    for col in numeric_cols:`);
        lines.push(`        Q1 = df[col].quantile(0.25)`);
        lines.push(`        Q3 = df[col].quantile(0.75)`);
        lines.push(`        IQR = Q3 - Q1`);
        lines.push(`        lower = Q1 - ${config.outlierThreshold} * IQR`);
        lines.push(`        upper = Q3 + ${config.outlierThreshold} * IQR`);
        lines.push(`        df = df[(df[col] >= lower) & (df[col] <= upper)]`);
        lines.push(`    print(f"Removed outliers, remaining rows: {len(df)}")`);
    }

    lines.push(`    `);
    lines.push(`    print(f"Final shape: {df.shape}")`);
    lines.push(`    return df`);

    return lines.join('\n');
}

/**
 * Generates task-specific Python preprocessing code
 * Classification: Proper label encoding, class imbalance handling
 * Regression: Target normalization, no class encoding
 */
export function generateTaskSpecificCleaningCode(
    config: CleaningConfig,
    taskType: 'classification' | 'regression',
    targetColumn: string
): string {
    const baseCode = generateCleaningCode(config);
    const lines: string[] = [baseCode, ''];

    if (taskType === 'classification') {
        // Classification-specific preprocessing
        lines.push(`def preprocess_for_classification(df, target_col="${targetColumn}"):`);
        lines.push(`    """Classification-specific preprocessing"""`);
        lines.push(`    from sklearn.preprocessing import LabelEncoder`);
        lines.push(`    `);
        lines.push(`    # Apply base preprocessing`);
        lines.push(`    df = preprocess(df)`);
        lines.push(`    `);
        lines.push(`    # Encode target labels properly`);
        lines.push(`    if df[target_col].dtype == 'object' or df[target_col].dtype.name == 'category':`);
        lines.push(`        le = LabelEncoder()`);
        lines.push(`        df[target_col] = le.fit_transform(df[target_col])`);
        lines.push(`        print(f"Encoded target classes: {list(le.classes_)}")`);
        lines.push(`    `);

        // Optional class imbalance handling
        if (config.handleClassImbalance) {
            lines.push(`    # Check class distribution`);
            lines.push(`    class_counts = df[target_col].value_counts()`);
            lines.push(`    print(f"Class distribution: {class_counts.to_dict()}")`);
            lines.push(`    `);
            lines.push(`    # Note: SMOTE can be applied here if imblearn is available`);
            lines.push(`    # from imblearn.over_sampling import SMOTE`);
            lines.push(`    # X, y = SMOTE().fit_resample(X, y)`);
        }

        lines.push(`    return df`);

    } else {
        // Regression-specific preprocessing
        lines.push(`def preprocess_for_regression(df, target_col="${targetColumn}"):`);
        lines.push(`    """Regression-specific preprocessing"""`);
        lines.push(`    from sklearn.preprocessing import StandardScaler`);
        lines.push(`    import numpy as np`);
        lines.push(`    `);
        lines.push(`    # Apply base preprocessing`);
        lines.push(`    df = preprocess(df)`);
        lines.push(`    `);

        // Optional target normalization for regression
        if (config.normalizeTarget) {
            lines.push(`    # Normalize target variable`);
            lines.push(`    original_mean = df[target_col].mean()`);
            lines.push(`    original_std = df[target_col].std()`);
            lines.push(`    df[target_col] = (df[target_col] - original_mean) / original_std`);
            lines.push(`    print(f"Normalized target: mean={original_mean:.4f}, std={original_std:.4f}")`);
        } else {
            lines.push(`    # Skip target normalization (use raw values)`);
            lines.push(`    print(f"Target range: [{df[target_col].min():.2f}, {df[target_col].max():.2f}]")`);
        }

        lines.push(`    `);
        lines.push(`    # Ensure no categorical encoding on target`);
        lines.push(`    if df[target_col].dtype == 'object':`);
        lines.push(`        raise ValueError(f"Regression target '{target_col}' should be numeric, not categorical!")`);
        lines.push(`    `);
        lines.push(`    return df`);
    }

    return lines.join('\n');
}


/**
 * Generates structured train.py template
 */
export function generateStructuredTrainScript(options: {
    datasetPath: string;
    targetColumn: string;
    algorithm: string;
    taskType: 'classification' | 'regression';
    testSize?: number;
    cleaningConfig?: CleaningConfig;
}): string {
    const {
        datasetPath,
        targetColumn,
        algorithm,
        taskType,
        testSize = 0.2,
        cleaningConfig = DEFAULT_CLEANING_CONFIG
    } = options;

    const cleaningCode = generateCleaningCode(cleaningConfig);

    const metricsImport = taskType === 'classification'
        ? 'from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report'
        : 'from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score';

    const evaluateCode = taskType === 'classification' ? `
def evaluate(model, X_test, y_test):
    """Evaluate classification model"""
    y_pred = model.predict(X_test)
    
    metrics = {
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred, average='weighted', zero_division=0),
        'recall': recall_score(y_test, y_pred, average='weighted', zero_division=0),
        'f1': f1_score(y_test, y_pred, average='weighted', zero_division=0)
    }
    
    print("\\n=== Classification Report ===")
    print(classification_report(y_test, y_pred, zero_division=0))
    
    for name, value in metrics.items():
        print(f"{name}: {value:.4f}")
    
    return metrics
` : `
def evaluate(model, X_test, y_test):
    """Evaluate regression model"""
    y_pred = model.predict(X_test)
    
    metrics = {
        'mse': mean_squared_error(y_test, y_pred),
        'mae': mean_absolute_error(y_test, y_pred),
        'rmse': mean_squared_error(y_test, y_pred, squared=False),
        'r2': r2_score(y_test, y_pred)
    }
    
    print("\\n=== Regression Metrics ===")
    for name, value in metrics.items():
        print(f"{name}: {value:.4f}")
    
    return metrics
`;

    const algorithmImport = getAlgorithmImport(algorithm);
    const algorithmInit = getAlgorithmInit(algorithm, taskType);

    return `#!/usr/bin/env python3
"""
Auto-generated training script
Dataset: ${datasetPath}
Target: ${targetColumn}
Algorithm: ${algorithm}
Task: ${taskType}
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
${metricsImport}
${algorithmImport}

# ============================================================
# LOAD DATA
# ============================================================

def load_data(path: str):
    """Load dataset from CSV"""
    print(f"Loading data from {path}...")
    df = pd.read_csv(path)
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    return df

# ============================================================
# PREPROCESSING
# ============================================================

${cleaningCode}

# ============================================================
# TRAIN MODEL
# ============================================================

def train_model(X_train, y_train):
    """Initialize and train the model"""
    print(f"\\nTraining ${algorithm}...")
    ${algorithmInit}
    model.fit(X_train, y_train)
    print("Training complete!")
    return model

# ============================================================
# EVALUATE
# ============================================================
${evaluateCode}

# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    # 1. Load
    df = load_data("${datasetPath}")
    
    # 2. Preprocess
    df = preprocess(df)
    
    # 3. Prepare features and target
    target_col = "${targetColumn}"
    X = df.drop(columns=[target_col])
    y = df[target_col]
    
    # Encode categorical features
    for col in X.select_dtypes(include=['object', 'category']).columns:
        X[col] = LabelEncoder().fit_transform(X[col].astype(str))
    
    # Encode target if classification
    if y.dtype == 'object':
        y = LabelEncoder().fit_transform(y)
    
    # Scale features
    scaler = StandardScaler()
    X = pd.DataFrame(scaler.fit_transform(X), columns=X.columns)
    
    # 4. Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=${testSize}, random_state=42
    )
    print(f"\\nTrain size: {len(X_train)}, Test size: {len(X_test)}")
    
    # 5. Train
    model = train_model(X_train, y_train)
    
    # 6. Evaluate
    metrics = evaluate(model, X_test, y_test)
    
    print("\\n=== Training Complete ===")
`;
}

/**
 * Get import statement for algorithm
 */
function getAlgorithmImport(algorithm: string): string {
    const imports: Record<string, string> = {
        'RandomForest': 'from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor',
        'XGBoost': 'import xgboost as xgb',
        'LogisticRegression': 'from sklearn.linear_model import LogisticRegression',
        'LinearRegression': 'from sklearn.linear_model import LinearRegression, Ridge',
        'DecisionTree': 'from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor',
        'SVM': 'from sklearn.svm import SVC, SVR',
        'KNN': 'from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor',
        'GradientBoosting': 'from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor',
        'NeuralNetwork': 'from sklearn.neural_network import MLPClassifier, MLPRegressor'
    };
    return imports[algorithm] || imports['RandomForest'];
}

/**
 * Get model initialization code
 */
function getAlgorithmInit(algorithm: string, taskType: string): string {
    const isClassification = taskType === 'classification';

    const inits: Record<string, string> = {
        'RandomForest': isClassification
            ? 'model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)'
            : 'model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)',
        'XGBoost': isClassification
            ? 'model = xgb.XGBClassifier(n_estimators=100, random_state=42, use_label_encoder=False, eval_metric="logloss")'
            : 'model = xgb.XGBRegressor(n_estimators=100, random_state=42)',
        'LogisticRegression': 'model = LogisticRegression(max_iter=1000, random_state=42)',
        'LinearRegression': 'model = Ridge(alpha=1.0)',
        'DecisionTree': isClassification
            ? 'model = DecisionTreeClassifier(random_state=42)'
            : 'model = DecisionTreeRegressor(random_state=42)',
        'SVM': isClassification
            ? 'model = SVC(kernel="rbf", random_state=42)'
            : 'model = SVR(kernel="rbf")',
        'KNN': isClassification
            ? 'model = KNeighborsClassifier(n_neighbors=5)'
            : 'model = KNeighborsRegressor(n_neighbors=5)',
        'GradientBoosting': isClassification
            ? 'model = GradientBoostingClassifier(n_estimators=100, random_state=42)'
            : 'model = GradientBoostingRegressor(n_estimators=100, random_state=42)',
        'NeuralNetwork': isClassification
            ? 'model = MLPClassifier(hidden_layer_sizes=(100, 50), max_iter=500, random_state=42)'
            : 'model = MLPRegressor(hidden_layer_sizes=(100, 50), max_iter=500, random_state=42)'
    };

    return inits[algorithm] || inits['RandomForest'];
}
