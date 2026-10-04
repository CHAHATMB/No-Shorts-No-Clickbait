// background.js
import './browser-polyfill.js';
import { FEATURES } from './features.js';
import { initUniversalTracker, extractDomain } from './modules/time-tracker.js';
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
  leetcodeVerified: false,
  codingBonusEnabled: false,
};

let solvedProblemsHistory = {};
let dailyBaselines = {};
let remainingTime = 0;
let dailyWatchStats = {};
let totalWatchTimeToday = 0;
let continueCountToday = 0;
let breaksTakenToday = 0;
let testCommandQueue = Promise.resolve();

async function loadCodingSettings() {
  const result = await browser.storage.local.get([
    "leetcodeUsername",
    "leetcodeVerified",
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
  codingProfiles.leetcodeVerified = result.leetcodeVerified === true;
  codingProfiles.codingBonusEnabled =
    result.codingBonusEnabled === true && codingProfiles.leetcodeVerified;

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
// BROADCAST STATS
// ============================================================
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

// ============================================================
// LEETCODE API & VERIFICATION
// ============================================================
async function queryLeetCodeUserData(username) {
  const clean = username ? username.trim() : "";
  if (!clean) return { valid: false, error: "Username is empty" };

  // 1. Primary: Community CORS-enabled REST API (alfa-leetcode-api)
  // Provides metadata (rank, reputation), recent submissions for today's solve detection, and CORS headers
  try {
    const alfaRes = await fetch(`https://alfa-leetcode-api.onrender.com/userProfile/${encodeURIComponent(clean)}`);
    if (alfaRes.ok) {
      const data = await alfaRes.json();
      if (data?.errors && !data?.totalSolved && data?.totalSolved !== 0 && !data?.matchedUser) {
        return { valid: false, error: "LeetCode user not found" };
      }
      if (typeof data?.totalSolved === "number" || typeof data?.easySolved === "number") {
        return {
          valid: true,
          username: clean,
          stats: {
            easy: data.easySolved || 0,
            medium: data.mediumSolved || 0,
            hard: data.hardSolved || 0,
            total: data.totalSolved || (data.easySolved || 0) + (data.mediumSolved || 0) + (data.hardSolved || 0),
          },
          meta: {
            ranking: data.ranking || null,
            totalSolved: data.totalSolved || 0,
            reputation: data.reputation || 0,
          },
          recentSubmissions: data.recentSubmissions || [],
          submissionCalendar: data.submissionCalendar || {},
        };
      }
    }
  } catch (e) {
    // Continue to next fallback
  }

  // 2. Secondary fallback: Community REST API (leetcode-api-faisalshohag)
  try {
    const faisalRes = await fetch(`https://leetcode-api-faisalshohag.vercel.app/${encodeURIComponent(clean)}`);
    if (faisalRes.ok) {
      const data = await faisalRes.json();
      if (data?.errors && !data?.matchedUser && !data?.totalSolved && data?.totalSolved !== 0) {
        return { valid: false, error: "LeetCode user not found" };
      }
      if (typeof data?.totalSolved === "number" || typeof data?.easySolved === "number") {
        return {
          valid: true,
          username: clean,
          stats: {
            easy: data.easySolved || 0,
            medium: data.mediumSolved || 0,
            hard: data.hardSolved || 0,
            total: data.totalSolved || (data.easySolved || 0) + (data.mediumSolved || 0) + (data.hardSolved || 0),
          },
          meta: {
            ranking: data.ranking || null,
            totalSolved: data.totalSolved || 0,
            reputation: data.reputation || 0,
          },
          recentSubmissions: data.recentSubmissions || [],
          submissionCalendar: data.submissionCalendar || {},
        };
      }
    }
  } catch (e) {
    // Continue to next fallback
  }

  // 3. Direct LeetCode GraphQL: Only query if host permissions are explicitly active
  // (to avoid triggering unhandled browser CORS errors in console when permission is absent)
  let hasHostPermission = false;
  try {
    if (typeof browser !== "undefined" && browser?.permissions?.contains) {
      hasHostPermission = await browser.permissions.contains({
        origins: ["*://*.leetcode.com/*"],
      });
    }
  } catch (e) {}

  if (hasHostPermission) {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            ranking
            reputation
          }
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `;

    try {
      const params = new URLSearchParams({
        query,
        variables: JSON.stringify({ username: clean }),
      });
      const getRes = await fetch(`https://leetcode.com/graphql?${params.toString()}`);
      if (getRes.ok) {
        const data = await getRes.json();
        if (data?.errors && !data?.data?.matchedUser) {
          return { valid: false, error: "LeetCode user not found" };
        }
        if (data?.data?.matchedUser) {
          const statsList = data.data.matchedUser.submitStats?.acSubmissionNum || [];
          const easy = statsList.find((s) => s.difficulty === "Easy")?.count || 0;
          const medium = statsList.find((s) => s.difficulty === "Medium")?.count || 0;
          const hard = statsList.find((s) => s.difficulty === "Hard")?.count || 0;
          return {
            valid: true,
            username: data.data.matchedUser.username || clean,
            stats: { easy, medium, hard, total: easy + medium + hard },
            meta: {
              ranking: data.data.matchedUser.profile?.ranking || null,
              totalSolved: easy + medium + hard,
              reputation: data.data.matchedUser.profile?.reputation || 0,
            },
          };
        }
      }
    } catch (e) {}
  }

  return { valid: false, error: "Could not verify username. Check connection or LeetCode status." };
}

async function calculateSolvedToday(userData, today) {
  const currentStats = userData.stats || { easy: 0, medium: 0, hard: 0 };
  const submissions = userData.recentSubmissions || [];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startSecs = Math.floor(startOfToday.getTime() / 1000);

  const todaysAccepted = submissions.filter(
    (s) => s.statusDisplay === "Accepted" && parseInt(s.timestamp, 10) >= startSecs
  );

  const uniqueSlugs = [...new Set(todaysAccepted.map((s) => s.titleSlug))];

  let directEasy = 0;
  let directMedium = 0;
  let directHard = 0;

  if (uniqueSlugs.length > 0) {
    let storedDiffs = {};
    try {
      const storageResult = await browser.storage.local.get("problemDifficulties");
      storedDiffs = storageResult.problemDifficulties || {};
    } catch (e) {}

    const missingSlugs = uniqueSlugs.filter((slug) => !storedDiffs[slug]);

    if (missingSlugs.length > 0) {
      await Promise.all(
        missingSlugs.map(async (slug) => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3500);
            const r = await fetch(`https://alfa-leetcode-api.onrender.com/select?titleSlug=${encodeURIComponent(slug)}`, {
              signal: controller.signal,
            });
            clearTimeout(timer);
            if (r.ok) {
              const q = await r.json();
              if (q?.difficulty) {
                storedDiffs[slug] = q.difficulty;
              }
            }
          } catch (e) {
            storedDiffs[slug] = "Medium";
          }
        })
      );
      try {
        await browser.storage.local.set({ problemDifficulties: storedDiffs });
      } catch (e) {}
    }

    uniqueSlugs.forEach((slug) => {
      const diff = storedDiffs[slug] || "Medium";
      if (diff === "Easy") directEasy++;
      else if (diff === "Hard") directHard++;
      else directMedium++;
    });
  }

  // Baseline delta calculation
  let baseline = dailyBaselines[today];
  if (!baseline) {
    baseline = {
      easy: Math.max(0, currentStats.easy - directEasy),
      medium: Math.max(0, currentStats.medium - directMedium),
      hard: Math.max(0, currentStats.hard - directHard),
    };
    dailyBaselines[today] = baseline;
    await browser.storage.local.set({ dailyBaselines });
  }

  const deltaEasy = Math.max(0, currentStats.easy - baseline.easy);
  const deltaMedium = Math.max(0, currentStats.medium - baseline.medium);
  const deltaHard = Math.max(0, currentStats.hard - baseline.hard);

  return {
    easy: Math.max(directEasy, deltaEasy),
    medium: Math.max(directMedium, deltaMedium),
    hard: Math.max(directHard, deltaHard),
  };
}

async function fetchLeetCodeStats(username) {
  if (!username) return null;
  const result = await queryLeetCodeUserData(username);
  if (result.valid && result.stats) {
    return result.stats;
  }
  return null;
}

async function verifyLeetCodeUser(username) {
  const clean = username ? username.trim() : "";
  if (!clean) return { valid: false, error: "Username is empty" };
  return queryLeetCodeUserData(clean);
}

async function updateSolvedProblems(force = false) {
  if (!FEATURES.CODING_PLATFORM_INTEGRATION) return null;
  await loadCodingSettings();
  if (!codingProfiles.leetcodeUsername || !codingProfiles.leetcodeVerified) return null;
  if (!force && !codingProfiles.codingBonusEnabled) return null;

  const userData = await queryLeetCodeUserData(codingProfiles.leetcodeUsername);
  if (!userData || !userData.valid || !userData.stats) return null;

  const today = new Date().toDateString();
  const solvedToday = await calculateSolvedToday(userData, today);
  const currentStats = userData.stats;

  const earnedMinutes =
    solvedToday.easy * REWARD_MINUTES.EASY +
    solvedToday.medium * REWARD_MINUTES.MEDIUM +
    solvedToday.hard * REWARD_MINUTES.HARD;

  const previousEarnedMinutes = solvedProblemsHistory[today]?.totalMinutes || 0;
  if (codingProfiles.codingBonusEnabled && earnedMinutes > previousEarnedMinutes) {
    const newMinutes = earnedMinutes - previousEarnedMinutes;
    remainingTime += newMinutes * 60 * 1000;
  }

  solvedProblemsHistory[today] = { ...solvedToday, totalMinutes: earnedMinutes };
  await browser.storage.local.set({
    solvedProblemsHistory,
    remainingTime,
    leetcodeUserMeta: userData.meta || null,
  });

  await broadcastStats({
    remainingTime,
    earnedMinutesToday: earnedMinutes,
    solvedToday,
  });

  return { currentStats, solvedToday, earnedMinutes, remainingTime, meta: userData.meta };
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
  if (message.action === "verifyLeetCode") {
    verifyLeetCodeUser(message.username).then(async (res) => {
      if (res.valid) {
        codingProfiles.leetcodeUsername = res.username;
        codingProfiles.leetcodeVerified = true;
        const today = new Date().toDateString();

        let solvedToday = { easy: 0, medium: 0, hard: 0 };
        try {
          solvedToday = await calculateSolvedToday(res, today);
        } catch (e) {
          if (!dailyBaselines[today] && res.stats) {
            dailyBaselines[today] = res.stats;
          }
        }

        const earnedMinutes =
          solvedToday.easy * REWARD_MINUTES.EASY +
          solvedToday.medium * REWARD_MINUTES.MEDIUM +
          solvedToday.hard * REWARD_MINUTES.HARD;

        const previousEarnedMinutes = solvedProblemsHistory[today]?.totalMinutes || 0;
        if (codingProfiles.codingBonusEnabled && earnedMinutes > previousEarnedMinutes) {
          const newMinutes = earnedMinutes - previousEarnedMinutes;
          remainingTime += newMinutes * 60 * 1000;
        }

        solvedProblemsHistory[today] = { ...solvedToday, totalMinutes: earnedMinutes };

        await browser.storage.local.set({
          leetcodeUsername: res.username,
          leetcodeVerified: true,
          leetcodeUserMeta: res.meta || null,
          dailyBaselines,
          solvedProblemsHistory,
          remainingTime,
        });

        await broadcastStats({
          leetcodeUsername: res.username,
          leetcodeVerified: true,
          codingBonusEnabled: codingProfiles.codingBonusEnabled,
          remainingTime,
          earnedMinutesToday: earnedMinutes,
          solvedToday,
        });

        sendResponse({
          ok: true,
          username: res.username,
          stats: res.stats,
          meta: res.meta,
          solvedToday,
          earnedMinutes,
          remainingTime,
        });
      } else {
        codingProfiles.leetcodeVerified = false;
        codingProfiles.codingBonusEnabled = false;
        await browser.storage.local.set({
          leetcodeVerified: false,
          codingBonusEnabled: false,
          leetcodeUserMeta: null,
        });
        await broadcastStats({
          leetcodeVerified: false,
          codingBonusEnabled: false,
        });
        sendResponse({ ok: false, error: res.error });
      }
    }).catch(err => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }


  if (message.action === "syncLeetCode") {
    (async () => {
      await loadCodingSettings();
      if (!codingProfiles.leetcodeUsername || !codingProfiles.leetcodeVerified) {
        return { ok: false, error: "Please verify your LeetCode username first." };
      }
      const result = await updateSolvedProblems(true);
      if (!result) {
        return { ok: false, error: "Could not fetch LeetCode data. Check connection." };
      }
      return { ok: true, ...result };
    })().then(sendResponse).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === "updateCodingProfiles") {
    codingProfiles.leetcodeUsername = message.leetcodeUsername || "";
    codingProfiles.leetcodeVerified = message.leetcodeVerified === true;
    codingProfiles.codingBonusEnabled = message.codingBonusEnabled === true && codingProfiles.leetcodeVerified;
    browser.storage.local
      .set({
        leetcodeUsername: codingProfiles.leetcodeUsername,
        leetcodeVerified: codingProfiles.leetcodeVerified,
        codingBonusEnabled: codingProfiles.codingBonusEnabled,
      })
      .then(async () => {
        if (codingProfiles.codingBonusEnabled) {
          await updateSolvedProblems();
        }
        await broadcastStats({
          codingBonusEnabled: codingProfiles.codingBonusEnabled,
          leetcodeUsername: codingProfiles.leetcodeUsername,
          leetcodeVerified: codingProfiles.leetcodeVerified,
          remainingTime,
        });
        sendResponse({ status: "Profile update initiated" });
      });
    return true;
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
  if (typeof __DEV__ !== 'undefined' && __DEV__ && [
    'testAddWatchTime', 'testAddSiteTime', 'testResetTodayData', 'testAddAllowance',
    'testSetAllowance', 'testResetOverrides', 'testMaxOverrides', 'testSolveProblem', 'testSetHourlyRate',
  ].includes(message.action)) {
    testCommandQueue = testCommandQueue.then(async () => {
      const MINUTE_MS = 60000;
      const MAX_TEST_MINUTES = 1440;
      const MAX_HOURLY_RATE = 1000000;
      if (['testAddWatchTime', 'testAddAllowance', 'testSetAllowance'].includes(message.action) &&
          (!Number.isInteger(message.minutes) || message.minutes < 0 || message.minutes > MAX_TEST_MINUTES)) {
        throw new TypeError('Minutes must be a whole number between 0 and 1440.');
      }
      if (message.action === 'testAddSiteTime' &&
          (!['github.com', 'instagram.com'].includes(message.domain) || !Number.isInteger(message.seconds) || message.seconds <= 0 || message.seconds > MAX_TEST_MINUTES * 60)) {
        throw new TypeError('Choose a supported test domain and a positive duration of at most one day.');
      }
      if (message.action === 'testSolveProblem' && !Object.hasOwn(REWARD_MINUTES, message.difficulty?.toUpperCase())) {
        throw new TypeError('Choose easy, medium, or hard.');
      }
      if (message.action === 'testSetHourlyRate' && (!Number.isInteger(message.rate) || message.rate <= 0 || message.rate > MAX_HOURLY_RATE)) {
        throw new TypeError('Hourly rate must be a positive whole number up to 1000000.');
      }
      await loadCodingSettings();
      const today = new Date().toDateString();
      const siteKey = `siteTime_${today}`;
      const stored = await browser.storage.local.get([siteKey, 'hourlyRate', 'blockOverrides']);
      const updates = {};
      let detail;
      if (message.action === 'testAddWatchTime') {
        const next = totalWatchTimeToday + message.minutes * MINUTE_MS;
        updates.totalWatchTimeToday = next;
        updates.dailyWatchStats = { ...dailyWatchStats, [today]: Math.round(next / MINUTE_MS) };
        updates[siteKey] = { ...stored[siteKey], 'youtube.com': (stored[siteKey]?.['youtube.com'] || 0) + message.minutes * 60 };
        detail = `Watch time: ${Math.round(totalWatchTimeToday / MINUTE_MS)}m → ${Math.round(next / MINUTE_MS)}m. Allowance unchanged.`;
      } else if (message.action === 'testAddSiteTime') {
        const previous = stored[siteKey]?.[message.domain] || 0;
        updates[siteKey] = { ...stored[siteKey], [message.domain]: previous + message.seconds };
        detail = `${message.domain}: ${Math.round(previous / 60)}m → ${Math.round((previous + message.seconds) / 60)}m.`;
      } else if (message.action === 'testResetTodayData') {
        Object.assign(updates, {
          totalWatchTimeToday: 0, continueCountToday: 0, breaksTakenToday: 0,
          dailyWatchStats: { ...dailyWatchStats, [today]: 0 }, lastWasterAlert: {}, [siteKey]: {},
        });
        detail = 'Today’s watch time, site time, and reminder counters reset. Earlier history, settings, and allowance preserved.';
      } else if (message.action === 'testAddAllowance' || message.action === 'testSetAllowance' || message.action === 'testSolveProblem') {
        const reward = message.action === 'testSolveProblem' ? REWARD_MINUTES[message.difficulty.toUpperCase()] : message.minutes;
        updates.remainingTime = (message.action === 'testSetAllowance' ? 0 : remainingTime) + reward * MINUTE_MS;
        detail = `Allowance: ${Math.round(remainingTime / MINUTE_MS)}m → ${Math.round(updates.remainingTime / MINUTE_MS)}m. Applies to all YouTube tabs with Coding Bonus enabled.`;
        if (message.action === 'testSolveProblem') {
          const difficulty = message.difficulty.toLowerCase();
          const history = { ...solvedProblemsHistory[today] };
          history[difficulty] = (history[difficulty] || 0) + 1;
          history.totalMinutes = (history.totalMinutes || 0) + reward;
          updates.solvedProblemsHistory = { ...solvedProblemsHistory, [today]: history };
          detail += ' Mock solve saved; the next LeetCode sync can replace mock counts.';
        }
      } else if (message.action === 'testSetHourlyRate') {
        updates.hourlyRate = message.rate;
        detail = `Hourly rate: ${stored.hourlyRate || 500} → ${message.rate}.`;
      } else {
        const count = message.action === 'testMaxOverrides' ? MAX_DAILY_OVERRIDES : 0;
        const previous = stored.blockOverrides?.[today] || 0;
        updates.blockOverrides = { ...stored.blockOverrides, [today]: count };
        detail = `Overrides used: ${previous} → ${count}/${MAX_DAILY_OVERRIDES}. Reopen the blocker to see the change.`;
      }
      await browser.storage.local.set(updates);
      if (updates.remainingTime !== undefined) remainingTime = updates.remainingTime;
      if (updates.totalWatchTimeToday !== undefined) totalWatchTimeToday = updates.totalWatchTimeToday;
      if (updates.dailyWatchStats) dailyWatchStats = updates.dailyWatchStats;
      if (updates.solvedProblemsHistory) solvedProblemsHistory = updates.solvedProblemsHistory;
      if (updates.continueCountToday !== undefined) continueCountToday = updates.continueCountToday;
      if (updates.breaksTakenToday !== undefined) breaksTakenToday = updates.breaksTakenToday;
      await broadcastStats({ remainingTime, totalWatchTimeToday, continueCountToday, breaksTakenToday, resetReminderBaseline: message.action === 'testResetTodayData' });
      sendResponse({ ok: true, status: 'saved', message: detail });
    }).catch(error => sendResponse({ ok: false, status: 'failed', message: error.message }));
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
