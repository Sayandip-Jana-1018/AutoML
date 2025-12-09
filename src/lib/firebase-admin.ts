import "server-only";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
    try {
        // Use explicit credentials from env vars
        const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

        if (privateKey && clientEmail && projectId) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
        } else {
            // Fallback to application default credentials
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId,
            });
        }
    } catch (error) {
        console.error("Firebase admin initialization error", error);
    }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
