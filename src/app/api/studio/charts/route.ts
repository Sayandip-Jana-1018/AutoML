import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Tier-based model selection
const TIER_MODELS = {
    free: { provider: 'gemini', model: 'gemini-1.5-flash' },
    silver: { provider: 'openai', model: 'gpt-4o-mini' },
    gold: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
};

// Popular chart types to auto-generate
export const CHART_TYPES = [
    { id: 'scatter', name: 'Scatter Plot', prompt: 'Create a scatter plot showing the relationship between the first two numeric columns' },
    { id: 'histogram', name: 'Histogram', prompt: 'Create a histogram showing the distribution of the target variable' },
    { id: 'boxplot', name: 'Box Plot', prompt: 'Create box plots for all numeric columns to show outliers and distributions' },
    { id: 'correlation', name: 'Correlation Heatmap', prompt: 'Generate a correlation heatmap of all numeric features' },
    { id: 'pairplot', name: 'Pair Plot', prompt: 'Create a pair plot matrix for the top 4 numeric features' },
    { id: 'bar', name: 'Bar Chart', prompt: 'Create a bar chart showing class distribution of the target variable' },
    { id: '3d_scatter', name: '3D Scatter', prompt: 'Create a 3D scatter plot using the first three numeric columns' },
    { id: 'violin', name: 'Violin Plot', prompt: 'Create violin plots showing distribution of numeric columns by category' },
];

interface ChartRequest {
    projectId: string;
    chartType?: string;
    customPrompt?: string;
    datasetPath?: string;
    aiModel?: 'gemini' | 'openai' | 'claude';
}

export async function POST(request: NextRequest) {
    try {
        // Verify auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        let uid: string;
        try {
            const decoded = await adminAuth.verifyIdToken(token);
            uid = decoded.uid;
        } catch {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const body: ChartRequest = await request.json();
        const { projectId, chartType, customPrompt, datasetPath, aiModel } = body;

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }

        // Get user tier
        const userDoc = await adminDb.collection('users').doc(uid).get();
        const userTier = (userDoc.data()?.tier as 'free' | 'silver' | 'gold') || 'free';
        const tierConfig = TIER_MODELS[userTier];

        // Check if chart already exists (duplicate detection)
        const chartPrompt = customPrompt || CHART_TYPES.find(c => c.id === chartType)?.prompt || customPrompt;
        if (!chartPrompt) {
            return NextResponse.json({ error: 'chartType or customPrompt required' }, { status: 400 });
        }

        const existingChart = await adminDb
            .collection('charts')
            .where('projectId', '==', projectId)
            .where('prompt', '==', chartPrompt)
            .limit(1)
            .get();

        if (!existingChart.empty) {
            const existing = existingChart.docs[0];
            return NextResponse.json({
                success: true,
                alreadyExists: true,
                chart: { id: existing.id, ...existing.data() }
            });
        }

        // Generate chart code using AI (use aiModel from request or fallback to tier-based)
        const selectedModel = aiModel || (userTier === 'gold' ? 'claude' : userTier === 'silver' ? 'openai' : 'gemini');
        const pythonCode = await generateChartCode(chartPrompt, datasetPath, selectedModel);

        // Save chart to Firestore
        const chartRef = await adminDb.collection('charts').add({
            projectId,
            userId: uid,
            chartType: chartType || 'custom',
            prompt: chartPrompt,
            code: pythonCode,
            imageUrl: null, // Will be populated after execution
            tier: userTier,
            model: tierConfig.model,
            createdAt: FieldValue.serverTimestamp(),
            status: 'generated'
        });

        return NextResponse.json({
            success: true,
            chart: {
                id: chartRef.id,
                chartType: chartType || 'custom',
                prompt: chartPrompt,
                code: pythonCode,
                status: 'generated'
            }
        });

    } catch (error) {
        console.error('[ChartGen] Error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Chart generation failed'
        }, { status: 500 });
    }
}

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';

// ... (imports)

async function generateChartCode(
    prompt: string,
    datasetPath: string | undefined,
    selectedModel: 'gemini' | 'openai' | 'claude'
): Promise<string> {
    const systemPrompt = `You are a Python data visualization expert. Generate clean, working Plotly code for interactive visualization.
Rules:
- Use pandas to load data from 'data.csv' (or provided path)
- Use 'plotly.express' or 'plotly.graph_objects'
- Assign the final figure to a variable named 'fig'
- Use a light theme (template='plotly_white' or default)
- Do NOT use matplotlib or seaborn
- Do NOT assume a column named 'target' exists unless you verify it or it's standard (e.g. use df.columns[-1] or heuristics)
- Handle missing values gracefully (dropna only if necessary, or fill)
- For classification metrics (confusion matrix, ROC, etc.):
  * Verify target columns are compatible types. 
  * If using sklearn, ensure data is numeric or properly encoded (use LabelEncoder if needed).
  * Drop NaNs in target columns explicitly before computing metrics.
- Keep code concise but complete`;

    const userPrompt = `Dataset: ${datasetPath || 'data.csv'}
Task: ${prompt}
Generate only the Python code, no explanations.`;

    try {
        let model;
        if (selectedModel === 'openai') {
            model = openai('gpt-4o');
        } else if (selectedModel === 'claude') {
            model = anthropic('claude-3-5-sonnet-20240620');
        } else {
            model = google('models/gemini-2.5-pro');
        }

        const { text } = await generateText({
            model,
            system: systemPrompt,
            prompt: userPrompt,
        });

        // Clean up code blocks
        return text.replace(/```python\n?/g, '').replace(/```\n?/g, '').trim();
    } catch (error) {
        console.error('AI Generation Error:', error);
        throw new Error(`Failed to generate chart code with ${selectedModel}: ${(error as Error).message}`);
    }
}

// GET: Fetch saved charts for a project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }

        // Fetch charts without orderBy to avoid index requirement, sort client-side
        const chartsSnapshot = await adminDb
            .collection('charts')
            .where('projectId', '==', projectId)
            .limit(50)
            .get();

        let charts = chartsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Sort client-side by createdAt descending
        charts.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        charts = charts.slice(0, 20);

        return NextResponse.json({ charts });

    } catch (error) {
        console.error('[ChartGen] GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch charts' }, { status: 500 });
    }
}
