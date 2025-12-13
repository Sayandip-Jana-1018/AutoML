import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

interface NotebookCell {
    cell_type: 'code' | 'markdown' | 'raw';
    source: string | string[];
    metadata?: Record<string, any>;
}

interface NotebookJSON {
    cells: NotebookCell[];
    metadata?: {
        mlforge?: {
            projectId?: string;
        };
    };
}

/**
 * POST /api/notebook/import
 * Import a Jupyter Notebook and extract code cells
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { notebook, projectId, userId } = body;

        if (!notebook || !projectId) {
            return NextResponse.json(
                { error: 'Missing notebook data or projectId' },
                { status: 400 }
            );
        }

        const nbData: NotebookJSON = typeof notebook === 'string'
            ? JSON.parse(notebook)
            : notebook;

        if (!nbData.cells || !Array.isArray(nbData.cells)) {
            return NextResponse.json(
                { error: 'Invalid notebook format - no cells found' },
                { status: 400 }
            );
        }

        // Extract code cells and combine into script
        const codeCells = nbData.cells.filter(cell => cell.cell_type === 'code');

        const codeLines: string[] = [];
        codeLines.push('# Imported from Jupyter Notebook');
        codeLines.push(`# Project: ${projectId}`);
        codeLines.push(`# Imported: ${new Date().toISOString()}`);
        codeLines.push('');

        for (const cell of codeCells) {
            const source = Array.isArray(cell.source)
                ? cell.source.join('')
                : cell.source;

            // Skip pip install and magic commands
            const lines = source.split('\n').filter((line: string) => {
                const trimmed = line.trim();
                return !trimmed.startsWith('!') &&
                    !trimmed.startsWith('%') &&
                    !trimmed.startsWith('get_ipython');
            });

            if (lines.length > 0) {
                codeLines.push(...lines);
                codeLines.push('');
            }
        }

        const extractedCode = codeLines.join('\n').trim();

        // Save as new script version
        const versionRef = adminDb.collection('projects').doc(projectId).collection('script_versions').doc();
        await versionRef.set({
            code: extractedCode,
            message: 'Imported from Jupyter Notebook',
            userId: userId || 'import',
            createdAt: new Date(),
            source: 'jupyter'
        });

        // Update main script
        await adminDb.collection('projects').doc(projectId).update({
            trainScript: extractedCode,
            lastUpdated: new Date()
        });

        return NextResponse.json({
            success: true,
            code: extractedCode,
            cellCount: codeCells.length,
            versionId: versionRef.id
        });

    } catch (error: any) {
        console.error('[Notebook Import] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to import notebook' },
            { status: 500 }
        );
    }
}
