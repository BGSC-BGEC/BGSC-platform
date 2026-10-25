const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, module, module.exports);
  return module.exports;
}
async function main() {
  const { normalizePhone, notificationTarget } = load('src/utils/account.ts');
  assert.equal(normalizePhone('(+91) 98765-43210'), '+919876543210');
  for (const phone of ['9876543210', '+0000000000', '++919876543210', '+91bad', '+1234567890123456', '']) assert.equal(normalizePhone(phone), null);
  assert.deepEqual(notificationTarget({ owner: { type: 'event', id: 'cup' }, team_id: 'team' }), { route: 'TeamJoin', params: { ref: 'cup' } });
  assert.deepEqual(notificationTarget({ challenge_id: 'challenge' }), { route: 'ChallengeDetail', params: { key: 'challenge' } });
  assert.deepEqual(notificationTarget({ transaction_id: 'tx' }), { route: 'Points' });
  assert.deepEqual(notificationTarget({ event_id: 'event', url: 'javascript:bad' }), { route: 'EventDetails', params: { ref: 'event' } });
  assert.deepEqual(notificationTarget({ url: 'https://untrusted.test' }), { route: 'Settings' });
  const calls = [];
  const api = Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method, async (...args) => { calls.push([method, ...args]); return {}; }]));
  const { usersRepository: users } = load('src/repositories/UsersRepository.ts', { '../api/client': { api, http: { post: async () => ({ data: {} }) } } });
  await users.card('user/name');
  await users.delete({ confirm: 'DELETE', research_consent: false });
  await users.verifyPhoneOtp('+919876543210', '123456');
  assert.equal(calls[0][1], '/users/user%2Fname/player-card');
  assert.deepEqual(calls[1], ['delete', '/users/me', { data: { confirm: 'DELETE', research_consent: false } }]);
  assert.deepEqual(calls[2][2], { phone_number: '+919876543210', otp: '123456' });
  const { notificationsRepository: inbox } = load('src/repositories/NotificationsRepository.ts', { '../api/client': { api: { ...api, post: async () => { throw new Error('write failed'); } } }, '../api/tokenStorage': { tokenStorage: { get: async () => ({ accessToken: 'test' }) } } });
  await assert.rejects(() => inbox.markAllAsRead(), /write failed/, 'failed writes must be visible');
  await assert.rejects(() => inbox.markAsRead('item'), /write failed/);
  console.log('Account self-check passed: phone validation, safe notification targets, deletion consent, OTP payloads, propagated write failures.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
