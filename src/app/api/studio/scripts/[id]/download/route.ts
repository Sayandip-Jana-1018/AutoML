import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const format = searchParams.get('format') || 'py';
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        // Get script version from Firestore
        const versionDoc = await getDoc(doc(db, 'projects', projectId, 'scripts', params.id));

        if (!versionDoc.exists()) {
            return NextResponse.json({ error: 'Version not found' }, { status: 404 });
        }

        const versionData = versionDoc.data();
        const content = versionData.content || `# Version ${versionData.version}\n# No content available`;
        const version = versionData.version || 1;

        if (format === 'ipynb') {
            // Create Jupyter Notebook format
            const notebook = {
                nbformat: 4,
                nbformat_minor: 5,
                metadata: {
                    kernelspec: {
                        display_name: 'Python 3',
                        language: 'python',
                        name: 'python3',
                    },
                    language_info: {
                        name: 'python',
                        version: '3.10.0',
                    },
                    mlforge: {
                        projectId,
                        version,
                        exportedAt: new Date().toISOString(),
                    },
                },
                cells: [
                    {
                        cell_type: 'markdown',
                        metadata: {},
                        source: [`# MLForge Training Script v${version}\n\nExported from MLForge Studio`],
                    },
                    {
                        cell_type: 'code',
                        metadata: {},
                        source: content.split('\n').map((line: string, i: number, arr: string[]) =>
                            i === arr.length - 1 ? line : line + '\n'
                        ),
                        execution_count: null,
                        outputs: [],
                    },
                ],
            };

            return new NextResponse(JSON.stringify(notebook, null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="train_v${version}.ipynb"`,
                },
            });
        }

        // Default: Python file
        return new NextResponse(content, {
            headers: {
                'Content-Type': 'text/x-python',
                'Content-Disposition': `attachment; filename="train_v${version}.py"`,
            },
        });
    } catch (error: any) {
        console.error('[Download Script] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to download script' },
            { status: 500 }
        );
    }
}
