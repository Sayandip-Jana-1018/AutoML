import { NextRequest, NextResponse } from 'next/server';
import { validateCollabLink, consumeCollabLink, revokeCollabLink } from '@/lib/collaboration';

export const runtime = 'nodejs';

interface RouteParams {
    params: { linkId: string };
}

/**
 * GET /api/collab/[linkId]
 * Validate a collaboration link
 */
export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const { linkId } = params;

        if (!linkId) {
            return NextResponse.json(
                { error: 'Missing linkId' },
                { status: 400 }
            );
        }

        const result = await validateCollabLink(linkId);

        if (!result.valid) {
            return NextResponse.json(
                { valid: false, error: result.error },
                { status: 404 }
            );
        }

        return NextResponse.json({
            valid: true,
            link: result.link,
            project: result.project
        });

    } catch (error: any) {
        console.error('[Collab Validate] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to validate link' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/collab/[linkId]
 * Consume a collaboration link (use it to gain access)
 */
export async function POST(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const { linkId } = params;
        const body = await request.json();
        const { userId, userEmail } = body;

        if (!linkId) {
            return NextResponse.json(
                { error: 'Missing linkId' },
                { status: 400 }
            );
        }

        const result = await consumeCollabLink(linkId, userId, userEmail);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            projectId: result.projectId,
            role: result.role,
            redirectUrl: `/studio/${result.projectId}`
        });

    } catch (error: any) {
        console.error('[Collab Consume] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to use link' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/collab/[linkId]
 * Revoke a collaboration link
 */
export async function DELETE(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const { linkId } = params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!linkId || !userId) {
            return NextResponse.json(
                { error: 'Missing linkId or userId' },
                { status: 400 }
            );
        }

        const result = await revokeCollabLink(linkId, userId);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Link revoked successfully'
        });

    } catch (error: any) {
        console.error('[Collab Revoke] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to revoke link' },
            { status: 500 }
        );
    }
}
