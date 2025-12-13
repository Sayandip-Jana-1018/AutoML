import { NextResponse } from "next/server";
import { storage, TRAINING_BUCKET } from "@/lib/gcp";

export const runtime = "nodejs";

const MAX_CHUNK_SIZE = 64 * 1024; // 64KB max per response

/**
 * GET /api/studio/jobs/[jobId]/logs
 * 
 * Stream training logs from GCS with offset-based pagination.
 * Limits response to 64KB chunks to prevent large responses.
 * 
 * Query params:
 * - projectId: Required project ID
 * - offset: Byte offset to start reading from (default: 0)
 */
export async function GET(
    req: Request,
    context: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await context.params;
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get("projectId");
        const offset = parseInt(searchParams.get("offset") || "0");

        if (!projectId) {
            return NextResponse.json(
                { error: "Missing projectId query parameter" },
                { status: 400 }
            );
        }

        if (!jobId) {
            return NextResponse.json(
                { error: "Missing jobId" },
                { status: 400 }
            );
        }

        const bucket = storage.bucket(TRAINING_BUCKET);

        // Try primary path format
        let logPath = `projects/${projectId}/jobs/${jobId}/logs/output.log`;
        let file = bucket.file(logPath);
        let [exists] = await file.exists();

        // Try alternative path
        if (!exists) {
            logPath = `${projectId}/jobs/${jobId}/logs/output.log`;
            file = bucket.file(logPath);
            [exists] = await file.exists();
        }

        // Try without /logs/ subdirectory
        if (!exists) {
            logPath = `projects/${projectId}/jobs/${jobId}/output.log`;
            file = bucket.file(logPath);
            [exists] = await file.exists();
        }

        if (!exists) {
            return NextResponse.json({
                logs: "",
                offset: 0,
                complete: false,
                message: "Log file not found yet. Training may still be starting.",
                checkedPaths: [
                    `projects/${projectId}/jobs/${jobId}/logs/output.log`,
                    `${projectId}/jobs/${jobId}/logs/output.log`,
                    `projects/${projectId}/jobs/${jobId}/output.log`
                ]
            });
        }

        // Get file metadata for size
        const [metadata] = await file.getMetadata();
        const size = parseInt(metadata.size as string);

        // If offset is at or past file size, no new content
        if (offset >= size) {
            return NextResponse.json({
                logs: "",
                offset: offset,
                complete: false,
                size: size
            });
        }

        // Limit chunk size to prevent huge responses
        const endByte = Math.min(offset + MAX_CHUNK_SIZE, size);

        // Stream from offset to calculated end
        const stream = file.createReadStream({
            start: offset,
            end: endByte - 1 // end is inclusive
        });

        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk as Buffer);
        }

        const logs = Buffer.concat(chunks).toString("utf-8");

        // Check for completion markers
        const complete = logs.includes("[TRAINING COMPLETE]") ||
            logs.includes("Training completed successfully") ||
            logs.includes("Job finished with state:") ||
            logs.includes("metrics.json saved");

        return NextResponse.json({
            logs,
            offset: endByte,
            complete,
            size,
            path: logPath
        });

    } catch (error: unknown) {
        console.error("[Logs API] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch logs";
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
