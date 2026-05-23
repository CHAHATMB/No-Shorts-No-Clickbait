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

  // Coding Profile Elements
  const leetcodeUsernameInput = document.getElementById("leetcode-username");
  const codechefUsernameInput = document.getElementById("codechef-username");
  const codeforcesUsernameInput = document.getElementById("codeforces-username");
  const hackerrankUsernameInput = document.getElementById("hackerrank-username");
  const codingBonusToggle = document.getElementById("coding-bonus-toggle");
  const codingProfileInputs = document.getElementById("coding-profile-inputs");
  const codingProfileStatus = document.getElementById("coding-profile-status");

  const solvedProblemsCountSpan = document.getElementById("solved-problems-count");
  const bonusTimeSpan = document.getElementById("bonus-time");

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
    });
  });

  // Dynamic UI visibility logic
  function updateDynamicUI(thumbnailMode, codingBonusEnabled, timeReminderEnabled) {
    // Hide pause on hover if thumbnails are hidden
    if (thumbnailMode === "hide") {
      pauseOnHoverCard.classList.add("hidden");
    } else {
      pauseOnHoverCard.classList.remove("hidden");
    }

    // Toggle coding profile inputs/status
    if (codingBonusEnabled) {
      codingProfileInputs.classList.remove("hidden");
      codingProfileStatus.classList.remove("hidden");
    } else {
      codingProfileInputs.classList.add("hidden");
      codingProfileStatus.classList.add("hidden");
    }

    // Toggle timer config
    if (timeReminderEnabled) {
      timerConfig.classList.remove("hidden");
    } else {
      timerConfig.classList.add("hidden");
    }
  }

  // Feature flag check
  if (!FEATURES.CODING_PLATFORM_INTEGRATION) {
    if (codingIntegrationFeature) {
      codingIntegrationFeature.style.display = 'none';
    }
  }

  // Coding profile input and toggle handlers
  function saveCodingProfileSettings() {
    const settings = {
      leetcodeUsername: leetcodeUsernameInput.value,
      codechefUsername: codechefUsernameInput.value,
      codeforcesUsername: codeforcesUsernameInput.value,
      hackerrankUsername: hackerrankUsernameInput.value,
      codingBonusEnabled: codingBonusToggle.checked,
    };

    browser.storage.local.set(settings).then(() => {
      updateDynamicUI(
        document.querySelector('input[name="thumbnail-mode"]:checked').value,
        codingBonusToggle.checked,
        timeReminderToggle.checked
      );
      
      browser.runtime.sendMessage({
        action: "updateCodingProfiles",
        ...settings
      });
    });
  }

  if (FEATURES.CODING_PLATFORM_INTEGRATION) {
    [leetcodeUsernameInput, codechefUsernameInput, codeforcesUsernameInput, hackerrankUsernameInput, codingBonusToggle].forEach(el => {
      el.addEventListener("change", saveCodingProfileSettings);
    });
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
    "shortsRemovalEnabled",
    "pauseOnHoverEnabled",
    "popupRemovalEnabled",
    "timeReminderEnabled",
    "leetcodeUsername",
    "codechefUsername",
    "codeforcesUsername",
    "hackerrankUsername",
    "codingBonusEnabled",
    "dailySolvedProblems",
    "bonusYouTubeTime",
  ]).then((result) => {
    const thumbnailMode = result.thumbnailMode || "blur";
    const thumbnailModeRadio = document.querySelector(`input[name="thumbnail-mode"][value="${thumbnailMode}"]`);
    if (thumbnailModeRadio) thumbnailModeRadio.checked = true;

    shortsToggle.checked = result.shortsRemovalEnabled !== undefined ? result.shortsRemovalEnabled : true;
    pauseToggle.checked = result.pauseOnHoverEnabled !== undefined ? result.pauseOnHoverEnabled : true;
    popupToggle.checked = result.popupRemovalEnabled !== undefined ? result.popupRemovalEnabled : true;
    timeReminderToggle.checked = result.timeReminderEnabled !== undefined ? result.timeReminderEnabled : true;

    leetcodeUsernameInput.value = result.leetcodeUsername || "";
    codechefUsernameInput.value = result.codechefUsername || "";
    codeforcesUsernameInput.value = result.codeforcesUsername || "";
    hackerrankUsernameInput.value = result.hackerrankUsername || "";
    codingBonusToggle.checked = result.codingBonusEnabled !== undefined ? result.codingBonusEnabled : true;

    // Update display for solved problems and bonus time
    const dailySolvedProblems = result.dailySolvedProblems || { leetcode: 0, codechef: 0, codeforces: 0 };
    const totalSolved = dailySolvedProblems.leetcode + dailySolvedProblems.codechef + dailySolvedProblems.codeforces;
    solvedProblemsCountSpan.textContent = totalSolved;
    bonusTimeSpan.textContent = result.bonusYouTubeTime !== undefined ? result.bonusYouTubeTime : 0;

    // Initial dynamic UI update
    updateDynamicUI(thumbnailMode, codingBonusToggle.checked, timeReminderToggle.checked);
  });

  // Listen for messages from background script
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "updateBonusTime") {
      bonusTimeSpan.textContent = message.bonusMinutes;
      if (message.dailySolvedProblems) {
        const totalSolved = message.dailySolvedProblems.leetcode + message.dailySolvedProblems.codechef + message.dailySolvedProblems.codeforces;
        solvedProblemsCountSpan.textContent = totalSolved;
      }
    }
  });

  // Thumbnail mode handler
  thumbnailModeRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      const mode = this.value;
      browser.storage.local.set({ thumbnailMode: mode });
      updateDynamicUI(mode, codingBonusToggle.checked, timeReminderToggle.checked);

      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.url?.includes("youtube.com")) {
          browser.tabs.sendMessage(tabs[0].id, { action: "changeThumbnailMode", mode: mode });
        }
      });
    });
  });

  // Other toggle handlers
  const toggles = [
    { el: shortsToggle, key: "shortsRemovalEnabled", action: "toggleShorts" },
    { el: pauseToggle, key: "pauseOnHoverEnabled", action: "togglePauseOnHover" },
    { el: popupToggle, key: "popupRemovalEnabled", action: "togglePopupRemoval" },
    { el: timeReminderToggle, key: "timeReminderEnabled", action: "toggleTimeReminder" }
  ];

  toggles.forEach(({ el, key, action }) => {
    el.addEventListener("change", function () {
      browser.storage.local.set({ [key]: this.checked });
      
      if (el === timeReminderToggle) {
        updateDynamicUI(
          document.querySelector('input[name="thumbnail-mode"]:checked').value,
          codingBonusToggle.checked,
          this.checked
        );
      }

      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.url?.includes("youtube.com")) {
          browser.tabs.sendMessage(tabs[0].id, { action, enabled: this.checked });
        }
      });
    });
  });

  // Timer preset handlers
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

  // Custom timer input handler
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
});
