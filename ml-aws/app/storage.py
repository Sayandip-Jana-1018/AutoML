"""
Storage Manager for AutoML Healthcare API
Handles local storage and AWS S3 integration
"""

import os
import json
import pickle
import pandas as pd
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class StorageManager:
    """
    Manages storage for datasets and models
    Supports local filesystem and AWS S3
    """
    
    def __init__(self, storage_type: str = "local", s3_bucket: str = None):
        """
        Initialize storage manager
        
        Args:
            storage_type: 'local' or 's3'
            s3_bucket: S3 bucket name (required if storage_type is 's3')
        """
        self.storage_type = storage_type
        self.s3_bucket = s3_bucket
        
        # Local storage paths
        self.base_path = os.environ.get("STORAGE_PATH", os.path.join(os.path.expanduser("~"), "automl_storage"))
        self.datasets_path = os.path.join(self.base_path, "datasets")
        self.models_path = os.path.join(self.base_path, "models")
        
        # Create directories
        os.makedirs(self.datasets_path, exist_ok=True)
        os.makedirs(self.models_path, exist_ok=True)
        
        # Metadata storage
        self.metadata: Dict[str, Dict] = {
            "datasets": {},
            "models": {}
        }
        self._load_metadata()
        
        # Initialize S3 client if needed
        self.s3_client = None
        if storage_type == "s3" and s3_bucket:
            self._init_s3()
    
    def _init_s3(self):
        """Initialize S3 client"""
        try:
            import boto3
            self.s3_client = boto3.client('s3')
            logger.info(f"S3 client initialized for bucket: {self.s3_bucket}")
        except ImportError:
            logger.warning("boto3 not installed, falling back to local storage")
            self.storage_type = "local"
        except Exception as e:
            logger.error(f"Failed to initialize S3: {e}")
            self.storage_type = "local"
    
    def _load_metadata(self):
        """Load metadata from disk"""
        metadata_path = os.path.join(self.base_path, "metadata.json")
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r') as f:
                    self.metadata = json.load(f)
            except Exception as e:
                logger.error(f"Error loading metadata: {e}")
    
    def _save_metadata(self):
        """Save metadata to disk"""
        metadata_path = os.path.join(self.base_path, "metadata.json")
        try:
            with open(metadata_path, 'w') as f:
                json.dump(self.metadata, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving metadata: {e}")
    
    # ============== Dataset Operations ==============
    
    def save_dataset(self, dataset_id: str, df: pd.DataFrame) -> bool:
        """Save dataset to storage"""
        try:
            if self.storage_type == "s3" and self.s3_client:
                return self._save_dataset_s3(dataset_id, df)
            else:
                return self._save_dataset_local(dataset_id, df)
        except Exception as e:
            logger.error(f"Error saving dataset {dataset_id}: {e}")
            return False
    
    def _save_dataset_local(self, dataset_id: str, df: pd.DataFrame) -> bool:
        """Save dataset to local filesystem"""
        file_path = os.path.join(self.datasets_path, f"{dataset_id}.csv")
        df.to_csv(file_path, index=False)
        
        # Update metadata
        self.metadata["datasets"][dataset_id] = {
            "id": dataset_id,
            "path": file_path,
            "rows": len(df),
            "columns": list(df.columns),
            "created_at": datetime.utcnow().isoformat(),
            "storage": "local"
        }
        self._save_metadata()
        
        return True
    
    def _save_dataset_s3(self, dataset_id: str, df: pd.DataFrame) -> bool:
        """Save dataset to S3"""
        import io
        
        # Convert to CSV buffer
        buffer = io.StringIO()
        df.to_csv(buffer, index=False)
        
        # Upload to S3
        s3_key = f"datasets/{dataset_id}.csv"
        self.s3_client.put_object(
            Bucket=self.s3_bucket,
            Key=s3_key,
            Body=buffer.getvalue()
        )
        
        # Also save locally for faster access
        self._save_dataset_local(dataset_id, df)
        
        # Update metadata
        self.metadata["datasets"][dataset_id]["storage"] = "s3"
        self.metadata["datasets"][dataset_id]["s3_key"] = s3_key
        self._save_metadata()
        
        return True
    
    def load_dataset(self, dataset_id: str) -> Optional[pd.DataFrame]:
        """Load dataset from storage"""
        try:
            # Try local first
            file_path = os.path.join(self.datasets_path, f"{dataset_id}.csv")
            if os.path.exists(file_path):
                return pd.read_csv(file_path)
            
            # Try S3 if available
            if self.storage_type == "s3" and self.s3_client:
                return self._load_dataset_s3(dataset_id)
            
            return None
            
        except Exception as e:
            logger.error(f"Error loading dataset {dataset_id}: {e}")
            return None
    
    def _load_dataset_s3(self, dataset_id: str) -> Optional[pd.DataFrame]:
        """Load dataset from S3"""
        import io
        
        s3_key = f"datasets/{dataset_id}.csv"
        try:
            response = self.s3_client.get_object(
                Bucket=self.s3_bucket,
                Key=s3_key
            )
            return pd.read_csv(io.BytesIO(response['Body'].read()))
        except self.s3_client.exceptions.NoSuchKey:
            return None
    
    def delete_dataset(self, dataset_id: str) -> bool:
        """Delete dataset from storage"""
        try:
            # Delete local file
            file_path = os.path.join(self.datasets_path, f"{dataset_id}.csv")
            if os.path.exists(file_path):
                os.remove(file_path)
            
            # Delete from S3 if applicable
            if self.storage_type == "s3" and self.s3_client:
                try:
                    self.s3_client.delete_object(
                        Bucket=self.s3_bucket,
                        Key=f"datasets/{dataset_id}.csv"
                    )
                except:
                    pass
            
            # Update metadata
            if dataset_id in self.metadata["datasets"]:
                del self.metadata["datasets"][dataset_id]
                self._save_metadata()
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting dataset {dataset_id}: {e}")
            return False
    
    def list_datasets(self) -> List[Dict[str, Any]]:
        """List all datasets"""
        return list(self.metadata["datasets"].values())

    def get_dataset_path(self, dataset_id: str) -> Optional[str]:
        """Get the local file path for a dataset"""
        file_path = os.path.join(self.datasets_path, f"{dataset_id}.csv")
        if os.path.exists(file_path):
            return file_path
        return None
    
    # ============== Model Operations ==============
    
    def save_model(self, model_id: str, model_data: Dict[str, Any]) -> bool:
        """Save trained model to storage"""
        try:
            if self.storage_type == "s3" and self.s3_client:
                return self._save_model_s3(model_id, model_data)
            else:
                return self._save_model_local(model_id, model_data)
        except Exception as e:
            logger.error(f"Error saving model {model_id}: {e}")
            return False
    
    def _save_model_local(self, model_id: str, model_data: Dict[str, Any]) -> bool:
        """Save model to local filesystem"""
        file_path = os.path.join(self.models_path, f"{model_id}.pkl")
        
        with open(file_path, 'wb') as f:
            pickle.dump(model_data, f)
        
        # Update metadata (without the actual model object)
        self.metadata["models"][model_id] = {
            "id": model_id,
            "path": file_path,
            "algorithm": model_data.get("algorithm"),
            "target_column": model_data.get("target_column"),
            "metrics": model_data.get("metrics"),
            "created_at": model_data.get("created_at", datetime.utcnow().isoformat()),
            "storage": "local"
        }
        self._save_metadata()
        
        return True
    
    def _save_model_s3(self, model_id: str, model_data: Dict[str, Any]) -> bool:
        """Save model to S3"""
        import io
        
        # Serialize model
        buffer = io.BytesIO()
        pickle.dump(model_data, buffer)
        buffer.seek(0)
        
        # Upload to S3
        s3_key = f"models/{model_id}.pkl"
        self.s3_client.put_object(
            Bucket=self.s3_bucket,
            Key=s3_key,
            Body=buffer.getvalue()
        )
        
        # Also save locally
        self._save_model_local(model_id, model_data)
        
        # Update metadata
        self.metadata["models"][model_id]["storage"] = "s3"
        self.metadata["models"][model_id]["s3_key"] = s3_key
        self._save_metadata()
        
        return True
    
    def load_model(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Load model from storage"""
        try:
            # Try local first
            file_path = os.path.join(self.models_path, f"{model_id}.pkl")
            if os.path.exists(file_path):
                with open(file_path, 'rb') as f:
                    return pickle.load(f)
            
            # Try S3 if available
            if self.storage_type == "s3" and self.s3_client:
                return self._load_model_s3(model_id)
            
            return None
            
        except Exception as e:
            logger.error(f"Error loading model {model_id}: {e}")
            return None
    
    def _load_model_s3(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Load model from S3"""
        import io
        
        s3_key = f"models/{model_id}.pkl"
        try:
            response = self.s3_client.get_object(
                Bucket=self.s3_bucket,
                Key=s3_key
            )
            return pickle.load(io.BytesIO(response['Body'].read()))
        except self.s3_client.exceptions.NoSuchKey:
            return None
    
    def delete_model(self, model_id: str) -> bool:
        """Delete model from storage"""
        try:
            # Delete local file
            file_path = os.path.join(self.models_path, f"{model_id}.pkl")
            if os.path.exists(file_path):
                os.remove(file_path)
            
            # Delete from S3 if applicable
            if self.storage_type == "s3" and self.s3_client:
                try:
                    self.s3_client.delete_object(
                        Bucket=self.s3_bucket,
                        Key=f"models/{model_id}.pkl"
                    )
                except:
                    pass
            
            # Update metadata
            if model_id in self.metadata["models"]:
                del self.metadata["models"][model_id]
                self._save_metadata()
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting model {model_id}: {e}")
            return False
    
    def list_models(self) -> List[Dict[str, Any]]:
        """List all models"""
        return list(self.metadata["models"].values())