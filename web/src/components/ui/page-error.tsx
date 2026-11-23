import React from 'react'
import { AlertCircle } from 'lucide-react'
import { isNotFoundError } from '../../lib/errors'

interface PageErrorProps {
  message: string
  onRetry?: () => void
}

/**
 * Page-level load error. "Not found" errors get a quiet, centred line instead of an alarm box —
 * they usually mean the section has no data or its endpoint isn't live yet, not that something broke.
 */
export const PageError: React.FC<PageErrorProps> = ({ message, onRetry }) => {
  if (isNotFoundError(message)) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Nothing to show here yet.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline cursor-pointer"
          >
            Try again
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 border border-rose-500/30 text-foreground bg-rose-500/5 rounded-xl flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1 text-xs border border-border hover:border-foreground rounded-lg transition-colors cursor-pointer shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  )
}
