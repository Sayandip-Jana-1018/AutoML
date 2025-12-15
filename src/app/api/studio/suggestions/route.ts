// API Route for storing and fetching suggestions

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
    checkProjectPermission,
    checkRateLimit,
    sanitizeCodeSuggestion,
    extractCodeFromSuggestion
} from "@/lib/suggestion-utils";
import { hashText } from "@/lib/diff-utils";

export const runtime = "nodejs";

/**
 * POST /api/studio/suggestions
 * Store a suggestion and return its ID for safe URL redirect
 * 
 * Includes: Permission check, Rate limiting, Code sanitization, 
 *           Version tracking, Duplicate prevention
 */
export async function POST(req: Request) {
    try {
        const {
            projectId,
            suggestion,
            modelId,
            userId,
            userEmail,
            // Version tracking (new)
            currentScriptVersion,
            currentVersionId,
            currentScriptSnapshot,
            // Duplicate prevention options
            skipDuplicateCheck = false
        } = await req.json();

        // Validate required fields
        if (!projectId || !suggestion || !userId) {
            return NextResponse.json(
                { error: "Missing required fields: projectId, suggestion, userId" },
                { status: 400 }
            );
        }

        // Rate limiting check (10 per minute per user)
        const rateLimit = checkRateLimit(userId, 10);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: "Rate limit exceeded. Please wait before creating more suggestions.",
                    resetIn: Math.ceil(rateLimit.resetIn / 1000)
                },
                { status: 429 }
            );
        }

        // Permission check
        const permission = await checkProjectPermission(projectId, userId, userEmail, 'edit');
        if (!permission.allowed) {
            return NextResponse.json(
                { error: permission.reason || "You do not have access to this project" },
                { status: 403 }
            );
        }

        // Extract code from suggestion
        const extractedCode = extractCodeFromSuggestion(suggestion);

        // Sanitize the extracted code
        const sanitizeResult = sanitizeCodeSuggestion(extractedCode);

        // Generate hash for duplicate detection
        const textHash = hashText(suggestion);

        // Check for duplicate unapplied suggestions (unless explicitly skipped)
        if (!skipDuplicateCheck) {
            const existingSnapshot = await adminDb.collection("suggestions")
                .where("projectId", "==", projectId)
                .where("applied", "==", false)
                .where("textHash", "==", textHash)
                .limit(1)
                .get();

            if (!existingSnapshot.empty) {
                const existingDoc = existingSnapshot.docs[0];
                return NextResponse.json({
                    suggestionId: existingDoc.id,
                    isDuplicate: true,
                    extractedCode: existingDoc.data().extractedCode || null,
                    sanitization: {
                        safe: existingDoc.data().sanitization?.safe ?? true,
                        warnings: existingDoc.data().sanitization?.warnings || [],
                        blockers: existingDoc.data().sanitization?.blockers || []
                    },
                    rateLimit: {
                        remaining: rateLimit.remaining
                    },
                    message: "Using existing suggestion with same content"
                });
            }
        }

        // Create suggestion document with version and sanitization info
        const suggestionRef = await adminDb.collection("suggestions").add({
            projectId,
            createdAt: FieldValue.serverTimestamp(),
            createdBy: userId,
            createdByEmail: userEmail,
            source: "chat",
            text: suggestion,
            textHash, // For duplicate detection
            extractedCode,
            modelId: modelId || null,
            applied: false,
            appliedBy: null,
            appliedAt: null,
            // Version tracking (new fields)
            targetScriptVersion: currentScriptVersion || null,
            targetVersionId: currentVersionId || null,
            currentScriptSnapshot: currentScriptSnapshot || null, // Store snapshot for diff later
            // Sanitization metadata
            sanitization: {
                safe: sanitizeResult.safe,
                warningCount: sanitizeResult.warnings.length,
                blockerCount: sanitizeResult.blockers.length,
                warnings: sanitizeResult.warnings.map(w => w.pattern),
                blockers: sanitizeResult.blockers.map(b => b.pattern)
            }
        });

        return NextResponse.json({
            suggestionId: suggestionRef.id,
            isDuplicate: false,
            extractedCode: extractedCode.length > 0 ? extractedCode : null,
            targetScriptVersion: currentScriptVersion || null,
            // Return sanitization info to UI
            sanitization: {
                safe: sanitizeResult.safe,
                warnings: sanitizeResult.warnings,
                blockers: sanitizeResult.blockers
            },
            rateLimit: {
                remaining: rateLimit.remaining
            }
        });

    } catch (error: unknown) {
        console.error("[Suggestions API] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to store suggestion";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

/**
 * GET /api/studio/suggestions?projectId=xxx
 * List suggestions for a project (for history tab)
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get("projectId");

        if (!projectId) {
            return NextResponse.json(
                { error: "Missing projectId parameter" },
                { status: 400 }
            );
        }

        const suggestionsSnapshot = await adminDb
            .collection("suggestions")
            .where("projectId", "==", projectId)
            .orderBy("createdAt", "desc")
            .limit(20)
            .get();

        const suggestions = suggestionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
        }));

        return NextResponse.json({ suggestions });

    } catch (error: unknown) {
        console.error("[Suggestions API] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch suggestions";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
