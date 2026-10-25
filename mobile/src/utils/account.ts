export function normalizePhone(value: string): string | null {
  const phone = value.replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function notificationTarget(data: Record<string, unknown>): { route: string; params?: Record<string, string> } {
  const owner = data.owner as { type?: unknown; id?: unknown } | undefined;
  if (typeof data.team_id === 'string' && owner?.type === 'event' && typeof owner.id === 'string') return { route: 'TeamJoin', params: { ref: owner.id } };
  if (typeof data.challenge_id === 'string') return { route: 'ChallengeDetail', params: { key: data.challenge_id } };
  if (typeof data.announcement_id === 'string') return { route: 'AnnouncementDetail', params: { id: data.announcement_id } };
  if (typeof data.event_id === 'string') return { route: 'EventDetails', params: { ref: data.event_id } };
  if (typeof data.transaction_id === 'string') return { route: 'Points' };
  if (typeof data.ticket_no === 'string') return { route: 'FeedbackSuccess', params: { ticket_no: data.ticket_no } };
  return { route: 'Settings' };
}
