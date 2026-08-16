// ================================================================
// Power Factor Pre-regulator (PFC)
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================

var il_rms = 0;
var A_coil_req = 0;
var d_coil_req = 0;
var il_peak_absolute_global = 0;

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

function checkUserInput() {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);

    if (isNaN(vin_min) || vin_min <= 0) vin_min = 90.0;
    if (isNaN(vin_max) || vin_max <= 0) vin_max = 260.0;
    if (isNaN(vout) || vout <= 0) vout = 380.0;
    if (isNaN(ilout) || ilout <= 0) ilout = 1.0;
    if (isNaN(f_khz) || f_khz <= 0) f_khz = 50.0;
    if (isNaN(verim) || verim <= 0) verim = 95.0;

    if (vin_min > vin_max) vin_max = vin_min;

    if (isNaN(vin_nom) || vin_nom <= 0 || vin_nom < vin_min || vin_nom > vin_max) {
        vin_nom = vin_min;
    }

    var getT = window.getT || function (key) { return key; };

    if (f_khz < 0.1 || f_khz > 1000) {
        alert(getT('alert_freq_warning') || "Uyarý: Anahtarlama frekansý 100 Hz ile 1 MHz arasýnda olmalýdýr!");
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
    document.getElementById('vin_min').value = 90;
    document.getElementById('vin_max').value = 260;
    document.getElementById('vin_nom').value = 90;
    document.getElementById('vout').value = 380;
    document.getElementById('ilout').value = 1;
    document.getElementById('f_khz').value = 50;
    document.getElementById('verim').value = 95;
}

// ================================================================
// GERÇEK KAYIP HESAPLAMALARI (Power Loss)
// ================================================================
function getRealParams() {
    return {
        Ron: parseFloat(document.getElementById('p_ron_h').value) || 0.150,
        Coss: (parseFloat(document.getElementById('p_coss').value) || 100) * 1e-12,
        tr: (parseFloat(document.getElementById('p_tr').value) || 20) * 1e-9,
        tf: (parseFloat(document.getElementById('p_tf').value) || 20) * 1e-9,
        Qg: (parseFloat(document.getElementById('p_qg').value) || 30) * 1e-9,
        Vgs: parseFloat(document.getElementById('p_vgs').value) || 12.0,
        Vd: parseFloat(document.getElementById('p_vd').value) || 1.0,
        trr: (parseFloat(document.getElementById('p_trr').value) || 20) * 1e-9,
        Irr: parseFloat(document.getElementById('p_irr').value) || 1.0,
        DCR: parseFloat(document.getElementById('p_dcr').value) || 0.050,
        Icc: (parseFloat(document.getElementById('p_icc').value) || 2.0) * 1e-3,
        Vcc: 12.0
    };
}

function calculateRealEfficiency(vin_rms, vout, iout, f_sw_hz, p, topoMode) {
    var Pout = vout * iout;
    var Iin_rms = Pout / vin_rms;

    var duty_factor = 1 - (8 * Math.sqrt(2) * vin_rms) / (3 * Math.PI * vout);
    if (duty_factor < 0) duty_factor = 0;

    var I_Qrms_sq;
    if (topoMode === 'continuous') {
        I_Qrms_sq = Math.pow(Iin_rms, 2) * duty_factor;
    } else if (topoMode === 'critical') {
        I_Qrms_sq = Math.pow(Iin_rms, 2) * duty_factor * 1.33;
    } else {
        I_Qrms_sq = Math.pow(Iin_rms, 2) * duty_factor * 1.5;
    }

    var Pon_MOS = I_Qrms_sq * p.Ron;

    var Psw_MOS = 0.5 * vout * Iin_rms * (p.tr + p.tf) * f_sw_hz;
    var Pcoss = 0.5 * p.Coss * Math.pow(vout, 2) * f_sw_hz;

    var Pdiode_cond = p.Vd * iout;
    var Pdiode_rr = 0.5 * vout * p.Irr * p.trr * f_sw_hz;

    if (topoMode === 'critical' || topoMode === 'discontinuous') {
        Pdiode_rr = 0;
    }

    var Pl_dcr = I_Qrms_sq * p.DCR;

    var Pgate = p.Qg * p.Vgs * f_sw_hz;
    var Pic = p.Vcc * p.Icc;

    var Ptotal = Pon_MOS + Psw_MOS + Pcoss + Pdiode_cond + Pdiode_rr + Pl_dcr + Pgate + Pic;
    var efficiency = (Pout / (Pout + Ptotal)) * 100;

    return {
        totalLossW: Ptotal,
        efficiencyPercent: Math.max(0, efficiency),
        breakdown: { Pon_MOS: Pon_MOS, Psw_MOS: Psw_MOS, Pcoss: Pcoss, Pdiode_cond: Pdiode_cond, Pdiode_rr: Pdiode_rr, Pl_dcr: Pl_dcr, Pgate: Pgate, Pic: Pic }
    };
}

function generateIdealEffCurve(eff_full_load, f_hz) {
    var values = [], labels = [];
    var k_fix = 0.015 * (f_hz / 50000);
    var k_cond = 0.035;

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
}

function generateRealEffCurve(vin_rms, vout, max_iout, f_hz, params, topoMode) {
    var values = [], labels = [];
    for (var pct = 10; pct <= 120; pct += 5) {
        var currentLoad = max_iout * (pct / 100);
        if (currentLoad <= 0.001) currentLoad = 0.001;

        var res = calculateRealEfficiency(vin_rms, vout, currentLoad, f_hz, params, topoMode);
        var e = res.efficiencyPercent;
        if (e > 99.5) e = 99.5; if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
}

// ================================================================
// Main calc. & DOM Update
// ================================================================
function updateChartsAndTable() {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_nom = parseFloat(document.getElementById('vin_nom').value);
    var vout = parseFloat(document.getElementById('vout').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);
    var effMode = document.getElementById("effMode").value;
    var topoMode = document.getElementById("mode").value;

    var f_hz = f_khz * 1000;
    var w2 = Math.sqrt(2);

    var f_line_el = document.getElementById('f_line_hz');
    var f_line = f_line_el ? (parseFloat(f_line_el.value) || 50.0) : 50.0;

    var rOutput = vout / ilout;
    var pOutput = vout * ilout;

    var vin_nom_peak = w2 * vin_nom;
    var vin_min_peak = w2 * vin_min;
    var iin_max_peak = w2 * vout * ilout / vin_min;

    var deltaIL;
    if (topoMode === 'continuous') {
        deltaIL = 0.4 * iin_max_peak;
    } else if (topoMode === 'critical') {
        deltaIL = 2.0 * iin_max_peak;
    } else {
        deltaIL = 2.5 * iin_max_peak;
    }

    var L_H = vin_min_peak * (1 - vin_min_peak / vout) / (f_hz * deltaIL);
    if (L_H < 0) L_H = 0.0001;
    var lOutput = L_H * 1e6;

    var deltaILMax = deltaIL;

    var deltaVout = 0.05 * vout;
    var C_F = ilout / (Math.PI * (2 * f_line) * deltaVout);
    var cOutput = C_F * 1e6;

    var il_peak_absolute;
    if (topoMode === 'continuous') {
        il_peak_absolute = iin_max_peak + (deltaILMax / 2);
    } else {
        il_peak_absolute = deltaILMax;
    }

    il_peak_absolute_global = il_peak_absolute;

    var wmax1 = 0.5 * L_H * Math.pow(il_peak_absolute, 2) * 1e6;

    var finalKullanilacakVerim = verim;
    var effData;

    if (effMode === "ideal") {
        effData = generateIdealEffCurve(verim / 100, f_hz);
        document.getElementById("powerLossSection").style.display = "none";
        var loss = Math.abs(100 - verim);
        if (document.getElementById('loss')) document.getElementById('loss').innerText = loss.toFixed(2);
    } else {
        var params = getRealParams();
        effData = generateRealEffCurve(vin_nom, vout, ilout, f_hz, params, topoMode);
        var realRes = calculateRealEfficiency(vin_nom, vout, ilout, f_hz, params, topoMode);

        finalKullanilacakVerim = realRes.efficiencyPercent;
        document.getElementById("powerLossSection").style.display = "block";

        document.getElementById("res_pon_mos").innerText = realRes.breakdown.Pon_MOS.toFixed(4) + " W";
        document.getElementById("res_psw_mos").innerText = realRes.breakdown.Psw_MOS.toFixed(4) + " W";
        document.getElementById("res_pdiode_cond").innerText = realRes.breakdown.Pdiode_cond.toFixed(4) + " W";
        document.getElementById("res_pdiode_rr").innerText = realRes.breakdown.Pdiode_rr.toFixed(4) + " W";
        document.getElementById("res_pcoss").innerText = realRes.breakdown.Pcoss.toFixed(4) + " W";
        document.getElementById("res_pl_dcr").innerText = realRes.breakdown.Pl_dcr.toFixed(4) + " W";
        document.getElementById("res_pgate").innerText = realRes.breakdown.Pgate.toFixed(4) + " W";
        document.getElementById("res_pic").innerText = realRes.breakdown.Pic.toFixed(4) + " W";

        document.getElementById("res_ptotal").innerText = realRes.totalLossW.toFixed(4) + " W";
        document.getElementById("res_peff").innerText = realRes.efficiencyPercent.toFixed(2) + " %";

        var loss = Math.abs(100 - finalKullanilacakVerim);
        if (document.getElementById('loss')) document.getElementById('loss').innerText = loss.toFixed(2);
    }

    var Pin = pOutput / (finalKullanilacakVerim / 100);
    var iin_rms = Pin / vin_min;

    var J = MagneticUtils.getCurrentDensity(f_khz);

    il_rms = iin_rms;
    A_coil_req = il_rms / J;
    d_coil_req = 2 * Math.sqrt(A_coil_req / Math.PI);

    if (document.getElementById('lOutput')) document.getElementById('lOutput').innerText = lOutput.toFixed(2);
    if (document.getElementById('cOutput')) document.getElementById('cOutput').innerText = cOutput.toFixed(2);
    if (document.getElementById('rOutput')) document.getElementById('rOutput').innerText = rOutput.toFixed(2);
    if (document.getElementById('deltaILMax')) document.getElementById('deltaILMax').innerText = deltaILMax.toFixed(2);
    if (document.getElementById('pOutput')) document.getElementById('pOutput').innerText = pOutput.toFixed(2);
    if (document.getElementById('deltaVout')) document.getElementById('deltaVout').innerText = deltaVout.toFixed(2);
    if (document.getElementById('wmax1')) document.getElementById('wmax1').innerText = wmax1.toFixed(2);
    if (document.getElementById('iin')) document.getElementById('iin').innerText = iin_rms.toFixed(2);

    var wf = generatePFCWaveforms(vin_nom_peak, iin_max_peak, pOutput, vout, deltaVout, deltaILMax, f_hz, topoMode, f_line);
    drawCharts(wf, effData);
    updateResultTable(wf);
}

function generatePFCWaveforms(vin_peak, il_peak, pOut, vout_dc, deltaVout, deltaILMax, f_hz, topoMode, f_line) {
    var labels = [], vin_abs = [], il_avg = [], il_ripple_max = [], il_ripple_min = [], p_in = [], p_out = [], v_out = [];
    var PTS = 200;
    var f_line_hz = f_line || 50.0;
    var T_mains_half = 500.0 / f_line_hz; // ms, half period of the rectified mains cycle (10ms @ 50Hz, 8.33ms @ 60Hz)
    var omega = Math.PI / T_mains_half;

    for (var k = 0; k <= PTS; k++) {
        var t_ms = (k / PTS) * T_mains_half;
        labels.push(t_ms.toFixed(2));

        var sin_wt = Math.sin(omega * t_ms);

        vin_abs.push(vin_peak * sin_wt);

        var current_il_avg = il_peak * sin_wt;
        il_avg.push(current_il_avg);

        if (topoMode === 'continuous') {
            var current_delta = deltaILMax * sin_wt;
            il_ripple_max.push(current_il_avg + (current_delta / 2));
            il_ripple_min.push(current_il_avg - (current_delta / 2));
        } else if (topoMode === 'critical') {
            var current_delta = 2 * current_il_avg;
            il_ripple_max.push(current_delta);
            il_ripple_min.push(0);
        } else {
            var current_delta = 2.5 * current_il_avg;
            il_ripple_max.push(current_delta);
            il_ripple_min.push(0);
        }

        var current_pin = (vin_peak * sin_wt) * (il_peak * sin_wt);
        p_in.push(current_pin);
        p_out.push(pOut);

        var current_vout = vout_dc - (deltaVout / 2) * Math.cos(2 * omega * t_ms);
        v_out.push(current_vout);
    }

    return {
        labels: labels,
        vin_abs: vin_abs,
        il_avg: il_avg,
        il_ripple_max: il_ripple_max,
        il_ripple_min: il_ripple_min,
        pin: p_in,
        pout: p_out,
        vout: v_out
    };
}

// ================================================================
// Charts
// ================================================================
function drawCharts(wf, effData) {
    var N = wf.labels.length;
    var tickStep = Math.max(1, Math.floor(N / 10));

    var textColor = '#e0e0e0';
    var gridColor = 'rgba(255, 255, 255, 0.1)';

    var getT = window.getT || function (key) { return key; };
    var f_line_el = document.getElementById('f_line_hz');
    var f_line_label = f_line_el ? (parseFloat(f_line_el.value) || 50) : 50;

    function baseOpts(yTitle) {
        return {
            responsive: true, animation: false,
            elements: { point: { radius: 0 }, line: { tension: 0.4 } },
            scales: {
                x: { type: 'category', ticks: { color: textColor, maxTicksLimit: 11, callback: function (val, idx) { return (idx % tickStep === 0) ? wf.labels[idx] + "ms" : ''; } }, title: { display: true, text: 'Time (ms) - ' + f_line_label + 'Hz Mains', color: textColor }, grid: { color: gridColor, borderColor: gridColor } },
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
        { label: 'IL Max Envelope', data: wf.il_ripple_max, borderColor: 'rgba(129, 199, 132, 1)', borderWidth: 1.5, fill: false, tension: 0.4 },
        { label: 'IL Min Envelope', data: wf.il_ripple_min, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 1.5, fill: false, tension: 0.4 },
        { label: 'IL Avg', data: wf.il_avg, borderColor: 'rgba(255, 255, 255, 0.5)', borderWidth: 1.5, fill: false, borderDash: [5, 5], tension: 0.4 }
    ], 'Inductor Current (A)');

    mk('vinChart', [
        { label: '|Vin| (V)', data: wf.vin_abs, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false, tension: 0.4 }
    ], 'Input Voltage (V)');

    mk('powChart', [
        { label: 'Pin (W)', data: wf.pin, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, backgroundColor: 'rgba(239, 83, 80, 0.15)', fill: true, tension: 0.4 },
        { label: 'Pout (W)', data: wf.pout, borderColor: 'rgba(255, 255, 255, 0.7)', borderWidth: 2, fill: false, borderDash: [7, 4], tension: 0.4 }
    ], 'Power (W)');

    mk('idChart', [
        { label: 'Vout (V)', data: wf.vout, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: false, tension: 0.4 }
    ], 'Output Voltage (V)');

    var effCanvas = document.getElementById('effChart');
    if (effCanvas) {
        if (effCanvas.chart) { effCanvas.chart.destroy(); effCanvas.chart = null; }
        effCanvas.chart = new Chart(effCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: effData.labels,
                datasets: [{
                    label: getT('chart_eff_pct') || 'Efficiency vs Load',
                    data: effData.values,
                    borderColor: 'rgba(129, 199, 132, 1)',
                    backgroundColor: 'rgba(129, 199, 132, 0.15)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: 'rgba(129, 199, 132, 1)'
                }]
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
        row.insertCell(0).innerHTML = wf.labels[idx] + " ms";
        row.insertCell(1).innerHTML = (wf.vin_abs[idx] || 0).toFixed(2) + " V";
        row.insertCell(2).innerHTML = (wf.il_avg[idx] || 0).toFixed(2) + " A";
        row.insertCell(3).innerHTML = (wf.pin[idx] || 0).toFixed(2) + " W";
        row.insertCell(4).innerHTML = (wf.vout[idx] || 0).toFixed(2) + " V";
    }
}

function printPage() { window.print(); }

// ================================================================
// FALSTAD API & IFRAME
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

function openFalstadPFCSimulation() {
    var vin_nom = parseFloat(document.getElementById('vin_nom').value) || 220;
    var vout = parseFloat(document.getElementById('vout').value) || 380;
    var ilout = parseFloat(document.getElementById('ilout').value) || 1;
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;

    var l_uH = parseFloat(document.getElementById('lOutput').innerText) || 500;
    var c_uF = parseFloat(document.getElementById('cOutput').innerText) || 100;

    var r_load = parseFloat(document.getElementById('rOutput').innerText) || (vout / ilout);

    document.getElementById("simulationContainer").style.display = "block";
    document.getElementById("liveDataBox").style.display = "block";
    document.getElementById("liveDataBox").innerHTML = "Fitcore SMPS Designer: ACTIVE PFC BOOST CONVERTER";

    if (document.getElementById("simulationContainer").scrollIntoView) {
        document.getElementById("simulationContainer").scrollIntoView({ behavior: 'smooth' });
    }

    var Uf = 0.7;
    var freq_hz = f_khz * 1000;
    var l_henry = l_uH * 1e-6;
    var c_farad = c_uF * 1e-6;

    var sim_timestep = 1.0 / (freq_hz * 50);
    var timestep_str = sim_timestep.toExponential(2).toUpperCase();

    var vin_peak = Math.sqrt(2) * vin_nom;
    var vin_eff = vin_peak - (2 * Uf);
    var vout_eff = vout + Uf;

    var duty_cycle = 1 - (vin_eff / vout_eff);

    if (duty_cycle < 0.05) duty_cycle = 0.05;
    if (duty_cycle > 0.90) duty_cycle = 0.90;

    var vscale_in = Math.max(50, Math.ceil(vin_peak / 50) * 50);
    var vscale_out = Math.max(50, Math.ceil(vout / 50) * 50);

    var iscale_out = Math.max(1, Math.ceil((vout / r_load) * 2));
    var iin_max_peak = Math.sqrt(2) * vout * ilout / vin_nom;
    var iscale_ind = Math.max(1, Math.ceil(iin_max_peak * 1.5));

    var v_init = vout;

    var falstadTemplate = `
$ 1 {TIMESTEP} 100.0 50 5.0 50
v 0 256 0 160 0 1 50 {VIN_PEAK} 0 0 0.5
R 272 224 272 192 0 2 {FREQ} 15 15 0 {DUTY}
d 64 208 112 160 1 {UF1}
d 64 208 112 256 1 {UF2}
d 112 160 160 208 1 {UF3}
d 112 256 160 208 1 {UF4}
c 192 160 192 288 0 10E-7 0
l 192 160 320 160 0 {L_VAL} 0
f 272 224 320 224 0 1.5 0.02
d 320 160 416 160 1 {UF5}
c 416 160 416 288 0 {C_VAL} {V_INIT}
r 480 160 480 288 0 {R_VAL}
w 0 160 112 160 0
w 0 256 112 256 0
w 192 288 320 288 0
w 320 288 416 288 0
w 416 288 480 288 0
w 480 160 416 160 0
g 416 288 416 304 0
w 320 160 320 208 0
w 320 240 320 288 0
w 64 208 64 288 0
w 64 288 192 288 0
w 160 208 160 160 0
w 160 160 192 160 0
o 0 1 0 34 {VSCALE_IN} 0.1 0 -1
o 7 1 0 33 {ISCALE_IND} 0.1 1 -1
o 11 1 0 33 {ISCALE_OUT} 0.1 2 -1
o 10 1 0 34 {VSCALE_OUT} 0.1 3 -1
`.trim();

    var circuitString = falstadTemplate
        .replace('{TIMESTEP}', timestep_str)
        .replace('{VIN_PEAK}', vin_peak)
        .replace('{UF1}', Uf)
        .replace('{UF2}', Uf)
        .replace('{UF3}', Uf)
        .replace('{UF4}', Uf)
        .replace('{UF5}', Uf)
        .replace('{L_VAL}', l_henry)
        .replace('{C_VAL}', c_farad)
        .replace('{V_INIT}', v_init)
        .replace('{R_VAL}', r_load)
        .replace('{FREQ}', freq_hz)
        .replace('{DUTY}', duty_cycle)
        .replace(/{VSCALE_IN}/g, vscale_in)
        .replace(/{VSCALE_OUT}/g, vscale_out)
        .replace(/{ISCALE_IND}/g, iscale_ind)
        .replace(/{ISCALE_OUT}/g, iscale_out);

    embedFalstadSimulation(circuitString);
}

function hesapla() {
    if (!checkUserInput()) { setDefaultValues(); }
    updateChartsAndTable();
    if (typeof window.openSelectedTable === "function") {
        window.openSelectedTable();
    }
}

// ================================================================
// TABLE and MODAL
// ================================================================
window.openSelectedTable = function () {
    const modeEl = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeEl ? modeEl.value : 'standard';

    var lOutput = parseFloat(document.getElementById('lOutput').innerText);
    var wmax1 = parseFloat(document.getElementById('wmax1').innerText);

    if (isNaN(lOutput) || lOutput <= 0) {
        var getT = window.getT || function (key) { return key; };
        alert(getT('alert_fill_fields') || "Lütfen önce hesaplama yapýn!");
        return;
    }

    if (mode === 'advanced') {
        if (typeof window.openAdvancedTable === 'function') {
            window.openAdvancedTable(1);
        } else {
            var getT = window.getT || function (key) { return key; };
            alert(getT('alert_advanced_module_error') || 'Advanced mod modülü yüklenemedi.');
        }
    } else {
        if (typeof UIModal !== 'undefined') {
            var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;
            var getT = window.getT || function (key) { return key; };
            UIModal.openStandardModal({
                title: getT('title_coil_data') || "PFC Bobin Seçimi",
                L_H: lOutput * 1e-6,
                L_uH: lOutput,
                Wmax: wmax1,
                Imax: il_peak_absolute_global, // real peak
                Irms_sq: Math.pow(il_rms, 2),
                d_wire_default: d_coil_req,
                min_area: A_coil_req,
                max_litz: 2 * 65.6 / Math.sqrt(f_khz * 1000)
            });
        } else {
            alert("UIModal arayüz modülü yüklenemedi!");
        }
    }
};

window.addEventListener('DOMContentLoaded', (event) => {
    document.getElementById('calculateButton').addEventListener('click', updateChartsAndTable);
    document.getElementById('printButton').addEventListener('click', printPage);
    document.getElementById('openButton').addEventListener('click', window.openSelectedTable);
});
