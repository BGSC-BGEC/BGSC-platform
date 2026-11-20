import React from 'react'
import type { AnnouncementDelivery, DeliveryStatus } from '../../types/announcement'

const CATEGORY_LABELS: Record<string, string> = {
  bgec: 'BGEC',
  fitsoc: 'FITSOC',
  airball: 'AIRBALL',
  offside: 'OFFSIDE',
  powerplay: 'POWERPLAY',
  around_the_net: 'AROUND THE NET',
  deuce: 'DEUCE',
  highlight: 'HIGHLIGHT',
  teams: 'TEAMS',
}

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  failed: 'Failed',
  rate_limited: 'Rate limited',
  skipped: 'Skipped',
  outcome_unknown: 'Outcome unknown',
}

function pillClass(status: DeliveryStatus): string {
  switch (status) {
    case 'sent':
      return 'border-green-600/30 text-green-700 bg-green-50'
    case 'failed':
    case 'outcome_unknown':
      return 'border-red-600/30 text-red-700 bg-red-50'
    case 'rate_limited':
      return 'border-yellow-600/30 text-yellow-800 bg-yellow-50'
    default:
      return 'border-gray-300 text-gray-600 bg-gray-100'
  }
}

export const DeliveryPill: React.FC<{ status: DeliveryStatus; label?: string; title?: string }> = ({
  status,
  label,
  title,
}) => (
  <span
    title={title}
    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${pillClass(status)}`}
  >
    {label ? `${label}: ` : ''}
    {STATUS_LABELS[status] ?? status}
  </span>
)

/**
 * Read-only view of the WhatsApp (per category) and push fan-out the Notification Service wrote
 * back. `compact` drops the row labels for table cells.
 */
export const DeliveryStatusSummary: React.FC<{
  delivery: AnnouncementDelivery | null | undefined
  compact?: boolean
}> = ({ delivery, compact }) => {
  if (!delivery) {
    return <span className="text-xs text-gray-500">No delivery data</span>
  }

  const { whatsapp, push } = delivery

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 w-20 shrink-0">
          WhatsApp
        </span>
        {!whatsapp.requested ? (
          <span className="text-xs text-gray-500">Not requested</span>
        ) : whatsapp.perCategory.length === 0 ? (
          <DeliveryPill status="pending" />
        ) : (
          whatsapp.perCategory.map((row) => (
            <DeliveryPill
              key={row.category}
              status={row.status}
              label={CATEGORY_LABELS[row.category] || row.category.toUpperCase()}
              title={[
                `Group ${row.groupId}`,
                row.attemptedAt ? `attempted ${new Date(row.attemptedAt).toLocaleString()}` : null,
                row.error ? `error: ${row.error}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))
        )}
      </div>
      {!compact &&
        whatsapp.perCategory
          .filter((row) => row.error)
          .map((row) => (
            <div key={`${row.category}-err`} className="text-[11px] text-red-600 pl-21.5">
              {CATEGORY_LABELS[row.category] || row.category}: {row.error}
            </div>
          ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 w-20 shrink-0">
          Push
        </span>
        {!push.requested ? (
          <span className="text-xs text-gray-500">Not requested</span>
        ) : (
          <>
            <DeliveryPill status={push.status} />
            {push.sentCount !== null && (
              <span className="text-xs text-gray-600">{push.sentCount} sent</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default DeliveryStatusSummary
