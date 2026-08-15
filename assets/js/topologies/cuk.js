// ================================================================
// Cuk Converter Calc
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================

window.l1_rms = 0;
window.l2_rms = 0;
window.wmax_L1 = 0;
window.wmax_L2 = 0;
window.deltaIL_L1 = 0;
window.deltaIL_L2 = 0;
window.lOutput_L1 = 0;
window.lOutput_L2 = 0;
window.Imax_L1 = 0;
window.Imax_L2 = 0;
window.min_area_L1 = 0;
window.min_area_L2 = 0;
window.d_wire_L1 = 0;
window.d_wire_L2 = 0;
window.max_wire_d_mm = 0;

// ================================================================
// UI MODE Change
// ================================================================
function toggleEffMode() {
    var effMode = document.getElementById("effMode").value;
    var rectMode = document.getElementById("rectifierMode") ? document.getElementById("rectifierMode").value : "async";
    var getT = window.getT || function (k) { return k; };

    if (effMode === "ideal") {
        document.getElementById("idealInputGroup").style.display = "contents";
        document.getElementById("realInputGroup").style.display = "none";
        document.getElementById("powerLossSection").style.display = "none";
    } else {
        document.getElementById("idealInputGroup").style.display = "none";
        document.getElementById("realInputGroup").style.display = "block";

        var lblVd = document.getElementById("lbl_vd");
        var lblTrr = document.getElementById("lbl_trr");
        var thPonH = document.getElementById("th_pon_h");
        var thPdiode = document.getElementById("th_pdiode");

        if (rectMode === "async") {
            if (document.getElementById("wrap_ron_h")) document.getElementById("wrap_ron_h").style.display = "none";
            if (document.getElementById("wrap_deadtime")) document.getElementById("wrap_deadtime").style.display = "none";

            if (lblVd) lblVd.innerText = getT("lbl_diode_vd") || "Diode Vd [V]";
            if (lblTrr) lblTrr.innerText = getT("lbl_trr_irr") || "trr [ns] / Irr [A]";
            if (thPonH) thPonH.innerText = getT("th_diode_cond") || "Diyot Ýletim (Pdiode_cond)";
            if (thPdiode) thPdiode.innerText = getT("th_diode_rr") || "Diyot Rev. Rec. (Prr)";
        } else {
            if (document.getElementById("wrap_ron_h")) document.getElementById("wrap_ron_h").style.display = "flex";
            if (document.getElementById("wrap_deadtime")) document.getElementById("wrap_deadtime").style.display = "flex";

            if (lblVd) lblVd.innerText = getT("lbl_body_diode_vsd") || "Body Diode Vsd [V]";
            if (lblTrr) lblTrr.innerText = getT("lbl_body_diode_trr") || "Body Diode trr [ns] / Irr [A]";
            if (thPonH) thPonH.innerText = getT("th_high_side_cond") || "High-Side Ýletim (Pon_H)";
            if (thPdiode) thPdiode.innerText = getT("th_ext_diode_sync") || "Harici Diyot (Sync=0W)";
        }
    }
}

window.addEventListener('DOMContentLoaded', (event) => {
    toggleEffMode();
});

// ================================================================
// Input Validation
// ================================================================
function checkUserInput() {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);

    if (isNaN(vin_min) || vin_min <= 0) vin_min = 4.0;
    if (isNaN(vin_max) || vin_max <= 0) vin_max = 6.0;
    if (isNaN(ilout) || ilout <= 0) ilout = 1.0;
    if (isNaN(f_khz) || f_khz <= 0) f_khz = 100.0;
    if (isNaN(verim) || verim <= 0) verim = 85.0;

    if (vout > 0) {
        var cukModalEl = document.getElementById('cukWarningModal');
        if (cukModalEl) {
            var cukModal = new bootstrap.Modal(cukModalEl);
            cukModal.show();
        }
        return false;
    }

    if (isNaN(vout) || vout === 0) vout = -15.0;
    if (vin_min > vin_max) vin_max = vin_min;

    if (isNaN(vin_nom) || vin_nom <= 0 || vin_nom < vin_min || vin_nom > vin_max) {
        vin_nom = vin_min;
    }

    if (f_khz < 0.1 || f_khz > 2000) {
        var getT = window.getT || function (k) { return k; };
        alert(getT("alert_freq_invalid") || "Frekans aralýðý geçerli deðil.");
        f_khz = 100.0;
    }

    document.getElementById('vin_min').value = vin_min;
    document.getElementById('vin_max').value = vin_max;
    document.getElementById('vin_nom').value = vin_nom;
    document.getElementById('vout').value = vout;
    document.getElementById('ilout').value = ilout;
    document.getElementById('f_khz').value = f_khz;
    document.getElementById('verim').value = verim;

    return true;
}

function setDefaultValues() {
    document.getElementById('vin_min').value = 4;
    document.getElementById('vin_max').value = 6;
    document.getElementById('vin_nom').value = 5;
    document.getElementById('vout').value = -12;
    document.getElementById('ilout').value = 1;
    document.getElementById('f_khz').value = 100;
    document.getElementById('verim').value = 85;
}

// ================================================================
// main calc
// ================================================================
function updateChartsAndTable() {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value) / 100.0;
    var mode = document.getElementById("mode").value;
    var effMode = document.getElementById("effMode").value;
    var getT = window.getT || function (k) { return k; };

    var vout_mag = Math.abs(vout);

    var Uf = 0.5;
    if (effMode === "real") {
        Uf = parseFloat(document.getElementById('p_vd').value) || 0.5;
    }

    var f = f_khz * 1000;

    var d_max = (vout_mag + Uf) / (vin_min + vout_mag + Uf);
    var d_nom = (vout_mag + Uf) / (vin_nom + vout_mag + Uf);

    var Pout = vout_mag * ilout;
    var Iin_nom = (Pout / verim) / vin_nom;

    var target_deltaIL1 = 0.4 * Iin_nom;
    var target_deltaIL2 = 0.4 * ilout;

    if (mode === "critical") {
        target_deltaIL1 = 2.0 * Iin_nom;
        target_deltaIL2 = 2.0 * ilout;
    } else if (mode === "discontinuous") {
        target_deltaIL1 = 2.5 * Iin_nom;
        target_deltaIL2 = 2.5 * ilout;
    }

    var L1_H = (vin_nom * d_nom) / (target_deltaIL1 * f);
    var L2_H = (vin_nom * d_nom) / (target_deltaIL2 * f);

    window.lOutput_L1 = L1_H * 1e6;
    window.lOutput_L2 = L2_H * 1e6;

    window.deltaIL_L1 = (vin_nom * d_nom) / (L1_H * f);
    window.deltaIL_L2 = (vin_nom * d_nom) / (L2_H * f);

    var IL1_valley = Iin_nom - 0.5 * window.deltaIL_L1;
    var IL2_valley = ilout - 0.5 * window.deltaIL_L2;
    var total_valley = IL1_valley + IL2_valley;

    var actualMode = (total_valley < -0.05) ? "discontinuous" : (Math.abs(total_valley) <= 0.05 ? "critical" : "continuous");

    var modeWarnEl = document.getElementById('modeWarning');
    if (mode !== actualMode) {
        modeWarnEl.style.display = 'block';
        modeWarnEl.style.color = '#856404';
        modeWarnEl.style.border = '1px solid #ffeeba';
        modeWarnEl.style.backgroundColor = '#fff3cd';

        var modeNameTranslated = getT("mode_" + actualMode) || actualMode;
        modeWarnEl.innerHTML = (getT("warn_mode_prefix") || "Uyarý: Devre ") + vin_nom + (getT("warn_mode_mid") || "V nominal giriþte <strong>") + modeNameTranslated + (getT("warn_mode_suffix") || "</strong> modunda çalýþýyor.");
    } else {
        modeWarnEl.style.display = 'none';
    }

    var t1_s = d_nom / f;
    window.Imax_L1 = Iin_nom + 0.5 * window.deltaIL_L1;
    window.Imax_L2 = ilout + 0.5 * window.deltaIL_L2;

    window.wmax_L1 = 0.5 * L1_H * Math.pow(window.Imax_L1, 2) * 1e6;
    window.wmax_L2 = 0.5 * L2_H * Math.pow(window.Imax_L2, 2) * 1e6;

    window.l1_rms = Math.sqrt(Math.pow(Iin_nom, 2) + Math.pow(window.deltaIL_L1, 2) / 12);
    window.l2_rms = Math.sqrt(Math.pow(ilout, 2) + Math.pow(window.deltaIL_L2, 2) / 12);

    var J = MagneticUtils.getCurrentDensity(f_khz);

    window.min_area_L1 = window.l1_rms / J;
    window.d_wire_L1 = 2 * Math.sqrt(window.min_area_L1 / Math.PI);

    window.min_area_L2 = window.l2_rms / J;
    window.d_wire_L2 = 2 * Math.sqrt(window.min_area_L2 / Math.PI);

    window.max_wire_d_mm = 2 * (65.6 / Math.sqrt(f_khz * 1000));

    var Ccp_uF = (ilout * d_nom) / (0.05 * (vin_nom + vout_mag) * f) * 1e6;
    var Cout_uF = window.deltaIL_L2 / (8 * f * (0.01 * vout_mag)) * 1e6;
    var rOutput = vout_mag / ilout;

    var effData, finalVerim = verim * 100;

    if (effMode === "ideal") {
        effData = generateIdealEffCurve(verim, f);
        document.getElementById("powerLossSection").style.display = "none";
        document.getElementById('loss').innerText = (100 - finalVerim).toFixed(2);
    } else {
        var params = getRealParams();
        var realRes = calculateRealEfficiency(vin_nom, vout_mag, ilout, f, L1_H, L2_H, params);
        finalVerim = realRes.efficiencyPercent;
        effData = generateRealEffCurve(vin_nom, vout_mag, ilout, f, L1_H, L2_H, params);

        document.getElementById("powerLossSection").style.display = "block";
        document.getElementById("res_pon_h").innerText = realRes.breakdown.Pon_H.toFixed(4) + " W";
        document.getElementById("res_pon_l").innerText = realRes.breakdown.Pon_L.toFixed(4) + " W";
        document.getElementById("res_psw_l").innerText = realRes.breakdown.Psw_L.toFixed(4) + " W";
        document.getElementById("res_pdiode").innerText = realRes.breakdown.Pdiode.toFixed(4) + " W";
        document.getElementById("res_pcoss").innerText = realRes.breakdown.Pcoss.toFixed(4) + " W";
        document.getElementById("res_pd").innerText = realRes.breakdown.Pd.toFixed(4) + " W";
        document.getElementById("res_pg").innerText = realRes.breakdown.Pg.toFixed(4) + " W";
        document.getElementById("res_pic").innerText = realRes.breakdown.Pic.toFixed(4) + " W";

        document.getElementById("res_pl1_dcr").innerText = realRes.breakdown.Pl1_dcr.toFixed(4) + " W";
        document.getElementById("res_pl2_dcr").innerText = realRes.breakdown.Pl2_dcr.toFixed(4) + " W";

        document.getElementById("res_pc1").innerText = realRes.breakdown.Pc1.toFixed(4) + " W";
        document.getElementById("res_pcout").innerText = realRes.breakdown.Pcout.toFixed(4) + " W";
        document.getElementById("res_ptotal").innerText = realRes.totalLossW.toFixed(4) + " W";
        document.getElementById("res_peff").innerText = realRes.efficiencyPercent.toFixed(2) + " %";

        document.getElementById('loss').innerText = Math.abs(100 - finalVerim).toFixed(2);
    }

    document.getElementById('lOutput1').innerText = window.lOutput_L1.toFixed(2);
    document.getElementById('lOutput2').innerText = window.lOutput_L2.toFixed(2);

    document.getElementById('c1Output').innerText = Ccp_uF.toFixed(2);
    document.getElementById('c2Output').innerText = Cout_uF.toFixed(2);
    document.getElementById('rOutput').innerText = rOutput.toFixed(2);

    document.getElementById('deltaIL1Max').innerText = window.deltaIL_L1.toFixed(2);
    document.getElementById('deltaIL2Max').innerText = window.deltaIL_L2.toFixed(2);

    document.getElementById('wmaxL1').innerText = window.wmax_L1.toFixed(2);
    document.getElementById('wmaxL2').innerText = window.wmax_L2.toFixed(2);

    var wf = generateAllWaveforms(vin_nom, vout_mag, ilout, Iin_nom, t1_s, L1_H, L2_H, window.deltaIL_L1, window.deltaIL_L2, actualMode);
    drawCharts(wf, Iin_nom, ilout, vin_nom, vout_mag, effData);
    updateResultTable(wf);
}

// ================================================================
// real power loss
// ================================================================
function getRealParams() {
    return {
        Ron_H: parseFloat(document.getElementById('p_ron_h').value) || 0.100,
        Ron_L: parseFloat(document.getElementById('p_ron_l').value) || 0.050,
        tr_L: (parseFloat(document.getElementById('p_tr_l').value) || 10) * 1e-9,
        tf_L: (parseFloat(document.getElementById('p_tf_l').value) || 10) * 1e-9,
        Coss_L: (parseFloat(document.getElementById('p_coss_l').value) || 120) * 1e-12,
        Qg_L: (parseFloat(document.getElementById('p_qg_l').value) || 15) * 1e-9,
        Vgs: parseFloat(document.getElementById('p_vgs').value) || 5.0,
        Vd: parseFloat(document.getElementById('p_vd').value) || 0.5,
        tDr: (parseFloat(document.getElementById('p_tdr').value) || 30) * 1e-9,
        tDf: (parseFloat(document.getElementById('p_tdf').value) || 30) * 1e-9,
        trr: (parseFloat(document.getElementById('p_trr').value) || 25) * 1e-9,
        Irr: parseFloat(document.getElementById('p_irr').value) || 0.5,
        DCR1: parseFloat(document.getElementById('p_dcr1').value) || 0.080,
        DCR2: parseFloat(document.getElementById('p_dcr2').value) || 0.080,
        Icc: (parseFloat(document.getElementById('p_icc').value) || 2) * 1e-3,
        ESR_C1: parseFloat(document.getElementById('p_esrc1').value) || 0.005,
        ESR_Cout: parseFloat(document.getElementById('p_esrcout').value) || 0.005
    };
}

function calculateRealEfficiency(vin, vout, iout, f_sw_hz, L1_H, L2_H, p) {
    var rectMode = document.getElementById("rectifierMode") ? document.getElementById("rectifierMode").value : "async";

    var r_load = vout / iout;
    var Uf = p.Vd;
    var M = (vout + Uf) / vin;
    var Leq = (L1_H * L2_H) / (L1_H + L2_H);
    var K = (2 * Leq * f_sw_hz) / r_load;
    var Kcrit = 1 / Math.pow(M + 1, 2);

    var D, D2;
    var I_L1_rms, I_L2_rms, I_Q1_rms, I_Q1_peak, I_Q1_valley, I_D1_rms;
    var Iin_avg, Ic1_rms, Icout_rms;

    if (K < Kcrit) {
        D = M * Math.sqrt(K);
        D2 = D * vin / (vout + Uf);

        var IL1_pk = (vin * D) / (L1_H * f_sw_hz);
        var IL2_pk = (vin * D) / (L2_H * f_sw_hz);

        I_Q1_peak = IL1_pk + IL2_pk;
        I_Q1_valley = 0;

        I_L1_rms = IL1_pk * Math.sqrt((D + D2) / 3);
        I_L2_rms = IL2_pk * Math.sqrt((D + D2) / 3);

        I_Q1_rms = I_Q1_peak * Math.sqrt(D / 3);
        I_D1_rms = I_Q1_peak * Math.sqrt(D2 / 3);

        Iin_avg = IL1_pk * (D + D2) / 2;

        Ic1_rms = Math.sqrt(D * Math.pow(IL2_pk, 2) / 3 + D2 * Math.pow(IL1_pk, 2) / 3);
        Icout_rms = Math.sqrt(Math.max(0, Math.pow(I_L2_rms, 2) - Math.pow(iout, 2)));

    } else {
        D = (vout + Uf) / (vin + vout + Uf);
        D2 = 1 - D;

        var dIL1 = (vin * D) / (L1_H * f_sw_hz);
        var dIL2 = (vin * D) / (L2_H * f_sw_hz);

        Iin_avg = iout * (vout + Uf) / vin;

        I_L1_rms = Math.sqrt(Math.pow(Iin_avg, 2) + Math.pow(dIL1, 2) / 12);
        I_L2_rms = Math.sqrt(Math.pow(iout, 2) + Math.pow(dIL2, 2) / 12);

        var I_Q1_avg = Iin_avg + iout;
        var dIL_total = dIL1 + dIL2;

        I_Q1_rms = Math.sqrt(D * (Math.pow(I_Q1_avg, 2) + Math.pow(dIL_total, 2) / 12));
        I_D1_rms = Math.sqrt(D2 * (Math.pow(I_Q1_avg, 2) + Math.pow(dIL_total, 2) / 12));

        I_Q1_peak = I_Q1_avg + dIL_total / 2;
        I_Q1_valley = I_Q1_avg - dIL_total / 2;

        Ic1_rms = Math.sqrt(D * Math.pow(iout, 2) + (1 - D) * Math.pow(Iin_avg, 2));
        Icout_rms = dIL2 / Math.sqrt(12);
    }

    var Pon_L = Math.pow(I_Q1_rms, 2) * p.Ron_L;

    var Psw_turn_on = 0.5 * (vin + vout + p.Vd) * I_Q1_valley * p.tr_L * f_sw_hz;
    var Psw_turn_off = 0.5 * (vin + vout + p.Vd) * I_Q1_peak * p.tf_L * f_sw_hz;
    var Psw_L = Psw_turn_on + Psw_turn_off;

    var Pcoss = 0.5 * p.Coss_L * Math.pow(vin + vout, 2) * f_sw_hz;
    var Pg = p.Qg_L * p.Vgs * f_sw_hz;

    var Pon_H = 0;
    var Pdiode_cond = 0;
    var Pd = 0;

    if (rectMode === "async") {
        Pdiode_cond = p.Vd * iout;
    } else {
        Pon_H = Math.pow(I_D1_rms, 2) * p.Ron_H;
        Pd = p.Vd * ((I_Q1_peak * p.tDr) + (I_Q1_valley * p.tDf)) * f_sw_hz;
    }

    var Prr = 0.5 * (vin + vout) * p.Irr * p.trr * f_sw_hz;
    var Pic = vin * p.Icc;

    var Pl1_dcr = Math.pow(I_L1_rms, 2) * p.DCR1;
    var Pl2_dcr = Math.pow(I_L2_rms, 2) * p.DCR2;

    var Pc1 = Math.pow(Ic1_rms, 2) * p.ESR_C1;
    var Pcout = Math.pow(Icout_rms, 2) * p.ESR_Cout;

    var Ptotal = Pon_H + Pdiode_cond + Pon_L + Psw_L + Prr + Pcoss + Pd + Pg + Pic + Pl1_dcr + Pl2_dcr + Pc1 + Pcout;
    var efficiency = (vout * iout) / ((vout * iout) + Ptotal) * 100;

    return {
        totalLossW: Ptotal,
        efficiencyPercent: efficiency,
        breakdown: {
            Pon_H: Pon_H,
            Pon_L: Pon_L,
            Psw_L: rectMode === "async" ? Psw_L : Psw_L + Prr,
            Pdiode: rectMode === "async" ? Pdiode_cond + Prr : 0,
            Pcoss: Pcoss,
            Pd: Pd,
            Pg: Pg,
            Pic: Pic,
            Pl1_dcr: Pl1_dcr,
            Pl2_dcr: Pl2_dcr,
            Pc1: Pc1,
            Pcout: Pcout
        }
    };
}

// ================================================================
// efficiency
// ================================================================
function generateIdealEffCurve(eff_full_load, f_hz) {
    var values = [], labels = [];
    var k_fix = 0.020 * (f_hz / 50000);
    var k_cond = 0.030;
    function raw_eff(p) {
        if (p < 0.001) p = 0.001;
        var loss = k_fix + k_cond * p * p;
        return p / (p + loss);
    }
    var scale = eff_full_load / raw_eff(1.0);
    for (var pct = 10; pct <= 120; pct += 5) {
        var p = pct / 100.0;
        var e = raw_eff(p) * scale * 100;
        if (e > 99.5) e = 99.5; if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
}

function generateRealEffCurve(vin, vout, max_iout, f_hz, L1_H, L2_H, params) {
    var values = [], labels = [];
    for (var pct = 10; pct <= 120; pct += 5) {
        var currentLoad = max_iout * (pct / 100);
        if (currentLoad <= 0.001) currentLoad = 0.001;

        var res = calculateRealEfficiency(vin, vout, currentLoad, f_hz, L1_H, L2_H, params);
        var e = res.efficiencyPercent;
        if (e > 99.5) e = 99.5; if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
}

// ================================================================
// wave forms
// ================================================================
function generateAllWaveforms(Ue, vout, ilout, Iin, t1_s, L1_H, L2_H, dIL1, dIL2, mode) {
    var effMode = document.getElementById("effMode").value;
    var Uf = (effMode === "real") ? (parseFloat(document.getElementById('p_vd').value) || 0.5) : 0.5;

    var f_khz = parseFloat(document.getElementById('f_khz').value) || 100;
    var f = f_khz * 1000;
    var T = 1 / f;

    var D;
    var r_load = vout / ilout;

    if (mode === "discontinuous") {
        var Leq = (L1_H * L2_H) / (L1_H + L2_H);
        var K = (2 * Leq * f) / r_load;
        var M = (vout + Uf) / Ue;
        D = M * Math.sqrt(K);
    } else {
        D = (vout + Uf) / (Ue + vout + Uf);
    }

    if (D > 0.95) D = 0.95;
    if (D < 0.05) D = 0.05;

    var t_on = D * T;
    var t_off1 = (Ue / (vout + Uf)) * t_on;
    var t_off2 = T - t_on - t_off1;

    if (t_off2 <= 0 || mode !== "discontinuous") {
        t_off1 = T - t_on;
        t_off2 = 0;
    }

    var IL1_min = 0, IL1_max = 0, IL2_min = 0, IL2_max = 0;

    if (mode === "discontinuous") {
        IL1_min = 0;
        IL2_min = 0;
        IL1_max = (Ue / L1_H) * t_on;
        IL2_max = (Ue / L2_H) * t_on;
    } else {
        IL1_min = Math.max(0, Iin - 0.5 * dIL1);
        IL1_max = Iin + 0.5 * dIL1;
        IL2_min = Math.max(0, ilout - 0.5 * dIL2);
        IL2_max = ilout + 0.5 * dIL2;
    }

    var PTS_ON = 40;
    var PTS_OFF1 = 40;
    var PTS_OFF2 = 20;

    var labels = [], il1 = [], il2 = [], vds = [], id = [];

    for (var cycle = 0; cycle < 2; cycle++) {
        var t0 = cycle * T;

        for (var k = 0; k < PTS_ON; k++) {
            var frac = k / PTS_ON;
            labels.push(((t0 + frac * t_on) * 1e6).toFixed(2));
            il1.push(IL1_min + (IL1_max - IL1_min) * frac);
            il2.push(IL2_min + (IL2_max - IL2_min) * frac);
            vds.push(0);
            id.push(0);
        }

        for (var k = 0; k < PTS_OFF1; k++) {
            var frac = k / PTS_OFF1;
            var current_il1 = IL1_max - (IL1_max - (mode === "discontinuous" ? 0 : IL1_min)) * frac;
            var current_il2 = IL2_max - (IL2_max - (mode === "discontinuous" ? 0 : IL2_min)) * frac;

            labels.push(((t0 + t_on + frac * t_off1) * 1e6).toFixed(2));
            il1.push(current_il1);
            il2.push(current_il2);
            vds.push(Ue + vout + Uf);
            id.push(Math.max(0, current_il1 + current_il2));
        }

        if (t_off2 > 0) {
            for (var k = 0; k < PTS_OFF2; k++) {
                var frac = k / PTS_OFF2;
                labels.push(((t0 + t_on + t_off1 + frac * t_off2) * 1e6).toFixed(2));
                il1.push(0);
                il2.push(0);
                id.push(0);
                var damping = Math.exp(-frac * 6);
                var ringing = Math.cos(frac * 8 * Math.PI);
                var vds_idle = Ue + (vout + Uf) * damping * ringing;
                vds.push(vds_idle);
            }
        }
    }
    return { labels: labels, il1: il1, il2: il2, vds: vds, id: id };
}

function drawCharts(wf, Iin, Iout, Vin, Vout_mag, effData) {
    var N = wf.labels.length;
    var tickStep = Math.max(1, Math.floor(N / 8));
    var textColor = '#e0e0e0';
    var gridColor = 'rgba(255, 255, 255, 0.1)';
    var refLineColor = 'rgba(255, 255, 255, 0.5)';
    var getT = window.getT || function (k) { return k; };

    var effMode = document.getElementById("effMode").value;
    var Uf = (effMode === "real") ? (parseFloat(document.getElementById('p_vd').value) || 0.5) : 0.5;

    var v_stress = Vin + Vout_mag + Uf;

    function baseOpts(yTitle) {
        return {
            responsive: true, animation: false, elements: { point: { radius: 0 }, line: { tension: 0 } },
            scales: {
                x: { type: 'category', ticks: { color: textColor, maxTicksLimit: 9, callback: function (val, idx) { return (idx % tickStep === 0) ? wf.labels[idx] + "us" : ''; } }, title: { display: true, text: getT('chart_time_us') || 'Time (µs)', color: textColor }, grid: { color: gridColor, borderColor: gridColor } },
                y: { title: { display: true, text: yTitle, color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }
            },
            plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } }
        };
    }

    function mk(id, datasets, yTitle) {
        var canvas = document.getElementById(id);
        if (!canvas) return;
        if (canvas.chart) { canvas.chart.destroy(); canvas.chart = null; }
        canvas.chart = new Chart(canvas.getContext('2d'), { type: 'line', data: { labels: wf.labels, datasets: datasets }, options: baseOpts(yTitle) });
    }

    mk('ilChart', [
        { label: getT("chart_il1_in") || "IL1 (Giriþ)", data: wf.il1, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, fill: false },
        { label: getT("chart_il2_out") || "IL2 (Çýkýþ)", data: wf.il2, borderColor: 'rgba(102, 187, 106, 1)', borderWidth: 2, fill: false },
        { label: getT("chart_iin_avg") || "Iin (Ort.)", data: Array(N).fill(Iin), borderColor: 'rgba(239, 83, 80, 0.5)', borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 },
        { label: getT("chart_iout_avg") || "Iout (Ort.)", data: Array(N).fill(Iout), borderColor: 'rgba(102, 187, 106, 0.5)', borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 }
    ], getT('chart_current_a') || 'Current (A)');

    mk('vinChart', [
        { label: getT("chart_vds_mosfet") || "Vds (MOSFET)", data: wf.vds, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false },
        { label: (getT("chart_v_stress") || "Vin + Vout (Stres)") + " (+Vf)", data: Array(N).fill(v_stress), borderColor: refLineColor, borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 }
    ], getT('chart_voltage_v') || 'Voltage (V)');

    mk('idChart', [
        { label: getT("chart_id_diode_sync") || "Id (Diode/Sync)", data: wf.id, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: false }
    ], getT('chart_current_a') || 'Current (A)');

    var effCanvas = document.getElementById('effChart');
    if (effCanvas) {
        if (effCanvas.chart) { effCanvas.chart.destroy(); effCanvas.chart = null; }
        effCanvas.chart = new Chart(effCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: effData.labels,
                datasets: [{ label: getT('chart_eff_pct') || 'Efficiency vs Load', data: effData.values, borderColor: 'rgba(129, 199, 132, 1)', backgroundColor: 'rgba(129, 199, 132, 0.15)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: 'rgba(129, 199, 132, 1)' }]
            },
            options: { responsive: true, animation: false, scales: { x: { title: { display: true, text: getT('chart_load_pct') || 'Load (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }, y: { min: 0, max: 100, title: { display: true, text: getT('chart_eff_pct') || 'Efficiency (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } } }, plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } } }
        });
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
        row.insertCell(1).innerHTML = (wf.vds[idx] || 0).toFixed(2) + " V";
        row.insertCell(2).innerHTML = (wf.il1[idx] || 0).toFixed(2) + " A";
        row.insertCell(3).innerHTML = (wf.il2[idx] || 0).toFixed(2) + " A";
        row.insertCell(4).innerHTML = (wf.id[idx] || 0).toFixed(2) + " A";
    }
}

// ================================================================
// FALSTAD API & IFRAME
// ================================================================
var falstadSim = null;

function embedFalstadSimulation(circuitString) {
    var encodedCircuit = encodeURIComponent(circuitString);
    var iframe = document.getElementById("circuitFrame");

    iframe.src = "./falstad/circuitjs.html?hideHeader=true&hideControls=false&noPowerCheck=true&cct=" + encodedCircuit;

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

// ================================================================
// CIRCUITJS (FALSTAD) Cuk CONVERTER
// ================================================================
function openFalstadCukSimulation() {
    var vin_nom = parseFloat(document.getElementById('vin_nom').value) || 12;
    var vout = parseFloat(document.getElementById('vout').value) || -24;
    var ilout = parseFloat(document.getElementById('ilout').value) || 2;
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;

    var vout_mag = Math.abs(vout);

    var l1_uH = parseFloat(document.getElementById('lOutput1').innerText) || 40;
    var l2_uH = parseFloat(document.getElementById('lOutput2').innerText) || 40;
    var c1_uF = parseFloat(document.getElementById('c1Output').innerText) || 10;
    var cout_uF = parseFloat(document.getElementById('c2Output').innerText) || 83;
    var r_load = parseFloat(document.getElementById('rOutput').innerText) || 12;
    var verim = parseFloat(document.getElementById('verim').value) / 100.0 || 0.85;

    document.getElementById("simulationContainer").style.display = "block";
    document.getElementById("liveDataBox").style.display = "block";
    document.getElementById("liveDataBox").innerHTML = "Fitcore SMPS Designer: Cuk Converter";

    document.getElementById("simulationContainer").scrollIntoView({ behavior: 'smooth' });

    var freq_hz = f_khz * 1000;
    var l1_henry = l1_uH * 1e-6;
    var l2_henry = l2_uH * 1e-6;
    var c1_farad = c1_uF * 1e-6;
    var cout_farad = cout_uF * 1e-6;

    var sim_timestep = 1.0 / (freq_hz * 50);
    var timestep_str = sim_timestep.toExponential(2).toUpperCase();

    var Uf = 0.5;
    var effMode = document.getElementById("effMode").value;
    if (effMode === "real") {
        Uf = parseFloat(document.getElementById('p_vd').value) || 0.5;
    }

    var d_nom_ccm = (vout_mag + Uf) / (vin_nom + vout_mag + Uf);

    var deltaIL_L1 = (vin_nom * d_nom_ccm) / (l1_henry * freq_hz);
    var deltaIL_L2 = (vin_nom * d_nom_ccm) / (l2_henry * freq_hz);
    var Pout = vout_mag * ilout;
    var Iin_nom = (Pout / verim) / vin_nom;

    var IL1_valley = Iin_nom - 0.5 * deltaIL_L1;
    var IL2_valley = ilout - 0.5 * deltaIL_L2;
    var total_valley = IL1_valley + IL2_valley;

    var currentMode = (total_valley < -0.05) ? "discontinuous" : "continuous";

    var duty_cycle;
    if (currentMode === "discontinuous") {
        var Leq = (l1_henry * l2_henry) / (l1_henry + l2_henry);
        var K = (2 * Leq * freq_hz) / r_load;
        var M = (vout_mag + Uf) / vin_nom;
        duty_cycle = M * Math.sqrt(K);
    } else {
        duty_cycle = d_nom_ccm;
    }

    if (duty_cycle > 0.95) duty_cycle = 0.95;
    if (duty_cycle < 0.05) duty_cycle = 0.05;

    var v_gate_max = 15;
    var v_amp = v_gate_max / 2;
    var vscale = Math.max(5, Math.ceil(vout_mag / 5) * 5);

    var input_current_approx = (vout_mag * ilout) / vin_nom;
    var iscale = Math.max(0.5, Math.ceil(input_current_approx / 2) * 0.5);

    var v_c1_initial = vin_nom + vout_mag;
    var ilout_neg = -ilout;
    var vout_signed = -vout_mag;

    var falstadTemplate = `
$ 1 {TIMESTEP} 100.0 50 5.0 50
v 96 320 96 176 0 0 40 {VIN} 0 0 0.5
v 144 256 192 256 0 2 {FREQ} {V_AMP} {V_AMP} 0 {DUTY}
l 96 176 240 176 0 {L1_VAL} {I_IN}
c 240 176 352 176 0 {C1_VAL} {V_C1}
d 352 176 352 320 1 {UF}
l 352 176 448 176 0 {L2_VAL} {ILOUT_NEG}
c 448 176 448 320 0 {COUT_VAL} {VOUT}
r 512 176 512 320 0 {R_VAL}
f 192 256 240 256 32 1.5 1000
w 240 240 240 176 0
w 240 272 240 320 0
w 96 320 240 320 0
w 240 320 352 320 0
w 352 320 448 320 0
w 448 320 512 320 0
w 448 176 512 176 0
g 96 320 96 336 0
o 8 1 0 34 {VSCALE} {ISCALE} 0 -1
o 2 1 0 33 {VSCALE} {ISCALE} 1 -1
o 5 1 0 33 {VSCALE} {ISCALE} 2 -1
o 4 1 0 33 {VSCALE} {ISCALE} 3 -1
o 6 1 0 34 {VSCALE} {ISCALE} 4 -1
`.trim();

    var circuitString = falstadTemplate
        .replace('{TIMESTEP}', timestep_str)
        .replace(/{VIN}/g, vin_nom)
        .replace('{VOUT}', vout_signed)
        .replace('{I_IN}', input_current_approx)
        .replace('{ILOUT_NEG}', ilout_neg)
        .replace('{V_C1}', v_c1_initial)
        .replace('{UF}', Uf)
        .replace('{L1_VAL}', l1_henry)
        .replace('{L2_VAL}', l2_henry)
        .replace('{C1_VAL}', c1_farad)
        .replace('{COUT_VAL}', cout_farad)
        .replace('{R_VAL}', r_load)
        .replace('{FREQ}', freq_hz)
        .replace(/{V_AMP}/g, v_amp)
        .replace('{DUTY}', duty_cycle)
        .replace(/{VSCALE}/g, vscale)
        .replace(/{ISCALE}/g, iscale);

    embedFalstadSimulation(circuitString);
}

function hesapla() {
    var checkResult = checkUserInput();
    if (checkResult === false) {
        return;
    }
    updateChartsAndTable();
    if (typeof window.openSelectedTable === "function") {
        window.openSelectedTable();
    }
}

function printPage() { window.print(); }

// ----------------------------------------------------------------
// Table and Modal
// ----------------------------------------------------------------
window.openSelectedTable = function () {
    const modeElement = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeElement ? modeElement.value : "standard";

    var l1 = parseFloat(window.lOutput_L1);
    var l2 = parseFloat(window.lOutput_L2);

    if (isNaN(l1) || isNaN(l2) || l1 === 0 || l2 === 0) {
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

    var coil1Params = {
        title: (window.getT && window.getT('btn_coil_l1')) ? window.getT('btn_coil_l1') : "L1 Bobin Data",
        L_H: window.lOutput_L1 * 1e-6,
        L_uH: window.lOutput_L1,
        Wmax: window.wmax_L1,
        Imax: window.Imax_L1,
        Irms_sq: Math.pow(window.l1_rms, 2),
        d_wire_default: window.d_wire_L1,
        min_area: window.min_area_L1,
        max_litz: window.max_wire_d_mm
    };

    var coil2Params = {
        title: (window.getT && window.getT('btn_coil_l2')) ? window.getT('btn_coil_l2') : "L2 Bobin Data",
        L_H: window.lOutput_L2 * 1e-6,
        L_uH: window.lOutput_L2,
        Wmax: window.wmax_L2,
        Imax: window.Imax_L2,
        Irms_sq: Math.pow(window.l2_rms, 2),
        d_wire_default: window.d_wire_L2,
        min_area: window.min_area_L2,
        max_litz: window.max_wire_d_mm
    };

    if (typeof UIModal !== 'undefined' && UIModal.openDualModal) {
        UIModal.openDualModal([
            { type: 'inductor', title: coil1Params.title, params: coil1Params },
            { type: 'inductor', title: coil2Params.title, params: coil2Params }
        ]);
    } else {
        alert("Arayüz modülü (UIModal) yüklenemedi.");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const calcBtn = document.getElementById('calculateButton');
    if (calcBtn) calcBtn.addEventListener('click', hesapla);

    const printBtn = document.getElementById('printButton');
    if (printBtn) printBtn.addEventListener('click', printPage);

    const openBtn = document.getElementById('openButton');
    if (openBtn) openBtn.addEventListener('click', window.openSelectedTable);
});
