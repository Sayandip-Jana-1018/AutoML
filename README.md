# 🌿 Healthy ~ Fly (Healthy) - AI-Powered Healthcare Ecosystem

![Project Status](https://img.shields.io/badge/Status-Active-success)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20Firebase%20%7C%20Gemini%20AI-blue)
![License](https://img.shields.io/badge/License-MIT-green)

**Healthy ~ Fly** (powered by Healthy) is a comprehensive AI-driven healthcare platform that unifies patient monitoring, emergency response, and custom AI model creation into a single ecosystem. From building AI models for patients to dispatching ambulances with real-time IoT data, Healthy ~ Fly covers the entire lifecycle of intelligent care.

---

## 🚀 Platform Modules

### 1. 🏠 Landing Page ("Healthy ~ Fly")
The gateway to the ecosystem, featuring:
*   **Instant Setup**: Get started with AI tools in seconds.
*   **Auto Code**: AI-generated code for healthcare applications.
*   **Smart Training**: Optimized algorithms for medical datasets.
*   **One-Click Deploy**: Instant production-ready model deployment.

### 2. 🔐 Secure Authentication
Robust authentication system powered by **Firebase Authentication**:
*   **Multi-Provider Support**: Sign in with **Google**, **GitHub**, **Microsoft (Azure AD)**, **Phone (OTP)**, or **Email/Password**.
*   **Account Linking**: Seamlessly link multiple sign-in methods to a single account.
*   **Password Reset**: Secure email-based password recovery.
*   **Profile Management**: Dedicated profile page with real-time data sync via Firestore.
*   **Session Management**: Automatic session handling with Firebase Auth.

### 3. 💳 Payments (Razorpay)
Seamless payment integration for premium features:
*   **Secure Transactions**: Integrated **Razorpay** payment gateway.
*   **Immersive UI**: Custom overlay with background blur and dimming for a focused payment experience.
*   **Plan Management**: Monthly and Annual subscription options.

### 4. 🚑 Ambulance Dispatch (IoT Command Center)
A real-time emergency response dashboard integrating hardware sensors.
*   **Live Hardware Stream**: Connects to **ESP32** via Web Serial to stream Heart Rate (MAX30102) and ECG (AD8232).
*   **Voice Triage**: AI analyzes voice descriptions to assess emergency severity.
*   **3D Mapping**: Interactive map with real-time ambulance routing and hospital matching.
*   **Data Augmentation**: Gemini AI fills gaps in sensor data (e.g., BP, Temp) for complete patient profiles.

### 5. 🧪 Studio (AutoML)
No-code environment to train custom healthcare models.
*   **Upload**: Drag-and-drop CSV datasets (e.g., Diabetes, Heart Disease).
*   **Train**: Auto-selects the best algorithm (Random Forest, Logistic Regression, etc.).
*   **Evaluate**: View accuracy metrics and confusion matrices.

### 6. 🛍️ Marketplace
A hub for pre-trained and community-shared medical AI models.
*   **Model Cards**: Detailed performance metrics and use cases.
*   **One-Click Deploy**: Launch models directly from the marketplace.
*   **API Integration**: Get ready-to-use API endpoints for your apps.

### 7. 💬 Chat (AI Assistant)
Context-aware AI assistant for healthcare queries.
*   **Model Switching**: Toggle between GPT-4, Gemini, and custom deployed models.
*   **Context Injection**: AI understands your deployed models and datasets.

### 8. 🚀 Deploy
Manage and monitor your active AI services.
*   **Real-time Prediction**: Test models with JSON input directly in the UI.
*   **Monitoring**: Track API usage and health.

---

## 🛠️ Tech Stack

### Frontend
*   **Framework**: Next.js 15 (App Router)
*   **Styling**: Tailwind CSS, Framer Motion (Animations), Glassmorphism UI
*   **Maps**: Mapbox GL JS
*   **3D**: React Three Fiber

### Backend & AI
*   **Auth**: Firebase Authentication (Email/Password, Google, GitHub, Microsoft, Phone OTP)
*   **Database**: Firebase Firestore (NoSQL)
*   **AI Models**: Google Gemini 2.0 Flash, OpenAI GPT-4
*   **AutoML**: Python (Scikit-learn) backend
*   **API**: Next.js Server Actions

### Hardware (IoT)
*   **Microcontroller**: ESP32 Dev Module
*   **Sensors**: MAX30102 (HR/SpO2), AD8232 (ECG)
*   **Protocol**: Web Serial API (Direct Browser Connection)

### Cloud Infrastructure (AWS)
Managed via **Terraform** (IaC):
*   **Compute**: AWS Lambda (Serverless Node.js)
*   **Storage**: S3 (Avatars & Datasets)
*   **Gateway**: API Gateway

---

## ☁️ Infrastructure Setup

The backend infrastructure is deployed on AWS using Terraform.

1.  **Navigate to Infra**:
    ```bash
    cd infra/terraform
    ```
2.  **Initialize & Apply**:
    ```bash
    terraform init
    terraform apply
    ```

---

## 🔌 Hardware Setup (Ambulance Module)

To use the Live Vitals feature:

1.  **Flash ESP32**: Upload `arduino/health_monitor.ino` using Arduino IDE.
2.  **Wiring**:
    *   **MAX30102**: SDA(21), SCL(22), VIN(3.3V), GND
    *   **AD8232**: OUT(34), LO+(35), LO-(32)
3.  **Connect**: Click "Connect Hardware" on the dashboard.

---

## 🏁 Getting Started

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/your-repo/healthy-fly.git
    npm install
    ```
2.  **Environment Variables** (`.env`):
    ```env
    # Firebase Configuration
    NEXT_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
    NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
    
    # OAuth Providers
    GOOGLE_CLIENT_ID="your-google-client-id"
    GOOGLE_CLIENT_SECRET="your-google-client-secret"
    GITHUB_ID="your-github-client-id"
    GITHUB_SECRET="your-github-client-secret"
    MICROSOFT_CLIENT_ID="your-microsoft-client-id"
    MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
    MICROSOFT_TENANT_ID="common"
    
    # AI & Payments
    GEMINI_API_KEY="your-gemini-api-key"
    NEXT_PUBLIC_RAZORPAY_KEY_ID="your-razorpay-key"
    # ... other keys
    ```
3.  **Run Locally**:
    ```bash
    npm run dev
    ```
4.  **Visit**: `http://localhost:3000`

---

## 🤝 Contributing
Built with ❤️ by Sayandip.
