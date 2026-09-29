window.__DEV__ = true;
const parameters = new URLSearchParams(location.search);
let now = Date.now();
Date.now = () => now;
window.sentMessages = [];
window.videoPaused = false;
const video = document.querySelector('video');
Object.defineProperties(video, {
  paused: { get: () => window.videoPaused },
  readyState: { get: () => 4 },
});
video.pause = () => { window.videoPaused = true; };
video.play = async () => { window.videoPaused = false; };
window.matchMedia = () => ({ matches: true });
const originalInterval = window.setInterval;
window.setInterval = (callback, duration) => {
  if (duration === 1000) {
    window.trackingTick = callback;
    return 0;
  }
  return originalInterval(callback, duration);
};
const runtime = {
  id: 'mascot-test',
  getURL(path) {
    const source = path === 'mascot-styles.css'
      ? 'src/modules/mascot/mascot-styles.css'
      : path.replace('mascots/finn/', 'mascots/walk_animation_asset/');
    return new URL(`../${source}`, import.meta.url).href;
  },
  onMessage: { addListener(listener) { window.sendExtensionMessage = listener; } },
  async sendMessage(message) { window.sentMessages.push(message); },
};
window.chrome = { runtime };
window.browser = {
  runtime,
  storage: {
    local: {
      async get() {
        return {
          codingBonusEnabled: parameters.get('coding') === 'true',
          mascotEnabled: parameters.get('mascot') !== 'false',
          timeReminderEnabled: parameters.get('reminders') !== 'false',
          timerInterval: 15,
          mascotCategories: {
            BREAK: parameters.get('breaks') !== 'false',
            HYDRATION: false,
            EYE_STRAIN: false,
            STOP_WATCHING: false,
            LATE_NIGHT: false,
          },
        };
      },
    },
  },
};
history.replaceState(null, '', '/watch?mascot-test');
window.fixtureReady = import('../src/content.js').then(() => {
  window.advanceWatch = duration => {
    window.trackingTick();
    now += duration;
    window.trackingTick();
  };
});
