/**
 * @fileoverview MascotController — the central orchestrator for the mascot companion.
 * Manages the character's lifecycle: DOM injection, animation state machine,
 * speech bubbles, video control, and user interactions.
 */

import {
  createCharacterElement,
  MascotAnimator,
  getRandomEntrance,
  preloadMascotAssets,
  DEFAULT_MASCOT_ID,
} from './mascot-character.js';
import { MESSAGE_CATEGORIES, buildContext, selectMessage } from './mascot-messages.js';
import { TriggerManager } from './mascot-triggers.js';

// Inline the CSS as a string to inject into the page
// (webpack won't process CSS imports in content scripts the same way)
const MASCOT_STYLES_ID = 'fg-mascot-styles';

/**
 * @typedef {Object} MascotShowOptions
 * @property {string} category - Message category from MESSAGE_CATEGORIES
 * @property {'transient'|'persistent'} behavior - Whether mascot stays or leaves
 * @property {string} [entrance] - Entrance animation type (walk/slide/jump/pop)
 * @property {number} [displayDuration] - How long to show transient messages (ms)
 * @property {boolean} [pauseVideo] - Whether to pause the video
 */

/**
 * State machine states for the mascot.
 * @enum {string}
 */
const MascotState = {
  OFFSCREEN: 'offscreen',
  ENTERING: 'entering',
  VISIBLE: 'visible',
  EXITING: 'exiting',
};

/**
 * Category icon mapping for the speech bubble header.
 */
const CATEGORY_ICONS = {
  [MESSAGE_CATEGORIES.HYDRATION]: '💧',
  [MESSAGE_CATEGORIES.EYE_STRAIN]: '👀',
  [MESSAGE_CATEGORIES.BREAK]: '🧘',
  [MESSAGE_CATEGORIES.STOP_WATCHING]: '🛑',
  [MESSAGE_CATEGORIES.LATE_NIGHT]: '🌙',
};

const CATEGORY_LABELS = {
  [MESSAGE_CATEGORIES.HYDRATION]: 'Hydration Reminder',
  [MESSAGE_CATEGORIES.EYE_STRAIN]: 'Eye Care',
  [MESSAGE_CATEGORIES.BREAK]: 'Break Time',
  [MESSAGE_CATEGORIES.STOP_WATCHING]: 'Time to Stop',
  [MESSAGE_CATEGORIES.LATE_NIGHT]: 'Late Night',
};

/**
 * Maps message category to the character pose to use.
 */
const CATEGORY_POSES = {
  [MESSAGE_CATEGORIES.HYDRATION]: 'drinking',
  [MESSAGE_CATEGORIES.EYE_STRAIN]: 'talking',
  [MESSAGE_CATEGORIES.BREAK]: 'waving',
  [MESSAGE_CATEGORIES.STOP_WATCHING]: 'stern',
  [MESSAGE_CATEGORIES.LATE_NIGHT]: 'sleepy',
};

/**
 * Maps message category to exit pose.
 */
const CATEGORY_EXIT_POSES = {
  [MESSAGE_CATEGORIES.HYDRATION]: 'waving',
  [MESSAGE_CATEGORIES.EYE_STRAIN]: 'waving',
  [MESSAGE_CATEGORIES.BREAK]: 'waving',
  [MESSAGE_CATEGORIES.STOP_WATCHING]: 'walking',
  [MESSAGE_CATEGORIES.LATE_NIGHT]: 'sleepy',
};

export class MascotController {
  constructor() {
    /** @type {MascotState} */
    this.state = MascotState.OFFSCREEN;

    /** @type {string} */
    this.mascotId = DEFAULT_MASCOT_ID;

    /** @type {MascotAnimator|null} */
    this.animator = null;

    /** @type {HTMLElement|null} */
    this.container = null;

    /** @type {HTMLElement|null} */
    this.speechBubble = null;

    /** @type {HTMLElement|null} */
    this.characterEl = null;

    /** @type {TriggerManager} */
    this.triggerManager = new TriggerManager();

    /** @type {Array<string>} Last N message IDs shown */
    this.recentMessageIds = [];

    /** @type {number} Max recent messages to track for dedup */
    this.maxRecentMessages = 5;

    /** @type {Array<Object>} Queue of pending messages */
    this.messageQueue = [];

    /** @type {number|null} Auto-dismiss timer */
    this.autoDismissTimer = null;

    /** @type {string|null} Current entrance animation type */
    this.currentEntrance = null;

    /** @type {boolean} Whether mascot feature is enabled */
    this.enabled = true;

    /** @type {boolean} Whether styles have been injected */
    this.stylesInjected = false;

    /** @type {Function|null} Callback for when user takes an action */
    this.onUserAction = null;
  }

  /**
   * Initialize the mascot system. Call once from content.js.
   */
  init() {
    this.injectStyles();
    preloadMascotAssets(this.mascotId);
  }

  /**
   * Inject mascot CSS into the page.
   */
  injectStyles() {
    if (this.stylesInjected || document.getElementById(MASCOT_STYLES_ID)) {
      this.stylesInjected = true;
      return;
    }

    // Load styles via fetch from extension URL
    const styleEl = document.createElement('link');
    styleEl.id = MASCOT_STYLES_ID;
    styleEl.rel = 'stylesheet';
    styleEl.href = (typeof browser !== 'undefined' ? browser : chrome).runtime.getURL('mascot-styles.css');
    document.head.appendChild(styleEl);
    this.stylesInjected = true;
  }

  /**
   * Show the mascot with a message.
   *
   * @param {string} messageText - The message to display
   * @param {MascotShowOptions} options - Display options
   */
  show(messageText, options = {}) {
    const {
      category = MESSAGE_CATEGORIES.BREAK,
      behavior = 'transient',
      entrance = 'grand',
      displayDuration = 8000,
      pauseVideo = false,
      pose = options.pose || CATEGORY_POSES[category] || 'talking',
    } = options;

    // Queue if already visible
    if (this.state !== MascotState.OFFSCREEN) {
      this.messageQueue.push({ messageText, options });
      return;
    }

    this.state = MascotState.ENTERING;
    this.currentEntrance = entrance;

    // Create DOM structure
    this._createDOM(messageText, category, behavior, entrance);

    // Pause video if requested
    if (pauseVideo || behavior === 'persistent') {
      this._pauseVideo();
    }

    // Set initial pose — use 'idle' during grand entrance to avoid conflicts with walk cycle CSS
    const initialPose = pose || CATEGORY_POSES[category] || 'talking';
    this._setPose(entrance === 'grand' ? 'idle' : initialPose);

    // Start walk frame animation for walk-in
    if (entrance === 'grand' || entrance === 'walk') {
      this.animator?.startWalk('left');
    }

    // Listen for entrance animation end
    const onEnterEnd = (e) => {
      // Ignore animationend events bubbling from child elements (feet, wings, etc.)
      if (e && e.target !== this.container) return;
      this.container.removeEventListener('animationend', onEnterEnd);
      this.state = MascotState.VISIBLE;

      // Stop walk cycle and switch to idle standing pose facing user
      this.animator?.setIdle();
      this._setPose(initialPose);

      // Show speech bubble with delay (longer for grand entrance for dramatic effect)
      const bubbleDelay = entrance === 'grand' ? 500 : 200;
      setTimeout(() => {
        if (this.speechBubble) {
          this.speechBubble.classList.add('visible');

          // Set the context pose now that entrance animation is done
          if (options.pose) {
            this._setPose(options.pose);
          } else {
            this._setPose(initialPose);
          }
        }
      }, bubbleDelay);

      // Auto-dismiss for transient messages
      if (behavior === 'transient') {
        this.autoDismissTimer = setTimeout(() => {
          this.dismiss();
        }, displayDuration);
      }
    };

    this.container.addEventListener('animationend', onEnterEnd);

    // Fallback: if animation doesn't fire (e.g., reduced motion), force visible
    const fallbackDelay = entrance === 'grand' ? 3500 : 1500;
    setTimeout(() => {
      if (this.state === MascotState.ENTERING) {
        onEnterEnd(null);
      }
    }, fallbackDelay);
  }

  /**
   * Evaluate triggers and show mascot if appropriate.
   * Called from the time tracking loop.
   *
   * @param {Object} watchData - Current watch state data
   */
  evaluate(watchData) {
    if (!this.enabled) return;
    if (this.state !== MascotState.OFFSCREEN) return;

    // Don't show in fullscreen
    if (document.fullscreenElement) return;

    const trigger = this.triggerManager.evaluate(watchData);
    if (!trigger) return;

    // Build context for message personalization
    const context = buildContext({
      totalWatchTimeToday: watchData.totalWatchTimeToday,
      sessionStartTime: this.triggerManager.sessionStartTime,
      continueCountToday: watchData.continueCountToday,
      breaksTakenToday: watchData.breaksTakenToday,
      moneyWasted: watchData.moneyWasted || 0,
      videoTitle: this._getVideoTitle(),
    });

    // Select a personalized message
    const message = selectMessage(trigger.category, context, this.recentMessageIds);

    // Track this message ID
    this.recentMessageIds.push(message.id);
    if (this.recentMessageIds.length > this.maxRecentMessages) {
      this.recentMessageIds.shift();
    }

    // Use grand entrance for all triggered appearances
    const entrance = 'grand';

    // Show the mascot
    this.show(message.text, {
      category: trigger.category,
      behavior: trigger.behavior,
      entrance,
      displayDuration: trigger.behavior === 'persistent' ? 0 : 8000,
      pauseVideo: trigger.behavior === 'persistent',
    });

    // Mark persistent active on trigger manager
    if (trigger.behavior === 'persistent') {
      this.triggerManager.setPersistentActive(true);
    }
  }

  /**
   * Dismiss the mascot with exit animation.
   * @param {'continue'|'break'|'close'} [action='close'] - What triggered the dismissal
   */
  dismiss(action = 'close') {
    if (this.state === MascotState.OFFSCREEN || this.state === MascotState.EXITING) return;

    // Clear auto-dismiss timer
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }

    this.state = MascotState.EXITING;

    // Hide speech bubble first
    if (this.speechBubble) {
      this.speechBubble.classList.remove('visible');
    }

    // Switch mascot sprite to exit pose (back facing walking away)
    this.animator?.setExit('right');

    // Set exit pose
    const currentCategory = this.container?.dataset.category;
    const exitPose = CATEGORY_EXIT_POSES[currentCategory] || 'waving';
    this._setPose(exitPose);

    // Determine exit animation (mirror of entrance)
    const exitClass = `fg-mascot-exit-${this.currentEntrance || 'slide'}`;

    // Remove entrance class, add exit class
    setTimeout(() => {
      if (!this.container) return;

      // Remove all entrance/exit classes
      this.container.className = '';
      this.container.id = 'fg-mascot-container';
      this.container.classList.add(exitClass);

      const onExitEnd = (e) => {
        // Ignore animationend events from child elements
        if (e && e.target !== this.container) return;
        this._cleanup();
        this.state = MascotState.OFFSCREEN;
        this.triggerManager.setPersistentActive(false);

        // Fire callback
        if (this.onUserAction) {
          this.onUserAction(action);
          this.onUserAction = null;
        }

        // Process queue
        if (this.messageQueue.length > 0) {
          const next = this.messageQueue.shift();
          setTimeout(() => {
            this.show(next.messageText, next.options);
          }, 500);
        }
      };

      this.container.addEventListener('animationend', onExitEnd);

      // Fallback for reduced motion (longer for grand exit)
      const exitFallback = this.currentEntrance === 'grand' ? 2500 : 1200;
      setTimeout(() => {
        if (this.state === MascotState.EXITING) {
          onExitEnd(null);
        }
      }, exitFallback);
    }, 300); // Delay to let speech bubble fade first
  }

  /**
   * Update mascot settings.
   * @param {Object} settings
   * @param {boolean} [settings.enabled]
   * @param {Object} [settings.categories] - Category enable/disable map
   * @param {Object} [settings.triggerConfig] - Override trigger configuration
   */
  updateSettings(settings) {
    if (settings.enabled !== undefined) {
      this.enabled = settings.enabled;
      if (!this.enabled && this.state !== MascotState.OFFSCREEN) {
        this.dismiss('close');
      }
    }

    if (settings.mascotId && settings.mascotId !== this.mascotId) {
      this.mascotId = settings.mascotId;
      preloadMascotAssets(this.mascotId);
    }

    if (settings.categories) {
      for (const [cat, enabled] of Object.entries(settings.categories)) {
        this.triggerManager.setCategoryEnabled(cat, enabled);
      }
    }

    if (settings.triggerConfig) {
      this.triggerManager.updateConfig(settings.triggerConfig);
    }
  }

  // ========================================
  // Private Methods
  // ========================================

  /**
   * Create the mascot DOM structure and append to page.
   * @private
   */
  _createDOM(messageText, category, behavior, entrance) {
    // Remove any existing container
    this._cleanup();

    // Container
    this.container = document.createElement('div');
    this.container.id = 'fg-mascot-container';
    this.container.dataset.category = category;
    this.container.classList.add(`fg-mascot-enter-${entrance}`);

    // Speech bubble
    this.speechBubble = document.createElement('div');
    this.speechBubble.className = 'fg-mascot-speech-bubble';
    this.speechBubble.innerHTML = `
      <button class="fg-mascot-close" aria-label="Close">✕</button>
      <div class="fg-mascot-category">
        <span>${CATEGORY_ICONS[category] || '💬'}</span>
        <span>${CATEGORY_LABELS[category] || 'Message'}</span>
      </div>
      <div class="fg-mascot-speech-text">${messageText}</div>
      ${behavior === 'persistent' ? `
        <div class="fg-mascot-speech-actions">
          <button class="fg-mascot-btn primary" data-action="break">Take a Break</button>
          <button class="fg-mascot-btn secondary" data-action="continue">Continue</button>
        </div>
      ` : ''}
    `;

    // Character
    this.characterEl = document.createElement('div');
    this.characterEl.className = 'fg-mascot-character';
    const imgEl = createCharacterElement(this.mascotId);
    this.characterEl.appendChild(imgEl);
    this.animator = new MascotAnimator(imgEl, this.mascotId);

    // Assemble
    this.container.appendChild(this.speechBubble);
    this.container.appendChild(this.characterEl);

    // Add pointer events
    this.characterEl.style.pointerEvents = 'all';
    this.characterEl.style.cursor = 'pointer';

    // Event listeners
    this._attachEventListeners(behavior);

    // Append to body
    document.body.appendChild(this.container);
  }

  /**
   * Attach event listeners to mascot DOM elements.
   * @private
   */
  _attachEventListeners(behavior) {
    // Close button
    const closeBtn = this.speechBubble?.querySelector('.fg-mascot-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismiss('close');
      });
    }

    // Action buttons (persistent mode)
    if (behavior === 'persistent') {
      const breakBtn = this.speechBubble?.querySelector('[data-action="break"]');
      const continueBtn = this.speechBubble?.querySelector('[data-action="continue"]');

      if (breakBtn) {
        breakBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dismiss('break');
        });
      }

      if (continueBtn) {
        continueBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Resume video before dismissing
          this._resumeVideo();
          this.dismiss('continue');
        });
      }
    }

    // Character click — dismiss transient messages
    if (this.characterEl && behavior === 'transient') {
      this.characterEl.addEventListener('click', () => {
        this.dismiss('close');
      });
    }

    // Pause auto-dismiss on hover
    if (this.container && behavior === 'transient') {
      this.container.addEventListener('mouseenter', () => {
        if (this.autoDismissTimer) {
          clearTimeout(this.autoDismissTimer);
          this.autoDismissTimer = null;
        }
      });

      this.container.addEventListener('mouseleave', () => {
        if (this.state === MascotState.VISIBLE) {
          this.autoDismissTimer = setTimeout(() => {
            this.dismiss('close');
          }, 3000);
        }
      });
    }
  }

  /**
   * Set the character pose via data attribute.
   * @private
   */
  _setPose(pose) {
    if (this.characterEl) {
      this.characterEl.setAttribute('data-pose', pose);
    }
  }

  /**
   * Get the current video title from the page.
   * @private
   * @returns {string}
   */
  _getVideoTitle() {
    const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                    document.querySelector('h1.ytd-video-primary-info-renderer') ||
                    document.querySelector('#title h1');
    return titleEl?.textContent?.trim() || '';
  }

  /**
   * Pause the currently playing video.
   * @private
   */
  _pauseVideo() {
    const video = document.querySelector('video');
    if (video && !video.paused) {
      video.pause();
    }
  }

  /**
   * Resume the currently paused video.
   * @private
   */
  _resumeVideo() {
    const video = document.querySelector('video');
    if (video && video.paused) {
      video.play().catch(() => {});
    }
  }

  /**
   * Remove mascot DOM elements from the page.
   * @private
   */
  _cleanup() {
    if (this.animator) {
      this.animator.stop();
      this.animator = null;
    }
    const existing = document.getElementById('fg-mascot-container');
    if (existing) {
      existing.remove();
    }
    this.container = null;
    this.speechBubble = null;
    this.characterEl = null;
  }

  /**
   * Directly trigger the mascot for testing and development.
   *
   * @param {string} [category] - Message category (break, hydration, eye_strain, stop_watching, late_night)
   * @param {string} [pose] - Character pose
   * @param {string} [customText] - Custom bubble text
   * @param {string} [entrance] - Entrance animation (slide, walk, jump, pop)
   */
  testTrigger(category, pose, customText, entrance) {
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
    this._cleanup();
    this.state = MascotState.OFFSCREEN;
    this.messageQueue = [];

    const cat = category || MESSAGE_CATEGORIES.BREAK;
    const chosenPose = pose || (cat === MESSAGE_CATEGORIES.HYDRATION ? 'drinking' : (CATEGORY_POSES[cat] || 'talking'));
    const text = customText || `[Test Lab] Testing ${cat} trigger! Keep up the focus.`;

    this.show(text, {
      category: cat,
      pose: chosenPose,
      behavior: 'transient',
      entrance: entrance || 'grand',
      displayDuration: 8000,
      pauseVideo: false,
    });
  }
}
