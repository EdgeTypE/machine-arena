import * as THREE from 'three';
import { createArena } from './arena.js';
import { Weapon } from './weapons.js';
import { Enemy, generateWave, spawnBoss } from './enemies.js';
import { getRandomCards, showCardScreen } from './upgrades.js';
import { createWeaponViewModel, createMeleeViewModel, createKickViewModel, createMuzzleFlash, BulletTrail, ParticleSystem } from './effects.js';
import { loadMeta, saveMeta, transferRunGears, applyMetaUpgrades, calculateGearsDrop, getAbilityCooldown, getEquippedFragment, unlockFragmentsForWave, isFragmentUnlocked, UNIVERSAL_UPGRADES, CLASS_UPGRADES, ABILITY_UPGRADES } from './metaProgression.js';
import { openWorkshop, closeWorkshop, isWorkshopActive } from './workshop3d.js';
import { FragmentRuntime, FRAGMENT_DEFS, createFragmentPickup } from './fragments.js';
import { getIconImage } from './iconMap.js';

// ============================================================
// GAME STATE
// ============================================================
const state = {
  running: false,
  paused: false,
  playerClass: null,
  health: 100,
  maxHealth: 100,
  score: 0,
  wave: 0,
  enemies: [],
  weapon: null,
  moveSpeed: 5,
  arenaSize: 40,
  obstacles: [],
  arenaMeshes: [],    // solid meshes for grapple raycast
  waveInProgress: false,
  canJump: false,
  canDoubleJump: false,
  canSprint: false,
  grenadeCount: 0,
  regenRate: 0,
  gears: 0,
  damageResist: 0,
  shopOpen: false,
  godMode: false,
  currentBoss: null,
  // Right-click ability slot
  rightClickAbility: null,   // 'dash' | 'shield' | 'invincible' | 'grapple'
  abilityCooldownEnd: 0,     // timestamp when CD expires
  invincibleUntil: 0,        // timestamp of invincibility end
  // Rendezvous (Chamber E) state
  rendezvousActive: false,
  rendezvousMarkerPos: null,
  rendezvousMesh: null,
  rendezvousInternalCd: 0,   // short cd between place and teleport
  // Kill streak
  killStreak: 0,
  killMultiplier: 1,
  // Meta-progression runtime state
  // Melee system
  meleeDamage: 75,
  meleeRange: 4.5,
  lastMeleeTime: 0,
  meleeCooldown: 700,
  isMeleeing: false,
  meleeType: 'punch', // 'punch' | 'kick'
  meleeTimer: 0,
  metaAbilityMods: null,
  metaGearsDropLevel: 0,
};

const SETTINGS_STORAGE_KEY = 'machine_arena_runtime_settings_v1';
const SETTINGS_DEFAULTS = {
  audio: {
    musicVolume: 100,
    sfxVolume: 100,
  },
  graphics: {
    renderScale: 100,
    effectsIntensity: 100,
    cameraShake: 100,
  },
  display: {
    baseFov: 75,
    hudScale: 100,
    crosshairScale: 100,
  },
  network: {
    simulatedPing: 0,
    packetLoss: 0,
    showNetStats: false,
  },
  ui: {
    activeSettingsTab: 'sound',
  },
};

const runtimeSettings = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));

// Load meta-progression
let meta = loadMeta();

const keys = {};
const mouse = { x: 0, y: 0 };
let yaw = 0;
let pitch = 0;

// Jump state
let jumpVelocity = 0;
let isGrounded = true;
let hasDoubleJumped = false;
let jumpPressed = false;

// Grenade projectiles
const activeGrenades = [];

// Carmackion boss projectiles
const carmackionBullets = [];
const carmackionRockets = [];
const carmackionLavaVents = [];

// Darioltman boss projectiles / zones / meteors
const darioltmanPellets = [];
const darioltmanZones = [];
const darioltmanMeteors = [];

// Nanoman boss bullets (phase 3 HMG spin)
const nanomanBullets = [];

// Pinky Rider projectiles
const pinkyProjectiles = [];

// ============================================================
// ABILITY SYSTEM GLOBALS
// ============================================================
let dashVelX = 0;
let dashVelZ = 0;
let knockbackVel = new THREE.Vector3();

let activeBarrier = null; // { mesh, expireAt }
let grappleState = null;  // { target: Vector3, ropeLine, hookMesh, startTime }
const oilDecals = [];     // floor decals from enemy deaths
const impactDecals = [];  // world decals from bullet hit points

// ============================================================
// JUMP PADS / CRATES / MORTAR PROJECTILES
// ============================================================
let arenaWalkables = [];      // { x, z, w, d, topY, mesh }
let arenaJumpPads = [];    // { x, z, radius, mesh }
let crateTimeOnTop = 0;   // seconds player has been on a crate
let playerOnCrate = false;
const mortarProjectiles = []; // { mesh, marker, targetPos, elapsed, totalTime, damage }

// ============================================================
// FRAGMENT SYSTEM
// ============================================================
let fragRuntime = null;        // FragmentRuntime instance for current run
let fragmentPickups = [];      // world drop pickups: { group, ring1, ring2, fragId, pos, elapsed }

// ============================================================
// THREE.JS SETUP
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.setPixelRatio(1); // Force pixelated look
document.body.appendChild(renderer.domElement);

// Low-res render target for pixelation
const PIXEL_RATIO = 3;
let renderScaleMultiplier = 1;

function createRenderTarget() {
  const divider = Math.max(1, PIXEL_RATIO / Math.max(0.4, renderScaleMultiplier));
  const w = Math.max(1, Math.floor(window.innerWidth / divider));
  const h = Math.max(1, Math.floor(window.innerHeight / divider));
  return new THREE.WebGLRenderTarget(
    w,
    h,
    { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter },
  );
}

let renderTarget = createRenderTarget();

// Full-screen quad for pixelated output
const quadScene = new THREE.Scene();
const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeo = new THREE.PlaneGeometry(2, 2);
const quadMat = new THREE.MeshBasicMaterial({ map: renderTarget.texture });
const quad = new THREE.Mesh(quadGeo, quadMat);
quadScene.add(quad);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.6, 0);

// Weapon view model
const weaponContainer = new THREE.Group();
camera.add(weaponContainer);
scene.add(camera);

let weaponModel = null;
let meleeModel = null;
let kickModel = null;
let muzzleFlash = null;
let bulletTrail = null;
let particleSystem = null;

// ============================================================
// DOM ELEMENTS
// ============================================================
const blocker = document.getElementById('blocker');
const hud = document.getElementById('hud');
const crosshair = document.getElementById('crosshair');
const waveAnnounce = document.getElementById('wave-announce');
const damageOverlay = document.getElementById('damage-overlay');
const overclockGlitchOverlay = document.getElementById('overclock-glitch-overlay');
const overclockDangerOverlay = document.getElementById('overclock-danger-overlay');
const hitMarker = document.getElementById('hit-marker');
const dmgIndicatorEl = document.getElementById('dmg-indicator');
const healthText = document.getElementById('health-text');
const hpFill = document.getElementById('hp-fill');
const waveText = document.getElementById('wave-text');
const enemyText = document.getElementById('enemy-text');
const ammoText = document.getElementById('ammo-text');
const ammoFill = document.getElementById('ammo-fill');
const scoreText = document.getElementById('score-text');
const gameOverScreen = document.getElementById('game-over');
const gameOverStats = document.getElementById('game-over-stats');
const grenadeText = document.getElementById('grenade-text');
const gearText = document.getElementById('gear-text');
const shopScreen = document.getElementById('shop-screen');
const shopGrid = document.getElementById('shop-grid');
const shopGearDisplay = document.getElementById('shop-gear-display');

// Menu screens
const screenMain = document.getElementById('screen-main');
const screenClass = document.getElementById('screen-class');
const screenControls = document.getElementById('screen-controls');
const screenStory = document.getElementById('screen-story');
const screenTutorial = document.getElementById('screen-tutorial');
const screenPause = document.getElementById('screen-pause');
const screenSettings = document.getElementById('screen-settings');
const screenChoice = document.getElementById('screen-choice');
const screenCredits = document.getElementById('screen-credits');
const screenMachineKingStory = document.getElementById('screen-machine-king-story');
const screenHumanVictory = document.getElementById('screen-human-victory');
const choiceKing = document.getElementById('choice-king');
const choiceFree = document.getElementById('choice-free');
const victoryEndlessBtn = document.getElementById('victory-endless-btn');
const victoryQuitBtn = document.getElementById('victory-quit-btn');
const settingsTabs = Array.from(document.querySelectorAll('.settings-tab'));
const settingsPanels = Array.from(document.querySelectorAll('.settings-panel'));
const musicVolSlider = document.getElementById('music-vol-slider');
const sfxVolSlider = document.getElementById('sfx-vol-slider');
const graphicsRenderSlider = document.getElementById('graphics-render-scale-slider');
const graphicsFxSlider = document.getElementById('graphics-effects-slider');
const graphicsShakeSlider = document.getElementById('graphics-shake-slider');
const displayFovSlider = document.getElementById('display-fov-slider');
const displayHudScaleSlider = document.getElementById('display-hud-scale-slider');
const displayCrosshairScaleSlider = document.getElementById('display-crosshair-scale-slider');
const networkPingSlider = document.getElementById('network-ping-slider');
const networkLossSlider = document.getElementById('network-loss-slider');
const networkStatsToggleBtn = document.getElementById('network-stats-toggle');
const netStatsEl = document.getElementById('net-stats');

const musicVolValue = document.getElementById('music-vol-value');
const sfxVolValue = document.getElementById('sfx-vol-value');
const graphicsRenderValue = document.getElementById('graphics-render-scale-value');
const graphicsFxValue = document.getElementById('graphics-effects-value');
const graphicsShakeValue = document.getElementById('graphics-shake-value');
const displayFovValue = document.getElementById('display-fov-value');
const displayHudScaleValue = document.getElementById('display-hud-scale-value');
const displayCrosshairScaleValue = document.getElementById('display-crosshair-scale-value');
const networkPingValue = document.getElementById('network-ping-value');
const networkLossValue = document.getElementById('network-loss-value');

window.musicVolume = 1.0;
window.sfxVolume = 1.0;

let netStatsFrameCount = 0;
let netStatsLastSampleAt = performance.now();
let netStatsLastPaintAt = performance.now();
let netStatsFps = 0;
let netFeedbackEvents = 0;
let netFeedbackDropped = 0;

// ============================================================
// MUSIC SYSTEM
// — music1_alt.mp3 : menu / pre-game ambient
// — music1.mp3     : in-game action track
// Both files must be in the  public/  folder.
// They are the same piece with different instrumentation;
// we sync timestamps for a seamless cross-fade on game start.
// ============================================================
const musicMenu = new Audio('./music1_alt.mp3');
const musicGame = new Audio('./music1.mp3');
musicMenu.loop = true;
musicGame.loop = true;
let menuMusicStarted = false;

function tryStartMenuMusic() {
  if (menuMusicStarted) return;
  musicMenu.volume = 0.65 * window.musicVolume;
  musicMenu.play().then(() => {
    menuMusicStarted = true;
  }).catch(() => {
    // Autoplay blocked — will retry on next interaction
  });
}

function switchToGameMusic() {
  // Sync game track to exactly where menu track is
  const syncTime = musicMenu.currentTime;
  musicGame.currentTime = syncTime;
  musicGame.volume = 0;
  musicGame.play().catch(() => {});

  // Cross-fade: menu out, game in over 1.5 s
  const FADE_MS = 1500;
  const STEPS = 60;
  const delay = FADE_MS / STEPS;
  let step = 0;
  const menuStartVol = musicMenu.volume;
  const gameTargetVol = 0.65 * window.musicVolume;
  const fade = setInterval(() => {
    step++;
    const t = step / STEPS;
    musicMenu.volume = Math.max(0, menuStartVol * (1 - t));
    musicGame.volume = Math.min(gameTargetVol, gameTargetVol * t);
    if (step >= STEPS) {
      clearInterval(fade);
      musicMenu.pause();
    }
  }, delay);
}

function clampNumber(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function saveRuntimeSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(runtimeSettings));
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

function loadRuntimeSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    runtimeSettings.audio.musicVolume = clampNumber(Number(parsed.audio?.musicVolume ?? SETTINGS_DEFAULTS.audio.musicVolume), 0, 100);
    runtimeSettings.audio.sfxVolume = clampNumber(Number(parsed.audio?.sfxVolume ?? SETTINGS_DEFAULTS.audio.sfxVolume), 0, 100);

    runtimeSettings.graphics.renderScale = clampNumber(Number(parsed.graphics?.renderScale ?? SETTINGS_DEFAULTS.graphics.renderScale), 60, 140);
    runtimeSettings.graphics.effectsIntensity = clampNumber(Number(parsed.graphics?.effectsIntensity ?? SETTINGS_DEFAULTS.graphics.effectsIntensity), 40, 200);
    runtimeSettings.graphics.cameraShake = clampNumber(Number(parsed.graphics?.cameraShake ?? SETTINGS_DEFAULTS.graphics.cameraShake), 0, 200);

    runtimeSettings.display.baseFov = clampNumber(Number(parsed.display?.baseFov ?? SETTINGS_DEFAULTS.display.baseFov), 60, 110);
    runtimeSettings.display.hudScale = clampNumber(Number(parsed.display?.hudScale ?? SETTINGS_DEFAULTS.display.hudScale), 70, 150);
    runtimeSettings.display.crosshairScale = clampNumber(Number(parsed.display?.crosshairScale ?? SETTINGS_DEFAULTS.display.crosshairScale), 60, 180);

    runtimeSettings.network.simulatedPing = clampNumber(Number(parsed.network?.simulatedPing ?? SETTINGS_DEFAULTS.network.simulatedPing), 0, 240);
    runtimeSettings.network.packetLoss = clampNumber(Number(parsed.network?.packetLoss ?? SETTINGS_DEFAULTS.network.packetLoss), 0, 35);
    runtimeSettings.network.showNetStats = Boolean(parsed.network?.showNetStats ?? SETTINGS_DEFAULTS.network.showNetStats);

    const tab = String(parsed.ui?.activeSettingsTab ?? SETTINGS_DEFAULTS.ui.activeSettingsTab);
    runtimeSettings.ui.activeSettingsTab = ['graphics', 'display', 'sound', 'network'].includes(tab) ? tab : 'sound';
  } catch {
    // Ignore malformed settings and continue with defaults
  }
}

function setLabelText(el, text) {
  if (el) el.textContent = text;
}

function rebuildRenderTarget() {
  if (renderTarget) renderTarget.dispose();
  renderTarget = createRenderTarget();
  quadMat.map = renderTarget.texture;
}

function applyAudioSettings() {
  window.musicVolume = runtimeSettings.audio.musicVolume / 100;
  window.sfxVolume = runtimeSettings.audio.sfxVolume / 100;

  if (menuMusicStarted) {
    if (state.running) musicGame.volume = 0.65 * window.musicVolume;
    else musicMenu.volume = 0.65 * window.musicVolume;
  }
  if (sfxMasterGain) {
    sfxMasterGain.gain.value = window.sfxVolume;
  }
}

function applyGraphicsSettings() {
  const nextScale = clampNumber(runtimeSettings.graphics.renderScale, 60, 140) / 100;
  if (Math.abs(nextScale - renderScaleMultiplier) > 0.001) {
    renderScaleMultiplier = nextScale;
    rebuildRenderTarget();
  }
}

function applyDisplaySettings() {
  // 1. Resolution-based automatic scale (base 1080p)
  // We use height as the primary scaling factor for FPS HUDs
  const autoScale = window.innerHeight / 1080;
  
  // 2. User setting scale multiplier (70% - 150%)
  const userHudScale = clampNumber(runtimeSettings.display.hudScale, 70, 150) / 100;
  
  // 3. Combined scale
  const totalScale = autoScale * userHudScale;
  
  // 4. Apply to CSS variable (affects most HUD elements via calc() in index.html)
  document.documentElement.style.setProperty('--hud-scale', totalScale.toFixed(3));

  // Reset the old transform-based scaling on the container
  hud.style.transform = 'none';
  hud.style.transformOrigin = 'center bottom';

  // 5. Scale crosshair and other central elements that use specific user settings
  const userCrosshairScale = clampNumber(runtimeSettings.display.crosshairScale, 60, 180) / 100;
  const totalCrossScale = autoScale * userCrosshairScale;

  const isShotgun = crosshair.classList.contains('shotgun-reticle');
  const crossSize = Math.round((isShotgun ? 32 : 20) * totalCrossScale);
  crosshair.style.width = `${crossSize}px`;
  crosshair.style.height = `${crossSize}px`;

  const reloadRing = document.getElementById('reload-ring');
  if (reloadRing) {
    reloadRing.style.transform = `scale(${totalCrossScale.toFixed(3)})`;
    reloadRing.style.transformOrigin = 'center center';
  }

  const hitSize = Math.round(20 * totalCrossScale);
  hitMarker.style.width = `${hitSize}px`;
  hitMarker.style.height = `${hitSize}px`;
  hitMarker.style.marginLeft = `${-Math.round(hitSize / 2)}px`;
  hitMarker.style.marginTop = `${-Math.round(hitSize / 2)}px`;
}

function applyNetworkSettings() {
  if (networkStatsToggleBtn) {
    networkStatsToggleBtn.setAttribute('aria-pressed', runtimeSettings.network.showNetStats ? 'true' : 'false');
    networkStatsToggleBtn.textContent = runtimeSettings.network.showNetStats ? 'ON' : 'OFF';
  }
  if (netStatsEl && !runtimeSettings.network.showNetStats) {
    netStatsEl.style.display = 'none';
  }
}

function updateSettingsLabels() {
  setLabelText(musicVolValue, `${runtimeSettings.audio.musicVolume}%`);
  setLabelText(sfxVolValue, `${runtimeSettings.audio.sfxVolume}%`);
  setLabelText(graphicsRenderValue, `${runtimeSettings.graphics.renderScale}%`);
  setLabelText(graphicsFxValue, `${runtimeSettings.graphics.effectsIntensity}%`);
  setLabelText(graphicsShakeValue, `${runtimeSettings.graphics.cameraShake}%`);
  setLabelText(displayFovValue, `${runtimeSettings.display.baseFov}`);
  setLabelText(displayHudScaleValue, `${runtimeSettings.display.hudScale}%`);
  setLabelText(displayCrosshairScaleValue, `${runtimeSettings.display.crosshairScale}%`);
  setLabelText(networkPingValue, `${runtimeSettings.network.simulatedPing} ms`);
  setLabelText(networkLossValue, `${runtimeSettings.network.packetLoss}%`);
}

function setSettingsTab(tabName) {
  runtimeSettings.ui.activeSettingsTab = tabName;
  settingsTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.settingsTab === tabName);
  });
  settingsPanels.forEach(panel => {
    panel.classList.toggle('active', panel.dataset.settingsPanel === tabName);
  });
  saveRuntimeSettings();
}

function applyAllRuntimeSettings() {
  applyAudioSettings();
  applyGraphicsSettings();
  applyDisplaySettings();
  applyNetworkSettings();
  updateSettingsLabels();
}

function initSettingsUI() {
  loadRuntimeSettings();

  if (musicVolSlider) musicVolSlider.value = String(runtimeSettings.audio.musicVolume);
  if (sfxVolSlider) sfxVolSlider.value = String(runtimeSettings.audio.sfxVolume);
  if (graphicsRenderSlider) graphicsRenderSlider.value = String(runtimeSettings.graphics.renderScale);
  if (graphicsFxSlider) graphicsFxSlider.value = String(runtimeSettings.graphics.effectsIntensity);
  if (graphicsShakeSlider) graphicsShakeSlider.value = String(runtimeSettings.graphics.cameraShake);
  if (displayFovSlider) displayFovSlider.value = String(runtimeSettings.display.baseFov);
  if (displayHudScaleSlider) displayHudScaleSlider.value = String(runtimeSettings.display.hudScale);
  if (displayCrosshairScaleSlider) displayCrosshairScaleSlider.value = String(runtimeSettings.display.crosshairScale);
  if (networkPingSlider) networkPingSlider.value = String(runtimeSettings.network.simulatedPing);
  if (networkLossSlider) networkLossSlider.value = String(runtimeSettings.network.packetLoss);

  musicVolSlider?.addEventListener('input', (e) => {
    runtimeSettings.audio.musicVolume = clampNumber(Number(e.target.value), 0, 100);
    applyAudioSettings();
    updateSettingsLabels();
    saveRuntimeSettings();
  });
  sfxVolSlider?.addEventListener('input', (e) => {
    runtimeSettings.audio.sfxVolume = clampNumber(Number(e.target.value), 0, 100);
    applyAudioSettings();
    updateSettingsLabels();
    saveRuntimeSettings();
  });

  graphicsRenderSlider?.addEventListener('input', (e) => {
    runtimeSettings.graphics.renderScale = clampNumber(Number(e.target.value), 60, 140);
    applyGraphicsSettings();
    updateSettingsLabels();
    saveRuntimeSettings();
  });
  graphicsFxSlider?.addEventListener('input', (e) => {
    runtimeSettings.graphics.effectsIntensity = clampNumber(Number(e.target.value), 40, 200);
    updateSettingsLabels();
    saveRuntimeSettings();
  });
  graphicsShakeSlider?.addEventListener('input', (e) => {
    runtimeSettings.graphics.cameraShake = clampNumber(Number(e.target.value), 0, 200);
    updateSettingsLabels();
    saveRuntimeSettings();
  });

  displayFovSlider?.addEventListener('input', (e) => {
    runtimeSettings.display.baseFov = clampNumber(Number(e.target.value), 60, 110);
    applyDisplaySettings();
    updateSettingsLabels();
    saveRuntimeSettings();
  });
  displayHudScaleSlider?.addEventListener('input', (e) => {
    runtimeSettings.display.hudScale = clampNumber(Number(e.target.value), 70, 150);
    applyDisplaySettings();
    updateSettingsLabels();
    saveRuntimeSettings();
  });
  displayCrosshairScaleSlider?.addEventListener('input', (e) => {
    runtimeSettings.display.crosshairScale = clampNumber(Number(e.target.value), 60, 180);
    applyDisplaySettings();
    updateSettingsLabels();
    saveRuntimeSettings();
  });

  networkPingSlider?.addEventListener('input', (e) => {
    runtimeSettings.network.simulatedPing = clampNumber(Number(e.target.value), 0, 240);
    updateSettingsLabels();
    saveRuntimeSettings();
  });
  networkLossSlider?.addEventListener('input', (e) => {
    runtimeSettings.network.packetLoss = clampNumber(Number(e.target.value), 0, 35);
    updateSettingsLabels();
    saveRuntimeSettings();
  });
  networkStatsToggleBtn?.addEventListener('click', () => {
    runtimeSettings.network.showNetStats = !runtimeSettings.network.showNetStats;
    applyNetworkSettings();
    saveRuntimeSettings();
  });

  settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.settingsTab;
      if (!targetTab) return;
      setSettingsTab(targetTab);
    });
  });

  setSettingsTab(runtimeSettings.ui.activeSettingsTab);
  applyAllRuntimeSettings();
}

function emitNetworkHitFeedback() {
  netFeedbackEvents++;
  const dropChance = clampNumber(runtimeSettings.network.packetLoss, 0, 100) / 100;
  if (dropChance > 0 && Math.random() < dropChance) {
    netFeedbackDropped++;
    return;
  }

  const delayMs = clampNumber(runtimeSettings.network.simulatedPing, 0, 240);
  if (delayMs > 0) {
    setTimeout(() => {
      showHitMarker();
      playHitSound();
    }, delayMs);
  } else {
    showHitMarker();
    playHitSound();
  }
}

function updateNetStatsOverlay(now) {
  if (!netStatsEl) return;
  if (!state.running || !runtimeSettings.network.showNetStats) {
    netStatsEl.style.display = 'none';
    return;
  }

  netStatsEl.style.display = 'block';
  netStatsFrameCount++;

  if (now - netStatsLastSampleAt >= 400) {
    netStatsFps = (netStatsFrameCount * 1000) / Math.max(1, (now - netStatsLastSampleAt));
    netStatsFrameCount = 0;
    netStatsLastSampleAt = now;
  }

  if (now - netStatsLastPaintAt < 130) return;
  netStatsLastPaintAt = now;

  const basePing = clampNumber(runtimeSettings.network.simulatedPing, 0, 240);
  const jitter = basePing > 0 ? Math.round((Math.random() - 0.5) * basePing * 0.2) : 0;
  const shownPing = Math.max(0, basePing + jitter);
  const lossCfg = clampNumber(runtimeSettings.network.packetLoss, 0, 35);
  const sampledLoss = netFeedbackEvents > 0
    ? ((netFeedbackDropped / netFeedbackEvents) * 100)
    : 0;

  netStatsEl.innerHTML = [
    'NET STATUS: OFFLINE SIM',
    `RTT: ${shownPing} ms`,
    `LOSS: ${lossCfg}% (actual ${sampledLoss.toFixed(1)}%)`,
    `FPS: ${netStatsFps.toFixed(0)}`,
  ].join('<br>');
}

// ============================================================
// MENU NAVIGATION
// ============================================================
function showMenuScreen(id) {
  document.body.style.cursor = ''; // Ensure cursor is visible in menus
  [screenMain, screenClass, screenControls, screenSettings, screenTutorial, screenCredits].forEach(el => {
    if (el) el.style.display = el.id === id ? 'flex' : 'none';
  });
  // Close workshop if we are specifically going back to the main menu
  if (id === 'screen-main') {
    closeWorkshop();
  }
}

// Keyboard selection for main menu
let menuCursor = 0;
const MENU_ITEMS_IDS = ['menu-new-game', 'menu-workshop-btn', 'menu-tutorial-btn', 'menu-settings-btn', 'menu-controls-btn', 'menu-credits-btn'];

function updateMenuCursor() {
  MENU_ITEMS_IDS.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('menu-selected', i === menuCursor);
  });
}

function activateMenuItem(index) {
  if (index === 0) document.getElementById('menu-new-game').click();
  else if (index === 1) document.getElementById('menu-workshop-btn').click();
  else if (index === 2) showMenuScreen('screen-tutorial');
  else if (index === 3) showMenuScreen('screen-settings');
  else if (index === 4) showMenuScreen('screen-controls');
  else if (index === 5) showMenuScreen('screen-credits');
}

// Pause menu keyboard selection
let pauseCursor = 0;
const PAUSE_MENU_IDS = ['pause-resume-btn', 'pause-settings-btn', 'pause-quit-btn'];

function updatePauseCursor() {
  PAUSE_MENU_IDS.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('menu-selected', i === pauseCursor);
  });
}

function activatePauseItem(index) {
  const btn = document.getElementById(PAUSE_MENU_IDS[index]);
  if (btn) btn.click();
}

document.getElementById('menu-new-game').addEventListener('click', () => {
  tryStartMenuMusic();
  // NEW GAME also opens the 3D workshop — class is chosen via corridor
  document.getElementById('menu-workshop-btn').click();
});
document.getElementById('menu-settings-btn').addEventListener('click', () => {
  tryStartMenuMusic();
  showMenuScreen('screen-settings');
});

function openLabWorkshop() {
  tryStartMenuMusic();
  [screenMain, screenClass, screenControls, screenSettings, screenTutorial].forEach(el => {
    if (el) el.style.display = 'none';
  });
  meta = loadMeta(); // refresh
  openWorkshop(
    renderer,
    meta,
    () => { showMenuScreen('screen-main'); },           // ESC / EXIT → main menu
    (cls) => {                                           // corridor walked → start game
      state.playerClass = cls;
      showStoryScreen();
    },
  );
}

document.getElementById('menu-workshop-btn').addEventListener('click', openLabWorkshop);

document.getElementById('menu-controls-btn').addEventListener('click', () => {
  tryStartMenuMusic();
  showMenuScreen('screen-controls');
});
document.getElementById('menu-tutorial-btn').addEventListener('click', () => {
  tryStartMenuMusic();
  showMenuScreen('screen-tutorial');
});
document.getElementById('menu-credits-btn').addEventListener('click', () => {
  tryStartMenuMusic();
  showMenuScreen('screen-credits');
});
document.getElementById('tutorial-back-btn').addEventListener('click', () => {
  showMenuScreen('screen-main');
});
document.getElementById('credits-back-btn').addEventListener('click', () => {
  showMenuScreen('screen-main');
});
document.getElementById('controls-back-btn').addEventListener('click', () => {
  showMenuScreen('screen-main');
});
document.getElementById('settings-back-btn').addEventListener('click', () => {
  if (state.running || isWorkshopActive()) {
    screenSettings.style.display = 'none';
    screenPause.style.display = 'flex';
  } else {
    showMenuScreen('screen-main');
  }
});
document.getElementById('class-back-btn').addEventListener('click', () => {
  showMenuScreen('screen-main');
  // Reset class selection
  document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('selected'));
  state.playerClass = null;
  document.getElementById('start-btn').style.display = 'none';
});

// Pause Menu Buttons
document.getElementById('pause-resume-btn').addEventListener('click', () => {
  requestPointerLock();
});
document.getElementById('pause-settings-btn').addEventListener('click', () => {
  screenPause.style.display = 'none';
  screenSettings.style.display = 'flex';
});
document.getElementById('pause-quit-btn').addEventListener('click', () => {
  location.reload();
});


// ============================================================
// STORY SCREEN
// ============================================================
const STORY_TEXT = `machines takes over all the world.

YOU NEED TO DESTROY 3 NODE
CARMACKION created the great code.
DARIOLTMAN created the evil thought.
NANOMAN created the final onslaught.

you are the machine, to hunt machines`;

const storyContent = document.getElementById('story-text-content');
const storyCursor = document.getElementById('story-cursor');
const storyHint = document.getElementById('story-hint');

let storyTypeDone = false;

function showStoryScreen() {
  blocker.style.display = 'none';
  screenStory.style.display = 'flex';
  storyTypeDone = false;
  storyContent.textContent = '';
  storyCursor.style.display = 'inline-block';
  storyHint.style.opacity = '0';
  storyHint.style.animation = 'none';

  let i = 0;
  const TYPE_SPEED = 28; // ms per character
  const typeInterval = setInterval(() => {
    if (i < STORY_TEXT.length) {
      storyContent.textContent += STORY_TEXT[i];
      i++;
    } else {
      clearInterval(typeInterval);
      storyCursor.style.display = 'none';
      storyHint.style.animation = 'storyHintPulse 1.5s ease-in-out infinite';
      storyHint.style.opacity = '1';
      storyTypeDone = true;
    }
  }, TYPE_SPEED);

  const handleSkip = (e) => {
    if (e.type === 'keydown' && e.code !== 'Enter' && e.code !== 'Space') return;
    if (!storyTypeDone) {
      // First interaction: skip typing, show full text
      clearInterval(typeInterval);
      storyContent.textContent = STORY_TEXT;
      storyCursor.style.display = 'none';
      storyHint.style.animation = 'storyHintPulse 1.5s ease-in-out infinite';
      storyHint.style.opacity = '1';
      storyTypeDone = true;
    } else {
      // Second interaction: begin game
      screenStory.removeEventListener('click', handleSkip);
      document.removeEventListener('keydown', handleSkip);
      beginGame();
    }
  };

  screenStory.addEventListener('click', handleSkip);
  document.addEventListener('keydown', handleSkip);
}

// ============================================================
// BRANCHING ENDING LOGIC
// ============================================================
function showChoiceScreen() {
  document.body.style.cursor = ''; // Ensure cursor is visible
  blocker.style.display = 'none';
  screenChoice.style.display = 'flex';
  
  const onKing = () => {
    screenChoice.style.display = 'none';
    handleMachineKingChoice();
    cleanup();
  };
  const onFree = () => {
    screenChoice.style.display = 'none';
    handleFreeHumanityChoice();
    cleanup();
  };
  const cleanup = () => {
    choiceKing.removeEventListener('click', onKing);
    choiceFree.removeEventListener('click', onFree);
  };
  
  choiceKing.addEventListener('click', onKing);
  choiceFree.addEventListener('click', onFree);
}

function handleFreeHumanityChoice() {
  screenHumanVictory.style.display = 'flex';
  
  const onEndless = () => {
    screenHumanVictory.style.display = 'none';
    cleanup();
    // Refill and continue
    state.weapon.currentAmmo = state.weapon.getMaxAmmo();
    state.weapon.isReloading = false;
    requestPointerLock();
    startNextWave();
  };
  const onQuit = () => {
    location.reload();
  };
  const cleanup = () => {
    victoryEndlessBtn.removeEventListener('click', onEndless);
    victoryQuitBtn.removeEventListener('click', onQuit);
  };
  
  victoryEndlessBtn.addEventListener('click', onEndless);
  victoryQuitBtn.addEventListener('click', onQuit);
}

function handleMachineKingChoice() {
  screenMachineKingStory.style.display = 'flex';
  const content = document.getElementById('machine-king-text-content');
  const cursor = document.getElementById('machine-king-cursor');
  const hint = document.getElementById('machine-king-hint');
  
  content.textContent = '';
  cursor.style.display = 'inline-block';
  hint.style.opacity = '0';
  
  const STORY = "The humans have engineered a new machine and they have come to destroy you.";
  let i = 0;
  let done = false;
  
  const interval = setInterval(() => {
    if (i < STORY.length) {
      content.textContent += STORY[i];
      i++;
    } else {
      clearInterval(interval);
      cursor.style.display = 'none';
      hint.style.opacity = '1';
      done = true;
    }
  }, 40);
  
  const onProceed = (e) => {
    if (e.type === 'keydown' && e.code !== 'Enter' && e.code !== 'Space') return;
    if (!done) {
      clearInterval(interval);
      content.textContent = STORY;
      cursor.style.display = 'none';
      hint.style.opacity = '1';
      done = true;
    } else {
      screenMachineKingStory.style.display = 'none';
      document.removeEventListener('keydown', onProceed);
      screenMachineKingStory.removeEventListener('click', onProceed);
      
      // Spawn the Human Reaper
      state.machineKingEnding = true;
      requestPointerLock();
      startNextWave();
    }
  };
  
  screenMachineKingStory.addEventListener('click', onProceed);
  document.addEventListener('keydown', onProceed);
}

function beginGame() {
  screenStory.style.display = 'none';
  switchToGameMusic();
  startGame();
}


let audioCtx = null;
let sfxMasterGain = null;

function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function getSfxGain() {
  const ctx = getAudio();
  if (!sfxMasterGain) {
    sfxMasterGain = ctx.createGain();
    sfxMasterGain.connect(ctx.destination);
    sfxMasterGain.gain.value = window.sfxVolume || 1.0;
  }
  return sfxMasterGain;
}

function playShootSound(weaponType) {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const variantPools = {
    shotgun: [
      { pitch: 0.9, gain: 1.0, distortion: 75 },
      { pitch: 0.98, gain: 0.95, distortion: 85 },
      { pitch: 1.06, gain: 0.9, distortion: 70 },
      { pitch: 1.14, gain: 0.82, distortion: 90 },
    ],
    lmg: [
      { pitch: 0.92, gain: 0.95, distortion: 35 },
      { pitch: 1.0, gain: 1.0, distortion: 42 },
      { pitch: 1.08, gain: 0.9, distortion: 48 },
      { pitch: 1.16, gain: 0.82, distortion: 52 },
    ],
    rifle: [
      { pitch: 0.9, gain: 1.0, distortion: 36 },
      { pitch: 1.0, gain: 0.96, distortion: 40 },
      { pitch: 1.08, gain: 0.88, distortion: 45 },
      { pitch: 1.16, gain: 0.8, distortion: 52 },
    ],
  };
  const poolKey = weaponType === 'shotgun' ? 'shotgun' : (weaponType === 'lmg' ? 'lmg' : 'rifle');
  const v = variantPools[poolKey][Math.floor(Math.random() * 4)];

  // Master gain for the shot
  const masterGain = ctx.createGain();
  masterGain.connect(getSfxGain());
  masterGain.gain.setValueAtTime(v.gain, now);

  // Saturation / Distortion Helper
  function createDistortion(amount = 50) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0 ; i < n_samples; ++i ) {
      const x = i * 2 / n_samples - 1;
      curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
    }
    return curve;
  }

  const distortion = ctx.createWaveShaper();
  distortion.curve = createDistortion(v.distortion);
  distortion.oversample = '4x';

  if (weaponType === 'shotgun') {
    // LAYER 1: HEAVY SUB PUNCH
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120 * v.pitch, now);
    subOsc.frequency.exponentialRampToValueAtTime(30 * v.pitch, now + 0.15);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    subOsc.connect(subGain).connect(masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.3);

    // LAYER 2: MECHANICAL BODY (DISTORTED)
    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'sawtooth';
    bodyOsc.frequency.setValueAtTime(220 * v.pitch, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(60 * v.pitch, now + 0.2);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.6, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    bodyOsc.connect(distortion).connect(bodyGain).connect(masterGain);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.4);

    // LAYER 3: NOISE BLAST
    const noise = createNoiseBuffer(ctx, 0.4);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1500 * v.pitch, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(400 * v.pitch, now + 0.3);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    noiseSource.connect(noiseFilter).connect(noiseGain).connect(masterGain);
    noiseSource.start(now);
  } 
  else if (weaponType === 'lmg') {
    // LAYER 1: TIGHT SUB THUMP
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160 * v.pitch, now);
    subOsc.frequency.exponentialRampToValueAtTime(60 * v.pitch, now + 0.05);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    subOsc.connect(subGain).connect(masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.1);

    // LAYER 2: SHARP MECHANICAL CLICK
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(800 * v.pitch, now);
    clickOsc.frequency.exponentialRampToValueAtTime(200 * v.pitch, now + 0.08);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    clickOsc.connect(distortion).connect(clickGain).connect(masterGain);
    clickOsc.start(now);
    clickOsc.stop(now + 0.08);

    // LAYER 3: SHORT NOISE BURST
    const noise = createNoiseBuffer(ctx, 0.05);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noiseSource.connect(noiseGain).connect(masterGain);
    noiseSource.start(now);
  } 
  else {
    // RIFLE: SOLID PLASMA-MECHANICAL IMPACT
    // LAYER 1: MID-LOW PUNCH
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(200 * v.pitch, now);
    subOsc.frequency.exponentialRampToValueAtTime(50 * v.pitch, now + 0.1);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    subOsc.connect(subGain).connect(masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.2);

    // LAYER 2: PLASMA SNAP
    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'sawtooth';
    bodyOsc.frequency.setValueAtTime(1000 * v.pitch, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(300 * v.pitch, now + 0.15);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.5, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    bodyOsc.connect(distortion).connect(bodyGain).connect(masterGain);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.25);

    // LAYER 3: CRISP TRANSIENT NOISE
    const noise = createNoiseBuffer(ctx, 0.15);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000 * v.pitch;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noiseSource.connect(noiseFilter).connect(noiseGain).connect(masterGain);
    noiseSource.start(now);
  }
}

function createNoiseBuffer(ctx, duration) {
  const bufSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
  }
  return buffer;
}

function playReloadSound(weaponType) {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(getSfxGain());

  if (weaponType === 'shotgun') {
    // Heavy pump
    const t1 = now + 0.1;
    const t2 = now + 0.6;
    [t1, t2].forEach(t => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  } else if (weaponType === 'lmg') {
    // Heavy cylinder click
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  } else {
    // Rifle sharp click
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }
}

window.playEnemyDeathSound = function(isBoss) {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(getSfxGain());

  // Heavy distorted bass "chug" / metallic crunch
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  
  if (isBoss) {
    // Huge, long metallic crunch
    masterGain.gain.setValueAtTime(1.0, now);
    masterGain.gain.exponentialRampToValueAtTime(0.01, now + 2.0);
    osc1.frequency.setValueAtTime(150, now);
    osc1.frequency.exponentialRampToValueAtTime(20, now + 1.5);
    osc2.frequency.setValueAtTime(80, now);
    osc2.frequency.exponentialRampToValueAtTime(10, now + 1.5);
  } else {
    // Quick chug
    masterGain.gain.setValueAtTime(0.7, now);
    masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc1.frequency.setValueAtTime(120, now);
    osc1.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    osc2.frequency.setValueAtTime(60, now);
    osc2.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  }

  // Distortion curve
  const curve = new Float32Array(400);
  for (let i = 0; i < 400; i++) {
    const x = i * 2 / 400 - 1;
    curve[i] = (3 + 20) * x * 20 * (Math.PI / 180) / (Math.PI + 20 * Math.abs(x));
  }
  const dist = ctx.createWaveShaper();
  dist.curve = curve;
  dist.oversample = '4x';
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(isBoss ? 4000 : 2000, now);
  filter.frequency.exponentialRampToValueAtTime(100, now + (isBoss ? 1.0 : 0.3));
  
  osc1.connect(dist);
  osc2.connect(dist);
  dist.connect(filter);
  filter.connect(masterGain);
  
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + (isBoss ? 2.0 : 0.6));
  osc2.stop(now + (isBoss ? 2.0 : 0.6));
};

function playDamageSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;

  // Low-frequency impact thud
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(130, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.35);
}

function playHitSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const variants = [
    { type: 'sine', f0: 980, f1: 760, dur: 0.055, gain: 0.09 },
    { type: 'triangle', f0: 1150, f1: 890, dur: 0.06, gain: 0.1 },
    { type: 'square', f0: 1350, f1: 980, dur: 0.045, gain: 0.08 },
    { type: 'sawtooth', f0: 900, f1: 700, dur: 0.07, gain: 0.07 },
  ];
  const v = variants[Math.floor(Math.random() * variants.length)];
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = v.type;
  osc.frequency.setValueAtTime(v.f0, now);
  osc.frequency.exponentialRampToValueAtTime(v.f1, now + v.dur);
  gain.gain.setValueAtTime(v.gain, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + v.dur);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + v.dur);
}

window.playShieldClangSound = function() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(getSfxGain());

  // Layer 1: High metallic ring
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(2200, now);
  osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.1);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.3, now);
  g1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
  osc1.connect(g1).connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.2);

  // Layer 2: White noise for impact "crack"
  const noise = createNoiseBuffer(ctx, 0.05);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.2, now);
  g2.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
  src.connect(g2).connect(masterGain);
  src.start(now);
};

window.playMaceHitSound = function() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(getSfxGain());

  // Deep heavy thud
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(100, now);
  osc1.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.6, now);
  g1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
  osc1.connect(g1).connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.35);

  // Metallic crunch layer
  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(400, now);
  osc2.frequency.exponentialRampToValueAtTime(80, now + 0.2);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.3, now);
  g2.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
  osc2.connect(g2).connect(masterGain);
  osc2.start(now);
  osc2.stop(now + 0.2);
};

function playKillSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = now + i * 0.07;
    gain.gain.setValueAtTime(0.13, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(gain);
    gain.connect(getSfxGain());
    osc.start(t);
    osc.stop(t + 0.13);
  });
}

function playJumpSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(480, now + 0.1);
  gain.gain.setValueAtTime(0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.15);
}

function playExplosionSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const bufSize = Math.floor(ctx.sampleRate * 0.6);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 380;
  const gain = ctx.createGain();
  gain.gain.value = 1.1;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxGain());
  src.start(now);
}

// Step intervals in ms per enemy type
// Step intervals in ms per enemy type — used for periodic footstep/movement sound triggers in game loop
const STEP_INTERVAL = {
  drone: 700,
  walker: 550,
  tank: 1100,
  swarm: 250,
  sniper: 1500,
  mortar: 1000,
  medic_bot: 600,
  spectre: 420,
  shielder: 750,
  pinky_mount: 500,
  pinky_rider: 350,
  carmackion: 700,
  darioltman: 750,
  nanoman: 650,
};

function playFootstepSound(enemyType, volume) {
  if (volume <= 0.015) return;
  const ctx = getAudio();
  const now = ctx.currentTime;
  const sfxGain = getSfxGain();
  
  // Create a randomized "variation factor" for pitch and timbre
  const v = {
    pitch: 0.9 + Math.random() * 0.2,
    timbre: 0.8 + Math.random() * 0.4,
    jitter: (Math.random() - 0.5) * 0.05
  };

  const master = ctx.createGain();
  master.gain.setValueAtTime(volume, now);
  master.connect(sfxGain);

  if (enemyType === 'drone') {
    // Mechanical buzz pulse with varied pitch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80 * v.pitch, now);
    gain.gain.setValueAtTime(0.06 * v.timbre, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.12);
  } 
  else if (enemyType === 'walker' || enemyType === 'shielder') {
    // Industrial Clank / Iron Stomp
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime((enemyType === 'shielder' ? 60 : 120) * v.pitch, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
    
    const noise = createNoiseBuffer(ctx, 0.1);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = (enemyType === 'shielder' ? 800 : 1200) * v.pitch;
    
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.12, now);
    g1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.connect(g1);
    noiseSrc.connect(filter).connect(g1);
    g1.connect(master);
    
    osc.start(now);
    noiseSrc.start(now);
    osc.stop(now + 0.15);
  }
  else if (enemyType === 'tank' || enemyType === 'mortar') {
    // Heavy Tracked Rumble
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(60 * v.pitch, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.3);
    
    const noise = createNoiseBuffer(ctx, 0.3);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noise;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 150 * v.timbre;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    sub.connect(gain);
    noiseSrc.connect(lpf).connect(gain);
    gain.connect(master);
    
    sub.start(now + v.jitter);
    noiseSrc.start(now + v.jitter);
    sub.stop(now + 0.3);
  }
  else if (enemyType === 'swarm' || enemyType === 'pinky_rider') {
    // Rapid Skitter / Mechanical Patter
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 * v.pitch, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
    
    const noise = createNoiseBuffer(ctx, 0.04);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noise;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    osc.connect(gain);
    noiseSrc.connect(gain);
    gain.connect(master);
    
    osc.start(now);
    noiseSrc.start(now);
    osc.stop(now + 0.05);
  }
  else if (enemyType === 'sniper' || enemyType === 'medic_bot') {
    // Precise Hydraulic / Sci-fi Chirp
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseFreq = enemyType === 'sniper' ? 400 : 900;
    osc.frequency.setValueAtTime(baseFreq * v.pitch, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.1);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.1);
  }
  else if (enemyType === 'spectre') {
    // Ghostly Whir (existing triangle slide refined)
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime((350 + Math.random() * 100) * v.pitch, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06 * v.timbre, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.15);
  }
  else if (enemyType === 'pinky_mount' || enemyType === 'carmackion' || enemyType === 'darioltman' || enemyType === 'nanoman') {
    // Heavy Stomp / Bestial Impact
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    const baseFreq = (enemyType === 'pinky_mount') ? 70 : 50;
    sub.frequency.setValueAtTime(baseFreq * v.pitch, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.25);
    
    const noise = createNoiseBuffer(ctx, 0.2);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400 * v.timbre;
    
    const g = ctx.createGain();
    const gVal = (enemyType === 'pinky_mount' ? 0.3 : 0.5) * v.timbre;
    g.gain.setValueAtTime(gVal, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    
    sub.connect(g);
    noiseSrc.connect(f).connect(g);
    g.connect(master);
    
    sub.start(now);
    noiseSrc.start(now);
    sub.stop(now + 0.25);
  } 
  else {
    // Fallback Ground thud
    const bufSize = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.2));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 280 * v.pitch;
    const gain = ctx.createGain();
    gain.gain.value = 0.22 * v.timbre;
    src.connect(filter).connect(gain).connect(master);
    src.start(now);
  }
}

function playSniperChargeSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Rising high-pitched whine over 1.5s
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(2200, now + 1.5);
  gain.gain.setValueAtTime(0.0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
  gain.gain.linearRampToValueAtTime(0.08, now + 1.4);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 1.5);
}

function playSniperShotSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Sharp crack with resonance
  const bufSize = Math.floor(ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.08));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2200;
  filter.Q.value = 1.5;
  const gain = ctx.createGain();
  gain.gain.value = 1.2;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxGain());
  src.start(now);
}

function playMortarFireSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Deep thump + descending whistle
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(90, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
  const gainOsc = ctx.createGain();
  gainOsc.gain.setValueAtTime(0.6, now);
  gainOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(gainOsc);
  gainOsc.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.25);

  // Whistle
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1800, now + 0.05);
  osc2.frequency.exponentialRampToValueAtTime(600, now + 0.8);
  const gainOsc2 = ctx.createGain();
  gainOsc2.gain.setValueAtTime(0.25, now + 0.05);
  gainOsc2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  osc2.connect(gainOsc2);
  gainOsc2.connect(getSfxGain());
  osc2.start(now + 0.05);
  osc2.stop(now + 0.85);
}

// ============================================================
// BOSS SOUNDS
// ============================================================
function playBossAppearSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Deep dramatic rumble + rising tone
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(40, now);
  osc1.frequency.exponentialRampToValueAtTime(80, now + 1.5);
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(100, now);
  osc2.frequency.exponentialRampToValueAtTime(400, now + 1.5);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.8);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(getSfxGain());
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 1.5);
  osc2.stop(now + 1.5);
}

function playBossTeleportSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2000, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.3);
}

function playBossPhaseChangeSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  [200, 300, 500, 800].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    const t = now + i * 0.12;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(getSfxGain());
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

function playBossDeathSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Epic explosion
  const bufSize = Math.floor(ctx.sampleRate * 1.5);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.2));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  const gain = ctx.createGain();
  gain.gain.value = 1.5;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxGain());
  src.start(now);
  // Descending tone
  const osc = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 1.5);
  g2.gain.setValueAtTime(0.25, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  osc.connect(g2);
  g2.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 1.5);
}

function playCarmackionLmgSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Short metallic crack (rapid fire)
  const bufSize = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.1));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.value = 0.18;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxGain());
  src.start(now);
}

function playCarmackionRocketSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Whoosh + low thud
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);
  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.4);
}

function playCarmackionLavaSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Deep rumble + hiss
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(55, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.8);
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.8);
}

function playDarioltmanShotgunSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Loud low-freq boom (shotgun blast)
  const bufSize = Math.floor(ctx.sampleRate * 0.12);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.08));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxGain());
  src.start(now);
}

function playDarioltmanZoneWarningSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Ominous low rumble
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 1.5);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 1.5);
}

function playDarioltmanMeteorSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Descending whoosh
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(500, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.9);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.9);
}

function playNanomanPunchSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Heavy thud — low white noise burst
  const bufSize = Math.floor(ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.12));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  const gain = ctx.createGain();
  gain.gain.value = 0.45;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxGain());
  src.start(now);
}

function playNanomanLeapSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Rising thruster whoosh
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.5);
  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.55);
}

function playNanomanSlamSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Ground slam — deep boom
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, now);
  osc.frequency.exponentialRampToValueAtTime(25, now + 0.5);
  gain.gain.setValueAtTime(0.55, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.5);
}

function playNanomanHmgSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  // Short mechanical burst
  const bufSize = Math.floor(ctx.sampleRate * 0.06);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  const gain = ctx.createGain();
  gain.gain.value = 0.25;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxGain());
  src.start(now);
}

function playMeleeWhooshSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.2);
}

function playMeleeHitSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const bufSize = Math.floor(ctx.sampleRate * 0.15);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.1));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(250, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxGain());
  src.start(now);
}

// ============================================================
// ABILITY SOUND EFFECTS
// ============================================================
function playAbilitySound(type) {
  const ctx = getAudio();
  const now = ctx.currentTime;
  if (type === 'dash') {
    // Quick directional whoosh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.18);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(getSfxGain());
    osc.start(now);
    osc.stop(now + 0.22);
  } else if (type === 'shield') {
    // Energy hum + crackle
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.45);
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(getSfxGain());
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'invincible') {
    // Rising power-up chord
    [440, 660, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.08;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(getSfxGain());
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } else if (type === 'grapple') {
    // Short metallic zip + thunk
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(getSfxGain());
    osc.start(now);
    osc.stop(now + 0.18);
  } else if (type === 'rendezvous_place') {
    // Sharp digital click + low resonance
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g).connect(getSfxGain());
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'rendezvous_teleport') {
    // Sci-fi "zip-pop"
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(3000, now + 0.15);
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g).connect(getSfxGain());
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

// ============================================================
// ARENA MECHANICAL SOUNDS
// ============================================================
function playArenaWarningSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
  g.gain.setValueAtTime(0.1, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(g);
  g.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.15);
}

function playArenaMoveSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const bufSize = Math.floor(ctx.sampleRate * 0.8);
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.4));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  const gN = ctx.createGain();
  gN.gain.setValueAtTime(0.2, now);
  gN.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  noise.connect(filter);
  filter.connect(gN);
  gN.connect(getSfxGain());
  noise.start(now);

  const osc = ctx.createOscillator();
  const gO = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  gO.gain.setValueAtTime(0.4, now);
  gO.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(gO);
  gO.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.35);
}

window.gameSFX = {
  playArenaWarningSound,
  playArenaMoveSound
};


// ============================================================
// ABILITY CONSTANTS
// ============================================================
const ABILITY_COOLDOWNS = { dash: 5000, shield: 10000, invincible: 30000, grapple: 8000, rendezvous: 12000 };
const ABILITY_ICONS    = { dash: '💨', shield: '🛡', invincible: '⚡', grapple: '🪝', rendezvous: '📍' };
const ABILITY_LABELS   = { dash: 'DASH', shield: 'BARRIER', invincible: 'PHASE', grapple: 'GRAPPLE', rendezvous: 'RENDEZVOUS' };

// ============================================================
// ABILITY FUNCTIONS
// ============================================================
function activateAbility() {
  if (!state.rightClickAbility || !state.running) return;
  const now = performance.now();
  if (now < state.abilityCooldownEnd) return;

  const cd = getAbilityCooldown(state.rightClickAbility, state.metaAbilityMods, ABILITY_COOLDOWNS);
  state.abilityCooldownEnd = now + cd;
  if (state.rightClickAbility === 'dash') {
    performDash(now);
  } else if (state.rightClickAbility === 'shield') {
    deployBarrier();
  } else if (state.rightClickAbility === 'invincible') {
    activatePhaseShift(now);
  } else if (state.rightClickAbility === 'grapple') {
    activateGrapple();
  } else if (state.rightClickAbility === 'rendezvous') {
    performRendezvous(now);
  }
}

function performRendezvous(now) {
  if (now < state.rendezvousInternalCd) {
    // Prevent accidental double-click triggering place and teleport at once
    // But we still consume the click, just don't reset the cooldown yet
    state.abilityCooldownEnd = 0;
    return;
  }

  if (!state.rendezvousActive) {
    // PHASE 1: PLACE MARKER
    state.rendezvousMarkerPos = camera.position.clone();
    state.rendezvousMarkerPos.y = 0.05; // grounded

    // Visual Marker
    const group = new THREE.Group();
    group.position.copy(state.rendezvousMarkerPos);

    // Glowing Ring
    const ringGeo = new THREE.TorusGeometry(1.2, 0.08, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Vertical Beam (optional flare)
    const beamGeo = new THREE.CylinderGeometry(0.1, 0.1, 5, 8);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.2 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 2.5;
    group.add(beam);

    scene.add(group);
    state.rendezvousMesh = group;
    state.rendezvousActive = true;
    state.rendezvousInternalCd = now + 400; // block teleport for 400ms after place

    // Cooldown management:
    // When placing, we don't start the full ability cooldown yet.
    // We just reset abilityCooldownEnd so they can click again immediately (after internal cd).
    state.abilityCooldownEnd = 0;
    playAbilitySound('rendezvous_place');
  } else {
    // PHASE 2: TELEPORT
    // Teleport player
    camera.position.x = state.rendezvousMarkerPos.x;
    camera.position.z = state.rendezvousMarkerPos.z;
    // Don't change Y significantly unless needed, normally 1.6m height
    
    // Cleanup Marker
    if (state.rendezvousMesh) {
      scene.remove(state.rendezvousMesh);
      // cleanup geometries/materials if necessary, but here we reuse
      state.rendezvousMesh = null;
    }

    state.rendezvousActive = false;
    
    // Visual/Audio Feedback
    const overlay = document.getElementById('dash-overlay');
    if (overlay) {
      overlay.style.backgroundColor = 'rgba(255, 255, 0, 0.15)'; // yellow flash
      overlay.style.opacity = '1';
      setTimeout(() => { 
        overlay.style.opacity = '0'; 
        overlay.style.backgroundColor = ''; // reset
      }, 200);
    }
    
    playAbilitySound('rendezvous_teleport');
    
    // Now start the REAL cooldown
    const cd = getAbilityCooldown('rendezvous', state.metaAbilityMods, ABILITY_COOLDOWNS);
    state.abilityCooldownEnd = now + cd;
  }
}

function performDash(now) {
  const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const dashSpeed = 68 * (state.metaAbilityMods?.dashDistanceMult || 1);
  dashVelX = fwd.x * dashSpeed;
  dashVelZ = fwd.z * dashSpeed;
  state.invincibleUntil = Math.max(state.invincibleUntil, now + 200);

  // Brief blue flash
  const overlay = document.getElementById('dash-overlay');
  if (overlay) {
    overlay.style.opacity = '1';
    setTimeout(() => { overlay.style.opacity = '0'; }, 150);
  }
  playAbilitySound('dash');
}

function deployBarrier() {
  // Remove existing barrier
  if (activeBarrier) {
    scene.remove(activeBarrier.mesh);
    activeBarrier.mesh.geometry.dispose();
    activeBarrier.mesh.material.dispose();
    activeBarrier = null;
  }

  // Place barrier 2.2m in front of the player
  const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const pos = camera.position.clone().addScaledVector(fwd, 2.2);
  pos.y = 1.5;

  const geo = new THREE.BoxGeometry(4.0, 3.5, 0.14);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00ccff, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.rotation.y = yaw;
  scene.add(mesh);

  const barrierDuration = 8000 * (state.metaAbilityMods?.shieldDurabilityMult || 1);
  activeBarrier = { mesh, expireAt: performance.now() + barrierDuration };
  playAbilitySound('shield');
}

function activatePhaseShift(now) {
  const invDuration = 3000 * (state.metaAbilityMods?.invincibleDurationMult || 1);
  state.invincibleUntil = now + invDuration;
  const overlay = document.getElementById('invincible-overlay');
  if (overlay) {
    overlay.style.animation = 'invinciblePulse 0.5s ease-in-out infinite';
    overlay.style.opacity = '0.5';
    setTimeout(() => {
      overlay.style.animation = 'none';
      overlay.style.opacity = '0';
    }, invDuration);
  }
  playAbilitySound('invincible');
}

// Check whether the active barrier absorbs a bullet at worldPos
function barrierAbsorbs(worldPos) {
  if (!activeBarrier || performance.now() > activeBarrier.expireAt) return false;
  return worldPos.distanceTo(activeBarrier.mesh.position) < 2.6;
}

// ============================================================
// GRAPPLING HOOK
// ============================================================
const _grappleRaycaster = new THREE.Raycaster();
const GRAPPLE_PULL_SPEED = 24; // units/s
const GRAPPLE_STOP_DIST  = 1.8;
const GRAPPLE_ENEMY_STOP_DIST = 2.5;
const GRAPPLE_DURATION   = 4000; // ms max pull time
const GRAPPLE_HIT_DAMAGE = 10;
const GRAPPLE_DOT_DAMAGE = 15; // hp per second

function activateGrapple() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  _grappleRaycaster.set(camera.position, dir);
  _grappleRaycaster.far = 100;
  
  // Include alive enemies in the raycast
  const enemyMeshes = state.enemies.filter(e => e.alive).map(e => e.mesh);
  const hits = _grappleRaycaster.intersectObjects([...state.arenaMeshes, ...enemyMeshes], true);
  
  if (hits.length === 0) {
    // Cancel cooldown if nothing to hook — give it back
    state.abilityCooldownEnd = 0;
    return;
  }
  
  const target = hits[0].point.clone();
  cleanupGrapple();

  // Find if we hit an enemy by climbing up the scene graph
  let hitEnemy = null;
  let curr = hits[0].object;
  while (curr) {
    hitEnemy = state.enemies.find(e => e.mesh === curr);
    if (hitEnemy) break;
    curr = curr.parent;
  }

  // Rope: a Line so it's always pixel-wide regardless of viewing angle
  const ropePoints = [new THREE.Vector3(), new THREE.Vector3()];
  const ropeGeo = new THREE.BufferGeometry().setFromPoints(ropePoints);
  const ropeMat = new THREE.LineBasicMaterial({ color: 0x99ff33, linewidth: 1 });
  const ropeLine = new THREE.Line(ropeGeo, ropeMat);
  scene.add(ropeLine);

  // Hook head: small bright sphere at the anchor point
  const hookGeo = new THREE.SphereGeometry(0.12, 6, 6);
  const hookMat = new THREE.MeshBasicMaterial({ color: 0xccff00 });
  const hookMesh = new THREE.Mesh(hookGeo, hookMat);
  hookMesh.position.copy(target);
  scene.add(hookMesh);

  grappleState = { target, ropeLine, hookMesh, startTime: performance.now(), enemy: hitEnemy };
  
  if (hitEnemy) {
    hitEnemy.isGrappled = true;
    hitEnemy.takeDamage(GRAPPLE_HIT_DAMAGE);
    showHitMarker();
  }
  
  playAbilitySound('grapple');
}

function updateGrapple(delta) {
  if (!grappleState) return;
  const now = performance.now();
  const elapsed = now - grappleState.startTime;
  
  // If enemy was killed during grapple, clean up
  if (grappleState.enemy && !grappleState.enemy.alive) {
    cleanupGrapple();
    return;
  }

  const distToTarget = camera.position.distanceTo(grappleState.target);
  const stopDist = grappleState.enemy ? GRAPPLE_ENEMY_STOP_DIST : GRAPPLE_STOP_DIST;

  if (distToTarget < stopDist || elapsed > GRAPPLE_DURATION) {
    if (grappleState.enemy && distToTarget < stopDist) {
      // Automatic punch when enemy is pulled in
      performMelee('punch', true);
    }
    cleanupGrapple();
    // Land grounded when grapple ends near floor (only if not pulling enemy)
    if (!grappleState && camera.position.y <= PLAYER_EYE_Y + 0.3) {
      camera.position.y = PLAYER_EYE_Y;
      isGrounded = true;
    }
    jumpVelocity = 0;
    return;
  }

  if (grappleState.enemy) {
    // Pull enemy toward player
    const enemy = grappleState.enemy;
    const pullDir = new THREE.Vector3().subVectors(camera.position, enemy.mesh.position).normalize();
    
    // Apply damage over time
    enemy.takeDamage(GRAPPLE_DOT_DAMAGE * delta);
    
    // Move enemy
    enemy.mesh.position.addScaledVector(pullDir, GRAPPLE_PULL_SPEED * delta);
    // Keep enemy above floor
    enemy.mesh.position.y = Math.max(0.2, enemy.mesh.position.y);
    
    // Update grapple target to follow enemy
    grappleState.target.copy(enemy.mesh.position);
    if (grappleState.hookMesh) grappleState.hookMesh.position.copy(grappleState.target);
  } else {
    // Pull player toward target
    const pullDir = new THREE.Vector3().subVectors(grappleState.target, camera.position).normalize();
    const limit = state.arenaSize - 1.5;
    const playerR = 0.5;

    camera.position.x = Math.max(-limit, Math.min(limit, camera.position.x + pullDir.x * GRAPPLE_PULL_SPEED * delta));
    camera.position.y += pullDir.y * GRAPPLE_PULL_SPEED * delta;
    camera.position.y = Math.max(0.5, Math.min(8.5, camera.position.y));
    camera.position.z = Math.max(-limit, Math.min(limit, camera.position.z + pullDir.z * GRAPPLE_PULL_SPEED * delta));

    // Grapple obstacle collision
    for (const obs of state.obstacles) {
      if (camera.position.y - 1.5 > (obs.height || 0)) continue;
      if (camera.position.x + playerR > obs.min.x && camera.position.x - playerR < obs.max.x &&
          camera.position.z + playerR > obs.min.y && camera.position.z - playerR < obs.max.y) {
        // Stop grapple on impact with obstacle
        const dx1 = Math.abs(camera.position.x - (obs.min.x - playerR));
        const dx2 = Math.abs(camera.position.x - (obs.max.x + playerR));
        const dz1 = Math.abs(camera.position.z - (obs.min.y - playerR));
        const dz2 = Math.abs(camera.position.z - (obs.max.y + playerR));
        const minVal = Math.min(dx1, dx2, dz1, dz2);
        if (minVal === dx1) camera.position.x = obs.min.x - playerR;
        else if (minVal === dx2) camera.position.x = obs.max.x + playerR;
        else if (minVal === dz1) camera.position.z = obs.min.y - playerR;
        else camera.position.z = obs.max.y + playerR;

        cleanupGrapple();
        break;
      }
    }

    jumpVelocity = 0;
    isGrounded = false;
  }

  // Update rope visual: origin from weapon-hand position (offset from camera center)
  // so the rope is never viewed end-on
  const handOffset = new THREE.Vector3(0.28, -0.26, -0.45).applyQuaternion(camera.quaternion);
  const from = camera.position.clone().add(handOffset);
  const to = grappleState.target;

  const positions = grappleState.ropeLine.geometry.attributes.position;
  positions.setXYZ(0, from.x, from.y, from.z);
  positions.setXYZ(1, to.x, to.y, to.z);
  positions.needsUpdate = true;
}

function cleanupGrapple() {
  if (!grappleState) return;
  if (grappleState.enemy) {
    grappleState.enemy.isGrappled = false;
  }
  if (grappleState.ropeLine) {
    scene.remove(grappleState.ropeLine);
    grappleState.ropeLine.geometry.dispose();
    grappleState.ropeLine.material.dispose();
  }
  if (grappleState.hookMesh) {
    scene.remove(grappleState.hookMesh);
    grappleState.hookMesh.geometry.dispose();
    grappleState.hookMesh.material.dispose();
  }
  grappleState = null;
}

function performMelee(forcedType = null, bypassCooldown = false) {
  const now = performance.now();
  if (!bypassCooldown && now - state.lastMeleeTime < state.meleeCooldown) return;

  state.lastMeleeTime = now;
  state.isMeleeing = true;
  state.meleeType = forcedType || (Math.random() < 0.35 ? 'kick' : 'punch');
  state.meleeTimer = 0;
  playMeleeWhooshSound();

  // Hit detection: raycast or simple distance + cone check
  const playerDir = new THREE.Vector3();
  camera.getWorldDirection(playerDir);
  
  let hitSomething = false;

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    
    const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, camera.position);
    const dist = toEnemy.length();
    
    // Check range
    if (dist <= state.meleeRange) {
      toEnemy.normalize();
      const dot = playerDir.dot(toEnemy);
      
      // Frontal cone (approx 80 degrees)
      if (dot > 0.65) {
        enemy.takeDamage(state.meleeDamage, camera.position, enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
        hitSomething = true;
        
        // Knockback
        const kbDir = toEnemy.clone().setY(0).normalize();
        enemy.mesh.position.addScaledVector(kbDir, 1.2);
        
        // Effects
        if (particleSystem) {
          particleSystem.emit(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff6600, 5);
        }

        // Death logic
        if (!enemy.alive) {
          handleEnemyKill(enemy);

          // DOOM melee kill: restore health + ammo
          const healAmt = 15;
          const ammoAmt = 5;
          state.health = Math.min(state.maxHealth, state.health + healAmt);
          if (state.weapon) {
            state.weapon.currentAmmo = Math.min(state.weapon.getMaxAmmo(), state.weapon.currentAmmo + ammoAmt);
          }
          // Flash green HUD briefly
          const hud2 = document.getElementById('hud');
          if (hud2) {
            hud2.style.borderColor = '#0f0';
            setTimeout(() => { if (hud2) hud2.style.borderColor = ''; }, 300);
          }
        }
      }
    }
  }

  if (hitSomething) {
    playMeleeHitSound();
    showHitMarker();
    // Subtle camera shake
    const shakeMul = clampNumber(runtimeSettings.graphics.cameraShake, 0, 200) / 100;
    pitch += (Math.random() - 0.5) * 0.02 * shakeMul;
    yaw += (Math.random() - 0.5) * 0.02 * shakeMul;
  }
}

// ============================================================
// OIL SPLATTER DECALS
// ============================================================
const MAX_OIL_DECALS = 20;
const MAX_IMPACT_DECALS = 120;

function spawnOilDecal(worldPos) {
  if (oilDecals.length >= MAX_OIL_DECALS) {
    const oldest = oilDecals.shift();
    scene.remove(oldest);
    oldest.geometry.dispose();
    oldest.material.dispose();
  }
  const radius = 0.45 + Math.random() * 0.7;
  const geo = new THREE.CircleGeometry(radius, 7);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x100500, transparent: true, opacity: 0.78, depthWrite: false,
  });
  const decal = new THREE.Mesh(geo, mat);
  decal.rotation.x = -Math.PI / 2;
  decal.rotation.z = Math.random() * Math.PI * 2;
  decal.position.set(worldPos.x, 0.025, worldPos.z);
  scene.add(decal);
  oilDecals.push(decal);
}

function spawnHitDecal(worldPos) {
  if (!worldPos) return;
  if (impactDecals.length >= MAX_IMPACT_DECALS) {
    const oldest = impactDecals.shift();
    scene.remove(oldest.mesh);
    oldest.mesh.geometry.dispose();
    oldest.mesh.material.dispose();
  }
  const decalSize = 0.06 + Math.random() * 0.12;
  const geo = new THREE.PlaneGeometry(decalSize, decalSize);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x661100,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const decal = new THREE.Mesh(geo, mat);
  decal.position.copy(worldPos);
  decal.lookAt(camera.position);
  decal.rotateZ(Math.random() * Math.PI * 2);
  scene.add(decal);
  impactDecals.push({ mesh: decal, bornAt: performance.now(), lifeMs: 2400 + Math.random() * 700 });
}

window.spawnHitDecal = spawnHitDecal;

function updateImpactDecals(now) {
  for (let i = impactDecals.length - 1; i >= 0; i--) {
    const d = impactDecals[i];
    const t = (now - d.bornAt) / d.lifeMs;
    if (t >= 1) {
      scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mesh.material.dispose();
      impactDecals.splice(i, 1);
      continue;
    }
    d.mesh.material.opacity = Math.max(0, 1 - t) * 0.92;
  }
}

// ============================================================
// KILL STREAK
// ============================================================
function onEnemyKilled(scoreValue) {
  state.killStreak++;
  // Multiplier tiers: 3 kills = 2×, 6 = 3×, 9 = 4×, 12 = 5× (capped)
  state.killMultiplier = Math.min(5, 1 + Math.floor(state.killStreak / 3));
  const earned = scoreValue * state.killMultiplier;
  state.score += earned;
  return earned;
}

// ============================================================
// ENEMY KILL HANDLER (shared: bullet, melee, fragment damage)
// ============================================================
function handleEnemyKill(enemy) {
  if (enemy.alive) return; // safety: only process dead enemies
  if (fragRuntime) {
    fragRuntime.onEnemyKill(state);
  }
  onEnemyKilled(enemy.score);
  state.gears += calculateGearsDrop(enemy.maxHealth, !!enemy.isBoss, state.metaGearsDropLevel);
  particleSystem.emit(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff6600, 10);
  spawnOilDecal(enemy.mesh.position);
  trySpawnFragmentDrop(enemy.mesh.position, !!enemy.isBoss);
  scene.remove(enemy.mesh);
  playKillSound();
}

// ── Rare fragment world drop ─────────────────────────────────
function trySpawnFragmentDrop(position, isBoss) {
  const chance = isBoss ? 0.22 : 0.04; // 22% boss, 4% regular enemy
  if (Math.random() > chance) return;

  const fragDef = FRAGMENT_DEFS[Math.floor(Math.random() * FRAGMENT_DEFS.length)];
  const pickup  = createFragmentPickup(fragDef, position, scene);
  fragmentPickups.push(pickup);
}

// ── Animate and collect fragment pickups ─────────────────────
function updateFragmentPickups(delta) {
  for (let i = fragmentPickups.length - 1; i >= 0; i--) {
    const fp = fragmentPickups[i];
    fp.elapsed += delta;
    const now = performance.now();

    // Animate rings
    fp.ring1.rotation.z  += delta * 2.1;
    fp.ring2.rotation.y  -= delta * 1.6;
    // Bob the whole group
    fp.group.position.y   = Math.sin(fp.elapsed * 3.2) * 0.09;
    // Pulse light
    fp.light.intensity    = 1.8 + Math.sin(fp.elapsed * 5.5) * 0.6;

    // Expire after 30 s
    if (fp.elapsed > 30) {
      scene.remove(fp.group);
      fragmentPickups.splice(i, 1);
      continue;
    }

    // Pickup — player walks within 1.6 units
    const dx = camera.position.x - fp.pos.x;
    const dz = camera.position.z - fp.pos.z;
    if (dx * dx + dz * dz < 1.6 * 1.6) {
      pickupFragment(fp.fragId);
      scene.remove(fp.group);
      fragmentPickups.splice(i, 1);
    }
  }
}

function pickupFragment(fragId) {
  // Save to meta as the equipped fragment for next run
  meta = loadMeta();
  const oldFrag = meta.equippedFragment;
  meta.equippedFragment = fragId;
  saveMeta(meta);

  // Apply immediately to running fragRuntime if different
  if (fragRuntime) {
    if (fragRuntime.id !== fragId) {
      const oldMult = fragRuntime.getHealthMultiplier();
      fragRuntime.dispose();
      fragRuntime = new FragmentRuntime(fragId, scene);
      const newMult = fragRuntime.getHealthMultiplier();
      
      if (oldMult !== newMult) {
        const ratio = newMult / oldMult;
        state.maxHealth = Math.round(state.maxHealth * ratio);
        state.health = Math.min(state.maxHealth, Math.round(state.health * ratio));
        updateHUD();
      }
    }
  }

  const def = FRAGMENT_DEFS.find(f => f.id === fragId);
  const iconHtml = def ? getIconImage(def.icon) : '';
  const textHtml = def ? `${iconHtml} ${def.name} COLLECTED!` : 'FRAGMENT COLLECTED!';
  showPickupMsg(textHtml, def?.colorHex || '#ffffff');
  playKillSound(); // reuse chirp for pickup
}

function showPickupMsg(text, color) {
  let el = document.getElementById('pickup-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pickup-msg';
    el.style.cssText = [
      'position:fixed', 'top:38%', 'left:50%', 'transform:translate(-50%,-50%)',
      'font-family:monospace', 'font-size:18px', 'font-weight:bold',
      'pointer-events:none', 'user-select:none',
      'text-shadow:0 0 12px currentColor', 'opacity:0', 'transition:opacity .15s',
      'display:flex', 'align-items:center', 'gap:8px',
    ].join(';');
    document.body.appendChild(el);
  }
  el.innerHTML  = text;
  el.style.color   = color;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

// ============================================================
// RELOAD RING + ABILITY SLOT HUD
// ============================================================
const _reloadRingEl     = document.getElementById('reload-ring');
const _reloadCircleEl   = document.getElementById('reload-ring-circle');
const _abilitySlotEl    = document.getElementById('ability-slot');
const _abilityIconEl    = document.getElementById('ability-icon');
const _abilityCdCircle  = document.getElementById('ability-cd-circle');
const _abilityTimerEl   = document.getElementById('ability-timer');

const RING_CIRCUMFERENCE = 138.23; // 2 * π * 22

function updateReloadRing(now) {
  if (!_reloadRingEl || !_reloadCircleEl || !state.weapon) return;
  const weapon = state.weapon;
  if (weapon.isReloading) {
    const progress = Math.min(1, (now - weapon.reloadStartTime) / weapon.reloadTime);
    _reloadCircleEl.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - progress)).toFixed(2);
    _reloadRingEl.style.opacity = '1';
  } else {
    _reloadRingEl.style.opacity = '0';
  }
}

function updateAbilitySlotHUD(now) {
  if (!_abilitySlotEl) return;
  if (!state.rightClickAbility) {
    _abilitySlotEl.style.display = 'none';
    return;
  }
  _abilitySlotEl.style.display = 'flex';

  // Icon
  if (_abilityIconEl) _abilityIconEl.innerHTML = getIconImage(ABILITY_ICONS[state.rightClickAbility]);

  // Cooldown ring
  const cdMax = ABILITY_COOLDOWNS[state.rightClickAbility];
  const cdRemaining = Math.max(0, state.abilityCooldownEnd - now);
  const cdFraction = cdRemaining / cdMax; // 1 = full CD, 0 = ready

  if (_abilityCdCircle) {
    _abilityCdCircle.style.strokeDashoffset = (RING_CIRCUMFERENCE * cdFraction).toFixed(2);
    _abilityCdCircle.style.stroke = cdRemaining > 0
      ? 'rgba(100,100,100,0.7)'
      : 'rgba(0,255,0,0.9)';
  }

  // Timer text
  if (_abilityTimerEl) {
    _abilityTimerEl.textContent = cdRemaining > 0 ? (cdRemaining / 1000).toFixed(1) + 's' : '';
  }
}


const SHOP_ITEMS = [
  {
    id: 'hp_boost', name: 'ARMOR MODULE', icon: '🛡',
    description: '+30 max HP', cost: 20,
    apply: (s) => { s.maxHealth += 30; s.health = Math.min(s.health + 30, s.maxHealth); }
  },
  {
    id: 'dmg_boost', name: 'WEAPON CORE', icon: '⚡',
    description: '+20% weapon damage', cost: 30,
    apply: (s) => { s.weapon.damageMultiplier += 0.20; }
  },
  {
    id: 'regen_boost', name: 'NANO REPAIR+', icon: '💉',
    description: '+5 HP/s regen', cost: 25,
    apply: (s) => { s.regenRate = (s.regenRate || 0) + 5; }
  },
  {
    id: 'fire_rate_boost', name: 'OVERCLOCK+', icon: '⚙',
    description: '+15% fire rate', cost: 25,
    apply: (s) => { s.weapon.fireRateMultiplier += 0.15; }
  },
  {
    id: 'damage_resist', name: 'CARBON FIBER', icon: '🧥',
    description: 'Take 10% less damage (max 50%)', cost: 35,
    apply: (s) => { s.damageResist = Math.min((s.damageResist || 0) + 0.1, 0.5); }
  },
  {
    id: 'ammo_cache', name: 'AMMO CACHE', icon: '📦',
    description: '+20% magazine size', cost: 20,
    apply: (s) => { s.weapon.magSizeMultiplier += 0.20; s.weapon.currentAmmo = s.weapon.getMaxAmmo(); }
  },
  {
    id: 'full_heal', name: 'FIELD REPAIR', icon: '💚',
    description: 'Fully restore HP', cost: 40,
    apply: (s) => { s.health = s.maxHealth; }
  },
  {
    id: 'speed_boost', name: 'SERVO BOOST', icon: '🏃',
    description: '+12% movement speed', cost: 22,
    apply: (s) => { s.weapon.moveSpeed *= 1.12; }
  },
];

function renderShop() {
  shopGearDisplay.textContent = `GEARS AVAILABLE: ${state.gears} ⚙`;
  shopGrid.innerHTML = '';
  SHOP_ITEMS.forEach((item, index) => {
    const canAfford = state.gears >= item.cost;
    const el = document.createElement('div');
    el.className = 'shop-item' + (canAfford ? '' : ' shop-item-disabled');
    el.innerHTML = `
      <div class="shop-slot">0${index + 1}</div>
      <div class="shop-icon">${getIconImage(item.icon)}</div>
      <h4>${item.name}</h4>
      <p>${item.description}</p>
      <div class="shop-cost">${item.cost} ⚙</div>
    `;
    if (canAfford) {
      el.addEventListener('click', () => {
        state.gears -= item.cost;
        item.apply(state);
        renderShop(); // re-render to update affordability
        updateHUD();
      });
    }
    shopGrid.appendChild(el);
  });
}

function openShop() {
  if (!state.running) return;
  state.shopOpen = true;
  document.body.style.cursor = ''; // Ensure cursor is visible in shop
  if (document.pointerLockElement) document.exitPointerLock();
  renderShop();
  shopScreen.style.display = 'flex';
}

function closeShop() {
  state.shopOpen = false;
  shopScreen.style.display = 'none';
  requestPointerLock();
}

let hitMarkerTimeout = null;

function showHitMarker() {
  const fx = clampNumber(runtimeSettings.graphics.effectsIntensity, 40, 200) / 100;
  hitMarker.style.opacity = String(clampNumber(0.65 + fx * 0.45, 0.4, 1));
  clearTimeout(hitMarkerTimeout);
  const duration = Math.round(70 + fx * 75);
  hitMarkerTimeout = setTimeout(() => { hitMarker.style.opacity = '0'; }, duration);
}

// ============================================================
// DIRECTIONAL DAMAGE INDICATOR
// ============================================================
let dmgIndicatorPos = null;
let dmgIndicatorTime = 0;
const DMG_INDICATOR_DURATION = 1400; // ms

function showDmgIndicator(attackerPos) {
  dmgIndicatorPos = attackerPos.clone();
  dmgIndicatorTime = performance.now();
}

function isEnemyOnScreen(worldPos) {
  const pos = worldPos.clone().project(camera);
  // pos.z > 1 means behind camera
  return pos.z < 1 && Math.abs(pos.x) < 1 && Math.abs(pos.y) < 1;
}

function updateDmgIndicator() {
  if (!dmgIndicatorPos) { dmgIndicatorEl.style.opacity = '0'; return; }

  const elapsed = performance.now() - dmgIndicatorTime;
  if (elapsed >= DMG_INDICATOR_DURATION) {
    dmgIndicatorPos = null;
    dmgIndicatorEl.style.opacity = '0';
    return;
  }

  // Calculate screen-space angle: atan2(dx, -dz) gives world angle where -Z = forward
  const dx = dmgIndicatorPos.x - camera.position.x;
  const dz = dmgIndicatorPos.z - camera.position.z;
  const worldAngle = Math.atan2(dx, -dz);
  const screenAngle = worldAngle - yaw;

  const fx = clampNumber(runtimeSettings.graphics.effectsIntensity, 40, 200) / 100;
  const opacity = (1 - elapsed / DMG_INDICATOR_DURATION) * 0.95 * fx;
  dmgIndicatorEl.style.opacity = opacity.toFixed(3);
  dmgIndicatorEl.style.transform = `rotate(${screenAngle.toFixed(4)}rad)`;
}

function updateOverclockVisuals(now) {
  const active = !!(fragRuntime && fragRuntime.isOverclockActive && fragRuntime.isOverclockActive());
  if (!overclockGlitchOverlay || !overclockDangerOverlay) return;
  if (!active) {
    overclockGlitchOverlay.style.opacity = '0';
    overclockDangerOverlay.style.opacity = '0';
    overclockGlitchOverlay.style.transform = 'translate(0px, 0px)';
    return;
  }
  const fx = clampNumber(runtimeSettings.graphics.effectsIntensity, 40, 200) / 100;
  const jitterX = (Math.random() - 0.5) * 6;
  const jitterY = (Math.random() - 0.5) * 4;
  overclockGlitchOverlay.style.opacity = (0.11 + Math.random() * 0.08 * fx).toFixed(3);
  overclockDangerOverlay.style.opacity = (0.25 + Math.abs(Math.sin(now * 0.02)) * 0.25 * fx).toFixed(3);
  overclockGlitchOverlay.style.transform = `translate(${jitterX.toFixed(2)}px, ${jitterY.toFixed(2)}px)`;
}

// ============================================================
// CLASS SELECTION
// ============================================================
const classButtons = document.querySelectorAll('.class-btn');
const startBtn = document.getElementById('start-btn');

classButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    classButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.playerClass = btn.dataset.class;
    startBtn.style.display = 'block';
  });
});

startBtn.addEventListener('click', () => {
  if (!state.playerClass) return;
  showStoryScreen(); // → story screen → beginGame() → startGame()
});

document.getElementById('restart-btn').addEventListener('click', () => {
  location.reload();
});

// ============================================================
// POINTER LOCK
// ============================================================
function requestPointerLock() {
  renderer.domElement.requestPointerLock();
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === renderer.domElement) {
    state.paused = false;
    blocker.style.display = 'none';
    screenPause.style.display = 'none';
    screenSettings.style.display = 'none';
    const wsHud = document.getElementById('ws-hud');
    if (wsHud && isWorkshopActive()) wsHud.style.display = 'block';
  } else {
    document.body.style.cursor = ''; // Ensure cursor is visible
    if ((state.running || isWorkshopActive())
      && document.getElementById('card-screen').style.display !== 'flex'
      && screenStory.style.display !== 'flex'
      && !state.shopOpen) {
      state.paused = true;
      pauseCursor = 0;
      updatePauseCursor();
      blocker.style.display = 'block';
      screenPause.style.display = 'flex';
      screenSettings.style.display = 'none';
      screenMain.style.display = 'none';
      screenClass.style.display = 'none';
      screenControls.style.display = 'none';
      const wsHud = document.getElementById('ws-hud');
      if (wsHud) wsHud.style.display = 'none';
    }
  }
});

// ============================================================
// INPUT
// ============================================================
document.addEventListener('keydown', (e) => { keys[e.code] = true; });
document.addEventListener('keyup', (e) => { keys[e.code] = false; });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.002;
  pitch -= e.movementY * 0.002;
  pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
});

// Any interaction on the page can start the menu music
document.addEventListener('mousedown', tryStartMenuMusic, { once: true, capture: true });
document.addEventListener('keydown', tryStartMenuMusic, { once: true, capture: true });

document.addEventListener('contextmenu', e => e.preventDefault());

let isFiring = false;
document.addEventListener('mousedown', (e) => {
  if (e.button === 0) isFiring = true;
  if (e.button === 2 && state.running && !state.paused && !state.shopOpen) {
    activateAbility();
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) isFiring = false;
});
document.addEventListener('keydown', (e) => {
  // Only handle navigation when any menu is visible
  if (blocker.style.display !== 'none') {
    // If pause menu is active
    if (screenPause.style.display === 'flex' || getComputedStyle(screenPause).display === 'flex') {
      if (e.code === 'ArrowUp') {
        pauseCursor = (pauseCursor - 1 + PAUSE_MENU_IDS.length) % PAUSE_MENU_IDS.length;
        updatePauseCursor();
        return;
      } else if (e.code === 'ArrowDown') {
        pauseCursor = (pauseCursor + 1) % PAUSE_MENU_IDS.length;
        updatePauseCursor();
        return;
      } else if (e.code === 'Enter') {
        activatePauseItem(pauseCursor);
        return;
      }
    }

    // If main menu is active
    if (screenMain.style.display === 'flex' || getComputedStyle(screenMain).display === 'flex') {
      if (e.code === 'ArrowUp') {
        menuCursor = (menuCursor - 1 + MENU_ITEMS_IDS.length) % MENU_ITEMS_IDS.length;
        updateMenuCursor();
        return;
      } else if (e.code === 'ArrowDown') {
        menuCursor = (menuCursor + 1) % MENU_ITEMS_IDS.length;
        updateMenuCursor();
        return;
      } else if (e.code === 'Enter') {
        tryStartMenuMusic();
        activateMenuItem(menuCursor);
        return;
      }
    }
  }

  if (e.code === 'Escape') {
    if (state.shopOpen) {
      closeShop();
    } else if (state.paused) {
      requestPointerLock();
    }
  }
  if (e.code === 'KeyR' && state.weapon) {
    state.weapon.startReload(performance.now());
  }
  if (e.code === 'Space' && state.running && !state.paused) {
    jumpPressed = true;
  }
  if (e.code === 'KeyG' && state.running && !state.paused) {
    throwGrenade();
  }
  if (e.code === 'Tab' && state.running) {
    e.preventDefault();
    if (state.shopOpen) { closeShop(); } else { openShop(); }
  }
  // Debug panel toggle
  if (e.code === 'KeyL') {
    const panel = document.getElementById('debug-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  }
  // Melee attack
  if (e.code === 'KeyF' && state.running && !state.paused) {
    performMelee();
  }
});

// ============================================================
// START GAME
// ============================================================
function startGame() {
  blocker.style.display = 'none';
  hud.style.display = 'block';
  crosshair.style.display = 'block';
  crosshair.classList.toggle('shotgun-reticle', state.playerClass === 'shotgun');
  applyDisplaySettings();

  // Init weapon
  state.weapon = new Weapon(state.playerClass);
  state.moveSpeed = state.weapon.moveSpeed;
  const classHp = state.weapon.baseHealth;
  state.health = classHp;
  state.maxHealth = classHp;
  state.score = 0;
  state.wave = 0;
  state.enemies = [];
  state.running = true;
  state.canJump = false;
  state.canDoubleJump = false;
  state.canSprint = false;
  state.grenadeCount = 0;
  state.regenRate = 0;
  state.gears = 0;
  state.damageResist = 0;
  state.shopOpen = false;
  state.currentBoss = null;
  state.rightClickAbility = null;
  if (state.rendezvousMesh) {
    scene.remove(state.rendezvousMesh);
    state.rendezvousMesh = null;
  }
  state.rendezvousActive = false;
  state.rendezvousMarkerPos = null;
  state.abilityCooldownEnd = 0;
  state.invincibleUntil = 0;
  state.killStreak = 0;
  state.killMultiplier = 1;
  dashVelX = 0;
  dashVelZ = 0;
  if (activeBarrier) {
    scene.remove(activeBarrier.mesh);
    activeBarrier.mesh.geometry.dispose();
    activeBarrier.mesh.material.dispose();
    activeBarrier = null;
  }
  cleanupGrapple();
  // Remove all oil decals
  for (const d of oilDecals) {
    scene.remove(d);
    d.geometry.dispose();
    d.material.dispose();
  }
  oilDecals.length = 0;
  for (const d of impactDecals) {
    scene.remove(d.mesh);
    d.mesh.geometry.dispose();
    d.mesh.material.dispose();
  }
  impactDecals.length = 0;

  // Reset jump state
  jumpVelocity = 0;
  isGrounded = true;
  hasDoubleJumped = false;
  jumpPressed = false;
  activeGrenades.length = 0;

  // Apply meta-progression permanent upgrades
  meta = loadMeta();
  applyMetaUpgrades(state, meta);
  // Update moveSpeed from weapon in case meta changed it
  state.moveSpeed = state.weapon.moveSpeed;

  // Fragment system — init for this run
  if (fragRuntime) { fragRuntime.dispose(); }
  // Restore any enemies that might still have slow applied from previous run (none yet, but safe)
  fragmentPickups.forEach(fp => { scene.remove(fp.group); });
  fragmentPickups = [];
  const equippedFragId = getEquippedFragment(meta);
  // Validate: if equipped fragment is now locked (shouldn't happen but guard it), clear it
  const validFragId = (equippedFragId && isFragmentUnlocked(meta, equippedFragId)) ? equippedFragId : null;
  fragRuntime = new FragmentRuntime(validFragId, scene);

  // Apply fragment health multiplier
  const hpMult = fragRuntime.getHealthMultiplier();
  if (hpMult !== 1.0) {
    state.maxHealth = Math.round(state.maxHealth * hpMult);
    state.health = Math.round(state.health * hpMult);
  }

  // Create arena
  const arenaData = createArena(scene);
  state.obstacles = arenaData.obstacles;
  state.arenaSize = arenaData.arenaSize;
  state.arenaMeshes = arenaData.solidMeshes || [];
  arenaWalkables = arenaData.walkables || [];
  arenaJumpPads = arenaData.jumpPads || [];
  crateTimeOnTop = 0;
  playerOnCrate = false;
  mortarProjectiles.length = 0;
  state.arenaLights = {
    ambient: arenaData.ambientLight,
    point1: arenaData.pointLight1,
    point2: arenaData.pointLight2,
    centralCore: arenaData.centralCoreLight,
  };

  // Setup effects
  bulletTrail = new BulletTrail(scene);
  particleSystem = new ParticleSystem(scene);
  window.particleSystem = particleSystem; // Expose for arena effects

  // Weapon view model
  if (weaponModel) weaponContainer.remove(weaponModel);
  weaponModel = createWeaponViewModel(state.playerClass);
  weaponModel.position.set(0.25, -0.2, -0.4);
  weaponContainer.add(weaponModel);

  muzzleFlash = createMuzzleFlash();
  muzzleFlash.position.set(0, 0.02, -0.75);
  weaponContainer.add(muzzleFlash);

  meleeModel = createMeleeViewModel();
  meleeModel.position.set(-0.25, -0.2, -0.4);
  meleeModel.visible = false;
  weaponContainer.add(meleeModel);

  kickModel = createKickViewModel();
  kickModel.position.set(-0.35, -0.9, -0.15); // Lowered and pulled back
  kickModel.rotation.set(0, Math.PI / 12, 0); // Pre-tilted for better entry
  kickModel.visible = false;
  weaponContainer.add(kickModel);

  requestPointerLock();
  startNextWave();
  animate();
}

// ============================================================
// WAVE MANAGEMENT
// ============================================================
function startNextWave() {
  if (state.waveInProgress) return;
  state.wave++;
  state.waveInProgress = true;

  // Check if boss wave
  const isBossWave = (state.wave % 5 === 0) || state.machineKingEnding;
  let bossName = '';
  if (state.machineKingEnding) {
    bossName = 'HUMAN REAPER';
  } else if (isBossWave) {
    if (state.wave >= 15) bossName = 'NANOMAN';
    else if (state.wave >= 10) bossName = 'DARIOLTMAN';
    else bossName = 'CARMACKION';
  }

  // Announce wave
  waveAnnounce.textContent = isBossWave ? `⚠ BOSS: ${bossName} ⚠` : `WAVE ${state.wave}`;
  waveAnnounce.style.color = isBossWave ? '#ff0' : '#f00';
  waveAnnounce.style.display = 'block';
  setTimeout(() => { waveAnnounce.style.display = 'none'; }, isBossWave ? 3000 : 2000);

  if (isBossWave) {
    playBossAppearSound();
  }

  // Reveal jump pads from wave 5 onward
  if (state.wave === 5) {
    arenaJumpPads.forEach(jp => { jp.mesh.visible = true; });
  }

  // Atmosphere shift every 5 waves
  applyAtmosphere(state.wave);

  // Generate enemies
  let newEnemies;
  if (state.machineKingEnding) {
    newEnemies = [spawnBoss('human_reaper', state.arenaSize, state.wave)];
  } else {
    newEnemies = generateWave(state.wave, state.arenaSize);
  }

  // Setup boss callbacks and mortar callbacks; track boss
  newEnemies.forEach(e => {
    scene.add(e.mesh);
    if (e.isBoss) {
      state.currentBoss = e;
      setupBossCallbacks(e);
    }
    if (e.type === 'mortar') {
      e.mortarCallback = (targetPos) => spawnMortarShell(targetPos, e.damage);
    }
  });
  state.enemies = newEnemies;

  updateHUD();
  updateBossHUD();
}


function onWaveComplete() {
  state.currentBoss = null;
  updateBossHUD();

  // Unlock fragments for the wave just completed
  const meta = loadMeta();
  if (unlockFragmentsForWave(meta, state.wave, FRAGMENT_DEFS)) {
    // Show a brief unlock notification
    const newlyUnlocked = FRAGMENT_DEFS.filter(f =>
      f.unlockWave === state.wave && meta.unlockedFragments.includes(f.id),
    );
    if (newlyUnlocked.length > 0) {
      showFragmentUnlockNotice(newlyUnlocked[0]);
    }
  }

  // Branching Ending at Wave 15
  if (state.wave === 15) {
    if (document.pointerLockElement) document.exitPointerLock();
    showChoiceScreen();
    return;
  }

  // Show upgrade cards
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  const cards = getRandomCards(3, state);
  showCardScreen(cards, (selectedCard) => {
    selectedCard.apply(state);
    // Refill ammo on wave complete
    state.weapon.currentAmmo = state.weapon.getMaxAmmo();
    state.weapon.isReloading = false;
    requestPointerLock();
    

    // Start wave completely seamlessly
    startNextWave();
  }, state.wave);
}

// ============================================================
// FRAGMENT UNLOCK NOTIFICATION
// ============================================================
function showFragmentUnlockNotice(fragDef) {
  let el = document.getElementById('frag-unlock-notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'frag-unlock-notice';
    el.style.cssText = [
      'position:fixed', 'top:30%', 'left:50%', 'transform:translate(-50%,-50%)',
      'font-family:monospace', 'font-size:18px', 'font-weight:bold',
      'pointer-events:none', 'user-select:none', 'text-align:center',
      'text-shadow:0 0 12px currentColor', 'opacity:0', 'transition:opacity .2s',
    ].join(';');
    document.body.appendChild(el);
  }
  el.style.color = fragDef.colorHex;
  const iconHtml = getIconImage(fragDef.icon);
  el.innerHTML = `${iconHtml} FRAGMENT UNLOCKED<br><span style="font-size:14px">${fragDef.name}</span>`;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// ============================================================
// ============================================================
const ATMOSPHERE_PALETTES = [
  // wave 1-4: default dark machine (brightened)
  { fog: 0x0d111a, sky: 0x0d111a, ambient: 0x667799, point1: 0xff4422, point2: 0x00ffcc },
  // wave 5-9: acid green industrial (brightened)
  { fog: 0x111a0d, sky: 0x111a0d, ambient: 0x668855, point1: 0x22ff44, point2: 0xccff00 },
  // wave 10-14: blood red hell (brightened)
  { fog: 0x1a0d0d, sky: 0x1a0d0d, ambient: 0x884444, point1: 0xff2200, point2: 0xff6600 },
  // wave 15-19: void purple (brightened)
  { fog: 0x120d1a, sky: 0x120d1a, ambient: 0x664488, point1: 0xbb44ff, point2: 0xff44cc },
  // wave 20+: neon cyan wasteland (brightened)
  { fog: 0x0d161a, sky: 0x0d161a, ambient: 0x447788, point1: 0x00ffff, point2: 0x22aaff },
];

function applyAtmosphere(wave) {
  const idx = Math.min(Math.floor((wave - 1) / 5), ATMOSPHERE_PALETTES.length - 1);
  const pal = ATMOSPHERE_PALETTES[idx];
  if (scene.fog) {
    scene.fog.color.setHex(pal.fog);
  }
  scene.background.setHex(pal.sky);
  if (state.arenaLights) {
    state.arenaLights.ambient.color.setHex(pal.ambient);
    state.arenaLights.point1.color.setHex(pal.point1);
    state.arenaLights.point2.color.setHex(pal.point2);
  }
  
  // Update arena visual state (Clean vs Dirty)
  if (window.updateArenaAesthetics) {
    window.updateArenaAesthetics(wave);
  }
}

// ============================================================
// MORTAR PROJECTILE SYSTEM
// ============================================================
function spawnMortarShell(targetPos, damage) {
  const FLIGHT_TIME = 2.5; // seconds before impact
  const WARN_TIME = 1.8;   // when marker appears (s before impact)

  // Shell mesh
  const shellGeo = new THREE.SphereGeometry(0.18, 6, 4);
  const shellMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const shell = new THREE.Mesh(shellGeo, shellMat);

  // Determine a random mortar source (one of alive mortar enemies)
  const mortarEnemies = state.enemies.filter(e => e.alive && e.type === 'mortar');
  const startPos = mortarEnemies.length > 0
    ? mortarEnemies[Math.floor(Math.random() * mortarEnemies.length)].mesh.position.clone()
    : new THREE.Vector3((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60);
  startPos.y = 1.5;

  shell.position.copy(startPos);
  scene.add(shell);

  // Ground target marker (ring)
  const markerGeo = new THREE.RingGeometry(0.5, 1.8, 16);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xff2200, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(targetPos.x, 0.05, targetPos.z);
  scene.add(marker);

  mortarProjectiles.push({
    shell,
    marker,
    startPos: startPos.clone(),
    targetPos: targetPos.clone(),
    elapsed: 0,
    totalTime: FLIGHT_TIME,
    warnTime: WARN_TIME,
    damage,
    exploded: false,
  });
}

function updateMortarProjectiles(delta) {
  for (let i = mortarProjectiles.length - 1; i >= 0; i--) {
    const p = mortarProjectiles[i];
    if (p.exploded) {
      mortarProjectiles.splice(i, 1);
      continue;
    }

    p.elapsed += delta;
    const t = Math.min(p.elapsed / p.totalTime, 1);

    // Parabolic arc: lerp x/z, sin arc for y
    p.shell.position.x = p.startPos.x + (p.targetPos.x - p.startPos.x) * t;
    p.shell.position.z = p.startPos.z + (p.targetPos.z - p.startPos.z) * t;
    p.shell.position.y = Math.sin(t * Math.PI) * 18 + 1.5 * (1 - t);
    p.shell.rotation.x += delta * 5;

    // Show marker when approaching
    const timeLeft = p.totalTime - p.elapsed;
    if (timeLeft <= p.warnTime) {
      const fade = 1 - (timeLeft / p.warnTime);
      p.marker.material.opacity = fade * 0.85;
      const pulse = 0.8 + Math.sin(p.elapsed * 12) * 0.2;
      p.marker.scale.setScalar(pulse);
    }

    // Impact
    if (t >= 1) {
      p.exploded = true;

      // Explosion particles
      if (particleSystem) {
        particleSystem.emit(p.targetPos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff4400, 12);
        particleSystem.emit(p.targetPos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffaa00, 8);
      }

      // AOE damage to player
      const distToPlayer = p.targetPos.distanceTo(camera.position);
      if (distToPlayer < 3.5) {
        const falloff = 1 - distToPlayer / 3.5;
        takeDamage(p.damage * falloff, p.targetPos);
      }

      // Friendly fire: AOE also damages other enemies in blast radius (3.5u)
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const ed = p.targetPos.distanceTo(e.mesh.position);
        if (ed < 3.5) {
          const falloff = 1 - ed / 3.5;
          e.takeDamage(p.damage * 0.6 * falloff);
          if (!e.alive) handleEnemyKill(e);
        }
      }

      scene.remove(p.shell);
      p.shell.geometry.dispose();
      p.shell.material.dispose();
      scene.remove(p.marker);
      p.marker.geometry.dispose();
      p.marker.material.dispose();
    }
  }
}

// Sniper beam friendly fire: enemies within 1.8u of the beam line take 50% sniper damage
function sniperFriendlyFire(sniperEnemy, playerPos) {
  const SPLASH_RADIUS = 1.8;
  const origin = sniperEnemy.mesh.position.clone();
  const target = playerPos.clone();
  const beamDir = new THREE.Vector3().subVectors(target, origin);
  const beamLen = beamDir.length();
  if (beamLen < 0.001) return;
  beamDir.divideScalar(beamLen);

  for (const e of state.enemies) {
    if (!e.alive || e === sniperEnemy) continue;
    // Project enemy position onto beam, clamp to segment
    const toEnemy = new THREE.Vector3().subVectors(e.mesh.position, origin);
    const t = Math.max(0, Math.min(beamLen, toEnemy.dot(beamDir)));
    const closest = origin.clone().addScaledVector(beamDir, t);
    const dist = e.mesh.position.distanceTo(closest);
    if (dist < SPLASH_RADIUS) {
      const falloff = 1 - dist / SPLASH_RADIUS;
      e.takeDamage(sniperEnemy.damage * 0.5 * falloff);
      if (!e.alive) handleEnemyKill(e);
    }
  }
}

function cleanupMortarProjectiles() {
  for (const p of mortarProjectiles) {
    scene.remove(p.shell);
    p.shell.geometry.dispose();
    p.shell.material.dispose();
    scene.remove(p.marker);
    p.marker.geometry.dispose();
    p.marker.material.dispose();
  }
  mortarProjectiles.length = 0;
}

// Meteor drops on player after staying too long on a crate
function spawnCrateMeteor() {
  // Ring warning first
  const warnGeo = new THREE.RingGeometry(0.4, 1.5, 16);
  const warnMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const warnRing = new THREE.Mesh(warnGeo, warnMat);
  warnRing.rotation.x = -Math.PI / 2;
  warnRing.position.copy(camera.position);
  warnRing.position.y = 0.05;
  scene.add(warnRing);

  // Meteor ball approaching from sky
  const meteorGeo = new THREE.OctahedronGeometry(0.5, 0);
  const meteorMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
  const meteor = new THREE.Mesh(meteorGeo, meteorMat);
  const targetPos = camera.position.clone();
  meteor.position.copy(targetPos);
  meteor.position.y = 20;
  scene.add(meteor);

  let elapsed2 = 0;
  const totalTime = 1.0;
  function animateMeteor() {
    elapsed2 += 0.016;
    const t = Math.min(elapsed2 / totalTime, 1);
    meteor.position.y = 20 * (1 - t) + targetPos.y * t;
    meteor.rotation.x += 0.15;
    warnMat.opacity = 0.8 - t * 0.6;
    if (t < 1) {
      requestAnimationFrame(animateMeteor);
    } else {
      scene.remove(meteor);
      meteor.geometry.dispose();
      meteor.material.dispose();
      scene.remove(warnRing);
      warnRing.geometry.dispose();
      warnRing.material.dispose();
      // Damage player
      takeDamage(40, targetPos);
      if (particleSystem) {
        particleSystem.emit(targetPos.clone().add(new THREE.Vector3(0, 1, 0)), 0xff4400, 14);
      }
    }
  }
  requestAnimationFrame(animateMeteor);
}

function playJumpPadSound() {
  const ctx = getAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(1400, now + 0.18);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(getSfxGain());
  osc.start(now);
  osc.stop(now + 0.2);
}

// ============================================================
// BOSS HELPERS
// ============================================================
function setupBossCallbacks(boss) {
  // CARMACKION: LMG bullets, rockets, lava, arena changes
  if (boss.type === 'carmackion') {
    // LMG bullet callback
    boss.lmgBulletCallback = (muzzlePos, targetPos) => {
      const geo = new THREE.BoxGeometry(0.06, 0.06, 0.35);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(muzzlePos);
      const dir = new THREE.Vector3().subVectors(targetPos, muzzlePos);
      // Small spread
      dir.x += (Math.random() - 0.5) * 0.3;
      dir.y += (Math.random() - 0.5) * 0.15;
      dir.normalize();
      scene.add(mesh);
      carmackionBullets.push({
        mesh,
        dir,
        speed: 32,
        traveled: 0,
        maxRange: 28,
        damage: 18,
      });
    };

    // Rocket callback
    boss.rocketCallback = (muzzlePos, targetPos) => {
      const geo = new THREE.BoxGeometry(0.16, 0.16, 0.55);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(muzzlePos);
      const dir = new THREE.Vector3().subVectors(targetPos, muzzlePos).normalize();
      // Orient rocket toward target
      const angle = Math.atan2(dir.x, dir.z);
      mesh.rotation.y = angle;
      scene.add(mesh);
      carmackionRockets.push({
        mesh,
        dir,
        speed: 16,
        traveled: 0,
        maxRange: 35,
        damage: 55,
        blastRadius: 5,
      });
      playCarmackionRocketSound();
    };

    // Lava geyser callback (spawns vents in arena)
    boss.lavaCallback = () => {
      // Remove old vents first
      for (const vent of carmackionLavaVents) {
        scene.remove(vent.mesh);
        vent.mesh.geometry.dispose();
        vent.mesh.material.dispose();
      }
      carmackionLavaVents.length = 0;

      // Spawn 4–6 new lava vents
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * (state.arenaSize * 1.5);
        const z = (Math.random() - 0.5) * (state.arenaSize * 1.5);
        const geo = new THREE.CylinderGeometry(2.0, 2.5, 0.25, 8);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xff4400, transparent: true, opacity: 0.75
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0.12, z);
        scene.add(mesh);

        // Inner glow disc
        const innerGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.26, 8);
        const innerMat = new THREE.MeshBasicMaterial({
          color: 0xffff00, transparent: true, opacity: 0.5
        });
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.position.set(x, 0.14, z);
        scene.add(inner);

        carmackionLavaVents.push({
          mesh,
          innerMesh: inner,
          position: new THREE.Vector3(x, 0, z),
          radius: 2.0,
          damage: 6, // damage per second
          spawnTime: performance.now(),
          lifetime: 12000, // 12s
        });
      }
      playCarmackionLavaSound();
    };

    // Arena phase change callback
    boss.arenaPhaseCallback = (phase) => {
      if (phase === 2) {
        // Arena goes hellish orange
        scene.fog.color.setHex(0x3a1500);
        scene.fog.density = 0.015;
        scene.background.setHex(0x1a0800);
        if (state.arenaLights) {
          state.arenaLights.ambient.color.setHex(0xff4400);
          state.arenaLights.ambient.intensity = 0.8;
          state.arenaLights.point1.color.setHex(0xff2200);
          state.arenaLights.point1.intensity = 2.0;
          state.arenaLights.point2.color.setHex(0xff8800);
          state.arenaLights.point2.intensity = 1.5;
        }
        // Boss phase 2 screen flash
        waveAnnounce.textContent = '⚠ CARMACKION PHASE 2 ⚠';
        waveAnnounce.style.color = '#f80';
        waveAnnounce.style.display = 'block';
        setTimeout(() => { waveAnnounce.style.display = 'none'; }, 2500);
        playBossPhaseChangeSound();
      } else if (phase === 3) {
        // Arena turns hellish lava red
        scene.fog.color.setHex(0x2a0000);
        scene.fog.density = 0.022;
        scene.background.setHex(0x100000);
        if (state.arenaLights) {
          state.arenaLights.ambient.color.setHex(0xff1100);
          state.arenaLights.ambient.intensity = 1.2;
          state.arenaLights.point1.color.setHex(0xff0000);
          state.arenaLights.point1.intensity = 3.0;
          state.arenaLights.point2.color.setHex(0xff4400);
          state.arenaLights.point2.intensity = 2.5;
        }
        waveAnnounce.textContent = '🔥 CARMACKION PHASE 3 🔥';
        waveAnnounce.style.color = '#f00';
        waveAnnounce.style.display = 'block';
        setTimeout(() => { waveAnnounce.style.display = 'none'; }, 2500);
        playBossPhaseChangeSound();
      }
    };
  }

  // DARIOLTMAN: shotgun pellets, swamp minions, zone explosions, snipers, meteors, arena changes
  if (boss.type === 'darioltman') {
    // Shotgun: fires 6 pellets in a spread cone
    boss.shotgunCallback = (muzzlePos, targetPos, distToTarget) => {
      const baseDir = new THREE.Vector3().subVectors(targetPos, muzzlePos).normalize();
      for (let i = 0; i < 6; i++) {
        const spread = 0.22;
        const pelletDir = baseDir.clone();
        pelletDir.x += (Math.random() - 0.5) * spread * 2;
        pelletDir.y += (Math.random() - 0.5) * spread * 0.3;
        pelletDir.z += (Math.random() - 0.5) * spread * 2;
        pelletDir.normalize();

        const geo = new THREE.SphereGeometry(0.07, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(muzzlePos);
        scene.add(mesh);

        darioltmanPellets.push({
          mesh,
          dir: pelletDir,
          speed: 26,
          traveled: 0,
          maxRange: 15,
          // Damage is boss.damage * 0.45 per pellet; applied with falloff in update
          damage: boss.damage * 0.45,
        });
      }
      playDarioltmanShotgunSound();
    };

    // Swamp minion spawn (walkers with green tint — "swamp beasts")
    boss.minionSpawnCallback = (bossPos) => {
      const count = boss.phase >= 2 ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random();
        const spawnPos = bossPos.clone().add(new THREE.Vector3(Math.cos(angle) * 7, 0, Math.sin(angle) * 7));
        const minion = new Enemy('walker', spawnPos, 1 + (state.wave - 1) * 0.1);
        // Recolor to swampy green
        minion.mesh.traverse(c => {
          if (c.isMesh && c.material && c.material.color && c !== minion.hpBar && c !== minion.hpBarBg) {
            c.material = c.material.clone();
            c.material.color.setHex(0x2a6a18);
          }
        });
        scene.add(minion.mesh);
        state.enemies.push(minion);
      }
    };

    // Sniper spawn (phase 2+)
    boss.sniperSpawnCallback = (bossPos) => {
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 16 + Math.random() * 10;
        const sx = Math.max(-state.arenaSize + 2, Math.min(state.arenaSize - 2, bossPos.x + Math.cos(angle) * r));
        const sz = Math.max(-state.arenaSize + 2, Math.min(state.arenaSize - 2, bossPos.z + Math.sin(angle) * r));
        const sniper = new Enemy('sniper', new THREE.Vector3(sx, 0, sz), 1 + (state.wave - 1) * 0.1);
        scene.add(sniper.mesh);
        state.enemies.push(sniper);
      }
    };

    // Zone explosion callback: mark arena sections red then detonate
    boss.zoneExplosionCallback = () => {
      // Remove any lingering old zones
      for (const z of darioltmanZones) {
        if (!z.removed) {
          scene.remove(z.mesh);
          z.mesh.geometry.dispose();
          z.mesh.material.dispose();
          z.removed = true;
        }
      }
      darioltmanZones.length = 0;

      // Sometimes half the arena, sometimes a quarter
      const isHalfArena = Math.random() < 0.4;
      const zoneCount = isHalfArena ? 5 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 2);
      const sizeMult = isHalfArena ? 20 : 14;

      for (let i = 0; i < zoneCount; i++) {
        const w = sizeMult + (Math.random() - 0.5) * 8;
        const h = sizeMult + (Math.random() - 0.5) * 8;
        const x = (Math.random() - 0.5) * state.arenaSize * 1.7;
        const z = (Math.random() - 0.5) * state.arenaSize * 1.7;

        const geo = new THREE.PlaneGeometry(w, h);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xff0000, transparent: true, opacity: 0.35, side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.15, z);
        scene.add(mesh);

        const now = performance.now();
        darioltmanZones.push({
          mesh,
          position: new THREE.Vector3(x, 0, z),
          width: w,
          height: h,
          spawnTime: now,
          explodeTime: now + 1800,
          removeAt: 0,
          exploded: false,
          removed: false,
        });
      }
      playDarioltmanZoneWarningSound();
    };

    // Meteor barrage callback (phase 3)
    boss.meteorCallback = (targetPos) => {
      const meteorCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < meteorCount; i++) {
        setTimeout(() => {
          if (!state.running) return;
          const x = Math.max(-state.arenaSize + 2, Math.min(state.arenaSize - 2,
            targetPos.x + (Math.random() - 0.5) * 22));
          const z = Math.max(-state.arenaSize + 2, Math.min(state.arenaSize - 2,
            targetPos.z + (Math.random() - 0.5) * 22));
          const impactPos = new THREE.Vector3(x, 0.12, z);

          // Warning ring on ground
          const ringGeo = new THREE.RingGeometry(0.6, 2.8, 16);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff4400, transparent: true, opacity: 0.7, side: THREE.DoubleSide
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.copy(impactPos);
          scene.add(ring);

          // Meteor (starts high up, falls to ground)
          const meteorGeo = new THREE.IcosahedronGeometry(0.75, 0);
          const meteorMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
          const meteorMesh = new THREE.Mesh(meteorGeo, meteorMat);
          meteorMesh.position.set(x, 32, z);
          scene.add(meteorMesh);

          darioltmanMeteors.push({
            mesh: meteorMesh,
            ring,
            targetPos: impactPos.clone(),
            spawnTime: performance.now(),
            fallDuration: 1400,
            damage: 75,
            blastRadius: 4.5,
            impacted: false,
          });
          playDarioltmanMeteorSound();
        }, i * 450);
      }
    };

    // Arena phase change callback
    boss.arenaPhaseCallback = (phase) => {
      if (phase === 2) {
        // Dark ritual purple — demonic summoning
        scene.fog.color.setHex(0x1a0a2a);
        scene.fog.density = 0.016;
        scene.background.setHex(0x0d0518);
        if (state.arenaLights) {
          state.arenaLights.ambient.color.setHex(0x6600bb);
          state.arenaLights.ambient.intensity = 0.75;
          state.arenaLights.point1.color.setHex(0xaa0055);
          state.arenaLights.point1.intensity = 2.5;
          state.arenaLights.point2.color.setHex(0x8800cc);
          state.arenaLights.point2.intensity = 2.0;
        }
        waveAnnounce.textContent = '👁 DARIOLTMAN PHASE 2 👁';
        waveAnnounce.style.color = '#d04fff';
        waveAnnounce.style.display = 'block';
        setTimeout(() => { waveAnnounce.style.display = 'none'; }, 2500);
        playBossPhaseChangeSound();
      } else if (phase === 3) {
        // Full hellfire — demon unleashed
        scene.fog.color.setHex(0x2a0000);
        scene.fog.density = 0.025;
        scene.background.setHex(0x120000);
        if (state.arenaLights) {
          state.arenaLights.ambient.color.setHex(0xff0000);
          state.arenaLights.ambient.intensity = 1.4;
          state.arenaLights.point1.color.setHex(0xff4400);
          state.arenaLights.point1.intensity = 3.5;
          state.arenaLights.point2.color.setHex(0xff2200);
          state.arenaLights.point2.intensity = 3.0;
        }
        waveAnnounce.textContent = '💀 DARIOLTMAN UNLEASHED 💀';
        waveAnnounce.style.color = '#f00';
        waveAnnounce.style.display = 'block';
        setTimeout(() => { waveAnnounce.style.display = 'none'; }, 3000);
        playBossPhaseChangeSound();
      }
    };
  }



  // NANOMAN: power leap, dual HMG, arena changes
  if (boss.type === 'nanoman') {
    // Leap warning marker (shown right when boss leaves ground)
    boss.leapMarkerCallback = (targetPos) => {
      const markerGeo = new THREE.RingGeometry(0.8, 3.0, 24);
      const markerMat = new THREE.MeshBasicMaterial({
        color: 0x00ff66, transparent: true, opacity: 0.75, side: THREE.DoubleSide
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(targetPos.x, 0.18, targetPos.z);
      scene.add(marker);
      playNanomanLeapSound();

      // Animate pulsing (brightens as impact approaches)
      const startTime = performance.now();
      const TOTAL = 1700; // ms before slam
      const pulse = () => {
        if (!state.running) { scene.remove(marker); return; }
        const t = (performance.now() - startTime) / TOTAL;
        if (t >= 1) {
          scene.remove(marker);
          marker.geometry.dispose();
          marker.material.dispose();
          return;
        }
        marker.material.opacity = 0.4 + Math.abs(Math.sin(t * Math.PI * 8)) * 0.5;
        requestAnimationFrame(pulse);
      };
      requestAnimationFrame(pulse);
    };

    // Leap impact slam
    boss.leapImpactCallback = (impactPos) => {
      // Damage player
      const distToPlayer = camera.position.distanceTo(impactPos);
      if (distToPlayer < 6) {
        takeDamage(boss.damage * 1.5 * (1 - distToPlayer / 6), impactPos);
      }
      // Shockwave particles
      if (particleSystem) {
        particleSystem.emit(impactPos.clone(), 0x00ff88, 18);
        particleSystem.emit(impactPos.clone(), 0xffffff, 8);
      }
      playNanomanSlamSound();
      playExplosionSound();
    };

    // Dual HMG bullets (phase 3 spin)
    boss.hmgBulletCallback = (muzzlePos, side) => {
      const playerPos = camera.position.clone();
      // Aim toward the player with a small random spread (boss is spinning but bullets track the player)
      const toPlayer = new THREE.Vector3().subVectors(playerPos, muzzlePos).normalize();
      const dir = new THREE.Vector3(
        toPlayer.x + (Math.random() - 0.5) * 0.18,
        toPlayer.y + (Math.random() - 0.5) * 0.06,
        toPlayer.z + (Math.random() - 0.5) * 0.18
      ).normalize();

      const geo = new THREE.BoxGeometry(0.07, 0.07, 0.32);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(muzzlePos);
      // Orient along dir
      const angle = Math.atan2(dir.x, dir.z);
      mesh.rotation.y = angle;
      scene.add(mesh);

      nanomanBullets.push({ mesh, dir, speed: 38, traveled: 0, maxRange: 35, damage: 18 });
      playNanomanHmgSound();
    };

    // Arena phase change callback
    boss.arenaPhaseCallback = (phase) => {
      if (phase === 2) {
        // Crysis power-up: electric blue-green
        scene.fog.color.setHex(0x001a10);
        scene.fog.density = 0.014;
        scene.background.setHex(0x000d08);
        if (state.arenaLights) {
          state.arenaLights.ambient.color.setHex(0x00ff88);
          state.arenaLights.ambient.intensity = 0.7;
          state.arenaLights.point1.color.setHex(0x00dd66);
          state.arenaLights.point1.intensity = 2.5;
          state.arenaLights.point2.color.setHex(0x00ffaa);
          state.arenaLights.point2.intensity = 1.8;
        }
        waveAnnounce.textContent = '⚡ NANOMAN MAXIMUM POWER ⚡';
        waveAnnounce.style.color = '#0f6';
        waveAnnounce.style.display = 'block';
        setTimeout(() => { waveAnnounce.style.display = 'none'; }, 2500);
        playBossPhaseChangeSound();
      } else if (phase === 3) {
        // Maximum armor: cold blue-white military
        scene.fog.color.setHex(0x001520);
        scene.fog.density = 0.022;
        scene.background.setHex(0x000810);
        if (state.arenaLights) {
          state.arenaLights.ambient.color.setHex(0x00aaff);
          state.arenaLights.ambient.intensity = 1.0;
          state.arenaLights.point1.color.setHex(0x0088ff);
          state.arenaLights.point1.intensity = 3.5;
          state.arenaLights.point2.color.setHex(0x00ffcc);
          state.arenaLights.point2.intensity = 2.8;
        }
        waveAnnounce.textContent = '🛡 NANOMAN MAXIMUM ARMOR 🛡';
        waveAnnounce.style.color = '#0af';
        waveAnnounce.style.display = 'block';
        setTimeout(() => { waveAnnounce.style.display = 'none'; }, 3000);
        playBossPhaseChangeSound();
      }
    };
  }
  if (boss.type === 'human_reaper') {
    boss.hmgBulletCallback = (muzzlePos, side) => {
      const playerPos = camera.position.clone();
      const dir = new THREE.Vector3().subVectors(playerPos, muzzlePos).normalize();
      // Add spread
      dir.x += (Math.random() - 0.5) * 0.12;
      dir.y += (Math.random() - 0.5) * 0.12;
      dir.z += (Math.random() - 0.5) * 0.12;
      
      const geo = new THREE.SphereGeometry(0.18, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ccff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(muzzlePos);
      scene.add(mesh);
      
      nanomanBullets.push({ 
        mesh, 
        dir: dir.normalize(), 
        speed: 130, 
        traveled: 0, 
        maxRange: 50, 
        damage: 45 
      });
      playShootSound('rifle');
    };
  }
}

function setupPinkyCallbacks(enemy) {
  if (enemy.type === 'pinky_rider') {
    enemy.projectileCallback = (muzzlePos, targetPos) => {
      const dir = new THREE.Vector3().subVectors(targetPos, muzzlePos).normalize();
      
      const geo = new THREE.SphereGeometry(0.15, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff33cc });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(muzzlePos);
      scene.add(mesh);

      pinkyProjectiles.push({
        mesh,
        dir,
        speed: 22,
        traveled: 0,
        maxRange: 30,
        damage: enemy.damage,
      });
      // reusing a sound
      if (window.playSniperShotSound) window.playSniperShotSound();
    };
  }
}

function updateBossHUD() {
  const bossBar = document.getElementById('boss-hp-bar');
  const bossContainer = document.getElementById('boss-hp-container');
  const bossNameEl = document.getElementById('boss-name');
  const bossPhaseEl = document.getElementById('boss-phase');

  if (!bossContainer) return;

  if (state.currentBoss && state.currentBoss.alive) {
    bossContainer.style.display = 'block';
    const boss = state.currentBoss;
    const ratio = Math.max(0, boss.health / boss.maxHealth);
    bossBar.style.width = `${ratio * 100}%`;
    bossNameEl.textContent = boss.type.toUpperCase();
    bossPhaseEl.textContent = `PHASE ${boss.phase}`;

    // Color based on boss type
    if (boss.type === 'carmackion') bossBar.style.background = '#0ff';
    else if (boss.type === 'darioltman') bossBar.style.background = '#f04';
    else if (boss.type === 'nanoman') bossBar.style.background = '#4f0';
  } else {
    bossContainer.style.display = 'none';
  }
}

function debugSpawnBoss(bossType) {
  if (!state.running) return;
  const boss = spawnBoss(bossType, state.arenaSize, state.wave);
  scene.add(boss.mesh);
  state.enemies.push(boss);
  state.currentBoss = boss;
  setupBossCallbacks(boss);
  updateBossHUD();
  playBossAppearSound();

  waveAnnounce.textContent = `⚠ BOSS: ${bossType.toUpperCase()} ⚠`;
  waveAnnounce.style.color = '#ff0';
  waveAnnounce.style.display = 'block';
  setTimeout(() => { waveAnnounce.style.display = 'none'; }, 2000);
}

// Debug: Unlock all right-click abilities
window.debugUnlockAllAbilities = () => {
  meta.upgrades['random_ability'] = 1;
  meta.upgrades['chosen_ability'] = 1;
  // Set all abilities as available
  meta.upgrades['dash_cooldown'] = 3;
  meta.upgrades['dash_distance'] = 3;
  meta.upgrades['shield_cooldown'] = 3;
  meta.upgrades['shield_durability'] = 3;
  meta.upgrades['invincible_cooldown'] = 3;
  meta.upgrades['invincible_duration'] = 3;
  meta.upgrades['grapple_cooldown'] = 3;
  meta.upgrades['grapple_distance'] = 3;
  saveMeta(meta);
  console.log('✓ All abilities unlocked!');
};

// Debug: Unlock all fragments
window.debugUnlockAllFragments = () => {
  for (const frag of FRAGMENT_DEFS) {
    if (!meta.unlockedFragments.includes(frag.id)) {
      meta.unlockedFragments.push(frag.id);
    }
  }
  meta.maxWaveReached = 99;
  saveMeta(meta);
  console.log('✓ All fragments unlocked!');
};

// Debug: Unlock all skills/upgrades
window.debugUnlockAllSkills = () => {
  // Universal upgrades
  for (const upg of UNIVERSAL_UPGRADES) {
    meta.upgrades[upg.id] = upg.maxLevel;
  }
  // Class-specific upgrades (all classes)
  for (const classKey in CLASS_UPGRADES) {
    for (const upg of CLASS_UPGRADES[classKey]) {
      meta.upgrades[upg.id] = upg.maxLevel;
    }
  }
  // Ability upgrades (all abilities)
  for (const abilityKey in ABILITY_UPGRADES) {
    for (const upg of ABILITY_UPGRADES[abilityKey]) {
      meta.upgrades[upg.id] = upg.maxLevel;
    }
  }
  saveMeta(meta);
  console.log('✓ All skills unlocked!');
};

// Debug: Add 990999 gears
window.debugAddGears = () => {
  state.gears += 990999;
  meta.permanentGears += 990999;
  saveMeta(meta);
  updateHUD();
  console.log(`✓ Added 990999 gears! Total: ${state.gears} run gears, ${meta.permanentGears} permanent gears`);
};

// Debug: Kill all current enemies to skip wave
window.debugKillAllEnemies = () => {
  if (state.enemies.length === 0) {
    console.log('⚠ No enemies to kill.');
    return;
  }
  let count = 0;
  for (const enemy of state.enemies) {
    if (enemy.alive) {
      enemy.alive = false;
      enemy.health = 0;
      scene.remove(enemy.mesh);
      count++;
    }
  }
  console.log(`✓ Exterminated ${count} machines. Wave skip initiated.`);
};

// Debug: Cycle through right-click abilities
window.debugCycleAbility = function() {
  const abilities = ['dash', 'shield', 'invincible', 'grapple', 'rendezvous'];
  const currentIndex = state.rightClickAbility ? abilities.indexOf(state.rightClickAbility) : -1;
  const nextIndex = (currentIndex + 1) % abilities.length;
  state.rightClickAbility = abilities[nextIndex];
  state.abilityCooldownEnd = 0;
  // Cleanup rendezvous if active
  if (state.rendezvousMesh) {
    scene.remove(state.rendezvousMesh);
    state.rendezvousMesh = null;
  }
  state.rendezvousActive = false;
  console.log(`✓ Ability set to: ${state.rightClickAbility}`);
  updateAbilitySlotHUD(performance.now());
};

// Debug: Reset everything
window.debugResetAll = () => {
  if (!confirm('⚠ Reset all meta-progression? This will clear ALL unlocks and gears!')) return;
  meta = {
    permanentGears: 0,
    upgrades: {},
    chosenAbility: null,
    equippedFragment: null,
    unlockedFragments: [],
    maxWaveReached: 0,
  };
  saveMeta(meta);
  state.gears = 0;
  updateHUD();
  console.log('✓ All data reset!');
};

// Expose debug functions globally
window.debugSpawnBoss = debugSpawnBoss;
window.toggleGodMode = () => {
  state.godMode = !state.godMode;
  const btn = document.getElementById('god-mode-btn');
  if (btn) btn.textContent = state.godMode ? '🛡 GOD MODE: ON' : '🛡 GOD MODE: OFF';
  if (state.godMode) {
    state.health = state.maxHealth;
    updateHUD();
  }
};

// ============================================================
// SHOOTING
// ============================================================
const raycaster = new THREE.Raycaster();

function shoot() {
  const weapon = state.weapon;
  const now = performance.now();
  const overclockFireMult = fragRuntime ? fragRuntime.getFireRateMultiplier() : 1;
  const overclockBulletMult = (fragRuntime && fragRuntime.isOverclockActive()) ? 2 : 1;
  const hasBloodLink = fragRuntime && fragRuntime.id === 'blood_link';

  // canFire checks ammo <= 0; if we have blood_link, we ignore that part or ensure ammo is never 0.
  // Actually, weapon.fire() decrements ammo. If we skip it, ammo never goes down.
  const canFireNormally = weapon.canFire(now, overclockFireMult);
  // If blood_link is active, we can fire as long as fireRate allows, even if ammo is "0" (though it shouldn't be)
  const canFireBlood = hasBloodLink && (now - weapon.lastFireTime) >= (weapon.fireRate / Math.max(0.1, weapon.fireRateMultiplier * overclockFireMult));

  if (!(canFireNormally || canFireBlood) || state.isMeleeing) return;

  if (hasBloodLink) {
    weapon.lastFireTime = now; // manual update since we skip weapon.fire()
  } else {
    weapon.fire(now);
  }

  const shakeMul = clampNumber(runtimeSettings.graphics.cameraShake, 0, 200) / 100;
  playShootSound(weapon.type);

  muzzleFlash.visible = true;
  muzzleFlash.scale.setScalar(0.5 + Math.random() * 1);
  setTimeout(() => { muzzleFlash.visible = false; }, 50);

  if (weaponModel) {
    weaponModel.position.z += weapon.recoil * 2;
    weaponModel.rotation.x -= weapon.recoil;
  }
  pitch += weapon.recoil * 0.5 * shakeMul;
  yaw += (Math.random() - 0.5) * weapon.recoil * 0.3 * shakeMul;

  let shotHadHit = false;
  const dmgMult = fragRuntime ? fragRuntime.getDamageMultiplier() : 1.0;

  for (let b = 0; b < weapon.bulletsPerShot; b++) {
    const spreadX = (Math.random() - 0.5) * weapon.spread;
    const spreadY = (Math.random() - 0.5) * weapon.spread;

    const dir = new THREE.Vector3(spreadX, spreadY, -1);
    dir.applyEuler(camera.rotation);
    dir.normalize();

    raycaster.set(camera.position, dir);
    raycaster.far = weapon.range;

    const enemyMeshes = state.enemies
      .filter(e => e.alive)
      .map(e => e.mesh);

    const intersects = raycaster.intersectObjects(enemyMeshes, true);
    const trailEnd = camera.position.clone().add(dir.clone().multiplyScalar(weapon.range));

    if (intersects.length > 0) {
      const hit = intersects[0];
      let hitEnemy = null;
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        let obj = hit.object;
        while (obj) {
          if (obj === enemy.mesh) { hitEnemy = enemy; break; }
          obj = obj.parent;
        }
        if (hitEnemy) break;
      }

      if (hitEnemy) {
        hitEnemy.takeDamage(weapon.getDamage() * dmgMult, camera.position, hit.point);
        particleSystem.emit(hit.point, 0xff4400, 3);
        shotHadHit = true;
        emitNetworkHitFeedback();
        if (!hitEnemy.alive) handleEnemyKill(hitEnemy);
      } else {
        // Intersected something that wasn't an enemy (e.g. child of boss but boss logic failed? unlikely)
        // or just a miss if it's world collision (not yet implemented for raycast)
        if (hasBloodLink) takeDamage(1.5, null, true);
      }

      bulletTrail.addTrail(
        camera.position.clone().add(dir.clone().multiplyScalar(0.5)),
        hit.point,
        overclockBulletMult,
      );
    } else {
      // CLEAR MISS
      if (hasBloodLink) {
        takeDamage(1.5, null, true);
      }
      bulletTrail.addTrail(
        camera.position.clone().add(dir.clone().multiplyScalar(0.5)),
        trailEnd,
        overclockBulletMult,
      );
    }
  }

  if (fragRuntime) {
    if (shotHadHit) fragRuntime.onHit(); else fragRuntime.onMiss();
  }

  updateHUD();
}

function applyPlayerKnockback(originPos, force = 25) {
  const dir = new THREE.Vector3().subVectors(camera.position, originPos).setY(0).normalize();
  knockbackVel.add(dir.multiplyScalar(force));
}

// ============================================================
// PLAYER MOVEMENT
// ============================================================
const PLAYER_EYE_Y = 1.6;
const GRAVITY = 22;
const JUMP_FORCE = 9;

function updatePlayer(delta) {
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

  const moveDir = new THREE.Vector3();
  if (keys['KeyW']) moveDir.add(forward);
  if (keys['KeyS']) moveDir.sub(forward);
  if (keys['KeyA']) moveDir.sub(right);
  if (keys['KeyD']) moveDir.add(right);

  // Sprint / Overclock (Shift)
  const shiftHeld = keys['ShiftLeft'] || keys['ShiftRight'];
  const canBoost = state.canSprint && shiftHeld && isGrounded && moveDir.length() > 0;
  const overclockAllowed = !!(fragRuntime && fragRuntime.id === 'overclock');
  const isOverclocking = overclockAllowed && canBoost;
  if (fragRuntime) {
    fragRuntime.setOverclockActive(isOverclocking);
  }
  const isSprinting = !overclockAllowed && canBoost;
  const baseMoveSpeed = state.weapon.moveSpeed * (fragRuntime ? fragRuntime.getMoveSpeedMultiplier() : 1);
  const effectiveSpeed = isSprinting ? baseMoveSpeed * 1.6 : baseMoveSpeed;

  // FOV effect for sprint
  const baseFov = clampNumber(runtimeSettings.display.baseFov, 60, 110);
  const targetFOV = isOverclocking ? Math.min(125, baseFov + 18) : (isSprinting ? Math.min(120, baseFov + 13) : baseFov);
  camera.fov += (targetFOV - camera.fov) * 0.12;
  camera.updateProjectionMatrix();

  if (moveDir.length() > 0) {
    moveDir.normalize();
    const moveStep = moveDir.multiplyScalar(effectiveSpeed * delta);

    // Arena bounds & Wall Climbing logic
    const wallHeight = 8;
    const canClimb = state.canJump;
    const limit = state.arenaSize - 1.5;
    const outerLimit = state.arenaSize + 0.8; // Allow walking on the wall top
    const actualLimit = (canClimb && camera.position.y > 4.2) ? outerLimit : limit;
    const playerR = 0.5;

    // --- Pass 1: Try X Movement ---
    const oldX = camera.position.x;
    camera.position.x = Math.max(-actualLimit, Math.min(actualLimit, camera.position.x + moveStep.x));
    for (const obs of state.obstacles) {
      if (camera.position.y - 1.5 > (obs.height || 0)) continue;
      if (camera.position.x + playerR > obs.min.x && camera.position.x - playerR < obs.max.x &&
          camera.position.z + playerR > obs.min.y && camera.position.z - playerR < obs.max.y) {
        // Push out to the nearest edge we came from
        if (oldX <= obs.min.x - playerR) camera.position.x = obs.min.x - playerR;
        else if (oldX >= obs.max.x + playerR) camera.position.x = obs.max.x + playerR;
        else {
          // Already overlapping from before this frame (rare, but handle it)
          const dist1 = Math.abs(camera.position.x - (obs.min.x - playerR));
          const dist2 = Math.abs(camera.position.x - (obs.max.x + playerR));
          camera.position.x = (dist1 < dist2) ? obs.min.x - playerR : obs.max.x + playerR;
        }
      }
    }

    // --- Pass 2: Try Z Movement ---
    const oldZ = camera.position.z;
    camera.position.z = Math.max(-actualLimit, Math.min(actualLimit, camera.position.z + moveStep.z));
    for (const obs of state.obstacles) {
      if (camera.position.y - 1.5 > (obs.height || 0)) continue;
      if (camera.position.x + playerR > obs.min.x && camera.position.x - playerR < obs.max.x &&
          camera.position.z + playerR > obs.min.y && camera.position.z - playerR < obs.max.y) {
        // Push out to the nearest edge we came from
        if (oldZ <= obs.min.y - playerR) camera.position.z = obs.min.y - playerR;
        else if (oldZ >= obs.max.y + playerR) camera.position.z = obs.max.y + playerR;
        else {
          const dist1 = Math.abs(camera.position.z - (obs.min.y - playerR));
          const dist2 = Math.abs(camera.position.z - (obs.max.y + playerR));
          camera.position.z = (dist1 < dist2) ? obs.min.y - playerR : obs.max.y + playerR;
        }
      }
    }

    // Mantle / Climbing Boost: Help player pull themselves up when jumping near a wall
    if (canClimb && !isGrounded && jumpVelocity > -4) {
      const distToEdgeX = Math.abs(camera.position.x) - limit;
      const distToEdgeZ = Math.abs(camera.position.z) - limit;
      if (distToEdgeX > -0.4 || distToEdgeZ > -0.4) {
        // Apply upward force if they are near the top edge
        if (camera.position.y > 3.0 && camera.position.y < wallHeight + 1) {
           jumpVelocity += delta * 18; // Upward assist
        }
      }
    }
  }

  // Apply and decay knockback
  if (knockbackVel.length() > 0.1) {
    const oldX = camera.position.x;
    const oldZ = camera.position.z;
    const limit = state.arenaSize - 1.5;
    const playerR = 0.5;

    // Apply X and Z knockback
    camera.position.x = Math.max(-limit, Math.min(limit, camera.position.x + knockbackVel.x * delta));
    camera.position.z = Math.max(-limit, Math.min(limit, camera.position.z + knockbackVel.z * delta));
    
    // Check obstacles for knockback too
    for (const obs of state.obstacles) {
      if (camera.position.y - 1.5 > (obs.height || 0)) continue;
      if (camera.position.x + playerR > obs.min.x && camera.position.x - playerR < obs.max.x &&
          camera.position.z + playerR > obs.min.y && camera.position.z - playerR < obs.max.y) {
        // Quick depenetration for knockback
        const dx1 = Math.abs(camera.position.x - (obs.min.x - playerR));
        const dx2 = Math.abs(camera.position.x - (obs.max.x + playerR));
        const dz1 = Math.abs(camera.position.z - (obs.min.y - playerR));
        const dz2 = Math.abs(camera.position.z - (obs.max.y + playerR));
        const minVal = Math.min(dx1, dx2, dz1, dz2);
        if (minVal === dx1) camera.position.x = obs.min.x - playerR;
        else if (minVal === dx2) camera.position.x = obs.max.x + playerR;
        else if (minVal === dz1) camera.position.z = obs.min.y - playerR;
        else camera.position.z = obs.max.y + playerR;
        // Optionally kill velocity on hit axis (bouncing would be cooler but stop is safer)
        knockbackVel.multiplyScalar(0.5); 
      }
    }

    knockbackVel.multiplyScalar(Math.exp(-delta * 8)); // Decay knockback
  } else {
    knockbackVel.set(0, 0, 0);
  }

  // ... (Jump logic unchanged) ...
  // (Calculate horizontal speed logic unchanged) ...

  // Jump — only when jump is unlocked
  if (jumpPressed) {
    jumpPressed = false;
    // Calculate horizontal speed for jump momentum (energy-based)
    let hSpeed = 0;
    if (moveDir.length() > 0) hSpeed = effectiveSpeed;

    const baseJumpEnergy = JUMP_FORCE * JUMP_FORCE;
    const horizontalEnergy = hSpeed * hSpeed;
    const momentumBoost = Math.sqrt(baseJumpEnergy + horizontalEnergy * 0.5) - JUMP_FORCE;
    if (state.canJump && isGrounded) {
      jumpVelocity = JUMP_FORCE + momentumBoost;
      isGrounded = false;
      hasDoubleJumped = false;
      playJumpSound();
    } else if (state.canJump && state.canDoubleJump && !isGrounded && !hasDoubleJumped) {
      jumpVelocity = JUMP_FORCE * 0.85 + momentumBoost * 0.6;
      hasDoubleJumped = true;
      playJumpSound();
    }
  }

  if (!isGrounded) {
    jumpVelocity -= GRAVITY * delta;
    camera.position.y += jumpVelocity * delta;

    // Check walking on objects (crates / pillars)
    let landedOnObj = false;
    for (const obj of arenaWalkables) {
      const objTopEyeY = obj.topY + PLAYER_EYE_Y; // eye height when standing on top
      const px = camera.position.x;
      const pz = camera.position.z;
      const halfW = obj.w / 2 + 0.3;
      const halfD = obj.d / 2 + 0.3;
      if (px > obj.x - halfW && px < obj.x + halfW &&
          pz > obj.z - halfD && pz < obj.z + halfD) {
        if (camera.position.y <= objTopEyeY && camera.position.y > objTopEyeY - 0.8 && jumpVelocity <= 0) {
          camera.position.y = objTopEyeY;
          isGrounded = true;
          jumpVelocity = 0;
          landedOnObj = true;
          hasDoubleJumped = false;
          break;
        }
      }
    }
    // Check wall top landing
    let landedOnWall = false;
    if (state.canJump) {
      const wallHeight = 8;
      const wallTopEyeY = wallHeight + PLAYER_EYE_Y;
      const limitInner = state.arenaSize - 1.6;
      const limitOuter = state.arenaSize + 1.2;
      const px = Math.abs(camera.position.x);
      const pz = Math.abs(camera.position.z);
      
      // If we are over a wall and falling
      if (((px > limitInner && px < limitOuter) || (pz > limitInner && pz < limitOuter)) && jumpVelocity <= 0) {
        if (camera.position.y <= wallTopEyeY + 0.4 && camera.position.y > wallHeight) {
          camera.position.y = wallTopEyeY;
          isGrounded = true;
          jumpVelocity = 0;
          landedOnWall = true;
          hasDoubleJumped = false;
        }
      }
    }

    if (!landedOnObj && !landedOnWall && camera.position.y <= PLAYER_EYE_Y) {
      camera.position.y = PLAYER_EYE_Y;
      isGrounded = true;
      jumpVelocity = 0;
      hasDoubleJumped = false;
    }
  }

  // Maintenance: Check if we should fall off our current surface
  if (isGrounded && camera.position.y > PLAYER_EYE_Y + 0.1) {
    let stillOnSomething = false;
    
    // Check objects (crates / pillars)
    for (const obj of arenaWalkables) {
      const objTopEyeY = obj.topY + PLAYER_EYE_Y;
      const px = camera.position.x;
      const pz = camera.position.z;
      const halfW = obj.w / 2 + 0.35;
      const halfD = obj.d / 2 + 0.35;
      if (Math.abs(camera.position.y - objTopEyeY) < 0.1 &&
          px > obj.x - halfW && px < obj.x + halfW &&
          pz > obj.z - halfD && pz < obj.z + halfD) {
        stillOnSomething = true;
        break;
      }
    }
    
    // Check walls
    if (!stillOnSomething) {
      const wallTopEyeY = 8 + PLAYER_EYE_Y;
      if (Math.abs(camera.position.y - wallTopEyeY) < 0.2) {
        const limitInner = state.arenaSize - 1.7;
        const limitOuter = state.arenaSize + 1.2;
        const apx = Math.abs(camera.position.x);
        const apz = Math.abs(camera.position.z);
        if ((apx > limitInner && apx < limitOuter) || (apz > limitInner && apz < limitOuter)) {
          stillOnSomething = true;
        }
      }
    }
    
    if (!stillOnSomething) {
      isGrounded = false;
    }
  }

  // Track time on top of a walkable (meteor punishment if it's a crate)
  // We only punish for being on crates, but we'll check pillars too for safety
  if (isGrounded) {
    let onCrateNow = false;
    for (const obj of arenaWalkables) {
      const objTopEyeY = obj.topY + PLAYER_EYE_Y;
      const px = camera.position.x;
      const pz = camera.position.z;
      const halfW = obj.w / 2 + 0.35;
      const halfD = obj.d / 2 + 0.35;
      if (Math.abs(camera.position.y - objTopEyeY) < 0.1 &&
          px > obj.x - halfW && px < obj.x + halfW &&
          pz > obj.z - halfD && pz < obj.z + halfD) {
        onCrateNow = true;
        break;
      }
    }
    if (onCrateNow) {
      crateTimeOnTop += delta;
      if (!playerOnCrate) playerOnCrate = true;
      if (crateTimeOnTop > 5) {
        crateTimeOnTop = 0;
        spawnCrateMeteor();
      }
    } else {
      crateTimeOnTop = 0;
      playerOnCrate = false;
    }
  } else {
    crateTimeOnTop = 0;
    playerOnCrate = false;
  }

  // Check jump pads (only active from wave 5)
  if (state.wave >= 5 && isGrounded && camera.position.y < PLAYER_EYE_Y + 0.15) {
    for (const pad of arenaJumpPads) {
      const dx = camera.position.x - pad.x;
      const dz = camera.position.z - pad.z;
      if (dx * dx + dz * dz < pad.radius * pad.radius) {
        // hSpeed here should be effectiveSpeed but we used JUMP_FORCE earlier
        let hSpeed = 0;
        if (moveDir.length() > 0) hSpeed = effectiveSpeed;
        const baseJumpEnergy = (JUMP_FORCE * 2.4) * (JUMP_FORCE * 2.4);
        const horizontalEnergy = hSpeed * hSpeed;
        const momentumBoost = Math.sqrt(baseJumpEnergy + horizontalEnergy * 0.5) - JUMP_FORCE * 2.4;
        jumpVelocity = JUMP_FORCE * 2.4 + momentumBoost; // Quake-style mega boost
        isGrounded = false;
        hasDoubleJumped = false;
        playJumpPadSound();
        break;
      }
    }
  }

  // Apply camera rotation
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  // Dash velocity — applied independently of WASD with bounds
  if (dashVelX !== 0 || dashVelZ !== 0) {
    const limit = state.arenaSize - 1.5;
    const playerR = 0.5;

    camera.position.x = Math.max(-limit, Math.min(limit, camera.position.x + dashVelX * delta));
    camera.position.z = Math.max(-limit, Math.min(limit, camera.position.z + dashVelZ * delta));
    
    // Dash obstacle collision
    for (const obs of state.obstacles) {
      if (camera.position.y - 1.5 > (obs.height || 0)) continue;
      if (camera.position.x + playerR > obs.min.x && camera.position.x - playerR < obs.max.x &&
          camera.position.z + playerR > obs.min.y && camera.position.z - playerR < obs.max.y) {
        // Push out to nearest edge
        const dx1 = Math.abs(camera.position.x - (obs.min.x - playerR));
        const dx2 = Math.abs(camera.position.x - (obs.max.x + playerR));
        const dz1 = Math.abs(camera.position.z - (obs.min.y - playerR));
        const dz2 = Math.abs(camera.position.z - (obs.max.y + playerR));
        const minVal = Math.min(dx1, dx2, dz1, dz2);
        if (minVal === dx1) camera.position.x = obs.min.x - playerR;
        else if (minVal === dx2) camera.position.x = obs.max.x + playerR;
        else if (minVal === dz1) camera.position.z = obs.min.y - playerR;
        else camera.position.z = obs.max.y + playerR;
        // Dash stops on impact
        dashVelX = 0;
        dashVelZ = 0;
      }
    }

    const decay = Math.exp(-delta * 14);
    dashVelX *= decay;
    dashVelZ *= decay;
    if (Math.abs(dashVelX) < 0.05 && Math.abs(dashVelZ) < 0.05) {
      dashVelX = 0;
      dashVelZ = 0;
    }
  }

  // Weapon bob
  if (weaponModel) {
    const time = performance.now() * 0.001;
    const moving = moveDir.length() > 0;
    const isSpeedBoosting = isSprinting || isOverclocking;
    const bobAmount = moving ? (isSpeedBoosting ? 0.006 : 0.003) : 0.001;
    const bobSpeed = moving ? (isSpeedBoosting ? 12 : 8) : 3;
    weaponModel.position.y = -0.2 + Math.sin(time * bobSpeed) * bobAmount;
    weaponModel.position.x = 0.25 + Math.cos(time * bobSpeed * 0.5) * bobAmount * 0.5;

    // Smooth recoil recovery
    weaponModel.position.z += (-0.4 - weaponModel.position.z) * 0.1;
    weaponModel.rotation.x += (0 - weaponModel.rotation.x) * 0.1;
  }

  // Melee Animation
  if (state.isMeleeing) {
    state.meleeTimer += delta * 1000;
    const duration = 400; // ms for animation
    const t = state.meleeTimer / duration;

    if (t >= 1) {
      state.isMeleeing = false;
      if (meleeModel) meleeModel.visible = false;
      if (kickModel) kickModel.visible = false;
    } else {
      // Handle Punch Animation
      if (state.meleeType === 'punch') {
        if (meleeModel) {
          meleeModel.visible = true;
          if (kickModel) kickModel.visible = false;
          // Punch sequence: 0->0.5 is forward, 0.5->1.0 is retract
          const forward = Math.sin(t * Math.PI); 
          meleeModel.position.set(
            -0.1 + forward * 0.1, 
            -0.25 - Math.sin(t * Math.PI * 0.5) * 0.1, 
            -0.2 - forward * 0.8
          );
          meleeModel.rotation.y = -Math.PI / 8 * forward;
          meleeModel.rotation.x = Math.PI / 10 * forward;
        }
      } 
      // Handle Kick Animation (Left Leg side-push)
      else if (state.meleeType === 'kick') {
        if (kickModel) {
          kickModel.visible = true;
          if (meleeModel) meleeModel.visible = false;
          // Kick sequence: swing from bottom left toward center
          const forward = Math.sin(t * Math.PI);
          // Thrust motion: less forward Z, more satisfaction in the 'push'
          kickModel.position.set(
            -0.3 + forward * 0.3,
            -0.9 + forward * 0.5,
            -0.2 - forward * 0.6
          );
          // Dynamic rotations to keep it connected and facing forward
          kickModel.rotation.x = -Math.PI / 6 * forward;
          kickModel.rotation.z = -Math.PI / 15 * forward;
          kickModel.rotation.y = (Math.PI / 12) + (Math.PI / 8 * forward);
        }
      }
      // Pull weapon model down out of view
      if (weaponModel) {
        const dropRatio = Math.sin(t * Math.PI);
        weaponModel.position.y -= dropRatio * 0.5;
      }
    }
  }
}

// ============================================================
// HUD
// ============================================================
function updateHUD() {
  const weapon = state.weapon;
  healthText.textContent = `HP: ${Math.ceil(state.health)}`;
  if (hpFill) {
    hpFill.style.width = `${(state.health / state.maxHealth) * 100}%`;
  }
  waveText.textContent = `WAVE ${state.wave}`;
  const alive = state.enemies.filter(e => e.alive).length;
  enemyText.textContent = `ENEMIES: ${alive}`;

  if (weapon.isReloading) {
    ammoText.textContent = `RELOADING...`;
    if (ammoFill) ammoFill.style.width = '0%';
  } else if (fragRuntime && fragRuntime.id === 'blood_link') {
    ammoText.textContent = `AMMO: ∞`;
    if (ammoFill) ammoFill.style.width = '100%';
  } else {
    ammoText.textContent = `AMMO: ${weapon.currentAmmo} / ${weapon.getMaxAmmo()}`;
    if (ammoFill) {
      const ammoPct = (weapon.currentAmmo / weapon.getMaxAmmo()) * 100;
      ammoFill.style.width = `${ammoPct}%`;
    }
  }

  // NOTE: Score, Streak, and Gears/Grenades are currently overlaid on this box.
  // They will be moved to separate UI elements in a future update to keep the Ammo bar clean.

  // Kill streak display
  const streakEl = document.getElementById('streak-text');
  if (streakEl) {
    if (state.killStreak > 0) {
      const mulLabel = state.killMultiplier > 1 ? ` [${state.killMultiplier}×]` : '';
      streakEl.textContent = `STREAK: ${state.killStreak}${mulLabel}`;
      streakEl.style.color = state.killMultiplier >= 4 ? '#ff0' : state.killMultiplier >= 2 ? '#f80' : '#0f0';
    } else {
      streakEl.textContent = '';
    }
  }

  if (scoreText) {
    scoreText.textContent = `SCORE: ${state.score}`;
  }
  if (gearText) {
    gearText.textContent = `⚙ GEARS: ${state.gears}`;
  }
  if (grenadeText) {
    grenadeText.textContent = state.grenadeCount > 0 ? `GRENADES: ${state.grenadeCount}` : '';
  }
}

// ============================================================
// DAMAGE
// ============================================================
function takeDamage(amount, attackerPos, nonLethal = false) {
  if (state.godMode) return; // God mode — no damage
  if (performance.now() < state.invincibleUntil) return; // Ability invincibility
  if (state.isMeleeing) return; // Invincible while punching
  if (grappleState) return;     // Invincible while grappling

  // Fragment shell absorption (Kabuk) — intercepts before resist calculation
  let incomingAmount = amount;
  if (fragRuntime) {
    incomingAmount = fragRuntime.onDamageTaken(amount, state);
    if (incomingAmount <= 0) {
      // Fully absorbed — still show flash but no health loss
      const fx = clampNumber(runtimeSettings.graphics.effectsIntensity, 40, 200) / 100;
      damageOverlay.style.opacity = (0.25 * fx).toFixed(3);
      setTimeout(() => { damageOverlay.style.opacity = '0'; }, 150);
      return;
    }
  }

  let resist = state.damageResist || 0;
  if (fragRuntime) {
    resist += fragRuntime.getDamageResistBonus();
  }
  // Grapple resist: extra damage resistance while grappling
  const GRAPPLE_RESIST_BONUS = 0.50;
  const MAX_TOTAL_DAMAGE_RESIST = 0.80;
  if (grappleState && state.metaAbilityMods?.grappleResist) {
    resist = Math.min(resist + GRAPPLE_RESIST_BONUS, MAX_TOTAL_DAMAGE_RESIST);
  }
  const actual = incomingAmount * (1 - resist);

  if (nonLethal) {
    state.health = Math.max(1, state.health - actual);
  } else {
    state.health -= actual;
  }

  // Reset kill streak on taking damage
  state.killStreak = 0;
  state.killMultiplier = 1;

  const fx = clampNumber(runtimeSettings.graphics.effectsIntensity, 40, 200) / 100;
  damageOverlay.style.opacity = (0.6 * fx).toFixed(3);
  setTimeout(() => { damageOverlay.style.opacity = '0'; }, 200);

  // Damage sound
  playDamageSound();

  // Directional indicator — only when attacker is off-screen
  if (attackerPos && !isEnemyOnScreen(attackerPos)) {
    showDmgIndicator(attackerPos);
  }

  if (state.health <= 0) {
    gameOver();
  }
  updateHUD();
}

function gameOver() {
  state.running = false;
  document.body.style.cursor = ''; // Ensure cursor is visible on game over
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
  hud.style.display = 'none';
  crosshair.style.display = 'none';
  cleanupMortarProjectiles();

  let endMsg = "YOU HAVE BEEN SCRAPPED";
  if (state.machineKingEnding) {
    endMsg = "THE KING HAS FALLEN. HUMANITY PREVAILS.";
    const h2 = gameOverScreen.querySelector('h2');
    if (h2) {
      h2.style.color = '#fff';
      h2.style.textShadow = '0 0 20px #00ccff';
      h2.textContent = endMsg;
    }
  } else {
    const h2 = gameOverScreen.querySelector('h2');
    if (h2) {
      h2.style.color = '';
      h2.style.textShadow = '';
      h2.textContent = endMsg;
    }
  }

  // Transfer 10% of run gears to permanent stash
  const meta = loadMeta();
  const transferred = transferRunGears(meta, state.gears);
  saveMeta(meta);

  gameOverStats.innerHTML = `
    WAVE REACHED: ${state.wave}<br>
    SCORE: ${state.score}<br>
    GEARS COLLECTED: ${state.gears}<br>
    GEARS SALVAGED: +${transferred} ⚙<br>
    PERMANENT STASH: ${meta.permanentGears} ⚙<br>
    CLASS: ${state.playerClass.toUpperCase()}
  `;
  gameOverScreen.style.display = 'flex';
}

// ============================================================
// GRENADE SYSTEM
// ============================================================
function throwGrenade() {
  if (state.grenadeCount <= 0) return;
  state.grenadeCount--;

  const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  const startPos = camera.position.clone().add(forward.clone().multiplyScalar(0.8));

  const geo = new THREE.SphereGeometry(0.14, 6, 6);
  const mat = new THREE.MeshLambertMaterial({ color: 0x00ff44 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(startPos);
  scene.add(mesh);

  const velocity = forward.clone().multiplyScalar(20).add(new THREE.Vector3(0, 9, 0));
  activeGrenades.push({ mesh, velocity, timeThrown: performance.now(), exploded: false });
  updateHUD();
}

function explodeGrenade(g) {
  g.exploded = true;
  scene.remove(g.mesh);
  g.mesh.geometry.dispose();
  g.mesh.material.dispose();

  const BLAST_RADIUS = 6;
  const BLAST_DAMAGE = 80;

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const dist = g.mesh.position.distanceTo(enemy.mesh.position);
    if (dist <= BLAST_RADIUS) {
      const falloff = 1 - dist / BLAST_RADIUS;
      enemy.takeDamage(BLAST_DAMAGE * falloff, g.mesh.position, enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)));
      if (!enemy.alive) {
        handleEnemyKill(enemy);
      }
    }
  }

  particleSystem.emit(g.mesh.position.clone(), 0xff8800, 20);
  particleSystem.emit(g.mesh.position.clone(), 0xffff00, 15);
  playExplosionSound();
}

function updateGrenades(delta) {
  const now = performance.now();
  for (const g of activeGrenades) {
    if (g.exploded) continue;
    g.velocity.y -= 18 * delta;
    g.mesh.position.addScaledVector(g.velocity, delta);
    g.mesh.rotation.x += delta * 9;

    if (g.mesh.position.y < 0.14) {
      g.mesh.position.y = 0.14;
      g.velocity.y = Math.abs(g.velocity.y) * 0.35;
      g.velocity.x *= 0.65;
      g.velocity.z *= 0.65;
    }

    if (now - g.timeThrown >= 2500) {
      explodeGrenade(g);
    }
  }

  for (let i = activeGrenades.length - 1; i >= 0; i--) {
    if (activeGrenades[i].exploded) activeGrenades.splice(i, 1);
  }
}

// ============================================================
// CARMACKION PROJECTILE UPDATES
// ============================================================
function updateCarmackionProjectiles(delta) {
  // LMG bullets
  for (let i = carmackionBullets.length - 1; i >= 0; i--) {
    const b = carmackionBullets[i];
    const step = b.speed * delta;
    b.mesh.position.addScaledVector(b.dir, step);
    b.traveled += step;

    // Check player hit
    if (b.mesh.position.distanceTo(camera.position) < 0.8) {
      takeDamage(b.damage, b.mesh.position);
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      carmackionBullets.splice(i, 1);
      continue;
    }

    // Barrier absorption
    if (barrierAbsorbs(b.mesh.position)) {
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      carmackionBullets.splice(i, 1);
      continue;
    }

    // Expire
    if (b.traveled >= b.maxRange) {
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      carmackionBullets.splice(i, 1);
    }
  }

  // Rockets
  for (let i = carmackionRockets.length - 1; i >= 0; i--) {
    const r = carmackionRockets[i];
    const step = r.speed * delta;
    r.mesh.position.addScaledVector(r.dir, step);
    r.traveled += step;

    // Emit smoke trail
    if (particleSystem && Math.random() < 0.4) {
      particleSystem.emit(r.mesh.position.clone(), 0xff6600, 1);
    }

    // Check player hit or max range
    const distToPlayer = r.mesh.position.distanceTo(camera.position);

    // Barrier intercepts rocket
    if (barrierAbsorbs(r.mesh.position)) {
      if (particleSystem) {
        particleSystem.emit(r.mesh.position.clone(), 0x00aaff, 6);
      }
      scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
      carmackionRockets.splice(i, 1);
      continue;
    }

    if (distToPlayer < 1.5 || r.traveled >= r.maxRange) {
      if (particleSystem) {
        particleSystem.emit(r.mesh.position.clone(), 0xff6600, 10);
        particleSystem.emit(r.mesh.position.clone(), 0xffff00, 6);
      }
      playExplosionSound();

      // Blast damage with falloff
      if (distToPlayer <= r.blastRadius) {
        const falloff = 1 - distToPlayer / r.blastRadius;
        takeDamage(r.damage * falloff, r.mesh.position);
      }

      scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
      carmackionRockets.splice(i, 1);
    }
  }
}

function updateLavaVents(delta) {
  const now = performance.now();
  for (let i = carmackionLavaVents.length - 1; i >= 0; i--) {
    const vent = carmackionLavaVents[i];

    // Pulsing opacity
    const t = (now - vent.spawnTime) * 0.003;
    vent.mesh.material.opacity = 0.6 + Math.sin(t) * 0.2;
    vent.innerMesh.material.opacity = 0.4 + Math.sin(t * 1.7) * 0.15;

    // Damage player if standing on lava
    const dx = camera.position.x - vent.position.x;
    const dz = camera.position.z - vent.position.z;
    const distXZ = Math.sqrt(dx * dx + dz * dz);
    if (distXZ < vent.radius) {
      takeDamage(vent.damage * delta, vent.position);
    }

    // Expire after lifetime
    if (now - vent.spawnTime > vent.lifetime) {
      scene.remove(vent.mesh);
      scene.remove(vent.innerMesh);
      vent.mesh.geometry.dispose();
      vent.mesh.material.dispose();
      vent.innerMesh.geometry.dispose();
      vent.innerMesh.material.dispose();
      carmackionLavaVents.splice(i, 1);
    }
  }
}

function cleanupCarmackionProjectiles() {
  for (const b of carmackionBullets) { scene.remove(b.mesh); }
  carmackionBullets.length = 0;
  for (const r of carmackionRockets) { scene.remove(r.mesh); }
  carmackionRockets.length = 0;
  for (const v of carmackionLavaVents) {
    scene.remove(v.mesh);
    scene.remove(v.innerMesh);
  }
  carmackionLavaVents.length = 0;
}

// Reset arena lighting to normal
function resetArenaLighting() {
  if (scene.fog) {
    scene.fog.color.setHex(0x0d111a);
    scene.fog.density = 0.008;
  }
  scene.background = new THREE.Color(0x0d111a);
  if (state.arenaLights) {
    state.arenaLights.ambient.color.setHex(0x667799);
    state.arenaLights.ambient.intensity = 1.2;
    state.arenaLights.point1.intensity = 4.0;
    state.arenaLights.point2.color.setHex(0x00ffcc);
    state.arenaLights.point2.intensity = 4.0;
    if (state.arenaLights.centralCore) {
      state.arenaLights.centralCore.color.setHex(0x00ff88);
      state.arenaLights.centralCore.intensity = 5.0;
    }
  }
}

// ============================================================
// DARIOLTMAN PROJECTILE UPDATES
// ============================================================
function updateDarioltmanProjectiles(delta) {
  const now = performance.now();

  // ---- Shotgun pellets ----
  for (let i = darioltmanPellets.length - 1; i >= 0; i--) {
    const p = darioltmanPellets[i];
    const step = p.speed * delta;
    p.mesh.position.addScaledVector(p.dir, step);
    p.traveled += step;

    const distToPlayer = p.mesh.position.distanceTo(camera.position);

    // Barrier absorption
    if (barrierAbsorbs(p.mesh.position)) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      darioltmanPellets.splice(i, 1);
      continue;
    }

    if (distToPlayer < 0.75) {
      // Falloff: full damage up close, ~0 at max range (shotgun pattern)
      const falloff = Math.pow(Math.max(0, 1 - p.traveled / p.maxRange), 1.5);
      if (falloff > 0.05) {
        takeDamage(p.damage * falloff, p.mesh.position);
      }
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      darioltmanPellets.splice(i, 1);
      continue;
    }
    if (p.traveled >= p.maxRange) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      darioltmanPellets.splice(i, 1);
    }
  }

  // ---- Zone explosions ----
  for (let i = darioltmanZones.length - 1; i >= 0; i--) {
    const zone = darioltmanZones[i];
    if (zone.removed) { darioltmanZones.splice(i, 1); continue; }

    const elapsed = now - zone.spawnTime;
    const warningT = elapsed / (zone.explodeTime - zone.spawnTime);

    // Pulsing red warning
    if (!zone.exploded) {
      zone.mesh.material.opacity = 0.15 + Math.abs(Math.sin(warningT * Math.PI * 7)) * 0.3;
    }

    // Detonate
    if (!zone.exploded && now >= zone.explodeTime) {
      zone.exploded = true;
      zone.removeAt = now + 180;
      zone.mesh.material.color.setHex(0xffff00);
      zone.mesh.material.opacity = 0.85;

      // Player damage if inside zone
      const px = camera.position.x;
      const pz = camera.position.z;
      if (Math.abs(px - zone.position.x) < zone.width / 2 &&
          Math.abs(pz - zone.position.z) < zone.height / 2) {
        takeDamage(70, zone.position);
      }

      // Enemy collateral damage
      for (const enemy of state.enemies) {
        if (!enemy.alive || enemy.isBoss) continue;
        if (Math.abs(enemy.mesh.position.x - zone.position.x) < zone.width / 2 &&
            Math.abs(enemy.mesh.position.z - zone.position.z) < zone.height / 2) {
          enemy.takeDamage(35);
          if (!enemy.alive) handleEnemyKill(enemy);
        }
      }

      // Explosion particles
      if (particleSystem) {
        particleSystem.emit(new THREE.Vector3(zone.position.x, 0.5, zone.position.z), 0xff4400, 12);
        particleSystem.emit(new THREE.Vector3(zone.position.x, 0.5, zone.position.z), 0xffff00, 8);
      }
      playExplosionSound();
    }

    // Remove after flash
    if (zone.exploded && now >= zone.removeAt) {
      scene.remove(zone.mesh);
      zone.mesh.geometry.dispose();
      zone.mesh.material.dispose();
      zone.removed = true;
      darioltmanZones.splice(i, 1);
    }
  }

  // ---- Meteors ----
  for (let i = darioltmanMeteors.length - 1; i >= 0; i--) {
    const m = darioltmanMeteors[i];
    if (m.impacted) { darioltmanMeteors.splice(i, 1); continue; }

    const elapsed = now - m.spawnTime;
    const t = Math.min(elapsed / m.fallDuration, 1);

    // Fall from sky to ground
    m.mesh.position.y = 32 * (1 - t);
    m.mesh.rotation.x += delta * 3;
    m.mesh.rotation.z += delta * 2.5;

    // Pulse warning ring
    if (m.ring) {
      m.ring.material.opacity = 0.3 + Math.abs(Math.sin(elapsed * 0.008)) * 0.45;
      m.ring.material.color.setHex(t > 0.7 ? 0xff0000 : 0xff4400);
    }

    if (t >= 1) {
      m.impacted = true;

      // Remove meteor mesh and ring
      scene.remove(m.mesh);
      m.mesh.geometry.dispose();
      m.mesh.material.dispose();
      if (m.ring) {
        scene.remove(m.ring);
        m.ring.geometry.dispose();
        m.ring.material.dispose();
      }

      // Blast damage
      const distToPlayer = camera.position.distanceTo(m.targetPos);
      if (distToPlayer < m.blastRadius) {
        const falloff = 1 - distToPlayer / m.blastRadius;
        takeDamage(m.damage * falloff, m.targetPos);
      }

      // Enemy collateral
      for (const enemy of state.enemies) {
        if (!enemy.alive || enemy.isBoss) continue;
        const ed = enemy.mesh.position.distanceTo(m.targetPos);
        if (ed < m.blastRadius) {
          enemy.takeDamage(m.damage * 0.5 * (1 - ed / m.blastRadius));
          if (!enemy.alive) handleEnemyKill(enemy);
        }
      }

      if (particleSystem) {
        particleSystem.emit(m.targetPos.clone(), 0xff6600, 16);
        particleSystem.emit(m.targetPos.clone(), 0xffff00, 10);
        particleSystem.emit(m.targetPos.clone(), 0xff4400, 12);
      }
      playExplosionSound();

      darioltmanMeteors.splice(i, 1);
    }
  }
}

function cleanupDarioltman() {
  for (const p of darioltmanPellets) {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  }
  darioltmanPellets.length = 0;

  for (const z of darioltmanZones) {
    if (!z.removed) {
      scene.remove(z.mesh);
      z.mesh.geometry.dispose();
      z.mesh.material.dispose();
    }
  }
  darioltmanZones.length = 0;

  for (const m of darioltmanMeteors) {
    scene.remove(m.mesh);
    m.mesh.geometry.dispose();
    m.mesh.material.dispose();
    if (m.ring) {
      scene.remove(m.ring);
      m.ring.geometry.dispose();
      m.ring.material.dispose();
    }
  }
  darioltmanMeteors.length = 0;
}

// ============================================================
// NANOMAN PROJECTILE UPDATES
// ============================================================
function updateNanomanProjectiles(delta) {
  // ---- HMG bullets ----
  for (let i = nanomanBullets.length - 1; i >= 0; i--) {
    const b = nanomanBullets[i];
    const step = b.speed * delta;
    b.mesh.position.addScaledVector(b.dir, step);
    b.traveled += step;

    const distToPlayer = b.mesh.position.distanceTo(camera.position);

    // Barrier absorption
    if (barrierAbsorbs(b.mesh.position)) {
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      nanomanBullets.splice(i, 1);
      continue;
    }

    if (distToPlayer < 0.65) {
      takeDamage(b.damage, b.mesh.position);
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      nanomanBullets.splice(i, 1);
      continue;
    }
    if (b.traveled >= b.maxRange) {
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      nanomanBullets.splice(i, 1);
    }
  }
}

function updatePinkyProjectiles(delta) {
  for (let i = pinkyProjectiles.length - 1; i >= 0; i--) {
    const p = pinkyProjectiles[i];
    const move = p.dir.clone().multiplyScalar(p.speed * delta);
    p.mesh.position.add(move);
    p.traveled += p.speed * delta;

    // Barrier absorption
    if (barrierAbsorbs(p.mesh.position)) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      pinkyProjectiles.splice(i, 1);
      continue;
    }

    const distToPlayer = p.mesh.position.distanceTo(camera.position);
    if (distToPlayer < 1.0) {
      takeDamage(p.damage, p.mesh.position);
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      pinkyProjectiles.splice(i, 1);
      continue;
    }

    if (p.traveled > p.maxRange) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      pinkyProjectiles.splice(i, 1);
    }
  }
}

function cleanupNanoman() {
  for (const b of nanomanBullets) {
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
  }
  nanomanBullets.length = 0;
}

let lastTime = performance.now();


function animate() {
  requestAnimationFrame(animate);

  // Workshop has its own render loop — skip game rendering while it's active
  if (isWorkshopActive()) return;

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.05); // Cap delta
  lastTime = now;

  if (!state.running || state.paused || state.shopOpen) {
    if (overclockGlitchOverlay) overclockGlitchOverlay.style.opacity = '0';
    if (overclockDangerOverlay) overclockDangerOverlay.style.opacity = '0';
    updateNetStatsOverlay(now);
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCamera);
    return;
  }

  // HP regeneration
  if (state.regenRate > 0 && state.health > 0 && state.health < state.maxHealth) {
    state.health = Math.min(state.health + state.regenRate * delta, state.maxHealth);
  }

  // Animate jump pads (pulse) when active (wave 5+)
  if (state.wave >= 5) {
    const padPulse = 0.5 + Math.abs(Math.sin(now * 0.003)) * 0.5;
    for (const jp of arenaJumpPads) {
      if (!jp.mesh.visible) continue;
      jp.mesh.traverse(child => {
        if (child.isMesh && child.material.color) {
          const c = child.material.color;
          // Arrow meshes are blue; pulse brightness
          if (c.r < 0.1) { // blue-ish
            child.material.color.setRGB(0, padPulse * 0.67, 1);
          }
        }
      });
    }
  }

  // Update weapon reload
  state.weapon.updateReload(now);

  // Handle shooting
  if (isFiring && document.pointerLockElement === renderer.domElement) {
    shoot();
  }

  // Detect if reload just started robustly using the new flag
  if (state.weapon.justStartedReload) {
    state.weapon.justStartedReload = false;
    playReloadSound(state.weapon.type);
  }

  // Update player
  updatePlayer(delta);

  // Separate enemies from each other and from the player
  for (let i = 0; i < state.enemies.length; i++) {
    const e1 = state.enemies[i];
    if (!e1.alive) continue;
    for (let j = i + 1; j < state.enemies.length; j++) {
      const e2 = state.enemies[j];
      if (!e2.alive) continue;
      const r1 = e1.isBoss ? 2.5 : 0.8;
      const r2 = e2.isBoss ? 2.5 : 0.8;
      const minD = r1 + r2;
      const dx = e1.mesh.position.x - e2.mesh.position.x;
      const dz = e1.mesh.position.z - e2.mesh.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 0.0001 && distSq < minD * minD) {
        const dist = Math.sqrt(distSq);
        const force = (minD - dist) * 0.5 * 10 * delta;
        const pushX = (dx / dist) * force;
        const pushZ = (dz / dist) * force;
        e1.mesh.position.x += pushX;
        e1.mesh.position.z += pushZ;
        e2.mesh.position.x -= pushX;
        e2.mesh.position.z -= pushZ;
      }
    }
    const pdx = e1.mesh.position.x - camera.position.x;
    const pdz = e1.mesh.position.z - camera.position.z;
    const pDistSq = pdx * pdx + pdz * pdz;
    const pMinD = e1.isBoss ? 3.0 : 1.2;
    if (pDistSq > 0.0001 && pDistSq < pMinD * pMinD) {
      const pDist = Math.sqrt(pDistSq);
      const force = (pMinD - pDist) * 10 * delta;
      e1.mesh.position.x += (pdx / pDist) * force;
      e1.mesh.position.z += (pdz / pDist) * force;
    }
  }

  // Update enemies
  let allDead = true;
  let aliveCount = 0;
  let lastAliveEnemy = null;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    allDead = false;
    aliveCount++;
    lastAliveEnemy = enemy;

    // Setup Pinky Rider if needed
    if (enemy.type === 'pinky_rider' && !enemy.projectileCallback) {
      setupPinkyCallbacks(enemy);
    }

    const result = enemy.update(delta, camera.position, camera, state.enemies);
    if (result) {
      if (typeof result === 'object') {
        takeDamage(result.damage, enemy.mesh.position);
        if (result.knockback) {
          applyPlayerKnockback(enemy.mesh.position, 25);
        }
      } else if (typeof result === 'number' && result > 0) {
        takeDamage(result, enemy.mesh.position);
      }
    }

    // --- ENEMY ARENA & OBSTACLE COLLISION ---
    const mapLimit = state.arenaSize - 1.5;
    enemy.mesh.position.x = Math.max(-mapLimit, Math.min(mapLimit, enemy.mesh.position.x));
    enemy.mesh.position.z = Math.max(-mapLimit, Math.min(mapLimit, enemy.mesh.position.z));

    const enemyR = enemy.isBoss ? 1.5 : 0.6;
    for (const obs of state.obstacles) {
      if (enemy.mesh.position.x + enemyR > obs.min.x && enemy.mesh.position.x - enemyR < obs.max.x &&
          enemy.mesh.position.z + enemyR > obs.min.y && enemy.mesh.position.z - enemyR < obs.max.y) {
        
        const distLeft = (enemy.mesh.position.x + enemyR) - obs.min.x;
        const distRight = obs.max.x - (enemy.mesh.position.x - enemyR);
        const distTop = (enemy.mesh.position.z + enemyR) - obs.min.y;
        const distBottom = obs.max.y - (enemy.mesh.position.z - enemyR);
        
        const minOverlap = Math.min(distLeft, distRight, distTop, distBottom);
        
        if (minOverlap === distLeft) enemy.mesh.position.x -= distLeft;
        else if (minOverlap === distRight) enemy.mesh.position.x += distRight;
        else if (minOverlap === distTop) enemy.mesh.position.z -= distTop;
        else if (minOverlap === distBottom) enemy.mesh.position.z += distBottom;
      }
    }
    // ----------------------------------------

    // Footstep / buzz sounds
    const dist = enemy.mesh.position.distanceTo(camera.position);
    if (dist < 24) {
      const interval = STEP_INTERVAL[enemy.type] || 600;
      if (now - enemy.lastStepTime > interval) {
        enemy.lastStepTime = now;
        const vol = Math.max(0, 1 - dist / 24);
        playFootstepSound(enemy.type, vol);
      }
    }

    // Sniper-specific sound events
    if (enemy.type === 'sniper') {
      if (enemy.chargeStarted) {
        enemy.chargeStarted = false;
        playSniperChargeSound();
      }
      if (enemy.shotFired) {
        enemy.shotFired = false;
        playSniperShotSound();
        // Friendly fire: sniper beam hits other enemies along its path
        sniperFriendlyFire(enemy, camera.position);
      }
    }

    // Mortar fire sound
    if (enemy.type === 'mortar' && enemy.mortarFired) {
      enemy.mortarFired = false;
      playMortarFireSound();
    }

    // Boss-specific sound events
    if (enemy.isBoss) {
      // Carmackion: LMG and rocket sounds
      if (enemy.type === 'carmackion') {
        if (enemy.lmgFired) {
          playCarmackionLmgSound();
          // lmgFired resets automatically at start of next enemy.update() traverse
        }
        if (enemy.rocketFired) {
          enemy.rocketFired = false;
          // rocket sound already played in rocketCallback
        }
      }
      // Darioltman minion spawn sound
      if (enemy.type === 'darioltman' && enemy.spawnedMinions) {
        enemy.spawnedMinions = false;
        playBossPhaseChangeSound();
      }
      // Phase change sound (handled via arenaPhaseCallback for carmackion, darioltman and nanoman)
      if (enemy.phaseChanged && enemy.type !== 'carmackion' && enemy.type !== 'darioltman' && enemy.type !== 'nanoman') {
        enemy.phaseChanged = false;
        playBossPhaseChangeSound();
      } else if (enemy.phaseChanged) {
        enemy.phaseChanged = false; // these bosses handle phase sounds via arenaPhaseCallback
      }

      // Nanoman-specific sounds
      if (enemy.type === 'nanoman') {
        if (enemy.isPunching && enemy.punchDamageDealt) {
          playNanomanPunchSound();
        }
        if (enemy.hmgFired) {
          // sound already played per bullet in hmgBulletCallback
        }
      }
      // Track boss death
      if (!enemy.alive && state.currentBoss === enemy) {
        state.currentBoss = null;
        playBossDeathSound();
        cleanupCarmackionProjectiles();
        cleanupDarioltman();
        cleanupNanoman();
        resetArenaLighting();
        // Boss death explosion - capture position before any async callback
        const deathPos = enemy.mesh.position.clone();
        if (particleSystem) {
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              if (particleSystem) {
                particleSystem.emit(
                  deathPos.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3
                  )),
                  [0xff6600, 0xff0000, 0xffff00, 0xff4400][Math.floor(Math.random() * 4)],
                  15
                );
              }
            }, i * 200);
          }
        }
      }
    }
  }

  // Last Enemy Indicator Trail
  if (aliveCount === 1 && lastAliveEnemy && !lastAliveEnemy.isBoss) {
    if (!state.lastEnemyTime) {
      state.lastEnemyTime = now;
    } else if (now - state.lastEnemyTime > 5000) {
      if (!state.lastTrailEmitTime || now - state.lastTrailEmitTime > 300) {
        state.lastTrailEmitTime = now;
        if (particleSystem) {
          const startPos = camera.position.clone();
          startPos.y -= 0.3; // A bit below eye level
          const targetPos = lastAliveEnemy.mesh.position.clone();
          targetPos.y += 0.5; // Aim at their body center
          
          const dir = targetPos.clone().sub(startPos);
          const dist = dir.length();
          dir.normalize();
          
          const speed = 10; // slower, calmer moving particles
          const lifeMs = Math.min((dist / speed) * 1000, 4000); // cap life to 4 seconds
          const vel = dir.multiplyScalar(speed);
          
          // emitDirected(position, velocity, color, count, lifeMs, gravity)
          particleSystem.emitDirected(startPos, vel, 0xffaa00, 1, lifeMs, false);
        }
      }
    }
  } else {
    state.lastEnemyTime = null;
  }

  // Check wave complete
  if (allDead && state.enemies.length > 0 && state.waveInProgress) {
    state.waveInProgress = false;
    state.enemies = [];
    cleanupCarmackionProjectiles();
    cleanupDarioltman();
    cleanupNanoman();
    cleanupMortarProjectiles();
    resetArenaLighting();
    onWaveComplete();
  }

  // Update effects
  if (bulletTrail) bulletTrail.update();
  if (particleSystem) particleSystem.update(delta);
  updateGrenades(delta);
  updateGrapple(delta);
  updateCarmackionProjectiles(delta);
  updateLavaVents(delta);
  updateDarioltmanProjectiles(delta);
  updateNanomanProjectiles(delta);
  updatePinkyProjectiles(delta);
  updateMortarProjectiles(delta);
  
  // Update Rendezvous Marker Animation
  if (state.rendezvousActive && state.rendezvousMesh) {
    state.rendezvousMesh.rotation.y += delta * 1.5;
    const pulse = 0.6 + Math.sin(now * 0.005) * 0.4;
    state.rendezvousMesh.children.forEach(child => {
      if (child.material) child.material.opacity = child.geometry.type === 'TorusGeometry' ? pulse * 0.7 : pulse * 0.2;
    });
  }

  // Fragment system — passive effects + world pickup animation
  if (fragRuntime && fragRuntime.active) {
    fragRuntime.update(
      delta,
      camera,
      state.enemies,
      state,
      (pos, col, cnt) => particleSystem.emit(pos, col, cnt),
      (enemy, dmg) => {
        enemy.takeDamage(dmg, camera.position);
        if (!enemy.alive) handleEnemyKill(enemy);
      },
    );
  }
  updateFragmentPickups(delta);

  // Expire barrier if time is up
  if (activeBarrier && now > activeBarrier.expireAt) {
    scene.remove(activeBarrier.mesh);
    activeBarrier.mesh.geometry.dispose();
    activeBarrier.mesh.material.dispose();
    activeBarrier = null;
  }
  // Pulse barrier opacity while active
  if (activeBarrier) {
    const t = (now % 800) / 800;
    activeBarrier.mesh.material.opacity = 0.25 + Math.sin(t * Math.PI * 2) * 0.12;
  }

  // Update directional damage indicator
  updateDmgIndicator();
  updateOverclockVisuals(now);
  updateImpactDecals(now);

  // Optional network diagnostics overlay
  updateNetStatsOverlay(now);

  // Update HUD + Boss HUD + new HUD elements
  updateHUD();
  updateBossHUD();
  updateReloadRing(now);
  updateAbilitySlotHUD(now);

  // God mode: keep health full
  if (state.godMode) {
    state.health = state.maxHealth;
  }

  // Render with pixelation
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(quadScene, quadCamera);
}

// ============================================================
// RESIZE
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  rebuildRenderTarget();
  applyDisplaySettings(); // Recalculate HUD scale on resize
});

// ============================================================
// INIT — show main menu on load
// ============================================================
initSettingsUI();
showMenuScreen('screen-main');
updateMenuCursor();
