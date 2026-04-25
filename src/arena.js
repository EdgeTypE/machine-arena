import * as THREE from 'three';

// Premium Industrial Machine Arena
export function createArena(scene) {
  const obstacles = [];
  const walkables = [];
  const solidMeshes = [];
  const jumpPads = [];
  const arenaSize = 40;
  let currentWave = 1;
  const dynamicWalkways = [];
  const dynamicSteps = [];
  let lastSoundTrigger = -1;
  const proximityObjects = [];
  
  const addContours = (mesh, color = 0xaa0000) => {
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
      color: color, 
      transparent: true, 
      opacity: 0 
    }));
    mesh.add(line);
    proximityObjects.push({ mesh: mesh, line: line });
    return line;
  };

  // --- MATERIALS ---
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x666666, // Even lighter
    roughness: 0.3,  // Shinier to catch highlights
    metalness: 0.9,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x333333, // Lighter
    roughness: 0.4,
    metalness: 0.8,
  });

  const emissiveGreenMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x004411, // Even darker forest green
    emissiveIntensity: 1.2,
  });

  const hazardMat = createHazardMaterial();

  // --- FLOOR SYSTEM ---
  // Create a modular grid of industrial plates
  const plateSize = 10;
  const gridCount = 8; // 8x8 = 80x80 total
  
  const plateGeo = new THREE.BoxGeometry(plateSize - 0.1, 0.4, plateSize - 0.1);
  const floorGroup = new THREE.Group();

  for (let x = -gridCount/2; x < gridCount/2; x++) {
    for (let z = -gridCount/2; z < gridCount/2; z++) {
      const posX = x * plateSize + plateSize/2;
      const posZ = z * plateSize + plateSize/2;
      
      // Randomly vary height slightly for "rugged" look
      const hOffset = Math.random() * 0.05;
      
      // Determine plate type
      let mat = metalMat;
      const isCenter = Math.abs(x) <= 1 && Math.abs(z) <= 1;
      const isEdge = Math.abs(x) >= gridCount/2 - 1 || Math.abs(z) >= gridCount/2 - 1;

      if (isCenter) {
        // Special center core plates
        mat = darkMetalMat;
      }

      const plate = new THREE.Mesh(plateGeo, mat);
      plate.position.set(posX, -0.2 + hOffset, posZ);
      plate.receiveShadow = true;
      floorGroup.add(plate);
      
      // Add emissive "lines" between some plates
      if (Math.random() > 0.7) {
        const lineGeo = new THREE.BoxGeometry(plateSize, 0.15, 0.15);
        const line = new THREE.Mesh(lineGeo, emissiveGreenMat);
        line.position.set(posX, 0.015, posZ + plateSize/2);
        floorGroup.add(line);
      }
    }
  }
  scene.add(floorGroup);
  solidMeshes.push(floorGroup); // Raycast against floor group

  // --- GRID HELPER (Restored) ---
  const gridHelper = new THREE.GridHelper(80, 20, 0x00ff44, 0x004411);
  gridHelper.position.y = 0.05;
  scene.add(gridHelper);

  // --- WALL SYSTEM (Octagonal) ---
  const wallHeight = 12;
  const wallThickness = 2;
  
  // 4 Main Walls
  const mainWallPositions = [
    { x: 0, z: -arenaSize, r: 0 },
    { x: 0, z: arenaSize, r: 0 },
    { x: -arenaSize, z: 0, r: Math.PI / 2 },
    { x: arenaSize, z: 0, r: Math.PI / 2 },
  ];

  mainWallPositions.forEach(wp => {
    const wallGeo = new THREE.BoxGeometry(arenaSize * 1.5, wallHeight, wallThickness);
    const wall = new THREE.Mesh(wallGeo, darkMetalMat);
    wall.position.set(wp.x, wallHeight / 2, wp.z);
    wall.rotation.y = wp.r;
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    solidMeshes.push(wall);
    addContours(wall, 0x00ff44);
    
    // Add decorative buttresses
    for (let i = -1; i <= 1; i++) {
      if (i === 0) continue;
      const bGeo = new THREE.BoxGeometry(2, wallHeight + 2, 3);
      const b = new THREE.Mesh(bGeo, metalMat);
      const bx = wp.r === 0 ? wp.x + i * 20 : wp.x;
      const bz = wp.r === 0 ? wp.z : wp.z + i * 20;
      b.position.set(bx, (wallHeight + 2) / 2, bz);
      b.rotation.y = wp.r;
      scene.add(b);
      solidMeshes.push(b);
      addContours(b, 0x00ff44);
      
      // Add blue light strip on buttress
      const stripGeo = new THREE.BoxGeometry(0.2, wallHeight, 0.1);
      const strip = new THREE.Mesh(stripGeo, emissiveGreenMat);
      strip.position.set(
        wp.r === 0 ? bx : bx + (wp.x < 0 ? 1.55 : -1.55),
        wallHeight / 2,
        wp.r === 0 ? bz + (wp.z < 0 ? 1.55 : -1.55) : bz
      );
      strip.rotation.y = wp.r;
      scene.add(strip);
    }
  });

  // 4 Corner "Buttress" Walls to create octagonal feel
  const cornerSize = 20;
  const corners = [
    { x: -arenaSize + 5, z: -arenaSize + 5, r: Math.PI / 4 },
    { x: arenaSize - 5, z: -arenaSize + 5, r: -Math.PI / 4 },
    { x: -arenaSize + 5, z: arenaSize - 5, r: -Math.PI / 4 },
    { x: arenaSize - 5, z: arenaSize - 5, r: Math.PI / 4 },
  ];

  corners.forEach(c => {
    const wallGeo = new THREE.BoxGeometry(cornerSize, wallHeight, wallThickness);
    const wall = new THREE.Mesh(wallGeo, darkMetalMat);
    wall.position.set(c.x, wallHeight / 2, c.z);
    wall.rotation.y = c.r;
    scene.add(wall);
    solidMeshes.push(wall);
    addContours(wall, 0x00ff44);

    // Add to obstacles (approximate rotated walls with AABBs for collision)
    // For 45 deg walls, an AABB of ~70% size is a decent approximation
    const aabbSize = cornerSize * 0.707; 
    obstacles.push({
      min: new THREE.Vector2(c.x - aabbSize/2, c.z - aabbSize/2),
      max: new THREE.Vector2(c.x + aabbSize/2, c.z + aabbSize/2),
      height: wallHeight
    });
  });

  // --- VERTICALITY: Peripheral Walkways ---
  const walkwayHeight = 5;
  const walkwayWidth = 6;
  
  const walkwayPositions = [
    { x: -arenaSize + 4, z: 0, w: walkwayWidth, d: 40 },
    { x: arenaSize - 4, z: 0, w: walkwayWidth, d: 40 },
    { x: 0, z: -arenaSize + 4, w: 40, d: walkwayWidth },
    { x: 0, z: arenaSize - 4, w: 40, d: walkwayWidth },
  ];

  walkwayPositions.forEach(wp => {
    const wGeo = new THREE.BoxGeometry(wp.w, 0.5, wp.d);
    const walkway = new THREE.Mesh(wGeo, metalMat);
    walkway.position.set(wp.x, walkwayHeight, wp.z);
    walkway.receiveShadow = true;
    scene.add(walkway);
    solidMeshes.push(walkway);
    addContours(walkway, 0x00ff44);
    
    // Support pillars for walkway
    for (let i = -1; i <= 1; i++) {
        const pGeo = new THREE.BoxGeometry(1, walkwayHeight, 1);
        const p = new THREE.Mesh(pGeo, darkMetalMat);
        const px = wp.w > wp.d ? wp.x + i * 15 : wp.x;
        const pz = wp.w > wp.d ? wp.z : wp.z + i * 15;
        p.position.set(px, walkwayHeight / 2, pz);
        scene.add(p);
        
        obstacles.push({
            min: new THREE.Vector2(px - 0.5, pz - 0.5),
            max: new THREE.Vector2(px + 0.5, pz + 0.5),
            height: walkwayHeight
        });
    }

    // Register as walkable
    const wRef = {
      x: wp.x, z: wp.z, w: wp.w, d: wp.d, topY: walkwayHeight, mesh: walkway
    };
    walkables.push(wRef);

    // Add glowing edges to walkways
    const edgeGeo = new THREE.BoxGeometry(wp.w + 0.1, 0.1, wp.d + 0.1);
    const edge = new THREE.Mesh(edgeGeo, emissiveGreenMat);
    edge.position.set(wp.x, walkwayHeight + 0.05, wp.z);
    scene.add(edge);

    // Dynamic Tracking for sliding
    const wData = { 
      mesh: walkway, 
      edge: edge, 
      initial: { x: wp.x, z: wp.z }, 
      axis: Math.abs(wp.x) > Math.abs(wp.z) ? 'x' : 'z',
      walkable: wRef
    };
    dynamicWalkways.push(wData);

    // Wall Floodlights
    const flood = new THREE.PointLight(0x00ff88, 3, 25);
    flood.position.set(wp.x, walkwayHeight + 2, wp.z);
    scene.add(flood);
  });

  // --- PARKOUR: Jumping Platforms to walkways ---
  const platformWidth = 3.5;
  const platformDepth = 3.5;
  const parkourStarts = [
    { x: -arenaSize + 12, z: 25, side: 'left' },
    { x: arenaSize - 12, z: -25, side: 'right' },
  ];

  parkourStarts.forEach(start => {
    // We create 3 intermediate steps leading to the 5.0m walkway
    const steps = [
      { y: 1.4, offset: 0 },
      { y: 2.8, offset: 4.5 },
      { y: 4.2, offset: 9 },
    ];

    steps.forEach((step, i) => {
      const pGeo = new THREE.BoxGeometry(platformWidth, 0.4, platformDepth);
      const p = new THREE.Mesh(pGeo, metalMat);
      
      const px = start.x;
      const pz = start.side === 'left' ? start.z - step.offset : start.z + step.offset;
      
      p.position.set(px, step.y, pz);
      scene.add(p);
      solidMeshes.push(p);
      addContours(p, 0x00ff44);

      // Register as walkable
      const stepRef = {
        x: px, z: pz, w: platformWidth, d: platformDepth, topY: step.y, mesh: p
      };
      walkables.push(stepRef);

      // Add glowing edges for visibility
      const pEdgeGeo = new THREE.BoxGeometry(platformWidth + 0.1, 0.1, platformDepth + 0.1);
      const pEdge = new THREE.Mesh(pEdgeGeo, emissiveGreenMat);
      pEdge.position.set(px, step.y + 0.05, pz);
      scene.add(pEdge);

      // Dynamic Tracking for tilting
      const sData = {
        mesh: p,
        edge: pEdge,
        initial: { x: px, y: step.y, z: pz },
        walkable: stepRef,
        delay: i * 0.4 // Stagger delay
      };
      dynamicSteps.push(sData);
    });
  });

  // --- OBSTACLES: Machine Blocks ---
  const machineBlocks = [
    { x: -15, z: -15, w: 4, d: 4, h: 6 },
    { x: 15, z: -15, w: 4, d: 4, h: 4 },
    { x: -15, z: 15, w: 4, d: 4, h: 4 },
    { x: 15, z: 15, w: 4, d: 4, h: 6 },
    { x: 0, z: 20, w: 8, d: 3, h: 3 },
    { x: 0, z: -20, w: 8, d: 3, h: 3 },
  ];

  machineBlocks.forEach(mb => {
    const blockGeo = new THREE.BoxGeometry(mb.w, mb.h, mb.d);
    const block = new THREE.Mesh(blockGeo, metalMat);
    block.position.set(mb.x, mb.h / 2, mb.z);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
    solidMeshes.push(block);
    addContours(block, 0x00ff44);
    
    // Add hazard stripes at the base
    const stripeGeo = new THREE.BoxGeometry(mb.w + 0.1, 0.5, mb.d + 0.1);
    const stripe = new THREE.Mesh(stripeGeo, hazardMat);
    stripe.position.set(mb.x, 0.25, mb.z);
    scene.add(stripe);

    obstacles.push({
      min: new THREE.Vector2(mb.x - mb.w / 2, mb.z - mb.d / 2),
      max: new THREE.Vector2(mb.x + mb.w / 2, mb.z + mb.d / 2),
      height: mb.h,
    });
    
    walkables.push({ x: mb.x, z: mb.z, w: mb.w, d: mb.d, topY: mb.h, mesh: block });
  });

  // --- MEGA-STRUCTURES (Background) ---
  addMegaStructures(scene);

  // --- TROLL MESSAGES (Outside the walls) ---
  addTrollMessages(scene, arenaSize);

  // --- DYNAMIC ELEMENTS: Spinning Fans ---
  const fanPositions = [
    { x: -38, z: -20, r: Math.PI/2 },
    { x: 38, z: 20, r: -Math.PI/2 },
  ];
  const fans = [];
  fanPositions.forEach(fp => {
    const fanGroup = createFanUnit();
    fanGroup.position.set(fp.x, 6, fp.z);
    fanGroup.rotation.y = fp.r;
    scene.add(fanGroup);
    fans.push(fanGroup.userData.blade);
  });

  // --- FLOOR VENTS (for steam) ---
  const ventGeo = new THREE.BoxGeometry(4, 0.1, 4);
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1, roughness: 0.2 });
  const ventPositions = [
    { x: -35, z: -35 }, { x: 35, z: -35 },
    { x: -35, z: 35 },  { x: 35, z: 35 }
  ];
  const floorVents = [];
  ventPositions.forEach(vp => {
    const vent = new THREE.Mesh(ventGeo, ventMat);
    vent.position.set(vp.x, 0.05, vp.z);
    scene.add(vent);
    floorVents.push(vent);
  });

  // --- PREMIUM UPGRADES ---
  // 1. Core Energy Vortex (Holographic Rings)
  const vortexGroup = new THREE.Group();
  const ring1Geo = new THREE.TorusGeometry(6, 0.05, 16, 100);
  const ring2Geo = new THREE.TorusGeometry(7.5, 0.05, 16, 100);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x003311, transparent: true, opacity: 0.25 });
  const r1 = new THREE.Mesh(ring1Geo, ringMat);
  const r2 = new THREE.Mesh(ring2Geo, ringMat);
  r1.rotation.x = Math.PI / 2;
  r2.rotation.x = Math.PI / 2;
  r2.rotation.y = Math.PI / 4;
  vortexGroup.add(r1, r2);
  vortexGroup.position.set(0, 5, 0);
  scene.add(vortexGroup);

  // 2. Atmospheric Light Shafts (God Rays)
  const shaftMat = new THREE.MeshBasicMaterial({ 
    color: 0x003311, 
    transparent: true, 
    opacity: 0.05, 
    side: THREE.DoubleSide,
    depthWrite: false 
  });
  for (let i = 0; i < 4; i++) {
    const shaftGeo = new THREE.CylinderGeometry(2, 5, 40, 16, 1, true);
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    const angle = (i / 4) * Math.PI * 2;
    shaft.position.set(Math.cos(angle) * 30, 20, Math.sin(angle) * 30);
    shaft.rotation.x = Math.PI / 12; // tilt slightly
    scene.add(shaft);
  }

  // --- JUMP PADS ---
  const jumpPadPositions = [
    { x: -25, z: -25 }, { x: 25, z: -25 },
    { x: -25, z: 25 },  { x: 25, z: 25 },
    { x: 0,   z: 0 },
  ];
  const padBaseMat = new THREE.MeshStandardMaterial({ color: 0x111133, metalness: 0.8, roughness: 0.2 });
  const padActiveMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

  jumpPadPositions.forEach(jp => {
    const padGroup = new THREE.Group();
    const baseGeo = new THREE.CylinderGeometry(1.5, 1.8, 0.3, 16);
    const base = new THREE.Mesh(baseGeo, padBaseMat);
    padGroup.add(base);

    const ringGeo = new THREE.TorusGeometry(1.2, 0.1, 8, 24);
    const ring = new THREE.Mesh(ringGeo, padActiveMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    padGroup.add(ring);

    padGroup.position.set(jp.x, 0.15, jp.z);
    padGroup.visible = false; // hidden until wave 5
    scene.add(padGroup);
    jumpPads.push({ x: jp.x, z: jp.z, radius: 1.5, mesh: padGroup });
  });

  // --- LIGHTING ---
  const ambientLight = new THREE.AmbientLight(0x667799, 1.2); // Further increased
  scene.add(ambientLight);

  const centralCoreLight = new THREE.PointLight(0x00ff88, 5, 80); // Greener and stronger
  centralCoreLight.position.set(0, 20, 0);
  scene.add(centralCoreLight);
  
  const pointLight1 = new THREE.PointLight(0xff4422, 4, 60);
  pointLight1.position.set(-30, 10, -30);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x00ffcc, 4, 60);
  pointLight2.position.set(30, 10, 30);
  scene.add(pointLight2);

  const dirLight = new THREE.DirectionalLight(0xaaaaff, 1.5);
  dirLight.position.set(50, 100, 50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -60;
  dirLight.shadow.camera.right = 60;
  dirLight.shadow.camera.top = 60;
  dirLight.shadow.camera.bottom = -60;
  scene.add(dirLight);

  // Fog & Background
  scene.fog = new THREE.FogExp2(0x0d111a, 0.008); // Even thinner fog
  scene.background = new THREE.Color(0x0d111a);

  // --- DYNAMIC AESTHETICS EVOLUTION ---
  const updateArenaAesthetics = (wave) => {
    currentWave = wave;
    const isGrungy = wave >= 5;
    if (isGrungy) {
      // Transition to Grungy: Brownish/Rusty tones
      metalMat.color.setHex(0x5d4037);
      metalMat.roughness = 0.8;
      darkMetalMat.color.setHex(0x3e2723);
      darkMetalMat.roughness = 0.9;
      emissiveGreenMat.emissive.setHex(0xff4400); // Shift to Warning Orange/Red
      ringMat.color.setHex(0xff3300);
      shaftMat.color.setHex(0xff3300);
    } else {
      // Transition to Clean: Cyan/Gray tones
      metalMat.color.setHex(0x666666);
      metalMat.roughness = 0.3;
      darkMetalMat.color.setHex(0x333333);
      darkMetalMat.roughness = 0.4;
      emissiveGreenMat.emissive.setHex(0x004411);
      ringMat.color.setHex(0x003311);
      shaftMat.color.setHex(0x003311);
    }
  };

  // Expose to window for main.js to call
  window.updateArenaAesthetics = updateArenaAesthetics;

  // Animation hook
  const fanUpdate = (t) => {
    const now = performance.now();
    fans.forEach(f => { f.rotation.z += 0.1; });
    
    // --- MECHANICAL WAVE LOGIC (Retraction) ---
    const cycleTime = 12000; // 12 seconds per cycle
    const cyclePos = now % cycleTime;
    const isRetractingPhase = cyclePos > 6000;
    
    // SFX Triggers
    if (window.gameSFX) {
      if (cyclePos > 5000 && cyclePos < 6000 && lastSoundTrigger !== 1) {
        window.gameSFX.playArenaWarningSound();
        lastSoundTrigger = 1;
      } else if (cyclePos > 6000 && cyclePos < 7000 && lastSoundTrigger !== 2) {
        window.gameSFX.playArenaMoveSound();
        lastSoundTrigger = 2;
      } else if (cyclePos > 11500 && lastSoundTrigger !== 3) {
        // Warning sound for return
        window.gameSFX.playArenaWarningSound();
        lastSoundTrigger = 3;
      } else if (cyclePos > 0 && cyclePos < 1000 && lastSoundTrigger === 3) {
        // Reset for next cycle
        lastSoundTrigger = 0;
      }
    }

    // Animate Parkour Steps (Move vertically)
    dynamicSteps.forEach((s, idx) => {
      // Use cyclePos to determine vertical offset
      // No stagger for "all move at same time"
      const t = Math.max(0, Math.min(1, (cyclePos - 6000) / 1000)); // 1s transition
      const reverseT = Math.max(0, Math.min(1, cyclePos / 1000));
      
      let verticalOffset = 0;
      if (isRetractingPhase) {
        verticalOffset = t * 6; // Move 6 units down
      } else {
        verticalOffset = (1 - reverseT) * 6;
      }
      
      s.mesh.position.y = s.initial.y - verticalOffset;
      s.edge.position.y = s.initial.y - verticalOffset + 0.05;
      
      // Update collision: Disable if too low
      s.walkable.topY = s.initial.y - verticalOffset;
      if (s.walkable.topY < -2) {
        s.walkable.topY = -10; // Out of reach
      }

      // Visual Warning
      if (cyclePos > 5000 && cyclePos < 6000) {
        s.edge.material.emissive.setHex(0xff0000); // Red warning
      } else {
        s.edge.material.emissive.setHex(0x00ff44); // Regular green
      }
    });

    // Animate Walkways (Slide out of walls horizontally, inverse to steps)
    dynamicWalkways.forEach((w, idx) => {
      // Adjusted timing: Walkways start sliding OUT at 4500ms (1.5s before steps retract at 6000ms)
      // This ensures they are fully out when steps start to go down.
      
      const t = Math.max(0, Math.min(1, (cyclePos - 4500) / 1500)); // Slide OUT starts at 4500ms
      const returnT = Math.max(0, Math.min(1, (cyclePos - 11000) / 1000)); // Quick retract at the very end
      
      let slide = 0;
      if (cyclePos > 4500 && cyclePos < 11000) {
        // Sliding OUT / STAYING OUT phase
        slide = (1 - t) * 16;
      } else if (cyclePos >= 11000) {
        // Return to wall at the end of cycle
        slide = returnT * 16;
      } else {
        // Default: IN the wall
        slide = 16;
      }

      if (w.axis === 'x') {
        const offset = w.initial.x > 0 ? slide : -slide;
        w.mesh.position.x = w.initial.x + offset;
        w.edge.position.x = w.initial.x + offset;
        w.walkable.x = w.initial.x + offset;
      } else {
        const offset = w.initial.z > 0 ? slide : -slide;
        w.mesh.position.z = w.initial.z + offset;
        w.edge.position.z = w.initial.z + offset;
        w.walkable.z = w.initial.z + offset;
      }

      // Reset Y position to walkwayHeight (just in case)
      w.mesh.position.y = walkwayHeight;
      w.edge.position.y = walkwayHeight + 0.05;
      w.walkable.topY = walkwayHeight;

      // Update collision: Disable if retracted too far
      if (slide > 4) {
        w.walkable.topY = -10; // Out of reach
      }

      // Sync Warning color
      if ((cyclePos > 11000 && cyclePos < 12000) || (cyclePos > 5000 && cyclePos < 6000)) {
        w.edge.material.emissive.setHex(0xff0000);
      } else {
        w.edge.material.emissive.setHex(0x00ff44);
      }
    });

    // Animate Core Vortex
    r1.rotation.z += 0.01;
    r2.rotation.z -= 0.015;
    r2.rotation.x += 0.005;
    
    // Core Pulse
    centralCoreLight.intensity = 4 + Math.sin(now * 0.003) * 1.5;

    // Particles (Steam & Sparks) at Wave 5+
    if (currentWave >= 5 && window.particleSystem) {
      // Steam from vents
      if (Math.random() > 0.8) {
        const vent = floorVents[Math.floor(Math.random() * floorVents.length)];
        window.particleSystem.emit(
          vent.position.clone().add(new THREE.Vector3((Math.random()-0.5)*2, 0, (Math.random()-0.5)*2)),
          0x888888,
          3
        );
      }
      // Sparks from core
      if (Math.random() > 0.95) {
        window.particleSystem.emit(new THREE.Vector3(0, 5, 0), 0xffaa00, 5);
      }
    }

    // Reactive Floor logic & Proximity Contours
    const playerPos = scene.children.find(c => c.isCamera)?.position || new THREE.Vector3();
    
    proximityObjects.forEach(obj => {
      const dist = obj.mesh.position.distanceTo(playerPos);
      const maxDist = 22;
      const minDist = 4;
      let opacity = 0;
      if (dist < minDist) opacity = 1.0;
      else if (dist < maxDist) opacity = 1.0 - (dist - minDist) / (maxDist - minDist);
      
      obj.line.material.opacity = opacity;
    });

    floorGroup.children.forEach(plate => {
      const dist = plate.position.distanceTo(playerPos);
      if (dist < 8) {
        plate.material.emissiveIntensity = 0.5 + (1 - dist / 8) * 1.0;
      } else {
        plate.material.emissiveIntensity = 0;
      }
    });
  };
  
  // Inject into global update loop if possible
  if (window.gameUpdateHooks) {
    window.gameUpdateHooks.push(fanUpdate);
  } else {
    const animate = () => {
      fanUpdate();
      requestAnimationFrame(animate);
    };
    animate();
  }

  return { obstacles, arenaSize, ambientLight, pointLight1, pointLight2, centralCoreLight, solidMeshes, walkables, jumpPads, updateArenaAesthetics };
}

function createHazardMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(0, 0, 64, 64);
  
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(32, 0);
  ctx.lineTo(64, 32);
  ctx.lineTo(64, 64);
  ctx.lineTo(32, 64);
  ctx.lineTo(0, 32);
  ctx.closePath();
  ctx.fill();
  
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.8,
    metalness: 0.2
  });
}

function createFanUnit() {
  const group = new THREE.Group();
  const housingGeo = new THREE.CylinderGeometry(4, 4, 1.5, 16);
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.9, roughness: 0.1 });
  const housing = new THREE.Mesh(housingGeo, housingMat);
  housing.rotation.x = Math.PI / 2;
  group.add(housing);
  
  const bladeGroup = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(0.5, 7.5, 0.1);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 1.0, roughness: 0.0 });
  
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(bladeGeo, bladeMat);
    b.rotation.z = (i / 4) * Math.PI * 2;
    bladeGroup.add(b);
  }
  bladeGroup.position.z = 0.5;
  group.add(bladeGroup);
  group.userData.blade = bladeGroup;
  
  return group;
}

function addMegaStructures(scene) {
  // --- SHARED MATERIALS ---
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 0.85, metalness: 0.2 });
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x0c0c18, roughness: 0.7, metalness: 0.3 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x151520, roughness: 0.95, metalness: 0.05 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.4, metalness: 0.8 });
  const glowRedMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.9 });
  const glowOrangeMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 });
  const glowCyanMat = new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.4 });
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
  const scanBeamMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false });

  // Seeded random for consistency
  const sr = (seed) => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; };
  const rng = sr(42);

  // ===== 1. THE CITADEL - Massive focal tower =====
  const citadelGroup = new THREE.Group();
  // Main spire
  const spireGeo = new THREE.CylinderGeometry(6, 18, 350, 8);
  citadelGroup.add(new THREE.Mesh(spireGeo, darkMat));
  // Citadel core ring
  const coreRingGeo = new THREE.TorusGeometry(22, 2, 8, 24);
  const coreRing = new THREE.Mesh(coreRingGeo, pipeMat);
  coreRing.position.y = 80; coreRing.rotation.x = Math.PI / 2;
  citadelGroup.add(coreRing);
  // Upper ring
  const upperRing = new THREE.Mesh(new THREE.TorusGeometry(14, 1.5, 8, 24), pipeMat);
  upperRing.position.y = 160; upperRing.rotation.x = Math.PI / 2;
  citadelGroup.add(upperRing);
  // Citadel antenna
  const antennaGeo = new THREE.CylinderGeometry(0.5, 1.5, 60, 6);
  const antenna = new THREE.Mesh(antennaGeo, pipeMat);
  antenna.position.y = 200;
  citadelGroup.add(antenna);
  // Glowing apex
  const apexGeo = new THREE.SphereGeometry(3, 8, 8);
  const apex = new THREE.Mesh(apexGeo, glowRedMat);
  apex.position.y = 230;
  citadelGroup.add(apex);
  // Apex point light
  const apexLight = new THREE.PointLight(0xff3300, 8, 300);
  apexLight.position.y = 230;
  citadelGroup.add(apexLight);
  // Citadel buttresses (4 angled supports)
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const buttGeo = new THREE.BoxGeometry(4, 120, 4);
    const butt = new THREE.Mesh(buttGeo, darkMat);
    butt.position.set(Math.cos(ang) * 16, 30, Math.sin(ang) * 16);
    butt.rotation.z = (Math.cos(ang) > 0 ? -1 : 1) * 0.15;
    butt.rotation.x = (Math.sin(ang) > 0 ? -1 : 1) * 0.15;
    citadelGroup.add(butt);
  }
  // Base platform
  const basePlatGeo = new THREE.CylinderGeometry(30, 35, 15, 8);
  const basePlat = new THREE.Mesh(basePlatGeo, concreteMat);
  basePlat.position.y = -168;
  citadelGroup.add(basePlat);

  citadelGroup.position.set(0, 175, -280);
  scene.add(citadelGroup);

  // ===== 2. CITY BUILDINGS - Dense dystopian skyline =====
  const buildingConfigs = [];
  // Generate buildings in rings around the arena
  for (let ring = 0; ring < 3; ring++) {
    const baseDist = 70 + ring * 45;
    const count = 16 + ring * 8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.3;
      const dist = baseDist + rng() * 30;
      const w = 6 + rng() * 14;
      const d = 6 + rng() * 14;
      const h = 20 + rng() * 80 + ring * 15;
      buildingConfigs.push({ x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, w, d, h });
    }
  }

  buildingConfigs.forEach(b => {
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const mesh = new THREE.Mesh(geo, rng() > 0.5 ? buildingMat : concreteMat);
    mesh.position.set(b.x, b.h / 2 - 5, b.z);
    scene.add(mesh);

    // Random window lights (small emissive dots on faces)
    if (rng() > 0.4) {
      const windowRows = Math.floor(b.h / 8);
      for (let row = 0; row < Math.min(windowRows, 6); row++) {
        const wGeo = new THREE.BoxGeometry(b.w + 0.1, 0.8, 0.8);
        const wMat = rng() > 0.6 ? glowOrangeMat : glowCyanMat;
        const wMesh = new THREE.Mesh(wGeo, wMat);
        wMesh.position.set(b.x, row * 8 + 5, b.z + b.d / 2 + 0.1);
        scene.add(wMesh);
      }
    }

    // Rooftop antenna or structure on tall buildings
    if (b.h > 60 && rng() > 0.5) {
      const aGeo = new THREE.CylinderGeometry(0.3, 0.3, 15, 4);
      const aMesh = new THREE.Mesh(aGeo, pipeMat);
      aMesh.position.set(b.x, b.h + 2, b.z);
      scene.add(aMesh);
      // Blinking light on top
      const blinkGeo = new THREE.SphereGeometry(0.6, 6, 6);
      const blink = new THREE.Mesh(blinkGeo, glowRedMat);
      blink.position.set(b.x, b.h + 10, b.z);
      scene.add(blink);
    }
  });

  // ===== 3. INDUSTRIAL SMOKESTACKS =====
  const stackPositions = [
    { x: -100, z: -130 }, { x: 130, z: -90 }, { x: -140, z: 80 },
    { x: 90, z: 140 }, { x: -60, z: -170 }, { x: 170, z: 60 },
  ];
  stackPositions.forEach(sp => {
    const h = 60 + rng() * 50;
    // Main chimney
    const chimGeo = new THREE.CylinderGeometry(4, 6, h, 8);
    const chim = new THREE.Mesh(chimGeo, concreteMat);
    chim.position.set(sp.x, h / 2, sp.z);
    scene.add(chim);
    // Top rim
    const rimGeo = new THREE.TorusGeometry(5, 1, 8, 12);
    const rim = new THREE.Mesh(rimGeo, pipeMat);
    rim.position.set(sp.x, h, sp.z);
    rim.rotation.x = Math.PI / 2;
    scene.add(rim);
    // Inner glow (fire)
    const fireGeo = new THREE.CylinderGeometry(3, 3, 2, 8);
    const fire = new THREE.Mesh(fireGeo, glowOrangeMat);
    fire.position.set(sp.x, h - 1, sp.z);
    scene.add(fire);
    // Light from stack
    const sLight = new THREE.PointLight(0xff4400, 3, 50);
    sLight.position.set(sp.x, h + 5, sp.z);
    scene.add(sLight);
  });

  // ===== 4. SUPPRESSOR TOWERS =====
  const suppressorPositions = [
    { x: -80, z: -80 }, { x: 80, z: -80 }, { x: -80, z: 80 }, { x: 80, z: 80 },
    { x: 0, z: -120 }, { x: 0, z: 120 }, { x: -120, z: 0 }, { x: 120, z: 0 },
  ];
  suppressorPositions.forEach(sp => {
    const h = 40 + rng() * 30;
    // Thin tower shaft
    const shaftGeo = new THREE.CylinderGeometry(1.5, 2.5, h, 6);
    const shaft = new THREE.Mesh(shaftGeo, darkMat);
    shaft.position.set(sp.x, h / 2, sp.z);
    scene.add(shaft);
    // Scanner head (octahedron)
    const headGeo = new THREE.OctahedronGeometry(3, 0);
    const head = new THREE.Mesh(headGeo, pipeMat);
    head.position.set(sp.x, h + 3, sp.z);
    scene.add(head);
    // Scanner glow
    const scanGlow = new THREE.Mesh(new THREE.SphereGeometry(1.5, 6, 6), glowCyanMat);
    scanGlow.position.set(sp.x, h + 3, sp.z);
    scene.add(scanGlow);
    // Scanner light
    const scanLight = new THREE.PointLight(0x0088ff, 2, 40);
    scanLight.position.set(sp.x, h + 3, sp.z);
    scene.add(scanLight);
  });

  // ===== 5. ENERGY BEAMS (vertical light columns) =====
  const beamPositions = [
    { x: 0, z: -280 },   // Behind citadel
    { x: -150, z: -150 }, { x: 150, z: -150 },
    { x: -180, z: 100 },  { x: 180, z: 100 },
  ];
  beamPositions.forEach(bp => {
    const bGeo = new THREE.CylinderGeometry(3, 3, 500, 8, 1, true);
    const beam = new THREE.Mesh(bGeo, beamMat);
    beam.position.set(bp.x, 200, bp.z);
    scene.add(beam);
    // Ground glow
    const groundGlow = new THREE.PointLight(0xff4400, 4, 60);
    groundGlow.position.set(bp.x, 5, bp.z);
    scene.add(groundGlow);
  });

  // ===== 6. SCANNING BEAMS (blue, tilted) =====
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + 0.5;
    const sGeo = new THREE.CylinderGeometry(1, 8, 300, 8, 1, true);
    const sBeam = new THREE.Mesh(sGeo, scanBeamMat);
    sBeam.position.set(Math.cos(ang) * 100, 100, Math.sin(ang) * 100);
    sBeam.rotation.x = 0.3;
    sBeam.rotation.z = ang;
    scene.add(sBeam);
  }

  // ===== 7. CONNECTING INFRASTRUCTURE (pipes, bridges) =====
  // Horizontal pipes connecting buildings at various heights
  const pipeConfigs = [
    { x1: -70, z1: -60, x2: -100, z2: -90, y: 35 },
    { x1: 70, z1: -50, x2: 110, z2: -80, y: 45 },
    { x1: -60, z1: 70, x2: -100, z2: 100, y: 30 },
    { x1: 60, z1: 80, x2: 95, z2: 110, y: 40 },
    { x1: -90, z1: -40, x2: -130, z2: -40, y: 55 },
    { x1: 90, z1: 40, x2: 130, z2: 40, y: 50 },
    { x1: -50, z1: -100, x2: 30, z2: -120, y: 60 },
    { x1: -80, z1: 50, x2: -80, z2: 100, y: 25 },
  ];
  pipeConfigs.forEach(pc => {
    const dx = pc.x2 - pc.x1, dz = pc.z2 - pc.z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const pGeo = new THREE.CylinderGeometry(0.8, 0.8, len, 6);
    const p = new THREE.Mesh(pGeo, pipeMat);
    p.position.set((pc.x1 + pc.x2) / 2, pc.y, (pc.z1 + pc.z2) / 2);
    p.rotation.z = Math.PI / 2;
    p.rotation.y = Math.atan2(dz, dx);
    scene.add(p);
  });

  // ===== 8. FLOATING INDUSTRIAL RINGS =====
  const fRingGeo = new THREE.TorusGeometry(130, 2, 8, 64);
  const fRing = new THREE.Mesh(fRingGeo, darkMat);
  fRing.position.y = 70; fRing.rotation.x = Math.PI / 2;
  scene.add(fRing);

  const outerRingGeo = new THREE.TorusGeometry(250, 3, 12, 96);
  const outerRing = new THREE.Mesh(outerRingGeo, darkMat);
  outerRing.position.y = -30; outerRing.rotation.x = Math.PI / 3;
  scene.add(outerRing);

  // ===== 9. GROUND-LEVEL DEBRIS & RUINS =====
  // Rubble clusters outside arena
  for (let i = 0; i < 20; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = 50 + rng() * 60;
    const s = 2 + rng() * 5;
    const rGeo = new THREE.BoxGeometry(s, s * 0.6, s);
    const rub = new THREE.Mesh(rGeo, concreteMat);
    rub.position.set(Math.cos(ang) * dist, s * 0.3 - 2, Math.sin(ang) * dist);
    rub.rotation.y = rng() * Math.PI;
    rub.rotation.z = rng() * 0.3;
    scene.add(rub);
  }

  // ===== 10. DYSTOPIAN GROUND PLANE (extends far beyond arena) =====
  const farGroundGeo = new THREE.PlaneGeometry(800, 800);
  const farGroundMat = new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 1, metalness: 0 });
  const farGround = new THREE.Mesh(farGroundGeo, farGroundMat);
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.y = -0.5;
  farGround.receiveShadow = true;
  scene.add(farGround);

  // ===== 11. ATMOSPHERIC SPOTLIGHTS (searching the sky) =====
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const spotGeo = new THREE.CylinderGeometry(0.5, 12, 200, 8, 1, true);
    const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.02, side: THREE.DoubleSide, depthWrite: false });
    const spot = new THREE.Mesh(spotGeo, spotMat);
    spot.position.set(Math.cos(ang) * 120, 100, Math.sin(ang) * 120);
    spot.rotation.x = 0.2;
    spot.rotation.z = ang * 0.3;
    scene.add(spot);
  }
}

function addTrollMessages(scene, arenaSize) {
  const messages = [
    "YOU WEREN'T SUPPOSED TO SEE THIS...",
    "FIXING THIS WOULD'VE TAKEN AGES. JUST GO BACK.",
    "NOTHING TO SEE HERE. PLEASE RETURN TO THE FIGHT.",
    "IS CLIP-WALKING YOUR ONLY HOBBY? GO BACK!"
  ];

  const positions = [
    { x: 0, z: -arenaSize - 10, r: 0 },
    { x: 0, z: arenaSize + 10, r: Math.PI },
    { x: -arenaSize - 10, z: 0, r: -Math.PI / 2 },
    { x: arenaSize + 10, z: 0, r: Math.PI / 2 },
  ];

  positions.forEach((p, i) => {
    const textMesh = createTrollTextMessage(messages[i]);
    textMesh.position.set(p.x, 8, p.z);
    textMesh.rotation.y = p.r;
    scene.add(textMesh);
  });
}

function createTrollTextMessage(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 1024;
  canvas.height = 128;
  
  // High contrast background for "debug" look
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // White text with red glow
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 512, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ 
    map: texture, 
    transparent: true, 
    side: THREE.DoubleSide 
  });
  
  const geometry = new THREE.PlaneGeometry(25, 3);
  return new THREE.Mesh(geometry, material);
}
