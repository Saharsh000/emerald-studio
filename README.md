# ⚡ Emerald Studio (v2.0)

> **The Ultimate Standalone Tooling Suite for Pokémon Emerald Decompilations (`pokeemerald` / `pokeemerald-expansion`)**  
> Combines the **Real-Time Free-Fly Overworld Tester** ("Fly Your Body / Noclip") with the beloved **Emerald Dialogue Studio**.

---

## 🌟 What is Emerald Studio?

Emerald Studio is an ultra-fast, zero-dependency developer workspace designed specifically for ROM hackers working with the `pokeemerald` decompilation.

### 🎮 1. Real-Time Free-Fly World Map Tester ("Noclip Overworld")
- **Fly Your Body Freely:** Smooth 60 FPS velocity camera with zero collisions, zero NPC obstructions, and pure pixel-crisp GBA rendering.
- **Atmospheric Weather Engine:** Real-time particle simulations for **Heavy Rain**, **Thunderstorm** (with ambient screen lightning), **Snow & Blizzard** (with wind oscillation), **Radiant Sunbeams**, **Volcanic Ash** (Route 113 / Mt. Chimney soot), and **Rolling Mist/Fog**.
- **Live Location Detection:** Automatic HUD banner slides in whenever you cross into any route, town, or city.
- **Flight Multipliers:**
  - `WASD` / `Arrow Keys`: Normal Flight (1x)
  - `Shift`: Mach Bike Boost (3x)
  - `Space`: Rayquaza Supersonic Warp (8x)
- **Instant POI Teleport:** Warp to any of the 34 Routes, 16 Cities/Towns, or Dungeons with 1 click.
- **Customizable Avatar:** Fly as **Professor Rayquaza** (64x64 floating overworld follower), **Brendan on Mach Bike**, **Brendan Walking**, or **Drone Crosshair**.
- **Wild Encounters Radar:** View newly assigned Gen 1–9 wild Pokémon for the active route and verify 0% wild starters.

### 💬 2. Emerald Dialogue Studio
- **Direct Pokeemerald Integration:** Reads and writes directly to `data/maps/*/scripts.inc` and `data/scripts/*.inc`.
- **Chapter-by-Chapter Journey:** Progress from *01 · New home & first steps* through *12 · Postgame & Battle Frontier*, plus optional/shared text.
- **Live GBA Preview:** Accurately visualizes textboxes, formatting codes (`\p` new page, `\l` scroll, `\n` newline).
- **Safety & Verification:** Hash checks ensure your edits never overwrite external changes unexpectedly.
- **Offline Checklist:** Persistent localStorage checklist to track completed dialogue rewrites.

---

## 🚀 Quick Start

### 1. One-Click Launch (macOS)
Double-click `start.command` in Finder. It starts the local server and opens `http://127.0.0.1:4173` in your default browser.

### 2. Terminal
```bash
cd /Users/saharsh/emerald-studio
npm start
```
Or directly with Node:
```bash
node server.js
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173) in your browser.

---

## ⌨️ Hotkeys & Controls

| Key | Action |
| :--- | :--- |
| `1` | Switch to **World Map Explorer** |
| `2` | Switch to **Dialogue Studio** |
| `W` / `A` / `S` / `D` | Fly North, West, South, East |
| `Shift` (Hold) | **Mach Boost** (3x velocity) |
| `Space` (Hold) | **Rayquaza Supersonic Warp** (8x velocity) |
| `+` / `-` or Scroll | Zoom In / Out |
| `Cmd + S` / `Ctrl + S` | Save current dialogue block |

---

## 📁 Repository Structure

```
emerald-studio/
├── server.js              # Zero-dependency Node HTTP server + tile caching proxy
├── package.json           # Standalone npm scripts
├── start.command          # 1-click macOS launcher
├── README.md              # Documentation
├── data/
│   ├── routes.json        # Hoenn POIs, route polygons, and weather settings
│   ├── maps_config.json   # Maps registry (Overworld, Underwater, Dungeons)
│   └── tile_cache/        # Automatic on-disk tile caching for offline performance
└── public/
    ├── index.html         # Unified studio UI
    ├── app.js             # Orchestrator & tab navigation
    ├── map.js             # Free-fly Leaflet engine & flight physics
    ├── weather.js         # 60fps Canvas weather particle engine
    ├── dialogue.js        # Full dialogue studio client
    ├── css/               # Modular styling (studio, map, dialogue)
    ├── assets/sprites/    # Rayquaza & Brendan flight avatars
    └── vendor/            # Bundled Leaflet library (100% offline)
```

---

## 🔗 GitHub Push Instructions

To push this repository to GitHub via GitHub Desktop or Terminal:

```bash
cd /Users/saharsh/emerald-studio
git init
git add .
git commit -m "feat: initial commit for emerald-studio v2.0"
git branch -M main
git remote add origin https://github.com/Saharsh000/emerald-studio.git
git push -u origin main
```
Or open **GitHub Desktop** -> `File` -> `Add Local Repository` -> Select `/Users/saharsh/emerald-studio` -> Publish Repository!
