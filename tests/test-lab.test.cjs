const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

function loadListener(file, start, end, overrides = {}) {
  const source = readFileSync(resolve(__dirname, '../src', file), 'utf8');
  let listener;
  const context = {
    __DEV__: true,
    browser: { runtime: { onMessage: { addListener(value) { listener = value; } } } },
    Promise,
    ...overrides,
  };
  vm.runInNewContext(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), context);
  return listener;
}

function youtubeListener(overrides) {
  return loadListener('content.js', '  browser.runtime.onMessage.addListener', '\n  function checkBlocking', {
    mascotController: null,
    ...overrides,
  });
}

function productivityListener(overrides) {
  return loadListener('productivity-content.js', '  browser.runtime.onMessage.addListener', '\n  // Initialize banner container', overrides);
}

test('YouTube listener leaves productivity messages unanswered', () => {
  assert.equal(youtubeListener()({ action: 'showBanner' }), undefined,
    'An unrelated receiver must not win the response race');
});

test('Productivity listener leaves YouTube messages unanswered', () => {
  assert.equal(productivityListener()({ action: 'testTriggerMascot' }), undefined,
    'Only the receiver performing the action may acknowledge it');
});

test('Production YouTube listener does not execute developer commands', async () => {
  let displayed = false;
  const listener = youtubeListener({ __DEV__: false, showBlock() { displayed = true; } });
  assert.equal(listener({ action: 'testShowHardBlock' }), undefined);
  assert.equal(displayed, false, 'Production must not expose the test hard-lock handler');
});

test('Disabled mascot reports a skipped preview rather than success', async () => {
  const response = await youtubeListener()({ action: 'testTriggerMascot' });
  assert.equal(response.ok, false);
  assert.equal(response.status, 'skipped');
  assert.match(response.message, /mascot/i);
});

test('Productivity preview waits for rendering and propagates failures', async () => {
  const listener = productivityListener({
    showBlockOverlay: async () => { throw new Error('Storage unavailable'); },
  });
  const response = await listener({ action: 'testPreviewBlocker' });
  assert.equal(response.ok, false);
  assert.match(response.message, /Storage unavailable/);
});

test('Production productivity listener ignores developer previews', () => {
  assert.equal(productivityListener({ __DEV__: false })({ action: 'testPreviewBlocker' }), undefined);
});

const clientModule = import(`data:text/javascript;base64,${Buffer.from(readFileSync(resolve(__dirname, '../src/modules/test-lab-client.js'))).toString('base64')}`);

for (const [url, supported, youtube] of [
  ['https://www.youtube.com/watch?v=test', true, true],
  ['https://m.youtube.com/', true, true],
  ['https://youtube.com/', true, true],
  ['https://youtube.com.example.org/', true, false],
  ['https://example.org/?youtube.com', true, false],
  ['chrome://extensions', false, false],
  ['about:blank', false, false],
  [undefined, false, false],
]) {
  test(`Active-target detection: ${url}`, async () => {
    const { getTestTarget } = await clientModule;
    const queries = [];
    const target = await getTestTarget({ tabs: { async query(query) { queries.push(query); return [{ id: 9, url }]; } } });
    assert.equal(target.supported, supported);
    assert.equal(target.youtube, youtube);
    assert.deepEqual(queries, [{ active: true, currentWindow: true }], 'Must never silently search other tabs');
  });
}

test('Command transport requires an explicit acknowledgement and never falls back', async () => {
  const { sendTestCommand } = await clientModule;
  let runtimeCalls = 0;
  const api = { tabs: { async sendMessage() { return undefined; } }, runtime: { async sendMessage() { runtimeCalls++; } } };
  await assert.rejects(sendTestCommand(api, { action: 'testPreviewBanner' }, 9), /did not acknowledge.*Refresh/);
  assert.equal(runtimeCalls, 0, 'A failed tab action must not claim success through the background');
  api.tabs.sendMessage = async () => { throw new Error('No receiver'); };
  await assert.rejects(sendTestCommand(api, {}, 9), /No receiver.*Refresh/);
});

test('Old catch-all receivers cannot pass connectivity checks or preview actions', async () => {
  const { sendTestCommand } = await clientModule;
  const api = { tabs: { sendMessage: async () => ({ ok: true }) } };
  await assert.rejects(sendTestCommand(api, { action: 'testPageStatus' }, 9), /older Test Lab receiver/);
  await assert.rejects(sendTestCommand(api, { action: 'testPreviewBanner' }, 9), /older Test Lab receiver/);
  api.tabs.sendMessage = async () => ({ ok: true, protocolVersion: 1 });
  assert.equal((await sendTestCommand(api, { action: 'testPageStatus' }, 9)).ok, true);
});

test('Command transport preserves skipped results and supports background commands', async () => {
  const { sendTestCommand } = await clientModule;
  const skipped = { ok: false, status: 'skipped', message: 'Mascot disabled' };
  assert.equal(await sendTestCommand({ tabs: { sendMessage: async () => skipped } }, {}, 9), skipped);
  const saved = { ok: true, status: 'saved', message: 'Saved' };
  assert.equal(await sendTestCommand({ runtime: { sendMessage: async () => saved } }, {}), saved);
});

test('Command timeout reports an uncertain result rather than success', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { sendTestCommand, TEST_COMMAND_TIMEOUT_MS } = await clientModule;
  const pending = sendTestCommand({ tabs: { sendMessage: () => new Promise(() => {}) } }, {}, 9);
  const rejected = assert.rejects(pending, /Timed out.*Check the current state before retrying/);
  context.mock.timers.tick(TEST_COMMAND_TIMEOUT_MS);
  await rejected;
});

function backgroundHarness(development = true) {
  const today = new Date().toDateString();
  const data = { lastUpdateDate: today, remainingTime: 600000, dailyWatchStats: { yesterday: 42 }, hourlyRate: 500 };
  const writes = [];
  let listener;
  let failWrite = false;
  const event = { addListener() {} };
  const context = {
    __DEV__: development, FEATURES: {}, console: { log() {}, error() {} },
    MAX_DAILY_OVERRIDES: 3, Promise, Date,
    browser: {
      tabs: { onUpdated: event, query: async () => [], sendMessage: async () => {} },
      alarms: { onAlarm: event },
      runtime: { onMessage: { addListener(value) { listener = value; } }, sendMessage: async () => {} },
      storage: { local: {
        async get(keys) {
          const names = typeof keys === 'string' ? [keys] : keys;
          return structuredClone(Object.fromEntries(names.map(key => [key, data[key]])));
        },
        async set(values) {
          if (failWrite) throw new Error('Storage write failed');
          writes.push(structuredClone(values));
          Object.assign(data, structuredClone(values));
        },
      } },
    },
  };
  const source = readFileSync(resolve(__dirname, '../src/background.js'), 'utf8').replace(/^import .*;\n/gm, '');
  const sandbox = vm.createContext(context);
  const blockerSource = readFileSync(resolve(__dirname, '../src/modules/url-blocker.js'), 'utf8').replace(/^export /gm, '');
  vm.runInContext(blockerSource, sandbox);
  vm.runInContext(source, sandbox);
  return {
    data, writes, today, listener,
    failWrites() { failWrite = true; },
    send(message) { return new Promise(resolve => listener(message, {}, resolve)); },
  };
}

test('Production background ignores saved-data test commands', () => {
  const harness = backgroundHarness(false);
  assert.equal(harness.listener({ action: 'testSetAllowance', minutes: 0 }, {}, () => assert.fail('No production test response')), undefined);
  assert.equal(harness.writes.length, 0);
});

test('Saved-data actions report before/after values and preserve unrelated history', async () => {
  const harness = backgroundHarness();
  let response = await harness.send({ action: 'testAddWatchTime', minutes: 15 });
  assert.equal(response.ok, true);
  assert.match(response.message, /0m → 15m/);
  assert.equal(harness.data.totalWatchTimeToday, 900000);
  assert.equal(harness.data[`siteTime_${harness.today}`]['youtube.com'], 900);
  assert.equal(harness.data.remainingTime, 600000, 'Adding history must not deduct allowance');
  await harness.send({ action: 'testAddSiteTime', domain: 'github.com', seconds: 1800 });
  await harness.send({ action: 'testAddSiteTime', domain: 'instagram.com', seconds: 1800 });
  assert.equal(harness.data[`siteTime_${harness.today}`]['instagram.com'], 1800);
  await harness.send({ action: 'testSetHourlyRate', rate: 1000 });
  await harness.send({ action: 'testMaxOverrides' });
  assert.equal((await harness.send({ action: 'getOverrideCount' })).count, 3, 'The real blocker must read the test override value');
  await harness.send({ action: 'testResetOverrides' });
  assert.equal((await harness.send({ action: 'getOverrideCount' })).count, 0);
  response = await harness.send({ action: 'testResetTodayData' });
  assert.equal(response.ok, true);
  assert.equal(harness.data.dailyWatchStats.yesterday, 42);
  assert.equal(harness.data.dailyWatchStats[harness.today], 0);
  assert.equal(harness.data.remainingTime, 600000);
  assert.equal(harness.data.hourlyRate, 1000);
  assert.deepEqual(harness.data[`siteTime_${harness.today}`], {});
});

test('Concurrent mock solves are serialized and save rewards with counts', async () => {
  const harness = backgroundHarness();
  await Promise.all(['easy', 'medium', 'hard'].map(difficulty => harness.send({ action: 'testSolveProblem', difficulty })));
  assert.deepEqual(harness.data.solvedProblemsHistory[harness.today], { easy: 1, medium: 1, hard: 1, totalMinutes: 75 });
  assert.equal(harness.data.remainingTime, 85 * 60000);
  for (const write of harness.writes.filter(value => value.solvedProblemsHistory)) {
    assert.ok(Object.hasOwn(write, 'remainingTime'), 'The solve and allowance must be written together');
  }
  await harness.send({ action: 'testAddAllowance', minutes: 30 });
  assert.equal(harness.data.remainingTime, 115 * 60000);
  await harness.send({ action: 'testSetAllowance', minutes: 0 });
  assert.equal(harness.data.remainingTime, 0, 'Zero is a valid explicit allowance');
});

for (const message of [
  { action: 'testAddWatchTime', minutes: -1 },
  { action: 'testAddWatchTime', minutes: NaN },
  { action: 'testAddAllowance', minutes: '30' },
  { action: 'testSetAllowance', minutes: 1441 },
  { action: 'testAddSiteTime', domain: 'github.com', seconds: 0 },
  { action: 'testAddSiteTime', domain: '__proto__', seconds: 1800 },
  { action: 'testSolveProblem', difficulty: 'unknown' },
  { action: 'testSetHourlyRate', rate: -1 },
]) {
  test(`Invalid saved-data input rejected: ${JSON.stringify(message)}`, async () => {
    const harness = backgroundHarness();
    const response = await harness.send(message);
    assert.equal(response.ok, false);
    assert.equal(response.status, 'failed');
    assert.equal(harness.writes.length, 0);
    assert.equal((await harness.send({ action: 'testAddAllowance', minutes: 30 })).ok, true, 'The queue must recover after rejection');
  });
}

test('Storage failure cannot report a successful mutation', async () => {
  const harness = backgroundHarness();
  harness.failWrites();
  const response = await harness.send({ action: 'testSolveProblem', difficulty: 'easy' });
  assert.equal(response.ok, false);
  assert.match(response.message, /Storage write failed/);
  assert.equal(harness.data.remainingTime, 600000);
  assert.equal(harness.data.solvedProblemsHistory, undefined);
});
