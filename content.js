// Main functionality for the extension
(function() {
  'use strict';

  // Configuration
  const config = {
    blurAmount: '10px',
    checkInterval: 1000, // Check for new elements every second
  };

  // Settings state
  let settings = {
    blurEnabled: true,
    shortsRemovalEnabled: true,
    pauseOnHoverEnabled: true,
    popupRemovalEnabled: true,
    timeReminderEnabled: true
  };

  // Time tracking variables
  let watchStartTime = null;
  let reminderTimer = null;
  let isWatchingVideo = false;
  let REMINDER_INTERVAL = 15 * 60 * 1000; // Default 15 minutes

  // Create a MutationObserver for popup detection
  const popupObserver = new MutationObserver((mutations) => {
    if (settings.popupRemovalEnabled) {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'TP-YT-IRON-OVERLAY-BACKDROP' || 
              (node.classList && node.classList.contains('ytd-enforcement-message-view-model'))) {
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
    const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
    if (backdrop) {
      backdrop.remove();
    }

    // Remove the modal dialog
    const dialog = document.querySelector('ytd-enforcement-message-view-model');
    if (dialog) {
      dialog.remove();
    }

    // Remove any other overlay elements
    const overlays = document.querySelectorAll('[class*="overlay"]');
    overlays.forEach(overlay => {
      if (overlay.style.zIndex > 2000) {
        overlay.remove();
      }
    });

    // Re-enable scrolling on the body
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  // Load settings
  browser.storage.local.get(['blurEnabled', 'shortsRemovalEnabled', 'pauseOnHoverEnabled', 'popupRemovalEnabled', 'timeReminderEnabled', 'timerInterval']).then(result => {
    settings.blurEnabled = result.blurEnabled !== undefined ? result.blurEnabled : true;
    settings.shortsRemovalEnabled = result.shortsRemovalEnabled !== undefined ? result.shortsRemovalEnabled : true;
    settings.pauseOnHoverEnabled = result.pauseOnHoverEnabled !== undefined ? result.pauseOnHoverEnabled : true;
    settings.popupRemovalEnabled = result.popupRemovalEnabled !== undefined ? result.popupRemovalEnabled : true;
    settings.timeReminderEnabled = result.timeReminderEnabled !== undefined ? result.timeReminderEnabled : true;
    
    // Set timer interval
    const timerInterval = result.timerInterval || 15;
    REMINDER_INTERVAL = timerInterval * 60 * 1000;
    
    applyModifications();
    initializeTimeTracking();
  }).catch(error => {
    console.error("Error loading settings:", error);
    // Continue with defaults if there's an error
    applyModifications();
    initializeTimeTracking();
  });

  // Listen for messages from popup
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'toggleBlur') {
      settings.blurEnabled = message.enabled;
      toggleBlurring(message.enabled);
    } else if (message.action === 'toggleShorts') {
      settings.shortsRemovalEnabled = message.enabled;
      toggleShortsRemoval(message.enabled);
    } else if (message.action === 'togglePauseOnHover') {
      settings.pauseOnHoverEnabled = message.enabled;
      if (!message.enabled) {
        removeVideoControlListeners();
      } else {
        setupVideoControls();
      }
    } else if (message.action === 'togglePopupRemoval') {
      settings.popupRemovalEnabled = message.enabled;
      if (message.enabled) {
        removeAdBlockerPopup();
      }
    } else if (message.action === 'toggleTimeReminder') {
      settings.timeReminderEnabled = message.enabled;
      if (message.enabled) {
        initializeTimeTracking();
      } else {
        stopTimeTracking();
      }
    } else if (message.action === 'updateTimerInterval') {
      REMINDER_INTERVAL = message.interval * 60 * 1000;
      // If currently watching, restart timer with new interval
      if (isWatchingVideo) {
        startWatchTimer();
      }
    }
    return Promise.resolve({response: "Settings updated"});
  });

  // Function to toggle thumbnail blurring
  function toggleBlurring(enabled) {
    if (enabled) {
      // Re-apply blurring
      document.querySelectorAll('.blurred-thumbnail').forEach(img => {
        img.style.filter = `blur(${config.blurAmount})`;
      });
      // Apply to any new thumbnails
      blurThumbnails();
    } else {
      // Remove blurring
      document.querySelectorAll('.blurred-thumbnail').forEach(img => {
        img.style.filter = 'blur(0)';
      });
    }
  }

  // Function to toggle Shorts removal
  function toggleShortsRemoval(enabled) {
    if (enabled) {
      document.body.classList.add('hide-shorts');
      removeShorts();
    } else {
      document.body.classList.remove('hide-shorts');
      document.querySelectorAll('.shorts-hidden').forEach(element => {
        element.style.display = '';
        element.classList.remove('shorts-hidden');
      });
    }
  }

  // Function to blur thumbnails
  function blurThumbnails() {
    if (!settings.blurEnabled) return;
    
    const thumbnailSelectors = [
      'ytd-thumbnail img', 
      'ytd-compact-video-renderer img',
      'ytd-grid-video-renderer img',
      'ytd-video-renderer img',
      '.ytp-videowall-still-image img',
      'a[href^="/watch"] img'
    ];
    
    const thumbnails = document.querySelectorAll(thumbnailSelectors.join(', '));
    
    thumbnails.forEach(img => {
      if (!img.classList.contains('blurred-thumbnail')) {
        img.classList.add('blurred-thumbnail');
        if (settings.blurEnabled) {
          img.style.filter = `blur(${config.blurAmount})`;
        }
        
        // Add touch event listeners for mobile
        img.addEventListener('touchstart', handleTouchStart);
        img.addEventListener('touchend', handleTouchEnd);
      }
    });
  }

  // Touch event handlers
  let touchTimer;
  
  function handleTouchStart(e) {
    const img = e.target;
    touchTimer = setTimeout(() => {
      img.style.filter = 'blur(0)';
    }, 200);
  }
  
  function handleTouchEnd(e) {
    clearTimeout(touchTimer);
    const img = e.target;
    if (settings.blurEnabled) {
      img.style.filter = `blur(${config.blurAmount})`;
    }
  }

  // Function to remove Shorts
  function removeShorts() {
    if (!settings.shortsRemovalEnabled) return;
    
    const shortsSelectors = [
      'ytd-rich-section-renderer[is-shorts-shelf]',
      'ytd-reel-shelf-renderer',
      'ytd-guide-entry-renderer a[title="Shorts"]',
      'ytd-mini-guide-entry-renderer a[title="Shorts"]',
      'ytd-grid-video-renderer a[href*="/shorts/"]',
      'ytd-video-renderer a[href*="/shorts/"]',
      'ytd-rich-grid-row:has(a[href*="/shorts/"])',
      'ytd-shelf-renderer:has(a[href*="/shorts/"])'
    ];
    
    const textSelectors = [
      'ytd-browse[page-subtype="home"] ytd-rich-grid-row',
      'ytd-browse[page-subtype="subscriptions"] ytd-shelf-renderer',
      'ytd-browse ytd-rich-section-renderer'
    ];
    
    document.querySelectorAll(shortsSelectors.join(', ')).forEach(element => {
      if (!element.classList.contains('shorts-hidden')) {
        element.style.display = 'none';
        element.classList.add('shorts-hidden');
      }
    });
    
    textSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        const text = element.textContent || '';
        if (text.includes('Shorts') && !element.classList.contains('shorts-hidden')) {
          element.style.display = 'none';
          element.classList.add('shorts-hidden');
        }
      });
    });
  }

  // Store references to videos with event listeners
  const videoElements = new WeakMap();

  // Function to setup video controls
  function setupVideoControls() {
    if (!settings.pauseOnHoverEnabled) return;

    const videoSelectors = [
      'video',
      '.html5-main-video',
      '.video-stream'
    ];
    
    const videos = document.querySelectorAll(videoSelectors.join(', '));
    
    videos.forEach(video => {
      if (!videoElements.has(video)) {
        const touchStartHandler = () => {
          if (video.played.length > 0 && !video.paused) {
            video.pause();
            video.dataset.wasPausedByExtension = 'true';
          }
        };
        
        const touchEndHandler = () => {
          if (video.dataset.wasPausedByExtension === 'true') {
            video.play().catch(e => {
              console.log('Auto-play prevented by browser policy:', e);
            });
            delete video.dataset.wasPausedByExtension;
          }
        };
        
        video.addEventListener('touchstart', touchStartHandler);
        video.addEventListener('touchend', touchEndHandler);
        
        videoElements.set(video, {
          touchStartHandler,
          touchEndHandler
        });
      }
    });

    const thumbnailSelectors = [
      'ytd-thumbnail',
      'ytd-compact-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-video-renderer'
    ];
    
    const thumbnails = document.querySelectorAll(thumbnailSelectors.join(', '));
    
    thumbnails.forEach(thumbnail => {
      if (!thumbnail.hasAttribute('data-control-listener')) {
        thumbnail.setAttribute('data-control-listener', 'true');
        
        thumbnail.addEventListener('touchstart', () => {
          const video = thumbnail.querySelector('video');
          if (video && video.played.length > 0 && !video.paused) {
            video.pause();
            video.dataset.wasPausedByExtension = 'true';
          }
        });
        
        thumbnail.addEventListener('touchend', () => {
          const video = thumbnail.querySelector('video');
          if (video && video.dataset.wasPausedByExtension === 'true') {
            video.play().catch(e => {
              console.log('Auto-play prevented by browser policy:', e);
            });
            delete video.dataset.wasPausedByExtension;
          }
        });
      }
    });
  }

  // Function to remove video control event listeners
  function removeVideoControlListeners() {
    document.querySelectorAll('video, .html5-main-video, .video-stream').forEach(video => {
      if (videoElements.has(video)) {
        const handlers = videoElements.get(video);
        video.removeEventListener('touchstart', handlers.touchStartHandler);
        video.removeEventListener('touchend', handlers.touchEndHandler);
        videoElements.delete(video);
      }
    });
    
    document.querySelectorAll('[data-control-listener="true"]').forEach(thumbnail => {
      thumbnail.removeAttribute('data-control-listener');
    });
  }

  // Time tracking functions
  function initializeTimeTracking() {
    if (!settings.timeReminderEnabled) return;
    
    // Check if we're on a video page
    if (window.location.pathname.includes('/watch')) {
      startWatchTimer();
    }
    
    // Listen for navigation changes
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        if (url.includes('/watch')) {
          startWatchTimer();
        } else {
          stopWatchTimer();
        }
      }
    }).observe(document, { subtree: true, childList: true });
    
    // Listen for video play/pause events
    document.addEventListener('play', handleVideoPlay, true);
    document.addEventListener('pause', handleVideoPause, true);
  }

  function startWatchTimer() {
    if (!settings.timeReminderEnabled) return;
    
    stopWatchTimer(); // Clear any existing timer
    watchStartTime = Date.now();
    isWatchingVideo = true;
    
    reminderTimer = setTimeout(() => {
      showTimeReminder();
    }, REMINDER_INTERVAL);
  }

  function stopWatchTimer() {
    if (reminderTimer) {
      clearTimeout(reminderTimer);
      reminderTimer = null;
    }
    watchStartTime = null;
    isWatchingVideo = false;
  }

  function stopTimeTracking() {
    stopWatchTimer();
    document.removeEventListener('play', handleVideoPlay, true);
    document.removeEventListener('pause', handleVideoPause, true);
  }

  function handleVideoPlay(event) {
    if (!settings.timeReminderEnabled) return;
    
    const video = event.target;
    if (video.tagName === 'VIDEO' && window.location.pathname.includes('/watch')) {
      if (!isWatchingVideo) {
        startWatchTimer();
      }
    }
  }

  function handleVideoPause(event) {
    if (!settings.timeReminderEnabled) return;
    
    const video = event.target;
    if (video.tagName === 'VIDEO' && window.location.pathname.includes('/watch')) {
      // Don't stop timer for short pauses, only for longer ones
      setTimeout(() => {
        if (video.paused) {
          stopWatchTimer();
        }
      }, 5000); // 5 second delay
    }
  }

  function showTimeReminder() {
    if (!settings.timeReminderEnabled) return;
    
    const minutesWatched = Math.round(REMINDER_INTERVAL / (60 * 1000));

    // Pause the video
    const video = document.querySelector('video');
      if (video) {
        video.pause();
      }
    
    // Create reminder popup
    const reminderDiv = document.createElement('div');
    reminderDiv.id = 'youtube-time-reminder';
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
    const closeBtn = reminderDiv.querySelector('.reminder-close');
    const continueBtn = reminderDiv.querySelector('.continue');
    const breakBtn = reminderDiv.querySelector('.take-break');
    
    closeBtn.addEventListener('click', () => {
      dismissReminder();
      startWatchTimer(); // Restart timerx
    });
    
    continueBtn.addEventListener('click', () => {
      dismissReminder();
      startWatchTimer(); // Restart timer
    });
    
    breakBtn.addEventListener('click', () => {
      dismissReminder();
      stopWatchTimer();
      // Pause the video
      const video = document.querySelector('video');
      if (video) {
        video.pause();
      }
    });
    
    // Auto-dismiss after 30 seconds if no interaction
    setTimeout(() => {
      if (document.getElementById('youtube-time-reminder')) {
        dismissReminder();
        startWatchTimer(); // Restart timer
      }
    }, 30000);
  }

  function dismissReminder() {
    const reminder = document.getElementById('youtube-time-reminder');
    if (reminder) {
      reminder.remove();
    }
  }

  // Main function to apply all modifications
  function applyModifications() {
    blurThumbnails();
    removeShorts();
    setupVideoControls();
  }

  // Start observing for popups
  popupObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });

  // Create a MutationObserver to detect when new content is loaded
  const observer = new MutationObserver((mutations) => {
    let shouldApplyModifications = false;
    
    mutations.forEach(mutation => {
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