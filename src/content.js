// Main functionality for the extension
import "./browser-polyfill.js";
import { FEATURES } from './features.js';

(function () {
  "use strict";

  // Configuration
  const config = {
    blurAmount: "10px",
    checkInterval: 1000, 
  };

  // Settings state
  let settings = {
    thumbnailMode: "blur", 
    shortsRemovalEnabled: true,
    pauseOnHoverEnabled: true,
    popupRemovalEnabled: true,
    codingBonusEnabled: true,
    focusModeEnabled: false,
  };

  let remainingTime = 0; 
  let isWatching = false;
  let lastDeductionTime = null;
  let blockOverlay = null;

  // Time Reminder state
  let timeReminderEnabled = true;
  let timerInterval = 15; // minutes
  let totalWatchTimeToday = 0;
  let continueCountToday = 0;
  let breaksTakenToday = 0;
  let reminderTimer = null;

  // Create a MutationObserver for popup and ad detection
  const popupObserver = new MutationObserver((mutations) => {
    if (settings.popupRemovalEnabled || settings.focusModeEnabled) {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeName === "TP-YT-IRON-OVERLAY-BACKDROP" ||
            (node.classList && node.classList.contains("ytd-enforcement-message-view-model")) ||
            node.nodeName === "YTD-IN-FEED-AD-LAYOUT-RENDERER" ||
            node.nodeName === "YTD-AD-SLOT-RENDERER"
          ) {
            removeAdBlockerPopup();
          }
        });
      });
    }
  });

  function removeAdBlockerPopup() {
    if (!settings.popupRemovalEnabled && !settings.focusModeEnabled) return;
    const selectors = [
      "tp-yt-iron-overlay-backdrop",
      "ytd-enforcement-message-view-model",
      "ytd-enforcement-message-view-model-renderer"
    ];
    selectors.forEach(s => document.querySelectorAll(s).forEach(el => el.remove()));
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }

  // Load settings
  browser.storage.local
    .get([
      "thumbnailMode",
      "blurAmount",
      "shortsRemovalEnabled",
      "pauseOnHoverEnabled",
      "popupRemovalEnabled",
      "codingBonusEnabled",
      "remainingTime",
      "focusModeEnabled",
      "timeReminderEnabled",
      "timerInterval",
      "totalWatchTimeToday",
      "continueCountToday",
      "breaksTakenToday"
    ])
    .then((result) => {
      settings.thumbnailMode = result.thumbnailMode || "blur";
      config.blurAmount = result.blurAmount ? `${result.blurAmount}px` : "10px";
      settings.shortsRemovalEnabled = result.shortsRemovalEnabled !== false;
      settings.pauseOnHoverEnabled = result.pauseOnHoverEnabled !== false;
      settings.popupRemovalEnabled = result.popupRemovalEnabled !== false;
      settings.codingBonusEnabled = result.codingBonusEnabled !== false;
      settings.focusModeEnabled = result.focusModeEnabled || false;
      remainingTime = result.remainingTime || 0;
      
      timeReminderEnabled = result.timeReminderEnabled !== false;
      timerInterval = result.timerInterval || 15;
      totalWatchTimeToday = result.totalWatchTimeToday || 0;
      continueCountToday = result.continueCountToday || 0;
      breaksTakenToday = result.breaksTakenToday || 0;

      applyModifications();
      checkBlocking();
      initializeTimeTracking();
    });

  // Listen for messages from popup/background
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "changeThumbnailMode") {
      settings.thumbnailMode = message.mode;
      applyThumbnailMode(message.mode);
    } else if (message.action === "updateBlurAmount") {
      config.blurAmount = message.amount;
      if (settings.thumbnailMode === "blur" || settings.focusModeEnabled) {
        applyThumbnailMode(settings.focusModeEnabled ? "hide" : settings.thumbnailMode);
      }
    } else if (message.action === "toggleShorts") {
      settings.shortsRemovalEnabled = message.enabled;
      toggleShortsRemoval(message.enabled);
    } else if (message.action === "togglePauseOnHover") {
      settings.pauseOnHoverEnabled = message.enabled;
    } else if (message.action === "toggleDeepFocus") {
      settings.focusModeEnabled = message.enabled;
      applyModifications();
    } else if (message.action === "toggleTimeReminder") {
      timeReminderEnabled = message.enabled;
      if (!timeReminderEnabled) dismissReminder();
    } else if (message.action === "updateTimerInterval") {
      timerInterval = message.interval;
    } else if (message.action === "updateStats") {
      if (message.remainingTime !== undefined) remainingTime = message.remainingTime;
      if (message.totalWatchTimeToday !== undefined) totalWatchTimeToday = message.totalWatchTimeToday;
      if (message.continueCountToday !== undefined) continueCountToday = message.continueCountToday;
      if (message.breaksTakenToday !== undefined) breaksTakenToday = message.breaksTakenToday;
      checkBlocking();
    }
    return Promise.resolve({ response: "Updated" });
  });

  function checkBlocking() {
    if (!FEATURES.CODING_PLATFORM_INTEGRATION || !settings.codingBonusEnabled) {
      removeBlock();
      return;
    }

    if (remainingTime <= 0) {
      showBlock();
    } else {
      removeBlock();
    }
  }

  function showBlock() {
    if (blockOverlay) return;

    // Pause any playing video
    const videos = document.querySelectorAll("video");
    videos.forEach(v => v.pause());

    blockOverlay = document.createElement("div");
    blockOverlay.id = "youtube-hard-block";
    blockOverlay.innerHTML = `
      <h1>YouTube Locked</h1>
      <p>You've run out of watch time. Solve some LeetCode problems to earn more!</p>
      <div class="stats-info">
        <p>Reward Tiers:</p>
        <p>Easy: 10m | Medium: 20m | Hard: 45m</p>
      </div>
      <a href="https://leetcode.com/problemset/all/" target="_blank" class="btn-primary">Go to LeetCode</a>
    `;
    document.body.appendChild(blockOverlay);
    document.body.style.overflow = "hidden";
  }

  function removeBlock() {
    if (blockOverlay) {
      blockOverlay.remove();
      blockOverlay = null;
      document.body.style.overflow = "";
    }
  }

  function initializeTimeTracking() {
    setInterval(() => {
      const video = document.querySelector("video");
      const isActuallyWatching = video && !video.paused && !video.ended && video.readyState > 2;

      if (isActuallyWatching && window.location.pathname.includes("/watch")) {
        const now = Date.now();
        if (lastDeductionTime) {
          const elapsed = now - lastDeductionTime;
          if (elapsed >= 5000) { // Update every 5 seconds
            browser.runtime.sendMessage({
              action: "deductTime",
              amount: elapsed
            });
            lastDeductionTime = now;
            
            // Check for periodic reminder
            checkPeriodicReminder();
          }
        } else {
          lastDeductionTime = now;
        }
      } else {
        lastDeductionTime = null;
      }
    }, 1000);
  }

  function checkPeriodicReminder() {
    if (!timeReminderEnabled || document.getElementById("youtube-time-reminder")) return;

    const intervalMs = timerInterval * 60 * 1000;
    const lastReminderTime = totalWatchTimeToday % intervalMs;
    
    // If we just crossed an interval threshold
    if (lastReminderTime < 5000) { 
      showTimeReminder();
    }
  }

  function showTimeReminder() {
    if (document.getElementById("youtube-time-reminder")) return;

    // Pause the video
    const video = document.querySelector("video");
    if (video) video.pause();

    const minutesWatched = Math.round(totalWatchTimeToday / (60 * 1000));

    const reminderDiv = document.createElement("div");
    reminderDiv.id = "youtube-time-reminder";
    reminderDiv.innerHTML = `
      <div class="reminder-content">
        <div class="reminder-header">
          <h3>⏰ Time Check!</h3>
          <button class="reminder-close">×</button>
        </div>
        <p>You've been watching YouTube for <strong>${minutesWatched} minutes</strong> today.</p>
        <p class="stats-info">You have canceled this reminder <strong>${continueCountToday}</strong> times today.</p>
        <p>Is this really how you want to spend your time? Consider taking a break or doing something productive!</p>
        <div class="reminder-buttons">
          <button class="reminder-btn continue">Continue Watching</button>
          <button class="reminder-btn take-break">Take a Break</button>
        </div>
      </div>
    `;

    document.body.appendChild(reminderDiv);

    // Add event listeners
    reminderDiv.querySelector(".reminder-close").addEventListener("click", dismissReminder);
    reminderDiv.querySelector(".take-break").addEventListener("click", () => {
      browser.runtime.sendMessage({ action: "takeBreak" });
      dismissReminder();
    });
    reminderDiv.querySelector(".continue").addEventListener("click", () => {
      browser.runtime.sendMessage({ action: "continueReminder" });
      dismissReminder();
    });
  }

  function dismissReminder() {
    const reminder = document.getElementById("youtube-time-reminder");
    if (reminder) reminder.remove();
  }

  function applyThumbnailMode(mode) {
    const effectiveMode = settings.focusModeEnabled ? "hide" : mode;
    
    if (effectiveMode === "hide") {
      document.querySelectorAll("ytd-thumbnail, yt-thumbnail-view-model").forEach(el => el.style.display = "none");
    } else {
      document.querySelectorAll("ytd-thumbnail, yt-thumbnail-view-model").forEach(el => {
        el.style.display = "";
        const img = el.querySelector("img");
        if (img) {
          img.classList.remove("thumbnail-controlled", "thumbnail-blurred");
          img.style.filter = "";
        }
      });
      processThumbnails();
    }
  }

  function processThumbnails() {
    const thumbnails = document.querySelectorAll("ytd-thumbnail img, yt-thumbnail-view-model img");
    thumbnails.forEach((img) => {
      if (img.closest("yt-avatar-shape")) return;
      
      if (!img.classList.contains("thumbnail-controlled")) {
        const mode = settings.focusModeEnabled ? "hide" : settings.thumbnailMode;
        
        if (mode === "blur") {
          img.classList.add("thumbnail-controlled");
          img.classList.add("thumbnail-blurred");
          img.style.filter = `blur(${config.blurAmount})`;
        } else if (mode === "screenshot") {
          img.classList.add("thumbnail-controlled");
          replaceThumbnailWithScreenshot(img);
        }
      }
    });
  }

  function replaceThumbnailWithScreenshot(img) {
    const anchor = img.closest("a#thumbnail") || img.closest("a");
    if (!anchor) return;
    
    const href = anchor.getAttribute("href");
    if (!href) return;
    
    const videoIdMatch = href.match(/[?&]v=([^&]+)/) || href.match(/\/shorts\/([^?]+)/);
    if (!videoIdMatch) return;
    
    const videoId = videoIdMatch[1];
    // Use the middle frame (2.jpg) which is usually less clickbaity
    const screenshotUrl = `https://i.ytimg.com/vi/${videoId}/hq2.jpg`;
    
    if (img.src !== screenshotUrl) {
      img.src = screenshotUrl;
      if (img.srcset) img.srcset = screenshotUrl;
    }
  }

  function toggleShortsRemoval(enabled) {
    if (enabled || settings.focusModeEnabled) {
      removeShorts();
    } else {
      document.querySelectorAll(".shorts-hidden").forEach(el => {
        el.style.display = "";
        el.classList.remove("shorts-hidden");
      });
    }
  }

  function removeShorts() {
    if (!settings.shortsRemovalEnabled && !settings.focusModeEnabled) return;
    const selectors = [
      "ytd-rich-section-renderer[is-shorts-shelf]",
      "ytd-reel-shelf-renderer",
      'ytd-guide-entry-renderer a[title="Shorts"]',
      'ytd-mini-guide-entry-renderer a[title="Shorts"]',
      'a[href*="/shorts/"]'
    ];
    selectors.forEach(s => {
      document.querySelectorAll(s).forEach(el => {
        const target = el.closest("ytd-rich-item-renderer") || el;
        target.style.display = "none";
        target.classList.add("shorts-hidden");
      });
    });
  }

  function applyModifications() {
    applyThumbnailMode(settings.thumbnailMode);
    removeShorts();
  }

  popupObserver.observe(document.body, { childList: true, subtree: true });
  new MutationObserver(applyModifications).observe(document.body, { childList: true, subtree: true });

  applyModifications();
})();