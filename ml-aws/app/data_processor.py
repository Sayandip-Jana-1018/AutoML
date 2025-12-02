"""
Data Processor for Healthcare Datasets
Handles preprocessing, validation, and feature engineering
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, List, Optional
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from io import BytesIO
import warnings
warnings.filterwarnings('ignore')


class DataProcessor:
    """Process and prepare healthcare datasets for ML"""
    
    # Common healthcare column patterns
    HEALTHCARE_COLUMNS = {
        "numeric": [
            "age", "bmi", "weight", "height", "blood_pressure", "bp",
            "heart_rate", "pulse", "temperature", "temp", "glucose",
            "cholesterol", "hemoglobin", "platelets", "oxygen", "spo2"
        ],
        "categorical": [
            "gender", "sex", "smoking", "diabetes", "hypertension",
            "diagnosis", "condition", "treatment", "medication"
        ],
        "target": [
            "outcome", "target", "result", "diagnosis", "disease",
            "condition", "label", "class", "status"
        ]
    }
    
    def __init__(self):
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.imputers: Dict[str, SimpleImputer] = {}
        self.scaler = StandardScaler()
    
    def read_csv(self, content: bytes) -> pd.DataFrame:
        """Read CSV from bytes content"""
        try:
            # Try different encodings
            for encoding in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    df = pd.read_csv(BytesIO(content), encoding=encoding)
                    return df
                except UnicodeDecodeError:
                    continue
            
            raise ValueError("Could not decode file with supported encodings")
            
        except Exception as e:
            raise ValueError(f"Error reading CSV: {str(e)}")
    
    def get_statistics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate comprehensive statistics for a dataset"""
        stats = {
            "shape": {"rows": len(df), "columns": len(df.columns)},
            "columns": {},
            "missing_values": {},
            "data_quality_score": 0
        }
        
        total_missing = 0
        total_cells = len(df) * len(df.columns)
        
        for col in df.columns:
            col_stats = {
                "dtype": str(df[col].dtype),
                "missing": int(df[col].isnull().sum()),
                "missing_pct": float(df[col].isnull().sum() / len(df) * 100),
                "unique": int(df[col].nunique())
            }
            
            total_missing += col_stats["missing"]
            
            if pd.api.types.is_numeric_dtype(df[col]):
                col_stats.update({
                    "mean": float(df[col].mean()) if not df[col].isnull().all() else None,
                    "std": float(df[col].std()) if not df[col].isnull().all() else None,
                    "min": float(df[col].min()) if not df[col].isnull().all() else None,
                    "max": float(df[col].max()) if not df[col].isnull().all() else None,
                    "median": float(df[col].median()) if not df[col].isnull().all() else None
                })
            else:
                # Categorical column
                value_counts = df[col].value_counts().head(5).to_dict()
                col_stats["top_values"] = {str(k): int(v) for k, v in value_counts.items()}
            
            stats["columns"][col] = col_stats
            
            if col_stats["missing"] > 0:
                stats["missing_values"][col] = col_stats["missing"]
        
        # Data quality score (0-100)
        stats["data_quality_score"] = round((1 - total_missing / total_cells) * 100, 2) if total_cells > 0 else 0
        
        # Suggest target column
        stats["suggested_target"] = self._suggest_target(df)
        
        return stats
    
    def _suggest_target(self, df: pd.DataFrame) -> Optional[str]:
        """Suggest likely target column based on naming conventions"""
        for col in df.columns:
            col_lower = col.lower()
            for target_pattern in self.HEALTHCARE_COLUMNS["target"]:
                if target_pattern in col_lower:
                    return col
        return None
    
    def preprocess(
        self, 
        df: pd.DataFrame, 
        target_column: str
    ) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
        """
        Preprocess dataset for training
        
        Args:
            df: Input DataFrame
            target_column: Name of target column
            
        Returns:
            Tuple of (X, y, preprocessor_info)
        """
        df = df.copy()
        preprocessor_info = {
            "label_encoders": {},
            "numeric_columns": [],
            "categorical_columns": [],
            "target_encoder": False,
            "target_classes": [],
            "dropped_columns": []
        }
        
        # Separate features and target
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found")
        
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
            # Skip ID-like columns (high cardinality categorical)
            if X_df[col].dtype == 'object' or X_df[col].dtype.name == 'category':
                if X_df[col].nunique() > len(df) * 0.9 and len(df) > 20:
                    preprocessor_info["dropped_columns"].append(col)
                    continue
                if col.lower() in ['id', 'student_id', 'patient_id', 'record_id', 'index']:
                    preprocessor_info["dropped_columns"].append(col)
                    continue

            if pd.api.types.is_numeric_dtype(X_df[col]):
                # Numeric column
                preprocessor_info["numeric_columns"].append(col)
                
                # Impute missing values with median
                if X_df[col].isnull().any():
                    median_val = X_df[col].median()
                    X_df[col] = X_df[col].fillna(median_val)
                
                processed_columns.append(col)
                
            elif X_df[col].dtype == 'object' or X_df[col].dtype.name == 'category':
                # Categorical column
                preprocessor_info["categorical_columns"].append(col)
                
                # Fill missing with mode
                if X_df[col].isnull().any():
                    mode_val = X_df[col].mode()[0] if len(X_df[col].mode()) > 0 else "UNKNOWN"
                    X_df[col] = X_df[col].fillna(mode_val)
                
                # Label encode
                le = LabelEncoder()
                X_df[col] = le.fit_transform(X_df[col].astype(str))
                preprocessor_info["label_encoders"][col] = le.classes_.tolist()
                
                processed_columns.append(col)
            
            elif pd.api.types.is_bool_dtype(X_df[col]):
                # Boolean column
                X_df[col] = X_df[col].astype(int)
                preprocessor_info["numeric_columns"].append(col)
                processed_columns.append(col)
        
        # Check if we have any features left
        if not processed_columns:
            raise ValueError("No valid features found after preprocessing (all columns were dropped or invalid)")

        # Convert to numpy array
        X = X_df[processed_columns].values.astype(np.float64)
        
        # Handle any remaining NaN values
        X = np.nan_to_num(X, nan=0.0)
        
        return X, y, preprocessor_info
    
    def validate_dataset(self, df: pd.DataFrame, target_column: str) -> Dict[str, Any]:
        """Validate dataset for ML training"""
        issues = []
        warnings_list = []
        
        # Check minimum rows
        if len(df) < 10:
            issues.append("Dataset has fewer than 10 rows, which is too small for training")
        elif len(df) < 50:
            warnings_list.append("Dataset has fewer than 50 rows, results may not be reliable")
        
        # Check target column
        if target_column not in df.columns:
            issues.append(f"Target column '{target_column}' not found")
        else:
            # Check target distribution
            target_counts = df[target_column].value_counts()
            if len(target_counts) < 2:
                issues.append("Target column has only one unique value")
            elif len(target_counts) > 50 and not pd.api.types.is_numeric_dtype(df[target_column]):
                 # Only warn if it's categorical with high cardinality (likely regression if numeric)
                warnings_list.append("Target has many unique values - consider if this is a classification problem")
            
            # Check class imbalance
            if len(target_counts) >= 2:
                min_count = target_counts.min()
                max_count = target_counts.max()
                if max_count / min_count > 10:
                    warnings_list.append(f"Severe class imbalance detected (ratio: {max_count/min_count:.1f}:1)")
        
        # Check for high missing values
        for col in df.columns:
            missing_pct = df[col].isnull().sum() / len(df) * 100
            if missing_pct > 50:
                warnings_list.append(f"Column '{col}' has {missing_pct:.1f}% missing values")
        
        # Check for constant columns
        for col in df.columns:
            if df[col].nunique() == 1:
                warnings_list.append(f"Column '{col}' has only one value and will be ignored")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings_list
        }
    
    def detect_column_types(self, df: pd.DataFrame) -> Dict[str, List[str]]:
        """Detect and categorize column types"""
        column_types = {
            "numeric": [],
            "categorical": [],
            "datetime": [],
            "text": [],
            "binary": [],
            "id": []
        }
        
        for col in df.columns:
            # Check if likely an ID column
            if df[col].nunique() == len(df) or col.lower() in ['id', 'index', 'patient_id', 'record_id']:
                column_types["id"].append(col)
                continue
            
            # Check data type
            if pd.api.types.is_numeric_dtype(df[col]):
                # Check if binary
                if df[col].nunique() == 2:
                    column_types["binary"].append(col)
                else:
                    column_types["numeric"].append(col)
                    
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                column_types["datetime"].append(col)
                
            elif df[col].dtype == 'object':
                # Check average string length
                avg_len = df[col].astype(str).str.len().mean()
                unique_ratio = df[col].nunique() / len(df)
                
                if avg_len > 100 or unique_ratio > 0.5:
                    column_types["text"].append(col)
                else:
                    column_types["categorical"].append(col)
            else:
                column_types["categorical"].append(col)
        
        return column_types