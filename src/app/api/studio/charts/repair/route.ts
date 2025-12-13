import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        // Auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const token = authHeader.split('Bearer ')[1];
        await adminAuth.verifyIdToken(token);

        const { code, error, datasetPath } = await request.json();

        const systemPrompt = `You are a Python expert debugging Pyodide/Plotly code. 
Fix the following code based on the error.
Rules:
- Return ONLY the full fixed Python code. No markdown, no explanations.
- Ensure 'fig' is assigned.
- Use 'plotly.express' or 'plotly.graph_objects'.
- Do not use matplotlib.
- If error is "ValueError: y contains previously unseen labels", use LabelEncoder on both train/test or handle unseen labels.
- If error is "ValueError: The length of the y vector must match...", ensure x/y match matrix shape.
- Drop NaN values in target columns if causing errors.
- Keep the light theme.`;

        const userPrompt = `Code:
${code}

Error:
${error}

Dataset: ${datasetPath || 'data.csv'}
Fix the code.`;

        const { text } = await generateText({
            model: openai('gpt-4o'), // Use high quality model for repair
            system: systemPrompt,
            prompt: userPrompt,
            temperature: 0.2 // Low temp for precision
        });

        const fixedCode = text.replace(/```python/g, '').replace(/```/g, '').trim();

        return NextResponse.json({ code: fixedCode });

    } catch (error) {
        console.error('Repair failed:', error);
        return NextResponse.json({ error: 'Repair failed' }, { status: 500 });
    }
}
