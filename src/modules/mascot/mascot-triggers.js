/**
 * @fileoverview Trigger system for the mascot companion.
 * Determines WHEN and WHY the mascot should appear based on
 * user watch patterns, time of day, and escalation state.
 */

import { MESSAGE_CATEGORIES } from './mascot-messages.js';

/**
 * Default trigger configuration. Can be overridden via user settings.
 * @type {Object}
 */
const DEFAULT_TRIGGER_CONFIG = {
  hydrationIntervalMs: 30 * 60 * 1000,    // Every 30 min of watching
  eyeStrainIntervalMs: 20 * 60 * 1000,    // Every 20 min continuous session
  breakIntervalMs: null,                    // Uses user's timerInterval setting
  stopWatchingThresholdMs: 60 * 60 * 1000, // After 60 min total today
  stopWatchingMinDismissals: 2,            // + at least 2 dismissed reminders
  lateNightStartHour: 23,                  // 11 PM
  lateNightMinWatchMs: 10 * 60 * 1000,    // 10 min of watching after start hour
  milestoneIntervalMs: 30 * 60 * 1000,    // Every 30 min total (cumulative)
};

/**
 * Manages trigger evaluation, cooldowns, and escalation.
 */
export class TriggerManager {
  /**
   * @param {Object} [config] - Override default trigger configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_TRIGGER_CONFIG, ...config };

    /** @type {Map<string, number>} Category -> last trigger timestamp */
    this.cooldowns = new Map();

    /** @type {Set<string>} Enabled trigger categories */
    this.enabledCategories = new Set([
      MESSAGE_CATEGORIES.HYDRATION,
      MESSAGE_CATEGORIES.EYE_STRAIN,
      MESSAGE_CATEGORIES.BREAK,
      MESSAGE_CATEGORIES.STOP_WATCHING,
      MESSAGE_CATEGORIES.LATE_NIGHT,
    ]);

    /** @type {number} Session start timestamp (reset on page load) */
    this.sessionStartTime = Date.now();

    /** @type {number} Last milestone threshold crossed (in ms) */
    this.lastMilestoneThreshold = 0;

    /** @type {number} Last total watch time we evaluated against */
    this.lastEvaluatedWatchTime = 0;

    /** @type {boolean} Whether a persistent mascot is currently showing */
    this.isPersistentActive = false;
  }

  /**
   * Update trigger configuration (e.g., from user settings).
   * @param {Object} newConfig
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
  }

  /**
   * Enable or disable specific trigger categories.
   * @param {string} category - Category from MESSAGE_CATEGORIES
   * @param {boolean} enabled
   */
  setCategoryEnabled(category, enabled) {
    if (enabled) {
      this.enabledCategories.add(category);
    } else {
      this.enabledCategories.delete(category);
    }
  }

  /**
   * Mark that a persistent mascot is currently showing (blocks new triggers).
   * @param {boolean} active
   */
  setPersistentActive(active) {
    this.isPersistentActive = active;
  }

  /**
   * Check if a category is in cooldown.
   * @param {string} category
   * @param {number} cooldownMs
   * @returns {boolean}
   */
  isInCooldown(category, cooldownMs) {
    const lastTrigger = this.cooldowns.get(category);
    if (!lastTrigger) return false;
    return (Date.now() - lastTrigger) < cooldownMs;
  }

  /**
   * Record that a trigger just fired for a category.
   * @param {string} category
   */
  recordTrigger(category) {
    this.cooldowns.set(category, Date.now());
  }

  /**
   * Get current session duration in milliseconds.
   * @returns {number}
   */
  getSessionDuration() {
    return Date.now() - this.sessionStartTime;
  }

  /**
   * Evaluate all trigger rules and return the highest priority trigger to fire.
   * Called periodically from the time tracking loop.
   *
   * @param {Object} context - Current state
   * @param {number} context.totalWatchTimeToday - Total watch time today in ms
   * @param {number} context.continueCountToday - Times user dismissed reminders today
   * @param {number} context.breaksTakenToday - Breaks taken today
   * @param {number} context.timerInterval - User's configured timer interval in minutes
   * @param {number} context.moneyWasted - Calculated money wasted (rupees)
   * @param {string} context.videoTitle - Current video title
   * @returns {Object|null} Trigger result: { category, behavior, priority } or null
   */
  evaluate(context) {
    // Don't fire new triggers if a persistent mascot is already showing
    if (this.isPersistentActive) return null;

    const now = new Date();
    const currentHour = now.getHours();
    const sessionMs = this.getSessionDuration();
    const triggers = [];

    // --- STOP WATCHING (highest priority) ---
    if (this.enabledCategories.has(MESSAGE_CATEGORIES.STOP_WATCHING)) {
      const threshold = this.config.stopWatchingThresholdMs;
      const minDismissals = this.config.stopWatchingMinDismissals;
      const cooldown = 15 * 60 * 1000; // 15 min cooldown

      if (
        context.totalWatchTimeToday >= threshold &&
        context.continueCountToday >= minDismissals &&
        !this.isInCooldown(MESSAGE_CATEGORIES.STOP_WATCHING, cooldown)
      ) {
        triggers.push({
          category: MESSAGE_CATEGORIES.STOP_WATCHING,
          behavior: 'persistent',
          priority: 100,
        });
      }
    }

    // --- LATE NIGHT ---
    if (this.enabledCategories.has(MESSAGE_CATEGORIES.LATE_NIGHT)) {
      const startHour = this.config.lateNightStartHour;
      const minWatch = this.config.lateNightMinWatchMs;
      const cooldown = 30 * 60 * 1000; // 30 min cooldown
      const isLateNight = currentHour >= startHour || currentHour < 5;

      if (
        isLateNight &&
        context.totalWatchTimeToday >= minWatch &&
        !this.isInCooldown(MESSAGE_CATEGORIES.LATE_NIGHT, cooldown)
      ) {
        // Persistent after midnight, transient before
        const behavior = currentHour >= 0 && currentHour < 5 ? 'persistent' : 'transient';
        triggers.push({
          category: MESSAGE_CATEGORIES.LATE_NIGHT,
          behavior,
          priority: 90,
        });
      }
    }

    // --- BREAK REMINDER ---
    if (this.enabledCategories.has(MESSAGE_CATEGORIES.BREAK)) {
      const intervalMs = (context.timerInterval || 15) * 60 * 1000;
      const cooldown = intervalMs;

      if (
        context.totalWatchTimeToday >= intervalMs &&
        !this.isInCooldown(MESSAGE_CATEGORIES.BREAK, cooldown)
      ) {
        // Check if we've crossed a new interval threshold
        const currentIntervals = Math.floor(context.totalWatchTimeToday / intervalMs);
        const lastIntervals = Math.floor(this.lastEvaluatedWatchTime / intervalMs);

        if (currentIntervals > lastIntervals) {
          triggers.push({
            category: MESSAGE_CATEGORIES.BREAK,
            behavior: 'transient',
            priority: 50,
          });
        }
      }
    }

    // --- HYDRATION ---
    if (this.enabledCategories.has(MESSAGE_CATEGORIES.HYDRATION)) {
      const intervalMs = this.config.hydrationIntervalMs;
      const cooldown = intervalMs;

      if (
        context.totalWatchTimeToday >= intervalMs &&
        !this.isInCooldown(MESSAGE_CATEGORIES.HYDRATION, cooldown)
      ) {
        const currentIntervals = Math.floor(context.totalWatchTimeToday / intervalMs);
        const lastIntervals = Math.floor(this.lastEvaluatedWatchTime / intervalMs);

        if (currentIntervals > lastIntervals) {
          triggers.push({
            category: MESSAGE_CATEGORIES.HYDRATION,
            behavior: 'transient',
            priority: 30,
          });
        }
      }
    }

    // --- EYE STRAIN ---
    if (this.enabledCategories.has(MESSAGE_CATEGORIES.EYE_STRAIN)) {
      const intervalMs = this.config.eyeStrainIntervalMs;
      const cooldown = intervalMs;

      if (
        sessionMs >= intervalMs &&
        !this.isInCooldown(MESSAGE_CATEGORIES.EYE_STRAIN, cooldown)
      ) {
        // Check session-based intervals
        const currentIntervals = Math.floor(sessionMs / intervalMs);
        const lastTrigger = this.cooldowns.get(MESSAGE_CATEGORIES.EYE_STRAIN) || this.sessionStartTime;
        const sinceLastTrigger = Date.now() - lastTrigger;

        if (sinceLastTrigger >= intervalMs) {
          triggers.push({
            category: MESSAGE_CATEGORIES.EYE_STRAIN,
            behavior: 'transient',
            priority: 40,
          });
        }
      }
    }

    // Update tracked watch time
    this.lastEvaluatedWatchTime = context.totalWatchTimeToday;

    // Return highest priority trigger, or null if none
    if (triggers.length === 0) return null;

    triggers.sort((a, b) => b.priority - a.priority);
    const selected = triggers[0];

    // Record the trigger
    this.recordTrigger(selected.category);

    return selected;
  }

  /**
   * Reset all cooldowns (e.g., on page navigation).
   */
  resetCooldowns() {
    this.cooldowns.clear();
    this.sessionStartTime = Date.now();
    this.lastEvaluatedWatchTime = 0;
    this.lastMilestoneThreshold = 0;
  }

  /**
   * Get debug info about current trigger state.
   * @returns {Object}
   */
  getDebugState() {
    const cooldownState = {};
    for (const [cat, time] of this.cooldowns) {
      cooldownState[cat] = {
        lastTrigger: new Date(time).toISOString(),
        agoMs: Date.now() - time,
      };
    }
    return {
      enabledCategories: [...this.enabledCategories],
      cooldowns: cooldownState,
      sessionDurationMs: this.getSessionDuration(),
      isPersistentActive: this.isPersistentActive,
      lastEvaluatedWatchTime: this.lastEvaluatedWatchTime,
    };
  }
}
