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

      <!-- Water cup & straw for drinking pose (hidden by default via CSS) -->
      <g class="mascot-drink-cup">
        <!-- Cup body -->
        <path class="mascot-cup-body" d="M 52 58 L 54 78 Q 54 82 58 82 L 68 82 Q 72 82 72 78 L 74 58 Z" fill="rgba(186, 230, 253, 0.85)" stroke="#38bdf8" stroke-width="1.5" />
        <!-- Water level inside cup -->
        <path class="mascot-cup-water" d="M 53.5 64 L 55 78 Q 55 81 58 81 L 68 81 Q 71 81 71 78 L 72.5 64 Z" fill="#0284c7" />
        <!-- Straw extending towards beak -->
        <path class="mascot-cup-straw" d="M 48 50 L 56 59 L 60 76" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" fill="none" />
        <!-- Water droplets / bubbles -->
        <circle class="mascot-water-drop" cx="47" cy="48" r="2" fill="#38bdf8" />
        <circle class="mascot-water-drop-2" cx="64" cy="46" r="1.5" fill="#38bdf8" />
      </g>

      <!-- Book for reading pose -->
      <g class="mascot-book">
        <path class="mascot-book-cover" d="M 34 72 Q 50 77 66 72 L 68 84 Q 50 89 32 84 Z" fill="#6366f1" />
        <path class="mascot-book-pages" d="M 35 71 Q 50 76 65 71 L 66 82 Q 50 87 34 82 Z" fill="#ffffff" />
        <line x1="50" y1="73" x2="50" y2="85" stroke="#a5b4fc" stroke-width="1.5" />
      </g>

      <!-- Sparkles for celebrating pose -->
      <g class="mascot-party-sparkles">
        <polygon points="20,25 22,29 26,30 22,31 20,35 18,31 14,30 18,29" fill="#facc15" />
        <polygon points="80,25 82,29 86,30 82,31 80,35 78,31 74,30 78,29" fill="#facc15" />
        <polygon points="50,12 51.5,15 55,16 51.5,17 50,20 48.5,17 45,16 48.5,15" fill="#ec4899" />
      </g>

      <!-- Zzz for sleeping pose -->
      <g class="mascot-sleep-zzz">
        <text x="74" y="32" font-family="-apple-system, sans-serif" font-weight="bold" font-size="11" fill="#818cf8">Z</text>
        <text x="82" y="24" font-family="-apple-system, sans-serif" font-weight="bold" font-size="9" fill="#a5b4fc">z</text>
        <text x="88" y="17" font-family="-apple-system, sans-serif" font-weight="bold" font-size="7" fill="#c7d2fe">z</text>
      </g>
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
  'worried',
  'sleepy',
  'sleeping',
  'waving',
  'drinking',
  'celebrating',
  'reading'
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
