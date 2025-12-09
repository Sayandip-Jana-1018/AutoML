import { NextResponse } from 'next/server';
import { getAnalyticsSummary, getUserAnalytics } from '@/lib/telemetry';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * Admin Analytics API
 * GET: Retrieve usage statistics and metrics
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const startDate = searchParams.get('startDate') || getDefaultStartDate();
        const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        const type = searchParams.get('type') || 'summary';

        // If requesting user-specific analytics
        if (userId && type === 'user') {
            const userAnalytics = await getUserAnalytics(userId);
            return NextResponse.json(userAnalytics);
        }

        // Get overall summary
        const summary = await getAnalyticsSummary(startDate, endDate);

        // Get additional metrics
        const [usersCount, projectsCount, activeJobsCount] = await Promise.all([
            getCollectionCount('users'),
            getCollectionCount('projects'),
            getActiveJobsCount()
        ]);

        // Get tier distribution
        const tierDistribution = await getTierDistribution();

        return NextResponse.json({
            ...summary,
            overview: {
                totalUsers: usersCount,
                totalProjects: projectsCount,
                activeJobs: activeJobsCount,
                tierDistribution
            },
            dateRange: { startDate, endDate },
            generatedAt: new Date().toISOString()
        });

    } catch (error: unknown) {
        console.error('[Analytics API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analytics';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

function getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Last 30 days
    return date.toISOString().split('T')[0];
}

async function getCollectionCount(collection: string): Promise<number> {
    try {
        const snapshot = await adminDb.collection(collection).count().get();
        return snapshot.data().count;
    } catch {
        return 0;
    }
}

async function getActiveJobsCount(): Promise<number> {
    try {
        const snapshot = await adminDb
            .collectionGroup('jobs')
            .where('status', 'in', ['PROVISIONING', 'PENDING', 'RUNNING'])
            .count()
            .get();
        return snapshot.data().count;
    } catch {
        return 0;
    }
}

async function getTierDistribution(): Promise<Record<string, number>> {
    try {
        const snapshot = await adminDb.collection('users').get();
        const distribution: Record<string, number> = { free: 0, silver: 0, gold: 0 };

        snapshot.docs.forEach(doc => {
            const tier = doc.data().tier || 'free';
            distribution[tier] = (distribution[tier] || 0) + 1;
        });

        return distribution;
    } catch {
        return { free: 0, silver: 0, gold: 0 };
    }
}
