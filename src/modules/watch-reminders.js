// modules/watch-reminders.js
// Global watch-time counting rule and reminder selection, owned by the background.

import { MESSAGE_CATEGORIES } from './mascot/mascot-messages.js';
import { TriggerManager } from './mascot/mascot-triggers.js';

export const MINUTE_MS = 60 * 1000;
export const MAX_WATCH_TICK_MS = MINUTE_MS;
export const SESSION_GAP_MS = 5 * MINUTE_MS;
const DEFAULT_TIMER_INTERVAL_MINUTES = 15;
export const BLOCK_GRACE_MS = 45 * 1000;
export const ACKNOWLEDGE_PAUSE_MS = 30 * 1000;
export const STOP_SNOOZE_MS = 5 * MINUTE_MS;
export const BLOCK_BEHAVIOR = 'block';
const ESCALATING_CATEGORIES = [MESSAGE_CATEGORIES.HYDRATION, MESSAGE_CATEGORIES.EYE_STRAIN, MESSAGE_CATEGORIES.BREAK];

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
 * A delivered reminder is acknowledged once the video has been paused long enough,
 * and ignored once the user has kept watching for the grace period.
 * @param {{category: string, watchTime: number, deliveredAt: number}} escalation
 * @returns {'acknowledged'|'ignored'|'pending'}
 */
export function escalateReminder(escalation, totalWatchTimeToday, now = Date.now()) {
  const watchedSince = totalWatchTimeToday - escalation.watchTime;
  if (now - escalation.deliveredAt - watchedSince >= ACKNOWLEDGE_PAUSE_MS) return 'acknowledged';
  return watchedSince >= BLOCK_GRACE_MS ? 'ignored' : 'pending';
}

export function snoozeStopWatching(session, totalWatchTimeToday) {
  return { ...session, stopAllowedUntil: totalWatchTimeToday + STOP_SNOOZE_MS };
}

/**
 * Pick at most one reminder for the counted tab and record it in the session
 * so no other tab, reload, or service worker restart can fire it again.
 * @param {Object} session - From continueWatchSession
 * @param {{totalWatchTimeToday: number, continueCountToday: number, breaksTakenToday: number}} stats
 * @param {{timeReminderEnabled?: boolean, timerInterval?: number, mascotEnabled?: boolean, mascotCategories?: Object}} settings
 * @returns {{session: Object, reminder: {category: string, behavior: string, sessionStartTime: number}|null}}
 */
export function selectReminder(session, stats, settings, now = Date.now()) {
  const timerInterval = settings.timerInterval || DEFAULT_TIMER_INTERVAL_MINUTES;
  const intervalMs = timerInterval * MINUTE_MS;
  const mascotEnabled = settings.mascotEnabled !== false;
  const categories = settings.mascotCategories || {};
  const breakEnabled = settings.timeReminderEnabled !== false &&
    (!mascotEnabled || categories[MESSAGE_CATEGORIES.BREAK] !== false);
  const stopEnabled = mascotEnabled && categories[MESSAGE_CATEGORIES.STOP_WATCHING] !== false;
  const { totalWatchTimeToday } = stats;
  const block = category => ({ category, behavior: BLOCK_BEHAVIOR, sessionStartTime: session.sessionStartTime });
  const escalate = category => ({ category, watchTime: totalWatchTimeToday, deliveredAt: now });

  if (stopEnabled && Number.isFinite(session.stopAllowedUntil) && totalWatchTimeToday >= session.stopAllowedUntil) {
    return { session, reminder: block(MESSAGE_CATEGORIES.STOP_WATCHING) };
  }
  if (session.escalation) {
    const outcome = escalateReminder(session.escalation, totalWatchTimeToday, now);
    if (outcome === 'pending') return { session, reminder: null };
    const reminder = outcome === 'ignored' ? block(session.escalation.category) : null;
    session = { ...session, escalation: null };
    if (reminder) return { session, reminder };
  }

  if (breakEnabled && totalWatchTimeToday >= intervalMs && totalWatchTimeToday - session.lastBreakWatchTime >= intervalMs) {
    return {
      session: { ...session, lastBreakWatchTime: totalWatchTimeToday, escalation: escalate(MESSAGE_CATEGORIES.BREAK) },
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
  const next = { ...session, triggers: triggerManager.exportState() };
  if (trigger?.category === MESSAGE_CATEGORIES.STOP_WATCHING) {
    return { session: { ...next, stopAllowedUntil: totalWatchTimeToday }, reminder: block(trigger.category) };
  }
  if (ESCALATING_CATEGORIES.includes(trigger?.category)) next.escalation = escalate(trigger.category);
  return {
    session: next,
    reminder: trigger && { category: trigger.category, behavior: trigger.behavior, sessionStartTime: session.sessionStartTime },
  };
}
