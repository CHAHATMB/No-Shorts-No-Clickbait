document.addEventListener('DOMContentLoaded', function() {
  const blurToggle = document.getElementById('blur-toggle');
  const shortsToggle = document.getElementById('shorts-toggle');
  const pauseToggle = document.getElementById('pause-toggle');
  const popupToggle = document.getElementById('popup-toggle');
  
  // Load saved settings using Firefox's browser API
  browser.storage.local.get(['blurEnabled', 'shortsRemovalEnabled', 'pauseOnHoverEnabled', 'popupRemovalEnabled']).then(result => {
    // Set default values if settings don't exist
    blurToggle.checked = result.blurEnabled !== undefined ? result.blurEnabled : true;
    shortsToggle.checked = result.shortsRemovalEnabled !== undefined ? result.shortsRemovalEnabled : true;
    pauseToggle.checked = result.pauseOnHoverEnabled !== undefined ? result.pauseOnHoverEnabled : true;
    popupToggle.checked = result.popupRemovalEnabled !== undefined ? result.popupRemovalEnabled : true;
  }).catch(error => {
    console.error("Error loading settings:", error);
    // Use defaults if there's an error
    blurToggle.checked = true;
    shortsToggle.checked = true;
    pauseToggle.checked = true;
    popupToggle.checked = true;
  });
  
  // Save settings when toggles are changed
  blurToggle.addEventListener('change', function() {
    browser.storage.local.set({blurEnabled: this.checked});
    
    // Send message to content script
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
      if (tabs[0].url.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: 'toggleBlur',
          enabled: blurToggle.checked
        });
      }
    });
  });
  
  shortsToggle.addEventListener('change', function() {
    browser.storage.local.set({shortsRemovalEnabled: this.checked});
    
    // Send message to content script
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
      if (tabs[0].url.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: 'toggleShorts',
          enabled: shortsToggle.checked
        });
      }
    });
  });
  
  pauseToggle.addEventListener('change', function() {
    browser.storage.local.set({pauseOnHoverEnabled: this.checked});
    
    // Send message to content script
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
      if (tabs[0].url.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: 'togglePauseOnHover',
          enabled: pauseToggle.checked
        });
      }
    });
  });

  popupToggle.addEventListener('change', function() {
    browser.storage.local.set({popupRemovalEnabled: this.checked});
    
    // Send message to content script
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
      if (tabs[0].url.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: 'togglePopupRemoval',
          enabled: popupToggle.checked
        });
      }
    });
  });
});