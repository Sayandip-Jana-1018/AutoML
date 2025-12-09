import "server-only";
import * as admin from "firebase-admin";

/**
 * Firebase Admin SDK Configuration
 * 
 * CROSS-PROJECT ARCHITECTURE:
 * - Firebase (Auth + Firestore): automl-dc494
 * - GCP (Vertex AI + GCS): fluent-cable-480715-c8
 * 
 * This file initializes Firebase Admin for Firestore access.
 * The mlforge-backend service account needs cross-project IAM permissions
 * OR we use a separate Firebase Admin credential.
 */

if (!admin.apps.length) {
    try {
        // Firebase project ID for Auth/Firestore (OLD project)
        const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; // automl-dc494

        // Service account credentials (from NEW GCP project)
        // NOTE: This service account needs Firestore access in automl-dc494
        // Either via: 1) Cross-project IAM, or 2) Separate Firebase SA credential
        const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

        if (privateKey && clientEmail && firebaseProjectId) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: firebaseProjectId, // Target Firebase project for Firestore
                    clientEmail,
                    privateKey,
                }),
            });
            console.log(`[Firebase Admin] Initialized for project: ${firebaseProjectId}`);
        } else {
            // Fallback to application default credentials
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: firebaseProjectId,
            });
            console.log('[Firebase Admin] Initialized with ADC');
        }
    } catch (error) {
        console.error("Firebase admin initialization error", error);
    }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
