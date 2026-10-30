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
  const ticks = [
    [14 * MINUTE_MS, null], [15 * MINUTE_MS, 'BREAK persistent'], [15 * MINUTE_MS + 5000, null],
    [29 * MINUTE_MS, 'BREAK block'], [30 * MINUTE_MS, 'BREAK persistent'], [30 * MINUTE_MS + 5000, null],
  ];
  for (const [total, expected] of ticks) {
    session = continueWatchSession(restart(session), today);
    const result = selectReminder(session, stats(total), breakSettings);
    session = result.session;
    const delivered = result.reminder && `${result.reminder.category} ${result.reminder.behavior}`;
    assert.equal(delivered, expected, `At ${total / MINUTE_MS} minutes: ${JSON.stringify(result.reminder)}`);
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
    if (result.reminder) fired.push([total / MINUTE_MS, result.reminder.category, result.reminder.behavior]);
  }
  assert.deepEqual(fired, [[30, 'HYDRATION', 'transient'], [31, 'HYDRATION', 'block']], `Hydration must fire once, then escalate once: ${JSON.stringify(fired)}`);
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

const TICK_MS = 5000;
const hydrationSettings = { timeReminderEnabled: false, mascotCategories: { HYDRATION: true, EYE_STRAIN: false, STOP_WATCHING: false, LATE_NIGHT: false } };
const stopSettings = { timeReminderEnabled: false, mascotCategories: { HYDRATION: false, EYE_STRAIN: false, STOP_WATCHING: true, LATE_NIGHT: false } };

// Plays the video tick by tick from `watch.total`, optionally pausing (wall clock only) before the first tick.
// Pass the test's mock timers as `clock` when TriggerManager cooldowns (which read Date.now) matter.
async function playFor(watch, durationMs, { pauseMs = 0, settings = hydrationSettings, continueCountToday = 0, clock } = {}) {
  const { continueWatchSession, selectReminder } = await reminders;
  const advance = ms => { watch.now += ms; clock?.tick(ms); };
  advance(pauseMs);
  const delivered = [];
  for (let played = 0; played < durationMs; played += TICK_MS) {
    watch.total += TICK_MS;
    advance(TICK_MS);
    const session = continueWatchSession(restart(watch.session), 'today', watch.now);
    const result = selectReminder(session, { totalWatchTimeToday: watch.total, continueCountToday, breaksTakenToday: 0 }, settings, watch.now);
    watch.session = result.session;
    if (result.reminder) delivered.push([watch.total / 1000, result.reminder.category, result.reminder.behavior]);
  }
  return delivered;
}
const startWatch = total => ({ total, now: Date.parse('2026-10-30T12:00:00'), session: null });

test('Escalation: an ignored reminder blocks once after the grace period', async () => {
  const { BLOCK_GRACE_MS } = await reminders;
  const watch = startWatch(30 * MINUTE_MS - TICK_MS);
  assert.deepEqual(await playFor(watch, TICK_MS), [[1800, 'HYDRATION', 'transient']]);
  assert.deepEqual(await playFor(watch, BLOCK_GRACE_MS - TICK_MS), [], 'No block inside the grace period');
  assert.deepEqual(await playFor(watch, TICK_MS), [[1800 + BLOCK_GRACE_MS / 1000, 'HYDRATION', 'block']]);
  assert.deepEqual(await playFor(watch, 5 * MINUTE_MS), [], `The block must fire once: ${JSON.stringify(watch.session)}`);
});

test('Escalation: pausing the video acknowledges the reminder and prevents the block', async () => {
  const { ACKNOWLEDGE_PAUSE_MS } = await reminders;
  const watch = startWatch(30 * MINUTE_MS - TICK_MS);
  await playFor(watch, TICK_MS);
  assert.deepEqual(await playFor(watch, 5 * MINUTE_MS, { pauseMs: ACKNOWLEDGE_PAUSE_MS }), []);
  assert.equal(watch.session.escalation, null);
});

test('Escalation: a pause shorter than the acknowledgement threshold still blocks', async () => {
  const { ACKNOWLEDGE_PAUSE_MS, BLOCK_GRACE_MS } = await reminders;
  const watch = startWatch(30 * MINUTE_MS - TICK_MS);
  await playFor(watch, TICK_MS);
  const delivered = await playFor(watch, BLOCK_GRACE_MS, { pauseMs: ACKNOWLEDGE_PAUSE_MS - 1000 });
  assert.deepEqual(delivered.map(([, category, behavior]) => [category, behavior]), [['HYDRATION', 'block']]);
});

test('Escalation: the break reminder escalates by the same rule', async () => {
  const { escalateReminder, selectReminder, continueWatchSession } = await reminders;
  const session = continueWatchSession(undefined, 'today', 0);
  const result = selectReminder(session, stats(15 * MINUTE_MS), breakSettings, 0);
  assert.deepEqual(result.session.escalation, { category: 'BREAK', watchTime: 15 * MINUTE_MS, deliveredAt: 0 });
  assert.equal(escalateReminder(result.session.escalation, 15 * MINUTE_MS + 45000, 45000), 'ignored');
  assert.equal(escalateReminder(result.session.escalation, 15 * MINUTE_MS + 40000, 40000), 'pending');
  assert.equal(escalateReminder(result.session.escalation, 15 * MINUTE_MS + 40000, 70000), 'acknowledged');
});

test('Stop watching: reaching the limit blocks right away and again on every later play', async () => {
  const watch = startWatch(60 * MINUTE_MS - TICK_MS);
  const options = { settings: stopSettings, continueCountToday: 2 };
  assert.deepEqual(await playFor(watch, TICK_MS, options), [[3600, 'STOP_WATCHING', 'block']]);
  const replayed = await playFor(watch, TICK_MS, options);
  assert.deepEqual(replayed, [[3605, 'STOP_WATCHING', 'block']], 'Navigating away or reloading must not lift the stop block');
});

test('Stop watching: "Watch 5 more min" allows five minutes of watching, then blocks again', async () => {
  const { snoozeStopWatching, STOP_SNOOZE_MS } = await reminders;
  const watch = startWatch(60 * MINUTE_MS - TICK_MS);
  const options = { settings: stopSettings, continueCountToday: 2 };
  await playFor(watch, TICK_MS, options);
  watch.session = restart(snoozeStopWatching(watch.session, watch.total));
  assert.deepEqual(await playFor(watch, STOP_SNOOZE_MS - TICK_MS, options), [], 'No block during the snooze');
  assert.deepEqual(await playFor(watch, TICK_MS, options), [[3900, 'STOP_WATCHING', 'block']]);
});

test('Stop watching: a snooze after the trigger cooldown has passed is not cut short', async context => {
  const watch = startWatch(60 * MINUTE_MS - TICK_MS);
  context.mock.timers.enable({ apis: ['Date'], now: watch.now });
  const { snoozeStopWatching, STOP_SNOOZE_MS } = await reminders;
  const options = { settings: stopSettings, continueCountToday: 2, clock: context.mock.timers };
  assert.deepEqual(await playFor(watch, TICK_MS, options), [[3600, 'STOP_WATCHING', 'block']]);
  context.mock.timers.tick(16 * MINUTE_MS);
  watch.now += 16 * MINUTE_MS;
  watch.session = restart(snoozeStopWatching(watch.session, watch.total));
  assert.deepEqual(await playFor(watch, STOP_SNOOZE_MS - TICK_MS, options), [], `The 15-minute trigger cooldown must not end the snooze: ${JSON.stringify(watch.session)}`);
  assert.deepEqual(await playFor(watch, TICK_MS, options), [[3900, 'STOP_WATCHING', 'block']]);
});

test('Stop watching: "Watch 5 more min" only extends a limit that is blocking now', async () => {
  const { snoozeStopWatching, STOP_SNOOZE_MS } = await reminders;
  assert.deepEqual(snoozeStopWatching({ date: 'today' }, 10 * MINUTE_MS), { date: 'today' }, 'No limit reached yet');
  const snoozed = snoozeStopWatching({ stopAllowedUntil: 60 * MINUTE_MS }, 60 * MINUTE_MS);
  assert.equal(snoozed.stopAllowedUntil, 60 * MINUTE_MS + STOP_SNOOZE_MS);
  assert.equal(snoozeStopWatching(snoozed, 61 * MINUTE_MS), snoozed, 'A stale overlay in another tab must not extend an active snooze');
});

test('Escalation: the grace period starts when the page shows the reminder', async () => {
  const { deferEscalation, BLOCK_GRACE_MS } = await reminders;
  const watch = startWatch(30 * MINUTE_MS - TICK_MS);
  await playFor(watch, TICK_MS);
  for (let held = 0; held < 2 * MINUTE_MS; held += TICK_MS) {
    watch.total += TICK_MS;
    watch.now += TICK_MS;
    watch.session = deferEscalation(restart(watch.session), watch.total, watch.now);
  }
  assert.deepEqual(await playFor(watch, BLOCK_GRACE_MS - TICK_MS), [], 'Time while the reminder was held must not count toward the grace');
  assert.deepEqual((await playFor(watch, TICK_MS)).map(([, category, behavior]) => [category, behavior]), [['HYDRATION', 'block']]);
});

test('Blocks are selected for a page that cannot show the mascot, and mascot reminders are not', async () => {
  const { continueWatchSession, selectBlock, BLOCK_GRACE_MS } = await reminders;
  const session = continueWatchSession(undefined, 'today', 0);
  assert.equal(selectBlock(session, 45 * MINUTE_MS, breakSettings, 0).reminder, null, 'A due break reminder waits for a page that can show it');
  const escalated = { ...session, escalation: { category: 'EYE_STRAIN', watchTime: 0, deliveredAt: 0 } };
  assert.deepEqual(selectBlock(escalated, BLOCK_GRACE_MS, breakSettings, BLOCK_GRACE_MS).reminder?.category, 'EYE_STRAIN');
  const limited = { ...session, stopAllowedUntil: 60 * MINUTE_MS };
  assert.equal(selectBlock(limited, 60 * MINUTE_MS, stopSettings, 0).reminder?.behavior, 'block');
});

test('Stop watching: during a snooze, a re-fired stop trigger does not swallow another reminder', async () => {
  const { continueWatchSession, selectReminder } = await reminders;
  const settings = { timeReminderEnabled: false, mascotCategories: { HYDRATION: true, EYE_STRAIN: false, STOP_WATCHING: true, LATE_NIGHT: false } };
  const snoozed = { ...continueWatchSession(undefined, 'today'), stopAllowedUntil: 95 * MINUTE_MS, triggers: { cooldowns: {}, lastEvaluatedWatchTime: 90 * MINUTE_MS - TICK_MS } };
  const result = selectReminder(snoozed, { totalWatchTimeToday: 90 * MINUTE_MS, continueCountToday: 2, breaksTakenToday: 0 }, settings);
  assert.equal(result.reminder?.category, 'HYDRATION', `The stop trigger (cooldown over) must not win during a snooze: ${JSON.stringify(result)}`);
  assert.equal(result.session.stopAllowedUntil, 95 * MINUTE_MS);
});

test('Stop watching: disabling the stop category lifts the block', async () => {
  const watch = startWatch(60 * MINUTE_MS - TICK_MS);
  await playFor(watch, TICK_MS, { settings: stopSettings, continueCountToday: 2 });
  const disabled = { ...stopSettings, mascotCategories: { ...stopSettings.mascotCategories, STOP_WATCHING: false } };
  assert.deepEqual(await playFor(watch, MINUTE_MS, { settings: disabled, continueCountToday: 2 }), []);
  assert.deepEqual(await playFor(watch, MINUTE_MS, { settings: { ...stopSettings, mascotEnabled: false }, continueCountToday: 2 }), []);
});

test('Escalation state resets on a new day', async () => {
  const { continueWatchSession } = await reminders;
  const fresh = continueWatchSession({ date: 'yesterday', stopAllowedUntil: 0, escalation: { category: 'BREAK', watchTime: 0, deliveredAt: 0 } }, 'today');
  assert.equal(fresh.stopAllowedUntil, undefined);
  assert.equal(fresh.escalation, undefined);
});

function backgroundHarness(data, window, { features = {}, fetch, beforeStorageRead = async () => {} } = {}) {
  let listener;
  const event = { addListener() {} };
  const context = {
    __DEV__: false, FEATURES: features, fetch, console: { log() {}, error() {} }, Promise, Date,
    browser: {
      tabs: { onUpdated: event, query: async () => [], sendMessage: async () => {} },
      windows: { getLastFocused: async () => window },
      alarms: { onAlarm: event, get: async () => ({}) },
      runtime: { onMessage: { addListener(value) { listener = value; } }, sendMessage: async () => {} },
      storage: { local: {
        async get(keys) {
          const names = typeof keys === 'string' ? [keys] : keys;
          const snapshot = structuredClone(Object.fromEntries(names.map(key => [key, data[key]])));
          await beforeStorageRead();
          return snapshot;
        },
        async set(values) { Object.assign(data, structuredClone(values)); },
      } },
    },
  };
  return reminders.then(exports => {
    vm.runInNewContext(readSource('background.js'), Object.assign(context, exports));
    return (tab, amount = 5000, reminderReady = true, flags = {}) => new Promise(resolve => listener({ action: 'deductTime', amount, reminderReady, ...flags }, { tab }, resolve));
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

test('A tick from a tab that cannot show a reminder does not use it up', async () => {
  const data = { lastUpdateDate: new Date().toDateString(), totalWatchTimeToday: 15 * MINUTE_MS - 5000, mascotCategories: breakSettings.mascotCategories };
  const tick = await backgroundHarness(data, { ...focusedWindow });
  const deferred = await tick(watchingTab, 5000, false);
  assert.equal(deferred.counted, true);
  assert.equal(deferred.reminder, null);
  assert.equal((await tick(watchingTab)).reminder?.category, 'BREAK', 'The deferred reminder must fire once the tab is ready');
});

test('Background shows blocks in fullscreen and holds the grace while a reminder waits to be shown', async () => {
  const data = {
    lastUpdateDate: new Date().toDateString(), totalWatchTimeToday: 60 * MINUTE_MS,
    mascotCategories: stopSettings.mascotCategories,
    watchSession: { date: new Date().toDateString(), lastBreakWatchTime: 0, sessionStartTime: Date.now(), lastTickTime: Date.now(), triggers: {}, stopAllowedUntil: 60 * MINUTE_MS },
  };
  const tick = await backgroundHarness(data, { ...focusedWindow });
  assert.equal((await tick(watchingTab, 5000, false, { blockReady: true })).reminder?.category, 'STOP_WATCHING', 'Fullscreen can show the stop block');
  assert.equal((await tick(watchingTab, 5000, false)).reminder, null, 'A page with a block already up gets nothing');

  data.watchSession = { ...data.watchSession, stopAllowedUntil: undefined, escalation: { category: 'HYDRATION', watchTime: 0, deliveredAt: 0 } };
  const held = await tick(watchingTab, 5000, false, { blockReady: true, reminderPending: true });
  assert.equal(held.reminder, null, 'A reminder still waiting in the tab must not escalate');
  assert.equal(data.watchSession.escalation.watchTime, data.totalWatchTimeToday);
});

test('A watch tick overlapping a LeetCode bonus keeps both updates', async () => {
  const today = new Date().toDateString();
  const data = {
    lastUpdateDate: today, remainingTime: MINUTE_MS, leetcodeUsername: 'coder', codingBonusEnabled: true,
    dailyBaselines: { [today]: { easy: 0, medium: 0, hard: 0 } },
    solvedProblemsHistory: { [today]: { easy: 0, medium: 0, hard: 0, totalMinutes: 0 } },
    mascotCategories: breakSettings.mascotCategories,
  };
  let finishFetch;
  const fetched = new Promise(resolve => { finishFetch = resolve; });
  let fetchStarted = false;
  let releaseReads = Promise.resolve();
  const tick = await backgroundHarness(data, { ...focusedWindow }, {
    features: { CODING_PLATFORM_INTEGRATION: true },
    beforeStorageRead: () => releaseReads,
    fetch: async () => {
      fetchStarted = true;
      await fetched;
      return { json: async () => ({ data: { matchedUser: { submitStats: { acSubmissionNum: [
        { difficulty: 'Easy', count: 1 }, { difficulty: 'Medium', count: 0 }, { difficulty: 'Hard', count: 0 },
      ] } } } }) };
    },
  });
  while (!fetchStarted) await settle();

  let openReads;
  releaseReads = new Promise(resolve => { openReads = resolve; });
  const pendingTick = tick(watchingTab);
  await settle();
  finishFetch();
  await settle();
  openReads();
  releaseReads = Promise.resolve();
  await pendingTick;
  await settle();
  assert.equal(data.remainingTime, MINUTE_MS - 5000 + 10 * MINUTE_MS, `Bonus and deduction must both apply: ${data.remainingTime}`);
  assert.equal(data.totalWatchTimeToday, 5000);
});

function contentTrackingLoop({ video, hidden = false, path = '/watch' }) {
  const source = readFileSync(resolve(__dirname, '../src/content.js'), 'utf8');
  const start = source.indexOf('  function initializeTimeTracking');
  const sent = [];
  let tickLoop;
  let now = Date.parse("2026-10-30T12:00:00");
  vm.runInNewContext(`${source.slice(start, source.indexOf('\n  function isReminderReady', start))}\ninitializeTimeTracking();`, {
    WATCH_TICK_MS: 5000, lastDeductionTime: null, pendingReminder: null,
    isReminderReady: () => true, handleWatchTick() {}, console, videoBlocker: { active: false }, findPlayerVideo: () => video,
    Date: { now: () => now },
    setInterval: callback => { tickLoop = callback; },
    document: { hidden, querySelector: () => video },
    window: { location: { pathname: path } },
    browser: { runtime: { sendMessage: async message => { sent.push(message); } } },
  });
  for (let second = 0; second <= 10; second++, now += 1000) tickLoop();
  return sent;
}

const playingVideo = { paused: false, ended: false, readyState: 4 };
for (const [name, options, expectedTicks] of [
  ['playing video in a visible watch page', { video: playingVideo }, 2],
  ['paused video', { video: { ...playingVideo, paused: true } }, 0],
  ['ended video', { video: { ...playingVideo, ended: true } }, 0],
  ['hidden tab', { video: playingVideo, hidden: true }, 0],
  ['page other than /watch', { video: playingVideo, path: '/' }, 0],
  ['page without a video', { video: null }, 0],
]) {
  test(`Content reports watch ticks only for a ${name}`, () => {
    const sent = contentTrackingLoop(options);
    assert.equal(sent.length, expectedTicks, JSON.stringify(sent));
    assert.ok(sent.every(message => message.action === 'deductTime' && message.amount === 5000));
  });
}

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

  window.focused = true;
  listeners.focus(1);
  await settle();
  context.mock.timers.tick(10000);
  browser.windows.getLastFocused = async () => { throw new Error('No last-focused window'); };
  listeners.alarm({ name: 'universalTimeTracker' });
  await settle();
  assert.equal(siteTime(), 70);
  context.mock.timers.tick(20 * 60000);
  browser.windows.getLastFocused = async () => window;
  listeners.focus(1);
  await settle();
  assert.equal(siteTime(), 70, 'Time with no browser window open must not be credited on reopen');
});
