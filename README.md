# Ålandsflyg

A browser flight simulator over Åland and the Stockholm and Turku archipelagos. Built for mobile (touch) and also playable on desktop with a keyboard.

- Five aircraft: a bush plane (DHC-2 Beaver type), a seaplane on floats, a regional turboprop (Fokker 50 type), an airliner (A320 type with fly-by-wire) and a yellow air ambulance helicopter (H145 type).
- Flight physics with lift, drag, stalls, ground effect, landing gear and gusty wind. The helicopter has its own model with collective, attitude-hold cyclic, translational lift, ground effect, vortex ring state, torque yaw and rotor wash, plus a hover assist (the lever commands climb/descent, drift hold, soft touchdown) and an autopilot that flies to the mission target.
- Airports with runways at their real coordinates: Mariehamn, Stockholm-Arlanda, Bromma and Turku, plus smaller fields (Kumlinge, Norrtälje, Lunda, Genböle, Lindholmen, Gimo) and a fictional grass strip at Saltvik. Hospital helipads in Mariehamn, Turku and Stockholm.
- Routes between the airports with an autopilot (NAV, altitude, speed and approach), time warp up to ×16 and a jump straight to the approach.
- A guided first flight (tutorial) that walks a new player through takeoff, climbing, turning and landing step by step.
- Eight missions, including four medevac flights (one far out to Kökar), with best times and scores saved in the browser.
- A nautical-chart style map with position, track and mission targets, plus a mini map.
- Three camera views: outside view, 3D cockpit with working instruments, and HUD.
- Graphics setting (low, medium, high) that starts at medium on phones, with automatic adjustment that lowers resolution or quality if the frame rate drops, and an optional FPS meter.
- Difficulty: Easy (default) helps level the wings and flare near the ground and tolerates firmer touchdowns; Realistic leaves it to you. The landing guide shows a flight-director ring and how far above or below the glide path you are.
- Installable web app (PWA): add it to the home screen for full screen and offline play.
- Weather: clear, scattered clouds, overcast, rain or low fog. Under the cloud layer it is grey and hazy (with rain streaks in rain), inside the cloud you fly on instruments, and above it you come out into sunshine over a sea of clouds. Turbulence in and below the clouds.
- Six times of day from dawn to night, with lit airports (edge, centreline, touchdown-zone and approach lights), towns, roads, lighthouses and ships.
- Runways are painted into the terrain and outlined in the HUD at a distance, so they are easy to find.

## Files

| File | Contents |
|---|---|
| `index.html` | Page structure and script loading |
| `css/style.css` | Menu, controls and map panel |
| `js/data.js` | Land/water masks for Åland and the whole region as embedded PNG images (generated) |
| `js/world.js` | Geography, elevation, land types, airfields and helipads |
| `js/physics.js` | The aircraft and the flight physics |
| `js/scene.js` | Three.js scene: sky, materials, airfields, forest, landmarks, models |
| `js/terrain.js` | Streaming terrain in three levels of detail and buildings that follow the camera |
| `js/daynight.js` | Time of day: sun, moon, stars, night lighting and aircraft lights |
| `js/weather.js` | Weather: cloud layer, haze, rain and turbulence |
| `js/route.js` | Routes, autopilot and time warp |
| `js/cockpit.js` | 3D cockpit with instruments for the airliners, the bush plane and the helicopter |
| `js/missions.js` | The missions |
| `js/map.js` | The map |
| `js/hud.js` | HUD: speed, altitude, heading, horizon, warnings |
| `js/app.js` | Menu, controls, camera, sound, performance and main loop |
| `manifest.webmanifest`, `sw.js` | Web app manifest and service worker (installable, offline) |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | App icons |

No build step is needed. Three.js r128 is loaded from cdnjs.

## Publishing with GitHub Pages

1. Upload all files with the same folder structure (Add file → Upload files).
2. Settings → Pages → Deploy from a branch → `main` / root.
3. The site is then at `https://<username>.github.io/<repo>/`.
4. On the phone: open the site in Safari → Share → Add to Home Screen.
5. When you update files, raise the version in `sw.js` (`alandsflyg-v1` → `v2`). The installed app shows the new version from the second start after an update.

## Data

The coastline comes from OpenStreetMap via geo-maps (© OpenStreetMap contributors, ODbL). It is simplified at the source and refined with noise to create skerries and bays. Runway coordinates come from OurAirports (public domain). Elevation and land cover are computed, not measured.
