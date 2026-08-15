import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { AnnouncementRepository } from '../core/repositories/AnnouncementRepository'

export function AnnouncementsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('GENERAL')
  const [formError, setFormError] = useState<string | null>(null)

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => AnnouncementRepository.list({ page: 1, limit: 50 }),
  })

  const create = useMutation({
    mutationFn: () => AnnouncementRepository.create({ title, body, type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] })
      setTitle('')
      setBody('')
      setType('GENERAL')
      setShowForm(false)
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const del = useMutation({
    mutationFn: (id: string) => AnnouncementRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const announcements = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Announcements</h1>
          <p className="text-sm text-slate-400 mt-1">Live data from announcement service</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Announcement
        </button>
      </div>

      {showForm && (
        <div className="p-5 rounded-xl bg-slate-800 border border-slate-700 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">Create Announcement</h2>
          <input
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-500 resize-none"
            placeholder="Body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <select
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-teal-500"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {['GENERAL', 'BGEC', 'EVENT', 'URGENT'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => create.mutate()}
              disabled={!title || !body || create.isPending}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {create.isPending ? 'Publishing…' : 'Publish'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isPending && <p className="text-slate-400 text-sm">Loading…</p>}
      {isError && <p className="text-red-400 text-sm">Failed to load: {(error as Error).message}</p>}

      {!isPending && !isError && (
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Tags</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {announcements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No announcements yet.
                  </td>
                </tr>
              ) : (
                announcements.map((a) => (
                  <tr key={a.id} className="bg-slate-900 hover:bg-slate-800/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-100">{a.title}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-teal-900/50 text-teal-300 border border-teal-700/40">
                        {a.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {(a.tags ?? []).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => del.mutate(a.id)}
                        disabled={del.isPending}
                        className="p-1.5 rounded-lg hover:bg-red-900/30 text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
