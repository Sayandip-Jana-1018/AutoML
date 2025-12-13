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
        const permissionLevel: Record<string, number> = { view: 1, edit: 2, run: 3 };
        const collabRole = collaborator.role as string;
        const reqPerm = requiredPermission as string;
        return (permissionLevel[collabRole] || 0) >= (permissionLevel[reqPerm] || 0);

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

// ==========================================
// COLLABORATION LINKS
// ==========================================

export type CollabLinkMode = 'private' | 'public';
export type CollabLinkRole = 'view' | 'edit';

export interface CollabLink {
    id: string;
    projectId: string;
    creatorId: string;
    creatorEmail?: string;
    mode: CollabLinkMode;
    role: CollabLinkRole;
    expiresAt: Date | null;
    maxUses: number | null;
    uses: number;
    createdAt: Date;
    revokedAt?: Date;
}

/**
 * Generate a unique link ID (URL-safe)
 */
function generateLinkId(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Create a shareable collaboration link
 */
export async function createCollabLink(params: {
    projectId: string;
    creatorId: string;
    creatorEmail?: string;
    mode: CollabLinkMode;
    role: CollabLinkRole;
    expiresInHours?: number;
    maxUses?: number;
}): Promise<{ success: boolean; linkId?: string; error?: string }> {
    try {
        // Verify project exists and creator owns it
        const projectDoc = await adminDb.collection('projects').doc(params.projectId).get();
        if (!projectDoc.exists) {
            return { success: false, error: 'Project not found' };
        }

        const projectData = projectDoc.data();

        // Check ownership - projects may use different field names
        const isOwner =
            projectData?.ownerId === params.creatorId ||
            projectData?.createdBy === params.creatorId ||
            projectData?.userId === params.creatorId ||
            (params.creatorEmail && projectData?.owner_email === params.creatorEmail);

        if (!isOwner) {
            console.log('[Collaboration] Owner check failed:', {
                projectOwnerId: projectData?.ownerId,
                projectCreatedBy: projectData?.createdBy,
                projectUserId: projectData?.userId,
                projectOwnerEmail: projectData?.owner_email,
                requestCreatorId: params.creatorId,
                requestCreatorEmail: params.creatorEmail
            });
            return { success: false, error: 'Only project owner can create collaboration links' };
        }

        const linkId = generateLinkId();
        const expiresAt = params.expiresInHours
            ? new Date(Date.now() + params.expiresInHours * 60 * 60 * 1000)
            : null;

        await adminDb.collection('collab_links').doc(linkId).set({
            projectId: params.projectId,
            creatorId: params.creatorId,
            creatorEmail: params.creatorEmail || null,
            mode: params.mode,
            role: params.role,
            expiresAt,
            maxUses: params.maxUses || null,
            uses: 0,
            createdAt: FieldValue.serverTimestamp(),
            revokedAt: null
        });

        return { success: true, linkId };

    } catch (error) {
        console.error('[Collaboration] Failed to create collab link:', error);
        return { success: false, error: 'Failed to create link' };
    }
}

/**
 * Validate a collaboration link (check if it's still valid)
 */
export async function validateCollabLink(linkId: string): Promise<{
    valid: boolean;
    link?: CollabLink;
    project?: { id: string; name: string };
    error?: string;
}> {
    try {
        const linkDoc = await adminDb.collection('collab_links').doc(linkId).get();

        if (!linkDoc.exists) {
            return { valid: false, error: 'Link not found' };
        }

        const data = linkDoc.data()!;

        // Check if revoked
        if (data.revokedAt) {
            return { valid: false, error: 'Link has been revoked' };
        }

        // Check expiration
        if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
            return { valid: false, error: 'Link has expired' };
        }

        // Check max uses
        if (data.maxUses && data.uses >= data.maxUses) {
            return { valid: false, error: 'Link has reached maximum uses' };
        }

        // Get project info
        const projectDoc = await adminDb.collection('projects').doc(data.projectId).get();
        if (!projectDoc.exists) {
            return { valid: false, error: 'Project no longer exists' };
        }

        const projectData = projectDoc.data()!;

        return {
            valid: true,
            link: {
                id: linkId,
                projectId: data.projectId,
                creatorId: data.creatorId,
                creatorEmail: data.creatorEmail,
                mode: data.mode,
                role: data.role,
                expiresAt: data.expiresAt?.toDate() || null,
                maxUses: data.maxUses,
                uses: data.uses,
                createdAt: data.createdAt?.toDate() || new Date()
            },
            project: {
                id: data.projectId,
                name: projectData.name || 'Untitled Project'
            }
        };

    } catch (error) {
        console.error('[Collaboration] Failed to validate link:', error);
        return { valid: false, error: 'Failed to validate link' };
    }
}

/**
 * Consume a collaboration link (increment uses and grant access)
 */
export async function consumeCollabLink(
    linkId: string,
    userId: string,
    userEmail?: string
): Promise<{ success: boolean; projectId?: string; role?: CollabLinkRole; error?: string }> {
    try {
        // First validate
        const validation = await validateCollabLink(linkId);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const link = validation.link!;

        // For private links, user must be logged in
        if (link.mode === 'private' && !userId) {
            return { success: false, error: 'Login required to access this link' };
        }

        // Increment uses
        await adminDb.collection('collab_links').doc(linkId).update({
            uses: FieldValue.increment(1)
        });

        // Add user as collaborator if not already (for logged-in users)
        if (userId && userId !== link.creatorId) {
            const projectRef = adminDb.collection('projects').doc(link.projectId);
            const projectDoc = await projectRef.get();
            const existingCollabs = projectDoc.data()?.collaborators || [];

            const alreadyCollab = existingCollabs.some((c: any) => c.uid === userId);
            if (!alreadyCollab) {
                await projectRef.update({
                    collaborators: FieldValue.arrayUnion({
                        uid: userId,
                        email: userEmail || '',
                        role: link.role,
                        addedAt: new Date(),
                        addedBy: link.creatorId,
                        addedViaLink: linkId
                    }),
                    updatedAt: FieldValue.serverTimestamp()
                });
            }
        }

        return {
            success: true,
            projectId: link.projectId,
            role: link.role
        };

    } catch (error) {
        console.error('[Collaboration] Failed to consume link:', error);
        return { success: false, error: 'Failed to use link' };
    }
}

/**
 * Revoke a collaboration link
 */
export async function revokeCollabLink(
    linkId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const linkDoc = await adminDb.collection('collab_links').doc(linkId).get();

        if (!linkDoc.exists) {
            return { success: false, error: 'Link not found' };
        }

        const data = linkDoc.data()!;

        // Only creator can revoke
        if (data.creatorId !== userId) {
            return { success: false, error: 'Only link creator can revoke' };
        }

        await adminDb.collection('collab_links').doc(linkId).update({
            revokedAt: FieldValue.serverTimestamp()
        });

        return { success: true };

    } catch (error) {
        console.error('[Collaboration] Failed to revoke link:', error);
        return { success: false, error: 'Failed to revoke link' };
    }
}

/**
 * Get all active links for a project
 */
export async function getProjectCollabLinks(
    projectId: string,
    creatorId: string
): Promise<CollabLink[]> {
    try {
        // Simple query - only filter by projectId to avoid composite index requirement
        const snapshot = await adminDb
            .collection('collab_links')
            .where('projectId', '==', projectId)
            .limit(100)
            .get();

        // Filter by creatorId and remove revoked links in memory
        const filteredDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            return data.creatorId === creatorId && !data.revokedAt;
        });

        // Sort by createdAt and limit
        return filteredDocs
            .sort((a, b) => {
                const aTime = a.data().createdAt?.toMillis?.() || 0;
                const bTime = b.data().createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            })
            .slice(0, 20)
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    projectId: data.projectId,
                    creatorId: data.creatorId,
                    creatorEmail: data.creatorEmail,
                    mode: data.mode,
                    role: data.role,
                    expiresAt: data.expiresAt?.toDate?.() || null,
                    maxUses: data.maxUses,
                    uses: data.uses,
                    createdAt: data.createdAt?.toDate?.() || new Date()
                };
            });

    } catch (error) {
        console.error('[Collaboration] Failed to get project links:', error);
        return [];
    }
}

