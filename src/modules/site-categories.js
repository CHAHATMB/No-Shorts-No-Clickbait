// modules/site-categories.js
// Site categorization system with defaults and user overrides

export const CATEGORIES = {
  WASTE: 'waste',       // costs you money/time
  NEUTRAL: 'neutral',   // neither good nor bad
  PRODUCTIVE: 'productive', // earns/invests time well
  SMART_SAVE: 'smartSave',  // saves time vs offline alternative
};

export const CATEGORY_META = {
  [CATEGORIES.WASTE]: {
    label: 'Time Wasters',
    emoji: '🔴',
    color: '#ef4444',
    multiplier: -1,
    description: 'Sites that cost you potential earnings'
  },
  [CATEGORIES.NEUTRAL]: {
    label: 'Neutral',
    emoji: '🟡',
    color: '#f59e0b',
    multiplier: 0,
    description: 'Necessary but not directly productive'
  },
  [CATEGORIES.PRODUCTIVE]: {
    label: 'Productive',
    emoji: '🟢',
    color: '#22c55e',
    multiplier: 1,
    description: 'Investing in your skills and career'
  },
  [CATEGORIES.SMART_SAVE]: {
    label: 'Smart Savings',
    emoji: '🔵',
    color: '#3b82f6',
    multiplier: 0.5,
    description: 'Saves time compared to offline alternatives'
  },
};

export const DEFAULT_CATEGORIES = {
  // Time Wasters
  'instagram.com': CATEGORIES.WASTE,
  'facebook.com': CATEGORIES.WASTE,
  'twitter.com': CATEGORIES.WASTE,
  'x.com': CATEGORIES.WASTE,
  'reddit.com': CATEGORIES.WASTE,
  'tiktok.com': CATEGORIES.WASTE,
  'snapchat.com': CATEGORIES.WASTE,
  'youtube.com': CATEGORIES.WASTE, // default; user can move to productive
  'twitch.tv': CATEGORIES.WASTE,
  'netflix.com': CATEGORIES.WASTE,
  'primevideo.com': CATEGORIES.WASTE,
  'hotstar.com': CATEGORIES.WASTE,
  
  // Neutral
  'gmail.com': CATEGORIES.NEUTRAL,
  'google.com': CATEGORIES.NEUTRAL,
  'docs.google.com': CATEGORIES.NEUTRAL,
  'drive.google.com': CATEGORIES.NEUTRAL,
  'calendar.google.com': CATEGORIES.NEUTRAL,
  'mail.google.com': CATEGORIES.NEUTRAL,
  'outlook.com': CATEGORIES.NEUTRAL,
  'teams.microsoft.com': CATEGORIES.NEUTRAL,
  'slack.com': CATEGORIES.NEUTRAL,
  'zoom.us': CATEGORIES.NEUTRAL,
  'meet.google.com': CATEGORIES.NEUTRAL,
  'notion.so': CATEGORIES.NEUTRAL,
  
  // Productive
  'github.com': CATEGORIES.PRODUCTIVE,
  'gitlab.com': CATEGORIES.PRODUCTIVE,
  'leetcode.com': CATEGORIES.PRODUCTIVE,
  'codeforces.com': CATEGORIES.PRODUCTIVE,
  'stackoverflow.com': CATEGORIES.PRODUCTIVE,
  'udemy.com': CATEGORIES.PRODUCTIVE,
  'coursera.org': CATEGORIES.PRODUCTIVE,
  'freecodecamp.org': CATEGORIES.PRODUCTIVE,
  'developer.mozilla.org': CATEGORIES.PRODUCTIVE,
  'docs.google.com': CATEGORIES.PRODUCTIVE,
  'medium.com': CATEGORIES.PRODUCTIVE,
  'dev.to': CATEGORIES.PRODUCTIVE,
  'codepen.io': CATEGORIES.PRODUCTIVE,
  'hackerrank.com': CATEGORIES.PRODUCTIVE,
  'codecademy.com': CATEGORIES.PRODUCTIVE,
  'edx.org': CATEGORIES.PRODUCTIVE,
  'khanacademy.org': CATEGORIES.PRODUCTIVE,
  
  // Smart Savings
  'amazon.in': CATEGORIES.SMART_SAVE,
  'amazon.com': CATEGORIES.SMART_SAVE,
  'flipkart.com': CATEGORIES.SMART_SAVE,
  'booking.com': CATEGORIES.SMART_SAVE,
  'makemytrip.com': CATEGORIES.SMART_SAVE,
  'irctc.co.in': CATEGORIES.SMART_SAVE,
  'swiggy.com': CATEGORIES.SMART_SAVE,
  'zomato.com': CATEGORIES.SMART_SAVE,
  'gpay.app': CATEGORIES.SMART_SAVE,
  'phonepe.com': CATEGORIES.SMART_SAVE,
  'paytm.com': CATEGORIES.SMART_SAVE,
};

/**
 * Load category overrides from storage and merge with defaults
 */
export async function getSiteCategories() {
  const result = await browser.storage.local.get('siteCategories');
  const userOverrides = result.siteCategories || {};
  return { ...DEFAULT_CATEGORIES, ...userOverrides };
}

/**
 * Save user category override for a domain
 */
export async function setCategoryForDomain(domain, category) {
  const result = await browser.storage.local.get('siteCategories');
  const userOverrides = result.siteCategories || {};
  userOverrides[domain] = category;
  await browser.storage.local.set({ siteCategories: userOverrides });
}

/**
 * Get category for a specific domain
 */
export async function getCategoryForDomain(domain) {
  const categories = await getSiteCategories();
  return categories[domain] || CATEGORIES.NEUTRAL;
}

/**
 * Categorize a list of domains and their time
 * Returns: { waste: {domain: secs}, neutral: {...}, productive: {...}, smartSave: {...} }
 */
export async function categorizeSiteTime(siteTimeData) {
  const categories = await getSiteCategories();
  const result = {
    [CATEGORIES.WASTE]: {},
    [CATEGORIES.NEUTRAL]: {},
    [CATEGORIES.PRODUCTIVE]: {},
    [CATEGORIES.SMART_SAVE]: {},
  };
  
  for (const [domain, seconds] of Object.entries(siteTimeData)) {
    const cat = categories[domain] || CATEGORIES.NEUTRAL;
    result[cat][domain] = seconds;
  }
  
  return result;
}
