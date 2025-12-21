/**
 * Schema Profiler for Dataset Analysis
 * Detects column types, counts rows, identifies missing values.
 */

import { storage } from '@/lib/gcp';
import JSZip from 'jszip';
import path from 'path';

export interface ColumnProfile {
    name: string;
    type: 'numeric' | 'categorical' | 'text' | 'datetime' | 'boolean' | 'image' | 'unknown';
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
    inferredTaskType: 'classification' | 'regression' | 'image_classification' | 'unknown';
    taskTypeConfidence: number; // 0-1 confidence score
    targetColumnSuggestion?: string;
    // NEW: Preview data rows for display
    previewRows?: Record<string, any>[];
    // NEW: Image dataset specific stats
    imageStats?: {
        totalImages: number;
        unmatchedImages: number;
        classDistribution: Record<string, number>;
        formatCounts: Record<string, number>;
    };
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
): { taskType: 'classification' | 'regression' | 'image_classification' | 'unknown'; confidence: number } {
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

    // Extract first 5 rows as preview data
    const previewRows = dataRows.slice(0, 5).map(row => {
        const rowObj: Record<string, any> = {};
        headers.forEach((header, idx) => {
            rowObj[header.trim()] = row[idx] || null;
        });
        return rowObj;
    });

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
        targetColumnSuggestion: targetSuggestion,
        previewRows
    };
}

/**
 * Robust CSV line parser (handles quoted values with commas, escaped quotes)
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    // Remove BOM if present
    if (line.charCodeAt(0) === 0xFEFF) {
        line = line.slice(1);
    }

    // Remove trailing \r if present (Windows line endings)
    if (line.endsWith('\r')) {
        line = line.slice(0, -1);
    }

    while (i < line.length) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote ("") - add single quote to result
                current += '"';
                i += 2;
                continue;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
                i++;
                continue;
            }
        }

        if (char === ',' && !inQuotes) {
            // Field delimiter - push current field and reset
            result.push(current.trim());
            current = '';
            i++;
            continue;
        }

        // Regular character - add to current field
        current += char;
        i++;
    }

    // Don't forget the last field
    result.push(current.trim());

    return result;
}

/**
 * Downloads a file from GCS and profiles it
 * Handles both CSV and ZIP (image) datasets
 */
export async function profileDatasetFromGCS(
    gcsPath: string,
    fileSize?: number,
    clientMetadata?: {
        totalFiles?: number;
        totalImages?: number;
        classCounts?: Record<string, number>;
        extractedSize?: number;
    }
): Promise<DatasetSchema> {
    // Parse GCS path: gs://bucket/path/to/file
    const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
        throw new Error(`Invalid GCS path: ${gcsPath}`);
    }

    const [, bucketName, filePath] = match;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    // Check extension
    const ext = filePath.split('.').pop()?.toLowerCase();

    // Safety: If ZIP is > 200MB, skip deep profiling to avoid OOM on serverless
    // BUT use client metadata if provided!
    if (ext === 'zip' && fileSize && fileSize > 200 * 1024 * 1024) {
        console.warn(`[Profiler] Skipping deep profiling for large ZIP (${(fileSize / 1024 / 1024).toFixed(1)} MB). Using client metadata if available.`);

        const totalFiles = clientMetadata?.totalFiles || 0;
        const totalImages = clientMetadata?.totalImages || 0;
        const classCounts = clientMetadata?.classCounts || {};
        const uniqueClasses = Object.keys(classCounts);

        return {
            columns: [
                { name: 'filename', type: 'image', nullCount: 0, uniqueCount: totalFiles, sampleValues: [] },
                { name: 'label', type: 'categorical', nullCount: 0, uniqueCount: Object.keys(classCounts).length, sampleValues: Object.keys(classCounts).slice(0, 5) }
            ],
            rowCount: totalImages,
            columnCount: 2,
            missingValueStats: { totalMissing: 0, percentMissing: 0 },
            inferredTaskType: 'image_classification',
            taskTypeConfidence: uniqueClasses.length > 0 ? 0.9 : 0.5,
            targetColumnSuggestion: 'label',
            previewRows: [],
            imageStats: {
                totalImages: totalImages || totalFiles,
                unmatchedImages: 0,
                classDistribution: classCounts,
                formatCounts: {}
            }
        };
    }

    // Download file content (buffer) - ONLY for small files
    const [content] = await file.download();

    if (ext === 'zip') {
        return profileZipDataset(content);
    } else {
        // Assume CSV/Text for now
        const csvContent = content.toString('utf-8');
        return profileCSV(csvContent);
    }
}

/**
 * Profiles a ZIP file containing an image dataset
 */
async function profileZipDataset(zipBuffer: Buffer): Promise<DatasetSchema> {
    const zip = await JSZip.loadAsync(zipBuffer);

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tiff'];
    const validImages = new Set<string>();
    const formatCounts: Record<string, number> = {};
    let metadataFileStr: string | null = null;

    // 1. Scan ZIP contents
    for (const [relativePath, entry] of Object.entries(zip.files)) {
        if (entry.dir || relativePath.startsWith('__MACOSX') || relativePath.includes('/.')) continue;

        const fileExt = '.' + relativePath.split('.').pop()?.toLowerCase();

        if (imageExtensions.includes(fileExt)) {
            validImages.add(relativePath);
            formatCounts[fileExt] = (formatCounts[fileExt] || 0) + 1;
        } else if (fileExt === '.csv' && !metadataFileStr) {
            // Heuristic: Take the first CSV as metadata, or prefer 'metadata.csv' / 'train.csv'
            // For now, simple approach: first found.
            metadataFileStr = await entry.async('string');
        }
    }

    const totalImages = validImages.size;
    let schema: DatasetSchema;

    if (metadataFileStr) {
        // Parse metadata CSV to get schema
        schema = profileCSV(metadataFileStr);
        schema.inferredTaskType = 'image_classification'; // Assume image classification if ZIP + CSV

        // Validate images against metadata
        // Try to find the 'filename' or 'image' column
        const filenameCol = schema.columns.find(c => ['image', 'file', 'filename', 'path', 'id'].includes(c.name.toLowerCase()));
        if (filenameCol) {
            filenameCol.type = 'image';
        }

        let unmatchedCount = 0;
        const classDistribution: Record<string, number> = {};

        if (filenameCol && schema.previewRows) {
            // Check sampled rows for mismatches to get an estimate
            let sampleMismatch = 0;
            const samplesChecked = schema.previewRows.length;

            schema.previewRows.forEach(row => {
                const fname = row[filenameCol.name];
                if (fname) {
                    // Try exact match or relative path match
                    const exists = validImages.has(fname) ||
                        Array.from(validImages).some(img => img.endsWith(fname) || fname.endsWith(img));
                    if (!exists) sampleMismatch++;
                }
            });

            // If we found mismatches in the sample, estimate for the whole dataset
            if (samplesChecked > 0) {
                unmatchedCount = Math.floor((sampleMismatch / samplesChecked) * schema.rowCount);
            }
        }

        // If we want class distribution, look for target column
        if (schema.targetColumnSuggestion) {
            const targetCol = schema.columns.find(c => c.name === schema.targetColumnSuggestion);
            if (targetCol && targetCol.type === 'categorical') {
                // Use sample values frequency from unique count approximation is hard without full data.
                // But we can just use the folder counts as a fallback if the distribution is unknown?
                // Or leaving it empty is fine, the frontend will use what it has.
            }
        }

        schema.imageStats = {
            totalImages,
            unmatchedImages: unmatchedCount,
            classDistribution: {},
            formatCounts
        };

    } else {
        // No metadata CSV - Folder based?
        // We can infer classes from folder names
        const folderCounts: Record<string, number> = {};

        for (const imagePath of validImages) {
            const parts = imagePath.split('/');
            if (parts.length > 1) {
                const parentFolder = parts[parts.length - 2];
                folderCounts[parentFolder] = (folderCounts[parentFolder] || 0) + 1;
            }
        }

        const uniqueClasses = Object.keys(folderCounts);

        schema = {
            columns: [
                { name: 'filename', type: 'image', nullCount: 0, uniqueCount: totalImages, sampleValues: [] },
                { name: 'label', type: 'categorical', nullCount: 0, uniqueCount: uniqueClasses.length, sampleValues: uniqueClasses.slice(0, 5) }
            ],
            rowCount: totalImages,
            columnCount: 2,
            missingValueStats: { totalMissing: 0, percentMissing: 0 },
            inferredTaskType: 'image_classification',
            taskTypeConfidence: 0.8,
            targetColumnSuggestion: 'label',
            imageStats: {
                totalImages,
                unmatchedImages: 0,
                classDistribution: folderCounts,
                formatCounts
            }
        };
    }

    return schema;
}

/**
 * Creates a summary string for the AI context
 */
export function schemaToPromptContext(schema: DatasetSchema): string {
    const columnSummary = schema.columns.map(c =>
        `- ${c.name} (${c.type}, ${c.nullCount} nulls, ${c.uniqueCount} unique)`
    ).join('\n');

    let additionalStats = '';
    if (schema.imageStats) {
        const classDist = Object.entries(schema.imageStats.classDistribution || {})
            .map(([cls, count]) => `  * ${cls}: ${count}`)
            .join('\n');

        additionalStats = `
Image Stats:
- Total Images: ${schema.imageStats.totalImages}
- Unmatched Images: ${schema.imageStats.unmatchedImages} (in CSV but not ZIP)
- Formats: ${Object.entries(schema.imageStats.formatCounts || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
- Class Distribution:
${classDist}
`;
    }

    return `
Dataset Summary:
- Rows: ${schema.rowCount}
- Columns: ${schema.columnCount}
- Missing Values: ${schema.missingValueStats.percentMissing.toFixed(1)}%
- Inferred Task: ${schema.inferredTaskType}
- Suggested Target: ${schema.targetColumnSuggestion || 'Unknown'}
${additionalStats}

Columns:
${columnSummary}
`.trim();
}
