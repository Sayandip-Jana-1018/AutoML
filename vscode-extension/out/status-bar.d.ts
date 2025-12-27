/**
 * Status Bar Manager for MLForge VS Code Extension
 */
import * as vscode from 'vscode';
export declare class StatusBarManager implements vscode.Disposable {
    private statusBarItem;
    constructor();
    setConnecting(): void;
    setConnected(projectId: string): void;
    setDisconnected(): void;
    setStatus(state: 'syncing' | 'success' | 'error', text?: string): void;
    setError(message: string): void;
    updateCollaboratorCount(count: number): void;
    dispose(): void;
}
//# sourceMappingURL=status-bar.d.ts.map