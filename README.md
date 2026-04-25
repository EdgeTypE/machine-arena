# ⚙ MACHINE ARENA ⚙

A low-poly, pixelated roguelite FPS built with [Three.js](https://threejs.org/) for the gamedev.js game jam.

**Theme: Machines**

## 🎮 Gameplay

You're trapped in a machine arena. Survive wave after wave of hostile machines. Between waves, choose upgrades to power up your loadout.

### Character Classes

| Class | Fire Rate | Damage | Range | Magazine |
|-------|-----------|--------|-------|----------|
| **LMG** | High | Low | Close-Mid | 80 |
| **Rifle** | Medium | Medium | Long | 20 |
| **Shotgun** | Low | High | Close | 6 |

### Enemy Types

- **Swarm Bot** - Fast, weak, attacks in numbers
- **Drone** - Flying unit, moderate threat
- **Walker** - Bipedal machine, balanced stats
- **Tank** - Heavy armor, high damage, slow
- **Sniper Bot** *(wave 4+)* - Keeps distance, charges a red laser for 1.5s, then fires a devastating instant-hit shot

### Upgrades

After each wave, choose 1 of 3 random upgrade cards. Some cards only appear once their prerequisites are met:

- ⚡ Overdrive (damage +25%)
- ⚙ Overclock (fire rate +20%)
- 📦 Expanded Mag (+30% mag size)
- 🛡 Armor Plate (+25 max HP)
- 💚 Repair Kit (restore 50% HP)
- 🏃 Turbo Boost (move speed +15%)
- 🎯 Precision (spread -30%)
- ⏱ Quick Load (reload time -25%)
- 🔥 Multi-Shot (+1 bullet per shot)
- 🦘 Jump Jets (unlock jump — Space key)
- 🚀 Double Jump (unlock double jump — requires Jump Jets)
- 👟 Sprint Boots (unlock sprint — Shift key)
- 💉 Nano Repair (+3 HP/s regen, stackable)
- 💥 Nova Grenade (+3 grenades, G key)

### ⚙ Gear Shop (Tab key)

Open the shop at any time during a run to spend collected Gears on permanent upgrades:

| Item | Cost | Effect |
|------|------|--------|
| 🛡 Armor Module | 20 | +30 max HP |
| ⚡ Weapon Core | 30 | +20% weapon damage |
| 💉 Nano Repair+ | 25 | +5 HP/s regen |
| ⚙ Overclock+ | 25 | +15% fire rate |
| 🧥 Carbon Fiber | 35 | −10% incoming damage (max 50%) |
| 📦 Ammo Cache | 20 | +20% magazine size |
| 💚 Field Repair | 40 | Full HP restore |
| 🏃 Servo Boost | 22 | +12% movement speed |

### Economy

Killing enemies drops **⚙ Gears** proportional to their max HP (`floor(maxHP / 5)`). Open the shop with **Tab** to spend them.

## 🕹 Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Shift | Sprint *(requires Sprint Boots upgrade)* |
| Space | Jump *(requires Jump Jets upgrade)* |
| Tab | Open / Close Gear Shop |
| Mouse | Look |
| Left Click | Shoot |
| R | Reload |
| G | Throw Grenade *(requires Nova Grenade upgrade)* |

## 🎬 Game Flow

```
Main Menu (Doom/Quake style)
  ├─ NEW GAME → Class Selection → Story Briefing → Game
  └─ CONTROLS → Controls Screen → Back
```

## 🎵 Music

Place the following MP3 files in the `public/` folder before running the game:

| File | When it plays |
|------|---------------|
| `public/music1_alt.mp3` | Main menu and pre-game screens |
| `public/music1.mp3` | In-game (action track) |

Both tracks should be the **same music with different instrumentation**.
When the player starts a game, the code reads `music1_alt`'s current timestamp
and starts `music1` at the **exact same position**, then cross-fades over 1.5 seconds
for a seamless transition.

```bash
npm install
npm run dev
```

## 📦 Build

```bash
npm run build
```

## 🛠 Tech Stack

- [Three.js](https://threejs.org/) - 3D rendering
- [Vite](https://vitejs.dev/) - Build tool
- Pixelated post-processing via low-res render targets

## 🗺 Next Development Session Ideas

- **Boss wave**: Every 5th wave spawns a boss enemy with a large health pool, multiple attack phases, and a unique death reward (bonus gears + guaranteed rare upgrade)
- **Ammo / HP crate pickups**: Spawn destructible crates in the arena that drop ammo or health when shot
- **Minimap / radar**: Small top-down overlay in the HUD corner showing live enemy positions and direction
- **Kill streak multiplier**: Consecutive kills without taking damage stack a score multiplier (×1 → ×4); displayed in HUD, resets on hit
- **Visual: Oil splatter decals** on arena floor when enemies die (sprite billboard that fades over ~10s)
- **Persistent Gear progress**: Save gears to `localStorage` so they carry over between sessions and feed into a meta-progression layer
- **Background ambient music**: Procedurally generated looping drone/beat using Web Audio API oscillators and a compressor chain
- **Sniper Bot counter-play**: Add a "dodge window" — player can hear the charge and move out of the laser path (laser origin stays fixed, not tracking)
