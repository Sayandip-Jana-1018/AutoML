/**
 * POST /api/mcp/sync-script
 * 
 * Sync code from VS Code to Firestore.
 * Called by VS Code extension when user saves or pushes code.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, code, token, source = 'vscode' } = body;

        if (!projectId || !code) {
            return NextResponse.json(
                { error: 'Missing projectId or code' },
                { status: 400 }
            );
        }

        // Verify the session token if provided
        if (token) {
            const sessionDoc = await adminDb.collection('mcp_sessions').doc(projectId).get();
            if (sessionDoc.exists) {
                const sessionData = sessionDoc.data();
                if (sessionData?.token !== token) {
                    console.warn('[MCP Sync Script] Invalid token for project:', projectId);
                    // Don't fail - still allow sync, just log the warning
                }
            }
        }

        // Get current project data
        const projectRef = adminDb.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();

        if (!projectDoc.exists) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        const projectData = projectDoc.data();
        const currentScript = projectData?.currentScript || '';

        // Only update if code actually changed
        if (currentScript === code) {
            return NextResponse.json({
                success: true,
                message: 'Code already in sync',
                changed: false
            });
        }

        // Update the project script
        await projectRef.update({
            currentScript: code,
            lastUpdated: FieldValue.serverTimestamp(),
            lastSyncSource: source,
            lastSyncAt: FieldValue.serverTimestamp()
        });

        // Create a new script version
        const scriptsRef = projectRef.collection('scripts');
        const versionsSnap = await scriptsRef.orderBy('version', 'desc').limit(1).get();
        const nextVersion = versionsSnap.empty ? 1 : (versionsSnap.docs[0].data().version || 0) + 1;

        await scriptsRef.add({
            version: nextVersion,
            content: code,
            createdAt: FieldValue.serverTimestamp(),
            source,
            message: `Synced from ${source}`
        });

        console.log(`[MCP Sync Script] Updated project ${projectId} from ${source}, version ${nextVersion}`);

        return NextResponse.json({
            success: true,
            message: 'Code synced successfully',
            changed: true,
            version: nextVersion
        });

    } catch (error: any) {
        console.error('[MCP Sync Script] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to sync script' },
            { status: 500 }
        );
    }
}
