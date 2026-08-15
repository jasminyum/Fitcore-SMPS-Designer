![License](https://img.shields.io/badge/license-Apache%202.0-blue)

# SMPS Calculation & Design Tool

www.ataqileriteknoloji.com

A browser-based calculation, optimization, and circuit-simulation tool for switch-mode power supply (SMPS) topologies. It includes 17 topology pages, a magnetics (coil/transformer) optimization engine running on Firebase Cloud Functions, a custom thermal-analysis simulation based on the actual selected components, and an embedded Falstad/CircuitJS circuit simulator.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Running the Firebase Functions](#running-the-firebase-functions)
- [Supported Topologies](#supported-topologies)
- [Adding Switching Devices (PLECS Export)](#adding-switching-devices-plecs-export)
- [Languages](#languages)
- [Known Limitations / Roadmap](#known-limitations--roadmap)
- [Security Notes](#security-notes)
- [Contributing](#contributing)

## Features

- **17 topology calculators** — separate pages for Buck, Boost, Buck-Boost, Ćuk, SEPIC, Zeta, Flyback, Forward (single/double transistor), Half-Bridge, Full-Bridge, LLC (Half/Full), DAB, PFC, transformer, and inductor design.
- **Cloud-based magnetics optimization** — the `runSmpsOptimization` Cloud Function, running on Firebase Cloud Functions, picks the best combination from the core and wire database using fuzzy-weighted cost/efficiency/size targets, with per-topology duty-cycle (D1/D2) assumptions applied correctly (see [Architecture](#architecture)).
- **3D core visualization** — a 3D render of the selected magnetic core via Three.js.
- **Custom thermal analysis simulation** — a thermal test that runs against the core/switch combination actually selected by the optimizer, triggered from a separate modal (`window.openCustomThermalModal`) and downloadable as CSV.
- **Embedded circuit simulator** — a live Falstad/CircuitJS circuit simulation can be opened from any topology page (the `falstad/` directory is a separate Java/GWT app).
- **Multilingual UI** — Turkish, English, and German translations (`assets/js/common/language.js`).
- **Contact form** — a simple PHPMailer-based contact form (`forms/contact.php`).

## Architecture

The project is a **build-tool-free** (no Vite/Webpack) multi-page static site combined with a serverless backend:

```
Browser (17 HTML pages)
   │
   ├─ assets/js/common/firebase_config.js   → initializes the Firebase SDK
   ├─ assets/js/common/api_service.js       → the SINGLE entry point for all Cloud Functions calls
   ├─ assets/js/common/advanced_optimizer.js → UI logic, 3D render, thermal test, table/export;
   │                                           also reachable through the window.SMPSApp namespace
   ├─ assets/js/topologies/*.js             → per-topology electrical calculation formulas
   └─ falstad/                              → embedded circuit simulator (standalone GWT app)
        │
        ▼ (HTTPS Callable)
Firebase Cloud Functions (assets/js/functions/index.js)
   └─ runSmpsOptimization  → optimizes against the core/wire data in smps_database.json,
                              using topology-specific D1/D2 waveform assumptions for the iGSE core-loss calculation
```

### Topology detection and D1/D2 assumptions

`advanced_optimizer.js` detects which topology the page is for from the page title (`document.title`) — via `isBuck`, `isBoost`, `isBuckBoost`, `isFlyback`, `isForward`, `isPushPull`, `isBridge`, `isPfc` — and sends it to the server as a `topology` field (`"buck"`, `"boost"`, `"buckboost"`, `"flyback"`, `"forward"`, `"pushpull"`, `"bridge"`, `"llc"`, `"dab"`). On the Cloud Function side, `getEffectiveWaveformParams` uses that value to pick the D1/D2 waveform parameters and the confidence level used in the iGSE calculation — for example, Buck/Boost use the actual switching duty cycle (`D_switch`) directly, while Bridge/LLC/DAB use values computed from the symmetric or resonant operating condition. If `topology` is missing or wrong, the server falls back to `D1=D2=0.5` and flags the result as "Low Confidence" — make sure this mapping is done correctly when adding a new topology page.

### Why global `window.X` is used

Because the inline `onclick="..."` handlers on the pages depend directly on global functions, the project doesn't currently use ES Modules (`import`/`export`). Instead:

- Every function is still defined as `window.functionName` (for backward compatibility, so `onclick` doesn't break).
- At the end of `advanced_optimizer.js`, a single namespace object called **`window.SMPSApp`** is created, and all the important functions/state are also collected there. Calling something like `window.SMPSApp.executeAdvancedOptimization()` in new code makes it clear which functions are considered part of the "public API."
- A full move to ES Modules would mean converting every inline handler across the 18 HTML pages to `addEventListener`, which is a bigger separate refactor — see the roadmap below.

## Project Structure

```
.
├── *.html                        # 20 pages: 17 topologies + index + filter + help
├── Web.config                     # request/build settings for the IIS static file server
├── assets/
│   ├── css/                      # design.css, style.css
│   ├── img/                      # images
│   ├── js/
│   │   ├── common/                # shared logic
│   │   │   ├── firebase_config.js # Firebase SDK init (public API key — see Security Notes)
│   │   │   ├── api_service.js     # central service layer for Cloud Functions calls
│   │   │   ├── advanced_optimizer.js # UI, 3D render, thermal test, table/export, window.SMPSApp namespace
│   │   │   ├── language.js        # TR/EN/DE translation dictionary
│   │   │   ├── ui_modal.js
│   │   │   └── smps_filter.js
│   │   ├── topologies/            # per-topology electrical calculation file (buck.js, boost.js, ...)
│   │   ├── filters/                # filter1.js
│   │   └── functions/              # Firebase Cloud Functions (Node.js 22)
│   │       ├── index.js            # runSmpsOptimization callable function, D1/D2 assumption logic
│   │       ├── smps_database.json  # core/wire/magnetic-material/switch database
│   │       ├── package.json
│   │       ├── firebase.json
│   │       └── .firebaserc         # Firebase project ID
│   └── vendor/                    # Bootstrap, Swiper, AOS, GLightbox, Isotope, Typed.js
├── dataset/
│   └── switches/                   # staging folder for new switch entries — see below
├── falstad/                        # embedded Falstad/CircuitJS circuit simulator (Java/GWT, separate app)
├── forms/
│   ├── contact.php                 # contact-form backend using PHPMailer
│   └── phpmailler/                 # PHPMailer library (already extracted; the zip has been removed)
└── .gitignore                      # excludes node_modules, .env, .firebase/, .vs/, etc.
```

## Setup

### Requirements

- A static file server (the project needs no build tool; opening `index.html` directly from an HTTP server is enough — don't open it via `file://`, the Firebase SDK and module loading may fail due to CORS). If you're running this on Windows/IIS, the `Web.config` at the root already has the request-size and build settings you need.
- Node.js 22 (only if you want to run/deploy the Cloud Functions locally).
- A Firebase project (only if you want to run your own optimization backend).

### Quick start (frontend only)

```bash
# Open with any simple static server, e.g.:
npx serve .
# or
python3 -m http.server 8080
```

Then go to `http://localhost:8080/index.html` in your browser.

> Note: the `apiKey` in `assets/js/common/firebase_config.js` is a public Firebase **web** API key — see [Security Notes](#security-notes). If you want to point this at your own Firebase project, replace the `firebaseConfig` object in that file with your own project's details.

## Running the Firebase Functions

For the optimization feature (core/magnetics selection) to work, the `runSmpsOptimization` Cloud Function needs to be deployed.

```bash
cd assets/js/functions
npm install
```

**Test locally with the emulator:**

```bash
npm run serve
# or
npm run shell
```

**Deploy:**

```bash
npm run deploy
```

This deploys to the project ID defined in `.firebaserc` — to use your own project, update that file and select your project with `firebase use --add`.

To follow the function's logs:

```bash
npm run logs
```

### Calling it through `api_service.js`

Page code never reaches Cloud Functions directly through `firebase.app().functions(...)`. Instead, it goes through `window.apiService` in `assets/js/common/api_service.js`:

```js
// Single payload (transformer/single mode)
const response = await window.apiService.runSmpsOptimizationSingle(payload);

// Parallel optimization for two independent coils (L1/L2)
const [settledL1, settledL2] = await window.apiService.runSmpsOptimizationDual(payloadL1, payloadL2);
```

If a new page needs to call Firebase, add `api_service.js` as a script right after `firebase_config.js` and use this API — don't call `firebase.app().functions(...)` directly.

## Supported Topologies

| Page | Topology |
|---|---|
| `buck.html` | Buck |
| `boost.html` | Boost |
| `buck-boost.html` | Buck-Boost |
| `cuk.html` | Ćuk |
| `sepic.html` | SEPIC |
| `zeta.html` | Zeta |
| `flyback.html` | Flyback |
| `single.html` | Single-Transistor Forward |
| `two-transistor.html` | Two-Transistor Forward |
| `half-bridge.html` | Half-Bridge |
| `full-bridge.html` | Full-Bridge |
| `llc-half.html` | LLC Half-Bridge Resonant |
| `llc-full.html` | LLC Full-Bridge Resonant |
| `dab.html` | Dual Active Bridge (DAB) |
| `pfc.html` | Active Power Factor Correction (PFC) |
| `transformer.html` | Transformer Design |
| `inductor.html` | Inductor Design |
| `filter.html` | Filter Design |
| `yardim.html` | Help / User Guide |

## Adding Switching Devices (PLECS Export)

The switch/diode database that the optimizer picks from lives in the `switches` array of `assets/js/functions/smps_database.json` — a few hundred MOSFET/IGBT/SiC entries with their switching-loss curves and thermal Foster networks already in it.

If you want to add a device that isn't there yet:

1. In **PLECS**, export the device's Manufacturer Thermal Description as XML from the thermal-database editor (this is the same export PLECS uses for its own MOSFET/IGBT/diode thermal models).
2. Convert that XML into a JSON file matching the schema already used by the existing `switches` entries (`name`, `manufacturer`, `type`, `v_abs_max`, `i_abs_max`, `i_cont`, `housing_type`, and the `switch`/`diode` blocks with `channel`, `e_on`, `e_off`, and `thermal_foster` curves — look at any existing entry in `smps_database.json` for the exact field layout).
3. Drop the converted file into `dataset/switches/` as `dataset/switches/<manufacturer>_<part_number>.json` — see `dataset/switches/README.md` for the details.
4. Open a pull request so it can be merged into `smps_database.json`.

There's no automated PLECS-XML → JSON converter in this repo yet (the existing entries were produced offline, tagged `"author": "XML_Parser"` in the data) — see the roadmap below.

## Languages

The UI supports Turkish (`tr`), English (`en`), and German (`de`) through `assets/js/common/language.js`. To add a new language, just add a new language key to the `translations` object in that file — the `data-i18n` attributes on the pages will pick up the matching translation automatically.

## Known Limitations / Roadmap

This project has deliberately not taken on a few pieces of architectural debt yet; listed here transparently for anyone contributing:

- **No ES Modules** — functions are defined globally on `window` (see [Architecture](#architecture)). This is partly tidied up by the `window.SMPSApp` namespace, but a full `import`/`export` migration is a separate, bigger refactor that requires converting every `onclick` handler across the 18 HTML pages to `addEventListener`.
- **No build tool** — Vite/Webpack aren't used; dependencies (like Three.js) are loaded via `<script>` tags or dynamic `document.createElement('script')`. This can occasionally cause rare race-condition errors on slow connections.
- **Inline HTML templates** — some functions, like `openAdvancedTable` and `openCustomThermalModal`, contain long template literals. Splitting these into separate `.html` files and `fetch`-ing them was deliberately avoided without a build tool, since that would break under `file://` due to CORS; breaking them into smaller `renderX()` functions is the suggested approach instead.
- **No PLECS-XML → JSON converter** — new switching devices currently have to be converted by hand (or with your own script) into the schema used in `smps_database.json`; see [Adding Switching Devices](#adding-switching-devices-plecs-export). Automating this conversion, and automatically merging files from `dataset/switches/` into `smps_database.json`, is on the roadmap.
- **The `falstad/` directory** — compiled with Java/GWT, it's an app independent of the rest of the project; it isn't part of the same build process as the JS/HTML tooling in this repo and needs to be maintained separately.

## Security Notes

- The `apiKey` in `assets/js/common/firebase_config.js` is a Firebase **web** API key, and it's meant to be visible in the browser — it isn't a secret. Actual access control is enforced through Firestore/Cloud Functions security rules. This is called out specifically so contributors don't panic thinking the "API key has leaked."
- No service account JSON file or other secret key is included in the repo.
- `.gitignore` excludes `node_modules/`, `.firebase/`, `.env`, and `.vs/` (Visual Studio local workspace state) from commits — if your local development creates files with sensitive info, make sure they stay covered by `.gitignore`.

## Contributing

1. Fork / clone this repo.
2. When adding a new topology page or feature, follow the existing pattern: keep the calculation logic in its own file under `assets/js/topologies/`, and reuse the shared UI/optimization logic under `assets/js/common/`.
3. When adding a new topology, don't forget to add the matching D1/D2 logic both in the `topology` detection block in `advanced_optimizer.js` and in the `getEffectiveWaveformParams` function on the backend (see [Architecture](#architecture)) — otherwise results silently fall back to the "Low Confidence" default.
4. New code that needs a Firebase call should go through `window.apiService`, not `firebase.app().functions(...)` directly.
5. Adding a new switching device? See [Adding Switching Devices](#adding-switching-devices-plecs-export) and drop it in `dataset/switches/`.
6. Open a pull request describing your changes.
