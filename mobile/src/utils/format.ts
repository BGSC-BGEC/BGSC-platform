import type { BadgeVariant } from '../components/Badge';
import type { ApiEvent, EventCategory, HallOfFameCategory, RegistrationStatus } from '../api/types';

const TZ = 'Asia/Kolkata';

export function formatDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ, ...opts });
  } catch {
    return new Date(iso).toDateString();
  }
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: TZ,
    });
  } catch {
    return new Date(iso).toString();
  }
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function formatNumber(value?: number | null): string {
  return (value ?? 0).toLocaleString('en-IN');
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  leagues: 'Leagues',
  bgec: 'BGEC',
  fitsoc: 'FitSoc',
  general: 'General',
};

export const EVENT_TYPE_LABELS: Record<ApiEvent['type'], string> = {
  LE: 'League',
  DE: 'Direct entry',
  ALL: 'Auction league',
  DLL: 'Dual league',
};

export const HOF_CATEGORY_LABELS: Record<HallOfFameCategory, string> = {
  event_winner: 'Event winners',
  challenge_legend: 'Challenge legends',
  sponsor_champion: 'Sponsor champions',
  custom: 'Special honours',
};

export interface StatusPill {
  label: string;
  variant: BadgeVariant;
  /** True when members can register right now */
  registrationOpen: boolean;
}

/** The backend has no "open" status — derive it from the registration window. */
export function eventStatusPill(event: ApiEvent, now = Date.now()): StatusPill {
  if (event.status === 'cancelled') return { label: 'Cancelled', variant: 'danger', registrationOpen: false };
  if (event.status === 'past') return { label: 'Completed', variant: 'muted', registrationOpen: false };
  if (event.status === 'draft') return { label: 'Draft', variant: 'muted', registrationOpen: false };

  const opens = event.registration?.opens_at ? new Date(event.registration.opens_at).getTime() : null;
  const closes = event.registration?.closes_at ? new Date(event.registration.closes_at).getTime() : null;
  const max = event.registration?.max_participants;
  const isFull = max != null && (event.counts?.registrations_confirmed ?? 0) >= max && !event.registration.waitlist_enabled;
  const windowOpen = (opens == null || opens <= now) && (closes == null || now < closes);

  if (event.status === 'ongoing') {
    return { label: 'Live', variant: 'success', registrationOpen: windowOpen && !isFull };
  }
  if (opens != null && now < opens) return { label: 'Soon', variant: 'warning', registrationOpen: false };
  if (!windowOpen) return { label: 'Closed', variant: 'muted', registrationOpen: false };
  if (isFull) return { label: 'Full', variant: 'warning', registrationOpen: false };
  return { label: 'Open', variant: 'success', registrationOpen: true };
}

export function capacityLabel(event: ApiEvent): string {
  const confirmed = event.counts?.registrations_confirmed ?? 0;
  const max = event.registration?.max_participants;
  const unit = event.teaming?.is_teamed ? 'teams' : 'participants';
  if (event.teaming?.is_teamed && event.teaming.max_teams) return `${event.teaming.max_teams} teams maximum`;
  if (max) return `${confirmed}/${max} ${unit}`;
  return `${confirmed} registered`;
}

export const REGISTRATION_STATUS: Record<RegistrationStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'muted' },
  submitted: { label: 'Pending approval', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  waitlisted: { label: 'Waitlisted', variant: 'warning' },
  rejected: { label: 'Rejected', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
};
