
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, getStorageBucket } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/visualize/save-plot
 * 
 * Uploads a base64 image to GCS and returns the GCS path.
 */
export async function POST(request: NextRequest) {
    try {
        // Auth check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        await adminAuth.verifyIdToken(token);

        const { projectId, chartId, imageBase64, plotData } = await request.json();

        if (!projectId || !chartId || (!imageBase64 && !plotData)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let buffer: Buffer;
        let contentType: string;
        let extension: string;

        if (plotData) {
            // Handle JSON data (Plotly)
            buffer = Buffer.from(typeof plotData === 'string' ? plotData : JSON.stringify(plotData), 'utf-8');
            contentType = 'application/json';
            extension = 'json';
        } else {
            // Handle Base64 Image (Matplotlib/Legacy)
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            buffer = Buffer.from(base64Data, 'base64');
            contentType = 'image/png';
            extension = 'png';
        }

        const bucket = getStorageBucket();
        // Path: projects/[id]/visualizations/[chartId]/output.[ext]
        const gcsPath = `projects/${projectId}/visualizations/${chartId}/output.${extension}`;
        const file = bucket.file(gcsPath);

        await file.save(buffer, {
            contentType,
            metadata: {
                projectId,
                chartId,
                generatedBy: 'mlforge-studio'
            }
        });

        // Return the GCS URI
        // gs://bucket/path
        const gsUri = `gs://${bucket.name}/${gcsPath}`;

        return NextResponse.json({ success: true, imageUrl: gsUri });

    } catch (error: any) {
        console.error('[SavePlot] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
