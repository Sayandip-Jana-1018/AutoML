import { NextRequest, NextResponse } from 'next/server';
import { createCollabLink, getProjectCollabLinks } from '@/lib/collaboration';

export const runtime = 'nodejs';

/**
 * POST /api/collab/create
 * Create a new collaboration link for a project
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, userId, userEmail, mode, role, expiresInHours, maxUses } = body;

        if (!projectId || !userId) {
            return NextResponse.json(
                { error: 'Missing required fields: projectId, userId' },
                { status: 400 }
            );
        }

        if (!mode || !['private', 'public'].includes(mode)) {
            return NextResponse.json(
                { error: 'Invalid mode. Must be "private" or "public"' },
                { status: 400 }
            );
        }

        if (!role || !['view', 'edit'].includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role. Must be "view" or "edit"' },
                { status: 400 }
            );
        }

        const result = await createCollabLink({
            projectId,
            creatorId: userId,
            creatorEmail: userEmail,
            mode,
            role,
            expiresInHours: expiresInHours || undefined,
            maxUses: maxUses || undefined
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        // Build full link URL
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const fullUrl = `${baseUrl}/collab/${result.linkId}`;

        return NextResponse.json({
            linkId: result.linkId,
            url: fullUrl,
            message: 'Collaboration link created successfully'
        });

    } catch (error: any) {
        console.error('[Collab Create] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create link' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/collab/create?projectId=xxx&userId=xxx
 * Get all active links for a project
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const userId = searchParams.get('userId');

        if (!projectId || !userId) {
            return NextResponse.json(
                { error: 'Missing projectId or userId' },
                { status: 400 }
            );
        }

        const links = await getProjectCollabLinks(projectId, userId);

        // Add full URLs
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const linksWithUrls = links.map(link => ({
            ...link,
            url: `${baseUrl}/collab/${link.id}`
        }));

        return NextResponse.json({ links: linksWithUrls });

    } catch (error: any) {
        console.error('[Collab Create] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch links' },
            { status: 500 }
        );
    }
}
