// Icon mapping: emoji character -> PNG file path
// Retro Doom-style icons from generated PNG files
export const ICON_MAP = {
  // Upgrades
  '⚡': 'overdrive',
  '⚙': 'overclock',
  '📦': 'expanded-mag',
  '🛡': 'armor-plate',
  '💚': 'repair-kit',
  '🏃': 'turbo-boost',
  '🎯': 'precision',
  '⏱': 'quick-load',
  '🔥': 'multi-shot',
  '🦘': 'jump-jets',
  '🚀': 'double-jump',
  '👟': 'sprint-boots',
  '💉': 'nano-repair',
  '💥': 'nova-grenade',
  '💨': 'dash-module',
  '🪝': 'grapple-hook',
  
  // Meta Progression
  '🎲': 'scramble-chip',
  '🎯': 'select-chip',
  '🦘': 'jump-actuator',
  '👟': 'sprint-servo',
  '🛡': 'plating-upgrade',
  '⚙': 'salvage-matrix',
  '🏃': 'motor-overclock',
  '📦': 'drum-extension',
  '💥': 'ap-rounds',
  '🛡': 'shock-plate',
  '📦': 'shell-rack',
  '🔥': 'spread-bore',
  '⏱': 'rapid-jets',
  '💨': 'extended-thrust',
  '⏱': 'quick-deploy',
  '🛡': 'reinforced-wall',
  '⏱': 'phase-resonance',
  '⚡': 'time-dilation',
  '⏱': 'winch-motor',
  '🪝': 'armored-cable',
  
  // Shop
  '🛡': 'armor-module',
  '⚡': 'weapon-core',
  '💉': 'nano-repair-plus',
  '⚙': 'overclock-plus',
  '🧥': 'carbon-fiber',
  '📦': 'ammo-cache',
  '💚': 'field-repair',
  '🏃': 'servo-boost',
  
  // Fragments
  '○': 'byte-ward',
  '↑': 'spear-protocol',
  '◉': 'howitzer',
  '⌛': 'trojan',
  '▲': 'doom',
  '◈': 'shell',
  
  // Abilities
  '💨': 'dash',
  '🛡': 'shield',
  '⚡': 'invincible',
  '🪝': 'grapple',
};

export const ICON_PATH = './retro_icons/doom_style/';
export const ICON_EXT = '.png';

const _iconCache = {};

export function getIconImage(emoji) {
  const iconName = ICON_MAP[emoji];
  if (iconName) {
    return `<img src="${ICON_PATH}${iconName}${ICON_EXT}" alt="" class="retro-icon" />`;
  }
  return emoji;
}

export function getIconClass(emoji) {
  return ICON_MAP[emoji] ? 'has-retro-icon' : '';
}

export function drawIconOnCanvas(ctx, emoji, x, y, size = 16) {
  const iconName = ICON_MAP[emoji];
  if (!iconName) {
    ctx.font = `${size}px monospace`;
    ctx.fillText(emoji, x, y);
    return;
  }
  
  const key = iconName;
  if (!_iconCache[key]) {
    const img = new Image();
    img.src = ICON_PATH + iconName + ICON_EXT;
    _iconCache[key] = img;
  }
  
  const img = _iconCache[key];
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y - size, size, size);
  } else {
    ctx.font = `${size}px monospace`;
    ctx.fillText(emoji, x, y);
  }
}