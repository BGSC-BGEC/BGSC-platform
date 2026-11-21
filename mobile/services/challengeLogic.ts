import type { Challenge, Participation, Proof } from '../src/repositories/ChallengesRepository';

export const participationGroup = (status: Participation['status']): 'active' | 'completed' =>
  ['approved', 'expired', 'withdrawn'].includes(status) ? 'completed' : 'active';

export function canSubmit(participation: Participation, now = Date.now()): boolean {
  return ['accepted', 'submitted', 'under_review', 'rejected'].includes(participation.status)
    && (!participation.deadline_at || Date.parse(participation.deadline_at) >= now);
}

export function proofError(proofs: Proof[], challenge: Challenge): string | null {
  if (!proofs.length || proofs.length > challenge.submission.max_files) return 'Add proof within the challenge’s file limit.';
  for (const proof of proofs) {
    if (!challenge.submission.proof_types.includes(proof.type)) return 'That proof type is not accepted for this challenge.';
    if (!proof.value.trim() || proof.value.trim().length > 5000) return 'Each proof needs between 1 and 5,000 characters.';
    if (proof.type === 'url') {
      try {
        const url = new URL(proof.value.trim());
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return 'Enter a complete http or https link.';
      } catch { return 'Enter a complete http or https link.'; }
    }
  }
  return null;
}

// Local provider is opt-in. Match its exact origin and OAuth path before opening a browser.
const demoStravaBase = process.env.EXPO_PUBLIC_FAKE_STRAVA_ORIGIN?.replace(/\/+$/, '');
export function isStravaAuthorizeUrl(value: string): boolean {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/oauth/authorize') return false;
  return ['https://www.strava.com', 'https://strava.com'].includes(url.origin)
    || (!!demoStravaBase && ['http:', 'https:'].includes(url.protocol) && url.origin === demoStravaBase);
}

export function stravaActivityUrl(id: string): string | undefined {
  const base = id.startsWith('demo-') ? demoStravaBase : 'https://www.strava.com';
  return base ? `${base}/activities/${encodeURIComponent(id)}` : undefined;
}

/** OAuth credentials arrive in the fragment so browsers do not send them as referrers. */
export function stravaCallback(url: string): { code: string; state: string; scope: string } | { error: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '/settings/integrations' && !(parsed.protocol === 'bgsc:' && parsed.hostname === 'settings' && parsed.pathname === '/integrations')) return null;
    const outcome = parsed.searchParams.get('strava');
    if (!outcome) return null;
    if (outcome !== 'authorized') return { error: outcome === 'denied' ? 'Strava connection cancelled.' : 'Strava authorization expired or failed. Please connect again.' };
    const fields = new URLSearchParams(parsed.hash.slice(1));
    const code = fields.get('code'); const state = fields.get('state'); const scope = fields.get('scope');
    return code && state && scope != null ? { code, state, scope } : { error: 'Strava returned an incomplete authorization. Please connect again.' };
  } catch { return null; }
}
