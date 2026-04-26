// ============================================================
// WORKSHOP 3D — Abandoned Computer Lab
// System Shock / Doom 64 aesthetic
// FPS movement + class-selection corridors
// ============================================================
import * as THREE from 'three';
import {
  UNIVERSAL_UPGRADES, CLASS_UPGRADES, ABILITY_UPGRADES,
  getUpgradeLevel, canPurchaseUpgrade, purchaseUpgrade, saveMeta,
  equipFragment, getEquippedFragment, isFragmentUnlocked,
} from './metaProgression.js';
import { FRAGMENT_DEFS } from './fragments.js';
import { ICON_MAP, ICON_PATH, drawIconOnCanvas } from './iconMap.js';

// ─── Constants ────────────────────────────────────────────────
const ABILITY_TYPES = ['dash', 'shield', 'invincible', 'grapple', 'rendezvous'];
const ABILITY_NAMES = { dash: 'DASH', shield: 'BARRIER', invincible: 'PHASE SHIFT', grapple: 'GRAPPLE', rendezvous: 'RENDEZVOUS' };
const ABILITY_LABELS = { dash: 'DASH', shield: 'BARRIER', invincible: 'PHASE', grapple: 'GRAPPLE', rendezvous: 'RENDEZVOUS' };
const PIXEL_RATIO = 2;

// Upgrade terminal definitions
const TERMINALS = [
  { id: 'universal',     label: 'UNIVERSAL', sub: 'SYSTEMS',  x:  0,  z: -5.5, color: 0x00cc55 },
  { id: 'lmg',           label: 'LMG',       sub: 'MODULE',   x: -7,  z: -3,   color: 0x00bb77 },
  { id: 'rifle',         label: 'RIFLE',     sub: 'MODULE',   x:  7,  z: -3,   color: 0x00bb77 },
  { id: 'shotgun',       label: 'SHOTGUN',   sub: 'MODULE',   x: -6,  z:  2,   color: 0x0099cc },
  { id: 'abilities',     label: 'R-CLICK',   sub: 'UPGRADES', x:  6,  z:  2,   color: 0x4466ff },
  { id: 'build_computer',label: 'BUILD',     sub: 'STATION',  x:  0,  z:  5.5, color: 0xff8800 },
];

// Class-selection corridor definitions
// Back wall at Z=-12; corridors extend to Z=-30
// Room width: -15 to +15
// Corridor centers at X = -8, 0, +8; each 3.5 units wide
const CORRIDORS = [
  { cls: 'lmg',     xCenter: -8, xMin: -9.75, xMax: -6.25, colorHex: 0xff0055, sign: '#ff3377', light: 0xff0055 },
  { cls: 'rifle',   xCenter:  0, xMin: -1.75, xMax:  1.75, colorHex: 0x00eeff, sign: '#33ffff', light: 0x00eeff },
  { cls: 'shotgun', xCenter:  8, xMin:  6.25, xMax:  9.75, colorHex: 0x9900ff, sign: '#bb33ff', light: 0x9900ff },
];
const BACK_WALL_Z = -12;

const HINT_MESSAGES = [
  "Collect Gears from defeated enemies to purchase meta-upgrades.",
  "The build computer allows you to customize your starting loadout.",
   'Did you know you can punch by pressing F?',
 'You can punch while reloading. Trust your fists when enemies corner you.',
  'Did you know you can punch by pressing F?',
 'You can punch while reloading. Trust your fists when enemies corner you.',
 'Only you choose who to become. Build your character as a tank or a ninja.',
 'Don\'t forget to unlock upgrades at the Workshop with Gears earned from kills.',
 'Motherboard Fragments are your passive abilities. Once unlocked during a run, they can always be equipped at the Build Terminal.',
 'Each class has its own traits: LMG is fast but fragile, Shotgun is slow but devastating. Rifles offer a balanced playstyle.',
 'Did you know you can create millions of different build combinations using the Terminals?'
];


// Hint screen state
let hintScreens = [];
let hintIdx = Math.floor(Math.random() * HINT_MESSAGES.length);
let hintTimer = 0;
const HINT_INTERVAL = 6;

const CORRIDOR_DEPTH = 18;       // how far back corridors extend from BACK_WALL_Z
// Trigger fires 9 units past the back wall — deep enough to feel committed to a corridor
const CORRIDOR_TRIGGER_Z = BACK_WALL_Z - 9;  // = -21

// ─── Module State ─────────────────────────────────────────────
let active = false;
let rafId = null;
let _renderer = null;
let _meta = null;
let _onClose = null;
let _onSelectClass = null;

// THREE
let scene = null;
let cam = null;
const clock = new THREE.Clock(false);

// Pixel pipeline
let rt = null;
let quadScene = null;
let quadCam = null;
let quadMat = null;
let pipeBuilt = false;

// FPS movement
const playerPos = new THREE.Vector3(0, 0, 10);
let playerYaw = Math.PI;    // facing -Z (into room)
let playerPitch = 0;
const wsKeys = {};
let wsPointerLocked = false;
let corridorTriggered = false;
let _bPLC;

// Interaction
const raycaster = new THREE.Raycaster();
const CENTER_NDC = new THREE.Vector2(0, 0);  // always raycast from screen center
let hoveredIdx = -1;
let currentPanelIdx = -1;

// Proximity / pressure-plate state
const PROXIMITY_RANGE = 3.0;   // units from terminal center to activate
let nearTerminalIdx = -1;       // which terminal player is standing near (-1 = none)
const termCursor = [];          // per-terminal selected upgrade index
const plateMeshes = [];         // glowing floor plates

// Per-terminal state
const termObjs = [];

// Flickering lights
const flickLights = [];
let blinkAccum = 0;
const BLINK_INTERVAL = 1.8;
const neonLoops = []; // Tracks neon tunnel segments for automatic lighting

// Bound event handlers
let _bMM, _bMC, _bKD, _bKU;

// ─── OPEN / CLOSE ─────────────────────────────────────────────
export function openWorkshop(renderer, meta, onClose, onSelectClass) {
  _renderer = renderer;
  _meta = meta;
  _onClose = onClose;
  _onSelectClass = onSelectClass || null;
  active = true;
  corridorTriggered = false;

  if (!scene) buildScene();
  if (!pipeBuilt) { buildPixelPipeline(); pipeBuilt = true; }
  if (!document.getElementById('ws-hud')) buildHtml();

  // Reset player to entrance
  playerPos.set(0, 0, 10);
  playerYaw = Math.PI;
  playerPitch = 0;

  refreshMonitorTextures();
  updateGearsHud();
  document.getElementById('ws-hud').style.display = 'block';

  document.body.style.cursor = '';

  // Show controls intro overlay on entry
  showIntroOverlay();

  // Pointer lock
  _bPLC = () => {
    wsPointerLocked = document.pointerLockElement === renderer.domElement;
    updateLockHint();
  };
  document.addEventListener('pointerlockchange', _bPLC);

  _bMM = e => {
    if (!wsPointerLocked) return;
    playerYaw   -= e.movementX * 0.002;
    playerPitch -= e.movementY * 0.002;
    playerPitch  = Math.max(-1.1, Math.min(1.1, playerPitch));
  };
  _bMC = e => onMouseClick(e);
  _bKD = e => onKeyDown(e);
  _bKU = e => { wsKeys[e.code] = false; };

  window.addEventListener('mousemove', _bMM);
  window.addEventListener('click',     _bMC);
  window.addEventListener('keydown',   _bKD);
  window.addEventListener('keyup',     _bKU);

  // Request pointer lock on first click (handled in onMouseClick)
  clock.start();
  hoveredIdx = -1;
  currentPanelIdx = -1;
  nearTerminalIdx = -1;
  termCursor.fill(0);
  
  // Reset loops
  neonLoops.forEach(l => l.mat.color.copy(l.offColor));

  // Reset plate opacities
  plateMeshes.forEach(pm => { if (pm) pm.opacity = 0.35; });
  loop();
}

// ─── INTRO OVERLAY ────────────────────────────────────────────
function showIntroOverlay() {
  let overlay = document.getElementById('ws-intro');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ws-intro';
    overlay.innerHTML = `
      <div id="ws-intro-box">
        <div id="ws-intro-title">MACHINE WORKSHOP NODE</div>
        <div id="ws-intro-sub">UAC FIELD FABRICATOR // REV 1993</div>
        <div class="ws-intro-sep"></div>
        <div class="ws-intro-row"><span class="ws-intro-key">CLICK</span><span class="ws-intro-desc">Lock mouse and boot tactical view</span></div>
        <div class="ws-intro-row"><span class="ws-intro-key">W A S D</span><span class="ws-intro-desc">Move between terminal stations</span></div>
        <div class="ws-intro-row"><span class="ws-intro-key">MOUSE</span><span class="ws-intro-desc">Look / align with terminal displays</span></div>
        <div class="ws-intro-row"><span class="ws-intro-key">↑ / ↓</span><span class="ws-intro-desc">Navigate selected terminal list</span></div>
        <div class="ws-intro-row"><span class="ws-intro-key">E</span><span class="ws-intro-desc">Buy upgrade / equip module</span></div>
        <div class="ws-intro-sep"></div>
        <div class="ws-intro-hint">Stand on a glowing floor plate to activate a terminal.</div>
        <div class="ws-intro-hint">Walk into a rear corridor to lock class and deploy.</div>
        <div class="ws-intro-sep"></div>
        <div id="ws-intro-start">[ CLICK ANYWHERE TO BEGIN ]</div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => {
      overlay.style.display = 'none';
      _renderer.domElement.requestPointerLock();
    });
  }
  overlay.style.display = 'flex';
  document.body.style.cursor = '';
}

export function closeWorkshop() {
  if (!active) return;
  active = false;
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }

  if (wsPointerLocked) document.exitPointerLock();
  wsPointerLocked = false;
  document.body.style.cursor = '';

  const hud = document.getElementById('ws-hud');
  if (hud) hud.style.display = 'none';
  const intro = document.getElementById('ws-intro');
  if (intro) intro.style.display = 'none';

  document.removeEventListener('pointerlockchange', _bPLC);
  window.removeEventListener('mousemove', _bMM);
  window.removeEventListener('click',     _bMC);
  window.removeEventListener('keydown',   _bKD);
  window.removeEventListener('keyup',     _bKU);

  // Clear key state
  Object.keys(wsKeys).forEach(k => { wsKeys[k] = false; });

  hoveredIdx = -1;
  currentPanelIdx = -1;
  if (_onClose) _onClose();
}

export function isWorkshopActive() { return active; }

// ─── PIXEL PIPELINE ───────────────────────────────────────────
function buildPixelPipeline() {
  rt = new THREE.WebGLRenderTarget(
    Math.floor(window.innerWidth / PIXEL_RATIO),
    Math.floor(window.innerHeight / PIXEL_RATIO),
    { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter },
  );
  quadScene = new THREE.Scene();
  quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quadMat = new THREE.MeshBasicMaterial({ map: rt.texture });
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));

  window.addEventListener('resize', () => {
    if (!pipeBuilt) return;
    rt.dispose();
    rt = new THREE.WebGLRenderTarget(
      Math.floor(window.innerWidth / PIXEL_RATIO),
      Math.floor(window.innerHeight / PIXEL_RATIO),
      { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter },
    );
    quadMat.map = rt.texture;
    if (cam) {
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
    }
  });
}

// ─── SCENE BUILDING ───────────────────────────────────────────
function buildScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050e06, 0.005);
  scene.background = new THREE.Color(0x0a1a0c);

  cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 80);

  buildLights();
  buildRoom();
  buildCorridors();
  buildTerminals();
  buildDecor();
  buildGraffiti();
  buildHintScreen(-7, 1.8, 12.85, Math.PI);
  buildHintScreen(7, 1.8, 12.85, Math.PI);
}

function buildLights() {
  // Very bright ambient — room should feel well-lit like a real facility
  scene.add(new THREE.AmbientLight(0x334433, 8.0));

  // Main overhead row — nine bright fluorescent banks covering full room
  const mainPositions = [
    { x: -6, z: 9 }, { x: 6, z: 9 },
    { x: -6, z: 3 }, { x: 6, z: 3 },
    { x: -6, z: -3 }, { x: 6, z: -3 },
    { x: 0, z: -8 }, { x: 0, z: 1 }, { x: 0, z: 9 },
  ];
  mainPositions.forEach(p => {
    const pl = new THREE.PointLight(0xccffdd, 4.5, 22);
    pl.position.set(p.x, 4.6, p.z);
    scene.add(pl);
  });

  // Left bank — mild flicker
  const left = new THREE.PointLight(0xaaffcc, 3.5, 26);
  left.position.set(-10, 4.6, -2);
  scene.add(left);
  flickLights.push({ light: left, base: 3.5, speed: 4.2, phase: 0.0 });

  // Right bank — faint flicker
  const right = new THREE.PointLight(0x99ffbb, 3.0, 24);
  right.position.set(10, 4.6, 1);
  scene.add(right);
  flickLights.push({ light: right, base: 3.0, speed: 7.1, phase: 2.3 });

  // Wall sconce lights — left and right walls, evenly spaced
  [
    { x: -14.5, z: 8 }, { x: -14.5, z: 2 }, { x: -14.5, z: -6 },
    { x:  14.5, z: 8 }, { x:  14.5, z: 2 }, { x:  14.5, z: -6 },
  ].forEach(p => {
    const sc = new THREE.PointLight(0xaaffcc, 2.5, 14);
    sc.position.set(p.x, 2.8, p.z);
    scene.add(sc);
  });

  // Fill lights (mid-height) to eliminate floor shadows
  [
    { x: -6, z: 6 }, { x: 6, z: 6 },
    { x: -6, z: 0 }, { x: 6, z: 0 },
    { x:  0, z: -5 },
  ].forEach(p => {
    const fl = new THREE.PointLight(0x88ddaa, 2.0, 16);
    fl.position.set(p.x, 1.5, p.z);
    scene.add(fl);
  });

  // Emergency red — back corner accent
  const red = new THREE.PointLight(0xff3300, 1.2, 10);
  red.position.set(12, 1.2, -10);
  scene.add(red);
  flickLights.push({ light: red, base: 1.2, speed: 2.0, phase: 1.1 });

  // Warm orange — broken desk lamp
  const orange = new THREE.PointLight(0xff9922, 1.0, 8);
  orange.position.set(-11, 1.4, 7);
  scene.add(orange);

  // Entrance area — bright welcome light
  const entrance = new THREE.PointLight(0xccffdd, 3.5, 22);
  entrance.position.set(0, 4.2, 10);
  scene.add(entrance);
  const entrance2 = new THREE.PointLight(0xaaffcc, 2.5, 16);
  entrance2.position.set(0, 2.0, 10);
  scene.add(entrance2);
}

function buildRoom() {
  const mFloor = new THREE.MeshLambertMaterial({ color: 0x1a2a1a });
  const mWall  = new THREE.MeshLambertMaterial({ color: 0x151e15 });
  const mCeil  = new THREE.MeshLambertMaterial({ color: 0x0d150d });
  const mTube  = new THREE.MeshBasicMaterial({ color: 0xccffdd });
  const mBeam  = new THREE.MeshLambertMaterial({ color: 0x182218 });

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 26), mFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -2);
  scene.add(floor);

  const grid = new THREE.GridHelper(30, 15, 0x254025, 0x1a2e1a);
  grid.position.set(0, 0.005, -2);
  scene.add(grid);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 26), mCeil);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 5.2, -2);
  scene.add(ceil);

  // Back wall: 4 segments with 3 openings for corridors
  // Corridor openings: xMin=-9.75..xMax=-6.25, -1.75..1.75, 6.25..9.75
  // Corridor height: 0..4.2, above lintel: 4.2..5.2
  const WALL_SEGS = [
    { x: -12.375, w: 5.25 },  // -15 to -9.75
    { x: -4,      w: 4.5  },  // -6.25 to -1.75
    { x:  4,      w: 4.5  },  // 1.75 to 6.25
    { x:  12.375, w: 5.25 },  // 9.75 to 15
  ];
  WALL_SEGS.forEach(seg => {
    // Full height wall segment where there's no opening
    scene.add(mkBox(seg.w, 5.2, 0.22, seg.x, 2.6, BACK_WALL_Z, mWall));
  });
  // Lintels above each corridor opening (4.2 to 5.2 = 1.0 height)
  CORRIDORS.forEach(cd => {
    scene.add(mkBox(3.5, 1.0, 0.22, cd.xCenter, 4.7, BACK_WALL_Z, mWall));
  });

  // Left and right walls
  scene.add(mkBox(0.22, 5.2, 26, -15, 2.6, -2, mWall));
  scene.add(mkBox(0.22, 5.2, 26,  15, 2.6, -2, mWall));

  // Front wall (behind player start)
  scene.add(mkBox(30, 5.2, 0.22, 0, 2.6, 13, mWall));

  // Fluorescent tubes on ceiling
  for (const tubeX of [-8, 0, 8]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 7, 6), mTube);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(tubeX, 5.1, -1);
    scene.add(tube);
  }

  // Ceiling support beams
  for (const beamZ of [-7, 0, 7]) {
    scene.add(mkBox(30, 0.18, 0.28, 0, 5.15, beamZ, mBeam));
  }
}

function buildCorridors() {
  const mFloor = new THREE.MeshLambertMaterial({ color: 0x111811 });
  const mWall  = new THREE.MeshLambertMaterial({ color: 0x0e150e });
  const mCeil  = new THREE.MeshLambertMaterial({ color: 0x0c130c });

  CORRIDORS.forEach(cd => {
    const len = CORRIDOR_DEPTH;
    const cx = cd.xCenter;
    const midZ = BACK_WALL_Z - len / 2;        // center Z of corridor
    const endZ = BACK_WALL_Z - len;             // far end of corridor

    // Floor
    const flr = new THREE.Mesh(new THREE.PlaneGeometry(3.5, len), mFloor);
    flr.rotation.x = -Math.PI / 2;
    flr.position.set(cx, 0.001, midZ);
    scene.add(flr);
    // Grid on floor
    const cGrid = new THREE.GridHelper(3.5, 7, 0x0f1f0f, 0x0b140b);
    cGrid.scale.z = len / 3.5;
    cGrid.position.set(cx, 0.002, midZ);
    scene.add(cGrid);

    // Ceiling
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(3.5, len), mCeil);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, 4.2, midZ);
    scene.add(ceil);

    // Left wall
    scene.add(mkBox(0.1, 4.2, len, cd.xMin, 2.1, midZ, mWall));
    // Right wall
    scene.add(mkBox(0.1, 4.2, len, cd.xMax, 2.1, midZ, mWall));
    // End wall
    scene.add(mkBox(3.5, 4.2, 0.1, cx, 2.1, endZ, mWall));
    
    // Trapezoidal Neon Tunnel Loops
    // Create multiple glowing loops down the corridor
    for (let depth = 0.5; depth < len - 0.5; depth += 1.5) {
      const zPos = BACK_WALL_Z - depth;
      const th = 0.05; // Thickness of the neon tube
      
      const loopMat = new THREE.MeshBasicMaterial({ color: 0x020302 }); // Starts off/dark
      
      // Bottom
      const bGeo = new THREE.BoxGeometry(3.5, th, th);
      const bMesh = new THREE.Mesh(bGeo, loopMat);
      bMesh.position.set(cx, 0.05, zPos);
      scene.add(bMesh);
      
      // Top (narrower for trapezoid illusion)
      const tGeo = new THREE.BoxGeometry(1.8, th, th);
      const tMesh = new THREE.Mesh(tGeo, loopMat);
      tMesh.position.set(cx, 4.15, zPos);
      scene.add(tMesh);
      
      // Angled sides
      const hyp = Math.sqrt(4.1 * 4.1 + 0.85 * 0.85); // 4.1 height diff, 0.85 width diff per side
      const aGeo = new THREE.BoxGeometry(th, hyp, th);
      
      const lMesh = new THREE.Mesh(aGeo, loopMat);
      lMesh.position.set(cx - 1.325, 2.1, zPos); // Center of angled section
      lMesh.rotation.z = -Math.atan2(0.85, 4.1);
      scene.add(lMesh);
      
      const rMesh = new THREE.Mesh(aGeo, loopMat);
      rMesh.position.set(cx + 1.325, 2.1, zPos);
      rMesh.rotation.z = Math.atan2(0.85, 4.1);
      scene.add(rMesh);
      
      // Save to neon loops for logic
      neonLoops.push({
        z: zPos,
        cx: cx,
        mat: loopMat,
        onColor: new THREE.Color(cd.colorHex),
        offColor: new THREE.Color(0x020302)
      });
    }

    // Lights inside corridor — bright so the class signs pop
    const corridorLight = new THREE.PointLight(cd.colorHex, 4.0, 18);
    corridorLight.position.set(cx, 3.8, midZ);
    scene.add(corridorLight);
    flickLights.push({ light: corridorLight, base: 4.0, speed: 2.5 + Math.random(), phase: Math.random() * Math.PI * 2 });

    // Extra near-entrance light — brighter so sign is readable from main room
    const nearLight = new THREE.PointLight(cd.colorHex, 3.0, 12);
    nearLight.position.set(cx, 3.5, BACK_WALL_Z - 2);
    scene.add(nearLight);

    // Class sign above the corridor opening (canvas texture)
    buildCorridorSign(cd);

    // Arrow on floor pointing into corridor
    buildCorridorArrow(cd, BACK_WALL_Z - 1.5);
  });
}

function buildCorridorSign(cd) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000200';
  ctx.fillRect(0, 0, 256, 96);

  // Glow text
  ctx.shadowBlur = 18;
  ctx.shadowColor = cd.sign;
  ctx.fillStyle = cd.sign;
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cd.cls.toUpperCase(), 128, 44);

  ctx.font = '14px monospace';
  ctx.fillStyle = cd.sign;
  ctx.shadowBlur = 6;
  ctx.fillText('→ ENTER CORRIDOR →', 128, 78);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.1), mat);
  sign.position.set(cd.xCenter, 4.7, BACK_WALL_Z + 0.15);
  scene.add(sign);
}

function buildCorridorArrow(cd, z) {
  const mat = new THREE.MeshBasicMaterial({ color: cd.colorHex });
  // Arrow shaft
  scene.add(mkBox(0.12, 0.01, 0.7, cd.xCenter, 0.004, z, mat));
  // Arrow head (two angled pieces)
  const h1 = mkBox(0.5, 0.01, 0.12, cd.xCenter, 0.004, z - 0.28, mat);
  h1.rotation.y = Math.PI / 4;
  scene.add(h1);
  const h2 = mkBox(0.5, 0.01, 0.12, cd.xCenter, 0.004, z - 0.28, mat);
  h2.rotation.y = -Math.PI / 4;
  scene.add(h2);
}

function buildTerminals() {
  const mDesk = new THREE.MeshLambertMaterial({ color: 0x243024 });
  const mMon  = new THREE.MeshLambertMaterial({ color: 0x1c251c });
  const mKeys = new THREE.MeshLambertMaterial({ color: 0x182018 });

  TERMINALS.forEach((td, i) => {
    const g = new THREE.Group();
    g.position.set(td.x, 0, td.z);
    scene.add(g);

    // Desk body (wider to match bigger monitor)
    g.add(mkBox(2.8, 0.86, 1.1, 0, 0.43, 0, new THREE.MeshLambertMaterial({ color: 0x1e281e })));
    g.add(mkBox(2.8, 0.07, 1.1, 0, 0.865, 0, mDesk));

    // Large monitor casing
    const monCasing = mkBox(2.0, 1.4, 0.13, 0, 1.72, -0.26, mMon);
    monCasing.rotation.x = -0.10;
    g.add(monCasing);

    // Monitor neck + base
    g.add(mkBox(0.15, 0.28, 0.10, 0, 0.99, -0.22, mMon));
    g.add(mkBox(0.65, 0.03, 0.32, 0, 0.88, -0.28, mMon));

    // Large canvas for in-world upgrade display
    const canvas = document.createElement('canvas');
    canvas.width  = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');

    // FIX: draw initial placeholder content BEFORE creating CanvasTexture.
    // This mirrors buildCorridorSign's pattern (draw first, then create texture)
    // which is the only approach that reliably works. Without this, the texture
    // is created with a transparent-black canvas and may never visually update.
    if (ctx) {
      const cr = (td.color >> 16) & 0xff;
      const cg = (td.color >> 8) & 0xff;
      const cb = td.color & 0xff;
      ctx.fillStyle = '#010d02';
      ctx.fillRect(0, 0, 512, 384);
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.font = 'bold 52px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(td.label, 256, 192);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    // FIX: polygonOffset prevents Z-fighting with the monitor casing front face.
    // The screen plane and the casing's front face occupy the same depth, so
    // polygonOffset pushes the screen forward in depth-buffer space.
    const screenMat = new THREE.MeshBasicMaterial({
      map: tex,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.30), screenMat);
    screen.position.set(0, 1.72, -0.190);
    screen.rotation.x = -0.10;
    screen.renderOrder = 1;
    screen.userData.terminalIdx = i;
    g.add(screen);

    const keysMesh = mkBox(1.20, 0.022, 0.36, 0, 0.90, 0.20, mKeys);
    g.add(keysMesh);

    const ledMat = new THREE.MeshBasicMaterial({ color: td.color });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), ledMat);
    led.position.set(0.88, 1.14, -0.20);
    g.add(led);

    // Stronger screen glow
    const glow = new THREE.PointLight(td.color, 2.5, 9.0);
    glow.position.set(0, 1.8, -0.3);
    g.add(glow);

    // ── Pressure plate on floor in front of the desk ──
    const plateMat = new THREE.MeshBasicMaterial({
      color: td.color,
      transparent: true,
      opacity: 0.35,
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.5), plateMat);
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(0, 0.006, 1.4);   // 1.4 units in front of the desk
    g.add(plate);

    // Plate border frame (thin boxes)
    const frameMat = new THREE.MeshBasicMaterial({ color: td.color });
    [
      mkBox(2.0, 0.01, 0.05,  0,    0.007,  0.65, frameMat),
      mkBox(2.0, 0.01, 0.05,  0,    0.007,  2.15, frameMat),
      mkBox(0.05, 0.01, 1.5, -0.975, 0.007, 1.4, frameMat),
      mkBox(0.05, 0.01, 1.5,  0.975, 0.007, 1.4, frameMat),
    ].forEach(b => g.add(b));

    plateMeshes.push(plateMat);
    termCursor.push(0);

    termObjs.push({ light: glow, canvas, ctx, tex, id: td.id, screenMesh: screen, group: g });
    drawMonitor(i, false, false);
  });
}

function buildDecor() {
  const mRust  = new THREE.MeshLambertMaterial({ color: 0x1e1609 });
  const mPipe  = new THREE.MeshLambertMaterial({ color: 0x192019 });
  const mMetal = new THREE.MeshLambertMaterial({ color: 0x131813 });
  const mDark  = new THREE.MeshLambertMaterial({ color: 0x0c100c });

  // Horizontal pipes along back wall
  for (const py of [0.8, 2.1, 3.6]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 28, 7), mPipe);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, py, -11.7);
    scene.add(pipe);
  }

  // Vertical pipe connectors
  for (const px of [-11, -5, 5, 11]) {
    const vPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.2, 7), mPipe);
    vPipe.position.set(px, 2.1, -11.7);
    scene.add(vPipe);
  }

  // Horizontal pipe along left wall
  const lpipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 22, 7), mPipe);
  lpipe.rotation.x = Math.PI / 2;
  lpipe.position.set(-14.7, 1.4, -2);
  scene.add(lpipe);

  // Server racks — back corners
  for (const [sx, sz] of [[-11.5, -10.5], [11.5, -10.5]]) {
    scene.add(mkBox(2.2, 4.6, 1.0, sx, 2.3, sz, mMetal));
    for (let row = 0; row < 8; row++) {
      scene.add(mkBox(1.9, 0.04, 0.02, sx, 0.7 + row * 0.5, sz + 0.51, mDark));
    }
    for (let row = 0; row < 7; row++) {
      const col = Math.random() < 0.6 ? 0x00ff44 : 0xff2200;
      const sl = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.04, 0.01),
        new THREE.MeshBasicMaterial({ color: col }),
      );
      sl.position.set(sx + (sx < 0 ? 0.85 : -0.85), 0.85 + row * 0.5, sz + 0.52);
      scene.add(sl);
    }
  }

  // Filing cabinet
  scene.add(mkBox(0.85, 1.6, 0.6, -13.5, 0.8, 5, mMetal));
  scene.add(mkBox(0.83, 0.02, 0.58, -13.5, 1.6, 5, mDark));

  // Overturned chair
  const seat = mkBox(0.5, 0.06, 0.5, -9.5, 0.52, 8, mRust);
  seat.rotation.z = 0.9;
  scene.add(seat);
  const back = mkBox(0.06, 0.55, 0.5, -9.2, 0.8, 8, mRust);
  back.rotation.z = -0.5;
  scene.add(back);

  // Scattered debris
  const debrisData = [
    [-9, 0, -9, 0.35, 0.22, 0.28],
    [-11, 0, -6, 0.20, 0.38, 0.22],
    [10, 0, -8, 0.38, 0.26, 0.42],
    [11.5, 0, 1, 0.28, 0.17, 0.32],
    [-13, 0, -3, 0.22, 0.28, 0.20],
    [9, 0, 7, 0.30, 0.19, 0.35],
  ];
  debrisData.forEach(([x, y, z, w, h, d]) => {
    const box = mkBox(w, h, d, x, y + h / 2, z, mRust);
    box.rotation.y = Math.random() * Math.PI;
    scene.add(box);
  });

  // Ceiling cable runs
  const cableGeo = new THREE.CylinderGeometry(0.03, 0.03, 24, 5);
  const cable1 = new THREE.Mesh(cableGeo, mDark);
  cable1.rotation.z = Math.PI / 2;
  cable1.position.set(0, 4.9, -8);
  scene.add(cable1);
  const cable2 = new THREE.Mesh(cableGeo, mDark);
  cable2.rotation.z = Math.PI / 2;
  cable2.position.set(0, 4.85, 3);
  scene.add(cable2);

  // Gear ring on back wall (between corridors)
  const gearRingGeo = new THREE.TorusGeometry(0.5, 0.055, 6, 14);
  const gearMat = new THREE.MeshLambertMaterial({ color: 0x1a2a1a });
  scene.add(mkMesh(gearRingGeo, gearMat, -4, 3.2, BACK_WALL_Z + 0.15));
  scene.add(mkMesh(gearRingGeo, gearMat,  4, 3.2, BACK_WALL_Z + 0.15));

  // Warning stripe on floor near entrance
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0x1a1200 });
  for (let sx = -12; sx <= 12; sx += 1.2) {
    scene.add(mkBox(0.55, 0.002, 0.8, sx, 0.002, 11, stripeMat));
  }
}

function buildGraffiti() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 2048, 1024);

  // Dried blood red / Dark spray colors
  const color = '#660000';
  const colorBright = '#881100';

  // Manual character paths (relative coordinates 0-1)
  const paths = {
    'N': [[0,1], [0,0], [1,1], [1,0]],
    'E': [[1,0], [0,0], [0,0.5], [0.8,0.5], [0,0.5], [0,1], [1,1]],
    'V': [[0,0], [0.5,1], [1,0]],
    'R': [[0,1], [0.05,0.05], [0.9,0.1], [1,0.4], [0.1,0.5], [0.4,0.5], [1,1]],
    'L': [[0,0], [0.1,1], [1,1]],
    'O': [[0.5,0.05], [0.95,0.2], [1,0.5], [0.9,0.9], [0.4,0.95], [0.05,0.7], [0,0.4], [0.1,0.1], [0.55,0.05]],
    'K': [[0.1,0.05], [0.1,1], [0.1,0.55], [0.8,0.1], [0.1,0.55], [0.9,1]],
    'B': [[0.1,0.05], [0.1,1], [0.8,0.85], [0.1,0.55], [0.9,0.4], [0.1,0.05]],
    'A': [[0.1,1], [0.5,0.1], [0.95,1], [0.25,0.6], [0.8,0.65]],
    'C': [[0.95,0.2], [0.5,0.05], [0.1,0.2], [0.05,0.5], [0.1,0.85], [0.5,1], [0.95,0.8]]
  };

  const drawScrawlPath = (pts, ox, oy, scaleW, scaleH) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i+1];
      const x1 = ox + p1[0] * scaleW;
      const y1 = oy + p1[1] * scaleH;
      const x2 = ox + p2[0] * scaleW;
      const y2 = oy + p2[1] * scaleH;
      
      const dist = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
      const steps = dist / 1.5;
      
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = x1 + (x2-x1) * t;
        const py = y1 + (y2-y1) * t;
        
        // Multi-pass spray dots for a fuzzy/rough stroke
        for (let j = 0; j < 8; j++) {
          const angle = Math.random() * Math.PI * 2;
          const rad = Math.random() * 9;
          const dotX = px + Math.cos(angle) * rad;
          const dotY = py + Math.sin(angle) * rad;
          
          ctx.globalAlpha = 0.12 + Math.random() * 0.15;
          ctx.fillStyle = Math.random() > 0.3 ? color : colorBright;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 1 + Math.random() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Potential drip from joints
      if (Math.random() > 0.85) {
        const dripX = x2 + (Math.random() - 0.5) * 5;
        const dripY = y2;
        const dripLen = 20 + Math.random() * 150;
        const dripW = 2 + Math.random() * 4;
        
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = color;
        ctx.fillRect(dripX, dripY, dripW, dripLen);
        ctx.beginPath();
        ctx.arc(dripX + dripW/2, dripY + dripLen, dripW * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  // Render "NEVER LOOK BACK"
  const words = [
    { text: "NEVER", rot: 0.04 }, 
    { text: "LOOK",  rot: -0.05 }, 
    { text: "BACK",  rot: 0.03 }
  ];
  let curY = 200;
  
  words.forEach((wObj, wIdx) => {
    const word = wObj.text;
    let curX = 1024 - (word.length * 130) / 2;
    const wave = Math.random() * 10;
    
    ctx.save();
    // Rotate word around its center
    ctx.translate(1024, curY + 100);
    ctx.rotate(wObj.rot);
    ctx.translate(-1024, -(curY + 100));

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const p = paths[char];
      if (p) {
        const jitterX = (Math.random() - 0.5) * 10;
        const jitterY = (Math.random() - 0.5) * 10 + Math.sin(i * 0.8) * wave;
        const charW = 100 + Math.random() * 20;
        const charH = 160 + Math.random() * 30;
        
        drawScrawlPath(p, curX + jitterX, curY + jitterY, charW, charH);
        
        // Horizontal "flow" connections
        if (i < word.length - 1 && Math.random() > 0.5) {
          const connectLine = [[1.2, 0.8], [0.8, 0.9]];
          drawScrawlPath(connectLine, curX + charW * 0.6, curY + charH * 0.7 + jitterY, 40, 20);
        }
      }
      curX += 140;
    }
    ctx.restore();
    curY += 240;
  });

  // Final noise pass (spray dust)
  for (let i = 0; i < 3000; i++) {
    const rx = Math.random() * 2048;
    const ry = Math.random() * 1024;
    ctx.globalAlpha = Math.random() * 0.04;
    ctx.fillStyle = color;
    ctx.fillRect(rx, ry, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ 
    map: tex, 
    transparent: true,
    opacity: 0.82, 
    alphaTest: 0.01,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4
  });
  
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), mat);
  // Moved further down (y=1.8)
  plane.position.set(0, 1.8, 12.87); 
  plane.rotation.y = Math.PI; 
  scene.add(plane);
}

function drawHintScreenCanvas(ctx, idx) {
  const W = 512, H = 256;
  
  // ─── Background ───
  const grad = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, W/1.5);
  grad.addColorStop(0, '#0a1a0c');
  grad.addColorStop(1, '#020803');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(0, 255, 68, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 2);
  }

  // ─── Borders & Corners ───
  const orange = '#ef8a30';
  const muted = 'rgba(171,135,83,0.4)';
  
  ctx.strokeStyle = muted;
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  // Tech Corners
  ctx.strokeStyle = orange;
  ctx.lineWidth = 3;
  const cs = 24; // corner size
  // Top-left
  ctx.beginPath(); ctx.moveTo(8, 8 + cs); ctx.lineTo(8, 8); ctx.lineTo(8 + cs, 8); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(W - 8 - cs, 8); ctx.lineTo(W - 8, 8); ctx.lineTo(W - 8, 8 + cs); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(8, H - 8 - cs); ctx.lineTo(8, H - 8); ctx.lineTo(8 + cs, H - 8); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(W - 8 - cs, H - 8); ctx.lineTo(W - 8, H - 8); ctx.lineTo(W - 8, H - 8 - cs); ctx.stroke();

  // ─── Header Badge ───
  ctx.fillStyle = 'rgba(239, 138, 48, 0.15)';
  ctx.fillRect(W/2 - 70, 0, 140, 38);
  ctx.strokeStyle = orange;
  ctx.lineWidth = 1;
  ctx.strokeRect(W/2 - 70, 0, 140, 38);

  ctx.fillStyle = orange;
  ctx.shadowBlur = 10;
  ctx.shadowColor = orange;
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('💡 TIP', W / 2, 10);
  ctx.shadowBlur = 0;

  // ─── Message Text ───
  ctx.fillStyle = '#d4b586';
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const msg = HINT_MESSAGES[idx % HINT_MESSAGES.length];
  const maxW = W - 100;
  const words = msg.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const startY = 85 + (3 - lines.length) * 12;
  lines.forEach((l, i) => {
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.fillText(l, W / 2, startY + i * 28);
    ctx.shadowBlur = 0;
  });

  // ─── Footer / Progress Bar ───
  const total = HINT_MESSAGES.length;
  const current = (idx % total) + 1;
  const barW = 120;
  const barH = 6;
  const barX = W / 2 - barW / 2;
  const barY = H - 40;

  // Bar background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = muted;
  ctx.strokeRect(barX, barY, barW, barH);

  // Segments
  const segW = barW / total;
  for (let i = 0; i < total; i++) {
    if (i < current) {
      ctx.fillStyle = orange;
      ctx.fillRect(barX + i * segW + 1, barY + 1, segW - 2, barH - 2);
    }
  }

  ctx.fillStyle = muted;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`STATUS: ADVISORY ${current}/${total}`, W / 2, H - 20);
}

function buildHintScreen(x, y, z, rotY) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  drawHintScreenCanvas(ctx, hintIdx);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });

  const screenW = 3.2, screenH = 1.6;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), mat);
  const offset = 0.06;
  const px = x + Math.sin(rotY) * offset;
  const pz = z + Math.cos(rotY) * offset;
  plane.position.set(px, y, pz);
  plane.rotation.y = rotY;
  scene.add(plane);

  const frameMat = new THREE.MeshLambertMaterial({ color: 0x1c251c });
  const casing = mkBox(screenW + 0.2, screenH + 0.14, 0.10, x, y, z, frameMat);
  casing.rotation.y = rotY;
  scene.add(casing);

  const glow = new THREE.PointLight(0xef8a30, 1.8, 6.0);
  glow.position.set(x + Math.sin(rotY) * 0.5, y, z + Math.cos(rotY) * 0.5);
  scene.add(glow);

  hintScreens.push({ canvas, ctx, tex, glow });
}

// ─── HELPERS ──────────────────────────────────────────────────

function mkBox(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function mkMesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// ─── FPS MOVEMENT ─────────────────────────────────────────────
function updateMovement(delta) {
  const speed = 5.5;

  // Forward/back direction (ignore pitch for horizontal movement)
  const fwd = new THREE.Vector3(
    -Math.sin(playerYaw),
    0,
    -Math.cos(playerYaw),
  );
  const right = new THREE.Vector3(
    Math.cos(playerYaw),
    0,
    -Math.sin(playerYaw),
  );

  const move = new THREE.Vector3();
  if (wsKeys['KeyW']) move.addScaledVector(fwd, speed * delta);
  if (wsKeys['KeyS']) move.addScaledVector(fwd, -speed * delta);
  if (wsKeys['KeyA']) move.addScaledVector(right, -speed * delta);
  if (wsKeys['KeyD']) move.addScaledVector(right, speed * delta);

  playerPos.add(move);

  // ── Collision: main room bounds ──
  const R = 0.3; // player radius

  // X bounds
  playerPos.x = Math.max(-14.7 + R, Math.min(14.7 - R, playerPos.x));

  // Z & X bounds: check corridor states
  const wallZ = BACK_WALL_Z + R + 0.15;
  
  if (playerPos.z < wallZ) {
    // Player is attempting to be past the back wall (in a corridor)
    // Find which corridor they are closest to horizontally
    const closestCorridor = CORRIDORS.reduce((prev, curr) => 
      Math.abs(curr.xCenter - playerPos.x) < Math.abs(prev.xCenter - playerPos.x) ? curr : prev
    );
    
    // Check if they are actually inside the bounds of this closest corridor entrance
    if (playerPos.x >= closestCorridor.xMin + R && playerPos.x <= closestCorridor.xMax - R) {
      // Safe inside corridor: clamp Z to corridor depth limit
      const minZ = BACK_WALL_Z - CORRIDOR_DEPTH + R + 0.1;
      playerPos.z = Math.max(minZ, playerPos.z);
      // Forcibly clamp their X to THIS corridor so they can't slip out sideways
      playerPos.x = Math.max(closestCorridor.xMin + R, Math.min(closestCorridor.xMax - R, playerPos.x));
    } else {
      // Trying to enter wall left/right of the corridor opening
      // Force them back out to simply slide against the main wall
      playerPos.z = wallZ;
    }
  } else {
    // Main room: bounded by front wall as well
    playerPos.z = Math.min(12.7 - R, playerPos.z);
  }

  // ── Collision: Terminals and Decor ──
  const obstacles = [
    // Terminals
    ...TERMINALS.map(td => ({ x: td.x, z: td.z, rx: 1.4, rz: 0.55 })),
    // Server racks
    { x: -11.5, z: -10.5, rx: 1.1, rz: 0.5 },
    { x: 11.5, z: -10.5, rx: 1.1, rz: 0.5 },
    // Filing cabinet
    { x: -13.5, z: 5, rx: 0.425, rz: 0.3 }
  ];

  for (const obs of obstacles) {
    const minX = obs.x - obs.rx;
    const maxX = obs.x + obs.rx;
    const minZ = obs.z - obs.rz;
    const maxZ = obs.z + obs.rz;

    if (playerPos.x + R > minX && playerPos.x - R < maxX &&
        playerPos.z + R > minZ && playerPos.z - R < maxZ) {
      
      const dL = (playerPos.x + R) - minX;
      const dR = maxX - (playerPos.x - R);
      const dT = (playerPos.z + R) - minZ;
      const dB = maxZ - (playerPos.z - R);

      const minT = Math.min(dL, dR, dT, dB);
      if (minT === dL) playerPos.x -= dL;
      else if (minT === dR) playerPos.x += dR;
      else if (minT === dT) playerPos.z -= dT;
      else if (minT === dB) playerPos.z += dB;
    }
  }
}

function checkCorridorTrigger() {
  if (corridorTriggered) return;
  if (playerPos.z > CORRIDOR_TRIGGER_Z) return;

  const corridor = CORRIDORS.find(
    cd => playerPos.x >= cd.xMin && playerPos.x <= cd.xMax,
  );
  if (!corridor) return;

  corridorTriggered = true;
  showLoadingScreen(corridor.cls);
}

// ─── LOADING SCREEN ───────────────────────────────────────────
function showLoadingScreen(cls) {
  // Stop workshop loop without triggering close callback
  active = false;
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  if (wsPointerLocked) document.exitPointerLock();
  wsPointerLocked = false;

  window.removeEventListener('mousemove', _bMM);
  window.removeEventListener('click',     _bMC);
  window.removeEventListener('keydown',   _bKD);
  window.removeEventListener('keyup',     _bKU);
  document.removeEventListener('pointerlockchange', _bPLC);

  const hud = document.getElementById('ws-hud');
  if (hud) hud.style.display = 'none';

  // Build loading screen DOM
  let screen = document.getElementById('ws-loading');
  if (!screen) {
    screen = document.createElement('div');
    screen.id = 'ws-loading';
    document.body.appendChild(screen);
  }
  screen.innerHTML = '';

 const clsLabel = cls.toUpperCase();

 const LOADING_HINTS = [
 'Did you know you can punch by pressing F?',
 'You can punch while reloading. Trust your fists when enemies corner you.',
  'Did you know you can punch by pressing F?',
 'You can punch while reloading. Trust your fists when enemies corner you.',
 'Only you choose who to become. Build your character as a tank or a ninja.',
 'Don\'t forget to unlock upgrades at the Workshop with Gears earned from kills.',
 'Motherboard Fragments are your passive abilities. Once unlocked during a run, they can always be equipped at the Build Terminal.',
 'Each class has its own traits: LMG is fast but fragile, Shotgun is slow but devastating. Rifles offer a balanced playstyle.',
 'Did you know you can create millions of different build combinations using the Terminals?',
 ];

 const hint = LOADING_HINTS[Math.floor(Math.random() * LOADING_HINTS.length)];

 screen.innerHTML = `
 <div id="wsl-inner">
 <div id="wsl-title">MACHINE ARENA</div>
 <div id="wsl-class">LOADING ${clsLabel} LOADOUT</div>
 <div id="wsl-bar-wrap"><div id="wsl-bar"></div></div>
 <div id="wsl-status">INITIALIZING SUBSYSTEMS...</div>
 <div id="wsl-details"></div>
 <div id="wsl-hint">💡 ${hint}</div>
 </div>
 `;
  screen.style.display = 'flex';

  const bar     = document.getElementById('wsl-bar');
  const status  = document.getElementById('wsl-status');
  const details = document.getElementById('wsl-details');

  const STEPS = [
    [0.08, 'LOADING ARENA GEOMETRY...'],
    [0.22, 'COMPILING ENEMY AI...'],
    [0.38, `ARMING ${clsLabel} WEAPON SYSTEMS...`],
    [0.52, 'CALIBRATING WAVE ENGINE...'],
    [0.65, 'APPLYING PERMANENT UPGRADES...'],
    [0.78, 'BOOTSTRAPPING RENDERER...'],
    [0.90, 'DECOMPRESSING AUDIO...'],
    [1.00, 'READY.'],
  ];

  const FLAVOR = [
    '>_SECTOR LOCK ENGAGED',
    '>_CLEARING ENEMY CACHE',
    `>_UNIT: ${clsLabel} [CONFIRMED]`,
    '>_ARENA NODE ONLINE',
    '>_COMMENCING DEPLOYMENT',
  ];

  let stepIdx = 0;
  let flavorIdx = 0;
  const STEP_MS = 220;
  const FLAVOR_MS = 180;

  function addFlavor() {
    if (flavorIdx >= FLAVOR.length) return;
    const line = document.createElement('div');
    line.textContent = FLAVOR[flavorIdx++];
    details.appendChild(line);
    if (details.children.length > 4) details.removeChild(details.children[0]);
    if (flavorIdx < FLAVOR.length) setTimeout(addFlavor, FLAVOR_MS + Math.random() * 80);
  }

  function advanceBar() {
    if (stepIdx >= STEPS.length) {
      // Done — flash then launch
      let flashes = 0;
      const flashInterval = setInterval(() => {
        bar.style.background = flashes % 2 === 0 ? '#00ff55' : '#005522';
        flashes++;
        if (flashes > 5) {
          clearInterval(flashInterval);
          screen.style.display = 'none';
          if (_onSelectClass) _onSelectClass(cls);
        }
      }, 120);
      return;
    }
    const [pct, msg] = STEPS[stepIdx++];
    bar.style.width = (pct * 100) + '%';
    status.textContent = msg;
    setTimeout(advanceBar, STEP_MS + Math.random() * 60);
  }

  setTimeout(addFlavor, 80);
  setTimeout(advanceBar, 100);
}

// ─── MONITOR CANVAS ───────────────────────────────────────────
// Idle mode: terminal name, install count, "APPROACH" hint
// Active mode: full upgrade list with cursor (rendered on screen texture)

function drawMonitor(idx, highlighted, blinkOn) {
  const inRange = (idx === nearTerminalIdx);
  if (inRange) {
    drawMonitorActive(idx);
  } else {
    drawMonitorIdle(idx, highlighted, blinkOn);
  }
}

function drawMonitorIdle(idx, highlighted, blinkOn) {
  const td  = TERMINALS[idx];
  if (td.id === 'build_computer') { drawBuildComputerIdle(idx, highlighted, blinkOn); return; }
  const obj = termObjs[idx];
  if (!obj) return;
  const { canvas, ctx, tex } = obj;
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = '#010d02';
  ctx.fillRect(0, 0, W, H);

  // Scanlines
  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, y + 2, W, 2);
  }

  const r = (td.color >> 16) & 0xff;
  const g = (td.color >> 8)  & 0xff;
  const b = td.color & 0xff;

  // Header bar
  ctx.fillStyle = `rgba(${r},${g},${b},0.22)`;
  ctx.fillRect(0, 0, W, 40);
  ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
  ctx.font = '18px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SYS:READY', 12, 26);
  ctx.textAlign = 'right';
  ctx.fillText(`TERM-${idx + 1}`, W - 12, 26);

  // Terminal label (large)
  ctx.fillStyle = `rgba(${r},${g},${b},1.0)`;
  ctx.font = `bold ${highlighted ? 58 : 52}px monospace`;
  ctx.textAlign = 'center';
  ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
  ctx.shadowBlur  = highlighted ? 28 : 14;
  ctx.fillText(td.label, W / 2, 170);
  ctx.shadowBlur = 0;

  ctx.font = '22px monospace';
  ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
  ctx.fillText(td.sub, W / 2, 208);

  // Divider
  ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 228); ctx.lineTo(W - 30, 228);
  ctx.stroke();

  // Install count
  const upgrades = getUpgradesForId(td.id);
  let installed = 0, total = 0;
  upgrades.forEach(u => {
    total    += u.maxLevel;
    installed += getUpgradeLevel(_meta, u.id);
  });
  ctx.font = '18px monospace';
  ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
  ctx.fillText(`${installed} / ${total} INSTALLED`, W / 2, 262);

  // Blink cursor
  if (blinkOn) {
    ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
    ctx.fillRect(W / 2 - 10, H - 32, 20, 3);
  }

  // "Approach" prompt at bottom
  ctx.fillStyle = `rgba(${r},${g},${b},${highlighted ? 1.0 : 0.5})`;
  ctx.font = `bold ${highlighted ? 20 : 18}px monospace`;
  ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
  ctx.shadowBlur  = highlighted ? 14 : 0;
  ctx.fillText('[ APPROACH TERMINAL ]', W / 2, H - 16);
  ctx.shadowBlur = 0;

  tex.needsUpdate = true;
}

function drawMonitorActive(idx) {
  const td  = TERMINALS[idx];
  if (td.id === 'build_computer') { drawBuildComputerActive(idx); return; }
  const obj = termObjs[idx];
  if (!obj) return;
  const { canvas, ctx, tex } = obj;
  const W = canvas.width, H = canvas.height;

  const r = (td.color >> 16) & 0xff;
  const g = (td.color >> 8)  & 0xff;
  const b = td.color & 0xff;

  ctx.fillStyle = '#000d03';
  ctx.fillRect(0, 0, W, H);

  // Scanlines (subtle)
  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, y + 2, W, 2);
  }

  // Header
  ctx.fillStyle = `rgba(${r},${g},${b},0.20)`;
  ctx.fillRect(0, 0, W, 36);
  ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${td.label} ${td.sub}`, 10, 23);
  ctx.textAlign = 'right';
  ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
  ctx.fillText(`GEARS: ${_meta ? _meta.permanentGears : 0}`, W - 10, 23);

  // Upgrades list
  const upgrades = getUpgradesForId(td.id);

  // Handle abilities terminal specially — show by ability group with a flat cursor
  let allRows = [];
  if (td.id === 'abilities') {
    ABILITY_TYPES.forEach(abType => {
      allRows.push({ header: ABILITY_NAMES[abType] });
      (ABILITY_UPGRADES[abType] || []).forEach(upg => allRows.push({ upg }));
    });
  } else {
    upgrades.forEach(upg => allRows.push({ upg }));
  }

  const cursor = termCursor[idx] || 0;
  // Only count actual upgrade rows (not headers) for cursor clamping
  const upgRowCount = allRows.filter(row => row.upg).length;
  if (upgRowCount > 0) termCursor[idx] = Math.max(0, Math.min(cursor, upgRowCount - 1));

  const LINE_H  = 44;
  const VISIBLE = 7;   // rows visible at once
  // Compute which upgrade-row index maps to cursor
  let upgRowIdx = 0;
  let startScroll = 0;
  allRows.forEach((row, ri) => {
    if (!row.upg) return;
    if (upgRowIdx === termCursor[idx]) startScroll = ri;
    upgRowIdx++;
  });
  // Ensure cursor row is visible
  startScroll = Math.max(0, Math.min(startScroll, allRows.length - VISIBLE));

  const visible = allRows.slice(startScroll, startScroll + VISIBLE);
  let curUpgIdx = 0;  // tracks upgrade rows seen so far (for cursor matching)
  // Pre-count upgrade rows before startScroll for cursor tracking
  let preUpgRows = 0;
  allRows.slice(0, startScroll).forEach(row => { if (row.upg) preUpgRows++; });
  curUpgIdx = preUpgRows;

  const TOP = 44;
  visible.forEach((row, vi) => {
    const yBase = TOP + vi * LINE_H;

    if (row.header) {
      // Section header
      ctx.fillStyle = `rgba(${r},${g},${b},0.35)`;
      ctx.fillRect(6, yBase + 4, W - 12, LINE_H - 8);
      ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`── ${row.header} ──`, W / 2, yBase + 24);
      return;
    }

    const upg     = row.upg;
    const lvl     = getUpgradeLevel(_meta, upg.id);
    const maxed   = lvl >= upg.maxLevel;
    const canBuy  = canPurchaseUpgrade(_meta, upg);
    const cost    = maxed ? 0 : upg.costs[lvl];
    const isSelected = curUpgIdx === termCursor[idx];
    curUpgIdx++;

    // Row background for selected
    if (isSelected) {
      ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
      ctx.fillRect(4, yBase + 2, W - 8, LINE_H - 4);
      ctx.fillStyle = `rgba(${r},${g},${b},0.6)`;
      ctx.fillRect(4, yBase + 2, 3, LINE_H - 4);
    }

    // Name + pips
    ctx.textAlign = 'left';
    let pips = '';
    for (let pi = 0; pi < upg.maxLevel; pi++) pips += pi < lvl ? '▣' : '▢';
    const nameCol = maxed ? `rgba(${r},${g},${b},0.5)` : `rgba(${r},${g},${b},1.0)`;
    ctx.fillStyle = nameCol;
    ctx.font = `bold 14px monospace`;
    if (upg.icon) {
      drawIconOnCanvas(ctx, upg.icon, 18, yBase + 17, 14);
      ctx.fillText(upg.name, 36, yBase + 17);
    } else {
      ctx.fillText(upg.name, 18, yBase + 17);
    }

    ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
    ctx.font = '12px monospace';
    ctx.fillText(pips, 18, yBase + 32);

    // Cost / status (right side)
    ctx.textAlign = 'right';
    if (maxed) {
      ctx.fillStyle = `rgba(${r},${g},${b},0.4)`;
      ctx.font = '11px monospace';
      ctx.fillText('✔ INSTALLED', W - 10, yBase + 17);
    } else if (!canBuy) {
      ctx.fillStyle = 'rgba(200,50,0,0.7)';
      ctx.font = '11px monospace';
      ctx.fillText(upg.requires ? 'LOCKED' : `${cost}G`, W - 10, yBase + 17);
    } else {
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${cost}G`, W - 10, yBase + 17);
      if (isSelected) {
        ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
        ctx.font = 'bold 11px monospace';
        ctx.fillText('[E] BUY', W - 10, yBase + 33);
      }
    }

    // Description (truncated)
    ctx.textAlign = 'left';
    ctx.fillStyle = `rgba(${r},${g},${b},0.4)`;
    ctx.font = '11px monospace';
    const descX = 85; // Fixed offset to clear pips
    const desc = upg.description.length > 38 ? upg.description.slice(0, 36) + '..' : upg.description;
    ctx.fillText(desc, descX, yBase + 32);
    if (isSelected) {
      // Clear description area and show description for selected row
      ctx.fillStyle = `rgba(${r},${g},${b},0.6)`;
      ctx.fillText(upg.description.length > 48 ? upg.description.slice(0, 46) + '..' : upg.description, descX, yBase + 32);
    }
  });

  // Footer
  ctx.fillStyle = `rgba(${r},${g},${b},0.25)`;
  ctx.fillRect(0, H - 28, W, 28);
  ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('↑/↓ NAVIGATE   [ E ] BUY   WALK AWAY TO CLOSE', W / 2, H - 10);

  tex.needsUpdate = true;
}

// ─── BUILD COMPUTER MONITOR ───────────────────────────────────
function drawBuildComputerIdle(idx, highlighted, blinkOn) {
  const td  = TERMINALS[idx];
  const obj = termObjs[idx];
  if (!obj) return;
  const { canvas, ctx, tex } = obj;
  const W = canvas.width, H = canvas.height;
  const [r, g, b] = [0xff, 0x88, 0x00]; // orange

  ctx.fillStyle = '#0d0500';
  ctx.fillRect(0, 0, W, H);
  // Scanlines
  for (let y = 0; y < H; y += 4) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, y + 2, W, 2); }

  // Header
  ctx.fillStyle = 'rgba(255,136,0,0.22)';
  ctx.fillRect(0, 0, W, 40);
  ctx.fillStyle = 'rgba(255,136,0,0.85)';
  ctx.font = '18px monospace'; ctx.textAlign = 'left';
  ctx.fillText('SYS:READY', 12, 26);
  ctx.textAlign = 'right';
  ctx.fillText('TERM-6', W - 12, 26);

  // Label
  ctx.fillStyle = 'rgba(255,136,0,1.0)';
  ctx.font = `bold ${highlighted ? 52 : 46}px monospace`;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255,136,0,0.8)'; ctx.shadowBlur = highlighted ? 28 : 12;
  ctx.fillText('BUILD', W / 2, 160);
  ctx.shadowBlur = 0;
  ctx.font = '22px monospace';
  ctx.fillStyle = 'rgba(255,136,0,0.7)';
  ctx.fillText('STATION', W / 2, 196);

  // Divider
  ctx.strokeStyle = 'rgba(255,136,0,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(30, 216); ctx.lineTo(W - 30, 216); ctx.stroke();

  // Equipped fragment display
  const equipped = _meta ? getEquippedFragment(_meta) : null;
  const fragDef  = equipped ? FRAGMENT_DEFS.find(f => f.id === equipped) : null;
  ctx.font = '16px monospace'; ctx.textAlign = 'center';
  if (fragDef) {
    ctx.fillStyle = 'rgba(255,136,0,0.9)';
    drawIconOnCanvas(ctx, fragDef.icon, W / 2 - 60, 252, 18);
    ctx.fillText(fragDef.name, W / 2 - 30, 252);
    ctx.fillStyle = 'rgba(255,136,0,0.5)'; ctx.font = '13px monospace';
    ctx.fillText('EQUIPPED', W / 2, 272);
  } else {
    ctx.fillStyle = 'rgba(255,136,0,0.4)';
    ctx.fillText('NO FRAGMENT', W / 2, 252);
  }

  if (blinkOn) { ctx.fillStyle = 'rgba(255,136,0,0.9)'; ctx.fillRect(W / 2 - 10, H - 32, 20, 3); }
  ctx.fillStyle = `rgba(255,136,0,${highlighted ? 1.0 : 0.5})`;
  ctx.font = `bold ${highlighted ? 20 : 18}px monospace`;
  ctx.shadowColor = 'rgba(255,136,0,0.8)'; ctx.shadowBlur = highlighted ? 14 : 0;
  ctx.fillText('[ APPROACH TERMINAL ]', W / 2, H - 16);
  ctx.shadowBlur = 0;

  tex.needsUpdate = true;
}

function drawBuildComputerActive(idx) {
  const obj = termObjs[idx];
  if (!obj) return;
  const { canvas, ctx, tex } = obj;
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = '#0d0500';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 4) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(0, y + 2, W, 2); }

  // Header
  ctx.fillStyle = 'rgba(255,136,0,0.18)';
  ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = 'rgba(255,136,0,0.9)';
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left';
  ctx.fillText('BUILD STATION', 10, 22);
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,136,0,0.6)';
  ctx.fillText(`GEARS: ${_meta ? _meta.permanentGears : 0}`, W - 10, 22);

  const cursor = termCursor[idx] || 0;

  // ─── Right-click ability section (cursor row 0) ───────────────
  const isAbilityRow = cursor === 0;
  if (isAbilityRow) {
    ctx.fillStyle = 'rgba(255,136,0,0.13)';
    ctx.fillRect(4, 38, W - 8, 44);
    ctx.fillStyle = 'rgba(255,136,0,0.7)';
    ctx.fillRect(4, 38, 3, 44);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,136,0,0.5)'; ctx.font = 'bold 12px monospace';
  ctx.fillText('─── R-CLICK ABILITY ───', 10, 52);

  const hasChosen  = _meta && getUpgradeLevel(_meta, 'chosen_ability') >= 1;
  const hasRandom  = _meta && getUpgradeLevel(_meta, 'random_ability') >= 1;
  const chosenAb   = _meta?.chosenAbility;
  const canCycle   = hasChosen || hasRandom;

  let abilityText, abilityColor;
  if (canCycle && chosenAb) {
    abilityText  = `▶ ${(ABILITY_NAMES[chosenAb] || chosenAb).toUpperCase()}`;
    abilityColor = 'rgba(255,136,0,1.0)';
  } else if (canCycle) {
    abilityText  = '▶ SELECT WITH [E]';
    abilityColor = 'rgba(255,136,0,0.75)';
  } else {
    abilityText  = '✖ LOCKED — buy SCRAMBLE CHIP';
    abilityColor = 'rgba(180,80,0,0.7)';
  }
  ctx.fillStyle = abilityColor; ctx.font = '13px monospace';
  ctx.fillText(abilityText, 14, 70);
  if (isAbilityRow && canCycle) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,136,0,0.7)'; ctx.font = 'bold 11px monospace';
    ctx.fillText('[E] CYCLE', W - 10, 70);
  }

  // Divider
  ctx.strokeStyle = 'rgba(255,136,0,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(10, 86); ctx.lineTo(W - 10, 86); ctx.stroke();

  // ─── Motherboard Fragments section (cursor rows 1..n) ────────
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,136,0,0.5)'; ctx.font = 'bold 12px monospace';
  ctx.fillText('─── MOTHERBOARD FRAGMENTS ───', 10, 102);

  const equipped = _meta ? getEquippedFragment(_meta) : null;

  const LINE_H  = 42;
  const TOP     = 108;
  const VISIBLE = 6;

  // cursor 0 = ability; cursor 1+ = fragment (fragIdx = cursor - 1)
  const fragCursor  = Math.max(0, cursor - 1);
  const startScroll = Math.max(0, Math.min(fragCursor, FRAGMENT_DEFS.length - VISIBLE));
  const visible     = FRAGMENT_DEFS.slice(startScroll, startScroll + VISIBLE);

  visible.forEach((frag, vi) => {
    const fragIdx    = startScroll + vi;
    const isSelected = cursor > 0 && fragIdx === fragCursor;
    const isEquipped = frag.id === equipped;
    const unlocked   = isFragmentUnlocked(_meta, frag.id);
    const yBase      = TOP + vi * LINE_H;

    // Row bg
    if (isSelected) {
      ctx.fillStyle = 'rgba(255,136,0,0.13)';
      ctx.fillRect(4, yBase + 2, W - 8, LINE_H - 4);
      ctx.fillStyle = 'rgba(255,136,0,0.7)';
      ctx.fillRect(4, yBase + 2, 3, LINE_H - 4);
    }

    // Icon + name
    let nameColor;
    if (!unlocked) {
      nameColor = 'rgba(120,60,0,0.55)';
    } else if (isEquipped) {
      nameColor = 'rgba(255,200,0,1.0)';
    } else if (isSelected) {
      nameColor = 'rgba(255,136,0,1.0)';
    } else {
      nameColor = 'rgba(255,136,0,0.65)';
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = nameColor; ctx.font = 'bold 13px monospace';
    const lockIcon = unlocked ? '' : '[LOCKED] ';
    if (unlocked) {
      drawIconOnCanvas(ctx, frag.icon, 14, yBase + 15, 14);
      ctx.fillText(lockIcon + frag.name, 32, yBase + 15);
    } else {
      ctx.fillText(lockIcon + frag.name, 14, yBase + 15);
    }

    // Right badge
    ctx.textAlign = 'right';
    if (!unlocked) {
      ctx.fillStyle = 'rgba(120,60,0,0.7)'; ctx.font = 'bold 11px monospace';
      ctx.fillText(`WAVE ${frag.unlockWave}`, W - 10, yBase + 15);
    } else if (isEquipped) {
      ctx.fillStyle = 'rgba(255,200,0,0.85)'; ctx.font = 'bold 11px monospace';
      ctx.fillText('[EQUIPPED]', W - 10, yBase + 15);
    } else if (isSelected) {
      ctx.fillStyle = 'rgba(255,136,0,0.75)'; ctx.font = 'bold 11px monospace';
      ctx.fillText('[E] EQUIP', W - 10, yBase + 15);
    }

    // Description
    ctx.textAlign = 'left';
    ctx.fillStyle = (!unlocked) ? 'rgba(120,60,0,0.4)' : (isSelected ? 'rgba(255,136,0,0.75)' : 'rgba(255,136,0,0.35)');
    ctx.font = '11px monospace';
    ctx.fillText(unlocked ? frag.description : 'Complete more waves to unlock', 14, yBase + 30);
  });

  // Footer
  ctx.fillStyle = 'rgba(255,136,0,0.2)'; ctx.fillRect(0, H - 26, W, 26);
  ctx.fillStyle = 'rgba(255,136,0,0.75)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText('↑/↓ SELECT   [ E ] EQUIP / CYCLE ABILITY   WALK AWAY TO CLOSE', W / 2, H - 10);

  tex.needsUpdate = true;
}

function getUpgradesForId(id) {
  if (id === 'universal') return UNIVERSAL_UPGRADES;
  if (id === 'lmg' || id === 'rifle' || id === 'shotgun') return CLASS_UPGRADES[id] || [];
  if (id === 'abilities') return Object.values(ABILITY_UPGRADES).flat();
  if (id === 'build_computer') return []; // handled separately
  return [];
}

function refreshMonitorTextures() {
  termObjs.forEach((_, i) => drawMonitor(i, i === hoveredIdx, false));
}

// ─── PROXIMITY / PRESSURE-PLATE INTERACTION ───────────────────
function updateProximity() {
  let foundIdx = -1;
  TERMINALS.forEach((td, i) => {
    const dx = playerPos.x - td.x;
    const dz = playerPos.z - td.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < PROXIMITY_RANGE) foundIdx = i;
  });

  if (foundIdx !== nearTerminalIdx) {
    const prev = nearTerminalIdx;
    nearTerminalIdx = foundIdx;

    // Redraw the terminals that changed state
    if (prev >= 0) {
      termObjs[prev].light.intensity = 2.5;
      drawMonitor(prev, false, false);
      plateMeshes[prev].opacity = 0.35;
    }
    if (foundIdx >= 0) {
      termObjs[foundIdx].light.intensity = 5.0;
      drawMonitorActive(foundIdx);
      plateMeshes[foundIdx].opacity = 0.80;
    }

    updateHint();
  }
}

// ─── INTERACTION ──────────────────────────────────────────────
function updateHover() {
  // Keep crosshair raycasting for highlighting terminals from a distance
  if (!wsPointerLocked) {
    if (hoveredIdx >= 0) {
      hoveredIdx = -1;
      updateHint();
    }
    return;
  }

  const screens = termObjs.map(t => t.screenMesh);
  raycaster.setFromCamera(CENTER_NDC, cam);
  const hits = raycaster.intersectObjects(screens, false);
  const prev = hoveredIdx;

  if (hits.length > 0 && hits[0].distance < 5.0) {
    hoveredIdx = hits[0].object.userData.terminalIdx;
  } else {
    hoveredIdx = -1;
  }

  if (hoveredIdx !== prev) {
    // Only redraw idle monitors (active ones are handled by proximity)
    if (prev >= 0 && prev !== nearTerminalIdx) {
      termObjs[prev].light.intensity = 2.5;
      drawMonitor(prev, false, false);
    }
    if (hoveredIdx >= 0 && hoveredIdx !== nearTerminalIdx) {
      termObjs[hoveredIdx].light.intensity = 4.0;
      drawMonitor(hoveredIdx, true, false);
    }
    updateHint();
  }
}

function updateHint() {
  const hint = document.getElementById('ws-hint');
  if (!hint) return;
  if (!wsPointerLocked) {
    hint.textContent = 'CLICK TO LOOK AROUND';
  } else if (playerPos.z < -7) {
    hint.textContent = 'WALK INTO CORRIDOR TO SELECT CLASS';
  } else if (nearTerminalIdx >= 0) {
    const isBuildComp = TERMINALS[nearTerminalIdx].id === 'build_computer';
    hint.textContent = isBuildComp
      ? '↑/↓ SELECT   [E] EQUIP FRAGMENT / CYCLE ABILITY  — BUILD STATION ACTIVE'
      : `↑/↓ NAVIGATE  [E] BUY  — ${TERMINALS[nearTerminalIdx].label} TERMINAL ACTIVE`;
  } else if (hoveredIdx >= 0) {
    hint.textContent = `APPROACH ${TERMINALS[hoveredIdx].label} TERMINAL`;
  } else {
    hint.textContent = 'WASD: MOVE  |  LOOK: MOUSE  |  ESC: EXIT';
  }
}

function updateLockHint() {
  updateHint();
  document.body.style.cursor = ''; // Let Pointer Lock and CSS handle it
}

function onMouseClick(e) {
  if (e.button !== 0) return;

  // Don't request pointer lock if a menu is open
  const blocker = document.getElementById('blocker');
  if (blocker && blocker.style.display !== 'none') return;

  const intro = document.getElementById('ws-intro');
  if (intro && intro.style.display === 'flex') return;

  if (!wsPointerLocked) {
    _renderer.domElement.requestPointerLock();
  }
}

function onKeyDown(e) {
  // If a menu is open, let main.js handle the keys
  const blocker = document.getElementById('blocker');
  if (blocker && blocker.style.display !== 'none') return;

  wsKeys[e.code] = true;

  if (e.code === 'Escape') {
    if (wsPointerLocked) {
      document.exitPointerLock();
    } else {
      // If already not pointer locked (e.g. paused), this key might be handled by main.js
      // for resuming, but if we are here and not locked, we could also just close.
      // However, to be consistent with gameplay, let's let the pause menu handle it.
      // If we want a way to still "Hard Exit" without the pause menu, 
      // we could add logic here. For now, let's just exit pointer lock.
      document.exitPointerLock();
    }
    return;
  }

  // Arrow key navigation in active terminal
  if (nearTerminalIdx >= 0) {
    const isBuildComp = TERMINALS[nearTerminalIdx].id === 'build_computer';
    if (e.code === 'ArrowUp') {
      termCursor[nearTerminalIdx] = Math.max(0, (termCursor[nearTerminalIdx] || 0) - 1);
      drawMonitorActive(nearTerminalIdx);
      e.preventDefault();
    } else if (e.code === 'ArrowDown') {
      if (isBuildComp) {
        // cursor 0 = ability row, 1..FRAGMENT_DEFS.length = fragment rows
        termCursor[nearTerminalIdx] = Math.min(FRAGMENT_DEFS.length, (termCursor[nearTerminalIdx] || 0) + 1);
      } else {
        const upgrades = getUpgradesForId(TERMINALS[nearTerminalIdx].id);
        const maxCursor = upgrades.length - 1;
        termCursor[nearTerminalIdx] = Math.min(maxCursor, (termCursor[nearTerminalIdx] || 0) + 1);
      }
      drawMonitorActive(nearTerminalIdx);
      e.preventDefault();
    } else if (e.code === 'KeyE' && wsPointerLocked) {
      if (isBuildComp) {
        const cursor = termCursor[nearTerminalIdx] || 0;
        if (cursor === 0) {
          cycleAbilitySelection(nearTerminalIdx);
        } else {
          equipFragmentFromWorkshop(nearTerminalIdx);
        }
      } else {
        buySelectedUpgrade(nearTerminalIdx);
      }
    }
  }
}

function cycleAbilitySelection(termIdx) {
  if (!_meta) return;
  // Cycle through unlocked abilities in order
  const unlocked = ABILITY_TYPES.filter(ab => {
    // An ability is "unlocked" if the player has at least one upgrade for it,
    // or if they have random_ability or chosen_ability purchased.
    const hasUpgrade = (ABILITY_UPGRADES[ab] || []).some(u => getUpgradeLevel(_meta, u.id) > 0);
    const hasAbilityChip = getUpgradeLevel(_meta, 'random_ability') >= 1 || getUpgradeLevel(_meta, 'chosen_ability') >= 1;
    return hasUpgrade || hasAbilityChip;
  });
  // If no ability upgrades, still allow cycling all abilities if chosen_ability purchased
  const pool = getUpgradeLevel(_meta, 'chosen_ability') >= 1
    ? ABILITY_TYPES
    : (getUpgradeLevel(_meta, 'random_ability') >= 1 ? ABILITY_TYPES : []);
  if (pool.length === 0) return;

  const current = _meta.chosenAbility;
  const idx = pool.indexOf(current);
  const next = pool[(idx + 1) % pool.length];
  _meta.chosenAbility = next;
  // Auto-upgrade to chosen_ability level if random_ability is bought but not chosen_ability
  // (We allow freely changing chosen ability as long as random_ability is purchased)
  saveMeta(_meta);
  drawMonitorActive(termIdx);
}

function equipFragmentFromWorkshop(termIdx) {
  const cursor = termCursor[termIdx] || 0;
  // cursor 0 = ability row, 1+ = fragments (subtract 1 to get fragment index)
  const fragIdx = cursor - 1;
  const frag   = FRAGMENT_DEFS[fragIdx];
  if (!frag || !_meta) return;
  // Check if locked
  if (!isFragmentUnlocked(_meta, frag.id)) return;
  equipFragment(_meta, frag.id);
  // If equipped fragment no longer unlocked or different, update
  drawMonitorActive(termIdx);
}

function buySelectedUpgrade(termIdx) {
  const td      = TERMINALS[termIdx];
  const upgrades = getUpgradesForId(td.id);
  const cursor  = termCursor[termIdx] || 0;

  // Handle flat cursor across the flat list (skipping headers for abilities terminal)
  let allRows = [];
  if (td.id === 'abilities') {
    ABILITY_TYPES.forEach(abType => {
      allRows.push(null);  // header placeholder
      (ABILITY_UPGRADES[abType] || []).forEach(upg => allRows.push(upg));
    });
  } else {
    upgrades.forEach(upg => allRows.push(upg));
  }

  const upgRows = allRows.filter(r => r !== null);
  const upg = upgRows[cursor];
  if (!upg) return;

  if (purchaseUpgrade(_meta, upg)) {
    updateGearsHud();
    drawMonitorActive(termIdx);
  }
}

// ─── GEARS HUD ────────────────────────────────────────────────
function updateGearsHud() {
  const el = document.getElementById('ws-gears');
  if (el) el.textContent = `GEARS: ${_meta ? _meta.permanentGears : 0}`;
}

// ─── HTML ─────────────────────────────────────────────────────
function buildHtml() {
  const style = document.createElement('style');
  style.textContent = WS_CSS;
  document.head.appendChild(style);

  const hud = document.createElement('div');
  hud.id = 'ws-hud';
  hud.innerHTML = `
    <div id="ws-topbar">
      <div id="ws-gears"></div>
      <div id="ws-mode">WORKSHOP ACTIVE</div>
      <div id="ws-exit">EXIT WORKSHOP</div>
    </div>
    <div id="ws-hint">CLICK TO LOOK AROUND</div>
    <div id="ws-cross"></div>
  `;
  document.body.appendChild(hud);
  document.getElementById('ws-exit').addEventListener('click', closeWorkshop);
}

// ─── RENDER LOOP ──────────────────────────────────────────────
function loop() {
  if (!active) return;
  rafId = requestAnimationFrame(loop);

  const delta   = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.getElapsedTime();

  // Flicker lights — keep flicker subtle so room stays bright
  flickLights.forEach(fl => {
    const n     = Math.sin(elapsed * fl.speed + fl.phase);
    const spike = Math.random() < 0.004 ? 0.7 : 1.0;   // rare, mild spike only
    fl.light.intensity = fl.base * (0.82 + 0.18 * n) * spike;
  });

  // Update automatic neon tunnel lights
  neonLoops.forEach(loop => {
    // Check if player is standing in front of corridor or inside it
    if (Math.abs(playerPos.x - loop.cx) < 2.5 && playerPos.z < loop.z + 5.5 && playerPos.z > loop.z - 3) {
      loop.mat.color.lerp(loop.onColor, 0.15); // Turn on rapidly when nearby/entering
    } else {
      loop.mat.color.lerp(loop.offColor, 0.04); // Slowly fade to off
    }
  });

  // Move player (only when locked, no intro overlay)
  const introOpen = (() => { const el = document.getElementById('ws-intro'); return el && el.style.display === 'flex'; })();
  if (wsPointerLocked && !introOpen) {
    updateMovement(delta);
    checkCorridorTrigger();
  }

  // Update camera from player position + yaw/pitch
  cam.position.set(playerPos.x, 1.7, playerPos.z);
  const lookX = cam.position.x - Math.sin(playerYaw) * Math.cos(playerPitch);
  const lookY = cam.position.y + Math.sin(playerPitch);
  const lookZ = cam.position.z - Math.cos(playerYaw) * Math.cos(playerPitch);
  cam.lookAt(lookX, lookY, lookZ);

  // Proximity check (pressure plate + in-world screen activation)
  updateProximity();

  // Crosshair hover (for idle monitors)
  updateHover();

  // Monitor idle blink (only for non-active terminals)
  blinkAccum += delta;
  if (blinkAccum >= BLINK_INTERVAL + Math.random() * 0.6) {
    blinkAccum = 0;
    termObjs.forEach((_, i) => {
      if (i !== nearTerminalIdx) drawMonitor(i, i === hoveredIdx, Math.random() > 0.4);
    });
    // Also refresh the active terminal's texture every blink cycle —
    // ensures any missed initial upload is retried.
    if (nearTerminalIdx >= 0) drawMonitorActive(nearTerminalIdx);
  }

  // Hint screen rotation
  if (hintScreens.length > 0) {
    hintTimer += delta;
    if (hintTimer >= HINT_INTERVAL) {
      hintTimer = 0;
      hintIdx = (hintIdx + 1) % HINT_MESSAGES.length;
      hintScreens.forEach(obj => {
        drawHintScreenCanvas(obj.ctx, hintIdx);
        obj.tex.needsUpdate = true;
      });
    }
  }

  // Render pixelated
  _renderer.setRenderTarget(rt);
  _renderer.render(scene, cam);
  _renderer.setRenderTarget(null);
  _renderer.render(quadScene, quadCam);
}

// ─── CSS ──────────────────────────────────────────────────────
const WS_CSS = `
/* ── Workshop 3D HUD ── */
#ws-hud {
  position: fixed;
  inset: 0;
  z-index: 95;
  pointer-events: none;
  font-family: 'Lucida Console', monospace;
}
#ws-topbar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  height: 48px;
  padding: 8px 12px;
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 10px;
  border: 2px solid rgba(171, 135, 83, 0.7);
  background: linear-gradient(180deg, rgba(18, 11, 8, 0.84) 0%, rgba(9, 7, 6, 0.92) 100%);
  box-shadow: inset 0 0 0 1px rgba(46, 29, 19, 0.95), 0 0 18px rgba(0, 0, 0, 0.55);
}
#ws-gears {
  color: #f2d4a5;
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  text-shadow: 0 1px 0 #000;
}
#ws-mode {
  color: #d1b07e;
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  text-shadow: 0 1px 0 #000;
}
#ws-exit {
  color: #e6b381;
  font-size: 11px;
  letter-spacing: 1px;
  cursor: pointer;
  pointer-events: all;
  border: 1px solid rgba(171, 135, 83, 0.7);
  padding: 7px 10px;
  text-transform: uppercase;
  text-shadow: 0 1px 0 #000;
  background: linear-gradient(180deg, rgba(71, 30, 15, 0.45) 0%, rgba(20, 11, 8, 0.65) 100%);
  transition: color 0.08s, border-color 0.08s, text-shadow 0.08s;
}
#ws-exit:hover {
  color: #f7e2bf;
  border-color: #f4c170;
  text-shadow: 0 0 10px rgba(244, 193, 112, 0.35), 0 1px 0 #000;
}
#ws-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 16px;
  border: 1px solid rgba(171, 135, 83, 0.62);
  background: linear-gradient(180deg, rgba(18, 11, 8, 0.75) 0%, rgba(10, 8, 7, 0.92) 100%);
  color: #d4b586;
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 1px 0 #000;
  animation: ws-hint-pulse 2s ease-in-out infinite;
}
@keyframes ws-hint-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.62; } }
#ws-cross {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border: 2px solid rgba(244, 193, 112, 0.84);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(244, 193, 112, 0.52), 0 0 14px rgba(244, 193, 112, 0.24);
}

/* ── Loading Screen ── */
#ws-loading {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: none;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 50% -20%, rgba(213, 78, 20, 0.2), transparent 55%),
    radial-gradient(circle at 50% 115%, rgba(70, 18, 8, 0.78), transparent 52%),
    linear-gradient(180deg, rgba(10, 8, 7, 0.96) 0%, rgba(5, 4, 4, 0.99) 100%);
  font-family: 'Lucida Console', monospace;
  image-rendering: pixelated;
}
#wsl-inner {
  width: min(92vw, 560px);
  text-align: center;
  border: 3px solid rgba(171, 135, 83, 0.74);
  background: linear-gradient(180deg, rgba(16, 11, 9, 0.95) 0%, rgba(8, 6, 5, 0.98) 100%);
  box-shadow: inset 0 0 0 1px rgba(46, 29, 19, 0.95), 0 20px 34px rgba(0, 0, 0, 0.65);
  padding: 24px 18px 16px;
}
#wsl-title {
  font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  font-size: clamp(30px, 7vw, 54px);
  line-height: 0.95;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 10px;
  color: transparent;
  background: linear-gradient(180deg, #ffebc4 0%, #efb467 28%, #cf622b 56%, #401008 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-stroke: 1px #1e0a05;
  text-shadow: 0 4px 0 rgba(78, 31, 16, 0.8), 0 10px 18px rgba(0, 0, 0, 0.68);
}
#wsl-class {
  font-size: 11px;
  letter-spacing: 2px;
  color: #d4b586;
  text-transform: uppercase;
  text-shadow: 0 1px 0 #000;
  margin-bottom: 16px;
}
#wsl-bar-wrap {
  width: 100%;
  height: 16px;
  border: 1px solid rgba(171, 135, 83, 0.76);
  background: rgba(28, 14, 10, 0.7);
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.82);
  margin-bottom: 12px;
}
#wsl-bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #b72818 0%, #ef6e35 100%);
  box-shadow: 0 0 8px rgba(239, 110, 53, 0.45);
  transition: width 0.18s steps(12);
}
#wsl-status {
  font-size: 10px;
  letter-spacing: 2px;
  color: #e6c18a;
  margin-bottom: 14px;
  min-height: 16px;
  text-transform: uppercase;
}
#wsl-details {
  font-size: 10px;
  color: #9f8666;
  letter-spacing: 1px;
  text-align: left;
  min-height: 70px;
}
#wsl-details div { margin-bottom: 4px; }
#wsl-hint {
 font-size: 11px;
 color: #c9a86c;
 letter-spacing: 0.5px;
 text-align: center;
 margin-top: 14px;
 padding: 10px 12px;
 border-top: 1px solid rgba(171, 135, 83, 0.35);
 line-height: 1.5;
 font-style: italic;
}

/* ── Intro / Controls overlay ── */
#ws-intro {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 4, 4, 0.88);
  font-family: 'Lucida Console', monospace;
  cursor: pointer;
}
#ws-intro-box {
  width: min(92vw, 620px);
  padding: 26px 24px;
  border: 3px solid rgba(171, 135, 83, 0.74);
  background: linear-gradient(180deg, rgba(16, 11, 9, 0.95) 0%, rgba(8, 6, 5, 0.98) 100%);
  box-shadow: inset 0 0 0 1px rgba(46, 29, 19, 0.95), 0 20px 34px rgba(0, 0, 0, 0.65);
}
#ws-intro-title {
  font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
  font-size: clamp(28px, 7vw, 44px);
  line-height: 0.95;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: transparent;
  background: linear-gradient(180deg, #ffebc4 0%, #efb467 28%, #cf622b 56%, #401008 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-stroke: 1px #1e0a05;
  text-shadow: 0 4px 0 rgba(78, 31, 16, 0.8), 0 10px 18px rgba(0, 0, 0, 0.68);
  text-align: center;
  margin-bottom: 8px;
}
#ws-intro-sub {
  text-align: center;
  font-size: 10px;
  letter-spacing: 2px;
  color: #d4b586;
  text-transform: uppercase;
  text-shadow: 0 1px 0 #000;
  margin-bottom: 10px;
}
.ws-intro-sep {
  border-top: 1px solid rgba(171, 135, 83, 0.38);
  margin: 10px 0;
}
.ws-intro-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}
.ws-intro-key {
  min-width: 96px;
  padding: 4px 8px;
  border: 1px solid rgba(171, 135, 83, 0.72);
  background: linear-gradient(180deg, rgba(66, 30, 15, 0.38) 0%, rgba(18, 11, 8, 0.62) 100%);
  color: #f0d0a2;
  font-size: 11px;
  letter-spacing: 1px;
  text-align: center;
  flex-shrink: 0;
  text-shadow: 0 1px 0 #000;
}
.ws-intro-desc {
  color: #caa97a;
  font-size: 11px;
  letter-spacing: 1px;
  text-shadow: 0 1px 0 #000;
}
.ws-intro-hint {
  color: #9f8666;
  font-size: 10px;
  letter-spacing: 1px;
  margin: 5px 0;
  line-height: 1.45;
}
#ws-intro-start {
  text-align: center;
  margin-top: 16px;
  font-size: 11px;
  letter-spacing: 2px;
  color: #f1cb96;
  text-shadow: 0 0 10px rgba(244, 193, 112, 0.3), 0 1px 0 #000;
  animation: ws-hint-pulse 1.4s ease-in-out infinite;
}

@media (max-width: 840px), (max-height: 760px) {
  #ws-topbar {
    grid-template-columns: 1fr;
    height: auto;
    gap: 6px;
  }
  #ws-mode {
    display: none;
  }
  #ws-hint {
    font-size: 10px;
    letter-spacing: 1px;
    padding: 8px 10px;
    white-space: normal;
    text-align: center;
    width: min(92vw, 520px);
  }
  .ws-intro-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
`;
