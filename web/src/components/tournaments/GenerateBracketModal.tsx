import React, { useState } from 'react'
import { X, GitBranch, AlertTriangle, Loader2 } from 'lucide-react'
import type { Bracket, BracketSeeding } from '../../types/bracket'
import { bracketService } from '../../services/bracketService'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export interface GenerateBracketModalProps {
  eventId: string
  eventTitle: string
  isOpen: boolean
  onClose: () => void
  onBracketGenerated: (newBracket: Bracket) => void
}

const SEEDING_OPTIONS: {
  id: BracketSeeding
  title: string
  description: string
}[] = [
  {
    id: 'registration',
    title: 'Registration Order (Default)',
    description: 'Seeds are assigned strictly based on the order participants confirmed registration.',
  },
  {
    id: 'random',
    title: 'Randomized Draw',
    description: 'Shuffles all confirmed participants randomly into bracket match positions.',
  },
  {
    id: 'manual',
    title: 'Manual Seeding',
    description: 'Seeds are arranged according to official rankings or seeded roster order.',
  },
]

export const GenerateBracketModal: React.FC<GenerateBracketModalProps> = ({
  eventId,
  eventTitle,
  isOpen,
  onClose,
  onBracketGenerated,
}) => {
  const [seeding, setSeeding] = useState<BracketSeeding>('registration')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsGenerating(true)
    setError(null)

    try {
      const generated = await bracketService.generateBracket(eventId, seeding)
      onBracketGenerated(generated)
      onClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate tournament bracket'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Generate Tournament Draw
            </h2>
            <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-sm">
              Event: {eventTitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleGenerate} className="flex flex-col flex-1 overflow-hidden">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Error Alert */}
          {error && (
            <div className="p-3 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-2">
              Select Seeding Strategy
            </label>
            <div className="space-y-2.5">
              {SEEDING_OPTIONS.map((option) => {
                const isSelected = seeding === option.id
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'block p-3.5 border rounded-xl cursor-pointer transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/20 shadow-xs'
                        : 'border-border bg-card hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="seeding"
                        value={option.id}
                        checked={isSelected}
                        onChange={() => setSeeding(option.id)}
                        className="accent-primary"
                      />
                      <span className="text-xs font-bold text-foreground">
                        {option.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground pl-6 mt-1 leading-relaxed">
                      {option.description}
                    </p>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="p-3.5 border border-border bg-muted/20 rounded-xl text-xs text-muted-foreground leading-relaxed">
            Generating the bracket establishes official match fixtures. You will be able to report scores, schedule match times, and advance teams.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isGenerating}
            className="text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isGenerating}
            size="sm"
            className="text-xs font-semibold gap-1.5"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating Draw...
              </>
            ) : (
              'Generate Bracket'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default GenerateBracketModal
