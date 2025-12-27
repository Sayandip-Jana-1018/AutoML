import { NextResponse } from 'next/server';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:4000';

export async function GET() {
    // First, check if WebSocket MCP server is running (optional, for real-time sync)
    let wsServerAvailable = false;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(`${MCP_SERVER_URL}/health`, {
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) {
            wsServerAvailable = true;
        }
    } catch {
        // WebSocket server not available - that's fine
    }

    // Always return healthy - HTTP sync always works via Next.js API
    return NextResponse.json({
        status: 'healthy',
        mode: wsServerAvailable ? 'websocket' : 'http-only',
        message: wsServerAvailable
            ? 'Full sync with WebSocket'
            : 'HTTP-only sync (save in VS Code to sync)',
        httpSyncAvailable: true,
        websocketSyncAvailable: wsServerAvailable,
        mcpServer: wsServerAvailable ? { url: MCP_SERVER_URL } : null,
    });
}

