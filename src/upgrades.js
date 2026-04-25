// Upgrade card definitions
import { getIconImage } from './iconMap.js';

const UPGRADES = [
  {
    id: 'damage_up',
    name: 'OVERDRIVE',
    icon: '⚡',
    description: 'Increase weapon damage by 25%',
    apply: (player) => { player.weapon.damageMultiplier += 0.25; }
  },
  {
    id: 'fire_rate_up',
    name: 'OVERCLOCK',
    icon: '⚙',
    description: 'Increase fire rate by 20%',
    apply: (player) => { player.weapon.fireRateMultiplier += 0.20; }
  },
  {
    id: 'mag_size_up',
    name: 'EXPANDED MAG',
    icon: '📦',
    description: 'Increase magazine size by 30%',
    apply: (player) => {
      player.weapon.magSizeMultiplier += 0.30;
      player.weapon.currentAmmo = player.weapon.getMaxAmmo();
    }
  },
  {
    id: 'health_up',
    name: 'ARMOR PLATE',
    icon: '🛡',
    description: 'Increase max HP by 25',
    apply: (player) => {
      player.maxHealth += 25;
      player.health = Math.min(player.health + 25, player.maxHealth);
    }
  },
  {
    id: 'heal',
    name: 'REPAIR KIT',
    icon: '💚',
    description: 'Restore 50% of max HP',
    apply: (player) => {
      player.health = Math.min(player.health + player.maxHealth * 0.5, player.maxHealth);
    }
  },
  {
    id: 'speed_up',
    name: 'TURBO BOOST',
    icon: '🏃',
    description: 'Increase movement speed by 15%',
    apply: (player) => { player.weapon.moveSpeed *= 1.15; }
  },
  {
    id: 'spread_down',
    name: 'PRECISION',
    icon: '🎯',
    description: 'Reduce weapon spread by 30%',
    apply: (player) => { player.weapon.spread *= 0.7; }
  },
  {
    id: 'reload_speed',
    name: 'QUICK LOAD',
    icon: '⏱',
    description: 'Reduce reload time by 25%',
    apply: (player) => { player.weapon.reloadTime *= 0.75; }
  },
  {
    id: 'extra_bullet',
    name: 'MULTI-SHOT',
    icon: '🔥',
    description: 'Fire +1 extra bullet per shot',
    apply: (player) => { player.weapon.bulletsPerShot += 1; }
  },
  {
    id: 'jump',
    name: 'JUMP JETS',
    icon: '🦘',
    description: 'Unlock jump ability (Space key)',
    requires: (player) => !player.canJump,
    apply: (player) => { player.canJump = true; }
  },
  {
    id: 'double_jump',
    name: 'DOUBLE JUMP',
    icon: '🚀',
    description: 'Unlock double jump (Space x2 in air)',
    requires: (player) => player.canJump && !player.canDoubleJump,
    apply: (player) => { player.canDoubleJump = true; }
  },
  {
    id: 'sprint',
    name: 'SPRINT BOOTS',
    icon: '👟',
    description: 'Unlock sprint (Shift key, 1.6x speed)',
    requires: (player) => !player.canSprint,
    apply: (player) => { player.canSprint = true; }
  },
  {
    id: 'nano_repair',
    name: 'NANO REPAIR',
    icon: '💉',
    description: 'Regenerate 3 HP per second',
    apply: (player) => { player.regenRate = (player.regenRate || 0) + 3; }
  },
  {
    id: 'nova_grenade',
    name: 'NOVA GRENADE',
    icon: '💥',
    description: 'Gain 3 grenades (G key). Massive AOE.',
    apply: (player) => { player.grenadeCount = (player.grenadeCount || 0) + 3; }
  },
  {
    id: 'ability_dash',
    name: 'DASH MODULE',
    icon: '💨',
    description: 'Equip RMB: Dash forward (5s CD)',
    requires: (player) => player.rightClickAbility !== 'dash',
    apply: (player) => { player.rightClickAbility = 'dash'; player.abilityCooldownEnd = 0; }
  },
  {
    id: 'ability_shield',
    name: 'BARRIER WALL',
    icon: '🛡',
    description: 'Equip RMB: Deploy barrier (10s CD)',
    requires: (player) => player.rightClickAbility !== 'shield',
    apply: (player) => { player.rightClickAbility = 'shield'; player.abilityCooldownEnd = 0; }
  },
  {
    id: 'ability_invincible',
    name: 'PHASE SHIFT',
    icon: '⚡',
    description: 'Equip RMB: 3s invincibility (30s CD)',
    requires: (player) => player.rightClickAbility !== 'invincible',
    apply: (player) => { player.rightClickAbility = 'invincible'; player.abilityCooldownEnd = 0; }
  },
  {
    id: 'ability_grapple',
    name: 'GRAPPLE HOOK',
    icon: '🪝',
    description: 'Equip RMB: Hook onto surfaces and pull yourself (8s CD)',
    requires: (player) => player.rightClickAbility !== 'grapple',
    apply: (player) => { player.rightClickAbility = 'grapple'; player.abilityCooldownEnd = 0; }
  },
];

export function getRandomCards(count = 3, playerState = null) {
  const available = playerState
    ? UPGRADES.filter(u => !u.requires || u.requires(playerState))
    : UPGRADES;
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function showCardScreen(cards, onSelect, wave = 0) {
  document.body.style.cursor = ''; // Ensure cursor is visible
  const screen = document.getElementById('card-screen');
  const container = document.getElementById('card-container');
  const titleEl = document.getElementById('card-title');
  const subtitleEl = document.getElementById('card-subtitle');
  container.innerHTML = '';

  // Theme progression based on wave
  screen.className = '';
  if (wave >= 15) {
    screen.classList.add('theme-orange');
  } else if (wave >= 10) {
    screen.classList.add('theme-purple');
  } else if (wave >= 5) {
    screen.classList.add('theme-cyan');
  } // Else default (green)

  if (titleEl) {
    titleEl.textContent = wave >= 15
      ? 'FINAL PROTOCOL UPGRADES'
      : (wave >= 10 ? 'COMBAT CORE UPGRADES' : 'UPGRADE PROTOCOL');
  }
  if (subtitleEl) {
    subtitleEl.textContent = `WAVE ${wave} COMPLETE - SELECT ONE MODULE`;
  }

  cards.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'upgrade-card';
    cardEl.innerHTML = `
      <div class="upgrade-index">0${idx + 1}</div>
      <div class="icon">${getIconImage(card.icon)}</div>
      <h3>${card.name}</h3>
      <p>${card.description}</p>
    `;
    cardEl.addEventListener('click', () => {
      screen.style.display = 'none';
      onSelect(card);
    });
    container.appendChild(cardEl);
  });

  screen.style.display = 'flex';
}
