import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET: Proxy endpoint to fetch remote datasets (handles CORS)
 * Used for "Import from URL" feature
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const url = searchParams.get('url');

        if (!url) {
            return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
        }

        // Validate URL
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
        }

        // Only allow http/https
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are supported' }, { status: 400 });
        }

        console.log(`[Dataset Proxy] Fetching: ${url}`);

        // Parse custom headers if provided (for API mode)
        const customHeadersParam = searchParams.get('headers');
        let customHeaders: Record<string, string> = {};
        if (customHeadersParam) {
            try {
                customHeaders = JSON.parse(customHeadersParam);
            } catch (e) {
                console.warn('[Dataset Proxy] Failed to parse custom headers');
            }
        }

        // Fetch the remote content
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 MLForge/1.0',
                'Accept': 'application/json, text/csv, */*',
                ...customHeaders
            },
            // Timeout after 30 seconds
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            return NextResponse.json({
                error: `Failed to fetch URL: ${response.status} ${response.statusText}`
            }, { status: response.status });
        }

        // Check content length (limit to 50MB for imports)
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
            return NextResponse.json({
                error: 'File too large. Maximum size for URL import is 50MB.'
            }, { status: 413 });
        }

        // Get content type
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Stream the response
        const blob = await response.blob();

        console.log(`[Dataset Proxy] Fetched ${blob.size} bytes, type: ${contentType}`);

        // Return as blob with appropriate headers
        return new NextResponse(blob, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': blob.size.toString(),
                'X-Original-URL': url,
                'Cache-Control': 'no-cache'
            }
        });

    } catch (error) {
        console.error('[Dataset Proxy] Error:', error);

        if (error instanceof Error && error.name === 'TimeoutError') {
            return NextResponse.json({ error: 'Request timed out' }, { status: 408 });
        }

        return NextResponse.json({
            error: 'Failed to fetch URL. Check the URL and try again.'
        }, { status: 500 });
    }
}
