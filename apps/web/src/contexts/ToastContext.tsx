import React, { createContext, useCallback, useContext, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  toast: (message: string, type?: ToastType, duration?: number) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const DEFAULT_DURATION = 4_000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration = DEFAULT_DURATION) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setToasts((prev) => [...prev, { id, message, type, duration }])
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration)
      }
    },
    [dismiss],
  )

  const toast = useCallback(
    (message: string, type?: ToastType, duration?: number) => {
      addToast(message, type ?? 'info', duration ?? DEFAULT_DURATION)
    },
    [addToast],
  )

  const success = useCallback(
    (message: string, duration?: number) => addToast(message, 'success', duration ?? DEFAULT_DURATION),
    [addToast],
  )

  const error = useCallback(
    (message: string, duration?: number) => addToast(message, 'error', duration ?? DEFAULT_DURATION * 1.5),
    [addToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, dismiss }}>
      {children}
      <ToastStack />
    </ToastContext.Provider>
  )
}

function ToastStack() {
  const { toasts, dismiss } = useContext(ToastContext)!
  if (toasts.length === 0) return null
  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none sm:left-auto sm:right-4 sm:max-w-sm"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg bg-zinc-900/95 backdrop-blur-sm transition-all toast-enter ${
            t.type === 'success'
              ? 'border-green-500/50'
              : t.type === 'error'
                ? 'border-red-500/50'
                : 'border-zinc-700'
          }`}
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <p
              className={`text-sm font-medium ${
                t.type === 'success'
                  ? 'text-green-400'
                  : t.type === 'error'
                    ? 'text-red-400'
                    : 'text-zinc-200'
              }`}
            >
              {t.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-1 text-zinc-500 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              aria-label="Dismiss"
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
