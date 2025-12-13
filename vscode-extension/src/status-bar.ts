/**
 * Status Bar Manager for MLForge VS Code Extension
 */

import * as vscode from 'vscode';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'mlforge.showStatus';
        this.setDisconnected();
        this.statusBarItem.show();
    }

    setConnecting(): void {
        this.statusBarItem.text = '$(sync~spin) MLForge: Connecting...';
        this.statusBarItem.tooltip = 'Connecting to MLForge server';
        this.statusBarItem.backgroundColor = undefined;
    }

    setConnected(projectId: string): void {
        this.statusBarItem.text = '$(cloud) MLForge: Connected';
        this.statusBarItem.tooltip = `Connected to project: ${projectId}`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    }

    setDisconnected(): void {
        this.statusBarItem.text = '$(cloud-offline) MLForge: Disconnected';
        this.statusBarItem.tooltip = 'Click to connect to MLForge';
        this.statusBarItem.backgroundColor = undefined;
    }

    setError(message: string): void {
        this.statusBarItem.text = '$(error) MLForge: Error';
        this.statusBarItem.tooltip = message;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    updateCollaboratorCount(count: number): void {
        if (count > 0) {
            this.statusBarItem.text = `$(cloud) MLForge: ${count} collaborator${count > 1 ? 's' : ''}`;
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
