/**
 * @fileoverview Defines the Guardie owl mascot SVG and related pose constants.
 */

/**
 * Generates the SVG string for the Guardie mascot character.
 * All pose elements are included in the SVG, with visibility/animation controlled via CSS.
 *
 * @returns {string} The raw SVG markup for the mascot character.
 */
export function getCharacterSVG() {
  return `
    <svg class="mascot-owl-svg" width="80" height="96" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
      <!-- Ear tufts -->
      <path class="mascot-ear-left" d="M 25 35 L 15 15 L 40 25 Z" fill="#E8971A" />
      <path class="mascot-ear-right" d="M 75 35 L 85 15 L 60 25 Z" fill="#E8971A" />
      
      <!-- Body -->
      <ellipse class="mascot-body" cx="50" cy="65" rx="40" ry="45" fill="#FFB347" />
      <ellipse class="mascot-belly" cx="50" cy="72" rx="28" ry="32" fill="#FFD699" />
      
      <!-- Wings (transform-origin for rotation) -->
      <path class="mascot-wing-left" d="M 15 55 Q 0 70 12 85 Q 20 70 25 60 Z" fill="#E8971A" style="transform-origin: 20px 60px" />
      <path class="mascot-wing-right" d="M 85 55 Q 100 70 88 85 Q 80 70 75 60 Z" fill="#E8971A" style="transform-origin: 80px 60px" />
      
      <!-- Feet -->
      <path class="mascot-foot-left" d="M 35 105 Q 35 115 25 115 Q 40 115 45 105 Z" fill="#E67E22" />
      <path class="mascot-foot-right" d="M 65 105 Q 65 115 75 115 Q 60 115 55 105 Z" fill="#E67E22" />
      
      <!-- Blush -->
      <circle class="mascot-blush" cx="28" cy="60" r="6" fill="#FFB6C1" opacity="0.5" />
      <circle class="mascot-blush" cx="72" cy="60" r="6" fill="#FFB6C1" opacity="0.5" />
      
      <!-- Eyes -->
      <g class="mascot-eye-left">
        <circle class="mascot-eye-bg" cx="35" cy="45" r="12" fill="#FFFFFF" />
        <circle class="mascot-pupil" cx="37" cy="45" r="5" fill="#2C3E50" />
        <circle class="mascot-eye-highlight" cx="35" cy="43" r="2" fill="#FFFFFF" />
      </g>
      
      <g class="mascot-eye-right">
        <circle class="mascot-eye-bg" cx="65" cy="45" r="12" fill="#FFFFFF" />
        <circle class="mascot-pupil" cx="63" cy="45" r="5" fill="#2C3E50" />
        <circle class="mascot-eye-highlight" cx="61" cy="43" r="2" fill="#FFFFFF" />
      </g>
      
      <!-- Eyebrows (for stern pose, hidden by default via CSS) -->
      <line class="mascot-brow-left" x1="22" y1="32" x2="40" y2="38" stroke="#2C3E50" stroke-width="2.5" stroke-linecap="round" />
      <line class="mascot-brow-right" x1="78" y1="32" x2="60" y2="38" stroke="#2C3E50" stroke-width="2.5" stroke-linecap="round" />
      
      <!-- Beak -->
      <path class="mascot-beak" d="M 45 52 L 55 52 L 50 62 Z" fill="#E67E22" />
    </svg>
  `;
}

/**
 * Array of available mascot poses.
 * @type {string[]}
 */
export const MASCOT_POSES = [
  'idle',
  'walking',
  'jumping',
  'sliding',
  'talking',
  'stern',
  'sleepy',
  'waving'
];

/**
 * Array of available entrance animation types.
 * @type {string[]}
 */
export const ENTRANCE_ANIMATIONS = [
  'walk',
  'slide',
  'jump',
  'pop'
];

/**
 * Returns a random entrance animation type.
 * @returns {string} The name of the entrance animation.
 */
export function getRandomEntrance() {
  const randomIndex = Math.floor(Math.random() * ENTRANCE_ANIMATIONS.length);
  return ENTRANCE_ANIMATIONS[randomIndex];
}
