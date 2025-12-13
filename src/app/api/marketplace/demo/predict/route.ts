/**
 * Marketplace Demo Predict Endpoint
 * POST /api/marketplace/demo/predict
 * 
 * Sandbox demo for public models:
 * - Rate limited per IP (configurable via MARKETPLACE_DEMO_RATE_LIMIT)
 * - 10s timeout (configurable via MARKETPLACE_DEMO_TIMEOUT_MS)
 * - Returns 429 with Retry-After on limit exceeded
 * - Increments demoUsageCount atomically
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 10; // 10 second timeout

const DEMO_TIMEOUT_MS = parseInt(process.env.MARKETPLACE_DEMO_TIMEOUT_MS || '10000', 10);

export async function POST(req: NextRequest) {
    const startTime = Date.now();

    try {
        // Get client IP for rate limiting
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            req.headers.get('x-real-ip') ||
            'unknown';

        // Rate limit check
        const rateLimit = await checkRateLimit(ip, 'marketplace-demo');

        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded',
                    message: 'Too many requests. Please try again later.',
                    retryAfter: rateLimit.retryAfter
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(rateLimit.retryAfter),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(rateLimit.resetAt)
                    }
                }
            );
        }

        const { modelId, inputs } = await req.json();

        if (!modelId) {
            return NextResponse.json({ error: 'modelId is required' }, { status: 400 });
        }

        if (!inputs || typeof inputs !== 'object') {
            return NextResponse.json({ error: 'inputs object is required' }, { status: 400 });
        }

        // Fetch model - must be public
        const modelDoc = await adminDb.collection('models').doc(modelId).get();

        if (!modelDoc.exists) {
            return NextResponse.json({ error: 'Model not found' }, { status: 404 });
        }

        const model = modelDoc.data();

        if (model?.visibility !== 'public' && !model?.isPublic) {
            return NextResponse.json({ error: 'Model is not public' }, { status: 403 });
        }

        // Call the actual prediction endpoint with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEMO_TIMEOUT_MS);

        try {
            const predictionUrl = process.env.PREDICTION_API_URL || 'http://localhost:8080';
            const response = await fetch(`${predictionUrl}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: modelId,
                    features: inputs
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error('Prediction service error');
            }

            const result = await response.json();

            // Increment usage count atomically
            await modelDoc.ref.update({
                demoUsageCount: FieldValue.increment(1),
                usageCount: FieldValue.increment(1),
                lastUsedAt: FieldValue.serverTimestamp()
            });

            const latencyMs = Date.now() - startTime;

            return NextResponse.json({
                prediction: result.prediction,
                confidence: result.confidence,
                demoMetadata: {
                    modelId,
                    modelName: model?.name,
                    taskType: model?.taskType,
                    algorithm: model?.algorithm,
                    latency_ms: latencyMs,
                    timestamp: new Date().toISOString(),
                    isDemo: true
                }
            }, {
                headers: {
                    'X-RateLimit-Remaining': String(rateLimit.remaining),
                    'X-RateLimit-Reset': String(rateLimit.resetAt)
                }
            });

        } catch (fetchError: any) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                return NextResponse.json(
                    { error: 'Prediction timeout', message: 'Demo request timed out' },
                    { status: 504 }
                );
            }

            // Fallback: Return mock prediction for demo purposes
            const latencyMs = Date.now() - startTime;

            await modelDoc.ref.update({
                demoUsageCount: FieldValue.increment(1),
                usageCount: FieldValue.increment(1)
            });

            return NextResponse.json({
                prediction: model?.taskType === 'classification' ? 'class_0' : 0.5,
                confidence: 0.85,
                demoMetadata: {
                    modelId,
                    modelName: model?.name,
                    taskType: model?.taskType,
                    algorithm: model?.algorithm,
                    latency_ms: latencyMs,
                    timestamp: new Date().toISOString(),
                    isDemo: true,
                    isMock: true,
                    note: 'Prediction service unavailable, showing demo result'
                }
            });
        }

    } catch (error: any) {
        console.error('[Marketplace Demo] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
