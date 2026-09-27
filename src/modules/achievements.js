// modules/achievements.js
// Gamification badges and achievement tracking

export const ACHIEVEMENTS = [
  {
    id: 'first_step',
    label: 'First Step',
    emoji: '🌱',
    description: 'Complete 1 productive hour',
    check: (stats) => stats.todayProductiveSecs >= 3600,
  },
  {
    id: 'focused',
    label: 'Focused',
    emoji: '🎯',
    description: '<1hr wasted today',
    check: (stats) => stats.todayWasteSecs < 3600 && stats.todayProductiveSecs > 0,
  },
  {
    id: 'streak_3',
    label: 'On a Roll',
    emoji: '🔥',
    description: '3-day streak of <2hr wasted',
    check: (stats) => stats.streak >= 3,
  },
  {
    id: 'streak_7',
    label: 'Streak Master',
    emoji: '⚡',
    description: '7-day streak of <2hr wasted',
    check: (stats) => stats.streak >= 7,
  },
  {
    id: 'money_saver',
    label: 'Money Saver',
    emoji: '💎',
    description: '₹10,000 net positive in a week',
    check: (stats) => stats.weeklyNet >= 10000,
  },
  {
    id: 'zen_mode',
    label: 'Zen Mode',
    emoji: '🧘',
    description: '0 overrides used today',
    check: (stats) => stats.todayOverrides === 0 && stats.todayProductiveSecs > 0,
  },
  {
    id: 'productivity_king',
    label: 'Productivity King',
    emoji: '👑',
    description: '5h+ productive for 5+ days',
    check: (stats) => stats.streakHeavyProductivity >= 5,
  },
];

/**
 * Compute which achievements are currently earned
 */
export function computeEarnedAchievements(stats) {
  return ACHIEVEMENTS.filter(a => {
    try { return a.check(stats); } catch { return false; }
  });
}

/**
 * Calculate current streak (days with <2hr waste)
 */
export async function calculateStreak(days = 30) {
  let streak = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `siteTime_${d.toDateString()}`;
    const result = await browser.storage.local.get(key);
    const dayData = result[key] || {};
    
    // Load site categories to identify waste
    const catResult = await browser.storage.local.get('siteCategories');
    const cats = catResult.siteCategories || {};
    
    let wasteSeconds = 0;
    for (const [domain, seconds] of Object.entries(dayData)) {
      if (cats[domain] === 'waste') wasteSeconds += seconds;
    }
    
    if (wasteSeconds < 7200) { // < 2 hours waste
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
