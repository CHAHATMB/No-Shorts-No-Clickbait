// background.js
import './browser-polyfill.js';
import { FEATURES } from './features.js';

console.log("Background service worker started.");

const REWARD_MINUTES = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 45,
};

let codingProfiles = {
  leetcodeUsername: null,
  codingBonusEnabled: false,
};

let solvedProblemsHistory = {}; // Daily stats: { "date": { easy: 0, medium: 0, hard: 0, totalMinutes: 0 } }
let dailyBaselines = {}; // Snapshot at start of day: { "date": { easy: 0, medium: 0, hard: 0 } }
let remainingTime = 0; // Current available watch time in milliseconds
let dailyWatchStats = {}; // { "date": minutes }
let totalWatchTimeToday = 0; // in milliseconds
let continueCountToday = 0;
let breaksTakenToday = 0;

// Load coding profiles and state from storage
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

  // Reset daily stats if it's a new day
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

  console.log("Settings loaded. Remaining:", Math.round(remainingTime / 1000 / 60), "min, Watched today:", Math.round(totalWatchTimeToday / 1000 / 60), "min");
}

// Badge status logic
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    if (tab.url.includes("youtube.com")) {
      browser.action.setBadgeText({ text: "ON", tabId: tabId });
      browser.action.setBadgeBackgroundColor({ color: "#cc0000", tabId: tabId });
    } else {
      browser.action.setBadgeText({ text: "", tabId: tabId });
    }
  }
});

// Function to fetch LeetCode solved problems breakdown
async function fetchLeetCodeStats(username) {
  if (!username) return null;
  console.log(`Fetching LeetCode stats for ${username}`);
  try {
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
        variables: { username: username },
      }),
    });
    const data = await response.json();
    if (data.data && data.data.matchedUser && data.data.matchedUser.submitStats.acSubmissionNum) {
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

// Main function to update solved problems and calculate bonus
async function updateSolvedProblems() {
  if (!FEATURES.CODING_PLATFORM_INTEGRATION) {
    return;
  }
  await loadCodingSettings();

  if (!codingProfiles.codingBonusEnabled || !codingProfiles.leetcodeUsername) {
    return;
  }

  const currentStats = await fetchLeetCodeStats(codingProfiles.leetcodeUsername);
  if (!currentStats) return;

  const today = new Date().toDateString();
  
  // If no baseline for today, set it to current stats
  if (!dailyBaselines[today]) {
    dailyBaselines[today] = currentStats;
    await browser.storage.local.set({ dailyBaselines });
    console.log("Set daily baseline for LeetCode:", dailyBaselines[today]);
  }

  const baseline = dailyBaselines[today];
  const solvedToday = {
    easy: Math.max(0, currentStats.easy - baseline.easy),
    medium: Math.max(0, currentStats.medium - baseline.medium),
    hard: Math.max(0, currentStats.hard - baseline.hard),
  };

  const earnedMinutes = 
    (solvedToday.easy * REWARD_MINUTES.EASY) +
    (solvedToday.medium * REWARD_MINUTES.MEDIUM) +
    (solvedToday.hard * REWARD_MINUTES.HARD);

  // Calculate if we need to add new time to remainingTime
  const previousEarnedMinutes = solvedProblemsHistory[today].totalMinutes || 0;
  if (earnedMinutes > previousEarnedMinutes) {
    const newMinutes = earnedMinutes - previousEarnedMinutes;
    remainingTime += (newMinutes * 60 * 1000);
    console.log(`Earned ${newMinutes} new minutes! Total remaining: ${remainingTime / 1000 / 60} min`);
  }

  solvedProblemsHistory[today] = {
    ...solvedToday,
    totalMinutes: earnedMinutes
  };

  await browser.storage.local.set({ 
    solvedProblemsHistory,
    remainingTime 
  });

  try {
    await browser.runtime.sendMessage({
      action: "updateStats",
      remainingTime: remainingTime,
      earnedMinutesToday: earnedMinutes,
      solvedToday: solvedToday
    });
  } catch (e) {
    // Ignore message errors
  }
}

// Alarm listener for periodic updates
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "updateSolvedProblems") {
    updateSolvedProblems();
  }
});

// Listen for messages from popup.js and content.js
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateCodingProfiles") {
    console.log("Received updateCodingProfiles message:", message);
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
    return true; // Keep channel open for async response
  }

  if (message.action === "deductTime") {
    const deduction = message.amount; // in milliseconds
    
    // 1. Update Coding Bonus remaining time
    remainingTime = Math.max(0, remainingTime - deduction);
    
    // 2. Update Productivity total watch time
    totalWatchTimeToday += deduction;
    
    // 3. Update Daily Stats for graph
    const today = new Date().toDateString();
    dailyWatchStats[today] = Math.round(totalWatchTimeToday / 1000 / 60); // Store in minutes
    
    browser.storage.local.set({ 
      remainingTime, 
      totalWatchTimeToday,
      dailyWatchStats
    });
    
    // Broadcast updated stats to all tabs and popup
    try {
      browser.runtime.sendMessage({
        action: "updateStats",
        remainingTime: remainingTime,
        totalWatchTimeToday: totalWatchTimeToday,
        continueCountToday: continueCountToday
      });
    } catch (e) {}
    return false;
  }

  if (message.action === "continueReminder") {
    continueCountToday++;
    browser.storage.local.set({ continueCountToday });
    
    // Broadcast updated count
    try {
      browser.runtime.sendMessage({
        action: "updateStats",
        continueCountToday: continueCountToday
      });
    } catch (e) {}
    return false;
  }

  if (message.action === "takeBreak") {
    breaksTakenToday++;
    browser.storage.local.set({ breaksTakenToday });
    
    // Broadcast updated stats
    try {
      browser.runtime.sendMessage({
        action: "updateStats",
        breaksTakenToday: breaksTakenToday
      });
    } catch (e) {}

    // Close the tab
    if (sender.tab) {
      browser.tabs.remove(sender.tab.id);
    }
    return false;
  }
});

// Initial setup
if (FEATURES.CODING_PLATFORM_INTEGRATION) {
  loadCodingSettings().then(() => {
    updateSolvedProblems();
    // Create alarm for periodic tracking (every 60 minutes)
    browser.alarms.get("updateSolvedProblems").then((alarm) => {
      if (!alarm) {
        browser.alarms.create("updateSolvedProblems", { periodInMinutes: 60 });
      }
    });
  });
}
