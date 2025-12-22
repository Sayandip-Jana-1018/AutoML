import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST: Download dataset from Kaggle
 * Requires dataset name (username/dataset-name) and API key
 */
export async function POST(req: Request) {
    try {
        let { dataset, apiKey, username } = await req.json();

        // Fallback to server-side environment variables if not provided
        if (!apiKey) {
            // Check for any valid key in environment (Legacy or New)
            if (process.env.KAGGLE_KEY) {
                console.log('[Kaggle] Using KAGGLE_KEY from environment');
                apiKey = process.env.KAGGLE_KEY;
                username = process.env.KAGGLE_USERNAME;
            } else if (process.env.KAGGLE_API_KEY) {
                console.log('[Kaggle] Using KAGGLE_API_KEY from environment');
                apiKey = process.env.KAGGLE_API_KEY;
                username = process.env.KAGGLE_USERNAME;
            }
        }

        if (!dataset || !apiKey) {
            return NextResponse.json({ error: 'Missing dataset or API key (and not found in env)' }, { status: 400 });
        }

        // Parse dataset: expect format "username/dataset-name"
        const parts = dataset.split('/');
        if (parts.length !== 2) {
            return NextResponse.json({
                error: 'Invalid dataset format. Use: username/dataset-name'
            }, { status: 400 });
        }

        const [owner, datasetName] = parts.map((p: string) => p.trim());

        console.log(`[Kaggle] Downloading dataset: ${owner}/${datasetName}`);

        // Kaggle API supports both Basic Auth (username:key) and Bearer Token (KGAT)
        let authHeader = '';
        if (apiKey.trim().startsWith('KGAT')) {
            authHeader = `Bearer ${apiKey.trim()}`;
        } else {
            // Legacy Basic Auth
            const authUsername = username?.trim() || 'kaggle';
            console.log(`[Kaggle] Authenticating as user: ${authUsername}`);
            const authString = Buffer.from(`${authUsername}:${apiKey.trim()}`).toString('base64');
            authHeader = `Basic ${authString}`;
        }

        // Direct download (skip metadata check to avoid 404s on some endpoints)
        const downloadUrl = `https://www.kaggle.com/api/v1/datasets/download/${owner}/${datasetName}`;
        const downloadRes = await fetch(downloadUrl, {
            headers: {
                'Authorization': authHeader,
                'User-Agent': 'MLForge/1.0 (Integration Test)'
            },
            // Timeout after 2 minutes for large datasets
            signal: AbortSignal.timeout(120000)
        });

        if (!downloadRes.ok) {
            const errorText = await downloadRes.text();
            console.error(`[Kaggle] Download failed: ${downloadRes.status}`, errorText);

            let errorMessage = `Failed to download dataset: ${downloadRes.status}`;
            if (downloadRes.status === 403) {
                errorMessage = "Permission denied (403). Check your API Key/Token.";
                if (authHeader.startsWith('Bearer')) {
                    errorMessage += " You are using a Bearer Token (KGAT). Ensure it has the correct scopes or try generating a standard API Key (username + hex key) from Kaggle settings.";
                } else if (!username || username === 'kaggle') {
                    errorMessage += " For Basic Auth, a valid KAGGLE_USERNAME in .env is required. Defaulted to 'kaggle'.";
                }

                // Common cause: Unaccepted rules or phone verification
                errorMessage += " NOTE: This dataset might require accepting rules or phone verification on Kaggle.";
            } else if (downloadRes.status === 404) {
                errorMessage = "Dataset not found (404). Check the 'username/dataset-name' format.";
            }

            return NextResponse.json({
                error: errorMessage,
                details: errorText
            }, { status: downloadRes.status });
        }

        // Get the blob
        const blob = await downloadRes.blob();

        console.log(`[Kaggle] Downloaded ${blob.size} bytes for ${owner}/${datasetName}`);

        // Return the zip file
        return new NextResponse(blob, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Length': blob.size.toString(),
                'Content-Disposition': `attachment; filename="${datasetName}.zip"`,
                'X-Dataset-Name': `${owner}/${datasetName}`
            }
        });

    } catch (error) {
        console.error('[Kaggle] Error:', error);

        if (error instanceof Error && error.name === 'TimeoutError') {
            return NextResponse.json({ error: 'Download timed out. The dataset may be too large.' }, { status: 408 });
        }

        return NextResponse.json({
            error: 'Failed to download from Kaggle. Check your credentials and try again.'
        }, { status: 500 });
    }
}
