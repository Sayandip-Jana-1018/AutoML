import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages, modelId, userId } = await req.json();
    console.log('Chat API called with modelId:', modelId, 'messages:', messages.length);

    // Fetch context from Firestore instead of EC2
    let context = "";
    try {
        // Fetch recent projects with datasets
        const projectsSnapshot = await adminDb
            .collection('projects')
            .where('owner_email', '!=', null)
            .orderBy('owner_email')
            .orderBy('created_at', 'desc')
            .limit(10)
            .get();

        const datasets: any[] = [];
        for (const projectDoc of projectsSnapshot.docs) {
            const datasetsRef = adminDb.collection('projects').doc(projectDoc.id).collection('datasets');
            const datasetsSnap = await datasetsRef.orderBy('createdAt', 'desc').limit(3).get();
            datasetsSnap.forEach(dsDoc => {
                const data = dsDoc.data();
                datasets.push({
                    id: dsDoc.id,
                    projectId: projectDoc.id,
                    name: data.name,
                    status: data.status,
                    type: data.type,
                    rowCount: data.schema?.rowCount,
                    columnCount: data.schema?.columnCount
                });
            });
        }

        // Fetch recent models
        const modelsSnapshot = await adminDb
            .collection('models')
            .orderBy('updatedAt', 'desc')
            .limit(5)
            .get();

        const models = modelsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                taskType: data.taskType,
                algorithm: data.algorithm,
                accuracy: data.metrics?.accuracy,
                status: data.status
            };
        });

        context = `
Available Datasets (showing recent): ${JSON.stringify(datasets.slice(0, 5), null, 2)}
Available Models (showing recent): ${JSON.stringify(models, null, 2)}
        `;
    } catch (e: any) {
        console.error("Failed to fetch context from Firestore:", e);
        context = "Could not fetch current datasets/models status from Firestore.";
    }

    const system = `You are AutoForgeML AI, an intelligent assistant for the AutoForgeML Studio platform.
You help users understand their datasets and models, and guide them through ML workflows.

Context:
${context}

Answer the user's questions based on this context. Be helpful and concise.`;

    let model;

    // Map model IDs from chat page:
    // ai-3 = Gemini Pro (free tier)
    // ai-1 = GPT-4 Turbo (silver tier)  
    // ai-2 = Claude 3 Opus (gold tier)

    if (modelId === 'ai-2' || modelId === '1' || modelId === 1) {
        model = anthropic('claude-3-opus-20240229');
        console.log('✅ Using Claude model: claude-3-opus-20240229 (Anthropic)');
    } else if (modelId === 'ai-3' || modelId === '2' || modelId === 2) {
        model = google('models/gemini-2.5-flash');
        console.log('✅ Using Gemini model: gemini-2.5-flash (Google)');
    } else if (modelId === 'ai-1' || modelId === '3' || modelId === 3) {
        model = openai('gpt-4o');
        console.log('✅ Using GPT-4o model (OpenAI)');
    } else {
        // Default to Gemini (free tier)
        model = google('models/gemini-2.5-flash');
        console.log('⚠️ Unknown modelId, defaulting to Gemini');
    }

    try {
        console.log('Calling streamText with model:', modelId);
        const result = await streamText({
            model,
            system,
            messages,
        });

        console.log('StreamText successful, returning response');
        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error('Model API call failed:', error);
        // No fallback - return the actual error so user knows which model failed
        return new Response(
            JSON.stringify({ error: `${modelId} failed: ${error.message}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
