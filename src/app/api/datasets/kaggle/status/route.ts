import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET: Check if Kaggle credentials are configured on the server
 */
export async function GET() {
    const configured = !!(process.env.KAGGLE_KEY || process.env.KAGGLE_API_KEY) && !!process.env.KAGGLE_USERNAME;

    return NextResponse.json({
        configured,
        // Don't leak the actual keys, just confirmation
        hasUsername: !!process.env.KAGGLE_USERNAME,
        hasKey: !!(process.env.KAGGLE_KEY || process.env.KAGGLE_API_KEY)
    });
}
