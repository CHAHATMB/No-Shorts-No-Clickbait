import './browser-polyfill.js';
import { FEATURES } from './features.js';

document.addEventListener('DOMContentLoaded', function () {

  // ============================================================
  // DOM ELEMENT REFERENCES
  // ============================================================
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Customization tab
  const focusModeToggle = document.getElementById('focus-mode-toggle');
  const thumbnailModeRadios = document.querySelectorAll('input[name="thumbnail-mode"]');
  const blurIntensityConfig = document.getElementById('blur-intensity-config');
  const blurRangeInput = document.getElementById('blur-range');
  const blurValueDisplay = document.getElementById('blur-value-display');
  const pauseToggle = document.getElementById('pause-toggle');
  const pauseOnHoverCard = document.getElementById('pause-on-hover-card');
  const shortsToggle = document.getElementById('shorts-toggle');
  const popupToggle = document.getElementById('popup-toggle');

  // Productivity tab - existing
  const timeReminderToggle = document.getElementById('time-reminder-toggle');
  const timerConfig = document.getElementById('timer-config');
  const timerPresets = document.querySelectorAll('input[name="timer-preset"]');
  const customTimerInput = document.getElementById('custom-timer');
  const graphContainer = document.getElementById('watch-stats-graph');
  const graphLabels = document.getElementById('graph-labels');
  const totalWatchedTodayDisplay = document.getElementById('total-watched-today');
  const continueCountTodayDisplay = document.getElementById('continue-count-today');
  const breaksTakenTodayDisplay = document.getElementById('breaks-taken-today');
  const codingIntegrationFeature = document.getElementById('coding-integration-feature');
  const leetcodeUsernameInput = document.getElementById('leetcode-username');
  const codingBonusToggle = document.getElementById('coding-bonus-toggle');
  const remainingTimeDisplay = document.getElementById('remaining-time-display');
  const earnedTimeDisplay = document.getElementById('earned-time-display');
  const solvedEasySpan = document.getElementById('solved-easy');
  const solvedMediumSpan = document.getElementById('solved-medium');
  const solvedHardSpan = document.getElementById('solved-hard');

  // Productivity tab - new
  const hourlyRateInput = document.getElementById('hourly-rate-input');
  const moneyWasted = document.getElementById('money-wasted');
  const moneyInvested = document.getElementById('money-invested');
  const moneyNet = document.getElementById('money-net');
  const moneyInsight = document.getElementById('money-insight');
  const siteTimeList = document.getElementById('site-time-list');
  const totalActiveTime = document.getElementById('total-active-time');
  const blockerList = document.getElementById('blocker-list');
  const blockerUrlInput = document.getElementById('blocker-url-input');
  const blockerAddBtn = document.getElementById('blocker-add-btn');
  const weeklyReportBars = document.getElementById('weekly-report-bars');
  const weeklyNet = document.getElementById('weekly-net');
  const badgesGrid = document.getElementById('badges-grid');
  const insightsContainer = document.getElementById('insights-container');

  // Mascot companion
  const mascotToggle = document.getElementById('mascot-toggle');
  const mascotCategoriesConfig = document.getElementById('mascot-categories-config');
  const mascotCatToggles = document.querySelectorAll('.mascot-cat-toggle');

  let dailyWatchStats = {};
  let currentHourlyRate = 500;
  let currentSiteData = {};
  let currentSiteCategories = {};

  // ============================================================
  // HELPERS
  // ============================================================
  function formatTime(secs) {
    if (!secs || secs < 60) return secs > 0 ? `${Math.round(secs)}s` : '0m';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function formatMoney(amount) {
    return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
  }

  function getCategoryColor(cat) {
    const colors = {
      waste: '#ef4444',
      productive: '#22c55e',
      smartSave: '#3b82f6',
      neutral: '#6b7280',
    };
    return colors[cat] || colors.neutral;
  }

  // Default site categories (kept in sync with site-categories.js)
  const WASTE_DEFAULTS = ['instagram.com','facebook.com','twitter.com','x.com','reddit.com','tiktok.com','youtube.com','twitch.tv','netflix.com','hotstar.com'];
  const PROD_DEFAULTS = ['github.com','gitlab.com','leetcode.com','codeforces.com','stackoverflow.com','udemy.com','coursera.org','freecodecamp.org','developer.mozilla.org','dev.to','codepen.io','hackerrank.com'];
  const SAVE_DEFAULTS = ['amazon.in','amazon.com','flipkart.com','booking.com','makemytrip.com','irctc.co.in','swiggy.com','zomato.com'];

  function getDomainCategory(domain, userCats) {
    if (userCats[domain]) return userCats[domain];
    if (WASTE_DEFAULTS.includes(domain)) return 'waste';
    if (PROD_DEFAULTS.includes(domain)) return 'productive';
    if (SAVE_DEFAULTS.includes(domain)) return 'smartSave';
    return 'neutral';
  }

  // ============================================================
  // TAB SWITCHING
  // ============================================================
  let updateTestTabLiveState;
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tabContents.forEach(c => {
        c.classList.remove('active');
        if (c.id === `tab-${tabId}`) c.classList.add('active');
      });
      if (tabId === 'productivity') {
        renderWatchHistoryGraph(dailyWatchStats);
        loadProductivityData();
      } else if (tabId === 'insights') {
        loadInsights();
      } else if (tabId === 'test') {
        if (typeof updateTestTabLiveState === 'function') {
          updateTestTabLiveState();
        }
      }
    });
  });

  // ============================================================
  // DEEP FOCUS UI
  // ============================================================
  function updateDeepFocusUI(enabled) {
    const cards = document.querySelectorAll('#tab-customization .card:not(.focus-card)');
    cards.forEach(card => {
      card.style.opacity = enabled ? '0.45' : '1';
      card.style.pointerEvents = enabled ? 'none' : 'auto';
    });
  }

  // ============================================================
  // WATCH HISTORY GRAPH
  // ============================================================
  function renderWatchHistoryGraph(stats) {
    if (!graphContainer) return;
    graphContainer.innerHTML = '';
    graphLabels.innerHTML = '';
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toDateString());
    }
    const maxMins = Math.max(...days.map(d => stats[d] || 0), 30);
    days.forEach(day => {
      const mins = stats[day] || 0;
      const height = (mins / maxMins) * 100;
      const bc = document.createElement('div');
      bc.className = 'graph-bar-container';
      const bar = document.createElement('div');
      bar.className = 'graph-bar';
      bar.style.height = `${Math.max(height, 2)}%`;
      bar.setAttribute('data-value', mins);
      bc.appendChild(bar);
      graphContainer.appendChild(bc);
      const label = document.createElement('div');
      label.className = 'graph-label';
      label.textContent = day.split(' ')[0];
      graphLabels.appendChild(label);
    });
  }

  // ============================================================
  // PRODUCTIVITY DATA LOAD
  // ============================================================
  async function loadProductivityData() {
    try {
      // Get today's site time
      const response = await browser.runtime.sendMessage({ action: 'getSiteTimeToday' });
      currentSiteData = response?.data || {};

      // Get 7-day range for weekly report
      const rangeResponse = await browser.runtime.sendMessage({ action: 'getSiteTimeRange', days: 7 });
      const rangeData = rangeResponse?.data || {};

      // Get settings
      const stored = await browser.storage.local.get(['hourlyRate', 'siteCategories', 'blockedPatterns']);
      currentHourlyRate = stored.hourlyRate || 500;
      currentSiteCategories = stored.siteCategories || {};

      if (hourlyRateInput) hourlyRateInput.value = currentHourlyRate;

      renderSiteTimeList(currentSiteData);
      renderMoneyMeter(currentSiteData);
      renderWeeklyReport(rangeData);
      renderBlockerList(stored.blockedPatterns || []);
      renderAchievements(currentSiteData);
    } catch (e) {
      console.error('[Popup] loadProductivityData error:', e);
    }
  }

  // ============================================================
  // SITE TIME LIST
  // ============================================================
  function renderSiteTimeList(siteData) {
    if (!siteTimeList) return;
    const sorted = Object.entries(siteData).sort(([, a], [, b]) => b - a);
    const total = Object.values(siteData).reduce((s, v) => s + v, 0);
    if (totalActiveTime) totalActiveTime.textContent = formatTime(total);

    if (sorted.length === 0) {
      siteTimeList.innerHTML = '<div style="text-align:center;color:var(--text-sec);font-size:11px;padding:16px 0">No activity tracked today yet.</div>';
      return;
    }

    const maxSecs = sorted[0][1];
    siteTimeList.innerHTML = '';
    sorted.slice(0, 8).forEach(([domain, secs]) => {
      const cat = getDomainCategory(domain, currentSiteCategories);
      const color = getCategoryColor(cat);
      const pct = Math.round((secs / maxSecs) * 100);
      const row = document.createElement('div');
      row.className = 'site-row';
      row.innerHTML = `
        <span class="site-cat-dot" style="background:${color}"></span>
        <span class="domain">${domain}</span>
        <div class="site-bar-bg"><div class="site-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="duration">${formatTime(secs)}</span>
      `;
      siteTimeList.appendChild(row);
    });
  }

  // ============================================================
  // MONEY METER
  // ============================================================
  function renderMoneyMeter(siteData) {
    if (!moneyWasted) return;
    const hourlyRate = currentHourlyRate;
    let wastedSecs = 0, investedSecs = 0, savedSecs = 0;

    for (const [domain, secs] of Object.entries(siteData)) {
      const cat = getDomainCategory(domain, currentSiteCategories);
      if (cat === 'waste') wastedSecs += secs;
      else if (cat === 'productive') investedSecs += secs;
      else if (cat === 'smartSave') savedSecs += secs;
    }

    const wasted = Math.round((wastedSecs / 3600) * hourlyRate);
    const invested = Math.round((investedSecs / 3600) * hourlyRate);
    const saved = Math.round((savedSecs / 3600) * hourlyRate * 0.5);
    const net = invested + saved - wasted;

    moneyWasted.textContent = formatMoney(wasted);
    moneyWasted.className = 'amount neg';
    moneyInvested.textContent = formatMoney(invested + saved);
    moneyInvested.className = 'amount pos';
    moneyNet.textContent = (net >= 0 ? '+' : '-') + formatMoney(net);
    moneyNet.className = `net-val ${net >= 0 ? 'pos' : 'neg'}`;
    moneyNet.style.color = net >= 0 ? 'var(--success)' : 'var(--danger)';

    // Insight message
    if (moneyInsight) {
      if (wasted > invested && wasted > 200) {
        const wastedHrs = (wastedSecs / 3600).toFixed(1);
        moneyInsight.textContent = `💡 You spent ${wastedHrs}h on distracting sites — worth ${formatMoney(wasted)} of your time.`;
      } else if (net > 500) {
        moneyInsight.textContent = `🎉 You're up ${formatMoney(net)} net today. Great focus!`;
      } else {
        moneyInsight.textContent = `Track your browsing to see the real cost of distractions.`;
      }
    }
  }

  // ============================================================
  // WEEKLY REPORT
  // ============================================================
  function renderWeeklyReport(rangeData) {
    if (!weeklyReportBars) return;
    weeklyReportBars.innerHTML = '';

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    let weekWasted = 0, weekInvested = 0;

    days.forEach(dayDate => {
      const key = `siteTime_${dayDate.toDateString()}`;
      const dayData = rangeData[key] || {};
      let prodSecs = 0, wasteSecs = 0;

      for (const [domain, secs] of Object.entries(dayData)) {
        const cat = getDomainCategory(domain, currentSiteCategories);
        if (cat === 'productive') prodSecs += secs;
        else if (cat === 'waste') wasteSecs += secs;
      }

      weekWasted += wasteSecs;
      weekInvested += prodSecs;

      const total = prodSecs + wasteSecs;
      const prodPct = total > 0 ? (prodSecs / total) * 100 : 0;
      const wastePct = total > 0 ? (wasteSecs / total) * 100 : 0;

      const label = dayDate.toDateString().split(' ')[0];
      const totalTime = formatTime(total);

      const row = document.createElement('div');
      row.className = 'week-bar-row';
      row.innerHTML = `
        <span class="week-day-label">${label}</span>
        <div class="week-bar-wrap">
          <div class="week-bar-prod" style="width:${prodPct}%"></div>
          <div class="week-bar-waste" style="width:${wastePct}%"></div>
        </div>
        <span class="week-total">${total > 0 ? totalTime : '-'}</span>
      `;
      weeklyReportBars.appendChild(row);
    });

    const hourlyRate = currentHourlyRate;
    const netMoney = Math.round(((weekInvested - weekWasted) / 3600) * hourlyRate);
    if (weeklyNet) {
      weeklyNet.textContent = (netMoney >= 0 ? '+' : '-') + formatMoney(netMoney);
      weeklyNet.style.color = netMoney >= 0 ? 'var(--success)' : 'var(--danger)';
    }
  }

  // ============================================================
  // URL BLOCKER UI
  // ============================================================
  function renderBlockerList(patterns) {
    if (!blockerList) return;
    blockerList.innerHTML = '';
    if (patterns.length === 0) {
      blockerList.innerHTML = '<div style="color:var(--text-sec);font-size:11px;text-align:center;padding:8px 0">No blocked URLs. Add one below.</div>';
      return;
    }
    patterns.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'blocker-item';
      item.innerHTML = `
        <label class="toggle-switch" style="flex-shrink:0">
          <input type="checkbox" class="blocker-toggle" data-index="${i}" ${p.enabled ? 'checked' : ''} />
          <span class="slider"></span>
        </label>
        <span class="label">${p.label || p.pattern}</span>
        <span class="mode-badge ${p.mode === 'softBlock' ? 'soft' : ''}">${p.mode === 'softBlock' ? 'Soft' : 'Block'}</span>
        <button class="btn-small btn-danger" data-remove="${i}">✕</button>
      `;
      blockerList.appendChild(item);
    });

    // Toggle handlers
    blockerList.querySelectorAll('.blocker-toggle').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        const stored = await browser.storage.local.get('blockedPatterns');
        const patterns = stored.blockedPatterns || [];
        if (patterns[idx]) { patterns[idx].enabled = e.target.checked; }
        await browser.storage.local.set({ blockedPatterns: patterns });
      });
    });

    // Remove handlers
    blockerList.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.getAttribute('data-remove'));
        const stored = await browser.storage.local.get('blockedPatterns');
        const patterns = stored.blockedPatterns || [];
        patterns.splice(idx, 1);
        await browser.storage.local.set({ blockedPatterns: patterns });
        renderBlockerList(patterns);
      });
    });
  }

  if (blockerAddBtn) {
    blockerAddBtn.addEventListener('click', async () => {
      const val = blockerUrlInput?.value?.trim();
      if (!val) return;
      const stored = await browser.storage.local.get('blockedPatterns');
      const patterns = stored.blockedPatterns || [];
      const clean = val.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      patterns.push({ pattern: clean, mode: 'block', label: clean, enabled: true });
      await browser.storage.local.set({ blockedPatterns: patterns });
      blockerUrlInput.value = '';
      renderBlockerList(patterns);
    });
  }

  // ============================================================
  // ACHIEVEMENTS
  // ============================================================
  const ACHIEVEMENT_DEFS = [
    { id: 'first_step', emoji: '🌱', label: 'First Step', check: (d) => d.prodSecs >= 3600 },
    { id: 'focused',    emoji: '🎯', label: 'Focused',    check: (d) => d.wasteSecs < 3600 && d.prodSecs > 0 },
    { id: 'streak_3',   emoji: '🔥', label: 'On a Roll',  check: (d) => d.streak >= 3 },
    { id: 'zen_mode',   emoji: '🧘', label: 'Zen Mode',   check: (d) => d.prodSecs > 0 },
    { id: 'big_earner', emoji: '💎', label: 'Big Earner',  check: (d) => d.net >= 5000 },
    { id: 'king',       emoji: '👑', label: 'Focus King',  check: (d) => d.prodSecs >= 18000 }, // 5h
  ];

  function renderAchievements(siteData) {
    if (!badgesGrid) return;
    let prodSecs = 0, wasteSecs = 0;
    for (const [domain, secs] of Object.entries(siteData)) {
      const cat = getDomainCategory(domain, currentSiteCategories);
      if (cat === 'productive') prodSecs += secs;
      else if (cat === 'waste') wasteSecs += secs;
    }
    const net = Math.round(((prodSecs - wasteSecs) / 3600) * currentHourlyRate);
    const stats = { prodSecs, wasteSecs, net, streak: 0 };

    badgesGrid.innerHTML = '';
    ACHIEVEMENT_DEFS.forEach(a => {
      const earned = a.check(stats);
      const badge = document.createElement('div');
      badge.className = `badge ${earned ? 'earned' : ''}`;
      badge.title = a.label;
      badge.innerHTML = `<span class="emoji">${a.emoji}</span><span class="badge-label">${a.label}</span>`;
      badgesGrid.appendChild(badge);
    });
  }

  // ============================================================
  // INSIGHTS TAB
  // ============================================================
  async function loadInsights() {
    if (!insightsContainer) return;
    insightsContainer.innerHTML = '';

    const siteData = currentSiteData;
    const hourlyRate = currentHourlyRate;
    const insights = [];

    let totalWasteSecs = 0, totalProdSecs = 0;
    const wasteDomains = [];

    for (const [domain, secs] of Object.entries(siteData)) {
      const cat = getDomainCategory(domain, currentSiteCategories);
      if (cat === 'waste') { totalWasteSecs += secs; wasteDomains.push([domain, secs]); }
      else if (cat === 'productive') totalProdSecs += secs;
    }
    wasteDomains.sort(([, a], [, b]) => b - a);

    // Insight 1: top waster
    if (wasteDomains.length > 0) {
      const [dom, secs] = wasteDomains[0];
      const hrs = (secs / 3600).toFixed(1);
      const cost = Math.round((secs / 3600) * hourlyRate);
      insights.push({
        icon: '💸',
        title: 'Time Cost Alert',
        body: `You spent ${hrs}h on ${dom} today — worth ${formatMoney(cost)} of your productive time at ₹${hourlyRate}/hr.`,
        cta: null,
      });
    }

    // Insight 2: productive praise or nudge
    if (totalProdSecs >= 3600) {
      const hrs = (totalProdSecs / 3600).toFixed(1);
      insights.push({
        icon: '🏅',
        title: 'Great Focus!',
        body: `You invested ${hrs}h in productive work today. That's ${formatMoney(Math.round((totalProdSecs / 3600) * hourlyRate))} worth of your time well spent!`,
        cta: null,
      });
    } else if (Object.keys(siteData).length > 0) {
      insights.push({
        icon: '💪',
        title: 'Ready to Level Up?',
        body: `No productive browsing tracked yet today. Open GitHub, LeetCode, or any learning platform to start investing your time.`,
        cta: { text: '⚡ Open LeetCode', href: 'https://leetcode.com' },
      });
    }

    // Insight 3: coupon trap / general waste
    if (totalWasteSecs > 5400) { // > 1.5 hrs
      const hrs = (totalWasteSecs / 3600).toFixed(1);
      const cost = Math.round((totalWasteSecs / 3600) * hourlyRate);
      insights.push({
        icon: '⏰',
        title: 'Time is Money',
        body: `You spent ${hrs}h on distracting sites today — costing you ${formatMoney(cost)}. Even 30 min of learning could earn you ₹${Math.round(hourlyRate/2)} in career value.`,
        cta: null,
      });
    }

    // Insight 4: if no data at all
    if (Object.keys(siteData).length === 0) {
      insights.push({
        icon: '🌱',
        title: 'Just Getting Started',
        body: 'Time tracking starts now! Browse normally and come back to see where your time goes. You might be surprised.',
        cta: null,
      });
    }

    if (insights.length === 0) {
      insightsContainer.innerHTML = '<div style="text-align:center;color:var(--text-sec);font-size:11px;padding:24px 0">Keep browsing — insights will appear as we collect data!</div>';
      return;
    }

    insights.forEach(ins => {
      const card = document.createElement('div');
      card.className = 'insight-card';
      card.innerHTML = `
        <div class="insight-header">
          <span class="insight-icon">${ins.icon}</span>
          <span class="insight-title">${ins.title}</span>
        </div>
        <div class="insight-body">${ins.body}</div>
        ${ins.cta ? `<a href="${ins.cta.href}" target="_blank" class="insight-cta">${ins.cta.text}</a>` : ''}
      `;
      insightsContainer.appendChild(card);
    });
  }

  // ============================================================
  // INITIAL DATA LOAD
  // ============================================================
  browser.storage.local.get([
    'thumbnailMode', 'blurAmount', 'shortsRemovalEnabled',
    'pauseOnHoverEnabled', 'popupRemovalEnabled', 'focusModeEnabled',
    'timeReminderEnabled', 'timerInterval', 'timerPreset',
    'leetcodeUsername', 'codingBonusEnabled',
    'solvedProblemsHistory', 'remainingTime',
    'totalWatchTimeToday', 'continueCountToday', 'breaksTakenToday',
    'dailyWatchStats', 'hourlyRate',
    'mascotEnabled', 'mascotCategories',
  ]).then(result => {
    // Focus mode
    const focusModeEnabled = result.focusModeEnabled || false;
    if (focusModeToggle) {
      focusModeToggle.checked = focusModeEnabled;
      updateDeepFocusUI(focusModeEnabled);
    }

    // Thumbnail mode
    const thumbnailMode = result.thumbnailMode || 'blur';
    const radio = document.querySelector(`input[name="thumbnail-mode"][value="${thumbnailMode}"]`);
    if (radio) radio.checked = true;
    const blurAmount = result.blurAmount || 10;
    if (blurRangeInput) blurRangeInput.value = blurAmount;
    if (blurValueDisplay) blurValueDisplay.textContent = `${blurAmount}px`;
    if (thumbnailMode === 'blur') blurIntensityConfig?.classList.remove('hidden');
    if (thumbnailMode === 'hide') pauseOnHoverCard?.classList.add('hidden');

    // Toggles
    if (shortsToggle) shortsToggle.checked = result.shortsRemovalEnabled !== false;
    if (pauseToggle) pauseToggle.checked = result.pauseOnHoverEnabled !== false;
    if (popupToggle) popupToggle.checked = result.popupRemovalEnabled !== false;
    if (timeReminderToggle) {
      timeReminderToggle.checked = result.timeReminderEnabled !== false;
      if (!timeReminderToggle.checked) timerConfig?.classList.add('hidden');
    }

    // Timer preset
    const preset = result.timerPreset || '15';
    const presetRadio = document.querySelector(`input[name="timer-preset"][value="${preset}"]`);
    if (presetRadio) presetRadio.checked = true;
    if (preset === 'custom' && customTimerInput) {
      customTimerInput.disabled = false;
      customTimerInput.value = result.timerInterval || 45;
    }

    // Coding bonus
    if (leetcodeUsernameInput) leetcodeUsernameInput.value = result.leetcodeUsername || '';
    if (codingBonusToggle) codingBonusToggle.checked = result.codingBonusEnabled !== false;

    dailyWatchStats = result.dailyWatchStats || {};
    currentHourlyRate = result.hourlyRate || 500;
    if (hourlyRateInput) hourlyRateInput.value = currentHourlyRate;

    // Stats
    const today = new Date().toDateString();
    const solvedHistory = result.solvedProblemsHistory || {};
    const stats = solvedHistory[today] || { easy: 0, medium: 0, hard: 0, totalMinutes: 0 };
    updateCodingStats({
      remainingTime: result.remainingTime || 0,
      earnedMinutesToday: stats.totalMinutes,
      solvedToday: stats,
      totalWatchTimeToday: result.totalWatchTimeToday || 0,
      continueCountToday: result.continueCountToday || 0,
      breaksTakenToday: result.breaksTakenToday || 0,
    });

    renderWatchHistoryGraph(dailyWatchStats);

    if (!FEATURES.CODING_PLATFORM_INTEGRATION && codingIntegrationFeature) {
      codingIntegrationFeature.classList.add('hidden');
    }

    // Mascot companion settings
    if (FEATURES.MASCOT_COMPANION) {
      const mascotEnabled = result.mascotEnabled !== false;
      if (mascotToggle) mascotToggle.checked = mascotEnabled;
      if (!mascotEnabled && mascotCategoriesConfig) {
        mascotCategoriesConfig.style.opacity = '0.45';
        mascotCategoriesConfig.style.pointerEvents = 'none';
      }
      const savedCats = result.mascotCategories || {};
      mascotCatToggles.forEach(cb => {
        const cat = cb.value;
        if (savedCats[cat] !== undefined) cb.checked = savedCats[cat];
      });
    } else {
      const mascotCard = document.getElementById('mascot-companion-card');
      if (mascotCard) mascotCard.classList.add('hidden');
    }
  });

  // ============================================================
  // UPDATE UI STATS (from background messages)
  // ============================================================
  function updateCodingStats(data) {
    if (data.remainingTime !== undefined && remainingTimeDisplay) {
      remainingTimeDisplay.textContent = `${Math.round(data.remainingTime / 1000 / 60)}m`;
    }
    if (data.earnedMinutesToday !== undefined && earnedTimeDisplay) {
      earnedTimeDisplay.textContent = `${data.earnedMinutesToday}m`;
    }
    if (data.solvedToday) {
      if (solvedEasySpan) solvedEasySpan.textContent = data.solvedToday.easy || 0;
      if (solvedMediumSpan) solvedMediumSpan.textContent = data.solvedToday.medium || 0;
      if (solvedHardSpan) solvedHardSpan.textContent = data.solvedToday.hard || 0;
    }
    if (data.totalWatchTimeToday !== undefined && totalWatchedTodayDisplay) {
      totalWatchedTodayDisplay.textContent = formatTime(Math.round(data.totalWatchTimeToday / 1000));
    }
    if (data.continueCountToday !== undefined && continueCountTodayDisplay) {
      continueCountTodayDisplay.textContent = data.continueCountToday;
    }
    if (data.breaksTakenToday !== undefined && breaksTakenTodayDisplay) {
      breaksTakenTodayDisplay.textContent = data.breaksTakenToday;
    }
  }

  browser.runtime.onMessage.addListener(msg => {
    if (msg.action === 'updateStats') updateCodingStats(msg);
  });

  // ============================================================
  // HOURLY RATE CHANGE
  // ============================================================
  if (hourlyRateInput) {
    hourlyRateInput.addEventListener('change', async () => {
      const rate = parseInt(hourlyRateInput.value) || 500;
      currentHourlyRate = Math.max(1, rate);
      await browser.storage.local.set({ hourlyRate: currentHourlyRate });
      renderMoneyMeter(currentSiteData);
    });
  }

  // ============================================================
  // CODING PROFILE SAVE
  // ============================================================
  function saveCodingProfileSettings() {
    browser.storage.local.set({
      leetcodeUsername: leetcodeUsernameInput?.value || '',
      codingBonusEnabled: codingBonusToggle?.checked ?? true,
    }).then(() => {
      browser.runtime.sendMessage({
        action: 'updateCodingProfiles',
        leetcodeUsername: leetcodeUsernameInput?.value || '',
        codingBonusEnabled: codingBonusToggle?.checked ?? true,
      });
    });
  }
  if (FEATURES.CODING_PLATFORM_INTEGRATION) {
    leetcodeUsernameInput?.addEventListener('change', saveCodingProfileSettings);
    codingBonusToggle?.addEventListener('change', saveCodingProfileSettings);
  }

  // ============================================================
  // THUMBNAIL CONTROLS
  // ============================================================
  thumbnailModeRadios.forEach(radio => {
    radio.addEventListener('change', function () {
      const mode = this.value;
      browser.storage.local.set({ thumbnailMode: mode });
      if (mode === 'blur') blurIntensityConfig?.classList.remove('hidden');
      else blurIntensityConfig?.classList.add('hidden');
      if (mode === 'hide') pauseOnHoverCard?.classList.add('hidden');
      else pauseOnHoverCard?.classList.remove('hidden');
      browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (tabs[0]?.url?.includes('youtube.com')) {
          browser.tabs.sendMessage(tabs[0].id, { action: 'changeThumbnailMode', mode });
        }
      });
    });
  });

  blurRangeInput?.addEventListener('input', e => {
    const amt = e.target.value;
    if (blurValueDisplay) blurValueDisplay.textContent = `${amt}px`;
    browser.storage.local.set({ blurAmount: parseInt(amt) });
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.url?.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, { action: 'updateBlurAmount', amount: `${amt}px` });
      }
    });
  });

  // ============================================================
  // OTHER TOGGLES
  // ============================================================
  shortsToggle?.addEventListener('change', function () {
    browser.storage.local.set({ shortsRemovalEnabled: this.checked });
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.url?.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, { action: 'toggleShorts', enabled: this.checked });
      }
    });
  });

  pauseToggle?.addEventListener('change', function () {
    browser.storage.local.set({ pauseOnHoverEnabled: this.checked });
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.url?.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, { action: 'togglePauseOnHover', enabled: this.checked });
      }
    });
  });

  popupToggle?.addEventListener('change', function () {
    browser.storage.local.set({ popupRemovalEnabled: this.checked });
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.url?.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, { action: 'togglePopupRemoval', enabled: this.checked });
      }
    });
  });

  timeReminderToggle?.addEventListener('change', function () {
    browser.storage.local.set({ timeReminderEnabled: this.checked });
    if (this.checked) timerConfig?.classList.remove('hidden');
    else timerConfig?.classList.add('hidden');
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.url?.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, { action: 'toggleTimeReminder', enabled: this.checked });
      }
    });
  });

  timerPresets.forEach(radio => {
    radio.addEventListener('change', function () {
      const preset = this.value;
      let interval = preset === 'custom' ? (parseInt(customTimerInput?.value) || 45) : parseInt(preset);
      if (customTimerInput) customTimerInput.disabled = preset !== 'custom';
      browser.storage.local.set({ timerPreset: preset, timerInterval: interval });
      browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (tabs[0]?.url?.includes('youtube.com')) {
          browser.tabs.sendMessage(tabs[0].id, { action: 'updateTimerInterval', interval });
        }
      });
    });
  });

  customTimerInput?.addEventListener('change', function () {
    const customRadio = document.querySelector('input[name="timer-preset"][value="custom"]');
    if (customRadio?.checked) {
      let interval = parseInt(this.value) || 45;
      if (interval < 1) { this.value = 1; interval = 1; }
      if (interval > 180) { this.value = 180; interval = 180; }
      browser.storage.local.set({ timerInterval: interval });
      browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (tabs[0]?.url?.includes('youtube.com')) {
          browser.tabs.sendMessage(tabs[0].id, { action: 'updateTimerInterval', interval });
        }
      });
    }
  });

  focusModeToggle?.addEventListener('change', function () {
    const enabled = this.checked;
    browser.storage.local.set({ focusModeEnabled: enabled });
    updateDeepFocusUI(enabled);
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.url?.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, { action: 'toggleDeepFocus', enabled });
      }
    });
  });

  // ============================================================
  // MASCOT COMPANION TOGGLES
  // ============================================================
  mascotToggle?.addEventListener('change', function () {
    const enabled = this.checked;
    browser.storage.local.set({ mascotEnabled: enabled });
    if (mascotCategoriesConfig) {
      mascotCategoriesConfig.style.opacity = enabled ? '1' : '0.45';
      mascotCategoriesConfig.style.pointerEvents = enabled ? 'auto' : 'none';
    }
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.url?.includes('youtube.com')) {
        browser.tabs.sendMessage(tabs[0].id, { action: 'toggleMascot', enabled });
      }
    });
  });

  mascotCatToggles.forEach(cb => {
    cb.addEventListener('change', () => {
      const categories = {};
      mascotCatToggles.forEach(toggle => {
        categories[toggle.value] = toggle.checked;
      });
      browser.storage.local.set({ mascotCategories: categories });
      browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (tabs[0]?.url?.includes('youtube.com')) {
          browser.tabs.sendMessage(tabs[0].id, { action: 'updateMascotCategories', categories });
        }
      });
    });
  });

  // ============================================================
  // DEV TEST LAB INITIALIZATION
  // ============================================================
  const IS_DEV_MODE = (typeof __DEV__ !== 'undefined' && __DEV__ === true);

  if (document.getElementById('tab-test')) {
    initTestLab();
  } else if (!IS_DEV_MODE) {
    const testBtn = document.getElementById('tab-btn-test');
    if (testBtn) testBtn.remove();
  }

  function initTestLab() {
    const testToast = document.getElementById('test-toast');
    let toastTimeout = null;

    function showTestToast(msg, isError = false) {
      if (!testToast) return;
      if (toastTimeout) clearTimeout(toastTimeout);
      testToast.textContent = msg;
      testToast.className = `test-toast visible ${isError ? 'error' : 'success'}`;
      toastTimeout = setTimeout(() => {
        testToast.className = 'test-toast';
      }, 3500);
    }

    async function getActiveTab() {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        return tabs[0] || null;
      } catch {
        return null;
      }
    }

    async function getYouTubeTab() {
      const activeTab = await getActiveTab();
      if (activeTab?.url?.includes('youtube.com')) {
        return activeTab;
      }
      try {
        const ytTabs = await browser.tabs.query({ url: '*://*.youtube.com/*' });
        if (ytTabs && ytTabs.length > 0) {
          return ytTabs[0];
        }
      } catch { /* ignore */ }
      return null;
    }

    updateTestTabLiveState = async function () {
      try {
        const tab = await getActiveTab();
        const domainEl = document.getElementById('test-active-domain');
        const pillLabel = document.getElementById('test-tab-label');
        const dot = document.getElementById('test-tab-dot');

        if (tab && tab.url) {
          try {
            const u = new URL(tab.url);
            const domain = u.hostname.replace(/^www\./, '');
            if (domainEl) domainEl.textContent = domain || 'Active Page';
            const isYT = domain.includes('youtube.com');
            if (pillLabel) pillLabel.textContent = isYT ? '🟢 YouTube Active' : '🟡 Web Tab';
            if (dot) dot.className = isYT ? 'test-status-dot' : 'test-status-dot inactive';
          } catch {
            if (domainEl) domainEl.textContent = 'Special Page';
            if (pillLabel) pillLabel.textContent = '⚪ System Tab';
            if (dot) dot.className = 'test-status-dot inactive';
          }
        } else {
          if (domainEl) domainEl.textContent = 'No Active Tab';
          if (pillLabel) pillLabel.textContent = '⚪ Inactive';
          if (dot) dot.className = 'test-status-dot inactive';
        }

        const stored = await browser.storage.local.get([
          'totalWatchTimeToday',
          'remainingTime',
          'blockerOverrides',
          'hourlyRate',
        ]);

        const watchSecs = Math.round((stored.totalWatchTimeToday || 0) / 1000);
        const allowSecs = Math.round((stored.remainingTime || 0) / 1000);
        const overridesCount = stored.blockerOverrides?.count || 0;
        const rate = stored.hourlyRate || 500;

        const watchEl = document.getElementById('test-stat-watch');
        const allowEl = document.getElementById('test-stat-allowance');
        const overridesEl = document.getElementById('test-stat-overrides');
        const rateEl = document.getElementById('test-stat-rate');

        if (watchEl) watchEl.textContent = formatTime(watchSecs);
        if (allowEl) allowEl.textContent = formatTime(allowSecs);
        if (overridesEl) overridesEl.textContent = `${overridesCount}/3`;
        if (rateEl) rateEl.textContent = `₹${rate}`;
      } catch (e) {
        console.error('[TestLab] Error updating live state:', e);
      }
    };

    updateTestTabLiveState();

    // ------------------------------------------------------------
    // 1. MASCOT TESTING
    // ------------------------------------------------------------
    async function triggerMascot(category, pose, customText) {
      const targetTab = await getYouTubeTab();
      if (!targetTab?.id) {
        showTestToast('⚠️ Open or switch to a YouTube tab to view mascot animations!', true);
        return;
      }
      try {
        await browser.tabs.sendMessage(targetTab.id, {
          action: 'testTriggerMascot',
          category,
          pose,
          text: customText,
        });
        showTestToast(`✓ Triggered ${category} mascot (${pose}) on YouTube!`);
      } catch (e) {
        showTestToast(`Could not send: ${e.message} (Try refreshing YouTube tab)`, true);
      }
    }

    document.getElementById('btn-test-mascot-break')?.addEventListener('click', () => {
      triggerMascot('break', 'waving', 'Time for a break! Take a stretch and drink some water.');
    });

    document.getElementById('btn-test-mascot-water')?.addEventListener('click', () => {
      triggerMascot('hydration', 'drinking', 'Have you had some water recently? Stay hydrated! 💧');
    });

    document.getElementById('btn-test-mascot-eye')?.addEventListener('click', () => {
      triggerMascot('eye_strain', 'talking', '20-20-20 rule: Look at something 20 feet away for 20 seconds!');
    });

    document.getElementById('btn-test-mascot-stop')?.addEventListener('click', () => {
      triggerMascot('stop_watching', 'stern', 'You have been watching for quite a while. Time to wrap it up?');
    });

    document.getElementById('btn-test-mascot-night')?.addEventListener('click', () => {
      triggerMascot('late_night', 'sleepy', 'It is late! Late-night screens disrupt sleep. Time to rest.');
    });

    document.getElementById('btn-test-mascot-dismiss')?.addEventListener('click', async () => {
      const targetTab = await getYouTubeTab();
      if (targetTab?.id) {
        browser.tabs.sendMessage(targetTab.id, { action: 'testDismissMascot' }).catch(() => {});
        showTestToast('✓ Mascot dismissed');
      } else {
        showTestToast('No YouTube tab found', true);
      }
    });

    document.getElementById('btn-test-mascot-custom')?.addEventListener('click', async () => {
      const targetTab = await getYouTubeTab();
      if (!targetTab?.id) {
        showTestToast('⚠️ Open or switch to a YouTube tab to view mascot animations!', true);
        return;
      }
      const pose = document.getElementById('test-mascot-pose')?.value || 'drinking';
      const entrance = document.getElementById('test-mascot-entrance')?.value || 'slide';
      const text = document.getElementById('test-mascot-text')?.value || 'Testing custom mascot trigger!';
      try {
        await browser.tabs.sendMessage(targetTab.id, {
          action: 'testTriggerMascot',
          category: 'break',
          pose,
          entrance,
          text,
        });
        showTestToast(`✓ Custom mascot triggered (${pose}/${entrance})`);
      } catch (e) {
        showTestToast(`Error: ${e.message} (Try refreshing YouTube tab)`, true);
      }
    });

    // ------------------------------------------------------------
    // 2. NOTIFICATION BANNERS
    // ------------------------------------------------------------
    async function triggerBanner(bannerType, data = {}) {
      try {
        const tab = await getActiveTab();
        if (!tab || !tab.id) {
          showTestToast('No active tab found', true);
          return;
        }
        await browser.tabs.sendMessage(tab.id, {
          action: 'showBanner',
          type: bannerType,
          bannerType,
          data,
        });
        showTestToast(`✓ Sent ${bannerType} banner to active tab!`);
      } catch (e) {
        browser.runtime.sendMessage({
          action: 'testTriggerBannerActiveTab',
          type: bannerType,
          bannerType,
          data,
        }).then(() => {
          showTestToast(`✓ Dispatched ${bannerType} banner!`);
        }).catch(err => {
          showTestToast(`Error: ${err.message}`, true);
        });
      }
    }

    document.getElementById('btn-test-banner-time')?.addEventListener('click', () => {
      triggerBanner('timeAlert', { domain: 'youtube.com', minutes: 45 });
    });

    document.getElementById('btn-test-banner-milestone')?.addEventListener('click', () => {
      triggerBanner('milestone', { message: '🎯 You reached 2 hours of productive focus today!' });
    });

    document.getElementById('btn-test-banner-summary')?.addEventListener('click', () => {
      triggerBanner('dailySummary', { productiveSecs: 5400, wasteSecs: 1800 });
    });

    document.getElementById('btn-test-banner-suggestion')?.addEventListener('click', () => {
      triggerBanner('suggestion', { message: '💡 You usually lose focus around now. Try enabling Focus Mode!' });
    });

    // ------------------------------------------------------------
    // 3. DISTRACTION BLOCKER & OVERLAYS
    // ------------------------------------------------------------
    document.getElementById('btn-test-blocker-overlay')?.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      try {
        await browser.tabs.sendMessage(tab.id, {
          action: 'showBlockOverlay',
          pattern: { pattern: 'test-distraction.com', label: 'Distracting Website' },
        });
        showTestToast('✓ Distraction block overlay shown on active tab!');
      } catch (e) {
        showTestToast(`Failed: ${e.message}`, true);
      }
    });

    document.getElementById('btn-test-hard-block')?.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (!tab?.url?.includes('youtube.com')) {
        showTestToast('⚠️ YouTube hard lock screen requires a YouTube tab!', true);
        return;
      }
      try {
        await browser.tabs.sendMessage(tab.id, { action: 'testShowHardBlock' });
        showTestToast('✓ YouTube hard lock screen shown!');
      } catch (e) {
        showTestToast(`Failed: ${e.message}`, true);
      }
    });

    document.getElementById('btn-test-clear-overlays')?.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (tab?.id) {
        browser.tabs.sendMessage(tab.id, { action: 'removeBlockOverlay' }).catch(() => {});
        browser.tabs.sendMessage(tab.id, { action: 'testHideHardBlock' }).catch(() => {});
      }
      showTestToast('✓ Cleared all active overlays');
    });

    document.getElementById('btn-test-reset-overrides')?.addEventListener('click', async () => {
      const resp = await browser.runtime.sendMessage({ action: 'testResetOverrides' });
      if (resp?.ok) {
        showTestToast('✓ Emergency overrides reset to 0 / 3');
        updateTestTabLiveState();
      }
    });

    document.getElementById('btn-test-max-overrides')?.addEventListener('click', async () => {
      const resp = await browser.runtime.sendMessage({ action: 'testMaxOverrides' });
      if (resp?.ok) {
        showTestToast('✓ Overrides set to max (3 / 3)');
        updateTestTabLiveState();
      }
    });

    // ------------------------------------------------------------
    // 4. WATCH TIME & MONEY SIMULATOR
    // ------------------------------------------------------------
    document.getElementById('btn-test-time-yt15')?.addEventListener('click', async () => {
      const resp = await browser.runtime.sendMessage({ action: 'testAddWatchTime', minutes: 15 });
      if (resp?.ok) {
        showTestToast(`✓ Added +15m watch time (Total: ${resp.minsWatched}m)`);
        updateTestTabLiveState();
        loadProductivityData();
      }
    });

    document.getElementById('btn-test-time-yt60')?.addEventListener('click', async () => {
      const resp = await browser.runtime.sendMessage({ action: 'testAddWatchTime', minutes: 60 });
      if (resp?.ok) {
        showTestToast(`✓ Added +60m watch time (Total: ${resp.minsWatched}m)`);
        updateTestTabLiveState();
        loadProductivityData();
      }
    });

    document.getElementById('btn-test-time-prod')?.addEventListener('click', async () => {
      const resp = await browser.runtime.sendMessage({
        action: 'testAddSiteTime',
        domain: 'github.com',
        seconds: 1800,
      });
      if (resp?.ok) {
        showTestToast('✓ Added +30m productive time (github.com)');
        loadProductivityData();
      }
    });

    document.getElementById('btn-test-time-waste')?.addEventListener('click', async () => {
      const resp = await browser.runtime.sendMessage({
        action: 'testAddSiteTime',
        domain: 'instagram.com',
        seconds: 1800,
      });
      if (resp?.ok) {
        showTestToast('✓ Added +30m wasted time (instagram.com)');
        loadProductivityData();
      }
    });

    document.getElementById('btn-test-reset-time')?.addEventListener('click', async () => {
      const resp = await browser.runtime.sendMessage({ action: 'testResetTodayData' });
      if (resp?.ok) {
        showTestToast('✓ Cleared today time tracking data');
        dailyWatchStats = {};
        updateTestTabLiveState();
        loadProductivityData();
        renderWatchHistoryGraph({});
      }
    });

    document.getElementById('btn-test-break-reminder')?.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (!tab?.url?.includes('youtube.com')) {
        showTestToast('⚠️ Switch to a YouTube tab to see break reminder popup!', true);
        return;
      }
      try {
        await browser.tabs.sendMessage(tab.id, { action: 'testTriggerBreakReminder' });
        showTestToast('✓ Break reminder popup triggered on YouTube!');
      } catch (e) {
        showTestToast(`Failed: ${e.message}`, true);
      }
    });

    document.querySelectorAll('[data-test-rate]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const rate = parseInt(btn.getAttribute('data-test-rate'));
        if (rate) {
          await browser.storage.local.set({ hourlyRate: rate });
          currentHourlyRate = rate;
          if (hourlyRateInput) hourlyRateInput.value = rate;
          showTestToast(`✓ Hourly rate set to ₹${rate}`);
          updateTestTabLiveState();
          loadProductivityData();
        }
      });
    });

    // ------------------------------------------------------------
    // 5. CODING BONUS & ALLOWANCE
    // ------------------------------------------------------------
    document.getElementById('btn-test-allowance-add30')?.addEventListener('click', async () => {
      const resp = await browser.runtime.sendMessage({ action: 'testAddAllowance', minutes: 30 });
      if (resp?.ok) {
        const mins = Math.round(resp.remainingTime / 60000);
        showTestToast(`✓ Added 30m allowance (${mins}m remaining)`);
        if (remainingTimeDisplay) remainingTimeDisplay.textContent = `${mins}m`;
        updateTestTabLiveState();
      }
    });

    document.getElementById('btn-test-allowance-add60')?.addEventListener('click', async () => {
      const resp = await browser.runtime.sendMessage({ action: 'testAddAllowance', minutes: 60 });
      if (resp?.ok) {
        const mins = Math.round(resp.remainingTime / 60000);
        showTestToast(`✓ Added 60m allowance (${mins}m remaining)`);
        if (remainingTimeDisplay) remainingTimeDisplay.textContent = `${mins}m`;
        updateTestTabLiveState();
      }
    });

    document.getElementById('btn-test-allowance-drain')?.addEventListener('click', async () => {
      const resp = await browser.runtime.sendMessage({ action: 'testSetAllowance', minutes: 0 });
      if (resp?.ok) {
        showTestToast('✓ Allowance drained to 0m (Screen locks on YouTube)');
        if (remainingTimeDisplay) remainingTimeDisplay.textContent = '0m';
        updateTestTabLiveState();
      }
    });

    async function mockSolveProblem(difficulty, minutes) {
      await browser.runtime.sendMessage({ action: 'testAddAllowance', minutes });
      const today = new Date().toDateString();
      const res = await browser.storage.local.get('solvedProblemsHistory');
      const hist = res.solvedProblemsHistory || {};
      if (!hist[today]) hist[today] = { easy: 0, medium: 0, hard: 0, totalMinutes: 0 };
      hist[today][difficulty] = (hist[today][difficulty] || 0) + 1;
      hist[today].totalMinutes = (hist[today].totalMinutes || 0) + minutes;
      await browser.storage.local.set({ solvedProblemsHistory: hist });

      if (solvedEasySpan) solvedEasySpan.textContent = hist[today].easy;
      if (solvedMediumSpan) solvedMediumSpan.textContent = hist[today].medium;
      if (solvedHardSpan) solvedHardSpan.textContent = hist[today].hard;
      if (earnedTimeDisplay) earnedTimeDisplay.textContent = `${hist[today].totalMinutes}m`;

      showTestToast(`✓ Solved ${difficulty.toUpperCase()} LeetCode (+${minutes}m allowance)`);
      updateTestTabLiveState();
    }

    document.getElementById('btn-test-solve-easy')?.addEventListener('click', () => mockSolveProblem('easy', 10));
    document.getElementById('btn-test-solve-med')?.addEventListener('click', () => mockSolveProblem('medium', 20));
    document.getElementById('btn-test-solve-hard')?.addEventListener('click', () => mockSolveProblem('hard', 45));

    // ------------------------------------------------------------
    // 6. STORAGE INSPECTOR & SYSTEM TOOLS
    // ------------------------------------------------------------
    const storageViewer = document.getElementById('test-storage-viewer');

    async function refreshStorageViewer() {
      if (!storageViewer) return;
      try {
        const allData = await browser.storage.local.get(null);
        storageViewer.textContent = JSON.stringify(allData, null, 2);
        showTestToast('✓ Storage snapshot refreshed');
      } catch (e) {
        storageViewer.textContent = `Error reading storage: ${e.message}`;
      }
    }

    document.getElementById('btn-test-refresh-storage')?.addEventListener('click', refreshStorageViewer);

    document.getElementById('btn-test-copy-storage')?.addEventListener('click', async () => {
      if (!storageViewer) return;
      try {
        await navigator.clipboard.writeText(storageViewer.textContent);
        showTestToast('✓ Storage JSON copied to clipboard!');
      } catch (e) {
        showTestToast('Failed to copy to clipboard', true);
      }
    });

    document.getElementById('btn-test-reload-tab')?.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (tab?.id) {
        browser.tabs.reload(tab.id);
        showTestToast('✓ Reloaded active tab');
      }
    });

    document.getElementById('btn-test-clear-storage')?.addEventListener('click', async () => {
      if (confirm('Clear ALL extension storage? This will reset all your settings, stats, and overrides.')) {
        await browser.storage.local.clear();
        showTestToast('✓ All storage cleared! Reset to factory defaults.');
        updateTestTabLiveState();
        loadProductivityData();
        refreshStorageViewer();
      }
    });
  }

});