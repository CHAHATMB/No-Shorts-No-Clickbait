/**
 * @fileoverview Defines PNG-based mascots and their frame animation logic.
 */

const getExtensionURL = (path) => {
  try {
    return (typeof browser !== 'undefined' ? browser : chrome).runtime.getURL(path);
  } catch (e) {
    return path;
  }
};

const WALK_FRAME_INTERVAL_MS = 60;

/**
 * Mascot Registry
 */
export const MASCOTS = {
  scout: {
    id: 'scout',
    name: 'Scout',
    idle: 'mascots/scout/front.png',
    walkFrames: [
      'mascots/scout/right1.png',
      'mascots/scout/right2.png',
      'mascots/scout/right3.png',
      'mascots/scout/right4.png',
      'mascots/scout/right5.png',
      'mascots/scout/right6.png',
      'mascots/scout/right7.png',
      'mascots/scout/right8.png',
    ],
    back: 'mascots/scout/back.png',
    walkFrameInterval: WALK_FRAME_INTERVAL_MS,
  },
};

export const DEFAULT_MASCOT_ID = 'scout';

// Holding the Image objects keeps decoded frames alive, preventing blank flashes when switching frames
const preloadedImages = new Map();
export function preloadMascotAssets(mascotId = DEFAULT_MASCOT_ID) {
  const mascot = MASCOTS[mascotId] || MASCOTS[DEFAULT_MASCOT_ID];
  const paths = [
    mascot.idle,
    mascot.back,
    ...(mascot.walkFrames || []),
  ];
  paths.forEach((path) => {
    const fullUrl = getExtensionURL(path);
    if (!preloadedImages.has(fullUrl)) {
      const img = new Image();
      img.src = fullUrl;
      preloadedImages.set(fullUrl, img);
    }
  });
}

/**
 * Creates the mascot character HTML img element with the idle pose.
 * @param {string} [mascotId]
 * @returns {HTMLImageElement}
 */
export function createCharacterElement(mascotId = DEFAULT_MASCOT_ID) {
  preloadMascotAssets(mascotId);
  const mascot = MASCOTS[mascotId] || MASCOTS[DEFAULT_MASCOT_ID];
  const img = document.createElement('img');
  img.className = 'fg-mascot-img';
  img.src = getExtensionURL(mascot.idle);
  img.alt = mascot.name;
  img.draggable = false;
  return img;
}

/**
 * Manages frame animation for walk cycle and pose changes.
 */
export class MascotAnimator {
  constructor(imgElement, mascotId = DEFAULT_MASCOT_ID) {
    this.img = imgElement;
    this.mascot = MASCOTS[mascotId] || MASCOTS[DEFAULT_MASCOT_ID];
    this.intervalId = null;
    this.currentFrameIndex = 0;
  }

  /**
   * Start cycling walk frames.
   * @param {'left'|'right'} [direction='left']
   */
  startWalk(direction = 'left') {
    this.stop();
    if (!this.img) return;

    if (direction === 'left') {
      this.img.classList.add('fg-mascot-facing-left');
    } else {
      this.img.classList.remove('fg-mascot-facing-left');
    }

    const walkFrames = this.mascot.walkFrames || [];
    if (walkFrames.length <= 1) {
      this.img.src = getExtensionURL(this.mascot.idle);
      return;
    }

    const frames = walkFrames.map((f) => getExtensionURL(f));
    this.currentFrameIndex = 0;
    this.img.src = frames[0];

    this.intervalId = setInterval(() => {
      this.currentFrameIndex = (this.currentFrameIndex + 1) % frames.length;
      if (this.img) {
        this.img.src = frames[this.currentFrameIndex];
      }
    }, this.mascot.walkFrameInterval || WALK_FRAME_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setIdle() {
    this.stop();
    if (this.img) {
      this.img.classList.remove('fg-mascot-facing-left');
      this.img.src = getExtensionURL(this.mascot.idle);
    }
  }

  setExit(direction = 'right') {
    this.stop();
    if (this.img) {
      if (this.mascot.back) {
        this.img.classList.remove('fg-mascot-facing-left');
        this.img.src = getExtensionURL(this.mascot.back);
      } else {
        if (direction === 'right') {
          this.img.classList.remove('fg-mascot-facing-left');
        } else {
          this.img.classList.add('fg-mascot-facing-left');
        }
        this.img.src = getExtensionURL(this.mascot.idle);
      }
    }
  }
}

/**
 * Fallback backward compatibility for legacy SVG callers.
 */
export function getCharacterSVG() {
  const mascot = MASCOTS[DEFAULT_MASCOT_ID];
  const url = getExtensionURL(mascot.idle);
  return `<img class="fg-mascot-img" src="${url}" alt="${mascot.name}" draggable="false" />`;
}

export const MASCOT_POSES = [
  'idle',
  'walking',
  'jumping',
  'sliding',
  'talking',
  'stern',
  'worried',
  'sleepy',
  'sleeping',
  'waving',
  'drinking',
  'celebrating',
  'reading',
];

export const ENTRANCE_ANIMATIONS = [
  'grand',
  'walk',
  'slide',
  'jump',
  'pop',
];

export function getRandomEntrance() {
  if (Math.random() < 0.6) return 'grand';
  const others = ENTRANCE_ANIMATIONS.filter((a) => a !== 'grand');
  return others[Math.floor(Math.random() * others.length)];
}
