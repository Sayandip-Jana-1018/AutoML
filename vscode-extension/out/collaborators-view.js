"use strict";
/**
 * Collaborators Tree View Provider
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
exports.CollaboratorsProvider = void 0;
const vscode = __importStar(require("vscode"));
class CollaboratorsProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    collaborators = [];
    setCollaborators(collaborators) {
        this.collaborators = collaborators;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }
        if (this.collaborators.length === 0) {
            return Promise.resolve([
                new CollaboratorItem('No collaborators', '', vscode.TreeItemCollapsibleState.None, true)
            ]);
        }
        return Promise.resolve(this.collaborators.map(c => new CollaboratorItem(c.name, c.color, vscode.TreeItemCollapsibleState.None)));
    }
}
exports.CollaboratorsProvider = CollaboratorsProvider;
class CollaboratorItem extends vscode.TreeItem {
    name;
    color;
    collapsibleState;
    isEmpty;
    constructor(name, color, collapsibleState, isEmpty = false) {
        super(name, collapsibleState);
        this.name = name;
        this.color = color;
        this.collapsibleState = collapsibleState;
        this.isEmpty = isEmpty;
        if (isEmpty) {
            this.description = 'Connect to see collaborators';
            this.iconPath = new vscode.ThemeIcon('info');
        }
        else {
            this.description = 'Online';
            this.iconPath = new vscode.ThemeIcon('account', new vscode.ThemeColor('charts.green'));
        }
        this.contextValue = isEmpty ? 'empty' : 'collaborator';
    }
}
//# sourceMappingURL=collaborators-view.js.map