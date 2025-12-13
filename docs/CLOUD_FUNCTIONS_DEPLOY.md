# Cloud Functions Deployment Guide

## Overview

Deploying the new metrics-sync functions is **safe** and will **not disrupt** existing functions. Firebase uses an **additive deployment model** - new functions are added alongside existing ones.

## What Gets Deployed

| Function | Trigger | Purpose |
|----------|---------|---------|
| `onDatasetUploaded` | Existing | Dataset schema profiling |
| `onDatasetReUploaded` | Existing | Dataset version handling |
| `onMetricsUploaded` | **NEW** | Parse metrics.json → update Firestore |
| `onModelUploaded` | **NEW** | Track model.joblib uploads |

## Pre-Deployment Checklist

- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Logged in (`firebase login`)
- [ ] Project selected (`firebase use automl-dc494`)
- [ ] Functions dependencies installed

## Step-by-Step Deployment

### 1. Install Dependencies
```bash
cd c:\Users\Sayan\Desktop\MLForge\functions
npm install
```

### 2. Build Functions
```bash
npm run build
```

This compiles TypeScript to JavaScript in the `lib/` folder.

### 3. Test Locally (Optional but Recommended)
```bash
npm run serve
```

This starts the Firebase emulator. Check for any errors in the console.

### 4. Deploy Functions
```bash
npm run deploy
```

Or with more control:
```bash
firebase deploy --only functions
```

### 5. Verify Deployment
```bash
firebase functions:list
```

You should see all 4 functions listed.

## Safety Considerations

### ✅ No Breaking Changes
- New functions are triggered by **different GCS paths** (training bucket, not dataset bucket)
- Existing functions continue to work on dataset uploads
- No shared state between old and new functions

### ✅ Isolated Triggers
- `onMetricsUploaded` only triggers on `metrics.json` files
- `onModelUploaded` only triggers on `model.joblib` files
- Dataset functions only trigger on CSV files

### ✅ Graceful Error Handling
- All functions have try/catch blocks
- Errors are logged but don't crash other functions
- Failed updates don't affect other documents

## Bucket Configuration

The new functions listen to a **different bucket**:

| Function | Bucket |
|----------|--------|
| Dataset functions | `automl-dc494.appspot.com` (Firebase Storage) |
| Metrics functions | `mlforge-fluent-cable-480715-c8` (GCS training bucket) |

> **Note**: Update the bucket name in `metrics-sync.ts` if your training bucket has a different name.

## Rollback (If Needed)

If something goes wrong, you can delete specific functions:

```bash
firebase functions:delete onMetricsUploaded onModelUploaded
```

Or redeploy without the new functions by commenting out the export in `index.ts`.

## Monitoring

After deployment, monitor in Firebase Console:
- Functions → Dashboard → Check invocations and errors
- Logs → Filter by function name

## Cost Impact

- New functions use minimal resources (256MiB memory)
- Only triggered when training completes
- Estimated cost: ~$0.01 per training run
