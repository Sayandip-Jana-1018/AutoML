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
            datasetInfo, // Additional dataset context (from Fix with AI)
            history // Chat history
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

        // Add Chat History if provided
        let historyContext = '';
        if (history && Array.isArray(history) && history.length > 0) {
            historyContext = `
PREVIOUS CONVERSATION HISTORY (Most recent last):
${history.map((h: any) => `${h.role.toUpperCase()}: ${h.content}`).slice(-15).join('\n---\n')}
`;
        }

        // 1. Enhanced Architect Agent Prompt with resource limits
        let systemPrompt = `
You are a Senior Machine Learning Architect helping generate Python training scripts.

CONTEXT:
- Current Script: A Python ML training script.
- Dataset Type: "${datasetType || 'unknown'}"
- User Request: "${message}"
- User Plan: "${tier}" (max ${limits.maxEpochs} epochs, max ${limits.maxTrees} trees, batch ${limits.maxBatchSize})
${schemaContext}
${historyContext}

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
   - CRITICAL: RETURN THE FULL, COMPLETE SCRIPT WITHOUT PLACEHOLDERS
   - DO NOT RETURN SNIPPETS. DO NOT RETURN DIFFS.
   - The "updatedScript" string MUST contain the ENTIRE content of the new file, including all imports, all functions, and all logic.
   - If you only modify one line, you MUST still return the other 100 lines unchanged.
   - Do NOT use "..." or "// ... rest of code" or "// ... existing code ..."
   - Check that all imports, functions, and logic are fully present in updatedScript
   - FAILURE TO PROVIDE FULL CODE WILL BREAK THE APPLICATION.

8. CRITICAL: MODEL SAVING FOR DEPLOYMENT (REQUIRED):
   - ALWAYS include a save_model() function that saves the model for deployment
   - Save model to '/tmp/training/model/' directory (NOT /tmp/model)
   - Use this pattern:
   
   import joblib
   import os
   import json
   from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, r2_score, mean_squared_error, mean_absolute_error

   # ... inside main():
   # CALCULATE METRICS (REQUIRED):
   # For Classification:
   # y_pred = model.predict(X_test)
   # metrics = {
   #     "accuracy": accuracy_score(y_test, y_pred),
   #     "precision": precision_score(y_test, y_pred, average='weighted', zero_division=0),
   #     "recall": recall_score(y_test, y_pred, average='weighted', zero_division=0),
   #     "f1": f1_score(y_test, y_pred, average='weighted', zero_division=0)
   # }
   # For Regression:
   # metrics = {
   #     "r2": r2_score(y_test, y_pred),
   #     "rmse": mean_squared_error(y_test, y_pred, squared=False),
   #     "mae": mean_absolute_error(y_test, y_pred)
   # }
   
   def save_model(model, metrics=None):
       """Save model and metrics for deployment"""
       model_dir = '/tmp/training/model'
       os.makedirs(model_dir, exist_ok=True)
       
       # Save model
       joblib.dump(model, os.path.join(model_dir, 'model.joblib'))
       print(f"Model saved to {model_dir}/model.joblib")
       
       # Save metrics if provided
       if metrics:
           with open(os.path.join(model_dir, 'metrics.json'), 'w') as f:
               json.dump(metrics, f, indent=2)
   
   # MUST call at end of main():
   save_model(model, metrics)

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
- Structure code with: load_data(), preprocess(), train_model(), evaluate(), save_model() functions
- NEVER use df.fillna(df.mean()) - always handle numeric and categorical columns separately
- ALWAYS use the target column from schema, NEVER guess your own target column
- ALWAYS include save_model() function and call it at the end
`;

        // --- USER DEBUG LOGS ---
        console.log('\n--- [Chat API] Context Debugger ---');
        console.log(`[Chat API] 🧠 History Messages: ${history ? history.length : 0}`);
        if (history && history.length > 0) {
            console.log(`[Chat API] 📜 Last Message: ${JSON.stringify(history[history.length - 1]).substring(0, 100)}...`);
        }
        console.log(`[Chat API] 📊 Dataset Info: ${schemaContext ? 'Provided (Columns, Types, Rows)' : 'Missing'}`);
        // console.log(`[Chat API] 🤖 System Prompt (Preview): \n${systemPrompt.substring(0, 500)}...`); // Can't log systemPrompt yet if it's not fully defined? No, it IS defined.
        console.log('-----------------------------------\n');
        // -----------------------



        // 2. Retry Loop for Full Code Enforcement
        let attempts = 0;
        const maxAttempts = 3;
        let aiResponse;

        while (attempts < maxAttempts) {
            attempts++;

            // Generate text
            const { text: rawResponse } = await generateText({
                model: selectedModel,
                prompt: systemPrompt + (attempts > 1 ? `\n\nCRITICAL ERROR: You previously returned a SNIPPET (only ${Math.round((aiResponse?.updatedScript?.length || 0) / (currentScript?.length || 1) * 100)}% of original length). STOP DOING THAT. RETURN THE FULL SCRIPT. DO NOT USE PLACEHOLDERS.` : ''),
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
            cleanJson = cleanJson
                .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
                .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
                .replace(/[\u2013\u2014]/g, '-')
                .replace(/\u2026/g, '...');

            try {
                aiResponse = JSON.parse(cleanJson);

                // VALIDATION: Check if it's a snippet
                if (aiResponse.updatedScript && currentScript) {
                    const newLength = aiResponse.updatedScript.length;
                    const oldLength = currentScript.length;
                    const ratio = newLength / oldLength;
                    const hasPlaceholders = aiResponse.updatedScript.includes('# ...') || aiResponse.updatedScript.includes('// ...') || aiResponse.updatedScript.includes('... rest of code');

                    // Check for Imports - a full script almost always has imports
                    // We check for "import " or "from " at the start of lines
                    const hasImports = /^\s*(import|from)\s+/m.test(aiResponse.updatedScript);

                    // Snippet Detection Logic:
                    // 1. Ratio < 0.4 (too short)
                    // 2. Explicit Placeholders found
                    // 3. No imports found (and original script likely had them)
                    const isLikelySnippet = (ratio < 0.6) || hasPlaceholders || (!hasImports && newLength > 100);

                    if (isLikelySnippet) {
                        console.warn(`[AI Attempt ${attempts}] Detected snippet (Ratio: ${ratio.toFixed(2)}, NoImports: ${!hasImports}, Placeholders: ${hasPlaceholders}). Retrying...`);

                        if (attempts === maxAttempts) {
                            console.error('[AI] Max attempts reached. Using currentScript as fallback.');
                            // CRITICAL FALLBACK: Return the current script if AI keeps returning snippets
                            if (currentScript && currentScript.length > 100) {
                                aiResponse.updatedScript = currentScript;
                                aiResponse.responseMessage = "AI could not generate updated code. Using current script.";
                            }
                        } else {
                            // Add strict instruction for next attempt
                            systemPrompt += "\n\nCRITICAL FAILURE: You returned a script WITHOUT IMPORTS or that was TOO SHORT. You must return the COMPLETE RUNNABLE SCRIPT including 'import pandas ...', 'load_data', etc.";
                            continue; // Retry logic
                        }
                    }
                }

                // If we get here, it satisfies valid criteria or it's a refusal/resource violation
                break;

            } catch (e) {
                // Expected when AI returns raw Python instead of JSON - not actually an error
                console.log(`[AI Attempt ${attempts}] Parsing as JSON failed, checking if raw Python...`);

                // FALLBACK: Check if rawResponse is actually a Python script (not JSON)
                // This happens when the AI returns pure Python code instead of JSON
                const rawCode = rawResponse.trim();
                const looksLikePython = /^\s*(import|from|#|def |class )/m.test(rawCode);

                if (looksLikePython && rawCode.length > 200) {
                    console.log(`[AI Attempt ${attempts}] Response looks like raw Python - using it directly`);

                    // Extract code from markdown if wrapped
                    let extractedScript = rawCode;
                    const codeBlockMatch = rawCode.match(/```(?:python|py)?\n([\s\S]*?)```/);
                    if (codeBlockMatch) {
                        extractedScript = codeBlockMatch[1];
                    }

                    aiResponse = {
                        updatedScript: extractedScript,
                        responseMessage: "Generated updated script with your requested improvements."
                    };
                    break; // Valid Python code found
                }

                if (attempts === maxAttempts) {
                    // Final fallback - use current script
                    if (currentScript && currentScript.length > 100) {
                        console.log('[AI] Using currentScript as final fallback');
                        aiResponse = {
                            updatedScript: currentScript,
                            responseMessage: "Unable to generate new code. Current script preserved."
                        };
                        break;
                    }
                    return NextResponse.json({
                        responseMessage: "I had trouble parsing that request. Could you rephrase?",
                        updatedScript: null
                    });
                }
            }
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

OLD: ${currentScript.substring(0, 12000)}
NEW: ${aiResponse.updatedScript.substring(0, 12000)}

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
