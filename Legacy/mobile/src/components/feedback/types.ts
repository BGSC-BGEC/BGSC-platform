import type {
  FeedbackAttachment,
  FeedbackCategory,
  FeedbackSeverity,
} from '@/core/repositories/FeedbackRepository';

/** 0 = Submit Ticket · 1 = FAQ · 2 = Directory (spec §2.2). */
export type FeedbackTabKey = 0 | 1 | 2;

export interface FeedbackFormState {
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  description: string;
  attachments: FeedbackAttachment[];
  anonymous: boolean;
  contactEmail: string;
}

export const initialFeedbackForm: FeedbackFormState = {
  category: 'bug',
  severity: 'low',
  description: '',
  attachments: [],
  anonymous: false,
  contactEmail: '',
};

export const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'complaint', label: 'Event Complaint' },
  { value: 'general', label: 'General' },
];

export const CATEGORY_LABEL: Record<FeedbackCategory, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<FeedbackCategory, string>;

/** Short pill labels per spec §3.2 wireframe. */
export const SEVERITY_OPTIONS: { value: FeedbackSeverity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Crit' },
];

/** Standard email regex per spec §3.2. */
export const EMAIL_RE = /^.+@.+\..+$/;

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_DESCRIPTION = 2000;
export const MIN_DESCRIPTION = 10;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
