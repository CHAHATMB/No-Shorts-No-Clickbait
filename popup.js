document.addEventListener('DOMContentLoaded', function() {
  const blurToggle = document.getElementById('blur-toggle');
  const shortsToggle = document.getElementById('shorts-toggle');
  const pauseToggle = document.getElementById('pause-toggle');
  const popupToggle = document.getElementById('popup-toggle');
  const timeReminderToggle = document.getElementById('time-reminder-toggle');
  const timerConfig = document.getElementById('timer-config');
  const customTimerInput = document.getElementById('custom-timer');
  const timerPresets = document.querySelectorAll('input[name="timer-preset"]');
  
  // Load timer settings
  browser.storage.local.get(['timerInterval', 'timerPreset']).then(result => {
    const interval = result.timerInterval || 15;
    const preset = result.timerPreset || '15';
    
    // Set the correct radio button
    const presetRadio = document.querySelector(`input[name="timer-preset"][value="${preset}"]`);
    if (presetRadio) {
      presetRadio.checked = true;
    }
    
    // If custom, enable input and set value
    if (preset === 'custom') {
      customTimerInput.disabled = false;
      customTimerInput.value = interval;
    }
  });

  // Load settings from storage
  browser.storage.local.get(['blurEnabled', 'shortsRemovalEnabled', 'pauseOnHoverEnabled', 'popupRemovalEnabled', 'timeReminderEnabled']).then(result => {
    // Set default values if settings don't exist
    blurToggle.checked = result.blurEnabled !== undefined ? result.blurEnabled : true;
    shortsToggle.checked = result.shortsRemovalEnabled !== undefined ? result.shortsRemovalEnabled : true;
    pauseToggle.checked = result.pauseOnHoverEnabled !== undefined ? result.pauseOnHoverEnabled : true;
    popupToggle.checked = result.popupRemovalEnabled !== undefined ? result.popupRemovalEnabled : true;
    timeReminderToggle.checked = result.timeReminderEnabled !== undefined ? result.timeReminderEnabled : true;
    
    // Show/hide timer config based on toggle state
    if (timeReminderToggle.checked) {
      timerConfig.classList.remove('hidden');
    } else {
      timerConfig.classList.add('hidden');
    }
  }).catch(error => {
    console.error("Error loading settings:", error);
    // Use defaults if there's an error
    blurToggle.checked = true;
    shortsToggle.checked = true;
    pauseToggle.checked = true;
    popupToggle.checked = true;
    timeReminderToggle.checked = true;
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

  timeReminderToggle.addEventListener('change', function() {
    browser.storage.local.set({timeReminderEnabled: this.checked});
    
    // Show/hide timer config
    if (this.checked) {
      timerConfig.classList.remove('hidden');
    } else {
      timerConfig.classList.add('hidden');
    }
    
    // Send message to content script
    browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
      if (tabs[0].url.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: 'toggleTimeReminder',
          enabled: timeReminderToggle.checked
        });
      }
    });
  });
  
  // Handle timer preset changes
  timerPresets.forEach(radio => {
    radio.addEventListener('change', function() {
      const preset = this.value;
      let interval;
      
      if (preset === 'custom') {
        customTimerInput.disabled = false;
        interval = parseInt(customTimerInput.value) || 45;
      } else {
        customTimerInput.disabled = true;
        interval = parseInt(preset);
      }
      
      // Save settings
      browser.storage.local.set({
        timerPreset: preset,
        timerInterval: interval
      });
      
      // Send to content script
      browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
        if (tabs[0].url.includes('youtube.com')) {
          browser.tabs.sendMessage(tabs[0].id, {
            action: 'updateTimerInterval',
            interval: interval
          });
        }
      });
    });
  });
  
  // Handle custom timer input changes
  customTimerInput.addEventListener('change', function() {
    const customRadio = document.querySelector('input[name="timer-preset"][value="custom"]');
    if (customRadio && customRadio.checked) {
      const interval = parseInt(this.value) || 45;
      
      // Validate range
      if (interval < 1) this.value = 1;
      if (interval > 180) this.value = 180;
      
      const finalInterval = parseInt(this.value);
      
      // Save settings
      browser.storage.local.set({
        timerInterval: finalInterval
      });
      
      // Send to content script
      browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
        if (tabs[0].url.includes('youtube.com')) {
          browser.tabs.sendMessage(tabs[0].id, {
            action: 'updateTimerInterval',
            interval: finalInterval
          });
        }
      });
    }
  });
});