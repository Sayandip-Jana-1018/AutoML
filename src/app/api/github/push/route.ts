import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateRepo, pushScript, getFileCommits } from '@/lib/git-sync';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/github/push
 * Push train.py to GitHub
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, code, commitMessage } = body;

        if (!projectId || !code) {
            return NextResponse.json(
                { error: 'Missing required fields: projectId and code' },
                { status: 400 }
            );
        }

        // Get project info
        const projectDoc = await adminDb.collection('projects').doc(projectId).get();
        if (!projectDoc.exists) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }
        const projectData = projectDoc.data();
        const projectName = projectData?.name || projectId;

        // Get or create repo
        const repo = await getOrCreateRepo(projectName);
        if (!repo) {
            return NextResponse.json(
                { error: 'Failed to access GitHub. Check GITHUB_PAT env variable.' },
                { status: 500 }
            );
        }

        // Push the script
        const result = await pushScript(
            repo,
            'train.py',
            code,
            commitMessage || `Update train.py from MLForge`
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        // Save repo info to project
        await adminDb.collection('projects').doc(projectId).update({
            githubRepo: repo.url,
            lastPushedAt: new Date()
        });

        return NextResponse.json({
            success: true,
            repoUrl: repo.url,
            commitUrl: result.commitUrl,
            commitSha: result.commitSha
        });

    } catch (error: any) {
        console.error('[GitHub Push] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to push to GitHub' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/github/push?projectId=xxx
 * Get push history for a project
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json(
                { error: 'Missing projectId' },
                { status: 400 }
            );
        }

        // Get project repo info
        const projectDoc = await adminDb.collection('projects').doc(projectId).get();
        if (!projectDoc.exists) {
            return NextResponse.json({ commits: [], repoUrl: null });
        }

        const projectData = projectDoc.data();
        const repoUrl = projectData?.githubRepo;

        if (!repoUrl) {
            return NextResponse.json({ commits: [], repoUrl: null });
        }

        // Extract owner/repo from URL
        const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
            return NextResponse.json({ commits: [], repoUrl });
        }

        const repo = {
            owner: match[1],
            repo: match[2],
            url: repoUrl,
            defaultBranch: 'main'
        };

        const commits = await getFileCommits(repo, 'train.py');

        return NextResponse.json({ commits, repoUrl });

    } catch (error: any) {
        console.error('[GitHub Push GET] Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
