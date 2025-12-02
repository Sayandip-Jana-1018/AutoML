# Deploying Backend Fixes to EC2

## Overview
The training failures are happening because the EC2 instance is running the old code. You need to upload the fixed files and restart the service.

## Files to Deploy
The following files have been fixed and need to be uploaded to EC2:
- `ml-aws/app/main.py` (added 2s delay, validation)
- `ml-aws/app/ml_pipeline.py` (removed fallback logic)
- `ml-aws/app/data_processor.py` (ID column handling)
- `ml-aws/.env` (AWS credentials)

## Deployment Steps

### Option 1: Using SCP (Recommended)

```bash
# 1. Navigate to ml-aws directory
cd C:\Users\Sayan\Desktop\Healthy\ml-aws

# 2. Upload the fixed files to EC2 (replace YOUR_KEY.pem with your actual key file)
scp -i "YOUR_KEY.pem" app/main.py ubuntu@3.239.173.255:/home/ubuntu/ml-aws/app/
scp -i "YOUR_KEY.pem" app/ml_pipeline.py ubuntu@3.239.173.255:/home/ubuntu/ml-aws/app/
scp -i "YOUR_KEY.pem" app/data_processor.py ubuntu@3.239.173.255:/home/ubuntu/ml-aws/app/
scp -i "YOUR_KEY.pem" .env ubuntu@3.239.173.255:/home/ubuntu/ml-aws/

# 3. SSH into EC2 and restart the service
ssh -i "YOUR_KEY.pem" ubuntu@3.239.173.255

# Once connected to EC2:
cd /home/ubuntu/ml-aws
sudo systemctl restart automl  # or whatever your service name is
# OR if running with uvicorn directly:
pkill -f uvicorn
nohup uvicorn app.main:app --host 0.0.0.0 --port 80 &

# 4. Check if service is running
curl http://localhost/health

# 5. Exit SSH
exit
```

### Option 2: Using Git (If you have a repo)

```bash
# On your local machine
cd C:\Users\Sayan\Desktop\Healthy\ml-aws
git add app/main.py app/ml_pipeline.py app/data_processor.py .env
git commit -m "Fix training failures: remove fallbacks, add ID column handling"
git push

# SSH into EC2
ssh -i "YOUR_KEY.pem" ubuntu@3.239.173.255

# On EC2
cd /home/ubuntu/ml-aws
git pull
sudo systemctl restart automl  # or restart uvicorn
exit
```

### Option 3: Manual Copy-Paste (Quick Test)

```bash
# SSH into EC2
ssh -i "YOUR_KEY.pem" ubuntu@3.239.173.255

# On EC2, edit each file manually
nano /home/ubuntu/ml-aws/app/main.py
# (paste the new content)

nano /home/ubuntu/ml-aws/app/ml_pipeline.py
# (paste the new content)

nano /home/ubuntu/ml-aws/app/data_processor.py
# (paste the new content)

nano /home/ubuntu/ml-aws/.env
# (paste the new content)

# Restart service
sudo systemctl restart automl
# OR
pkill -f uvicorn
nohup uvicorn app.main:app --host 0.0.0.0 --port 80 &
```

## Verification

After deployment, test the API:

```bash
# Check health
curl http://3.239.173.255/health

# Check if datasets are listed
curl http://3.239.173.255/datasets

# Try training with your dataset
curl -X POST http://3.239.173.255/train \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "14603aaf-4d7d-4178-93c6-c3593983f689",
    "target_column": "GPA",
    "algorithm": "auto"
  }'
```

## Troubleshooting

If training still fails after deployment:

1. **Check EC2 logs**:
   ```bash
   ssh -i "YOUR_KEY.pem" ubuntu@3.239.173.255
   tail -f /var/log/automl.log  # or wherever logs are
   # OR if running with nohup:
   tail -f nohup.out
   ```

2. **Run diagnostic script**:
   ```bash
   # Upload diagnostic script
   scp -i "YOUR_KEY.pem" diagnose_dataset.py ubuntu@3.239.173.255:/home/ubuntu/ml-aws/
   
   # SSH and run it
   ssh -i "YOUR_KEY.pem" ubuntu@3.239.173.255
   cd /home/ubuntu/ml-aws
   python diagnose_dataset.py
   ```

3. **Check dataset**:
   - Ensure the dataset has at least 10-50 rows
   - Ensure "GPA" column exists and has valid numeric values
   - Check if there are any ID columns that should be excluded

## Common Issues

- **Permission denied**: Use `sudo` for system commands
- **Port 80 requires sudo**: Run uvicorn with sudo or use port 8000
- **Service not found**: Check service name with `systemctl list-units | grep automl`
- **Files not updating**: Clear Python cache with `find . -name "*.pyc" -delete`
