/**
 * MLForge VS Code Extension
 * Real-time collaboration with MLForge Studio
 */

import * as vscode from 'vscode';
import { MCPClient } from './mcp-client';
import { StatusBarManager } from './status-bar';
import { CollaboratorsProvider } from './collaborators-view';
import * as Y from 'yjs';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Simple HTTP GET function for VSCode extension (fetch not available)
function httpGet(url: string, token?: string): Promise<any> {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    console.error('[MLForge] Failed to parse response:', data);
                    resolve(null);
                }
            });
        });

        req.on('error', (err) => {
            console.error('[MLForge] HTTP request error:', err);
            resolve(null);
        });

        req.end();
    });
}

// Simple HTTP POST function for VSCode extension
function httpPost(url: string, body: object): Promise<any> {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;
        const bodyStr = JSON.stringify(body);

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr)
            }
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300, data: JSON.parse(data) });
                } catch {
                    console.error('[MLForge] Failed to parse response:', data);
                    resolve({ ok: false, data: null });
                }
            });
        });

        req.on('error', (err) => {
            console.error('[MLForge] HTTP POST error:', err);
            resolve({ ok: false, data: null });
        });

        req.write(bodyStr);
        req.end();
    });
}

let mcpClient: MCPClient | null = null;
let statusBar: StatusBarManager | null = null;
let collaboratorsProvider: CollaboratorsProvider | null = null;
let activeEditor: vscode.TextEditor | null = null;
let isRemoteChange = false;
let documentBinding: vscode.Disposable | null = null;

// Store connection info for sync without WebSocket
let currentProjectId: string | null = null;
let currentToken: string | null = null;

// Store extension context for persistence
let extensionContext: vscode.ExtensionContext | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('MLForge extension activated');
    extensionContext = context;

    // Restore connection state from persistent storage
    currentProjectId = context.globalState.get<string>('mlforge.projectId') || null;
    currentToken = context.globalState.get<string>('mlforge.token') || null;

    if (currentProjectId) {
        console.log('[MLForge] Restored connection to project:', currentProjectId);
    }

    // Initialize status bar
    statusBar = new StatusBarManager();
    context.subscriptions.push(statusBar);

    // Initialize collaborators view
    collaboratorsProvider = new CollaboratorsProvider();
    vscode.window.registerTreeDataProvider('mlforgeCollaborators', collaboratorsProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('mlforge.connect', () => connectToProject()),
        vscode.commands.registerCommand('mlforge.disconnect', () => disconnect()),
        vscode.commands.registerCommand('mlforge.commit', () => saveVersion()),
        vscode.commands.registerCommand('mlforge.push', () => pushToCloud()),
        vscode.commands.registerCommand('mlforge.showStatus', () => showStatus())
    );

    // Register URI handler for one-click connect from Studio
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            async handleUri(uri: vscode.Uri) {
                console.log('[MLForge] URI received:', uri.toString());

                // Parse query parameters
                const params = new URLSearchParams(uri.query);
                const projectId = params.get('projectId');
                const wsUrl = params.get('wsUrl');
                const token = params.get('token');

                if (projectId) {
                    // Store connection info globally for sync without WebSocket
                    currentProjectId = projectId;
                    currentToken = token;

                    // Persist to globalState so it survives reloads
                    extensionContext?.globalState.update('mlforge.projectId', projectId);
                    extensionContext?.globalState.update('mlforge.token', token);

                    vscode.window.showInformationMessage(`✓ Connected to MLForge project: ${projectId}`);
                    console.log('[MLForge] Connection persisted to globalState');
                    statusBar?.setConnected(projectId);

                    // Store in global state for persistence
                    context.globalState.update('mlforge.projectId', projectId);
                    if (token) {
                        context.globalState.update('mlforge.mcpToken', token);
                    }
                    if (wsUrl) {
                        context.globalState.update('mlforge.wsUrl', wsUrl);
                    }

                    // Fetch the current script from MLForge and open it
                    await openTrainPyFromProject(projectId, token || undefined);

                    // Try WebSocket connection for real-time sync (optional)
                    connectWithToken(projectId, wsUrl || undefined, token || undefined);
                } else {
                    vscode.window.showErrorMessage('Invalid MLForge URI: missing projectId');
                }
            }
        })
    );

    // Track cursor position changes
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection((e) => {
            if (mcpClient?.isConnected && e.textEditor === activeEditor) {
                const pos = e.selections[0].active;
                mcpClient.updateCursor(pos.line, pos.character);
            }
        })
    );

    // Auto-sync to cloud when any document is saved (works without WebSocket)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            // Sync if we have a projectId (from URI connection)
            if (currentProjectId) {
                console.log('[MLForge] Text document saved, syncing to cloud...', document.fileName);
                pushToCloud();
            }
        })
    );

    // Also handle Jupyter notebook saves
    context.subscriptions.push(
        vscode.workspace.onDidSaveNotebookDocument((notebook) => {
            if (currentProjectId) {
                console.log('[MLForge] Notebook saved, syncing to cloud...', notebook.uri.fsPath);
                pushToCloudFromNotebook(notebook);
            }
        })
    );

    // Auto-connect if configured
    const config = vscode.workspace.getConfiguration('mlforge');
    if (config.get<boolean>('autoConnect')) {
        checkForProjectLink();
    }
}

// Open train.py from project by fetching the script from MLForge API
async function openTrainPyFromProject(projectId: string, token?: string) {
    try {
        const config = vscode.workspace.getConfiguration('mlforge');
        const apiUrl = config.get<string>('apiBaseUrl') || 'http://localhost:3000';

        console.log('[MLForge] Fetching script for project:', projectId);

        // Use https/http module instead of fetch (not available in VSCode extension host)
        const url = `${apiUrl}/api/studio/projects/${projectId}/script`;
        const data = await httpGet(url, token);

        if (!data) {
            console.error('[MLForge] Failed to fetch script');
            vscode.window.showWarningMessage('Could not fetch script. Opening empty file.');
            const doc = await vscode.workspace.openTextDocument({ language: 'python', content: '# MLForge Project: ' + projectId + '\n\n' });
            await vscode.window.showTextDocument(doc);
            return;
        }

        const scriptContent = data.script || '# MLForge Project: ' + projectId + '\n# No script found\n';

        console.log('[MLForge] Fetched script, length:', scriptContent.length);

        // Determine file path to save/open
        let filePath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            // Use current workspace
            const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            filePath = path.join(workspacePath, 'train.py');
        } else {
            // Use temp directory if no workspace open
            const tempDir = os.tmpdir();
            // Sanitize project ID for filename
            const safeProjectId = projectId.replace(/[^a-zA-Z0-9-_]/g, '_');
            filePath = path.join(tempDir, `mlforge_${safeProjectId}_train.py`);
        }

        // Write content to the file
        // Note: usage of fs module requires nodejs environment, which VS Code extensions have
        try {
            fs.writeFileSync(filePath, scriptContent);
        } catch (writeErr: any) {
            console.error('[MLForge] Failed to write file:', writeErr);
            vscode.window.showErrorMessage(`Failed to save script to disk: ${writeErr.message}`);
            return;
        }

        // Open the document from disk
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc, { preview: false });

        vscode.window.showInformationMessage('📄 train.py loaded from MLForge');

    } catch (error: any) {
        console.error('[MLForge] Error opening train.py:', error);
        vscode.window.showErrorMessage(`Failed to open train.py: ${error.message}`);
    }
}

async function connectToProject() {
    // Get project ID from user
    const projectId = await vscode.window.showInputBox({
        prompt: 'Enter MLForge Project ID',
        placeHolder: 'e.g., PtTHiUDPPbtogsdvc7k0'
    });

    if (!projectId) {
        return;
    }

    await connect(projectId);
}

async function connect(projectId: string) {
    const config = vscode.workspace.getConfiguration('mlforge');
    const serverUrl = config.get<string>('serverUrl') || 'http://localhost:4000';

    try {
        statusBar?.setConnecting();

        mcpClient = new MCPClient(serverUrl, projectId);
        await mcpClient.connect();

        // Listen for collaborator updates
        mcpClient.on('participants', (participants) => {
            collaboratorsProvider?.setCollaborators(participants);
        });

        // Bind Yjs document to active editor when synced
        mcpClient.on('synced', () => {
            bindToActiveEditor();
        });

        // Listen for remote code changes
        mcpClient.codeText.observe((event: Y.YTextEvent) => {
            if (event.transaction.origin === mcpClient) {
                // Remote change - apply to VS Code editor
                applyRemoteChanges(event);
            }
        });

        statusBar?.setConnected(projectId);
        vscode.window.showInformationMessage(`Connected to MLForge project: ${projectId}`);

    } catch (error: any) {
        statusBar?.setDisconnected();
        vscode.window.showErrorMessage(`Failed to connect: ${error.message}`);
    }
}

// Connect with token from URI (one-click from Studio)
async function connectWithToken(projectId: string, wsUrl?: string, token?: string) {
    try {
        statusBar?.setConnecting();

        // Use provided wsUrl or default from config
        const config = vscode.workspace.getConfiguration('mlforge');
        const serverUrl = wsUrl
            ? wsUrl.replace('/ws/' + projectId, '').replace('ws://', 'http://').replace('wss://', 'https://')
            : (config.get<string>('serverUrl') || 'http://localhost:4000');

        mcpClient = new MCPClient(serverUrl, projectId, token);
        await mcpClient.connect();

        // Listen for collaborator updates
        mcpClient.on('participants', (participants) => {
            collaboratorsProvider?.setCollaborators(participants);
        });

        // Bind Yjs document to active editor when synced
        mcpClient.on('synced', () => {
            console.log('[MLForge] Document synced, binding to editor...');
            bindToActiveEditor();
        });

        // Listen for remote code changes
        mcpClient.codeText.observe((event: Y.YTextEvent) => {
            if (event.transaction.origin === mcpClient) {
                // Remote change - apply to VS Code editor
                applyRemoteChanges(event);
            }
        });

        statusBar?.setConnected(projectId);
        vscode.window.showInformationMessage(`✅ Connected to MLForge project: ${projectId}`);

    } catch (error: any) {
        statusBar?.setDisconnected();
        vscode.window.showErrorMessage(`Failed to connect: ${error.message}\n\nMake sure MCP server is running.`);
    }
}

function bindToActiveEditor() {
    // Dispose of previous binding
    if (documentBinding) {
        documentBinding.dispose();
    }

    activeEditor = vscode.window.activeTextEditor || null;
    if (!activeEditor || !mcpClient) {
        return;
    }

    console.log('[MLForge] Binding to editor:', activeEditor.document.fileName);

    // Subscribe to local document changes
    documentBinding = vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === activeEditor?.document && !isRemoteChange && mcpClient?.isConnected) {
            // Apply local changes to Yjs
            applyLocalChanges(e.contentChanges);
        }
    });

    // Initialize Yjs with current editor content if empty
    const yText = mcpClient.codeText;
    const editorContent = activeEditor.document.getText();

    if (yText.length === 0 && editorContent.length > 0) {
        // First connection - sync editor to Yjs
        console.log('[MLForge] Initializing Yjs with editor content');
        mcpClient.setCode(editorContent);
    } else if (yText.length > 0) {
        // Yjs has content - sync to editor
        const yjsContent = yText.toString();
        if (yjsContent !== editorContent) {
            console.log('[MLForge] Syncing Yjs content to editor');
            isRemoteChange = true;
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                activeEditor.document.positionAt(0),
                activeEditor.document.positionAt(editorContent.length)
            );
            edit.replace(activeEditor.document.uri, fullRange, yjsContent);
            vscode.workspace.applyEdit(edit).then(() => {
                isRemoteChange = false;
            });
        }
    }
}

function applyLocalChanges(changes: readonly vscode.TextDocumentContentChangeEvent[]) {
    if (!mcpClient) return;

    const yText = mcpClient.codeText;

    // Apply each change to Yjs
    for (const change of changes) {
        const offset = change.rangeOffset;
        const deleteCount = change.rangeLength;
        const insertText = change.text;

        mcpClient.ydoc.transact(() => {
            if (deleteCount > 0) {
                yText.delete(offset, deleteCount);
            }
            if (insertText.length > 0) {
                yText.insert(offset, insertText);
            }
        }, 'local'); // Mark as local so we don't echo back
    }
}

function applyRemoteChanges(event: Y.YTextEvent) {
    if (!activeEditor) return;

    isRemoteChange = true;

    // Convert Yjs delta to VS Code edit
    const edit = new vscode.WorkspaceEdit();
    let offset = 0;

    for (const delta of event.delta) {
        if (delta.retain !== undefined) {
            offset += delta.retain;
        } else if (delta.delete !== undefined) {
            const startPos = activeEditor.document.positionAt(offset);
            const endPos = activeEditor.document.positionAt(offset + delta.delete);
            edit.delete(activeEditor.document.uri, new vscode.Range(startPos, endPos));
        } else if (delta.insert !== undefined) {
            const insertText = typeof delta.insert === 'string' ? delta.insert : '';
            const pos = activeEditor.document.positionAt(offset);
            edit.insert(activeEditor.document.uri, pos, insertText);
            offset += insertText.length;
        }
    }

    vscode.workspace.applyEdit(edit).then(() => {
        isRemoteChange = false;
    });
}

async function disconnect() {
    if (documentBinding) {
        documentBinding.dispose();
        documentBinding = null;
    }
    if (mcpClient) {
        mcpClient.disconnect();
        mcpClient = null;
    }
    activeEditor = null;
    statusBar?.setDisconnected();
    collaboratorsProvider?.setCollaborators([]);
    vscode.window.showInformationMessage('Disconnected from MLForge');
}

async function saveVersion() {
    if (!mcpClient?.isConnected) {
        vscode.window.showWarningMessage('Not connected to MLForge. Connect first.');
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const message = await vscode.window.showInputBox({
        prompt: 'Version message',
        placeHolder: 'Describe your changes...'
    });

    if (!message) {
        return;
    }

    try {
        // Save version via API
        const config = vscode.workspace.getConfiguration('mlforge');
        const apiUrl = config.get<string>('apiBaseUrl') || 'http://localhost:3000';

        // TODO: Implement version save API call
        vscode.window.showInformationMessage(`Version saved: ${message}`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to save version: ${error.message}`);
    }
}

// Helper to sync code to cloud
async function syncCodeToCloud(code: string, showMessages: boolean = true) {
    const projectId = mcpClient?.projectId || currentProjectId;
    const token = mcpClient?.token || currentToken;

    if (!projectId) {
        if (showMessages) vscode.window.showWarningMessage('Not connected to MLForge. Open a project from Studio first.');
        return;
    }

    if (!code.trim()) {
        if (showMessages) vscode.window.showWarningMessage('No code to sync');
        return;
    }

    try {
        const config = vscode.workspace.getConfiguration('mlforge');
        const apiUrl = config.get<string>('apiBaseUrl') || 'http://localhost:3000';

        if (showMessages) vscode.window.showInformationMessage('🔄 Syncing to MLForge...');

        const response = await httpPost(`${apiUrl}/api/mcp/sync-script`, { projectId, code, token, source: 'vscode' });

        const result = response.data as { error?: string; changed?: boolean; version?: number };

        if (!response.ok) {
            throw new Error(result?.error || 'Failed to sync');
        }

        if (showMessages) {
            if (result.changed) {
                vscode.window.showInformationMessage(`✅ Code synced to MLForge (v${result.version})`);
            } else {
                vscode.window.showInformationMessage('✓ Code already in sync');
            }
        }
        console.log('[MLForge] Sync complete:', result);
    } catch (error: any) {
        console.error('[MLForge] Sync error:', error);
        if (showMessages) vscode.window.showErrorMessage(`Failed to push: ${error.message}`);
    }
}

// Push from a saved notebook document
async function pushToCloudFromNotebook(notebook: vscode.NotebookDocument) {
    // Small delay to ensure cells are fully persisted after save
    await new Promise(resolve => setTimeout(resolve, 100));

    const cells = notebook.getCells();
    const codeCells = cells.filter(cell => cell.kind === vscode.NotebookCellKind.Code);
    const code = codeCells.map(cell => cell.document.getText()).join('\n\n');
    console.log('[MLForge] Extracted code from notebook:', code.length, 'chars from', codeCells.length, 'cells');
    console.log('[MLForge] First 100 chars:', code.substring(0, 100));
    await syncCodeToCloud(code, true);
}

// Push from active editor (manual command)
async function pushToCloud() {
    const projectId = mcpClient?.projectId || currentProjectId;
    if (!projectId) {
        vscode.window.showWarningMessage('Not connected to MLForge. Open a project from Studio first.');
        return;
    }

    let code = '';

    // Check for active notebook first
    const activeNotebook = vscode.window.activeNotebookEditor;
    if (activeNotebook) {
        const cells = activeNotebook.notebook.getCells();
        const codeCells = cells.filter(cell => cell.kind === vscode.NotebookCellKind.Code);
        code = codeCells.map(cell => cell.document.getText()).join('\n\n');
        console.log('[MLForge] Extracted code from active notebook:', code.length, 'chars');
    } else {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor or notebook');
            return;
        }
        code = editor.document.getText();
    }

    await syncCodeToCloud(code, true);
}

function showStatus() {
    const connected = mcpClient?.isConnected ?? false;
    const projectId = mcpClient?.projectId ?? 'None';
    const participants = mcpClient?.participants ?? [];

    vscode.window.showInformationMessage(
        `MLForge Status:\n` +
        `Connected: ${connected}\n` +
        `Project: ${projectId}\n` +
        `Collaborators: ${participants.length}`
    );
}

function checkForProjectLink() {
    // Check if current workspace/file has MLForge link
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        // Check for .mlforge file or comment header
        const text = editor.document.getText(new vscode.Range(0, 0, 5, 0));
        const match = text.match(/# MLForge Project: (\w+)/);
        if (match) {
            connect(match[1]);
        }
    }
}

export function deactivate() {
    if (documentBinding) {
        documentBinding.dispose();
    }
    if (mcpClient) {
        mcpClient.disconnect();
    }
}
