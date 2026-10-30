const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

const MINUTE_MS = 60000;
const readSource = file => readFileSync(resolve(__dirname, '../src', file), 'utf8').replace(/^import .*;\n/gm, '');
const importSource = (source, instance = '') => import(`data:text/javascript;base64,${Buffer.from(`${source}\n//${instance}`).toString('base64')}`);
const reminders = importSource(['modules/mascot/mascot-messages.js', 'modules/mascot/mascot-triggers.js', 'modules/watch-reminders.js'].map(readSource).join('\n'));
const restart = session => JSON.parse(JSON.stringify(session));
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); };

const focusedWindow = { id: 1, focused: true };
const watchingTab = { id: 10, windowId: 1, active: true };

for (const [name, tab, window, counted] of [
  ['active tab in the focused window', watchingTab, focusedWindow, true],
  ['background tab in the focused window', { id: 11, windowId: 1, active: false }, focusedWindow, false],
  ['active tab in another window', { id: 20, windowId: 2, active: true }, focusedWindow, false],
  ['active tab while the browser is unfocused', watchingTab, { id: 1, focused: false }, false],
  ['message without a sender tab', undefined, focusedWindow, false],
]) {
  test(`Counting rule: ${name} ${counted ? 'counts' : 'does not count'}`, async () => {
    const { isCountedWatchTab } = await reminders;
    assert.equal(isCountedWatchTab(tab, window), counted, JSON.stringify({ tab, window }));
  });
}

test('Watch ticks are validated and clamped', async () => {
  const { clampWatchTick, MAX_WATCH_TICK_MS } = await reminders;
  for (const invalid of [-5000, 0, NaN, Infinity, '5000', undefined]) {
    assert.equal(clampWatchTick(invalid), 0, `Invalid tick ${String(invalid)} must not count`);
  }
  assert.equal(clampWatchTick(5000), 5000);
  assert.equal(clampWatchTick(15 * MINUTE_MS), MAX_WATCH_TICK_MS, 'One message cannot add unbounded time');
});

const breakSettings = { timerInterval: 15, mascotEnabled: true, mascotCategories: { HYDRATION: false, EYE_STRAIN: false, STOP_WATCHING: false, LATE_NIGHT: false } };
const stats = totalWatchTimeToday => ({ totalWatchTimeToday, continueCountToday: 0, breaksTakenToday: 0 });

test('Break reminder fires once per interval across tabs, reloads, and worker restarts', async () => {
  const { continueWatchSession, selectReminder } = await reminders;
  const today = 'Fri Oct 30 2026';
  let session = continueWatchSession(undefined, today);
  const ticks = [[14 * MINUTE_MS, null], [15 * MINUTE_MS, 'BREAK'], [15 * MINUTE_MS + 5000, null], [29 * MINUTE_MS, null], [30 * MINUTE_MS, 'BREAK'], [30 * MINUTE_MS + 5000, null]];
  for (const [total, expected] of ticks) {
    session = continueWatchSession(restart(session), today);
    const result = selectReminder(session, stats(total), breakSettings);
    session = result.session;
    assert.equal(result.reminder?.category ?? null, expected, `At ${total / MINUTE_MS} minutes: ${JSON.stringify(result.reminder)}`);
  }
});

test('Break reminder respects disabled timer reminders and a disabled mascot break category', async () => {
  const { continueWatchSession, selectReminder } = await reminders;
  const session = continueWatchSession(undefined, 'today');
  for (const settings of [{ ...breakSettings, timeReminderEnabled: false }, { ...breakSettings, mascotCategories: { ...breakSettings.mascotCategories, BREAK: false } }]) {
    assert.equal(selectReminder(session, stats(20 * MINUTE_MS), settings).reminder, null, JSON.stringify(settings));
  }
  const fallback = selectReminder(session, stats(20 * MINUTE_MS), { ...breakSettings, mascotEnabled: false, mascotCategories: { BREAK: false } });
  assert.equal(fallback.reminder?.category, 'BREAK', 'Without the mascot the text-panel reminder ignores mascot categories');
});

test('A new day starts a fresh reminder baseline', async () => {
  const { continueWatchSession, selectReminder } = await reminders;
  const yesterday = selectReminder(continueWatchSession(undefined, 'yesterday'), stats(45 * MINUTE_MS), breakSettings).session;
  assert.equal(yesterday.lastBreakWatchTime, 45 * MINUTE_MS);
  const today = continueWatchSession(restart(yesterday), 'today');
  assert.equal(selectReminder(today, stats(15 * MINUTE_MS), breakSettings).reminder?.category, 'BREAK');
});

test('Mascot triggers keep their cooldowns through restarts', async () => {
  const { continueWatchSession, selectReminder } = await reminders;
  const settings = { timeReminderEnabled: false, mascotCategories: { HYDRATION: true, EYE_STRAIN: false, STOP_WATCHING: false, LATE_NIGHT: false } };
  let session = continueWatchSession(undefined, 'today');
  const fired = [];
  for (const total of [29 * MINUTE_MS, 30 * MINUTE_MS, 30 * MINUTE_MS + 5000, 31 * MINUTE_MS]) {
    const result = selectReminder(continueWatchSession(restart(session), 'today'), stats(total), settings);
    session = result.session;
    if (result.reminder) fired.push([total / MINUTE_MS, result.reminder.category]);
  }
  assert.deepEqual(fired, [[30, 'HYDRATION']], `Hydration must fire once: ${JSON.stringify(fired)}`);
});

test('A watch session restarts only after a gap', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: 1000000 });
  const { continueWatchSession, SESSION_GAP_MS } = await reminders;
  const started = continueWatchSession(undefined, 'today');
  context.mock.timers.tick(SESSION_GAP_MS);
  const continued = continueWatchSession(started, 'today');
  assert.equal(continued.sessionStartTime, started.sessionStartTime);
  context.mock.timers.tick(SESSION_GAP_MS + 1);
  assert.equal(continueWatchSession(continued, 'today').sessionStartTime, Date.now());
});

function backgroundHarness(data, window) {
  let listener;
  const event = { addListener() {} };
  const context = {
    __DEV__: false, FEATURES: {}, console: { log() {}, error() {} }, Promise, Date,
    browser: {
      tabs: { onUpdated: event, query: async () => [], sendMessage: async () => {} },
      windows: { getLastFocused: async () => window },
      alarms: { onAlarm: event },
      runtime: { onMessage: { addListener(value) { listener = value; } }, sendMessage: async () => {} },
      storage: { local: {
        async get(keys) {
          const names = typeof keys === 'string' ? [keys] : keys;
          return structuredClone(Object.fromEntries(names.map(key => [key, data[key]])));
        },
        async set(values) { Object.assign(data, structuredClone(values)); },
      } },
    },
  };
  return reminders.then(exports => {
    vm.runInNewContext(readSource('background.js'), Object.assign(context, exports));
    return (tab, amount = 5000) => new Promise(resolve => listener({ action: 'deductTime', amount, reminderReady: true }, { tab }, resolve));
  });
}

test('Background counts only the watched tab and delivers each reminder once', async () => {
  const data = { lastUpdateDate: new Date().toDateString(), totalWatchTimeToday: 15 * MINUTE_MS - 5000, remainingTime: MINUTE_MS, mascotCategories: breakSettings.mascotCategories };
  const window = { ...focusedWindow };
  const otherWindowTab = { id: 20, windowId: 2, active: true };
  let tick = await backgroundHarness(data, window);

  const responses = await Promise.all([tick(watchingTab), tick(otherWindowTab), tick({ ...watchingTab, id: 11, active: false })]);
  assert.deepEqual(responses.map(response => response.counted), [true, false, false]);
  assert.equal(data.totalWatchTimeToday, 15 * MINUTE_MS, 'Simultaneous tabs must count once');
  assert.equal(data.remainingTime, MINUTE_MS - 5000);
  assert.equal(responses[0].reminder?.category, 'BREAK');

  Object.assign(window, { id: 2 });
  assert.equal((await tick(otherWindowTab)).reminder, null, 'Switching tabs must not repeat a delivered reminder');

  tick = await backgroundHarness(data, window);
  const afterRestart = await tick(otherWindowTab);
  assert.equal(afterRestart.totalWatchTimeToday, 15 * MINUTE_MS + 10000, 'A restarted worker must add to saved time, not reset it');
  assert.equal(afterRestart.reminder, null, 'A restarted worker must not repeat the reminder');

  window.focused = false;
  assert.equal((await tick(otherWindowTab)).counted, false, 'An unfocused browser must not count');
  assert.equal(data.totalWatchTimeToday, 15 * MINUTE_MS + 10000);
});

test('Site-time tracker counts only the focused window and survives worker restarts', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-30T12:00:00') });
  const data = {};
  const listeners = {};
  const window = { id: 1, focused: true, tabs: [{ id: 10, active: true, url: 'https://www.youtube.com/watch?v=1' }] };
  const event = name => ({ addListener(value) { listeners[name] = value; } });
  globalThis.browser = {
    tabs: { onActivated: event('activated'), onUpdated: event('updated') },
    windows: { onFocusChanged: event('focus'), getLastFocused: async () => window },
    alarms: { onAlarm: event('alarm'), get: async () => ({}), create() {} },
    storage: { local: {
      async get(keys) {
        const names = typeof keys === 'string' ? [keys] : keys;
        return structuredClone(Object.fromEntries(names.map(key => [key, data[key]])));
      },
      async set(values) { Object.assign(data, structuredClone(values)); },
    } },
  };
  context.after(() => { delete globalThis.browser; });
  context.mock.method(console, 'log', () => {});
  const siteTime = () => data[`siteTime_${new Date().toDateString()}`]?.['youtube.com'] || 0;
  const startWorker = async instance => (await importSource(readSource('modules/time-tracker.js'), instance)).initUniversalTracker();

  await startWorker('first');
  await settle();
  context.mock.timers.tick(30000);
  listeners.alarm({ name: 'universalTimeTracker' });
  await settle();
  assert.equal(siteTime(), 30);

  context.mock.timers.tick(20000);
  await startWorker('restarted');
  await settle();
  assert.equal(siteTime(), 50, 'Time before a worker restart must not be lost');

  context.mock.timers.tick(10000);
  window.focused = false;
  listeners.focus(-1);
  await settle();
  context.mock.timers.tick(60000);
  listeners.alarm({ name: 'universalTimeTracker' });
  await settle();
  assert.equal(siteTime(), 60, 'Time while the browser is unfocused must not count');
});
