'use client';
/**
 * Data Preview Table Component
 * Shows data table with column type badges
 */
import React from 'react';
import { type LocalPreview } from '@/lib/file-parsers';
import { getTypeBadgeColor, getTypeBadgeIcon, type ColumnTypeInfo } from '@/lib/column-type-detection';

interface PreviewTableProps {
    localPreview: LocalPreview;
    displayedRows: any[];
    targetColumn: string | null;
    setTargetColumn: (col: string) => void;
    detectedColumnTypes: Record<string, ColumnTypeInfo>;
    onCycleColumnType: (col: string, e: React.MouseEvent) => void;
    themeColor: string;
}

export function PreviewTable({
    localPreview,
    displayedRows,
    targetColumn,
    setTargetColumn,
    detectedColumnTypes,
    onCycleColumnType,
    themeColor
}: PreviewTableProps) {
    if (!localPreview.columns || !localPreview.rows) return null;

    return (
        <div
            className="overflow-auto rounded-lg border border-white/10 max-h-[200px]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: `${themeColor}40 transparent` }}
        >
            <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/90">
                    <tr>
                        {localPreview.columns.map((col, i) => {
                            const typeInfo = detectedColumnTypes[col];
                            const typeIcon = typeInfo ? getTypeBadgeIcon(typeInfo.type) : '';
                            const typeColor = typeInfo ? getTypeBadgeColor(typeInfo.type) : '#9ca3af';
                            return (
                                <th
                                    key={i}
                                    onClick={() => setTargetColumn(col)}
                                    className="px-3 py-2 text-left font-medium text-xs border-b border-white/10 cursor-pointer hover:bg-white/5"
                                    style={targetColumn === col ? { color: themeColor } : { color: 'rgba(255,255,255,0.6)' }}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="truncate max-w-[100px]">{col}</span>
                                        {typeInfo && (
                                            <span
                                                onClick={(e) => onCycleColumnType(col, e)}
                                                className="text-[10px] px-1 py-0.5 rounded flex items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                                                style={{ background: `${typeColor}20`, color: typeColor }}
                                                title={`${typeInfo.type} — click to change`}
                                            >
                                                {typeIcon}
                                            </span>
                                        )}
                                        {targetColumn === col && (
                                            <span className="text-[10px] px-1 py-0.5 rounded shrink-0" style={{ background: `${themeColor}30` }}>
                                                target
                                            </span>
                                        )}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {displayedRows.map((row, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                            {localPreview.columns?.map((col, j) => (
                                <td key={j} className="px-3 py-2 text-white/80 text-xs whitespace-nowrap max-w-[120px] truncate">
                                    {String(row[col] ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default PreviewTable;
