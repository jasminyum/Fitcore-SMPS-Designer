# falstad/ — Third-Party Code & Licensing

## Scope of this notice

This notice applies only to the contents of the `falstad/` directory. It
does **not** apply to the rest of the FitCore repository, which is
licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
(see the `LICENSE` file at the repository root).

## Why this code is not covered by FitCore's AGPL-3.0 license

The code in this directory is not original work authored by the FitCore
project. It is a browser-based circuit simulation environment built from
two separate third-party open-source projects, each under its own
license:

- **CircuitJS1** (`circuitjs1/` and related build output), originally
  written by Paul Falstad as a Java applet and adapted to run in the
  browser (via GWT) by Iain Sharp. Licensed under the
  **GNU General Public License v2.0 (GPL-2.0)**.
  Source: https://github.com/sharpie7/circuitjs1
  Original: https://github.com/pfalstad/circuitjs1
  License text: https://github.com/pfalstad/circuitjs1/blob/master/COPYING.txt

- **AVR8js** (`avr8js/`, `avr8js-build/`), an AVR microcontroller
  simulator developed by Wokwi. Licensed under the **MIT License**.
  Source: https://github.com/wokwi/avr8js
  License text: https://github.com/wokwi/avr8js/blob/master/LICENSE

These two projects are combined here to provide interactive, in-browser
circuit and microcontroller simulation for FitCore's design examples.
Each retains its own upstream license; using or redistributing the
contents of this directory is governed by the terms above, not by
FitCore's AGPL-3.0 license.

## Practical implications

- **CircuitJS1 (GPL-2.0)**: any modified version of this code that is
  distributed, or run as a network service, must make its corresponding
  source available under GPL-2.0 terms to those who interact with it.
- **AVR8js (MIT)**: permissive — may be used, modified, and
  redistributed with attribution and inclusion of the MIT license text.

## Attribution

CircuitJS1 was created by Paul Falstad and adapted for the browser by
Iain Sharp, with contributions from numerous other developers credited
in the upstream repository. AVR8js was created by Wokwi.

No claim of authorship over this third-party code is made by the
FitCore project or its contributors.
