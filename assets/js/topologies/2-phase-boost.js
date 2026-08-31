// ================================================================
// 2-Phase Interleaved Boost Converter
// ================================================================

window.l1_rms = 0;
window.l2_rms = 0;
window.A_coil_req = 0;
window.d_coil_req = 0;
window.lOutput1_global = 0;
window.lOutput2_global = 0;
window.wmax1_global = 0;
window.wmax2_global = 0;
window.Imax1_global = 0;
window.Imax2_global = 0;

window.toggleEffMode = function () {
    var effMode = document.getElementById("effMode").value;
    var rectMode = document.getElementById("rectifierMode") ? document.getElementById("rectifierMode").value : "async";

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
            if (lblVd) lblVd.innerText = "Diode Vd [V]";
            if (lblTrr) lblTrr.innerText = "trr [ns] / Irr [A]";
            if (thPonH) thPonH.innerText = "Diode Cond. (Pdiode_cond)";
            if (thPdiode) thPdiode.innerText = "Diode Rev. Rec. (Prr)";
        } else {
            if (document.getElementById("wrap_ron_h")) document.getElementById("wrap_ron_h").style.display = "flex";
            if (document.getElementById("wrap_deadtime")) document.getElementById("wrap_deadtime").style.display = "flex";
            if (lblVd) lblVd.innerText = "Body Diode Vsd [V]";
            if (lblTrr) lblTrr.innerText = "Body Diode trr [ns] / Irr [A]";
            if (thPonH) thPonH.innerText = "High-Side Cond. (Pon_H)";
            if (thPdiode) thPdiode.innerText = "External Diode (Sync=0W)";
        }
    }
};

window.addEventListener('DOMContentLoaded', (event) => {
    window.toggleEffMode();
});

window.checkUserInput = function () {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);

    if (isNaN(vin_min) || vin_min <= 0) vin_min = 40.0;
    if (isNaN(vin_max) || vin_max <= 0) vin_max = 60.0;
    if (isNaN(vout) || vout <= 0) vout = 181.0;
    if (isNaN(ilout) || ilout <= 0) ilout = 1.9;
    if (isNaN(f_khz) || f_khz <= 0) f_khz = 100.0;
    if (isNaN(verim) || verim <= 0) verim = 90.0;

    if (vout <= vin_max || vout <= vin_nom || vout <= vin_min) {
        if (typeof bootstrap !== 'undefined') {
            var buckModalEl = document.getElementById('buckWarningModal');
            if (buckModalEl) {
                var buckModal = new bootstrap.Modal(buckModalEl);
                buckModal.show();
            }
        } else {
            alert("Hata: Boost Converter'da Çıkış Gerilimi, Giriş Geriliminden BÜYÜK olmalıdır.");
        }
        return false;
    }

    if (vin_min > vin_max) vin_max = vin_min;

    if (isNaN(vin_nom) || vin_nom <= 0 || vin_nom < vin_min || vin_nom > vin_max) {
        vin_nom = vin_min;
    }

    if (f_khz < 0.1 || f_khz > 1000) {
        alert(window.getT ? window.getT('alert_freq_warning') : 'Frekans aralığı hatalı!');
        f_khz = 50.0;
    }

    document.getElementById('vin_min').value = vin_min;
    document.getElementById('vin_max').value = vin_max;
    document.getElementById('vin_nom').value = vin_nom;
    document.getElementById('vout').value = vout;
    document.getElementById('ilout').value = ilout;
    document.getElementById('f_khz').value = f_khz;
    document.getElementById('verim').value = verim;

    return true;
};

window.setDefaultValues = function () {
    document.getElementById('vin_min').value = 40;
    document.getElementById('vin_max').value = 60;
    document.getElementById('vin_nom').value = 50;
    document.getElementById('vout').value = 181;
    document.getElementById('ilout').value = 1.9;
    document.getElementById('f_khz').value = 100;
    document.getElementById('verim').value = 90;
};

window.updateChartsAndTable = function () {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value) / 100;
    var mode = document.getElementById("mode").value;
    var effMode = document.getElementById("effMode").value;

    var f_sw = f_khz * 1000;
    var Uf = 0.7;
    if (effMode === "real") {
        Uf = parseFloat(document.getElementById('p_vd').value) || 0.7;
    }
    var nUa = vout + Uf;

    // min voltage max power
    var Ue_min = vin_min;
    var Pin_min = (vout * ilout) / verim;
    var Iin_max = Pin_min / Ue_min;
    var Ie_min = Iin_max / 2;

    var target_deltaIL;
    if (mode === "continuous") {
        target_deltaIL = 0.4 * Ie_min;
    } else if (mode === "critical") {
        target_deltaIL = 2.0 * Ie_min;
    } else if (mode === "discontinuous") {
        target_deltaIL = 2.5 * Ie_min;
    }

    var lOutput_H = (nUa - Ue_min) * Ue_min / (nUa * f_sw * target_deltaIL);
    var lOutput = lOutput_H * 1e6;

    // Nominal
    var Ue_nom = vin_nom;
    var Pin_nom = (vout * ilout) / verim;
    var Iin_nom_total = Pin_nom / Ue_nom;
    var Ie_nom = Iin_nom_total / 2;

    var actual_deltaIL = (nUa - Ue_nom) * Ue_nom / (nUa * f_sw * lOutput_H);

    var epsilon = 0.02;
    var actualMode;
    if (actual_deltaIL > (2 * Ie_nom) + epsilon) {
        actualMode = "discontinuous";
    } else if (Math.abs(actual_deltaIL - (2 * Ie_nom)) <= epsilon) {
        actualMode = "critical";
    } else {
        actualMode = "continuous";
    }

    var modeWarnEl = document.getElementById('modeWarning');
    if (mode !== actualMode) {
        modeWarnEl.style.display = 'block';
        modeWarnEl.style.color = '#856404';
        modeWarnEl.style.border = '1px solid #ffeeba';
        modeWarnEl.style.backgroundColor = '#fff3cd';
        var modeNames = { "continuous": "CCM", "discontinuous": "DCM", "critical": "CRM" };
        modeWarnEl.innerHTML = "⚠️ <strong>Uyarı:</strong> Bobin <strong>" + modeNames[mode] + "</strong> moduna göre tasarlandı, ancak nominal giriş geriliminde (" + vin_nom + "V) devre <strong>" + modeNames[actualMode] + "</strong> moduna geçiyor!";
    } else {
        modeWarnEl.style.display = 'none';
    }

    var t1_s, Imax_phase, deltaILMax;

    if (actualMode === "continuous" || actualMode === "critical") {
        t1_s = (nUa - Ue_nom) / (nUa * f_sw);
        Imax_phase = Ie_nom + 0.5 * actual_deltaIL;
        deltaILMax = actual_deltaIL;
    } else {
        // DCM: separate phase approach
        var ratio = nUa / (nUa - Ue_nom) - 1;
        t1_s = Math.sqrt(2 * lOutput_H * (ilout / 2) / (f_sw * Ue_nom * ratio));
        var dIL_dc = Ue_nom * t1_s / lOutput_H;
        Imax_phase = dIL_dc;
        deltaILMax = Imax_phase;
    }

    var wmax = 0.5 * lOutput_H * Math.pow(Imax_phase, 2) * 1e6; // in uWs

    var D_nom = (nUa - Ue_nom) / nUa;
    var Delta_Vmax = 0.01 * vout;
    var C = (ilout * D_nom) / (Delta_Vmax * f_sw);
    var C_uF = C * 1e6;
    var rOutput = vout / ilout;

    window.lOutput1_global = lOutput;
    window.lOutput2_global = lOutput;
    window.wmax1_global = wmax;
    window.wmax2_global = wmax;
    window.Imax1_global = Imax_phase;
    window.Imax2_global = Imax_phase;
    window.l1_rms = Math.sqrt(Math.pow(Ie_nom, 2) + Math.pow(deltaILMax, 2) / 12);
    window.l2_rms = window.l1_rms;

    document.getElementById('lOutput1').innerText = lOutput.toFixed(2);
    document.getElementById('lOutput2').innerText = lOutput.toFixed(2);
    document.getElementById('cOutput').innerText = C_uF.toFixed(2);
    document.getElementById('rOutput').innerText = rOutput.toFixed(2);

    document.getElementById('deltaIL1Max').innerText = deltaILMax.toFixed(2);
    document.getElementById('deltaIL2Max').innerText = deltaILMax.toFixed(2);
    document.getElementById('wmaxL1').innerText = wmax.toFixed(2);
    document.getElementById('wmaxL2').innerText = wmax.toFixed(2);

    var effData, finalVerim = verim * 100;
    if (effMode === "ideal") {
        effData = generateIdealEffCurve(finalVerim, f_sw);
        document.getElementById("powerLossSection").style.display = "none";
    } else {
        var params = getRealParams();
        var realRes = calculateRealEfficiency(Ue_nom, vout, ilout, f_sw, deltaILMax, Ie_nom, params);
        finalVerim = realRes.efficiencyPercent;
        effData = generateRealEffCurve(Ue_nom, vout, ilout, f_sw, lOutput_H, params);

        document.getElementById("powerLossSection").style.display = "block";
        document.getElementById("res_pon_h").innerText = realRes.breakdown.Pon_H.toFixed(4) + " W";
        document.getElementById("res_pon_l").innerText = realRes.breakdown.Pon_L.toFixed(4) + " W";
        document.getElementById("res_psw_l").innerText = realRes.breakdown.Psw_L.toFixed(4) + " W";
        document.getElementById("res_pdiode").innerText = realRes.breakdown.Pdiode.toFixed(4) + " W";
        document.getElementById("res_pcoss").innerText = realRes.breakdown.Pcoss.toFixed(4) + " W";
        document.getElementById("res_pd").innerText = realRes.breakdown.Pd.toFixed(4) + " W";
        document.getElementById("res_pg").innerText = realRes.breakdown.Pg.toFixed(4) + " W";
        document.getElementById("res_pic").innerText = realRes.breakdown.Pic.toFixed(4) + " W";
        document.getElementById("res_pl_dcr").innerText = realRes.breakdown.Pl_dcr.toFixed(4) + " W";
        document.getElementById("res_pcin").innerText = realRes.breakdown.Pcin.toFixed(4) + " W";
        document.getElementById("res_pcout").innerText = realRes.breakdown.Pcout.toFixed(4) + " W";
        document.getElementById("res_ptotal").innerText = realRes.totalLossW.toFixed(4) + " W";
        document.getElementById("res_peff").innerText = realRes.efficiencyPercent.toFixed(2) + " %";
    }

    var wf = generateAllWaveforms(Ue_nom, vout, ilout, Ie_nom, lOutput_H, deltaILMax, Imax_phase, actualMode);
    drawCharts(wf, Iin_nom_total, ilout, Ue_nom, vout, effData);
    updateResultTable(wf);
};

window.getRealParams = function () {
    return {
        Ron_H: parseFloat(document.getElementById('p_ron_h').value) || 0.100,
        Ron_L: parseFloat(document.getElementById('p_ron_l').value) || 0.050,
        tr_L: (parseFloat(document.getElementById('p_tr_l').value) || 10) * 1e-9,
        tf_L: (parseFloat(document.getElementById('p_tf_l').value) || 10) * 1e-9,
        Coss_L: (parseFloat(document.getElementById('p_coss_l').value) || 120) * 1e-12,
        Qg_L: (parseFloat(document.getElementById('p_qg_l').value) || 15) * 1e-9,
        Vgs: parseFloat(document.getElementById('p_vgs').value) || 5.0,
        Vd: parseFloat(document.getElementById('p_vd').value) || 0.7,
        tDr: (parseFloat(document.getElementById('p_tdr').value) || 30) * 1e-9,
        tDf: (parseFloat(document.getElementById('p_tdf').value) || 30) * 1e-9,
        trr: (parseFloat(document.getElementById('p_trr').value) || 25) * 1e-9,
        Irr: parseFloat(document.getElementById('p_irr').value) || 0.5,
        DCR: parseFloat(document.getElementById('p_dcr').value) || 0.080,
        Icc: (parseFloat(document.getElementById('p_icc').value) || 2) * 1e-3,
        ESR_Cin: parseFloat(document.getElementById('p_esrcin').value) || 0.003,
        ESR_Cout: parseFloat(document.getElementById('p_esrcout').value) || 0.005
    };
};

window.calculateRealEfficiency = function (vin, vout, iout, f_sw_hz, deltaIL, IL_avg_per_phase, p) {
    var rectMode = document.getElementById("rectifierMode") ? document.getElementById("rectifierMode").value : "async";
    var D = 1 - (vin / (vout + p.Vd));

    var IL_rms_sq = Math.pow(IL_avg_per_phase, 2) + (Math.pow(deltaIL, 2) / 12);

    var Isw_rms_sq = D * IL_rms_sq;
    var Pon_L = 2 * Isw_rms_sq * p.Ron_L;

    var Psw_turn_on = 0.5 * (vout + p.Vd) * Math.max(0, IL_avg_per_phase - deltaIL / 2) * p.tr_L * f_sw_hz;
    var Psw_turn_off = 0.5 * (vout + p.Vd) * (IL_avg_per_phase + deltaIL / 2) * p.tf_L * f_sw_hz;
    var Psw_L = 2 * (Psw_turn_on + Psw_turn_off);

    var Pcoss = 2 * 0.5 * p.Coss_L * Math.pow(vout, 2) * f_sw_hz;
    var Pg = 2 * p.Qg_L * p.Vgs * f_sw_hz;

    var Id_rms_sq = (1 - D) * IL_rms_sq;
    var Id_avg = IL_avg_per_phase * (1 - D);

    var Pon_H = 0;
    var Pdiode_cond = 0;
    var Pd = 0;

    if (rectMode === "async") {
        Pdiode_cond = 2 * p.Vd * Id_avg;
    } else {
        Pon_H = 2 * Id_rms_sq * p.Ron_H;
        Pd = 2 * p.Vd * IL_avg_per_phase * (p.tDr + p.tDf) * f_sw_hz;
    }

    var Prr = 2 * 0.5 * vout * p.Irr * p.trr * f_sw_hz;
    var Pic = vin * p.Icc;
    var Pl_dcr = 2 * IL_rms_sq * p.DCR;

    var Icin_rms = (deltaIL / Math.sqrt(12)) * 0.5;
    var Pcin = Math.pow(Icin_rms, 2) * p.ESR_Cin;

    var Icout_rms = Math.sqrt(Math.max(0, 2 * Id_rms_sq - Math.pow(iout, 2)));
    var Pcout = Math.pow(Icout_rms, 2) * p.ESR_Cout;

    var Ptotal = Pon_H + Pdiode_cond + Pon_L + Psw_L + Prr + Pcoss + Pd + Pg + Pic + Pl_dcr + Pcin + Pcout;
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
            Pl_dcr: Pl_dcr,
            Pcin: Pcin,
            Pcout: Pcout
        }
    };
};

window.generateIdealEffCurve = function (eff_full_load, f_hz) {
    var values = [], labels = [];
    var k_fix = 0.020 * (f_hz / 50000);
    var k_cond = 0.030;
    function raw_eff(p) {
        if (p < 0.001) p = 0.001;
        var loss = k_fix + k_cond * p * p;
        return p / (p + loss);
    }

    var rawEffValAtFullLoad = raw_eff(1.0);
    var effRatio = (eff_full_load / 100) / rawEffValAtFullLoad;

    for (var pct = 10; pct <= 120; pct += 5) {
        var p = pct / 100.0;
        var e = raw_eff(p) * effRatio * 100;
        if (e > 99.5) e = 99.5; if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
};

window.generateRealEffCurve = function (vin, vout, max_iout, f_hz, L_H, params) {
    var values = [], labels = [];
    for (var pct = 10; pct <= 120; pct += 5) {
        var currentLoad = max_iout * (pct / 100);
        if (currentLoad <= 0.001) currentLoad = 0.001;

        var Uf = params.Vd;
        var nUa = vout + Uf;
        var Pin = (vout * currentLoad) / 0.9;
        var Iin_per_phase = (Pin / vin) / 2;
        var Delta_IL = (nUa - vin) * vin / (nUa * f_hz * L_H);

        var epsilon = 0.02;
        var DeltaILMax = Delta_IL;
        var Ie_nom = Iin_per_phase;

        if (Delta_IL > (2 * Ie_nom) + epsilon) {
            var ratio = nUa / (nUa - vin) - 1;
            var t1_s = Math.sqrt(2 * L_H * (currentLoad / 2) / (f_hz * vin * ratio));
            DeltaILMax = vin * t1_s / L_H;
        }

        var res = calculateRealEfficiency(vin, vout, currentLoad, f_hz, DeltaILMax, Ie_nom, params);
        var e = res.efficiencyPercent;
        if (e > 99.5) e = 99.5; if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
};

window.generateAllWaveforms = function (Ue, vout, ilout, Ie_per_phase, L_H, deltaIL, Imax, mode) {
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 100;
    var f = f_khz * 1000;
    var T = 1 / f;

    var effMode = document.getElementById("effMode").value;
    var Uf = (effMode === "real") ? (parseFloat(document.getElementById('p_vd').value) || 0.7) : 0.7;
    var nUa = vout + Uf;

    var D_actual;
    var t1_s;

    if (mode === "discontinuous") {
        var ratio = nUa / (nUa - Ue) - 1;
        t1_s = Math.sqrt(2 * L_H * (ilout / 2) / (f * Ue * ratio));
        D_actual = t1_s / T;
    } else {
        D_actual = (nUa - Ue) / nUa;
        t1_s = D_actual * T;
    }

    var t_off = T - t1_s;
    var t2_s = 0;

    if (mode === "discontinuous") {
        t2_s = Imax * L_H / (nUa - Ue);
        if (t2_s > t_off) t2_s = t_off * 0.95;
    } else {
        t2_s = t_off;
    }

    var IL_min = Math.max(0, Ie_per_phase - 0.5 * deltaIL);
    var IL_max = Ie_per_phase + 0.5 * deltaIL;
    if (mode === "discontinuous") {
        IL_min = 0;
        IL_max = Imax;
    }

    var pts = 100;
    var labels = [], il1 = [], il2 = [], vds1 = [], vds2 = [], id1 = [], id2 = [];

    for (var cycle = 0; cycle < 2; cycle++) {
        var t0 = cycle * T;

        for (var k = 0; k < pts; k++) {
            var frac = k / pts;
            var t_mod = frac;
            labels.push(((t0 + frac * T) * 1e6).toFixed(2));

            // Phase 1
            var il1_val, vds1_val, id1_val;
            if (t_mod < D_actual) { // Switch ON
                il1_val = IL_min + (IL_max - IL_min) * (t_mod / D_actual);
                vds1_val = 0;
                id1_val = 0;
            } else if (t_mod < D_actual + (t2_s / T)) { // Diode ON (t2_s)
                var frac_off = (t_mod - D_actual) / (t2_s / T);
                il1_val = IL_max - (IL_max - IL_min) * frac_off;
                if (mode === "discontinuous") {
                    il1_val = IL_max * (1 - frac_off);
                }
                vds1_val = nUa;
                id1_val = il1_val;
            } else { // Dead time (DCM)
                var frac_rest = (t_mod - D_actual - (t2_s / T)) / (1 - D_actual - (t2_s / T));
                var decay = Math.exp(-6 * frac_rest);
                il1_val = 0;
                vds1_val = Ue + (nUa - Ue) * decay + Math.sin(2 * Math.PI * 3 * frac_rest) * decay * (nUa - Ue) * 0.15;
                id1_val = 0;
            }
            il1.push(il1_val);
            vds1.push(vds1_val);
            id1.push(id1_val);

            // Phase 2
            var t_mod2 = (t_mod + 0.5) % 1.0;
            var il2_val, vds2_val, id2_val;
            if (t_mod2 < D_actual) {
                il2_val = IL_min + (IL_max - IL_min) * (t_mod2 / D_actual);
                vds2_val = 0;
                id2_val = 0;
            } else if (t_mod2 < D_actual + (t2_s / T)) {
                var frac_off2 = (t_mod2 - D_actual) / (t2_s / T);
                il2_val = IL_max - (IL_max - IL_min) * frac_off2;
                if (mode === "discontinuous") {
                    il2_val = IL_max * (1 - frac_off2);
                }
                vds2_val = nUa;
                id2_val = il2_val;
            } else {
                var frac_rest2 = (t_mod2 - D_actual - (t2_s / T)) / (1 - D_actual - (t2_s / T));
                var decay2 = Math.exp(-6 * frac_rest2);
                il2_val = 0;
                vds2_val = Ue + (nUa - Ue) * decay2 + Math.sin(2 * Math.PI * 3 * frac_rest2) * decay2 * (nUa - Ue) * 0.15;
                id2_val = 0;
            }
            il2.push(il2_val);
            vds2.push(vds2_val);
            id2.push(id2_val);
        }
    }

    return { labels: labels, il1: il1, il2: il2, vds1: vds1, vds2: vds2, id1: id1, id2: id2 };
};

window.drawCharts = function (wf, Iin, Iout, Vin, Vout_mag, effData) {
    var N = wf.labels.length;
    var tickStep = Math.max(1, Math.floor(N / 8));
    var textColor = '#e0e0e0';
    var gridColor = 'rgba(255, 255, 255, 0.1)';
    var refLineColor = 'rgba(255, 255, 255, 0.5)';
    var getT = window.getT || function (k) { return k; };

    function baseOpts(yTitle) {
        return {
            responsive: true, animation: false, elements: { point: { radius: 0 }, line: { tension: 0 } },
            scales: {
                x: { type: 'category', ticks: { color: textColor, maxTicksLimit: 9, callback: function (val, idx) { return (idx % tickStep === 0) ? wf.labels[idx] : ''; } }, title: { display: true, text: getT('chart_time_us') || 'Time (µs)', color: textColor }, grid: { color: gridColor, borderColor: gridColor } },
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
        { label: 'IL1 (Phase 1)', data: wf.il1, borderColor: '#ef5350', borderWidth: 2, fill: false },
        { label: 'IL2 (Phase 2)', data: wf.il2, borderColor: '#66bb6a', borderWidth: 2, fill: false },
        { label: 'Iin (Total Avg)', data: Array(N).fill(Iin), borderColor: refLineColor, borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 }
    ], 'Current (A)');

    mk('vdsChart', [
        { label: 'Vds1 (Phase 1)', data: wf.vds1, borderColor: '#42a5f5', borderWidth: 2, fill: false },
        { label: 'Vds2 (Phase 2)', data: wf.vds2, borderColor: '#ab47bc', borderWidth: 2, fill: false }
    ], 'Voltage (V)');

    mk('idChart', [
        { label: 'Id1 (Phase 1)', data: wf.id1, borderColor: '#ffa726', borderWidth: 2, fill: false },
        { label: 'Id2 (Phase 2)', data: wf.id2, borderColor: '#ffca28', borderWidth: 2, fill: false }
    ], 'Current (A)');

    var effCanvas = document.getElementById('effChart');
    if (effCanvas) {
        if (effCanvas.chart) { effCanvas.chart.destroy(); effCanvas.chart = null; }
        effCanvas.chart = new Chart(effCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: effData.labels,
                datasets: [{ label: 'Efficiency vs Load', data: effData.values, borderColor: '#81c784', backgroundColor: 'rgba(129, 199, 132, 0.15)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3 }]
            },
            options: { responsive: true, animation: false, scales: { x: { title: { display: true, text: 'Load (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }, y: { min: 0, max: 100, title: { display: true, text: 'Efficiency (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } } }, plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } } }
        });
    }
};

window.updateResultTable = function (wf) {
    var table = document.getElementById('resultTable');
    if (!table) return;
    var tbody = table.getElementsByTagName('tbody')[0];
    tbody.innerHTML = "";
    var N = wf.labels.length;
    var step = Math.max(1, Math.floor(N / 20));
    for (var i = 0; i <= 20; i++) {
        var idx = Math.min(i * step, N - 1);
        var row = tbody.insertRow(-1);
        row.insertCell(0).innerHTML = wf.labels[idx];
        row.insertCell(1).innerHTML = (wf.vds1[idx] || 0).toFixed(1);
        row.insertCell(2).innerHTML = (wf.vds2[idx] || 0).toFixed(1);
        row.insertCell(3).innerHTML = (wf.il1[idx] || 0).toFixed(2);
        row.insertCell(4).innerHTML = (wf.il2[idx] || 0).toFixed(2);
        row.insertCell(5).innerHTML = (wf.id1[idx] || 0).toFixed(2);
        row.insertCell(6).innerHTML = (wf.id2[idx] || 0).toFixed(2);
    }
};

window.openSelectedTable = function () {
    const modeElement = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeElement ? modeElement.value : "standard";

    if (!window.lOutput1_global) {
        alert(window.getT ? window.getT('adv_alert_calc_first') : "Lütfen önce hesaplama yapın!");
        return;
    }

    var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;
    var max_litz = 2 * 65.6 / Math.sqrt(f_khz * 1000);

    const params = {
        title: (window.getT ? window.getT('title_coil_data') : "Çekirdek Seçimi (Interleaved Boost)"),
        L_uH: window.lOutput1_global,
        L_H: window.lOutput1_global * 1e-6,
        Wmax: window.wmax1_global,
        Imax: window.Imax1_global,
        Irms_sq: Math.pow(window.l1_rms, 2),
        d_wire_default: Math.sqrt((4 * (window.l1_rms / 4)) / Math.PI), // J=4 approx
        min_area: window.l1_rms / 4,
        max_litz: max_litz,
        userMode: document.getElementById("mode").value
    };

    if (mode === "advanced") {
        if (typeof window.openAdvancedTable === "function") {
            window.openAdvancedTable();
        } else {
            alert("Advanced modül yüklenemedi.");
        }
    } else {
        if (typeof UIModal !== 'undefined') {
            UIModal.openDualModal([
                { type: 'inductor', title: 'L1 Coil', params: params },
                { type: 'inductor', title: 'L2 Coil', params: params }
            ]);
        }
    }
};

// ================================================================
// FALSTAD API & IFRAME MANAGEMENT FOR INTERLEAVED BOOST
// ================================================================
window.falstadSim = null;

window.embedFalstadSimulation = function (circuitString) {
    var iframe = document.getElementById("circuitFrame");

    // Initialize with a blank circuit
    var blankCct = encodeURIComponent("$ 1 0.000005 10.20027730826997 50 5 50 5e-11");
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
                    window.falstadSim = cw.CircuitJS1;
                    cw.CircuitJS1.importCircuit(circuitString, false);
                }
            } catch (e) { }
        }, 50);
    };
};

window.openFalstadInterleavedSimulation = function () {
    var vin_nom = parseFloat(document.getElementById('vin_nom').value) || 50;
    var vout = parseFloat(document.getElementById('vout').value) || 181;
    var ilout = parseFloat(document.getElementById('ilout').value) || 1.9;
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 100;

    var l_val_uH = parseFloat(document.getElementById('lOutput1').innerText) || 10;
    var c_val_uF = parseFloat(document.getElementById('cOutput').innerText) || 10;
    var r_val = parseFloat(document.getElementById('rOutput').innerText) || (vout / ilout);

    var dcr_val = parseFloat(document.getElementById('p_dcr') ? document.getElementById('p_dcr').value : 0.08);
    var ron_val = parseFloat(document.getElementById('p_ron_l') ? document.getElementById('p_ron_l').value : 0.05);
    var esr_cout = parseFloat(document.getElementById('p_esrcout') ? document.getElementById('p_esrcout').value : 0.02);

    var freq_hz = f_khz * 1000;
    var l_val = l_val_uH * 1e-6;

    // open loop capacitance choice
    var sim_c_uF = Math.max(c_val_uF * 10, 150);
    var c_val = sim_c_uF * 1e-6;

    var Vf = 0.2;

    var Iout_est = vout / r_val;
    var duty_cycle = 1 - (vin_nom / (vout + Vf));
    for (var iter = 0; iter < 6; iter++) {
        var D = duty_cycle;
        var Iin_est = Iout_est / (1 - D);
        var Iphase_est = Iin_est / 2;
        var Vdrop = Iphase_est * (dcr_val + D * ron_val);
        var Vin_eff = vin_nom - Vdrop;
        duty_cycle = 1 - (Vin_eff / (vout + Vf));
    }
    if (duty_cycle < 0.05) duty_cycle = 0.05;
    if (duty_cycle > 0.95) duty_cycle = 0.95;

    var sim_timestep = 1.0 / (freq_hz * 100);
    var timestep_str = sim_timestep.toExponential(2).toUpperCase();

    var falstadTemplate = `<cir f="1" ts="{TIMESTEP}" ic="250" cb="50" pb="50" vr="5" mts="5e-11">
  <c x="496 144 496 352" f="0" c="{C_VAL}" iv="0" sr="{ESR_COUT}" vd="0"/>
  <l x="176 144 304 144" f="0" l="{L_VAL}" ic="0" i="0"/>
  <l x="176 208 240 208" f="0" l="{L_VAL}" ic="0" i="0"/>
  <r x="112 144 176 144" f="0" r="{DCR}"/>
  <r x="112 208 176 208" f="0" r="{DCR}"/>
  <d x="304 144 432 144" f="1" mo="custom" fwdrop="0.2"/>
  <d x="368 208 432 208" f="1" mo="custom" fwdrop="0.2"/>
  <r x="560 144 560 352" f="0" r="{ROUT}"/>
  <as x="368 256 368 288" f="0" ron="{RON}" roff="10000000000" th="2.5"/>
  <as x="304 224 304 256" f="0" ron="{RON}" roff="10000000000" th="2.5"/>
  <g x="80 352 80 368" f="0"/>
  <v x="80 352 80 176" f="16" wf="0" maxv="{VIN}"/>
  <R x="288 240 256 240" f="17" wf="2" fr="{FREQ}" maxv="2.5" bias="2.5" dutyCycle="{DUTY}"/>
  <w x="240 208 368 208" f="0"/>
  <w x="432 208 432 144" f="0"/>
  <w x="432 144 496 144" f="0"/>
  <w x="496 144 560 144" f="0"/>
  <w x="304 352 368 352" f="0"/>
  <w x="368 352 496 352" f="0"/>
  <w x="496 352 560 352" f="0"/>
  <w x="112 144 112 176" f="0"/>
  <w x="112 176 112 208" f="0"/>
  <w x="80 176 112 176" f="0"/>
  <w x="80 352 304 352" f="0"/>
  <d x="384 288 384 256" f="1" mo="custom" fwdrop="0.2"/>
  <d x="320 256 320 224" f="1" mo="custom" fwdrop="0.2"/>
  <w x="320 224 304 224" f="0"/>
  <w x="320 256 304 256" f="0"/>
  <w x="304 224 304 144" f="0"/>
  <w x="304 256 304 352" f="0"/>
  <w x="368 208 368 256" f="0"/>
  <w x="368 288 368 352" f="0"/>
  <w x="384 256 368 256" f="0"/>
  <w x="384 288 368 288" f="0"/>
  <R x="352 272 352 304" f="17" wf="2" fr="{FREQ}" maxv="2.5" bias="2.5" phaseShift="3.14159265" dutyCycle="{DUTY}"/>
  <o en="7" sp="2" f="x3" p="0">
    <p v="0" sc="2.5"/>
    <p v="3" sc="0.003125"/>
  </o>
  <o en="28" sp="2" f="x3" p="1">
    <p v="0" sc="2.5"/>
    <p v="3" sc="0.0125"/>
  </o>
  <o en="30" sp="2" f="x3" p="2">
    <p v="0" sc="2.5"/>
    <p v="3" sc="0.0125"/>
  </o>
  <o en="1" sp="2" f="x3" p="3">
    <p v="0" sc="5"/>
    <p v="3" sc="0.0125"/>
    <p e="2" v="0" sc="5"/>
    <p e="2" v="3" sc="0.0125"/>
  </o>
</cir>`;

    var circuitString = falstadTemplate
        .replace(/{TIMESTEP}/g, timestep_str)
        .replace(/{C_VAL}/g, c_val.toExponential(4))
        .replace(/{L_VAL}/g, l_val.toExponential(4))
        .replace(/{DCR}/g, dcr_val)
        .replace(/{ROUT}/g, r_val.toFixed(2))
        .replace(/{RON}/g, ron_val)
        .replace(/{ESR_COUT}/g, esr_cout)
        .replace(/{VIN}/g, vin_nom)
        .replace(/{FREQ}/g, freq_hz)
        .replace(/{DUTY}/g, duty_cycle.toFixed(4));

    if (typeof window.embedFalstadSimulation === "function") {
        window.embedFalstadSimulation(circuitString);

        var simContainer = document.getElementById("simulationContainer");
        if (simContainer) {
            simContainer.style.display = "block";
            simContainer.scrollIntoView({ behavior: 'smooth' });
        }

        var liveDataBox = document.getElementById("liveDataBox");
        if (liveDataBox) {
            liveDataBox.style.display = "block";
            liveDataBox.innerHTML = "Fitcore SMPS Designer: 2-Phase Interleaved Boost Converter Simulation";
        }
    }
};

window.hesapla = function () {
    if (window.checkUserInput() === false) return;
    window.updateChartsAndTable();
    if (typeof window.openSelectedTable === "function") {
        window.openSelectedTable();
    }
};

document.getElementById('calculateButton').addEventListener('click', window.hesapla);