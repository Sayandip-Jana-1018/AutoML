import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        // Auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const { code, error, datasetPath, projectId } = await request.json();

        // Fetch schema if projectId is provided
        let schemaContext = '';
        if (projectId) {
            try {
                // Try to get dataset schema from project or its datasets subcollection
                const projectDoc = await adminDb.collection('projects').doc(projectId).get();
                const projectData = projectDoc.data();
                let datasetSchema: { columns: string[], columnTypes: Record<string, string>, rowCount: number, datasetType: string } | null = null;

                if (projectData) {
                    const datasetsSnap = await adminDb.collection('projects').doc(projectId)
                        .collection('datasets').orderBy('createdAt', 'desc').limit(1).get();

                    if (!datasetsSnap.empty) {
                        const dsData = datasetsSnap.docs[0].data();
                        datasetSchema = {
                            columns: dsData.columns || dsData.schema?.columns || [],
                            columnTypes: dsData.columnTypes || dsData.schema?.columnTypes || {},
                            rowCount: dsData.rowCount || dsData.schema?.rowCount || 0,
                            datasetType: dsData.type || projectData.dataset?.type || 'tabular'
                        };
                    } else if (projectData.dataset) {
                        datasetSchema = {
                            columns: projectData.dataset.columns || [],
                            columnTypes: projectData.dataset.columnTypes || {},
                            rowCount: projectData.dataset.rowCount || 0,
                            datasetType: projectData.dataset.type || 'tabular'
                        };
                    }
                }

                if (datasetSchema && datasetSchema.columns.length > 0) {
                    const columnsInfo = datasetSchema.columns.map(col => {
                        const type = datasetSchema.columnTypes[col] || 'unknown';
                        return `  - ${col} (${type})`;
                    }).join('\n');
                    schemaContext = `
Dataset Infomation:
- Total rows: ${datasetSchema.rowCount}
- Dataset type: ${datasetSchema.datasetType}
- Columns:
${columnsInfo}
`;
                }
            } catch (schemaErr) {
                console.warn('Failed to fetch schema for repair:', schemaErr);
            }
        }

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

        const userPrompt = `${schemaContext}
Code:
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
