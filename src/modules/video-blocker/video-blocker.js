// modules/video-blocker/video-blocker.js
// Covers the player and keeps the video paused until the user resumes.

import { MESSAGE_CATEGORIES } from '../mascot/mascot-messages.js';

const BLOCKER_ID = 'fg-video-blocker';
const COUNTDOWN_SECONDS = 20;
const SECOND_MS = 1000;
const NAVIGATE_START_EVENT = 'yt-navigate-start';
const NAVIGATE_FINISH_EVENT = 'yt-navigate-finish';
const PLAYER_VIDEO_SELECTOR = '#movie_player video';

const BLOCK_TYPES = {
  [MESSAGE_CATEGORIES.HYDRATION]: { art: 'water', message: 'Time for a glass of water.' },
  [MESSAGE_CATEGORIES.EYE_STRAIN]: { art: 'stretch', message: 'Stand up, stretch, and rest your eyes.' },
  [MESSAGE_CATEGORIES.BREAK]: { art: 'break', message: 'Step away from the screen for a moment.' },
  [MESSAGE_CATEGORIES.STOP_WATCHING]: { art: 'stop', message: 'You have reached today’s watch limit.', snooze: 'Watch 5 more min' },
};

// Thumbnail hover previews are also <video> elements and can come first in the DOM.
export function findPlayerVideo() {
  return document.querySelector(PLAYER_VIDEO_SELECTOR) || document.querySelector('video');
}

export class VideoBlocker {
  /**
   * @param {{onSnooze: Function}} handlers - Called when the user extends the stop-watching limit
   */
  constructor({ onSnooze }) {
    this.onSnooze = onSnooze;
    this.overlay = null;
    this.video = null;
    this.countdownTimer = null;
    this.keepPaused = () => this.video.pause();
    // Navigation tears the overlay down, then puts the same block on the next page, so a click on another video cannot skip it.
    this.restoreAfterNavigation = () => {
      const { category } = this.overlay.dataset;
      this.remove();
      document.addEventListener(NAVIGATE_FINISH_EVENT, () => this.show(category), { once: true });
    };
  }

  get active() {
    return Boolean(this.overlay);
  }

  /**
   * @param {string} category - From MESSAGE_CATEGORIES
   * @returns {boolean} Whether the block is now shown
   */
  show(category) {
    const type = BLOCK_TYPES[category];
    const video = findPlayerVideo();
    if (!type || this.overlay || !video) return false;

    this.video = video;
    video.pause();
    video.addEventListener('play', this.keepPaused);
    document.addEventListener(NAVIGATE_START_EVENT, this.restoreAfterNavigation);

    this.overlay = document.createElement('div');
    this.overlay.id = BLOCKER_ID;
    this.overlay.dataset.category = category;
    this.overlay.setAttribute('role', 'alertdialog');
    this.overlay.setAttribute('aria-label', type.message);
    this.overlay.innerHTML = `
      <div class="fg-video-blocker-art" aria-hidden="true"></div>
      <p class="fg-video-blocker-message"></p>
      <p class="fg-video-blocker-countdown" aria-live="polite"></p>
      <button type="button" class="fg-video-blocker-action" hidden></button>
    `;
    this.loadArt(type.art, this.overlay.querySelector('.fg-video-blocker-art'));
    this.overlay.querySelector('.fg-video-blocker-message').textContent = type.message;
    this.overlay.addEventListener('click', event => event.stopPropagation());
    this.overlay.addEventListener('keydown', event => event.stopPropagation());

    const action = this.overlay.querySelector('button');
    action.addEventListener('click', () => {
      if (type.snooze) this.onSnooze();
      this.resume();
    });
    if (type.snooze) {
      action.textContent = type.snooze;
      action.hidden = false;
    } else {
      action.textContent = 'Resume';
      this.startCountdown(action);
    }

    const player = video.closest('#movie_player') || video.parentElement;
    if (document.fullscreenElement && !document.fullscreenElement.contains(player)) document.exitFullscreen().catch(() => {});
    player.appendChild(this.overlay);
    return true;
  }

  // Inline rather than <img>: media queries inside an SVG image do not reliably follow the page's reduced-motion setting.
  async loadArt(name, target) {
    try {
      const response = await fetch(browser.runtime.getURL(`video-blocker/${name}.svg`));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const art = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement;
      target.appendChild(document.importNode(art, true));
    } catch (error) {
      console.warn('[VideoBlocker] Art failed to load:', error);
    }
  }

  startCountdown(action) {
    const countdown = this.overlay.querySelector('.fg-video-blocker-countdown');
    const tick = secondsLeft => {
      if (secondsLeft > 0) {
        countdown.textContent = `Resume in ${secondsLeft}s`;
        this.countdownTimer = setTimeout(() => tick(secondsLeft - 1), SECOND_MS);
        return;
      }
      countdown.textContent = '';
      action.hidden = false;
      action.focus({ preventScroll: true });
    };
    tick(COUNTDOWN_SECONDS);
  }

  resume() {
    const video = this.video;
    this.remove();
    video?.play().catch(() => {});
  }

  remove() {
    if (!this.overlay) return;
    clearTimeout(this.countdownTimer);
    this.video.removeEventListener('play', this.keepPaused);
    document.removeEventListener(NAVIGATE_START_EVENT, this.restoreAfterNavigation);
    this.overlay.remove();
    this.overlay = null;
    this.video = null;
  }
}
