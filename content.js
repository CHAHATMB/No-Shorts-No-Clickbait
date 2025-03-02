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
    shortsRemovalEnabled: true
  };

  // Load settings
  browser.storage.local.get(['blurEnabled', 'shortsRemovalEnabled']).then(result => {
    settings.blurEnabled = result.blurEnabled !== undefined ? result.blurEnabled : true;
    settings.shortsRemovalEnabled = result.shortsRemovalEnabled !== undefined ? result.shortsRemovalEnabled : true;
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

  // Main function to apply all modifications
  function applyModifications() {
    blurThumbnails();
    removeShorts();
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