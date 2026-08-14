import type { Challenge } from '@/core/types';

/** Time-limit display (points spec §5.2 / §6.3): digital hides it pre-accept. */
export function fmtTimeLimit(c: Challenge): string {
  if (c.mode === 'digital' && c.userState === 'not_accepted') return 'Revealed on accept';
  if (c.timeLimitDays == null) return 'No limit';
  return `${c.timeLimitDays} day${c.timeLimitDays === 1 ? '' : 's'}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
