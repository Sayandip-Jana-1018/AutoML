/**
 * Image Dataset Processor
 * 
 * Utilities for analyzing image datasets with metadata CSV files.
 * Handles the common pattern of ZIP with images + metadata.csv (like HAM10000).
 */

export interface ImageMetadataAnalysis {
    suggestedImageColumn: string | null;
    suggestedLabelColumn: string | null;
    classDistribution: Record<string, number>;
    matchedImages: number;
    unmatchedImages: number;
    unmatchedFilenames: string[];
    totalImages: number;
    uniqueClasses: number;
    suggestedArchitecture: string;
    warnings: string[];
}

export interface ColumnAnalysis {
    column: string;
    uniqueValues: number;
    sampleValues: string[];
    isLikelyImageColumn: boolean;
    isLikelyLabelColumn: boolean;
    matchRate?: number; // Percentage of values that match image filenames
}

/**
 * Analyze a CSV's columns to find image filename and label columns
 */
export function analyzeImageMetadata(
    csvColumns: string[],
    csvRows: Record<string, any>[],
    imageFilenames: string[]
): ImageMetadataAnalysis {
    const warnings: string[] = [];
    const imageFilenameSet = new Set(imageFilenames.map(f => normalizeFilename(f)));

    const columnAnalyses: ColumnAnalysis[] = csvColumns.map(col => {
        const values = csvRows.map(row => String(row[col] || '').trim()).filter(Boolean);
        const uniqueValues = new Set(values);

        // Check if this column might contain image filenames
        let matchCount = 0;
        for (const val of values) {
            const normalized = normalizeFilename(val);
            if (imageFilenameSet.has(normalized) ||
                imageFilenameSet.has(normalized + '.jpg') ||
                imageFilenameSet.has(normalized + '.jpeg') ||
                imageFilenameSet.has(normalized + '.png')) {
                matchCount++;
            }
        }
        const matchRate = values.length > 0 ? matchCount / values.length : 0;

        // Heuristics for image column
        const colLower = col.toLowerCase();
        const isLikelyImageColumn =
            matchRate > 0.5 || // More than 50% match image files
            colLower.includes('image') ||
            colLower.includes('file') ||
            colLower.includes('path') ||
            colLower.includes('name') ||
            colLower === 'id' ||
            colLower.includes('_id');

        // Heuristics for label column (categorical with reasonable class count)
        const isLikelyLabelColumn =
            uniqueValues.size >= 2 &&
            uniqueValues.size <= 100 && // Reasonable number of classes
            !isLikelyImageColumn &&
            (colLower.includes('label') ||
                colLower.includes('class') ||
                colLower.includes('category') ||
                colLower.includes('target') ||
                colLower.includes('diagnosis') ||
                colLower.includes('dx') ||
                colLower.includes('type') ||
                // If it has few unique values, might be a label
                (uniqueValues.size <= 20 && values.length > uniqueValues.size * 5));

        return {
            column: col,
            uniqueValues: uniqueValues.size,
            sampleValues: Array.from(uniqueValues).slice(0, 5),
            isLikelyImageColumn,
            isLikelyLabelColumn,
            matchRate
        };
    });

    // Find best image column (highest match rate with heuristic boost)
    let imageColumn: ColumnAnalysis | null = null;
    for (const col of columnAnalyses) {
        if (col.isLikelyImageColumn) {
            if (!imageColumn || (col.matchRate || 0) > (imageColumn.matchRate || 0)) {
                imageColumn = col;
            }
        }
    }

    // Find best label column
    let labelColumn: ColumnAnalysis | null = null;
    for (const col of columnAnalyses) {
        if (col.isLikelyLabelColumn && col.column !== imageColumn?.column) {
            if (!labelColumn || col.uniqueValues < labelColumn.uniqueValues) {
                // Prefer columns with fewer unique values (likely to be actual classes)
                labelColumn = col;
            }
        }
    }

    // Calculate class distribution if we have a label column
    const classDistribution: Record<string, number> = {};
    if (labelColumn) {
        for (const row of csvRows) {
            const label = String(row[labelColumn.column] || 'unknown').trim();
            classDistribution[label] = (classDistribution[label] || 0) + 1;
        }
    }

    // Calculate matched/unmatched images
    let matchedImages = 0;
    const unmatchedFilenames: string[] = [];

    if (imageColumn) {
        for (const row of csvRows) {
            const filename = normalizeFilename(String(row[imageColumn.column] || ''));
            if (imageFilenameSet.has(filename) ||
                imageFilenameSet.has(filename + '.jpg') ||
                imageFilenameSet.has(filename + '.jpeg') ||
                imageFilenameSet.has(filename + '.png')) {
                matchedImages++;
            } else if (filename) {
                unmatchedFilenames.push(filename);
            }
        }
    }

    // Generate warnings
    if (!imageColumn) {
        warnings.push('Could not detect image filename column. Please select manually.');
    }
    if (!labelColumn) {
        warnings.push('Could not detect label column. Dataset may be unlabeled or require manual selection.');
    }
    if (unmatchedFilenames.length > 0 && unmatchedFilenames.length < 20) {
        warnings.push(`${unmatchedFilenames.length} image(s) referenced in CSV but not found in archive.`);
    } else if (unmatchedFilenames.length >= 20) {
        warnings.push(`${unmatchedFilenames.length} images referenced in CSV not found. Check filename column.`);
    }

    // Suggest architecture based on class count and image count
    const uniqueClasses = Object.keys(classDistribution).length;
    let suggestedArchitecture = 'CNN (Custom)';
    if (imageFilenames.length > 5000) {
        suggestedArchitecture = 'ResNet50 (Transfer Learning)';
    } else if (imageFilenames.length > 1000) {
        suggestedArchitecture = 'MobileNetV2 (Transfer Learning)';
    } else if (uniqueClasses <= 10) {
        suggestedArchitecture = 'EfficientNetB0 (Transfer Learning)';
    }

    return {
        suggestedImageColumn: imageColumn?.column || null,
        suggestedLabelColumn: labelColumn?.column || null,
        classDistribution,
        matchedImages,
        unmatchedImages: unmatchedFilenames.length,
        unmatchedFilenames: unmatchedFilenames.slice(0, 10), // Only keep first 10
        totalImages: imageFilenames.length,
        uniqueClasses,
        suggestedArchitecture,
        warnings
    };
}

/**
 * Normalize a filename for comparison (remove extension, lowercase, trim)
 */
function normalizeFilename(filename: string): string {
    return filename
        .toLowerCase()
        .trim()
        .replace(/\.(jpg|jpeg|png|gif|bmp|webp|tiff?)$/i, '')
        .replace(/[\/\\]/g, '/') // Normalize path separators
        .split('/').pop() || ''; // Get just filename, not path
}

/**
 * Analyze columns to suggest which ones might be useful
 */
export function getColumnSuggestions(
    columns: string[],
    rows: Record<string, any>[]
): ColumnAnalysis[] {
    return columns.map(col => {
        const values = rows.map(row => String(row[col] || '').trim()).filter(Boolean);
        const uniqueValues = new Set(values);
        const colLower = col.toLowerCase();

        const isLikelyImageColumn =
            colLower.includes('image') ||
            colLower.includes('file') ||
            colLower.includes('path') ||
            colLower.includes('name') ||
            colLower === 'id';

        const isLikelyLabelColumn =
            uniqueValues.size >= 2 &&
            uniqueValues.size <= 100 &&
            (colLower.includes('label') ||
                colLower.includes('class') ||
                colLower.includes('category') ||
                colLower.includes('target') ||
                colLower.includes('dx') ||
                colLower.includes('diagnosis'));

        return {
            column: col,
            uniqueValues: uniqueValues.size,
            sampleValues: Array.from(uniqueValues).slice(0, 5),
            isLikelyImageColumn,
            isLikelyLabelColumn
        };
    });
}

/**
 * Estimate training time for image dataset
 */
export function estimateImageTrainingTime(
    datasetSizeMB: number,
    imageCount: number,
    backend: 'runpod' | 'gcp-compute-engine',
    epochs: number = 50
): {
    estimatedMinutes: string;
    phases: { name: string; minutes: string }[];
    warning?: string;
} {
    if (backend === 'runpod') {
        // GPU training on RTX 4000 Ada (20GB VRAM)
        const startupMin = 5;
        const downloadMin = Math.ceil(datasetSizeMB / 100); // ~100MB/min download
        const trainMinPerEpoch = Math.ceil(imageCount / 1000) * 0.5; // ~500 img/min/epoch
        const trainingMin = Math.ceil(trainMinPerEpoch * epochs);
        const uploadMin = 3;
        const total = startupMin + downloadMin + trainingMin + uploadMin;

        return {
            estimatedMinutes: `${total - 15}–${total + 15}`,
            phases: [
                { name: 'GPU Pod Startup', minutes: `${startupMin}` },
                { name: 'Data Download', minutes: `${downloadMin}` },
                { name: `Training (${epochs} epochs)`, minutes: `${trainingMin}` },
                { name: 'Upload Results', minutes: `${uploadMin}` }
            ]
        };
    } else {
        // CPU training - much slower
        const startupMin = 3;
        const downloadMin = Math.ceil(datasetSizeMB / 50); // Slower download on smaller VMs
        const trainMinPerEpoch = Math.ceil(imageCount / 50) * 0.5; // ~50 img/min/epoch on CPU
        const trainingMin = Math.ceil(trainMinPerEpoch * epochs);
        const uploadMin = 5;
        const total = startupMin + downloadMin + trainingMin + uploadMin;

        const hours = Math.ceil(total / 60);

        return {
            estimatedMinutes: `${hours * 60 - 30}–${hours * 60 + 60}`,
            phases: [
                { name: 'VM Startup', minutes: `${startupMin}` },
                { name: 'Data Download', minutes: `${downloadMin}` },
                { name: `Training (${epochs} epochs)`, minutes: `${trainingMin}` },
                { name: 'Upload Results', minutes: `${uploadMin}` }
            ],
            warning: 'CPU training for images is very slow. Consider upgrading to Gold for GPU acceleration.'
        };
    }
}
