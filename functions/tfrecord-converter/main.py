"""
TFRecord Converter - Cloud Function Gen2
Converts image ZIP datasets to TFRecord shards for fast training.

Configuration:
- Memory: 8GB
- Timeout: 3600s (1 hour)
- Trigger: HTTP (called by MLForge backend after upload)

Deployment:
gcloud functions deploy convert-to-tfrecord \
    --gen2 \
    --runtime python310 \
    --region us-central1 \
    --memory 8Gi \
    --timeout 3600s \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point convert_to_tfrecord
"""

import functions_framework
from flask import jsonify
from google.cloud import storage, firestore
import tensorflow as tf
import tempfile
import zipfile
import os
import json
import hashlib
import random
import shutil
from PIL import Image
import traceback
import resource

# Increase file descriptor limit for large ZIPs
try:
    resource.setrlimit(resource.RLIMIT_NOFILE, (100000, 100000))
except:
    pass

# Initialize clients
storage_client = storage.Client()
db = firestore.Client()


def _bytes_feature(value):
    """Returns a bytes_list from bytes."""
    return tf.train.Feature(bytes_list=tf.train.BytesList(value=[value]))


def _int64_feature(value):
    """Returns an int64_list from int."""
    return tf.train.Feature(int64_list=tf.train.Int64List(value=[value]))


def find_image_folder(base_path, max_depth=4):
    """Find the folder containing train/class structure (handles nested ZIPs)"""
    
    def get_subdirs(path):
        if not os.path.exists(path):
            return []
        return [d for d in os.listdir(path) 
                if os.path.isdir(os.path.join(path, d)) 
                and d not in ['__pycache__', '.git', '__MACOSX', '.DS_Store']]
    
    def has_images(folder):
        try:
            files = os.listdir(folder)[:20]
            return any(f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp')) for f in files)
        except:
            return False
    
    def search(path, depth=0):
        if depth > max_depth:
            return None
        
        subdirs = get_subdirs(path)
        subdir_lower = {d.lower(): d for d in subdirs}
        
        # Check for train folder
        for name in ['train', 'training']:
            if name in subdir_lower:
                train_dir = os.path.join(path, subdir_lower[name])
                train_subdirs = get_subdirs(train_dir)
                if train_subdirs and has_images(os.path.join(train_dir, train_subdirs[0])):
                    test_dir = None
                    for t in ['test', 'val', 'validation']:
                        if t in subdir_lower:
                            test_dir = os.path.join(path, subdir_lower[t])
                            break
                    return {'train': train_dir, 'test': test_dir, 'base': path}
        
        # Check for direct class folders
        if len(subdirs) > 1:
            first_class = os.path.join(path, subdirs[0])
            if has_images(first_class):
                return {'train': path, 'test': None, 'base': path}
        
        # Recurse into subdirectories
        for subdir in subdirs:
            result = search(os.path.join(path, subdir), depth + 1)
            if result:
                return result
        
        return None
    
    return search(base_path)


def collect_images(class_dir, class_idx):
    """Collect all image paths from a class directory"""
    images = []
    extensions = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp')
    
    for img_file in os.listdir(class_dir):
        if img_file.lower().endswith(extensions):
            img_path = os.path.join(class_dir, img_file)
            images.append((img_path, class_idx))
    
    return images


def get_image_dimensions(img_path):
    """Get original image dimensions"""
    try:
        with Image.open(img_path) as img:
            return img.size
    except:
        return (0, 0)


def create_example(img_path, label):
    """Create a TFRecord example from an image"""
    with open(img_path, 'rb') as f:
        img_bytes = f.read()
    
    example = tf.train.Example(features=tf.train.Features(feature={
        'image': _bytes_feature(img_bytes),
        'label': _int64_feature(label),
        'filename': _bytes_feature(os.path.basename(img_path).encode()),
    }))
    
    return example.SerializeToString()


def write_shards(images, output_prefix, shard_size_bytes):
    """Write images to TFRecord shards"""
    shard_paths = []
    checksums = {}
    
    shard_idx = 0
    current_size = 0
    writer = None
    current_shard_path = None
    
    for img_path, label in images:
        if writer is None or current_size >= shard_size_bytes:
            if writer:
                writer.close()
                with open(current_shard_path, 'rb') as f:
                    checksums[os.path.basename(current_shard_path)] = hashlib.md5(f.read()).hexdigest()
            
            current_shard_path = f"{output_prefix}-{shard_idx:05d}.tfrecord"
            shard_paths.append(os.path.basename(current_shard_path))
            writer = tf.io.TFRecordWriter(current_shard_path)
            shard_idx += 1
            current_size = 0
            print(f"  Writing shard: {os.path.basename(current_shard_path)}")
        
        try:
            serialized = create_example(img_path, label)
            writer.write(serialized)
            current_size += len(serialized)
        except Exception as e:
            print(f"  Warning: Failed to process {img_path}: {e}")
    
    if writer:
        writer.close()
        with open(current_shard_path, 'rb') as f:
            checksums[os.path.basename(current_shard_path)] = hashlib.md5(f.read()).hexdigest()
    
    return shard_paths, checksums


@functions_framework.http
def convert_to_tfrecord(request):
    """
    HTTP Cloud Function to convert image ZIP to TFRecord shards.
    
    Request body:
    {
        "projectId": "...",
        "datasetPath": "projects/{id}/datasets/{hash}/images.zip",
        "bucket": "automl-dc494.firebasestorage.app",
        "shardSizeMB": 50,
        "valSplit": 0.2
    }
    """
    try:
        data = request.get_json()
        project_id = data['projectId']
        zip_gcs_path = data['datasetPath']
        bucket_name = data.get('bucket', 'automl-dc494.firebasestorage.app')
        shard_size_mb = data.get('shardSizeMB', 50)
        val_split = data.get('valSplit', 0.2)
        
        print(f"Converting dataset for project: {project_id}")
        print(f"Source: gs://{bucket_name}/{zip_gcs_path}")
        
        # Update Firestore status to 'converting'
        project_ref = db.collection('projects').document(project_id)
        project_ref.update({
            'dataset.conversionStatus': 'converting',
            'dataset.conversionProgress': 0
        })
        
        bucket = storage_client.bucket(bucket_name)
        
        # Process in temp directory
        with tempfile.TemporaryDirectory() as tmpdir:
            # Download and extract ZIP
            print("Downloading ZIP...")
            zip_path = os.path.join(tmpdir, 'dataset.zip')
            bucket.blob(zip_gcs_path).download_to_filename(zip_path)
            zip_size = os.path.getsize(zip_path)
            print(f"Downloaded: {zip_size / (1024*1024):.1f} MB")
            
            project_ref.update({'dataset.conversionProgress': 10})
            
            print("Extracting ZIP...")
            extract_dir = os.path.join(tmpdir, 'extracted')
            with zipfile.ZipFile(zip_path, 'r') as zf:
                zf.extractall(extract_dir)
            os.remove(zip_path)
            
            folders = find_image_folder(extract_dir)
            train_dir = folders['train']
            test_dir = folders.get('test')
            
            class_names = sorted([d for d in os.listdir(train_dir) 
                                 if os.path.isdir(os.path.join(train_dir, d))
                                 and d not in ['__pycache__', '__MACOSX']])
            class_to_idx = {name: idx for idx, name in enumerate(class_names)}
            
            train_images = []
            sample_img = None
            for class_name in class_names:
                class_dir = os.path.join(train_dir, class_name)
                imgs = collect_images(class_dir, class_to_idx[class_name])
                train_images.extend(imgs)
                if sample_img is None and imgs:
                    sample_img = imgs[0][0]
            
            orig_width, orig_height = get_image_dimensions(sample_img) if sample_img else (0, 0)
            
            random.seed(42)
            random.shuffle(train_images)
            
            val_images = []
            if test_dir is None and val_split > 0:
                split_idx = int(len(train_images) * (1 - val_split))
                val_images = train_images[split_idx:]
                train_images = train_images[:split_idx]
            
            test_images = []
            if test_dir:
                for class_name in class_names:
                    class_dir = os.path.join(test_dir, class_name)
                    if os.path.exists(class_dir):
                        test_images.extend(collect_images(class_dir, class_to_idx[class_name]))
            
            project_ref.update({'dataset.conversionProgress': 50})
            
            # Create shards directory
            shards_dir = os.path.join(tmpdir, 'shards')
            os.makedirs(shards_dir, exist_ok=True)
            
            shard_size_bytes = shard_size_mb * 1024 * 1024
            all_shard_paths = {'train': [], 'val': [], 'test': []}
            all_checksums = {}
            
            # Write training shards
            print("Writing training shards...")
            train_shards, train_checksums = write_shards(
                train_images,
                os.path.join(shards_dir, 'train'),
                shard_size_bytes
            )
            all_shard_paths['train'] = train_shards
            all_checksums.update(train_checksums)
            
            project_ref.update({'dataset.conversionProgress': 70})
            
            # Write validation shards
            if val_images:
                print("Writing validation shards...")
                val_shards, val_checksums = write_shards(
                    val_images,
                    os.path.join(shards_dir, 'val'),
                    shard_size_bytes
                )
                all_shard_paths['val'] = val_shards
                all_checksums.update(val_checksums)
            
            # Write test shards
            if test_images:
                print("Writing test shards...")
                test_shards, test_checksums = write_shards(
                    test_images,
                    os.path.join(shards_dir, 'test'),
                    shard_size_bytes
                )
                all_shard_paths['test'] = test_shards
                all_checksums.update(test_checksums)
            
            project_ref.update({'dataset.conversionProgress': 80})
            
            # Create metadata
            metadata = {
                'numClasses': len(class_names),
                'classNames': class_names,
                'trainSamples': len(train_images),
                'valSamples': len(val_images) if val_images else 0,
                'testSamples': len(test_images) if test_images else 0,
                'originalWidth': orig_width,
                'originalHeight': orig_height,
                'shardPaths': all_shard_paths,
                'checksums': all_checksums,
                'shardSizeMB': shard_size_mb
            }
            
            metadata_path = os.path.join(shards_dir, 'metadata.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            # Upload shards to GCS
            print("Uploading shards to GCS...")
            shards_gcs_prefix = zip_gcs_path.rsplit('/', 1)[0] + '/shards'
            
            for filename in os.listdir(shards_dir):
                local_path = os.path.join(shards_dir, filename)
                gcs_path = f"{shards_gcs_prefix}/{filename}"
                blob = bucket.blob(gcs_path)
                blob.upload_from_filename(local_path)
                print(f"  Uploaded: {filename}")
            
            project_ref.update({'dataset.conversionProgress': 95})
            
            # Update Firestore with completion
            project_ref.update({
                'dataset.conversionStatus': 'completed',
                'dataset.conversionProgress': 100,
                'dataset.shardPaths': all_shard_paths,
                'dataset.shardMetadata': {
                    'numClasses': len(class_names),
                    'classNames': class_names[:50],  # Limit for Firestore
                    'trainSamples': len(train_images),
                    'valSamples': len(val_images) if val_images else 0,
                    'testSamples': len(test_images) if test_images else 0,
                    'shardSizeMB': shard_size_mb
                },
                'dataset.shardsGcsPrefix': f"gs://{bucket_name}/{shards_gcs_prefix}"
            })
            
            print("Conversion complete!")
            
            return jsonify({
                'status': 'success',
                'shardPaths': all_shard_paths,
                'metadata': metadata,
                'gcsPrefix': f"gs://{bucket_name}/{shards_gcs_prefix}"
            })
    
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        
        # Update Firestore with error
        try:
            project_ref = db.collection('projects').document(data.get('projectId', ''))
            project_ref.update({
                'dataset.conversionStatus': 'failed',
                'dataset.conversionError': str(e)
            })
        except:
            pass
        
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500
