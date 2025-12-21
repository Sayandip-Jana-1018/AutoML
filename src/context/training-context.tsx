"use client"

import * as React from "react"

export interface ActiveJob {
    id: string
    projectId: string
    status: string
    phase?: string
    progress?: number
    vmName?: string
    consoleUrl?: string
    createdAt?: Date
    logs?: string[]
    error?: string
    startTime?: number
    estimatedMinutes?: number
}

interface TrainingContextType {
    // Active job state
    activeJob: ActiveJob | null
    setActiveJob: (job: ActiveJob | null) => void

    // Overlay visibility
    showOverlay: boolean
    setShowOverlay: (show: boolean) => void

    // Capsule collapsed state
    isCollapsed: boolean
    setIsCollapsed: (collapsed: boolean) => void

    // Training step tracking
    currentStep: string
    setCurrentStep: (step: string) => void

    // Time tracking (for timer persistence)
    startTime: number | undefined
    setStartTime: (time: number | undefined) => void
    estimatedMinutes: number
    setEstimatedMinutes: (minutes: number) => void

    // Utility methods
    startTraining: (job: ActiveJob) => void
    completeTraining: () => void
    failTraining: (error: string) => void
}

const TrainingContext = React.createContext<TrainingContextType | undefined>(undefined)

const STORAGE_KEY = 'mlforge_active_training'

export function TrainingProvider({ children }: { children: React.ReactNode }) {
    const [activeJob, setActiveJobState] = React.useState<ActiveJob | null>(null)
    const [showOverlay, setShowOverlay] = React.useState(false)
    const [isCollapsed, setIsCollapsed] = React.useState(false)
    const [currentStep, setCurrentStep] = React.useState<string>('preparing')
    const [startTime, setStartTime] = React.useState<number | undefined>(undefined)
    const [estimatedMinutes, setEstimatedMinutes] = React.useState<number>(0)

    // Load from sessionStorage on mount
    React.useEffect(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY)
            if (stored) {
                const data = JSON.parse(stored)
                if (data.activeJob && data.activeJob.status !== 'completed' && data.activeJob.status !== 'failed') {
                    setActiveJobState(data.activeJob)
                    setShowOverlay(true)
                    setIsCollapsed(data.isCollapsed ?? false)
                    setCurrentStep(data.currentStep ?? 'preparing')
                    setStartTime(data.startTime)
                    setEstimatedMinutes(data.estimatedMinutes ?? 0)
                }
            }
        } catch (e) {
            console.error('[TrainingContext] Failed to load from storage:', e)
        }
    }, [])

    // Persist to sessionStorage on changes
    React.useEffect(() => {
        if (activeJob) {
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                    activeJob,
                    isCollapsed,
                    currentStep,
                    startTime,
                    estimatedMinutes
                }))
            } catch (e) {
                console.error('[TrainingContext] Failed to save to storage:', e)
            }
        } else {
            sessionStorage.removeItem(STORAGE_KEY)
        }
    }, [activeJob, isCollapsed, currentStep, startTime, estimatedMinutes])

    // Set active job
    const setActiveJob = React.useCallback((job: ActiveJob | null) => {
        setActiveJobState(job)
        if (job) {
            setShowOverlay(true)
        }
    }, [])

    // Start training
    const startTraining = React.useCallback((job: ActiveJob) => {
        setActiveJobState(job)
        setShowOverlay(true)
        setIsCollapsed(false)
        setCurrentStep('preparing')
    }, [])

    // Complete training
    const completeTraining = React.useCallback(() => {
        setActiveJobState(prev => prev ? { ...prev, status: 'completed' } : null)
        setShowOverlay(false)
        setIsCollapsed(false)
        sessionStorage.removeItem(STORAGE_KEY)
    }, [])

    // Fail training
    const failTraining = React.useCallback((error: string) => {
        setActiveJobState(prev => prev ? { ...prev, status: 'failed', error } : null)
        setCurrentStep('failed')
    }, [])

    const value = React.useMemo(() => ({
        activeJob,
        setActiveJob,
        showOverlay,
        setShowOverlay,
        isCollapsed,
        setIsCollapsed,
        currentStep,
        setCurrentStep,
        startTime,
        setStartTime,
        estimatedMinutes,
        setEstimatedMinutes,
        startTraining,
        completeTraining,
        failTraining
    }), [
        activeJob, setActiveJob, showOverlay, isCollapsed, currentStep,
        startTime, estimatedMinutes, startTraining, completeTraining, failTraining
    ])

    return (
        <TrainingContext.Provider value={value}>
            {children}
        </TrainingContext.Provider>
    )
}

export function useTraining() {
    const context = React.useContext(TrainingContext)
    if (context === undefined) {
        throw new Error("useTraining must be used within a TrainingProvider")
    }
    return context
}

export default TrainingContext
