// productivity-content.js
// Runs on ALL URLs - handles banners and URL blocking overlay
import './browser-polyfill.js';
import { TEST_PROTOCOL_VERSION } from './modules/test-lab-client.js';

(function () {
  'use strict';

  // ============================================================
  // BANNER SYSTEM
  // ============================================================
  let bannerQueue = [];
  let isBannerVisible = false;
  let bannerTimeout = null;

  const BANNER_STYLES = `
    #fg-banner-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: none;
    }
    .fg-banner {
      background: rgba(15, 15, 25, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 14px 16px;
      min-width: 280px;
      max-width: 340px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      color: white;
      pointer-events: all;
      transform: translateX(110%);
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      margin-bottom: 10px;
    }
    .fg-banner.visible {
      transform: translateX(0);
    }
    .fg-banner.hiding {
      transform: translateX(110%);
      transition: transform 0.3s ease-in;
    }
    .fg-banner-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .fg-banner-title {
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .fg-banner-close {
      background: none;
      border: none;
      color: rgba(255,255,255,0.5);
      cursor: pointer;
      font-size: 16px;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
    }
    .fg-banner-close:hover {
      background: rgba(255,255,255,0.1);
      color: white;
    }
    .fg-banner-body {
      font-size: 12px;
      color: rgba(255,255,255,0.8);
      line-height: 1.5;
    }
    .fg-banner-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .fg-banner-btn {
      flex: 1;
      padding: 6px 10px;
      border: none;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .fg-banner-btn:hover { opacity: 0.85; }
    .fg-banner-btn.primary {
      background: #cc0000;
      color: white;
    }
    .fg-banner-btn.secondary {
      background: rgba(255,255,255,0.12);
      color: white;
    }
    .fg-progress-bar {
      height: 3px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      margin-top: 10px;
      overflow: hidden;
    }
    .fg-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #cc0000, #ff4d4d);
      border-radius: 2px;
      transition: width 1s linear;
    }
  `;

  function injectBannerContainer() {
    if (document.getElementById('fg-banner-container')) return;
    const style = document.createElement('style');
    style.textContent = BANNER_STYLES;
    document.head.appendChild(style);
    const container = document.createElement('div');
    container.id = 'fg-banner-container';
    document.body.appendChild(container);
  }

  const previewCleanups = new Set();

  function showBanner(type, data = {}, preview = false) {
    if (!['timeAlert', 'milestone', 'dailySummary', 'suggestion'].includes(type)) {
      return { ok: false, status: 'failed', message: 'Unknown banner type.' };
    }
    // Ensure container exists
    if (!document.getElementById('fg-banner-container')) {
      injectBannerContainer();
    }

    const container = document.getElementById('fg-banner-container');
    if (!container) return;

    const bannerEl = document.createElement('div');
    bannerEl.className = 'fg-banner';
    
    let title = '';
    let body = '';
    let actions = '';
    let autoDismissMs = 8000;

    if (type === 'timeAlert') {
      title = '⏱️ Time Alert';
      body = `You've been on <strong>${data.domain}</strong> for <strong>${data.minutes} min</strong> today.`;
      actions = `
        <button class="fg-banner-btn secondary" data-action="dismiss">Dismiss</button>
        <button class="fg-banner-btn primary" data-action="block">Block Now</button>
      `;
    } else if (type === 'milestone') {
      title = '🎉 Milestone!';
      body = data.message || 'Great job staying focused!';
      autoDismissMs = 6000;
    } else if (type === 'dailySummary') {
      title = '📊 Daily Summary';
      const prodMins = Math.round((data.productiveSecs || 0) / 60);
      const wasteMins = Math.round((data.wasteSecs || 0) / 60);
      body = `<strong>${prodMins}m</strong> productive · <strong>${wasteMins}m</strong> wasted today.`;
      actions = `<button class="fg-banner-btn secondary" data-action="dismiss">Dismiss</button>`;
    } else if (type === 'suggestion') {
      title = '💡 Suggestion';
      body = data.message || '';
      autoDismissMs = 10000;
      actions = `<button class="fg-banner-btn secondary" data-action="dismiss">Got it</button>`;
    }

    // Auto-dismiss progress bar
    bannerEl.innerHTML = `
      <div class="fg-banner-header">
        <div class="fg-banner-title">${title}</div>
        <button class="fg-banner-close">✕</button>
      </div>
      <div class="fg-banner-body">${body}</div>
      ${actions ? '<div class="fg-banner-actions">' + actions + '</div>' : ''}
      <div class="fg-progress-bar"><div class="fg-progress-fill" style="width:100%"></div></div>
    `;

    if (preview) {
      bannerEl.dataset.preview = 'true';
      bannerEl.querySelector('.fg-banner-title').textContent = `Preview: ${type}`;
      const blockButton = bannerEl.querySelector('[data-action="block"]');
      if (blockButton) blockButton.textContent = 'Dismiss preview';
    }
    container.appendChild(bannerEl);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => bannerEl.classList.add('visible'));
    });

    // Progress bar animation
    const fill = bannerEl.querySelector('.fg-progress-fill');
    const progressTimer = setTimeout(() => { if (fill) fill.style.width = '0%'; }, 100);
    if (fill) fill.style.transitionDuration = `${autoDismissMs}ms`;
    let timer;
    let removalTimer;
    const cleanup = () => {
      clearTimeout(progressTimer);
      clearTimeout(timer);
      clearTimeout(removalTimer);
      bannerEl.remove();
      previewCleanups.delete(cleanup);
    };
    if (preview) previewCleanups.add(cleanup);

    // Event handlers
    const dismissBanner = () => {
      clearTimeout(timer);
      clearTimeout(removalTimer);
      bannerEl.classList.add('hiding');
      removalTimer = setTimeout(cleanup, 300);
    };

    bannerEl.querySelector('.fg-banner-close').addEventListener('click', dismissBanner);

    bannerEl.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        if (action === 'dismiss' || preview) {
          dismissBanner();
        } else if (action === 'block') {
          dismissBanner();
          // Open extension popup or notify background
          browser.runtime.sendMessage({ action: 'openPopupToBlocker' }).catch(() => {});
        }
      });
    });

    // Auto dismiss
    timer = setTimeout(dismissBanner, autoDismissMs);
    bannerEl.addEventListener('mouseenter', () => clearTimeout(timer));
    bannerEl.addEventListener('mouseleave', () => {
      clearTimeout(timer);
      timer = setTimeout(dismissBanner, 2000);
    });
    return { ok: true, status: 'shown', message: 'Banner preview shown on the target page.' };
  }

  // ============================================================
  // URL BLOCKER OVERLAY
  // ============================================================
  const BLOCKER_STYLES = `
    #fg-block-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: linear-gradient(135deg, #0a0a14 0%, #0f0f20 50%, #0a0a14 100%);
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
      overflow: hidden;
    }
    #fg-block-overlay::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(ellipse at center, rgba(204,0,0,0.08) 0%, transparent 60%);
      pointer-events: none;
    }
    .fg-block-content {
      position: relative;
      z-index: 1;
      text-align: center;
      max-width: 700px;
      padding: 40px 20px;
    }
    .fg-block-icon {
      font-size: 64px;
      margin-bottom: 16px;
      display: block;
    }
    .fg-block-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px 0;
      background: linear-gradient(135deg, #fff, #ccc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .fg-block-subtitle {
      font-size: 15px;
      color: rgba(255,255,255,0.5);
      margin: 0 0 32px 0;
    }
    .fg-block-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 28px;
    }
    .fg-block-stat-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: 20px;
      text-align: left;
    }
    .fg-block-stat-card h3 {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .fg-stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      padding: 4px 0;
    }
    .fg-stat-row span:last-child {
      font-weight: 600;
    }
    .fg-stat-positive { color: #22c55e; }
    .fg-stat-negative { color: #ef4444; }
    .fg-stat-neutral { color: #f59e0b; }
    .fg-block-quote {
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      font-style: italic;
      margin-bottom: 28px;
      padding: 0 20px;
      line-height: 1.6;
    }
    .fg-block-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .fg-block-btn {
      padding: 11px 22px;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .fg-block-btn.primary {
      background: linear-gradient(135deg, #cc0000, #ff4444);
      color: white;
      box-shadow: 0 4px 15px rgba(204,0,0,0.3);
    }
    .fg-block-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(204,0,0,0.4); }
    .fg-block-btn.secondary {
      background: rgba(255,255,255,0.08);
      color: white;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .fg-block-btn.secondary:hover { background: rgba(255,255,255,0.14); }
    .fg-block-btn.danger {
      background: transparent;
      color: rgba(255,255,255,0.3);
      border: 1px solid rgba(255,255,255,0.1);
      font-size: 12px;
    }
    .fg-block-btn.danger:hover { color: rgba(255,255,255,0.6); }
    .fg-override-counter {
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      margin-top: 16px;
    }
    .fg-streak-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 6px 14px;
      font-size: 13px;
      margin-bottom: 24px;
    }
  `;

  const MOTIVATIONAL_QUOTES = [
    '"The cost of a thing is the amount of life you exchange for it." — Thoreau',
    '"Time is more valuable than money. You can get more money, but you cannot get more time." — Jim Rohn',
    '"An investment in knowledge pays the best interest." — Benjamin Franklin',
    '"Either you run the day or the day runs you." — Jim Rohn',
    '"Do something today that your future self will thank you for."',
  ];

  let blockOverlayEl = null;
  let blockOverlayPending = false;
  let previewRevision = 0;

  async function showBlockOverlay(pattern, preview = false) {
    if (blockOverlayEl || blockOverlayPending) return { ok: false, status: 'skipped', message: 'A blocker is already displayed or loading.' };
    blockOverlayPending = true;
    const revision = previewRevision;
    const previousOverflow = document.body.style.overflow;

    // Pause any playing media
    if (!preview) {
      document.querySelectorAll('video, audio').forEach(m => m.pause());
      document.body.style.overflow = 'hidden';
    }

    // Inject styles
    if (!document.getElementById('fg-blocker-styles')) {
      const style = document.createElement('style');
      style.id = 'fg-blocker-styles';
      style.textContent = BLOCKER_STYLES;
      document.head.appendChild(style);
    }

    // Load stats
    let todayData = {};
    let overrideCount = 0;
    try {
      const today = new Date().toDateString();
      const key = `siteTime_${today}`;
      const stored = await browser.storage.local.get([key, 'hourlyRate', 'siteCategories']);
      todayData = stored[key] || {};
      const hourlyRate = stored.hourlyRate || 500;
      const cats = stored.siteCategories || {};
      
      // Default categories inline (avoid module import in content script)
      const WASTE_DEFAULTS = ['instagram.com','facebook.com','twitter.com','x.com','reddit.com','tiktok.com','youtube.com','twitch.tv','netflix.com'];
      const PROD_DEFAULTS = ['github.com','leetcode.com','stackoverflow.com','udemy.com','coursera.org','freecodecamp.org','dev.to'];
      
      let wasteSecs = 0, prodSecs = 0;
      for (const [domain, secs] of Object.entries(todayData)) {
        const cat = cats[domain] || (WASTE_DEFAULTS.includes(domain) ? 'waste' : (PROD_DEFAULTS.includes(domain) ? 'productive' : 'neutral'));
        if (cat === 'waste') wasteSecs += secs;
        else if (cat === 'productive') prodSecs += secs;
      }
      
      const wastedMoney = Math.round((wasteSecs / 3600) * hourlyRate);
      const investedMoney = Math.round((prodSecs / 3600) * hourlyRate);
      const net = investedMoney - wastedMoney;
      
      const overrideResult = await browser.runtime.sendMessage({ action: 'getOverrideCount' });
      overrideCount = overrideResult?.count || 0;
      if (preview && revision !== previewRevision) return { ok: false, status: 'skipped', message: 'Preview cancelled.' };
      
      const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
      const domain = window.location.hostname.replace(/^www\./, '');
      const canOverride = overrideCount < 3;
      
      const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      };
      const formatMoney = (v) => `₹${Math.abs(v).toLocaleString('en-IN')}`;

      blockOverlayEl = document.createElement('div');
      blockOverlayEl.id = 'fg-block-overlay';
      blockOverlayEl.innerHTML = `
        <div class="fg-block-content">
          <span class="fg-block-icon">🚫</span>
          <h1 class="fg-block-title">${domain} is blocked</h1>
          <p class="fg-block-subtitle">${pattern.label || 'This site'} is on your blocked list.</p>

          <div class="fg-streak-badge">
            🔥 Streak: calculating...
          </div>

          <div class="fg-block-stats-grid">
            <div class="fg-block-stat-card">
              <h3>⏱️ Today's Time</h3>
              <div class="fg-stat-row"><span>Productive</span><span class="fg-stat-positive">${formatTime(prodSecs)}</span></div>
              <div class="fg-stat-row"><span>Wasted</span><span class="fg-stat-negative">${formatTime(wasteSecs)}</span></div>
              <div class="fg-stat-row"><span>Ratio</span><span class="${prodSecs > wasteSecs ? 'fg-stat-positive' : 'fg-stat-negative'}">${prodSecs + wasteSecs > 0 ? Math.round((prodSecs / (prodSecs + wasteSecs)) * 100) : 0}% 🟢</span></div>
            </div>
            <div class="fg-block-stat-card">
              <h3>💰 Money Meter</h3>
              <div class="fg-stat-row"><span>Invested</span><span class="fg-stat-positive">${formatMoney(investedMoney)}</span></div>
              <div class="fg-stat-row"><span>Wasted</span><span class="fg-stat-negative">${formatMoney(wastedMoney)}</span></div>
              <div class="fg-stat-row"><span>Net</span><span class="${net >= 0 ? 'fg-stat-positive' : 'fg-stat-negative'}">${net >= 0 ? '+' : '-'}${formatMoney(net)}</span></div>
            </div>
          </div>

          <p class="fg-block-quote">${randomQuote}</p>

          <div class="fg-block-actions">
            <a href="https://github.com" target="_blank" class="fg-block-btn secondary">🐙 Go to GitHub</a>
            <a href="https://leetcode.com" target="_blank" class="fg-block-btn primary">⚡ Go to LeetCode</a>
            <button type="button" class="fg-block-btn secondary" id="fg-block-sync-btn" style="cursor:pointer;">🔄 Sync Stats</button>
            ${canOverride ? `<button class="fg-block-btn danger" id="fg-override-btn">Override (${3 - overrideCount} left today)</button>` : '<span style="font-size:12px;color:rgba(255,255,255,0.3)">No overrides left today</span>'}
          </div>
          <div id="fg-block-sync-status" style="font-size:12px;margin-top:8px;min-height:16px;color:rgba(255,255,255,0.6);"></div>
          <p class="fg-override-counter">Overrides used today: ${overrideCount}/3</p>
        </div>
      `;

      if (preview) {
        blockOverlayEl.dataset.preview = 'true';
        blockOverlayEl.querySelectorAll('a').forEach(link => {
          link.removeAttribute('href');
          link.setAttribute('aria-disabled', 'true');
        });
        const previewSync = blockOverlayEl.querySelector('#fg-block-sync-btn');
        if (previewSync) previewSync.disabled = true;
        blockOverlayEl.querySelector('.fg-block-subtitle').textContent = 'Preview only. No blocked rules or overrides will change.';
        const closeButton = document.createElement('button');
        closeButton.className = 'fg-block-btn secondary';
        closeButton.textContent = 'Close preview';
        closeButton.addEventListener('click', removeBlockOverlay);
        blockOverlayEl.querySelector('.fg-block-actions').appendChild(closeButton);
      } else {
        blockOverlayEl.dataset.previousOverflow = previousOverflow;
      }
      document.body.appendChild(blockOverlayEl);

      // Set streak badge
      const streakBadge = blockOverlayEl.querySelector('.fg-streak-badge');
      if (streakBadge) streakBadge.textContent = '🔥 Stay focused today!';

      // Sync button
      const fgBlockSyncBtn = document.getElementById('fg-block-sync-btn');
      const fgBlockSyncStatus = document.getElementById('fg-block-sync-status');
      if (fgBlockSyncBtn && !preview) {
        fgBlockSyncBtn.addEventListener('click', async () => {
          fgBlockSyncBtn.disabled = true;
          fgBlockSyncBtn.textContent = '⏳ Syncing...';
          if (fgBlockSyncStatus) fgBlockSyncStatus.textContent = 'Checking LeetCode stats...';
          try {
            const res = await browser.runtime.sendMessage({ action: 'syncLeetCode' });
            if (res && res.ok) {
              if (fgBlockSyncStatus) {
                fgBlockSyncStatus.style.color = '#22c55e';
                fgBlockSyncStatus.textContent = `✓ Synced! Solved today: ${res.solvedToday?.easy || 0} Easy, ${res.solvedToday?.medium || 0} Med, ${res.solvedToday?.hard || 0} Hard (+${res.earnedMinutes || 0}m earned)`;
              }
            } else {
              if (fgBlockSyncStatus) {
                fgBlockSyncStatus.style.color = '#ef4444';
                fgBlockSyncStatus.textContent = `✗ ${res?.error || 'Sync failed'}`;
              }
            }
          } catch (e) {
            if (fgBlockSyncStatus) {
              fgBlockSyncStatus.style.color = '#ef4444';
              fgBlockSyncStatus.textContent = '✗ Network error';
            }
          } finally {
            fgBlockSyncBtn.disabled = false;
            fgBlockSyncBtn.textContent = '🔄 Sync Stats';
          }
        });
      }

      // Override button
      const overrideBtn = document.getElementById('fg-override-btn');
      if (overrideBtn) {
        overrideBtn.addEventListener('click', async () => {
          if (preview) {
            removeBlockOverlay();
            return;
          }
          await browser.runtime.sendMessage({ action: 'useOverride' });
          removeBlockOverlay();
          // Re-block after 5 minutes
          setTimeout(() => {
            if (!document.getElementById('fg-block-overlay')) {
              showBlockOverlay(pattern);
            }
          }, 5 * 60 * 1000);
        });
      }
      return { ok: true, status: 'shown', message: 'Blocker preview shown. Override only dismisses this preview.' };
    } catch (e) {
      console.error('[FocusGuard] Block overlay error:', e);
      if (!preview) document.body.style.overflow = previousOverflow;
      return { ok: false, status: 'failed', message: e.message };
    } finally {
      blockOverlayPending = false;
    }
  }

  function removeBlockOverlay() {
    if (blockOverlayEl) {
      if (blockOverlayEl.dataset.preview !== 'true') document.body.style.overflow = blockOverlayEl.dataset.previousOverflow || '';
      blockOverlayEl.remove();
      blockOverlayEl = null;
    }
  }

  // ============================================================
  // MESSAGE LISTENER
  // ============================================================
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'showBanner') {
      return Promise.resolve(showBanner(message.type, message.data || {}));
    } else if (message.action === 'showBlockOverlay') {
      return showBlockOverlay(message.pattern);
    } else if (message.action === 'removeBlockOverlay') {
      removeBlockOverlay();
      return Promise.resolve({ ok: true });
    }
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    if (message.action === 'testPageStatus') return Promise.resolve({ ok: true, protocolVersion: TEST_PROTOCOL_VERSION });
    if (message.action === 'testPreviewBanner') {
      return Promise.resolve(showBanner(message.type, message.data || {}, true));
    }
    if (message.action === 'testPreviewBlocker') {
      return showBlockOverlay({ label: 'Test site' }, true).catch(error => ({ ok: false, status: 'failed', message: error.message }));
    }
    if (message.action === 'testClearPagePreviews') {
      previewRevision++;
      previewCleanups.forEach(cleanup => cleanup());
      if (blockOverlayEl?.dataset.preview === 'true') removeBlockOverlay();
      return Promise.resolve({ ok: true, message: 'Page previews cleared. Real blockers were left unchanged.' });
    }
  });

  // Initialize banner container on page load (defer to avoid blocking)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBannerContainer);
  } else {
    // Use setTimeout to not block page rendering
    setTimeout(injectBannerContainer, 500);
  }

})();
