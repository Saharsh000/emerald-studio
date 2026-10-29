/*
 * Emerald Free-Fly / Noclip Map Tester Client
 * Complete free-flight exploration of Hoenn:
 * - 60 FPS keyboard velocity flight (WASD, Arrows, Shift Mach-Boost, Space Warp)
 * - Pure overworld rendering without NPCs
 * - Auto-detecting Route Location HUD
 * - Live weather sync and manual weather controls
 * - Wild encounters radar with starter check
 * - POI quick-warp teleportation
 */

(function(window) {
  "use strict";

  class EmeraldMapTester {
    constructor() {
      this.map = null;
      this.tileLayer = null;
      this.activeMapId = "Overworld";
      this.routes = [];
      this.mapsConfig = [];
      this.currentLocation = null;
      this.autoWeather = true;
      this.weatherEngine = null;

      // Flight movement physics
      this.keys = {};
      this.velocity = { x: 0, y: 0 };
      this.avatarFacing = "down";
      this.avatarType = "rayquaza";
      this.flightSpeedMultiplier = 1.0;
      this.isFlying = false;

      // Sample mock encounters for peek radar (matches our complete-hoenn-route-dex.md)
      this.sampleEncounters = {
        "Littleroot": [
          { name: "Starter Professor", type: "Gift Only", rate: "Rayquaza (9 Starters)", shiny: "Prompt" }
        ],
        "Route 101": [
          { name: "Pawmi", type: "Grass", rate: "20%", level: "3-5" },
          { name: "Fletchling", type: "Grass", rate: "20%", level: "3-5" },
          { name: "Wooloo", type: "Grass", rate: "15%", level: "3-5" },
          { name: "Yamper", type: "Grass", rate: "15%", level: "3-5" },
          { name: "Poochyena", type: "Grass", rate: "10%", level: "3-5" },
          { name: "Zigzagoon", type: "Grass", rate: "10%", level: "3-5" },
          { name: "Rookidee", type: "Grass", rate: "10%", level: "3-5" }
        ],
        "Route 102": [
          { name: "Fletchling", type: "Grass", rate: "20%", level: "4-6" },
          { name: "Lechonk", type: "Grass", rate: "20%", level: "4-6" },
          { name: "Ralts", type: "Grass", rate: "10%", level: "4-6" },
          { name: "Lotad", type: "Grass", rate: "10%", level: "4-6" },
          { name: "Seedot", type: "Grass", rate: "10%", level: "4-6" },
          { name: "Pawmi", type: "Grass", rate: "10%", level: "4-6" }
        ],
        "Route 103": [
          { name: "Wingull", type: "Grass/Water", rate: "25%", level: "4-7" },
          { name: "Wattrel", type: "Grass/Water", rate: "25%", level: "4-7" },
          { name: "Poochyena", type: "Grass", rate: "20%", level: "4-7" },
          { name: "Zigzagoon", type: "Grass", rate: "20%", level: "4-7" }
        ],
        "Route 104": [
          { name: "Marill", type: "Grass/Surf", rate: "25%", level: "6-8" },
          { name: "Taillow", type: "Grass", rate: "20%", level: "6-8" },
          { name: "Wingull", type: "Grass", rate: "20%", level: "6-8" },
          { name: "Wurmple", type: "Grass", rate: "15%", level: "6-8" }
        ],
        "Route 119": [
          { name: "Tropius", type: "Tall Grass", rate: "20%", level: "25-28" },
          { name: "Kecleon", type: "Tall Grass", rate: "15%", level: "25-28" },
          { name: "Feebas", type: "Fishing", rate: "Tile Specific", level: "20-25" },
          { name: "Gloom", type: "Tall Grass", rate: "20%", level: "25-28" },
          { name: "Linoone", type: "Tall Grass", rate: "20%", level: "25-28" }
        ],
        "Route 113": [
          { name: "Skarmory", type: "Ash Grass", rate: "20%", level: "15-18" },
          { name: "Spinda", type: "Ash Grass", rate: "35%", level: "15-18" },
          { name: "Slugma", type: "Ash Grass", rate: "25%", level: "15-18" },
          { name: "Numel", type: "Ash Grass", rate: "20%", level: "15-18" }
        ],
        "Fortree City": [
          { name: "Tinkatink", type: "Treehouse Gift", rate: "Special", level: "20" }
        ],
        "EverGrande City": [
          { name: "Dragonite", type: "Peak Spawns", rate: "10%", level: "45-50" },
          { name: "Salamence", type: "Peak Spawns", rate: "10%", level: "45-50" },
          { name: "Garchomp", type: "Peak Spawns", rate: "10%", level: "45-50" },
          { name: "Baxcalibur", type: "Peak Snow", rate: "10%", level: "45-50" }
        ]
      };
    }

    async init() {
      await this.loadMetadata();
      this.initLeaflet();
      this.initWeather();
      this.initFlightControls();
      this.initUI();
      this.startFlightLoop();
    }

    async loadMetadata() {
      try {
        const [routesRes, mapsRes] = await Promise.all([
          fetch("/api/routes"),
          fetch("/api/maps")
        ]);
        this.routes = await routesRes.json();
        this.mapsConfig = await mapsRes.json();
      } catch (err) {
        console.error("Failed to load map metadata:", err);
      }
    }

    initLeaflet() {
      const container = document.getElementById("emerald-leaflet-map");
      if (!container) return;

      this.map = L.map("emerald-leaflet-map", {
        crs: L.CRS.Simple,
        minZoom: 3,
        maxZoom: 7,
        zoomSnap: 1,
        zoomDelta: 1,
        attributionControl: false,
        zoomControl: false,
        preferCanvas: true,
        inertia: true,
        inertiaDeceleration: 2500,
      });

      // Default to Littleroot Town overworld
      this.setMapLayer("Overworld", [-72.79, 32.0], 5);

      this.map.on("move", () => this.onCameraMoved());
      this.map.on("zoomend", () => this.updateTelemetry());
    }

    setMapLayer(mapId, center, zoom) {
      if (this.tileLayer) {
        this.map.removeLayer(this.tileLayer);
      }

      this.activeMapId = mapId;
      const tileUrl = `/api/tiles/${mapId}/{z}/{x}/{y}.png`;

      this.tileLayer = L.tileLayer(tileUrl, {
        tileSize: 256,
        maxNativeZoom: 7,
        minNativeZoom: 3,
        reuseTiles: true,
        bounds: [[-95.742, 0], [0, 199.992]],
        className: "emerald-crisp-tile",
      }).addTo(this.map);

      if (center) {
        this.map.setView(center, zoom || 5);
      }

      this.onCameraMoved();
    }

    initWeather() {
      const canvas = document.getElementById("weather-canvas");
      const lightning = document.getElementById("lightning-flash");
      if (canvas) {
        this.weatherEngine = new window.WeatherEngine(canvas, lightning);
        this.weatherEngine.setWeather("sunny");
      }
    }

    initFlightControls() {
      window.addEventListener("keydown", (e) => {
        // Ignore typing in input fields
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") {
          return;
        }

        const key = e.key.toLowerCase();
        this.keys[key] = true;

        if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
          e.preventDefault();
        }
      });

      window.addEventListener("keyup", (e) => {
        const key = e.key.toLowerCase();
        this.keys[key] = false;
      });
    }

    startFlightLoop() {
      const avatarEl = document.getElementById("player-avatar-sprite");
      const speedValEl = document.getElementById("telemetry-speed");

      const tick = () => {
        let dx = 0;
        let dy = 0;

        // Keys check
        if (this.keys["w"] || this.keys["arrowup"]) dy -= 1;
        if (this.keys["s"] || this.keys["arrowdown"]) dy += 1;
        if (this.keys["a"] || this.keys["arrowleft"]) dx -= 1;
        if (this.keys["d"] || this.keys["arrowright"]) dx += 1;

        if (dx !== 0 || dy !== 0) {
          // Normalize diagonal
          const mag = Math.sqrt(dx * dx + dy * dy);
          let vx = (dx / mag);
          let vy = (dy / mag);

          // Speed boost multipliers
          let multiplier = 12; // Base speed
          if (this.keys["shift"]) multiplier = 32; // Mach Bike
          if (this.keys[" "] || this.keys["space"]) multiplier = 75; // Rayquaza Extreme Speed

          vx *= multiplier * this.flightSpeedMultiplier;
          vy *= multiplier * this.flightSpeedMultiplier;

          // Pan Leaflet camera
          this.map.panBy([vx, vy], { animate: false });
          this.isFlying = true;

          // Update avatar orientation
          if (Math.abs(dx) > Math.abs(dy)) {
            this.avatarFacing = dx > 0 ? "right" : "left";
            if (avatarEl) avatarEl.style.transform = dx > 0 ? "scaleX(1)" : "scaleX(-1)";
          } else {
            this.avatarFacing = dy > 0 ? "down" : "up";
            if (avatarEl) avatarEl.style.transform = "scaleX(1)";
          }

          if (speedValEl) {
            speedValEl.textContent = `${Math.round(multiplier * 20)} px/s ${multiplier >= 75 ? "⚡ SUPERSONIC" : (multiplier >= 32 ? "🚴 MACH" : "🚶 WALK")}`;
          }
        } else {
          this.isFlying = false;
          if (speedValEl) speedValEl.textContent = "0 px/s (Hovering)";
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }

    onCameraMoved() {
      const center = this.map.getCenter();
      this.updateTelemetry();
      this.detectCurrentLocation(center);
    }

    updateTelemetry() {
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();

      const coordsEl = document.getElementById("telemetry-coords");
      const zoomEl = document.getElementById("telemetry-zoom");
      const mapNameEl = document.getElementById("telemetry-map");

      // Approximate GBA tile coordinates
      // Leaflet lat: [-95.74 to 0], lng: [0 to 200]
      // 1 Leaflet unit ≈ 4 GBA tiles (0.25 tileSize)
      const tileX = Math.round((center.lng / 0.25));
      const tileY = Math.round((center.lat / 0.25));

      if (coordsEl) coordsEl.textContent = `X: ${tileX} | Y: ${tileY} (Lat: ${center.lat.toFixed(2)}, Lng: ${center.lng.toFixed(2)})`;
      if (zoomEl) zoomEl.textContent = `${zoom}x (${Math.round((zoom / 5) * 100)}% GBA Native)`;
      if (mapNameEl) mapNameEl.textContent = this.activeMapId;
    }

    detectCurrentLocation(center) {
      if (this.activeMapId !== "Overworld") {
        this.updateLocationBanner(this.activeMapId, "Dungeon / Crater Interior", "none");
        return;
      }

      // Check polygon point-in-polygon
      const pt = [center.lat, center.lng];
      let matched = null;

      for (const route of this.routes) {
        if (route.polygon && route.polygon.length >= 3) {
          if (this.pointInPolygon(pt, route.polygon)) {
            matched = route;
            break;
          }
        }
      }

      // Fallback nearest distance if not inside exact polygon
      if (!matched) {
        let minDist = Infinity;
        for (const route of this.routes) {
          if (route.center) {
            const d = Math.hypot(center.lat - route.center[0], center.lng - route.center[1]);
            if (d < minDist && d < 6.0) {
              minDist = d;
              matched = route;
            }
          }
        }
      }

      if (matched && (!this.currentLocation || this.currentLocation.name !== matched.name)) {
        this.currentLocation = matched;
        this.updateLocationBanner(matched.name, matched.type.toUpperCase(), matched.weather);

        if (this.autoWeather && this.weatherEngine) {
          this.weatherEngine.setWeather(matched.weather || "sunny");
          this.updateActiveWeatherButton(matched.weather || "sunny");
        }

        this.renderEncounters(matched.name);
      }
    }

    pointInPolygon(point, vs) {
      const x = point[0], y = point[1];
      let inside = false;
      for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    updateLocationBanner(name, type, weather) {
      const nameEl = document.getElementById("banner-location-name");
      const badgeEl = document.getElementById("banner-location-badge");
      const weatherEl = document.getElementById("banner-location-weather");

      if (nameEl) nameEl.textContent = name;
      if (badgeEl) badgeEl.textContent = `📍 ${type}`;
      if (weatherEl) weatherEl.textContent = `Atmosphere: ${weather.toUpperCase()}`;
    }

    renderEncounters(routeName) {
      const listEl = document.getElementById("encounters-list-container");
      const countEl = document.getElementById("encounters-count-badge");
      if (!listEl) return;

      const encounters = this.sampleEncounters[routeName] || [
        { name: "Wild Pokémon Spawns", type: "Grass / Water", rate: "Diverse", level: "Scaled" },
        { name: "Gen 1–9 Overhaul", type: "All Gens", rate: "Active", level: "Assigned" }
      ];

      if (countEl) countEl.textContent = `${encounters.length} Active Species`;

      listEl.innerHTML = encounters.map(enc => `
        <div class="encounter-row">
          <div>
            <span class="encounter-species">${enc.name}</span>
            <div style="font-size:0.67rem; color:var(--muted);">${enc.type} · Lv ${enc.level || 'Custom'}</div>
          </div>
          <span class="encounter-rate">${enc.rate}</span>
        </div>
      `).join("");
    }

    updateActiveWeatherButton(type) {
      document.querySelectorAll(".weather-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.weather === type);
      });
    }

    initUI() {
      // Warp selector dropdown populate
      const warpSelect = document.getElementById("warp-select");
      if (warpSelect && this.routes) {
        warpSelect.innerHTML = `<option value="">⚡ Teleport / Warp To Route...</option>` +
          this.routes.map(r => `<option value="${r.name}">${r.name} (${r.type})</option>`).join("");

        warpSelect.addEventListener("change", (e) => {
          const targetName = e.target.value;
          if (!targetName) return;
          const found = this.routes.find(r => r.name === targetName);
          if (found && found.center) {
            this.map.flyTo(found.center, 5, { duration: 1.2 });
          }
          warpSelect.value = "";
        });
      }

      // Map switcher dropdown
      const mapSelect = document.getElementById("map-layer-select");
      if (mapSelect && this.mapsConfig) {
        mapSelect.innerHTML = this.mapsConfig.map(m => `
          <option value="${m.id}" ${m.id === "Overworld" ? "selected" : ""}>🗺️ ${m.name}</option>
        `).join("");

        mapSelect.addEventListener("change", (e) => {
          const mapId = e.target.value;
          const conf = this.mapsConfig.find(m => m.id === mapId);
          if (conf) {
            this.setMapLayer(conf.id, conf.center, conf.defaultZoom);
          }
        });
      }

      // Weather manual override buttons
      document.querySelectorAll(".weather-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const weather = btn.dataset.weather;
          this.autoWeather = false;
          const autoCheck = document.getElementById("auto-weather-check");
          if (autoCheck) autoCheck.checked = false;

          if (this.weatherEngine) {
            this.weatherEngine.setWeather(weather);
          }
          this.updateActiveWeatherButton(weather);
        });
      });

      // Auto weather sync checkbox
      const autoCheck = document.getElementById("auto-weather-check");
      if (autoCheck) {
        autoCheck.addEventListener("change", (e) => {
          this.autoWeather = e.target.checked;
          if (this.autoWeather && this.currentLocation && this.weatherEngine) {
            this.weatherEngine.setWeather(this.currentLocation.weather || "sunny");
            this.updateActiveWeatherButton(this.currentLocation.weather || "sunny");
          }
        });
      }

      // Avatar Selector
      const avatarSelect = document.getElementById("avatar-select");
      const avatarEl = document.getElementById("player-avatar-sprite");
      const shadowEl = document.getElementById("player-shadow");
      const crosshairEl = document.getElementById("crosshair-hud");

      if (avatarSelect) {
        avatarSelect.addEventListener("change", (e) => {
          const type = e.target.value;
          this.avatarType = type;

          if (type === "rayquaza") {
            avatarEl.style.display = "block";
            shadowEl.style.display = "block";
            crosshairEl.style.display = "none";
            avatarEl.src = "assets/sprites/rayquaza.png";
            avatarEl.style.width = "64px";
            avatarEl.style.height = "64px";
          } else if (type === "brendan_bike") {
            avatarEl.style.display = "block";
            shadowEl.style.display = "block";
            crosshairEl.style.display = "none";
            avatarEl.src = "assets/sprites/brendan_bike.png";
            avatarEl.style.width = "48px";
            avatarEl.style.height = "48px";
          } else if (type === "brendan_walk") {
            avatarEl.style.display = "block";
            shadowEl.style.display = "block";
            crosshairEl.style.display = "none";
            avatarEl.src = "assets/sprites/brendan_walk.png";
            avatarEl.style.width = "36px";
            avatarEl.style.height = "48px";
          } else if (type === "crosshair") {
            avatarEl.style.display = "none";
            shadowEl.style.display = "none";
            crosshairEl.style.display = "block";
          } else if (type === "none") {
            avatarEl.style.display = "none";
            shadowEl.style.display = "none";
            crosshairEl.style.display = "none";
          }
        });
      }
    }
  }

  window.EmeraldMapTester = EmeraldMapTester;
})(window);
