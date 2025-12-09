/**
 * Schema Profiler for Dataset Analysis
 * Detects column types, counts rows, identifies missing values.
 */

import { storage } from '@/lib/gcp';

export interface ColumnProfile {
    name: string;
    type: 'numeric' | 'categorical' | 'text' | 'datetime' | 'boolean' | 'unknown';
    nullCount: number;
    uniqueCount: number;
    sampleValues: string[];
}

export interface DatasetSchema {
    columns: ColumnProfile[];
    rowCount: number;
    columnCount: number;
    missingValueStats: {
        totalMissing: number;
        percentMissing: number;
    };
    inferredTaskType: 'classification' | 'regression' | 'unknown';
    taskTypeConfidence: number; // 0-1 confidence score
    targetColumnSuggestion?: string;
}

/**
 * Infers column type from sample values
 */
function inferColumnType(values: string[]): ColumnProfile['type'] {
    const nonEmpty = values.filter(v => v && v.trim() !== '');
    if (nonEmpty.length === 0) return 'unknown';

    // Check for numeric
    const numericPattern = /^-?\d+(\.\d+)?$/;
    const numericCount = nonEmpty.filter(v => numericPattern.test(v.trim())).length;
    if (numericCount / nonEmpty.length > 0.8) return 'numeric';

    // Check for boolean
    const booleanValues = ['true', 'false', 'yes', 'no', '0', '1', 't', 'f', 'y', 'n'];
    const boolCount = nonEmpty.filter(v => booleanValues.includes(v.toLowerCase().trim())).length;
    if (boolCount / nonEmpty.length > 0.9) return 'boolean';

    // Check for datetime
    const datePattern = /^\d{4}[-/]\d{2}[-/]\d{2}|^\d{2}[-/]\d{2}[-/]\d{4}/;
    const dateCount = nonEmpty.filter(v => datePattern.test(v.trim())).length;
    if (dateCount / nonEmpty.length > 0.7) return 'datetime';

    // Check for categorical (low cardinality)
    const uniqueValues = new Set(nonEmpty.map(v => v.toLowerCase().trim()));
    if (uniqueValues.size <= 10 && nonEmpty.length > 20) return 'categorical';
    if (uniqueValues.size / nonEmpty.length < 0.1) return 'categorical';

    // Default to text
    return 'text';
}

/**
 * Suggests the most likely target column based on column names and types
 */
function suggestTargetColumn(columns: ColumnProfile[]): string | undefined {
    // Common target column patterns
    const targetPatterns = [
        /^(target|label|class|y|outcome|result|prediction|category)$/i,
        /_(target|label|class|y|outcome|result)$/i,
        /^is_|^has_/i
    ];

    for (const col of columns) {
        for (const pattern of targetPatterns) {
            if (pattern.test(col.name)) {
                return col.name;
            }
        }
    }

    // If no obvious target, suggest last categorical/boolean column
    const categoricalCols = columns.filter(c => c.type === 'categorical' || c.type === 'boolean');
    if (categoricalCols.length > 0) {
        return categoricalCols[categoricalCols.length - 1].name;
    }

    return undefined;
}

/**
 * Infers task type with confidence score based on target column characteristics
 */
function inferTaskTypeWithConfidence(
    targetColumn?: ColumnProfile
): { taskType: 'classification' | 'regression' | 'unknown'; confidence: number } {
    if (!targetColumn) {
        return { taskType: 'unknown', confidence: 0 };
    }

    if (targetColumn.type === 'categorical' || targetColumn.type === 'boolean') {
        // High confidence for categorical/boolean targets
        const confidence = targetColumn.uniqueCount <= 5 ? 0.95 : 0.85;
        return { taskType: 'classification', confidence };
    }

    if (targetColumn.type === 'numeric') {
        // If numeric with few unique values, likely classification
        if (targetColumn.uniqueCount <= 10) {
            return { taskType: 'classification', confidence: 0.75 };
        }
        // Many unique values = regression
        return { taskType: 'regression', confidence: 0.85 };
    }

    return { taskType: 'unknown', confidence: 0.3 };
}

/**
 * Parses CSV content and profiles the schema
 */
export function profileCSV(csvContent: string): DatasetSchema {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV must have at least a header and one data row');
    }

    // Parse header
    const headers = parseCSVLine(lines[0]);

    // Parse data rows (sample up to 1000 rows for profiling)
    const dataRows = lines.slice(1, Math.min(1001, lines.length)).map(line => parseCSVLine(line));

    // Profile each column
    const columns: ColumnProfile[] = headers.map((header, colIndex) => {
        const values = dataRows.map(row => row[colIndex] || '');
        const nonEmpty = values.filter(v => v && v.trim() !== '');
        const uniqueSet = new Set(nonEmpty.map(v => v.toLowerCase().trim()));

        return {
            name: header.trim(),
            type: inferColumnType(values),
            nullCount: values.length - nonEmpty.length,
            uniqueCount: uniqueSet.size,
            sampleValues: Array.from(uniqueSet).slice(0, 5)
        };
    });

    // Calculate missing value stats
    const totalCells = dataRows.length * columns.length;
    const totalMissing = columns.reduce((sum, col) => sum + col.nullCount, 0);

    // Suggest target and task type with confidence
    const targetSuggestion = suggestTargetColumn(columns);
    const targetColumn = targetSuggestion ? columns.find(c => c.name === targetSuggestion) : undefined;
    const { taskType, confidence } = inferTaskTypeWithConfidence(targetColumn);

    return {
        columns,
        rowCount: dataRows.length,
        columnCount: columns.length,
        missingValueStats: {
            totalMissing,
            percentMissing: totalCells > 0 ? (totalMissing / totalCells) * 100 : 0
        },
        inferredTaskType: taskType,
        taskTypeConfidence: confidence,
        targetColumnSuggestion: targetSuggestion
    };
}

/**
 * Simple CSV line parser (handles quoted values)
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

/**
 * Downloads a file from GCS and profiles it
 */
export async function profileDatasetFromGCS(gcsPath: string): Promise<DatasetSchema> {
    // Parse GCS path: gs://bucket/path/to/file
    const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
        throw new Error(`Invalid GCS path: ${gcsPath}`);
    }

    const [, bucketName, filePath] = match;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    // Download file content
    const [content] = await file.download();
    const csvContent = content.toString('utf-8');

    return profileCSV(csvContent);
}

/**
 * Creates a summary string for the AI context
 */
export function schemaToPromptContext(schema: DatasetSchema): string {
    const columnSummary = schema.columns.map(c =>
        `- ${c.name} (${c.type}, ${c.nullCount} nulls, ${c.uniqueCount} unique)`
    ).join('\n');

    return `
Dataset Summary:
- Rows: ${schema.rowCount}
- Columns: ${schema.columnCount}
- Missing Values: ${schema.missingValueStats.percentMissing.toFixed(1)}%
- Inferred Task: ${schema.inferredTaskType}
- Suggested Target: ${schema.targetColumnSuggestion || 'Unknown'}

Columns:
${columnSummary}
`.trim();
}
