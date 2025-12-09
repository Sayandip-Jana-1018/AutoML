import { NextResponse } from 'next/server';
import { suggestTemplate, getTemplatesForTier, getQuickStartConfig } from '@/lib/templates';

export const runtime = 'nodejs';

/**
 * Template Suggestions API
 * GET: Get suggested template based on dataset characteristics
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const taskType = searchParams.get('taskType') as 'classification' | 'regression' | null;
        const tier = (searchParams.get('tier') || 'free') as 'free' | 'silver' | 'gold';
        const datasetSize = parseInt(searchParams.get('datasetSize') || '1000');
        const numClasses = searchParams.get('numClasses') ? parseInt(searchParams.get('numClasses')!) : undefined;

        if (taskType) {
            // Get specific suggestion
            const template = suggestTemplate(taskType, tier, datasetSize, numClasses);
            const quickStart = getQuickStartConfig(template);

            return NextResponse.json({
                suggestion: template,
                quickStartConfig: quickStart,
                allAvailable: getTemplatesForTier(tier).filter(t => t.taskType === taskType)
            });
        }

        // Return all templates for tier
        const templates = getTemplatesForTier(tier);
        return NextResponse.json({ templates });

    } catch (error: unknown) {
        console.error('[Templates API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get templates';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
