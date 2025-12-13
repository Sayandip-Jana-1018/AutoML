/**
 * Firebase Persistence Layer
 * Saves Yjs document snapshots to Firestore
 */
/**
 * Initialize Firebase Admin SDK
 */
export declare function initFirebase(): Promise<void>;
/**
 * Save document snapshot to Firestore
 */
export declare function saveSnapshot(docName: string, state: Uint8Array): Promise<void>;
/**
 * Load document snapshot from Firestore
 */
export declare function loadSnapshot(docName: string): Promise<Uint8Array | null>;
/**
 * Delete document snapshot
 */
export declare function deleteSnapshot(docName: string): Promise<void>;
/**
 * List all snapshots (for debugging)
 */
export declare function listSnapshots(): Promise<string[]>;
//# sourceMappingURL=persistence.d.ts.map