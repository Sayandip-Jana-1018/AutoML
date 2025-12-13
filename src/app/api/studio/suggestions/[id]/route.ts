"use server";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { checkProjectPermission } from "@/lib/suggestion-utils";

export const runtime = "nodejs";

interface RouteContext {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/studio/suggestions/[id]
 * Fetch a single suggestion by ID
 */
export async function GET(req: Request, context: RouteContext) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json(
                { error: "Missing suggestion ID" },
                { status: 400 }
            );
        }

        const suggestionDoc = await adminDb.collection("suggestions").doc(id).get();

        if (!suggestionDoc.exists) {
            return NextResponse.json(
                { error: "Suggestion not found" },
                { status: 404 }
            );
        }

        const data = suggestionDoc.data();

        // Parse sanitization warnings if stored as pattern names
        let sanitization = data?.sanitization;
        if (sanitization && sanitization.warnings && Array.isArray(sanitization.warnings)) {
            // If warnings are just pattern names, convert to full objects
            if (typeof sanitization.warnings[0] === 'string') {
                sanitization = {
                    ...sanitization,
                    warnings: sanitization.warnings.map((pattern: string) => ({
                        pattern,
                        severity: 'medium',
                        message: `Code contains '${pattern}'. This may have side effects.`
                    })),
                    blockers: (sanitization.blockers || []).map((pattern: string) => ({
                        pattern,
                        message: `Detected '${pattern}' which could be dangerous. Review carefully before applying.`
                    }))
                };
            }
        }

        return NextResponse.json({
            suggestion: {
                id: suggestionDoc.id,
                ...data,
                sanitization,
                createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
                appliedAt: data?.appliedAt?.toDate?.()?.toISOString() || null
            }
        });

    } catch (error: unknown) {
        console.error("[Suggestions API] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch suggestion";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

/**
 * PATCH /api/studio/suggestions/[id]
 * Mark suggestion as applied with audit trail and diff storage
 */
export async function PATCH(req: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const {
            appliedBy,
            appliedByEmail,
            extractedCode,
            currentScript, // For diff generation
            appliedToVersion // Track which version we're applying to
        } = await req.json();

        if (!id) {
            return NextResponse.json(
                { error: "Missing suggestion ID" },
                { status: 400 }
            );
        }

        if (!appliedBy) {
            return NextResponse.json(
                { error: "Missing appliedBy field" },
                { status: 400 }
            );
        }

        // Verify suggestion exists
        const suggestionDoc = await adminDb.collection("suggestions").doc(id).get();
        if (!suggestionDoc.exists) {
            return NextResponse.json(
                { error: "Suggestion not found" },
                { status: 404 }
            );
        }

        const suggestionData = suggestionDoc.data();
        const projectId = suggestionData?.projectId;

        if (!projectId) {
            return NextResponse.json(
                { error: "Suggestion has no associated project" },
                { status: 400 }
            );
        }

        // Permission check using utility
        const permission = await checkProjectPermission(projectId, appliedBy, appliedByEmail, 'edit');
        if (!permission.allowed) {
            return NextResponse.json(
                { error: permission.reason || "You do not have permission to apply this suggestion" },
                { status: 403 }
            );
        }

        // Generate diff if currentScript provided
        const codeToApply = extractedCode || suggestionData?.extractedCode || '';
        let appliedPatch: { diff: string } | null = null;

        if (currentScript && codeToApply) {
            const { generateDiff } = await import("@/lib/diff-utils");
            const diff = generateDiff(currentScript, codeToApply);
            appliedPatch = { diff };
        }

        // Check for version mismatch
        const versionMismatch = appliedToVersion &&
            suggestionData?.targetScriptVersion &&
            appliedToVersion !== suggestionData.targetScriptVersion;

        // Update suggestion as applied with full audit trail
        await adminDb.collection("suggestions").doc(id).update({
            applied: true,
            appliedBy,
            appliedByEmail,
            appliedAt: FieldValue.serverTimestamp(),
            appliedCode: codeToApply,
            appliedPatch, // Store the diff
            appliedToVersion: appliedToVersion || null,
            versionMismatchOnApply: versionMismatch || false,
            currentScriptBeforeApply: currentScript || null, // For rollback
            // Audit metadata
            audit: FieldValue.arrayUnion({
                action: 'applied',
                by: appliedByEmail,
                at: new Date().toISOString(),
                codeLength: codeToApply.length,
                hasDiff: !!appliedPatch,
                appliedToVersion: appliedToVersion || null,
                versionMismatch: versionMismatch || false
            })
        });

        return NextResponse.json({
            success: true,
            message: "Suggestion marked as applied",
            appliedAt: new Date().toISOString(),
            hasDiff: !!appliedPatch,
            versionMismatch: versionMismatch || false
        });

    } catch (error: unknown) {
        console.error("[Suggestions API] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to update suggestion";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

