const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, imports = {}) {
  const filename = path.join(__dirname, '..', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}

async function main() {
  const rules = load('src/repositories/investmentRules.ts');
  assert.equal(rules.investmentLimit(200, 20, 100), 80);
  assert.equal(rules.investmentLimit(5, 0, null), 5);
  assert.equal(rules.investmentLimit(200, 120, 100), 0);
  assert.equal(rules.investmentLimit(200000, 20, null), 100000);
  assert.equal(rules.investmentLimit(100, 90.5, 100), 9);
  for (const value of ['', '9', '-10', '1e2', '10.5', ' 10', '101', 'Infinity']) assert.equal(rules.validInvestment(value, 100), false, value);
  for (const value of ['10', '50', '100']) assert.equal(rules.validInvestment(value, 100), true, value);
  for (let i = 0; i < 20; i++) assert.match(rules.investmentRequestId(), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);

  const storage = new Map();
  const calls = [];
  let storageFails = false;
  const imports = {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-secure-store': {
      getItemAsync: async key => storage.get(key) ?? null,
      setItemAsync: async (key, value) => { if (storageFails) throw new Error('Keychain unavailable'); storage.set(key, value); },
      deleteItemAsync: async key => storage.delete(key),
    },
    '../api/client': { api: { post: async (url, body) => { calls.push({ url, body }); return {}; }, get: async (url, options) => { calls.push({ url, options }); return {}; } } },
    './investmentRules': rules,
  };
  const { investmentRepository: repo } = load('src/repositories/InvestmentRepository.ts', imports);
  const initial = await repo.prepare('member', 'event', 50);
  const retry = await repo.prepare('member', 'event', 100);
  assert.deepEqual(retry, initial, 'An uncertain retry keeps both original amount and request id');
  const restarted = load('src/repositories/InvestmentRepository.ts', imports).investmentRepository;
  assert.deepEqual(await restarted.pending('member', 'event'), initial, 'Pending request survives app restart');
  assert.equal(await restarted.pending('another-member', 'event'), null, 'Pending requests never cross accounts');
  assert.equal(await restarted.pending('member', 'another-event'), null, 'Pending requests never cross events');
  await repo.invest('event/with space', retry);
  assert.equal(calls[0].url, '/leaderboards/events/event%2Fwith%20space/invest');
  assert.deepEqual(calls[0].body, initial);
  await repo.project('event', 50);
  assert.deepEqual(calls[1].options, { params: { amount: 50 } });
  await repo.clear('member', 'event');
  assert.equal(await repo.pending('member', 'event'), null);
  storageFails = true;
  await assert.rejects(() => repo.prepare('member', 'event', 50), /Keychain unavailable/, 'Do not create an unpersisted spending request');
  storageFails = false;
  await assert.rejects(() => repo.prepare('member', 'event', 1), /whole number/);
  storage.set('bgsc.investment.member.event', JSON.stringify({ amount: -1, request_id: initial.request_id }));
  await assert.rejects(() => repo.pending('member', 'event'), /saved investment/, 'Invalid saved requests must not be replayed');
  console.log('Standings self-check passed: limits, validation, durable idempotency, account isolation, API encoding, storage failures.');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
