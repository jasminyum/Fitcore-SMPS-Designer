// ================================================================
// LLC Half-Bridge Resonant Converter
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================

window.currentEfficiency = 80;
window.lOutput_global = 0;
window.wmax1_global = 0;
window.Imax_global = 0;
window.il_rms = 0;
window.i1_rms_global = 0;
window.i2_rms_global = 0;
window.A1_req = 0;
window.A2_req = 0;
window.A_coil_req = 0;
window.d1_req = 0;
window.d2_req = 0;
window.d_coil_req = 0;
window.max_wire_d_mm = 0;
window.VeOpt_global = 0;

// ----------------------------------------------------------------
// ARAYÜZ VE GÝRÝÞ KONTROLLERÝ
// ----------------------------------------------------------------
function toggleEffMode() {
    var mode = document.getElementById("effMode").value;
    if (mode === "ideal") {
        document.getElementById("idealInputGroup").style.display = "contents";
        document.getElementById("realInputGroup").style.display = "none";
        document.getElementById("powerLossSection").style.display = "none";
    } else {
        document.getElementById("idealInputGroup").style.display = "none";
        document.getElementById("realInputGroup").style.display = "block";
    }
}

function toggleRectifierType(isUserAction = false) {
    var type = document.getElementById("rectifierType").value;
    var getT = window.getT || function (key) { return key; };

    if (type === "diode") {
        document.getElementById("diode-inputs").style.display = "block";
        document.getElementById("sr-inputs").style.display = "none";

        document.getElementById("lbl_vrev").innerText = getT("lbl_vrev_diode") || "Diyot Ters Gerilim (Vrev)";
        document.getElementById("lbl_irms").innerText = getT("lbl_irms_diode") || "Diyot RMS Akýmý (Irms)";
        document.getElementById("lbl_ipk").innerText = getT("lbl_ipk_diode") || "Diyot Peak Akýmý (Ipk)";
        document.getElementById("lbl_iavg").innerText = getT("lbl_iavg_diode") || "Diyot Ort. Akým (Iavg)";

        document.getElementById("ploss_sec_cond").innerText = getT("ploss_sec_cond_diode") || "Diyot Ýletim (P_D1 + P_D2)";
        document.getElementById("ploss_sec_sw").innerText = getT("ploss_sec_sw_diode") || "Diyot Rev. Rec. (Pdiode_rr)";

        if (isUserAction) {
            document.getElementById('vin_min').value = 350;
            document.getElementById('vin_nom').value = 390;
            document.getElementById('vin_max').value = 430;
            document.getElementById('vin_test').value = 390;
            document.getElementById('vout').value = 24;
            document.getElementById('ilout').value = 10;
            document.getElementById('f_khz').value = 100;
            document.getElementById('verim').value = 92;
        }
    } else {
        document.getElementById("diode-inputs").style.display = "none";
        document.getElementById("sr-inputs").style.display = "block";

        document.getElementById("lbl_vrev").innerText = getT("lbl_vrev_sr") || "SR Ters Gerilim (Vrev)";
        document.getElementById("lbl_irms").innerText = getT("lbl_irms_sr") || "SR RMS Akýmý (Irms)";
        document.getElementById("lbl_ipk").innerText = getT("lbl_ipk_sr") || "SR Peak Akýmý (Ipk)";
        document.getElementById("lbl_iavg").innerText = getT("lbl_iavg_sr") || "SR Ort. Akým (Iavg)";

        document.getElementById("ploss_sec_cond").innerText = getT("ploss_sec_cond_sr") || "SR Ýletim (2x Pon_sr)";
        document.getElementById("ploss_sec_sw").innerText = getT("ploss_sec_sw_sr") || "SR Anahtarlama Kaybý";

        if (isUserAction) {
            document.getElementById('vin_min').value = 375;
            document.getElementById('vin_nom').value = 390;
            document.getElementById('vin_max').value = 405;
            document.getElementById('vin_test').value = 390;
            document.getElementById('vout').value = 12;
            document.getElementById('ilout').value = 25;
            document.getElementById('f_khz').value = 130;
            document.getElementById('verim').value = 96;
            document.getElementById('qmax').value = 0.4;
            document.getElementById('m_ratio').value = 6.3;
        }
    }
}

function setDefaultValues() {
    document.getElementById("rectifierType").value = "sr";
    toggleRectifierType(true);
}

function checkUserInput() {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vin_test = parseFloat(document.getElementById('vin_test').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);
    var qmax = parseFloat(document.getElementById('qmax').value);
    var m_ratio = parseFloat(document.getElementById('m_ratio').value);

    if (isNaN(vin_min) || vin_min <= 0) vin_min = 375.0;
    if (isNaN(vin_max) || vin_max <= 0) vin_max = 405.0;
    if (isNaN(vin_nom) || vin_nom <= 0) vin_nom = 390.0;
    if (isNaN(vin_test) || vin_test <= 0) vin_test = vin_nom;
    if (isNaN(vout) || vout <= 0) vout = 12.0;
    if (isNaN(ilout) || ilout <= 0) ilout = 25.0;
    if (isNaN(f_khz) || f_khz <= 0) f_khz = 130.0;
    if (isNaN(verim) || verim <= 0) verim = 96.0;

    if (isNaN(qmax) || qmax <= 0) qmax = 0.4;
    if (isNaN(m_ratio) || m_ratio <= 1.0) m_ratio = 6.3;

    if (vin_min > vin_max) vin_max = vin_min;
    if (vin_nom < vin_min) vin_nom = vin_min;
    if (vin_nom > vin_max) vin_nom = vin_max;

    if (f_khz < 1 || f_khz > 2000) {
        alert("Warning: Resonant frequency must be between 1 kHz - 2 MHz! Please enter the value for this range...");
        f_khz = 130.0;
    }

    document.getElementById('vin_min').value = vin_min;
    document.getElementById('vin_nom').value = vin_nom;
    document.getElementById('vin_max').value = vin_max;
    document.getElementById('vin_test').value = vin_test;
    document.getElementById('vout').value = vout;
    document.getElementById('ilout').value = ilout;
    document.getElementById('f_khz').value = f_khz;
    document.getElementById('verim').value = verim;
    document.getElementById('qmax').value = qmax;
    document.getElementById('m_ratio').value = m_ratio;

    return true;
}

// ----------------------------------------------------------------
// GÜÇ KAYBI HESAPLAMALARI (HALF BRIDGE ÖZEL)
// ----------------------------------------------------------------
function getRealParams() {
    return {
        Ron: parseFloat(document.getElementById('p_ron_h').value) || 0.250,
        Coss: (parseFloat(document.getElementById('p_coss').value) || 150) * 1e-12,
        Qg: (parseFloat(document.getElementById('p_qg').value) || 25) * 1e-9,
        Vgs: parseFloat(document.getElementById('p_vgs').value) || 10.0,
        tr: (parseFloat(document.getElementById('p_tr').value) || 15) * 1e-9,
        tf: (parseFloat(document.getElementById('p_tf').value) || 15) * 1e-9,

        Vd1: parseFloat(document.getElementById('p_vd1').value) || 1.4,
        Vd2: parseFloat(document.getElementById('p_vd2').value) || 1.4,
        trr: (parseFloat(document.getElementById('p_trr').value) || 35) * 1e-9,
        Irr: parseFloat(document.getElementById('p_irr').value) || 0.8,

        Ron_sr: parseFloat(document.getElementById('p_ron_sr').value) || 0.010,
        Coss_sr: (parseFloat(document.getElementById('p_coss_sr').value) || 500) * 1e-12,
        Qg_sr: (parseFloat(document.getElementById('p_qg_sr').value) || 50) * 1e-9,
        Vgs_sr: parseFloat(document.getElementById('p_vgs_sr').value) || 10.0,
        tr_sr: (parseFloat(document.getElementById('p_tr_sr').value) || 20) * 1e-9,
        tf_sr: (parseFloat(document.getElementById('p_tf_sr').value) || 20) * 1e-9,

        DCR_pri: parseFloat(document.getElementById('p_dcr_pri').value) || 0.100,
        DCR_sec: parseFloat(document.getElementById('p_dcr_sec').value) || 0.020,
        DCR_ind: parseFloat(document.getElementById('p_dcr_ind').value) || 0.015,
        ESR_Cout: parseFloat(document.getElementById('p_esrcout').value) || 0.005,
        Icc: (parseFloat(document.getElementById('p_icc').value) || 2.5) * 1e-3
    };
}

function calculateRealEfficiency_LLC_HalfBridge(vin_test, vout, iout, fs_hz, fr_hz, ILm_pk, nOutput, p, actualMode) {
    var Fx = fs_hz / fr_hz;
    var rectType = document.getElementById("rectifierType").value;

    var Iout_ref = (iout * Math.PI) / (2.0 * Math.SQRT2 * nOutput);
    var Im_ref = ILm_pk / Math.sqrt(3);
    var Ipri_rms = Math.sqrt(Iout_ref * Iout_ref + Im_ref * Im_ref);

    var sw_penalty = 1.0;
    var sec_sw_penalty = 1.0;

    if (actualMode === "below") {
        Ipri_rms *= (1 + 0.15 * (1 - Fx));
    } else if (actualMode === "above") {
        sw_penalty = 1 + 2.0 * (Fx - 1);
        sec_sw_penalty = 1 + 3.0 * (Fx - 1);
    }

    var V_stress = Math.max(vin_test, 33);

    var Pon_MOS = Math.pow(Ipri_rms, 2) * p.Ron;
    var Psw_MOS = 2 * (0.5 * V_stress * ILm_pk * p.tf * fs_hz) * sw_penalty;
    var k_hyst = 0.15;

    var Eoss_total = 0.5 * p.Coss * Math.pow(V_stress, 2);
    var Pcoss_pri = 2 * (k_hyst * Eoss_total * fs_hz);

    var Psec_cond = 0, Psec_sw = 0, Psec_gate = 0, Psec_coss = 0;
    var Isec_rms = iout * (Math.PI / (2.0 * Math.SQRT2));

    var Vsec_stress = 2.0 * vout;

    if (rectType === "diode") {
        Psec_cond = iout * p.Vd1;
        Psec_sw = 2 * (0.5 * Vsec_stress * p.Irr * p.trr * fs_hz) * sec_sw_penalty;
    } else {
        Psec_cond = Math.pow(Isec_rms, 2) * p.Ron_sr;
        Psec_sw = 0;
        Psec_coss = 2 * (0.5 * p.Coss_sr * Math.pow(Vsec_stress, 2) * fs_hz);
        Psec_gate = 2 * (p.Qg_sr * p.Vgs_sr * fs_hz);
    }

    var Ptr_dcr = Math.pow(Ipri_rms, 2) * p.DCR_pri + Math.pow(Isec_rms, 2) * p.DCR_sec;
    var Pl_dcr = Math.pow(Ipri_rms, 2) * p.DCR_ind;

    var Icout_rms = Math.sqrt(Math.max(0, Math.pow(Isec_rms, 2) - Math.pow(iout, 2)));
    var Pcout = Math.pow(Icout_rms, 2) * p.ESR_Cout;

    var Pgate = 2 * (p.Qg * p.Vgs * fs_hz) + Psec_gate;

    var Pic = 15.0 * p.Icc;

    var Pcoss_total = Pcoss_pri + Psec_coss;
    var Ptotal = Pon_MOS + Psw_MOS + Psec_cond + Psec_sw + Ptr_dcr + Pl_dcr + Pcout + Pgate + Pic;
    var efficiency = (vout * iout) / ((vout * iout) + Ptotal) * 100;

    return {
        totalLossW: Ptotal,
        efficiencyPercent: Math.max(0, efficiency),
        breakdown: { Pon_MOS: Pon_MOS, Psw_MOS: Psw_MOS, Pcoss: Pcoss_total, Pdiode_cond: Psec_cond, Pdiode_rr: Psec_sw, Ptr_dcr: Ptr_dcr, Pl_dcr: Pl_dcr, Pcout: Pcout, Pgate: Pgate, Pic: Pic }
    };
}

function generateIdealEffCurve(eff_full_load, fr_hz, fs_hz) {
    var values = [], labels = [], frequencies = [];
    var k_fix = 0.013 * (fr_hz / 100000);
    var k_cond = 0.022;
    function raw_eff(p) {
        if (p < 0.001) p = 0.001;
        return p / (p + k_fix + k_cond * p * p);
    }
    var scale = eff_full_load / raw_eff(1.0);
    for (var i = 2; i <= 24; i++) {
        var p = i * 5.0 / 100.0;
        var e = Math.min(99.5, Math.max(0, raw_eff(p) * scale * 100.0));
        values.push(parseFloat(e.toFixed(1)));
        labels.push((i * 5) + "%");
        frequencies.push(fs_hz);
    }
    return { values: values, labels: labels, frequencies: frequencies };
}

function generateRealEffCurve_HalfBridge(vin_test, vout, max_iout, fs_hz_nominal, fr_hz, ILm_pk_nominal, nOutput, p, actualMode, target_gain, m, Qmax, Lm_H) {
    var values = [], labels = [], frequencies = [];

    for (var pct = 10; pct <= 120; pct += 5) {
        var currentLoad = max_iout * (pct / 100);
        if (currentLoad <= 0.001) currentLoad = 0.001;

        var current_fs_hz = fs_hz_nominal;
        var current_ILm_pk = ILm_pk_nominal;

        if (target_gain !== undefined && m !== undefined && Qmax !== undefined && Lm_H !== undefined) {

            var current_Q = Qmax * (currentLoad / max_iout);

            var current_Fx = findFxForGain(target_gain, m, current_Q);
            current_fs_hz = fr_hz * current_Fx;

            current_ILm_pk = (nOutput * vout) / (4.0 * Lm_H * current_fs_hz);
        }

        var res = calculateRealEfficiency_LLC_HalfBridge(vin_test, vout, currentLoad, current_fs_hz, fr_hz, current_ILm_pk, nOutput, p, actualMode);

        var e = res.efficiencyPercent;
        if (e > 99.5) e = 99.5;
        if (e < 0) e = 0;

        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
        frequencies.push(current_fs_hz);
    }
    return { values: values, labels: labels, frequencies: frequencies };
}

// ----------------------------------------------------------------
// LLC HALF BRIDGE KAZANÇ VE DALGA FORMU
// ----------------------------------------------------------------
function findFxmin(Q, m) {
    var bestFx = 0.5;
    var bestK = 0;
    var num = 0, term1 = 0, term2 = 0, den = 0, K = 0;
    for (var i = 1; i <= 899; i++) {
        var Fx = 0.1 + i * 0.001;
        if (Fx >= 1.0) break;
        num = Fx * Fx * (m - 1.0);
        term1 = m * Fx * Fx - 1.0;
        term2 = Fx * (Fx * Fx - 1.0) * (m - 1.0) * Q;
        den = Math.sqrt(term1 * term1 + term2 * term2);
        K = (den > 0) ? num / den : 0;
        if (K > bestK) { bestK = K; bestFx = Fx; }
    }
    return bestFx;
}

function generateAllWaveforms_LLC_HalfBridge(Vin_test, Vout, NpNs, fs_hz, fr_hz, ILr_pk, ILm_pk, Iout, actualMode) {
    var PTS = 200;
    var n_cyc = 2;
    var labels = [], ilr = [], ilm = [], vsw = [], id_sec = [];

    var Ts = 1.0 / fs_hz;
    var Tr = 1.0 / fr_hz;

    for (var cyc = 0; cyc < n_cyc; cyc++) {
        var t0 = cyc * Ts;
        for (var k = 0; k < PTS; k++) {
            var frac = k / PTS;
            var t = t0 + frac * Ts;
            var t_in_half = (frac < 0.5) ? (frac * Ts) : ((frac - 0.5) * Ts);

            var Vsw_val = (frac < 0.5) ? (Vin_test / 2.0) : -(Vin_test / 2.0);

            var ILm_base = -ILm_pk + (2.0 * ILm_pk / (Ts / 2)) * t_in_half;
            var ILr_base = 0;
            var I_sine_amp = Math.sqrt(Math.max(0, ILr_pk * ILr_pk - ILm_pk * ILm_pk));

            if (actualMode === "below") {
                if (t_in_half <= Tr / 2) {
                    ILr_base = -ILm_pk * Math.cos(Math.PI * t_in_half / (Tr / 2)) + I_sine_amp * Math.sin(Math.PI * t_in_half / (Tr / 2));
                } else {
                    ILr_base = ILm_base;
                }
            } else {
                ILr_base = -ILm_pk * Math.cos(Math.PI * t_in_half / (Tr / 2)) + I_sine_amp * Math.sin(Math.PI * t_in_half / (Tr / 2));
            }

            var ILm_val = (frac < 0.5) ? ILm_base : -ILm_base;
            var ILr_val = (frac < 0.5) ? ILr_base : -ILr_base;

            var diff = ILr_val - ILm_val;
            var ID_val = 0;
            if (frac < 0.5 && diff > 0) {
                ID_val = diff / NpNs;
            } else if (frac >= 0.5 && diff < 0) {
                ID_val = (-diff) / NpNs;
            }

            labels.push((t * 1e6).toFixed(2));
            vsw.push(Vsw_val);
            ilr.push(ILr_val);
            ilm.push(ILm_val);
            id_sec.push(ID_val);
        }
    }
    return { labels: labels, vsw: vsw, ilr: ilr, ilm: ilm, id_sec: id_sec };
}

// ----------------------------------------------------------------
// GERÇEK ÇALIÞMA FREKANSI (ROOT-FINDING / BISECTION ALGORITHM)
// ----------------------------------------------------------------
function getGainFHA(Fx, m, Q) {
    var num = Fx * Fx * (m - 1.0);
    var term1 = m * Fx * Fx - 1.0;
    var term2 = Fx * (Fx * Fx - 1.0) * (m - 1.0) * Q;
    var den = Math.sqrt(term1 * term1 + term2 * term2);
    return (den > 0) ? (num / den) : 0;
}

function findFxForGain(targetGain, m, Q) {
    if (Math.abs(targetGain - 1.0) < 0.0001) return 1.0;

    var Fx_low = 0.1;
    var Fx_high = 3.0;
    var Fx_mid = 1.0;
    var iterations = 0;

    if (targetGain > 1.0) {
        var peakFx = 0.1;
        var maxGain = 0;

        for (var f = 0.1; f <= 1.0; f += 0.002) {
            var g = getGainFHA(f, m, Q);
            if (g > maxGain) { maxGain = g; peakFx = f; }
        }

        if (targetGain >= maxGain) {
            return peakFx;
        }

        Fx_low = peakFx;
        Fx_high = 1.0;
    }
    else {
        Fx_low = 1.0;
        Fx_high = 10.0;
    }

    while (iterations < 100) {
        Fx_mid = (Fx_low + Fx_high) / 2.0;
        var currentGain = getGainFHA(Fx_mid, m, Q);

        if (Math.abs(currentGain - targetGain) < 0.0001) {
            break;
        }

        if (currentGain > targetGain) {
            Fx_low = Fx_mid;
        } else {
            Fx_high = Fx_mid;
        }
        iterations++;
    }

    return Fx_mid;
}

// ----------------------------------------------------------------
// ANA HESAPLAMA MANTIÐI (HALF BRIDGE)
// ----------------------------------------------------------------
function updateChartsAndTable() {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vin_test = parseFloat(document.getElementById('vin_test').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);
    var effMode = document.getElementById("effMode").value;
    var userMode = document.getElementById('mode').value;

    if (isNaN(vin_test) || vin_test <= 0) {
        vin_test = vin_nom;
        document.getElementById('vin_test').value = vin_nom;
    }

    var getT = window.getT || function (key) { return key; };
    var actualMode = "at";
    if (vin_test < vin_nom) actualMode = "below";
    else if (vin_test > vin_nom) actualMode = "above";

    var modeWarning = document.getElementById("modeWarning");
    if (userMode !== actualMode) {
        var modeNames = {
            "below": getT("mode_below") || "Below Resonance (Boost)",
            "at": getT("mode_at") || "At Resonance",
            "above": getT("mode_above") || "Above Resonance (Buck)"
        };
        modeWarning.style.display = "block";
        modeWarning.innerHTML = (getT("warn_llc_1") || "<strong>Uyarý:</strong> Seçtiðiniz mod (") + modeNames[userMode] +
            (getT("warn_llc_2") || "), girdiðiniz Test Gerilimi (") + vin_test +
            (getT("warn_llc_3") || "V) ile uyumsuz. Nominal gerilim (") + vin_nom +
            (getT("warn_llc_4") || "V) baz alýndýðýnda, ") + vin_test +
            (getT("warn_llc_5") || "V için doðru mod <strong>") + modeNames[actualMode] +
            (getT("warn_llc_6") || "</strong> olmalýdýr. Hesaplamalar ve grafikler fiziksel olarak doðru olan <strong>") + modeNames[actualMode] +
            (getT("warn_llc_7") || "</strong> moduna göre güncellendi.");
    } else {
        modeWarning.style.display = "none";
    }

    var fr = f_khz * 1000;

    var nOutput = (vin_nom / 2.0) / vout;
    var M_max = vin_nom / vin_min;

    var pOutput = vout * ilout;
    var rOutput = vout / ilout;

    var Rac = (8.0 / (Math.PI * Math.PI)) * nOutput * nOutput * vout * vout / pOutput;

    var Qmax = parseFloat(document.getElementById('qmax').value);
    var m = parseFloat(document.getElementById('m_ratio').value);

    var omega_r = 2.0 * Math.PI * fr;
    var Lr_H = Qmax * Rac / omega_r;
    var Lr_uH = Lr_H * 1e6;
    var Cr_F = 1.0 / (omega_r * omega_r * Lr_H);
    var Cr_uF = Cr_F * 1e6;
    var Lm_H = (m - 1.0) * Lr_H;

    var target_gain = vin_nom / vin_test;
    var Q_actual = Qmax;

    var Fx = findFxForGain(target_gain, m, Q_actual);
    var fs_hz = fr * Fx;

    var ILm_pk = (nOutput * vout) / (4.0 * Lm_H * fs_hz);
    var ILr_pk = Math.sqrt(Math.pow((Math.PI * ilout) / (2.0 * nOutput), 2) + ILm_pk * ILm_pk);
    var deltaILMax = ILm_pk * 2.0;

    var VD_REV = 2.0 * vout;
    var ID_RMS = ilout * (Math.PI / 4.0);
    var ID_PK = ilout * (Math.PI / 2.0);
    var ID_AVG = ilout / 2.0;

    var Fxmin = findFxmin(Qmax, m);
    var fs_min_kHz = Fxmin * f_khz;

    var wmax1 = 0.5 * Lr_H * ILr_pk * ILr_pk * 1e6;
    var VeOpt = 52000 * Math.pow(pOutput / 800, 1.2) * Math.sqrt(50000 / fr);

    var J = MagneticUtils.getCurrentDensity(f_khz);

    var I_sec_rms = ilout * (Math.PI / (2.0 * Math.SQRT2));
    var I_pri_rms = Math.sqrt(Math.pow(I_sec_rms / nOutput, 2) + Math.pow(ILm_pk / Math.sqrt(3), 2));

    window.i1_rms_global = I_pri_rms;
    window.i2_rms_global = I_sec_rms;

    window.A1_req = I_pri_rms / J;
    window.d1_req = 2 * Math.sqrt(window.A1_req / Math.PI);

    window.A2_req = (I_sec_rms / Math.SQRT2) / J;
    window.d2_req = 2 * Math.sqrt(window.A2_req / Math.PI);

    window.il_rms = ILr_pk / Math.SQRT2;
    window.A_coil_req = I_pri_rms / J;
    window.d_coil_req = 2 * Math.sqrt(window.A_coil_req / Math.PI);

    var skin_depth_mm = 65.6 / Math.sqrt(fr);
    window.max_wire_d_mm = 2 * skin_depth_mm;

    window.lOutput_global = Lr_uH;
    window.wmax1_global = wmax1;
    window.Imax_global = ILr_pk;
    window.VeOpt_global = VeOpt;

    var finalKullanilacakVerim = verim;
    var effData;

    if (effMode === "ideal") {
        effData = generateIdealEffCurve(verim / 100, fr, fs_hz);
        document.getElementById("powerLossSection").style.display = "none";
        var loss = Math.abs(100 - verim);
        if (document.getElementById('loss')) document.getElementById('loss').innerText = loss.toFixed(2);
    } else {
        var params = getRealParams();
        effData = generateRealEffCurve_HalfBridge(vin_test, vout, ilout, fs_hz, fr, ILm_pk, nOutput, params, actualMode, target_gain, m, Qmax, Lm_H);
        var realRes = calculateRealEfficiency_LLC_HalfBridge(vin_test, vout, ilout, fs_hz, fr, ILm_pk, nOutput, params, actualMode);

        finalKullanilacakVerim = realRes.efficiencyPercent;
        document.getElementById("powerLossSection").style.display = "block";

        document.getElementById("res_pon_mos").innerText = realRes.breakdown.Pon_MOS.toFixed(4) + " W";
        document.getElementById("res_psw_mos").innerText = realRes.breakdown.Psw_MOS.toFixed(4) + " W";
        document.getElementById("res_pcoss").innerText = realRes.breakdown.Pcoss.toFixed(4) + " W";
        document.getElementById("res_pdiode_cond").innerText = realRes.breakdown.Pdiode_cond.toFixed(4) + " W";
        document.getElementById("res_pdiode_rr").innerText = realRes.breakdown.Pdiode_rr.toFixed(4) + " W";
        document.getElementById("res_ptr_dcr").innerText = realRes.breakdown.Ptr_dcr.toFixed(4) + " W";
        document.getElementById("res_pl_dcr").innerText = realRes.breakdown.Pl_dcr.toFixed(4) + " W";
        document.getElementById("res_pcout").innerText = realRes.breakdown.Pcout.toFixed(4) + " W";
        document.getElementById("res_pgate").innerText = realRes.breakdown.Pgate.toFixed(4) + " W";
        document.getElementById("res_pic").innerText = realRes.breakdown.Pic.toFixed(4) + " W";

        document.getElementById("res_ptotal").innerText = realRes.totalLossW.toFixed(4) + " W";
        document.getElementById("res_peff").innerText = realRes.efficiencyPercent.toFixed(2) + " %";

        var loss = Math.abs(100 - finalKullanilacakVerim);
        if (document.getElementById('loss')) document.getElementById('loss').innerText = loss.toFixed(2);
    }

    window.currentEfficiency = finalKullanilacakVerim;
    var Pin = pOutput / (finalKullanilacakVerim / 100.0);
    var iin = Pin / vin_test;

    var delta_Vout = vout * 0.01;
    var c_out_calc_uF = (ilout / (2 * fs_hz * delta_Vout)) * 1e6;

    var delta_Vin = vin_test * 0.01;
    var c_in_calc_uF = (iin / (2 * fs_hz * delta_Vin)) * 1e6;

    if (document.getElementById('lOutput')) document.getElementById('lOutput').innerText = Lr_uH.toFixed(5);
    if (document.getElementById('cOutput')) document.getElementById('cOutput').innerText = Cr_uF.toFixed(5);
    if (document.getElementById('f')) document.getElementById('f').innerText = fr.toFixed(2);
    if (document.getElementById('rOutput')) document.getElementById('rOutput').innerText = rOutput.toFixed(5);
    if (document.getElementById('wmax1')) document.getElementById('wmax1').innerText = wmax1.toFixed(2);
    if (document.getElementById('nOutput')) document.getElementById('nOutput').innerText = nOutput.toFixed(5);
    if (document.getElementById('pOutput')) document.getElementById('pOutput').innerText = pOutput.toFixed(2);
    if (document.getElementById('deltaILMax')) document.getElementById('deltaILMax').innerText = deltaILMax.toFixed(5);
    if (document.getElementById('vin1')) document.getElementById('vin1').innerText = vin_test.toFixed(2);
    if (document.getElementById('VeOpt')) document.getElementById('VeOpt').innerText = VeOpt.toFixed(2);
    if (document.getElementById('fs_min')) document.getElementById('fs_min').innerText = fs_min_kHz.toFixed(2);
    if (document.getElementById('vdRev')) document.getElementById('vdRev').innerText = VD_REV.toFixed(2);
    if (document.getElementById('idRms')) document.getElementById('idRms').innerText = ID_RMS.toFixed(3);
    if (document.getElementById('idPeak')) document.getElementById('idPeak').innerText = ID_PK.toFixed(3);
    if (document.getElementById('idAvg')) document.getElementById('idAvg').innerText = ID_AVG.toFixed(3);
    if (document.getElementById('iin')) document.getElementById('iin').innerText = iin.toFixed(2);
    if (document.getElementById('deltaVout')) document.getElementById('deltaVout').innerText = M_max.toFixed(5);
    if (document.getElementById('ilrPeak')) document.getElementById('ilrPeak').innerText = ILr_pk.toFixed(5);
    if (document.getElementById('cin_calc')) document.getElementById('cin_calc').innerText = c_in_calc_uF.toFixed(2);
    if (document.getElementById('cout_calc')) document.getElementById('cout_calc').innerText = c_out_calc_uF.toFixed(2);

    var wf = generateAllWaveforms_LLC_HalfBridge(vin_test, vout, nOutput, fs_hz, fr, ILr_pk, ILm_pk, ilout, actualMode);

    drawCharts(wf, ilout, vin_test, effData, (1.0 / fs_hz));
    updateResultTable(wf);
}

// ----------------------------------------------------------------
// GRAFÝK VE TABLO YARDIMCILARI
// ----------------------------------------------------------------
function drawCharts(wf, ilout, Vin_test, effData, Ts) {
    var N = wf.labels.length;
    var tickStep = Math.max(1, Math.floor(N / 10));
    var textColor = '#e0e0e0';
    var gridColor = 'rgba(255, 255, 255, 0.1)';
    var refLineColor = 'rgba(255, 255, 255, 0.5)';
    var rectType = document.getElementById("rectifierType").value;
    var getT = window.getT || function (k) { return k; };

    function baseOpts(yLabel, xLabelTitle) {
        return {
            responsive: true, animation: false,
            elements: { point: { radius: 0 }, line: { tension: 0 } },
            scales: {
                x: {
                    type: 'category',
                    ticks: { color: textColor, maxTicksLimit: 10, callback: function (val, idx) { return (idx % tickStep === 0) ? wf.labels[idx] + " us" : ''; } },
                    title: { display: true, text: xLabelTitle, color: textColor },
                    grid: { color: gridColor, borderColor: gridColor }
                },
                y: {
                    title: { display: true, text: yLabel, color: textColor },
                    ticks: { color: textColor },
                    grid: { color: gridColor, borderColor: gridColor }
                }
            },
            plugins: {
                legend: { display: true, position: 'top', labels: { color: textColor } },
                zoom: { zoom: { wheel: { enabled: true }, mode: 'xy' }, pan: { enabled: true, mode: 'xy' } }
            }
        };
    }

    function mkChart(id, datasets, yLabel, xLabelTitle = getT('chart_time_us') || "Zaman (µs)") {
        var canvas = document.getElementById(id);
        if (!canvas) return;
        if (canvas.chart) { canvas.chart.destroy(); canvas.chart = null; }
        canvas.chart = new Chart(canvas.getContext('2d'), {
            type: 'line', data: { labels: wf.labels, datasets: datasets }, options: baseOpts(yLabel, xLabelTitle)
        });
    }

    mkChart('ilChart', [
        { label: getT('chart_ilr_res') || "ILr (Rezonant Akýmý)", data: wf.ilr, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, fill: false },
        { label: getT('chart_ilm_mag') || "ILm (Mýknatýslama Akýmý)", data: wf.ilm, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, borderDash: [5, 3], fill: false },
        { label: getT('chart_iout_dc') || "I_out (DC Yük Akýmý)", data: Array(N).fill(ilout), borderColor: refLineColor, borderWidth: 1.5, borderDash: [6, 4], fill: false, pointRadius: 0 }
    ], getT('chart_current_a') || "Akým (A)");

    mkChart('vinChart', [
        { label: getT('chart_vsw_bridge') || "Vsw (Köprü Çýkýþý)", data: wf.vsw, borderColor: 'rgba(105, 240, 174, 1)', borderWidth: 2, fill: false, stepped: 'before' },
        { label: getT('chart_vin_nom') || "Vin/2 (Efektif Swing)", data: Array(N).fill(Vin_test / 2.0), borderColor: refLineColor, borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 }
    ], getT('chart_voltage_v') || "Gerilim (V)");

    var secLabel = rectType === 'diode' ? (getT('chart_sec_diode') || "I_Diyot (Sekonder)") : (getT('chart_sec_sr') || "I_SR (Sekonder)");
    mkChart('idChart', [
        { label: secLabel, data: wf.id_sec, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: true, backgroundColor: 'rgba(255, 167, 38, 0.15)' },
        { label: getT('chart_iout') || "I_out", data: Array(N).fill(ilout), borderColor: refLineColor, borderWidth: 1.5, borderDash: [6, 4], fill: false, pointRadius: 0 }
    ], getT('chart_current_a') || "Akým (A)");

    var effCanvas = document.getElementById('effChart');
    if (effCanvas) {
        if (effCanvas.chart) { effCanvas.chart.destroy(); effCanvas.chart = null; }
        var effLabel = rectType === 'diode' ? (getT('chart_eff_diode') || "Verim Eðrisi (Diyot)") : (getT('chart_eff_sr') || "Verim Eðrisi (SR MOSFET)");
        effCanvas.chart = new Chart(effCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: effData.labels,
                datasets: [{
                    label: effLabel, data: effData.values, borderColor: 'rgba(129, 199, 132, 1)', backgroundColor: 'rgba(129, 199, 132, 0.15)', borderWidth: 2, fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: 'rgba(129, 199, 132, 1)'
                }]
            },
            options: {
                responsive: true, animation: false,
                scales: {
                    x: { title: { display: true, text: getT('chart_load_pct') || "Yük Yüzdesi (%)", color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } },
                    y: { min: 0, max: 100, title: { display: true, text: getT('chart_eff_pct') || "Verim (%)", color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }
                },
                plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } }
            }
        });
    }

    if (effData.frequencies) {
        var freqCanvas = document.getElementById('freqLoadChart');
        if (freqCanvas) {
            if (freqCanvas.chart) { freqCanvas.chart.destroy(); freqCanvas.chart = null; }
            freqCanvas.chart = new Chart(freqCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: effData.labels,
                    datasets: [{
                        label: getT('chart_freq_load') || "Çalýþma Frekansý (fs)",
                        data: effData.frequencies.map(f => f / 1000),
                        borderColor: 'rgba(171, 71, 188, 1)',
                        backgroundColor: 'rgba(171, 71, 188, 0.15)',
                        borderWidth: 2, fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: 'rgba(171, 71, 188, 1)'
                    }]
                },
                options: {
                    responsive: true, animation: false,
                    scales: {
                        x: { title: { display: true, text: getT('chart_load_pct') || "Yük Yüzdesi (%)", color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } },
                        y: { title: { display: true, text: getT('chart_freq_khz') || "Frekans (kHz)", color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }
                    },
                    plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } }
                }
            });
        }
    }
}

function updateResultTable(wf) {
    var table = document.getElementById('resultTable');
    if (!table) return;
    var tbody = table.getElementsByTagName('tbody')[0];
    tbody.innerHTML = "";
    var N = wf.labels.length;
    var step = Math.max(1, Math.floor(N / 20));
    for (var i = 0; i <= 20; i++) {
        var idx = Math.min(i * step, N - 1);
        var row = tbody.insertRow(-1);
        row.insertCell(0).innerHTML = wf.labels[idx] + " us";
        row.insertCell(1).innerHTML = (wf.vsw[idx] || 0).toFixed(2) + " V";
        row.insertCell(2).innerHTML = (wf.id_sec[idx] || 0).toFixed(3) + " A";
        row.insertCell(3).innerHTML = (wf.ilr[idx] || 0).toFixed(3) + " A";
    }
}

// ----------------------------------------------------------------
// FALSTAD API & IFRAME LLC SIMÜLASYONU
// ----------------------------------------------------------------
var falstadSim = null;

function embedFalstadSimulation(circuitString, timestepStr, mtsStr) {
    var iframe = document.getElementById("circuitFrame");
    if (!iframe) return;

    var blankCct = encodeURIComponent("$ 1 " + timestepStr + " 260 50 5 50 " + mtsStr);

    iframe.src = "./falstad/circuitjs.html"
        + "?hideHeader=true"
        + "&hideMenuBar=true"
        + "&hideToolBar=true"
        + "&hideControls=false"
        + "&noPowerCheck=true"
        + "&cct=" + blankCct;

    iframe.onload = function () {
        var checkReady = setInterval(function () {
            try {
                var cw = iframe.contentWindow;
                if (cw && cw.CircuitJS1 && typeof cw.CircuitJS1.importCircuit === "function") {
                    clearInterval(checkReady);
                    falstadSim = cw.CircuitJS1;
                    cw.CircuitJS1.importCircuit(circuitString, false);
                }
            } catch (e) { }
        }, 50);
    };
}

function openFalstadLlchalfSimulation() {
    var vin_test = parseFloat(document.getElementById('vin_test').value) || 390;
    var vout = parseFloat(document.getElementById('vout').value) || 24;
    var ilout = parseFloat(document.getElementById('ilout').value) || 10;
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 100;

    var rectType = document.getElementById("rectifierType").value;

    var freq_hz = f_khz * 1000;
    var r_load = vout / ilout;

    var l_val_uH = parseFloat(document.getElementById('lOutput').innerText) || 60.0;
    var l_res = l_val_uH * 1e-6;

    var c_val_uF = parseFloat(document.getElementById('cOutput').innerText) || 0.027;
    var c_res = c_val_uF * 1e-6;

    var nOutputText = document.getElementById('nOutput').innerText || "15.25";
    var N = parseFloat(nOutputText);

    var ratio = 2 / N;

    var m_ratio = parseFloat(document.getElementById('m_ratio').value) || 6.3;
    var l_mag = (m_ratio - 1.0) * l_res;
    var t_mag_ideal = l_mag * 40;

    var c_in_uF = parseFloat(document.getElementById('cin_calc').innerText) || 100;
    var c_out_uF = parseFloat(document.getElementById('cout_calc').innerText) || 470;

    var c_in = c_in_uF * 1e-6;
    var c_out = c_out_uF * 1e-6;

    var sim_timestep = 1.0 / (freq_hz * 200);
    var timestep_str = sim_timestep.toExponential(2).toUpperCase();

    var sim_mts = 1.0 / (freq_hz * 2);
    var mts_str = sim_mts.toExponential(2).toUpperCase();

    var vscale_out = 40.0 * (24.0 / vout);
    var iscale_out = 25.6 * (20.0 / ilout);
    var vscale_in = 1280.0 * (400.0 / vin_test);
    var iscale_in = 12.8 * (1.2 / (ilout / N));

    var falstadTemplate = "";

    if (rectType === "diode") {
        falstadTemplate = `<cir f="1" ts="{TIMESTEP}" ic="263.0686190299136" cb="50" pb="50" vr="5" mts="{MACRO_TIMESTEP}">
  <v x="144 464 144 160" f="16" wf="0" maxv="{VIN}"/>
  <g x="144 464 144 496" f="0"/>
  <l x="480 304 592 304" f="0" l="{L_RES}" ic="0" i="-1.4985864411985195"/>
  <c x="1008 160 1008 416" f="0" c="{C_OUT}" iv="0" sr="0" vd="0.009813135776788764"/>
  <r x="1072 160 1072 464" f="0" r="{R_LOAD}"/>
  <w x="144 160 208 160" f="0"/>
  <w x="208 160 480 160" f="0"/>
  <w x="480 160 480 208" f="0"/>
  <w x="144 464 208 464" f="0"/>
  <w x="480 240 480 304" f="0"/>
  <w x="480 400 480 464" f="0"/>
  <w x="208 464 480 464" f="0"/>
  <w x="480 304 480 368" f="0"/>
  <w x="960 160 960 464" f="0"/>
  <w x="816 368 816 464" f="0"/>
  <w x="1072 160 1008 160" f="0"/>
  <w x="1072 464 1008 464" f="0"/>
  <R x="336 304 304 304" f="17" wf="2" fr="{FREQ}" maxv="2.5" bias="2.5"/>
  <I x="336 304 416 304" f="0" sl="0.5" hi="5"/>
  <w x="464 384 416 384" f="0"/>
  <w x="416 384 416 304" f="0"/>
  <w x="464 224 336 224" f="0"/>
  <w x="336 224 336 304" f="0"/>
  <g x="1072 464 1072 496" f="0"/>
  <as x="480 208 480 240" f="2" ron="0.002" roff="10000000000" th="2.5"/>
  <as x="480 368 480 400" f="2" ron="0.002" roff="10000000000" th="2.5"/>
  <dm nm="ideal" f="1" is="0.004" rs="0" n="1" bv="0" fi="1"/>
  <d x="512 240 512 208" f="0" mo="ideal"/>
  <d x="512 400 512 368" f="0" mo="ideal"/>
  <d x="816 464 960 464" f="0" mo="ideal"/>
  <d x="816 160 960 160" f="0" mo="ideal"/>
  <w x="512 208 480 208" f="0"/>
  <w x="512 240 480 240" f="0"/>
  <w x="512 368 480 368" f="0"/>
  <w x="512 400 480 400" f="0"/>
  <l x="592 304 592 368" f="0" l="{L_MAG}" ic="0" i="-1.4962385393371773"/>
  <c x="592 464 480 464" f="0" c="{C_RES}" iv="0" sr="0" vd="141.94617327650695"/>
  <w x="592 368 592 464" f="0"/>
  <c x="208 160 208 464" f="0" c="{C_IN}" iv="0" sr="0.1" vd="399.9999999999972"/>
  <tt x="592 304 752 304" f="0" in="{T_MAG_IDEAL}" ra="{RATIO}" co="0.99999" c0="-0.0023479018613424257" c1="-0.005704185134763536" c2="0.01037185361528684"/>
  <w x="960 160 1008 160" f="0"/>
  <w x="752 304 816 304" f="0"/>
  <w x="752 368 816 368" f="0"/>
  <w x="816 160 816 304" f="0"/>
  <w x="752 336 912 336" f="0"/>
  <w x="912 336 912 416" f="0"/>
  <w x="912 416 1008 416" f="0"/>
  <w x="1008 416 1008 464" f="0"/>
  <o en="4" sp="10" f="x3" p="0">
    <p v="0" sc="{VSCALE_OUT}"/>
    <p v="3" sc="{ISCALE_OUT}"/>
  </o>
  <o en="2" sp="10" f="x3" p="1">
    <p v="0" sc="{VSCALE_IN}"/>
    <p v="3" sc="{ISCALE_IN}"/>
  </o>
</cir>`;
    } else {
        falstadTemplate = `<cir f="1" ts="{TIMESTEP}" ic="109.66331584284586" cb="77" pb="50" vr="5" mts="{MACRO_TIMESTEP}">
  <v x="144 464 144 160" f="16" wf="0" maxv="{VIN}"/>
  <g x="144 464 144 496" f="0"/>
  <l x="480 304 592 304" f="0" l="{L_RES}" ic="0" i="5.629910964305528"/>
  <c x="1008 160 1008 416" f="0" c="{C_OUT}" iv="0" sr="0" vd="7.138037722185422"/>
  <r x="1072 160 1072 464" f="0" r="{R_LOAD}"/>
  <w x="144 160 208 160" f="0"/>
  <w x="208 160 480 160" f="0"/>
  <w x="480 160 480 208" f="0"/>
  <w x="144 464 208 464" f="0"/>
  <w x="480 240 480 304" f="0"/>
  <w x="480 400 480 464" f="0"/>
  <w x="208 464 480 464" f="0"/>
  <w x="480 304 480 368" f="0"/>
  <w x="960 160 960 464" f="0"/>
  <w x="816 368 816 464" f="0"/>
  <w x="1072 160 1008 160" f="0"/>
  <w x="1072 464 1008 464" f="0"/>
  <R x="336 304 304 304" f="17" wf="2" fr="{FREQ}" maxv="2.5" bias="2.5"/>
  <I x="336 304 416 304" f="0" sl="0.5" hi="5"/>
  <w x="464 384 416 384" f="0"/>
  <w x="416 384 416 304" f="0"/>
  <w x="464 224 336 224" f="0"/>
  <w x="336 224 336 304" f="0"/>
  <g x="1072 464 1072 496" f="0"/>
  <as x="480 208 480 240" f="2" ron="0.002" roff="10000000000" th="2.5"/>
  <as x="480 368 480 400" f="2" ron="0.002" roff="10000000000" th="2.5"/>
  <dm nm="ideal" f="1" is="1.7143528192810002e-7" rs="0" n="2.0000000000000084" bv="0" fi="1"/>
  <d x="512 240 512 208" f="0" mo="ideal"/>
  <d x="512 400 512 368" f="0" mo="ideal"/>
  <d x="864 496 896 496" f="0" mo="ideal"/>
  <d x="864 128 896 128" f="0" mo="ideal"/>
  <w x="512 208 480 208" f="0"/>
  <w x="512 240 480 240" f="0"/>
  <w x="512 368 480 368" f="0"/>
  <w x="512 400 480 400" f="0"/>
  <l x="592 304 592 368" f="0" l="{L_MAG}" ic="0" i="1.8055817494462199"/>
  <c x="592 464 480 464" f="0" c="{C_RES}" iv="0" sr="0" vd="90.52734501044287"/>
  <w x="592 368 592 464" f="0"/>
  <c x="208 160 208 464" f="0" c="{C_IN}" iv="0" sr="0.1" vd="399.99999999999716"/>
  <tt x="592 304 752 304" f="2" in="{T_MAG_IDEAL}" ra="{RATIO}" co="0.99999" c0="3.824329214859307" c1="-8.534217644229763" c2="0.8855780564646774"/>
  <w x="960 160 1008 160" f="0"/>
  <w x="752 304 816 304" f="0"/>
  <w x="752 368 816 368" f="0"/>
  <w x="816 160 816 304" f="0"/>
  <w x="752 336 912 336" f="0"/>
  <w x="912 336 912 416" f="0"/>
  <w x="912 416 1008 416" f="0"/>
  <w x="1008 416 1008 464" f="0"/>
  <as x="864 160 896 160" f="26" ron="0.002" roff="10000000000" th="2.5"/>
  <as x="864 464 896 464" f="18" ron="0.002" roff="10000000000" th="2.5"/>
  <I x="864 304 864 384" f="0" sl="0.5" hi="5"/>
  <R x="864 304 864 272" f="17" wf="2" fr="{FREQ}" maxv="2.5" bias="2.5"/>
  <w x="880 176 896 176" f="0"/>
  <w x="896 176 896 304" f="0"/>
  <w x="896 304 864 304" f="0"/>
  <w x="864 384 864 448" f="0"/>
  <w x="864 448 880 448" f="0"/>
  <w x="816 464 864 464" f="0"/>
  <w x="896 464 960 464" f="0"/>
  <w x="816 160 864 160" f="0"/>
  <w x="896 160 960 160" f="0"/>
  <w x="864 128 864 160" f="0"/>
  <w x="896 128 896 160" f="0"/>
  <w x="864 464 864 496" f="0"/>
  <w x="896 464 896 496" f="0"/>
  <o en="4" sp="10" f="x3" p="0">
    <p v="0" sc="{VSCALE_OUT}"/>
    <p v="3" sc="{ISCALE_OUT}"/>
  </o>
  <o en="2" sp="10" f="x3" p="1">
    <p v="0" sc="{VSCALE_IN}"/>
    <p v="3" sc="{ISCALE_IN}"/>
  </o>
</cir>`;
    }

    var circuitString = falstadTemplate
        .replace(/{TIMESTEP}/g, timestep_str)
        .replace(/{MACRO_TIMESTEP}/g, mts_str)
        .replace(/{VIN}/g, vin_test)
        .replace(/{L_RES}/g, l_res)
        .replace(/{L_MAG}/g, l_mag)
        .replace(/{T_MAG_IDEAL}/g, t_mag_ideal)
        .replace(/{RATIO}/g, ratio)
        .replace(/{C_RES}/g, c_res)
        .replace(/{C_IN}/g, c_in)
        .replace(/{C_OUT}/g, c_out)
        .replace(/{R_LOAD}/g, r_load.toFixed(4))
        .replace(/{FREQ}/g, freq_hz)
        .replace(/{VSCALE_OUT}/g, vscale_out.toFixed(2))
        .replace(/{ISCALE_OUT}/g, iscale_out.toFixed(2))
        .replace(/{VSCALE_IN}/g, vscale_in.toFixed(2))
        .replace(/{ISCALE_IN}/g, iscale_in.toFixed(2));

    if (typeof embedFalstadSimulation === "function") {
        embedFalstadSimulation(circuitString, timestep_str, mts_str);

        var simContainer = document.getElementById("simulationContainer");
        if (simContainer) {
            simContainer.style.display = "block";
            simContainer.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

function hesapla() {
    if (!checkUserInput()) { setDefaultValues(); }
    updateChartsAndTable();
    if (typeof window.openSelectedTable === "function") {
        window.openSelectedTable();
    }
}

function printPage() { window.print(); }

// ----------------------------------------------------------------
// TABLO & MODAL ENTEGRASYONU (Modern Architecture)
// ----------------------------------------------------------------
window.openSelectedTable = function () {
    const modeElement = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeElement ? modeElement.value : "standard";

    var lOutputStr = document.getElementById('lOutput')?.innerText;
    var wmax1Str = document.getElementById('wmax1')?.innerText;
    var veOptStr = document.getElementById('VeOpt')?.innerText;

    if (!lOutputStr || isNaN(parseFloat(lOutputStr)) || !veOptStr || isNaN(parseFloat(veOptStr))) {
        var getT = window.getT || function (key) { return key; };
        alert(getT('adv_alert_calc_first') || "Lütfen önce hesaplama yapýn!");
        return;
    }

    if (mode === "advanced") {
        if (typeof window.openAdvancedTable === "function") {
            window.openAdvancedTable();
        } else {
            alert("Advanced modül yüklenemedi.");
        }
        return;
    }

    var L_H = window.lOutput_global * 1e-6;
    var Wmax = window.wmax1_global;
    var VeOpt = window.VeOpt_global;
    var vin_test = parseFloat(document.getElementById('vin_test')?.value) || 390;
    var f_hz = parseFloat(document.getElementById('f')?.innerText) || 130000;
    var nOutput = parseFloat(document.getElementById('nOutput')?.innerText) || 1;
    var Imax = window.Imax_global;

    var trafoParams = {
        title: (window.getT && window.getT('btn_transformer')) ? window.getT('btn_transformer') : "Transformer Data",
        topology: 'half_bridge',
        vin_min: vin_test,
        VeOpt: VeOpt,
        f_hz: f_hz,
        vin1: vin_test,
        nOutput: nOutput,
        I1_rms_sq: Math.pow(window.i1_rms_global, 2),
        I2_rms_sq: Math.pow(window.i2_rms_global, 2),
        d1_req: window.d1_req,
        d2_req: window.d2_req,
        max_litz: window.max_wire_d_mm
    };

    var coilParams = {
        title: (window.getT && window.getT('btn_coil')) ? window.getT('btn_coil') : "Coil Data",
        L_H: L_H,
        L_uH: window.lOutput_global,
        Wmax: Wmax,
        Imax: Imax,
        Irms_sq: Math.pow(window.il_rms, 2),
        d_wire_default: window.d_coil_req,
        min_area: window.A_coil_req,
        max_litz: window.max_wire_d_mm
    };

    if (typeof UIModal !== 'undefined' && UIModal.openDualModal) {
        UIModal.openDualModal([
            { type: 'trafo', title: trafoParams.title, params: trafoParams },
            { type: 'inductor', title: coilParams.title, params: coilParams }
        ]);
    } else {
        alert("Arayüz modülü (UIModal) yüklenemedi.");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const calcBtn = document.getElementById('calculateButton');
    if (calcBtn) calcBtn.addEventListener('click', updateChartsAndTable);

    const printBtn = document.getElementById('printButton');
    if (printBtn) printBtn.addEventListener('click', printPage);

    const openBtn = document.getElementById('openButton');
    if (openBtn) openBtn.addEventListener('click', window.openSelectedTable);
});
