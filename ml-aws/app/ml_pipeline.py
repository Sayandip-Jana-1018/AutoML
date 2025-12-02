"""
ML Pipeline for AutoML Healthcare API
Supports multiple algorithms with automatic selection
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional, List
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)
from sklearn.preprocessing import StandardScaler, LabelEncoder
import warnings
warnings.filterwarnings('ignore')


class MLPipeline:
    """Machine Learning Pipeline with AutoML capabilities"""
    
    ALGORITHMS = {
        "logistic_regression": LogisticRegression,
        "random_forest": RandomForestClassifier,
        "gradient_boosting": GradientBoostingClassifier,
        "svm": SVC
    }
    
    ALGORITHM_PARAMS = {
        "logistic_regression": {
            "max_iter": 1000,
            "random_state": 42,
            "class_weight": "balanced"
        },
        "random_forest": {
            "n_estimators": 100,
            "max_depth": 10,
            "random_state": 42,
            "class_weight": "balanced",
            "n_jobs": -1
        },
        "gradient_boosting": {
            "n_estimators": 100,
            "max_depth": 5,
            "random_state": 42,
            "learning_rate": 0.1
        },
        "svm": {
            "kernel": "rbf",
            "probability": True,
            "random_state": 42,
            "class_weight": "balanced"
        }
    }
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
    
    def train(
        self, 
        X: np.ndarray, 
        y: np.ndarray, 
        algorithm: str = "auto",
        test_size: float = 0.2
    ) -> Dict[str, Any]:
        """
        Train a model with the specified or best algorithm
        """
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y if self._can_stratify(y) else None
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        if algorithm == "auto":
            best_model, best_algorithm, best_score = self._auto_select(
                X_train_scaled, y_train, X_test_scaled, y_test
            )
        else:
            if algorithm not in self.ALGORITHMS:
                raise ValueError(f"Unknown algorithm: {algorithm}. Available: {list(self.ALGORITHMS.keys())}")
            
            best_algorithm = algorithm
            model_class = self.ALGORITHMS[algorithm]
            params = self.ALGORITHM_PARAMS[algorithm]
            best_model = model_class(**params)
            best_model.fit(X_train_scaled, y_train)
        
        # Evaluate model
        metrics = self._evaluate(best_model, X_test_scaled, y_test)
        
        # Get feature importance
        feature_importance = self._get_feature_importance(best_model, X.shape[1])
        
        return {
            "model": {
                "classifier": best_model,
                "scaler": self.scaler,
            },
            "algorithm_used": best_algorithm,
            "metrics": metrics,
            "feature_importance": feature_importance
        }
    
    def _can_stratify(self, y: np.ndarray) -> bool:
        """Check if stratification is possible"""
        unique, counts = np.unique(y, return_counts=True)
        return all(c >= 2 for c in counts)
    
    def _auto_select(
        self, 
        X_train: np.ndarray, 
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray
    ) -> Tuple[Any, str, float]:
        """Automatically select the best algorithm"""
        best_model = None
        best_algorithm = None
        best_score = -1
        
        for name, model_class in self.ALGORITHMS.items():
            try:
                params = self.ALGORITHM_PARAMS[name]
                model = model_class(**params)
                
                # Cross-validation on training data
                cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='f1_weighted')
                mean_cv_score = cv_scores.mean()
                
                # Fit and evaluate on test set
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                test_score = f1_score(y_test, y_pred, average='weighted')
                
                # Combined score
                combined_score = 0.6 * mean_cv_score + 0.4 * test_score
                
                if combined_score > best_score:
                    best_score = combined_score
                    best_model = model
                    best_algorithm = name
                    
            except Exception as e:
                print(f"Algorithm {name} failed: {str(e)}")
                continue
        
        if best_model is None:
            raise ValueError("All algorithms failed to train. Please check your target column and data quality.")
        
        return best_model, best_algorithm, best_score
    
    def _evaluate(self, model: Any, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, Any]:
        """Evaluate model and return metrics"""
        y_pred = model.predict(X_test)
        
        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred, average='weighted', zero_division=0)),
        }
        
        # ROC AUC for binary classification
        if len(np.unique(y_test)) == 2:
            try:
                if hasattr(model, 'predict_proba'):
                    y_prob = model.predict_proba(X_test)[:, 1]
                    metrics["roc_auc"] = float(roc_auc_score(y_test, y_prob))
            except:
                pass
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        metrics["confusion_matrix"] = cm.tolist()
        
        return metrics
    
    def _get_feature_importance(self, model: Any, n_features: int) -> Dict[str, float]:
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
        
        importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
        
        return importance
    
    def predict(
        self, 
        model_data: Dict[str, Any],
        preprocessor_info: Dict[str, Any],
        data: Dict[str, Any],
        feature_columns: List[str]
    ) -> Tuple[Any, Optional[float]]:
        """Make a prediction for a single record"""
        classifier = model_data["classifier"]
        scaler = model_data["scaler"]
        
        # Prepare input
        input_values = []
        for col in feature_columns:
            if col in data:
                value = data[col]
                if col in preprocessor_info.get("label_encoders", {}):
                    le_classes = preprocessor_info["label_encoders"][col]
                    if value in le_classes:
                        value = le_classes.index(value)
                    else:
                        value = 0
                input_values.append(float(value) if value is not None else 0.0)
            else:
                input_values.append(0.0)
        
        # Scale and predict
        X = np.array(input_values).reshape(1, -1)
        X_scaled = scaler.transform(X)
        
        prediction = int(classifier.predict(X_scaled)[0])
        
        # Get probability if available
        probability = None
        if hasattr(classifier, 'predict_proba'):
            probs = classifier.predict_proba(X_scaled)[0]
            probability = float(max(probs))
        
        # Decode prediction if needed
        if "target_encoder" in preprocessor_info and preprocessor_info["target_encoder"]:
            target_classes = preprocessor_info["target_classes"]
            if isinstance(prediction, (int, np.integer)) and prediction < len(target_classes):
                prediction = target_classes[int(prediction)]
        
        return prediction, probability