/**
 * Collaboration Service
 * Handles sharing, visibility, and collaborator management
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export type VisibilityLevel = 'private' | 'team' | 'public';
export type Permission = 'view' | 'edit' | 'run';

export interface Collaborator {
    uid: string;
    email: string;
    role: Permission;
    addedAt: Date;
    addedBy: string;
}

export interface ShareableResource {
    id: string;
    type: 'dataset' | 'model' | 'project';
    ownerId: string;
    visibility: VisibilityLevel;
    collaborators: Collaborator[];
}

/**
 * Add a collaborator to a resource
 */
export async function addCollaborator(
    resourceType: 'datasets' | 'models' | 'projects',
    resourceId: string,
    collaborator: {
        email: string;
        role: Permission;
    },
    addedBy: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Find user by email
        const usersSnapshot = await adminDb
            .collection('users')
            .where('email', '==', collaborator.email)
            .limit(1)
            .get();

        if (usersSnapshot.empty) {
            return { success: false, error: 'User not found with this email' };
        }

        const userDoc = usersSnapshot.docs[0];
        const uid = userDoc.id;

        // Check if already a collaborator
        const resourceRef = adminDb.collection(resourceType).doc(resourceId);
        const resourceDoc = await resourceRef.get();

        if (!resourceDoc.exists) {
            return { success: false, error: 'Resource not found' };
        }

        const existingCollaborators = resourceDoc.data()?.collaborators || [];
        if (existingCollaborators.some((c: Collaborator) => c.uid === uid)) {
            return { success: false, error: 'User is already a collaborator' };
        }

        // Add collaborator
        await resourceRef.update({
            collaborators: FieldValue.arrayUnion({
                uid,
                email: collaborator.email,
                role: collaborator.role,
                addedAt: new Date(),
                addedBy
            }),
            updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true };

    } catch (error) {
        console.error('[Collaboration] Failed to add collaborator:', error);
        return { success: false, error: 'Failed to add collaborator' };
    }
}

/**
 * Remove a collaborator from a resource
 */
export async function removeCollaborator(
    resourceType: 'datasets' | 'models' | 'projects',
    resourceId: string,
    collaboratorUid: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const resourceRef = adminDb.collection(resourceType).doc(resourceId);
        const resourceDoc = await resourceRef.get();

        if (!resourceDoc.exists) {
            return { success: false, error: 'Resource not found' };
        }

        const collaborators = resourceDoc.data()?.collaborators || [];
        const updatedCollaborators = collaborators.filter(
            (c: Collaborator) => c.uid !== collaboratorUid
        );

        await resourceRef.update({
            collaborators: updatedCollaborators,
            updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true };

    } catch (error) {
        console.error('[Collaboration] Failed to remove collaborator:', error);
        return { success: false, error: 'Failed to remove collaborator' };
    }
}

/**
 * Update resource visibility
 */
export async function updateVisibility(
    resourceType: 'datasets' | 'models' | 'projects',
    resourceId: string,
    visibility: VisibilityLevel
): Promise<{ success: boolean; error?: string }> {
    try {
        await adminDb.collection(resourceType).doc(resourceId).update({
            visibility,
            updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true };

    } catch (error) {
        console.error('[Collaboration] Failed to update visibility:', error);
        return { success: false, error: 'Failed to update visibility' };
    }
}

/**
 * Check if user has permission on a resource
 */
export async function checkPermission(
    resourceType: 'datasets' | 'models' | 'projects',
    resourceId: string,
    userId: string,
    requiredPermission: Permission
): Promise<boolean> {
    try {
        const resourceDoc = await adminDb.collection(resourceType).doc(resourceId).get();

        if (!resourceDoc.exists) {
            return false;
        }

        const data = resourceDoc.data()!;

        // Owner has all permissions
        if (data.ownerId === userId) {
            return true;
        }

        // Public resources allow view
        if (data.visibility === 'public' && requiredPermission === 'view') {
            return true;
        }

        // Check collaborators
        const collaborators = data.collaborators || [];
        const collaborator = collaborators.find((c: Collaborator) => c.uid === userId);

        if (!collaborator) {
            return false;
        }

        // Permission hierarchy: run > edit > view
        const permissionLevel = { view: 1, edit: 2, run: 3 };
        return permissionLevel[collaborator.role] >= permissionLevel[requiredPermission];

    } catch (error) {
        console.error('[Collaboration] Permission check failed:', error);
        return false;
    }
}

/**
 * Get resources shared with user
 */
export async function getSharedWithMe(
    resourceType: 'datasets' | 'models' | 'projects',
    userId: string
): Promise<ShareableResource[]> {
    try {
        // Query resources where user is in collaborators array
        // Note: This requires a composite index in Firestore
        const snapshot = await adminDb
            .collection(resourceType)
            .where('collaborators', 'array-contains-any', [
                { uid: userId },
            ])
            .limit(50)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            type: resourceType.slice(0, -1) as 'dataset' | 'model' | 'project',
            ...doc.data()
        })) as ShareableResource[];

    } catch (error) {
        console.error('[Collaboration] Failed to get shared resources:', error);
        return [];
    }
}

/**
 * Get collaborators for a resource
 */
export async function getCollaborators(
    resourceType: 'datasets' | 'models' | 'projects',
    resourceId: string
): Promise<Collaborator[]> {
    try {
        const doc = await adminDb.collection(resourceType).doc(resourceId).get();

        if (!doc.exists) {
            return [];
        }

        return doc.data()?.collaborators || [];

    } catch (error) {
        console.error('[Collaboration] Failed to get collaborators:', error);
        return [];
    }
}
