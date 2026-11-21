/**
 * The announcement service answers with error codes (`{ error: 'pinned_until_after_expiry' }`),
 * which apiClient surfaces as the Error message. Codes this console can trigger get readable text;
 * anything else is shown as-is.
 */
const MESSAGES: Record<string, string> = {
  pinned_until_after_expiry:
    'The pin end date is after the announcement expires (4 months after publishing). Choose an earlier date.',
  scheduled_for_must_be_future: 'The scheduled time must be in the future.',
  min_role_above_own_rank: 'You cannot target a minimum role above your own.',
  event_not_found: 'The selected event no longer exists.',
  already_published: 'This announcement has already been published.',
  not_scheduled: 'This announcement is no longer scheduled.',
  not_author_or_senior: 'Only the author, or someone who outranks the author, can change this announcement.',
  announcement_not_found: 'Announcement not found (it may have been deleted).',
  not_published: 'Statistics are only available for published announcements.',
  validation_failed: 'Some fields are invalid. Check the form and try again.',
  forbidden: 'You do not have permission to do this.',
}

export function describeAnnouncementError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : ''
  if (!raw) return fallback
  return MESSAGES[raw] ?? raw
}
