/**
 * Schema Validation Utility
 * Validates dataset columns against expected schema templates
 */

export interface SchemaTemplate {
    name: string;
    requiredColumns: string[];
    optionalColumns?: string[];
    description?: string;
}

export interface SchemaValidationResult {
    isValid: boolean;
    matchedTemplate: SchemaTemplate | null;
    matchScore: number; // 0-100
    missingRequired: string[];
    extraColumns: string[];
    matchedColumns: string[];
    suggestions: string[];
}

// Common dataset schema templates
export const COMMON_SCHEMAS: SchemaTemplate[] = [
    {
        name: 'Classification Dataset',
        requiredColumns: ['label', 'target', 'class', 'category'],
        description: 'Standard classification dataset with target column'
    },
    {
        name: 'Regression Dataset',
        requiredColumns: ['target', 'value', 'price', 'amount'],
        description: 'Numeric prediction dataset'
    },
    {
        name: 'Time Series',
        requiredColumns: ['date', 'timestamp', 'time'],
        optionalColumns: ['value', 'target'],
        description: 'Temporal data with date/time column'
    },
    {
        name: 'Customer Data',
        requiredColumns: ['customer_id', 'user_id', 'id'],
        optionalColumns: ['name', 'email', 'phone'],
        description: 'Customer or user records'
    },
    {
        name: 'Transaction Data',
        requiredColumns: ['transaction_id', 'amount', 'date'],
        optionalColumns: ['customer_id', 'product_id'],
        description: 'Financial transaction records'
    },
    {
        name: 'Product Catalog',
        requiredColumns: ['product_id', 'name', 'price'],
        optionalColumns: ['category', 'description', 'stock'],
        description: 'E-commerce product data'
    },
    {
        name: 'Sentiment Analysis',
        requiredColumns: ['text', 'review', 'comment'],
        optionalColumns: ['sentiment', 'rating', 'label'],
        description: 'Text data for NLP analysis'
    }
];

/**
 * Normalize column name for matching (lowercase, remove special chars)
 */
function normalizeColumnName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Check if a column matches any of the expected column patterns
 */
function columnMatches(column: string, patterns: string[]): boolean {
    const normalized = normalizeColumnName(column);
    return patterns.some(pattern => {
        const normalizedPattern = normalizeColumnName(pattern);
        return normalized.includes(normalizedPattern) ||
            normalizedPattern.includes(normalized) ||
            normalized === normalizedPattern;
    });
}

/**
 * Validate dataset columns against a specific schema template
 */
export function validateAgainstSchema(
    columns: string[],
    template: SchemaTemplate
): SchemaValidationResult {
    const normalizedColumns = columns.map(c => c.toLowerCase());

    // Check which required columns are present
    const matchedRequired = template.requiredColumns.filter(req =>
        columns.some(col => columnMatches(col, [req]))
    );

    const missingRequired = template.requiredColumns.filter(req =>
        !columns.some(col => columnMatches(col, [req]))
    );

    // Check optional columns
    const matchedOptional = (template.optionalColumns || []).filter(opt =>
        columns.some(col => columnMatches(col, [opt]))
    );

    // Calculate match score
    const requiredScore = template.requiredColumns.length > 0
        ? (matchedRequired.length / template.requiredColumns.length) * 100
        : 100;

    // Find extra columns not in schema
    const allSchemaColumns = [...template.requiredColumns, ...(template.optionalColumns || [])];
    const extraColumns = columns.filter(col =>
        !allSchemaColumns.some(schemaCol => columnMatches(col, [schemaCol]))
    );

    const isValid = matchedRequired.length > 0; // At least one required column matched

    // Generate suggestions
    const suggestions: string[] = [];
    if (missingRequired.length > 0 && matchedRequired.length > 0) {
        suggestions.push(`Consider adding: ${missingRequired.slice(0, 2).join(', ')}`);
    }
    if (matchedOptional.length > 0) {
        suggestions.push(`Using optional columns: ${matchedOptional.join(', ')}`);
    }

    return {
        isValid,
        matchedTemplate: isValid ? template : null,
        matchScore: Math.round(requiredScore),
        missingRequired: missingRequired.slice(0, 3), // Limit to 3
        extraColumns: extraColumns.slice(0, 5), // Limit to 5
        matchedColumns: [...matchedRequired, ...matchedOptional],
        suggestions
    };
}

/**
 * Auto-detect best matching schema template for given columns
 */
export function detectSchema(columns: string[]): SchemaValidationResult {
    let bestMatch: SchemaValidationResult | null = null;

    for (const template of COMMON_SCHEMAS) {
        const result = validateAgainstSchema(columns, template);
        if (!bestMatch || result.matchScore > bestMatch.matchScore) {
            bestMatch = result;
        }
    }

    // If no good match found, return generic result
    if (!bestMatch || bestMatch.matchScore < 25) {
        return {
            isValid: true,
            matchedTemplate: null,
            matchScore: 0,
            missingRequired: [],
            extraColumns: [],
            matchedColumns: [],
            suggestions: ['No standard schema detected - custom dataset format']
        };
    }

    return bestMatch;
}

/**
 * Get schema match badge info
 */
export function getSchemaMatchInfo(result: SchemaValidationResult): {
    color: string;
    label: string;
    icon: 'check' | 'warning' | 'info';
} {
    if (result.matchedTemplate && result.matchScore >= 75) {
        return { color: '#22c55e', label: result.matchedTemplate.name, icon: 'check' };
    }
    if (result.matchedTemplate && result.matchScore >= 50) {
        return { color: '#f59e0b', label: `Partial: ${result.matchedTemplate.name}`, icon: 'warning' };
    }
    return { color: '#6b7280', label: 'Custom Schema', icon: 'info' };
}
