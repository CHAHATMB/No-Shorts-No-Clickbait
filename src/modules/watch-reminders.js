// modules/watch-reminders.js
// Global watch-time counting rule and reminder selection, owned by the background.

import { MESSAGE_CATEGORIES } from './mascot/mascot-messages.js';
import { TriggerManager } from './mascot/mascot-triggers.js';

export const MINUTE_MS = 60 * 1000;
export const MAX_WATCH_TICK_MS = MINUTE_MS;
export const SESSION_GAP_MS = 5 * MINUTE_MS;
const DEFAULT_TIMER_INTERVAL_MINUTES = 15;

export function isCountedWatchTab(tab, focusedWindow) {
  return Boolean(tab?.active && focusedWindow?.focused && tab.windowId === focusedWindow.id);
}

export function clampWatchTick(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(amount, MAX_WATCH_TICK_MS);
}

export function continueWatchSession(saved, today, now = Date.now()) {
  if (saved?.date !== today) {
    return { date: today, lastBreakWatchTime: 0, sessionStartTime: now, lastTickTime: now, triggers: {} };
  }
  const sessionStartTime = now - saved.lastTickTime > SESSION_GAP_MS ? now : saved.sessionStartTime;
  return { ...saved, sessionStartTime, lastTickTime: now };
}

/**
 * Pick at most one reminder for the counted tab and record it in the session
 * so no other tab, reload, or service worker restart can fire it again.
 * @param {Object} session - From continueWatchSession
 * @param {{totalWatchTimeToday: number, continueCountToday: number, breaksTakenToday: number}} stats
 * @param {{timeReminderEnabled?: boolean, timerInterval?: number, mascotEnabled?: boolean, mascotCategories?: Object}} settings
 * @returns {{session: Object, reminder: {category: string, behavior: string, sessionStartTime: number}|null}}
 */
export function selectReminder(session, stats, settings) {
  const timerInterval = settings.timerInterval || DEFAULT_TIMER_INTERVAL_MINUTES;
  const intervalMs = timerInterval * MINUTE_MS;
  const mascotEnabled = settings.mascotEnabled !== false;
  const categories = settings.mascotCategories || {};
  const breakEnabled = settings.timeReminderEnabled !== false &&
    (!mascotEnabled || categories[MESSAGE_CATEGORIES.BREAK] !== false);
  const { totalWatchTimeToday } = stats;

  if (breakEnabled && totalWatchTimeToday >= intervalMs && totalWatchTimeToday - session.lastBreakWatchTime >= intervalMs) {
    return {
      session: { ...session, lastBreakWatchTime: totalWatchTimeToday },
      reminder: { category: MESSAGE_CATEGORIES.BREAK, behavior: 'persistent', sessionStartTime: session.sessionStartTime },
    };
  }
  if (!mascotEnabled) return { session, reminder: null };

  const triggerManager = new TriggerManager();
  triggerManager.restoreState(session.triggers);
  triggerManager.sessionStartTime = session.sessionStartTime;
  for (const [category, enabled] of Object.entries(categories)) {
    triggerManager.setCategoryEnabled(category, enabled);
  }
  const trigger = triggerManager.evaluate({ ...stats, timerInterval, breakReminderManaged: true });
  return {
    session: { ...session, triggers: triggerManager.exportState() },
    reminder: trigger && { category: trigger.category, behavior: trigger.behavior, sessionStartTime: session.sessionStartTime },
  };
}
