// This script polls for changes in updated.json and reloads the extension.
// It is only included in development mode.

let lastBuild = null;

async function checkUpdate() {
  try {
    // Use chrome.runtime.getURL to get the absolute path within the extension
    const url = (typeof browser !== 'undefined' ? browser : chrome).runtime.getURL('updated.json');
    const response = await fetch(url + '?t=' + Date.now());
    const data = await response.json();
    
    if (lastBuild && data.lastBuild !== lastBuild) {
      console.log('Detected change, reloading extension...');
      (typeof browser !== 'undefined' ? browser : chrome).runtime.reload();
    }
    lastBuild = data.lastBuild;
  } catch (e) {
    // During build or initial load, updated.json might be missing or invalid
  }
}

// Check for updates every 2 seconds
setInterval(checkUpdate, 2000);
console.log('Auto-reload script active (polling every 2s)');
