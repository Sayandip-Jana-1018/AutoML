import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, generateText } from 'ai';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages, modelId, userId, datasetInfo, currentScript } = await req.json();
    console.log('Chat API called with modelId:', modelId, 'messages:', messages.length);

    // Fetch context from Firestore instead of EC2
    let context = "";
    try {
        // ... (Firestore fetching logic stays same, implied) ...
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

    // --- GOD MODE CONTEXT INJECTION ---
    let detailedContext = context;
    if (datasetInfo) {
        detailedContext += `\n\nACTIVE DATASET SCHEMA:\nFilename: ${datasetInfo.filename}\nRows: ${datasetInfo.rows}\nTarget Column: ${datasetInfo.targetColumn}\nColumns: ${datasetInfo.columns?.join(', ')}`;
    }
    if (currentScript) {
        detailedContext += `\n\nCURRENT SCRIPT:\n\`\`\`python\n${currentScript.substring(0, 10000)}\n\`\`\``;
    }
    // ----------------------------------

    const system = `You are AutoForgeML AI, an intelligent assistant for the AutoForgeML Studio platform.
You help users understand their datasets, improve models, and WRITE CODE.

Context:
${detailedContext}

RULES FOR CODE GENERATION:
1. If asked to write or fix code, ALWAYS generate the FULL, COMPLETE, RUNNABLE script.
2. NEVER return snippets, partial code, or use placeholders like "..." or "# ... same as before".
3. Ensure all imports (pandas, sklearn, etc.) and helper functions (load_data, save_model) are included.
4. The user wants to copy-paste your code directly into the editor, so it must be standalone and valid.
5. If modifying existing code, return the NEW COMPLETED content.
6. METRICS ARE CRITICAL:
   - You MUST calculate accuracy, precision, recall, f1_score.
   - For multi-class, use 'average="weighted"'.
   - Save these to \`metrics.json\` inside the \`save_model\` function details.
   - Example: metrics = {"accuracy": acc, "precision": prec, "recall": rec, "f1": f1}

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
        model = google('gemini-2.5-flash'); // PRO Model for smarter, full-code generation
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
        console.log('Calling generateText with model:', modelId);

        let attempts = 0;
        const maxAttempts = 3;
        let finalResponse = '';
        let currentSystemPrompt = system;

        while (attempts < maxAttempts) {
            attempts++;
            const result = await generateText({
                model,
                system: currentSystemPrompt,
                messages,
            });

            const text = result.text;

            // STRICTER SNIPPET DETECTION LOGIC
            const hasCodeIndicators = text.includes('def ') || text.includes('class ') || text.includes(' = ') || text.includes('return ') || text.includes('import ') || text.includes('from ');
            const hasImports = text.includes('import pandas') || text.includes('import numpy') || text.includes('from sklearn') || text.match(/^import /m) || text.match(/^from /m);

            // If it looks like code (has indicators) but lacks standarad imports, it's a snippet.
            // Exception: minimal conversational text ("Here is the code") is allowed, but the CODE BLOCK inside must have imports.
            // Since we generate raw text/markdown, we check if the *bulk* of the response is code-like without imports.

            let isSnippet = false;
            if (hasCodeIndicators && !hasImports) {
                isSnippet = true;
            }

            // Heuristic: If script provided and response is < 50% length, likely a snippet
            if (currentScript && text.length < currentScript.length * 0.5) {
                isSnippet = true;
            }

            if (isSnippet) {
                console.warn(`[Chat API] Detected snippet (Attempt ${attempts}/${maxAttempts}). Reprompting for FULL CODE.`);
                currentSystemPrompt += `\n\nCRITICAL FAILURE: You returned a Snippet!
YOUR LAST RESPONSE WAS REJECTED because it lacked imports or was too short.
USER REQUIRES THE FULL, EXECUTABLE SCRIPT.
1. START YOUR CODE WITH IMPORTS (import pandas as pd, etc).
2. INCLUDE THE ENTIRE SCRIPT (Do not use placeholders).
3. DO NOT return only the changed parts.
RETURN THE COMPLETE FILE NOW.`;
                if (attempts === maxAttempts) {
                    // Fallback: Try to prepend imports if we have them? 
                    // Or just return the failed text.
                    console.error('[Chat API] Failed to generate full code after max attempts.');
                    finalResponse = text;
                }
            } else {
                console.log(`[Chat API] Full code validation passed (Attempt ${attempts})`);
                finalResponse = text;
                break;
            }
        }

        // Return as a stream (even though it's one chunk) for frontend compatibility
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(finalResponse);
                controller.close();
            },
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error: any) {
        console.error('Model API call failed:', error);
        return new Response(
            JSON.stringify({ error: `${modelId} failed: ${error.message}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
