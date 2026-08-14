import { EventTable } from '../components/EventTable'

export function Events() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Events</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing placeholder data — wired to the live Event Service in
          Milestone 1.2.
        </p>
      </div>
      <EventTable />
    </div>
  )
}
