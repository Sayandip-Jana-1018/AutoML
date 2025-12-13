'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
    ScatterChart, BarChart3, LineChart, PieChart, BoxSelect,
    Layers, Grid3X3, Loader2
} from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';

// Chart type definitions
export const POPULAR_CHARTS = [
    { id: 'scatter', name: 'Scatter Plot', icon: ScatterChart },
    { id: 'histogram', name: 'Histogram', icon: BarChart3 },
    { id: 'boxplot', name: 'Box Plot', icon: BoxSelect },
    { id: 'correlation', name: 'Correlation Heatmap', icon: Grid3X3 },
    { id: 'pairplot', name: 'Pair Plot', icon: Layers },
    { id: 'bar', name: 'Bar Chart', icon: PieChart },
    { id: '3d_scatter', name: '3D Scatter', icon: LineChart },
    { id: 'violin', name: 'Violin Plot', icon: LineChart },
];

interface ChartGridProps {
    onChartSelect: (chartType: string) => void;
    generatingChart: string | null;
    generatedCharts: string[];
}

export const ChartGrid: React.FC<ChartGridProps> = ({
    onChartSelect,
    generatingChart,
    generatedCharts
}) => {
    const { themeColor } = useThemeColor();

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {POPULAR_CHARTS.map((chart, i) => {
                const isGenerating = generatingChart === chart.id;
                const isGenerated = generatedCharts.includes(chart.id);

                return (
                    <motion.button
                        key={chart.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => !isGenerating && !isGenerated && onChartSelect(chart.id)}
                        disabled={isGenerating}
                        className={`p-4 rounded-xl backdrop-blur-xl text-center transition-all ${isGenerated
                            ? 'opacity-60 cursor-default'
                            : isGenerating
                                ? 'opacity-80'
                                : 'hover:scale-105 cursor-pointer'
                            }`}
                        style={{
                            background: isGenerated
                                ? `${themeColor}15`
                                : 'rgba(0,0,0,0.3)',
                            border: `1px solid ${isGenerated ? themeColor + '40' : 'rgba(255,255,255,0.1)'}`
                        }}
                    >
                        {isGenerating ? (
                            <Loader2
                                className="w-8 h-8 mx-auto mb-2 animate-spin"
                                style={{ color: themeColor }}
                            />
                        ) : (
                            <chart.icon
                                className="w-8 h-8 mx-auto mb-2"
                                style={{ color: isGenerated ? themeColor : 'white' }}
                            />
                        )}
                        <span className={`text-sm ${isGenerated ? '' : 'text-white/80'}`}
                            style={isGenerated ? { color: themeColor } : {}}>
                            {chart.name}
                        </span>
                        {isGenerated && (
                            <span className="block text-xs mt-1 text-white/40">Generated</span>
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
};

export default ChartGrid;
