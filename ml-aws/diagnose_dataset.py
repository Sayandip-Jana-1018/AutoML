"""
Diagnostic script to test dataset processing and identify training failures
"""
import sys
sys.path.insert(0, '/home/ubuntu/ml-aws')

from app.data_processor import DataProcessor
from app.ml_pipeline import MLPipeline
from app.storage import StorageManager
import traceback

# Initialize components
storage = StorageManager()
data_processor = DataProcessor()
ml_pipeline = MLPipeline()

# Test with the failing dataset
dataset_id = "14603aaf-4d7d-4178-93c6-c3593983f689"
target_column = "GPA"

print(f"Testing dataset: {dataset_id}")
print(f"Target column: {target_column}")
print("=" * 60)

try:
    # Load dataset
    print("\n1. Loading dataset...")
    df = storage.load_dataset(dataset_id)
    if df is None:
        print("ERROR: Dataset not found!")
        sys.exit(1)
    
    print(f"   ✓ Dataset loaded: {len(df)} rows, {len(df.columns)} columns")
    print(f"   Columns: {list(df.columns)}")
    print(f"\n   First few rows:")
    print(df.head())
    
    # Validate dataset
    print("\n2. Validating dataset...")
    validation = data_processor.validate_dataset(df, target_column)
    print(f"   Valid: {validation['valid']}")
    if validation['issues']:
        print(f"   Issues: {validation['issues']}")
    if validation['warnings']:
        print(f"   Warnings: {validation['warnings']}")
    
    if not validation['valid']:
        print("\nERROR: Dataset validation failed!")
        sys.exit(1)
    
    # Preprocess
    print("\n3. Preprocessing data...")
    X, y, preprocessor_info = data_processor.preprocess(df, target_column)
    print(f"   ✓ Preprocessed: X shape={X.shape}, y shape={y.shape}")
    print(f"   Dropped columns: {preprocessor_info.get('dropped_columns', [])}")
    print(f"   Numeric columns: {preprocessor_info.get('numeric_columns', [])}")
    print(f"   Categorical columns: {preprocessor_info.get('categorical_columns', [])}")
    
    # Check target distribution
    import numpy as np
    unique_targets = np.unique(y)
    print(f"\n   Target distribution:")
    for val in unique_targets:
        count = np.sum(y == val)
        print(f"     {val}: {count} samples")
    
    # Train model
    print("\n4. Training model...")
    results = ml_pipeline.train(X, y, algorithm="auto", test_size=0.2)
    print(f"   ✓ Training complete!")
    print(f"   Algorithm used: {results['algorithm_used']}")
    print(f"   Metrics: {results['metrics']}")
    
    print("\n" + "=" * 60)
    print("SUCCESS: All steps completed!")
    
except Exception as e:
    print(f"\nERROR: {str(e)}")
    print("\nFull traceback:")
    traceback.print_exc()
    sys.exit(1)
