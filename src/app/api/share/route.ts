import { NextResponse } from 'next/server';
import { addCollaborator, removeCollaborator, updateVisibility, getCollaborators } from '@/lib/collaboration';

export const runtime = 'nodejs';

/**
 * POST: Share a resource with a collaborator
 * PUT: Update visibility
 * DELETE: Remove a collaborator
 */
export async function POST(req: Request) {
    try {
        const { resourceType, resourceId, email, role, addedBy } = await req.json();

        if (!resourceType || !resourceId || !email || !role || !addedBy) {
            return NextResponse.json({
                error: 'Missing required fields'
            }, { status: 400 });
        }

        const result = await addCollaborator(resourceType, resourceId, { email, role }, addedBy);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('[Share API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to share';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { resourceType, resourceId, visibility } = await req.json();

        if (!resourceType || !resourceId || !visibility) {
            return NextResponse.json({
                error: 'Missing required fields'
            }, { status: 400 });
        }

        const result = await updateVisibility(resourceType, resourceId, visibility);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('[Share API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update visibility';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const resourceType = searchParams.get('resourceType') as 'datasets' | 'models' | 'projects';
        const resourceId = searchParams.get('resourceId');
        const collaboratorUid = searchParams.get('collaboratorUid');

        if (!resourceType || !resourceId || !collaboratorUid) {
            return NextResponse.json({
                error: 'Missing required fields'
            }, { status: 400 });
        }

        const result = await removeCollaborator(resourceType, resourceId, collaboratorUid);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('[Share API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to remove collaborator';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const resourceType = searchParams.get('resourceType') as 'datasets' | 'models' | 'projects';
        const resourceId = searchParams.get('resourceId');

        if (!resourceType || !resourceId) {
            return NextResponse.json({
                error: 'Missing required fields'
            }, { status: 400 });
        }

        const collaborators = await getCollaborators(resourceType, resourceId);
        return NextResponse.json({ collaborators });

    } catch (error: unknown) {
        console.error('[Share API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get collaborators';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
