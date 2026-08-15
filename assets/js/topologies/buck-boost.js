// ================================================================
// Inverting Buck-Boost Converter
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================

window.il_rms = 0;
window.A1_req = 0;
window.A2_req = 0;
window.A_coil_req = 0;
window.d_coil_req = 0;
window.lOutput_global = 0;
window.wmax1_global = 0;
window.Imax_global = 0;

// ================================================================
// UI SHOW/HIDE
// ================================================================
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
        var thPonL = document.getElementById("th_pon_l");
        var thPdiode = document.getElementById("th_pdiode");

        if (rectMode === "async") {
            if (document.getElementById("wrap_ron_l")) document.getElementById("wrap_ron_l").style.display = "none";
            if (document.getElementById("wrap_coss_l")) document.getElementById("wrap_coss_l").style.display = "none";
            if (document.getElementById("wrap_qg_l")) document.getElementById("wrap_qg_l").style.display = "none";
            if (document.getElementById("wrap_deadtime")) document.getElementById("wrap_deadtime").style.display = "none";

            if (lblVd) lblVd.innerText = "Diode Vd [V]";
            if (lblTrr) lblTrr.innerText = "trr [ns] / Irr [A]";
            if (thPonL) thPonL.innerText = "Diode Cond. (Pdiode_cond)";
            if (thPdiode) thPdiode.innerText = "Diode Rev. Rec. (Prr)";
        } else {
            if (document.getElementById("wrap_ron_l")) document.getElementById("wrap_ron_l").style.display = "flex";
            if (document.getElementById("wrap_coss_l")) document.getElementById("wrap_coss_l").style.display = "flex";
            if (document.getElementById("wrap_qg_l")) document.getElementById("wrap_qg_l").style.display = "flex";
            if (document.getElementById("wrap_deadtime")) document.getElementById("wrap_deadtime").style.display = "flex";

            if (lblVd) lblVd.innerText = "Body Diode Vsd [V]";
            if (lblTrr) lblTrr.innerText = "Body Diode trr [ns] / Irr [A]";
            if (thPonL) thPonL.innerText = "Sync Cond. (Pon_Sync)";
            if (thPdiode) thPdiode.innerText = "External Diode (Sync=0W)";
        }
    }
};

window.addEventListener('DOMContentLoaded', (event) => {
    window.toggleEffMode();
});

// ================================================================
// INPUT VALIDATION
// ================================================================
window.checkUserInput = function () {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);

    if (isNaN(vin_min) || vin_min <= 0) vin_min = 12.0;
    if (isNaN(vin_max) || vin_max <= 0) vin_max = 18.0;
    if (isNaN(ilout) || ilout <= 0) ilout = 1.0;
    if (isNaN(f_khz) || f_khz <= 0) f_khz = 50.0;
    if (isNaN(verim) || verim <= 0) verim = 80.0;

    if (vout > 0) {
        if (typeof bootstrap !== 'undefined') {
            var modalEl = document.getElementById('invBuckBoostWarningModal');
            if (modalEl) {
                var warningModal = bootstrap.Modal.getOrCreateInstance(modalEl);
                warningModal.show();
            }
        } else {
            alert("Hata: Inverting Buck-Boost dönüştürücüler evirici yapıdadır, çıkış gerilimi pozitif olamaz.");
        }
        return false;
    }

    if (isNaN(vout) || vout === 0) vout = -15.0;

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
    document.getElementById('vin_min').value = 12;
    document.getElementById('vin_max').value = 18;
    document.getElementById('vin_nom').value = 12;
    document.getElementById('vout').value = -15;
    document.getElementById('ilout').value = 1;
    document.getElementById('f_khz').value = 50;
    document.getElementById('verim').value = 80;
};

// ================================================================
// main
// ================================================================
window.updateChartsAndTable = function () {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);
    var mode = document.getElementById("mode").value;
    var effMode = document.getElementById("effMode").value;

    var Uf = 0.7;
    var f = f_khz * 1000;
    var T = 1.0 / f;
    var Ua_mag = Math.abs(vout);
    var nUa = Ua_mag + Uf;

    var Ue_min = vin_min;
    var t1_min = nUa / (f * (Ue_min + nUa));
    var IL_min_case = ilout * T / (T - t1_min);

    var target_deltaIL;
    if (mode === "continuous") {
        target_deltaIL = 0.4 * IL_min_case;
    } else if (mode === "critical") {
        target_deltaIL = 2.0 * IL_min_case;
    } else if (mode === "discontinuous") {
        target_deltaIL = 2.5 * IL_min_case;
    }

    var lOutput_H = Ue_min * t1_min / target_deltaIL;
    var lOutput = lOutput_H * 1e6;
    var deltaILMax = target_deltaIL;

    var Ue_nom = vin_nom;
    var t1_nom = nUa / (f * (Ue_nom + nUa));
    var IL_nom = ilout * T / (T - t1_nom);
    var actual_deltaIL = Ue_nom * t1_nom / lOutput_H;

    var epsilon = 0.02;
    var actualMode;
    if (actual_deltaIL > (2 * IL_nom) + epsilon) {
        actualMode = "discontinuous";
    } else if (Math.abs(actual_deltaIL - (2 * IL_nom)) <= epsilon) {
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
        modeWarnEl.innerHTML = "⚠️ <strong>" + (window.getT ? window.getT('warning_mode_1') : "Uyarı:") + "</strong> Bobin <strong>" + modeNames[mode] + "</strong> moduna göre tasarlandı, ancak nominal giriş geriliminde (" + vin_nom + "V) devre <strong>" + modeNames[actualMode] + "</strong> moduna geçiyor!";
    } else {
        modeWarnEl.style.display = 'none';
    }

    var t1, Imax;
    if (actualMode === "continuous" || actualMode === "critical") {
        t1 = t1_nom;
        Imax = IL_nom + 0.5 * actual_deltaIL;
        deltaILMax = actual_deltaIL;
    } else {
        var t1_dc = Math.sqrt(2 * lOutput_H * ilout * nUa / (f * Ue_nom * Ue_nom));
        t1 = t1_dc;
        var dIL_dc = Ue_nom * t1_dc / lOutput_H;
        Imax = dIL_dc;
        deltaILMax = Imax;
    }

    var wmax1 = 0.5 * lOutput_H * Imax * Imax * 1e6;

    var D = nUa / (Ue_nom + nUa);
    var Vripple = Ua_mag * 0.01;
    var cOutput = ilout * D / (f * Vripple) * 1e6;
    var rOutput = Ua_mag / ilout;

    var finalKullanilacakVerim = verim;
    var effData;

    if (effMode === "ideal") {
        effData = window.generateIdealEffCurve(verim / 100, f);
        document.getElementById("powerLossSection").style.display = "none";

        var Pout = Ua_mag * ilout;
        var Pin = IL_nom * Ue_nom;
        var eff_actual = (Pout / Pin) * 100;
        var loss = Math.abs(eff_actual - verim);
        if (document.getElementById('loss')) document.getElementById('loss').innerText = loss.toFixed(2);
    } else {
        var params = window.getRealParams();
        effData = window.generateRealEffCurve(vin_nom, vout, ilout, f, lOutput_H, params);

        var realRes = window.calculateRealEfficiency(vin_nom, vout, ilout, f, deltaILMax, IL_nom, params);

        finalKullanilacakVerim = realRes.efficiencyPercent;
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

        var loss = Math.abs(100 - finalKullanilacakVerim);
        if (document.getElementById('loss')) document.getElementById('loss').innerText = loss.toFixed(2);
    }

    var J = MagneticUtils.getCurrentDensity(f_khz);

    var D_max_adv = Ua_mag / (vin_min * (finalKullanilacakVerim / 100) + Ua_mag);
    var Ie_max_adv = ilout / (1 - D_max_adv);
    window.il_rms = Math.sqrt(Math.pow(Ie_max_adv, 2) + Math.pow(deltaILMax, 2) / 12);
    window.A_coil_req = window.il_rms / J;
    window.d_coil_req = Math.sqrt((4 * window.A_coil_req) / Math.PI);

    // PRECISE IIN CALCULATION (Input Current)
    var Pout_val = Ua_mag * ilout;
    var Pin_val = Pout_val / (finalKullanilacakVerim / 100);
    var iin_val = Pin_val / vin_nom;

    var iinEl = document.getElementById('iin');
    if (iinEl) {
        iinEl.innerText = iin_val.toFixed(2);
    }

    var iinContainer = document.getElementById('iin_container');
    if (iinContainer) {
        iinContainer.style.display = "inline";
    }

    window.lOutput_global = lOutput;
    window.wmax1_global = wmax1;
    window.Imax_global = Imax;

    document.getElementById('lOutput').innerText = lOutput.toFixed(2);
    document.getElementById('cOutput').innerText = cOutput.toFixed(2);
    document.getElementById('rOutput').innerText = rOutput.toFixed(2);
    document.getElementById('deltaILMax').innerText = deltaILMax.toFixed(2);
    document.getElementById('wmax1').innerText = wmax1.toFixed(2);

    var wf = window.generateAllWaveforms(Ue_nom, vout, ilout, IL_nom, t1, lOutput_H, deltaILMax, Imax, actualMode);
    window.drawCharts(wf, IL_nom, ilout, Ue_nom, effData);
    window.updateResultTable(wf);
};

// ================================================================
// ACTUAL LOSS CALCULATIONS
// ================================================================
window.getRealParams = function () {
    return {
        Ron_H: parseFloat(document.getElementById('p_ron_h').value) || 0.150,
        Ron_L: parseFloat(document.getElementById('p_ron_l').value) || 0.050,
        tr: (parseFloat(document.getElementById('p_tr_l').value) || 12) * 1e-9,
        tf: (parseFloat(document.getElementById('p_tf_l').value) || 12) * 1e-9,
        Coss: (parseFloat(document.getElementById('p_coss_l').value) || 150) * 1e-12,
        Qg: (parseFloat(document.getElementById('p_qg_l').value) || 20) * 1e-9,
        Vgs: parseFloat(document.getElementById('p_vgs').value) || 5.0,
        Vd: parseFloat(document.getElementById('p_vd').value) || 0.7,
        tDr: (parseFloat(document.getElementById('p_tdr').value) || 35) * 1e-9,
        tDf: (parseFloat(document.getElementById('p_tdf').value) || 35) * 1e-9,
        trr: (parseFloat(document.getElementById('p_trr').value) || 30) * 1e-9,
        Irr: parseFloat(document.getElementById('p_irr').value) || 0.6,
        DCR: parseFloat(document.getElementById('p_dcr').value) || 0.060,
        Icc: (parseFloat(document.getElementById('p_icc').value) || 2.5) * 1e-3,
        ESR_Cin: parseFloat(document.getElementById('p_esrcin').value) || 0.005,
        ESR_Cout: parseFloat(document.getElementById('p_esrcout').value) || 0.004
    };
};

window.calculateRealEfficiency = function (vin, vout, iout, f_sw_hz, deltaIL, IL_avg, p) {
    var rectMode = document.getElementById("rectifierMode") ? document.getElementById("rectifierMode").value : "async";
    var Ua_mag = Math.abs(vout);
    var D = Ua_mag / (vin + Ua_mag);

    var IL_rms_sq = Math.pow(IL_avg, 2) + (Math.pow(deltaIL, 2) / 12);
    var Isw_rms_sq = D * IL_rms_sq;
    var Id_rms_sq = (1 - D) * IL_rms_sq;
    var V_stress = vin + Ua_mag;

    var Pon_SW = Isw_rms_sq * p.Ron_H;
    var Psw = 0.5 * V_stress * IL_avg * (p.tr + p.tf) * f_sw_hz;
    var Pcoss_main = 0.5 * p.Coss * Math.pow(V_stress, 2) * f_sw_hz;
    var Pg_main = p.Qg * p.Vgs * f_sw_hz;

    var Pon_L = 0;
    var Pdiode = 0;
    var Pd = 0;
    var Pg_sync = 0;
    var Pcoss_sync = 0;

    var Prr = 0.5 * V_stress * p.Irr * p.trr * f_sw_hz;

    if (rectMode === "async") {
        Pdiode = p.Vd * iout;
    } else {
        Pon_L = Id_rms_sq * p.Ron_L;
        Pd = p.Vd * iout * (p.tDr + p.tDf) * f_sw_hz;
        Pg_sync = p.Qg * p.Vgs * f_sw_hz;
        Pcoss_sync = 0.5 * p.Coss * Math.pow(V_stress, 2) * f_sw_hz;
    }

    var Pcoss_total = Pcoss_main + Pcoss_sync;
    var Pg_total = Pg_main + Pg_sync;
    var Pic = vin * p.Icc;

    var Pl_dcr = IL_rms_sq * p.DCR;
    var Pcin = D * IL_rms_sq * p.ESR_Cin;

    var Icout_rms_sq = Math.max(0, Id_rms_sq - Math.pow(iout, 2));
    var Pcout = Icout_rms_sq * p.ESR_Cout;

    var Ptotal = Pon_SW + Pon_L + Pdiode + Psw + Prr + Pcoss_total + Pd + Pg_total + Pic + Pl_dcr + Pcin + Pcout;
    var efficiency = (Ua_mag * iout) / ((Ua_mag * iout) + Ptotal) * 100;

    return {
        totalLossW: Ptotal,
        efficiencyPercent: efficiency,
        breakdown: {
            Pon_H: Pon_SW,
            Pon_L: Pon_L,
            Psw_L: rectMode === "async" ? Psw : Psw + Prr,
            Pdiode: rectMode === "async" ? Pdiode + Prr : 0,
            Pcoss: Pcoss_total,
            Pd: Pd,
            Pg: Pg_total,
            Pic: Pic,
            Pl_dcr: Pl_dcr,
            Pcin: Pcin,
            Pcout: Pcout
        }
    };
};

window.generateIdealEffCurve = function (eff_full_load, f_hz) {
    var values = [], labels = [];
    var k_fix = 0.023 * (f_hz / 50000);
    var k_cond = 0.033;

    function raw_eff(p) {
        if (p < 0.001) p = 0.001;
        var loss = k_fix + k_cond * p * p;
        return p / (p + loss);
    }
    var scale = eff_full_load / raw_eff(1.0);

    for (var pct = 10; pct <= 120; pct += 5) {
        var p = pct / 100.0;
        var e = raw_eff(p) * scale * 100;
        if (e > 99.5) e = 99.5;
        if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
};

window.generateRealEffCurve = function (vin, vout, max_iout, f_hz, L_H, params) {
    var values = [], labels = [];
    var Uf = 0.7;
    var Ua_mag = Math.abs(vout);
    var nUa = Ua_mag + Uf;

    for (var pct = 10; pct <= 120; pct += 5) {
        var currentLoad = max_iout * (pct / 100);
        if (currentLoad <= 0.001) currentLoad = 0.001;

        var T = 1.0 / f_hz;
        var t1 = nUa / (f_hz * (vin + nUa));
        var IL_avg = currentLoad * T / (T - t1);
        var actualDeltaIL = vin * t1 / L_H;

        var res = window.calculateRealEfficiency(vin, vout, currentLoad, f_hz, actualDeltaIL, IL_avg, params);
        var e = res.efficiencyPercent;
        if (e > 99.5) e = 99.5; if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
};

// ================================================================
// WAVEFORM GENERATOR
// ================================================================
window.generateAllWaveforms = function (Ue, vout, ilout, IL_avg, t1_s, L_H, deltaIL, Imax, mode) {
    var Uf = 0.7;
    var Ua_mag = Math.abs(vout);
    var nUa = Ua_mag + Uf;
    var T = t1_s * (Ue + nUa) / nUa;
    var t_off = T - t1_s;

    var IL_min = Math.max(0, IL_avg - 0.5 * deltaIL);
    var IL_max = IL_avg + 0.5 * deltaIL;

    var slope_on = Ue / L_H;
    var slope_off = -nUa / L_H;

    var t2_s = 0;
    if (mode === "discontinuous") {
        t2_s = Imax * L_H / nUa;
        if (t2_s > t_off) t2_s = t_off * 0.95;
    }

    var PTS = 100;
    var labels = [], il = [], vl = [], id = [];

    for (var cycle = 0; cycle < 2; cycle++) {
        var t0 = cycle * T;
        if (mode === "continuous" || mode === "critical") {
            for (var k = 0; k < PTS; k++) {
                var frac = k / PTS;
                labels.push(((t0 + frac * t1_s) * 1e6).toFixed(2));
                il.push(IL_min + slope_on * frac * t1_s);
                vl.push(Ue);
                id.push(0);
            }
            for (var k = 0; k < PTS; k++) {
                var frac = k / PTS;
                var il_val = IL_max + slope_off * frac * t_off;
                labels.push(((t0 + t1_s + frac * t_off) * 1e6).toFixed(2));
                il.push(il_val);
                vl.push(-nUa);
                id.push(il_val > 0 ? il_val : 0);
            }
        } else {
            var t_rest = t_off - t2_s;
            for (var k = 0; k < PTS; k++) {
                var frac = k / PTS;
                labels.push(((t0 + frac * t1_s) * 1e6).toFixed(2));
                il.push(Imax * frac);
                vl.push(Ue);
                id.push(0);
            }
            var PTS2 = Math.max(Math.round(PTS * t2_s / t_off), 10);
            for (var k = 0; k < PTS2; k++) {
                var frac = k / PTS2;
                var il_val = Imax * (1 - frac);
                labels.push(((t0 + t1_s + frac * t2_s) * 1e6).toFixed(2));
                il.push(il_val);
                vl.push(-nUa);
                id.push(il_val);
            }
            var PTS3 = Math.max(PTS - PTS2, 5);
            for (var k = 0; k < PTS3; k++) {
                var frac = k / PTS3;
                var decay = Math.exp(-6 * frac);
                labels.push(((t0 + t1_s + t2_s + frac * t_rest) * 1e6).toFixed(2));
                il.push(0);
                vl.push(Math.sin(2 * Math.PI * 3 * frac) * decay * Ue * 0.15);
                id.push(0);
            }
        }
    }
    return { labels: labels, il: il, vl: vl, id: id };
};

// ================================================================
// CHARTS AND TABLES
// ================================================================
window.drawCharts = function (wf, IL_avg, ilout, Ue, effData) {
    var N = wf.labels.length;
    var tickStep = Math.max(1, Math.floor(N / 8));
    var textColor = '#e0e0e0';
    var gridColor = 'rgba(255, 255, 255, 0.1)';
    var refLineColor = 'rgba(255, 255, 255, 0.5)';

    function baseOpts(yTitle) {
        return {
            responsive: true, animation: false, elements: { point: { radius: 0 }, line: { tension: 0 } },
            scales: {
                x: { type: 'category', ticks: { color: textColor, maxTicksLimit: 9, callback: function (val, idx) { return (idx % tickStep === 0) ? wf.labels[idx] + "µs" : ''; } }, title: { display: true, text: 'Time (µs)', color: textColor }, grid: { color: gridColor, borderColor: gridColor } },
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
        { label: 'IL (Bobin)', data: wf.il, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, fill: false },
        { label: 'IL_avg', data: Array(N).fill(IL_avg), borderColor: refLineColor, borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 }
    ], 'Current (A)');

    mk('vinChart', [
        { label: 'V_L (Bobin Voltage)', data: wf.vl, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false, stepped: 'before' },
        { label: '0V', data: Array(N).fill(0), borderColor: refLineColor, borderWidth: 1.5, borderDash: [4, 4], fill: false, pointRadius: 0 }
    ], 'Voltage (V)');

    mk('idChart', [
        { label: 'Id (Diode/Sync)', data: wf.id, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: false },
        { label: 'Iout', data: Array(N).fill(ilout), borderColor: refLineColor, borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 }
    ], 'Current (A)');

    var effCanvas = document.getElementById('effChart');
    if (effCanvas) {
        if (effCanvas.chart) { effCanvas.chart.destroy(); effCanvas.chart = null; }
        effCanvas.chart = new Chart(effCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: effData.labels,
                datasets: [{ label: 'Efficiency vs Load', data: effData.values, borderColor: 'rgba(129, 199, 132, 1)', backgroundColor: 'rgba(129, 199, 132, 0.15)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: 'rgba(129, 199, 132, 1)' }]
            },
            options: { responsive: true, animation: false, scales: { x: { title: { display: true, text: 'Load (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }, y: { min: 0, max: 100, title: { display: true, text: 'Efficiency (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } } }, plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } } }
        });
    }
};

window.updateResultTable = function (wf) {
    var table = document.getElementById('resultTable');
    if (!table) return;
    var tbody = table.getElementsByTagName('tbody')[0];
    if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
    } else {
        tbody.innerHTML = "";
    }
    var N = wf.labels.length;
    var step = Math.max(1, Math.floor(N / 20));
    for (var i = 0; i <= 20; i++) {
        var idx = Math.min(i * step, N - 1);
        var row = tbody.insertRow(-1);
        row.insertCell(0).innerHTML = wf.labels[idx] + " µs";
        row.insertCell(1).innerHTML = (wf.vl[idx] || 0).toFixed(2) + " V";
        row.insertCell(2).innerHTML = (wf.il[idx] || 0).toFixed(2) + " A";
        row.insertCell(3).innerHTML = (wf.id[idx] || 0).toFixed(2) + " A";
    }
};

// ================================================================
// UI Modal Entegrasyonu
// ================================================================
window.openSelectedTable = function () {
    const modeElement = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeElement ? modeElement.value : "standard";

    if (!window.lOutput_global) {
        alert(window.getT ? window.getT('adv_alert_calc_first') : "Lütfen önce hesaplama yapın!");
        return;
    }

    var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;
    var max_litz = 2 * 65.6 / Math.sqrt(f_khz * 1000);

    const params = {
        title: (window.getT ? window.getT('title_coil_data') : "Çekirdek Seçimi (Buck-Boost)"),
        L_uH: window.lOutput_global,
        L_H: window.lOutput_global * 1e-6,
        Wmax: window.wmax1_global,
        Imax: window.Imax_global,
        Irms_sq: Math.pow(window.il_rms, 2),
        d_wire_default: window.d_coil_req,
        min_area: window.A_coil_req,
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
            UIModal.openStandardModal(params);
        } else {
            alert("Arayüz modülü yüklenemedi.");
        }
    }
};

// ================================================================
// FALSTAD API & IFRAME MANAGEMENT
// ================================================================
window.embedFalstadSimulation = function (circuitString) {
    var encodedCircuit = encodeURIComponent(circuitString);
    var iframe = document.getElementById("circuitFrame");

    iframe.src = "./falstad/circuitjs.html?hideHeader=true&hideControls=false&noPowerCheck=true&cct=" + encodedCircuit;

    iframe.contentWindow.oncircuitjsloaded = function () {
        window.falstadSim = iframe.contentWindow.CircuitJS1;
    };
};

window.openFalstadBuckBoostSimulation = function () {
    var vin_nom = parseFloat(document.getElementById('vin_nom').value) || 12;
    var vout = parseFloat(document.getElementById('vout').value) || -15;
    var ilout = parseFloat(document.getElementById('ilout').value) || 1;
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;

    var l_uH = parseFloat(document.getElementById('lOutput').innerText) || 100;
    var c_uF = parseFloat(document.getElementById('cOutput').innerText) || 47;
    var r_load = parseFloat(document.getElementById('rOutput').innerText) || 15;

    document.getElementById("simulationContainer").style.display = "block";
    document.getElementById("liveDataBox").style.display = "block";
    document.getElementById("liveDataBox").innerHTML = "Fitcore SMPS Designer: INVERTING BUCK-BOOST Converter";

    document.getElementById("simulationContainer").scrollIntoView({ behavior: 'smooth' });

    var freq_hz = f_khz * 1000;
    var l_henry = l_uH * 1e-6;
    var c_farad = c_uF * 1e-6;

    var sim_timestep = 1.0 / (freq_hz * 50);
    var timestep_str = sim_timestep.toExponential(2).toUpperCase();

    var vout_mag = Math.abs(vout);

    var Uf = 0.7;
    var duty_cycle = (vout_mag + Uf) / (vin_nom + vout_mag + Uf);

    if (duty_cycle > 0.95) duty_cycle = 0.95;
    if (duty_cycle < 0.05) duty_cycle = 0.05;

    var v_high = vin_nom + 15;
    var v_low = -vout_mag - 5;

    var v_offset = (v_high + v_low) / 2;
    var v_amp = (v_high - v_low) / 2;

    var vscale = Math.max(5, Math.ceil(Math.max(vin_nom, vout_mag) / 5) * 5);
    var input_current_approx = (vout_mag * ilout) / vin_nom;
    var iscale = Math.max(0.5, Math.ceil((input_current_approx + ilout) / 2) * 0.5);

    var falstadTemplate = `
$ 1 {TIMESTEP} 100.0 50 5.0 50
v 32 224 32 80 0 0 40 {VIN} 0 0 0.5
R 112 128 80 128 0 2 {FREQ} {V_AMP} {V_OFFSET} 0 {DUTY}
l 160 80 160 224 0 {L_VAL} 0
d 256 80 160 80 1 {UF}
c 256 80 256 224 0 {C_VAL} 0
r 352 80 352 224 0 {R_VAL}
f 112 128 112 80 40 1.5 1000
w 32 80 96 80 0
w 128 80 160 80 0
w 256 80 352 80 0
w 32 224 160 224 0
w 160 224 256 224 0
w 256 224 352 224 0
g 160 224 160 240 0
o 2 1 0 34 {VSCALE} 0.05 0 -1
o 2 1 0 33 {ISCALE} 0.1 1 -1
o 4 1 0 34 {VSCALE} 0.05 2 -1
o 4 1 0 33 {ISCALE} 0.1 3 -1
o 3 1 0 34 {VSCALE} 0.05 4 -1
o 3 1 0 33 {ISCALE} 0.1 5 -1
`.trim();

    var circuitString = falstadTemplate
        .replace('{TIMESTEP}', timestep_str)
        .replace('{VIN}', vin_nom)
        .replace('{UF}', Uf)
        .replace('{L_VAL}', l_henry)
        .replace('{C_VAL}', c_farad)
        .replace('{R_VAL}', r_load)
        .replace('{FREQ}', freq_hz)
        .replace(/{V_AMP}/g, v_amp)
        .replace(/{V_OFFSET}/g, v_offset)
        .replace('{DUTY}', duty_cycle)
        .replace(/{VSCALE}/g, vscale)
        .replace(/{ISCALE}/g, iscale);

    window.embedFalstadSimulation(circuitString);
};

window.printPage = function () {
    window.print();
};

window.hesapla = function () {
    var checkResult = window.checkUserInput();

    if (checkResult === false) return;
    if (checkResult === undefined) window.setDefaultValues();

    window.updateChartsAndTable();

    if (typeof window.openSelectedTable === "function") {
        window.openSelectedTable();
    }
};

document.getElementById('calculateButton').addEventListener('click', window.hesapla);
