# dataset/switches/

Drop-in folder for new switching-device (MOSFET/IGBT/SiC/diode) entries before they get merged into
`assets/js/functions/smps_database.json`.

## Why this folder exists

`smps_database.json` is a single, hand-maintained JSON file that already contains hundreds of switch
entries (see the `switches` array). Editing that file directly for every new device is error-prone —
it's easy to break the JSON or clobber someone else's entry. Instead:

1. Export the device's thermal/electrical description from **PLECS** (Manufacturer Thermal Description,
   XML format) — PLECS ships this export option from its thermal-database editor for any
   MOSFET/IGBT/diode model.
2. Convert that XML into one JSON file per device, matching the schema already used in the `switches`
   array of `smps_database.json` (fields such as `name`, `manufacturer`, `type`, `v_abs_max`, `i_abs_max`,
   `i_cont`, `housing_type`, and the `switch` / `diode` blocks with `channel`, `e_on`, `e_off`, and
   `thermal_foster` curves).
3. Save the converted file here as `dataset/switches/<manufacturer>_<part_number>.json`.
4. Open a pull request. A maintainer (or a future merge script — see the main README's roadmap) folds it
   into `smps_database.json`'s `switches` array.

## Notes

- There is currently **no automated PLECS-XML → JSON converter in this repo**; the existing entries were
  produced with an offline script (tagged `"author": "XML_Parser"` in the data) that isn't part of this
  codebase yet. Until one is added, converting by hand (or with your own script) and matching the schema
  is the expected path — see an existing entry in `smps_database.json` for the exact field layout.
- Keep one device per file so reviews and diffs stay readable.
- This folder is a staging area, not something the app reads directly at runtime — only the merged
  `smps_database.json` is loaded by the Cloud Function.
