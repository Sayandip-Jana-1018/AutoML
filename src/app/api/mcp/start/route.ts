import { NextRequest, NextResponse } from 'next/server';
import { spawn, exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        // Get the project root directory
        const projectRoot = process.cwd();
        const mcpServerPath = path.join(projectRoot, 'mcp-server');

        // Check if already running first
        try {
            const healthCheck = await fetch('http://localhost:4000/health', {
                signal: AbortSignal.timeout(1000),
            });
            if (healthCheck.ok) {
                return NextResponse.json({
                    success: true,
                    message: 'MCP server is already running',
                    alreadyRunning: true,
                });
            }
        } catch {
            // Not running, continue to start
        }

        // Use different approach for Windows - exec with full command
        const isWindows = process.platform === 'win32';
        const command = isWindows
            ? `cd /d "${mcpServerPath}" && npm start`
            : `cd "${mcpServerPath}" && npm start`;

        // Start server in background using exec
        const child = exec(command, {
            cwd: mcpServerPath,
            windowsHide: true,
        });

        // Don't wait for it to finish, just detach
        child.unref?.();

        // Wait for server to be ready
        for (let i = 0; i < 10; i++) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            try {
                const healthCheck = await fetch('http://localhost:4000/health', {
                    signal: AbortSignal.timeout(1000),
                });
                if (healthCheck.ok) {
                    return NextResponse.json({
                        success: true,
                        message: 'MCP server started successfully',
                        pid: child.pid,
                    });
                }
            } catch {
                // Keep waiting
            }
        }

        return NextResponse.json({
            success: false,
            message: 'MCP server start command issued but server not responding. Please start manually: cd mcp-server && npm start',
        }, { status: 500 });

    } catch (error: any) {
        console.error('[MCP Start] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to start MCP server',
                hint: 'Try running manually: cd mcp-server && npm start',
            },
            { status: 500 }
        );
    }
}
