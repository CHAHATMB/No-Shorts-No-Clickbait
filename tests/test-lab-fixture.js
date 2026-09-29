window.__DEV__ = true;
window.testHarness = {
  tab: { id: 7, url: 'https://www.youtube.com/watch?v=fixture' },
  messages: [],
  data: { codingBonusEnabled: false, mascotEnabled: true },
  response: null,
  delay: null,
  error: null,
  confirmResult: true,
  confirmations: [],
  storageListeners: [],
  messageListeners: [],
};
const harness = window.testHarness;
window.confirm = message => {
  harness.confirmations.push(message);
  return harness.confirmResult;
};
const runtime = {
  id: 'test-lab-fixture',
  getManifest: () => ({ version: 'test' }),
  getURL: path => new URL(`../${path}`, location.href).href,
  onMessage: { addListener(listener) { harness.messageListeners.push(listener); } },
  async sendMessage(message) {
    harness.messages.push({ scope: 'runtime', ...message });
    if (message.action === 'getSiteTimeToday' || message.action === 'getSiteTimeRange') return { data: {} };
    if (message.action === 'getBlockedPatterns') return { patterns: [] };
    if (message.action === 'getOverrideCount') return { count: 0 };
    if (harness.error) throw new Error(harness.error);
    if (harness.delay) await harness.delay;
    if (harness.response) return harness.response;
    if (message.action === 'testAddAllowance') harness.data.remainingTime = (harness.data.remainingTime || 0) + message.minutes * 60000;
    return { ok: true, status: 'saved', message: 'Allowance: 0m → 30m.' };
  },
};
window.chrome = { runtime };
window.browser = {
  runtime,
  tabs: {
    async query() { return harness.tab ? [harness.tab] : []; },
    async sendMessage(tabId, message) {
      harness.messages.push({ scope: 'tab', tabId, ...message });
      if (harness.error) throw new Error(harness.error);
      if (harness.delay) await harness.delay;
      if (message.action === 'testPageStatus') return { ok: true, protocolVersion: 1 };
      if (message.action === 'testYouTubeStatus') return { ok: true, protocolVersion: 1, mascotEnabled: true, codingBonusEnabled: false, timeReminderEnabled: true };
      return harness.response || { ok: true, status: 'shown', message: 'Preview shown on the selected tab.' };
    },
  },
  storage: {
    onChanged: { addListener(listener) { harness.storageListeners.push(listener); } },
    local: {
      async get(keys) {
        if (keys === null) return structuredClone(harness.data);
        const names = typeof keys === 'string' ? [keys] : keys;
        return structuredClone(Object.fromEntries(names.map(key => [key, harness.data[key]])));
      },
      async set(values) { Object.assign(harness.data, values); },
    },
  },
};
