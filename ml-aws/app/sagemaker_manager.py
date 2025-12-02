"""
SageMaker Manager for AutoML Healthcare API
Handles SageMaker training jobs and model management
"""

import os
import json
import boto3
import time
import pickle
from datetime import datetime
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class SageMakerManager:
    """Manages SageMaker training jobs and model artifacts"""
    
    def __init__(self):
        self.region = os.environ.get('AWS_REGION', 'us-east-1')
        self.s3_bucket = os.environ.get('S3_BUCKET')
        self.role_arn = os.environ.get('SAGEMAKER_ROLE')
        self.subnets = os.environ.get('VPC_SUBNETS', '').split(',')
        self.security_group = os.environ.get('SECURITY_GROUP')
        
        # Initialize AWS clients
        self.s3_client = boto3.client('s3', region_name=self.region)
        self.sagemaker_client = boto3.client('sagemaker', region_name=self.region)
        
        # Validate configuration
        if not self.s3_bucket:
            logger.warning("S3_BUCKET not set - SageMaker features disabled")
        if not self.role_arn:
            logger.warning("SAGEMAKER_ROLE not set - SageMaker features disabled")
    
    def is_configured(self) -> bool:
        """Check if SageMaker is properly configured"""
        return bool(self.s3_bucket and self.role_arn)
    
    def upload_dataset_to_s3(self, dataset_id: str, local_path: str) -> str:
        """Upload dataset to S3 and return S3 URI"""
        s3_key = f"datasets/{dataset_id}/data.csv"
        
        try:
            self.s3_client.upload_file(local_path, self.s3_bucket, s3_key)
            s3_uri = f"s3://{self.s3_bucket}/{s3_key}"
            logger.info(f"Dataset uploaded to: {s3_uri}")
            return s3_uri
        except Exception as e:
            logger.error(f"Failed to upload dataset: {e}")
            raise
    
    def start_training_job(
        self,
        job_name: str,
        dataset_s3_uri: str,
        target_column: str,
        algorithm: str = "auto",
        test_size: float = 0.2
    ) -> str:
        """Start a SageMaker training job"""
        
        if not self.is_configured():
            raise ValueError("SageMaker not configured. Set S3_BUCKET and SAGEMAKER_ROLE.")
        
        # Get the parent S3 path (folder containing data.csv)
        s3_input_path = '/'.join(dataset_s3_uri.rsplit('/', 1)[:-1])
        
        # Output path for model artifacts
        output_path = f"s3://{self.s3_bucket}/models/{job_name}"
        
        # Training job configuration
        training_params = {
            'TrainingJobName': job_name,
            'RoleArn': self.role_arn,
            'AlgorithmSpecification': {
                'TrainingImage': self._get_sklearn_image(),
                'TrainingInputMode': 'File'
            },
            'InputDataConfig': [
                {
                    'ChannelName': 'training',
                    'DataSource': {
                        'S3DataSource': {
                            'S3DataType': 'S3Prefix',
                            'S3Uri': s3_input_path,
                            'S3DataDistributionType': 'FullyReplicated'
                        }
                    },
                    'ContentType': 'text/csv'
                }
            ],
            'OutputDataConfig': {
                'S3OutputPath': output_path
            },
            'ResourceConfig': {
                'InstanceType': 'ml.c5.xlarge',
                'InstanceCount': 1,
                'VolumeSizeInGB': 10
            },
            'StoppingCondition': {
    'MaxRuntimeInSeconds': 3600,
    'MaxWaitTimeInSeconds': 7200
},
'EnableManagedSpotTraining': True,
            'HyperParameters': {
                'target_column': target_column,
                'algorithm': algorithm,
                'test_size': str(test_size),
                'sagemaker_program': 'sagemaker_train.py',
                'sagemaker_submit_directory': f's3://{self.s3_bucket}/code/sourcedir.tar.gz'
            },
            'EnableNetworkIsolation': False
        }
        
        # Add VPC config if subnets are specified
        if self.subnets and self.subnets[0] and self.security_group:
            training_params['VpcConfig'] = {
                'Subnets': self.subnets,
                'SecurityGroupIds': [self.security_group]
            }
        
        try:
            response = self.sagemaker_client.create_training_job(**training_params)
            logger.info(f"Training job started: {job_name}")
            return job_name
        except Exception as e:
            logger.error(f"Failed to start training job: {e}")
            raise
    
    def _get_sklearn_image(self) -> str:
        """Get the SageMaker SKLearn container image URI"""
        account_map = {
            'us-east-1': '683313688378',
            'us-east-2': '257758044811',
            'us-west-1': '746614075791',
            'us-west-2': '246618743249',
            'eu-west-1': '141502667606',
            'eu-central-1': '492215442770',
            'ap-southeast-1': '121021644041',
            'ap-southeast-2': '783357654285',
            'ap-northeast-1': '354813040037',
            'ap-northeast-2': '366743142698'
        }
        
        account = account_map.get(self.region, '683313688378')
        return f"{account}.dkr.ecr.{self.region}.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3"
    
    def _get_or_create_security_group(self) -> list:
        """Get or create a security group for SageMaker"""
        ec2_client = boto3.client('ec2', region_name=self.region)
        
        # Get VPC ID from subnet
        try:
            subnet_response = ec2_client.describe_subnets(SubnetIds=[self.subnets[0]])
            vpc_id = subnet_response['Subnets'][0]['VpcId']
            
            # Check if security group exists
            sg_name = 'automl-sagemaker-sg'
            try:
                sg_response = ec2_client.describe_security_groups(
                    Filters=[
                        {'Name': 'group-name', 'Values': [sg_name]},
                        {'Name': 'vpc-id', 'Values': [vpc_id]}
                    ]
                )
                if sg_response['SecurityGroups']:
                    return [sg_response['SecurityGroups'][0]['GroupId']]
            except:
                pass
            
            # Create security group
            sg_response = ec2_client.create_security_group(
                GroupName=sg_name,
                Description='Security group for SageMaker training jobs',
                VpcId=vpc_id
            )
            sg_id = sg_response['GroupId']
            
            # Allow all outbound traffic
            ec2_client.authorize_security_group_egress(
                GroupId=sg_id,
                IpPermissions=[{
                    'IpProtocol': '-1',
                    'FromPort': -1,
                    'ToPort': -1,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
                }]
            )
            
            return [sg_id]
            
        except Exception as e:
            logger.error(f"Failed to setup security group: {e}")
            return []
    
    def get_training_job_status(self, job_name: str) -> Dict[str, Any]:
        """Get status of a training job"""
        try:
            response = self.sagemaker_client.describe_training_job(
                TrainingJobName=job_name
            )
            
            status = response['TrainingJobStatus']
            
            result = {
                'job_name': job_name,
                'status': status.lower(),
                'creation_time': response.get('CreationTime'),
                'last_modified_time': response.get('LastModifiedTime'),
            }
            
            if status == 'Completed':
                result['model_artifacts'] = response.get('ModelArtifacts', {}).get('S3ModelArtifacts')
                result['metrics'] = self._extract_metrics(response)
            elif status == 'Failed':
                result['failure_reason'] = response.get('FailureReason')
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to get training job status: {e}")
            raise
    
    def _extract_metrics(self, response: Dict) -> Dict[str, float]:
        """Extract metrics from training job response"""
        metrics = {}
        final_metrics = response.get('FinalMetricDataList', [])
        for metric in final_metrics:
            metrics[metric['MetricName']] = metric['Value']
        return metrics
    
    def download_model(self, model_artifacts_uri: str, local_path: str) -> str:
        """Download model artifacts from S3"""
        import tarfile
        import tempfile
        
        # Parse S3 URI
        s3_parts = model_artifacts_uri.replace('s3://', '').split('/')
        bucket = s3_parts[0]
        key = '/'.join(s3_parts[1:])
        
        # Download tar.gz file
        with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
            self.s3_client.download_file(bucket, key, tmp.name)
            
            # Extract
            with tarfile.open(tmp.name, 'r:gz') as tar:
                tar.extractall(path=local_path)
        
        model_file = os.path.join(local_path, 'model.pkl')
        if os.path.exists(model_file):
            return model_file
        
        # Try to find model file
        for root, dirs, files in os.walk(local_path):
            for f in files:
                if f.endswith('.pkl'):
                    return os.path.join(root, f)
        
        raise FileNotFoundError("Model file not found in artifacts")
    
    def load_model(self, model_path: str) -> Dict[str, Any]:
        """Load model from pickle file"""
        with open(model_path, 'rb') as f:
            return pickle.load(f)
    
    def upload_source_code(self):
        """Upload training script to S3"""
        import tarfile
        import tempfile
        
        # Create tar.gz of source code
        source_files = ['app/sagemaker_train.py']
        
        with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
            with tarfile.open(tmp.name, 'w:gz') as tar:
                for src_file in source_files:
                    if os.path.exists(src_file):
                        tar.add(src_file, arcname=os.path.basename(src_file))
            
            # Upload to S3
            s3_key = 'code/sourcedir.tar.gz'
            self.s3_client.upload_file(tmp.name, self.s3_bucket, s3_key)
            
        logger.info(f"Source code uploaded to s3://{self.s3_bucket}/{s3_key}")
        return f"s3://{self.s3_bucket}/{s3_key}"
    
    def wait_for_training_job(self, job_name: str, poll_interval: int = 30) -> Dict[str, Any]:
        """Wait for training job to complete"""
        while True:
            status = self.get_training_job_status(job_name)
            
            if status['status'] in ['completed', 'failed', 'stopped']:
                return status
            
            logger.info(f"Training job {job_name} status: {status['status']}")
            time.sleep(poll_interval)
    
    def list_training_jobs(self, max_results: int = 10) -> list:
        """List recent training jobs"""
        try:
            response = self.sagemaker_client.list_training_jobs(
                MaxResults=max_results,
                SortBy='CreationTime',
                SortOrder='Descending'
            )
            return response.get('TrainingJobSummaries', [])
        except Exception as e:
            logger.error(f"Failed to list training jobs: {e}")
            return []