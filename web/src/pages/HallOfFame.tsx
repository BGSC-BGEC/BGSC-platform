import React, { useState, useEffect, useCallback } from 'react'
import { Crown, Plus, Search, Star, Trash2, AlertCircle } from 'lucide-react'
import {
  hallOfFameService,
  type HallOfFameEntry,
  type HofCategory,
} from '../services/hallOfFameService'
import { userService } from '../services/userService'
import type { User } from '../types/user'

export const HallOfFame: React.FC = () => {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Induct Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [honoreeId, setHonoreeId] = useState('')
  const [honoreeName, setHonoreeName] = useState('')
  const [category, setCategory] = useState<HofCategory>('event_winner')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [quote, setQuote] = useState('')
  const [domain, setDomain] = useState('sports')
  const [year, setYear] = useState(new Date().getFullYear())
  const [featured, setFeatured] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  useEffect(() => {
    userService
      .getUsers()
      .then((list) => setUsers(list))
      .catch(() => {})
  }, [])

  const handleUserPick = (userId: string) => {
    setSelectedUserId(userId)
    const found = users.find((u) => u.id === userId)
    if (found) {
      setHonoreeId(found.id)
      setHonoreeName(found.name || found.username)
    }
  }

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !honoreeName.trim()) return

    setIsSubmitting(true)
    setError(null)
    try {
      const fallbackUuid =
        honoreeId.trim() || '00000000-0000-4000-8000-000000000001'
      const created = await hallOfFameService.createEntry({
        category,
        title: title.trim(),
        description: description.trim(),
        quote: quote.trim(),
        honoreeId: fallbackUuid,
        honoreeName: honoreeName.trim(),
        domain,
        year,
        featured,
      })
      setEntries((prev) => [created, ...prev])
      setIsModalOpen(false)
      setTitle('')
      setDescription('')
      setQuote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to induct honoree')
    } finally {
      setIsSubmitting(false)
    }
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
          onClick={() => setIsModalOpen(true)}
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
                    {entry.category.replace('_', ' ')} &bull; {entry.year}
                  </span>
                  {entry.featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-black text-white rounded">
                      <Star className="w-3 h-3" />
                      Featured
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-black">{entry.honoreeName}</h3>
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
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-[11px] uppercase font-bold text-gray-500">
                  Domain: {entry.domain}
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
                    onClick={() => handleDelete(entry.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 border border-gray-200 rounded cursor-pointer"
                    title="Delete entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Induct Honoree Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-black">
                Induct into Hall of Fame
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
              >
                X
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-4 text-left">
              {users.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase text-black mb-1">
                    Select Club Member (Optional)
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => handleUserPick(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                  >
                    <option value="">-- Choose member or enter manually below --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} (@{u.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-black mb-1">
                    Honoree Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arjun Sharma"
                    value={honoreeName}
                    onChange={(e) => setHonoreeName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-black mb-1">
                    Honoree UUID
                  </label>
                  <input
                    type="text"
                    placeholder="User UUID"
                    value={honoreeId}
                    onChange={(e) => setHonoreeId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                  Achievement Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BGSC Badminton Smash S3 Champion"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-black mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as HofCategory)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                  >
                    <option value="event_winner">Event Winner</option>
                    <option value="challenge_legend">Challenge Legend</option>
                    <option value="sponsor_champion">Sponsor Champion</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-black mb-1">
                    Domain
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                  >
                    <option value="sports">Sports</option>
                    <option value="esports">Esports</option>
                    <option value="fitness">Fitness</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-black mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Story behind the championship or milestone..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                  Winner Quote (Optional)
                </label>
                <input
                  type="text"
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="Memorable quote..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold uppercase text-black cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                />
                <span>Feature on Club Hall of Fame Spotlight</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs border border-gray-300 rounded text-black cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold border border-black bg-black text-white rounded cursor-pointer"
                >
                  {isSubmitting ? 'Inducting...' : 'Induct Honoree'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default HallOfFame
