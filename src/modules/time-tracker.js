// modules/time-tracker.js
// Universal website time tracker - tracks active tab time for all domains

const TIME_TRACKER_ALARM = 'universalTimeTracker';
const TRACKER_INTERVAL_SECONDS = 30; // heartbeat every 30s
const DATA_RETENTION_DAYS = 30;
const MAX_FLUSH_SECONDS = 3600; // longer gaps indicate idle/sleep
const TRACKING_STATE_KEY = 'siteTimeTracking';

let trackerQueue = Promise.resolve();

/**
 * Extract clean domain from URL
 */
export function extractDomain(url) {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('moz-extension://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
      return null;
    }
    const u = new URL(url);
    // Remove www. prefix for cleaner display
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Get today's date key
 */
export function getTodayKey() {
  return new Date().toDateString();
}

/**
 * Get date key for N days ago
 */
export function getDateKey(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toDateString();
}

/**
 * Load today's site time data from storage
 */
export async function loadTodaySiteTime() {
  const key = `siteTime_${getTodayKey()}`;
  const result = await browser.storage.local.get(key);
  return result[key] || {};
}

/**
 * Load site time data for a specific date key
 */
export async function loadSiteTimeForDate(dateKey) {
  const key = `siteTime_${dateKey}`;
  const result = await browser.storage.local.get(key);
  return result[key] || {};
}

/**
 * Add seconds to a domain's time for today
 */
export async function addTimeForDomain(domain, seconds) {
  if (!domain || seconds <= 0) return;
  const key = `siteTime_${getTodayKey()}`;
  const result = await browser.storage.local.get(key);
  const data = result[key] || {};
  data[domain] = (data[domain] || 0) + seconds;
  await browser.storage.local.set({ [key]: data });
  return data;
}

/**
 * Get aggregated time data for the last N days
 * Returns: { domain: totalSeconds, ... }
 */
export async function getAggregatedTimeForDays(days = 7) {
  const keys = [];
  for (let i = 0; i < days; i++) {
    keys.push(`siteTime_${getDateKey(i)}`);
  }
  const result = await browser.storage.local.get(keys);
  const aggregated = {};
  for (const key of keys) {
    const dayData = result[key] || {};
    for (const [domain, seconds] of Object.entries(dayData)) {
      aggregated[domain] = (aggregated[domain] || 0) + seconds;
    }
  }
  return aggregated;
}

/**
 * Get daily totals for the last N days
 * Returns: { dateKey: totalSeconds }
 */
export async function getDailyTotals(days = 7) {
  const totals = {};
  for (let i = 0; i < days; i++) {
    const dateKey = getDateKey(i);
    const key = `siteTime_${dateKey}`;
    const result = await browser.storage.local.get(key);
    const dayData = result[key] || {};
    totals[dateKey] = Object.values(dayData).reduce((sum, s) => sum + s, 0);
  }
  return totals;
}

/**
 * Cleanup old data beyond DATA_RETENTION_DAYS
 */
export async function cleanupOldData() {
  const allStorage = await browser.storage.local.get(null);
  const keysToRemove = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DATA_RETENTION_DAYS);
  
  for (const key of Object.keys(allStorage)) {
    if (key.startsWith('siteTime_')) {
      const dateStr = key.replace('siteTime_', '');
      const date = new Date(dateStr);
      if (!isNaN(date) && date < cutoff) {
        keysToRemove.push(key);
      }
    }
  }
  
  if (keysToRemove.length > 0) {
    await browser.storage.local.remove(keysToRemove);
    console.log('[TimeTracker] Cleaned up old data:', keysToRemove);
  }
}

/**
 * Format seconds to human readable string (e.g. "1h 23m" or "45m")
 */
export function formatTime(seconds) {
  if (!seconds || seconds < 60) return seconds > 0 ? `${Math.round(seconds)}s` : '0m';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Initialize the universal time tracker in the background script
 * Call this from background.js
 */
export function initUniversalTracker() {
  browser.tabs.onActivated.addListener(queueTrackingSync);
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) queueTrackingSync();
  });
  browser.windows.onFocusChanged.addListener(queueTrackingSync);

  // Heartbeat alarm: commit accumulated time every TRACKER_INTERVAL_SECONDS
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TIME_TRACKER_ALARM) queueTrackingSync();
  });

  // Create alarm if not exists
  browser.alarms.get(TIME_TRACKER_ALARM).then(alarm => {
    if (!alarm) {
      browser.alarms.create(TIME_TRACKER_ALARM, {
        periodInMinutes: TRACKER_INTERVAL_SECONDS / 60
      });
    }
  });

  queueTrackingSync();
  console.log('[TimeTracker] Universal tracker initialized');
}

function queueTrackingSync() {
  trackerQueue = trackerQueue.then(syncTracking).catch(error => console.error('[TimeTracker] Sync failed:', error));
  return trackerQueue;
}

// Tracking state lives in storage because the MV3 service worker can restart between events.
async function syncTracking() {
  // Rejects when no browser window is open; treat that as nothing to track.
  const focusedWindow = await browser.windows.getLastFocused({ populate: true }).catch(() => null);
  const activeTab = focusedWindow?.focused ? focusedWindow.tabs?.find(tab => tab.active) : null;
  const domain = extractDomain(activeTab?.url);
  const now = Date.now();
  const { [TRACKING_STATE_KEY]: tracking } = await browser.storage.local.get(TRACKING_STATE_KEY);
  await browser.storage.local.set({ [TRACKING_STATE_KEY]: domain ? { domain, startTime: now } : null });
  if (tracking) {
    const elapsed = Math.round((now - tracking.startTime) / 1000);
    if (elapsed > 0 && elapsed < MAX_FLUSH_SECONDS) {
      await addTimeForDomain(tracking.domain, elapsed);
    }
  }
}
