import { NextResponse } from 'next/server';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:4000';

export async function GET() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(`${MCP_SERVER_URL}/health`, {
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
            return NextResponse.json(
                { status: 'unhealthy', error: 'MCP server returned error' },
                { status: 503 }
            );
        }

        const data = await res.json();

        return NextResponse.json({
            status: 'healthy',
            mcpServer: {
                ...data,
                url: MCP_SERVER_URL,
            },
        });
    } catch (error: any) {
        console.error('[MCP Health] Error:', error);

        if (error.name === 'AbortError') {
            return NextResponse.json(
                {
                    status: 'unreachable',
                    error: 'MCP server timed out',
                    instructions: 'Run: cd mcp-server && npm start',
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            {
                status: 'unreachable',
                error: error.message || 'MCP server not running',
                instructions: 'Run: cd mcp-server && npm start',
            },
            { status: 503 }
        );
    }
}
