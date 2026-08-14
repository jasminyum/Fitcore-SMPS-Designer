// ================================================================
// Single Transistor Forward Converter 
// ================================================================

var d1_req = 0, A1_req = 0, d2_req = 0, A2_req = 0;
var d_coil_req = 0, A_coil_req = 0, il_rms = 0;
var max_wire_d_mm = 0;

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

    if (isNaN(vin_min) || vin_min <= 0) vin_min = 360.0;
    if (isNaN(vin_max) || vin_max <= 0) vin_max = 400.0;
    if (isNaN(vout) || vout <= 0) vout = 24.0;
    if (isNaN(ilout) || ilout <= 0) ilout = 10.0;
    if (isNaN(f_khz) || f_khz <= 0) f_khz = 50.0;
    if (isNaN(verim) || verim <= 0) verim = 80.0;

    if (vin_min > vin_max) vin_max = vin_min;

    if (isNaN(vin_nom) || vin_nom <= 0 || vin_nom < vin_min || vin_nom > vin_max) {
        vin_nom = vin_max;
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
    document.getElementById('vin_min').value = 360;
    document.getElementById('vin_max').value = 400;
    document.getElementById('vin_nom').value = 400;
    document.getElementById('vout').value = 24;
    document.getElementById('ilout').value = 10;
    document.getElementById('f_khz').value = 50;
    document.getElementById('verim').value = 80;
}

// ================================================================
// ACTUAL LOSS CALCULATIONS (Power Loss)
// ================================================================
function getRealParams() {
    return {
        Ron: parseFloat(document.getElementById('p_ron_h').value) || 0.250,
        Coss: (parseFloat(document.getElementById('p_coss').value) || 150) * 1e-12,
        Qg: (parseFloat(document.getElementById('p_qg').value) || 25) * 1e-9,
        Vgs: parseFloat(document.getElementById('p_vgs').value) || 10.0,
        tr: (parseFloat(document.getElementById('p_tr').value) || 15) * 1e-9,
        tf: (parseFloat(document.getElementById('p_tf').value) || 15) * 1e-9,
        Vd1: parseFloat(document.getElementById('p_vd1').value) || 0.7,
        Vd2: parseFloat(document.getElementById('p_vd2').value) || 0.7,
        trr: (parseFloat(document.getElementById('p_trr').value) || 35) * 1e-9,
        Irr: parseFloat(document.getElementById('p_irr').value) || 0.8,
        DCR_pri: parseFloat(document.getElementById('p_dcr_pri').value) || 0.100,
        DCR_sec: parseFloat(document.getElementById('p_dcr_sec').value) || 0.020,
        DCR_ind: parseFloat(document.getElementById('p_dcr_ind').value) || 0.015,
        ESR_Cout: parseFloat(document.getElementById('p_esrcout').value) || 0.005,
        Icc: (parseFloat(document.getElementById('p_icc').value) || 2.5) * 1e-3
    };
}

function calculateRealEfficiency(vin, vout, iout, f_sw_hz, deltaIL, nOutput, p) {
    var Vsec = vin / nOutput;
    var D = (vout + p.Vd1) / Vsec;
    if (D > 0.5) D = 0.5;
    if (D < 0) D = 0;

    var Ipri_rms = (iout / nOutput) * Math.sqrt(D);
    var Ipri_pk = (iout + deltaIL / 2) / nOutput;

    var Pon_MOS = Math.pow(Ipri_rms, 2) * p.Ron;

    var V_stress = 2 * vin;
    var Psw_MOS = 0.5 * V_stress * Ipri_pk * (p.tr + p.tf) * f_sw_hz;
    var Pcoss = 0.5 * p.Coss * Math.pow(V_stress, 2) * f_sw_hz;

    var Pdiode_fwd = iout * D * p.Vd1;
    var Pdiode_fwl = iout * (1 - D) * p.Vd2;
    var Pdiode_cond = Pdiode_fwd + Pdiode_fwl;
    var Pdiode_rr = 0.5 * Vsec * p.Irr * p.trr * f_sw_hz;

    var Iout_rms_sq = Math.pow(iout, 2) + Math.pow(deltaIL, 2) / 12;
    var Pl_dcr = Iout_rms_sq * p.DCR_ind;
    var Ptr_dcr = Math.pow(Ipri_rms, 2) * p.DCR_pri + Math.pow(iout * Math.sqrt(D), 2) * p.DCR_sec;

    var Icout_rms = deltaIL / (2 * Math.sqrt(3));
    var Pcout = Math.pow(Icout_rms, 2) * p.ESR_Cout;

    var Pgate = p.Qg * p.Vgs * f_sw_hz;
    var Pic = vin * p.Icc;

    var Ptotal = Pon_MOS + Psw_MOS + Pcoss + Pdiode_cond + Pdiode_rr + Ptr_dcr + Pl_dcr + Pcout + Pgate + Pic;
    var efficiency = (vout * iout) / ((vout * iout) + Ptotal) * 100;

    return {
        totalLossW: Ptotal,
        efficiencyPercent: Math.max(0, efficiency),
        breakdown: { Pon_MOS: Pon_MOS, Psw_MOS: Psw_MOS, Pcoss: Pcoss, Pdiode_cond: Pdiode_cond, Pdiode_rr: Pdiode_rr, Ptr_dcr: Ptr_dcr, Pl_dcr: Pl_dcr, Pcout: Pcout, Pgate: Pgate, Pic: Pic }
    };
}

function generateIdealEffCurve(eff_full_load, f_hz) {
    var values = [], labels = [];
    var k_fix = 0.02 * (f_hz / 50000);
    var k_cond = 0.03;
    function raw_eff(p) {
        if (p < 0.001) p = 0.001;
        var loss = k_fix + k_cond * p * p;
        return p / (p + loss);
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

function generateRealEffCurve(vin, vout, max_iout, f_sw_hz, L_H, nOutput, p) {
    var values = [], labels = [];
    for (var pct = 10; pct <= 120; pct += 5) {
        var currentLoad = max_iout * (pct / 100);
        if (currentLoad <= 0.001) currentLoad = 0.001;

        var Vsec = vin / nOutput;
        var D = (vout + p.Vd1) / Vsec;
        var t1 = D / f_sw_hz;
        var actualDeltaIL = (Vsec - vout - p.Vd1) * t1 / L_H;

        var res = calculateRealEfficiency(vin, vout, currentLoad, f_sw_hz, actualDeltaIL, nOutput, p);
        var e = res.efficiencyPercent;
        if (e > 99.5) e = 99.5; if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
}

// ================================================================
// ANA HESAPLAMA
// ================================================================
function updateChartsAndTable() {
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
    var f_hz = f_khz * 1000;
    var T = 1.0 / f_hz;
    var rOutput = vout / ilout;

    var nOutput = 0.5 * vin_min * 0.95 / (vout + Uf);

    var Ue_max = vin_max;
    var nUe_max = Ue_max / nOutput - Uf;
    var t1_max = (vout + Uf) / (f_hz * (nUe_max + Uf));
    var deltaILMax = 0.4 * ilout;
    var L_H = t1_max * (nUe_max - vout) / deltaILMax;

    var Ue_nom = vin_nom;
    var nUe_nom = Ue_nom / nOutput - Uf;
    var t1_nom = (vout + Uf) / (f_hz * (nUe_nom + Uf));
    var actual_deltaIL = t1_nom * (nUe_nom - vout) / L_H;

    var actualMode = (actual_deltaIL > 2 * ilout) ? "discontinuous" : "continuous";

    var modeSelect = document.getElementById("mode");
    var modeWarnEl = document.getElementById('modeWarning');

    if (modeSelect.value !== "continuous") {
        alert(window.getT ? window.getT('info_forward_ccm_force') : "Bu konvertör tasarımı gereği CCM modunda çalışmalıdır.");
        modeWarnEl.style.display = 'block';
        modeWarnEl.style.color = '#004085';
        modeWarnEl.style.backgroundColor = '#cce5ff';
        modeWarnEl.style.border = '1px solid #b8daff';
        modeWarnEl.innerHTML = "💡 " + (window.getT ? window.getT('info_forward_ccm_force') : "Bu konvertör tasarımı gereği CCM modunda çalışmalıdır.");

        modeSelect.value = "continuous";
        mode = "continuous";
    }
    else if (actualMode === "discontinuous") {
        alert(window.getT ? window.getT('warn_forward_dcm_transition') : "Dikkat: Sistem DCM moduna geçiyor!");
        modeWarnEl.style.display = 'block';
        modeWarnEl.style.color = '#856404';
        modeWarnEl.style.backgroundColor = '#fff3cd';
        modeWarnEl.style.border = '1px solid #ffeeba';
        modeWarnEl.innerHTML = "⚠️ " + (window.getT ? window.getT('warn_forward_dcm_transition') : "Dikkat: Mevcut yük şartlarında sistem DCM (Kesintili Mod) sınırına girdi.");
    }
    else {
        modeWarnEl.style.display = 'none';
    }

    var Imax, dIL_actual, t1;
    if (mode === "continuous") {
        t1 = t1_nom;
        dIL_actual = actual_deltaIL;
        Imax = ilout + 0.5 * dIL_actual;
    } else {
        t1 = Math.sqrt((ilout * L_H) / ((f_hz / 2) * (nUe_nom - vout) * (nUe_nom + Uf) / (vout + Uf)));
        dIL_actual = (nUe_nom - vout) * t1 / L_H;
        Imax = dIL_actual;
    }

    var lOutput = L_H * 1e6;
    var wmax1 = 0.5 * L_H * Imax * Imax * 1e6;
    var cOutput = (ilout * (1 - (t1 / T))) / (f_hz * 0.1) * 1e6;

    var iPa = ilout * (vout + Uf);
    var Pa = iPa / 0.95;

    var VeOpt = 52000 * Math.pow(Pa / 800, 1.2) * Math.sqrt(50000 / f_hz);

    var finalKullanilacakVerim = verim;
    var effData;

    if (effMode === "ideal") {
        effData = generateIdealEffCurve(verim / 100, f_hz);
        document.getElementById("powerLossSection").style.display = "none";
        var loss = Math.abs(100 - verim);
        document.getElementById('loss').innerText = loss.toFixed(2);
    } else {
        var params = getRealParams();
        effData = generateRealEffCurve(Ue_nom, vout, ilout, f_hz, L_H, nOutput, params);
        var realRes = calculateRealEfficiency(Ue_nom, vout, ilout, f_hz, dIL_actual, nOutput, params);

        finalKullanilacakVerim = realRes.efficiencyPercent;
        document.getElementById("powerLossSection").style.display = "block";

        document.getElementById("res_pon_mos").innerText = realRes.breakdown.Pon_MOS.toFixed(2) + " W";
        document.getElementById("res_psw_mos").innerText = realRes.breakdown.Psw_MOS.toFixed(2) + " W";
        document.getElementById("res_pcoss").innerText = realRes.breakdown.Pcoss.toFixed(2) + " W";
        document.getElementById("res_pdiode_cond").innerText = realRes.breakdown.Pdiode_cond.toFixed(2) + " W";
        document.getElementById("res_pdiode_rr").innerText = realRes.breakdown.Pdiode_rr.toFixed(2) + " W";
        document.getElementById("res_ptr_dcr").innerText = realRes.breakdown.Ptr_dcr.toFixed(2) + " W";
        document.getElementById("res_pl_dcr").innerText = realRes.breakdown.Pl_dcr.toFixed(2) + " W";
        document.getElementById("res_pcout").innerText = realRes.breakdown.Pcout.toFixed(2) + " W";
        document.getElementById("res_pgate").innerText = realRes.breakdown.Pgate.toFixed(2) + " W";
        document.getElementById("res_pic").innerText = realRes.breakdown.Pic.toFixed(2) + " W";
        document.getElementById("res_ptotal").innerText = realRes.totalLossW.toFixed(2) + " W";
        document.getElementById("res_peff").innerText = realRes.efficiencyPercent.toFixed(2) + " %";

        var loss = Math.abs(100 - finalKullanilacakVerim);
        document.getElementById('loss').innerText = loss.toFixed(2);
    }

    window.currentEfficiency = finalKullanilacakVerim;

    var Pin = (Pa / (finalKullanilacakVerim / 100));
    var iin = Pin / Ue_nom;

    document.getElementById('f').innerText = f_hz.toFixed(2);
    document.getElementById('lOutput').innerText = lOutput.toFixed(2);
    document.getElementById('cOutput').innerText = cOutput.toFixed(2);
    document.getElementById('rOutput').innerText = rOutput.toFixed(2);
    document.getElementById('deltaILMax').innerText = deltaILMax.toFixed(2);
    document.getElementById('nOutput').innerText = nOutput.toFixed(2);
    document.getElementById('wmax1').innerText = wmax1.toFixed(2);
    document.getElementById('vin1').innerText = Ue_nom.toFixed(2);
    document.getElementById('VeOpt').innerText = VeOpt.toFixed(2);
    document.getElementById('iin').innerText = iin.toFixed(2);

    var wf = generateAllWaveforms(Ue_nom, vout, ilout, nOutput, t1, f_hz, L_H, dIL_actual, mode);
    drawCharts(wf, ilout, effData);
    updateResultTable(wf);
}

// ================================================================
// WAVEFORM GENERATOR
// ================================================================
function generateAllWaveforms(Ue, vout, ilout, nOutput, t1_s, f_hz, L_H, deltaIL, mode) {
    var T = 1.0 / f_hz;
    var Uf = 0.7;
    var V3_on = (Ue / nOutput) - Uf;

    var labels = [], v1 = [], iin = [], v3 = [], il = [];
    var PTS = 150;

    function addSeg(start_t, end_t, v1_val, iin_start, iin_end, v3_start, v3_end, il_start, il_end, osc) {
        var pts = Math.max(10, Math.round(PTS * (end_t - start_t) / T));
        for (var k = 1; k <= pts; k++) {
            var frac = k / pts;
            var t = start_t + frac * (end_t - start_t);
            labels.push((t * 1e6).toFixed(2));
            v1.push(v1_val);
            iin.push(iin_start + frac * (iin_end - iin_start));

            if (osc) {
                var decay = Math.exp(-20 * frac);
                var wave = Math.cos(2 * Math.PI * 4 * frac);
                v3.push(vout * (1 - decay * wave));
            } else {
                v3.push(v3_start + frac * (v3_end - v3_start));
            }
            il.push(il_start + frac * (il_end - il_start));
        }
    }

    for (var cycle = 0; cycle < 2; cycle++) {
        var t0 = cycle * T;

        if (cycle === 0) {
            labels.push("0.00");
            v1.push(Ue);
            iin.push(mode === "continuous" ? (ilout - deltaIL / 2) / nOutput : 0);
            v3.push(V3_on);
            il.push(mode === "continuous" ? Math.max(0, ilout - deltaIL / 2) : 0);
        }

        if (mode === "continuous") {
            var iin_base = (ilout - deltaIL / 2) / nOutput;
            var iin_peak = (ilout + deltaIL / 2) / nOutput;
            addSeg(t0, t0 + t1_s, Ue, iin_base, iin_peak, V3_on, V3_on, ilout - deltaIL / 2, ilout + deltaIL / 2, false);

            var il_at_2t1 = ilout + deltaIL / 2 - deltaIL * (t1_s / (T - t1_s));
            addSeg(t0 + t1_s, t0 + 2 * t1_s, -Ue, 0, 0, 0, 0, ilout + deltaIL / 2, il_at_2t1, false);

            addSeg(t0 + 2 * t1_s, t0 + T, 0, 0, 0, 0, 0, il_at_2t1, ilout - deltaIL / 2, false);

        } else {
            var Iin_peak_dc = deltaIL / nOutput;
            var t2 = t1_s + (deltaIL * L_H / vout);
            if (t2 > T) t2 = T * 0.95;
            var t_demag_end = 2 * t1_s;

            addSeg(t0, t0 + t1_s, Ue, 0, Iin_peak_dc, V3_on, V3_on, 0, deltaIL, false);

            if (t2 > t_demag_end) {
                var il_at_demag = deltaIL - deltaIL * (t1_s / (t2 - t1_s));
                addSeg(t0 + t1_s, t0 + t_demag_end, -Ue, 0, 0, 0, 0, deltaIL, il_at_demag, false);
                addSeg(t0 + t_demag_end, t0 + t2, 0, 0, 0, 0, 0, il_at_demag, 0, false);
                addSeg(t0 + t2, t0 + T, 0, 0, 0, vout, vout, 0, 0, true);
            } else {
                addSeg(t0 + t1_s, t0 + t2, -Ue, 0, 0, 0, 0, deltaIL, 0, false);
                addSeg(t0 + t2, t0 + t_demag_end, -Ue, 0, 0, vout, vout, 0, 0, true);
                addSeg(t0 + t_demag_end, t0 + T, 0, 0, 0, vout, vout, 0, 0, false);
            }
        }
    }

    return { labels: labels, v1: v1, v3: v3, iin: iin, il: il };
}

// ================================================================
// CHARTS
// ================================================================
function drawCharts(wf, ilout, effData) {
    var N = wf.labels.length;
    var tickStep = Math.max(1, Math.floor(N / 8));
    var textColor = '#e0e0e0';
    var gridColor = 'rgba(255, 255, 255, 0.1)';
    var refLineColor = 'rgba(255, 255, 255, 0.5)';

    function baseOpts(yTitle, stepped) {
        return {
            responsive: true, animation: false,
            elements: { point: { radius: 0 }, line: { tension: 0, stepped: stepped || false } },
            scales: {
                x: { type: 'category', ticks: { color: textColor, maxTicksLimit: 9, callback: function (val, idx) { return (idx % tickStep === 0) ? wf.labels[idx] + "µs" : ''; } }, title: { display: true, text: 'Time (µs)', color: textColor }, grid: { color: gridColor, borderColor: gridColor } },
                y: { title: { display: true, text: yTitle, color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }
            },
            plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } }
        };
    }

    function mk(id, datasets, yTitle, stepped) {
        var canvas = document.getElementById(id);
        if (!canvas) return;
        if (canvas.chart) { canvas.chart.destroy(); canvas.chart = null; }
        canvas.chart = new Chart(canvas.getContext('2d'), { type: 'line', data: { labels: wf.labels, datasets: datasets }, options: baseOpts(yTitle, stepped) });
    }

    mk('vinChart', [
        { label: 'V1 (Trafo Pri)', data: wf.v1, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false }
    ], 'Voltage (V)');

    mk('v3Chart', [
        { label: 'V3', data: wf.v3, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: false }
    ], 'Voltage (V)');

    mk('idChart', [
        { label: 'I1 (Primer)', data: wf.iin, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, fill: false }
    ], 'Current (A)');

    mk('ilChart', [
        { label: 'IL (Bobin)', data: wf.il, borderColor: 'rgba(105, 240, 174, 1)', borderWidth: 2, fill: false },
        { label: 'Iout', data: Array(N).fill(ilout), borderColor: refLineColor, borderWidth: 1.5, borderDash: [7, 4], fill: false, pointRadius: 0 }
    ], 'Current (A)');

    var effCanvas = document.getElementById('effChart');
    if (effCanvas) {
        if (effCanvas.chart) { effCanvas.chart.destroy(); effCanvas.chart = null; }
        effCanvas.chart = new Chart(effCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: effData.labels,
                datasets: [{
                    label: 'Efficiency vs Load',
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
            options: { responsive: true, animation: false, scales: { x: { title: { display: true, text: 'Load (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }, y: { min: 0, max: 100, title: { display: true, text: 'Efficiency (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } } }, plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } } }
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
        row.insertCell(0).innerHTML = wf.labels[idx] + " µs";
        row.insertCell(1).innerHTML = (wf.v1[idx] || 0).toFixed(2) + " V";
        row.insertCell(2).innerHTML = (wf.v3[idx] || 0).toFixed(2) + " V";
        row.insertCell(3).innerHTML = (wf.iin[idx] || 0).toFixed(2) + " A";
        row.insertCell(4).innerHTML = (wf.il[idx] || 0).toFixed(2) + " A";
    }
}

function printPage() { window.print(); }

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
// CIRCUITJS (FALSTAD) SINGLE TRANSISTOR FORWARD ENTEGRASYONU
// ================================================================

function openFalstadSingleSimulation() {
    var vin_nom = parseFloat(document.getElementById('vin_nom').value) || 400;
    var vout = parseFloat(document.getElementById('vout').value) || 24;
    var ilout = parseFloat(document.getElementById('ilout').value) || 10;
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;

    var l_uH = parseFloat(document.getElementById('lOutput').innerText) || 70.7;
    var c_uF = parseFloat(document.getElementById('cOutput').innerText) || 1145;
    var r_load = parseFloat(document.getElementById('rOutput').innerText) || 2.4;
    var nOutput = parseFloat(document.getElementById('nOutput').innerText) || 6.92;

    document.getElementById("simulationContainer").style.display = "block";
    document.getElementById("liveDataBox").style.display = "block";
    document.getElementById("liveDataBox").innerHTML = "Fitcore SMPS Designer: SINGLE TRANSISTOR FORWARD Converter";

    if (document.getElementById("simulationContainer").scrollIntoView) {
        document.getElementById("simulationContainer").scrollIntoView({ behavior: 'smooth' });
    }

    var Uf = 0.7;
    var freq_hz = f_khz * 1000;
    var l_henry = l_uH * 1e-6;
    var c_farad = c_uF * 1e-6;

    var sim_timestep = 1.0 / (freq_hz * 50);
    var timestep_str = sim_timestep.toExponential(2).toUpperCase();

    var ratio = 1.0 / nOutput;
    var l_pri = 0.004;

    var leakage_fraction = 0.025;
    var coupling = Math.sqrt(1 - leakage_fraction).toFixed(4);
    var l_leakage = l_pri * leakage_fraction;
    var c_snub = 2.5e-9;
    var r_snub = Math.round(Math.sqrt(l_leakage / c_snub));

    var duty_ideal = (vout + Uf) * nOutput / vin_nom;
    var l_leakage_sec = l_leakage * (ratio * ratio);

    var duty_drop = (ilout * freq_hz * l_leakage_sec) / (vin_nom * ratio);
    var duty_cycle = duty_ideal + duty_drop;
    duty_cycle = duty_cycle * 1.03;

    if (duty_cycle > 0.49) duty_cycle = 0.49;
    if (duty_cycle < 0.05) duty_cycle = 0.05;

    var v_gate_max = 15;
    var v_amp = v_gate_max / 2;
    var v_offset = v_amp;

    var v_init = vout;
    var vscale_in = Math.max(50, Math.ceil(vin_nom / 50) * 50);
    var vscale_out = Math.max(5, Math.ceil((vout + 5) / 5) * 5);
    var iscale = Math.max(0.5, Math.ceil(ilout * 1.5 * 10) / 10);
    var vscale_ds = Math.max(50, Math.ceil(vin_nom * 2.5 / 50) * 50);

    var falstadTemplate = `
$ 1 {TIMESTEP} 10.0 50 5.0 50
T 240 192 336 256 0 {L_PRI} {RATIO} {COUPLING} 48
T 144 192 80 128 4 {L_PRI} 1 0.999 64
d 80 384 80 256 1 {UF}
f 192 320 240 320 32 1.5 0.02
d 336 192 448 192 1 {UF}
d 448 272 448 192 1 {UF}
d 160 384 160 192 1 {UF}
l 448 192 544 192 0 {L_VAL} 0
c 544 192 544 272 0 {C_VAL} {V_INIT}
r 608 192 608 272 0 {R_VAL}
v 48 384 48 128 0 0 40 {VIN} 0 0 0.5
R 192 320 208 256 0 2 {FREQ} {V_AMP} {V_OFFSET} 0 {DUTY}
r 288 304 288 352 0 {R_SNUB}
c 288 352 288 384 0 {C_SNUB} 0
g 80 384 80 400 0
g 160 384 160 400 0
g 336 272 336 288 0
w 336 256 336 272 0
w 336 272 448 272 0
w 448 272 544 272 0
w 544 192 608 192 0
w 544 272 608 272 0
w 240 256 240 304 0
w 240 336 240 384 0
w 160 384 240 384 0
w 48 128 80 128 0
w 80 128 80 192 0
w 240 192 240 128 0
w 240 128 176 128 0
w 48 384 80 384 0
w 80 128 176 128 0
w 144 192 160 192 0
w 144 256 176 256 0
w 176 256 176 128 0
w 240 304 288 304 0
w 288 384 240 384 0
o 10 1 0 34 {VSCALE_IN} 0.05 0 -1
o 9 1 0 34 {VSCALE_OUT} 0.05 1 -1
o 7 1 0 33 {ISCALE_OUT} 0.1 2 -1
o 3 1 0 34 {VSCALE_DS} 0.05 3 -1
o 9 1 0 33 {ISCALE_OUT} 0.1 4 -1
`.trim();

    var circuitString = falstadTemplate
        .replace('{TIMESTEP}', timestep_str)
        .replace('{VIN}', vin_nom)
        .replace(/{UF}/g, Uf)
        .replace(/{L_PRI}/g, l_pri)
        .replace('{RATIO}', ratio)
        .replace('{COUPLING}', coupling)
        .replace('{L_VAL}', l_henry)
        .replace('{C_VAL}', c_farad)
        .replace('{V_INIT}', v_init)
        .replace('{R_VAL}', r_load)
        .replace('{FREQ}', freq_hz)
        .replace(/{V_AMP}/g, v_amp)
        .replace(/{V_OFFSET}/g, v_offset)
        .replace('{DUTY}', duty_cycle)
        .replace('{R_SNUB}', r_snub)
        .replace('{C_SNUB}', c_snub)
        .replace(/{VSCALE_IN}/g, vscale_in)
        .replace(/{VSCALE_OUT}/g, vscale_out)
        .replace(/{VSCALE_DS}/g, vscale_ds)
        .replace(/{ISCALE_OUT}/g, iscale);

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
// CENTRAL TABLE & MODAL INTEGRATION (FIXED VERSION)
// ================================================================
window.openSelectedTable = function () {
    const modeElement = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeElement ? modeElement.value : "standard";

    var lOutputStr = document.getElementById('lOutput')?.innerText;
    var wmax1Str = document.getElementById('wmax1')?.innerText;
    var veOptStr = document.getElementById('VeOpt')?.innerText;

    if (!lOutputStr || isNaN(parseFloat(lOutputStr)) || !veOptStr || isNaN(parseFloat(veOptStr))) {
        alert(window.getT ? window.getT('adv_alert_calc_first') : "Lütfen önce hesaplama yapın!");
        return;
    }

    var f_hz = parseFloat(document.getElementById('f')?.innerText) || (parseFloat(document.getElementById('f_khz').value) * 1000);
    var nOutput = parseFloat(document.getElementById('nOutput')?.innerText) || 1;
    var deltaILMax = parseFloat(document.getElementById('deltaILMax')?.innerText) || 0;
    var ilout = parseFloat(document.getElementById('ilout')?.value) || 10;

    var eff_decimal = (window.currentEfficiency || 80) / 100;
    var f_khz = f_hz / 1000;
    var J = MagneticUtils.getCurrentDensity(f_khz);

    var D_max = 0.5;
    var i2_rms = ilout * Math.sqrt(D_max);
    var i1_rms = ((ilout / nOutput) * Math.sqrt(D_max)) / eff_decimal;
    var coil_irms = Math.sqrt(Math.pow(ilout, 2) + Math.pow(deltaILMax, 2) / 12);

    window.A1_req = i1_rms / J;
    window.A2_req = i2_rms / J;
    window.A_coil_req = coil_irms / J;
    window.il_rms = coil_irms;

    if (mode === "advanced") {
        if (typeof window.openAdvancedTable === "function") {
            window.openAdvancedTable();
        } else {
            alert("Advanced modül yüklenemedi.");
        }
        return;
    }

    var L_H = parseFloat(lOutputStr) * 1e-6;
    var Wmax = parseFloat(wmax1Str);
    var VeOpt = parseFloat(veOptStr);
    var vin1 = parseFloat(document.getElementById('vin1')?.innerText) || 400;
    var Imax = ilout + (deltaILMax / 2);
    var max_litz = 2 * (65.6 / Math.sqrt(f_hz));

    var trafoParams = {
        title: window.getT ? window.getT('btn_transformer') : "Transformer Data",
        VeOpt: VeOpt,
        f_hz: f_hz,
        vin1: vin1,
        nOutput: nOutput,
        I1_rms_sq: i1_rms * i1_rms,
        I2_rms_sq: i2_rms * i2_rms,
        d1_req: 2 * Math.sqrt((i1_rms / J) / Math.PI),
        d2_req: 2 * Math.sqrt((i2_rms / J) / Math.PI),
        max_litz: max_litz
    };

    var coilParams = {
        title: window.getT ? window.getT('btn_coil') : "Coil Data",
        L_H: L_H,
        L_uH: L_H * 1e6,
        Wmax: Wmax,
        Imax: Imax,
        Irms_sq: coil_irms * coil_irms,
        d_wire_default: 2 * Math.sqrt((coil_irms / J) / Math.PI),
        min_area: coil_irms / J,
        max_litz: max_litz
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

document.getElementById('calculateButton').addEventListener('click', function () { updateChartsAndTable(); });