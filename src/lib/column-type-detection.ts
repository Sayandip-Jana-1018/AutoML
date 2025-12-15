/**
 * Column Type Detection
 * Automatically detects column types: numeric, categorical, datetime, text, id, target
 * Used in the upload preview to help users understand their data
 */

export type ColumnType = 'numeric' | 'categorical' | 'datetime' | 'text' | 'id' | 'target' | 'unknown';

export interface ColumnTypeInfo {
    type: ColumnType;
    confidence: 'high' | 'medium' | 'low';
    uniqueCount: number;
    nullCount: number;
    sampleValues: string[];
}

// Common target column name patterns
const TARGET_PATTERNS = [
    /^(target|label|class|y|output|outcome|result)$/i,
    /^is_|^has_|^was_|^did_/i,  // Boolean-like prefixes
    /_target$|_label$|_class$|_outcome$/i
];

// Common ID column name patterns
const ID_PATTERNS = [
    /^(id|_?id|index|row_?id|uuid|guid)$/i,
    /_id$|Id$/,
    /^pk$|^primary_?key$/i
];

// Datetime patterns
const DATETIME_PATTERNS = [
    /^\d{4}-\d{2}-\d{2}$/,  // 2024-01-15
    /^\d{4}\/\d{2}\/\d{2}$/,  // 2024/01/15
    /^\d{2}\/\d{2}\/\d{4}$/,  // 01/15/2024
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,  // ISO format
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/,  // 2024-01-15 14:30
];

const DATE_COLUMN_PATTERNS = [
    /date|time|timestamp|created|updated|modified|at$/i,
    /_dt$|_ts$/i
];

/**
 * Check if a string looks like a number
 */
function isNumericValue(value: string): boolean {
    if (!value || value.trim() === '') return false;
    const cleaned = value.replace(/[,$%]/g, '').trim();
    return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
}

/**
 * Check if a string looks like a datetime
 */
function isDatetimeValue(value: string): boolean {
    if (!value || value.trim() === '') return false;
    // Check against datetime patterns
    if (DATETIME_PATTERNS.some(pattern => pattern.test(value.trim()))) {
        return true;
    }
    // Try parsing as date
    const date = new Date(value);
    return !isNaN(date.getTime()) && value.length > 4;
}

/**
 * Detect types for all columns
 */
export function detectColumnTypes(
    columns: string[],
    rows: Record<string, any>[],
    lastColumnAsTarget = true
): Record<string, ColumnTypeInfo> {
    const result: Record<string, ColumnTypeInfo> = {};
    const sampleSize = Math.min(rows.length, 100);

    columns.forEach((column, colIndex) => {
        const values = rows.slice(0, sampleSize).map(row => String(row[column] ?? ''));
        const nonEmptyValues = values.filter(v => v.trim() !== '' && v.toLowerCase() !== 'null' && v.toLowerCase() !== 'nan' && v !== 'undefined');

        const uniqueValues = new Set(nonEmptyValues);
        const nullCount = values.length - nonEmptyValues.length;

        // Sample up to 5 unique values for display
        const sampleValues = Array.from(uniqueValues).slice(0, 5);

        // Default to unknown
        let type: ColumnType = 'unknown';
        let confidence: 'high' | 'medium' | 'low' = 'low';

        // 1. Check if column name matches target patterns (highest priority for last column)
        const isLastColumn = colIndex === columns.length - 1;
        const matchesTargetPattern = TARGET_PATTERNS.some(p => p.test(column));

        if (matchesTargetPattern || (isLastColumn && lastColumnAsTarget)) {
            // Verify it looks like a valid target (categorical with few classes or binary)
            const numericCount = nonEmptyValues.filter(isNumericValue).length;
            const isLikelyTarget = uniqueValues.size <= 20 || (uniqueValues.size <= 2 && numericCount === nonEmptyValues.length);

            if (isLikelyTarget) {
                type = 'target';
                confidence = matchesTargetPattern ? 'high' : 'medium';
            }
        }

        // 2. Check if column name matches ID patterns
        if (type === 'unknown' && ID_PATTERNS.some(p => p.test(column))) {
            // Verify values are unique
            if (uniqueValues.size === nonEmptyValues.length || uniqueValues.size > sampleSize * 0.9) {
                type = 'id';
                confidence = 'high';
            }
        }

        // 3. Check for datetime
        if (type === 'unknown') {
            const datetimeCount = nonEmptyValues.filter(isDatetimeValue).length;
            const datetimeRatio = datetimeCount / nonEmptyValues.length;

            if (datetimeRatio > 0.8 || DATE_COLUMN_PATTERNS.some(p => p.test(column))) {
                type = 'datetime';
                confidence = datetimeRatio > 0.9 ? 'high' : 'medium';
            }
        }

        // 4. Check for numeric
        if (type === 'unknown') {
            const numericCount = nonEmptyValues.filter(isNumericValue).length;
            const numericRatio = numericCount / nonEmptyValues.length;

            if (numericRatio > 0.8) {
                type = 'numeric';
                confidence = numericRatio > 0.95 ? 'high' : 'medium';
            }
        }

        // 5. Check for categorical (few unique values, strings)
        if (type === 'unknown') {
            const uniqueRatio = uniqueValues.size / Math.max(nonEmptyValues.length, 1);

            if (uniqueValues.size <= 20 && uniqueRatio < 0.5) {
                type = 'categorical';
                confidence = uniqueValues.size <= 10 ? 'high' : 'medium';
            }
        }

        // 6. Check for text (long strings, high cardinality)
        if (type === 'unknown') {
            const avgLength = nonEmptyValues.reduce((sum, v) => sum + v.length, 0) / Math.max(nonEmptyValues.length, 1);

            if (avgLength > 50 || uniqueValues.size > sampleSize * 0.8) {
                type = 'text';
                confidence = avgLength > 100 ? 'high' : 'medium';
            }
        }

        // Default to categorical if still unknown
        if (type === 'unknown') {
            type = 'categorical';
            confidence = 'low';
        }

        result[column] = {
            type,
            confidence,
            uniqueCount: uniqueValues.size,
            nullCount,
            sampleValues
        };
    });

    return result;
}

/**
 * Infer the most likely target column
 */
export function inferTargetColumn(
    columns: string[],
    types: Record<string, ColumnTypeInfo>
): string | null {
    // First check for explicit target type
    for (const col of columns) {
        if (types[col]?.type === 'target') {
            return col;
        }
    }

    // Then check for pattern matches
    for (const col of columns) {
        if (TARGET_PATTERNS.some(p => p.test(col))) {
            return col;
        }
    }

    // Finally, use last column if it's categorical
    const lastCol = columns[columns.length - 1];
    if (lastCol && types[lastCol]?.type === 'categorical') {
        return lastCol;
    }

    return lastCol || null;
}

/**
 * All column types for cycling
 */
export const COLUMN_TYPES: ColumnType[] = ['numeric', 'categorical', 'datetime', 'text', 'id', 'target'];

/**
 * Get the next column type in the cycle (for click-to-change)
 */
export function getNextColumnType(currentType: ColumnType): ColumnType {
    const idx = COLUMN_TYPES.indexOf(currentType);
    return COLUMN_TYPES[(idx + 1) % COLUMN_TYPES.length];
}

/**
 * Get type badge color for UI display
 */
export function getTypeBadgeColor(type: ColumnType): string {
    switch (type) {
        case 'numeric': return '#3b82f6';      // Blue
        case 'categorical': return '#8b5cf6';  // Purple
        case 'datetime': return '#f97316';     // Orange
        case 'text': return '#6b7280';         // Gray
        case 'id': return '#ef4444';           // Red
        case 'target': return '#22c55e';       // Green
        default: return '#9ca3af';             // Light gray
    }
}

/**
 * Get type badge icon (emoji for simplicity)
 */
export function getTypeBadgeIcon(type: ColumnType): string {
    switch (type) {
        case 'numeric': return '🔢';
        case 'categorical': return '📊';
        case 'datetime': return '📅';
        case 'text': return '📝';
        case 'id': return '🔑';
        case 'target': return '🎯';
        default: return '❓';
    }
}
