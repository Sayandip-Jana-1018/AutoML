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
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

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
            modelType, // Model ID from chat (ai-1, ai-2, ai-3)
            modelName, // Model display name
            userId,
            userEmail,
            // Version tracking (new)
            currentScriptVersion,
            currentVersionId,
            currentScriptSnapshot,
            // Duplicate prevention options
            skipDuplicateCheck = false,
            // Pre-generated summary from studio/chat API
            summary: preGeneratedSummary
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
            modelType: modelType || null, // ai-1, ai-2, or ai-3
            modelName: modelName || null, // Display name
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

        // Generate AI summary - use pre-generated if available
        let summary = preGeneratedSummary || null;
        console.log('[Suggestions API] Summary status:', {
            hasPreGenerated: !!preGeneratedSummary,
            hasExtractedCode: !!extractedCode,
            hasCurrentScript: !!currentScriptSnapshot,
            modelType
        });

        // Only generate if no pre-generated summary and we have extracted code
        if (!summary && extractedCode && modelType) {
            try {
                // Select AI model based on modelType from chat
                let aiModel;
                if (modelType === 'ai-2') {
                    aiModel = anthropic('claude-3-opus-20240229');
                    console.log('[Suggestions API] Using Claude for summary (claude-3-opus-20240229)');
                } else if (modelType === 'ai-3') {
                    aiModel = google('gemini-2.5-flash');
                    console.log('[Suggestions API] Using Gemini for summary (gemini-2.5-flash)');
                } else {
                    aiModel = openai('gpt-4o');
                    console.log('[Suggestions API] Using GPT-4 for summary (gpt-4o)');
                }

                let summaryPrompt;
                if (currentScriptSnapshot) {
                    // Compare old vs new
                    summaryPrompt = `Compare OLD and NEW Python ML scripts. Identify SPECIFIC changes and improvements.

OLD CODE:
${currentScriptSnapshot.substring(0, 1500)}

NEW CODE:
${extractedCode.substring(0, 1500)}

Return ONLY this JSON (max 5 changes):
{"changes":[
  {"type":"algorithm","title":"Added XGBoost","description":"Changed from RandomForest to XGBoost for better accuracy","severity":"high"},
  {"type":"hyperparameter","title":"Tuned n_estimators","description":"Increased trees from 100 to 200","severity":"medium"}
],"notImplemented":["Feature X mentioned but not added"]}

RULES:
- Each change must be SPECIFIC (what was old -> what is new)
- Type: algorithm, preprocessing, hyperparameter, evaluation, feature
- Severity: high (major impact), medium (moderate), low (minor)
- Only include ACTUAL changes, not similarities`;
                } else {
                    // Analyze new code for improvement features
                    summaryPrompt = `Analyze this Python ML code and list ALL improvement features it contains.

CODE:
${extractedCode.substring(0, 1500)}

Return ONLY this JSON (identify what improvements this code has):
{"changes":[
  {"type":"feature","title":"Feature Name","description":"What this feature does and why it helps","severity":"high"}
],"notImplemented":[]}

Look for these improvement patterns:
- Cross-validation (cross_val_score)
- Hyperparameter tuning (GridSearchCV, RandomizedSearchCV)
- Advanced algorithms (XGBoost, GradientBoosting, LightGBM)
- Feature engineering (polynomial, interactions)
- Data preprocessing (outlier removal, scaling)
- Ensemble methods (VotingClassifier, Stacking)
- Evaluation metrics (F1, precision, recall, AUC)

Type: algorithm, preprocessing, hyperparameter, evaluation, feature
Severity: high, medium, low`;
                }

                console.log('[Suggestions API] Generating summary with AI...');
                const { text: summaryResponse } = await generateText({ model: aiModel, prompt: summaryPrompt });
                console.log('[Suggestions API] AI raw response:', summaryResponse.substring(0, 500));

                let summaryJson = summaryResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                const firstBrace = summaryJson.indexOf('{');
                const lastBrace = summaryJson.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    summaryJson = summaryJson.substring(firstBrace, lastBrace + 1);
                }
                const parsed = JSON.parse(summaryJson);

                // Validate structure - ensure it has changes array
                if (parsed.changes && Array.isArray(parsed.changes)) {
                    summary = parsed;
                    console.log('[Suggestions API] ✅ Summary generated successfully:', JSON.stringify(summary));
                } else {
                    // AI returned wrong format - create from whatever it gave us
                    console.log('[Suggestions API] ⚠️ AI returned wrong format, creating structured summary');
                    summary = {
                        changes: [{
                            type: 'feature',
                            title: parsed.title || 'AI Code Analysis',
                            description: parsed.description || JSON.stringify(parsed).substring(0, 200),
                            severity: 'high'
                        }],
                        notImplemented: parsed.notImplemented || []
                    };
                    console.log('[Suggestions API] ✅ Created fallback summary:', JSON.stringify(summary));
                }
            } catch (err) {
                console.error('[Suggestions API] ❌ Summary generation failed:', err);
                // Create a basic summary as fallback
                summary = {
                    changes: [{
                        type: 'code',
                        title: 'AI Code Suggestion',
                        description: 'Code changes suggested by AI. Review the code in the Preview Changes tab.',
                        severity: 'medium'
                    }],
                    notImplemented: []
                };
                console.log('[Suggestions API] Using fallback summary');
            }
        } else {
            if (summary) {
                console.log('[Suggestions API] ✅ Using pre-generated summary (skipping AI generation)');
            } else if (!extractedCode) {
                console.log('[Suggestions API] ⚠️ Skipping summary - no code extracted from suggestion');
            } else if (!modelType) {
                console.log('[Suggestions API] ⚠️ Skipping summary - no model type specified');
            }
        }

        // Update suggestion with summary
        if (summary) {
            console.log('[Suggestions API] Saving summary to Firestore...');
            await suggestionRef.update({ summary });
            console.log('[Suggestions API] Summary saved!');
        } else {
            console.log('[Suggestions API] No summary to save');
        }

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
