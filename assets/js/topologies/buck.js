// ================================================================
// Buck (Step-Down) Converter (Controller)
// ================================================================

window.currentOperatingPoint = null;
window.lOutput_global = 0;
window.wmax1_global = 0;
window.A_coil_req = 0;
window.d_coil_req = 0;

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
        var thPdiode = document.getElementById("th_pdiode");

        if (rectMode === "async") {
            if (document.getElementById("wrap_ron_l")) document.getElementById("wrap_ron_l").style.display = "none";
            if (document.getElementById("wrap_qg_l")) document.getElementById("wrap_qg_l").style.display = "none";
            if (document.getElementById("wrap_tr_tf_l")) document.getElementById("wrap_tr_tf_l").style.display = "none";
            if (document.getElementById("wrap_deadtime")) document.getElementById("wrap_deadtime").style.display = "none";

            if (lblVd) lblVd.innerText = "Diode Vd [V]";
            if (lblTrr) lblTrr.innerText = "trr [ns] / Irr [A]";
            if (thPdiode) thPdiode.innerText = "Diode Cond. (Pdiode)";
        } else {
            if (document.getElementById("wrap_ron_l")) document.getElementById("wrap_ron_l").style.display = "flex";
            if (document.getElementById("wrap_qg_l")) document.getElementById("wrap_qg_l").style.display = "flex";
            if (document.getElementById("wrap_tr_tf_l")) document.getElementById("wrap_tr_tf_l").style.display = "flex";
            if (document.getElementById("wrap_deadtime")) document.getElementById("wrap_deadtime").style.display = "flex";

            if (lblVd) lblVd.innerText = "Body Diode Vsd [V]";
            if (lblTrr) lblTrr.innerText = "Body Diode trr [ns] / Irr [A]";
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

    if (isNaN(vin_min) || vin_min <= 0) vin_min = 24;
    if (isNaN(vin_max) || vin_max <= 0) vin_max = 34;
    if (isNaN(vout) || vout <= 0) vout = 12;
    if (isNaN(ilout) || ilout <= 0) ilout = 10;
    if (isNaN(f_khz) || f_khz <= 0) f_khz = 50;
    if (isNaN(verim) || verim <= 0) verim = 85.0;

    if (vout >= vin_min || vout >= vin_nom) {
        var boostModal = new bootstrap.Modal(document.getElementById('boostWarningModal'));
        boostModal.show();
        return false;
    }

    if (vin_min > vin_max) vin_max = vin_min;
    if (isNaN(vin_nom) || vin_nom <= 0 || vin_nom < vin_min || vin_nom > vin_max) {
        vin_nom = vin_max;
    }
    if (f_khz < 0.1 || f_khz > 1000) {
        alert(window.getT ? window.getT('alert_freq_warning') : 'Frekans aralığı hatalı!');
        f_khz = 50;
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
    document.getElementById('vin_min').value = 24;
    document.getElementById('vin_max').value = 34;
    document.getElementById('vin_nom').value = 29;
    document.getElementById('vout').value = 12;
    document.getElementById('ilout').value = 10;
    document.getElementById('f_khz').value = 50;
    document.getElementById('verim').value = 85;
};

window.calcBuckOperatingPoint = function (Ue, vout, iout, f, L_H) {
    var Uf = 0.7;

    var deltaIL_CCM = (Ue - vout) * (vout + Uf) / ((Ue + Uf) * f * L_H);
    var isCCM = (deltaIL_CCM < 2 * iout);

    var t1, t2, Imax, Imin, i1_rms, i2_rms, iL_rms, i2_avg, dIL;

    if (isCCM) {
        var D = (vout + Uf) / (Ue + Uf);
        t1 = D / f;
        t2 = (1 - D) / f;
        dIL = deltaIL_CCM;
        Imax = iout + dIL / 2;
        Imin = iout - dIL / 2;

        i1_rms = Math.sqrt(D * (Imin * Imin + Imin * Imax + Imax * Imax) / 3);
        i2_rms = Math.sqrt((1 - D) * (Imin * Imin + Imin * Imax + Imax * Imax) / 3);
        iL_rms = Math.sqrt(iout * iout + (dIL * dIL) / 12);
        i2_avg = iout * (1 - D);
    } else {
        var term = (1 / (Ue - vout)) + (1 / (vout + Uf));
        Imax = Math.sqrt((2 * iout) / (f * L_H * term));
        dIL = Imax;
        Imin = 0;

        t1 = (Imax * L_H) / (Ue - vout);
        t2 = (Imax * L_H) / (vout + Uf);
        var D1 = t1 * f;
        var D2 = t2 * f;

        i1_rms = Imax * Math.sqrt(D1 / 3);
        i2_rms = Imax * Math.sqrt(D2 / 3);
        iL_rms = Imax * Math.sqrt((D1 + D2) / 3);
        i2_avg = Imax * D2 / 2;
    }

    return {
        isCCM: isCCM, Imax: Imax, Imin: Imin, dIL: dIL, t1: t1, t2: t2,
        i1_rms: i1_rms, i2_rms: i2_rms, iL_rms: iL_rms, i2_avg: i2_avg
    };
};

window.updateChartsAndTable = function () {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);
    var mode = document.getElementById("mode").value;
    var effMode = document.getElementById("effMode").value;

    var Uf = 0.7;
    var f = f_khz * 1000;

    var deltaIL_target;
    var Ue_design = vin_max;

    if (mode === "continuous") {
        deltaIL_target = 0.4 * ilout;
    } else if (mode === "critical") {
        deltaIL_target = 2.0 * ilout;
        Ue_design = vin_nom;
    } else {
        deltaIL_target = 2.5 * ilout;
        Ue_design = vin_nom;
    }

    var lOutput_H = (Ue_design - vout) * (vout + Uf) / ((Ue_design + Uf) * f * deltaIL_target);
    var lOutput = lOutput_H * 1e6;

    var op = window.calcBuckOperatingPoint(vin_nom, vout, ilout, f, lOutput_H);

    window.currentOperatingPoint = op;
    window.lOutput_global = lOutput;

    var modeWarnEl = document.getElementById('modeWarning');
    var actualMode;
    if (Math.abs(op.dIL - 2 * ilout) < 0.05 * ilout && !op.isCCM) {
        actualMode = "critical";
    } else if (!op.isCCM) {
        actualMode = "discontinuous";
    } else {
        actualMode = "continuous";
    }

    if (mode !== actualMode) {
        modeWarnEl.style.display = 'block';
        modeWarnEl.style.color = '#856404';
        modeWarnEl.style.backgroundColor = '#fff3cd';
        var modeNames = { "continuous": "CCM", "discontinuous": "DCM", "critical": "CRM" };
        var condition = (actualMode === "discontinuous") ? " (ΔIL > 2*Iout)" : (actualMode === "critical" ? " (ΔIL = 2*Iout)" : " (ΔIL < 2*Iout)");

        modeWarnEl.textContent = (window.getT ? window.getT('warning_mode_1') : "⚠️ Uyarı: Seçilen mod ") + modeNames[mode] +
            (window.getT ? window.getT('warning_mode_2') : ", ancak nominal gerilimde devre ") + modeNames[actualMode] +
            (window.getT ? window.getT('warning_mode_4') : " modunda çalışacak!") + condition;
    } else {
        modeWarnEl.style.display = 'none';
        modeWarnEl.textContent = '';
    }

    var wmax1 = 0.5 * lOutput_H * Math.pow(op.Imax, 2) * 1e6;
    window.wmax1_global = wmax1;

    var Vripple = vout * 0.01;
    var cOutput = op.dIL / (8 * f * Vripple) * 1e6;
    var rOutput = vout / ilout;
    var Pout = vout * ilout;

    var wf = window.generateAllWaveforms(vin_nom, vout, ilout, op, f);
    var effData;
    var finalKullanilacakVerim;

    if (effMode === "ideal") {
        effData = window.generateIdealEffCurve(verim / 100, f);
        finalKullanilacakVerim = verim;
        document.getElementById("powerLossSection").style.display = "none";
    } else {
        var params = window.getRealParams();
        effData = window.generateRealEffCurve(vin_nom, vout, ilout, f, lOutput_H, params);
        var realRes = window.calculateRealEfficiency(vin_nom, vout, ilout, f, op, params);

        finalKullanilacakVerim = realRes.efficiencyPercent;

        document.getElementById("powerLossSection").style.display = "block";
        document.getElementById("res_pon_h").innerText = realRes.breakdown.Pon_H.toFixed(4) + " W";
        document.getElementById("res_pon_l").innerText = realRes.breakdown.Pon_L.toFixed(4) + " W";
        document.getElementById("res_psw_h").innerText = realRes.breakdown.Psw_H.toFixed(4) + " W";
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

    var Pin = Pout / (finalKullanilacakVerim / 100);
    var iin = Pin / vin_nom;

    var J = MagneticUtils.getCurrentDensity(f_khz);

    window.il_rms = op.iL_rms;
    window.A_coil_req = op.iL_rms / J;
    window.d_coil_req = Math.sqrt((4 * window.A_coil_req) / Math.PI);

    document.getElementById('lOutput').innerText = lOutput.toFixed(2);
    document.getElementById('cOutput').innerText = cOutput.toFixed(2);
    document.getElementById('rOutput').innerText = rOutput.toFixed(2);
    document.getElementById('deltaILMax').innerText = op.dIL.toFixed(2);
    document.getElementById('wmax1').innerText = wmax1.toFixed(2);
    document.getElementById('iin').innerText = iin.toFixed(2);

    window.drawCharts(wf, ilout, vout, effData);
    window.updateResultTable(wf);
};

window.generateAllWaveforms = function (Ue, vout, ilout, op, f_hz) {
    var T = 1 / f_hz;
    var t_off = T - op.t1;
    var Uf = 0.7;

    var PTS = 100;
    var labels = [], vin_node = [], il = [], i1 = [], i2 = [];

    for (var cycle = 0; cycle < 2; cycle++) {
        var t0 = cycle * T;

        for (var k = 0; k < PTS; k++) {
            var frac = k / PTS;
            labels.push(((t0 + frac * op.t1) * 1e6).toFixed(2));
            vin_node.push(Ue);
            var current = op.Imin + (op.Imax - op.Imin) * frac;
            il.push(current);
            i1.push(current);
            i2.push(0);
        }

        if (op.isCCM) {
            for (var k = 0; k < PTS; k++) {
                var frac = k / PTS;
                labels.push(((t0 + op.t1 + frac * t_off) * 1e6).toFixed(2));
                vin_node.push(0);
                var current = op.Imax - (op.Imax - op.Imin) * frac;
                il.push(current);
                i1.push(0);
                i2.push(current);
            }
        } else {
            var PTS2 = Math.max(Math.round(PTS * op.t2 / t_off), 10);
            for (var k = 0; k < PTS2; k++) {
                var frac = k / PTS2;
                labels.push(((t0 + op.t1 + frac * op.t2) * 1e6).toFixed(2));
                vin_node.push(0);
                var current = op.Imax * (1 - frac);
                il.push(current);
                i1.push(0);
                i2.push(current);
            }

            var t_rest = T - op.t1 - op.t2;
            if (t_rest > 1e-9) {
                var PTS3 = Math.max(PTS - PTS2, 5);
                for (var k = 0; k < PTS3; k++) {
                    var frac = k / PTS3;
                    var decay = Math.exp(-6 * frac);
                    labels.push(((t0 + op.t1 + op.t2 + frac * t_rest) * 1e6).toFixed(2));
                    vin_node.push(vout + Math.sin(2 * Math.PI * 3 * frac) * decay * (Ue - vout) * 0.12);
                    il.push(0);
                    i1.push(0);
                    i2.push(0);
                }
            } else {
                labels.push(((t0 + T) * 1e6).toFixed(2));
                vin_node.push(0);
                il.push(0); i1.push(0); i2.push(0);
            }
        }
    }
    return { labels: labels, vin: vin_node, il: il, i1: i1, i2: i2 };
};

window.generateIdealEffCurve = function (eff_full_load, f_hz) {
    var values = [], labels = [];
    var k_fix = 0.018 * (f_hz / 50000);
    var k_cond = 0.028;
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

window.getRealParams = function () {
    return {
        Ron_H: parseFloat(document.getElementById('p_ron_h').value) || 0.100,
        Ron_L: parseFloat(document.getElementById('p_ron_l').value) || 0.070,
        tr_H: (parseFloat(document.getElementById('p_tr_h').value) || 4) * 1e-9,
        tf_H: (parseFloat(document.getElementById('p_tf_h').value) || 6) * 1e-9,
        tr_L: (parseFloat(document.getElementById('p_tr_l').value) || 2) * 1e-9,
        tf_L: (parseFloat(document.getElementById('p_tf_l').value) || 2) * 1e-9,
        Coss_H: (parseFloat(document.getElementById('p_coss_h').value) || 80) * 1e-12,
        Qg_H: (parseFloat(document.getElementById('p_qg_h').value) || 1) * 1e-9,
        Qg_L: (parseFloat(document.getElementById('p_qg_l').value) || 1) * 1e-9,
        Vgs: parseFloat(document.getElementById('p_vgs').value) || 5.0,
        Vd: parseFloat(document.getElementById('p_vd').value) || 0.5,
        tDr: (parseFloat(document.getElementById('p_tdr').value) || 30) * 1e-9,
        tDf: (parseFloat(document.getElementById('p_tdf').value) || 30) * 1e-9,
        trr: (parseFloat(document.getElementById('p_trr').value) || 25) * 1e-9,
        Irr: parseFloat(document.getElementById('p_irr').value) || 0.3,
        DCR: parseFloat(document.getElementById('p_dcr').value) || 0.080,
        Icc: (parseFloat(document.getElementById('p_icc').value) || 1) * 1e-3,
        ESR_Cin: parseFloat(document.getElementById('p_esrcin').value) || 0.003,
        ESR_Cout: parseFloat(document.getElementById('p_esrcout').value) || 0.001
    };
};

window.generateRealEffCurve = function (vin, vout, max_iout, f_hz, L_H, params) {
    var values = [], labels = [];
    for (var pct = 10; pct <= 120; pct += 5) {
        var currentLoad = max_iout * (pct / 100);
        if (currentLoad <= 0.001) currentLoad = 0.001;

        var op = window.calcBuckOperatingPoint(vin, vout, currentLoad, f_hz, L_H);
        var res = window.calculateRealEfficiency(vin, vout, currentLoad, f_hz, op, params);

        var e = res.efficiencyPercent;
        if (e > 99.5) e = 99.5; if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1))); labels.push(pct + "%");
    }
    return { values: values, labels: labels };
};

window.calculateRealEfficiency = function (vin, vout, iout, f_sw_hz, op, p) {
    var rectMode = document.getElementById("rectifierMode") ? document.getElementById("rectifierMode").value : "async";

    var Pon_H = Math.pow(op.i1_rms, 2) * p.Ron_H;
    var Psw_H = 0.5 * vin * op.Imax * (p.tr_H + p.tf_H) * f_sw_hz;
    var Pcoss = 0.5 * p.Coss_H * Math.pow(vin, 2) * f_sw_hz;
    var Pg_H = p.Qg_H * p.Vgs * f_sw_hz;

    var Pic = vin * p.Icc;
    var Pl_dcr = Math.pow(op.iL_rms, 2) * p.DCR;

    var Icin_rms_sq = Math.max(0, Math.pow(op.i1_rms, 2) - Math.pow(iout * (vout / vin), 2));
    var Pcin = Icin_rms_sq * p.ESR_Cin;

    var Icout_rms_sq = Math.max(0, Math.pow(op.iL_rms, 2) - Math.pow(iout, 2));
    var Pcout = Icout_rms_sq * p.ESR_Cout;

    var Pon_L = 0;
    var Psw_L = 0;
    var Pdiode = 0;
    var Prr = 0;
    var Pd = 0;
    var Pg_L = 0;

    if (rectMode === "async") {
        Pdiode = p.Vd * op.i2_avg;
        if (op.isCCM) { Prr = 0.5 * vin * p.Irr * p.trr * f_sw_hz; }
    } else {
        Pon_L = Math.pow(op.i2_rms, 2) * p.Ron_L;
        Psw_L = 0.5 * p.Vd * op.Imax * (p.tr_L + p.tf_L) * f_sw_hz;
        Pg_L = p.Qg_L * p.Vgs * f_sw_hz;
        Pd = p.Vd * iout * (p.tDr + p.tDf) * f_sw_hz;
        if (op.isCCM) { Prr = 0.5 * vin * p.Irr * p.trr * f_sw_hz; }
    }

    var Pg_Total = Pg_H + Pg_L;
    var Ptotal = Pon_H + Pon_L + Psw_H + Psw_L + Pdiode + Prr + Pcoss + Pd + Pg_Total + Pic + Pl_dcr + Pcin + Pcout;
    var efficiency = (vout * iout) / ((vout * iout) + Ptotal) * 100;

    return {
        totalLossW: Ptotal,
        efficiencyPercent: efficiency,
        breakdown: {
            Pon_H: Pon_H, Pon_L: Pon_L, Psw_H: Psw_H,
            Psw_L: rectMode === "async" ? Psw_L : Psw_L + Prr,
            Pdiode: rectMode === "async" ? Pdiode + Prr : 0,
            Pcoss: Pcoss, Pd: Pd, Pg: Pg_Total, Pic: Pic,
            Pl_dcr: Pl_dcr, Pcin: Pcin, Pcout: Pcout
        }
    };
};

window.drawCharts = function (wf, ilout, vout, effData) {
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

    function mk(id, datasets, yTitle, extraOpts = {}) {
        var canvas = document.getElementById(id);
        if (!canvas) return;
        if (canvas.chart) { canvas.chart.destroy(); canvas.chart = null; }
        var finalOptions = baseOpts(yTitle);
        if (extraOpts.scales && extraOpts.scales.y) { finalOptions.scales.y = { ...finalOptions.scales.y, ...extraOpts.scales.y }; }
        canvas.chart = new Chart(canvas.getContext('2d'), { type: 'line', data: { labels: wf.labels, datasets: datasets }, options: finalOptions });
    }

    mk('vinChart', [
        { label: 'Vin (Switch node)', data: wf.vin, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false, stepped: 'before' },
        { label: 'Vout', data: Array(N).fill(vout), borderColor: 'rgba(224, 224, 224, 0.8)', borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 }
    ], 'Voltage (V)');

    var ilData = wf.il;
    var actualMin = Math.min(...ilData); var actualMax = Math.max(...ilData);
    mk('ilChart', [
        { label: 'IL (Bobin)', data: ilData, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, fill: false },
        { label: 'Iout', data: Array(N).fill(ilout), borderColor: 'rgba(224, 224, 224, 0.8)', borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 }
    ], 'Current (A)', { scales: { y: { min: actualMin - 10, max: actualMax + 10 } } });

    mk('idChart', [
        { label: 'IDiode (Diode/Sync)', data: wf.i2, borderColor: 'rgba(105, 240, 174, 1)', borderWidth: 2, fill: false },
        { label: 'ISwitch', data: wf.i1, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: false }
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
};

window.updateResultTable = function (wf) {
    var table = document.getElementById('resultTable');
    if (!table) return;

    var headerRow = table.rows[0];
    if (headerRow) {
        while (headerRow.cells.length < 5) {
            var newCell = document.createElement(headerRow.cells[0].tagName === 'TH' ? 'th' : 'td');
            headerRow.appendChild(newCell);
        }
        headerRow.cells[3].innerHTML = "I_Switch";
        headerRow.cells[4].innerHTML = "I_Diode";
    }

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
        row.insertCell(1).innerHTML = (wf.vin[idx] || 0).toFixed(2) + " V";
        row.insertCell(2).innerHTML = (wf.il[idx] || 0).toFixed(2) + " A";
        row.insertCell(3).innerHTML = (wf.i1[idx] || 0).toFixed(2) + " A";
        row.insertCell(4).innerHTML = (wf.i2[idx] || 0).toFixed(2) + " A";
    }
};

window.openSelectedTable = function () {
    const modeElement = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeElement ? modeElement.value : "standard";

    if (!window.currentOperatingPoint) {
        alert(window.getT ? window.getT('adv_alert_calc_first') : "Lütfen önce hesaplama yapın!");
        return;
    }

    var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;
    var max_litz = 2 * 65.6 / Math.sqrt(f_khz * 1000);

    const params = {
        title: (window.getT ? window.getT('title_coil_data') : "Çekirdek Seçimi"),
        L_uH: window.lOutput_global,
        L_H: window.lOutput_global * 1e-6,
        Wmax: window.wmax1_global,
        Imax: window.currentOperatingPoint.Imax,
        Irms_sq: Math.pow(window.currentOperatingPoint.iL_rms, 2),
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

window.embedFalstadSimulation = function (circuitString) {
    var encodedCircuit = encodeURIComponent(circuitString);
    var iframe = document.getElementById("circuitFrame");

    iframe.src = "./falstad/circuitjs.html?hideHeader=true&hideControls=false&noPowerCheck=true&cct=" + encodedCircuit;
    iframe.contentWindow.oncircuitjsloaded = function () {
        window.falstadSim = iframe.contentWindow.CircuitJS1;
    };
};

window.openFalstadBuckSimulation = function () {
    var vin_nom = parseFloat(document.getElementById('vin_nom').value) || 24;
    var vout = parseFloat(document.getElementById('vout').value) || 12;
    var ilout = parseFloat(document.getElementById('ilout').value) || 10;
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;

    var l_uH = parseFloat(document.getElementById('lOutput').innerText) || 100;
    var c_uF = parseFloat(document.getElementById('cOutput').innerText) || 47;
    var r_load = parseFloat(document.getElementById('rOutput').innerText) || 1.2;

    document.getElementById("simulationContainer").style.display = "block";
    document.getElementById("liveDataBox").style.display = "block";
    document.getElementById("liveDataBox").innerHTML = "Fitcore SMPS Designer: BUCK (STEP-DOWN) Converter";

    document.getElementById("simulationContainer").scrollIntoView({ behavior: 'smooth' });

    var Uf = 0.7;
    var freq_hz = f_khz * 1000;
    var l_henry = l_uH * 1e-6;
    var c_farad = c_uF * 1e-6;

    var sim_timestep = 1.0 / (freq_hz * 50);
    var timestep_str = sim_timestep.toExponential(2).toUpperCase();

    var op = window.calcBuckOperatingPoint(vin_nom, vout, ilout, freq_hz, l_henry);
    var duty_cycle = op.t1 * freq_hz;

    if (duty_cycle > 0.95) duty_cycle = 0.95;
    if (duty_cycle < 0.05) duty_cycle = 0.05;

    var v_gate_max = vin_nom + 15;
    var v_amp = v_gate_max / 2;

    var falstadTemplate = `
$ 1 {TIMESTEP} 0.5 50 5.0 50
v 32 224 32 80 0 0 40 {VIN} 0 0 0.5
v 112 192 112 128 0 2 {FREQ} {V_AMP} {V_AMP} 0 {DUTY}
d 160 224 160 112 1 {UF}
l 160 80 256 80 0 {L_VAL} 0
c 256 80 256 224 0 {C_VAL} 0
r 256 80 352 80 0 {R_VAL}
w 32 224 160 224 0
w 160 224 256 224 0
w 256 224 352 224 0
w 352 80 352 224 0
g 160 224 160 240 0
w 128 80 160 80 0
w 160 112 160 80 0
w 96 80 64 80 0
w 64 80 32 80 0
f 112 128 112 80 40 1.5 1000
o 3 1 0 34 20.0 0.05 0 -1
o 3 1 0 33 5.0 0.1 1 -1
o 5 1 0 34 20.0 0.05 2 -1
o 5 1 0 33 5.0 0.1 3 -1
o 15 1 0 34 20.0 0.05 4 -1
o 15 1 0 33 5.0 0.1 5 -1
`.trim();

    var vscale = Math.max(5, Math.ceil(vin_nom / 5) * 5);
    var iscale = Math.max(2, Math.ceil(ilout / 2) * 2);

    var circuitString = falstadTemplate
        .replace('{TIMESTEP}', timestep_str)
        .replace('{VIN}', vin_nom)
        .replace('{UF}', Uf)
        .replace('{L_VAL}', l_henry)
        .replace('{C_VAL}', c_farad)
        .replace('{R_VAL}', r_load)
        .replace('{FREQ}', freq_hz)
        .replace(/{V_AMP}/g, v_amp)
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