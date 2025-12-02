@echo off
REM Deployment script for EC2 backend fixes
echo ========================================
echo Deploying Backend Fixes to EC2
echo ========================================
echo.

REM Set variables
set KEY=ec2-key.pem
set HOST=ubuntu@3.239.173.255
set REMOTE_DIR=/home/ubuntu/ml-aws

echo Step 1: Setting key permissions...
icacls %KEY% /inheritance:r
icacls %KEY% /grant:r "%USERNAME%:(R)"

echo.
echo Step 2: Uploading fixed files to EC2...
scp -i %KEY% app\main.py %HOST%:%REMOTE_DIR%/app/
scp -i %KEY% app\ml_pipeline.py %HOST%:%REMOTE_DIR%/app/
scp -i %KEY% app\data_processor.py %HOST%:%REMOTE_DIR%/app/
scp -i %KEY% .env %HOST%:%REMOTE_DIR%/

echo.
echo Step 3: Restarting backend service...
ssh -i %KEY% %HOST% "cd %REMOTE_DIR% && pkill -f uvicorn && nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 80 > /dev/null 2>&1 &"

echo.
echo Step 4: Waiting for service to start...
timeout /t 3 /nobreak > nul

echo.
echo Step 5: Testing health endpoint...
curl -s http://3.239.173.255/health

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo You can now test training in the browser.
pause
