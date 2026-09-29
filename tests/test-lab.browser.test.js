const results = [];
window.testLabResults = results;
const frame = document.getElementById('popup');
const markup = await (await fetch('../src/popup.html')).text();
frame.srcdoc = markup.replace('<head>', '<head><base href="/src/">')
  .replace(/@import url\([^)]*\);/, '')
  .replace('<script src="browser-polyfill.js"></script>', '<script src="/tests/test-lab-fixture.js"></script>')
  .replace('<script src="popup.js"></script>', '<script type="module" src="/src/popup.js"></script>');
await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
const documentUnderTest = frame.contentDocument;
const harness = frame.contentWindow.testHarness;
const element = id => documentUnderTest.getElementById(id);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const waitFor = async predicate => {
  const deadline = Date.now() + 7000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for Test Lab state');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
async function test(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  } finally {
    harness.response = null;
    harness.error = null;
    harness.confirmResult = true;
  }
  document.getElementById('results').textContent = results.map(result => `${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `: ${result.error}` : ''}`).join('\n');
}
async function clickAction(id) {
  await waitFor(() => !element(id).disabled);
  element(id).click();
  await waitFor(() => !element('test-toast').textContent.startsWith('RUNNING:') && !element(id).disabled);
}
async function refreshTarget() {
  element('btn-test-check-connection').click();
  await waitFor(() => element('test-active-domain').textContent === (harness.tab ? new URL(harness.tab.url).hostname : 'No web page selected'));
  await new Promise(resolve => setTimeout(resolve, 30));
}

element('tab-btn-test').click();
await waitFor(() => element('test-tab-label').textContent === 'Connected');

await test('Test tab separates previews, saved-data tools, and diagnostics', () => {
  const sections = [...documentUnderTest.querySelectorAll('#tab-test > details')];
  assert(sections.length === 3, `Expected three sections, received ${sections.length}`);
  assert(sections[0].open && !sections[1].open && !sections[2].open, 'Only previews should open by default');
  assert(!element('btn-test-clear-storage'), 'Unreliable full-storage reset must not be offered');
  assert(element('test-toast').getAttribute('role') === 'status', 'Results must be announced accessibly');
});

await test('Preview command targets only the displayed active tab without storage writes', async () => {
  const before = JSON.stringify(harness.data);
  await clickAction('btn-test-mascot-water');
  const command = harness.messages.findLast(message => message.action === 'testTriggerMascot');
  assert(command.tabId === 7 && command.category === 'hydration', `Unexpected target or payload: ${JSON.stringify(command)}`);
  assert(element('test-toast').textContent.startsWith('SHOWN:'), 'Must show acknowledged result');
  assert(JSON.stringify(harness.data) === before, 'Preview must not mutate storage');
});

await test('Skipped actions show the actual reason', async () => {
  harness.response = { ok: false, status: 'skipped', message: 'Mascot category disabled' };
  await clickAction('btn-test-mascot-water');
  assert(element('test-toast').textContent === 'SKIPPED: Mascot category disabled', element('test-toast').textContent);
  harness.response = null;
});

await test('Delivery failure stays visible and does not fall back through background', async () => {
  const count = harness.messages.filter(message => message.scope === 'runtime').length;
  harness.error = 'Receiver disconnected';
  await clickAction('btn-test-banner-time');
  assert(element('test-toast').textContent.startsWith('FAILED:'), 'Delivery errors must not look successful');
  assert(element('test-toast').textContent.includes('Refresh'), 'Failure should explain recovery');
  assert(harness.messages.filter(message => message.scope === 'runtime').length === count, 'No fallback dispatch');
  harness.error = null;
});

await test('A pending action disables buttons and prevents duplicate mutations', async () => {
  let resolve;
  harness.delay = new Promise(done => { resolve = done; });
  const previous = harness.messages.filter(message => message.action === 'testAddAllowance').length;
  element('btn-test-allowance-add30').click();
  element('btn-test-allowance-add30').click();
  await new Promise(done => setTimeout(done, 20));
  assert(element('btn-test-allowance-add30').disabled, 'Pending action should disable controls');
  assert(harness.messages.filter(message => message.action === 'testAddAllowance').length === previous + 1, 'Duplicate click must not send twice');
  resolve();
  harness.delay = null;
  await waitFor(() => !element('btn-test-allowance-add30').disabled);
  assert(element('test-stat-allowance').textContent === '30m', 'Saved stats should refresh');
});

await test('Cancelling a destructive action sends no command', async () => {
  harness.confirmResult = false;
  const count = harness.messages.length;
  await clickAction('btn-test-reset-time');
  assert(harness.confirmations.at(-1).includes('Earlier history'), 'Confirmation must describe the reset boundary');
  assert(harness.messages.length === count, 'Cancelled reset must not dispatch');
  assert(element('test-toast').textContent.startsWith('SKIPPED:'), 'Cancellation should be visible');
  harness.confirmResult = true;
});

await test('Override display reads the real blocker storage schema and today’s date', async () => {
  harness.data.blockOverrides = { yesterday: 3, [new Date().toDateString()]: 2 };
  harness.data.blockerOverrides = { date: new Date().toDateString(), count: 3 };
  harness.storageListeners.forEach(listener => listener({ blockOverrides: {} }, 'local'));
  await waitFor(() => element('test-stat-overrides').textContent === '2/3');
  assert(element('test-stat-overrides').textContent === '2/3', 'Legacy test-only values must not override actual usage');
});

await test('Clear previews reaches both page and YouTube receivers', async () => {
  await clickAction('btn-test-clear-overlays');
  const commands = harness.messages.slice(-2).map(message => message.action);
  assert(commands.join(',') === 'testClearPagePreviews,testClearYouTubePreviews', commands.join(','));
});

await test('Switching the active tab cannot silently redirect an action', async () => {
  harness.tab = { id: 8, url: 'https://www.youtube.com/watch?v=other' };
  const count = harness.messages.filter(message => message.action === 'testTriggerMascot').length;
  await clickAction('btn-test-mascot-water');
  assert(element('test-toast').textContent.includes('active page changed'), 'Must explain target change');
  assert(harness.messages.filter(message => message.action === 'testTriggerMascot').length === count, 'Must not send to changed target');
});

await test('Non-YouTube tabs disable YouTube-only controls but keep page previews', async () => {
  harness.tab = { id: 9, url: 'https://github.com/' };
  await refreshTarget();
  assert(element('btn-test-mascot-water').disabled, 'Mascot requires YouTube');
  assert(!element('btn-test-banner-time').disabled, 'Page banner should remain available');
  assert(element('test-target-help').textContent.includes('require an active YouTube tab'), 'Restriction should be visible');
});

await test('Browser pages disable all previews while saved-data tools remain available', async () => {
  harness.tab = { id: 10, url: 'chrome://extensions/' };
  await refreshTarget();
  assert(element('btn-test-banner-time').disabled, 'Restricted pages cannot receive previews');
  assert(element('btn-test-hard-block').disabled, 'Restricted pages cannot receive YouTube previews');
  assert(!element('btn-test-allowance-add30').disabled, 'Storage tools do not require page connection');
  assert(element('test-tab-label').textContent === 'Not ready', 'A URL alone must not mean connected');
});

await test('Storage snapshot is explicit and copy refuses placeholder text', async () => {
  await clickAction('btn-test-copy-storage');
  assert(element('test-toast').textContent.includes('Refresh the storage snapshot'), 'Cannot copy placeholder as JSON');
  element('btn-test-refresh-storage').click();
  await waitFor(() => element('test-storage-viewer').textContent.startsWith('{'));
  assert(JSON.parse(element('test-storage-viewer').textContent).remainingTime === 1800000, 'Snapshot should contain current saved data');
});

await test('All controls fit at 320px and retain explicit form labels', async () => {
  frame.style.width = '320px';
  documentUnderTest.querySelectorAll('#tab-test details').forEach(details => { details.open = true; });
  await new Promise(resolve => requestAnimationFrame(resolve));
  const root = element('tab-test');
  assert(root.scrollWidth <= root.clientWidth, `Horizontal overflow: ${root.scrollWidth} > ${root.clientWidth}`);
  for (const field of root.querySelectorAll('input, select')) {
    assert(field.labels.length > 0, `${field.id} must have an explicit label`);
  }
  frame.style.width = '380px';
});

harness.tab = { id: 7, url: 'https://www.youtube.com/watch?v=fixture' };
await refreshTarget();
documentUnderTest.querySelectorAll('#tab-test details').forEach(details => { details.open = false; });
documentUnderTest.querySelector('#tab-test > details').open = true;
element('tab-test').scrollTop = 0;
const pageFrame = document.createElement('iframe');
pageFrame.title = 'Productivity content preview fixture';
pageFrame.style.cssText = 'width:800px;height:600px';
pageFrame.srcdoc = '<!doctype html><html><head></head><body><video></video><script src="/tests/test-lab-fixture.js"></script><script type="module" src="/src/productivity-content.js"></script></body></html>';
const pageLoaded = new Promise(resolve => pageFrame.addEventListener('load', resolve, { once: true }));
document.body.appendChild(pageFrame);
await pageLoaded;
const pageWindow = pageFrame.contentWindow;
const pageDocument = pageFrame.contentDocument;
const pageHarness = pageWindow.testHarness;
const sendPage = message => pageHarness.messageListeners[0](message);
let mediaPauses = 0;
pageDocument.querySelector('video').pause = () => { mediaPauses++; };
const timers = new Map();
const setTimer = pageWindow.setTimeout.bind(pageWindow);
const clearTimer = pageWindow.clearTimeout.bind(pageWindow);
pageWindow.setTimeout = (callback, delay) => {
  const timer = setTimer(() => { timers.delete(timer); callback(); }, delay);
  timers.set(timer, delay);
  return timer;
};
pageWindow.clearTimeout = timer => { timers.delete(timer); clearTimer(timer); };

await test('Banner previews clean up timers and cannot invoke real actions', async () => {
  for (const type of ['timeAlert', 'milestone', 'dailySummary', 'suggestion']) {
    const response = await sendPage({ action: 'testPreviewBanner', type, data: { domain: 'example.org', minutes: 45, message: 'Sample' } });
    assert(response.ok, `Failed to preview ${type}`);
  }
  assert(pageDocument.querySelectorAll('.fg-banner[data-preview="true"]').length === 4, 'All four banner types should render');
  pageDocument.querySelector('[data-action="block"]').click();
  assert(!pageHarness.messages.some(message => message.action === 'openPopupToBlocker'), 'Preview button must not invoke real blocking tools');
  await sendPage({ action: 'testClearPagePreviews' });
  assert(!pageDocument.querySelector('.fg-banner[data-preview="true"]'), 'Preview banners must clear');
  assert(timers.size === 0, `Preview timers leaked: ${JSON.stringify([...timers.values()])}`);
});

await test('Blocker preview override consumes no allowance and schedules no re-block', async () => {
  const before = JSON.stringify(pageHarness.data);
  const response = await sendPage({ action: 'testPreviewBlocker' });
  assert(response.ok && pageDocument.getElementById('fg-block-overlay'), 'Blocker must exist before successful acknowledgement');
  assert(mediaPauses === 0 && pageDocument.body.style.overflow !== 'hidden', 'Preview must not pause media or change scrolling');
  assert(!pageDocument.querySelector('#fg-block-overlay a[href]'), 'Preview must not open external tabs');
  pageDocument.getElementById('fg-override-btn').click();
  assert(!pageDocument.getElementById('fg-block-overlay'), 'Preview override should dismiss');
  assert(!pageHarness.messages.some(message => message.action === 'useOverride'), 'Preview must not consume real overrides');
  assert(![...timers.values()].includes(300000), 'Preview must not schedule re-block');
  assert(JSON.stringify(pageHarness.data) === before, 'Preview must not change saved data');
});

await test('Clearing previews preserves real page banners and blockers', async () => {
  await sendPage({ action: 'showBanner', type: 'milestone', data: { message: 'Real banner' } });
  await sendPage({ action: 'showBlockOverlay', pattern: { label: 'Real rule' } });
  const realBlocker = pageDocument.getElementById('fg-block-overlay');
  const realBanner = pageDocument.querySelector('.fg-banner');
  await sendPage({ action: 'testClearPagePreviews' });
  assert(realBlocker.isConnected && realBanner.isConnected, 'Real page UI must survive preview cleanup');
  const response = await sendPage({ action: 'testPreviewBlocker' });
  assert(response.status === 'skipped', 'Preview must not replace real blocker');
});
pageFrame.remove();
window.testLabFinished = true;
