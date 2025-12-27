"use strict";
/**
 * Status Bar Manager for MLForge VS Code Extension
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarManager {
    statusBarItem;
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'mlforge.showStatus';
        this.setDisconnected();
        this.statusBarItem.show();
    }
    setConnecting() {
        this.statusBarItem.text = '$(sync~spin) MLForge: Connecting...';
        this.statusBarItem.tooltip = 'Connecting to MLForge server';
        this.statusBarItem.backgroundColor = undefined;
    }
    setConnected(projectId) {
        this.statusBarItem.text = '$(cloud) MLForge: Connected';
        this.statusBarItem.tooltip = `Connected to project: ${projectId}`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    }
    setDisconnected() {
        this.statusBarItem.text = '$(cloud-offline) MLForge: Disconnected';
        this.statusBarItem.tooltip = 'Click to connect to MLForge';
        this.statusBarItem.backgroundColor = undefined;
    }
    setStatus(state, text) {
        switch (state) {
            case 'syncing':
                this.statusBarItem.text = text || '$(sync~spin) MLForge: Syncing...';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'success':
                this.statusBarItem.text = text || '$(check) MLForge: Synced';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                break;
            case 'error':
                this.statusBarItem.text = text || '$(error) MLForge: Error';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
        }
    }
    setError(message) {
        this.statusBarItem.text = '$(error) MLForge: Error';
        this.statusBarItem.tooltip = message;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    updateCollaboratorCount(count) {
        if (count > 0) {
            this.statusBarItem.text = `$(cloud) MLForge: ${count} collaborator${count > 1 ? 's' : ''}`;
        }
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=status-bar.js.map