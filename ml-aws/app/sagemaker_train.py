"""
SageMaker Training Script
This script runs inside the SageMaker container
"""

import os
import json
import pickle
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
import warnings
warnings.filterwarnings('ignore')


def train(args):
    """Main training function for SageMaker"""
    
    # SageMaker paths
    input_path = os.environ.get('SM_CHANNEL_TRAINING', '/opt/ml/input/data/training')
    output_path = os.environ.get('SM_MODEL_DIR', '/opt/ml/model')
    
    # Read training parameters
    target_column = args.get('target_column', 'target')
    algorithm = args.get('algorithm', 'auto')
    test_size = float(args.get('test_size', 0.2))
    
    print(f"Input path: {input_path}")
    print(f"Output path: {output_path}")
    print(f"Target column: {target_column}")
    print(f"Algorithm: {algorithm}")
    
    # Load dataset
    data_file = os.path.join(input_path, 'data.csv')
    if not os.path.exists(data_file):
        # Try to find any CSV file
        csv_files = [f for f in os.listdir(input_path) if f.endswith('.csv')]
        if csv_files:
            data_file = os.path.join(input_path, csv_files[0])
        else:
            raise ValueError(f"No CSV file found in {input_path}")
    
    print(f"Loading data from: {data_file}")
    df = pd.read_csv(data_file)
    print(f"Dataset shape: {df.shape}")
    
    # Preprocess
    X, y, preprocessor_info = preprocess_data(df, target_column)
    print(f"Features shape: {X.shape}")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42,
        stratify=y if can_stratify(y) else None
    )
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train model
    if algorithm == "auto":
        model, algorithm_used = auto_select_model(X_train_scaled, y_train, X_test_scaled, y_test)
    else:
        model, algorithm_used = train_specific_model(algorithm, X_train_scaled, y_train)
    
    # Evaluate
    metrics = evaluate_model(model, X_test_scaled, y_test)
    print(f"Metrics: {json.dumps(metrics, indent=2)}")
    
    # Get feature importance
    feature_importance = get_feature_importance(model, X.shape[1])
    
    # Save model artifacts
    model_data = {
        "model": model,
        "scaler": scaler,
        "preprocessor_info": preprocessor_info,
        "feature_columns": [col for col in df.columns if col != target_column],
        "target_column": target_column,
        "algorithm": algorithm_used,
        "metrics": metrics,
        "feature_importance": feature_importance
    }
    
    model_path = os.path.join(output_path, 'model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model_data, f)
    
    print(f"Model saved to: {model_path}")
    
    # Save metrics separately for easy access
    metrics_path = os.path.join(output_path, 'metrics.json')
    with open(metrics_path, 'w') as f:
        json.dump({
            "algorithm": algorithm_used,
            "metrics": metrics,
            "feature_importance": feature_importance
        }, f, indent=2)
    
    print("Training complete!")
    return metrics


def preprocess_data(df, target_column):
    """Preprocess dataset for training"""
    preprocessor_info = {
        "label_encoders": {},
        "numeric_columns": [],
        "categorical_columns": [],
        "target_encoder": False,
        "target_classes": []
    }
    
    # Separate features and target
    y = df[target_column].copy()
    X_df = df.drop(columns=[target_column])
    
    # Encode target if categorical
    if not pd.api.types.is_numeric_dtype(y):
        le = LabelEncoder()
        y = le.fit_transform(y.astype(str))
        preprocessor_info["target_encoder"] = True
        preprocessor_info["target_classes"] = le.classes_.tolist()
    else:
        y = y.values
    
    # Process each column
    processed_columns = []
    
    for col in X_df.columns:
        if pd.api.types.is_numeric_dtype(X_df[col]):
            preprocessor_info["numeric_columns"].append(col)
            if X_df[col].isnull().any():
                X_df[col] = X_df[col].fillna(X_df[col].median())
            processed_columns.append(col)
            
        elif X_df[col].dtype == 'object' or X_df[col].dtype.name == 'category':
            preprocessor_info["categorical_columns"].append(col)
            if X_df[col].isnull().any():
                mode_val = X_df[col].mode()[0] if len(X_df[col].mode()) > 0 else "UNKNOWN"
                X_df[col] = X_df[col].fillna(mode_val)
            
            le = LabelEncoder()
            X_df[col] = le.fit_transform(X_df[col].astype(str))
            preprocessor_info["label_encoders"][col] = le.classes_.tolist()
            processed_columns.append(col)
            
        elif pd.api.types.is_bool_dtype(X_df[col]):
            X_df[col] = X_df[col].astype(int)
            preprocessor_info["numeric_columns"].append(col)
            processed_columns.append(col)
    
    X = X_df[processed_columns].values.astype(np.float64)
    X = np.nan_to_num(X, nan=0.0)
    
    return X, y, preprocessor_info


def can_stratify(y):
    """Check if stratification is possible"""
    unique, counts = np.unique(y, return_counts=True)
    return all(c >= 2 for c in counts)


def auto_select_model(X_train, y_train, X_test, y_test):
    """Automatically select the best model"""
    algorithms = {
        "logistic_regression": LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced"),
        "random_forest": RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, class_weight="balanced", n_jobs=-1),
        "gradient_boosting": GradientBoostingClassifier(n_estimators=100, max_depth=5, random_state=42, learning_rate=0.1),
        "svm": SVC(kernel="rbf", probability=True, random_state=42, class_weight="balanced")
    }
    
    best_model = None
    best_algorithm = None
    best_score = -1
    
    for name, model in algorithms.items():
        try:
            cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='f1_weighted')
            mean_cv_score = cv_scores.mean()
            
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            test_score = f1_score(y_test, y_pred, average='weighted')
            
            combined_score = 0.6 * mean_cv_score + 0.4 * test_score
            
            print(f"{name}: CV={mean_cv_score:.4f}, Test={test_score:.4f}, Combined={combined_score:.4f}")
            
            if combined_score > best_score:
                best_score = combined_score
                best_model = model
                best_algorithm = name
                
        except Exception as e:
            print(f"Algorithm {name} failed: {str(e)}")
            continue
    
    if best_model is None:
        raise ValueError("All algorithms failed to train")
    
    print(f"Best algorithm: {best_algorithm}")
    return best_model, best_algorithm


def train_specific_model(algorithm, X_train, y_train):
    """Train a specific model"""
    algorithms = {
        "logistic_regression": LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced"),
        "random_forest": RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, class_weight="balanced", n_jobs=-1),
        "gradient_boosting": GradientBoostingClassifier(n_estimators=100, max_depth=5, random_state=42, learning_rate=0.1),
        "svm": SVC(kernel="rbf", probability=True, random_state=42, class_weight="balanced")
    }
    
    if algorithm not in algorithms:
        raise ValueError(f"Unknown algorithm: {algorithm}")
    
    model = algorithms[algorithm]
    model.fit(X_train, y_train)
    return model, algorithm


def evaluate_model(model, X_test, y_test):
    """Evaluate model and return metrics"""
    y_pred = model.predict(X_test)
    
    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
        "f1_score": float(f1_score(y_test, y_pred, average='weighted', zero_division=0)),
    }
    
    if len(np.unique(y_test)) == 2:
        try:
            if hasattr(model, 'predict_proba'):
                y_prob = model.predict_proba(X_test)[:, 1]
                metrics["roc_auc"] = float(roc_auc_score(y_test, y_prob))
        except:
            pass
    
    cm = confusion_matrix(y_test, y_pred)
    metrics["confusion_matrix"] = cm.tolist()
    
    return metrics


def get_feature_importance(model, n_features):
    """Extract feature importance from model"""
    importance = {}
    
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        for i, imp in enumerate(importances):
            importance[f"feature_{i}"] = float(imp)
            
    elif hasattr(model, 'coef_'):
        coefs = np.abs(model.coef_).flatten()
        if len(coefs) == n_features:
            for i, coef in enumerate(coefs):
                importance[f"feature_{i}"] = float(coef)
        else:
            coefs = np.abs(model.coef_).mean(axis=0)
            for i, coef in enumerate(coefs):
                importance[f"feature_{i}"] = float(coef)
    
    return dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))


# Entry point for SageMaker
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('--target_column', type=str, default='target')
    parser.add_argument('--algorithm', type=str, default='auto')
    parser.add_argument('--test_size', type=float, default=0.2)
    
    args, _ = parser.parse_known_args()
    
    train(vars(args))
    