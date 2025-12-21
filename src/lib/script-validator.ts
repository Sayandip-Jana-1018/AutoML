/**
 * Comprehensive Script Validator
 * 
 * Validates Python ML scripts before training to catch 90% of errors early.
 * Checks syntax, imports, functions, dataset paths, and common pitfalls.
 */

export type ScriptType = 'tabular' | 'image' | 'unknown';
export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
    severity: ValidationSeverity;
    type: 'syntax' | 'import' | 'function' | 'path' | 'structure' | 'pitfall';
    message: string;
    line?: number;
    suggestion?: string;
}

export interface ValidationResult {
    valid: boolean;
    scriptType: ScriptType;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    summary: string;
}

/**
 * Detect script type based on imports and patterns
 */
export function detectScriptType(script: string): ScriptType {
    const hasImagePatterns =
        script.includes('tensorflow') ||
        script.includes('keras') ||
        script.includes('ImageDataGenerator') ||
        script.includes('flow_from_directory') ||
        script.includes('find_dataset_path') ||
        script.includes('Conv2D') ||
        script.includes('image_dataset_from_directory');

    const hasTabularPatterns =
        script.includes('pandas') ||
        script.includes('pd.read_csv') ||
        script.includes('sklearn') ||
        script.includes('train_test_split') ||
        script.includes('RandomForest') ||
        script.includes('XGBoost') ||
        script.includes('LightGBM');

    if (hasImagePatterns && !hasTabularPatterns) return 'image';
    if (hasTabularPatterns && !hasImagePatterns) return 'tabular';
    if (hasImagePatterns && hasTabularPatterns) {
        // Both patterns - likely image since it may use sklearn for metrics
        return 'image';
    }
    return 'unknown';
}

/**
 * Check for balanced brackets and quotes
 */
function checkSyntax(script: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check balanced parentheses
    const openParens = (script.match(/\(/g) || []).length;
    const closeParens = (script.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        issues.push({
            severity: 'error',
            type: 'syntax',
            message: `Unbalanced parentheses: ${openParens} open, ${closeParens} close`,
            suggestion: 'Check for missing or extra parentheses in function calls'
        });
    }

    // Check balanced brackets
    const openBrackets = (script.match(/\[/g) || []).length;
    const closeBrackets = (script.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
        issues.push({
            severity: 'error',
            type: 'syntax',
            message: `Unbalanced brackets: ${openBrackets} open, ${closeBrackets} close`,
            suggestion: 'Check for missing or extra brackets in list/array indexing'
        });
    }

    // Check balanced braces
    const openBraces = (script.match(/\{/g) || []).length;
    const closeBraces = (script.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        issues.push({
            severity: 'error',
            type: 'syntax',
            message: `Unbalanced braces: ${openBraces} open, ${closeBraces} close`,
            suggestion: 'Check for missing or extra braces in dictionaries/f-strings'
        });
    }

    // Check for common Python syntax errors
    if (script.includes('print ') && !script.includes('print(')) {
        const lineNum = findLineNumber(script, 'print ');
        issues.push({
            severity: 'error',
            type: 'syntax',
            message: 'Python 2 style print statement detected',
            line: lineNum,
            suggestion: 'Use print() function instead of print statement'
        });
    }

    // Check for tabs vs spaces inconsistency (common issue)
    if (script.includes('\t') && script.includes('    ')) {
        issues.push({
            severity: 'warning',
            type: 'syntax',
            message: 'Mixed tabs and spaces detected',
            suggestion: 'Use consistent indentation (4 spaces recommended)'
        });
    }

    return issues;
}

/**
 * Check for required imports based on script type
 */
function checkImports(script: string, scriptType: ScriptType): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (scriptType === 'tabular') {
        // Check pandas
        if (!script.includes('import pandas') && !script.includes('from pandas')) {
            issues.push({
                severity: 'error',
                type: 'import',
                message: 'Missing pandas import',
                suggestion: 'Add: import pandas as pd'
            });
        }

        // Check sklearn
        if (!script.includes('sklearn') && !script.includes('xgboost') && !script.includes('lightgbm')) {
            issues.push({
                severity: 'warning',
                type: 'import',
                message: 'No ML library import detected (sklearn, xgboost, lightgbm)',
                suggestion: 'Import a model from sklearn or other ML library'
            });
        }

        // Check train_test_split
        if (!script.includes('train_test_split')) {
            issues.push({
                severity: 'warning',
                type: 'import',
                message: 'No train_test_split detected',
                suggestion: 'Consider splitting data: from sklearn.model_selection import train_test_split'
            });
        }
    }

    if (scriptType === 'image') {
        // Check TensorFlow/Keras
        if (!script.includes('tensorflow') && !script.includes('keras') && !script.includes('torch')) {
            issues.push({
                severity: 'error',
                type: 'import',
                message: 'Missing deep learning framework import (TensorFlow/Keras/PyTorch)',
                suggestion: 'Add: import tensorflow as tf'
            });
        }

        // Check for data loading
        if (!script.includes('ImageDataGenerator') &&
            !script.includes('image_dataset_from_directory') &&
            !script.includes('flow_from_directory') &&
            !script.includes('find_dataset_path')) {
            issues.push({
                severity: 'warning',
                type: 'import',
                message: 'No image data loading method detected',
                suggestion: 'Use ImageDataGenerator or tf.keras.utils.image_dataset_from_directory'
            });
        }
    }

    // Check for os import if file operations are present
    if ((script.includes('os.path') || script.includes('os.listdir') || script.includes('os.makedirs'))
        && !script.includes('import os')) {
        issues.push({
            severity: 'error',
            type: 'import',
            message: 'Using os module without importing it',
            suggestion: 'Add: import os'
        });
    }

    return issues;
}

/**
 * Check for required functions
 */
function checkFunctions(script: string, scriptType: ScriptType): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for main entry point
    if (!script.includes('if __name__') && !script.includes('def main') && !script.includes('main()')) {
        issues.push({
            severity: 'warning',
            type: 'function',
            message: 'No main entry point detected',
            suggestion: 'Add: if __name__ == "__main__": at the end'
        });
    }

    if (scriptType === 'tabular') {
        // Check for load_data function
        if (!script.includes('def load_data') && !script.includes('pd.read_csv')) {
            issues.push({
                severity: 'error',
                type: 'function',
                message: 'Missing data loading (load_data function or pd.read_csv)',
                suggestion: 'Add a load_data() function or use pd.read_csv() directly'
            });
        }
    }

    // Check for model saving
    if (!script.includes('joblib.dump') &&
        !script.includes('model.save') &&
        !script.includes('pickle.dump') &&
        !script.includes('save_model')) {
        issues.push({
            severity: 'warning',
            type: 'function',
            message: 'No model saving code detected',
            suggestion: 'Add: joblib.dump(model, "model.pkl") or model.save("model.h5")'
        });
    }

    // Check for metrics output
    if (!script.includes('metrics.json') && !script.includes('json.dump') && !script.includes('json.dumps')) {
        issues.push({
            severity: 'warning',
            type: 'function',
            message: 'No metrics JSON output detected',
            suggestion: 'Save metrics to metrics.json for tracking'
        });
    }

    return issues;
}

/**
 * Check dataset paths
 */
function checkPaths(script: string, scriptType: ScriptType): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for placeholder paths
    const placeholderPatterns = [
        { pattern: /['"]path_to/i, name: 'path_to' },
        { pattern: /['"]your_file/i, name: 'your_file' },
        { pattern: /['"]your_dataset/i, name: 'your_dataset' },
        { pattern: /['"]placeholder/i, name: 'placeholder' },
        { pattern: /['"]<.*>/i, name: '<placeholder>' },
        { pattern: /['"]INSERT_PATH/i, name: 'INSERT_PATH' },
    ];

    for (const { pattern, name } of placeholderPatterns) {
        if (pattern.test(script)) {
            const lineNum = findLineNumber(script, name);
            issues.push({
                severity: 'error',
                type: 'path',
                message: `Placeholder path detected: "${name}"`,
                line: lineNum,
                suggestion: 'Replace with actual path like "./dataset.csv" or "./dataset"'
            });
        }
    }

    // Check for hardcoded absolute paths (Windows or Linux)
    const absolutePathPattern = /['"](C:\\|D:\\|\/home\/|\/Users\/)/i;
    if (absolutePathPattern.test(script)) {
        issues.push({
            severity: 'error',
            type: 'path',
            message: 'Hardcoded absolute path detected',
            suggestion: 'Use relative paths like "./dataset.csv" for portability'
        });
    }

    if (scriptType === 'tabular') {
        // Check for valid CSV path
        const validPaths = ['./dataset.csv', '/tmp/dataset.csv', 'dataset.csv', '/tmp/training/dataset.csv'];
        const hasValidPath = validPaths.some(p => script.includes(p)) ||
            script.includes('DATASET_GCS_PATH') ||
            script.includes('os.environ');

        if (!hasValidPath && script.includes('read_csv')) {
            issues.push({
                severity: 'warning',
                type: 'path',
                message: 'Dataset path may not work in training environment',
                suggestion: 'Use "./dataset.csv" - the training system places data there'
            });
        }
    }

    return issues;
}

/**
 * Check for common pitfalls
 */
function checkPitfalls(script: string, scriptType: ScriptType): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Pitfall: df.fillna(df.mean()) on mixed types
    if (script.includes('fillna(df.mean())') || script.includes('fillna(df.median())')) {
        const lineNum = findLineNumber(script, 'fillna(df.');
        issues.push({
            severity: 'warning',
            type: 'pitfall',
            message: 'fillna(df.mean()) may fail on non-numeric columns',
            line: lineNum,
            suggestion: 'Use SimpleImputer with ColumnTransformer to handle numeric and categorical separately'
        });
    }

    // Pitfall: Not handling missing values
    if (script.includes('read_csv') && !script.includes('fillna') &&
        !script.includes('dropna') && !script.includes('SimpleImputer')) {
        issues.push({
            severity: 'warning',
            type: 'pitfall',
            message: 'No missing value handling detected',
            suggestion: 'Consider using SimpleImputer or df.fillna() to handle missing values'
        });
    }

    // Pitfall: Fitting scaler on test data
    if (script.includes('fit_transform(X_test)') || script.includes('fit_transform(y_test)')) {
        const lineNum = findLineNumber(script, 'fit_transform(X_test)') || findLineNumber(script, 'fit_transform(y_test)');
        issues.push({
            severity: 'error',
            type: 'pitfall',
            message: 'fit_transform() should not be used on test data (data leakage)',
            line: lineNum,
            suggestion: 'Use transform() on test data, only fit_transform() on training data'
        });
    }

    // Pitfall: Hardcoded column names that may not exist
    if (scriptType === 'tabular') {
        // Check for hardcoded column drops/accesses that aren't dynamic
        const hardcodedColumns = script.match(/\[['"][A-Za-z_]+['"]\]/g);
        if (hardcodedColumns && hardcodedColumns.length > 5) {
            issues.push({
                severity: 'warning',
                type: 'pitfall',
                message: `Many hardcoded column names detected (${hardcodedColumns.length})`,
                suggestion: 'Consider using dynamic column detection with df.select_dtypes()'
            });
        }
    }

    // Pitfall: Not setting random state
    if ((script.includes('train_test_split') || script.includes('RandomForest') || script.includes('KFold'))
        && !script.includes('random_state')) {
        issues.push({
            severity: 'warning',
            type: 'pitfall',
            message: 'No random_state set - results will not be reproducible',
            suggestion: 'Add random_state=42 to ensure reproducible results'
        });
    }

    // Pitfall: Using deprecated parameters
    if (script.includes('use_label_encoder=False')) {
        // Actually this is correct for older XGBoost, not a pitfall
    }

    // Pitfall: Image script without GPU check
    if (scriptType === 'image' && !script.includes('GPU') && !script.includes('CUDA') && !script.includes('device')) {
        issues.push({
            severity: 'warning',
            type: 'pitfall',
            message: 'No GPU availability check detected',
            suggestion: 'Add: print(tf.config.list_physical_devices("GPU"))'
        });
    }

    return issues;
}

/**
 * Find line number of a pattern in script
 */
function findLineNumber(script: string, pattern: string): number | undefined {
    const lines = script.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(pattern)) {
            return i + 1; // 1-indexed
        }
    }
    return undefined;
}

/**
 * Main validation function
 */
export function validateScript(script: string): ValidationResult {
    const scriptType = detectScriptType(script);

    const allIssues: ValidationIssue[] = [
        ...checkSyntax(script),
        ...checkImports(script, scriptType),
        ...checkFunctions(script, scriptType),
        ...checkPaths(script, scriptType),
        ...checkPitfalls(script, scriptType),
    ];

    const errors = allIssues.filter(i => i.severity === 'error');
    const warnings = allIssues.filter(i => i.severity === 'warning');

    const valid = errors.length === 0;

    let summary: string;
    if (valid && warnings.length === 0) {
        summary = `✅ Script looks good! Detected as ${scriptType} training script.`;
    } else if (valid) {
        summary = `⚠️ ${warnings.length} warning(s) found. Script may work but review suggestions.`;
    } else {
        summary = `❌ ${errors.length} error(s) found. Fix these before training.`;
    }

    return {
        valid,
        scriptType,
        errors,
        warnings,
        summary
    };
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
    let output = result.summary + '\n\n';

    if (result.errors.length > 0) {
        output += '🚫 ERRORS (must fix):\n';
        for (const error of result.errors) {
            output += `  • ${error.message}`;
            if (error.line) output += ` (line ${error.line})`;
            output += '\n';
            if (error.suggestion) output += `    → ${error.suggestion}\n`;
        }
        output += '\n';
    }

    if (result.warnings.length > 0) {
        output += '⚠️ WARNINGS (review):\n';
        for (const warning of result.warnings) {
            output += `  • ${warning.message}`;
            if (warning.line) output += ` (line ${warning.line})`;
            output += '\n';
            if (warning.suggestion) output += `    → ${warning.suggestion}\n`;
        }
    }

    return output;
}

export default {
    validateScript,
    detectScriptType,
    formatValidationResult
};
