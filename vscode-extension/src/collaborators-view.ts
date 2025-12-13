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

export class CollaboratorsProvider implements vscode.TreeDataProvider<CollaboratorItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CollaboratorItem | undefined | null | void> =
        new vscode.EventEmitter<CollaboratorItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CollaboratorItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private collaborators: Collaborator[] = [];

    setCollaborators(collaborators: Collaborator[]): void {
        this.collaborators = collaborators;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CollaboratorItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CollaboratorItem): Thenable<CollaboratorItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        if (this.collaborators.length === 0) {
            return Promise.resolve([
                new CollaboratorItem(
                    'No collaborators',
                    '',
                    vscode.TreeItemCollapsibleState.None,
                    true
                )
            ]);
        }

        return Promise.resolve(
            this.collaborators.map(c =>
                new CollaboratorItem(
                    c.name,
                    c.color,
                    vscode.TreeItemCollapsibleState.None
                )
            )
        );
    }
}

class CollaboratorItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly color: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isEmpty: boolean = false
    ) {
        super(name, collapsibleState);

        if (isEmpty) {
            this.description = 'Connect to see collaborators';
            this.iconPath = new vscode.ThemeIcon('info');
        } else {
            this.description = 'Online';
            this.iconPath = new vscode.ThemeIcon('account', new vscode.ThemeColor('charts.green'));
        }

        this.contextValue = isEmpty ? 'empty' : 'collaborator';
    }
}
