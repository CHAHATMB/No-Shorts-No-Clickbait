import { MascotController } from '../src/modules/mascot/mascot-controller.js';
import { MASCOTS, createCharacterElement, MascotAnimator } from '../src/modules/mascot/mascot-character.js';

const results = [];
const output = document.getElementById('results');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const runtime = {
  id: 'mascot-test',
  getURL(path) {
    const source = path === 'mascot-styles.css'
      ? 'src/modules/mascot/mascot-styles.css'
      : path.replace('mascots/finn/', 'mascots/walk_animation_asset/');
    return new URL(`../${source}`, import.meta.url).href;
  },
};
window.chrome = { runtime };
window.browser = { runtime };

function createClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const originals = Object.fromEntries(['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'].map(key => [key, window[key]]));
  const schedule = (callback, delay = 0, repeat = false) => {
    const id = ++nextId;
    timers.set(id, { callback, at: now + delay, repeat: repeat ? delay : 0 });
    return id;
  };
  window.setTimeout = (callback, delay) => schedule(callback, delay);
  window.setInterval = (callback, delay) => schedule(callback, delay, true);
  window.clearTimeout = window.clearInterval = id => timers.delete(id);
  return {
    tick(duration) {
      const end = now + duration;
      let next;
      while ((next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0])) {
        const [id, timer] = next;
        now = timer.at;
        if (timer.repeat) timer.at += timer.repeat;
        else timers.delete(id);
        timer.callback();
      }
      now = end;
    },
    restore() {
      Object.assign(window, originals);
    },
    get size() { return timers.size; },
  };
}

function finishEntrance(controller, clock) {
  controller.container.dispatchEvent(new Event('animationend'));
  clock.tick(500);
}

async function test(name, run) {
  const clock = createClock();
  const controller = new MascotController();
  controller.init();
  try {
    await run(controller, clock);
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  } finally {
    controller._cleanup();
    clock.restore();
    document.querySelectorAll('video, #youtube-time-reminder').forEach(element => element.remove());
  }
  output.textContent = results.map(result => `${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `: ${result.error}` : ''}`).join('\n');
}

await test('Walking entrance brings the actual mascot inside the viewport', controller => {
  controller.show('Time for water', { entrance: 'walk' });
  const animation = controller.container.getAnimations()[0];
  animation?.finish();
  const image = controller.characterEl.getBoundingClientRect();
  assert(image.left >= 0 && image.right <= innerWidth, `Mascot bounds ${image.left}..${image.right} exceed viewport ${innerWidth}`);
});

await test('Every entrance lands on-screen with accessible controls and cleans up after exit', (controller, clock) => {
  for (const entrance of ['grand', 'walk', 'slide', 'jump', 'pop', 'unknown']) {
    controller.show('A reminder', { entrance });
    controller.container.getAnimations().forEach(animation => animation.finish());
    const bounds = controller.characterEl.getBoundingClientRect();
    assert(bounds.left >= 0 && bounds.right <= innerWidth, `${entrance} must land inside the viewport`);
    finishEntrance(controller, clock);
    assert(!controller.speechBubble.inert, `${entrance} controls must be accessible after arrival`);
    controller.dismiss();
    clock.tick(4000);
    assert(!controller.container && clock.size === 0, `${entrance} must clean up`);
  }
});

await test('Mascot stays at the top-right with its speech bubble below the character', (controller, clock) => {
  controller.show('Top-right reminder', { entrance: 'walk' });
  finishEntrance(controller, clock);
  const container = controller.container.getBoundingClientRect();
  const character = controller.characterEl.getBoundingClientRect();
  const bubble = controller.speechBubble.getBoundingClientRect();
  assert(container.top >= 56 && container.top <= 88, `Reminder must sit just below the header, received top ${container.top}`);
  assert(innerWidth - container.right <= 48, 'Reminder must stay near the right edge');
  assert(character.bottom <= bubble.top, 'Bubble must sit below the mascot');
  assert(container.bottom <= innerHeight, 'Reminder must remain within the viewport');
});

await test('Visible reminder follows YouTube theme changes in both directions', (controller, clock) => {
  const root = document.documentElement;
  const previousTheme = root.getAttribute('dark');
  try {
    root.removeAttribute('dark');
    controller.show('Theme-aware reminder');
    finishEntrance(controller, clock);
    const colors = () => {
      controller.container.getAnimations({ subtree: true })
        .filter(animation => animation instanceof CSSTransition)
        .forEach(animation => animation.finish());
      return {
        surface: getComputedStyle(controller.speechBubble).backgroundColor,
        text: getComputedStyle(controller.speechBubble).color,
        primary: getComputedStyle(controller.speechBubble.querySelector('.primary')).backgroundColor,
        secondary: getComputedStyle(controller.speechBubble.querySelector('.secondary')).backgroundColor,
        label: getComputedStyle(controller.speechBubble.querySelector('.fg-mascot-category')).color,
        border: getComputedStyle(controller.speechBubble).borderTopColor,
        glow: getComputedStyle(controller.characterEl).filter,
        scheme: getComputedStyle(controller.container).colorScheme,
        tail: getComputedStyle(controller.speechBubble, '::after').borderBottomColor,
      };
    };
    const light = colors();
    assert(light.text === 'rgb(15, 15, 15)' && light.scheme === 'light', 'YouTube light mode must use dark text and light controls');
    assert(light.surface === light.tail, 'Light speech bubble and tail must match');
    root.setAttribute('dark', '');
    const dark = colors();
    assert(dark.text === 'rgb(241, 241, 241)' && dark.scheme === 'dark', 'YouTube dark mode must use light text and dark controls');
    assert(dark.surface === dark.tail, 'Dark speech bubble and tail must match');
    for (const property of ['surface', 'primary', 'secondary', 'label', 'border', 'glow']) {
      assert(light[property] !== dark[property], `${property} must adapt to the active YouTube theme`);
    }
    root.removeAttribute('dark');
    const restored = colors();
    assert(restored.surface === light.surface && restored.text === light.text, 'Switching back must restore light mode without recreating the mascot');
    assert(controller.state === 'visible', 'Theme changes must not restart the animation lifecycle');
  } finally {
    if (previousTheme === null) root.removeAttribute('dark');
    else root.setAttribute('dark', previousTheme);
  }
});

await test('Hover preserves the reminder and leaving starts a single dismissal timer', (controller, clock) => {
  controller.show('Read at your own pace');
  controller.container.dispatchEvent(new Event('mouseenter'));
  finishEntrance(controller, clock);
  clock.tick(15000);
  assert(controller.state === 'visible', 'Hover during entrance must pause dismissal');
  controller.container.dispatchEvent(new Event('mouseleave'));
  controller.container.dispatchEvent(new Event('mouseenter'));
  controller.container.dispatchEvent(new Event('mouseleave'));
  clock.tick(2999);
  assert(controller.state === 'visible', 'Leaving must allow time to finish reading');
  clock.tick(4000);
  assert(!controller.container && clock.size === 0, 'Leaving must eventually clean up without orphan timers');
});

await test('PNG frames cycle, mirror on entrance, and stop at the idle frame', (controller, clock) => {
  controller.show('Walk in', { entrance: 'walk' });
  const image = controller.characterEl.querySelector('img');
  if (controller.reducedMotion) {
    clock.tick(500);
    assert(image.src.endsWith('front.png') && controller.animator.intervalId === null, 'Reduced motion must use a static idle frame');
    return;
  }
  assert(image.src.endsWith('right1.png'), 'Entrance must start with the first walk frame');
  assert(image.classList.contains('fg-mascot-facing-left'), 'Entrance must face left');
  clock.tick(140);
  assert(image.src.endsWith('right2.png'), 'Walk frames must advance');
  finishEntrance(controller, clock);
  assert(image.src.endsWith('front.png'), 'Arrival must use the front-facing sprite');
  assert(controller.animator.intervalId === null, 'Walk interval must stop on arrival');
});

await test('Walking exit cycles frames facing right', (controller, clock) => {
  controller.show('Walk out', { entrance: 'walk' });
  finishEntrance(controller, clock);
  controller.dismiss();
  clock.tick(300);
  if (controller.reducedMotion) {
    assert(!controller.container && clock.size === 0, 'Reduced-motion exit must clean up without walking');
    return;
  }
  const image = controller.characterEl.querySelector('img');
  const firstFrame = image.src;
  clock.tick(140);
  assert(image.src !== firstFrame, 'Exit must animate actual walking frames, not a static back image');
  assert(!image.classList.contains('fg-mascot-facing-left'), 'Exit must face right');
});

await test('Dismissal during entrance cannot resurrect the bubble', (controller, clock) => {
  controller.show('Early dismissal');
  const container = controller.container;
  controller.dismiss();
  clock.tick(300);
  container.dispatchEvent(new Event('animationend'));
  clock.tick(4000);
  assert(controller.state === 'offscreen' && !controller.container, 'Entrance listener must not run during exit');
  assert(clock.size === 0, 'Dismissed mascot must not retain timers');
});

await test('Action callback works on every reminder', (controller, clock) => {
  const actions = [];
  controller.onUserAction = action => actions.push(action);
  for (let index = 0; index < 2; index++) {
    controller.show('Break reminder', { behavior: 'persistent' });
    finishEntrance(controller, clock);
    controller.dismiss('break');
    clock.tick(4000);
  }
  assert(actions.join(',') === 'break,break', `Expected two actions, received ${actions}`);
});

await test('Replacing a preview cancels stale lifecycle timers', (controller, clock) => {
  controller.testTrigger('break');
  clock.tick(1000);
  controller.testTrigger('hydration');
  clock.tick(2500);
  assert(controller.state === (controller.reducedMotion ? 'visible' : 'entering'), 'Old entrance fallback must not change the new mascot lifecycle');
  assert(controller.container.dataset.category === 'HYDRATION', 'The replacement preview must still be active');
});

await test('Disabling the mascot clears queued reminders and timers', (controller, clock) => {
  controller.show('First');
  controller.show('Queued', { category: 'HYDRATION' });
  controller.updateSettings({ enabled: false });
  clock.tick(10000);
  assert(!controller.container && controller.messageQueue.length === 0, 'Disabled mascot must stay hidden');
  assert(clock.size === 0, 'Disabling must cancel all timers');
  controller.show('Disabled');
  assert(!controller.container, 'Direct show must respect the enabled setting');
});

await test('Message text cannot insert HTML from a video title or custom message', controller => {
  const text = '<strong>Video title, not markup</strong>';
  controller.show(text);
  const message = controller.speechBubble.querySelector('.fg-mascot-speech-text');
  assert(message.textContent === text && message.children.length === 0, 'Message must be rendered as text');
});

await test('Test categories normalize to their configured labels', controller => {
  controller.testTrigger('hydration');
  assert(controller.container.dataset.category === 'HYDRATION', 'Test Lab categories must match the category registry');
  assert(controller.speechBubble.textContent.includes('Hydration Reminder'), 'Correct reminder heading must be shown');
});

await test('Keyboard focus pauses transient dismissal and Escape closes it', (controller, clock) => {
  controller.show('Read this reminder');
  finishEntrance(controller, clock);
  const close = controller.speechBubble.querySelector('button');
  close.focus();
  clock.tick(12000);
  assert(controller.state === 'visible', 'Reminder must remain while keyboard focus is inside');
  close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  clock.tick(4000);
  assert(!controller.container, 'Escape must dismiss the reminder');
});

await test('Taking a break pauses the video; transient reminders do not', (controller, clock) => {
  const video = document.createElement('video');
  let pauses = 0;
  Object.defineProperty(video, 'paused', { get: () => pauses > 0 });
  video.pause = () => { pauses++; };
  document.body.appendChild(video);
  controller.show('Stretch your legs');
  finishEntrance(controller, clock);
  assert(pauses === 0, 'Gentle reminder must not interrupt playback');
  const button = controller.speechBubble.querySelector('[data-action="break"]');
  assert(button, 'Transient reminders need an actionable break button');
  button.click();
  assert(pauses === 1, 'Taking a break must pause playback');
});

await test('Reduced motion disables sprite cycling and shows the bubble immediately', (controller, clock) => {
  const matchMedia = window.matchMedia;
  window.matchMedia = query => ({ matches: query === '(prefers-reduced-motion: reduce)' });
  try {
    controller.show('Reduced motion reminder');
    clock.tick(1);
    assert(controller.animator.intervalId === null, 'Reduced motion must not animate PNG frames');
    assert(controller.state === 'visible' && controller.speechBubble.classList.contains('visible'), 'Reduced motion must not wait for an animation fallback');
    controller.dismiss();
    clock.tick(1);
    assert(!controller.container, 'Reduced motion dismissal should not wait for an animation');
  } finally {
    window.matchMedia = matchMedia;
  }
});

await test('Unknown mascot IDs fall back to Finn and all registered PNG assets load', async () => {
  const fallback = createCharacterElement('missing');
  assert(fallback.alt === 'Finn', 'Unknown mascot must use the default character');
  const animator = new MascotAnimator(fallback, 'missing');
  animator.setIdle();
  animator.setExit();
  animator.stop();
  const paths = new Set(Object.values(MASCOTS).flatMap(mascot => [mascot.idle, mascot.back, ...mascot.walkFrames]));
  await Promise.all([...paths].map(async path => {
    const image = new Image();
    image.src = runtime.getURL(path);
    await image.decode();
    assert(image.naturalWidth > 0, `Asset failed to load: ${path}`);
  }));
});

async function withReminderFixture(parameters, run) {
  const iframe = document.createElement('iframe');
  iframe.width = '800';
  iframe.height = '600';
  iframe.src = `./reminder-fixture.html?${parameters}`;
  const loaded = new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }));
  document.body.appendChild(iframe);
  try {
    await loaded;
    const fixture = iframe.contentWindow;
    await fixture.fixtureReady;
    const settle = () => new Promise(resolve => fixture.setTimeout(resolve, 30));
    await run(fixture, settle);
  } finally {
    iframe.remove();
  }
}

await test('Watch timer shows one walking mascot instead of the legacy reminder', async () => {
  await withReminderFixture('', async (fixture, settle) => {
    fixture.advanceWatch(15 * 60 * 1000);
    await settle();
    const document = fixture.document;
    assert(document.querySelectorAll('#fg-mascot-container').length === 1, 'Timer must show exactly one mascot');
    assert(!document.getElementById('youtube-time-reminder'), 'Legacy panel must not appear alongside mascot');
    assert(document.querySelector('.fg-mascot-img'), 'Timed reminder must contain the mascot image');
    assert(document.querySelector('.fg-mascot-speech-text').textContent.includes('15 minutes'), 'Reminder must show actual watch time');
    assert(fixture.videoPaused, 'Persistent reminder must pause the video');
    document.querySelector('[data-action="continue"]').click();
    await settle();
    assert(!fixture.videoPaused, 'Continue Watching must resume playback');
    assert(fixture.sentMessages.filter(message => message.action === 'continueReminder').length === 1, 'Continue must update stats once');
    fixture.advanceWatch(15 * 60 * 1000);
    await settle();
    document.querySelector('[data-action="break"]').click();
    await settle();
    assert(fixture.videoPaused, 'Taking a break must leave playback paused');
    assert(fixture.sentMessages.filter(message => message.action === 'takeBreak').length === 1, 'Subsequent reminders must still update stats');
  });
});

await test('Disabled mascot uses the existing text-panel fallback', async () => {
  await withReminderFixture('mascot=false', async (fixture, settle) => {
    fixture.advanceWatch(15 * 60 * 1000);
    await settle();
    assert(fixture.document.getElementById('youtube-time-reminder'), 'Disabled mascot must preserve timer reminders');
    assert(!fixture.document.getElementById('fg-mascot-container'), 'Disabled mascot must not render');
  });
});

await test('Disabling timer reminders or the break category prevents duplicate break triggers', async () => {
  for (const parameters of ['reminders=false', 'breaks=false']) {
    await withReminderFixture(parameters, async (fixture, settle) => {
      fixture.advanceWatch(15 * 60 * 1000);
      await settle();
      assert(!fixture.document.querySelector('#fg-mascot-container, #youtube-time-reminder'), `${parameters} must suppress break reminders`);
    });
  }
});

await test('Disabling timer reminders dismisses an active mascot break reminder', async () => {
  await withReminderFixture('', async (fixture, settle) => {
    fixture.advanceWatch(15 * 60 * 1000);
    await settle();
    await fixture.sendExtensionMessage({ action: 'toggleTimeReminder', enabled: false });
    await settle();
    assert(!fixture.document.getElementById('fg-mascot-container'), 'Turning reminders off must dismiss the active break reminder');
  });
});

await test('Preview actions never pause playback or invoke real user actions', (controller, clock) => {
  const video = document.createElement('video');
  let pauses = 0;
  video.pause = () => { pauses++; };
  Object.defineProperty(video, 'paused', { value: false });
  document.body.appendChild(video);
  let actions = 0;
  controller.onUserAction = () => { actions++; };
  const response = controller.testTrigger('break', 'waving', 'Preview', 'walk', 'persistent');
  assert(response.ok, response.message);
  finishEntrance(controller, clock);
  controller.speechBubble.querySelector('[data-action="break"]').click();
  clock.tick(4000);
  assert(pauses === 0 && actions === 0, `Preview invoked ${pauses} pauses and ${actions} real callbacks`);
});

await test('Clear preview removes timers but leaves real reminders untouched', (controller, clock) => {
  controller.testTrigger('hydration');
  controller.clearPreview();
  clock.tick(10000);
  assert(!controller.container && clock.size === 0, 'Preview cleanup must cancel pending timers');
  controller.show('Real reminder', { behavior: 'persistent' });
  const real = controller.container;
  controller.clearPreview();
  assert(controller.container === real && real.isConnected, 'Real reminder must remain');
  const response = controller.testTrigger('hydration');
  assert(!response.ok && response.status === 'skipped', 'Preview must not replace a real reminder');
});

await test('Disabled categories return a skipped result without rendering', controller => {
  controller.updateSettings({ categories: { HYDRATION: false } });
  const response = controller.testTrigger('hydration');
  assert(!response.ok && response.status === 'skipped', response.message);
  assert(!controller.container, 'Disabled category must not render');
});

await test('Break previews remain isolated with both mascot and fallback dialog', async () => {
  for (const parameters of ['', 'mascot=false']) {
    await withReminderFixture(parameters, async (fixture, settle) => {
      const response = await fixture.sendExtensionMessage({ action: 'testTriggerBreakReminder' });
      await settle();
      assert(response.ok, `${parameters}: ${response.message}`);
      assert(!fixture.videoPaused, 'Preview must not pause playback');
      fixture.document.querySelector('[data-action="break"], .take-break').click();
      await settle();
      assert(!fixture.sentMessages.some(message => message.action === 'takeBreak'), 'Preview must not request tab closure or saved stats');
      assert(!fixture.videoPaused, 'Preview button must not pause playback');
    });
  }
});

await test('Hard-lock preview cleanup does not remove a real allowance lock', async () => {
  await withReminderFixture('', async (fixture, settle) => {
    let response = await fixture.sendExtensionMessage({ action: 'testShowHardBlock' });
    assert(response.ok, response.message);
    assert(!fixture.videoPaused, 'Preview hard lock must not pause playback');
    assert(!fixture.document.querySelector('#youtube-hard-block a[href]'), 'Preview hard lock must not open external tabs');
    await fixture.sendExtensionMessage({ action: 'testClearYouTubePreviews' });
    assert(!fixture.document.getElementById('youtube-hard-block'), 'Preview must clear');
    await fixture.sendExtensionMessage({ action: 'testTriggerBreakReminder' });
    await settle();
    await fixture.sendExtensionMessage({ action: 'testClearYouTubePreviews' });
    assert(!fixture.document.querySelector('[data-preview="true"]'), 'All YouTube preview UI must clear');
  });
  await withReminderFixture('coding=true', async fixture => {
    const real = fixture.document.getElementById('youtube-hard-block');
    assert(real && real.dataset.preview !== 'true', 'Fixture must start with a real allowance lock');
    await fixture.sendExtensionMessage({ action: 'testClearYouTubePreviews' });
    assert(real.isConnected, 'Clear previews must not unlock a real allowance lock');
    const response = await fixture.sendExtensionMessage({ action: 'testShowHardBlock' });
    assert(!response.ok && response.status === 'skipped', 'Preview must not replace the real lock');
  });
});

window.mascotTestResults = results;
document.title = `${results.filter(result => !result.passed).length ? 'FAIL' : 'PASS'} Mascot regression tests`;
