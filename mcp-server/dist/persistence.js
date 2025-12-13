"use strict";
/**
 * Firebase Persistence Layer
 * Saves Yjs document snapshots to Firestore
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFirebase = initFirebase;
exports.saveSnapshot = saveSnapshot;
exports.loadSnapshot = loadSnapshot;
exports.deleteSnapshot = deleteSnapshot;
exports.listSnapshots = listSnapshots;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const fs_1 = require("fs");
let db = null;
/**
 * Initialize Firebase Admin SDK
 */
async function initFirebase() {
    if (firebase_admin_1.default.apps.length > 0) {
        db = firebase_admin_1.default.firestore();
        return;
    }
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    try {
        if (serviceAccountPath && (0, fs_1.existsSync)(serviceAccountPath)) {
            const serviceAccount = JSON.parse((0, fs_1.readFileSync)(serviceAccountPath, 'utf-8'));
            firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.cert(serviceAccount)
            });
        }
        else if (projectId) {
            // Use default credentials (for Cloud Run, etc.)
            firebase_admin_1.default.initializeApp({
                projectId
            });
        }
        else {
            console.warn('[Firebase] No credentials configured, persistence disabled');
            return;
        }
        db = firebase_admin_1.default.firestore();
        console.log('[Firebase] Initialized successfully');
    }
    catch (error) {
        console.error('[Firebase] Initialization failed:', error);
        throw error;
    }
}
/**
 * Save document snapshot to Firestore
 */
async function saveSnapshot(docName, state) {
    if (!db) {
        console.log('[Persistence] Firebase not initialized, skipping save');
        return;
    }
    try {
        const docRef = db.collection('mcp_snapshots').doc(docName);
        await docRef.set({
            state: Buffer.from(state).toString('base64'),
            updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
            size: state.length
        }, { merge: true });
        console.log(`[Persistence] Saved snapshot: ${docName} (${state.length} bytes)`);
    }
    catch (error) {
        console.error(`[Persistence] Failed to save ${docName}:`, error);
    }
}
/**
 * Load document snapshot from Firestore
 */
async function loadSnapshot(docName) {
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
    }
    catch (error) {
        console.error(`[Persistence] Failed to load ${docName}:`, error);
        return null;
    }
}
/**
 * Delete document snapshot
 */
async function deleteSnapshot(docName) {
    if (!db) {
        return;
    }
    try {
        await db.collection('mcp_snapshots').doc(docName).delete();
        console.log(`[Persistence] Deleted snapshot: ${docName}`);
    }
    catch (error) {
        console.error(`[Persistence] Failed to delete ${docName}:`, error);
    }
}
/**
 * List all snapshots (for debugging)
 */
async function listSnapshots() {
    if (!db) {
        return [];
    }
    try {
        const snapshot = await db.collection('mcp_snapshots').limit(100).get();
        return snapshot.docs.map(doc => doc.id);
    }
    catch (error) {
        console.error('[Persistence] Failed to list snapshots:', error);
        return [];
    }
}
//# sourceMappingURL=persistence.js.map