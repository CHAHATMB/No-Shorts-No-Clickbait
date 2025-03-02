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
    pauseOnHoverEnabled: true
  };

  // Load settings
  browser.storage.local.get(['blurEnabled', 'shortsRemovalEnabled', 'pauseOnHoverEnabled']).then(result => {
    settings.blurEnabled = result.blurEnabled !== undefined ? result.blurEnabled : true;
    settings.shortsRemovalEnabled = result.shortsRemovalEnabled !== undefined ? result.shortsRemovalEnabled : true;
    settings.pauseOnHoverEnabled = result.pauseOnHoverEnabled !== undefined ? result.pauseOnHoverEnabled : true;
    applyModifications();
  }).catch(error => {
    console.error("Error loading settings:", error);
    // Continue with defaults if there's an error
    applyModifications();
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
        // Remove event listeners if disabled
        removeVideoPauseListeners();
      } else {
        // Add event listeners if enabled
        setupVideoPauseOnHover();
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
    // We'll use CSS for this, but we can add/remove a class from the body
    if (enabled) {
      document.body.classList.add('hide-shorts');
      // Also manually hide any existing shorts
      removeShorts();
    } else {
      document.body.classList.remove('hide-shorts');
      // Show previously hidden shorts
      document.querySelectorAll('.shorts-hidden').forEach(element => {
        element.style.display = '';
        element.classList.remove('shorts-hidden');
      });
    }
  }

  // Function to blur thumbnails
  function blurThumbnails() {
    if (!settings.blurEnabled) return;
    
    // Target all thumbnail images
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
      }
    });
  }

  // Function to remove Shorts
  function removeShorts() {
    if (!settings.shortsRemovalEnabled) return;
    
    // Shorts in homepage
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
    
    // Find elements containing "Shorts" text
    const textSelectors = [
      'ytd-browse[page-subtype="home"] ytd-rich-grid-row',
      'ytd-browse[page-subtype="subscriptions"] ytd-shelf-renderer',
      'ytd-browse ytd-rich-section-renderer'
    ];
    
    // Hide elements with direct selectors
    document.querySelectorAll(shortsSelectors.join(', ')).forEach(element => {
      if (!element.classList.contains('shorts-hidden')) {
        element.style.display = 'none';
        element.classList.add('shorts-hidden');
      }
    });
    
    // Check for elements containing "Shorts" text
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

// const videoElements = new Map();

// Function to pause video on hover
function setupVideoPauseOnHover() {
  if (!settings.pauseOnHoverEnabled) return;

  const videoSelectors = ['video', '.html5-main-video', '.video-stream'];
  const videos = document.querySelectorAll(videoSelectors.join(', '));

  videos.forEach(video => {
    if (!videoElements.has(video)) {
      // Create event handlers
      const mouseEnterHandler = () => {
        if (!video.paused) {
          video.pause();
          video.dataset.wasPausedByExtension = 'true';
        }
      };

      const mouseLeaveHandler = () => {
        if (video.dataset.wasPausedByExtension === 'true') {
          video.play().catch(e => console.log('Auto-play prevented:', e));
          delete video.dataset.wasPausedByExtension;
        }
      };

      // Add event listeners
      video.addEventListener('mouseenter', mouseEnterHandler);
      video.addEventListener('mouseleave', mouseLeaveHandler);

      // Store references
      videoElements.set(video, { mouseEnterHandler, mouseLeaveHandler });
    }
  });

  // Handle dynamically loaded videos
  observeNewVideos();

  // Handle preview videos in thumbnails
  setupThumbnailHoverPause();
}

// Function to remove video pause event listeners
function removeVideoPauseListeners() {
  document.querySelectorAll('video, .html5-main-video, .video-stream').forEach(video => {
    if (videoElements.has(video)) {
      const { mouseEnterHandler, mouseLeaveHandler } = videoElements.get(video);
      video.removeEventListener('mouseenter', mouseEnterHandler);
      video.removeEventListener('mouseleave', mouseLeaveHandler);
      videoElements.delete(video);
    }
  });

  document.querySelectorAll('[data-pause-listener="true"]').forEach(thumbnail => {
    thumbnail.removeAttribute('data-pause-listener');
  });
}

  // Main function to apply all modifications
  function applyModifications() {
    blurThumbnails();
    removeShorts();
    setupVideoPauseOnHover();
  }

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
  
  // Also run periodically to catch any elements that might have been missed
  setInterval(applyModifications, config.checkInterval);
})();