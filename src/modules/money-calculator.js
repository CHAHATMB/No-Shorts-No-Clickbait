// modules/money-calculator.js
// Calculates financial impact of time spent on websites

import { CATEGORIES, CATEGORY_META, categorizeSiteTime } from './site-categories.js';

const DEFAULT_HOURLY_RATE = 500; // ₹ per hour

/**
 * Get user's configured hourly rate
 */
export async function getHourlyRate() {
  const result = await browser.storage.local.get('hourlyRate');
  return result.hourlyRate || DEFAULT_HOURLY_RATE;
}

/**
 * Set user's hourly rate
 */
export async function setHourlyRate(rate) {
  await browser.storage.local.set({ hourlyRate: Math.max(1, parseInt(rate) || DEFAULT_HOURLY_RATE) });
}

/**
 * Convert seconds to monetary value based on hourly rate and category multiplier
 */
export function secondsToMoney(seconds, hourlyRate, multiplier) {
  const hours = seconds / 3600;
  return Math.round(hours * hourlyRate * multiplier);
}

/**
 * Calculate full financial impact from site time data
 * Returns detailed breakdown with totals
 */
export async function calculateFinancialImpact(siteTimeData) {
  const hourlyRate = await getHourlyRate();
  const categorized = await categorizeSiteTime(siteTimeData);
  
  const result = {
    hourlyRate,
    breakdown: {},
    totals: {
      wasted: 0,      // negative ₹ (waste sites)
      invested: 0,    // positive ₹ (productive sites)
      saved: 0,       // positive ₹ (smart save sites)
      net: 0,
    },
    topWasters: [],
    topProductive: [],
  };

  // Process each category
  for (const [catKey, domains] of Object.entries(categorized)) {
    const meta = CATEGORY_META[catKey];
    result.breakdown[catKey] = [];
    
    for (const [domain, seconds] of Object.entries(domains)) {
      const value = Math.abs(secondsToMoney(seconds, hourlyRate, Math.abs(meta.multiplier)));
      result.breakdown[catKey].push({ domain, seconds, value });
      
      if (catKey === CATEGORIES.WASTE) {
        result.totals.wasted += value;
      } else if (catKey === CATEGORIES.PRODUCTIVE) {
        result.totals.invested += value;
      } else if (catKey === CATEGORIES.SMART_SAVE) {
        result.totals.saved += value;
      }
    }
    
    // Sort by value descending
    result.breakdown[catKey].sort((a, b) => b.value - a.value);
  }
  
  result.totals.net = result.totals.invested + result.totals.saved - result.totals.wasted;
  result.topWasters = result.breakdown[CATEGORIES.WASTE].slice(0, 3);
  result.topProductive = result.breakdown[CATEGORIES.PRODUCTIVE].slice(0, 3);
  
  return result;
}

/**
 * Generate smart insight message based on the financial data
 */
export function generateInsight(impact) {
  const { totals, hourlyRate, topWasters } = impact;
  const insights = [];
  
  if (topWasters.length > 0) {
    const top = topWasters[0];
    const hours = (top.seconds / 3600).toFixed(1);
    insights.push(`You spent ${hours}h on ${top.domain}, costing you ₹${top.value.toLocaleString('en-IN')} in potential earnings.`);
  }
  
  if (totals.net < -500) {
    insights.push(`Today you lost ₹${Math.abs(totals.net).toLocaleString('en-IN')} net. Consider swapping some wasteful browsing with productive learning.`);
  } else if (totals.net > 500) {
    insights.push(`Great job! You're up ₹${totals.net.toLocaleString('en-IN')} net today. Keep it up! 🎉`);
  }
  
  if (totals.wasted > hourlyRate * 2) {
    const hours = (totals.wasted / hourlyRate).toFixed(1);
    insights.push(`You burned ${hours} hours worth of earnings on unproductive sites today.`);
  }
  
  return insights[0] || null;
}

/**
 * Format a money value in Indian Rupees
 */
export function formatMoney(amount) {
  return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
}
