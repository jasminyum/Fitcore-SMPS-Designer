// ================================================================
// MAGNETIC CALCULATION HELPERS
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================
const MagneticUtils = {
    mu0: 4 * Math.PI * 1e-7,

    getCurrentDensity: function (fsw_khz) {
        const F_MIN = 10;
        const F_MAX = 1500;
        const J_MAX = 5.0;
        const J_MIN = 3.0;

        if (fsw_khz <= F_MIN) return J_MAX;
        if (fsw_khz >= F_MAX) return J_MIN;

        const logF = Math.log10(fsw_khz);
        const logMin = Math.log10(F_MIN);
        const logMax = Math.log10(F_MAX);

        const result = J_MAX - (J_MAX - J_MIN) * ((logF - logMin) / (logMax - logMin));

        return Math.round(result * 1000) / 1000;
    },

    getRowColorClass: function (W_val, optValue) {
        if (W_val < optValue) return '';
        if (W_val > 2 * optValue) return 'background-color: #5C4033 !important; color: #ffffff !important;';
        if (W_val > 1.5 * optValue) return 'background-color: #FFA500 !important; color: #121212 !important;';
        return 'background-color: #228B22 !important; color: #ffffff !important;';
    },

    calculateInductorCores: function (coreList, targetL_H, Irms_sq, wireDiameter, Imax) {
        let processedCores = [];
        let A_wire = Math.PI * Math.pow(wireDiameter / 2, 2);
        let rho = 0.01724;

        coreList.forEach(satir => {
            let AL_nH = parseFloat(satir[4]);
            let Ae_mm2 = parseFloat(satir[5]);
            let le_mm = parseFloat(satir[6]);
            let Amin_mm2 = parseFloat(satir[7]);

            if (isNaN(AL_nH) || isNaN(Ae_mm2)) return;

            let AL = AL_nH * 1e-9;
            let Ae = Ae_mm2 * 1e-6;
            let le = le_mm * 1e-3;
            let Amin = Amin_mm2 * 1e-6;

            let Aele = Ae * le;
            let mue = AL * le / (this.mu0 * Ae);
            let mu0e = this.mu0 * mue;

            let B1 = 0.3 * Amin / Ae;
            let Wmax_J = 0.5 * B1 * B1 * Aele / mu0e;
            let core_Wmax = Math.round(Wmax_J * 1e6);

            let N1 = Math.ceil(Math.sqrt(targetL_H / AL));
            if (N1 < 1) N1 = 1;

            let Bmax_Tesla = (targetL_H * Imax) / (N1 * Amin);
            let core_Bmax = Math.round(Bmax_Tesla * 1000);

            let MLT_mm = 4.5 * Math.sqrt(Ae_mm2);
            let total_length_m = (N1 * MLT_mm) / 1000;
            let DCR_ohm = rho * (total_length_m / A_wire);
            let P_loss_total = Irms_sq * DCR_ohm;

            processedCores.push({
                originalId: satir[0],
                core: satir[1],
                ident: satir[2],
                manu: satir[3],
                al: AL_nH,
                ain: Ae_mm2,
                lin: le_mm,
                amin: Amin_mm2,
                wmax: core_Wmax,
                bmax: core_Bmax,
                n1: N1,
                dcr_mohm: DCR_ohm * 1000,
                ploss: P_loss_total
            });
        });

        return processedCores;
    },

    calculateTrafoCores: function (coreList, L1_H, L2_H, f_hz, vin_min, nOutput, I1_rms_sq, I2_rms_sq, wireD1, wireD2, topology) {
        let processedCores = [];
        let A1 = Math.PI * Math.pow(wireD1 / 2, 2);
        let A2 = Math.PI * Math.pow(wireD2 / 2, 2);
        let rho = 0.01724;

        coreList.forEach(satir => {
            let Amin_mm2, Ve_mm3, ident, manu;
            let AL_nH = "-", Ae_mm2 = "-", le_mm = "-";

            if (satir.length >= 8 && !isNaN(parseFloat(satir[5])) && !isNaN(parseFloat(satir[6]))) {
                AL_nH = parseFloat(satir[4]);
                Ae_mm2 = parseFloat(satir[5]);
                le_mm = parseFloat(satir[6]);
                Amin_mm2 = parseFloat(satir[7]);
                Ve_mm3 = Math.round(Ae_mm2 * le_mm);
                ident = satir[2];
                manu = satir[3];
            } else {
                Amin_mm2 = parseFloat(satir[3]);
                Ve_mm3 = parseFloat(satir[4]);
                ident = "-";
                manu = satir[2];
            }

            if (isNaN(Amin_mm2) || isNaN(Ve_mm3)) return;

            let deltaB = Math.round(100 * 0.2 * Math.pow(50000 / f_hz, 0.6)) / 100;
            if (deltaB > 0.6) deltaB = 0.6;

            let N1 = 1;
            let amin_m2 = Amin_mm2 * 1e-6;

            if (topology === 'full_bridge' || topology === 'push_pull') {
                N1 = Math.ceil(vin_min / (4 * f_hz * deltaB * amin_m2));
            } else if (topology === 'half_bridge') {
                N1 = Math.ceil((vin_min / 2) / (4 * f_hz * deltaB * amin_m2));
            } else if (topology === 'llc' || topology === 'dab') {
                N1 = Math.ceil(vin_min / (4 * f_hz * deltaB * amin_m2));
            } else {
                N1 = Math.ceil((vin_min * 0.5) / (f_hz * deltaB * amin_m2));
            }

            if (N1 < 1) N1 = 1;

            let N2 = Math.ceil(N1 / nOutput);
            if (N2 < 1) N2 = 1;

            let Ae_est = Amin_mm2 * 1.1;
            let MLT_mm = 4.5 * Math.sqrt(Ae_est);
            let len1_m = (N1 * MLT_mm) / 1000;
            let len2_m = (N2 * MLT_mm) / 1000;

            let DCR1_ohm = rho * (len1_m / A1);
            let DCR2_ohm = rho * (len2_m / A2);
            let P_cu = (I1_rms_sq * DCR1_ohm) + (I2_rms_sq * DCR2_ohm);

            processedCores.push({
                originalId: satir[0],
                core: satir[1],
                ident: ident,
                manu: manu,
                al: AL_nH,
                ain: Ae_mm2,
                lin: le_mm,
                amin: Amin_mm2,
                ve: Ve_mm3,
                deltaB: deltaB, N1: N1, N2: N2,
                dcr1_mohm: DCR1_ohm * 1000, dcr2_mohm: DCR2_ohm * 1000, P_cu: P_cu
            });
        });

        return processedCores;
    },

    calculateFlybackCores: function (coreList, L_H, nOutput, Imax, wmaxOpt, I1_rms_sq, I2_rms_sq, wireD1, wireD2) {
        let processedCores = [];
        let A1 = Math.PI * Math.pow(wireD1 / 2, 2);
        let A2 = Math.PI * Math.pow(wireD2 / 2, 2);
        let rho = 0.01724;
        let W_J = wmaxOpt * 1e-6;

        coreList.forEach(satir => {
            let AL_nH = parseFloat(satir[4]);
            let Ae_mm2 = parseFloat(satir[5]);
            let le_mm = parseFloat(satir[6]);
            let Amin_mm2 = parseFloat(satir[7]);

            if (isNaN(AL_nH) || isNaN(Ae_mm2) || isNaN(le_mm) || isNaN(Amin_mm2)) return;

            let AL = AL_nH * 1e-9;
            let Ae = Ae_mm2 * 1e-6;
            let le = le_mm * 1e-3;
            let Amin = Amin_mm2 * 1e-6;

            let Aele = Ae * le;
            let mue = AL * le / (this.mu0 * Ae);
            let mu0e = this.mu0 * mue;

            let B1 = 0.3 * Amin / Ae;
            let Wmax_J = 0.5 * B1 * B1 * Aele / mu0e;
            let core_Wmax = Math.round(Wmax_J * 1e6);

            let B2 = Math.sqrt(W_J * 2 * mu0e / Aele);
            let core_Bmax = Math.round((B2 * Ae / Amin) * 1e3);

            let N1 = Math.ceil(Math.sqrt(L_H / AL));
            if (N1 < 1) N1 = 1;
            let N2 = Math.ceil(N1 / nOutput);
            if (N2 < 1) N2 = 1;

            let MLT_mm = 4.5 * Math.sqrt(Ae_mm2);
            let len1_m = (N1 * MLT_mm) / 1000;
            let len2_m = (N2 * MLT_mm) / 1000;

            let DCR1_ohm = rho * len1_m / A1;
            let DCR2_ohm = rho * len2_m / A2;
            let P_cu = (I1_rms_sq * DCR1_ohm) + (I2_rms_sq * DCR2_ohm);

            processedCores.push({
                originalId: satir[0], core: satir[1], ident: satir[2], manu: satir[3],
                al: AL_nH, ain: Ae_mm2, lin: le_mm, amin: Amin_mm2,
                wmax: core_Wmax, bmax: core_Bmax, n1: N1, n2: N2,
                dcr1_mohm: DCR1_ohm * 1000, dcr2_mohm: DCR2_ohm * 1000, ploss: P_cu
            });
        });

        return processedCores;
    }
};
