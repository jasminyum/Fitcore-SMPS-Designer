// ================================================================
// Flyback Converter
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================

window.il_rms = 0;
window.i2_rms_calc = 0;
window.Imax_global = 0;
window.A1_req = 0;
window.A2_req = 0;
window.d1_req = 0;
window.d2_req = 0;
window.max_wire_d_mm = 0;

// ================================================================
// UI MODE SWITCHING
// ================================================================
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

// ================================================================
// INPUT VALIDATION
// ================================================================
function checkUserInput() {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);

    if (isNaN(vin_min) || vin_min <= 0) vin_min = 250.0;
    if (isNaN(vin_max) || vin_max <= 0) vin_max = 360.0;
    if (isNaN(vout) || vout <= 0) vout = 200.0;
    if (isNaN(ilout) || ilout <= 0) ilout = 0.25;
    if (isNaN(f_khz) || f_khz <= 0) f_khz = 50.0;
    if (isNaN(verim) || verim <= 0) verim = 80.0;

    if (vin_min > vin_max) vin_max = vin_min;

    var Uem = (vin_min + vin_max) / 2;
    if (isNaN(vin_nom) || vin_nom <= 0 || vin_nom < vin_min || vin_nom > vin_max) {
        vin_nom = Uem;
    }

    if (f_khz < 0.1 || f_khz > 1000) {
        alert(window.getT ? window.getT('alert_freq_warning') : "Uyarı: Anahtarlama frekansı 100 Hz ile 1 MHz arasında olmalıdır!");
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
}

function setDefaultValues() {
    document.getElementById('vin_min').value = 250;
    document.getElementById('vin_max').value = 360;
    document.getElementById('vin_nom').value = 305;
    document.getElementById('vout').value = 200;
    document.getElementById('ilout').value = 0.25;
    document.getElementById('f_khz').value = 50;
    document.getElementById('verim').value = 80;
}

// ================================================================
// main
// ================================================================
function updateChartsAndTable() {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);
    var modeEl = document.getElementById("mode");
    var userMode = modeEl ? modeEl.value : "continuous";
    var effMode = document.getElementById("effMode").value;

    var Uf = 0.7;
    var f_hz = f_khz * 1000;
    var Uem = (vin_min + vin_max) / 2;

    var nOutput = Uem / (vout + Uf);
    var lOutput_H = (Uem * Uem) / (8 * (vout + Uf) * ilout * f_hz);
    var lOutput = lOutput_H * 1e6;

    var Ue = vin_nom;
    var ILs_nom = ilout * (1.0 / nOutput) * (Ue + (vout + Uf) * nOutput) / Ue;
    var actual_deltaIL = (1 / f_hz) * (1 / lOutput_H) * (vout + Uf) * nOutput * Ue / ((vout + Uf) * nOutput + Ue);

    var actualMode;
    var tolerance = 0.03 * ILs_nom;
    var currentDiff = actual_deltaIL - 2 * ILs_nom;

    if (Math.abs(currentDiff) <= tolerance) {
        actualMode = "critical";
    } else if (actual_deltaIL > 2 * ILs_nom) {
        actualMode = "discontinuous";
    } else {
        actualMode = "continuous";
    }

    var modeWarnEl = document.getElementById('modeWarning');
    var modeNames = { "continuous": "CCM", "discontinuous": "DCM", "critical": "CRM" };
    var condition = (actualMode === "discontinuous") ? " (ΔIL > 2*IL_primer)" : (actualMode === "critical" ? " (ΔIL = 2*IL_primer)" : " (ΔIL < 2*IL_primer)");

    if (userMode !== actualMode) {
        modeWarnEl.style.display = 'block';
        modeWarnEl.style.color = '#856404';
        modeWarnEl.style.border = '1px solid #ffeeba';
        modeWarnEl.style.backgroundColor = '#fff3cd';
        modeWarnEl.textContent = (window.getT ? window.getT('warning_mode_1') : "⚠️ Uyarı: Seçilen mod ") + modeNames[userMode] +
            (window.getT ? window.getT('warning_mode_2') : ", ancak girilen frekans ve gerilim değerlerine göre devre ") + modeNames[actualMode] +
            (window.getT ? window.getT('warning_mode_4') : " modunda çalışacak!") + condition + (window.getT ? window.getT('warning_mode_5') : " Lütfen parametreleri veya modu düzeltin.");
    } else if (userMode === "critical") {
        modeWarnEl.style.display = 'block';
        modeWarnEl.style.color = '#004085';
        modeWarnEl.style.border = '1px solid #b8daff';
        modeWarnEl.style.backgroundColor = '#cce5ff';

        var t1_crm_info = (lOutput_H * (2 * ILs_nom)) / Ue;
        var t2_crm_info = (lOutput_H * (2 * ILs_nom)) / ((vout + Uf) * nOutput);
        var f_crm_info = 1.0 / (t1_crm_info + t2_crm_info);
        modeWarnEl.textContent = (window.getT ? window.getT('info_crm_mode') : "Bilgi: CRM modu aktif ve parametreler kusursuz uyumlu. Nominal yükte ideal çalışma frekansı ") + (f_crm_info / 1000).toFixed(1) + " kHz.";
    } else {
        modeWarnEl.style.display = 'none';
        modeWarnEl.textContent = '';
    }

    var t1, Imax, Imin, i1_rms_calc, i2_rms_calc, dIL;
    var D1, D2;

    if (actualMode === "continuous") {
        var D = (vout + Uf) * nOutput / ((vout + Uf) * nOutput + Ue);
        t1 = D / f_hz;
        dIL = actual_deltaIL;
        Imax = ILs_nom + 0.5 * dIL;
        Imin = Math.max(0, Imax - dIL);
        D1 = D; D2 = 1 - D;

        i1_rms_calc = Math.sqrt(D1 * (Imin * Imin + Imin * Imax + Imax * Imax) / 3);
        var imax2 = Imax * nOutput;
        var imin2 = Imin * nOutput;
        i2_rms_calc = Math.sqrt(D2 * (imin2 * imin2 + imin2 * imax2 + imax2 * imax2) / 3);
    } else {
        t1 = Math.sqrt(2 * ilout * lOutput_H * (vout + Uf) / (f_hz * Ue * Ue));
        dIL = (1.0 / lOutput_H) * Ue * t1;
        Imax = dIL; Imin = 0;
        D1 = t1 * f_hz;
        var t2 = Imax * lOutput_H / ((vout + Uf) * nOutput);
        D2 = t2 * f_hz;

        i1_rms_calc = Math.sqrt(D1 * Imax * Imax / 3);
        var imax2_d = Imax * nOutput;
        i2_rms_calc = Math.sqrt(D2 * imax2_d * imax2_d / 3);
    }

    var J = MagneticUtils.getCurrentDensity(f_khz);

    window.Imax_global = Imax;
    window.il_rms = i1_rms_calc;
    window.i2_rms_calc = i2_rms_calc;
    window.A1_req = i1_rms_calc / J;
    window.A2_req = i2_rms_calc / J;
    window.d1_req = 2 * Math.sqrt(window.A1_req / Math.PI);
    window.d2_req = 2 * Math.sqrt(window.A2_req / Math.PI);
    window.max_wire_d_mm = 2 * (65.6 / Math.sqrt(f_hz));

    var wmax1 = 0.5 * lOutput_H * Imax * Imax * 1e6;
    var Vripple = vout * 0.01;
    var cOutput = ilout * D1 / (f_hz * Vripple) * 1e6;
    var rOutput = vout / ilout;
    var Pout = vout * ilout;

    var finalKullanilacakVerim = verim;
    var effData;
    var calculated_Iin;

    if (effMode === "ideal") {
        effData = generateIdealEffCurve(verim / 100, f_hz);
        document.getElementById("powerLossSection").style.display = "none";
        calculated_Iin = Pout / (Ue * (verim / 100));
        var loss = Math.abs(100 - verim);
        document.getElementById('loss').innerText = loss.toFixed(2);
    } else {
        var params = getRealParams();
        effData = generateRealEffCurve(vin_nom, vout, ilout, f_hz, lOutput_H, nOutput, actualMode, params);
        var realRes = calculateRealEfficiency(vin_nom, vout, ilout, f_hz, Imax, Imin, nOutput, i1_rms_calc, i2_rms_calc, actualMode, params);

        finalKullanilacakVerim = realRes.efficiencyPercent;
        document.getElementById("powerLossSection").style.display = "block";

        const setText = (id, text) => {
            let el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setText("res_pon_h", realRes.breakdown.Pon_H.toFixed(4) + " W");
        setText("res_pon_d", realRes.breakdown.Pdiode_cond.toFixed(4) + " W");
        setText("res_psw_h", realRes.breakdown.Psw_H.toFixed(4) + " W");
        setText("res_prr", realRes.breakdown.Prr.toFixed(4) + " W");
        setText("res_pcoss", realRes.breakdown.Pcoss.toFixed(4) + " W");
        setText("res_pg", realRes.breakdown.Pg.toFixed(4) + " W");
        setText("res_pic", realRes.breakdown.Pic.toFixed(4) + " W");
        setText("res_pl_dcr", realRes.breakdown.Pl_pri.toFixed(4) + " W");
        setText("res_pcin", realRes.breakdown.Pl_sec.toFixed(4) + " W");
        setText("res_pcout", realRes.breakdown.Pcout.toFixed(4) + " W");
        setText("res_ptotal", realRes.totalLossW.toFixed(4) + " W");
        setText("res_peff", realRes.efficiencyPercent.toFixed(2) + " %");

        var loss = Math.abs(100 - finalKullanilacakVerim);
        setText("loss", loss.toFixed(2));
        calculated_Iin = Pout / (Ue * (finalKullanilacakVerim / 100));
    }

    document.getElementById('lOutput').innerText = lOutput.toFixed(2);
    document.getElementById('cOutput').innerText = cOutput.toFixed(2);
    document.getElementById('rOutput').innerText = rOutput.toFixed(2);
    document.getElementById('deltaILMax').innerText = dIL.toFixed(2);
    document.getElementById('nOutput').innerText = nOutput.toFixed(2);
    document.getElementById('wmax1').innerText = wmax1.toFixed(2);

    var iinEl = document.getElementById('iin');
    if (iinEl) {
        iinEl.innerText = calculated_Iin.toFixed(2);
        document.getElementById('iin_container').style.display = "inline";
    }

    var wf = generateAllWaveforms(Ue, vout, nOutput, f_hz, t1, lOutput_H, dIL, Imax, actualMode);
    drawCharts(wf, ilout, vin_min, vin_max, Uem, effData);
    updateResultTable(wf);
}

// ================================================================
// EFFICIENCY AND LOSS CALCULATIONS
// ================================================================
function getRealParams() {
    const getVal = (id, def) => {
        var el = document.getElementById(id);
        var val = el ? parseFloat(el.value) : NaN;
        return isNaN(val) ? def : val;
    };

    return {
        Ron_H: getVal('p_ron_h', 0.250),
        tr_H: getVal('p_tr_h', 15) * 1e-9,
        tf_H: getVal('p_tf_h', 15) * 1e-9,
        Coss_H: getVal('p_coss_h', 80) * 1e-12,
        Qg_H: getVal('p_qg_h', 15) * 1e-9,
        Vgs: getVal('p_vgs', 10.0),
        Vd: getVal('p_vd', 0.8),
        trr: getVal('p_trr', 35) * 1e-9,
        Irr: getVal('p_irr', 0.8),
        DCR_pri: getVal('p_dcr', 0.150),
        DCR_sec: getVal('p_dcr_sec', 0.050),
        Icc: getVal('p_icc', 3.0) * 1e-3,
        ESR_Cin: getVal('p_esrcin', 0.005),
        ESR_Cout: getVal('p_esrcout', 0.004)
    };
}

function calculateRealEfficiency(vin, vout, iout, f_sw_hz, Imax, Imin, nOutput, i1_rms, i2_rms, mode, p) {
    var Pon_SW = Math.pow(i1_rms, 2) * p.Ron_H;
    var Pdiode_cond = p.Vd * iout;

    var V_stress = vin + nOutput * (vout + p.Vd);

    var Psw_H_on = 0;
    var Psw_H_off = 0;
    var Prr = 0;
    var Pcoss = 0.5 * p.Coss_H * Math.pow(V_stress, 2) * f_sw_hz;

    if (mode === "continuous") {
        Psw_H_on = 0.5 * V_stress * Imin * p.tr_H * f_sw_hz;
        Psw_H_off = 0.5 * V_stress * Imax * p.tf_H * f_sw_hz;
        Prr = 0.5 * V_stress * p.Irr * p.trr * f_sw_hz;
    } else {
        Psw_H_on = 0;
        Psw_H_off = 0.5 * V_stress * Imax * p.tf_H * f_sw_hz;
        Prr = 0;
    }

    var Psw_H = Psw_H_on + Psw_H_off;
    var Pg = p.Qg_H * p.Vgs * f_sw_hz;
    var Pic = vin * p.Icc;

    var Pl_pri = Math.pow(i1_rms, 2) * p.DCR_pri;
    var Pl_sec = Math.pow(i2_rms, 2) * p.DCR_sec;

    var Icin_rms_sq = Math.max(0, Math.pow(i1_rms, 2) - Math.pow(iout * (vout / vin), 2));
    var Pcin = Icin_rms_sq * p.ESR_Cin;

    var Icout_rms_sq = Math.max(0, Math.pow(i2_rms, 2) - Math.pow(iout, 2));
    var Pcout = Icout_rms_sq * p.ESR_Cout;

    var Ptotal = Pon_SW + Pdiode_cond + Psw_H + Prr + Pcoss + Pg + Pic + Pl_pri + Pl_sec + Pcin + Pcout;
    var efficiency = (vout * iout) / ((vout * iout) + Ptotal) * 100;

    return {
        totalLossW: Ptotal,
        efficiencyPercent: efficiency,
        breakdown: { Pon_H: Pon_SW, Pdiode_cond: Pdiode_cond, Psw_H: Psw_H, Prr: Prr, Pcoss: Pcoss, Pg: Pg, Pic: Pic, Pl_pri: Pl_pri, Pl_sec: Pl_sec, Pcin: Pcin, Pcout: Pcout }
    };
}

function generateIdealEffCurve(eff_full_load, f_hz) {
    var values = [], labels = [];
    var k_fix = 0.028 * (f_hz / 50000);
    var k_cond = 0.038;
    function raw_eff(p) {
        if (p < 0.001) p = 0.001;
        return p / (p + k_fix + k_cond * p * p);
    }
    var scale = eff_full_load / raw_eff(1.0);
    for (var pct = 10; pct <= 120; pct += 5) {
        var p = pct / 100.0;
        var e = Math.min(99.5, Math.max(0, raw_eff(p) * scale * 100));
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
}

function generateRealEffCurve(vin, vout, max_iout, f_hz, L_H, nOutput, mode, params) {
    var values = [], labels = [];
    var Uf = 0.7;

    for (var pct = 10; pct <= 120; pct += 5) {
        var currentLoad = max_iout * (pct / 100);
        if (currentLoad <= 0.001) currentLoad = 0.001;

        var t1_c, Imax_c, actual_deltaIL_c;
        var f_current = f_hz;
        var ILs_nom_c = currentLoad * (1.0 / nOutput) * (vin + (vout + Uf) * nOutput) / vin;

        if (mode === "continuous") {
            t1_c = (1.0 / f_hz) * (vout + Uf) * nOutput / ((vout + Uf) * nOutput + vin);
            actual_deltaIL_c = (1 / f_hz) * (1 / L_H) * (vout + Uf) * nOutput * vin / ((vout + Uf) * nOutput + vin);
            Imax_c = ILs_nom_c + 0.5 * actual_deltaIL_c;
        } else if (mode === "critical") {
            Imax_c = 2 * ILs_nom_c;
            actual_deltaIL_c = Imax_c;
            t1_c = (L_H * Imax_c) / vin;
            var t2_c = (L_H * Imax_c) / ((vout + Uf) * nOutput);
            f_current = 1.0 / (t1_c + t2_c);
        } else {
            t1_c = Math.sqrt(2 * currentLoad * L_H * (vout + Uf) / (f_hz * vin * vin));
            actual_deltaIL_c = (1.0 / L_H) * vin * t1_c;
            Imax_c = actual_deltaIL_c;
        }

        var D_c = t1_c * f_current;
        var imax2_c = Imax_c * nOutput;
        var IL_min_safe_c = Math.max(0, Imax_c - actual_deltaIL_c);
        var i1_rms_c, i2_rms_c;

        if (mode === "continuous") {
            i1_rms_c = Math.sqrt(D_c * (IL_min_safe_c * IL_min_safe_c + IL_min_safe_c * Imax_c + Imax_c * Imax_c) / 3);
            var imin2_c = IL_min_safe_c * nOutput;
            i2_rms_c = Math.sqrt((1 - D_c) * (imin2_c * imin2_c + imin2_c * imax2_c + imax2_c * imax2_c) / 3);
        } else {
            i1_rms_c = Math.sqrt(D_c * Imax_c * Imax_c / 3);
            var t2_c_inner = Imax_c * L_H / ((vout + Uf) * nOutput);
            i2_rms_c = Math.sqrt((t2_c_inner * f_current) * imax2_c * imax2_c / 3);
        }

        var Imin_c = 0;
        if (mode === "continuous") {
            Imin_c = IL_min_safe_c;
        }

        var res = calculateRealEfficiency(vin, vout, currentLoad, f_current, Imax_c, Imin_c, nOutput, i1_rms_c, i2_rms_c, mode, params);
        var e = res.efficiencyPercent;
        if (e > 99.5) e = 99.5; if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
}

// ================================================================
// WAVEFORM GENERATOR
// ================================================================
function generateAllWaveforms(Ue, vout, nOutput, f_hz, t1_s, L_H, deltaIL, Imax, mode) {
    var Uf = 0.7;
    var nUa = (vout + Uf) * nOutput;

    var Imin = Math.max(0, Imax - deltaIL);
    if (mode !== "continuous") Imin = 0;

    var slope_on = Ue / L_H;
    var imax2 = Imax * nOutput;
    var imin2 = Imin * nOutput;

    var T = 1.0 / f_hz;
    var t_off = T - t1_s;
    if (t_off <= 0) t_off = t1_s * 0.5;

    var t2_s = 0;
    if (mode !== "continuous") {
        t2_s = (Imax * L_H) / nUa;
        if (t2_s > t_off) t2_s = t_off * 0.99;
    }

    var PTS = 100;
    var labels = [], i1 = [], i2 = [], vl1 = [], vds = [];

    for (var cycle = 0; cycle < 2; cycle++) {
        var t0 = cycle * T;

        if (mode === "continuous") {
            for (var k = 0; k < PTS; k++) {
                var frac = k / PTS;
                labels.push(((t0 + frac * t1_s) * 1e6).toFixed(2));
                i1.push(Imin + slope_on * frac * t1_s);
                i2.push(0);
                vl1.push(Ue);
                vds.push(0);
            }
            for (var k = 0; k < PTS; k++) {
                var frac = k / PTS;
                var current_i2 = imax2 - (imax2 - imin2) * frac;
                labels.push(((t0 + t1_s + frac * t_off) * 1e6).toFixed(2));
                i1.push(0);
                i2.push(Math.max(0, current_i2));
                vl1.push(-nUa);
                vds.push(Ue + nUa);
            }
        } else {
            for (var k = 0; k < PTS; k++) {
                var frac = k / PTS;
                labels.push(((t0 + frac * t1_s) * 1e6).toFixed(2));
                i1.push(Imax * frac);
                i2.push(0);
                vl1.push(Ue);
                vds.push(0);
            }
            var PTS2 = Math.max(Math.round(PTS * t2_s / t_off), 10);
            for (var k = 0; k < PTS2; k++) {
                var frac = k / PTS2;
                labels.push(((t0 + t1_s + frac * t2_s) * 1e6).toFixed(2));
                i1.push(0);
                i2.push(imax2 * (1 - frac));
                vl1.push(-nUa);
                vds.push(Ue + nUa);
            }
            var PTS3 = Math.max(PTS - PTS2, 5);
            var t_rest = t_off - t2_s;
            for (var k = 0; k < PTS3; k++) {
                var frac = k / PTS3;
                var decay = Math.exp(-6 * frac);
                labels.push(((t0 + t1_s + t2_s + frac * t_rest) * 1e6).toFixed(2));
                i1.push(0);
                i2.push(0);

                var ring_vds = Ue + nUa * decay * Math.cos(2 * Math.PI * 3 * frac);
                vds.push(ring_vds);
                vl1.push(0);
            }
        }
    }

    return { labels: labels, i1: i1, i2: i2, vl1: vl1, vds: vds };
}

// ================================================================
// CHARTS
// ================================================================
function drawCharts(wf, ilout, vin_min, vin_max, Uem, effData) {
    var N = wf.labels.length;
    var tickStep = Math.max(1, Math.floor(N / 8));
    var textColor = '#e0e0e0';
    var gridColor = 'rgba(255, 255, 255, 0.1)';
    var refLineColor = 'rgba(255, 255, 255, 0.5)';

    function baseOpts(yTitle) {
        return {
            responsive: true,
            animation: false,
            elements: { point: { radius: 0 }, line: { tension: 0 } },
            scales: {
                x: { type: 'category', ticks: { color: textColor, maxTicksLimit: 9, callback: function (v, i) { return (i % tickStep === 0) ? wf.labels[i] + "µs" : ''; } }, title: { display: true, text: 'Time (µs)', color: textColor }, grid: { color: gridColor, borderColor: gridColor } },
                y: { title: { display: true, text: yTitle, color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }
            },
            plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } }
        };
    }

    function mk(id, datasets, yTitle, extraOpts = {}) {
        var canvas = document.getElementById(id);
        if (!canvas) return;
        if (canvas.chart) { canvas.chart.destroy(); canvas.chart = null; }
        var finalOptions = baseOpts(yTitle);
        if (extraOpts.scales && extraOpts.scales.y) { finalOptions.scales.y = { ...finalOptions.scales.y, ...extraOpts.scales.y }; }
        canvas.chart = new Chart(canvas.getContext('2d'), { type: 'line', data: { labels: wf.labels, datasets: datasets }, options: finalOptions });
    }

    mk('vinChart', [
        { label: 'V_L1 (Primer)', data: wf.vl1, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false },
        { label: 'Vin (ort.)', data: Array(N).fill(Uem), borderColor: refLineColor, borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 }
    ], 'Voltage (V)');

    mk('vdsChart', [
        { label: 'Vds (MOSFET)', data: wf.vds, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: false }
    ], 'Voltage (V)');

    mk('ilChart', [
        { label: 'I1 (Primer)', data: wf.i1, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, fill: false }
    ], 'Current (A)');

    mk('idChart', [
        { label: 'I2 (Secondary)', data: wf.i2, borderColor: 'rgba(105, 240, 174, 1)', borderWidth: 2, fill: false },
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
            options: {
                responsive: true, animation: false,
                scales: { x: { title: { display: true, text: 'Load (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }, y: { min: 0, max: 100, title: { display: true, text: 'Efficiency (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } } },
                plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } }
            }
        });
    }
}

// ================================================================
// RESULT TABLE
// ================================================================
function updateResultTable(wf) {
    var table = document.getElementById('resultTable');
    if (!table) return;
    var tbody = table.getElementsByTagName('tbody')[0];
    tbody.innerHTML = "";

    var N = wf.labels.length;
    var step = Math.max(1, Math.floor(N / 20));

    document.getElementById('resultTable').rows[0].cells[3].innerHTML = "I1 (Primary)";
    document.getElementById('resultTable').rows[0].cells[4].innerHTML = "I2 (Secondary)";

    for (var i = 0; i <= 20; i++) {
        var idx = Math.min(i * step, N - 1);
        var row = tbody.insertRow(-1);
        row.insertCell(0).innerHTML = wf.labels[idx] + " µs";
        row.insertCell(1).innerHTML = (wf.vl1[idx] || 0).toFixed(2) + " V";
        row.insertCell(2).innerHTML = (wf.vds[idx] || 0).toFixed(2) + " V";
        row.insertCell(3).innerHTML = (wf.i1[idx] || 0).toFixed(2) + " A";
        row.insertCell(4).innerHTML = (wf.i2[idx] || 0).toFixed(2) + " A";
    }
}

// ================================================================
// FALSTAD API & IFRAME MANAGEMENT
// ================================================================
var falstadSim = null;

function embedFalstadSimulation(circuitString) {
    var encodedCircuit = encodeURIComponent(circuitString);
    var iframe = document.getElementById("circuitFrame");

    iframe.src = "./falstad/circuitjs.html?hideHeader=true&hideControls=false&noPowerCheck=true&cct=" + encodedCircuit;

    iframe.contentWindow.oncircuitjsloaded = function () {
        falstadSim = iframe.contentWindow.CircuitJS1;
    };
}

// ================================================================
// CIRCUITJS (FALSTAD) FLYBACK CONVERTER ENTEGRASYONU
// ================================================================
function openFalstadFlybackSimulation() {
    var vin_nom = parseFloat(document.getElementById('vin_nom').value) || 305;
    var vout = parseFloat(document.getElementById('vout').value) || 200;
    var ilout = parseFloat(document.getElementById('ilout').value) || 0.25;
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;

    var l_uH = parseFloat(document.getElementById('lOutput').innerText) || 1000;
    var c_uF = parseFloat(document.getElementById('cOutput').innerText) || 10;
    var r_load = parseFloat(document.getElementById('rOutput').innerText) || 800;
    var nOutput = parseFloat(document.getElementById('nOutput').innerText) || 1.5;

    document.getElementById("simulationContainer").style.display = "block";
    document.getElementById("liveDataBox").style.display = "block";
    document.getElementById("liveDataBox").innerHTML = "Fitcore SMPS Designer: FLYBACK Converter & Snubber Network";

    if (document.getElementById("simulationContainer").scrollIntoView) {
        document.getElementById("simulationContainer").scrollIntoView({ behavior: 'smooth' });
    }

    var Uf = 0.7;
    var freq_hz = f_khz * 1000;
    var l_henry = l_uH * 1e-6;
    var c_farad = c_uF * 1e-6;

    var sim_timestep = 1.0 / (freq_hz * 50);
    var timestep_str = sim_timestep.toExponential(2).toUpperCase();

    var ratio = -(1 / nOutput);

    var v_f = (vout + Uf) * nOutput;
    var ILs_nom = ilout * (1.0 / nOutput) * (vin_nom + v_f) / vin_nom;
    var actual_deltaIL = (1 / freq_hz) * (1 / l_henry) * (v_f * vin_nom) / (v_f + vin_nom);
    var Imax = ILs_nom + 0.5 * actual_deltaIL;

    var leakage_ratio = 0.025;
    var coupling = Math.sqrt(1 - leakage_ratio).toFixed(4);
    var L_leakage = leakage_ratio * l_henry;

    var v_x = 0.2 * v_f;
    var v_clamp = v_f + v_x;

    var p_leak = 0.5 * L_leakage * Imax * Imax * freq_hz;
    var r_snub = (v_clamp * v_clamp) / (p_leak * 2);
    if (r_snub > 100000) r_snub = 100000;
    if (r_snub < 1000) r_snub = 1000;

    var c_snub = 100e-9;

    var c_oss = (Imax * 1.0e-6) / v_x;
    if (c_oss > 10e-9) c_oss = 10e-9;
    if (c_oss < 1e-9) c_oss = 1e-9;

    var duty_cycle = ((vout + Uf) * nOutput) / (((vout + Uf) * nOutput) + vin_nom);
    if (duty_cycle > 0.95) duty_cycle = 0.95;
    if (duty_cycle < 0.05) duty_cycle = 0.05;

    var v_gate_max = 15;
    var v_amp = v_gate_max / 2;
    var v_offset = v_amp;

    var v_init = vout;
    var vscale_in = Math.max(50, Math.ceil(vin_nom / 50) * 50);
    var vscale_out = Math.max(50, Math.ceil(vout / 50) * 50);
    var input_current_approx = (vout * ilout) / vin_nom;
    var iscale = Math.max(0.5, Math.ceil((input_current_approx + ilout) / 2) * 0.5);

    var expected_vds = vin_nom + v_clamp;
    var vscale_ds = Math.max(50, Math.ceil((expected_vds + 50) / 50) * 50);
    var iscale_out = Math.max(0.1, Math.ceil(ilout * 1.5 * 10) / 10);

    var falstadTemplate = `
$ 1 {TIMESTEP} 10.0 50 5.0 50
v 80 320 80 192 0 0 40 {VIN} 0 0 0.5
f 176 288 224 288 32 1.5 0.02
T 224 224 352 272 0 {L_PRI} {RATIO} {COUPLING} 48
d 352 208 464 208 1 {UF}
r 528 208 528 304 0 {R_VAL}
c 464 208 464 304 0 {C_VAL} {V_INIT}
g 528 304 528 320 0
R 176 288 144 288 0 2 {FREQ} {V_AMP} {V_OFFSET} 0 {DUTY}
r 256 224 256 272 0 100000000
c 256 272 256 304 0 {C_OSS} 0
d 208 272 208 240 1 0.7
c 208 240 208 192 0 {C_SNUB} {V_CLAMP}
r 192 240 192 192 0 {R_SNUB}
w 464 208 528 208 0
w 464 304 528 304 0
w 464 304 352 304 0
w 352 208 352 224 0
w 352 272 352 304 0
w 224 224 224 192 0
w 224 192 80 192 0
w 80 320 224 320 0
w 224 320 224 304 0
w 224 224 256 224 0
w 224 272 256 272 0
w 224 304 256 304 0
w 224 272 208 272 0
w 208 192 224 192 0
w 208 240 192 240 0
w 192 192 208 192 0
o 0 1 0 34 {VSCALE_IN} 0.05 0 -1
o 5 1 0 34 {VSCALE_OUT} 0.05 1 -1
o 8 1 0 34 {VSCALE_DS} 0.05 2 -1
o 9 1 0 34 {VSCALE_DS} 0.05 3 -1
o 3 1 0 33 {ISCALE} 0.1 4 -1
o 4 1 0 33 {ISCALE_OUT} 0.1 5 -1
`.trim();

    var circuitString = falstadTemplate
        .replace('{TIMESTEP}', timestep_str)
        .replace('{VIN}', vin_nom)
        .replace('{UF}', Uf)
        .replace('{L_PRI}', l_henry)
        .replace('{RATIO}', ratio)
        .replace('{COUPLING}', coupling)
        .replace('{C_SNUB}', c_snub)
        .replace('{R_SNUB}', r_snub)
        .replace('{C_OSS}', c_oss)
        .replace('{C_VAL}', c_farad)
        .replace('{R_VAL}', r_load)
        .replace('{FREQ}', freq_hz)
        .replace(/{V_AMP}/g, v_amp)
        .replace(/{V_OFFSET}/g, v_offset)
        .replace('{DUTY}', duty_cycle)
        .replace('{V_INIT}', v_init)
        .replace('{V_CLAMP}', v_clamp)
        .replace(/{VSCALE_IN}/g, vscale_in)
        .replace(/{VSCALE_OUT}/g, vscale_out)
        .replace(/{VSCALE_DS}/g, vscale_ds)
        .replace(/{ISCALE}/g, iscale)
        .replace(/{ISCALE_OUT}/g, iscale_out);

    embedFalstadSimulation(circuitString);
}

// ================================================================
// MAIN TRIGGER AND UI MODAL INTEGRATION
// ================================================================
function hesapla() {
    if (!checkUserInput()) { setDefaultValues(); }
    updateChartsAndTable();
    if (typeof window.openSelectedTable === "function") {
        window.openSelectedTable();
    }
}

window.openSelectedTable = function () {
    const modeElement = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeElement ? modeElement.value : "standard";

    var lOutputStr = document.getElementById('lOutput')?.innerText;
    var wmax1Str = document.getElementById('wmax1')?.innerText;

    if (!lOutputStr || isNaN(parseFloat(lOutputStr))) {
        alert(window.getT ? window.getT('adv_alert_calc_first') : "Lütfen önce hesaplama yapın!");
        return;
    }

    var L_uH = parseFloat(lOutputStr);
    var Wmax = parseFloat(wmax1Str);
    var nOutput = parseFloat(document.getElementById('nOutput')?.innerText) || 1;
    var Imax = window.Imax_global || parseFloat(document.getElementById('deltaILMax')?.innerText) || 0;

    var i1_rms_sq = Math.pow(window.il_rms || 1, 2);
    var ilout = parseFloat(document.getElementById('ilout')?.value) || 0.25;
    var i2_rms_sq = Math.pow(window.i2_rms_calc || ilout * 1.5, 2);

    const params = {
        title: (window.getT ? window.getT('title_transformer_data') : "Flyback Trafo Verileri"),
        L_uH: L_uH,
        L_H: L_uH * 1e-6,
        Wmax: Wmax,
        Imax: Imax,
        nOutput: nOutput,
        I1_rms_sq: i1_rms_sq,
        I2_rms_sq: i2_rms_sq,
        d1_req: window.d1_req || 0.5,
        d2_req: window.d2_req || 0.5,
        max_litz: window.max_wire_d_mm || 0.5,
        userMode: document.getElementById("mode")?.value || "continuous"
    };

    if (mode === "advanced") {
        if (typeof window.openAdvancedTable === "function") {
            window.openAdvancedTable();
        } else {
            alert("Advanced modül yüklenemedi.");
        }
    } else {
        if (typeof UIModal !== 'undefined' && UIModal.openFlybackModal) {
            UIModal.openFlybackModal(params);
        } else {
            alert("Arayüz modülü yüklenemedi.");
        }
    }
};

// ================================================================
// EVENT LISTENERS
// ================================================================
document.getElementById('calculateButton').addEventListener('click', updateChartsAndTable);
document.getElementById('printButton').addEventListener('click', function () { window.print(); });
document.getElementById('openButton').addEventListener('click', window.openSelectedTable);
