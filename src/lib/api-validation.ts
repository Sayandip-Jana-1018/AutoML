/**
 * API Validation Utilities
 * 
 * Provides Zod-based request validation and RFC 7807 compliant error responses.
 * Used for standardizing API error handling across MLForge.
 */

import { z, ZodError, ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

/**
 * RFC 7807 Problem Details for HTTP APIs
 * https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
    type: string;           // URI reference identifying the problem type
    title: string;          // Short, human-readable summary
    status: number;         // HTTP status code
    detail?: string;        // Human-readable explanation specific to this occurrence
    instance?: string;      // URI reference identifying the specific occurrence
    errors?: Array<{        // Additional validation errors (extension)
        field: string;
        message: string;
        code?: string;
    }>;
    traceId?: string;       // Request trace ID (extension)
}

/**
 * Create an RFC 7807 compliant error response
 */
export function problemResponse(problem: ProblemDetails): NextResponse<ProblemDetails> {
    return NextResponse.json(problem, {
        status: problem.status,
        headers: {
            'Content-Type': 'application/problem+json'
        }
    });
}

/**
 * Common problem types
 */
export const ProblemTypes = {
    VALIDATION_ERROR: '/problems/validation-error',
    NOT_FOUND: '/problems/not-found',
    UNAUTHORIZED: '/problems/unauthorized',
    FORBIDDEN: '/problems/forbidden',
    RATE_LIMITED: '/problems/rate-limited',
    INTERNAL_ERROR: '/problems/internal-error',
    QUOTA_EXCEEDED: '/problems/quota-exceeded',
} as const;

/**
 * Create a validation error response from Zod errors
 */
export function validationErrorResponse(error: ZodError, instance?: string): NextResponse<ProblemDetails> {
    const errors = error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code
    }));

    return problemResponse({
        type: ProblemTypes.VALIDATION_ERROR,
        title: 'Validation Error',
        status: 400,
        detail: 'The request body contains invalid data',
        instance,
        errors
    });
}

/**
 * Create a not found error response
 */
export function notFoundResponse(resource: string, id?: string): NextResponse<ProblemDetails> {
    return problemResponse({
        type: ProblemTypes.NOT_FOUND,
        title: 'Resource Not Found',
        status: 404,
        detail: id ? `${resource} with ID '${id}' was not found` : `${resource} not found`
    });
}

/**
 * Create an unauthorized error response
 */
export function unauthorizedResponse(detail?: string): NextResponse<ProblemDetails> {
    return problemResponse({
        type: ProblemTypes.UNAUTHORIZED,
        title: 'Unauthorized',
        status: 401,
        detail: detail || 'Authentication required'
    });
}

/**
 * Create a forbidden error response
 */
export function forbiddenResponse(detail?: string): NextResponse<ProblemDetails> {
    return problemResponse({
        type: ProblemTypes.FORBIDDEN,
        title: 'Forbidden',
        status: 403,
        detail: detail || 'You do not have permission to access this resource'
    });
}

/**
 * Create a rate limited error response
 */
export function rateLimitedResponse(resetIn: number): NextResponse<ProblemDetails> {
    return problemResponse({
        type: ProblemTypes.RATE_LIMITED,
        title: 'Rate Limit Exceeded',
        status: 429,
        detail: `Rate limit exceeded. Please wait ${Math.ceil(resetIn / 1000)} seconds before retrying.`
    });
}

/**
 * Create an internal error response
 */
export function internalErrorResponse(detail?: string, traceId?: string): NextResponse<ProblemDetails> {
    return problemResponse({
        type: ProblemTypes.INTERNAL_ERROR,
        title: 'Internal Server Error',
        status: 500,
        detail: detail || 'An unexpected error occurred',
        traceId
    });
}

/**
 * Validate request body against a Zod schema
 * Returns typed data or throws with a proper error response
 */
export async function validateRequestBody<T extends ZodSchema>(
    request: Request,
    schema: T
): Promise<{ data: z.infer<T> } | { error: NextResponse<ProblemDetails> }> {
    try {
        const body = await request.json();
        const result = schema.safeParse(body);

        if (!result.success) {
            return { error: validationErrorResponse(result.error, request.url) };
        }

        return { data: result.data };
    } catch (e) {
        return {
            error: problemResponse({
                type: ProblemTypes.VALIDATION_ERROR,
                title: 'Invalid Request Body',
                status: 400,
                detail: 'Request body must be valid JSON'
            })
        };
    }
}

/**
 * Common request schemas for MLForge
 */
export const CommonSchemas = {
    projectId: z.string().min(1, 'Project ID is required'),
    userId: z.string().min(1, 'User ID is required'),
    userEmail: z.string().email('Valid email is required'),
    script: z.string().min(1, 'Script content is required'),
    suggestion: z.string().min(1, 'Suggestion text is required'),
    version: z.number().int().positive('Version must be a positive integer'),
};

export default {
    problemResponse,
    validationErrorResponse,
    notFoundResponse,
    unauthorizedResponse,
    forbiddenResponse,
    rateLimitedResponse,
    internalErrorResponse,
    validateRequestBody,
    ProblemTypes,
    CommonSchemas
};
