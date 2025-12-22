/**
 * Suggestion Utilities
 * 
 * Helpers for permission checking, code sanitization, and rate limiting
 */

import { adminDb } from './firebase-admin';

// Rate limiting store (in-memory for simplicity, consider Redis for production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if user has permission to access/modify a project
 */
export async function checkProjectPermission(
    projectId: string,
    userId: string,
    userEmail: string,
    requiredRole: 'view' | 'edit' | 'run' = 'edit'
): Promise<{ allowed: boolean; reason?: string }> {
    try {
        const projectDoc = await adminDb.collection('projects').doc(projectId).get();

        if (!projectDoc.exists) {
            return { allowed: false, reason: 'Project not found' };
        }

        const project = projectDoc.data();

        // Check if owner
        if (project?.owner_email === userEmail || project?.owner_uid === userId) {
            return { allowed: true };
        }

        // Check collaborators
        const collaborators = project?.collaborators || [];
        const collaborator = collaborators.find(
            (c: any) => c.uid === userId || c.email === userEmail
        );

        if (!collaborator) {
            return { allowed: false, reason: 'You are not a collaborator on this project' };
        }

        // Check role hierarchy
        const roleHierarchy = { view: 1, edit: 2, run: 3 };
        const userRoleLevel = roleHierarchy[collaborator.role as keyof typeof roleHierarchy] || 0;
        const requiredRoleLevel = roleHierarchy[requiredRole];

        if (userRoleLevel < requiredRoleLevel) {
            return {
                allowed: false,
                reason: `You need '${requiredRole}' permission. You have '${collaborator.role}'`
            };
        }

        return { allowed: true };
    } catch (error) {
        console.error('[checkProjectPermission] Error:', error);
        return { allowed: false, reason: 'Permission check failed' };
    }
}

/**
 * Dangerous patterns to detect in code suggestions
 */
const DANGEROUS_PATTERNS = [
    { pattern: /os\.system\s*\(/i, name: 'os.system', severity: 'high' as const },
    { pattern: /subprocess\.(run|call|Popen)\s*\(/i, name: 'subprocess', severity: 'medium' as const },
    { pattern: /eval\s*\(/i, name: 'eval', severity: 'high' as const },
    { pattern: /exec\s*\(/i, name: 'exec', severity: 'high' as const },
    { pattern: /import\s+pickle/i, name: 'pickle', severity: 'medium' as const },
    { pattern: /requests\.(get|post|put|delete)\s*\(/i, name: 'network request', severity: 'low' as const },
    { pattern: /urllib\./i, name: 'urllib', severity: 'low' as const },
    { pattern: /open\s*\([^)]*['"]w['"]/i, name: 'file write', severity: 'medium' as const },
    { pattern: /shutil\.(rmtree|remove)/i, name: 'file deletion', severity: 'high' as const },
    { pattern: /__import__\s*\(/i, name: 'dynamic import', severity: 'high' as const },
    { pattern: /boto3\./i, name: 'AWS SDK', severity: 'low' as const },
    { pattern: /google\.cloud\./i, name: 'GCP SDK', severity: 'low' as const },
];

export interface SanitizeResult {
    safe: boolean;
    warnings: Array<{
        pattern: string;
        severity: 'low' | 'medium' | 'high';
        message: string;
    }>;
    blockers: Array<{
        pattern: string;
        message: string;
    }>;
}

/**
 * Sanitize code suggestion and return warnings
 */
export function sanitizeCodeSuggestion(code: string): SanitizeResult {
    const warnings: SanitizeResult['warnings'] = [];
    const blockers: SanitizeResult['blockers'] = [];

    for (const { pattern, name, severity } of DANGEROUS_PATTERNS) {
        if (pattern.test(code)) {
            if (severity === 'high') {
                blockers.push({
                    pattern: name,
                    message: `Detected '${name}' which could be dangerous. Review carefully before applying.`
                });
            } else {
                warnings.push({
                    pattern: name,
                    severity,
                    message: `Code contains '${name}'. This may have side effects.`
                });
            }
        }
    }

    // Allow even with blockers, but flag them
    return {
        safe: blockers.length === 0,
        warnings,
        blockers
    };
}

/**
 * Rate limiting for Execute in Studio action
 * @param userId User identifier
 * @param maxPerMinute Maximum allowed executions per minute
 * @returns Whether the action is allowed
 */
export function checkRateLimit(
    userId: string,
    maxPerMinute: number = 10
): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const key = `execute:${userId}`;

    const record = rateLimitStore.get(key);

    if (!record || now >= record.resetAt) {
        // New window
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: maxPerMinute - 1, resetIn: windowMs };
    }

    if (record.count >= maxPerMinute) {
        return {
            allowed: false,
            remaining: 0,
            resetIn: record.resetAt - now
        };
    }

    // Increment count
    record.count++;
    return {
        allowed: true,
        remaining: maxPerMinute - record.count,
        resetIn: record.resetAt - now
    };
}

/**
 * Extract code blocks from markdown/AI response
 */
export function extractCodeFromSuggestion(text: string): string {
    const codeBlocks = text.match(/```(?:python|py)?\n([\s\S]*?)```/g) || [];
    return codeBlocks
        .map(block => block.replace(/```(?:python|py)?\n?/g, '').replace(/```$/g, ''))
        .join('\n\n');
}

/**
 * Detect if a message likely contains an improvement suggestion
 */
export function isImprovementSuggestion(content: string): boolean {
    const lowerContent = content.toLowerCase();

    // Check for improvement-related keywords
    const improvementKeywords = [
        'improve', 'better', 'optimize', 'increase accuracy',
        'reduce loss', 'hyperparameter', 'tuning', 'try this',
        'here\'s how', 'you could', 'consider using'
    ];

    const hasImprovementKeyword = improvementKeywords.some(kw => lowerContent.includes(kw));
    const hasCodeBlock = content.includes('```');

    return hasImprovementKeyword && hasCodeBlock;
}

/**
 * Detect if code is a snippet (incomplete) rather than a full script
 * A full script should have imports and a main function structure
 */
export function isSnippet(code: string): boolean {
    if (!code || code.length < 50) return false; // Too short to judge

    // Check for imports - a full script almost always has imports
    const hasImports = /^\s*(import|from)\s+\w+/m.test(code);

    // Check for main function patterns
    const hasMainStructure = /def\s+(main|train|load_data|preprocess|evaluate|save_model)\s*\(/m.test(code);

    // Check for if __name__ == "__main__" block - indicates complete script
    const hasMainBlock = /__name__\s*==\s*["']__main__["']/m.test(code);

    // Check for placeholder patterns
    const hasPlaceholders = /\.\.\.|# ?(rest of|existing|same as|continue|your code|TODO)/i.test(code);

    // If has placeholders, definitely a snippet
    if (hasPlaceholders) return true;

    // If it has imports AND main structure/block, it's a COMPLETE script
    if (hasImports && (hasMainStructure || hasMainBlock)) return false;

    // If it has imports AND is substantial (>500 chars), likely complete
    if (hasImports && code.length > 500) return false;

    // If no imports and code is substantial, it's probably a snippet
    if (!hasImports && code.length > 100) return true;

    return false;
}

/**
 * Merge a code snippet with the base script by replacing matching functions
 */
export function mergeSnippetWithBase(snippet: string, baseScript: string): string {
    if (!snippet || !baseScript) return snippet || baseScript;

    // Extract function definitions from snippet
    const functionPattern = /def\s+(\w+)\s*\([^)]*\):\s*((?:(?!^def\s)[\s\S])*)/gm;
    const snippetFunctions: Map<string, string> = new Map();

    let match;
    while ((match = functionPattern.exec(snippet)) !== null) {
        const funcName = match[1];
        const fullMatch = match[0];
        snippetFunctions.set(funcName, fullMatch);
    }

    // If no functions found in snippet, it might be top-level code - return base
    if (snippetFunctions.size === 0) {
        return baseScript;
    }

    // Replace matching functions in base script
    let mergedScript = baseScript;
    for (const [funcName, funcCode] of snippetFunctions) {
        const baseFuncPattern = new RegExp(
            `def\\s+${funcName}\\s*\\([^)]*\\):\\s*(?:(?!^def\\s)[\\s\\S])*`,
            'gm'
        );

        if (baseFuncPattern.test(mergedScript)) {
            mergedScript = mergedScript.replace(baseFuncPattern, funcCode);
        }
    }

    return mergedScript;
}
