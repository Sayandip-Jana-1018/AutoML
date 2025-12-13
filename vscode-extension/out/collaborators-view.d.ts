/**
 * Collaborators Tree View Provider
 */
import * as vscode from 'vscode';
interface Collaborator {
    id: number;
    name: string;
    color: string;
    email?: string;
}
export declare class CollaboratorsProvider implements vscode.TreeDataProvider<CollaboratorItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<CollaboratorItem | undefined | null | void>;
    private collaborators;
    setCollaborators(collaborators: Collaborator[]): void;
    getTreeItem(element: CollaboratorItem): vscode.TreeItem;
    getChildren(element?: CollaboratorItem): Thenable<CollaboratorItem[]>;
}
declare class CollaboratorItem extends vscode.TreeItem {
    readonly name: string;
    readonly color: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    readonly isEmpty: boolean;
    constructor(name: string, color: string, collapsibleState: vscode.TreeItemCollapsibleState, isEmpty?: boolean);
}
export {};
//# sourceMappingURL=collaborators-view.d.ts.map