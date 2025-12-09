"use client";

import { motion } from "framer-motion";
import { GitBranch, Database, FileCode, Cpu, Cloud, CheckCircle2 } from "lucide-react";

interface LineageNode {
    id: string;
    type: 'dataset' | 'script' | 'job' | 'model' | 'endpoint';
    name: string;
    metadata: Record<string, unknown>;
}

interface LineageEdge {
    from: string;
    to: string;
    label?: string;
}

interface LineageGraphProps {
    nodes: LineageNode[];
    edges: LineageEdge[];
    className?: string;
}

const nodeIcons = {
    dataset: Database,
    script: FileCode,
    job: Cpu,
    model: GitBranch,
    endpoint: Cloud
};

const nodeColors = {
    dataset: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
    script: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    job: 'from-purple-500/20 to-violet-500/20 border-purple-500/30',
    model: 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
    endpoint: 'from-pink-500/20 to-rose-500/20 border-pink-500/30'
};

const iconColors = {
    dataset: 'text-green-400',
    script: 'text-blue-400',
    job: 'text-purple-400',
    model: 'text-orange-400',
    endpoint: 'text-pink-400'
};

export function LineageGraph({ nodes, edges, className = '' }: LineageGraphProps) {
    if (nodes.length === 0) {
        return (
            <div className={`p-8 text-center text-gray-500 ${className}`}>
                No lineage data available
            </div>
        );
    }

    // Order nodes by type for vertical layout
    const orderedTypes: LineageNode['type'][] = ['dataset', 'script', 'job', 'model', 'endpoint'];
    const groupedNodes = orderedTypes.map(type => nodes.filter(n => n.type === type));

    return (
        <div className={`p-6 ${className}`}>
            <div className="flex items-center gap-2 mb-6">
                <GitBranch className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Model Lineage</h3>
            </div>

            {/* Vertical flow layout */}
            <div className="relative flex flex-col items-center gap-6">
                {groupedNodes.map((group, groupIndex) => (
                    group.length > 0 && (
                        <div key={groupIndex} className="relative">
                            {/* Connector line */}
                            {groupIndex > 0 && (
                                <div className="absolute -top-6 left-1/2 w-0.5 h-6 bg-gradient-to-b from-white/10 to-white/20" />
                            )}

                            {/* Nodes row */}
                            <div className="flex items-center gap-4">
                                {group.map((node, nodeIndex) => (
                                    <LineageNodeCard
                                        key={node.id}
                                        node={node}
                                        delay={groupIndex * 0.1 + nodeIndex * 0.05}
                                    />
                                ))}
                            </div>

                            {/* Arrow down */}
                            {groupIndex < groupedNodes.length - 1 && groupedNodes[groupIndex + 1].length > 0 && (
                                <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                                    <svg className="w-4 h-4 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 16l-6-6h12z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    )
                ))}
            </div>

            {/* Legend */}
            <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
                    {orderedTypes.map(type => {
                        const Icon = nodeIcons[type];
                        return (
                            <div key={type} className="flex items-center gap-1.5">
                                <Icon className={`w-3.5 h-3.5 ${iconColors[type]}`} />
                                <span className="capitalize">{type}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function LineageNodeCard({ node, delay }: { node: LineageNode; delay: number }) {
    const Icon = nodeIcons[node.type];
    const isProduction = node.metadata?.isProduction === true;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`
                relative p-4 rounded-xl bg-gradient-to-br ${nodeColors[node.type]}
                border backdrop-blur-xl min-w-[140px] text-center
                hover:scale-105 transition-transform cursor-pointer
            `}
        >
            {isProduction && (
                <div className="absolute -top-2 -right-2 p-1 rounded-full bg-green-500">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
            )}

            <Icon className={`w-6 h-6 mx-auto mb-2 ${iconColors[node.type]}`} />
            <p className="text-sm font-medium text-white">{node.name}</p>
            <p className="text-xs text-gray-400 capitalize mt-1">{node.type}</p>

            {/* Metrics preview for model nodes */}
            {node.type === 'model' && node.metadata.metrics && (
                <div className="mt-2 pt-2 border-t border-white/10 text-xs">
                    {Object.entries(node.metadata.metrics as Record<string, number>)
                        .slice(0, 2)
                        .map(([key, value]) => (
                            <div key={key} className="flex justify-between text-gray-300">
                                <span>{key}:</span>
                                <span className="text-white font-medium">
                                    {typeof value === 'number' ? value.toFixed(3) : value}
                                </span>
                            </div>
                        ))
                    }
                </div>
            )}
        </motion.div>
    );
}

export default LineageGraph;
