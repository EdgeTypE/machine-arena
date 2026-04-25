// ============================================================
// MOTHERBOARD FRAGMENTS — Passive Ability Items
// Quake/Doom style: rare drops from enemy deaths,
// animated world pickups, run-level passive effects.
// ============================================================
import * as THREE from 'three';

// ─── Definitions ──────────────────────────────────────────────
export const FRAGMENT_DEFS = [
  {
    id: 'byte_garlic',
    name: 'BYTE WARD',
    icon: '○',
    color: 0x0088ff,
    colorHex: '#0088ff',
    description: 'Enemies within 6u take 8 dmg/s',
    detail: 'Passive aura ring. Enemies stepping inside the 6-unit radius take continuous damage.',
    unlockWave: 2,
  },
  {
    id: 'spear_protocol',
    name: 'SPEAR PROTOCOL',
    icon: '↑',
    color: 0x00ff88,
    colorHex: '#00ff88',
    description: 'Every 5s: fires a spear at random enemy',
    detail: 'Automatically launches a spear at a random enemy every 5 seconds.',
    unlockWave: 3,
  },
  {
    id: 'obus',
    name: 'HOWITZER',
    icon: '◉',
    color: 0xff6600,
    colorHex: '#ff6600',
    description: 'Every 15s: fires a rocket at random enemy',
    detail: 'Fires a high-damage area rocket at a random enemy every 15 seconds.',
    unlockWave: 4,
  },
  {
    id: 'trojan',
    name: 'TROJAN',
    icon: '⌛',
    color: 0xaa00ff,
    colorHex: '#aa00ff',
    description: 'Every 3s: slows nearest enemy (≤15u) for 3s',
    detail: 'Infects the nearest enemy within 15 units. Reduces movement speed by 60% for 3 seconds.',
    unlockWave: 5,
  },
  {
    id: 'doom_streak',
    name: 'DOOM',
    icon: '▲',
    color: 0xff2200,
    colorHex: '#ff2200',
    description: 'Hit chain +10% dmg each. Miss = reset',
    detail: 'Each consecutive hit multiplies damage by 1.1×. Missing a shot resets the multiplier.',
    unlockWave: 7,
  },
  {
    id: 'shell',
    name: 'SHELL',
    icon: '◈',
    color: 0xffcc00,
    colorHex: '#ffcc00',
    description: '10s no damage → shield (5 hits / 250 dmg)',
    detail: 'After 10 seconds without taking damage, a shell shield forms. Absorbs 5 hits or 250 damage total.',
    unlockWave: 9,
  },
  {
    id: 'overclock',
    name: 'OVERCLOCK',
    icon: '⚡',
    color: 0x66ccff,
    colorHex: '#66ccff',
    description: 'Shift: +100% move/fire/bullet speed, +100% incoming dmg',
    detail: 'Replaces Sprint. While active, doubles movement and fire speed, but all incoming damage is doubled.',
    unlockWave: 11,
  },
  {
    id: 'death_warrant',
    name: 'MEMENTO MORI',
    icon: '☠',
    color: 0x66ff66,
    colorHex: '#66ff66',
    description: '≤25% HP: 8s +30% resist, +20% speed, kills heal 5%',
    detail: 'When health drops below 25%, gain panic-state bonuses for 8 seconds. Each kill heals 5% max HP. 45s cooldown.',
    unlockWave: 12,
  },
  {
    id: 'glass_cannon',
    name: 'GLASS CANNON',
    icon: '⚔',
    color: 0xff00ff,
    colorHex: '#ff00ff',
    description: 'Damage x2, HP /2',
    detail: 'Doubles your outgoing damage, but your maximum and current health are halved.',
    unlockWave: 15,
  },
  {
    id: 'blood_link',
    name: 'BLOOD LINK',
    icon: '∞',
    color: 0xff0033,
    colorHex: '#ff0033',
    description: 'Infinite ammo. Misses drain 1.5 HP.',
    detail: 'Synchronizes your weapon with your bio-rhythm. Bypasses magazine requirements, but every bullet that misses an enemy drains 1.5 health from you.',
    unlockWave: 8,
  },
];

// ─── Runtime ──────────────────────────────────────────────────
export class FragmentRuntime {
  constructor(fragmentId, scene) {
    this.id   = fragmentId || null;
    this.scene = scene;
    this.active = !!fragmentId;

    // Cooldown timer shared by spear / obus / trojan
    this.timer = 0;

    // Flying projectiles: { mesh, dir, speed, damage, traveled, maxRange, aoe, type }
    this.projectiles = [];

    // Byte Zarısı — garlic aura rings
    this.garlicRing      = null;
    this.garlicRingInner = null;

    // Doom streak
    this.streak    = 0;
    this.streakMult = 1.0;

    // Kabuk (Shell)
    this.noHitTimer       = 0;
    this.shieldActive     = false;
    this.shieldHitsLeft   = 0;
    this.shieldDamageLeft = 0;
    this.shieldMesh       = null;
    this.shieldMeshInner  = null;

    // Overclock
    this.overclockActive = false;

    // Death Warrant (Memento Mori)
    this.deathWarrantActive = false;
    this.deathWarrantUntil = 0;
    this.deathWarrantCooldownUntil = 0;

    if (fragmentId === 'byte_garlic') this._buildGarlicRing();
    if (fragmentId) this._showActiveHUD(fragmentId);
  }

  // ── Garlic ring visual ───────────────────────────────────────
  _buildGarlicRing() {
    const mat1 = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.3 });
    const geo1 = new THREE.TorusGeometry(6, 0.13, 6, 48);
    this.garlicRing = new THREE.Mesh(geo1, mat1);
    this.garlicRing.rotation.x = Math.PI / 2;
    this.garlicRing.position.y = 0.13;
    this.scene.add(this.garlicRing);

    const mat2 = new THREE.MeshBasicMaterial({ color: 0x0055aa, transparent: true, opacity: 0.18 });
    const geo2 = new THREE.TorusGeometry(5.4, 0.07, 6, 36);
    this.garlicRingInner = new THREE.Mesh(geo2, mat2);
    this.garlicRingInner.rotation.x = Math.PI / 2;
    this.garlicRingInner.rotation.z = 0.4;
    this.garlicRingInner.position.y = 0.13;
    this.scene.add(this.garlicRingInner);
  }

  // ── Main update ─────────────────────────────────────────────
  // Called every frame from main.js game loop.
  // emitParticleFn: (pos, color, count) => void
  // dealDamageFn:   (enemy, amount)     => void  (handles death internally)
  update(delta, camera, enemies, state, emitParticleFn, dealDamageFn) {
    if (!this.active) return;

    const alive = enemies.filter(e => e.alive);

    switch (this.id) {
      case 'byte_garlic':    this._updateGarlic(delta, camera, alive, emitParticleFn, dealDamageFn); break;
      case 'spear_protocol': this._updateSpear(delta, camera, alive);  break;
      case 'obus':           this._updateObus(delta, camera, alive);   break;
      case 'trojan':         this._updateTrojan(delta, camera, alive); break;
      case 'shell':          this._updateShell(delta, camera);         break;
      case 'death_warrant':  this._updateDeathWarrant(state);          break;
      // doom_streak: driven entirely by onHit() / onMiss() hooks
    }

    this._tickProjectiles(delta, alive, emitParticleFn, dealDamageFn);
  }

  // ── Byte Zarısı ─────────────────────────────────────────────
  _updateGarlic(delta, camera, alive, emitParticleFn, dealDamageFn) {
    const cx = camera.position.x, cz = camera.position.z;
    const now = performance.now();

    if (this.garlicRing) {
      this.garlicRing.position.x = cx;
      this.garlicRing.position.z = cz;
      this.garlicRing.material.opacity = 0.15 + Math.sin(now * 0.003) * 0.12;
      this.garlicRing.rotation.z += delta * 0.28;
    }
    if (this.garlicRingInner) {
      this.garlicRingInner.position.x = cx;
      this.garlicRingInner.position.z = cz;
      this.garlicRingInner.rotation.z -= delta * 0.45;
    }

    const dmgPerSec = 8;
    for (const e of alive) {
      const dx = e.mesh.position.x - cx, dz = e.mesh.position.z - cz;
      if (dx * dx + dz * dz <= 36) {
        dealDamageFn(e, dmgPerSec * delta);
        if (emitParticleFn && Math.random() < 0.04) {
          emitParticleFn(e.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 0x0066ff, 1);
        }
      }
    }
  }

  // ── Mızrak Protokolü ────────────────────────────────────────
  _updateSpear(delta, camera, alive) {
    this.timer += delta;
    if (this.timer >= 5.0 && alive.length > 0) {
      this.timer = 0;
      const target = alive[Math.floor(Math.random() * alive.length)];
      const origin = camera.position.clone();
      origin.y += 0.7;
      const tPos = target.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
      const dir  = new THREE.Vector3().subVectors(tPos, origin).normalize();

      const geo  = new THREE.BoxGeometry(0.07, 0.07, 1.5);
      const mat  = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);
      mesh.lookAt(origin.clone().add(dir));
      this.scene.add(mesh);

      this.projectiles.push({ mesh, dir, speed: 32, damage: 45, traveled: 0, maxRange: 80, aoe: 0, type: 'spear' });
    }
  }

  // ── Obüs ────────────────────────────────────────────────────
  _updateObus(delta, camera, alive) {
    this.timer += delta;
    if (this.timer >= 15.0 && alive.length > 0) {
      this.timer = 0;
      const target = alive[Math.floor(Math.random() * alive.length)];
      const origin = camera.position.clone();
      origin.y += 1.0;
      const tPos = target.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
      const dir  = new THREE.Vector3().subVectors(tPos, origin).normalize();

      const geo  = new THREE.CylinderGeometry(0.09, 0.13, 0.65, 7);
      const mat  = new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);

      // Align cylinder long-axis to the direction vector
      const up   = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      mesh.applyQuaternion(quat);
      this.scene.add(mesh);

      this.projectiles.push({ mesh, dir, speed: 26, damage: 200, traveled: 0, maxRange: 100, aoe: 4.5, type: 'obus' });
      this._playThump();
    }
  }

  _playThump() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(85, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(); osc.stop(ctx.currentTime + 0.28);
    } catch (_e) { /* AudioContext not available */ }
  }

  // ── Trojan ──────────────────────────────────────────────────
  _updateTrojan(delta, camera, alive) {
    // Tick all active slow timers
    for (const e of alive) {
      if (e.slowTimer > 0) {
        e.slowTimer -= delta;
        if (e.slowTimer <= 0) {
          e.slowTimer = 0;
          if (e._origSpeed !== undefined) { e.speed = e._origSpeed; e._origSpeed = undefined; }
          if (e._slowColorSaved) {
            e.mesh.traverse(child => {
              if (child.isMesh && child.material?.color && child._origColor !== undefined) {
                child.material.color.setHex(child._origColor);
                child._origColor = undefined;
              }
            });
            e._slowColorSaved = false;
          }
        }
      }
    }

    this.timer += delta;
    if (this.timer >= 3.0 && alive.length > 0) {
      this.timer = 0;
      // Find nearest enemy that is not already slowed
      let nearest = null, nearestDist = Infinity;
      for (const e of alive) {
        if (e.slowTimer > 0) continue;
        const d = e.mesh.position.distanceTo(camera.position);
        if (d > 15) continue; // only affect enemies within 15 units
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }
      if (nearest) {
        nearest._origSpeed = nearest.speed;
        nearest.speed      = nearest.speed * 0.4;
        nearest.slowTimer  = 3.0;
        // Purple tint
        nearest._slowColorSaved = true;
        nearest.mesh.traverse(child => {
          if (child.isMesh && child.material?.color) {
            child._origColor = child.material.color.getHex();
            child.material.color.setHex(0x9900cc);
          }
        });
      }
    }
  }

  // ── Kabuk (Shell) ───────────────────────────────────────────
  _updateShell(delta, camera) {
    if (!this.shieldActive) {
      this.noHitTimer += delta;
      if (this.noHitTimer >= 10.0) this._activateShell(camera);
    } else {
      const now = performance.now();
      // Orbital rings follow player at ground level — never inside camera FOV
      const base = camera.position.clone();
      base.y -= 1.55; // ground-ish level, well below eye

      if (this.shellRings) {
        this.shellRings.forEach((ring, i) => {
          ring.position.copy(base);
          const speed = 0.6 + i * 0.35;
          ring.rotation.y += delta * speed * (i % 2 === 0 ? 1 : -1);
          // Gentle pulse on opacity
          ring.material.opacity = 0.45 + Math.sin(now * 0.002 + i * 1.2) * 0.2;
        });
      }
      if (this.shellNodes) {
        this.shellNodes.forEach((node, i) => {
          const angle = (i / this.shellNodes.length) * Math.PI * 2 + now * 0.0008;
          const r = 1.35;
          node.position.set(
            base.x + Math.cos(angle) * r,
            base.y + Math.sin(now * 0.0015 + i) * 0.18,
            base.z + Math.sin(angle) * r
          );
          node.material.opacity = 0.6 + Math.sin(now * 0.003 + i * 0.9) * 0.35;
        });
      }
    }
  }

  _activateShell(camera) {
    this.shieldActive     = true;
    this.shieldHitsLeft   = 5;
    this.shieldDamageLeft = 250;
    this.noHitTimer       = 0;

    const base = camera.position.clone();
    base.y -= 1.55;

    // ── 3 orbital rings at different tilt angles ──
    this.shellRings = [];
    const ringAngles = [
      { rx: 0,          rz: 0 },           // horizontal
      { rx: Math.PI/3,  rz: 0 },           // tilted 60°
      { rx: Math.PI/6,  rz: Math.PI/3 },   // oblique
    ];
    ringAngles.forEach(({ rx, rz }) => {
      const geo = new THREE.TorusGeometry(1.35, 0.022, 6, 64);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffcc00, transparent: true, opacity: 0.55,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = rx;
      ring.rotation.z = rz;
      ring.position.copy(base);
      this.scene.add(ring);
      this.shellRings.push(ring);
    });

    // ── 6 small glowing node spheres orbiting at ground level ──
    this.shellNodes = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const r = 1.35;
      const geo = new THREE.SphereGeometry(0.055, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe566, transparent: true, opacity: 0.9,
        depthWrite: false,
      });
      const node = new THREE.Mesh(geo, mat);
      node.position.set(
        base.x + Math.cos(angle) * r,
        base.y,
        base.z + Math.sin(angle) * r
      );
      this.scene.add(node);
      this.shellNodes.push(node);
    }

    // Keep legacy refs null so old removal code is safe
    this.shieldMesh      = null;
    this.shieldMeshInner = null;

    this._hudMsg('◈ SHELL ACTIVE', '#ffcc00');
  }

  _deactivateShell() {
    this.shieldActive = false;
    this.noHitTimer   = 0;

    // Remove orbital rings
    if (this.shellRings) {
      this.shellRings.forEach(r => {
        this.scene.remove(r);
        r.geometry.dispose();
        r.material.dispose();
      });
      this.shellRings = null;
    }
    // Remove orbital nodes
    if (this.shellNodes) {
      this.shellNodes.forEach(n => {
        this.scene.remove(n);
        n.geometry.dispose();
        n.material.dispose();
      });
      this.shellNodes = null;
    }
    // Legacy safety
    if (this.shieldMesh) {
      this.scene.remove(this.shieldMesh);
      this.shieldMesh.geometry.dispose();
      this.shieldMesh.material.dispose();
      this.shieldMesh = null;
    }
    if (this.shieldMeshInner) {
      this.scene.remove(this.shieldMeshInner);
      this.shieldMeshInner.geometry.dispose();
      this.shieldMeshInner.material.dispose();
      this.shieldMeshInner = null;
    }
    this._hudMsg('◈ SHELL BROKEN', '#ff4400');
  }

  _triggerDeathWarrant(state) {
    const now = performance.now();
    if (this.deathWarrantActive || now < this.deathWarrantCooldownUntil) return;
    if (!state) return;
    if (state.health > state.maxHealth * 0.25) return;
    this.deathWarrantActive = true;
    this.deathWarrantUntil = now + 8000;
    this.deathWarrantCooldownUntil = now + 45000;
    this._hudMsg('☠ MEMENTO MORI ONLINE', '#66ff66');
  }

  _updateDeathWarrant(state) {
    const now = performance.now();
    if (this.deathWarrantActive && now >= this.deathWarrantUntil) {
      this.deathWarrantActive = false;
      this._hudMsg('☠ MEMENTO MORI OFFLINE', '#339933');
    }
    if (!this.deathWarrantActive) {
      this._triggerDeathWarrant(state);
    }
  }

  // ── Projectile Tick ─────────────────────────────────────────
  _tickProjectiles(delta, alive, emitParticleFn, dealDamageFn) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const step = p.speed * delta;
      p.mesh.position.addScaledVector(p.dir, step);
      p.traveled += step;
      p.mesh.rotation.z += delta * 12;

      let hit = false;
      for (const e of alive) {
        const dist      = p.mesh.position.distanceTo(e.mesh.position);
        const hitRadius = p.aoe > 0 ? p.aoe : 1.2;
        if (dist < hitRadius) {
          if (p.aoe > 0) {
            for (const ae of alive) {
              const ad = p.mesh.position.distanceTo(ae.mesh.position);
              if (ad < p.aoe) {
                const falloff = 1 - (ad / p.aoe) * 0.5;
                dealDamageFn(ae, p.damage * falloff);
              }
            }
            if (emitParticleFn) {
              emitParticleFn(p.mesh.position.clone(), 0xff4400, 14);
              emitParticleFn(p.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xff8800, 8);
            }
          } else {
            dealDamageFn(e, p.damage);
            if (emitParticleFn) emitParticleFn(p.mesh.position.clone(), 0x00ff88, 6);
          }
          hit = true;
          break;
        }
      }

      if (hit || p.traveled > p.maxRange) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ── Doom Streak Hooks ────────────────────────────────────────
  onHit() {
    if (this.id !== 'doom_streak') return;
    this.streak     = Math.min(this.streak + 1, 20);
    this.streakMult = Math.pow(1.1, this.streak);
    this._refreshStreakHUD();
  }

  onMiss() {
    if (this.id !== 'doom_streak' || this.streak === 0) return;
    this.streak     = 0;
    this.streakMult = 1.0;
    this._refreshStreakHUD();
  }

  getDamageMultiplier() {
    let mult = 1.0;
    if (this.id === 'doom_streak') mult *= this.streakMult;
    if (this.id === 'glass_cannon') mult *= 2.0;
    return mult;
  }

  getHealthMultiplier() {
    return this.id === 'glass_cannon' ? 0.5 : 1.0;
  }

  // ── Shell Damage Hook ────────────────────────────────────────
  // Returns the remaining damage after shell absorption.
  // Returns the original amount if no absorption applies.
  onDamageTaken(amount, state = null) {
    if (this.id === 'shell') {
      this.noHitTimer = 0; // any damage resets the 10 s timer
      if (this.shieldActive) {
        this.shieldHitsLeft--;
        this.shieldDamageLeft -= amount;
        if (this.shieldHitsLeft <= 0 || this.shieldDamageLeft <= 0) {
          this._deactivateShell();
          return 0;
        }
        this._hudMsg(
          `◈ SHELL: ${this.shieldHitsLeft} hits / ${Math.max(0, Math.ceil(this.shieldDamageLeft))} dmg`,
          '#ffcc00',
        );
        return 0; // fully absorbed
      }
    }
    if (this.id === 'overclock' && this.overclockActive) {
      return amount * 2;
    }
    if (this.id === 'death_warrant' && state) {
      this._triggerDeathWarrant(state);
    }
    return amount;
  }

  setOverclockActive(active) {
    this.overclockActive = this.id === 'overclock' ? !!active : false;
  }

  isOverclockActive() {
    return this.id === 'overclock' && this.overclockActive;
  }

  getFireRateMultiplier() {
    return this.isOverclockActive() ? 2.0 : 1.0;
  }

  getMoveSpeedMultiplier() {
    if (this.isOverclockActive()) return 2.0;
    if (this.id === 'death_warrant' && this.deathWarrantActive) return 1.2;
    return 1.0;
  }

  getDamageResistBonus() {
    return (this.id === 'death_warrant' && this.deathWarrantActive) ? 0.30 : 0;
  }

  onEnemyKill(state) {
    if (this.id !== 'death_warrant' || !this.deathWarrantActive || !state) return;
    const healAmount = state.maxHealth * 0.05;
    state.health = Math.min(state.maxHealth, state.health + healAmount);
  }

  // ── HUD Helpers ─────────────────────────────────────────────
  _refreshStreakHUD() {
    let el = document.getElementById('frag-streak-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'frag-streak-hud';
      el.style.cssText = [
        'position:fixed', 'bottom:100px', 'right:16px',
        'font-family:monospace', 'font-size:13px', 'font-weight:bold',
        'color:#ff2200', 'text-shadow:0 0 8px #ff0000',
        'pointer-events:none', 'user-select:none', 'transition:opacity .2s',
      ].join(';');
      document.body.appendChild(el);
    }
    if (this.streak > 0) {
      el.textContent = `▲ DOOM ×${this.streak}  [+${Math.round((this.streakMult - 1) * 100)}%]`;
      el.style.opacity = '1';
    } else {
      el.style.opacity = '0';
    }
  }

  _showActiveHUD(fragId) {
    const def = FRAGMENT_DEFS.find(f => f.id === fragId);
    if (!def) return;
    let el = document.getElementById('frag-active-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'frag-active-hud';
      el.style.cssText = [
        'position:fixed', 'bottom:130px', 'right:16px',
        'font-family:monospace', 'font-size:12px',
        'pointer-events:none', 'user-select:none',
      ].join(';');
      document.body.appendChild(el);
    }
    el.style.color = def.colorHex;
    el.innerHTML   = `${def.icon} ${def.name}`;
  }

  _hudMsg(text, color) {
    let el = document.getElementById('frag-msg-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'frag-msg-hud';
      el.style.cssText = [
        'position:fixed', 'top:45%', 'left:50%', 'transform:translate(-50%,-50%)',
        'font-family:monospace', 'font-size:16px', 'font-weight:bold',
        'pointer-events:none', 'user-select:none',
        'text-shadow:0 0 10px currentColor', 'opacity:0', 'transition:opacity .15s',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.color  = color;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 1800);
  }

  // ── Cleanup ──────────────────────────────────────────────────
  dispose() {
    if (this.garlicRing) {
      this.scene.remove(this.garlicRing);
      this.garlicRing.geometry.dispose();
      this.garlicRing.material.dispose();
      this.garlicRing = null;
    }
    if (this.garlicRingInner) {
      this.scene.remove(this.garlicRingInner);
      this.garlicRingInner.geometry.dispose();
      this.garlicRingInner.material.dispose();
      this.garlicRingInner = null;
    }
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.projectiles = [];
    if (this.shieldMesh) {
      this.scene.remove(this.shieldMesh);
      this.shieldMesh.geometry.dispose();
      this.shieldMesh.material.dispose();
      this.shieldMesh = null;
    }
    if (this.shieldMeshInner) {
      this.scene.remove(this.shieldMeshInner);
      this.shieldMeshInner.geometry.dispose();
      this.shieldMeshInner.material.dispose();
      this.shieldMeshInner = null;
    }
    // Restore any slowed enemies
    // (enemies array not accessible here; main.js restores on dispose)

    // Remove HUD elements
    ['frag-streak-hud', 'frag-active-hud', 'frag-msg-hud'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    this.active = false;
  }
}

// ─── World Drop Visual ────────────────────────────────────────
// Returns a pickup object: { group, ring1, ring2, fragId, pos, elapsed }
export function createFragmentPickup(fragDef, position, scene) {
  const color = fragDef.color;
  const group = new THREE.Group();
  group.position.copy(position);
  group.position.y = 0;

  // PCB board (dark green)
  const boardGeo = new THREE.BoxGeometry(0.44, 0.04, 0.44);
  const boardMat = new THREE.MeshLambertMaterial({ color: 0x003300 });
  const board    = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = 0.07;
  group.add(board);

  // Glowing circuit traces on the board surface
  const traceMat = new THREE.MeshBasicMaterial({ color });
  const traceOffsets = [-0.1, 0, 0.1];
  for (const zo of traceOffsets) {
    const tg = new THREE.BoxGeometry(0.34, 0.012, 0.022);
    const tm = new THREE.Mesh(tg, traceMat);
    tm.position.set(0, 0.085, zo);
    group.add(tm);
  }
  const tv = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.34), traceMat);
  tv.position.set(0, 0.085, 0);
  group.add(tv);

  // Outer horizontal spinning ring (Quake item ring)
  const ring1Geo = new THREE.TorusGeometry(0.56, 0.048, 7, 22);
  const ring1Mat = new THREE.MeshBasicMaterial({ color });
  const ring1    = new THREE.Mesh(ring1Geo, ring1Mat);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = 0.38;
  group.add(ring1);

  // Inner tilted counter-rotating ring (Doom item shimmer)
  const ring2Geo = new THREE.TorusGeometry(0.38, 0.032, 6, 16);
  const ring2Mat = new THREE.MeshBasicMaterial({ color });
  const ring2    = new THREE.Mesh(ring2Geo, ring2Mat);
  ring2.rotation.x = Math.PI / 4;
  ring2.position.y = 0.38;
  group.add(ring2);

  // Pulsing point light underneath
  const light = new THREE.PointLight(color, 2.2, 5.5);
  light.position.y = 0.65;
  group.add(light);

  scene.add(group);

  return { group, ring1, ring2, light, board, fragId: fragDef.id, pos: position.clone(), elapsed: 0 };
}
