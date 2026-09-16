![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)

# FitCore SMPS Calculation & Design Suite

**🚀 Live Demo:** [www.ataqileriteknoloji.com](https://www.ataqileriteknoloji.com)

A light browser-based calculation, optimization, and circuit-simulation tool for switch-mode power supply (SMPS) topologies. It includes 18 topology pages, a magnetics (coil/transformer) optimization engine running on Firebase Cloud Functions, a custom thermal-analysis simulation based on the actual selected components, and an embedded Falstad/CircuitJS circuit simulator.

> **📸 Screenshots:**  
<img width="1919" height="831" alt="Ekran görüntüsü 2026-09-13 005910" src="https://github.com/user-attachments/assets/690261c7-a6bc-463b-9ae3-a08a894749a2" />

<img width="515" height="748" alt="Ekran görüntüsü 2026-09-13 005903" src="https://github.com/user-attachments/assets/81648b7a-e307-4ba4-ab4f-fa6c87008d5b" />

<img width="1263" height="846" alt="Ekran görüntüsü 2026-09-13 024601" src="https://github.com/user-attachments/assets/60865226-e3f9-4352-90c9-43364a2ff74a" />

## Contents

* [Features](#features)
* [Architecture](#architecture)
* [Project Structure](#project-structure)
* [Setup](#setup)
* [Running the Firebase Functions](#running-the-firebase-functions)
* [Supported Topologies](#supported-topologies)
* [Adding Switching Devices (PLECS Export)](#adding-switching-devices-plecs-export)
* [Languages](#languages)
* [Known Limitations / Roadmap](#known-limitations--roadmap)
* [Security Notes](#security-notes)
* [Contributing](#contributing)
* [References & Data Sources](#references--data-sources)
* [License](#license)

## Features

* **18 topology calculators** — separate pages for Buck, Boost, Two-Phase Interleaved Boost, Buck-Boost, Ćuk, SEPIC, Zeta, Flyback, Forward (single/double transistor), Half-Bridge, Full-Bridge, LLC (Half/Full), DAB, PFC, transformer, and inductor design.
* **Cloud-based magnetics optimization** — the `runSmpsOptimization` Cloud Function, running on Firebase Cloud Functions, picks the best combination from the core and wire database using fuzzy-weighted cost/efficiency/size targets, with per-topology duty-cycle (D1/D2) assumptions applied correctly (see [Architecture](#architecture)).
* **Hybrid AC Winding Resistance Modeling** — Computes high-frequency skin and proximity losses using a physically grounded hybrid algorithm. It applies the classical 1D Dowell method for solid round wires, integrates Geng et al.'s equations for Litz wire implementations, and applies Holguin et al.'s geometrical corrections to account for 2D fringing fields in gapped magnetic components. Edge effects and orthogonal field components are factored in for robust accuracy.
* **Monte Carlo Tolerance Analysis** — run 1000-iteration statistical simulations to evaluate the impact of manufacturing tolerances (e.g., ±10-20% on core loss, switching loss, conduction loss, and thermal resistance) on thermal performance and magnetic saturation. Results are instantly exportable as CSV for yield and reliability analysis.
* **3D core visualization** — a 3D render of the selected magnetic core via Three.js.
* **Custom thermal analysis simulation** — a thermal test that runs against the core/switch combination actually selected by the optimizer, triggered from a separate modal (`window.openCustomThermalModal`) and downloadable as CSV.
* **Embedded circuit simulator** — a live Falstad/CircuitJS circuit simulation can be opened from any topology page (the `falstad/` directory is a separate Java/GWT app).
* **Multilingual UI** — Turkish, English, and German translations (`assets/js/common/language.js`).
* **Contact form** — a simple PHPMailer-based contact form (`forms/contact.php`).

## Architecture

The project is a **build-tool-free** (no Vite/Webpack) multi-page static site combined with a serverless backend:

```text
Browser (18 HTML pages)
│
├─ assets/js/common/firebase_config.js   → initializes the Firebase SDK
├─ assets/js/common/api_service.js       → the SINGLE entry point for all Cloud Functions calls
├─ assets/js/common/advanced_optimizer.js → UI logic, 3D render, thermal test, table/export;
│                                          also reachable through the window.SMPSApp namespace
├─ assets/js/topologies/*.js             → per-topology electrical calculation formulas
└─ falstad/                              → embedded circuit simulator (standalone GWT app)
│
▼ (HTTPS Callable)
Firebase Cloud Functions (assets/js/functions/index.js)
└─ runSmpsOptimization  → optimizes against the core/wire data in smps_database.json,
   using topology-specific D1/D2 waveform assumptions for the iGSE core-loss calculation
   and a hybrid Dowell/Geng/Holguin algorithm (`getDowellRacFactor`) for AC copper losses.

```

### Topology detection and D1/D2 assumptions

`advanced_optimizer.js` detects which topology the page is for from the page title (`document.title`) — via `isBuck`, `isBoost`, `isInterleavedBoost`, `isBuckBoost`, `isFlyback`, `isForward`, `isPushPull`, `isBridge`, `isPfc` — and sends it to the server as a `topology` field (`"buck"`, `"boost"`, `"interleavedboost"`, `"buckboost"`, `"flyback"`, `"forward"`, `"pushpull"`, `"bridge"`, `"llc"`, `"dab"`). On the Cloud Function side, `getEffectiveWaveformParams` uses that value to pick the D1/D2 waveform parameters and the confidence level used in the iGSE calculation — for example, Buck/Boost use the actual switching duty cycle (`D_switch`) directly, while Bridge/LLC/DAB use values computed from the symmetric or resonant operating condition. If `topology` is missing or wrong, the server falls back to `D1=D2=0.5` and flags the result as "Low Confidence" — make sure this mapping is done correctly when adding a new topology page.

### Why global `window.X` is used

Because the inline `onclick="..."` handlers on the pages depend directly on global functions, the project doesn't currently use ES Modules (`import`/`export`). Instead:

* Every function is still defined as `window.functionName` (for backward compatibility, so `onclick` doesn't break).
* At the end of `advanced_optimizer.js`, a single namespace object called **`window.SMPSApp`** is created, and all the important functions/state are also collected there. Calling something like `window.SMPSApp.executeAdvancedOptimization()` in new code makes it clear which functions are considered part of the "public API."
* A full move to ES Modules would mean converting every inline handler across the 19 HTML pages to `addEventListener`, which is a bigger separate refactor — see the roadmap below.

## Project Structure

```text
.
├── *.html                       # 21 pages: 18 topologies + index + filter + help
├── Web.config                   # request/build settings for the IIS static file server
├── assets/
│   ├── css/                     # design.css, style.css
│   ├── img/                     # images
│   ├── js/
│   │   ├── common/              # shared logic
│   │   │   ├── firebase_config.js # Firebase SDK init (public API key — see Security Notes)
│   │   │   ├── api_service.js     # central service layer for Cloud Functions calls
│   │   │   ├── advanced_optimizer.js # UI, 3D render, thermal test, table/export, window.SMPSApp namespace
│   │   │   ├── language.js        # TR/EN/DE translation dictionary
│   │   │   ├── ui_modal.js
│   │   │   └── smps_filter.js
│   │   ├── topologies/          # per-topology electrical calculation file (buck.js, boost.js ...)
│   │   ├── filters/             # filter1.js
│   │   └── functions/           # Firebase Cloud Functions (Node.js 22)
│   │       ├── index.js         # runSmpsOptimization callable function, D1/D2 assumption logic
│   │       ├── smps_database.json  # core/wire/magnetic-material/switch database
│   │       ├── package.json
│   │       ├── firebase.json
│   │       └── .firebaserc      # Firebase project ID
│   └── vendor/                  # Bootstrap, Swiper, AOS, GLightbox, Isotope, Typed.js
├── dataset/
│   └── switches/                # staging folder for new switch entries — see below
├── falstad/                     # embedded Falstad/CircuitJS circuit simulator (Java/GWT, separate app)
├── forms/
│   ├── contact.php              # contact-form backend using PHPMailer
│   └── phpmailler/              # PHPMailer library
└── .gitignore                   # excludes node_modules, .env, .firebase/, .vs/, etc.

```

## Setup

### Requirements

* A static file server (the project needs no build tool; opening `index.html` directly from an HTTP server is enough — don't open it via `file://`, the Firebase SDK and module loading may fail due to CORS). If you're running this on Windows/IIS, the `Web.config` at the root already has the request-size and build settings you need.
* Node.js 22 (only if you want to run/deploy the Cloud Functions locally).
* A Firebase project (only if you want to run your own optimization backend).

### Quick start (frontend only)

```bash
# Open with any simple static server, e.g.:
npx serve .
# or
python3 -m http.server 8080

```

Then go to `http://localhost:8080/index.html` in your browser.

> Note: the `apiKey` in `assets/js/common/firebase_config.js` is a public Firebase **web** API key — see [Security Notes](https://www.google.com/search?q=%23security-notes). If you want to point this at your own Firebase project, replace the `firebaseConfig` object in that file with your own project's details.

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
| --- | --- |
| `buck.html` | Buck |
| `boost.html` | Boost |
| `interleaved-boost.html` | Two-Phase Interleaved Boost |
| `buck-boost.html` | Buck-Boost |
| `cuk.html` | Ćuk |
| `sepic.html` | SEPIC |
| `zeta.html` | Zeta |
| `flyback.html` | Flyback |
| `single.html` | Single-Transistor Forward |
| `two-transistor.html` | Two-Transistor Forward |
| `half-bridge.html` | Half-Bridge Push-Pull |
| `full-bridge.html` | Full-Bridge Push-Pull |
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

* **No Automated Testing:** Currently, there are no automated E2E or unit tests included. Setting up a test suite for the UI logic and Cloud Functions is a high priority on the roadmap.
* **No ES Modules:** Functions are defined globally on `window` (see [Architecture](https://www.google.com/search?q=%23architecture)). This is partly tidied up by the `window.SMPSApp` namespace, but a full `import`/`export` migration is a separate, bigger refactor that requires converting every `onclick` handler across the 19 HTML pages to `addEventListener`.
* **No build tool:** Vite/Webpack aren't used; dependencies (like Three.js) are loaded via `<script>` tags or dynamic `document.createElement('script')`. This can occasionally cause rare race-condition errors on slow connections.
* **Inline HTML templates:** Some functions, like `openAdvancedTable` and `openCustomThermalModal`, contain long template literals. Splitting these into separate `.html` files and `fetch`-ing them was deliberately avoided without a build tool, since that would break under `file://` due to CORS; breaking them into smaller `renderX()` functions is the suggested approach instead.
* **No PLECS-XML → JSON converter:** New switching devices currently have to be converted by hand (or with your own script) into the schema used in `smps_database.json`; see [Adding Switching Devices](https://www.google.com/search?q=%23adding-switching-devices-plecs-export). Automating this conversion, and automatically merging files from `dataset/switches/` into `smps_database.json`, is on the roadmap.
* **The `falstad/` directory:** Compiled with Java/GWT, it's an app independent of the rest of the project; it isn't part of the same build process as the JS/HTML tooling in this repo and needs to be maintained separately.

## Security Notes

* The `apiKey` in `assets/js/common/firebase_config.js` is a Firebase **web** API key, and it's meant to be visible in the browser — it isn't a secret. Actual access control is enforced through Firestore/Cloud Functions security rules. This is called out specifically so contributors don't panic thinking the "API key has leaked."
* No service account JSON file or other secret key is included in the repo.
* `.gitignore` excludes `node_modules/`, `.firebase/`, `.env`, and `.vs/` (Visual Studio local workspace state) from commits — if your local development creates files with sensitive info, make sure they stay covered by `.gitignore`.

## Contributing

1. Fork / clone this repo.
2. When adding a new topology page or feature, follow the existing pattern: keep the calculation logic in its own file under `assets/js/topologies/`, and reuse the shared UI/optimization logic under `assets/js/common/`.
3. When adding a new topology, don't forget to add the matching D1/D2 logic both in the `topology` detection block in `advanced_optimizer.js` and in the `getEffectiveWaveformParams` function on the backend (see [Architecture](https://www.google.com/search?q=%23architecture)) — otherwise results silently fall back to the "Low Confidence" default.
4. New code that needs a Firebase call should go through `window.apiService`, not `firebase.app().functions(...)` directly.
5. Adding a new switching device? See [Adding Switching Devices](https://www.google.com/search?q=%23adding-switching-devices-plecs-export) and drop it in `dataset/switches/`.
6. Open a pull request describing your changes.

## References & Data Sources

The calculations, methodologies, and default datasets within this suite are based on the following literature and engineering datasheets:

* Abdel-Rahman, S. (2012). *Resonant LLC converter: Operation and design* (Application Note AN 2012-09 V1.0). Infineon Technologies North America.
* Adragna, C. (2000). *Minimize power losses of lightly loaded flyback converters with the L5991 PWM controller* (Application Note AN1049). STMicroelectronics.
* Adragna, C. (2001). *Offline flyback converters design methodology with the L6590 family* (Application Note AN1262). STMicroelectronics.
* Attanasio, R. (2012). *AN4070 application note: 250 W grid connected microinverter*. STMicroelectronics.
* Barg, S., & Bertilsson, K. (2021). Core loss calculation of symmetric trapezoidal magnetic flux density waveform. *IEEE Open Journal of Power Electronics*, 2, 446–455. [https://doi.org/10.1109/OJPEL.2021.3099908](https://doi.org/10.1109/OJPEL.2021.3099908)
* Barry, B. C., Hayes, J. G., & Rylko, M. S. (2014). CCM and DCM operation of the interleaved two-phase boost converter with discrete and coupled inductors. *IEEE Transactions on Power Electronics*. [https://doi.org/10.1109/TPEL.2014.2386778](https://doi.org/10.1109/TPEL.2014.2386778)
* Basso, C. P. (2008). *Switch-mode power supplies: SPICE simulations and practical designs*. McGraw-Hill.
* Betten, J. (2011). Benefits of a coupled-inductor SEPIC converter. *Analog Applications Journal*, 20, 14–17. Texas Instruments.
* Billings, K., & Morey, T. (2010). *Switchmode power supply handbook* (3rd ed.). McGraw-Hill Education.
* Bityukov, V. K., & Lavrenov, A. I. (2025). Method for designing DC/DC converters based on Zeta topology. *Russian Technological Journal*, 13(1), 59–67. [https://doi.org/10.32362/2500-316X-2025-13-1-59-67](https://doi.org/10.32362/2500-316X-2025-13-1-59-67)
* Boyar, A., & Kabalci, E. (2018). Design and analysis of a two-phase interleaved boost converter based microinverter. *2018 IEEE*.
* Chen, J., Li, L., Zhang, Z., Yao, K., Guan, C., & Ma, C. (2019). Segmented constant-on-time control method for CRM Buck-Buck/Boost PFC converter. *2019 IEEE Energy Conversion Congress and Exposition (ECCE)*, 1520–1526. [https://doi.org/10.1109/ECCE.2019.8912213](https://doi.org/10.1109/ECCE.2019.8912213)
* Choudhary, V., & Bell, R. (2011). *Designing non-inverting buck-boost (Zeta) converters with a buck P-FET controller* (Literature No. SNVA608). Texas Instruments.
* Dash, K. M., Satapathy, S., & Babu, B. C. (2013). *Simulation analysis of Zeta converter with continuous and discontinuous conduction modes*. PESA.
* Ferroxcube. (2013). *Soft ferrites E cores and accessories* (Data Sheet MFP226).
* Geng, S., Lu, H., Chu, M., Wang, W., Wan, P., Li, P., & Peng, X. (2021). Modelling and optimization of winding resistance for litz wire inductors. *IET Power Electronics*, 14(11), 1834–1843. [https://doi.org/10.1049/pel2.12152](https://doi.org/10.1049/pel2.12152)
* Gottlieb, I. (1993). *Power supplies: Switching regulators, inverters, and converters* (1st ed.). McGraw-Hill/TAB Electronics.
* Green, P. B., Naraharisetti, K., Fan, W., & Alvarez, I. (2020). *100 W single-stage CrCM PFC Flyback converter using the IRS2982S and IR1161L* (Application Note AN_1909_PL88_1909_005304). Infineon Technologies AG.
* Holguín, F. A., Asensi, R., Prieto, R., & Cobos, J. A. (2014). Simple analytical approach for the calculation of winding resistance in gapped magnetic components. *2014 IEEE Applied Power Electronics Conference and Exposition - APEC 2014*, 1944-1950. [https://doi.org/10.1109/APEC.2014.6803572](https://doi.org/10.1109/APEC.2014.6803572)
* Hua, J. (2019). *Output noise filtering for DC/DC power modules* (Application Report SNVA871). Texas Instruments.
* Jørgensen, A. B. (2021). Derivation, design and simulation of the Zeta converter. *TechRxiv*. [https://doi.org/10.36227/techrxiv.16732825.v1](https://doi.org/10.36227/techrxiv.16732825.v1)
* Maniktala, S. (2012). *Switching power supplies A - Z*. McGraw-Hill Education.
* Mappus, S. (2014). *Power converter topology trends*. Texas Instruments.
* MLD Group. (2023). *Simplified analysis and design of series-resonant LLC half-bridge converters*. STMicroelectronics Off-line SMPS BU Application Lab.
* Mohan, N., Undeland, T. M., & Robbins, W. P. (1995). *Power electronics: Converters, applications, and devices* (2nd ed.). John Wiley & Sons.
* Mühlethaler, J., Biela, J., Kolar, J. W., & Ecklebe, A. (2012). Improved core-loss calculation for magnetic components employed in power electronic systems. *IEEE Transactions on Power Electronics*, 27(2), 964–973. [https://doi.org/10.1109/TPEL.2011.2162252](https://doi.org/10.1109/TPEL.2011.2162252)
* Novak, M., Sangwongwanich, A., & Blaabjerg, F. (2021). Monte Carlo-based reliability estimation methods for power devices in power electronics systems. *IEEE Open Journal of Power Electronics*, 2, 523–534. [https://doi.org/10.1109/OJPEL.2021.3116070](https://doi.org/10.1109/OJPEL.2021.3116070)
* Obeidat, F. (n.d.). *Electric circuits II: Magnetically coupled circuits*. Philadelphia University.
* ON Semiconductor. (2014). *Power factor correction (PFC) handbook: Choosing the right power factor controller solution* (HBD853/D Rev. 5).
* Onay, H., Süel, V., Özgen, T., & Hava, A. (2019). Comparative power loss analysis of DCM flyback transformer based on FEA, numeric simulation, calculation and measurements. *EPE'19 ECCE Europe*. [https://doi.org/10.23919/EPE.2019.8914811](https://doi.org/10.23919/EPE.2019.8914811)
* onsemi. (2021). *SEPIC converter analysis and design* (Application Note AND90136/D Rev. 1). Semiconductor Components Industries, LLC.
* Plexim GmbH. (2026). *PLECS user manual: Thermal modeling*. [https://www.plexim.com/](https://www.plexim.com/)
* Pranjić, F., & Virtič, P. (2024). Analysis of the operational reliability of different types of switching substations using the Monte Carlo method. *Energies*, 17(13), 3142. [https://doi.org/10.3390/en17133142](https://doi.org/10.3390/en17133142)
* Rashid, M. H. (Ed.). (2023). *Power electronics handbook* (5th ed.). Academic Press.
* Ridley Engineering. (2025). *SEPIC converter analysis*. [https://ridleyengineering.com/](https://ridleyengineering.com/)
* Robert, F., Mathys, P., & Schauwers, J. P. (1998). Ohmic losses calculation in SMPS transformers: numerical study of Dowell's approach accuracy. *IEEE Transactions on Magnetics*, 34(4), 1255–1257. [https://doi.org/10.1109/20.706513](https://doi.org/10.1109/20.706513)
* Rogers, E. (1999). *Understanding buck power stages in switchmode power supplies* (Application Report SLVA057). Texas Instruments.
* Sarkawi, H., Ohta, Y., & Rapisarda, P. (2021). On the switching control of the DC-DC Zeta converter operating in continuous conduction mode. *IET Control Theory & Applications*.
* Scibilia, R. (n.d.). *Magnetics in SMPS basics*. Texas Instruments.
* Sclocchi, M. (2011). *Input filter design for switching power supplies* (Literature No. SNVA538). Texas Instruments.
* Shao, S., Chen, L., Shan, Z., Gao, F., Chen, H., Sha, D., & Dragičević, T. (2021). Modeling and advanced control of dual active bridge DC-DC converters: A review. *IEEE Transactions on Power Electronics*, 37(2), 1524–1547. [https://doi.org/10.1109/TPEL.2021.3108157](https://doi.org/10.1109/TPEL.2021.3108157)
* Sivonen, M. (2025). *Design of dual active bridge transformer for high frequency switching applications*.
* TDK. (2019). *LLC resonance power transformers: Pin terminal type SRX/SRV series* (Data Sheet trans_ac_dc-converter_srx_srv_en.f).
* Texas Instruments. (2015). *LM2611 1.4-MHz Cuk converter* (Data Sheet SNOS965J).
* Texas Instruments. (2020). *Peak efficiency at 99%, 585-W high-voltage buck reference design with standard Si-MOSFETs* (Test Report TIDT177).
* Texas Instruments. (2024). *Bidirectional, dual active bridge reference design for level 3 electric vehicle charging stations* (TIDA-010054; Rev. E).
* Tuztasi, F. M., Yildiz, A. B., & Kelebek, H. (2022). Modeling and analysis of DC-DC CUK converter with coupled inductors. *WSEAS Transactions on Circuits and Systems*, 21, 188–192. [https://doi.org/10.37394/23201.2022.21.21](https://doi.org/10.37394/23201.2022.21.21)
* Vitorino, M. A., Bento, A. A. M., Fernandes, D. A., & Corrêa, M. B. R. (2013). Design of boost converter operating in CRM controlled by OCC. *COBEP 2013*, 440–447. [https://doi.org/10.1109/COBEP.2013.6785153](https://doi.org/10.1109/COBEP.2013.6785153)
* Wang, Y., Liu, X., & Li, J. (2026). Improved equations for core loss prediction under asymmetric triangular excitation waveforms based on improved generalized Steinmetz equation. *Journal of Magnetism and Magnetic Materials*.
* Wu, D., Wang, P., Lyu, Y., Andersen, M. A. E., & Ouyang, Z. (2024). A high efficiency and high power density partial power Buck-Boost converter. *IEEE Journal of Emerging and Selected Topics in Power Electronics*, 12(4), 3563–3573. [https://doi.org/10.1109/JESTPE.2024.3406132](https://doi.org/10.1109/JESTPE.2024.3406132)
* Wu, R., Wang, H., Ma, K., Ghimire, P., Iannuzzo, F., & Blaabjerg, F. (2014). A temperature-dependent thermal model of IGBT modules suitable for circuit-level simulations. *2014 IEEE Energy Conversion Congress and Exposition (ECCE)*, 2901–2908. [https://doi.org/10.1109/ECCE.2014.6953793](https://doi.org/10.1109/ECCE.2014.6953793)
* Würth Elektronik. (2026). *SEPIC converter design and calculation*. Passive Components Blog. [https://passive-components.eu/sepic-converter-design-and-calculation/](https://passive-components.eu/sepic-converter-design-and-calculation/)
* Yang, Z., Tahir, M., Hu, S., Huang, Q., & Zhu, H. (2022). Transformer leakage inductance calculation method with experimental validation for CLLLC converter topology. *Energies*, 15(18), 6801. [https://doi.org/10.3390/en15186801](https://doi.org/10.3390/en15186801)

### Core & Semiconductor Data

The ferrite core recommendations implemented in ATAQ Fitcore SMPS Designer are generated using manufacturer ferrite core data, the Magnetic Attribute System (MAS) database, and established transformer design references. Suggested cores are engineering approximations and should be verified against manufacturer specifications for production designs.

* Hirschmann, W., & Hauenstein, G. *Schaltnetzteile*.
* Infineon Technologies. (n.d.). *OptiMOS 5 30-25 V simulation models*. Design Resources. [https://www.infineon.com/product-table/optimos-5-25v-30v](https://www.infineon.com/product-table/optimos-5-25v-30v)
* Infineon Technologies. (n.d.). *OptiMOS 6 100 V simulation models*. Design Resources. [https://www.infineon.com/products/power/mosfet/n-channel/optimos-strongirfet/optimos-6/optimos-6-100v?tab=simmodels](https://www.infineon.com/products/power/mosfet/n-channel/optimos-strongirfet/optimos-6/optimos-6-100v?tab=simmodels)
* Infineon Technologies. (n.d.). *Power MOSFET simulation models*. Design Resources. [https://www.infineon.com/design-resources/simulation-modeling/power-mosfet-simulation-models](https://www.infineon.com/design-resources/simulation-modeling/power-mosfet-simulation-models)
* Kories, R., & Schmidt-Walter, H. (2017). *Electrical Engineering: A Pocket Reference*. Artech House.
* Paderborn University LEA (Power Electronics). (2026). *transistordatabase: Open-source power semiconductor database project*. GitHub. [https://github.com/upb-lea/transistordatabase](https://github.com/upb-lea/transistordatabase)
* Paderborn University LEA (Power Electronics). (2026). *transistordatabase_File_Exchange: Data sharing repository*. GitHub. [https://github.com/upb-lea/transistordatabase_File_Exchange](https://github.com/upb-lea/transistordatabase_File_Exchange)
* Power Supply Manufacturers Association. (2026). *Magnetic Attribute System (MAS) – Core Database*. GitHub. [https://github.com/Power-Supply-Manufacturers-Association/MAS/tree/main/data](https://github.com/Power-Supply-Manufacturers-Association/MAS/tree/main/data)
* Wolfspeed. (2026). *LTspice and PLECS simulation models*. Design Resources. [https://www.wolfspeed.com/tools-and-support/power/ltspice-and-plecs-models](https://www.wolfspeed.com/tools-and-support/power/ltspice-and-plecs-models)

> **⚠️ Disclaimer:** Calculations, component recommendations and magnetic core suggestions are provided as engineering estimates based on published design methods, manufacturer data and open-source databases. Final verification and validation remain the responsibility of the design engineer.

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL v3)](https://www.google.com/search?q=LICENSE).
Copyright © ATAQ İleri Teknoloji. All rights reserved.

```

```
