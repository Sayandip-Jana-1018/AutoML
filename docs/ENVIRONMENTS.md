# Environment Configuration

## Environment Files Structure

Create the following files for each environment:

### Development (`.env.local`)
```env
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=your-dev-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=autoforge-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=autoforge-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=autoforge-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=autoforge-dev
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@autoforge-dev.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# GCP
GOOGLE_CLOUD_PROJECT=autoforge-dev
GCS_BUCKET=autoforge-dev-datasets

# Vertex AI
VERTEX_REGION=us-central1

# App
NODE_ENV=development
```

### Staging (`.env.staging`)
```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID=autoforge-staging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=autoforge-staging.appspot.com
# ... (same structure, different values)
NODE_ENV=staging
```

### Production (`.env.production`)
```env
# Firebase (User data, Auth)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=automl-dc494
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=automl-dc494.appspot.com
NEXT_PUBLIC_FIREBASE_USER_STORAGE_BUCKET=automl-dc494.firebasestorage.app

# Firebase Admin
FIREBASE_PROJECT_ID=automl-dc494
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@automl-dc494.iam.gserviceaccount.com

# GCP (ML Training)
GOOGLE_CLOUD_PROJECT=mlforge-fluent-cable-480715-c8
GCS_BUCKET=mlforge-fluent-cable-480715-c8
TRAINING_BUCKET=mlforge-fluent-cable-480715-c8

# Vertex AI
VERTEX_REGION=us-central1

NODE_ENV=production
```

## GitHub Actions Secrets

Add these secrets in GitHub repository settings:

| Secret Name | Description |
|-------------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | GCS bucket |
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON (base64) |
| `FIREBASE_PROJECT_ID_PROD` | Production project ID |
| `FIREBASE_PROJECT_ID_STAGING` | Staging project ID |
| `VERCEL_TOKEN` | Vercel deployment token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

## Branch Protection Rules

1. **main branch** (Production)
   - Require pull request reviews
   - Require status checks to pass
   - Only deploy from main

2. **staging branch** (Staging)
   - Require status checks
   - Auto-deploy on push

3. **develop branch** (Development)
   - No restrictions
   - Local testing only
