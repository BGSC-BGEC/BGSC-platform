import React, { useState, useEffect } from 'react'
import type { Bracket, BracketSeeding } from '../../types/bracket'
import { bracketService } from '../../services/bracketService'

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
              Generate Tournament Draw
            </h2>
            <p className="text-xs text-gray-600 mt-0.5 truncate max-w-sm">
              Event: {eventTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
          >
            X
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">
              Select Seeding Strategy
            </label>
            <div className="space-y-2">
              {SEEDING_OPTIONS.map((option) => {
                const isSelected = seeding === option.id
                return (
                  <label
                    key={option.id}
                    className={`block p-3 border rounded cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-black bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="seeding"
                        value={option.id}
                        checked={isSelected}
                        onChange={() => setSeeding(option.id)}
                        className="accent-black"
                      />
                      <span className="text-xs font-bold text-black">
                        {option.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 pl-5 mt-1 leading-relaxed">
                      {option.description}
                    </p>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="p-3 border border-gray-200 bg-gray-50 rounded text-xs text-gray-700">
            Generating the bracket establishes official match fixtures. You will be able to report scores, schedule match times, and advance teams.
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-xs border border-gray-300 text-black hover:bg-gray-100 rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? 'Generating Draw...' : 'Generate Bracket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default GenerateBracketModal
