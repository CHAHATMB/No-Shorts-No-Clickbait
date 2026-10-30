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

// The grace period starts once the page has shown the reminder, not when it was delivered.
export function deferEscalation(session, totalWatchTimeToday, now = Date.now()) {
  if (!session.escalation) return session;
  return { ...session, escalation: { ...session.escalation, watchTime: totalWatchTimeToday, deliveredAt: now } };
}

export function snoozeStopWatching(session, totalWatchTimeToday) {
  if (!(totalWatchTimeToday >= session.stopAllowedUntil)) return session;
  return { ...session, stopAllowedUntil: totalWatchTimeToday + STOP_SNOOZE_MS };
}

const blockReminder = (category, session) => ({ category, behavior: BLOCK_BEHAVIOR, sessionStartTime: session.sessionStartTime });

/**
 * Blocks only, for a page that can show a block but not a mascot (e.g. fullscreen).
 * An escalation still in the returned session is pending.
 * @returns {{session: Object, reminder: Object|null}}
 */
export function selectBlock(session, totalWatchTimeToday, settings, now = Date.now()) {
  const stopEnabled = settings.mascotEnabled !== false && settings.mascotCategories?.[MESSAGE_CATEGORIES.STOP_WATCHING] !== false;
  if (stopEnabled && totalWatchTimeToday >= session.stopAllowedUntil) {
    return { session, reminder: blockReminder(MESSAGE_CATEGORIES.STOP_WATCHING, session) };
  }
  if (!session.escalation) return { session, reminder: null };
  const outcome = escalateReminder(session.escalation, totalWatchTimeToday, now);
  if (outcome === 'pending') return { session, reminder: null };
  return {
    session: { ...session, escalation: null },
    reminder: outcome === 'ignored' ? blockReminder(session.escalation.category, session) : null,
  };
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
  const { totalWatchTimeToday } = stats;
  const escalate = category => ({ category, watchTime: totalWatchTimeToday, deliveredAt: now });

  const blocked = selectBlock(session, totalWatchTimeToday, settings, now);
  if (blocked.reminder || blocked.session.escalation) return blocked;
  session = blocked.session;

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
  // Once the limit is set, selectBlock owns it; a re-fired stop trigger would only shadow lower-priority reminders.
  if (Number.isFinite(session.stopAllowedUntil)) triggerManager.setCategoryEnabled(MESSAGE_CATEGORIES.STOP_WATCHING, false);
  const trigger = triggerManager.evaluate({ ...stats, timerInterval, breakReminderManaged: true });
  const next = { ...session, triggers: triggerManager.exportState() };
  if (trigger?.category === MESSAGE_CATEGORIES.STOP_WATCHING) {
    return { session: { ...next, stopAllowedUntil: totalWatchTimeToday }, reminder: blockReminder(trigger.category, session) };
  }
  if (ESCALATING_CATEGORIES.includes(trigger?.category)) next.escalation = escalate(trigger.category);
  return {
    session: next,
    reminder: trigger && { category: trigger.category, behavior: trigger.behavior, sessionStartTime: session.sessionStartTime },
  };
}
