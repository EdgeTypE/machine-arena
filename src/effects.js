import * as THREE from 'three';

// Create weapon view model (first person weapon)
export function createWeaponViewModel(type) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x666666, flatShading: true });
  const matDark = new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true });
  const matAccent = new THREE.MeshLambertMaterial({ color: 0x00ff44, flatShading: true });

  switch (type) {
    case 'lmg': {
      // Long barrel LMG
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), mat);
      body.position.z = -0.15;
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 6), matDark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.55);
      group.add(barrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), matDark);
      mag.position.set(0, -0.08, -0.1);
      group.add(mag);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), mat);
      grip.position.set(0, -0.06, 0.1);
      grip.rotation.x = 0.2;
      group.add(grip);
      // green light
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), matAccent);
      light.position.set(0, 0.05, -0.2);
      group.add(light);
      break;
    }
    case 'rifle': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.5), mat);
      body.position.z = -0.15;
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.4, 6), matDark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.5);
      group.add(barrel);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), matDark);
      scope.position.set(0, 0.06, -0.2);
      group.add(scope);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.04), matDark);
      mag.position.set(0, -0.07, -0.1);
      group.add(mag);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.035), mat);
      grip.position.set(0, -0.06, 0.1);
      grip.rotation.x = 0.2;
      group.add(grip);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.015), matAccent);
      light.position.set(0, 0.05, -0.15);
      group.add(light);
      break;
    }
    case 'shotgun': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), mat);
      body.position.z = -0.1;
      group.add(body);
      // Double barrel
      const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), matDark);
      barrel1.rotation.x = Math.PI / 2;
      barrel1.position.set(-0.02, 0.02, -0.4);
      group.add(barrel1);
      const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), matDark);
      barrel2.rotation.x = Math.PI / 2;
      barrel2.position.set(0.02, 0.02, -0.4);
      group.add(barrel2);
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.1), mat);
      pump.position.set(0, -0.02, -0.25);
      group.add(pump);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.04), mat);
      grip.position.set(0, -0.07, 0.08);
      grip.rotation.x = 0.3;
      group.add(grip);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), matAccent);
      light.position.set(0, 0.05, -0.15);
      group.add(light);
      break;
    }
  }

  return group;
}

// Muzzle flash effect
export function createMuzzleFlash() {
  const geo = new THREE.SphereGeometry(0.05, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
  const flash = new THREE.Mesh(geo, mat);
  flash.visible = false;
  return flash;
}

// Bullet trail
export class BulletTrail {
  constructor(scene) {
    this.scene = scene;
    this.trails = [];
  }

  addTrail(start, end, speedMultiplier = 1) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.6
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.trails.push({ line, time: performance.now(), lifeMs: 100 / Math.max(0.5, speedMultiplier) });
  }

  update() {
    const now = performance.now();
    this.trails = this.trails.filter(t => {
      if (now - t.time > t.lifeMs) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        return false;
      }
      t.line.material.opacity = 1 - (now - t.time) / t.lifeMs;
      return true;
    });
  }
}

// Hit effect particles
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  emit(position, color = 0xff4400, count = 5) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.TetrahedronGeometry(0.08, 0);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const particle = new THREE.Mesh(geo, mat);
      particle.position.copy(position);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 4,
        (Math.random() - 0.5) * 5
      );
      this.scene.add(particle);
      this.particles.push({ mesh: particle, velocity: vel, time: performance.now(), lifeMs: 500, gravity: true });
    }
  }

  emitDirected(position, velocity, color = 0xff4400, count = 1, lifeMs = 500, gravity = false) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.TetrahedronGeometry(0.05, 0); // slightly smaller
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const particle = new THREE.Mesh(geo, mat);
      particle.position.copy(position);
      this.scene.add(particle);
      const velSpread = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5));
      this.particles.push({ 
        mesh: particle, 
        velocity: velocity.clone().add(velSpread), 
        time: performance.now(),
        lifeMs,
        gravity
      });
    }
  }

  update(delta) {
    const now = performance.now();
    this.particles = this.particles.filter(p => {
      const age = now - p.time;
      if (age > p.lifeMs) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        return false;
      }
      if (p.gravity) {
        p.velocity.y -= 9.8 * delta;
      }
      p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
      p.mesh.material.opacity = 1 - age / p.lifeMs;
      p.mesh.rotation.x += delta * 5;
      p.mesh.rotation.z += delta * 3;
      return true;
    });
  }
}
// Melee arm view model (low-poly fist)
export function createMeleeViewModel() {
  const group = new THREE.Group();
  
  // Cybernetic/Machine arm (metallic gray with glowing lines)
  const armMat = new THREE.MeshLambertMaterial({ color: 0x555555, flatShading: true });
  const fistMat = new THREE.MeshLambertMaterial({ color: 0x444444, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

  // Upper arm
  const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.4), armMat);
  upperArm.position.set(0, 0, 0.2);
  group.add(upperArm);

  // Forearm
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), armMat);
  forearm.position.set(0, 0, 0.6);
  group.add(forearm);

  // Fist
  const fist = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), fistMat);
  fist.position.set(0, 0, 0.9);
  group.add(fist);

  // Glowing knuckle lines
  const knuckleGlow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.04), glowMat);
  knuckleGlow.position.set(0, 0.05, 0.95);
  group.add(knuckleGlow);

  return group;
}

// Melee leg view model (mech boot for kick) - High Fidelity Version
export function createKickViewModel() {
  const group = new THREE.Group();
  
  const legMat = new THREE.MeshLambertMaterial({ color: 0x555555, flatShading: true });
  const jointMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });
  const bootMat = new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x777777, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

  // 1. Thigh (top section) - lengthened to ensure it stays off-bottom-screen
  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), legMat);
  thigh.position.set(0, 0.5, -0.05);
  group.add(thigh);

  // 2. Knee Joint
  const knee = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), jointMat);
  knee.position.set(0, 0.22, -0.05);
  group.add(knee);

  // 3. Shin (main part)
  const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.16), legMat);
  shin.position.set(0, 0, 0);
  group.add(shin);

  // 4. Shin Armor Plates
  const armorL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.18), trimMat);
  armorL.position.set(-0.08, -0.02, 0);
  group.add(armorL);
  const armorR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.18), trimMat);
  armorR.position.set(0.08, -0.02, 0);
  group.add(armorR);

  // 5. Pistons
  const pistonL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), jointMat);
  pistonL.position.set(-0.06, -0.1, -0.08);
  group.add(pistonL);
  const pistonR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), jointMat);
  pistonR.position.set(0.06, -0.1, -0.08);
  group.add(pistonR);

  // 6. Boot Base
  const bootBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.2), bootMat);
  bootBase.position.set(0, -0.28, 0);
  group.add(bootBase);

  // 7. Boot Front (Heavier toe)
  const toe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.25), bootMat);
  toe.position.set(0, -0.3, 0.2);
  group.add(toe);

  // 8. Glowing sole lines (Triple line pattern)
  const soleGlow1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.12), glowMat);
  soleGlow1.position.set(0, -0.38, -0.05);
  group.add(soleGlow1);
  const soleGlow2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.15), glowMat);
  soleGlow2.position.set(0, -0.38, 0.2);
  group.add(soleGlow2);

  return group;
}
