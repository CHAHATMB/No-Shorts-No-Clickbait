// background.js
import './browser-polyfill.js';
import { FEATURES } from './features.js';
import { initUniversalTracker, addTimeForDomain, extractDomain } from './modules/time-tracker.js';
import { checkUrlBlocked, getOverrideCount, incrementOverrideCount, MAX_DAILY_OVERRIDES } from './modules/url-blocker.js';

console.log("Background service worker started.");

// ============================================================
// CODING BONUS SYSTEM (existing)
// ============================================================
const REWARD_MINUTES = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 45,
};

let codingProfiles = {
  leetcodeUsername: null,
  codingBonusEnabled: false,
};

let solvedProblemsHistory = {};
let dailyBaselines = {};
let remainingTime = 0;
let dailyWatchStats = {};
let totalWatchTimeToday = 0;
let continueCountToday = 0;
let breaksTakenToday = 0;

async function loadCodingSettings() {
  const result = await browser.storage.local.get([
    "leetcodeUsername",
    "codingBonusEnabled",
    "solvedProblemsHistory",
    "dailyBaselines",
    "remainingTime",
    "dailyWatchStats",
    "totalWatchTimeToday",
    "continueCountToday",
    "breaksTakenToday",
    "lastUpdateDate"
  ]);

  codingProfiles.leetcodeUsername = result.leetcodeUsername || null;
  codingProfiles.codingBonusEnabled =
    result.codingBonusEnabled !== undefined ? result.codingBonusEnabled : true;

  solvedProblemsHistory = result.solvedProblemsHistory || {};
  dailyBaselines = result.dailyBaselines || {};
  remainingTime = result.remainingTime || 0;
  dailyWatchStats = result.dailyWatchStats || {};

  const today = new Date().toDateString();
  const lastUpdateDate = result.lastUpdateDate;

  if (lastUpdateDate !== today) {
    totalWatchTimeToday = 0;
    continueCountToday = 0;
    breaksTakenToday = 0;
    await browser.storage.local.set({
      totalWatchTimeToday,
      continueCountToday,
      breaksTakenToday,
      lastUpdateDate: today
    });
  } else {
    totalWatchTimeToday = result.totalWatchTimeToday || 0;
    continueCountToday = result.continueCountToday || 0;
    breaksTakenToday = result.breaksTakenToday || 0;
  }

  if (!solvedProblemsHistory[today]) {
    solvedProblemsHistory[today] = { easy: 0, medium: 0, hard: 0, totalMinutes: 0 };
  }
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    if (tab.url.includes("youtube.com")) {
      browser.action.setBadgeText({ text: "ON", tabId: tabId });
      browser.action.setBadgeBackgroundColor({ color: "#cc0000", tabId: tabId });
    } else {
      browser.action.setBadgeText({ text: "", tabId: tabId });
    }

    // URL blocker check
    if (FEATURES.URL_BLOCKER) {
      handleUrlBlockerCheck(tabId, tab.url);
    }
  }
});

// ============================================================
// URL BLOCKER
// ============================================================
async function handleUrlBlockerCheck(tabId, url) {
  try {
    const { matched, pattern } = await checkUrlBlocked(url);
    if (matched) {
      // Notify content script to show block overlay
      try {
        await browser.tabs.sendMessage(tabId, {
          action: 'showBlockOverlay',
          pattern: pattern,
        });
      } catch (e) {
        // Content script might not be loaded yet, retry
        setTimeout(async () => {
          try {
            await browser.tabs.sendMessage(tabId, {
              action: 'showBlockOverlay',
              pattern: pattern,
            });
          } catch (e2) { /* ignore */ }
        }, 1000);
      }
    }
  } catch (e) {
    console.error('[Blocker] Error checking URL:', e);
  }
}

// ============================================================
// NOTIFICATION BANNER SYSTEM
// ============================================================
async function sendNotificationBanner(type, data = {}) {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await browser.tabs.sendMessage(tabs[0].id, {
        action: 'showBanner',
        type,
        data,
      });
    }
  } catch (e) { /* ignore */ }
}

// Check if we should send time-waster alert
async function checkTimeWasterAlert() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.url) return;
    
    const domain = extractDomain(tabs[0].url);
    if (!domain) return;
    
    const catResult = await browser.storage.local.get(['siteCategories', 'bannerSettings']);
    const cats = catResult.siteCategories || {};
    const bannerSettings = catResult.bannerSettings || { timeAlerts: true, dailySummary: true, milestones: true };
    
    if (!bannerSettings.timeAlerts) return;
    
    // Check if it's a waste site
    const { DEFAULT_CATEGORIES } = await import('./modules/site-categories.js');
    const allCats = { ...DEFAULT_CATEGORIES, ...cats };
    if (allCats[domain] !== 'waste') return;
    
    // Check how long on this site today
    const key = `siteTime_${new Date().toDateString()}`;
    const result = await browser.storage.local.get([key, 'lastWasterAlert']);
    const siteData = result[key] || {};
    const secs = siteData[domain] || 0;
    
    // Alert thresholds: 30min, 60min, 90min
    const thresholds = [1800, 3600, 5400];
    const lastAlert = result.lastWasterAlert || {};
    const lastAlertForDomain = lastAlert[domain] || 0;
    
    for (const threshold of thresholds) {
      if (secs >= threshold && lastAlertForDomain < threshold) {
        const mins = Math.round(secs / 60);
        // Update last alert
        lastAlert[domain] = threshold;
        await browser.storage.local.set({ lastWasterAlert: lastAlert });
        
        await sendNotificationBanner('timeAlert', {
          domain,
          minutes: mins,
        });
        break;
      }
    }
  } catch (e) { /* ignore */ }
}

// ============================================================
// LEETCODE API (existing)
// ============================================================
async function fetchLeetCodeStats(username) {
  if (!username) return null;
  try {
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              submitStats {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
            }
          }
        `,
        variables: { username },
      }),
    });
    const data = await response.json();
    if (data.data?.matchedUser?.submitStats?.acSubmissionNum) {
      const stats = data.data.matchedUser.submitStats.acSubmissionNum;
      return {
        easy: stats.find(s => s.difficulty === "Easy")?.count || 0,
        medium: stats.find(s => s.difficulty === "Medium")?.count || 0,
        hard: stats.find(s => s.difficulty === "Hard")?.count || 0,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching LeetCode data:", error);
    return null;
  }
}

async function updateSolvedProblems() {
  if (!FEATURES.CODING_PLATFORM_INTEGRATION) return;
  await loadCodingSettings();
  if (!codingProfiles.codingBonusEnabled || !codingProfiles.leetcodeUsername) return;

  const currentStats = await fetchLeetCodeStats(codingProfiles.leetcodeUsername);
  if (!currentStats) return;

  const today = new Date().toDateString();

  if (!dailyBaselines[today]) {
    dailyBaselines[today] = currentStats;
    await browser.storage.local.set({ dailyBaselines });
  }

  const baseline = dailyBaselines[today];
  const solvedToday = {
    easy: Math.max(0, currentStats.easy - baseline.easy),
    medium: Math.max(0, currentStats.medium - baseline.medium),
    hard: Math.max(0, currentStats.hard - baseline.hard),
  };

  const earnedMinutes =
    solvedToday.easy * REWARD_MINUTES.EASY +
    solvedToday.medium * REWARD_MINUTES.MEDIUM +
    solvedToday.hard * REWARD_MINUTES.HARD;

  const previousEarnedMinutes = solvedProblemsHistory[today].totalMinutes || 0;
  if (earnedMinutes > previousEarnedMinutes) {
    const newMinutes = earnedMinutes - previousEarnedMinutes;
    remainingTime += newMinutes * 60 * 1000;
  }

  solvedProblemsHistory[today] = { ...solvedToday, totalMinutes: earnedMinutes };
  await browser.storage.local.set({ solvedProblemsHistory, remainingTime });

  try {
    await browser.runtime.sendMessage({
      action: "updateStats",
      remainingTime,
      earnedMinutesToday: earnedMinutes,
      solvedToday,
    });
  } catch (e) { /* ignore */ }
}

// ============================================================
// ALARM HANDLER
// ============================================================
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "updateSolvedProblems") {
    updateSolvedProblems();
  }
  if (alarm.name === "universalTimeTracker") {
    // Time tracker flushes itself; we do the banner check here
    if (FEATURES.NOTIFICATION_BANNERS) {
      checkTimeWasterAlert();
    }
  }
});

// ============================================================
// MESSAGE HANDLER
// ============================================================
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateCodingProfiles") {
    codingProfiles.leetcodeUsername = message.leetcodeUsername;
    codingProfiles.codingBonusEnabled = message.codingBonusEnabled;
    browser.storage.local
      .set({
        leetcodeUsername: message.leetcodeUsername,
        codingBonusEnabled: message.codingBonusEnabled,
      })
      .then(() => {
        updateSolvedProblems();
        sendResponse({ status: "Profile update initiated" });
      });
    return true;
  }

async function broadcastStats(data) {
  try {
    await browser.runtime.sendMessage({ action: "updateStats", ...data });
  } catch (e) {}
  try {
    const tabs = await browser.tabs.query({ url: "*://*.youtube.com/*" });
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, { action: "updateStats", ...data }).catch(() => {});
    }
  } catch (e) {}
}

  if (message.action === "deductTime") {
    const deduction = message.amount;
    remainingTime = Math.max(0, remainingTime - deduction);
    totalWatchTimeToday += deduction;
    const today = new Date().toDateString();
    dailyWatchStats[today] = Math.round(totalWatchTimeToday / 1000 / 60);
    browser.storage.local.set({ remainingTime, totalWatchTimeToday, dailyWatchStats });
    broadcastStats({
      remainingTime,
      totalWatchTimeToday,
      continueCountToday,
    });
    return false;
  }

  if (message.action === "continueReminder") {
    continueCountToday++;
    browser.storage.local.set({ continueCountToday });
    broadcastStats({ continueCountToday });
    return false;
  }

  if (message.action === "takeBreak") {
    breaksTakenToday++;
    browser.storage.local.set({ breaksTakenToday });
    broadcastStats({ breaksTakenToday });
    if (sender.tab) browser.tabs.remove(sender.tab.id);
    return false;
  }

  // URL Blocker messages
  if (message.action === "getOverrideCount") {
    getOverrideCount().then(count => sendResponse({ count }));
    return true;
  }

  if (message.action === "useOverride") {
    incrementOverrideCount().then(count => sendResponse({ count }));
    return true;
  }

  if (message.action === "getBlockedPatterns") {
    browser.storage.local.get('blockedPatterns').then(result => {
      sendResponse({ patterns: result.blockedPatterns || [] });
    });
    return true;
  }

  if (message.action === "saveBlockedPatterns") {
    browser.storage.local.set({ blockedPatterns: message.patterns }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  // Time tracker queries
  if (message.action === "getSiteTimeToday") {
    const key = `siteTime_${new Date().toDateString()}`;
    browser.storage.local.get(key).then(result => {
      sendResponse({ data: result[key] || {} });
    });
    return true;
  }

  if (message.action === "getSiteTimeRange") {
    const keys = [];
    for (let i = 0; i < (message.days || 7); i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      keys.push(`siteTime_${d.toDateString()}`);
    }
    browser.storage.local.get(keys).then(result => {
      sendResponse({ data: result });
    });
    return true;
  }

  // ============================================================
  // DEV / TEST LAB HANDLERS
  // ============================================================
  if (message.action === "testAddWatchTime") {
    const mins = message.minutes || 15;
    const ms = mins * 60 * 1000;
    totalWatchTimeToday += ms;
    const today = new Date().toDateString();
    dailyWatchStats[today] = Math.round(totalWatchTimeToday / 1000 / 60);
    addTimeForDomain('youtube.com', mins * 60).then(() => {
      return browser.storage.local.set({ totalWatchTimeToday, dailyWatchStats });
    }).then(() => {
      broadcastStats({ totalWatchTimeToday, remainingTime });
      sendResponse({ ok: true, totalWatchTimeToday, minsWatched: dailyWatchStats[today] });
    });
    return true;
  }

  if (message.action === "testAddSiteTime") {
    const domain = message.domain || 'github.com';
    const seconds = message.seconds || 1800;
    addTimeForDomain(domain, seconds).then(() => {
      sendResponse({ ok: true, domain, seconds });
    });
    return true;
  }

  if (message.action === "testResetTodayData") {
    totalWatchTimeToday = 0;
    continueCountToday = 0;
    breaksTakenToday = 0;
    const today = new Date().toDateString();
    dailyWatchStats[today] = 0;
    const siteKey = `siteTime_${today}`;
    const updates = {
      totalWatchTimeToday: 0,
      continueCountToday: 0,
      breaksTakenToday: 0,
      dailyWatchStats,
      lastWasterAlert: {},
    };
    updates[siteKey] = {};
    browser.storage.local.set(updates).then(() => {
      broadcastStats({ totalWatchTimeToday: 0, continueCountToday: 0, breaksTakenToday: 0 });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.action === "testAddAllowance") {
    const mins = message.minutes || 30;
    remainingTime = Math.max(0, remainingTime + (mins * 60 * 1000));
    browser.storage.local.set({ remainingTime }).then(() => {
      broadcastStats({ remainingTime });
      sendResponse({ ok: true, remainingTime });
    });
    return true;
  }

  if (message.action === "testSetAllowance") {
    const mins = message.minutes || 0;
    remainingTime = mins * 60 * 1000;
    browser.storage.local.set({ remainingTime }).then(() => {
      broadcastStats({ remainingTime });
      sendResponse({ ok: true, remainingTime });
    });
    return true;
  }

  if (message.action === "testResetOverrides") {
    const today = new Date().toDateString();
    browser.storage.local.set({ blockerOverrides: { date: today, count: 0 } }).then(() => {
      sendResponse({ ok: true, count: 0 });
    });
    return true;
  }

  if (message.action === "testMaxOverrides") {
    const today = new Date().toDateString();
    browser.storage.local.set({ blockerOverrides: { date: today, count: MAX_DAILY_OVERRIDES } }).then(() => {
      sendResponse({ ok: true, count: MAX_DAILY_OVERRIDES });
    });
    return true;
  }

  if (message.action === "testTriggerBannerActiveTab") {
    sendNotificationBanner(message.bannerType, message.data || {}).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
});

// ============================================================
// INITIALIZATION
// ============================================================
if (FEATURES.CODING_PLATFORM_INTEGRATION) {
  loadCodingSettings().then(() => {
    updateSolvedProblems();
    browser.alarms.get("updateSolvedProblems").then((alarm) => {
      if (!alarm) {
        browser.alarms.create("updateSolvedProblems", { periodInMinutes: 60 });
      }
    });
  });
}

if (FEATURES.UNIVERSAL_TIME_TRACKER) {
  initUniversalTracker();
}
