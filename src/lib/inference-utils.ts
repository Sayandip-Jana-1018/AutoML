
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Generic Python Inference Script
 * Capable of loading:
 * - Scikit-learn models (.joblib, .pkl)
 * - PyTorch models (.pth, .pt)
 * 
 * Capable of processing:
 * - Tabular data (JSON input)
 * - Image data (Base64 input)
 */
export const GENERIC_INFERENCE_SCRIPT = `
import os
import sys
import json
import base64
import numpy as np
import pandas as pd
import warnings
from io import BytesIO

# Suppress warnings
warnings.filterwarnings('ignore')

def load_model(model_path):
    """Load model based on file extension"""
    ext = os.path.splitext(model_path)[1].lower()
    
    if ext in ['.joblib', '.pkl']:
        try:
            import joblib
            return joblib.load(model_path)
        except Exception as e:
            # Fallback to pickle
            import pickle
            with open(model_path, 'rb') as f:
                return pickle.load(f)
                
    elif ext in ['.pth', '.pt']:
        import torch
        # Load entire model (not just state_dict) for simplicity in this generic script
        # In production, we'd want to instantiate the architecture class first
        try:
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            model = torch.load(model_path, map_location=device)
            model.eval()
            return model
        except Exception as e:
            # Try loading as jit script
            return torch.jit.load(model_path)
            
    raise ValueError(f"Unsupported model format: {ext}")

def preprocess_image(base64_string, target_size=(224, 224)):
    """Convert base64 -> PIL -> Preprocessed format"""
    from PIL import Image
    
    # decode base64
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    img_data = base64.b64decode(base64_string)
    img = Image.open(BytesIO(img_data)).convert('RGB')
    
    # Resize
    img = img.resize(target_size)
    
    # Check if we need torch preprocessing or flatten for sklearn
    try:
        import torch
        from torchvision import transforms
        
        transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                               std=[0.229, 0.224, 0.225])
        ])
        
        # Add batch dimension: [1, 3, 224, 224]
        return transform(img).unsqueeze(0)
    except ImportError:
        # Fallback for sklearn image models (flattened)
        return np.array(img).flatten().reshape(1, -1)

def run_inference():
    try:
        # 1. Parse arguments
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing arguments. Usage: script.py <model_path> <input_json>"}));
            return

        model_path = sys.argv[1]
        input_data = json.loads(sys.argv[2])
        
        # 2. Load Model
        if not os.path.exists(model_path):
            print(json.dumps({"error": f"Model file not found at {model_path}"}))
            return
            
        model = load_model(model_path)
        
        # 3. Process Input
        X = None
        
        # Check for image input (look for 'image' or 'base64' keys)
        if hasattr(input_data, 'get') and (input_data.get('image') or input_data.get('base64')):
            img_str = input_data.get('image') or input_data.get('base64')
            X = preprocess_image(img_str)
            is_deep_learning = 'torch' in sys.modules and 'torch.nn' in str(type(model))
        else:
            # Tabular input
            # Convert dictionary to DataFrame
            df = pd.DataFrame([input_data])
            X = df
            is_deep_learning = False

        # 4. Predict
        prediction = None
        probabilities = None
        
        if is_deep_learning:
            import torch
            with torch.no_grad():
                output = model(X)
                
                # Handle different output types
                if isinstance(output, torch.Tensor):
                    _, preds = torch.max(output, 1)
                    prediction = preds.item()
                    
                    # Calculate softmax for probabilities
                    probs = torch.nn.functional.softmax(output, dim=1)
                    probabilities = probs[0].tolist()
        else:
            # Sklearn / Classic ML
            prediction = model.predict(X)[0]
            
            # Try to get probabilities
            if hasattr(model, 'predict_proba'):
                try:
                    probs = model.predict_proba(X)
                    probabilities = probs[0].tolist()
                except:
                    pass

        # 5. Format Output
        result = {
            "prediction": prediction.item() if hasattr(prediction, 'item') else prediction,
            "probability": max(probabilities) if probabilities else None,
            "probabilities": probabilities,
            "status": "success"
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\\n{traceback.format_exc()}"
        print(json.dumps({"error": error_msg, "status": "failed"}))

if __name__ == "__main__":
    run_inference()
`;

/**
 * Execute python inference script
 */
export async function runPythonInference(
    modelPath: string,
    inputData: Record<string, any>
): Promise<any> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(path.dirname(modelPath), 'inference.py');

        // Write the script
        fs.writeFileSync(scriptPath, GENERIC_INFERENCE_SCRIPT);

        const process = spawn('python3', [
            scriptPath,
            modelPath,
            JSON.stringify(inputData)
        ]);

        let outputData = '';
        let errorData = '';

        process.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        process.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        process.on('close', (code) => {
            if (code !== 0) {
                console.error('Inference Script Error:', errorData);
                resolve({ error: 'Inference script failed', details: errorData });
                return;
            }

            try {
                // Find the last JSON object in the output (ignore other print statements)
                const lines = outputData.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                const result = JSON.parse(lastLine);
                resolve(result);
            } catch (e) {
                console.error('Failed to parse inference output:', outputData);
                resolve({ error: 'Invalid output format', details: outputData });
            }
        });
    });
}
