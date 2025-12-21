/**
 * File Parsing Utilities
 * Extracted from UploadStageOverlay.tsx for modularity
 */
import JSZip from 'jszip';

// ============ TYPES ============
export interface DataPreview {
    columns: string[];
    columnTypes: Record<string, 'numeric' | 'categorical' | 'datetime' | 'image'>;
    rows: any[];
    totalRows: number;
    fileSize: number;
}

export interface LocalPreview {
    type: 'tabular' | 'json' | 'text' | 'image' | 'zip' | 'html' | 'unknown';
    columns?: string[];
    rows?: any[];
    totalRows?: number;
    text?: string;
    imageUrl?: string;
    zipFiles?: { name: string; size: number }[];
    zipImagePreviews?: string[];
    zipFolders?: { name: string; count: number }[];
    extractedSize?: number; // Total size of all files in ZIP
    totalFiles?: number; // Total count of files in ZIP
    totalImages?: number; // Total count of image files
    confidence: 'high' | 'medium' | 'low';
    detectionReason: string;
    nullCount?: number;
    duplicateRows?: number;
    missingColumns?: string[];
    fileTree?: FileTreeNode;
}

export interface HTMLTableInfo {
    index: number;
    name: string;
    columns: string[];
    rowCount: number;
    previewRow: string[];
}

export interface FileTreeNode {
    name: string;
    type: 'folder' | 'file';
    count?: number; // For folders: total files inside (recursive)
    size?: number;  // For files: size in bytes
    children?: FileTreeNode[];
}

export const CLIENT_PREVIEW_LIMIT = 500 * 1024 * 1024;
export const SUPPORTED_EXTENSIONS = ['.csv', '.tsv', '.xlsx', '.xls', '.json', '.jsonl', '.txt', '.zip', '.jpg', '.jpeg', '.png', '.gif', '.webp'];

// ============ PARSING FUNCTIONS ============

/**
 * Robust CSV line parser - handles quoted fields containing commas, escaped quotes
 */
function parseCSVLine(line: string, delimiter = ','): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    // Remove BOM if present
    if (line.charCodeAt(0) === 0xFEFF) {
        line = line.slice(1);
    }

    // Remove trailing \r if present (Windows line endings)
    if (line.endsWith('\r')) {
        line = line.slice(0, -1);
    }

    while (i < line.length) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote ("") - add single quote to result
                current += '"';
                i += 2;
                continue;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
                i++;
                continue;
            }
        }

        if (char === delimiter && !inQuotes) {
            // Field delimiter - push current field and reset
            result.push(current.trim());
            current = '';
            i++;
            continue;
        }

        // Regular character - add to current field
        current += char;
        i++;
    }

    // Don't forget the last field
    result.push(current.trim());

    return result;
}

export function parseCSV(text: string, delimiter = ','): { columns: string[]; rows: any[]; totalRows: number; nullCount: number; duplicateRows: number } {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return { columns: [], rows: [], totalRows: 0, nullCount: 0, duplicateRows: 0 };

    // Use robust CSV line parser for header
    const columns = parseCSVLine(lines[0], delimiter);
    const rows: any[] = [];
    let nullCount = 0;
    const rowStrings = new Set<string>();
    let duplicateRows = 0;

    for (let i = 1; i < lines.length && i <= 50; i++) {
        // Use robust CSV line parser for each row
        const values = parseCSVLine(lines[i], delimiter);
        const row: any = {};
        columns.forEach((col, idx) => {
            const val = values[idx] || '';
            row[col] = val;
            if (val === '' || val.toLowerCase() === 'null' || val.toLowerCase() === 'nan' || val.toLowerCase() === 'na') {
                nullCount++;
            }
        });

        const rowStr = JSON.stringify(row);
        if (rowStrings.has(rowStr)) duplicateRows++;
        rowStrings.add(rowStr);
        rows.push(row);
    }
    return { columns, rows, totalRows: lines.length - 1, nullCount, duplicateRows };
}

export function parseJSONL(text: string): { columns: string[]; rows: any[]; totalRows: number } {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return { columns: [], rows: [], totalRows: 0 };
    const rows: any[] = [];
    const columnsSet = new Set<string>();
    for (let i = 0; i < lines.length && i < 50; i++) {
        try {
            const obj = JSON.parse(lines[i]);
            Object.keys(obj).forEach(k => columnsSet.add(k));
            rows.push(obj);
        } catch (e) { }
    }
    return { columns: Array.from(columnsSet), rows, totalRows: lines.length };
}

/**
 * Flatten a nested object into a flat object with dot-notation keys
 */
function flattenObject(obj: any, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key in obj) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (value === null || value === undefined) {
            result[newKey] = '';
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            // Recursively flatten nested objects
            Object.assign(result, flattenObject(value, newKey));
        } else if (Array.isArray(value)) {
            // For arrays, stringify them
            result[newKey] = JSON.stringify(value);
        } else {
            result[newKey] = value;
        }
    }

    return result;
}

/**
 * Find the first array in a nested object (for APIs that wrap data in objects)
 */
function findDataArray(data: any): any[] | null {
    if (Array.isArray(data)) return data;

    if (typeof data === 'object' && data !== null) {
        // Check common wrapper keys first
        const commonKeys = ['results', 'data', 'items', 'records', 'rows', 'entries', 'list', 'users', 'posts'];
        for (const key of commonKeys) {
            if (Array.isArray(data[key])) return data[key];
        }

        // Check any key that contains an array
        for (const key in data) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                return data[key];
            }
        }
    }

    return null;
}

export function parseJSON(text: string): { columns: string[]; rows: any[]; totalRows: number } {
    try {
        const data = JSON.parse(text);

        // Try to find an array of data (handles nested API responses)
        const dataArray = findDataArray(data);

        if (dataArray && dataArray.length > 0) {
            // Flatten each row to handle nested objects
            const flattenedRows = dataArray.slice(0, 50).map(row => {
                if (typeof row === 'object' && row !== null) {
                    return flattenObject(row);
                }
                return { value: row };
            });

            // Collect all unique columns from flattened rows
            const columnsSet = new Set<string>();
            flattenedRows.forEach(row => {
                Object.keys(row).forEach(key => columnsSet.add(key));
            });

            const columns = Array.from(columnsSet);
            return { columns, rows: flattenedRows, totalRows: dataArray.length };
        } else if (Array.isArray(data)) {
            // Simple array of primitives
            return { columns: ['value'], rows: data.slice(0, 50).map(v => ({ value: v })), totalRows: data.length };
        } else {
            // Object - convert to key/value pairs
            const columns = ['key', 'value'];
            const rows = Object.entries(data).map(([k, v]) => ({
                key: k,
                value: typeof v === 'object' ? JSON.stringify(v) : v
            }));
            return { columns, rows: rows.slice(0, 50), totalRows: rows.length };
        }
    } catch (e) {
        return { columns: [], rows: [], totalRows: 0 };
    }
}

export function parseHTMLTables(html: string): HTMLTableInfo[] {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tables = Array.from(doc.querySelectorAll('table'));

        return tables.map((table, index) => {
            const caption = table.querySelector('caption')?.textContent?.trim();
            const id = table.id;
            const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
            const headerCells = headerRow ? Array.from(headerRow.querySelectorAll('th, td')) : [];
            const columns = headerCells.map((cell, i) => (cell.textContent || '').trim() || `Col ${i + 1}`);

            const firstDataRow = table.querySelector('tbody tr') || table.querySelectorAll('tr')[1];
            const previewCells = firstDataRow ? Array.from(firstDataRow.querySelectorAll('td, th')) : [];
            const previewRow = previewCells.slice(0, 3).map(cell => (cell.textContent || '').trim().substring(0, 20));

            const rowCount = table.querySelectorAll('tbody tr').length || Math.max(0, table.querySelectorAll('tr').length - 1);

            let name = caption || (id && id !== '' ? id : null);
            if (!name && columns.length > 0) {
                name = columns.slice(0, 2).join(', ') + (columns.length > 2 ? '...' : '');
            }
            name = name || `Table ${index + 1}`;

            return { index, name, columns, rowCount, previewRow };
        }).filter(t => {
            // Filter out bad tables
            if (t.rowCount <= 0 || t.columns.length < 2) return false;

            // Filter out tables that look like CSS/parser output
            const badPatterns = ['mw-parser', 'navbox', 'infobox', 'sidebar', 'metadata'];
            const nameLower = t.name.toLowerCase();
            if (badPatterns.some(p => nameLower.includes(p))) return false;

            // Filter out tables with very long column names (likely CSS)
            if (t.columns.some(c => c.length > 50)) return false;

            return true;
        });
    } catch (e) {
        return [];
    }
}

/**
 * Get the best HTML table automatically (the one with most data)
 */
export function getBestHTMLTable(html: string): { tableIndex: number; parsed: ReturnType<typeof parseHTMLTableByIndex> } | null {
    const tables = parseHTMLTables(html);
    if (tables.length === 0) return null;

    // Find table with most rows and columns (best data)
    const scored = tables.map(t => ({
        ...t,
        score: t.rowCount * t.columns.length
    }));

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    const parsed = parseHTMLTableByIndex(html, best.index);
    return { tableIndex: best.index, parsed };
}

export function parseHTMLTableByIndex(html: string, tableIndex: number): { columns: string[]; rows: any[]; totalRows: number; nullCount: number; duplicateRows: number } {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tables = Array.from(doc.querySelectorAll('table'));

        if (tableIndex >= tables.length) {
            return { columns: [], rows: [], totalRows: 0, nullCount: 0, duplicateRows: 0 };
        }

        const table = tables[tableIndex] as HTMLTableElement;

        const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
        const headerCells = headerRow ? Array.from(headerRow.querySelectorAll('th, td')) : [];
        const columns: string[] = headerCells.map((cell, i) => (cell.textContent || '').trim() || `Column ${i + 1}`);

        if (columns.length === 0) return { columns: [], rows: [], totalRows: 0, nullCount: 0, duplicateRows: 0 };

        const tbodyRows = table.querySelectorAll('tbody tr');
        const allRows = table.querySelectorAll('tr');
        const bodyRows = Array.from(tbodyRows.length > 0 ? tbodyRows : allRows).slice(1);

        const rows: any[] = [];
        let nullCount = 0;
        const rowStrings = new Set<string>();
        let duplicateRows = 0;

        bodyRows.slice(0, 50).forEach((tr: Element) => {
            const cells = Array.from(tr.querySelectorAll('td, th'));
            const row: any = {};
            columns.forEach((col, colIdx) => {
                const cellText = (cells[colIdx]?.textContent || '').trim();
                row[col] = cellText;
                if (!cellText || cellText === '-' || cellText === 'N/A') nullCount++;
            });

            const rowStr = JSON.stringify(row);
            if (rowStrings.has(rowStr)) duplicateRows++;
            rowStrings.add(rowStr);
            rows.push(row);
        });

        return { columns, rows, totalRows: bodyRows.length, nullCount, duplicateRows };
    } catch (e) {
        return { columns: [], rows: [], totalRows: 0, nullCount: 0, duplicateRows: 0 };
    }
}

export async function parseZipFile(file: File): Promise<{
    imagePreviews: string[];
    folders: { name: string; count: number }[];
    fileTree: FileTreeNode;
    totalFiles: number;
    totalImages: number;
    extractedSize?: number;
    tabularData?: { fileName: string; columns: string[]; rows: any[]; totalRows: number; nullCount?: number; duplicateRows?: number };
}> {
    try {
        const zip = await JSZip.loadAsync(file);
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const tabularExtensions = ['.csv', '.tsv', '.json', '.jsonl'];

        const imagePreviews: string[] = [];
        let totalFiles = 0;
        let totalImages = 0;
        let extractedSize = 0;
        let firstTabularFile: { path: string, entry: JSZip.JSZipObject, type: string } | null = null;
        let largestTabularSize = 0;

        const filePaths: { path: string; size: number }[] = [];

        // Pass 1: Gather all file paths and stats
        for (const name of Object.keys(zip.files)) {
            const zipEntry = zip.files[name];
            if (zipEntry.dir || name.startsWith('__MACOSX') || name.includes('/.')) continue;

            totalFiles++;
            const size = (zipEntry as any)._data?.uncompressedSize || 0;
            extractedSize += size;

            const ext = '.' + name.split('.').pop()?.toLowerCase();
            const isImage = imageExtensions.includes(ext);
            const isTabular = tabularExtensions.includes(ext);

            if (isImage) {
                totalImages++;
                filePaths.push({ path: name, size });

                // Keep first 6 images for preview
                if (imagePreviews.length < 6) {
                    const blob = await zipEntry.async('blob');
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                    imagePreviews.push(base64);
                }
            } else if (isTabular) {
                const lowerPath = name.toLowerCase();
                const currentSize = (zipEntry as any)._data?.uncompressedSize || 0;

                let score = currentSize;
                if (lowerPath.includes('train')) score += 100000000;
                if (lowerPath.includes('data')) score += 1000000;

                if (!firstTabularFile || score > largestTabularSize) {
                    firstTabularFile = { path: name, entry: zipEntry, type: ext };
                    largestTabularSize = score;
                }
            }
        }

        // Pass 2: Build File Tree
        const rootNode: FileTreeNode = { name: 'root', type: 'folder', children: [], count: 0 };

        filePaths.forEach(({ path, size }) => {
            const parts = path.split('/');
            let currentNode = rootNode;

            parts.forEach((part, idx) => {
                if (idx === parts.length - 1) {
                    // File node
                    currentNode.children = currentNode.children || [];
                    currentNode.children.push({ name: part, type: 'file', size });
                } else {
                    // Folder node
                    currentNode.children = currentNode.children || [];
                    let folderNode = currentNode.children.find(c => c.name === part && c.type === 'folder');
                    if (!folderNode) {
                        folderNode = { name: part, type: 'folder', children: [], count: 0 };
                        currentNode.children.push(folderNode);
                    }
                    currentNode = folderNode;
                }
            });
        });

        // Pass 3: Calculate folder counts (recursive)
        const calculateCounts = (node: FileTreeNode): number => {
            if (node.type === 'file') return 1;
            let count = 0;
            node.children?.forEach(child => {
                count += calculateCounts(child);
            });
            node.count = count;
            return count;
        };
        calculateCounts(rootNode);

        // Pass 4: Smart folder detection for backward compat
        const folderCounts: Record<string, number> = {};
        if (filePaths.length > 0) {
            const pathComponents = filePaths.map(p => p.path.split('/'));
            let depth = 0;
            const maxDepth = Math.max(...pathComponents.map(p => p.length));

            while (depth < maxDepth - 1) {
                const uniqueAtDepth = new Set(pathComponents.map(p => p[depth]));
                if (uniqueAtDepth.size > 1) break;
                depth++;
            }

            pathComponents.forEach(parts => {
                if (parts.length > depth + 1) {
                    const classFolder = parts[depth];
                    folderCounts[classFolder] = (folderCounts[classFolder] || 0) + 1;
                } else {
                    folderCounts['(root)'] = (folderCounts['(root)'] || 0) + 1;
                }
            });
        }

        const folders = Object.entries(folderCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        let tabularData;
        if (firstTabularFile) {
            try {
                const text = await firstTabularFile.entry.async('string');
                if (firstTabularFile.type === '.json') {
                    const parsed = parseJSON(text);
                    tabularData = { fileName: firstTabularFile.path, ...parsed };
                } else if (firstTabularFile.type === '.jsonl') {
                    const parsed = parseJSONL(text);
                    tabularData = { fileName: firstTabularFile.path, ...parsed };
                } else {
                    const delimiter = firstTabularFile.type === '.tsv' ? '\t' : ',';
                    const parsed = parseCSV(text, delimiter);
                    tabularData = { fileName: firstTabularFile.path, ...parsed };
                }
            } catch (e) {
                console.warn('Failed to parse inner tabular file', e);
            }
        }

        return { imagePreviews, folders, fileTree: rootNode, totalFiles, totalImages, tabularData, extractedSize };
    } catch (e) {
        console.error('ZIP parse error:', e);
        return { imagePreviews: [], folders: [], fileTree: { name: 'root', type: 'folder', children: [] }, totalFiles: 0, totalImages: 0 };
    }
}

export function detectFileType(file: File): { type: LocalPreview['type']; confidence: 'high' | 'medium' | 'low'; reason: string } {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const mimeType = file.type;
    if (['csv', 'tsv'].includes(ext)) return { type: 'tabular', confidence: 'high', reason: `File extension .${ext}` };
    if (['xlsx', 'xls'].includes(ext)) return { type: 'tabular', confidence: 'high', reason: `Excel file .${ext}` };
    if (ext === 'jsonl') return { type: 'tabular', confidence: 'high', reason: 'JSONL format' };
    if (ext === 'json') return { type: 'json', confidence: 'high', reason: 'JSON file' };
    if (ext === 'txt') return { type: 'text', confidence: 'high', reason: 'Plain text file' };
    if (ext === 'zip') return { type: 'zip', confidence: 'high', reason: 'ZIP archive' };
    if (['html', 'htm'].includes(ext)) return { type: 'html', confidence: 'high', reason: 'HTML file' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return { type: 'image', confidence: 'high', reason: `Image file .${ext}` };
    if (mimeType.includes('csv') || mimeType.includes('spreadsheet')) return { type: 'tabular', confidence: 'medium', reason: 'Detected from MIME type' };
    if (mimeType.startsWith('image/')) return { type: 'image', confidence: 'medium', reason: 'Detected from MIME type' };
    if (mimeType.includes('html')) return { type: 'html', confidence: 'medium', reason: 'HTML content detected' };
    return { type: 'unknown', confidence: 'low', reason: 'Could not detect file type' };
}
