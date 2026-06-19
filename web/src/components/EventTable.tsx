import { useQuery } from '@tanstack/react-query'
import { EventRepository } from '../core/repositories/EventRepository'
import type { EventStatus } from '../core/types'

const STATUS_STYLES: Record<EventStatus, string> = {
  upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ongoing: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  past: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

export function EventTable() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['events'],
    queryFn: () => EventRepository.list(),
  })

  if (isPending) {
    return <p className="text-slate-500 dark:text-slate-400">Loading events…</p>
  }

  if (isError) {
    return (
      <p className="text-red-600 dark:text-red-400">
        Failed to load events: {(error as Error).message}
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            <th className="px-4 py-2 font-medium">Title</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Dates</th>
            <th className="px-4 py-2 font-medium">Venue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {data.map((evt) => (
            <tr key={evt.id} className="bg-white dark:bg-slate-900">
              <td className="px-4 py-2 font-medium">{evt.title}</td>
              <td className="px-4 py-2">{evt.type}</td>
              <td className="px-4 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[evt.status]}`}
                >
                  {evt.status}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                {evt.startDate} → {evt.endDate}
              </td>
              <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                {evt.venue ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
