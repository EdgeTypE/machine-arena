import * as THREE from 'three';

const ENEMY_TYPES = {
  drone: {
    name: 'Drone',
    health: 30,
    speed: 5,
    damage: 10,
    attackRange: 3,
    attackCooldown: 1500,
    color: 0xff3333,
    scale: 0.8,
    score: 100,
  },
  walker: {
    name: 'Walker',
    health: 80,
    speed: 3,
    damage: 20,
    attackRange: 4,
    attackCooldown: 2000,
    color: 0xff6600,
    scale: 1.2,
    score: 200,
  },
  tank: {
    name: 'Tank',
    health: 200,
    speed: 1.5,
    damage: 35,
    attackRange: 5,
    attackCooldown: 3000,
    color: 0xcc0000,
    scale: 1.8,
    score: 500,
  },
  swarm: {
    name: 'Swarm Bot',
    health: 15,
    speed: 4,
    damage: 6,
    attackRange: 2,
    attackCooldown: 800,
    color: 0xffaa00,
    scale: 0.5,
    score: 50,
  },
  sniper: {
    name: 'Sniper Bot',
    health: 60,
    speed: 2.5,
    damage: 55,
    attackRange: 22,
    attackCooldown: 5000,
    color: 0xaa00ff,
    scale: 1.0,
    score: 350,
  },
  mortar: {
    name: 'Mortar Bot',
    health: 70,
    speed: 1.2,
    damage: 50,
    attackRange: 35,
    attackCooldown: 4000,
    color: 0x884400,
    scale: 1.1,
    score: 300,
  },
  medic_bot: {
    name: 'Medic Bot',
    health: 90,
    speed: 2.8,
    damage: 0,
    attackRange: 0,
    attackCooldown: 0,
    color: 0x22cc66,
    scale: 1.0,
    score: 260,
  },
  spectre: {
    name: 'Spectre',
    health: 70,
    speed: 4.2,
    damage: 28,
    attackRange: 3.6,
    attackCooldown: 1400,
    color: 0x88bbff,
    scale: 1.0,
    score: 380,
  },
  shielder: {
    name: 'Shielder',
    health: 180,
    speed: 2.1,
    damage: 35,
    attackRange: 4.8,
    attackCooldown: 2200,
    turnSpeed: 1.5, // Much slower base turn
    color: 0x999999,
    scale: 1.3,
    score: 450,
  },
  pinky_mount: {
    name: 'Pinky Mount',
    health: 350,
    speed: 3.5,
    damage: 40,
    attackRange: 4,
    attackCooldown: 3000,
    color: 0xff0066,
    scale: 1.4,
    score: 600,
  },
  pinky_rider: {
    name: 'Pinky Rider',
    health: 120,
    speed: 4.5,
    damage: 25,
    attackRange: 18,
    attackCooldown: 1200,
    color: 0xff33cc,
    scale: 0.9,
    score: 300,
  },
  // ---- BOSSES ----
  carmackion: {
    name: 'CARMACKION',
    health: 800,
    speed: 4.5,
    damage: 20,
    attackRange: 22,
    attackCooldown: 2000,
    color: 0x00dd88,
    scale: 2.0,
    score: 2000,
    isBoss: true,
  },
  darioltman: {
    name: 'DARIOLTMAN',
    health: 1500,
    speed: 3,
    damage: 45,
    attackRange: 15,
    attackCooldown: 2500,
    color: 0xff0044,
    scale: 3.0,
    score: 4000,
    isBoss: true,
  },
  nanoman: {
    name: 'NANOMAN',
    health: 2500,
    speed: 2.5,
    damage: 60,
    attackRange: 18,
    attackCooldown: 1800,
    color: 0x44ff00,
    scale: 3.5,
    score: 6000,
    isBoss: true,
  },
  human_reaper: {
    name: 'THE HUMAN REAPER',
    health: 100000, // Unwinnable scale
    speed: 5.5,    // Fast and aggressive
    damage: 150,    // Two-shot potential
    attackRange: 35,
    attackCooldown: 1200,
    color: 0xffffff, // Pure white (human-made contrast)
    scale: 4.5,     // Massive presence
    score: 0,
    isBoss: true,
  },
};

function createDroneMesh(color, scale) {
  const group = new THREE.Group();

  // Body - octahedron for drone
  const bodyGeo = new THREE.OctahedronGeometry(0.6 * scale, 0);
  const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.5;
  body.name = 'droneBody';
  group.add(body);

  // Propellers
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const armGeo = new THREE.BoxGeometry(0.1 * scale, 0.05 * scale, 0.8 * scale);
    const arm = new THREE.Mesh(armGeo, bodyMat);
    arm.position.set(Math.cos(angle) * 0.6 * scale, 1.5, Math.sin(angle) * 0.6 * scale);
    arm.rotation.y = angle;
    group.add(arm);
  }

  // Eye (emissive)
  const eyeGeo = new THREE.SphereGeometry(0.15 * scale, 4, 4);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(0, 1.5, 0.4 * scale);
  group.add(eye);

  return group;
}

function createWalkerMesh(color, scale) {
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(0.8 * scale, 1.2 * scale, 0.6 * scale);
  const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.2 * scale;
  group.add(body);

  // Head
  const headGeo = new THREE.BoxGeometry(0.5 * scale, 0.4 * scale, 0.5 * scale);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 2.0 * scale;
  head.name = 'head';
  group.add(head);

  // Eyes (2 red glowing)
  const eyeGeo = new THREE.BoxGeometry(0.1 * scale, 0.1 * scale, 0.1 * scale);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
  eye1.position.set(-0.12 * scale, 2.0 * scale, 0.26 * scale);
  group.add(eye1);
  const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
  eye2.position.set(0.12 * scale, 2.0 * scale, 0.26 * scale);
  group.add(eye2);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.18 * scale, 0.7 * scale, 0.18 * scale);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(-0.54 * scale, 1.4 * scale, 0);
  armL.rotation.z = -0.2;
  armL.name = 'armL';
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(0.54 * scale, 1.4 * scale, 0);
  armR.rotation.z = 0.2;
  armR.name = 'armR';
  group.add(armR);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.2 * scale, 0.8 * scale, 0.2 * scale);
  const leg1 = new THREE.Mesh(legGeo, bodyMat);
  leg1.position.set(-0.25 * scale, 0.4 * scale, 0);
  group.add(leg1);
  const leg2 = new THREE.Mesh(legGeo, bodyMat);
  leg2.position.set(0.25 * scale, 0.4 * scale, 0);
  group.add(leg2);

  return group;
}

function createTankMesh(color, scale) {
  const group = new THREE.Group();

  // Body - large box
  const bodyGeo = new THREE.BoxGeometry(1.5 * scale, 1.0 * scale, 2.0 * scale);
  const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.8 * scale;
  group.add(body);

  // Turret
  const turretGeo = new THREE.BoxGeometry(0.8 * scale, 0.5 * scale, 0.8 * scale);
  const turret = new THREE.Mesh(turretGeo, bodyMat);
  turret.position.y = 1.5 * scale;
  group.add(turret);

  // Cannon
  const cannonGeo = new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 1.5 * scale, 6);
  const cannon = new THREE.Mesh(cannonGeo, bodyMat);
  cannon.rotation.x = Math.PI / 2;
  cannon.position.set(0, 1.5 * scale, 0.8 * scale);
  cannon.name = 'cannon';
  group.add(cannon);

  // Eye
  const eyeGeo = new THREE.SphereGeometry(0.2 * scale, 4, 4);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(0, 1.5 * scale, 0.42 * scale);
  group.add(eye);

  // Tracks
  const trackGeo = new THREE.BoxGeometry(0.3 * scale, 0.3 * scale, 2.2 * scale);
  const trackMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });
  const track1 = new THREE.Mesh(trackGeo, trackMat);
  track1.position.set(-0.8 * scale, 0.15 * scale, 0);
  group.add(track1);
  const track2 = new THREE.Mesh(trackGeo, trackMat);
  track2.position.set(0.8 * scale, 0.15 * scale, 0);
  group.add(track2);

  return group;
}

function createSwarmMesh(color, scale) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.TetrahedronGeometry(0.4 * scale, 0);
  const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  body.name = 'swarmBody';
  group.add(body);

  const eyeGeo = new THREE.SphereGeometry(0.1 * scale, 4, 4);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(0, 0.6, 0.3 * scale);
  eye.name = 'swarmEye';
  group.add(eye);

  return group;
}

function createSniperMesh(color, scale) {
  const group = new THREE.Group();

  // Tripod legs
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const legGeo = new THREE.BoxGeometry(0.08 * scale, 0.06 * scale, 0.7 * scale);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(Math.cos(angle) * 0.35 * scale, 0.06, Math.sin(angle) * 0.35 * scale);
    leg.rotation.y = angle;
    leg.rotation.z = 0.35;
    group.add(leg);
  }

  // Slim body
  const bodyGeo = new THREE.BoxGeometry(0.28 * scale, 1.3 * scale, 0.28 * scale);
  const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.8 * scale;
  group.add(body);

  // Head - octahedron
  const headGeo = new THREE.OctahedronGeometry(0.24 * scale, 0);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 1.6 * scale;
  group.add(head);

  // Long barrel (points in +Z = toward player after lookAt)
  const barrelGeo = new THREE.CylinderGeometry(0.055 * scale, 0.055 * scale, 1.4 * scale, 6);
  const barrelMat = new THREE.MeshLambertMaterial({ color: 0x111111, flatShading: true });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.15 * scale, 0.7 * scale);
  barrel.name = 'barrel';
  group.add(barrel);

  // Glowing eye (purple/magenta)
  const eyeGeo = new THREE.SphereGeometry(0.11 * scale, 6, 6);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(0, 1.6 * scale, 0.25 * scale);
  group.add(eye);

  return group;
}

function createMortarMesh(color, scale) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });

  // Squat tracked base
  const baseGeo = new THREE.BoxGeometry(1.2 * scale, 0.4 * scale, 1.5 * scale);
  const base = new THREE.Mesh(baseGeo, bodyMat);
  base.position.y = 0.2 * scale;
  group.add(base);

  // Tracks
  const trackGeo = new THREE.BoxGeometry(0.25 * scale, 0.3 * scale, 1.6 * scale);
  const track1 = new THREE.Mesh(trackGeo, darkMat);
  track1.position.set(-0.65 * scale, 0.15 * scale, 0);
  group.add(track1);
  const track2 = track1.clone();
  track2.position.set(0.65 * scale, 0.15 * scale, 0);
  group.add(track2);

  // Turret body
  const turretGeo = new THREE.BoxGeometry(0.7 * scale, 0.55 * scale, 0.7 * scale);
  const turret = new THREE.Mesh(turretGeo, bodyMat);
  turret.position.y = 0.67 * scale;
  turret.name = 'turret';
  group.add(turret);

  // Mortar barrel — angled upward like a real mortar
  const barrelGeo = new THREE.CylinderGeometry(0.13 * scale, 0.16 * scale, 1.1 * scale, 8);
  const barrel = new THREE.Mesh(barrelGeo, darkMat);
  barrel.rotation.x = -Math.PI / 4; // 45° up
  barrel.position.set(0, 1.1 * scale, -0.15 * scale);
  barrel.name = 'mortarBarrel';
  group.add(barrel);

  // Glowing muzzle tip
  const muzzleGeo = new THREE.SphereGeometry(0.14 * scale, 6, 4);
  const muzzle = new THREE.Mesh(muzzleGeo, glowMat);
  // Tip of a barrel rotated -45°: offset along barrel axis
  const ba = Math.PI / 4;
  muzzle.position.set(0, 1.1 * scale + Math.cos(ba) * 0.55 * scale, -0.15 * scale - Math.sin(ba) * 0.55 * scale);
  muzzle.name = 'mortarMuzzle';
  group.add(muzzle);

  // Glowing eye
  const eyeGeo = new THREE.SphereGeometry(0.1 * scale, 6, 4);
  const eye = new THREE.Mesh(eyeGeo, glowMat);
  eye.position.set(0, 0.9 * scale, 0.36 * scale);
  group.add(eye);

  return group;
}

function createMedicBotMesh(color, scale) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a3a28, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x44ff99 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8 * scale, 0.95 * scale, 0.7 * scale), bodyMat);
  body.position.y = 0.95 * scale;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.35 * scale, 0.55 * scale), darkMat);
  head.position.y = 1.62 * scale;
  group.add(head);

  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 0.08 * scale, 0.08 * scale), glowMat);
  eye.position.set(0, 1.62 * scale, 0.3 * scale);
  group.add(eye);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14 * scale, 0.65 * scale, 0.14 * scale), bodyMat);
    arm.position.set(side * 0.5 * scale, 0.95 * scale, 0);
    arm.name = side < 0 ? 'medicArmL' : 'medicArmR';
    group.add(arm);
  }

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.55 * scale, 0.16 * scale), darkMat);
    leg.position.set(side * 0.2 * scale, 0.27 * scale, 0);
    leg.name = side < 0 ? 'medicLegL' : 'medicLegR';
    group.add(leg);
  }

  return group;
}

function createSpectreMesh(color, scale) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity: 0.03,
    flatShading: true,
    depthWrite: false,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xaaddff,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7 * scale, 1.1 * scale, 0.5 * scale), bodyMat);
  torso.position.y = 1.1 * scale;
  torso.name = 'spectreTorso';
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45 * scale, 0.4 * scale, 0.45 * scale), bodyMat);
  head.position.y = 1.85 * scale;
  head.name = 'spectreHead';
  group.add(head);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 6, 5), coreMat);
  core.position.set(0, 1.35 * scale, 0.18 * scale);
  core.name = 'spectreCore';
  group.add(core);

  return group;
}

function createShielderMesh(color, scale) {
  const group = new THREE.Group();
  const armorMat = new THREE.MeshLambertMaterial({ color: 0x777777, flatShading: true });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xaa8800, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

  // --- ARMORED BODY ---
  const bodyGeo = new THREE.BoxGeometry(0.8 * scale, 1.3 * scale, 0.6 * scale);
  const body = new THREE.Mesh(bodyGeo, armorMat);
  body.position.y = 1.3 * scale;
  group.add(body);

  // Helmet
  const helmetGeo = new THREE.BoxGeometry(0.6 * scale, 0.5 * scale, 0.6 * scale);
  const helmet = new THREE.Mesh(helmetGeo, armorMat);
  helmet.position.y = 2.2 * scale;
  group.add(helmet);

  // Visor Slit
  const visorGeo = new THREE.BoxGeometry(0.5 * scale, 0.08 * scale, 0.1 * scale);
  const visor = new THREE.Mesh(visorGeo, glowMat);
  visor.position.set(0, 2.2 * scale, 0.26 * scale);
  group.add(visor);

  // Shoulder Pads
  const shoulderGeo = new THREE.BoxGeometry(0.3 * scale, 0.25 * scale, 0.5 * scale);
  const lShoulder = new THREE.Mesh(shoulderGeo, armorMat);
  lShoulder.position.set(-0.55 * scale, 1.8 * scale, 0);
  group.add(lShoulder);
  const rShoulder = lShoulder.clone();
  rShoulder.position.set(0.55 * scale, 1.8 * scale, 0);
  group.add(rShoulder);

  // --- ARMS ---
  const armGeo = new THREE.BoxGeometry(0.2 * scale, 0.8 * scale, 0.2 * scale);
  
  // Left Arm (Shield Arm)
  const armL = new THREE.Mesh(armGeo, armorMat);
  armL.position.set(-0.6 * scale, 1.3 * scale, 0.1 * scale);
  armL.rotation.x = -0.4; // Slightly forward
  armL.name = 'armL';
  group.add(armL);

  // Right Arm (Mace Arm)
  const armR = new THREE.Mesh(armGeo, armorMat);
  armR.position.set(0.6 * scale, 1.3 * scale, 0);
  armR.name = 'armR';
  group.add(armR);

  // --- HEATER SHIELD (Medieval style) ---
  const shieldGroup = new THREE.Group();
  shieldGroup.name = 'shieldGroup';
  shieldGroup.position.set(-0.75 * scale, 1.3 * scale, 0.4 * scale);
  
  // Shield Base (Pointed bottom)
  const shieldTopGeo = new THREE.BoxGeometry(0.9 * scale, 0.7 * scale, 0.08 * scale);
  const shieldTop = new THREE.Mesh(shieldTopGeo, armorMat);
  shieldGroup.add(shieldTop);

  const shieldBottomGeo = new THREE.CylinderGeometry(0.45 * scale, 0.01 * scale, 0.6 * scale, 4);
  const shieldBottom = new THREE.Mesh(shieldBottomGeo, armorMat);
  shieldBottom.rotation.y = Math.PI / 4;
  shieldBottom.position.y = -0.6 * scale;
  shieldGroup.add(shieldBottom);

  // Shield Trim/Border
  const trimGeo = new THREE.BoxGeometry(1.0 * scale, 0.1 * scale, 0.1 * scale);
  const trim = new THREE.Mesh(trimGeo, goldMat);
  trim.position.y = 0.35 * scale;
  shieldGroup.add(trim);

  // Shield Cross Detail
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.6 * scale, 0.05 * scale), goldMat);
  crossV.position.z = 0.05 * scale;
  shieldGroup.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.12 * scale, 0.05 * scale), goldMat);
  crossH.position.set(0, 0.1, 0.05 * scale);
  shieldGroup.add(crossH);

  group.add(shieldGroup);

  // --- SPIKY MACE ---
  const maceGroup = new THREE.Group();
  maceGroup.name = 'maceGroup';
  maceGroup.position.set(0.6 * scale, 0.8 * scale, 0.1 * scale);

  // Handle
  const handleGeo = new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 1.2 * scale, 6);
  const handle = new THREE.Mesh(handleGeo, darkMat);
  maceGroup.add(handle);

  // Head
  const headGeo = new THREE.OctahedronGeometry(0.25 * scale, 0);
  const head = new THREE.Mesh(headGeo, armorMat);
  head.position.y = 0.6 * scale;
  maceGroup.add(head);

  // Spikes
  const spikeGeo = new THREE.ConeGeometry(0.06 * scale, 0.25 * scale, 4);
  for (let i = 0; i < 6; i++) {
    const spike = new THREE.Mesh(spikeGeo, darkMat);
    const angle = (i / 6) * Math.PI * 2;
    spike.position.set(Math.cos(angle) * 0.2 * scale, 0.6 * scale, Math.sin(angle) * 0.2 * scale);
    spike.rotation.z = Math.PI / 2;
    spike.rotation.y = -angle;
    head.add(spike);
  }
  const topSpike = new THREE.Mesh(spikeGeo, darkMat);
  topSpike.position.y = 0.2 * scale;
  head.add(topSpike);

  group.add(maceGroup);

  // --- LEGS ---
  const legGeo = new THREE.BoxGeometry(0.25 * scale, 0.7 * scale, 0.25 * scale);
  const lLeg = new THREE.Mesh(legGeo, armorMat);
  lLeg.position.set(-0.25 * scale, 0.35 * scale, 0);
  group.add(lLeg);
  const rLeg = lLeg.clone();
  rLeg.position.set(0.25 * scale, 0.35 * scale, 0);
  group.add(rLeg);

  return group;
}

function createPinkyMountMesh(color, scale) {
  const group = new THREE.Group();
  const pinkMat = new THREE.MeshLambertMaterial({ color: 0xff0066, flatShading: true });
  const darkPinkMat = new THREE.MeshLambertMaterial({ color: 0x990033, flatShading: true });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x444444, flatShading: true });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });

  // Main body - bulky
  const bodyGeo = new THREE.BoxGeometry(1.2 * scale, 1.0 * scale, 1.8 * scale);
  const body = new THREE.Mesh(bodyGeo, pinkMat);
  body.position.y = 0.8 * scale;
  group.add(body);

  // Neck
  const neckGeo = new THREE.BoxGeometry(0.6 * scale, 0.6 * scale, 0.6 * scale);
  const neck = new THREE.Mesh(neckGeo, pinkMat);
  neck.position.set(0, 1.1 * scale, 0.8 * scale);
  neck.rotation.x = -0.3;
  group.add(neck);

  // Head
  const headGeo = new THREE.BoxGeometry(0.8 * scale, 0.7 * scale, 1.0 * scale);
  const head = new THREE.Mesh(headGeo, pinkMat);
  head.position.set(0, 1.3 * scale, 1.4 * scale);
  head.name = 'head';
  group.add(head);

  // Jaw
  const jawGeo = new THREE.BoxGeometry(0.7 * scale, 0.2 * scale, 0.8 * scale);
  const jaw = new THREE.Mesh(jawGeo, darkPinkMat);
  jaw.position.set(0, 1.0 * scale, 1.5 * scale);
  jaw.name = 'jaw';
  group.add(jaw);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.15 * scale, 0.15 * scale, 0.15 * scale);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.3 * scale, 1.4 * scale, 1.8 * scale);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.set(0.3 * scale, 1.4 * scale, 1.8 * scale);
  group.add(eyeR);

  // Horns
  const hornGeo = new THREE.ConeGeometry(0.12 * scale, 0.6 * scale, 4);
  const hornL = new THREE.Mesh(hornGeo, metalMat);
  hornL.position.set(-0.35 * scale, 1.7 * scale, 1.4 * scale);
  hornL.rotation.x = 0.5;
  hornL.rotation.z = 0.2;
  group.add(hornL);
  const hornR = hornL.clone();
  hornR.position.set(0.35 * scale, 1.7 * scale, 1.4 * scale);
  hornR.rotation.z = -0.2;
  group.add(hornR);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.3 * scale, 0.6 * scale, 0.3 * scale);
  const legPositions = [
    [-0.45, 0.3, 0.6], [0.45, 0.3, 0.6],
    [-0.45, 0.3, -0.6], [0.45, 0.3, -0.6]
  ];
  legPositions.forEach((pos, i) => {
    const leg = new THREE.Mesh(legGeo, darkPinkMat);
    leg.position.set(pos[0] * scale, pos[1] * scale, pos[2] * scale);
    leg.name = 'leg' + i;
    group.add(leg);
  });

  // Saddle / Mount point
  const saddleGeo = new THREE.BoxGeometry(0.7 * scale, 0.1 * scale, 0.7 * scale);
  const saddle = new THREE.Mesh(saddleGeo, metalMat);
  saddle.position.set(0, 1.35 * scale, -0.1 * scale);
  group.add(saddle);

  return group;
}

function createPinkyRiderMesh(color, scale) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xff33cc, flatShading: true });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

  // Body
  const bodyGeo = new THREE.BoxGeometry(0.5 * scale, 0.8 * scale, 0.4 * scale);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.0 * scale;
  group.add(body);

  // Head
  const headGeo = new THREE.BoxGeometry(0.4 * scale, 0.4 * scale, 0.4 * scale);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 1.6 * scale;
  group.add(head);

  // Visor
  const visorGeo = new THREE.BoxGeometry(0.3 * scale, 0.1 * scale, 0.1 * scale);
  const visor = new THREE.Mesh(visorGeo, glowMat);
  visor.position.set(0, 1.65 * scale, 0.2 * scale);
  group.add(visor);

  // Gun
  const gunGroup = new THREE.Group();
  gunGroup.name = 'gunGroup';
  gunGroup.position.set(0.35 * scale, 1.1 * scale, 0);

  const barrelGeo = new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, 0.8 * scale, 6);
  const barrel = new THREE.Mesh(barrelGeo, darkMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.4 * scale;
  gunGroup.add(barrel);

  const stockGeo = new THREE.BoxGeometry(0.12 * scale, 0.15 * scale, 0.3 * scale);
  const stock = new THREE.Mesh(stockGeo, darkMat);
  stock.position.z = -0.1 * scale;
  gunGroup.add(stock);

  group.add(gunGroup);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.15 * scale, 0.6 * scale, 0.15 * scale);
  const lLeg = new THREE.Mesh(legGeo, darkMat);
  lLeg.position.set(-0.15 * scale, 0.3 * scale, 0);
  lLeg.name = 'lLeg';
  group.add(lLeg);
  const rLeg = lLeg.clone();
  rLeg.position.set(0.15 * scale, 0.3 * scale, 0);
  rLeg.name = 'rLeg';
  group.add(rLeg);

  return group;
}

// ============================================================
// BOSS MESHES
// ============================================================

// CARMACKION — Doom Slayer-style humanoid warrior. Armored, imposing, relentless.
function createCarmackionMesh(color, scale) {
  const group = new THREE.Group();
  const armorMat = new THREE.MeshLambertMaterial({ color: 0x1a3a28, flatShading: true });
  const accentMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x0d1f15, flatShading: true });
  const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });

  // === LEGS ===
  // Left upper leg
  const thighGeo = new THREE.BoxGeometry(0.28 * scale, 0.55 * scale, 0.3 * scale);
  const lThigh = new THREE.Mesh(thighGeo, armorMat);
  lThigh.position.set(-0.18 * scale, 1.1 * scale, 0);
  lThigh.name = 'lThigh';
  group.add(lThigh);
  // Right upper leg
  const rThigh = lThigh.clone();
  rThigh.position.set(0.18 * scale, 1.1 * scale, 0);
  rThigh.name = 'rThigh';
  group.add(rThigh);

  // Left lower leg
  const calfGeo = new THREE.BoxGeometry(0.22 * scale, 0.5 * scale, 0.26 * scale);
  const lCalf = new THREE.Mesh(calfGeo, darkMat);
  lCalf.position.set(-0.18 * scale, 0.55 * scale, 0);
  group.add(lCalf);
  const rCalf = lCalf.clone();
  rCalf.position.set(0.18 * scale, 0.55 * scale, 0);
  group.add(rCalf);

  // Boots
  const bootGeo = new THREE.BoxGeometry(0.28 * scale, 0.28 * scale, 0.38 * scale);
  const lBoot = new THREE.Mesh(bootGeo, accentMat);
  lBoot.position.set(-0.18 * scale, 0.14 * scale, 0.04 * scale);
  group.add(lBoot);
  const rBoot = lBoot.clone();
  rBoot.position.set(0.18 * scale, 0.14 * scale, 0.04 * scale);
  group.add(rBoot);

  // === WAIST / PELVIS ===
  const waistGeo = new THREE.BoxGeometry(0.52 * scale, 0.22 * scale, 0.38 * scale);
  const waist = new THREE.Mesh(waistGeo, darkMat);
  waist.position.y = 1.62 * scale;
  group.add(waist);

  // === TORSO ===
  const torsoGeo = new THREE.BoxGeometry(0.82 * scale, 0.85 * scale, 0.52 * scale);
  const torso = new THREE.Mesh(torsoGeo, armorMat);
  torso.position.y = 2.3 * scale;
  group.add(torso);

  // Chest plate accent
  const chestGeo = new THREE.BoxGeometry(0.5 * scale, 0.5 * scale, 0.08 * scale);
  const chest = new THREE.Mesh(chestGeo, accentMat);
  chest.position.set(0, 2.3 * scale, 0.3 * scale);
  group.add(chest);

  // Chest glow strip
  const glowGeo = new THREE.BoxGeometry(0.38 * scale, 0.05 * scale, 0.06 * scale);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, 2.42 * scale, 0.34 * scale);
  glow.name = 'chestGlow';
  group.add(glow);

  // === SHOULDER PADS ===
  const shoulderGeo = new THREE.BoxGeometry(0.28 * scale, 0.22 * scale, 0.38 * scale);
  const lShoulder = new THREE.Mesh(shoulderGeo, accentMat);
  lShoulder.position.set(-0.58 * scale, 2.7 * scale, 0);
  group.add(lShoulder);
  const rShoulder = new THREE.Mesh(shoulderGeo, accentMat);
  rShoulder.position.set(0.58 * scale, 2.7 * scale, 0);
  group.add(rShoulder);

  // === ARMS ===
  // Left arm (guard/defensive)
  const armGeo = new THREE.BoxGeometry(0.22 * scale, 0.68 * scale, 0.22 * scale);
  const lArm = new THREE.Mesh(armGeo, armorMat);
  lArm.position.set(-0.56 * scale, 2.22 * scale, 0);
  lArm.name = 'lArm';
  group.add(lArm);
  // Left forearm (angled forward in guard stance)
  const lForearmGeo = new THREE.BoxGeometry(0.2 * scale, 0.26 * scale, 0.52 * scale);
  const lForearm = new THREE.Mesh(lForearmGeo, darkMat);
  lForearm.position.set(-0.56 * scale, 1.88 * scale, 0.2 * scale);
  group.add(lForearm);

  // Right arm (gun arm)
  const rArm = new THREE.Mesh(armGeo, armorMat);
  rArm.position.set(0.56 * scale, 2.22 * scale, 0);
  rArm.name = 'rArm';
  group.add(rArm);

  // === LMG WEAPON (attached to right arm) ===
  // Gun body
  const lmgBodyGeo = new THREE.BoxGeometry(0.14 * scale, 0.18 * scale, 0.7 * scale);
  const lmgBody = new THREE.Mesh(lmgBodyGeo, gunMat);
  lmgBody.position.set(0.62 * scale, 1.88 * scale, 0.35 * scale);
  lmgBody.name = 'lmgBody';
  group.add(lmgBody);
  // Gun barrel
  const lmgBarrelGeo = new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.7 * scale, 8);
  const lmgBarrel = new THREE.Mesh(lmgBarrelGeo, gunMat);
  lmgBarrel.rotation.x = Math.PI / 2;
  lmgBarrel.position.set(0.62 * scale, 1.88 * scale, 0.7 * scale);
  lmgBarrel.name = 'lmgBarrel';
  group.add(lmgBarrel);
  // Drum magazine
  const magGeo = new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 0.14 * scale, 8);
  const magMat = new THREE.MeshLambertMaterial({ color: 0x444444, flatShading: true });
  const mag = new THREE.Mesh(magGeo, magMat);
  mag.position.set(0.62 * scale, 1.72 * scale, 0.3 * scale);
  group.add(mag);
  // Muzzle flash placeholder (controlled in AI)
  const muzzleGeo = new THREE.SphereGeometry(0.08 * scale, 4, 4);
  const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0 });
  const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
  muzzle.position.set(0.62 * scale, 1.88 * scale, 1.06 * scale);
  muzzle.name = 'muzzle';
  group.add(muzzle);

  // === HEAD / HELMET ===
  // Helmet base
  const helmetGeo = new THREE.BoxGeometry(0.44 * scale, 0.44 * scale, 0.42 * scale);
  const helmet = new THREE.Mesh(helmetGeo, armorMat);
  helmet.position.y = 3.05 * scale;
  helmet.name = 'helmet';
  group.add(helmet);
  // Helmet crest / ridge on top
  const crestGeo = new THREE.BoxGeometry(0.08 * scale, 0.14 * scale, 0.38 * scale);
  const crest = new THREE.Mesh(crestGeo, accentMat);
  crest.position.set(0, 3.32 * scale, 0);
  group.add(crest);
  // Visor slit (glowing)
  const visorGeo = new THREE.BoxGeometry(0.32 * scale, 0.08 * scale, 0.04 * scale);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 3.06 * scale, 0.22 * scale);
  visor.name = 'visor';
  group.add(visor);
  // Chin guard
  const chinGeo = new THREE.BoxGeometry(0.34 * scale, 0.12 * scale, 0.12 * scale);
  const chin = new THREE.Mesh(chinGeo, darkMat);
  chin.position.set(0, 2.88 * scale, 0.2 * scale);
  group.add(chin);

  return group;
}

// DARIOLTMAN — Evil incarnate. Phase 1-2: demonic warrior with shotgun. Phase 3: unleashed mega-demon.
function createDarioltmanMesh(color, scale) {
  const group = new THREE.Group();

  // ======= NORMAL FORM (Phase 1 & 2) =======
  const normalForm = new THREE.Group();
  normalForm.name = 'normalForm';

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x440000, flatShading: true });
  const headMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const hornMat = new THREE.MeshLambertMaterial({ color: 0x220000, flatShading: true });
  const wingMat = new THREE.MeshLambertMaterial({ color: 0x330011, side: THREE.DoubleSide, flatShading: true });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const auraMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.3 });
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, flatShading: true });
  const barrelMat = new THREE.MeshLambertMaterial({ color: 0x111111, flatShading: true });

  // Main body
  const bodyGeo = new THREE.BoxGeometry(1.2 * scale, 1.8 * scale, 1.0 * scale);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 2.0 * scale;
  normalForm.add(body);

  // Head — demonic skull
  const headGeo = new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.7 * scale);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 3.2 * scale;
  normalForm.add(head);

  // Horns
  const hornGeo = new THREE.ConeGeometry(0.12 * scale, 0.8 * scale, 4);
  const horn1 = new THREE.Mesh(hornGeo, hornMat);
  horn1.position.set(-0.35 * scale, 3.8 * scale, 0);
  horn1.rotation.z = 0.3;
  normalForm.add(horn1);
  const horn2 = horn1.clone();
  horn2.position.set(0.35 * scale, 3.8 * scale, 0);
  horn2.rotation.z = -0.3;
  normalForm.add(horn2);

  // Glowing evil eyes
  const eyeGeo = new THREE.SphereGeometry(0.12 * scale, 6, 6);
  const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
  eye1.position.set(-0.2 * scale, 3.3 * scale, 0.36 * scale);
  normalForm.add(eye1);
  const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
  eye2.position.set(0.2 * scale, 3.3 * scale, 0.36 * scale);
  normalForm.add(eye2);

  // Dark wings
  const wingGeo = new THREE.PlaneGeometry(2.0 * scale, 1.5 * scale);
  const wing1 = new THREE.Mesh(wingGeo, wingMat);
  wing1.position.set(-1.2 * scale, 2.5 * scale, -0.2 * scale);
  wing1.rotation.y = -0.4;
  wing1.name = 'wing1';
  normalForm.add(wing1);
  const wing2 = new THREE.Mesh(wingGeo, wingMat);
  wing2.position.set(1.2 * scale, 2.5 * scale, -0.2 * scale);
  wing2.rotation.y = 0.4;
  wing2.name = 'wing2';
  normalForm.add(wing2);

  // Arms — heavy claws
  const armGeo = new THREE.BoxGeometry(0.3 * scale, 1.2 * scale, 0.3 * scale);
  const arm1 = new THREE.Mesh(armGeo, bodyMat);
  arm1.position.set(-0.9 * scale, 1.5 * scale, 0);
  arm1.name = 'arm1';
  normalForm.add(arm1);
  const arm2 = new THREE.Mesh(armGeo, bodyMat);
  arm2.position.set(0.9 * scale, 1.5 * scale, 0);
  arm2.name = 'arm2';
  normalForm.add(arm2);

  // Fire aura ring
  const auraGeo = new THREE.TorusGeometry(1.8 * scale, 0.15 * scale, 6, 16);
  const aura = new THREE.Mesh(auraGeo, auraMat.clone());
  aura.position.y = 0.3;
  aura.rotation.x = Math.PI / 2;
  aura.name = 'aura';
  normalForm.add(aura);

  // Legs — heavy
  const legGeo = new THREE.BoxGeometry(0.35 * scale, 1.0 * scale, 0.35 * scale);
  const leg1 = new THREE.Mesh(legGeo, bodyMat);
  leg1.position.set(-0.35 * scale, 0.5 * scale, 0);
  normalForm.add(leg1);
  const leg2 = leg1.clone();
  leg2.position.set(0.35 * scale, 0.5 * scale, 0);
  normalForm.add(leg2);

  // === SHOTGUN (held at right side, hip level) ===
  // Stock/body
  const sgBodyGeo = new THREE.BoxGeometry(0.22 * scale, 0.2 * scale, 0.62 * scale);
  const sgBody = new THREE.Mesh(sgBodyGeo, gunMat);
  sgBody.position.set(0.72 * scale, 1.65 * scale, 0.35 * scale);
  normalForm.add(sgBody);
  // Wide sawn-off barrel
  const sgBarrelGeo = new THREE.CylinderGeometry(0.1 * scale, 0.12 * scale, 0.52 * scale, 6);
  const sgBarrel = new THREE.Mesh(sgBarrelGeo, barrelMat);
  sgBarrel.rotation.x = Math.PI / 2;
  sgBarrel.position.set(0.72 * scale, 1.65 * scale, 0.8 * scale);
  normalForm.add(sgBarrel);
  // Pump handle
  const sgPumpGeo = new THREE.BoxGeometry(0.17 * scale, 0.1 * scale, 0.26 * scale);
  const sgPump = new THREE.Mesh(sgPumpGeo, barrelMat);
  sgPump.position.set(0.72 * scale, 1.53 * scale, 0.5 * scale);
  sgPump.name = 'sgPump';
  normalForm.add(sgPump);
  // Muzzle flash (transparent until fired)
  const sgMuzzleGeo = new THREE.SphereGeometry(0.1 * scale, 4, 4);
  const sgMuzzleMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0 });
  const sgMuzzle = new THREE.Mesh(sgMuzzleGeo, sgMuzzleMat);
  sgMuzzle.position.set(0.72 * scale, 1.65 * scale, 1.1 * scale);
  sgMuzzle.name = 'sgMuzzle';
  normalForm.add(sgMuzzle);

  group.add(normalForm);

  // ======= DEMON FORM (Phase 3) — Initially hidden =======
  const demonForm = new THREE.Group();
  demonForm.name = 'demonForm';
  demonForm.visible = false;

  const dS = scale * 1.4; // 40% bigger overall
  const dBodyMat = new THREE.MeshLambertMaterial({ color: 0x1a0000, flatShading: true });
  const dAccentMat = new THREE.MeshLambertMaterial({ color: 0x660011, flatShading: true });
  const dHornMat = new THREE.MeshLambertMaterial({ color: 0x100000, flatShading: true });
  const dWingMat = new THREE.MeshLambertMaterial({ color: 0x110000, side: THREE.DoubleSide, flatShading: true });
  const dLavaMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
  const dEyeMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const dAuraMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.45 });

  // Massive torso
  const dTorsoGeo = new THREE.BoxGeometry(1.5 * dS, 2.1 * dS, 1.2 * dS);
  const dTorso = new THREE.Mesh(dTorsoGeo, dBodyMat);
  dTorso.position.y = 2.2 * dS;
  demonForm.add(dTorso);

  // Large demonic head
  const dHeadGeo = new THREE.BoxGeometry(1.0 * dS, 0.9 * dS, 0.85 * dS);
  const dHead = new THREE.Mesh(dHeadGeo, dAccentMat);
  dHead.position.y = 3.65 * dS;
  demonForm.add(dHead);

  // 4 massive curved horns
  const dHornGeo = new THREE.ConeGeometry(0.15 * dS, 1.1 * dS, 4);
  for (let i = 0; i < 4; i++) {
    const dHorn = new THREE.Mesh(dHornGeo, dHornMat);
    dHorn.position.set(
      (i < 2 ? -1 : 1) * 0.44 * dS,
      4.55 * dS,
      (i % 2 === 0 ? 0.14 : -0.08) * dS
    );
    dHorn.rotation.z = (i < 2 ? 0.5 : -0.5);
    dHorn.rotation.x = (i % 2 === 0 ? -0.15 : 0.15);
    demonForm.add(dHorn);
  }

  // Glowing lava eyes
  const dEyeGeo = new THREE.SphereGeometry(0.18 * dS, 8, 8);
  const dEye1 = new THREE.Mesh(dEyeGeo, dEyeMat);
  dEye1.position.set(-0.28 * dS, 3.75 * dS, 0.44 * dS);
  dEye1.name = 'dEye1';
  demonForm.add(dEye1);
  const dEye2 = new THREE.Mesh(dEyeGeo, dEyeMat);
  dEye2.position.set(0.28 * dS, 3.75 * dS, 0.44 * dS);
  dEye2.name = 'dEye2';
  demonForm.add(dEye2);

  // Massive bat wings (all dimensions in dS for proper demon scale)
  const dWingGeo = new THREE.BoxGeometry(3.2 * dS, 0.1 * dS, 1.8 * dS);
  const dWing1 = new THREE.Mesh(dWingGeo, dWingMat);
  dWing1.position.set(-2.2 * dS, 2.8 * dS, -0.4 * dS);
  dWing1.rotation.z = 0.25;
  dWing1.name = 'dWing1';
  demonForm.add(dWing1);
  const dWing2 = new THREE.Mesh(dWingGeo, dWingMat);
  dWing2.position.set(2.2 * dS, 2.8 * dS, -0.4 * dS);
  dWing2.rotation.z = -0.25;
  dWing2.name = 'dWing2';
  demonForm.add(dWing2);

  // Wing bone spikes (glowing lava tips)
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const dSpikeGeo = new THREE.ConeGeometry(0.07 * dS, 0.7 * dS, 4);
      const dSpike = new THREE.Mesh(dSpikeGeo, dLavaMat);
      dSpike.position.set(side * (1.8 + j * 0.9) * dS, 3.1 * dS, -0.4 * dS);
      dSpike.rotation.z = side * (Math.PI * 0.5 + 0.2);
      demonForm.add(dSpike);
    }
  }

  // Heavy arms with claws
  const dArmGeo = new THREE.BoxGeometry(0.4 * dS, 1.4 * dS, 0.4 * dS);
  const dArm1 = new THREE.Mesh(dArmGeo, dBodyMat);
  dArm1.position.set(-1.05 * dS, 1.6 * dS, 0);
  dArm1.name = 'dArm1';
  demonForm.add(dArm1);
  const dArm2 = new THREE.Mesh(dArmGeo, dBodyMat);
  dArm2.position.set(1.05 * dS, 1.6 * dS, 0);
  dArm2.name = 'dArm2';
  demonForm.add(dArm2);

  // Claw spikes from hands
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const dClawGeo = new THREE.ConeGeometry(0.05 * dS, 0.45 * dS, 4);
      const dClaw = new THREE.Mesh(dClawGeo, dLavaMat);
      dClaw.position.set(side * 1.05 * dS + (j - 1) * 0.14 * dS, 0.7 * dS, 0.22 * dS);
      dClaw.rotation.x = -0.35;
      demonForm.add(dClaw);
    }
  }

  // Heavy demon legs
  const dLegGeo = new THREE.BoxGeometry(0.5 * dS, 1.2 * dS, 0.5 * dS);
  const dLeg1 = new THREE.Mesh(dLegGeo, dBodyMat);
  dLeg1.position.set(-0.5 * dS, 0.6 * dS, 0);
  demonForm.add(dLeg1);
  const dLeg2 = new THREE.Mesh(dLegGeo, dBodyMat);
  dLeg2.position.set(0.5 * dS, 0.6 * dS, 0);
  demonForm.add(dLeg2);

  // Big fire aura ring
  const dAuraGeo = new THREE.TorusGeometry(2.6 * dS, 0.22 * dS, 6, 16);
  const dAura = new THREE.Mesh(dAuraGeo, dAuraMat);
  dAura.position.y = 0.3;
  dAura.rotation.x = Math.PI / 2;
  dAura.name = 'dAura';
  demonForm.add(dAura);

  // Lava cracks on torso (glowing orange strips)
  for (let i = 0; i < 5; i++) {
    const crackGeo = new THREE.BoxGeometry(0.07 * dS, (0.2 + Math.random() * 0.3) * dS, 0.05 * dS);
    const crackMesh = new THREE.Mesh(crackGeo, dLavaMat);
    crackMesh.position.set(
      (Math.random() - 0.5) * 1.3 * dS,
      (1.5 + Math.random() * 1.5) * dS,
      0.62 * dS
    );
    crackMesh.rotation.z = (Math.random() - 0.5) * 0.5;
    demonForm.add(crackMesh);
  }

  group.add(demonForm);

  return group;
}

// NANOMAN — Final Boss. Crysis nanosuit-inspired powered exoskeleton.
// Phase 1: melee only. Phase 2: power leap slam. Phase 3: dual HMG + 360 spin with shield.
function createNanomanMesh(color, scale) {
  const group = new THREE.Group();

  // ---- Materials ----
  const armorMat = new THREE.MeshLambertMaterial({ color: 0x1a2e1a, flatShading: true }); // dark olive nanosuit
  const plateMat = new THREE.MeshLambertMaterial({ color: 0x0d1f0d, flatShading: true }); // even darker chest/limb plates
  const accentMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 }); // nanosuit glow green
  const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.9 });
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x111111, flatShading: true });
  const gunBarMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });
  const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.0, side: THREE.DoubleSide });

  // ---- TORSO ----
  const torsoGeo = new THREE.BoxGeometry(1.6 * scale, 2.1 * scale, 1.1 * scale);
  const torso = new THREE.Mesh(torsoGeo, plateMat);
  torso.position.y = 2.5 * scale;
  torso.name = 'torso';
  group.add(torso);

  // Chest energy cell (glowing strip down front)
  const cellGeo = new THREE.BoxGeometry(0.22 * scale, 1.0 * scale, 0.06 * scale);
  const cell = new THREE.Mesh(cellGeo, accentMat);
  cell.position.set(0, 2.5 * scale, 0.57 * scale);
  cell.name = 'cell';
  group.add(cell);

  // Shoulder plates
  for (const side of [-1, 1]) {
    const spGeo = new THREE.BoxGeometry(0.55 * scale, 0.4 * scale, 0.9 * scale);
    const sp = new THREE.Mesh(spGeo, plateMat);
    sp.position.set(side * 1.02 * scale, 3.38 * scale, 0);
    group.add(sp);
    // Small glowing pip on shoulder
    const pipGeo = new THREE.BoxGeometry(0.08 * scale, 0.08 * scale, 0.08 * scale);
    const pip = new THREE.Mesh(pipGeo, accentMat);
    pip.position.set(side * 1.02 * scale, 3.6 * scale, 0.38 * scale);
    group.add(pip);
  }

  // ---- HEAD ----
  const headGeo = new THREE.BoxGeometry(0.68 * scale, 0.62 * scale, 0.62 * scale);
  const head = new THREE.Mesh(headGeo, plateMat);
  head.position.y = 3.88 * scale;
  head.name = 'nmHead';
  group.add(head);

  // Visor — wide glowing band
  const visGeo = new THREE.BoxGeometry(0.58 * scale, 0.16 * scale, 0.06 * scale);
  const vis = new THREE.Mesh(visGeo, visorMat);
  vis.position.set(0, 3.93 * scale, 0.33 * scale);
  vis.name = 'visor';
  group.add(vis);

  // Helmet top ridge
  const ridgeGeo = new THREE.BoxGeometry(0.1 * scale, 0.14 * scale, 0.52 * scale);
  const ridge = new THREE.Mesh(ridgeGeo, plateMat);
  ridge.position.set(0, 4.26 * scale, 0);
  group.add(ridge);

  // ---- ARMS ----
  const upperArmGeo = new THREE.BoxGeometry(0.45 * scale, 0.9 * scale, 0.45 * scale);
  const lowerArmGeo = new THREE.BoxGeometry(0.38 * scale, 0.75 * scale, 0.38 * scale);
  const fistGeo = new THREE.BoxGeometry(0.4 * scale, 0.36 * scale, 0.44 * scale);

  // Left arm
  const lUpper = new THREE.Mesh(upperArmGeo, armorMat);
  lUpper.position.set(-1.1 * scale, 2.65 * scale, 0);
  lUpper.name = 'lUpper';
  group.add(lUpper);
  const lLower = new THREE.Mesh(lowerArmGeo, plateMat);
  lLower.position.set(-1.1 * scale, 1.8 * scale, 0.06 * scale);
  lLower.name = 'lLower';
  group.add(lLower);
  const lFist = new THREE.Mesh(fistGeo, plateMat);
  lFist.position.set(-1.1 * scale, 1.2 * scale, 0.1 * scale);
  lFist.name = 'lFist';
  group.add(lFist);
  // Fist knuckle glow
  const lKnuckleGeo = new THREE.BoxGeometry(0.38 * scale, 0.07 * scale, 0.07 * scale);
  const lKnuckle = new THREE.Mesh(lKnuckleGeo, accentMat);
  lKnuckle.position.set(-1.1 * scale, 1.38 * scale, 0.32 * scale);
  lKnuckle.name = 'lKnuckle';
  group.add(lKnuckle);

  // Right arm
  const rUpper = new THREE.Mesh(upperArmGeo, armorMat);
  rUpper.position.set(1.1 * scale, 2.65 * scale, 0);
  rUpper.name = 'rUpper';
  group.add(rUpper);
  const rLower = new THREE.Mesh(lowerArmGeo, plateMat);
  rLower.position.set(1.1 * scale, 1.8 * scale, 0.06 * scale);
  rLower.name = 'rLower';
  group.add(rLower);
  const rFist = new THREE.Mesh(fistGeo, plateMat);
  rFist.position.set(1.1 * scale, 1.2 * scale, 0.1 * scale);
  rFist.name = 'rFist';
  group.add(rFist);
  const rKnuckleGeo = new THREE.BoxGeometry(0.38 * scale, 0.07 * scale, 0.07 * scale);
  const rKnuckle = new THREE.Mesh(rKnuckleGeo, accentMat);
  rKnuckle.position.set(1.1 * scale, 1.38 * scale, 0.32 * scale);
  rKnuckle.name = 'rKnuckle';
  group.add(rKnuckle);

  // ---- HEAVY MACHINE GUNS (Phase 3 — initially hidden) ----
  // Each HMG is a group of barrel+body+stand
  for (const side of [-1, 1]) {
    const hmgGroup = new THREE.Group();
    hmgGroup.name = side < 0 ? 'lHmg' : 'rHmg';
    hmgGroup.visible = false;

    // Body block
    const hmgBodyGeo = new THREE.BoxGeometry(0.28 * scale, 0.3 * scale, 0.82 * scale);
    const hmgBody = new THREE.Mesh(hmgBodyGeo, gunMat);
    hmgBody.position.set(0, 0, 0.15 * scale);
    hmgGroup.add(hmgBody);

    // 3 rotating barrels (side by side)
    for (let b = 0; b < 3; b++) {
      const bGeo = new THREE.CylinderGeometry(0.055 * scale, 0.055 * scale, 0.9 * scale, 6);
      const bMesh = new THREE.Mesh(bGeo, gunBarMat);
      bMesh.rotation.x = Math.PI / 2;
      bMesh.position.set((b - 1) * 0.11 * scale, 0, 0.7 * scale);
      hmgGroup.add(bMesh);
    }

    // Drum magazine
    const drumGeo = new THREE.CylinderGeometry(0.14 * scale, 0.14 * scale, 0.22 * scale, 8);
    const drum = new THREE.Mesh(drumGeo, gunMat);
    drum.position.set(0, -0.22 * scale, 0.15 * scale);
    hmgGroup.add(drum);

    // Muzzle flash point
    const mfGeo = new THREE.SphereGeometry(0.1 * scale, 4, 4);
    const mfMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0 });
    const mf = new THREE.Mesh(mfGeo, mfMat);
    mf.position.set(0, 0, 1.16 * scale);
    mf.name = side < 0 ? 'lMuzzle' : 'rMuzzle';
    hmgGroup.add(mf);

    // Position at arm/hand level
    hmgGroup.position.set(side * 1.1 * scale, 0.6 * scale, 0.3 * scale);
    group.add(hmgGroup);
  }

  // ---- LEGS ----
  const thighGeo = new THREE.BoxGeometry(0.52 * scale, 1.0 * scale, 0.52 * scale);
  const shinGeo = new THREE.BoxGeometry(0.44 * scale, 0.9 * scale, 0.44 * scale);
  const footGeo = new THREE.BoxGeometry(0.5 * scale, 0.22 * scale, 0.7 * scale);

  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'l' : 'r';
    const thigh = new THREE.Mesh(thighGeo, armorMat);
    thigh.position.set(side * 0.5 * scale, 1.18 * scale, 0);
    thigh.name = prefix + 'Thigh';
    group.add(thigh);

    const shin = new THREE.Mesh(shinGeo, plateMat);
    shin.position.set(side * 0.5 * scale, 0.26 * scale, 0.04 * scale);
    shin.name = prefix + 'Shin';
    group.add(shin);

    const foot = new THREE.Mesh(footGeo, plateMat);
    foot.position.set(side * 0.5 * scale, -0.2 * scale, 0.12 * scale);
    group.add(foot);

    // Calf booster thruster (for leap effect)
    const boostGeo = new THREE.CylinderGeometry(0.1 * scale, 0.14 * scale, 0.3 * scale, 6);
    const boostMat = new THREE.MeshLambertMaterial({ color: 0x0d1f0d, flatShading: true });
    const boost = new THREE.Mesh(boostGeo, boostMat);
    boost.position.set(side * 0.5 * scale, -0.06 * scale, -0.22 * scale);
    boost.name = prefix + 'Booster';
    group.add(boost);

    // Booster glow (hidden until leaping)
    const bgGeo = new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.2 * scale, 6);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.set(side * 0.5 * scale, -0.22 * scale, -0.22 * scale);
    bg.name = prefix + 'BoosterGlow';
    group.add(bg);
  }

  // ---- NANOSUIT GLOW LINES (edge strips on legs and torso sides) ----
  for (const side of [-1, 1]) {
    const glowGeo = new THREE.BoxGeometry(0.05 * scale, 0.9 * scale, 0.05 * scale);
    const glow1 = new THREE.Mesh(glowGeo, accentMat);
    glow1.position.set(side * 0.84 * scale, 2.5 * scale, 0.56 * scale);
    group.add(glow1);
    const glow2 = new THREE.Mesh(glowGeo.clone(), accentMat);
    glow2.position.set(side * 0.5 * scale, 0.6 * scale, 0.24 * scale);
    group.add(glow2);
  }

  // ---- SHIELD BUBBLE (phase 3 idle shield — initially invisible) ----
  const shieldGeo = new THREE.SphereGeometry(2.6 * scale, 10, 8);
  const shield = new THREE.Mesh(shieldGeo, shieldMat.clone());
  shield.position.y = 2.0 * scale;
  shield.name = 'shield';
  group.add(shield);

  return group;
}

function createHumanReaperMesh(color, scale) {
  const group = new THREE.Group();
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee, flatShading: true });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xffcc00, flatShading: true });
  const blueGlow = new THREE.MeshBasicMaterial({ color: 0x00ccff });

  // Core torso - sleek angular human tech
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2 * scale, 2.2 * scale, 0.8 * scale), whiteMat);
  torso.position.y = 2.2 * scale;
  group.add(torso);

  // Floating shoulder pads
  for (const side of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 * scale, 0), goldMat);
    pad.position.set(side * 1.2 * scale, 3.2 * scale, 0);
    group.add(pad);

    // Energy wings/beams
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 2.5 * scale, 0.1 * scale), blueGlow);
    beam.position.set(side * 1.5 * scale, 3.0 * scale, -0.4 * scale);
    beam.rotation.z = side * 0.4;
    group.add(beam);
  }

  // Head - sleek helmet with blue visor
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6 * scale, 0.7 * scale, 0.6 * scale), whiteMat);
  head.position.y = 3.6 * scale;
  group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.15 * scale, 0.1 * scale), blueGlow);
  visor.position.set(0, 3.65 * scale, 0.31 * scale);
  group.add(visor);

  // Large multi-barreled railguns on arms
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 1.5 * scale, 0.4 * scale), whiteMat);
    arm.position.set(side * 0.8 * scale, 2.2 * scale, 0);
    arm.name = side < 0 ? 'reaperArmL' : 'reaperArmR';
    group.add(arm);

    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, 1.8 * scale, 8), goldMat);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(side * 0.9 * scale, 1.8 * scale, 0.8 * scale);
    gun.name = side < 0 ? 'reaperGunL' : 'reaperGunR';
    group.add(gun);
  }

  return group;
}

export class Enemy {
  constructor(type, position, waveMultiplier = 1) {
    const stats = ENEMY_TYPES[type];
    this.type = type;
    this.health = stats.health * waveMultiplier;
    this.maxHealth = this.health;
    this.speed = stats.speed;
    this.damage = stats.damage * waveMultiplier;
    this.attackRange = stats.attackRange;
    this.attackCooldown = stats.attackCooldown;
    this.turnSpeed = stats.turnSpeed || null; // Add turnSpeed (null = instant)
    this.lastAttackTime = 0;
    this.attackAnimTimer = 0;
    this.score = stats.score;
    this.alive = true;
    this.deathTime = 0;
    this.lastStepTime = 0;

    // Boss flag
    this.isBoss = stats.isBoss || false;

    // Rotation lock for Shielder-style logic
    this.rotationTimer = 0;

    // Create mesh
    switch (type) {
      case 'drone': this.mesh = createDroneMesh(stats.color, stats.scale); break;
      case 'walker': this.mesh = createWalkerMesh(stats.color, stats.scale); break;
      case 'tank': this.mesh = createTankMesh(stats.color, stats.scale); break;
      case 'swarm': this.mesh = createSwarmMesh(stats.color, stats.scale); break;
      case 'sniper': this.mesh = createSniperMesh(stats.color, stats.scale); break;
      case 'mortar': this.mesh = createMortarMesh(stats.color, stats.scale); break;
      case 'medic_bot': this.mesh = createMedicBotMesh(stats.color, stats.scale); break;
      case 'spectre': this.mesh = createSpectreMesh(stats.color, stats.scale); break;
      case 'carmackion': this.mesh = createCarmackionMesh(stats.color, stats.scale); break;
      case 'darioltman': this.mesh = createDarioltmanMesh(stats.color, stats.scale); break;
      case 'nanoman': this.mesh = createNanomanMesh(stats.color, stats.scale); break;
      case 'shielder': this.mesh = createShielderMesh(stats.color, stats.scale); break;
      case 'pinky_mount': this.mesh = createPinkyMountMesh(stats.color, stats.scale); break;
      case 'pinky_rider': this.mesh = createPinkyRiderMesh(stats.color, stats.scale); break;
      case 'human_reaper': this.mesh = createHumanReaperMesh(stats.color, stats.scale); break;
      default: this.mesh = createWalkerMesh(stats.color, stats.scale);
    }

    this.mesh.position.copy(position);
    this.isGrappled = false;

    // Health bar
    const hpBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x330000 })
    );
    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    hpBarBg.position.y = this.getTopY() + 0.3;
    hpBar.position.y = this.getTopY() + 0.3;
    hpBar.position.z = 0.01;
    this.hpBarBg = hpBarBg;
    this.hpBar = hpBar;
    this.mesh.add(hpBarBg);
    this.mesh.add(hpBar);

    // Collision radius
    this.radius = stats.scale * 0.6;

    // Sniper-specific state
    if (type === 'sniper') {
      this.telegraphing = false;
      this.telegraphStart = 0;
      this.chargeStarted = false;
      this.shotFired = false;
      this.laserLockedPlayerPos = null; // world-space lock position for dodge window
      // Delay the first shot by a full attackCooldown so the sniper doesn't
      // immediately telegraph the moment it spawns.
      this.lastAttackTime = performance.now();
      // Laser beam mesh (BoxGeometry along +Z; scaled dynamically in update)
      const laserGeo = new THREE.BoxGeometry(0.06, 0.06, 1);
      const laserMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
      this.laserMesh = new THREE.Mesh(laserGeo, laserMat);
      this.laserMesh.visible = false;
      this.mesh.add(this.laserMesh);
    }

    // Mortar-specific state
    if (type === 'mortar') {
      this.lastAttackTime = performance.now(); // delay first shot
      this.mortarCallback = null; // set in main.js: (targetPos) => {}
      this.mortarFired = false;
    }

    if (type === 'medic_bot') {
      this.healTarget = null;
      this.healRange = 8.5;
      this.healPerSecond = 20;
      this.healPulse = 0;
      const beamMat = new THREE.LineBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.0 });
      const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      this.healBeam = new THREE.Line(beamGeo, beamMat);
      this.healBeam.visible = false;
      this.mesh.add(this.healBeam);
    }

    // ---- BOSS-SPECIFIC STATE ----
    if (this.isBoss) {
      this.phase = 1; // Boss phase (1, 2, 3)
      this.phaseChanged = false;
      this.bossSpawnTime = performance.now();
      this.lastSpecialAttack = 0;
      this.specialCooldown = 4000;
      this.spawnedMinions = false;
    }

    // CARMACKION — Humanoid warrior: LMG fire, rockets (ph2), lava (ph3)
    if (type === 'carmackion') {
      this.lastAttackTime = performance.now(); // prevent instant first shot
      // LMG fire
      this.lastLmg = performance.now();
      this.lmgCooldown = 220;       // ms between bullets (phase 1)
      this.lmgBulletCallback = null; // set in main.js
      this.lmgFired = false;         // flag for sound
      // Rockets (phase 2+)
      this.lastRocket = 0;
      this.rocketCooldown = 3500;
      this.rocketCallback = null;    // set in main.js
      this.rocketFired = false;      // flag for sound
      // Lava geysers (phase 3)
      this.lastLava = 0;
      this.lavaCooldown = 3500;
      this.lavaCallback = null;      // set in main.js
      // Arena state transitions
      this.arenaPhase2Set = false;
      this.arenaPhase3Set = false;
      this.arenaPhaseCallback = null; // set in main.js
      // Movement: strafe direction (1 = left, -1 = right)
      this.strafeDir = 1;
      this.lastStrafeSwitch = 0;
      this.strafeSwitchCooldown = 2200;
      // Leg bob
      this.walkCycle = 0;
    }

    // DARIOLTMAN — Shotgun warrior (ph1), zone explosions + snipers (ph2), demon form + meteors (ph3)
    if (type === 'darioltman') {
      this.lastAttackTime = performance.now();
      // Shotgun (phase 1-2)
      this.lastShotgun = performance.now() - 2000; // slight delay before first shot
      this.shotgunCooldown = 2500;
      this.shotgunFired = false;
      this.shotgunCallback = null;
      // Swamp minions (phase 1)
      this.lastSwampMinion = 0;
      this.swampMinionCooldown = 7000;
      this.minionSpawnCallback = null;
      this.spawnedMinions = false;
      // Snipers (phase 2)
      this.lastSniper = 0;
      this.sniperCooldown = 12000;
      this.sniperSpawnCallback = null;
      // Zone explosions (phase 2+)
      this.lastZoneExplosion = 0;
      this.zoneExplosionCooldown = 8000;
      this.zoneExplosionCallback = null;
      // Meteors (phase 3)
      this.lastMeteor = 0;
      this.meteorCooldown = 4500;
      this.meteorCallback = null;
      // Phase 3 demon form swap
      this.phase3MeshSwapped = false;
      // Arena transitions
      this.arenaPhase2Set = false;
      this.arenaPhase3Set = false;
      this.arenaPhaseCallback = null;
      // Movement
      this.walkCycle = 0;
      this.strafeDir = 1;
      this.lastStrafeSwitch = 0;
      this.strafeSwitchCooldown = 2200;
    }

    // NANOMAN — Crysis nanosuit final boss: melee (ph1), power leap (ph2), dual HMG + shield (ph3)
    if (type === 'nanoman') {
      this.lastAttackTime = performance.now();
      // Phase 1: melee punch alternating left/right
      this.punchSide = 1;          // 1 = right, -1 = left
      this.isPunching = false;
      this.punchTime = 0;
      this.punchDuration = 0.22;   // seconds arm extends
      this.punchDamageDealt = false;
      // Phase 2: power leap → slam
      this.isLeaping = false;
      this.leapPhase = 'none';     // 'rising' | 'hanging' | 'falling' | 'none'
      this.leapOrigin = null;
      this.leapTarget = null;
      this.leapY = 0;
      this.leapTimer = 0;
      this.lastLeap = 0;
      this.leapCooldown = 6000;
      this.leapMarkerCallback = null;
      this.leapImpactCallback = null;
      // Phase 3: dual HMG + 360 spin
      this.isSpinning = false;
      this.spinTimer = 0;
      this.spinDuration = 0;
      this.spinRounds = 0;         // how many full 360s done in current spin
      this.lastSpin = 0;
      this.spinCooldown = 5000;
      this.hmgBulletCallback = null;
      this.lastHmgShot = 0;
      this.hmgShotCooldown = 90;
      this.hmgFired = false;
      this.hmgArmed = false;       // set true after phase 3 starts
      // Phase 3 shield: active when NOT spinning
      this.shieldActive = false;   // starts false (shield only activates in ph3)
      this.shieldHP = 999;        // effectively immune when shielded
      // Arena callbacks
      this.arenaPhase2Set = false;
      this.arenaPhase3Set = false;
      this.arenaPhaseCallback = null;
      // Walk/punch animation
      this.walkCycle = 0;
    }

    // Pinky Mount specific state
    if (type === 'pinky_mount') {
      this.chargeState = 'idle'; // 'idle', 'windup', 'charge', 'cooldown'
      this.chargeTimer = 0;
      this.lastChargeTime = 0;
      this.chargeCooldown = 4000;
      this.chargeTarget = new THREE.Vector3();
      this.chargeDir = new THREE.Vector3();
      this.walkCycle = 0;
      this.rider = null; // Reference to the rider Enemy
    }

    // Pinky Rider specific state
    if (type === 'pinky_rider') {
      this.mountedOn = null; // Reference to the mount Enemy
      this.projectileCallback = null; // set in main.js
      this.walkCycle = 0;
    }
  }

  getTopY() {
    switch (this.type) {
      case 'drone': return 2.2;
      case 'walker': return 2.5 * 1.2;
      case 'tank': return 2.2 * 1.8;
      case 'swarm': return 1.2;
      case 'sniper': return 2.0;
      case 'mortar': return 1.8;
      case 'medic_bot': return 2.1;
      case 'spectre': return 2.1;
      case 'carmackion': return 3.5;
      case 'darioltman': return 5.0;
      case 'nanoman': return 5.5;
      case 'shielder': return 2.8;
      case 'pinky_mount': return 2.2;
      case 'pinky_rider': return 2.0;
      case 'human_reaper': return 4.0;
      default: return 2;
    }
  }

  takeDamage(amount, sourcePos = null, hitPoint = null) {
    if (amount <= 0) {
      // Healing passes a negative amount; subtracting it raises health.
      this.health = Math.min(this.maxHealth, this.health - amount);
      const healRatio = Math.max(0, this.health / this.maxHealth);
      this.hpBar.scale.x = healRatio;
      this.hpBar.position.x = -(1.2 * (1 - healRatio)) / 2;
      return;
    }

    if (hitPoint && window.spawnHitDecal) {
      window.spawnHitDecal(hitPoint);
    }

    // SHIELDER blocking logic
    if (this.type === 'shielder' && sourcePos) {
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
      const toSource = new THREE.Vector3().subVectors(sourcePos, this.mesh.position).setY(0).normalize();
      const dot = forward.dot(toSource);

      // Block if damage from the front (approx 120 degree cone)
      if (dot > 0.45) {
        this.shieldHitTime = performance.now(); // for shake animation
        if (window.playShieldClangSound) window.playShieldClangSound();
        if (window.particleSystem && hitPoint) {
          window.particleSystem.emit(hitPoint, 0xffcc00, 4); // Yellow sparks
        }
        return;
      }
    }

    // NANOMAN phase-3 idle shield: immune while not spinning
    if (this.type === 'nanoman' && this.shieldActive) {
      // absorb all damage silently — invulnerable
      return;
    }

    this.health = Math.max(0, this.health - amount);
    // Update hp bar
    const ratio = Math.max(0, this.health / this.maxHealth);
    this.hpBar.scale.x = ratio;
    this.hpBar.position.x = -(1.2 * (1 - ratio)) / 2;

    // Boss phase transitions
    if (this.isBoss) {
      const hpPercent = this.health / this.maxHealth;
      if (this.phase === 1 && hpPercent <= 0.66) {
        this.phase = 2;
        this.phaseChanged = true;
      } else if (this.phase === 2 && hpPercent <= 0.33) {
        this.phase = 3;
        this.phaseChanged = true;
      }
    }

    if (this.health <= 0) {
      if (this.alive && window.playEnemyDeathSound) {
        window.playEnemyDeathSound(this.isBoss);
      }
      this.alive = false;
      this.deathTime = performance.now();
    }
  }

  update(delta, playerPos, camera, allEnemies = []) {
    if (!this.alive || this.isGrappled) return 0;

    // Move toward player
    const dir = new THREE.Vector3()
      .subVectors(playerPos, this.mesh.position)
      .setY(0)
      .normalize();
    const dist = this.mesh.position.distanceTo(playerPos);
    const now = performance.now();

    // ---- SNIPER: maintain distance + telegraph attack ----
    if (this.type === 'sniper') {
      const PREFERRED_DIST = 16;
      const FLEE_DIST = 10;
      const TELEGRAPH_DURATION = 1500;

      // Movement: only when NOT telegraphing (laser is locked during telegraph)
      if (!this.telegraphing) {
        if (dist < FLEE_DIST) {
          this.mesh.position.sub(dir.clone().multiplyScalar(this.speed * delta));
        } else if (dist > PREFERRED_DIST + 3) {
          this.mesh.position.add(dir.clone().multiplyScalar(this.speed * delta));
        }
        // Always face player only when not locked
        this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
      }

      if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }

      // Start telegraph when attack is ready
      if (!this.telegraphing && now - this.lastAttackTime >= this.attackCooldown) {
        this.telegraphing = true;
        this.telegraphStart = now;
        this.chargeStarted = true;
        this.laserLockedPlayerPos = playerPos.clone(); // lock aim at current player position
        if (this.laserMesh) this.laserMesh.visible = true;
      }

      // Update telegraph visual and check if it's time to fire
      if (this.telegraphing) {
        const elapsed = now - this.telegraphStart;
        const t = elapsed / TELEGRAPH_DURATION;
        if (this.laserMesh) {
          // Use locked position distance so beam doesn't track the player
          const lockedDist = this.laserLockedPlayerPos
            ? new THREE.Vector3().subVectors(this.laserLockedPlayerPos, this.mesh.position).length()
            : dist;
          const barrelOffset = 1.4;
          const laserLen = Math.max(1, lockedDist - barrelOffset);
          this.laserMesh.scale.z = laserLen;
          this.laserMesh.position.set(0, 1.15, barrelOffset + laserLen * 0.5);
          this.laserMesh.material.opacity = 0.15 + Math.abs(Math.sin(t * Math.PI * 5)) * 0.75;
        }
        if (elapsed >= TELEGRAPH_DURATION) {
          this.telegraphing = false;
          this.lastAttackTime = now;
          if (this.laserMesh) {
            this.laserMesh.visible = false;
            this.laserMesh.material.opacity = 0.8;
          }
          this.shotFired = true;
          this.attackAnimTimer = 0.25;

          // Dodge window: only deal damage if player is still near the locked position
          if (this.laserLockedPlayerPos) {
            const dx = playerPos.x - this.laserLockedPlayerPos.x;
            const dz = playerPos.z - this.laserLockedPlayerPos.z;
            const dodgedDist = Math.sqrt(dx * dx + dz * dz);
            this.laserLockedPlayerPos = null;
            if (dodgedDist > 1.5) return 0; // player dodged the shot
          }

          return this.damage;
        }
      }

      return 0;
    }
    // ---- END SNIPER ----

    // ============================================================
    // MORTAR BOT — stays back, lobs shells with telegraph
    // ============================================================
    if (this.type === 'mortar') {
      const PREFERRED_DIST = 20;
      const FLEE_DIST = 12;

      // Move: keep distance from player
      if (dist < FLEE_DIST) {
        this.mesh.position.sub(dir.clone().multiplyScalar(this.speed * delta));
      } else if (dist > PREFERRED_DIST + 4) {
        this.mesh.position.add(dir.clone().multiplyScalar(this.speed * delta));
      }
      this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
      if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }

      // Barrel recoil animation
      if (this.attackAnimTimer > 0) {
        this.attackAnimTimer -= delta;
        const t = Math.max(0, this.attackAnimTimer / 0.3);
        const anim = Math.sin((1 - t) * Math.PI);
        this.mesh.traverse(child => {
          if (child.name === 'mortarBarrel') {
            child.rotation.x = -Math.PI / 4 - anim * 0.3;
          }
        });
      } else {
        this.mesh.traverse(child => {
          if (child.name === 'mortarBarrel') child.rotation.x = -Math.PI / 4;
        });
      }

      // Fire — callback tells main.js to handle projectile + telegraph
      if (now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        this.attackAnimTimer = 0.3;
        this.mortarFired = true;
        if (this.mortarCallback) {
          this.mortarCallback(playerPos.clone());
        }
      }

      return 0;
    }
    // ---- END MORTAR ----

    // ============================================================
    // SHIELDER — slow approach, frontal block, heavy mace attack
    // ============================================================
    if (this.type === 'shielder') {
      const scale = ENEMY_TYPES.shielder.scale;
      
      // Movement
      if (dist > this.attackRange * 0.7) {
        this.mesh.position.add(dir.clone().multiplyScalar(this.speed * delta));
      }
      // ---- SHIELDER Rotation Logic (Target Acquisition & Lock) ----
      if (this.rotationTimer > 0) {
        this.rotationTimer -= delta;
      }
      
      const isLocked = this.rotationTimer > 0 || this.isPunching;

      if (!isLocked && this.turnSpeed) {
        // Calculate target rotation to face player
        const targetQuat = new THREE.Quaternion();
        const dummy = new THREE.Object3D();
        dummy.position.copy(this.mesh.position);
        dummy.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
        targetQuat.copy(dummy.quaternion);

        // Turn towards player
        this.mesh.quaternion.rotateTowards(targetQuat, this.turnSpeed * delta);

        // Once facing player (dot > 0.996 = ~5.1 degrees), lock rotation for a few seconds
        const currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position).setY(0).normalize();
        if (currentForward.dot(toPlayer) > 0.996) {
          this.rotationTimer = 2.0; // Stay locked for 4 seconds
        }
      }
      if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }

      // Leg bobbing
      this.walkCycle = (this.walkCycle || 0) + delta * this.speed * 4;
      const legAnim = Math.sin(this.walkCycle) * 0.3;
      // Shield shake on block
      let shieldShake = 0;
      if (this.shieldHitTime && now - this.shieldHitTime < 250) {
        const t = (now - this.shieldHitTime) / 250;
        shieldShake = Math.sin(t * Math.PI * 10) * 0.1 * (1 - t);
      }

      this.mesh.traverse(child => {
        if (child.name === 'shieldGroup') {
          child.position.x = -0.75 * scale + shieldShake;
          child.rotation.z = shieldShake * 2;
        }
        if (child.name === 'maceGroup') {
          // Idle mace sway
          child.rotation.x = Math.sin(this.walkCycle * 0.5) * 0.1;
        }
      });

      // Attack logic
      if (!this.isPunching && dist <= this.attackRange && now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        this.isPunching = true; // Use isPunching as a general melee flag
        this.punchTime = 0;
        this.punchDamageDealt = false;
        if (window.playMeleeWhooshSound) window.playMeleeWhooshSound();
      }

      if (this.isPunching) {
        const attackDuration = 0.5;
        this.punchTime += delta;
        const t = Math.min(this.punchTime / attackDuration, 1);
        const animVal = Math.sin(t * Math.PI); // 0 -> 1 -> 0

        this.mesh.traverse(child => {
          if (child.name === 'armR') {
            child.rotation.x = -animVal * 1.5;
            child.position.z = animVal * 0.8 * scale;
          }
          if (child.name === 'maceGroup') {
            child.rotation.x = -animVal * 0.5;
          }
        });

        if (t >= 0.5 && !this.punchDamageDealt && dist <= this.attackRange + 0.5) {
          this.punchDamageDealt = true;
          if (window.playMaceHitSound) window.playMaceHitSound();
          return { damage: this.damage, knockback: true }; // Flag for knockback
        }

        if (t >= 1) {
          this.isPunching = false;
        }
      }

      return 0;
    }

    // ============================================================
    // PINKY MOUNT — Bulky beast, charges at player
    // ============================================================
    if (this.type === 'pinky_mount') {
      const scale = ENEMY_TYPES.pinky_mount.scale;
      
      if (this.chargeState === 'idle') {
        // Move toward player
        if (dist > this.attackRange * 0.8) {
          this.mesh.position.add(dir.clone().multiplyScalar(this.speed * delta));
        }
        this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));

        // Start charge?
        if (dist < 15 && now - this.lastChargeTime > this.chargeCooldown) {
          this.chargeState = 'windup';
          this.chargeTimer = 0;
          this.chargeTarget.copy(playerPos);
          this.chargeDir.copy(dir);
        }
      } else if (this.chargeState === 'windup') {
        this.chargeTimer += delta;
        // Shake mesh
        const shake = Math.sin(this.chargeTimer * 40) * 0.05;
        this.mesh.position.x += shake;
        this.mesh.position.z += shake;
        
        if (this.chargeTimer >= 1.0) {
          this.chargeState = 'charge';
          this.chargeTimer = 0;
          if (window.playMeleeWhooshSound) window.playMeleeWhooshSound();
        }
      } else if (this.chargeState === 'charge') {
        this.chargeTimer += delta;
        const chargeSpeed = this.speed * 3.5;
        this.mesh.position.add(this.chargeDir.clone().multiplyScalar(chargeSpeed * delta));
        
        // Hit player?
        if (dist < 2.0) {
          this.chargeState = 'cooldown';
          this.chargeTimer = 0;
          this.lastChargeTime = now;
          return { damage: this.damage, knockback: true };
        }
        
        if (this.chargeTimer >= 1.2) {
          this.chargeState = 'cooldown';
          this.chargeTimer = 0;
          this.lastChargeTime = now;
        }
      } else if (this.chargeState === 'cooldown') {
        this.chargeTimer += delta;
        if (this.chargeTimer >= 0.8) {
          this.chargeState = 'idle';
        }
      }

      // Leg animations
      this.walkCycle = (this.walkCycle || 0) + delta * this.speed * 4;
      const legAnim = Math.sin(this.walkCycle) * 0.3;
      this.mesh.traverse(child => {
        if (child.name && child.name.startsWith('leg')) {
          const index = parseInt(child.name.slice(3));
          child.rotation.x = (index % 2 === 0 ? 1 : -1) * legAnim;
        }
        if (child.name === 'head') {
          child.rotation.x = this.chargeState === 'windup' ? Math.sin(this.chargeTimer * 20) * 0.1 : 0;
        }
      });

      if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }
      return 0;
    }

    // ============================================================
    // PINKY RIDER — Ranged attacker, can be mounted
    // ============================================================
    if (this.type === 'pinky_rider') {
      const scale = ENEMY_TYPES.pinky_rider.scale;

      if (this.mountedOn && this.mountedOn.alive) {
        // Position relative to mount
        const mountPos = this.mountedOn.mesh.position;
        const mountQuat = this.mountedOn.mesh.quaternion;
        
        // Target position: slightly above and behind the mount's center
        const offset = new THREE.Vector3(0, 1.35 * this.mountedOn.mesh.scale.y, -0.15 * this.mountedOn.mesh.scale.z);
        offset.applyQuaternion(mountQuat);
        
        this.mesh.position.copy(mountPos).add(offset);
        this.mesh.quaternion.copy(mountQuat);
        // But also look at player
        this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
      } else {
        // Mounted mode off
        this.mountedOn = null;
        // Normal movement
        if (dist > 12) {
          this.mesh.position.add(dir.clone().multiplyScalar(this.speed * delta));
        } else if (dist < 8) {
          this.mesh.position.sub(dir.clone().multiplyScalar(this.speed * 0.5 * delta));
        }
        this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
      }

      // Attack logic
      if (now - this.lastAttackTime > this.attackCooldown) {
        this.lastAttackTime = now;
        this.attackAnimTimer = 0.22;
        if (this.projectileCallback) {
          const gunMuzzle = new THREE.Vector3(0.35 * scale, 1.1 * scale, 1.0 * scale);
          this.mesh.localToWorld(gunMuzzle);
          this.projectileCallback(gunMuzzle, playerPos.clone());
        }
      }

      // Anim
      if (this.attackAnimTimer > 0) {
        this.attackAnimTimer -= delta;
        const t = this.attackAnimTimer / 0.22;
        this.mesh.traverse(c => {
          if (c.name === 'gunGroup') {
            c.position.z = -0.15 * Math.sin(t * Math.PI);
          }
        });
      }

      if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }
      return 0;
    }

    // ============================================================
    // MEDIC BOT — support-only healer
    // ============================================================
    if (this.type === 'medic_bot') {
      let target = null;
      let bestScore = Infinity;
      for (const ally of allEnemies) {
        if (!ally || !ally.alive || ally === this || ally.isBoss) continue;
        if (ally.health >= ally.maxHealth) continue;
        const distToAlly = ally.mesh.position.distanceTo(this.mesh.position);
        const ratio = ally.health / ally.maxHealth;
        const score = ratio + distToAlly * 0.02;
        if (score < bestScore) {
          bestScore = score;
          target = ally;
        }
      }

      if (target) {
        this.healTarget = target;
        const toTarget = new THREE.Vector3().subVectors(target.mesh.position, this.mesh.position).setY(0);
        const tDist = toTarget.length();
        if (tDist > this.healRange * 0.9) {
          this.mesh.position.add(toTarget.normalize().multiplyScalar(this.speed * delta));
        }
        this.mesh.lookAt(new THREE.Vector3(target.mesh.position.x, this.mesh.position.y, target.mesh.position.z));

        if (this.healBeam) {
          this.healBeam.visible = true;
          const localStart = new THREE.Vector3(0, 1.25, 0.25);
          const localEnd = this.mesh.worldToLocal(target.mesh.position.clone().add(new THREE.Vector3(0, target.getTopY() * 0.65, 0)));
          this.healBeam.geometry.setFromPoints([localStart, localEnd]);
          this.healPulse += delta * 8;
          this.healBeam.material.opacity = 0.35 + Math.abs(Math.sin(this.healPulse)) * 0.35;
        }

        if (tDist <= this.healRange) {
          target.takeDamage(-this.healPerSecond * delta);
        }
      } else {
        this.healTarget = null;
        if (this.healBeam) this.healBeam.visible = false;
        if (dist > 10) {
          this.mesh.position.add(dir.clone().multiplyScalar(this.speed * 0.6 * delta));
        } else if (dist < 6) {
          this.mesh.position.sub(dir.clone().multiplyScalar(this.speed * 0.45 * delta));
        }
        this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
      }

      if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }
      return 0;
    }

    // ============================================================
    // SPECTRE — stealth melee assassin
    // ============================================================
    if (this.type === 'spectre') {
      if (dist > this.attackRange * 0.8) {
        this.mesh.position.add(dir.clone().multiplyScalar(this.speed * delta));
      }
      this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
      if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }

      const reveal = dist < 6 ? (0.18 + (1 - dist / 6) * 0.26) : (0.02 + Math.abs(Math.sin(now * 0.006)) * 0.03);
      this.mesh.traverse(child => {
        if (!child.isMesh || !child.material || child.material.opacity === undefined) return;
        child.material.transparent = true;
        child.material.opacity = reveal;
        child.material.depthWrite = false;
      });

      if (dist <= this.attackRange && now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        this.attackAnimTimer = 0.25;
        return this.damage;
      }
      return 0;
    }

    // ============================================================
    // CARMACKION — Humanoid Doom Slayer-style Warrior AI
    // ============================================================
    if (this.type === 'carmackion') {
      const scale = ENEMY_TYPES.carmackion.scale;

      // ---- Phase-based speed ----
      const moveSpeed = this.phase === 3 ? this.speed * 1.5
        : this.phase === 2 ? this.speed * 1.25
          : this.speed;
      const lmgCd = this.phase === 3 ? 100
        : this.phase === 2 ? 150
          : this.lmgCooldown;

      // ---- One-time arena changes ----
      if (this.phase >= 2 && !this.arenaPhase2Set) {
        this.arenaPhase2Set = true;
        if (this.arenaPhaseCallback) this.arenaPhaseCallback(2);
      }
      if (this.phase >= 3 && !this.arenaPhase3Set) {
        this.arenaPhase3Set = true;
        if (this.arenaPhaseCallback) this.arenaPhaseCallback(3);
      }

      // ---- Preferred combat distance ----
      const preferredDist = this.phase === 3 ? 6
        : this.phase === 2 ? 8
          : 10;

      // ---- Movement: approach to combat range then strafe ----
      if (dist > preferredDist + 2) {
        this.mesh.position.add(dir.clone().multiplyScalar(moveSpeed * delta));
      } else if (dist < preferredDist - 2) {
        // Back off slightly to maintain range
        this.mesh.position.sub(dir.clone().multiplyScalar(moveSpeed * 0.5 * delta));
      }

      // Strafe side-to-side (switch direction periodically)
      if (now - this.lastStrafeSwitch > this.strafeSwitchCooldown) {
        this.lastStrafeSwitch = now;
        this.strafeDir *= -1;
      }
      const strafeVec = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir);
      this.mesh.position.add(strafeVec.multiplyScalar(moveSpeed * 0.7 * delta));

      // Always face player
      this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
      if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }

      // ---- Walking animation ----
      this.walkCycle = (this.walkCycle || 0) + delta * moveSpeed * 3;
      const legSwing = Math.sin(this.walkCycle) * 0.25;
      this.mesh.traverse(child => {
        if (child.name === 'lThigh') child.rotation.x = legSwing;
        if (child.name === 'rThigh') child.rotation.x = -legSwing;
        // LMG barrel recoil flash
        if (child.name === 'muzzle') {
          if (this.lmgFired) {
            child.material.opacity = 0.9;
            setTimeout(() => { if (child.material) child.material.opacity = 0; }, 40);
          }
        }
        // Right arm gun-fire recoil
        if (child.name === 'rArm' && this.lmgFired) {
          child.rotation.x = -0.2;
        } else if (child.name === 'rArm') {
          child.rotation.x += (0 - child.rotation.x) * 0.15;
        }
      });
      this.lmgFired = false;

      // ---- LMG fire (all phases) ----
      if (dist <= this.attackRange && now - this.lastLmg >= lmgCd) {
        this.lastLmg = now;
        if (this.lmgBulletCallback) {
          const muzzleWorldPos = new THREE.Vector3(0.62 * scale, 1.88 * scale, 1.06 * scale);
          this.mesh.localToWorld(muzzleWorldPos);
          this.lmgBulletCallback(muzzleWorldPos, playerPos.clone());
        }
        this.lmgFired = true;
      }

      // ---- Rockets (phase 2+) ----
      if (this.phase >= 2 && dist <= this.attackRange && now - this.lastRocket >= this.rocketCooldown) {
        this.lastRocket = now;
        const rocketCd = this.phase === 3 ? 2500 : 3500;
        this.rocketCooldown = rocketCd;
        if (this.rocketCallback) {
          const muzzleWorldPos = new THREE.Vector3(0.62 * scale, 1.88 * scale, 1.06 * scale);
          this.mesh.localToWorld(muzzleWorldPos);
          this.rocketCallback(muzzleWorldPos, playerPos.clone());
        }
        this.rocketFired = true;
      }

      // ---- Lava geysers (phase 3) ----
      if (this.phase >= 3 && now - this.lastLava >= this.lavaCooldown) {
        this.lastLava = now;
        if (this.lavaCallback) this.lavaCallback();
      }

      return 0; // damage is dealt via projectiles
    }

    // ============================================================
    // DARIOLTMAN — Shotgun Warrior / Mega-Demon Boss AI
    // ============================================================
    if (this.type === 'darioltman') {
      const scale = ENEMY_TYPES.darioltman.scale;

      // ---- One-time phase transitions ----
      if (this.phase >= 2 && !this.arenaPhase2Set) {
        this.arenaPhase2Set = true;
        if (this.arenaPhaseCallback) this.arenaPhaseCallback(2);
      }
      if (this.phase >= 3 && !this.arenaPhase3Set) {
        this.arenaPhase3Set = true;
        if (this.arenaPhaseCallback) this.arenaPhaseCallback(3);
      }

      // ---- Phase 3: swap mesh to demon form (once) ----
      if (this.phase >= 3 && !this.phase3MeshSwapped) {
        this.phase3MeshSwapped = true;
        this.mesh.traverse(c => {
          if (c.name === 'normalForm') c.visible = false;
          if (c.name === 'demonForm') c.visible = true;
        });
      }

      const moveSpeed = this.phase === 3 ? this.speed * 1.7
        : this.phase === 2 ? this.speed * 1.3
          : this.speed;

      // Phase 1-2 prefers shotgun range, phase 3 rushes close
      const preferredDist = this.phase >= 3 ? 5 : 10;

      // ---- Animations ----
      this.walkCycle = (this.walkCycle || 0) + delta * moveSpeed * 2.2;
      const swingAmt = Math.sin(this.walkCycle) * 0.22;
      this.mesh.traverse(child => {
        if (child.name === 'wing1') child.rotation.y = -0.4 + Math.sin(now * 0.003) * 0.18;
        if (child.name === 'wing2') child.rotation.y = 0.4 - Math.sin(now * 0.003) * 0.18;
        if (child.name === 'aura' || child.name === 'dAura') {
          child.rotation.z += delta * 0.6;
          child.material.opacity = 0.2 + Math.abs(Math.sin(now * 0.005)) * 0.2;
        }
        if (child.name === 'dWing1') child.rotation.z = 0.25 + Math.sin(now * 0.003) * 0.12;
        if (child.name === 'dWing2') child.rotation.z = -0.25 - Math.sin(now * 0.003) * 0.12;
        if (child.name === 'arm1' || child.name === 'dArm1') child.rotation.x = swingAmt;
        if (child.name === 'arm2' || child.name === 'dArm2') child.rotation.x = -swingAmt;
        if (child.name === 'sgMuzzle' && this.shotgunFired) {
          child.material.opacity = 0.9;
          setTimeout(() => { if (child.material) child.material.opacity = 0; }, 80);
        }
      });
      this.shotgunFired = false;

      // ---- Movement ----
      if (dist > preferredDist + 2) {
        this.mesh.position.add(dir.clone().multiplyScalar(moveSpeed * delta));
      } else if (dist < preferredDist - 3 && this.phase < 3) {
        // Back off to maintain shotgun range
        this.mesh.position.sub(dir.clone().multiplyScalar(moveSpeed * 0.4 * delta));
      }

      // Strafe
      if (now - this.lastStrafeSwitch > this.strafeSwitchCooldown) {
        this.lastStrafeSwitch = now;
        this.strafeDir *= -1;
      }
      const strafeVec = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir);
      this.mesh.position.add(strafeVec.multiplyScalar(moveSpeed * 0.5 * delta));

      this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
      if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }

      // ---- Shotgun attack (phase 1-2, range <= 15) ----
      if (this.phase <= 2 && dist <= 15 && now - this.lastShotgun >= this.shotgunCooldown) {
        this.lastShotgun = now;
        if (this.shotgunCallback) {
          const muzzleWorldPos = new THREE.Vector3(0.72 * scale, 1.65 * scale, 1.1 * scale);
          this.mesh.localToWorld(muzzleWorldPos);
          this.shotgunCallback(muzzleWorldPos, playerPos.clone(), dist);
        }
        this.shotgunFired = true;
      }

      // ---- Swamp minions (phase 1) ----
      if (this.phase === 1 && now - this.lastSwampMinion > this.swampMinionCooldown && this.minionSpawnCallback) {
        this.lastSwampMinion = now;
        this.minionSpawnCallback(this.mesh.position, 'swamp');
        this.spawnedMinions = true;
      }

      // ---- Snipers (phase 2+) ----
      if (this.phase >= 2 && now - this.lastSniper > this.sniperCooldown && this.sniperSpawnCallback) {
        this.lastSniper = now;
        this.sniperSpawnCallback(this.mesh.position);
        this.spawnedMinions = true;
      }

      // ---- Zone explosions (phase 2+) ----
      if (this.phase >= 2 && now - this.lastZoneExplosion > this.zoneExplosionCooldown && this.zoneExplosionCallback) {
        this.lastZoneExplosion = now;
        this.zoneExplosionCallback();
      }

      // ---- Meteor barrage (phase 3) ----
      if (this.phase >= 3 && now - this.lastMeteor > this.meteorCooldown && this.meteorCallback) {
        this.lastMeteor = now;
        this.meteorCallback(playerPos.clone());
      }

      // ---- Melee attack (phase 3 demon close-range) ----
      if (dist <= this.attackRange && now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        return this.phase >= 3 ? this.damage * 2 : this.damage;
      }

      return 0;
    }

    // ============================================================
    // NANOMAN — Crysis Nanosuit Final Boss AI
    // ============================================================
    if (this.type === 'nanoman') {
      const scale = ENEMY_TYPES.nanoman.scale;

      // ---- One-time phase transitions ----
      if (this.phase >= 2 && !this.arenaPhase2Set) {
        this.arenaPhase2Set = true;
        if (this.arenaPhaseCallback) this.arenaPhaseCallback(2);
      }
      if (this.phase >= 3 && !this.arenaPhase3Set) {
        this.arenaPhase3Set = true;
        this.hmgArmed = true;
        // Show HMG arms, hide fists
        this.mesh.traverse(c => {
          if (c.name === 'lHmg' || c.name === 'rHmg') c.visible = true;
          if (c.name === 'lFist' || c.name === 'rFist') c.visible = false;
          if (c.name === 'lKnuckle' || c.name === 'rKnuckle') c.visible = false;
          if (c.name === 'lLower' || c.name === 'rLower') c.visible = false;
        });
        if (this.arenaPhaseCallback) this.arenaPhaseCallback(3);
      }

      const moveSpeed = this.phase === 1 ? this.speed
        : this.phase === 2 ? this.speed * 1.3
          : this.speed * 1.1;

      // ============================================================
      // PHASE 3: Dual HMG + 360 Spin + idle Shield
      // ============================================================
      if (this.phase >= 3) {

        // -- Idle shield: on when not spinning --
        const shouldShield = !this.isSpinning;
        if (shouldShield !== this.shieldActive) {
          this.shieldActive = shouldShield;
          this.mesh.traverse(c => {
            if (c.name === 'shield') {
              c.material.opacity = shouldShield ? 0.18 : 0;
              c.visible = true; // always in scene, opacity controls visibility
            }
          });
        }

        // -- Initiate spin --
        if (!this.isSpinning && now - this.lastSpin > this.spinCooldown) {
          this.isSpinning = true;
          this.spinRounds = 2 + Math.floor(Math.random() * 2); // 2-3 full 360s
          this.spinDuration = this.spinRounds * 2.0; // ~2s per full rotation
          this.spinTimer = 0;
          this.shieldActive = false;
          this.mesh.traverse(c => {
            if (c.name === 'shield') c.material.opacity = 0;
          });
        }

        // -- During spin: rotate and fire HMG --
        if (this.isSpinning) {
          const spinSpeed = (Math.PI * 2 * this.spinRounds) / this.spinDuration;
          this.mesh.rotation.y += spinSpeed * delta;
          this.spinTimer += delta;

          // Fire from both HMGs while spinning
          if (now - this.lastHmgShot >= this.hmgShotCooldown && this.hmgBulletCallback) {
            this.lastHmgShot = now;
            // Fire from both HMG muzzle positions (world space)
            for (const side of ['l', 'r']) {
              const localMuzzle = new THREE.Vector3(
                side === 'l' ? -1.1 * scale : 1.1 * scale,
                0.6 * scale,   // lower to ~waist/arm barrel height so bullets can hit player
                1.5 * scale
              );
              this.mesh.localToWorld(localMuzzle);
              this.hmgBulletCallback(localMuzzle, side);
            }
            this.hmgFired = true;
          }

          // End spin
          if (this.spinTimer >= this.spinDuration) {
            this.isSpinning = false;
            this.lastSpin = now;
            this.hmgFired = false;
            // Re-activate shield
            this.shieldActive = true;
            this.mesh.traverse(c => {
              if (c.name === 'shield') c.material.opacity = 0.18;
            });
          }
        }

        if (!this.isSpinning) {
          // Move toward player slowly
          if (dist > this.attackRange * 0.7) {
            this.mesh.position.add(dir.clone().multiplyScalar(moveSpeed * delta));
          }
          this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
        }

        // HMG muzzle flash animation
        this.mesh.traverse(c => {
          if ((c.name === 'lMuzzle' || c.name === 'rMuzzle') && this.hmgFired) {
            c.material.opacity = 0.95;
            setTimeout(() => { if (c.material) c.material.opacity = 0; }, 50);
          }
          // Animate shield pulse
          if (c.name === 'shield' && this.shieldActive) {
            c.material.opacity = 0.12 + Math.abs(Math.sin(now * 0.004)) * 0.1;
            c.rotation.y += delta * 0.8;
          }
          // Booster glow during spin
          if ((c.name === 'lBoosterGlow' || c.name === 'rBoosterGlow')) {
            c.material.opacity = this.isSpinning ? 0.7 + Math.sin(now * 0.02) * 0.2 : 0;
          }
        });
        this.hmgFired = false;

        if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }
        return 0;
      }

      // ============================================================
      // PHASE 2: Power Leap → Slam
      // ============================================================
      if (this.phase >= 2) {

        // Animations: booster glow while leaping
        this.mesh.traverse(c => {
          if ((c.name === 'lBoosterGlow' || c.name === 'rBoosterGlow')) {
            c.material.opacity = this.isLeaping ? 0.8 : 0;
          }
        });

        // -- LEAPING STATE MACHINE --
        if (this.isLeaping) {
          const HANG_TIME = 0.6;
          const RISE_TIME = 0.55;
          const FALL_TIME = 0.55;

          if (this.leapPhase === 'rising') {
            this.leapTimer += delta;
            const t = Math.min(this.leapTimer / RISE_TIME, 1);
            this.mesh.position.y = this.leapY + Math.sin(t * Math.PI * 0.5) * 18 * scale;
            if (t >= 1) {
              this.leapPhase = 'hanging';
              this.leapTimer = 0;
            }
          } else if (this.leapPhase === 'hanging') {
            this.leapTimer += delta;
            // Stay airborne, aim toward player target
            if (this.leapTimer >= HANG_TIME) {
              this.leapPhase = 'falling';
              this.leapTimer = 0;
            }
          } else if (this.leapPhase === 'falling') {
            this.leapTimer += delta;
            const t = Math.min(this.leapTimer / FALL_TIME, 1);
            const startY = this.leapY + 18 * scale;
            const targetY = 0;
            this.mesh.position.y = startY + (targetY - startY) * (t * t); // quadratic fall
            // Lerp XZ toward target
            if (this.leapTarget) {
              this.mesh.position.x += (this.leapTarget.x - this.mesh.position.x) * delta * 4;
              this.mesh.position.z += (this.leapTarget.z - this.mesh.position.z) * delta * 4;
            }
            if (t >= 1) {
              // Impact
              this.mesh.position.y = 0;
              this.isLeaping = false;
              this.leapPhase = 'none';
              this.lastLeap = now;
              if (this.leapImpactCallback) {
                this.leapImpactCallback(this.mesh.position.clone());
              }
            }
          }

          this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
          if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }
          return 0;
        }

        // Initiate leap when far enough + cooldown passed
        if (!this.isLeaping && now - this.lastLeap > this.leapCooldown && dist > 6) {
          this.isLeaping = true;
          this.leapPhase = 'rising';
          this.leapTimer = 0;
          this.leapY = this.mesh.position.y;
          this.leapTarget = playerPos.clone();
          // Warn player 2.5s before impact (now + rise + hang = ~1.15s, but marker placed immediately)
          if (this.leapMarkerCallback) {
            this.leapMarkerCallback(this.leapTarget.clone());
          }
        }
      }

      // ============================================================
      // PHASE 1 & 2 GROUND MOVEMENT + MELEE PUNCH
      // ============================================================
      this.walkCycle = (this.walkCycle || 0) + delta * moveSpeed * 2.5;
      const legSwing = Math.sin(this.walkCycle) * 0.32;

      // Punch animation
      let lPunchT = 0;
      let rPunchT = 0;
      if (this.isPunching) {
        this.punchTime += delta;
        const punchT = Math.min(this.punchTime / this.punchDuration, 1);
        // extend/retract: peak at t=0.5
        const ext = Math.sin(punchT * Math.PI);
        if (this.punchSide > 0) rPunchT = ext; else lPunchT = ext;

        // Deal damage at peak extension (once per punch)
        if (punchT >= 0.5 && !this.punchDamageDealt && dist <= this.attackRange) {
          this.punchDamageDealt = true;
          // damage returned at bottom
        }
        if (punchT >= 1) {
          this.isPunching = false;
          this.punchSide *= -1; // alternate
        }
      }

      this.mesh.traverse(c => {
        if (c.name === 'lThigh') c.rotation.x = legSwing;
        if (c.name === 'rThigh') c.rotation.x = -legSwing;
        // Punch arm extension along Z
        if (c.name === 'lUpper') c.rotation.x = -lPunchT * 0.9;
        if (c.name === 'rUpper') c.rotation.x = -rPunchT * 0.9;
        // Knuckle glow pulsed during punch
        if (c.name === 'lKnuckle') c.material.color.setHex(lPunchT > 0.3 ? 0x00ffff : 0x00ff66);
        if (c.name === 'rKnuckle') c.material.color.setHex(rPunchT > 0.3 ? 0x00ffff : 0x00ff66);
        // Shield hidden in ph1-2
        if (c.name === 'shield') c.material.opacity = 0;
      });

      // Movement: approach player
      if (dist > this.attackRange * 0.6 && !this.isLeaping) {
        this.mesh.position.add(dir.clone().multiplyScalar(moveSpeed * delta));
      }

      this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
      if (camera) { this.hpBarBg.lookAt(camera.position); this.hpBar.lookAt(camera.position); }

      // Initiate melee punch
      if (!this.isPunching && dist <= this.attackRange && now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        this.isPunching = true;
        this.punchTime = 0;
        this.punchDamageDealt = false;
      }

      // Return damage if punch peak reached this frame
      if (this.isPunching && this.punchDamageDealt) {
        return this.damage;
      }
      return 0;
    }

    // ============================================================
    // HUMAN REAPER — Secret Super Boss
    // ============================================================
    if (this.type === 'human_reaper') {
      const scale = ENEMY_TYPES.human_reaper.scale;
      
      // Face player
      this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
      
      // Aggressive move speed
      const moveSpeed = this.speed;
      if (dist > 8) {
        this.mesh.position.add(dir.clone().multiplyScalar(moveSpeed * delta));
      } else if (dist < 5) {
        this.mesh.position.sub(dir.clone().multiplyScalar(moveSpeed * 0.5 * delta));
      }

      // Rapid fire projectiles
      if (now - this.lastAttackTime > this.attackCooldown) {
        this.lastAttackTime = now;
        if (this.hmgBulletCallback) {
          // Fire from both railguns
          for (const side of ['l', 'r']) {
            const localMuzzle = new THREE.Vector3(
              side === 'l' ? -0.9 * scale : 0.9 * scale,
              1.8 * scale,
              1.8 * scale
            );
            this.mesh.localToWorld(localMuzzle);
            this.hmgBulletCallback(localMuzzle, side);
          }
        }
      }

      // Animate railguns (slight recoil)
      this.mesh.traverse(c => {
        if (c.name === 'reaperGunL' || c.name === 'reaperGunR') {
          const side = c.name === 'reaperGunL' ? -1 : 1;
          const recoil = Math.max(0, 1 - (now - this.lastAttackTime) / 200);
          c.position.z = 0.8 * scale - 0.3 * scale * recoil;
        }
      });

      if (camera) { 
        this.hpBarBg.lookAt(camera.position); 
        this.hpBar.lookAt(camera.position); 
      }
      
      return 0;
    }

    if (dist > this.attackRange * 0.8) {
      this.mesh.position.add(dir.multiplyScalar(this.speed * delta));
    }

    // Face player
    this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));

    // Hp bar face camera
    if (camera) {
      this.hpBarBg.lookAt(camera.position);
      this.hpBar.lookAt(camera.position);
    }

    // Bobbing animation
    if (this.type === 'drone') {
      this.mesh.position.y = 0 + Math.sin(performance.now() * 0.003) * 0.3;
    }
    if (this.type === 'swarm') {
      this.mesh.position.y = Math.sin(performance.now() * 0.005 + this.mesh.position.x) * 0.2;
    }

    // Can attack?
    if (dist <= this.attackRange && now - this.lastAttackTime >= this.attackCooldown) {
      this.lastAttackTime = now;
      this.attackAnimTimer = 0.4; // Trigger attack animation
      return this.damage; // return damage to apply
    }

    // ---- ATTACK ANIMATIONS ----
    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer -= delta;
      const t = Math.max(0, this.attackAnimTimer / 0.4); // 1.0 -> 0.0 (extended to 0.4s)
      // Animation peak at t=0.5 (sin wave peak)
      const animVal = Math.sin((1 - t) * Math.PI); // 0 -> 1 -> 0

      const stats = ENEMY_TYPES[this.type];
      const scale = stats.scale;

      this.mesh.traverse(child => {
        if (this.type === 'drone' && child.name === 'droneBody') {
          // Drone: full-body lunge + spin
          child.position.z = 0.7 * animVal;
          child.position.y = 1.5 + 0.3 * animVal;
          child.rotation.x = -0.8 * animVal;
          child.rotation.y = animVal * Math.PI * 0.5;
        }
        if (this.type === 'walker' && child.name === 'head') {
          // Walker: aggressive headbutt + dip
          child.position.z = 0.9 * animVal;
          child.position.y = 2.0 * scale - 0.3 * scale * animVal;
          child.rotation.x = 0.6 * animVal;
        }
        if (this.type === 'walker' && (child.name === 'armL' || child.name === 'armR')) {
          // Arms swing forward on attack
          const side = child.name === 'armL' ? 1 : -1;
          child.rotation.x = -1.2 * animVal;
          child.rotation.z = side * 0.3 * animVal;
        }
        if (this.type === 'tank' && child.name === 'cannon') {
          // Tank: strong recoil + body rock
          child.position.z = 0.8 * scale - 0.8 * animVal;
        }
        if (this.type === 'tank' && child.name === 'turret') {
          // Turret rocks back
          child.rotation.x = 0.25 * animVal;
        }
        if (this.type === 'swarm') {
          // Swarm: whole body scales up like a spike burst
          if (child.name === 'swarmBody') {
            child.scale.setScalar(1 + 0.6 * animVal);
          }
        }
        if (this.type === 'sniper' && child.name === 'barrel') {
          // Sniper recoil
          child.position.z = 0.7 * scale - 0.4 * animVal;
        }
      });
    } else {
      // Reset positions if timer is zero (prevent sticking)
      const stats = ENEMY_TYPES[this.type];
      const scale = stats.scale;

      this.mesh.traverse(child => {
        if (this.type === 'drone' && child.name === 'droneBody') {
          child.position.z = 0;
          child.position.y = 1.5;
          child.rotation.x = 0;
          child.rotation.y = 0;
        }
        if (this.type === 'walker' && child.name === 'head') {
          child.position.z = 0;
          child.position.y = 2.0 * scale;
          child.rotation.x = 0;
        }
        if (this.type === 'walker' && (child.name === 'armL' || child.name === 'armR')) {
          child.rotation.x = 0;
          child.rotation.z = child.name === 'armL' ? -0.2 : 0.2;
        }
        if (this.type === 'tank' && child.name === 'cannon') {
          child.position.z = 0.8 * scale;
        }
        if (this.type === 'tank' && child.name === 'turret') {
          child.rotation.x = 0;
        }
        if (this.type === 'swarm' && child.isMesh) {
          child.scale.setScalar(1);
        }
        if (this.type === 'sniper' && child.name === 'barrel') {
          child.position.z = 0.7 * scale;
        }
      });
    }

    return 0;
  }
}

// Wave generation
export function generateWave(waveNumber, arenaSize) {
  const enemies = [];
  const baseCount = 3 + waveNumber * 2;
  const healthMultiplier = 1 + (waveNumber - 1) * 0.15;

  // Boss waves: every 5th wave
  const isBossWave = waveNumber % 5 === 0;
  let bossType = null;
  if (isBossWave) {
    if (waveNumber >= 15) bossType = 'nanoman';
    else if (waveNumber >= 10) bossType = 'darioltman';
    else bossType = 'carmackion';
  }

  // Determine enemy composition based on wave
  const types = [];
  // Boss waves have fewer regular enemies
  const enemyCount = isBossWave ? Math.max(3, Math.floor(baseCount * 0.4)) : baseCount;
  for (let i = 0; i < enemyCount; i++) {
    if (waveNumber < 3) {
      types.push(Math.random() < 0.6 ? 'swarm' : 'drone');
      // types.push('pinky_rider')
      // types.push('shielder')
    } else if (waveNumber < 5) {
      const r = Math.random();
      if (r < 0.3) types.push('swarm');
      else if (r < 0.6) types.push('drone');
      else types.push('walker');
    } else {
      const r = Math.random();
      if (r < 0.10) types.push('swarm');
      else if (r < 0.24) types.push('drone');
      else if (r < 0.43) types.push('walker');
      else if (r < 0.58) types.push('tank');
      else if (r < 0.69) types.push('sniper');
      else if (r < 0.76) types.push('mortar');
      else if (r < 0.84) types.push('shielder');
      else if (r < 0.91) types.push(waveNumber >= 8 ? 'medic_bot' : 'walker');
      else if (r < 0.97) types.push(waveNumber >= 10 ? 'spectre' : 'drone');
      else types.push('pinky_rider'); // Selecting rider triggers mount spawn
    }
  }

  // Guarantee at least one sniper from wave 4 onwards
  if (waveNumber >= 4 && !types.includes('sniper')) {
    types[0] = 'sniper';
  }

  // Spawn regular enemies at arena edges
  types.forEach(type => {
    const side = Math.floor(Math.random() * 4);
    const limit = arenaSize - 3;
    let x, z;
    switch (side) {
      case 0: x = (Math.random() - 0.5) * limit * 2; z = -limit; break;
      case 1: x = (Math.random() - 0.5) * limit * 2; z = limit; break;
      case 2: x = -limit; z = (Math.random() - 0.5) * limit * 2; break;
      case 3: x = limit; z = (Math.random() - 0.5) * limit * 2; break;
    }
    const pos = new THREE.Vector3(x, 0, z);
    
    if (type === 'pinky_rider') {
      const mount = new Enemy('pinky_mount', pos.clone(), healthMultiplier);
      const rider = new Enemy('pinky_rider', pos.clone(), healthMultiplier);
      mount.rider = rider;
      rider.mountedOn = mount;
      enemies.push(mount);
      enemies.push(rider);
    } else {
      enemies.push(new Enemy(type, pos, healthMultiplier));
    }
  });

  // Spawn boss at a dramatic position
  if (bossType) {
    const bossPos = new THREE.Vector3(0, 0, -(arenaSize - 5));
    enemies.push(new Enemy(bossType, bossPos, healthMultiplier));
  }

  return enemies;
}

// Spawn a single boss (used by debug panel)
export function spawnBoss(bossType, arenaSize, waveNumber = 1) {
  const healthMultiplier = 1 + (waveNumber - 1) * 0.15;
  const pos = new THREE.Vector3(0, 0, -(arenaSize - 5));
  return new Enemy(bossType, pos, healthMultiplier);
}
