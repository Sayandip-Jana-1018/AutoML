import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages, modelId } = await req.json();
    console.log('Chat API called with modelId:', modelId, 'messages:', messages.length);

    // Fetch context from EC2 with timeout
    let context = "";
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const [datasetsRes, modelsRes] = await Promise.all([
            fetch('http://3.239.173.255/datasets', { signal: controller.signal }).catch(e => ({ ok: false, json: async () => ({ datasets: [] }) })),
            fetch('http://3.239.173.255/models', { signal: controller.signal }).catch(e => ({ ok: false, json: async () => ({ models: [] }) }))
        ]);

        clearTimeout(timeoutId);

        // @ts-ignore
        const datasetsData = datasetsRes.ok ? await datasetsRes.json() : { datasets: [] };
        // @ts-ignore
        const modelsData = modelsRes.ok ? await modelsRes.json() : { models: [] };

        const datasets = (datasetsData.datasets || []).slice(0, 5).map((d: any) => ({
            dataset_id: d.dataset_id,
            name: d.name,
            rows: d.rows,
            columns: d.columns,
            created_at: d.created_at
        }));

        const models = (modelsData.models || []).slice(0, 5).map((m: any) => ({
            model_id: m.model_id,
            target_column: m.target_column,
            algorithm: m.algorithm,
            accuracy: m.metrics?.accuracy,
            created_at: m.created_at
        }));

        context = `
Available Datasets (showing first 5): ${JSON.stringify(datasets, null, 2)}
Available Models (showing first 5): ${JSON.stringify(models, null, 2)}
        `;
    } catch (e: any) {
        if (e.name === 'AbortError') {
            console.error("Request timeout fetching context");
        } else {
            console.error("Failed to fetch context", e);
        }
        context = "Could not fetch current datasets/models status.";
    }

    const system = `You are Healthy AI, an intelligent assistant for the Healthy AutoML platform.
You help users understand their datasets and models.

Context:
${context}

Answer the user's questions based on this context. Be helpful and concise.`;

    let model;
    const id = Number(modelId);

    if (id === 1) {
        model = anthropic('claude-3-opus-20240229');
        console.log('Using Claude model');
    } else if (id === 2) {
        model = google('models/gemini-2.0-flash-exp');
        console.log('Using Gemini model');
    } else if (id === 3) {
        model = openai('gpt-4o-mini');
        console.log('Using GPT-4o-mini model');
    } else {
        model = openai('gpt-4o');
        console.log('Using GPT-4o model');
    }

    try {
        console.log('Calling streamText with model:', id);
        const result = await streamText({
            model,
            system,
            messages,
        });

        console.log('StreamText successful, returning response');
        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error('Primary model failed, falling back to Gemini:', error);

        const fallbackResult = await streamText({
            model: google('models/gemini-2.0-flash-exp'),
            system,
            messages,
        });

        return fallbackResult.toTextStreamResponse();
    }
}
