import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { storage, GCP_PROJECT_ID, GCP_LOCATION, TRAINING_BUCKET } from '@/lib/gcp';

export const runtime = 'nodejs';

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: {
        firestore: { status: string; latencyMs?: number; error?: string };
        gcs: { status: string; bucket?: string; error?: string };
        vertexAi: { status: string; project?: string; location?: string; error?: string };
    };
    config: {
        gcpProject: string | undefined;
        gcpLocation: string;
        trainingBucket: string;
        firebaseProject: string | undefined;
    };
    version: string;
    environment: string;
}

/**
 * Health Check API
 * GET: Check system health (Firestore, GCS, Vertex AI)
 * 
 * Cross-Project Architecture:
 * - Firestore: automl-dc494 (Firebase)
 * - GCS + Vertex AI: fluent-cable-480715-c8 (new GCP project)
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
    const startTime = Date.now();
    const checks: HealthStatus['checks'] = {
        firestore: { status: 'unknown' },
        gcs: { status: 'unknown' },
        vertexAi: { status: 'unknown' }
    };

    // Check Firestore (Firebase project: automl-dc494)
    try {
        const fsStart = Date.now();
        await adminDb.collection('_healthcheck').doc('ping').set({
            timestamp: new Date(),
            source: 'health-api'
        });
        const fsEnd = Date.now();
        checks.firestore = { status: 'ok', latencyMs: fsEnd - fsStart };
    } catch (error: unknown) {
        checks.firestore = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }

    // Check GCS (new GCP project: fluent-cable-480715-c8)
    try {
        const bucket = storage.bucket(TRAINING_BUCKET);
        const [exists] = await bucket.exists();
        if (exists) {
            checks.gcs = { status: 'ok', bucket: TRAINING_BUCKET };
        } else {
            checks.gcs = { status: 'error', bucket: TRAINING_BUCKET, error: 'Bucket does not exist' };
        }
    } catch (error: unknown) {
        checks.gcs = {
            status: 'error',
            bucket: TRAINING_BUCKET,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }

    // Check Vertex AI configuration (passive check - just validate config exists)
    try {
        if (GCP_PROJECT_ID && GCP_LOCATION) {
            checks.vertexAi = {
                status: 'ok',
                project: GCP_PROJECT_ID,
                location: GCP_LOCATION
            };
        } else {
            checks.vertexAi = {
                status: 'error',
                error: 'Missing GCP_PROJECT_ID or GCP_LOCATION environment variables'
            };
        }
    } catch (error: unknown) {
        checks.vertexAi = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }

    // Determine overall status
    const allOk = Object.values(checks).every(c => c.status === 'ok');
    const anyError = Object.values(checks).some(c => c.status === 'error');

    const overallStatus: 'healthy' | 'degraded' | 'unhealthy' =
        allOk ? 'healthy' : anyError ? 'unhealthy' : 'degraded';

    const response: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks,
        config: {
            gcpProject: GCP_PROJECT_ID,
            gcpLocation: GCP_LOCATION,
            trainingBucket: TRAINING_BUCKET,
            firebaseProject: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        },
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    };

    // Return appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });
}
