/**
 * Mascot message definitions and selection logic.
 */

export const MESSAGE_CATEGORIES = {
  HYDRATION: 'HYDRATION',
  EYE_STRAIN: 'EYE_STRAIN',
  BREAK: 'BREAK',
  STOP_WATCHING: 'STOP_WATCHING',
  LATE_NIGHT: 'LATE_NIGHT'
};

export const MESSAGE_POOLS = {
  [MESSAGE_CATEGORIES.HYDRATION]: [
    {
      id: 'hydration_1',
      text: 'Hey there! You\'ve been watching for {watchTime}. Time for a quick water break? 💧',
      tone: 'gentle',
      minWatchMinutes: 30,
      uses: ['watchTime']
    },
    {
      id: 'hydration_2',
      text: 'Stay hydrated! It\'s {currentTime}, a perfect time for a sip of water. 🌊',
      tone: 'playful',
      minWatchMinutes: 0,
      uses: ['currentTime']
    },
    {
      id: 'hydration_3',
      text: 'Did you know your brain needs water to stay sharp? Grab a glass! 🧠💧',
      tone: 'gentle',
      minWatchMinutes: 0,
      uses: []
    },
    {
      id: 'hydration_4',
      text: 'Good {timeOfDay}! Don\'t forget to drink some water while you watch. 🥤',
      tone: 'gentle',
      minWatchMinutes: 0,
      uses: ['timeOfDay']
    },
    {
      id: 'hydration_5',
      text: 'You\'ve been here a while. Hydration check! 💧 Your plants drink water, you should too.',
      tone: 'playful',
      minWatchMinutes: 45,
      uses: []
    },
    {
      id: 'hydration_6',
      text: 'A quick pause to drink water will make this video even better. 🧊',
      tone: 'gentle',
      minWatchMinutes: 15,
      uses: []
    }
  ],
  [MESSAGE_CATEGORIES.EYE_STRAIN]: [
    {
      id: 'eye_strain_1',
      text: 'Remember the 20-20-20 rule! Look at something 20 feet away for 20 seconds. 👁️',
      tone: 'gentle',
      minWatchMinutes: 20,
      uses: []
    },
    {
      id: 'eye_strain_2',
      text: 'You\'ve been looking at the screen for {sessionTime} straight. Give your eyes a rest! 😌',
      tone: 'gentle',
      minWatchMinutes: 30,
      uses: ['sessionTime']
    },
    {
      id: 'eye_strain_3',
      text: 'Blink check! When we watch videos, we blink 66% less. Blink a few times! 👁️👄👁️',
      tone: 'playful',
      minWatchMinutes: 15,
      uses: []
    },
    {
      id: 'eye_strain_4',
      text: 'Your eyes are working hard! Close them for a few seconds. 🙈',
      tone: 'gentle',
      minWatchMinutes: 45,
      uses: []
    },
    {
      id: 'eye_strain_5',
      text: 'Screen time can be tiring for your eyes. Maybe stretch a bit too? 🧘‍♂️',
      tone: 'gentle',
      minWatchMinutes: 60,
      uses: []
    },
    {
      id: 'eye_strain_6',
      text: 'Let\'s keep those peepers healthy! Look away from the screen for just a moment. 👀',
      tone: 'gentle',
      minWatchMinutes: 25,
      uses: []
    }
  ],
  [MESSAGE_CATEGORIES.BREAK]: [
    {
      id: 'break_1',
      text: 'You\'ve been watching for {watchTime} total today. Maybe time for a little stretch? 🚶',
      tone: 'gentle',
      minWatchMinutes: 45,
      uses: ['watchTime']
    },
    {
      id: 'break_2',
      text: 'That\'s {continueCount} reminders you\'ve skipped today! Come on, take a quick break. ⏳',
      tone: 'firm',
      minWatchMinutes: 60,
      uses: ['continueCount']
    },
    {
      id: 'break_3',
      text: 'Happy {dayOfWeek}! Make sure you\'re not spending the whole day on YouTube. 🗓️',
      tone: 'gentle',
      minWatchMinutes: 60,
      uses: ['dayOfWeek']
    },
    {
      id: 'break_4',
      text: 'You\'ve already taken {breakCount} breaks today, which is great! Ready for another? 🌟',
      tone: 'gentle',
      minWatchMinutes: 30,
      uses: ['breakCount']
    },
    {
      id: 'break_5',
      text: 'Your time is valuable! You\'ve effectively spent ₹{moneyWasted} worth of time here today. 💸',
      tone: 'firm',
      minWatchMinutes: 90,
      uses: ['moneyWasted']
    },
    {
      id: 'break_6',
      text: 'I know "{videoTitle}" is interesting, but you really should take a pause. 🛑',
      tone: 'firm',
      minWatchMinutes: 45,
      uses: ['videoTitle']
    }
  ],
  [MESSAGE_CATEGORIES.STOP_WATCHING]: [
    {
      id: 'stop_watching_1',
      text: 'Okay, seriously now. You\'ve been on YouTube for {watchTime}. You need to stop. 🛑',
      tone: 'stern',
      minWatchMinutes: 120,
      uses: ['watchTime']
    },
    {
      id: 'stop_watching_2',
      text: 'You\'ve dismissed me {continueCount} times. It\'s time to close the tab. Now. ⚠️',
      tone: 'stern',
      minWatchMinutes: 60,
      uses: ['continueCount']
    },
    {
      id: 'stop_watching_3',
      text: 'That\'s ₹{moneyWasted} worth of time gone! Is it really worth it? Stop watching. 💸',
      tone: 'stern',
      minWatchMinutes: 120,
      uses: ['moneyWasted']
    },
    {
      id: 'stop_watching_4',
      text: 'I care about your productivity, and this isn\'t helping. Please take a real break. 🚫',
      tone: 'firm',
      minWatchMinutes: 90,
      uses: []
    },
    {
      id: 'stop_watching_5',
      text: 'Enough is enough. Close YouTube and go do something else! 🏃‍♂️',
      tone: 'stern',
      minWatchMinutes: 150,
      uses: []
    },
    {
      id: 'stop_watching_6',
      text: 'Your future self will thank you if you stop watching right now. 🕰️',
      tone: 'firm',
      minWatchMinutes: 60,
      uses: []
    }
  ],
  [MESSAGE_CATEGORIES.LATE_NIGHT]: [
    {
      id: 'late_night_1',
      text: 'It\'s getting late! {currentTime} is past your bedtime, isn\'t it? 🌙',
      tone: 'gentle',
      minWatchMinutes: 0,
      uses: ['currentTime']
    },
    {
      id: 'late_night_2',
      text: 'Watching videos at {currentTime}? You need your sleep! 😴',
      tone: 'firm',
      minWatchMinutes: 0,
      uses: ['currentTime']
    },
    {
      id: 'late_night_3',
      text: 'Blue light ruins your sleep quality. Time to turn it off! 📵',
      tone: 'firm',
      minWatchMinutes: 15,
      uses: []
    },
    {
      id: 'late_night_4',
      text: 'You\'ve been watching for {watchTime} and it\'s the middle of the night. Sleep! 🛏️',
      tone: 'stern',
      minWatchMinutes: 30,
      uses: ['watchTime']
    },
    {
      id: 'late_night_5',
      text: 'The night is for dreaming, not for YouTube. Go to sleep! 🌠',
      tone: 'gentle',
      minWatchMinutes: 0,
      uses: []
    },
    {
      id: 'late_night_6',
      text: 'Don\'t ruin your tomorrow by staying up too late tonight. 🌅',
      tone: 'firm',
      minWatchMinutes: 20,
      uses: []
    }
  ]
};

/**
 * Converts milliseconds to human string
 * @param {number} ms 
 * @returns {string}
 */
export function formatWatchTime(ms) {
  if (typeof ms !== 'number' || isNaN(ms)) return '0 minutes';
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Returns morning/afternoon/evening/night based on current hour
 * @returns {string}
 */
export function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Returns formatted time like "11:42 PM"
 * @returns {string}
 */
export function formatCurrentTime() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Returns full day name
 * @returns {string}
 */
export function getDayOfWeek() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Returns the escalation level based on continue count
 * @param {number} continueCount 
 * @returns {string}
 */
export function getEscalationLevel(continueCount) {
  if (continueCount <= 1) return 'gentle';
  if (continueCount <= 3) return 'moderate';
  if (continueCount <= 5) return 'firm';
  return 'stern';
}

/**
 * Replaces all {variable} placeholders in template with values from context
 * @param {string} template 
 * @param {Object} context 
 * @returns {string}
 */
export function fillTemplate(template, context) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return context[key] !== undefined ? context[key] : match;
  });
}

/**
 * Builds the context object with formatted values for templates
 * @param {Object} data 
 * @returns {Object}
 */
export function buildContext(data) {
  const sessionDurationMs = data.sessionStartTime ? (Date.now() - data.sessionStartTime) : 0;
  
  return {
    watchTime: formatWatchTime(data.totalWatchTimeToday || 0),
    sessionTime: formatWatchTime(sessionDurationMs),
    timeOfDay: getTimeOfDay(),
    currentTime: formatCurrentTime(),
    continueCount: data.continueCountToday || 0,
    breakCount: data.breaksTakenToday || 0,
    moneyWasted: data.moneyWasted || 0,
    dayOfWeek: getDayOfWeek(),
    videoTitle: data.videoTitle ? (data.videoTitle.length > 30 ? data.videoTitle.substring(0, 27) + '...' : data.videoTitle) : 'this video',
    // Raw values for scoring logic
    _rawWatchTimeMs: data.totalWatchTimeToday || 0,
    _rawContinueCount: data.continueCountToday || 0,
    _rawMoneyWasted: data.moneyWasted || 0
  };
}

/**
 * Selects the best message based on category, context, and recent history
 * @param {string} category 
 * @param {Object} context 
 * @param {Array<string>} recentIds 
 * @returns {Object}
 */
export function selectMessage(category, context, recentIds = []) {
  const pool = MESSAGE_POOLS[category] || [];
  const watchMinutes = Math.floor(context._rawWatchTimeMs / 60000);
  
  // 1. Filter by category, minWatchMinutes, and exclude recentIds
  const eligibleMessages = pool.filter(msg => {
    if (recentIds.includes(msg.id)) return false;
    if (msg.minWatchMinutes > watchMinutes) return false;
    // Specific logic for STOP_WATCHING
    if (category === MESSAGE_CATEGORIES.STOP_WATCHING && msg.uses.includes('continueCount') && context._rawContinueCount < 2) {
      return false;
    }
    return true;
  });

  if (eligibleMessages.length === 0) {
    // Fallback if filtering is too strict
    return {
      id: 'fallback',
      text: 'Remember to take a break!',
      tone: 'gentle',
      category
    };
  }

  // 2. Score messages
  const scoredMessages = eligibleMessages.map(msg => {
    let score = 0;
    
    msg.uses.forEach(use => {
      if (use === 'continueCount' && context._rawContinueCount > 0) {
        score += 3;
      } else if (use === 'moneyWasted' && context._rawMoneyWasted > 0) {
        score += 2;
      } else if (use === 'watchTime' && watchMinutes > 15) {
        score += 2;
      } else {
        score += 1;
      }
    });

    return { ...msg, score };
  });

  // 3. Sort by score descending
  scoredMessages.sort((a, b) => b.score - a.score);

  // 4. Take top 3
  const top3 = scoredMessages.slice(0, 3);

  // 5. Pick one randomly
  const selected = top3[Math.floor(Math.random() * top3.length)];

  // 6. Fill template
  const filledText = fillTemplate(selected.text, context);

  return {
    id: selected.id,
    text: filledText,
    tone: selected.tone,
    category
  };
}
