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
