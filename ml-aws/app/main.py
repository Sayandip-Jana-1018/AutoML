"""
AutoML Healthcare API
A REST API for automated machine learning on healthcare datasets
Supports both local training and AWS SageMaker
"""

import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime
import asyncio
import time

from .ml_pipeline import MLPipeline
from .data_processor import DataProcessor
from .storage import StorageManager
from .sagemaker_manager import SageMakerManager

app = FastAPI(
    title="AutoML Healthcare API",
    description="Automated Machine Learning API for Healthcare Datasets (Local + SageMaker)",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
storage = StorageManager()
data_processor = DataProcessor()
ml_pipeline = MLPipeline()
sagemaker_mgr = SageMakerManager()

# In-memory job tracking
jobs: Dict[str, Dict[str, Any]] = {}
trained_models: Dict[str, Any] = {}

# Load persisted models on startup
def load_persisted_models():
    """Load models from disk on startup"""
    models_list = storage.list_models()
    for model_meta in models_list:
        model_id = model_meta.get("id")
        if model_id:
            model_data = storage.load_model(model_id)
            if model_data:
                trained_models[model_id] = model_data
                print(f"Loaded model: {model_id}")

load_persisted_models()


# ============== Pydantic Models ==============

class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    algorithm: Optional[str] = "auto"
    test_size: Optional[float] = 0.2
    use_sagemaker: Optional[bool] = False  # New: option to use SageMaker

class PredictRequest(BaseModel):
    model_id: str
    data: Dict[str, Any]

class BatchPredictRequest(BaseModel):
    model_id: str
    data: List[Dict[str, Any]]


# ============== Helper Functions ==============

def create_job(job_type: str, use_sagemaker: bool = False) -> str:
    """Create a new job and return job_id"""
    job_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    jobs[job_id] = {
        "job_id": job_id,
        "type": job_type,
        "status": "pending",
        "progress": 0,
        "result": None,
        "error": None,
        "use_sagemaker": use_sagemaker,
        "sagemaker_job_name": None,
        "created_at": now,
        "updated_at": now
    }
    return job_id

def update_job(job_id: str, **kwargs):
    """Update job status"""
    if job_id in jobs:
        jobs[job_id].update(kwargs)
        jobs[job_id]["updated_at"] = datetime.utcnow().isoformat()


# ============== Background Tasks ==============

async def train_model_local(job_id: str, dataset_id: str, target_column: str,
                            algorithm: str, test_size: float):
    """Background task for LOCAL model training"""
    try:
        # Add delay to ensure file is fully ready
        await asyncio.sleep(2)
        update_job(job_id, status="running", progress=10)
        
        df = storage.load_dataset(dataset_id)
        if df is None:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        update_job(job_id, progress=20)
        
        X, y, preprocessor_info = data_processor.preprocess(df, target_column)
        update_job(job_id, progress=40)
        
        model_id = str(uuid.uuid4())
        results = ml_pipeline.train(X, y, algorithm=algorithm, test_size=test_size)
        update_job(job_id, progress=80)
        
        model_data = {
            "model_id": model_id,
            "model": results["model"],
            "preprocessor_info": preprocessor_info,
            "feature_columns": [col for col in df.columns if col != target_column],
            "target_column": target_column,
            "metrics": results["metrics"],
            "algorithm": results["algorithm_used"],
            "training_mode": "local",
            "created_at": datetime.utcnow().isoformat()
        }
        trained_models[model_id] = model_data
        storage.save_model(model_id, model_data)
        
        update_job(job_id, status="completed", progress=100, result={
            "model_id": model_id,
            "algorithm": results["algorithm_used"],
            "metrics": results["metrics"],
            "feature_importance": results.get("feature_importance", {}),
            "training_mode": "local"
        })
        
    except Exception as e:
        update_job(job_id, status="failed", error=str(e))


async def train_model_sagemaker(job_id: str, dataset_id: str, target_column: str,
                                 algorithm: str, test_size: float):
    """Background task for SAGEMAKER model training"""
    try:
        # Add delay to ensure file is fully ready
        await asyncio.sleep(2)
        update_job(job_id, status="running", progress=5)
        
        # Check SageMaker configuration
        if not sagemaker_mgr.is_configured():
            raise ValueError("SageMaker not configured. Set S3_BUCKET and SAGEMAKER_ROLE environment variables.")
        
        # Get dataset path
        df = storage.load_dataset(dataset_id)
        if df is None:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        update_job(job_id, progress=10)
        
        # Upload dataset to S3
        local_path = storage.get_dataset_path(dataset_id)
        s3_uri = sagemaker_mgr.upload_dataset_to_s3(dataset_id, local_path)
        update_job(job_id, progress=20)
        
        # Upload training code to S3
        sagemaker_mgr.upload_source_code()
        update_job(job_id, progress=25)
        
        # Start SageMaker training job
        sagemaker_job_name = f"automl-{job_id[:8]}-{int(datetime.utcnow().timestamp())}"
        sagemaker_mgr.start_training_job(
            job_name=sagemaker_job_name,
            dataset_s3_uri=s3_uri,
            target_column=target_column,
            algorithm=algorithm,
            test_size=test_size
        )
        
        update_job(job_id, progress=30, sagemaker_job_name=sagemaker_job_name)
        
        # Poll for completion
        while True:
            await asyncio.sleep(30)  # Check every 30 seconds
            
            status = sagemaker_mgr.get_training_job_status(sagemaker_job_name)
            
            if status['status'] == 'completed':
                update_job(job_id, progress=80)
                
                # Download model artifacts
                model_id = str(uuid.uuid4())
                model_dir = os.path.join(storage.models_path, model_id)
                os.makedirs(model_dir, exist_ok=True)
                
                model_path = sagemaker_mgr.download_model(
                    status['model_artifacts'],
                    model_dir
                )
                
                # Load model
                model_data = sagemaker_mgr.load_model(model_path)
                model_data['model_id'] = model_id
                model_data['training_mode'] = 'sagemaker'
                model_data['sagemaker_job_name'] = sagemaker_job_name
                model_data['created_at'] = datetime.utcnow().isoformat()
                
                trained_models[model_id] = model_data
                storage.save_model(model_id, model_data)
                
                update_job(job_id, status="completed", progress=100, result={
                    "model_id": model_id,
                    "algorithm": model_data.get("algorithm", "unknown"),
                    "metrics": model_data.get("metrics", {}),
                    "feature_importance": model_data.get("feature_importance", {}),
                    "training_mode": "sagemaker",
                    "sagemaker_job_name": sagemaker_job_name
                })
                break
                
            elif status['status'] == 'failed':
                raise ValueError(f"SageMaker job failed: {status.get('failure_reason', 'Unknown error')}")
            
            elif status['status'] in ['inprogress', 'training']:
                update_job(job_id, progress=50)
                
    except Exception as e:
        update_job(job_id, status="failed", error=str(e))


# ============== API Endpoints ==============

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AutoML Healthcare API",
        "version": "2.0.0",
        "sagemaker_enabled": sagemaker_mgr.is_configured()
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "datasets_count": len(storage.list_datasets()),
        "models_count": len(trained_models),
        "active_jobs": len([j for j in jobs.values() if j["status"] == "running"]),
        "sagemaker_configured": sagemaker_mgr.is_configured(),
        "s3_bucket": os.environ.get('S3_BUCKET', 'not set')
    }


@app.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """Upload a CSV dataset for training"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        dataset_id = str(uuid.uuid4())
        
        content = await file.read()
        df = data_processor.read_csv(content)
        
        if df.empty:
            raise HTTPException(status_code=400, detail="Dataset is empty")
        
        storage.save_dataset(dataset_id, df)
        stats = data_processor.get_statistics(df)
        
        # Optionally upload to S3 if configured
        s3_uploaded = False
        if sagemaker_mgr.is_configured():
            try:
                local_path = storage.get_dataset_path(dataset_id)
                sagemaker_mgr.upload_dataset_to_s3(dataset_id, local_path)
                s3_uploaded = True
            except Exception as e:
                print(f"S3 upload failed (non-critical): {e}")
        
        return {
            "dataset_id": dataset_id,
            "filename": file.filename,
            "rows": len(df),
            "columns": list(df.columns),
            "statistics": stats,
            "s3_uploaded": s3_uploaded,
            "message": "Dataset uploaded successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.get("/datasets")
async def list_datasets():
    """List all uploaded datasets"""
    return {"datasets": storage.list_datasets()}


@app.get("/datasets/{dataset_id}")
async def get_dataset_info(dataset_id: str):
    """Get detailed information about a dataset"""
    df = storage.load_dataset(dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return {
        "dataset_id": dataset_id,
        "rows": len(df),
        "columns": list(df.columns),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "statistics": data_processor.get_statistics(df),
        "sample": df.head(5).to_dict(orient="records")
    }


@app.post("/train")
async def train_model(request: TrainRequest, background_tasks: BackgroundTasks):
    """
    Start model training job
    
    Set use_sagemaker=true to train on AWS SageMaker
    """
    df = storage.load_dataset(request.dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if request.target_column not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Target column '{request.target_column}' not found. Available: {list(df.columns)}"
        )
    
    # Validate dataset
    validation = data_processor.validate_dataset(df, request.target_column)
    if not validation["valid"]:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset validation failed: {'; '.join(validation['issues'])}"
        )
    
    if validation["warnings"]:
        print(f"Training warnings: {validation['warnings']}")
    
    # Check if SageMaker is requested but not configured
    if request.use_sagemaker and not sagemaker_mgr.is_configured():
        raise HTTPException(
            status_code=400,
            detail="SageMaker training requested but not configured. Set S3_BUCKET and SAGEMAKER_ROLE."
        )
    
    job_id = create_job("training", use_sagemaker=request.use_sagemaker)
    
    if request.use_sagemaker:
        background_tasks.add_task(
            train_model_sagemaker,
            job_id,
            request.dataset_id,
            request.target_column,
            request.algorithm,
            request.test_size
        )
        training_mode = "sagemaker"
    else:
        background_tasks.add_task(
            train_model_local,
            job_id,
            request.dataset_id,
            request.target_column,
            request.algorithm,
            request.test_size
        )
        training_mode = "local"
    
    return {
        "job_id": job_id,
        "status": "pending",
        "training_mode": training_mode,
        "message": f"Training job started ({training_mode})"
    }


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get status of a training job"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[job_id]
    
    # If SageMaker job, fetch latest status
    if job.get("use_sagemaker") and job.get("sagemaker_job_name") and job["status"] == "running":
        try:
            sm_status = sagemaker_mgr.get_training_job_status(job["sagemaker_job_name"])
            job["sagemaker_status"] = sm_status
        except:
            pass
    
    return job


@app.get("/models")
async def list_models():
    """List all trained models"""
    return {
        "models": [
            {
                "model_id": m["model_id"],
                "algorithm": m.get("algorithm", "unknown"),
                "target_column": m.get("target_column", "unknown"),
                "metrics": m.get("metrics", {}),
                "training_mode": m.get("training_mode", "local"),
                "created_at": m.get("created_at", "unknown")
            }
            for m in trained_models.values()
        ]
    }


@app.get("/models/{model_id}")
async def get_model_info(model_id: str):
    """Get detailed information about a trained model"""
    if model_id not in trained_models:
        raise HTTPException(status_code=404, detail="Model not found")
    
    model_data = trained_models[model_id]
    return {
        "model_id": model_data["model_id"],
        "algorithm": model_data.get("algorithm", "unknown"),
        "target_column": model_data.get("target_column", "unknown"),
        "feature_columns": model_data.get("feature_columns", []),
        "metrics": model_data.get("metrics", {}),
        "training_mode": model_data.get("training_mode", "local"),
        "created_at": model_data.get("created_at", "unknown")
    }


@app.post("/predict")
async def predict(request: PredictRequest):
    """Make a single prediction"""
    if request.model_id not in trained_models:
        raise HTTPException(status_code=404, detail="Model not found")
    
    try:
        model_data = trained_models[request.model_id]
        prediction, probability = ml_pipeline.predict(
            model_data["model"],
            model_data.get("preprocessor_info", {}),
            request.data,
            model_data.get("feature_columns", [])
        )
        
        return {
            "prediction": int(prediction) if hasattr(prediction, 'item') else prediction,
            "probability": float(probability) if probability else None,
            "model_id": request.model_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@app.post("/predict/batch")
async def batch_predict(request: BatchPredictRequest):
    """Make batch predictions"""
    if request.model_id not in trained_models:
        raise HTTPException(status_code=404, detail="Model not found")
    
    try:
        model_data = trained_models[request.model_id]
        results = []
        
        for record in request.data:
            prediction, probability = ml_pipeline.predict(
                model_data["model"],
                model_data.get("preprocessor_info", {}),
                record,
                model_data.get("feature_columns", [])
            )
            results.append({
                "prediction": int(prediction) if hasattr(prediction, 'item') else prediction,
                "probability": float(probability) if probability else None
            })
        
        return {
            "predictions": results,
            "count": len(results),
            "model_id": request.model_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction error: {str(e)}")


@app.delete("/models/{model_id}")
async def delete_model(model_id: str):
    """Delete a trained model"""
    if model_id not in trained_models:
        raise HTTPException(status_code=404, detail="Model not found")
    
    del trained_models[model_id]
    storage.delete_model(model_id)
    
    return {"message": f"Model {model_id} deleted successfully"}


@app.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str):
    """Delete a dataset"""
    if not storage.delete_dataset(dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return {"message": f"Dataset {dataset_id} deleted successfully"}


# ============== SageMaker Specific Endpoints ==============

@app.get("/sagemaker/status")
async def sagemaker_status():
    """Check SageMaker configuration status"""
    return {
        "configured": sagemaker_mgr.is_configured(),
        "s3_bucket": os.environ.get('S3_BUCKET', 'not set'),
        "role_arn": os.environ.get('SAGEMAKER_ROLE', 'not set')[:50] + "..." if os.environ.get('SAGEMAKER_ROLE') else 'not set',
        "region": os.environ.get('AWS_REGION', 'us-east-1')
    }


@app.get("/sagemaker/jobs")
async def list_sagemaker_jobs():
    """List recent SageMaker training jobs"""
    if not sagemaker_mgr.is_configured():
        raise HTTPException(status_code=400, detail="SageMaker not configured")
    
    jobs_list = sagemaker_mgr.list_training_jobs()
    return {"jobs": jobs_list}