document.addEventListener('DOMContentLoaded', function() {
  const blurToggle = document.getElementById('blur-toggle');
  const shortsToggle = document.getElementById('shorts-toggle');
  
  // Load saved settings
  chrome.storage.local.get(['blurEnabled', 'shortsRemovalEnabled'], function(result) {
    // Set default values if settings don't exist
    blurToggle.checked = result.blurEnabled !== undefined ? result.blurEnabled : true;
    shortsToggle.checked = result.shortsRemovalEnabled !== undefined ? result.shortsRemovalEnabled : true;
  });
  
  // Save settings when toggles are changed
  blurToggle.addEventListener('change', function() {
    chrome.storage.local.set({blurEnabled: this.checked});
    
    // Send message to content script
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleBlur',
          enabled: blurToggle.checked
        });
      }
    });
  });
  
  shortsToggle.addEventListener('change', function() {
    chrome.storage.local.set({shortsRemovalEnabled: this.checked});
    
    // Send message to content script
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleShorts',
          enabled: shortsToggle.checked
        });
      }
    });
  });
});