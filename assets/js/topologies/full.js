// ================================================================
// Full-Bridge Push-Pull Converter
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

// ================================================================
// helpers
// ================================================================
function runde(x) {
    if (x < 0) return "Hata!";
    if (x === 0) return 0;
    if (x < 0.1) {
        var ri = 0;
        do { x *= 10; ri++; } while (x < 1 || ri % 3 !== 0);
        x = Math.round(1e3 * x) / 1e3;
        return x.toString().substring(0, 5) + "E-" + ri;
    }
    return Math.round(100 * x) / 100;
}

// ================================================================
// INPUT VALIDATION / DEFAULTS
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
    if (isNaN(vout) || vout <= 0) vout = 60.0;
    if (isNaN(ilout) || ilout <= 0) ilout = 20.0;
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
    document.getElementById('vout').value = 60;
    document.getElementById('ilout').value = 20;
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
        Vd1: parseFloat(document.getElementById('p_vd1').value) || 1.4,
        Vd2: parseFloat(document.getElementById('p_vd2').value) || 1.4,
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
    if (D > 0.95) D = 0.95;
    if (D < 0) D = 0;

    var Ipri_rms = (iout / nOutput) * Math.sqrt(D);
    var Ipri_pk = (iout + deltaIL / 2) / nOutput;

    var V_stress = vin;

    var Pon_MOS = 2 * (Math.pow(Ipri_rms, 2) * p.Ron);

    var Psw_MOS = 4 * (0.5 * V_stress * Ipri_pk * (p.tr + p.tf) * f_sw_hz);
    var Pcoss = 4 * (0.5 * p.Coss * Math.pow(V_stress, 2) * f_sw_hz);

    var Pdiode_cond = iout * D * p.Vd1 + iout * (1 - D) * p.Vd2;
    var Pdiode_rr = 0.5 * Vsec * p.Irr * p.trr * f_sw_hz * 2;

    var Iout_rms_sq = Math.pow(iout, 2) + Math.pow(deltaIL, 2) / 12;
    var Pl_dcr = Iout_rms_sq * p.DCR_ind;
    var Ptr_dcr = Math.pow(Ipri_rms, 2) * p.DCR_pri + Math.pow(iout * Math.sqrt(D), 2) * p.DCR_sec;

    var Icout_rms = deltaIL / (2 * Math.sqrt(3));
    var Pcout = Math.pow(Icout_rms, 2) * p.ESR_Cout;

    var Pgate = 4 * (p.Qg * p.Vgs * f_sw_hz);
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
    var mode = document.getElementById("mode").value;
    var verim = parseFloat(document.getElementById('verim').value);
    var effMode = document.getElementById("effMode").value;

    var Uf = 1.4;
    var f_hz = f_khz * 1000;
    var fScale = f_khz * 2000;
    var T = 1.0 / f_hz;

    var rOutput = vout / ilout;

    var nOutput = vin_min * 0.95 / (vout + Uf);

    var Ue_max = vin_max;
    var nUe_max = Ue_max / nOutput - Uf;
    var deltaILMax = 0.4 * ilout;
    var t1_max = (vout + Uf) / (fScale * (nUe_max + Uf));
    var L_H = t1_max * (nUe_max - vout) / deltaILMax;

    var Ue_nom = vin_nom;
    var nUe_nom = Ue_nom / nOutput - Uf;
    var t1_nom = (vout + Uf) / (fScale * (nUe_nom + Uf));

    var actual_deltaIL = (nUe_nom - vout) * t1_nom / L_H;

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
        Imax = (dIL_actual <= 2 * ilout) ? ilout + 0.5 * dIL_actual : dIL_actual;
    } else {
        t1 = Math.sqrt((ilout * L_H) / ((fScale / 2) * (nUe_nom - vout) * (nUe_nom + Uf) / (vout + Uf)));
        dIL_actual = (nUe_nom - vout) * t1 / L_H;
        Imax = dIL_actual;
    }

    var Vripple = vout * 0.01;
    var cOutput = dIL_actual / (8 * f_hz * Vripple) * 1e6;

    var lOutput = L_H * 1e6;
    var wmax1 = 0.5 * L_H * Imax * Imax * 1e6;

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
        document.getElementById('loss').innerText = loss.toFixed(2);
    }

    var iPa = ilout * (vout + Uf);
    var Pa = iPa / (finalKullanilacakVerim / 100);
    var VeOpt = 52000 * Math.pow(Pa / 800, 1.2) * Math.sqrt(50000 / f_hz);

    window.currentEfficiency = finalKullanilacakVerim;

    var Pin = Pa;
    var iin = Pin / Ue_nom;

    var J = MagneticUtils.getCurrentDensity(f_khz);

    var D_max_total = 2 * (vout + Uf) / ((vin_min / nOutput - Uf) + Uf);
    if (D_max_total > 0.95) D_max_total = 0.95;

    var Irms_sec = ilout * Math.sqrt(D_max_total);
    var Irms_pri = ((ilout / nOutput) / (finalKullanilacakVerim / 100)) * Math.sqrt(D_max_total);

    var skin_depth_mm = 65.6 / Math.sqrt(f_hz);
    var max_wire_d_mm = 2 * skin_depth_mm;

    var A1_req = Irms_pri / J;
    var d1_req = 2 * Math.sqrt(A1_req / Math.PI);
    var A2_req = Irms_sec / J;
    var d2_req = 2 * Math.sqrt(A2_req / Math.PI);

    var il_rms = Math.sqrt(Math.pow(ilout, 2) + Math.pow(dIL_actual, 2) / 12);
    var A_coil_req = il_rms / J;
    var d_coil_req = 2 * Math.sqrt(A_coil_req / Math.PI);

    // Global assignments (for SPA module)
    window.lOutput_global = lOutput;
    window.wmax1_global = wmax1;
    window.Imax_global = Imax;
    window.il_rms = il_rms;
    window.i1_rms_global = Irms_pri;
    window.i2_rms_global = Irms_sec;
    window.A1_req = A1_req;
    window.A2_req = A2_req;
    window.A_coil_req = A_coil_req;
    window.d1_req = d1_req;
    window.d2_req = d2_req;
    window.d_coil_req = d_coil_req;
    window.max_wire_d_mm = max_wire_d_mm;

    document.getElementById('f').innerText = f_hz.toFixed(2);
    document.getElementById('lOutput').innerText = lOutput.toFixed(2);
    document.getElementById('cOutput').innerText = cOutput.toFixed(2);
    document.getElementById('rOutput').innerText = rOutput.toFixed(2);
    document.getElementById('deltaILMax').innerText = deltaILMax.toFixed(2);
    document.getElementById('nOutput').innerText = nOutput.toFixed(2);
    document.getElementById('wmax1').innerText = wmax1.toFixed(2);

    var vin1El = document.getElementById('vin1');
    if (vin1El) vin1El.innerText = Ue_nom.toFixed(2);

    document.getElementById('VeOpt').innerText = VeOpt.toFixed(2);
    document.getElementById('iin').innerText = iin.toFixed(2);

    var wf = generateAllWaveforms(Ue_nom, vout, ilout, nOutput, t1, f_hz, L_H, dIL_actual, mode);

    drawCharts(wf, ilout, effData);
    updateResultTable(wf);
}

// ================================================================
// WAVEFORM GENERATOR
// ================================================================
function generateAllWaveforms(Ue_nom, vout, ilout, nOutput, t1_s, f_hz, L_H, deltaIL, mode) {
    var T = 1.0 / f_hz;
    var T_half = T / 2.0;
    var Uf = 1.4;

    var V1_pos = Ue_nom;
    var V1_neg = -Ue_nom;
    var V3_on = (Ue_nom / nOutput) - Uf;

    var t_on = t1_s;
    var t_dead = T_half - t_on;
    if (t_dead < 0) t_dead = 0;

    var slope_on = (V3_on - vout) / L_H;
    var slope_off = -vout / L_H;

    var IL_min = Math.max(0, ilout - 0.5 * deltaIL);
    var IL_max = ilout + 0.5 * deltaIL;

    var Iin_base = IL_min / nOutput;
    var Iin_peak = IL_max / nOutput;

    var PTS = 100;
    var labels = [], v1 = [], iin = [], v3 = [], il = [];

    function addSeg(start_t, end_t, v1_val, iin_start, iin_end, v3_start, v3_end, il_start, il_end, osc) {
        var pts = Math.max(5, Math.round(PTS * (end_t - start_t) / T_half));
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
            v1.push(Ue_nom);
            iin.push(mode === "continuous" ? (ilout - deltaIL / 2) / nOutput : 0);
            v3.push(V3_on);
            il.push(mode === "continuous" ? Math.max(0, ilout - deltaIL / 2) : 0);
        }

        for (var half = 0; half < 2; half++) {
            var t_start = t0 + half * T_half;
            var v1_pulse = (half === 0) ? V1_pos : V1_neg;

            if (mode === "continuous") {
                var iin_base_c = (ilout - deltaIL / 2) / nOutput;
                var iin_peak_c = (ilout + deltaIL / 2) / nOutput;

                addSeg(t_start, t_start + t1_s, v1_pulse, iin_base_c, iin_peak_c, V3_on, V3_on, ilout - deltaIL / 2, ilout + deltaIL / 2, false);
                addSeg(t_start + t1_s, t_start + T_half, 0, 0, 0, 0, 0, ilout + deltaIL / 2, ilout - deltaIL / 2, false);

            } else {
                var Iin_peak_dc = deltaIL / nOutput;
                var t2 = deltaIL * L_H / vout;
                var t_dead_c = T_half - t1_s;
                if (t2 > t_dead_c) t2 = t_dead_c * 0.95;

                addSeg(t_start, t_start + t1_s, v1_pulse, 0, Iin_peak_dc, V3_on, V3_on, 0, deltaIL, false);
                addSeg(t_start + t1_s, t_start + t1_s + t2, 0, 0, 0, 0, 0, deltaIL, 0, false);
                addSeg(t_start + t1_s + t2, t_start + T_half, 0, 0, 0, vout, vout, 0, 0, true);
            }
        }
    }

    return { labels: labels, v1: v1, iin: iin, v3: v3, il: il };
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

    mk('vinChart', [{ label: 'V1', data: wf.v1, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false, stepped: 'before' }], 'Voltage (V)');
    mk('idChart', [{ label: 'Iin', data: wf.iin, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, fill: false }], 'Current (A)');
    mk('vdsChart', [{ label: 'V3', data: wf.v3, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: false }], 'Voltage (V)');
    mk('ilChart', [
        { label: 'IL', data: wf.il, borderColor: 'rgba(105, 240, 174, 1)', borderWidth: 2, fill: false },
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
                    label: 'Efficiency vs Load', data: effData.values, borderColor: 'rgba(129, 199, 132, 1)', backgroundColor: 'rgba(129, 199, 132, 0.15)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: 'rgba(129, 199, 132, 1)'
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

function downloadTableAsPDF() {
    var table = document.getElementById('resultTable');
    var html = table.outerHTML;
    var blob = new Blob([html], { type: "application/vnd.ms-excel" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'tablo.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ================================================================
// CENTRAL TABLE & MODAL INTEGRATION
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
    var VeOpt = parseFloat(veOptStr);

    var vin1 = parseFloat(document.getElementById('vin_min')?.value) || 360;

    var f_hz = parseFloat(document.getElementById('f')?.innerText) || 50000;
    var nOutput = parseFloat(document.getElementById('nOutput')?.innerText) || 1;
    var Imax = window.Imax_global;

    var trafoParams = {
        title: window.getT ? window.getT('btn_transformer') : "Transformer Data",
        topology: 'full_bridge',
        VeOpt: VeOpt,
        f_hz: f_hz,
        vin_min: vin1,
        vin1: parseFloat(document.getElementById('vin_nom')?.value) || 400,
        nOutput: nOutput,
        I1_rms_sq: window.i1_rms_global * window.i1_rms_global,
        I2_rms_sq: window.i2_rms_global * window.i2_rms_global,
        d1_req: window.d1_req,
        d2_req: window.d2_req,
        max_litz: window.max_wire_d_mm
    };

    var coilParams = {
        title: window.getT ? window.getT('btn_coil') : "Coil Data",
        L_H: L_H,
        L_uH: window.lOutput_global,
        Wmax: Wmax,
        Imax: Imax,
        Irms_sq: window.il_rms * window.il_rms,
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

function hesapla() {
    if (!checkUserInput()) { setDefaultValues(); }
    updateChartsAndTable();
    if (typeof window.openSelectedTable === "function") {
        window.openSelectedTable();
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
// CIRCUITJS (FALSTAD) FULL-BRIDGE PUSH-PULL
// ================================================================

function openFalstadFullSimulation() {
    var vin_nom = parseFloat(document.getElementById('vin_nom').value) || 400;
    var vout = parseFloat(document.getElementById('vout').value) || 60;
    var ilout = parseFloat(document.getElementById('ilout').value) || 10;
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 50;

    var l_uH = parseFloat(document.getElementById('lOutput').innerText) || 70.7;
    var c_uF = parseFloat(document.getElementById('cOutput').innerText) || 1145;
    var r_load = parseFloat(document.getElementById('rOutput').innerText) || 6.0;
    var nOutput = parseFloat(document.getElementById('nOutput').innerText) || 3.16;

    document.getElementById("simulationContainer").style.display = "block";
    document.getElementById("liveDataBox").style.display = "block";
    document.getElementById("liveDataBox").innerHTML = "Fitcore SMPS Designer: FULL-BRIDGE Converter Simulation";

    if (document.getElementById("simulationContainer").scrollIntoView) {
        document.getElementById("simulationContainer").scrollIntoView({ behavior: 'smooth' });
    }

    var Uf2 = 0.7;
    var freq_hz = f_khz * 1000;
    var l_henry = l_uH * 1e-6;
    var c_farad = c_uF * 1e-6;

    var sim_timestep = 1.0 / (freq_hz * 100);
    var timestep_str = sim_timestep.toExponential(2).toUpperCase();

    var ratio = 1.0 / nOutput;
    var l_pri = 0.0005;

    var leakage_fraction = 0.025;
    var coupling = Math.sqrt(1 - leakage_fraction).toFixed(4);
    var l_leakage = l_pri * leakage_fraction;
    var c_snub = 2.5e-9;
    var r_snub = Math.round(Math.sqrt(l_leakage / c_snub));
    if (r_snub < 10) r_snub = 10;

    var duty_ideal = ((vout + Uf2) * nOutput) / (2.0 * vin_nom);

    var falstad_loss_factor = 1.05;
    var duty_cycle = duty_ideal * falstad_loss_factor;

    if (duty_cycle > 0.485) duty_cycle = 0.485;
    if (duty_cycle < 0.05) duty_cycle = 0.05;

    var v_gate_max = 29;
    var v_amp = v_gate_max / 2;
    var v_offset = v_amp;
    var pi = Math.PI;

    var v_init = vout * 0.98;
    var i_init = vout / r_load;

    var i_pri_peak = ilout / nOutput;

    var vscale_in = Math.max(50, Math.ceil(vin_nom / 50) * 50);
    var vscale_out = Math.max(5, Math.ceil((vout + 5) / 5) * 5);
    var iscale = Math.max(0.5, Math.ceil(ilout * 1.5 * 10) / 10);
    var iscale_in = Math.max(0.5, Math.ceil(i_pri_peak * 1.5 * 10) / 10);
    var vscale_ds = Math.max(50, Math.ceil(vin_nom / 50) * 50);
    var vscale_pri = Math.max(50, Math.ceil(vin_nom / 50) * 50);

    var falstadTemplate = `
$ 1 {TIMESTEP} 100 60 5.0 50
T 256 192 400 256 0 {L_PRI} {RATIO} {COUPLING} 64
f 64 304 112 304 32 1.5 0.020
d 432 256 432 128 1 {UF}
l 432 128 496 128 0 {L_VAL} {I_INIT}
c 496 128 496 320 0 {C_VAL} {V_INIT}
r 560 128 560 320 0 {R_VAL}
v 16 352 16 128 0 0 40 {VIN} 0 0 0.5
w 384 272 384 320 0
w 400 256 432 256 0
w 432 320 496 320 0
w 496 128 560 128 0
w 496 320 560 320 0
w 256 320 256 352 0
w 16 128 48 128 0
w 256 128 112 128 0
w 48 128 112 128 0
g 384 320 384 336 0
d 400 192 400 128 1 {UF}
f 64 176 112 176 32 1.5 0.020
w 112 160 112 128 0
w 16 352 112 352 0
w 112 352 256 352 0
g 16 352 16 368 0
v 48 240 64 176 0 2 {FREQ} {V_AMP} {V_OFFSET} 0 {DUTY}
w 112 240 112 288 0
v 48 304 64 304 0 2 {FREQ} {V_AMP} {V_OFFSET} {PI} {DUTY}
r 48 240 112 240 0 10
r 48 304 16 352 0 10
w 144 192 112 192 0
d 384 272 400 192 1 {UF}
d 432 320 432 256 1 {UF}
w 112 352 112 320 0
w 112 192 112 240 0
w 432 128 400 128 0
w 384 320 432 320 0
w 112 128 128 128 0
c 128 128 128 160 0 {C_SNUB} 0
r 128 160 112 192 0 {R_SNUB}
w 112 240 128 240 0
c 128 240 128 288 0 {C_SNUB} 0
r 128 288 128 320 0 {R_SNUB}
w 128 320 112 320 0
r 192 304 112 352 0 10
v 192 304 208 304 0 2 {FREQ} {V_AMP} {V_OFFSET} 0 {DUTY}
f 208 304 256 304 32 1.5 0.020
w 208 256 256 288 0
r 176 176 208 256 0 10
v 176 176 208 144 0 2 {FREQ} {V_AMP} {V_OFFSET} {PI} {DUTY}
f 208 144 256 144 32 1.5 0.020
w 144 192 256 192 0
w 208 256 256 256 0
w 208 256 256 160 0
o 6 1 0 34 {VSCALE_IN}  0.05 0 -1
o 4 1 0 34 {VSCALE_OUT} 0.05 1 -1
o 3 1 0 33 {ISCALE_OUT} 0.1  2 -1
o 6 1 0 33 {ISCALE_IN} 0.05 3 -1
o 1 1 0 34 {VSCALE_DS}  0.05 4 -1
o 0 1 0 34 {VSCALE_PRI} 0.05 5 -1`.trim();

    var circuitString = falstadTemplate
        .replace(/{TIMESTEP}/g, timestep_str)
        .replace(/{VIN}/g, vin_nom)
        .replace(/{UF}/g, Uf2)
        .replace(/{L_PRI}/g, l_pri)
        .replace(/{RATIO}/g, ratio)
        .replace(/{COUPLING}/g, coupling)
        .replace(/{L_VAL}/g, l_henry)
        .replace(/{I_INIT}/g, i_init)
        .replace(/{C_VAL}/g, c_farad)
        .replace(/{V_INIT}/g, v_init)
        .replace(/{R_VAL}/g, r_load)
        .replace(/{FREQ}/g, freq_hz)
        .replace(/{V_AMP}/g, v_amp)
        .replace(/{V_OFFSET}/g, v_offset)
        .replace(/{DUTY}/g, duty_cycle)
        .replace(/{C_SNUB}/g, c_snub)
        .replace(/{R_SNUB}/g, r_snub)
        .replace(/{PI}/g, pi)
        .replace(/{VSCALE_IN}/g, vscale_in)
        .replace(/{VSCALE_OUT}/g, vscale_out)
        .replace(/{ISCALE_OUT}/g, iscale)
        .replace(/{ISCALE_IN}/g, iscale_in)
        .replace(/{VSCALE_DS}/g, vscale_ds)
        .replace(/{VSCALE_PRI}/g, vscale_pri);

    if (typeof embedFalstadSimulation === "function") {
        embedFalstadSimulation(circuitString);
    }
}

// ================================================================
// EVENT LISTENERS
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
    const calcBtn = document.getElementById('calculateButton');
    if (calcBtn) calcBtn.addEventListener('click', updateChartsAndTable);

    const printBtn = document.getElementById('printButton');
    if (printBtn) printBtn.addEventListener('click', function () { printPage(); });

    const openBtn = document.getElementById('openButton');
    if (openBtn) openBtn.addEventListener('click', window.openSelectedTable);
});
