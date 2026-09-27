// modules/url-blocker.js
// URL pattern matching and blocking system

/**
 * Default blocked URL patterns
 * Format: { pattern, mode: 'block' | 'softBlock', label }
 */
export const DEFAULT_BLOCKED_PATTERNS = [
  { pattern: 'instagram.com/reels', mode: 'block', label: 'Instagram Reels', enabled: false },
  { pattern: 'instagram.com/explore', mode: 'block', label: 'Instagram Explore', enabled: false },
  { pattern: 'youtube.com/shorts', mode: 'softBlock', label: 'YouTube Shorts', enabled: false },
  { pattern: 'facebook.com', mode: 'softBlock', label: 'Facebook', enabled: false },
  { pattern: 'twitter.com', mode: 'softBlock', label: 'Twitter / X', enabled: false },
  { pattern: 'x.com', mode: 'softBlock', label: 'X (Twitter)', enabled: false },
  { pattern: 'reddit.com', mode: 'softBlock', label: 'Reddit', enabled: false },
];

/**
 * Load blocked patterns from storage
 */
export async function getBlockedPatterns() {
  const result = await browser.storage.local.get('blockedPatterns');
  return result.blockedPatterns || DEFAULT_BLOCKED_PATTERNS;
}

/**
 * Save blocked patterns
 */
export async function saveBlockedPatterns(patterns) {
  await browser.storage.local.set({ blockedPatterns: patterns });
}

/**
 * Add a new blocked pattern
 */
export async function addBlockedPattern(pattern, mode = 'block', label = '') {
  const patterns = await getBlockedPatterns();
  const newPattern = {
    pattern: pattern.toLowerCase().replace(/^https?:\/\/(www\.)?/, ''),
    mode,
    label: label || pattern,
    enabled: true,
  };
  patterns.push(newPattern);
  await saveBlockedPatterns(patterns);
  return patterns;
}

/**
 * Remove a blocked pattern by index
 */
export async function removeBlockedPattern(index) {
  const patterns = await getBlockedPatterns();
  patterns.splice(index, 1);
  await saveBlockedPatterns(patterns);
  return patterns;
}

/**
 * Toggle a pattern's enabled state
 */
export async function toggleBlockedPattern(index) {
  const patterns = await getBlockedPatterns();
  if (patterns[index]) {
    patterns[index].enabled = !patterns[index].enabled;
    await saveBlockedPatterns(patterns);
  }
  return patterns;
}

/**
 * Check if a given URL matches any enabled blocked pattern
 * Returns: { matched: boolean, pattern: {...} | null }
 */
export async function checkUrlBlocked(url) {
  if (!url) return { matched: false, pattern: null };
  
  let cleanUrl;
  try {
    const u = new URL(url);
    cleanUrl = (u.hostname + u.pathname).replace(/^www\./, '').toLowerCase();
  } catch {
    return { matched: false, pattern: null };
  }
  
  const patterns = await getBlockedPatterns();
  
  for (const p of patterns) {
    if (!p.enabled) continue;
    const normalizedPattern = p.pattern.toLowerCase().replace(/^www\./, '');
    if (cleanUrl.startsWith(normalizedPattern) || cleanUrl.includes(normalizedPattern)) {
      return { matched: true, pattern: p };
    }
  }
  
  return { matched: false, pattern: null };
}

/**
 * Get/set override count for today (soft blocks can be overridden limited times)
 */
export async function getOverrideCount() {
  const today = new Date().toDateString();
  const result = await browser.storage.local.get('blockOverrides');
  const overrides = result.blockOverrides || {};
  return overrides[today] || 0;
}

export async function incrementOverrideCount() {
  const today = new Date().toDateString();
  const result = await browser.storage.local.get('blockOverrides');
  const overrides = result.blockOverrides || {};
  overrides[today] = (overrides[today] || 0) + 1;
  await browser.storage.local.set({ blockOverrides: overrides });
  return overrides[today];
}

export const MAX_DAILY_OVERRIDES = 3;
