// Main functionality for the extension
(function () {
  "use strict";

  // Configuration
  const config = {
    blurAmount: "10px",
    checkInterval: 1000, // Check for new elements every second
  };

  // Settings state
  let settings = {
    thumbnailMode: "blur", // "show", "blur", or "hide"
    shortsRemovalEnabled: true,
    pauseOnHoverEnabled: true,
    popupRemovalEnabled: true,
    timeReminderEnabled: true,
  };

  // Time tracking variables
  let sessionStartTime = null;
  let reminderTimer = null;
  let isSessionActive = false;
  let REMINDER_INTERVAL = 15 * 60 * 1000; // Default 15 minutes
  let totalWatchTime = 0; // New variable to store accumulated watch time
  let bonusYouTubeTime = 0; // New variable for bonus time from coding profiles

  // Create a MutationObserver for popup detection
  const popupObserver = new MutationObserver((mutations) => {
    if (settings.popupRemovalEnabled) {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeName === "TP-YT-IRON-OVERLAY-BACKDROP" ||
            (node.classList &&
              node.classList.contains("ytd-enforcement-message-view-model"))
          ) {
            removeAdBlockerPopup();
          }
        });
      });
    }
  });

  // Function to remove ad blocker popup
  function removeAdBlockerPopup() {
    if (!settings.popupRemovalEnabled) return;

    // Remove the backdrop
    const backdrop = document.querySelector("tp-yt-iron-overlay-backdrop");
    if (backdrop) {
      backdrop.remove();
    }

    // Remove the modal dialog
    const dialog = document.querySelector("ytd-enforcement-message-view-model");
    if (dialog) {
      dialog.remove();
    }

    // Remove enforcement message renderer
    const renderer = document.querySelector("ytd-enforcement-message-view-model-renderer");
    if (renderer) {
      renderer.remove();
    }

    // Re-enable scrolling on the body
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }

  // Load settings
  browser.storage.local
    .get([
      "thumbnailMode",
      "shortsRemovalEnabled",
      "pauseOnHoverEnabled",
      "popupRemovalEnabled",
      "timeReminderEnabled",
      "timerInterval",
      "totalWatchTime",
    ])
    .then((result) => {
      settings.thumbnailMode =
        result.thumbnailMode !== undefined ? result.thumbnailMode : "blur";
      settings.shortsRemovalEnabled =
        result.shortsRemovalEnabled !== undefined
          ? result.shortsRemovalEnabled
          : true;
      settings.pauseOnHoverEnabled =
        result.pauseOnHoverEnabled !== undefined
          ? result.pauseOnHoverEnabled
          : true;
      settings.popupRemovalEnabled =
        result.popupRemovalEnabled !== undefined
          ? result.popupRemovalEnabled
          : true;
      settings.timeReminderEnabled =
        result.timeReminderEnabled !== undefined
          ? result.timeReminderEnabled
          : true;
      totalWatchTime =
        result.totalWatchTime !== undefined ? result.totalWatchTime : 0;

      // Set timer interval
      const timerInterval = result.timerInterval || 15;
      REMINDER_INTERVAL = timerInterval * 60 * 1000;

      applyModifications();
      initializeTimeTracking();
    })
    .catch((error) => {
      console.error("Error loading settings:", error);
      // Continue with defaults if there's an error
      applyModifications();
      initializeTimeTracking();
    });

  // Listen for messages from popup
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === "changeThumbnailMode") {
      settings.thumbnailMode = message.mode;
      applyThumbnailMode(message.mode);
    } else if (message.action === "toggleShorts") {
      settings.shortsRemovalEnabled = message.enabled;
      toggleShortsRemoval(message.enabled);
    } else if (message.action === "togglePauseOnHover") {
      settings.pauseOnHoverEnabled = message.enabled;
      if (!message.enabled) {
        removeVideoControlListeners();
      } else {
        setupVideoControls();
      }
    } else if (message.action === "togglePopupRemoval") {
      settings.popupRemovalEnabled = message.enabled;
      if (message.enabled) {
        removeAdBlockerPopup();
      }
    } else if (message.action === "toggleTimeReminder") {
      settings.timeReminderEnabled = message.enabled;
      if (message.enabled) {
        initializeTimeTracking();
      } else {
        stopTimeTracking();
      }
    } else if (message.action === "updateTimerInterval") {
      REMINDER_INTERVAL = message.interval * 60 * 1000;
      // If currently watching, restart timer with new interval
      if (isSessionActive) {
        scheduleNextReminder();
      }
    } else if (message.action === "updateBonusTime") {
      bonusYouTubeTime = message.bonusMinutes * 60 * 1000; // Convert minutes to milliseconds
      console.log(
        `Received bonus YouTube time: ${message.bonusMinutes} minutes`
      );
      if (isSessionActive) {
        scheduleNextReminder(); // Reschedule reminder with new bonus time
      }
    }
    return Promise.resolve({ response: "Settings updated" });
  });

  // Function to apply thumbnail mode (show, blur, hide)
  function applyThumbnailMode(mode) {
    // If switching to "hide" mode, remove all thumbnail containers
    if (mode === "hide") {
      // Remove parent anchor elements that contain thumbnails
      const thumbnailParents = document.querySelectorAll(
        "a.yt-lockup-view-model__content-image"
      );
      thumbnailParents.forEach((parent) => {
        parent.remove();
      });

      // Also handle other thumbnail containers as fallback
      const thumbnailContainers = document.querySelectorAll(
        "yt-thumbnail-view-model, ytd-thumbnail"
      );
      thumbnailContainers.forEach((container) => {
        container.remove();
      });
      return;
    }

    // For switching between "show" and "blur" modes
    const thumbnails = document.querySelectorAll(".thumbnail-controlled");

    thumbnails.forEach((img) => {
      // Remove blur classes and styles
      img.classList.remove("thumbnail-blurred");
      img.style.filter = "";

      // Apply blur mode if selected
      if (mode === "blur") {
        img.classList.add("thumbnail-blurred");
        img.style.filter = `blur(${config.blurAmount})`;
      }
      // "show" mode: no classes, no filter
    });

    // Process any new thumbnails
    processThumbnails();
  }

  // Function to toggle Shorts removal
  function toggleShortsRemoval(enabled) {
    if (enabled) {
      document.body.classList.add("hide-shorts");
      removeShorts();
    } else {
      document.body.classList.remove("hide-shorts");
      document.querySelectorAll(".shorts-hidden").forEach((element) => {
        element.style.display = "";
        element.classList.remove("shorts-hidden");
      });
    }
  }

  // Function to process thumbnails based on current mode
  function processThumbnails() {
    // If mode is "hide", remove thumbnail containers entirely
    if (settings.thumbnailMode === "hide") {
      // Remove parent anchor elements that contain thumbnails
      const thumbnailParents = document.querySelectorAll(
        "a.yt-lockup-view-model__content-image"
      );
      thumbnailParents.forEach((parent) => {
        if (!parent.hasAttribute("data-thumbnail-removed")) {
          parent.setAttribute("data-thumbnail-removed", "true");
          parent.remove();
        }
      });

      // Also handle other thumbnail containers as fallback
      const thumbnailContainers = document.querySelectorAll(
        "yt-thumbnail-view-model, ytd-thumbnail"
      );
      thumbnailContainers.forEach((container) => {
        if (!container.hasAttribute("data-thumbnail-removed")) {
          container.setAttribute("data-thumbnail-removed", "true");
          container.remove();
        }
      });
      return;
    }

    // For "show" and "blur" modes, process thumbnail images
    const thumbnailSelectors = [
      // Old YouTube structure
      "ytd-thumbnail img",
      "ytd-compact-video-renderer img",
      "ytd-grid-video-renderer img",
      "ytd-video-renderer img",
      ".ytp-videowall-still-image img",
      "ytd-playlist-thumbnail img",
      // New YouTube structure
      ".ytThumbnailViewModelImage img",
      "img.ytCoreImageHost",
    ];

    const thumbnails = document.querySelectorAll(thumbnailSelectors.join(", "));

    thumbnails.forEach((img) => {
      if (!img.classList.contains("thumbnail-controlled")) {
        img.classList.add("thumbnail-controlled");

        // Apply the current mode
        if (settings.thumbnailMode === "blur") {
          img.classList.add("thumbnail-blurred");
          img.style.filter = `blur(${config.blurAmount})`;

          // Add touch event listeners for mobile
          img.addEventListener("touchstart", handleTouchStart);
          img.addEventListener("touchend", handleTouchEnd);
        }
        // "show" mode: no additional styles
      }
    });
  }

  // Touch event handlers
  let touchTimer;

  function handleTouchStart(e) {
    const img = e.target;
    touchTimer = setTimeout(() => {
      img.style.filter = "blur(0)";
    }, 200);
  }

  function handleTouchEnd(e) {
    clearTimeout(touchTimer);
    const img = e.target;
    if (settings.thumbnailMode === "blur") {
      img.style.filter = `blur(${config.blurAmount})`;
    }
  }

  // Function to remove Shorts
  function removeShorts() {
    if (!settings.shortsRemovalEnabled) return;

    const shortsSelectors = [
      "ytd-rich-section-renderer[is-shorts-shelf]",
      "ytd-reel-shelf-renderer",
      'ytd-guide-entry-renderer a[title="Shorts"]',
      'ytd-mini-guide-entry-renderer a[title="Shorts"]',
      'ytd-grid-video-renderer a[href*="/shorts/"]',
      'ytd-video-renderer a[href*="/shorts/"]',
      'ytd-rich-grid-row:has(a[href*="/shorts/"])',
      'ytd-shelf-renderer:has(a[href*="/shorts/"])',
      // New YouTube Shorts container structure
      'grid-shelf-view-model.ytGridShelfViewModelHost',
      'ytm-shorts-lockup-view-model',
      'ytm-shorts-lockup-view-model-v2',
      'a.shortsLockupViewModelHostEndpoint[href*="/shorts/"]',
    ];

    const textSelectors = [
      'ytd-browse[page-subtype="home"] ytd-rich-grid-row',
      'ytd-browse[page-subtype="subscriptions"] ytd-shelf-renderer',
      "ytd-browse ytd-rich-section-renderer",
      // New YouTube structure
      "grid-shelf-view-model",
      "ytd-item-section-renderer",
    ];

    document.querySelectorAll(shortsSelectors.join(", ")).forEach((element) => {
      if (!element.classList.contains("shorts-hidden")) {
        element.style.display = "none";
        element.classList.add("shorts-hidden");
      }
    });

    textSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        const text = element.textContent || "";
        if (
          text.includes("Shorts") &&
          !element.classList.contains("shorts-hidden")
        ) {
          element.style.display = "none";
          element.classList.add("shorts-hidden");
        }
      });
    });
  }

  // Store references to videos with event listeners
  const videoElements = new WeakMap();

  // Function to setup video controls
  function setupVideoControls() {
    if (!settings.pauseOnHoverEnabled) return;

    const videoSelectors = ["video", ".html5-main-video", ".video-stream"];

    const videos = document.querySelectorAll(videoSelectors.join(", "));

    videos.forEach((video) => {
      if (!videoElements.has(video)) {
        const touchStartHandler = () => {
          if (video.played.length > 0 && !video.paused) {
            video.pause();
            video.dataset.wasPausedByExtension = "true";
          }
        };

        const touchEndHandler = () => {
          if (video.dataset.wasPausedByExtension === "true") {
            video.play().catch((e) => {
              console.log("Auto-play prevented by browser policy:", e);
            });
            delete video.dataset.wasPausedByExtension;
          }
        };

        video.addEventListener("touchstart", touchStartHandler);
        video.addEventListener("touchend", touchEndHandler);

        videoElements.set(video, {
          touchStartHandler,
          touchEndHandler,
        });
      }
    });

    const thumbnailSelectors = [
      "ytd-thumbnail",
      "ytd-compact-video-renderer",
      "ytd-grid-video-renderer",
      "ytd-video-renderer",
    ];

    const thumbnails = document.querySelectorAll(thumbnailSelectors.join(", "));

    thumbnails.forEach((thumbnail) => {
      if (!thumbnail.hasAttribute("data-control-listener")) {
        thumbnail.setAttribute("data-control-listener", "true");

        thumbnail.addEventListener("touchstart", () => {
          const video = thumbnail.querySelector("video");
          if (video && video.played.length > 0 && !video.paused) {
            video.pause();
            video.dataset.wasPausedByExtension = "true";
          }
        });

        thumbnail.addEventListener("touchend", () => {
          const video = thumbnail.querySelector("video");
          if (video && video.dataset.wasPausedByExtension === "true") {
            video.play().catch((e) => {
              console.log("Auto-play prevented by browser policy:", e);
            });
            delete video.dataset.wasPausedByExtension;
          }
        });
      }
    });
  }

  // Function to remove video control event listeners
  function removeVideoControlListeners() {
    document
      .querySelectorAll("video, .html5-main-video, .video-stream")
      .forEach((video) => {
        if (videoElements.has(video)) {
          const handlers = videoElements.get(video);
          video.removeEventListener("touchstart", handlers.touchStartHandler);
          video.removeEventListener("touchend", handlers.touchEndHandler);
          videoElements.delete(video);
        }
      });

    document
      .querySelectorAll('[data-control-listener="true"]')
      .forEach((thumbnail) => {
        thumbnail.removeAttribute("data-control-listener");
      });
  }

  // Time tracking functions
  function initializeTimeTracking() {
    if (!settings.timeReminderEnabled) return;

    // Load any previously accumulated watch time
    browser.storage.local.get("totalWatchTime").then((result) => {
      totalWatchTime = result.totalWatchTime || 0;
      console.log(`Loaded totalWatchTime: ${totalWatchTime / 1000} seconds`);
      // If already on a YouTube page, potentially start the timer
      if (window.location.host.includes("youtube.com")) {
        scheduleNextReminder(); // Schedule initial reminder based on accumulated time
      }
    });

    // Listen for navigation changes - specifically when leaving a /watch page
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        // If we were on a watch page and now we're not, stop the session and save time
        if (lastUrl.includes("/watch") && !url.includes("/watch")) {
          stopWatchingSession();
        } else if (!lastUrl.includes("/watch") && url.includes("/watch")) {
          // If we just entered a watch page, start tracking, but only if a video is playing
          // The actual start of tracking will happen on 'play' event
        } else if (url.includes("/watch") && lastUrl.includes("/watch")) {
          // If navigating between videos on watch pages, reset session start but continue total tracking
          if (isSessionActive) {
            const sessionDuration = Date.now() - sessionStartTime;
            totalWatchTime += sessionDuration;
            console.log(
              `Navigated within watch pages. Accumulated time: ${
                totalWatchTime / 1000
              }s`
            );
          }
          sessionStartTime = Date.now(); // Reset session start for current video
          scheduleNextReminder(); // Reschedule based on new video context (if applicable)
        }
        lastUrl = url;
      }
    }).observe(document, { subtree: true, childList: true });

    // Listen for video play/pause events
    document.addEventListener("play", handleVideoPlay, true);
    document.addEventListener("pause", handleVideoPause, true);
  }

  function startWatchingSession() {
    if (!settings.timeReminderEnabled) return;

    if (!isSessionActive) {
      sessionStartTime = Date.now();
      isSessionActive = true;
      console.log("Watching session started.");
    }
    scheduleNextReminder();
  }

  function stopWatchingSession() {
    if (!settings.timeReminderEnabled || !isSessionActive) return;

    const sessionDuration = Date.now() - sessionStartTime;
    totalWatchTime += sessionDuration;
    isSessionActive = false;
    sessionStartTime = null;

    browser.storage.local
      .set({ totalWatchTime })
      .then(() => {
        console.log(`Watch time saved: ${totalWatchTime / 1000} seconds`);
      })
      .catch((error) => {
        console.error("Error saving total watch time:", error);
      });

    if (reminderTimer) {
      clearTimeout(reminderTimer);
      reminderTimer = null;
    }
    console.log("Watching session stopped.");
  }

  function scheduleNextReminder() {
    if (!settings.timeReminderEnabled || !isSessionActive) {
      if (reminderTimer) {
        clearTimeout(reminderTimer);
        reminderTimer = null;
      }
      return;
    }

    if (reminderTimer) {
      clearTimeout(reminderTimer);
    }

    const timeElapsedInCurrentPeriod =
      totalWatchTime % (REMINDER_INTERVAL + bonusYouTubeTime);
    const timeLeftForNextReminder =
      REMINDER_INTERVAL + bonusYouTubeTime - timeElapsedInCurrentPeriod;

    console.log(
      `Scheduling next reminder in ${
        timeLeftForNextReminder / 1000
      } seconds. Total watched: ${totalWatchTime / 1000}s`
    );

    reminderTimer = setTimeout(() => {
      showTimeReminder();
    }, timeLeftForNextReminder);
  }

  function stopTimeTracking() {
    stopWatchingSession(); // Ensure totalWatchTime is saved before stopping
    document.removeEventListener("play", handleVideoPlay, true);
    document.removeEventListener("pause", handleVideoPause, true);
    // Optionally, reset totalWatchTime if tracking is completely disabled
    totalWatchTime = 0;
    browser.storage.local.set({ totalWatchTime: 0 });
  }

  function handleVideoPlay(event) {
    if (!settings.timeReminderEnabled) return;

    const video = event.target;
    if (
      video.tagName === "VIDEO" &&
      window.location.pathname.includes("/watch")
    ) {
      startWatchingSession();
    }
  }

  function handleVideoPause(event) {
    if (!settings.timeReminderEnabled) return;

    const video = event.target;
    if (
      video.tagName === "VIDEO" &&
      window.location.pathname.includes("/watch")
    ) {
      // Don't stop session for short pauses, only for longer ones
      // This prevents saving time constantly during minor interruptions
      setTimeout(() => {
        if (video.paused) {
          stopWatchingSession();
        }
      }, 5000); // 5 second delay
    }
  }

  function showTimeReminder() {
    if (!settings.timeReminderEnabled) return;

    // Pause the video
    const video = document.querySelector("video");
    if (video) {
      video.pause();
    }

    // Ensure current session time is added before showing reminder
    if (isSessionActive && sessionStartTime) {
      totalWatchTime += Date.now() - sessionStartTime;
      sessionStartTime = Date.now(); // Reset session start for continuity after reminder
      browser.storage.local.set({ totalWatchTime });
    }

    const minutesWatched = Math.round(totalWatchTime / (60 * 1000));

    // Create reminder popup
    const reminderDiv = document.createElement("div");
    reminderDiv.id = "youtube-time-reminder";
    reminderDiv.innerHTML = `
      <div class="reminder-content">
        <div class="reminder-header">
          <h3>⏰ Time Check!</h3>
          <button class="reminder-close">&times;</button>
        </div>
        <p>You've been watching YouTube for ${minutesWatched} minutes.</p>
        <p>Take a moment to consider if you're still on track with your goals.</p>
        <div class="reminder-buttons">
          <button class="reminder-btn continue">Continue Watching</button>
          <button class="reminder-btn take-break">Take a Break</button>
        </div>
      </div>
    `;

    document.body.appendChild(reminderDiv);

    // Add event listeners
    const closeBtn = reminderDiv.querySelector(".reminder-close");
    const continueBtn = reminderDiv.querySelector(".continue");
    const breakBtn = reminderDiv.querySelector(".take-break");

    closeBtn.addEventListener("click", () => {
      dismissReminder();
      scheduleNextReminder(); // Reschedule timer
    });

    continueBtn.addEventListener("click", () => {
      dismissReminder();
      scheduleNextReminder(); // Reschedule timer
    });

    breakBtn.addEventListener("click", () => {
      dismissReminder();
      stopWatchingSession(); // Stop tracking entirely for a break
      // Pause the video
      const video = document.querySelector("video");
      if (video) {
        video.pause();
      }
    });

    // Auto-dismiss after 30 seconds if no interaction
    setTimeout(() => {
      if (document.getElementById("youtube-time-reminder")) {
        dismissReminder();
        scheduleNextReminder(); // Reschedule timer
      }
    }, 30000);
  }

  function dismissReminder() {
    const reminder = document.getElementById("youtube-time-reminder");
    if (reminder) {
      reminder.remove();
    }
  }

  // Main function to apply all modifications
  function applyModifications() {
    processThumbnails();
    removeShorts();
    setupVideoControls();
  }

  // Start observing for popups
  popupObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Create a MutationObserver to detect when new content is loaded
  const observer = new MutationObserver((mutations) => {
    let shouldApplyModifications = false;

    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        shouldApplyModifications = true;
      }
    });

    if (shouldApplyModifications) {
      applyModifications();
    }
  });

  // Start observing the document with the configured parameters
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial application
  applyModifications();
})();
