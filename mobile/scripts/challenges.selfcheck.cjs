const assert = require('node:assert/strict');
process.env.EXPO_PUBLIC_FAKE_STRAVA_ORIGIN = 'http://localhost:3100';
const { isStravaAuthorizeUrl, stravaActivityUrl, canSubmit, participationGroup, proofError, stravaCallback } = require('../services/challengeLogic.ts');

const now = Date.parse('2026-10-24T12:00:00Z');
for (const status of ['accepted', 'submitted', 'under_review', 'rejected']) {
  assert.equal(canSubmit({ status, deadline_at: null }, now), true);
  assert.equal(participationGroup(status), 'active');
}
for (const status of ['approved', 'withdrawn', 'expired']) {
  assert.equal(canSubmit({ status, deadline_at: null }, now), false);
  assert.equal(participationGroup(status), 'completed');
}
assert.equal(canSubmit({ status: 'accepted', deadline_at: '2026-10-24T11:59:59Z' }, now), false);
assert.equal(canSubmit({ status: 'rejected', deadline_at: '2026-10-24T12:00:00Z' }, now), true);
const challenge = { submission: { max_files: 2, proof_types: ['url', 'text'] } };
assert.equal(proofError([{ type: 'text', value: ' A detailed explanation ' }], challenge), null);
assert.equal(proofError([{ type: 'url', value: 'https://www.strava.com/activities/123' }], challenge), null);
for (const value of ['', '   ', 'javascript:alert(1)', 'file:///private', 'http://', 'not a url']) {
  assert.ok(proofError([{ type: 'url', value }], challenge), value);
}
assert.ok(proofError([{ type: 'image', value: 'https://example.com/image.jpg' }], challenge));
assert.ok(proofError([], challenge));
assert.ok(proofError(Array(3).fill({ type: 'text', value: 'proof' }), challenge));
assert.ok(proofError([{ type: 'text', value: 'x'.repeat(5001) }], challenge));
const expected = { code: 'one', state: 'signed-state', scope: 'read,activity:read_all' };
for (const base of ['bgsc:///settings/integrations', 'bgsc://settings/integrations', 'https://bgsc.example/settings/integrations']) {
  assert.deepEqual(stravaCallback(`${base}?strava=authorized#code=one&state=signed-state&scope=read%2Cactivity%3Aread_all`), expected);
}
assert.equal(stravaCallback('https://bgsc.example/events?strava=authorized#code=one&state=signed-state&scope=read'), null);
assert.equal(stravaCallback('https://bgsc.example/evilsettings/integrations?strava=authorized#code=one&state=signed-state&scope=read'), null);
assert.equal(stravaCallback('not a URL'), null);
assert.equal(stravaCallback('bgsc://settings/integrations'), null);
assert.match(stravaCallback('bgsc://settings/integrations?strava=denied').error, /cancelled/);
assert.match(stravaCallback('bgsc://settings/integrations?strava=authorized&code=secret&state=secret&scope=read').error, /incomplete/);
assert.match(stravaCallback('bgsc://settings/integrations?strava=invalid_oauth_state').error, /expired or failed/);
console.log('Slice E selfcheck passed: participation states, deadlines, proof validation and OAuth fragment parsing.');

assert.equal(isStravaAuthorizeUrl('http://localhost:3100/oauth/authorize?state=test'), true);
assert.equal(isStravaAuthorizeUrl('https://www.strava.com/oauth/authorize'), true);
assert.equal(isStravaAuthorizeUrl('http://localhost:3101/oauth/authorize'), false);
assert.equal(isStravaAuthorizeUrl('http://localhost:3100/other'), false);
assert.equal(stravaActivityUrl('demo-1-run'), 'http://localhost:3100/activities/demo-1-run');
assert.equal(stravaActivityUrl('123'), 'https://www.strava.com/activities/123');
