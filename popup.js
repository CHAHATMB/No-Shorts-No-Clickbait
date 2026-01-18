document.addEventListener("DOMContentLoaded", function () {
  const thumbnailModeRadios = document.querySelectorAll('input[name="thumbnail-mode"]');
  const shortsToggle = document.getElementById("shorts-toggle");
  const pauseToggle = document.getElementById("pause-toggle");
  const popupToggle = document.getElementById("popup-toggle");
  const timeReminderToggle = document.getElementById("time-reminder-toggle");
  const timerConfig = document.getElementById("timer-config");
  const customTimerInput = document.getElementById("custom-timer");
  const timerPresets = document.querySelectorAll('input[name="timer-preset"]');

  const leetcodeUsernameInput = document.getElementById("leetcode-username");
  const codechefUsernameInput = document.getElementById("codechef-username");
  const codeforcesUsernameInput = document.getElementById(
    "codeforces-username"
  );
  const hackerrankUsernameInput = document.getElementById(
    "hackerrank-username"
  );
  const codingBonusToggle = document.getElementById("coding-bonus-toggle");

  const solvedProblemsCountSpan = document.getElementById(
    "solved-problems-count"
  );
  const bonusTimeSpan = document.getElementById("bonus-time");

  // Load timer settings
  browser.storage.local.get(["timerInterval", "timerPreset"]).then((result) => {
    const interval = result.timerInterval || 15;
    const preset = result.timerPreset || "15";

    // Set the correct radio button
    const presetRadio = document.querySelector(
      `input[name="timer-preset"][value="${preset}"]`
    );
    if (presetRadio) {
      presetRadio.checked = true;
    }

    // If custom, enable input and set value
    if (preset === "custom") {
      customTimerInput.disabled = false;
      customTimerInput.value = interval;
    }
  });

  // Load settings from storage
  browser.storage.local
    .get([
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
    ])
    .then((result) => {
      // Set default values if settings don't exist
      const thumbnailMode = result.thumbnailMode || "blur";
      const thumbnailModeRadio = document.querySelector(
        `input[name="thumbnail-mode"][value="${thumbnailMode}"]`
      );
      if (thumbnailModeRadio) {
        thumbnailModeRadio.checked = true;
      }

      shortsToggle.checked =
        result.shortsRemovalEnabled !== undefined
          ? result.shortsRemovalEnabled
          : true;
      pauseToggle.checked =
        result.pauseOnHoverEnabled !== undefined
          ? result.pauseOnHoverEnabled
          : true;
      popupToggle.checked =
        result.popupRemovalEnabled !== undefined
          ? result.popupRemovalEnabled
          : true;
      timeReminderToggle.checked =
        result.timeReminderEnabled !== undefined
          ? result.timeReminderEnabled
          : true;

      leetcodeUsernameInput.value = result.leetcodeUsername || "";
      codechefUsernameInput.value = result.codechefUsername || "";
      codeforcesUsernameInput.value = result.codeforcesUsername || "";
      hackerrankUsernameInput.value = result.hackerrankUsername || "";
      codingBonusToggle.checked =
        result.codingBonusEnabled !== undefined
          ? result.codingBonusEnabled
          : true;

      // Update display for solved problems and bonus time
      const dailySolvedProblems = result.dailySolvedProblems || {
        leetcode: 0,
        codechef: 0,
        codeforces: 0,
      };
      const totalSolved =
        dailySolvedProblems.leetcode +
        dailySolvedProblems.codechef +
        dailySolvedProblems.codeforces;
      solvedProblemsCountSpan.textContent = totalSolved;
      bonusTimeSpan.textContent =
        result.bonusYouTubeTime !== undefined ? result.bonusYouTubeTime : 0;

      // Show/hide timer config based on toggle state
      if (timeReminderToggle.checked) {
        timerConfig.classList.remove("hidden");
      } else {
        timerConfig.classList.add("hidden");
      }
    })
    .catch((error) => {
      console.error("Error loading settings:", error);
      // Use defaults if there's an error
      const blurRadio = document.querySelector(
        'input[name="thumbnail-mode"][value="blur"]'
      );
      if (blurRadio) blurRadio.checked = true;
      shortsToggle.checked = true;
      pauseToggle.checked = true;
      popupToggle.checked = true;
      timeReminderToggle.checked = true;
      codingBonusToggle.checked = true;
      solvedProblemsCountSpan.textContent = "0";
      bonusTimeSpan.textContent = "0";
    });

  // Listen for messages from background script to update UI
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "updateBonusTime") {
      bonusTimeSpan.textContent = message.bonusMinutes;
      // Also update solved problems if the message contains that info
      if (message.dailySolvedProblems) {
        const totalSolved =
          message.dailySolvedProblems.leetcode +
          message.dailySolvedProblems.codechef +
          message.dailySolvedProblems.codeforces;
        solvedProblemsCountSpan.textContent = totalSolved;
      }
    }
  });

  // Save settings when thumbnail mode is changed
  thumbnailModeRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      const mode = this.value; // "show", "blur", or "hide"
      browser.storage.local.set({ thumbnailMode: mode });

      // Send message to content script
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0].url.includes("youtube.com")) {
          browser.tabs.sendMessage(tabs[0].id, {
            action: "changeThumbnailMode",
            mode: mode,
          });
        }
      });
    });
  });

  shortsToggle.addEventListener("change", function () {
    browser.storage.local.set({ shortsRemovalEnabled: this.checked });

    // Send message to content script
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0].url.includes("youtube.com")) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: "toggleShorts",
          enabled: shortsToggle.checked,
        });
      }
    });
  });

  pauseToggle.addEventListener("change", function () {
    browser.storage.local.set({ pauseOnHoverEnabled: this.checked });

    // Send message to content script
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0].url.includes("youtube.com")) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: "togglePauseOnHover",
          enabled: pauseToggle.checked,
        });
      }
    });
  });

  popupToggle.addEventListener("change", function () {
    browser.storage.local.set({ popupRemovalEnabled: this.checked });

    // Send message to content script
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0].url.includes("youtube.com")) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: "togglePopupRemoval",
          enabled: popupToggle.checked,
        });
      }
    });
  });

  timeReminderToggle.addEventListener("change", function () {
    browser.storage.local.set({ timeReminderEnabled: this.checked });

    // Show/hide timer config
    if (this.checked) {
      timerConfig.classList.remove("hidden");
    } else {
      timerConfig.classList.add("hidden");
    }

    // Send message to content script
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0].url.includes("youtube.com")) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: "toggleTimeReminder",
          enabled: timeReminderToggle.checked,
        });
      }
    });
  });

  // Coding profile input and toggle handlers
  function saveCodingProfileSettings() {
    browser.storage.local
      .set({
        leetcodeUsername: leetcodeUsernameInput.value,
        codechefUsername: codechefUsernameInput.value,
        codeforcesUsername: codeforcesUsernameInput.value,
        hackerrankUsername: hackerrankUsernameInput.value,
        codingBonusEnabled: codingBonusToggle.checked,
      })
      .then(() => {
        // Send message to background script to update coding profiles
        browser.runtime.sendMessage({
          action: "updateCodingProfiles",
          leetcodeUsername: leetcodeUsernameInput.value,
          codechefUsername: codechefUsernameInput.value,
          codeforcesUsername: codeforcesUsernameInput.value,
          hackerrankUsername: hackerrankUsernameInput.value,
          codingBonusEnabled: codingBonusToggle.checked,
        });
      });
  }

  leetcodeUsernameInput.addEventListener("change", saveCodingProfileSettings);
  codechefUsernameInput.addEventListener("change", saveCodingProfileSettings);
  codeforcesUsernameInput.addEventListener("change", saveCodingProfileSettings);
  hackerrankUsernameInput.addEventListener("change", saveCodingProfileSettings);
  codingBonusToggle.addEventListener("change", saveCodingProfileSettings);

  // Handle timer preset changes
  timerPresets.forEach((radio) => {
    radio.addEventListener("change", function () {
      const preset = this.value;
      let interval;

      if (preset === "custom") {
        customTimerInput.disabled = false;
        interval = parseInt(customTimerInput.value) || 45;
      } else {
        customTimerInput.disabled = true;
        interval = parseInt(preset);
      }

      // Save settings
      browser.storage.local.set({
        timerPreset: preset,
        timerInterval: interval,
      });

      // Send to content script
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0].url.includes("youtube.com")) {
          browser.tabs.sendMessage(tabs[0].id, {
            action: "updateTimerInterval",
            interval: interval,
          });
        }
      });
    });
  });

  // Handle custom timer input changes
  customTimerInput.addEventListener("change", function () {
    const customRadio = document.querySelector(
      'input[name="timer-preset"][value="custom"]'
    );
    if (customRadio && customRadio.checked) {
      const interval = parseInt(this.value) || 45;

      // Validate range
      if (interval < 1) this.value = 1;
      if (interval > 180) this.value = 180;

      const finalInterval = parseInt(this.value);

      // Save settings
      browser.storage.local.set({
        timerInterval: finalInterval,
      });

      // Send to content script
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0].url.includes("youtube.com")) {
          browser.tabs.sendMessage(tabs[0].id, {
            action: "updateTimerInterval",
            interval: finalInterval,
          });
        }
      });
    }
  });
});
