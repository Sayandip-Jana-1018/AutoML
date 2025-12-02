# Healthy Testing Guide

Follow these steps to verify the new features.

## 1. Profile Management
1.  Navigate to the **Profile Page** (`/profile`).
2.  **Edit Profile**: Click "Edit Profile", change your Name or Bio, and click "Save". Refresh the page to confirm changes persist.
3.  **Upload Avatar**: Click the camera icon on your profile picture. Select an image file. It should upload and update your avatar immediately.

## 2. Studio (Upload & Train)
1.  Navigate to the **Studio Page** (`/studio`).
2.  **Step 1: Upload**:
    -   Enter a dataset name (e.g., "Test Data").
    -   Upload a CSV file.
    -   Click "Upload & Continue".
3.  **Step 2: Configure**:
    -   Select a target column (prediction goal).
    -   Select an algorithm (or leave as "Auto").
    -   Click "Start Training".
4.  **Step 3: Train**:
    -   Watch the progress bar.
    -   Once complete, you can click "Go to Deployments" or "Chat with Model".

## 3. Deployments (Monitor & Predict)
1.  Navigate to the **Deploy Page** (`/deploy`).
2.  **List Models**: You should see your newly trained model here.
3.  **Prediction**:
    -   Click "Test / Predict" on any card.
    -   Enter a JSON input (e.g., `{"feature1": 10, "feature2": "value"}`) and click "Run Prediction".

## 4. Chat with Context
1.  Navigate to the **Chat Page** (`/chat`).
2.  **Select Model**: Choose a model from the sidebar (e.g., GPT-4).
3.  **Ask Question**: Type "What datasets are available?" or "Show me my models".
    -   The AI should respond with information fetched from the EC2 API (context is injected into the system prompt).

## Troubleshooting
-   **Console Errors**: You might see `AbortError: play() request was interrupted`. This is often due to browser autoplay policies or extensions and can usually be ignored if the app functions correctly.
-   **API Errors**: Check the terminal where `npm run dev` is running for backend logs.

## 5. Ambulance Dispatch & Hardware
1.  **Navigate**: Go to the main dashboard (`/`).
2.  **Hardware Connection**:
    -   Ensure your ESP32 is plugged in.
    -   Click **"Connect Hardware"**.
    -   Select the COM port.
    -   **Verify**: "Live Vitals" panel should start showing real-time data (Heart Rate, SpO2).
3.  **Voice Triage**:
    -   Click the **Microphone** icon.
    -   Speak a symptom (e.g., "Severe chest pain").
    -   **Verify**: Text appears in the box and AI analyzes it.
4.  **Dispatch**:
    -   Click **"DISPATCH EMERGENCY"**.
    -   **Verify**:
        -   Map route highlights.
        -   Ambulance marker moves.
        -   Data is saved to `integrated_patient_data.csv`.
