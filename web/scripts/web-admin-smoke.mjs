// Web Admin contract smoke: replays the exact payloads web/src/services/* send, as a founder.
// Usage: node web-admin-smoke.mjs   (stack on :3000, bgsc_live)
const B = 'http://localhost:3000'
let token
const call = async (method, path, body) => {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const j = r.status === 204 ? null : await r.json().catch(() => null)
  const data = j && j.success === true && 'data' in j ? j.data : j
  const ok = r.ok
  console.log(`${ok ? 'PASS' : 'FAIL'} ${r.status} ${method} ${path}${ok ? '' : ' ' + JSON.stringify(j).slice(0, 300)}`)
  if (!ok) process.exitCode = 1
  return data
}
const iso = (d) => new Date(Date.now() + d * 864e5).toISOString()

const login = await call('POST', '/auth/login', { login: 'founder.tck0l@example.com', password: 'LivePass#2026x' })
token = login.tokens.access_token
// refresh flow used by apiClient on 401
const ref = await call('POST', '/auth/refresh', { refresh_token: login.tokens.refresh_token })
token = (ref.tokens || ref).access_token || token

// Dashboard / users / leaderboard
const users = await call('GET', '/users')
await call('GET', '/leaderboards/global?period=all&domain=all')
const events = await call('GET', '/events')
console.log('  events:', (events.events || events).length, 'users:', (users.users || users).length)

// Events Part 2 — create (eventService.createEvent body)
const ev = await call('POST', '/events', {
  title: `Web Admin Demo Cup ${Date.now() % 10000}`, description: '', category: 'leagues', type: 'LE', domain: 'sports',
  status: 'draft', start_at: iso(7), end_at: iso(8), venue: 'Main Court',
  registration: { closes_at: iso(6), max_participants: 16, waitlist_enabled: true, requires_approval: true },
  teaming: { is_teamed: false }, auction: null,
})
const evId = ev._id || ev.id
// Form builder (registrationService → toBackendFields shape)
const form = await call('POST', '/forms', {
  owner: { type: 'event', id: evId }, title: 'Demo Registration',
  fields: [
    { key: 'skill', label: 'Skill level', type: 'select', required: true, placeholder: null, options: [{ value: 'Beginner', label: 'Beginner' }, { value: 'Pro', label: 'Pro' }], order: 0 },
    { key: 'phone', label: 'Phone', type: 'phone', required: false, placeholder: null, options: null, order: 1 },
  ],
})
const formId = form._id || form.id
await call('PATCH', `/forms/${formId}`, { title: 'Demo Registration v2' })
await call('POST', `/forms/${formId}/publish`)
await call('GET', `/forms?owner_type=event&owner_id=${evId}`)
await call('PATCH', `/events/${evId}`, { registration: { closes_at: iso(6), form_id: formId }, status: 'upcoming' })
await call('GET', `/registrations?owner_id=${evId}`)
await call('GET', `/events/${evId}/attendance`)
await call('PATCH', `/events/${evId}`, { status: 'cancelled' })

// Draft delete
const draft = await call('POST', '/events', {
  title: 'Web Admin Draft', category: 'general', type: 'LE', domain: 'general', status: 'draft',
  start_at: iso(10), end_at: iso(11), venue: null, registration: { closes_at: iso(9) }, teaming: { is_teamed: false }, auction: null,
})
await call('DELETE', `/events/${draft._id || draft.id}`)

// Challenges (challengeService.createChallenge body)
const ch = await call('POST', '/challenges', {
  title: 'Web Admin 5K', description: 'Run 5K and post your Strava link.', domain: 'sports', kind: 'physical',
  difficulty: 'medium', award_points: 50, grants_hall_of_fame: false,
  location: { name: 'Campus Ground / Track', details: null },
  submission: { requires_proof: true, proof_types: ['text', 'url'], auto_approve: false },
})
const chId = ch._id || ch.id
await call('GET', '/challenges?status=draft')
await call('POST', `/challenges/${chId}/activate`)
await call('GET', `/challenges/${chId}/participations?status=under_review`)
await call('POST', `/challenges/${chId}/complete`)
await call('POST', `/challenges/${chId}/archive`)
await call('DELETE', `/challenges/${chId}`)

// Hall of Fame (hallOfFameService.createEntry body)
const honoree = (users.users || users)[0]
const hof = await call('POST', '/hall-of-fame', {
  category: 'custom', title: `Web Admin Inductee ${Date.now() % 10000}`, description: null, quote: null,
  honoree: { type: 'user', id: honoree._id || honoree.id, display_name: honoree.username },
  source: { type: 'manual', title: 'Club Induction' },
  achievement: { domain: 'sports', year: 2026, season: '2026', award_points: 0 }, featured: false,
})
await call('GET', '/hall-of-fame')
await call('PATCH', `/hall-of-fame/${hof._id || hof.id}`, { featured: true })
await call('DELETE', `/hall-of-fame/${hof._id || hof.id}`)

// Auction console on live auction event
const aucEvent = await call('POST', '/events', {
  title: `Web Admin Auction League ${Date.now() % 10000}`, category: 'leagues', type: 'ALL', domain: 'sports',
  status: 'draft', start_at: iso(14), end_at: iso(15), venue: 'Main Arena',
  registration: { closes_at: iso(13), max_participants: 32 },
  teaming: { is_teamed: true, team_size_min: 2, team_size_max: 5, max_teams: 8 },
  auction: { k_multiplier: 1.0, min_bid_increment: 100, bid_timer_seconds: 15, purse_per_team: 10000 },
})
const aucId = aucEvent._id || aucEvent.id
await call('GET', `/events/${aucId}/auction/live`)
await call('GET', `/events/${aucId}/auction/lots`)
await call('PATCH', `/auction/events/${aucId}/config`, { min_bid_increment: 200, bid_timer_seconds: 20 })
await call('DELETE', `/events/${aucId}`)
// Existing Phase-1 pages
await call('GET', '/announcements')
await call('GET', '/media')
await call('GET', '/feedback')
console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE OK')
