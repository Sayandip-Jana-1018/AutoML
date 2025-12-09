/**
 * Chat Command Types
 * Formalized command detection and code modification patterns
 */

export interface ChatCommand {
    type: CommandType;
    params: Record<string, any>;
    description: string;
    codeModification?: string;
}

export type CommandType =
    | 'SET_SPLIT_RATIO'
    | 'CHANGE_MODEL'
    | 'ADD_METRIC'
    | 'SET_EPOCHS'
    | 'SET_TREES'
    | 'SET_LEARNING_RATE'
    | 'ADD_LAYER'
    | 'MODIFY_PREPROCESSING'
    | 'ENABLE_HPO'
    | 'SET_TARGET'
    | 'ADD_FEATURE_ENGINEERING'
    | 'GENERAL';

/**
 * Command patterns for detection
 */
export const COMMAND_PATTERNS: { pattern: RegExp; type: CommandType; extract: (match: RegExpMatchArray) => Record<string, any> }[] = [
    {
        pattern: /split\s*(?:ratio|size)?\s*(?:to|=|:)?\s*(\d+)[\s/:-]*(\d+)/i,
        type: 'SET_SPLIT_RATIO',
        extract: (match) => ({ trainRatio: parseInt(match[1]) / 100, testRatio: parseInt(match[2]) / 100 })
    },
    {
        pattern: /test\s*(?:size|split)?\s*(?:to|=|:)?\s*(\d+)%?/i,
        type: 'SET_SPLIT_RATIO',
        extract: (match) => ({ testSize: parseInt(match[1]) / 100 })
    },
    {
        pattern: /(?:use|change\s*to|switch\s*to)\s+(xgboost|random\s*forest|logistic\s*regression|linear\s*regression|svm|knn|gradient\s*boost|neural\s*net|decision\s*tree)/i,
        type: 'CHANGE_MODEL',
        extract: (match) => ({ model: normalizeModelName(match[1]) })
    },
    {
        pattern: /add\s+(?:the\s+)?(f1|precision|recall|accuracy|rmse|mae|r2|auc|roc)/i,
        type: 'ADD_METRIC',
        extract: (match) => ({ metric: match[1].toLowerCase() })
    },
    {
        pattern: /(?:set\s+)?epochs?\s*(?:to|=|:)?\s*(\d+)/i,
        type: 'SET_EPOCHS',
        extract: (match) => ({ epochs: parseInt(match[1]) })
    },
    {
        pattern: /(?:set\s+)?(?:n_estimators|trees?|estimators?)\s*(?:to|=|:)?\s*(\d+)/i,
        type: 'SET_TREES',
        extract: (match) => ({ nEstimators: parseInt(match[1]) })
    },
    {
        pattern: /(?:set\s+)?(?:learning[\s_]?rate|lr)\s*(?:to|=|:)?\s*([\d.]+)/i,
        type: 'SET_LEARNING_RATE',
        extract: (match) => ({ learningRate: parseFloat(match[1]) })
    },
    {
        pattern: /add\s+(?:a\s+)?(?:dropout|dense|hidden)\s*(?:layer)?\s*(?:of|with)?\s*(?:size)?\s*(\d+)?/i,
        type: 'ADD_LAYER',
        extract: (match) => ({ layerType: 'dense', size: match[1] ? parseInt(match[1]) : 64 })
    },
    {
        pattern: /(?:enable|run|do)\s+(?:hyperparameter\s+)?(?:tuning|hpo|optimization)/i,
        type: 'ENABLE_HPO',
        extract: () => ({ enabled: true })
    },
    {
        pattern: /(?:set|change)\s+target\s*(?:column|to|:)?\s*["']?(\w+)["']?/i,
        type: 'SET_TARGET',
        extract: (match) => ({ targetColumn: match[1] })
    },
    {
        pattern: /(?:add|create)\s+(?:feature\s+)?(?:engineering|polynomial|interaction)/i,
        type: 'ADD_FEATURE_ENGINEERING',
        extract: () => ({ type: 'polynomial' })
    }
];

/**
 * Normalize model name
 */
function normalizeModelName(input: string): string {
    const normalized = input.toLowerCase().replace(/\s+/g, '');
    const mapping: Record<string, string> = {
        'xgboost': 'XGBoost',
        'randomforest': 'RandomForest',
        'logisticregression': 'LogisticRegression',
        'linearregression': 'LinearRegression',
        'svm': 'SVM',
        'knn': 'KNN',
        'gradientboost': 'GradientBoosting',
        'gradientboosting': 'GradientBoosting',
        'neuralnet': 'NeuralNetwork',
        'neuralnetwork': 'NeuralNetwork',
        'decisiontree': 'DecisionTree'
    };
    return mapping[normalized] || 'RandomForest';
}

/**
 * Detect command from user message
 */
export function detectCommand(message: string): ChatCommand | null {
    for (const { pattern, type, extract } of COMMAND_PATTERNS) {
        const match = message.match(pattern);
        if (match) {
            return {
                type,
                params: extract(match),
                description: getCommandDescription(type, extract(match))
            };
        }
    }
    return null;
}

/**
 * Detect ALL matching commands (for ambiguity detection)
 */
export function detectAllCommands(message: string): ChatCommand[] {
    const commands: ChatCommand[] = [];
    for (const { pattern, type, extract } of COMMAND_PATTERNS) {
        const match = message.match(pattern);
        if (match) {
            commands.push({
                type,
                params: extract(match),
                description: getCommandDescription(type, extract(match))
            });
        }
    }
    return commands;
}

/**
 * Detect if command is ambiguous (matches multiple patterns)
 * Returns structured response for UI
 */
export function detectAmbiguousCommand(message: string): {
    isAmbiguous: boolean;
    detectedCommand: ChatCommand | null;
    isSafe: boolean;
    reason?: string;
    possibleCommands?: CommandType[];
} {
    const allCommands = detectAllCommands(message);

    if (allCommands.length === 0) {
        return {
            isAmbiguous: false,
            detectedCommand: null,
            isSafe: true,
            reason: "No recognized command pattern"
        };
    }

    if (allCommands.length === 1) {
        return {
            isAmbiguous: false,
            detectedCommand: allCommands[0],
            isSafe: true
        };
    }

    // Multiple commands detected = ambiguous
    return {
        isAmbiguous: true,
        detectedCommand: null,
        isSafe: false,
        reason: `Ambiguous command: matches ${allCommands.length} patterns. Please be more specific.`,
        possibleCommands: allCommands.map(c => c.type)
    };
}

/**
 * Get human-readable command description
 */
function getCommandDescription(type: CommandType, params: Record<string, any>): string {
    switch (type) {
        case 'SET_SPLIT_RATIO':
            return params.testSize
                ? `Set test size to ${(params.testSize * 100).toFixed(0)}%`
                : `Set train/test split to ${(params.trainRatio * 100).toFixed(0)}/${(params.testRatio * 100).toFixed(0)}`;
        case 'CHANGE_MODEL':
            return `Change model to ${params.model}`;
        case 'ADD_METRIC':
            return `Add ${params.metric.toUpperCase()} metric`;
        case 'SET_EPOCHS':
            return `Set epochs to ${params.epochs}`;
        case 'SET_TREES':
            return `Set n_estimators to ${params.nEstimators}`;
        case 'SET_LEARNING_RATE':
            return `Set learning rate to ${params.learningRate}`;
        case 'ADD_LAYER':
            return `Add ${params.layerType} layer with ${params.size} units`;
        case 'ENABLE_HPO':
            return 'Enable hyperparameter tuning';
        case 'SET_TARGET':
            return `Set target column to "${params.targetColumn}"`;
        case 'ADD_FEATURE_ENGINEERING':
            return `Add ${params.type} feature engineering`;
        default:
            return 'General code modification';
    }
}

/**
 * Generate code modification for command
 */
export function generateCodeModification(command: ChatCommand, currentScript: string): {
    modifiedScript: string;
    diff: CodeDiff[]
} {
    const diff: CodeDiff[] = [];
    let modifiedScript = currentScript;

    switch (command.type) {
        case 'SET_SPLIT_RATIO': {
            const testSize = command.params.testSize || command.params.testRatio || 0.2;
            const oldPattern = /test_size\s*=\s*[\d.]+/g;
            const newValue = `test_size=${testSize}`;

            if (oldPattern.test(currentScript)) {
                modifiedScript = currentScript.replace(oldPattern, newValue);
                diff.push({
                    type: 'replace',
                    original: currentScript.match(oldPattern)?.[0] || '',
                    modified: newValue,
                    lineRange: findLineRange(currentScript, oldPattern)
                });
            }
            break;
        }

        case 'SET_TREES': {
            const nEstimators = command.params.nEstimators;
            const oldPattern = /n_estimators\s*=\s*\d+/g;
            const newValue = `n_estimators=${nEstimators}`;

            if (oldPattern.test(currentScript)) {
                modifiedScript = currentScript.replace(oldPattern, newValue);
                diff.push({
                    type: 'replace',
                    original: currentScript.match(oldPattern)?.[0] || '',
                    modified: newValue,
                    lineRange: findLineRange(currentScript, oldPattern)
                });
            }
            break;
        }

        case 'SET_EPOCHS': {
            const epochs = command.params.epochs;
            const oldPattern = /(?:epochs|max_iter)\s*=\s*\d+/g;
            const newValue = `max_iter=${epochs}`;

            if (oldPattern.test(currentScript)) {
                modifiedScript = currentScript.replace(oldPattern, newValue);
                diff.push({
                    type: 'replace',
                    original: currentScript.match(oldPattern)?.[0] || '',
                    modified: newValue,
                    lineRange: findLineRange(currentScript, oldPattern)
                });
            }
            break;
        }

        case 'SET_LEARNING_RATE': {
            const lr = command.params.learningRate;
            const oldPattern = /learning_rate\s*=\s*[\d.]+/g;
            const newValue = `learning_rate=${lr}`;

            if (oldPattern.test(currentScript)) {
                modifiedScript = currentScript.replace(oldPattern, newValue);
                diff.push({
                    type: 'replace',
                    original: currentScript.match(oldPattern)?.[0] || '',
                    modified: newValue,
                    lineRange: findLineRange(currentScript, oldPattern)
                });
            }
            break;
        }

        // For complex commands like CHANGE_MODEL, we rely on the AI to regenerate
        default:
            break;
    }

    return { modifiedScript, diff };
}

/**
 * Find line range for a pattern
 */
function findLineRange(script: string, pattern: RegExp): { start: number; end: number } {
    const lines = script.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
            return { start: i + 1, end: i + 1 };
        }
    }
    return { start: 0, end: 0 };
}

/**
 * Code diff representation
 */
export interface CodeDiff {
    type: 'add' | 'remove' | 'replace';
    original?: string;
    modified: string;
    lineRange: { start: number; end: number };
}

/**
 * Format diff for display
 */
export function formatDiffForDisplay(diffs: CodeDiff[]): string {
    return diffs.map(d => {
        if (d.type === 'replace') {
            return `Line ${d.lineRange.start}:\n- ${d.original}\n+ ${d.modified}`;
        } else if (d.type === 'add') {
            return `Line ${d.lineRange.start} (add):\n+ ${d.modified}`;
        } else {
            return `Line ${d.lineRange.start} (remove):\n- ${d.original}`;
        }
    }).join('\n\n');
}

/**
 * Pending change awaiting user confirmation
 */
export interface PendingChange {
    command: ChatCommand;
    originalScript: string;
    modifiedScript: string;
    diffs: CodeDiff[];
    timestamp: number;
}
