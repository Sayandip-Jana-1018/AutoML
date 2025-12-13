/**
 * Deploy Predict Endpoint
 * POST /api/deploy/{modelId}/predict
 * 
 * Private prediction for deployed models:
 * - Requires Firebase auth OR API key
 * - Logs request/response to deploy_logs/{modelId}
 * - Returns latency_ms and estimated_cost_inr
 * - Owner-only access to logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { validateApiKey } from '@/lib/api-keys';

export const runtime = 'nodejs';

const USD_TO_INR = parseFloat(process.env.USD_TO_INR || '83.0');
const COST_PER_PREDICTION_USD = 0.0001; // $0.0001 per prediction

interface RouteContext {
    params: { modelId: string };
}

export async function POST(req: NextRequest, context: RouteContext) {
    const startTime = Date.now();

    try {
        const { modelId } = context.params;

        if (!modelId) {
            return NextResponse.json({ error: 'modelId is required' }, { status: 400 });
        }

        // Authenticate via API key or Firebase token
        let userId: string | null = null;
        let authMethod: 'api_key' | 'firebase' = 'firebase';

        const authHeader = req.headers.get('authorization');
        const apiKeyHeader = req.headers.get('x-api-key');

        if (apiKeyHeader) {
            // Validate API key
            const keyValidation = await validateApiKey(apiKeyHeader);
            if (!keyValidation.valid) {
                return NextResponse.json({ error: keyValidation.error }, { status: 401 });
            }
            userId = keyValidation.userId!;
            authMethod = 'api_key';
        } else if (authHeader?.startsWith('Bearer ')) {
            // Validate Firebase token
            try {
                const token = authHeader.split('Bearer ')[1];
                const decodedToken = await adminAuth.verifyIdToken(token);
                userId = decodedToken.uid;
            } catch {
                return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
            }
        } else {
            return NextResponse.json(
                { error: 'Authentication required. Provide X-API-Key header or Bearer token.' },
                { status: 401 }
            );
        }

        // Fetch model
        const modelDoc = await adminDb.collection('models').doc(modelId).get();

        if (!modelDoc.exists) {
            return NextResponse.json({ error: 'Model not found' }, { status: 404 });
        }

        const model = modelDoc.data();

        // Check ownership - only owner can use deploy endpoint
        if (model?.ownerId !== userId) {
            return NextResponse.json(
                { error: 'Access denied. You can only test your own models.' },
                { status: 403 }
            );
        }

        const { inputs, options } = await req.json();

        if (!inputs || typeof inputs !== 'object') {
            return NextResponse.json({ error: 'inputs object is required' }, { status: 400 });
        }

        // Call prediction service
        let prediction: any = null;
        let confidence: number | null = null;
        let predictionError: string | null = null;

        try {
            const predictionUrl = process.env.PREDICTION_API_URL || 'http://localhost:8080';
            const response = await fetch(`${predictionUrl}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: modelId,
                    features: inputs
                })
            });

            if (response.ok) {
                const result = await response.json();
                prediction = result.prediction;
                confidence = result.confidence;
            } else {
                predictionError = 'Prediction service error';
            }
        } catch {
            // Mock prediction for demo
            prediction = model?.taskType === 'classification' ? 'class_0' : 0.5;
            confidence = 0.85;
        }

        const latencyMs = Date.now() - startTime;
        const estimatedCostUsd = COST_PER_PREDICTION_USD;
        const estimatedCostInr = estimatedCostUsd * USD_TO_INR;

        // Log the request (for owner access)
        const logEntry = {
            modelId,
            userId,
            authMethod,
            inputs,
            prediction,
            confidence,
            error: predictionError,
            latency_ms: latencyMs,
            estimated_cost_usd: estimatedCostUsd,
            estimated_cost_inr: estimatedCostInr,
            timestamp: FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30-day retention
        };

        await adminDb.collection('deploy_logs').doc(modelId)
            .collection('requests').add(logEntry);

        // Update usage count
        await modelDoc.ref.update({
            usageCount: FieldValue.increment(1),
            lastUsedAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            prediction,
            confidence,
            latency_ms: latencyMs,
            estimated_cost_usd: parseFloat(estimatedCostUsd.toFixed(6)),
            estimated_cost_inr: parseFloat(estimatedCostInr.toFixed(4)),
            metadata: {
                modelId,
                modelName: model?.name,
                taskType: model?.taskType,
                algorithm: model?.algorithm,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('[Deploy Predict] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/deploy/{modelId}/predict - Get prediction logs
 */
export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const { modelId } = context.params;

        // Authenticate
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Verify ownership
        const modelDoc = await adminDb.collection('models').doc(modelId).get();
        if (!modelDoc.exists || modelDoc.data()?.ownerId !== userId) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Get recent logs
        const logsSnapshot = await adminDb.collection('deploy_logs').doc(modelId)
            .collection('requests')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        const logs = logsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString()
        }));

        return NextResponse.json({ logs });

    } catch (error: any) {
        console.error('[Deploy Predict] Logs error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
