import './browser-polyfill.js';
import { FEATURES } from './features.js';

document.addEventListener("DOMContentLoaded", function () {
  // Tab Elements
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Feature Elements
  const codingIntegrationFeature = document.getElementById("coding-integration-feature");
  const thumbnailModeRadios = document.querySelectorAll('input[name="thumbnail-mode"]');
  const shortsToggle = document.getElementById("shorts-toggle");
  const pauseToggle = document.getElementById("pause-toggle");
  const pauseOnHoverCard = document.getElementById("pause-on-hover-card");
  const popupToggle = document.getElementById("popup-toggle");
  const timeReminderToggle = document.getElementById("time-reminder-toggle");
  const timerConfig = document.getElementById("timer-config");
  const customTimerInput = document.getElementById("custom-timer");
  const timerPresets = document.querySelectorAll('input[name="timer-preset"]');

  const blurIntensityConfig = document.getElementById("blur-intensity-config");
  const blurRangeInput = document.getElementById("blur-range");
  const blurValueDisplay = document.getElementById("blur-value-display");

  const focusModeToggle = document.getElementById("focus-mode-toggle");

  function updateDeepFocusUI(enabled) {
    const mainContent = document.querySelectorAll('#tab-customization .feature-card:not(.focus-mode-card)');
    mainContent.forEach(card => {
      if (enabled) {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
      } else {
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      }
    });
  }

  let dailyWatchStats = {};

  // Tab Switching Logic
  const leetcodeUsernameInput = document.getElementById("leetcode-username");
  const codingBonusToggle = document.getElementById("coding-bonus-toggle");
  const remainingTimeDisplay = document.getElementById("remaining-time-display");
  const earnedTimeDisplay = document.getElementById("earned-time-display");
  const solvedEasySpan = document.getElementById("solved-easy");
  const solvedMediumSpan = document.getElementById("solved-medium");
  const solvedHardSpan = document.getElementById("solved-hard");

  const totalWatchedTodayDisplay = document.getElementById("total-watched-today");
  const continueCountTodayDisplay = document.getElementById("continue-count-today");
  const breaksTakenTodayDisplay = document.getElementById("breaks-taken-today");
  const graphContainer = document.getElementById("watch-stats-graph");
  const graphLabels = document.getElementById("graph-labels");

  // Tab Switching Logic
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      
      // Update buttons
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Update contents
      tabContents.forEach(content => {
        content.classList.remove("active");
        if (content.id === `tab-${tabId}`) {
          content.classList.add("active");
        }
      });

      if (tabId === "productivity") {
        renderWatchHistoryGraph(dailyWatchStats);
      }
    });
  });

  // Feature flag check
  if (!FEATURES.CODING_PLATFORM_INTEGRATION) {
    if (codingIntegrationFeature) {
      codingIntegrationFeature.style.display = 'none';
    }
  }

  // Load timer settings
  browser.storage.local.get(["timerInterval", "timerPreset"]).then((result) => {
    const interval = result.timerInterval || 15;
    const preset = result.timerPreset || "15";

    const presetRadio = document.querySelector(`input[name="timer-preset"][value="${preset}"]`);
    if (presetRadio) presetRadio.checked = true;

    if (preset === "custom") {
      customTimerInput.disabled = false;
      customTimerInput.value = interval;
    }
  });

  // Load all settings from storage
  browser.storage.local.get([
    "thumbnailMode",
    "blurAmount",
    "shortsRemovalEnabled",
    "pauseOnHoverEnabled",
    "popupRemovalEnabled",
    "timeReminderEnabled",
    "leetcodeUsername",
    "codingBonusEnabled",
    "solvedProblemsHistory",
    "totalWatchTimeToday",
    "continueCountToday",
    "dailyWatchStats"
  ]).then((result) => {
    const focusModeEnabled = result.focusModeEnabled || false;
    focusModeToggle.checked = focusModeEnabled;
    updateDeepFocusUI(focusModeEnabled);

    const thumbnailMode = result.thumbnailMode || "blur";
    const thumbnailModeRadio = document.querySelector(`input[name="thumbnail-mode"][value="${thumbnailMode}"]`);
    if (thumbnailModeRadio) thumbnailModeRadio.checked = true;

    const blurAmount = result.blurAmount || 10;
    blurRangeInput.value = blurAmount;
    blurValueDisplay.textContent = `${blurAmount}px`;

    // Show/hide blur intensity config
    if (thumbnailMode === "blur") {
      blurIntensityConfig.classList.remove("hidden");
    }

    shortsToggle.checked = result.shortsRemovalEnabled !== undefined ? result.shortsRemovalEnabled : true;
    pauseToggle.checked = result.pauseOnHoverEnabled !== undefined ? result.pauseOnHoverEnabled : true;
    popupToggle.checked = result.popupRemovalEnabled !== undefined ? result.popupRemovalEnabled : true;
    timeReminderToggle.checked = result.timeReminderEnabled !== undefined ? result.timeReminderEnabled : true;

    leetcodeUsernameInput.value = result.leetcodeUsername || "";
    codingBonusToggle.checked = result.codingBonusEnabled !== undefined ? result.codingBonusEnabled : true;
    
    dailyWatchStats = result.dailyWatchStats || {};

    // Hide pause on hover card if thumbnails are hidden
    if (thumbnailMode === "hide") {
      pauseOnHoverCard.classList.add("hidden");
    }

    // Toggle timer config
    if (!timeReminderToggle.checked) {
      timerConfig.classList.add("hidden");
    }

    const today = new Date().toDateString();
    const stats = (result.solvedProblemsHistory && result.solvedProblemsHistory[today]) || {
      easy: 0,
      medium: 0,
      hard: 0,
      totalMinutes: 0,
    };
    
    updateUIStats({
      remainingTime: result.remainingTime || 0,
      earnedMinutesToday: stats.totalMinutes,
      solvedToday: stats,
      totalWatchTimeToday: result.totalWatchTimeToday || 0,
      continueCountToday: result.continueCountToday || 0,
      breaksTakenToday: result.breaksTakenToday || 0
    });

    renderWatchHistoryGraph(result.dailyWatchStats || {});
  });

  function renderWatchHistoryGraph(stats) {
    if (!graphContainer) return;
    
    graphContainer.innerHTML = "";
    graphLabels.innerHTML = "";

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toDateString());
    }

    const maxMinutes = Math.max(...Object.values(stats), 60); // At least 60m scale

    days.forEach(day => {
      const minutes = stats[day] || 0;
      const height = (minutes / maxMinutes) * 100;
      
      const barContainer = document.createElement("div");
      barContainer.className = "graph-bar-container";
      
      const bar = document.createElement("div");
      bar.className = "graph-bar";
      bar.style.height = `${Math.max(height, 2)}%`;
      bar.setAttribute("data-value", minutes);
      
      barContainer.appendChild(bar);
      graphContainer.appendChild(barContainer);

      const label = document.createElement("div");
      label.className = "graph-label";
      const shortDay = day.split(" ")[0]; // Mon, Tue, etc.
      label.textContent = shortDay;
      graphLabels.appendChild(label);
    });
  }

  function updateBlurAmount(amount) {
    blurValueDisplay.textContent = `${amount}px`;
    browser.storage.local.set({ blurAmount: parseInt(amount) });

    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]?.url?.includes("youtube.com")) {
        browser.tabs.sendMessage(tabs[0].id, { 
          action: "updateBlurAmount", 
          amount: `${amount}px` 
        });
      }
    });
  }

  blurRangeInput.addEventListener("input", (e) => {
    updateBlurAmount(e.target.value);
  });

  function updateUIStats(data) {
    if (data.remainingTime !== undefined) {
      remainingTimeDisplay.textContent = `${Math.round(data.remainingTime / 1000 / 60)}m`;
    }
    if (data.earnedMinutesToday !== undefined) {
      earnedTimeDisplay.textContent = `${data.earnedMinutesToday}m`;
    }
    if (data.solvedToday) {
      solvedEasySpan.textContent = data.solvedToday.easy || 0;
      solvedMediumSpan.textContent = data.solvedToday.medium || 0;
      solvedHardSpan.textContent = data.solvedToday.hard || 0;
    }
    if (data.totalWatchTimeToday !== undefined) {
      totalWatchedTodayDisplay.textContent = `${Math.round(data.totalWatchTimeToday / 1000 / 60)}m`;
    }
    if (data.continueCountToday !== undefined) {
      continueCountTodayDisplay.textContent = data.continueCountToday;
    }
    if (data.breaksTakenToday !== undefined) {
      breaksTakenTodayDisplay.textContent = data.breaksTakenToday;
    }
  }

  // Listen for messages from background script
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "updateStats") {
      updateUIStats(message);
    }
  });

  function saveCodingProfileSettings() {
    browser.storage.local
      .set({
        leetcodeUsername: leetcodeUsernameInput.value,
        codingBonusEnabled: codingBonusToggle.checked,
      })
      .then(() => {
        browser.runtime.sendMessage({
          action: "updateCodingProfiles",
          leetcodeUsername: leetcodeUsernameInput.value,
          codingBonusEnabled: codingBonusToggle.checked,
        });
      });
  }

  if (FEATURES.CODING_PLATFORM_INTEGRATION) {
    leetcodeUsernameInput.addEventListener("change", saveCodingProfileSettings);
    codingBonusToggle.addEventListener("change", saveCodingProfileSettings);
  }

  // Thumbnail mode handler
  thumbnailModeRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      const mode = this.value;
      browser.storage.local.set({ thumbnailMode: mode });
      
      if (mode === "blur") {
        blurIntensityConfig.classList.remove("hidden");
      } else {
        blurIntensityConfig.classList.add("hidden");
      }

      if (mode === "hide") {
        pauseOnHoverCard.classList.add("hidden");
      } else {
        pauseOnHoverCard.classList.remove("hidden");
      }

      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.url?.includes("youtube.com")) {
          browser.tabs.sendMessage(tabs[0].id, { action: "changeThumbnailMode", mode: mode });
        }
      });
    });
  });

  shortsToggle.addEventListener("change", function () {
    browser.storage.local.set({ shortsRemovalEnabled: this.checked });
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]?.url?.includes("youtube.com")) {
        browser.tabs.sendMessage(tabs[0].id, { action: "toggleShorts", enabled: this.checked });
      }
    });
  });

  pauseToggle.addEventListener("change", function () {
    browser.storage.local.set({ pauseOnHoverEnabled: this.checked });
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]?.url?.includes("youtube.com")) {
        browser.tabs.sendMessage(tabs[0].id, { action: "togglePauseOnHover", enabled: this.checked });
      }
    });
  });

  popupToggle.addEventListener("change", function () {
    browser.storage.local.set({ popupRemovalEnabled: this.checked });
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]?.url?.includes("youtube.com")) {
        browser.tabs.sendMessage(tabs[0].id, { action: "togglePopupRemoval", enabled: this.checked });
      }
    });
  });

  timeReminderToggle.addEventListener("change", function () {
    browser.storage.local.set({ timeReminderEnabled: this.checked });
    if (this.checked) {
      timerConfig.classList.remove("hidden");
    } else {
      timerConfig.classList.add("hidden");
    }
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]?.url?.includes("youtube.com")) {
        browser.tabs.sendMessage(tabs[0].id, { action: "toggleTimeReminder", enabled: this.checked });
      }
    });
  });

  timerPresets.forEach((radio) => {
    radio.addEventListener("change", function () {
      const preset = this.value;
      let interval = preset === "custom" ? (parseInt(customTimerInput.value) || 45) : parseInt(preset);
      customTimerInput.disabled = preset !== "custom";

      browser.storage.local.set({ timerPreset: preset, timerInterval: interval });

      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.url?.includes("youtube.com")) {
          browser.tabs.sendMessage(tabs[0].id, { action: "updateTimerInterval", interval });
        }
      });
    });
  });

  customTimerInput.addEventListener("change", function () {
    const customRadio = document.querySelector('input[name="timer-preset"][value="custom"]');
    if (customRadio?.checked) {
      let interval = parseInt(this.value) || 45;
      if (interval < 1) this.value = 1;
      if (interval > 180) this.value = 180;
      interval = parseInt(this.value);

      browser.storage.local.set({ timerInterval: interval });

      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.url?.includes("youtube.com")) {
          browser.tabs.sendMessage(tabs[0].id, { action: "updateTimerInterval", interval });
        }
      });
    }
  });

  focusModeToggle.addEventListener("change", function () {
    const enabled = this.checked;
    browser.storage.local.set({ focusModeEnabled: enabled });
    updateDeepFocusUI(enabled);

    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]?.url?.includes("youtube.com")) {
        browser.tabs.sendMessage(tabs[0].id, { 
          action: "toggleDeepFocus", 
          enabled: enabled 
        });
      }
    });
  });
});