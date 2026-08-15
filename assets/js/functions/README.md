# Dataset — Data Sources & Licensing

## Scope of this notice

This notice applies only to the contents of the `functions/` directory
(magnetic core, core shape, bobbin, wire, and semiconductor data used by
FitCore). It does **not** apply to the FitCore source code, which is
licensed separately under Apache License 2.0 (see the `LICENSE` file at
the repository root).

## Why this data is not covered by the Apache 2.0 license

The data in this directory is not original work authored by the FitCore
project. It has been compiled and derived from:

- **OpenMagnetics / the Magnetic Attribute System (MAS) core database**,
  maintained by the Power Supply Manufacturers Association
- **Manufacturer datasheets** (ferrite core, bobbin, wire, and
  semiconductor manufacturers)
- **Open-source power semiconductor databases** (Paderborn University
  LEA's `transistordatabase` project)
- **Published technical references and textbooks** on power electronics
  and magnetics design

Because the underlying data originates from these third-party sources —
each with their own terms, and in the case of manufacturer datasheets,
copyright held by the respective manufacturers — it cannot be relicensed
under Apache 2.0 by the FitCore project. Anyone wishing to reuse or
redistribute this dataset should consult the original sources listed
below for their applicable terms.

## Core & Semiconductor Data

The ferrite core recommendations implemented in ATAQ FitCore SMPS
Designer are generated using manufacturer ferrite core data, the
Magnetic Attribute System (MAS) database, and established transformer
design references. Suggested cores are engineering approximations and
should be verified against manufacturer specifications for production
designs.

- Power Supply Manufacturers Association. (2026). *Magnetic Attribute
  System (MAS) – Core Database*. GitHub.
  https://github.com/Power-Supply-Manufacturers-Association/MAS/tree/main/data
- Hirschmann, W., & Hauenstein, G. *Schaltnetzteile*.
- Kories, R., & Schmidt-Walter, H. (2017). *Electrical Engineering: A
  Pocket Reference*. Artech House.
- Infineon Technologies. (n.d.). *Power MOSFET simulation models*.
  Design Resources.
  https://www.infineon.com/design-resources/simulation-modeling/power-mosfet-simulation-models
- Infineon Technologies. (n.d.). *OptiMOS 5 30-25 V simulation models*.
  Design Resources.
  https://www.infineon.com/product-table/optimos-5-25v-30v
- Infineon Technologies. (n.d.). *OptiMOS 6 100 V simulation models*.
  Design Resources.
  https://www.infineon.com/products/power/mosfet/n-channel/optimos-strongirfet/optimos-6/optimos-6-100v?tab=simmodels
- Wolfspeed. (2026). *LTspice and PLECS simulation models*. Design
  Resources.
  https://www.wolfspeed.com/tools-and-support/power/ltspice-and-plecs-models
- Paderborn University LEA (Power Electronics). (2026).
  *transistordatabase: Open-source power semiconductor database
  project*. GitHub. https://github.com/upb-lea/transistordatabase
- Paderborn University LEA (Power Electronics). (2026).
  *transistordatabase_File_Exchange: Data sharing repository*. GitHub.
  https://github.com/upb-lea/transistordatabase_File_Exchange

## References

Abdel-Rahman, S. (2012). *Resonant LLC converter: Operation and design*
(Application Note AN 2012-09 V1.0). Infineon Technologies North America.

Adragna, C. (2000). *Minimize power losses of lightly loaded flyback
converters with the L5991 PWM controller* (Application Note AN1049).
STMicroelectronics.

Adragna, C. (2001). *Offline flyback converters design methodology with
the L6590 family* (Application Note AN1262). STMicroelectronics.

Attanasio, R. (2012). *AN4070 application note: 250 W grid connected
microinverter*. STMicroelectronics.

Betten, J. (2011). Benefits of a coupled-inductor SEPIC converter.
*Analog Applications Journal*, 20, 14–17. Texas Instruments.

Billings, K., & Morey, T. (2010). *Switchmode power supply handbook*
(3rd ed.). McGraw-Hill Education.

Bityukov, V. K., & Lavrenov, A. I. (2025). Method for designing DC/DC
converters based on Zeta topology. *Russian Technological Journal*,
*13*(1), 59–67. https://doi.org/10.32362/2500-316X-2025-13-1-59-67

Chen, J., Li, L., Zhang, Z., Yao, K., Guan, C., & Ma, C. (2019).
Segmented constant-on-time control method for CRM Buck-Buck/Boost PFC
converter. *2019 IEEE Energy Conversion Congress and Exposition
(ECCE)*, 1520–1526. https://doi.org/10.1109/ECCE.2019.8912213

Choudhary, V., & Bell, R. (2011). *Designing non-inverting buck-boost
(Zeta) converters with a buck P-FET controller* (Literature No.
SNVA608). Texas Instruments.

Dash, K. M., Satapathy, S., & Babu, B. C. (2013). *Simulation analysis
of Zeta converter with continuous and discontinuous conduction modes*.
PESA.

Ferroxcube. (2013). *Soft ferrites E cores and accessories* (Data Sheet
MFP226).

Gottlieb, I. (1993). *Power supplies: Switching regulators, inverters,
and converters* (1st ed.). McGraw-Hill/TAB Electronics.

Green, P. B., Naraharisetti, K., Fan, W., & Alvarez, I. (2020). *100 W
single-stage CrCM PFC Flyback converter using the IRS2982S and IR1161L*
(Application Note AN_1909_PL88_1909_005304). Infineon Technologies AG.

Hua, J. (2019). *Output noise filtering for DC/DC power modules*
(Application Report SNVA871). Texas Instruments.

Jørgensen, A. B. (2021). Derivation, design and simulation of the Zeta
converter. *TechRxiv*. https://doi.org/10.36227/techrxiv.16732825.v1

Maniktala, S. (2012). *Switching power supplies A - Z*. McGraw-Hill
Education.

Mappus, S. (2014). *Power converter topology trends*. Texas
Instruments.

MLD Group. (2023). *Simplified analysis and design of series-resonant
LLC half-bridge converters*. STMicroelectronics Off-line SMPS BU
Application Lab.

Mohan, N., Undeland, T. M., & Robbins, W. P. (1995). *Power
electronics: Converters, applications, and devices* (2nd ed.). John
Wiley & Sons.

Obeidat, F. (n.d.). *Electric circuits II: Magnetically coupled
circuits*. Philadelphia University.

ON Semiconductor. (2014). *Power factor correction (PFC) handbook:
Choosing the right power factor controller solution* (HBD853/D Rev.
5).

Onay, H. A., Süel, V., Özgen, T., & Hava, A. (2019). Comparative power
loss analysis of DCM flyback transformer based on FEA, numeric
simulation, calculation and measurements. *EPE'19 ECCE Europe*.
https://doi.org/10.23919/EPE.2019.8914811

onsemi. (2021). *SEPIC converter analysis and design* (Application
Note AND90136/D Rev. 1). Semiconductor Components Industries, LLC.

Rashid, M. H. (Ed.). (2023). *Power electronics handbook* (5th ed.).
Academic Press.

Ridley Engineering. (2025). *SEPIC converter analysis*.
https://ridleyengineering.com/

Rogers, E. (1999). *Understanding buck power stages in switchmode
power supplies* (Application Report SLVA057). Texas Instruments.

Sarkawi, H., Ohta, Y., & Rapisarda, P. (2021). On the switching control
of the DC-DC Zeta converter operating in continuous conduction mode.
*IET Control Theory & Applications*.

Scibilia, R. (n.d.). *Magnetics in SMPS basics*. Texas Instruments.

Sclocchi, M. (2011). *Input filter design for switching power
supplies* (Literature No. SNVA538). Texas Instruments.

Shao, S., Chen, L., Shan, Z., Gao, F., Chen, H., Sha, D., & Dragičević,
T. (2021). Modeling and advanced control of dual active bridge DC-DC
converters: A review. *IEEE Transactions on Power Electronics*, 37(2),
1524–1547. https://doi.org/10.1109/TPEL.2021.3108157

Sivonen, M. (2025). *Design of dual active bridge transformer for high
frequency switching applications*.

TDK. (2019). *LLC resonance power transformers: Pin terminal type
SRX/SRV series* (Data Sheet trans_ac_dc-converter_srx_srv_en.f).

Texas Instruments. (2015). *LM2611 1.4-MHz Cuk converter* (Data Sheet
SNOS965J).

Texas Instruments. (2020). *Peak efficiency at 99%, 585-W high-voltage
buck reference design with standard Si-MOSFETs* (Test Report
TIDT177).

Texas Instruments. (2024). *Bidirectional, dual active bridge
reference design for level 3 electric vehicle charging stations*
(TIDA-010054; Rev. E).

Tuztasi, F. M., Yildiz, A. B., & Kelebek, H. (2022). Modeling and
analysis of DC-DC CUK converter with coupled inductors. *WSEAS
Transactions on Circuits and Systems*, 21, 188–192.
https://doi.org/10.37394/23201.2022.21.21

Vitorino, M. A., Bento, A. A. M., Fernandes, D. A., & Corrêa, M. B. R.
(2013). Design of boost converter operating in CRM controlled by OCC.
*COBEP 2013*, 440–447. https://doi.org/10.1109/COBEP.2013.6785153

Wu, D., Wang, P., Lyu, Y., Andersen, M. A. E., & Ouyang, Z. (2024). A
high efficiency and high power density partial power Buck-Boost
converter. *IEEE Journal of Emerging and Selected Topics in Power
Electronics*, 12(4), 3563–3573.
https://doi.org/10.1109/JESTPE.2024.3406132

Würth Elektronik. (2026). *SEPIC converter design and calculation*.
Passive Components Blog.
https://passive-components.eu/sepic-converter-design-and-calculation/

Yang, Z., Tahir, M., Hu, S., Huang, Q., & Zhu, H. (2022). Transformer
leakage inductance calculation method with experimental validation for
CLLLC converter topology. *Energies*, 15(18), 6801.
https://doi.org/10.3390/en15186801

## Disclaimer

Calculations, component recommendations, and magnetic core suggestions
are provided as engineering estimates based on published design
methods, manufacturer data and open-source databases. Final
verification and validation remain the responsibility of the design
engineer.
