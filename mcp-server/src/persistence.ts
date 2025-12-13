/**
 * Firebase Persistence Layer
 * Saves Yjs document snapshots to Firestore
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let db: admin.firestore.Firestore | null = null;

/**
 * Initialize Firebase Admin SDK
 */
export async function initFirebase(): Promise<void> {
    if (admin.apps.length > 0) {
        db = admin.firestore();
        return;
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    try {
        if (serviceAccountPath && existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } else if (projectId) {
            // Use default credentials (for Cloud Run, etc.)
            admin.initializeApp({
                projectId
            });
        } else {
            console.warn('[Firebase] No credentials configured, persistence disabled');
            return;
        }

        db = admin.firestore();
        console.log('[Firebase] Initialized successfully');
    } catch (error) {
        console.error('[Firebase] Initialization failed:', error);
        throw error;
    }
}

/**
 * Save document snapshot to Firestore
 */
export async function saveSnapshot(docName: string, state: Uint8Array): Promise<void> {
    if (!db) {
        console.log('[Persistence] Firebase not initialized, skipping save');
        return;
    }

    try {
        const docRef = db.collection('mcp_snapshots').doc(docName);
        await docRef.set({
            state: Buffer.from(state).toString('base64'),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            size: state.length
        }, { merge: true });

        console.log(`[Persistence] Saved snapshot: ${docName} (${state.length} bytes)`);
    } catch (error) {
        console.error(`[Persistence] Failed to save ${docName}:`, error);
    }
}

/**
 * Load document snapshot from Firestore
 */
export async function loadSnapshot(docName: string): Promise<Uint8Array | null> {
    if (!db) {
        return null;
    }

    try {
        const docRef = db.collection('mcp_snapshots').doc(docName);
        const doc = await docRef.get();

        if (!doc.exists) {
            return null;
        }

        const data = doc.data();
        if (!data?.state) {
            return null;
        }

        return new Uint8Array(Buffer.from(data.state, 'base64'));
    } catch (error) {
        console.error(`[Persistence] Failed to load ${docName}:`, error);
        return null;
    }
}

/**
 * Delete document snapshot
 */
export async function deleteSnapshot(docName: string): Promise<void> {
    if (!db) {
        return;
    }

    try {
        await db.collection('mcp_snapshots').doc(docName).delete();
        console.log(`[Persistence] Deleted snapshot: ${docName}`);
    } catch (error) {
        console.error(`[Persistence] Failed to delete ${docName}:`, error);
    }
}

/**
 * List all snapshots (for debugging)
 */
export async function listSnapshots(): Promise<string[]> {
    if (!db) {
        return [];
    }

    try {
        const snapshot = await db.collection('mcp_snapshots').limit(100).get();
        return snapshot.docs.map(doc => doc.id);
    } catch (error) {
        console.error('[Persistence] Failed to list snapshots:', error);
        return [];
    }
}
