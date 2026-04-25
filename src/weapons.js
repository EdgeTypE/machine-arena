// Weapon class definitions
export const WEAPON_STATS = {
  lmg: {
    name: 'LMG',
    baseHealth: 75,
    damage: 8,
    fireRate: 80,        // ms between shots
    magSize: 80,
    reloadTime: 2500,    // ms
    range: 40,
    spread: 0.06,
    bulletsPerShot: 1,
    recoil: 0.01,
    moveSpeed: 6.875,    // 1.25x base (5.5)
  },
  rifle: {
    name: 'RIFLE',
    baseHealth: 100,
    damage: 25,
    fireRate: 250,
    magSize: 20,
    reloadTime: 1800,
    range: 80,
    spread: 0.02,
    bulletsPerShot: 1,
    recoil: 0.03,
    moveSpeed: 5.5,      // 1x base
  },
  shotgun: {
    name: 'SHOTGUN',
    baseHealth: 125,
    damage: 18,
    fireRate: 600,
    magSize: 6,
    reloadTime: 2000,
    range: 22,
    spread: 0.22,        // wide scatter pattern
    bulletsPerShot: 8,   // more pellets for better coverage
    recoil: 0.08,
    moveSpeed: 4.125,    // 0.75x base (5.5)
  }
};

export class Weapon {
  constructor(type) {
    const stats = WEAPON_STATS[type];
    this.type = type;
    this.name = stats.name;
    this.baseHealth = stats.baseHealth;
    this.baseDamage = stats.damage;
    this.damage = stats.damage;
    this.fireRate = stats.fireRate;
    this.magSize = stats.magSize;
    this.currentAmmo = stats.magSize;
    this.reloadTime = stats.reloadTime;
    this.range = stats.range;
    this.spread = stats.spread;
    this.bulletsPerShot = stats.bulletsPerShot;
    this.recoil = stats.recoil;
    this.moveSpeed = stats.moveSpeed;

    this.isReloading = false;
    this.lastFireTime = 0;
    this.reloadStartTime = 0;
    this.justStartedReload = false;

    // Upgrade multipliers
    this.damageMultiplier = 1;
    this.fireRateMultiplier = 1;
    this.magSizeMultiplier = 1;
  }

  canFire(now, externalFireRateMultiplier = 1) {
    if (this.isReloading) return false;
    if (this.currentAmmo <= 0) return false;
    const totalMult = Math.max(0.1, this.fireRateMultiplier * Math.max(0.1, externalFireRateMultiplier));
    return (now - this.lastFireTime) >= (this.fireRate / totalMult);
  }

  fire(now) {
    this.lastFireTime = now;
    this.currentAmmo--;
    if (this.currentAmmo <= 0) {
      this.startReload(now);
    }
  }

  startReload(now) {
    if (this.isReloading) return;
    if (this.currentAmmo >= Math.floor(this.magSize * this.magSizeMultiplier)) return;
    this.isReloading = true;
    this.reloadStartTime = now;
    this.justStartedReload = true;
  }

  updateReload(now) {
    if (!this.isReloading) return;
    if (now - this.reloadStartTime >= this.reloadTime) {
      this.currentAmmo = Math.floor(this.magSize * this.magSizeMultiplier);
      this.isReloading = false;
    }
  }

  getDamage() {
    return this.baseDamage * this.damageMultiplier;
  }

  getMaxAmmo() {
    return Math.floor(this.magSize * this.magSizeMultiplier);
  }
}
