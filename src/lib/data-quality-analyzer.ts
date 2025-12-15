/**
 * Data Quality Analyzer
 * Analyzes datasets for quality issues and generates cleaning recommendations
 * These recommendations can be passed to the training pipeline
 */

import { type ColumnTypeInfo, type ColumnType } from './column-type-detection';

// ============ TYPES ============

export type CleaningAction =
    | 'drop_column'
    | 'fill_null_mean'
    | 'fill_null_median'
    | 'fill_null_mode'
    | 'fill_null_value'
    | 'drop_null_rows'
    | 'remove_duplicates'
    | 'normalize'
    | 'standardize'
    | 'encode_label'
    | 'encode_onehot'
    | 'clip_outliers'
    | 'log_transform'
    | 'convert_type';

export interface CleaningRecommendation {
    id: string;
    column?: string;
    action: CleaningAction;
    reason: string;
    severity: 'low' | 'medium' | 'high';
    impact: string;
    params?: Record<string, any>;
    applied?: boolean;
}

export interface DataQualityReport {
    totalRows: number;
    totalColumns: number;
    nullPercentage: number;
    duplicateRows: number;
    duplicatePercentage: number;
    columnIssues: Record<string, ColumnQualityIssue[]>;
    recommendations: CleaningRecommendation[];
    overallScore: number; // 0-100
}

export interface ColumnQualityIssue {
    type: 'null' | 'outlier' | 'skew' | 'low_variance' | 'high_cardinality' | 'duplicate_values' | 'type_mismatch';
    severity: 'low' | 'medium' | 'high';
    description: string;
    value?: number;
}

// ============ ANALYZER ============

/**
 * Analyze dataset quality and generate recommendations
 */
export function analyzeDataQuality(
    columns: string[],
    rows: Record<string, any>[],
    columnTypes: Record<string, ColumnTypeInfo>
): DataQualityReport {
    const recommendations: CleaningRecommendation[] = [];
    const columnIssues: Record<string, ColumnQualityIssue[]> = {};

    const totalRows = rows.length;
    const totalColumns = columns.length;
    let totalNulls = 0;
    let totalCells = totalRows * totalColumns;

    // Analyze each column
    columns.forEach(col => {
        const typeInfo = columnTypes[col];
        const issues: ColumnQualityIssue[] = [];
        const values = rows.map(row => row[col]);

        // Count nulls
        const nullValues = values.filter(v =>
            v === null || v === undefined || v === '' ||
            (typeof v === 'string' && (v.toLowerCase() === 'null' || v.toLowerCase() === 'nan' || v === 'undefined'))
        );
        const nullCount = nullValues.length;
        const nullPercentage = (nullCount / totalRows) * 100;
        totalNulls += nullCount;

        // Check for high null percentage
        if (nullPercentage > 50) {
            issues.push({
                type: 'null',
                severity: 'high',
                description: `${nullPercentage.toFixed(1)}% null values`,
                value: nullPercentage
            });
            recommendations.push({
                id: `${col}_drop_column`,
                column: col,
                action: 'drop_column',
                reason: `Column "${col}" has ${nullPercentage.toFixed(1)}% missing values`,
                severity: 'high',
                impact: 'Removes unreliable column from analysis'
            });
        } else if (nullPercentage > 10) {
            issues.push({
                type: 'null',
                severity: 'medium',
                description: `${nullPercentage.toFixed(1)}% null values`,
                value: nullPercentage
            });

            // Recommend fill strategy based on type
            if (typeInfo?.type === 'numeric') {
                recommendations.push({
                    id: `${col}_fill_median`,
                    column: col,
                    action: 'fill_null_median',
                    reason: `Fill ${nullCount} missing values with median`,
                    severity: 'medium',
                    impact: 'Preserves data distribution for numeric column'
                });
            } else if (typeInfo?.type === 'categorical') {
                recommendations.push({
                    id: `${col}_fill_mode`,
                    column: col,
                    action: 'fill_null_mode',
                    reason: `Fill ${nullCount} missing values with most frequent value`,
                    severity: 'medium',
                    impact: 'Uses most common category for imputation'
                });
            }
        } else if (nullPercentage > 0) {
            issues.push({
                type: 'null',
                severity: 'low',
                description: `${nullPercentage.toFixed(1)}% null values`,
                value: nullPercentage
            });
        }

        // Check for numeric issues
        if (typeInfo?.type === 'numeric') {
            const numericValues = values
                .filter(v => v !== null && v !== undefined && v !== '')
                .map(v => parseFloat(String(v).replace(/[,$%]/g, '')))
                .filter(v => !isNaN(v));

            if (numericValues.length > 5) {
                // Check for outliers using IQR
                const sorted = [...numericValues].sort((a, b) => a - b);
                const q1 = sorted[Math.floor(sorted.length * 0.25)];
                const q3 = sorted[Math.floor(sorted.length * 0.75)];
                const iqr = q3 - q1;
                const lowerBound = q1 - 1.5 * iqr;
                const upperBound = q3 + 1.5 * iqr;
                const outliers = numericValues.filter(v => v < lowerBound || v > upperBound);
                const outlierPercentage = (outliers.length / numericValues.length) * 100;

                if (outlierPercentage > 5) {
                    issues.push({
                        type: 'outlier',
                        severity: outlierPercentage > 15 ? 'high' : 'medium',
                        description: `${outlierPercentage.toFixed(1)}% outliers detected`,
                        value: outlierPercentage
                    });
                    recommendations.push({
                        id: `${col}_clip_outliers`,
                        column: col,
                        action: 'clip_outliers',
                        reason: `Clip ${outliers.length} outliers to [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
                        severity: 'medium',
                        impact: 'Reduces noise from extreme values',
                        params: { lower: lowerBound, upper: upperBound }
                    });
                }

                // Check for skewness
                const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
                const std = Math.sqrt(numericValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / numericValues.length);
                const skewness = numericValues.reduce((sum, v) => sum + Math.pow((v - mean) / std, 3), 0) / numericValues.length;

                if (Math.abs(skewness) > 1) {
                    issues.push({
                        type: 'skew',
                        severity: Math.abs(skewness) > 2 ? 'high' : 'medium',
                        description: `${skewness > 0 ? 'Right' : 'Left'}-skewed (${skewness.toFixed(2)})`,
                        value: skewness
                    });
                    if (skewness > 1 && Math.min(...numericValues) > 0) {
                        recommendations.push({
                            id: `${col}_log_transform`,
                            column: col,
                            action: 'log_transform',
                            reason: `Apply log transform to reduce right-skewness`,
                            severity: 'low',
                            impact: 'Normalizes distribution for better model performance'
                        });
                    }
                }
            }
        }

        // Check for high cardinality in categorical
        if (typeInfo?.type === 'categorical' || typeInfo?.type === 'text') {
            const uniqueValues = new Set(values.filter(v => v !== null && v !== undefined));
            const uniqueRatio = uniqueValues.size / totalRows;

            if (uniqueRatio > 0.5 && typeInfo?.type === 'categorical') {
                issues.push({
                    type: 'high_cardinality',
                    severity: 'medium',
                    description: `High cardinality: ${uniqueValues.size} unique values`,
                    value: uniqueValues.size
                });
            }
        }

        // Check for ID column (should maybe be dropped)
        if (typeInfo?.type === 'id') {
            recommendations.push({
                id: `${col}_drop_id`,
                column: col,
                action: 'drop_column',
                reason: `ID column "${col}" doesn't add predictive value`,
                severity: 'low',
                impact: 'Removes non-informative identifier column'
            });
        }

        columnIssues[col] = issues;
    });

    // Check for duplicate rows
    const rowStrings = rows.map(row => JSON.stringify(row));
    const duplicateCount = rowStrings.length - new Set(rowStrings).size;
    const duplicatePercentage = (duplicateCount / totalRows) * 100;

    if (duplicateCount > 0) {
        recommendations.push({
            id: 'remove_duplicates',
            action: 'remove_duplicates',
            reason: `Remove ${duplicateCount} duplicate rows (${duplicatePercentage.toFixed(1)}%)`,
            severity: duplicatePercentage > 10 ? 'high' : 'medium',
            impact: 'Ensures each data point is unique'
        });
    }

    // Calculate overall quality score
    const nullScore = Math.max(0, 100 - (totalNulls / totalCells) * 200);
    const duplicateScore = Math.max(0, 100 - duplicatePercentage * 2);
    const issueCount = Object.values(columnIssues).reduce((sum, issues) => sum + issues.length, 0);
    const issueScore = Math.max(0, 100 - issueCount * 5);
    const overallScore = Math.round((nullScore + duplicateScore + issueScore) / 3);

    return {
        totalRows,
        totalColumns,
        nullPercentage: (totalNulls / totalCells) * 100,
        duplicateRows: duplicateCount,
        duplicatePercentage,
        columnIssues,
        recommendations: recommendations.slice(0, 10), // Top 10 recommendations
        overallScore
    };
}

/**
 * Generate a summary of data quality issues
 */
export function getQualitySummary(report: DataQualityReport): string {
    const issues: string[] = [];

    if (report.nullPercentage > 5) {
        issues.push(`${report.nullPercentage.toFixed(1)}% missing values`);
    }
    if (report.duplicateRows > 0) {
        issues.push(`${report.duplicateRows} duplicate rows`);
    }
    if (report.recommendations.length > 0) {
        issues.push(`${report.recommendations.length} cleaning suggestions`);
    }

    if (issues.length === 0) {
        return `✅ Data quality excellent (Score: ${report.overallScore}/100)`;
    }

    return `${issues.join(' • ')} — Score: ${report.overallScore}/100`;
}

/**
 * Convert recommendations to CleaningConfig format for training
 */
export function recommendationsToCleaningConfig(
    recommendations: CleaningRecommendation[]
): Record<string, any> {
    return {
        dropColumns: recommendations
            .filter(r => r.action === 'drop_column' && r.applied)
            .map(r => r.column),
        fillNullStrategy: recommendations
            .filter(r => r.action.startsWith('fill_null') && r.applied)
            .reduce((acc, r) => ({ ...acc, [r.column!]: r.action.replace('fill_null_', '') }), {}),
        removeDuplicates: recommendations.some(r => r.action === 'remove_duplicates' && r.applied),
        clipOutliers: recommendations
            .filter(r => r.action === 'clip_outliers' && r.applied)
            .map(r => ({ column: r.column, ...r.params }))
    };
}
