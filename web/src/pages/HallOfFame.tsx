import React, { useState, useEffect, useCallback } from 'react'
import { Crown, Plus, Search, Star, Trash2, AlertCircle, Pencil } from 'lucide-react'
import {
  hallOfFameService,
  type HallOfFameEntry,
} from '../services/hallOfFameService'
import { useCan } from '../services/permissions'
import { HallOfFameEntryForm } from '../components/halloffame/HallOfFameEntryForm'

const SOURCE_LABEL: Record<HallOfFameEntry['source']['type'], string> = {
  event: 'Event',
  challenge: 'Challenge',
  manual: 'Manual',
}

export const HallOfFame: React.FC = () => {
  const canDelete = useCan('hallOfFame.delete')

  const [entries, setEntries] = useState<HallOfFameEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Create / edit modal: `editing` null + open = create.
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<HallOfFameEntry | null>(null)

  const loadEntries = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const list = await hallOfFameService.getEntries({
        category: categoryFilter,
        search: searchTerm,
      })
      setEntries(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Hall of Fame')
    } finally {
      setIsLoading(false)
    }
  }, [categoryFilter, searchTerm])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const openCreate = () => {
    setEditing(null)
    setIsModalOpen(true)
  }

  const openEdit = (entry: HallOfFameEntry) => {
    setEditing(entry)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  const handleSaved = (saved: HallOfFameEntry) => {
    setEntries((prev) =>
      prev.some((item) => item.id === saved.id)
        ? prev.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...prev]
    )
    closeModal()
  }

  const handleToggleFeatured = async (entry: HallOfFameEntry) => {
    try {
      const updated = await hallOfFameService.updateEntry(entry.id, {
        featured: !entry.featured,
      })
      setEntries((prev) =>
        prev.map((item) => (item.id === entry.id ? updated : item))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update entry')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await hallOfFameService.deleteEntry(id)
      setEntries((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-black flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Hall of Fame
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Celebrate championship winners, endurance legends, and historic club milestones.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Induct Honoree
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search honoree or achievement title..."
            value={searchTerm}
            maxLength={64}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
        >
          <option value="all">All Categories</option>
          <option value="event_winner">Event Winners</option>
          <option value="challenge_legend">Challenge Legends</option>
          <option value="sponsor_champion">Sponsor Champions</option>
          <option value="custom">Custom Milestones</option>
        </select>
      </div>

      {error && (
        <div className="p-4 border border-black bg-white text-black rounded flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadEntries}
            className="px-3 py-1 border border-black rounded font-bold hover:bg-black hover:text-white cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
          Loading Hall of Fame inductees...
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded bg-white">
          No Hall of Fame entries found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="p-5 bg-white border border-gray-200 rounded flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-black rounded">
                    {entry.category.replace('_', ' ')} &bull; {entry.achievement.year}
                  </span>
                  {entry.featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-black text-white rounded">
                      <Star className="w-3 h-3" />
                      Featured
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-black">
                    {entry.honoree.displayName || 'Unknown honoree'}
                  </h3>
                  <p className="text-xs font-semibold text-gray-700">{entry.title}</p>
                </div>

                {entry.description && (
                  <p className="text-xs text-gray-600">{entry.description}</p>
                )}

                {entry.quote && (
                  <blockquote className="text-xs italic text-gray-500 border-l-2 border-black pl-2.5">
                    "{entry.quote}"
                  </blockquote>
                )}

                <p className="text-[11px] text-gray-500">
                  Source: {SOURCE_LABEL[entry.source.type]}
                  {entry.source.title ? ` — ${entry.source.title}` : ''}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-[11px] uppercase font-bold text-gray-500">
                  Domain: {entry.achievement.domain || '—'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleFeatured(entry)}
                    className="px-2.5 py-1 text-xs font-bold border border-gray-300 hover:border-black rounded cursor-pointer"
                  >
                    {entry.featured ? 'Unfeature' : 'Feature'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(entry)}
                    className="p-1.5 text-gray-600 hover:text-black border border-gray-200 rounded cursor-pointer"
                    title="Edit entry"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 border border-gray-200 rounded cursor-pointer"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <HallOfFameEntryForm
          key={editing?.id ?? 'new'}
          entry={editing}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

export default HallOfFame
