import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/notebook/export
 * Export project code as Jupyter Notebook
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, code, datasetInfo, modelInfo } = body;

        if (!projectId || !code) {
            return NextResponse.json(
                { error: 'Missing projectId or code' },
                { status: 400 }
            );
        }

        // Get project info
        const projectDoc = await adminDb.collection('projects').doc(projectId).get();
        const projectData = projectDoc.data();
        const projectName = projectData?.name || 'MLForge Project';

        // Generate Jupyter Notebook JSON
        const notebook = {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: {
                kernelspec: {
                    display_name: 'Python 3',
                    language: 'python',
                    name: 'python3'
                },
                language_info: {
                    name: 'python',
                    version: '3.10.0'
                },
                mlforge: {
                    projectId,
                    projectName,
                    exportedAt: new Date().toISOString()
                }
            },
            cells: [
                // Cell 1: Title and Metadata
                {
                    cell_type: 'markdown',
                    metadata: {},
                    source: [
                        `# ${projectName}\n`,
                        '\n',
                        `**Exported from MLForge Studio**\n`,
                        `- Project ID: \`${projectId}\`\n`,
                        `- Exported: ${new Date().toLocaleDateString()}\n`,
                        '\n',
                        '---'
                    ]
                },
                // Cell 2: Install Dependencies
                {
                    cell_type: 'code',
                    execution_count: null,
                    metadata: { tags: ['setup'] },
                    outputs: [],
                    source: [
                        '# Install required dependencies\n',
                        '!pip install pandas numpy scikit-learn matplotlib seaborn -q'
                    ]
                },
                // Cell 3: Download Dataset (if available)
                ...(datasetInfo?.gcsPath ? [{
                    cell_type: 'code',
                    execution_count: null,
                    metadata: { tags: ['data'] },
                    outputs: [],
                    source: [
                        '# Download dataset from MLForge cloud\n',
                        `# Dataset: ${datasetInfo.filename || 'data.csv'}\n`,
                        '!pip install gcsfs -q\n',
                        '\n',
                        'import pandas as pd\n',
                        `df = pd.read_csv("${datasetInfo.gcsPath}")\n`,
                        'df.head()'
                    ]
                }] : []),
                // Cell 4: Main Training Code
                {
                    cell_type: 'code',
                    execution_count: null,
                    metadata: { tags: ['training'] },
                    outputs: [],
                    source: code.split('\n').map((line: string, i: number, arr: string[]) =>
                        i < arr.length - 1 ? line + '\n' : line
                    )
                },
                // Cell 5: Visualization
                {
                    cell_type: 'code',
                    execution_count: null,
                    metadata: { tags: ['visualization'] },
                    outputs: [],
                    source: [
                        '# Visualize Results\n',
                        'import matplotlib.pyplot as plt\n',
                        'import seaborn as sns\n',
                        '\n',
                        '# Uncomment to visualize your model results:\n',
                        "# plt.figure(figsize=(10, 6))\n",
                        "# plt.title('Model Results')\n",
                        '# plt.show()'
                    ]
                },
                // Cell 6: Model Info (if available)
                ...(modelInfo ? [{
                    cell_type: 'markdown',
                    metadata: {},
                    source: [
                        '## Model Information\n',
                        '\n',
                        `- **Task Type:** ${modelInfo.taskType || 'Unknown'}\n`,
                        `- **Accuracy:** ${modelInfo.accuracy ? (modelInfo.accuracy * 100).toFixed(2) + '%' : 'N/A'}\n`,
                        `- **Algorithm:** ${modelInfo.algorithm || 'Auto-selected'}\n`
                    ]
                }] : [])
            ]
        };

        // Return notebook as JSON
        return NextResponse.json({
            success: true,
            notebook,
            filename: `${projectName.replace(/\s+/g, '_')}.ipynb`
        });

    } catch (error: any) {
        console.error('[Notebook Export] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to export notebook' },
            { status: 500 }
        );
    }
}
