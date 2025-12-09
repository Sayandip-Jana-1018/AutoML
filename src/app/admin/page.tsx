"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    BarChart3,
    Users,
    Database,
    Cpu,
    DollarSign,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Clock,
    Activity,
    Layers,
    RefreshCw
} from "lucide-react";
import { Navbar } from "@/components/navbar";

interface AnalyticsData {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalDatasets: number;
    totalModels: number;
    totalCost: number;
    totalGpuHours: number;
    byTier: {
        free: { jobs: number; cost: number };
        silver: { jobs: number; cost: number };
        gold: { jobs: number; cost: number };
    };
    dailyData: Array<{
        date: string;
        jobs: number;
        completed: number;
        failed: number;
        cost: number;
    }>;
    overview: {
        totalUsers: number;
        totalProjects: number;
        activeJobs: number;
        tierDistribution: Record<string, number>;
    };
}

export default function AdminDashboardPage() {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAnalytics();
    }, [dateRange]);

    const fetchAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const res = await fetch(`/api/admin/analytics?startDate=${startDate.toISOString().split('T')[0]}`);
            if (!res.ok) throw new Error('Failed to fetch analytics');

            const data = await res.json();
            setAnalytics(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    const successRate = analytics
        ? ((analytics.completedJobs / Math.max(analytics.totalJobs, 1)) * 100).toFixed(1)
        : '0';

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
            <Navbar />

            <main className="container mx-auto px-4 py-8 pt-24">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
                        <p className="text-gray-400">Platform analytics and usage monitoring</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Date Range Selector */}
                        <div className="flex rounded-xl bg-white/5 border border-white/10 p-1">
                            {(['7d', '30d', '90d'] as const).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setDateRange(range)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateRange === range
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={fetchAnalytics}
                            disabled={loading}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300"
                    >
                        <AlertTriangle className="w-4 h-4 inline mr-2" />
                        {error}
                    </motion.div>
                )}

                {loading && !analytics ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
                    </div>
                ) : analytics && (
                    <>
                        {/* Overview Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <StatCard
                                icon={Users}
                                label="Total Users"
                                value={analytics.overview.totalUsers}
                                color="blue"
                            />
                            <StatCard
                                icon={Layers}
                                label="Projects"
                                value={analytics.overview.totalProjects}
                                color="purple"
                            />
                            <StatCard
                                icon={Database}
                                label="Datasets"
                                value={analytics.totalDatasets}
                                color="green"
                            />
                            <StatCard
                                icon={Cpu}
                                label="Models"
                                value={analytics.totalModels}
                                color="orange"
                            />
                        </div>

                        {/* Jobs & Cost Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {/* Jobs Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-6 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-white">Jobs Summary</h3>
                                    <Activity className="w-5 h-5 text-blue-400" />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">Total Jobs</span>
                                        <span className="text-xl font-bold text-white">{analytics.totalJobs}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-gray-400">
                                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                                            Completed
                                        </span>
                                        <span className="text-green-400 font-medium">{analytics.completedJobs}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-gray-400">
                                            <XCircle className="w-4 h-4 text-red-400" />
                                            Failed
                                        </span>
                                        <span className="text-red-400 font-medium">{analytics.failedJobs}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-gray-400">
                                            <Clock className="w-4 h-4 text-yellow-400" />
                                            Active
                                        </span>
                                        <span className="text-yellow-400 font-medium">{analytics.overview.activeJobs}</span>
                                    </div>

                                    {/* Success Rate Bar */}
                                    <div className="pt-2">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500">Success Rate</span>
                                            <span className="text-green-400">{successRate}%</span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                                                style={{ width: `${successRate}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Cost Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="p-6 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-white">Cost & Usage</h3>
                                    <DollarSign className="w-5 h-5 text-green-400" />
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <span className="text-gray-400 text-sm">Total Cost</span>
                                        <p className="text-3xl font-bold text-white">
                                            ${analytics.totalCost.toFixed(2)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-sm">GPU Hours</span>
                                        <p className="text-xl font-semibold text-blue-400">
                                            {analytics.totalGpuHours.toFixed(1)}h
                                        </p>
                                    </div>

                                    {/* Cost by Tier */}
                                    <div className="pt-2 space-y-2">
                                        {Object.entries(analytics.byTier).map(([tier, data]) => (
                                            <div key={tier} className="flex items-center justify-between text-sm">
                                                <span className="text-gray-400 capitalize">{tier}</span>
                                                <span className="text-gray-300">${data.cost.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Tier Distribution */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="p-6 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-white">User Tiers</h3>
                                    <TrendingUp className="w-5 h-5 text-purple-400" />
                                </div>

                                <div className="space-y-4">
                                    {Object.entries(analytics.overview.tierDistribution).map(([tier, count]) => {
                                        const total = Object.values(analytics.overview.tierDistribution).reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
                                        const colors: Record<string, string> = {
                                            free: 'from-orange-500 to-red-500',
                                            silver: 'from-gray-400 to-gray-600',
                                            gold: 'from-yellow-400 to-yellow-600'
                                        };

                                        return (
                                            <div key={tier}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-gray-300 capitalize">{tier}</span>
                                                    <span className="text-gray-400">{count} ({percentage}%)</span>
                                                </div>
                                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full bg-gradient-to-r ${colors[tier]}`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </div>

                        {/* Daily Activity Chart */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="p-6 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">Daily Activity</h3>
                                <BarChart3 className="w-5 h-5 text-blue-400" />
                            </div>

                            <div className="h-64 flex items-end gap-1">
                                {analytics.dailyData.slice(-14).map((day, i) => {
                                    const maxJobs = Math.max(...analytics.dailyData.map(d => d.jobs), 1);
                                    const height = (day.jobs / maxJobs) * 100;
                                    const failRate = day.jobs > 0 ? (day.failed / day.jobs) : 0;

                                    return (
                                        <div
                                            key={day.date}
                                            className="flex-1 flex flex-col items-center gap-2"
                                            title={`${day.date}: ${day.jobs} jobs`}
                                        >
                                            <div
                                                className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-blue-400 transition-all hover:from-blue-400 hover:to-blue-300"
                                                style={{
                                                    height: `${Math.max(height, 4)}%`,
                                                    opacity: 0.5 + (i / 28)
                                                }}
                                            />
                                            <span className="text-[10px] text-gray-500 rotate-45 origin-left">
                                                {day.date.slice(5)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </main>
        </div>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    color
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number;
    color: 'blue' | 'purple' | 'green' | 'orange';
}) {
    const colors: Record<'blue' | 'purple' | 'green' | 'orange', string> = {
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
        purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
        green: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
        orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400'
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-4 rounded-2xl bg-gradient-to-br ${colors[color]} border backdrop-blur-xl`}
        >
            <div className="flex items-center gap-3">
                <Icon className="w-6 h-6" />
                <div>
                    <p className="text-sm text-gray-400">{label}</p>
                    <p className="text-2xl font-bold text-white">{value}</p>
                </div>
            </div>
        </motion.div>
    );
}
