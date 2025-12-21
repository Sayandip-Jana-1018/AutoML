import { NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { RESOURCE_POLICIES, type SubscriptionTier } from '@/lib/resource-policy';
import { detectCommand, generateCodeModification, formatDiffForDisplay, type ChatCommand } from '@/lib/chat-commands';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const {
            projectId,
            message,
            currentScript,
            datasetType,
            model,
            schema, // Rich schema from profiler
            tier = 'free' as SubscriptionTier,
            datasetInfo // Additional dataset context (from Fix with AI)
        } = await req.json();

        // 0. Select Model Provider
        let selectedModel;
        if (model === 'openai') {
            if (!process.env.OPENAI_API_KEY) throw new Error("Missing OpenAI API Key");
            selectedModel = openai('gpt-4o');
        } else if (model === 'claude') {
            if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing Anthropic API Key");
            selectedModel = anthropic('claude-3-opus-20240229');
        } else {
            selectedModel = google('gemini-2.5-flash');
        }

        // Get resource limits for the user's tier (with validation)
        const validTier: SubscriptionTier = ['free', 'silver', 'gold'].includes(tier) ? tier : 'free';
        const limits = RESOURCE_POLICIES[validTier];

        // Build rich context from schema and datasetInfo
        let schemaContext = schema ? `
Dataset Schema:
- Rows: ${schema.rowCount || 'Unknown'}
- Columns: ${schema.columnCount || 'Unknown'}
- Task Type: ${schema.inferredTaskType || 'Unknown'}
- Suggested Target: ${schema.targetColumnSuggestion || 'Unknown'}
- Missing Values: ${schema.missingValueStats?.percentMissing?.toFixed(1) || 0}%
- Column Types: ${schema.columns?.map((c: any) => `${c.name}(${c.type})`).join(', ') || 'Unknown'}
` : '';

        // Add datasetInfo if provided (from Fix with AI flow)
        if (datasetInfo) {
            schemaContext += `
Additional Dataset Context:
- Filename: ${datasetInfo.filename || 'Unknown'}
- Task Type: ${datasetInfo.taskType || 'Unknown'}
- Target Column: ${datasetInfo.targetColumn || 'Unknown'}
`;
        }

        // 1. Enhanced Architect Agent Prompt with resource limits
        const systemPrompt = `
You are a Senior Machine Learning Architect helping generate Python training scripts.

CONTEXT:
- Current Script: A Python ML training script.
- Dataset Type: "${datasetType || 'unknown'}"
- User Request: "${message}"
- User Plan: "${tier}" (max ${limits.maxEpochs} epochs, max ${limits.maxTrees} trees, batch ${limits.maxBatchSize})
${schemaContext}

YOUR GOALS:
1. GENERATE VALID CODE:
   - Create a complete, runnable Python training script
   - Use sensible defaults within the user's plan limits
   - For tree-based models, use n_estimators=100 by default (well within limits)
   - For neural networks/CNNs, the script uses epochs=20 and batch_size=32 by default
   - Users can customize epochs/batch_size in the Training Config panel before training

2. CRITICAL: TARGET COLUMN RULES:
   - YOU MUST use the "Suggested Target" from the Dataset Schema above as target_col
   - NEVER guess or pick your own target column - always use the one from schema
   - If schema says "Suggested Target: Survived", use target_col = 'Survived'
   - The target column should be EXCLUDED from feature columns (numeric_cols, categorical_cols)
   
3. CRITICAL: DYNAMIC COLUMN DETECTION (REQUIRED):
   - NEVER hardcode column names - always detect them dynamically from the DataFrame
   - Use this pattern for preprocessing (works with ANY target column):
   
   target_col = '${schema?.targetColumnSuggestion || 'target'}'  # From schema
   X = df.drop(columns=[target_col])
   y = df[target_col]
   
   # DYNAMIC column detection - always works!
   numeric_cols = X.select_dtypes(include=['int64', 'float64']).columns.tolist()
   categorical_cols = X.select_dtypes(include=['object', 'category']).columns.tolist()
   
   preprocessor = ColumnTransformer([
       ('num', Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler())]), numeric_cols),
       ('cat', Pipeline([('imputer', SimpleImputer(strategy='constant', fill_value='missing')), ('encoder', OneHotEncoder(handle_unknown='ignore'))]), categorical_cols)
   ])

4. CRITICAL: DATASET PATH AND LOADING (REQUIRED):
   - Dataset Type: "${datasetType || 'unknown'}"
   
   FOR TABULAR/CSV DATASETS (datasetType contains 'tabular' or 'csv' or is unknown):
   - Use './dataset.csv' as the dataset path
   - Use this pattern:
   
   def load_data():
       return pd.read_csv('./dataset.csv')
   
   FOR IMAGE DATASETS (datasetType contains 'image'):
   - DO NOT use pd.read_csv() - images are in folders, not CSV!
   - Dataset is extracted to './dataset/' folder with class subfolders
   - Use TensorFlow/Keras flow_from_directory:
   
   from tensorflow.keras.preprocessing.image import ImageDataGenerator
   
   def find_dataset_path():
       \"\"\"Find the dataset path - handles various folder structures\"\"\"
       search_paths = ['./dataset', './data', '.']
       for base_path in search_paths:
           if not os.path.exists(base_path):
               continue
           subdirs = [d for d in os.listdir(base_path) if os.path.isdir(os.path.join(base_path, d))]
           # Look for train/test split
           if 'train' in subdirs:
               train_dir = os.path.join(base_path, 'train')
               test_dir = os.path.join(base_path, 'test') if 'test' in subdirs else None
               return train_dir, test_dir
           # Check for class folders directly
           if len(subdirs) > 1:
               return base_path, None
       return './dataset', None
   
   train_datagen = ImageDataGenerator(validation_split=0.2)
   train_generator = train_datagen.flow_from_directory(
       train_path, target_size=(128, 128), batch_size=32,
       class_mode='categorical', subset='training'
   )
   

5. ONLY CHECK LIMITS IF USER EXPLICITLY REQUESTS:
   - If user says "use 1000 epochs" and limit is ${limits.maxEpochs}, set to ${limits.maxEpochs}
   - If user says "5000 trees" and limit is ${limits.maxTrees}, set to ${limits.maxTrees}
   - DO NOT refuse unless user explicitly asks for values exceeding limits
   - Allowed algorithms for ${tier}: ${limits.allowedAlgorithms.join(', ')}
   
6. DETECT COMMAND TYPE (for structured editing):
   - "Split 80/20" → SET_SPLIT_RATIO
   - "Use XGBoost" → CHANGE_MODEL
   - "Add F1 score" → ADD_METRIC
   - "Set epochs to 50" → SET_EPOCHS
   - "Add dropout" → ADD_LAYER
   
7. ALWAYS GENERATE CODE:
   - Unless user specifically requests impossible values, generate code
   - Set isSafe=true and provide updatedScript

OUTPUT FORMAT (JSON only, no markdown):
{
    "isSafe": true,
    "refusalReason": null,
    "suggestedAlternative": null,
    "resourceViolation": null,
    "detectedCommand": { "type": string, "value": any } | null,
    "updatedScript": "# Full Python script here...",
    "responseMessage": "The script has been generated..."
}

IMPORTANT:
- Almost all requests should result in generated code (isSafe=true)
- Only set resourceViolation if user EXPLICITLY requests values exceeding limits
- Structure code with: load_data(), preprocess(), train_model(), evaluate() functions
- NEVER use df.fillna(df.mean()) - always handle numeric and categorical columns separately
- ALWAYS use the target column from schema, NEVER guess your own target column
`;



        const { text: rawResponse } = await generateText({
            model: selectedModel,
            prompt: systemPrompt,
        });

        // Better JSON extraction: find the JSON object, ignoring text before/after
        let cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        // Extract only the JSON object (from first { to last })
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
        }

        // Normalize special characters that break JSON parsing
        // Replace curly quotes with straight quotes, en/em dashes with regular dashes
        cleanJson = cleanJson
            .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // Curly double quotes → straight
            .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")  // Curly single quotes → straight
            .replace(/[\u2013\u2014]/g, '-')  // En/em dash → hyphen
            .replace(/\u2026/g, '...')  // Ellipsis → three dots

        let aiResponse;

        try {
            aiResponse = JSON.parse(cleanJson);
        } catch (e) {
            console.error("AI JSON Parse Error", e);
            console.error("Raw Response:", rawResponse);
            console.error("Cleaned JSON:", cleanJson);
            return NextResponse.json({
                responseMessage: "I had trouble parsing that request. Could you rephrase?",
                updatedScript: null
            });
        }

        // Handle resource violations
        if (aiResponse.resourceViolation) {
            return NextResponse.json({
                updatedScript: null,
                responseMessage: `⚠️ Resource Limit: ${aiResponse.resourceViolation}\n\nYour ${tier} plan allows: max ${limits.maxEpochs} epochs, ${limits.maxTrees} trees. Upgrade for higher limits.`,
                resourceViolation: aiResponse.resourceViolation
            });
        }

        // Handle general refusals
        if (!aiResponse.isSafe) {
            return NextResponse.json({
                updatedScript: null,
                responseMessage: `⚠️ Architect Warning: ${aiResponse.refusalReason}.\n\n${aiResponse.suggestedAlternative ? `Suggestion: ${aiResponse.suggestedAlternative}` : ''}`,
                detectedCommand: aiResponse.detectedCommand
            });
        }

        // Generate AI summary of changes
        let summary = null;
        if (aiResponse.updatedScript && currentScript) {
            try {
                const summaryPrompt = `Compare these scripts and return JSON summary:

OLD: ${currentScript.substring(0, 1000)}
NEW: ${aiResponse.updatedScript.substring(0, 1000)}

Return: {"changes": [{"type": "algorithm", "title": "...", "description": "...", "severity": "high"}], "notImplemented": ["..."]}`;

                const { text: summaryResponse } = await generateText({ model: selectedModel, prompt: summaryPrompt });
                let summaryJson = summaryResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                const firstBrace = summaryJson.indexOf('{');
                const lastBrace = summaryJson.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    summaryJson = summaryJson.substring(firstBrace, lastBrace + 1);
                }
                // Sanitize JSON: fix escaped characters and control chars that break parsing
                summaryJson = summaryJson
                    .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
                    .replace(/\\\\/g, '\\\\\\\\') // Fix double backslashes
                    .replace(/\\'/g, "'") // Fix escaped single quotes
                    .replace(/\\n/g, ' ') // Replace newlines in strings with space
                    .replace(/\\t/g, ' ') // Replace tabs with space
                    .replace(/\\r/g, ' '); // Replace carriage returns
                summary = JSON.parse(summaryJson);
            } catch (e) {
                console.error('[Summary] Failed:', e);
            }
        }

        return NextResponse.json({
            updatedScript: aiResponse.updatedScript,
            responseMessage: aiResponse.responseMessage || "Code updated successfully.",
            detectedCommand: aiResponse.detectedCommand,
            summary: summary
        });

    } catch (error: any) {
        console.error("AI Chat Error:", error);
        return NextResponse.json({
            error: error.message || "Failed to process instruction"
        }, { status: 500 });
    }
}
