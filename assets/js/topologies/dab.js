// ================================================================
// DAB CONVERTER CALCULATOR & OPTIMIZER
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================

window.il_rms = 0;
window.A1_req = 0;
window.A2_req = 0;
window.d1_req = 0;
window.d2_req = 0;
window.max_wire_d_mm = 0;
window.lOutput_global = 0;
window.wmax1_global = 0;
window.Imax_global = 0;
window.VeOpt_global = 0;

// ================================================================
// BASIC DAB CALCULATION FUNCTIONS
// ================================================================
function dabPower(N, V1, V2, phi, Fs, L) {
    return (N * V1 * V2 * phi * (Math.PI - phi)) / (2 * Math.PI * Math.PI * Fs * L);
}

function dabPhiFromPower(N, V1, V2, P, Fs, L) {
    var arg = 1 - (8 * Fs * L * P) / (N * V1 * V2);
    if (arg < 0) arg = 0;
    return (Math.PI / 2) * (1 - Math.sqrt(arg));
}

function dabD(N, V1, V2) { return N * V2 / V1; }
function dabIbase(V1, Fs, L) { return V1 / (2 * Math.PI * Fs * L); }

function dabI1I2(N, V1, V2, phi, Fs, L) {
    var d = dabD(N, V1, V2);
    var Ib = dabIbase(V1, Fs, L);
    var i1 = 0.5 * (2 * phi - (1 - d) * Math.PI) * Ib;
    var i2 = 0.5 * (2 * d * phi + (1 - d) * Math.PI) * Ib;
    return { i1: i1, i2: i2, d: d, Ib: Ib };
}

function zvsCheck(N, V1_min, V1_max, V2_min, V2_max, P, Fs, L) {
    var d_worst_pri = dabD(N, V1_min, V2_max);
    var d_worst_sec = dabD(N, V1_max, V2_min);
    var phi_worst_pri = dabPhiFromPower(N, V1_min, V2_max, P, Fs, L);
    var phi_worst_sec = dabPhiFromPower(N, V1_max, V2_min, P, Fs, L);
    var phi_zvs_pri = (1 - 1 / d_worst_pri) * Math.PI / 2;
    var phi_zvs_sec = (1 - d_worst_sec) * Math.PI / 2;
    var sw_pri = dabI1I2(N, V1_min, V2_max, phi_worst_pri, Fs, L);
    var sw_sec = dabI1I2(N, V1_max, V2_min, phi_worst_sec, Fs, L);
    return {
        zvs_pri_ok: (sw_pri.i1 > 0) && (phi_worst_pri >= phi_zvs_pri),
        zvs_sec_ok: (sw_sec.i2 > 0) && (phi_worst_sec >= phi_zvs_sec),
        i1_worst: sw_pri.i1, i2_worst: sw_sec.i2
    };
}

function dabILrms(i1, i2, phi) {
    var term = (1 / 3) * (i1 * i1 + i2 * i2 + (1 - 2 * phi / Math.PI) * i1 * i2);
    if (term < 0) term = 0;
    return Math.sqrt(term);
}

function calcFastDAB(V1, V2p, d1, d2, phi, omegaL) {
    var steps = 100;
    var d_theta = Math.PI / steps;
    var sum_di = 0;

    for (var i = 0; i < steps; i++) {
        var theta = (i + 0.5) * d_theta;
        var vab = (theta > d1) ? V1 : 0;
        var vcd = 0;
        var t_sec = (theta - phi) % (2 * Math.PI);
        if (t_sec < 0) t_sec += 2 * Math.PI;
        if (t_sec > d2 && t_sec < Math.PI) vcd = V2p;
        else if (t_sec > Math.PI + d2) vcd = -V2p;

        sum_di += (vab - vcd) / omegaL * d_theta;
    }

    var iL_0 = -sum_di / 2;
    var P_avg = 0, Irms_sq = 0;
    var iL = iL_0;
    var i1_sw = iL_0, i2_sw = iL_0;

    for (var i = 0; i <= steps; i++) {
        var theta = i * d_theta;
        if (Math.abs(theta - d1) < d_theta) i1_sw = iL;
        if (Math.abs(theta - phi) < d_theta) i2_sw = iL;
        if (i === steps) break;

        var theta_mid = (i + 0.5) * d_theta;
        var vab = (theta_mid > d1) ? V1 : 0;
        var vcd = 0;
        var t_sec = (theta_mid - phi) % (2 * Math.PI);
        if (t_sec < 0) t_sec += 2 * Math.PI;
        if (t_sec > d2 && t_sec < Math.PI) vcd = V2p;
        else if (t_sec > Math.PI + d2) vcd = -V2p;

        var delta_i = (vab - vcd) / omegaL * d_theta;
        var iL_next = iL + delta_i;

        P_avg += vab * (iL + iL_next) / 2 * d_theta;
        Irms_sq += (iL * iL + iL * iL_next + iL_next * iL_next) / 3 * d_theta;
        iL = iL_next;
    }

    return {
        P: Math.abs(P_avg / Math.PI),
        Irms: Math.sqrt(Irms_sq / Math.PI),
        i1_sw: i1_sw,
        i2_sw: i2_sw
    };
}

function findOptimalModulationFast(V1, V2, N, L, Fs, P_target, mode) {
    var omegaL = 2 * Math.PI * Fs * L;
    var V2p = N * V2;
    var best_d1 = 0, best_d2 = 0, best_phi = 0;
    var min_rms = Infinity;
    var found = false;
    var P_tol = P_target * 0.08;

    if (mode === "sps") {
        var phi = dabPhiFromPower(N, V1, V2, P_target, Fs, L);
        return { d1: 0, d2: 0, phi: isNaN(phi) ? 0 : phi };
    }
    else if (mode === "dps") {
        var steps = 30;
        for (var i = 0; i <= steps; i++) {
            var phi = (i / steps) * (Math.PI / 1.5);
            for (var j = 0; j <= steps; j++) {
                var d = (j / steps) * (Math.PI / 1.5);
                var res = calcFastDAB(V1, V2p, d, d, phi, omegaL);
                if (Math.abs(res.P - P_target) <= P_tol) {
                    if (res.Irms < min_rms) {
                        min_rms = res.Irms;
                        best_phi = phi; best_d1 = d; best_d2 = d;
                        found = true;
                    }
                }
            }
        }
    }
    else if (mode === "tps") {
        var steps = 15;
        for (var i = 0; i <= steps; i++) {
            var phi = (i / steps) * (Math.PI / 1.5);
            for (var j = 0; j <= steps; j++) {
                var d1 = (j / steps) * (Math.PI / 1.5);
                for (var k = 0; k <= steps; k++) {
                    var d2 = (k / steps) * (Math.PI / 1.5);
                    var res = calcFastDAB(V1, V2p, d1, d2, phi, omegaL);
                    if (Math.abs(res.P - P_target) <= P_tol) {
                        if (res.Irms < min_rms) {
                            min_rms = res.Irms;
                            best_phi = phi; best_d1 = d1; best_d2 = d2;
                            found = true;
                        }
                    }
                }
            }
        }
    }

    if (!found) {
        var phi = dabPhiFromPower(N, V1, V2, P_target, Fs, L);
        return { d1: 0, d2: 0, phi: isNaN(phi) ? 0 : phi };
    }
    return { d1: best_d1, d2: best_d2, phi: best_phi };
}

// ================================================================
// UI & HESAPLAMALAR
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
        document.getElementById("powerLossSection").style.display = "flex";
    }
}

function checkUserInput() {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vout_min = parseFloat(document.getElementById('vout_min').value);
    var vout_max = parseFloat(document.getElementById('vout_max').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    return !isNaN(vin_min) && !isNaN(vin_max) && !isNaN(vout_min) && !isNaN(vout_max) && !isNaN(ilout) && !isNaN(f_khz);
}

function setDefaultValues() {
    document.getElementById('vin_min').value = 380;
    document.getElementById('vin_max').value = 420;
    document.getElementById('vin_nom').value = 400;
    document.getElementById('vout_min').value = 20;
    document.getElementById('vout_max').value = 28;
    document.getElementById('vout_nom').value = 24;
    document.getElementById('ilout').value = 20;
    document.getElementById('f_khz').value = 100;
    document.getElementById('verim').value = 98;
    document.getElementById('mode').value = "sps";
}

function getRealParamsDAB() {
    return {
        Ron_pri: parseFloat(document.getElementById('p_ron_pri').value) || 0.050,
        Ron_sec: parseFloat(document.getElementById('p_ron_sec').value) || 0.010,
        Coss_pri: (parseFloat(document.getElementById('p_coss_pri').value) || 100) * 1e-12,
        Coss_sec: (parseFloat(document.getElementById('p_coss_sec').value) || 250) * 1e-12,
        Qg: (parseFloat(document.getElementById('p_qg').value) || 30) * 1e-9,
        Vgs: parseFloat(document.getElementById('p_vgs').value) || 10.0,
        tr: (parseFloat(document.getElementById('p_tr').value) || 20) * 1e-9,
        tf: (parseFloat(document.getElementById('p_tf').value) || 20) * 1e-9,
        DCR_pri: parseFloat(document.getElementById('p_dcr_pri').value) || 0.050,
        DCR_sec: parseFloat(document.getElementById('p_dcr_sec').value) || 0.005,
        DCR_ind: parseFloat(document.getElementById('p_dcr_ind').value) || 0.020,
        ESR_Cout: parseFloat(document.getElementById('p_esrcout').value) || 0.003,
        Icc: (parseFloat(document.getElementById('p_icc').value) || 5.0) * 1e-3
    };
}

function calculateRealEfficiencyDAB(N, V1, V2, Pout, Fs, L, params, converterMode) {
    var phi = dabPhiFromPower(N, V1, V2, Pout, Fs, L);
    var sw = dabI1I2(N, V1, V2, phi, Fs, L);

    var opt = findOptimalModulationFast(V1, V2, N, L, Fs, Pout, converterMode);
    var exact = calcFastDAB(V1, N * V2, opt.d1, opt.d2, opt.phi, 2 * Math.PI * Fs * L);

    var iL_rms = (converterMode === "sps") ? dabILrms(sw.i1, sw.i2, phi) : exact.Irms;
    var i1_sw = (converterMode === "sps") ? sw.i1 : exact.i1_sw;
    var i2_sw = (converterMode === "sps") ? sw.i2 : exact.i2_sw;

    var i1_rms = iL_rms;
    var i2_rms = iL_rms * N;

    var Pon_pri = 2 * Math.pow(i1_rms, 2) * params.Ron_pri;
    var Pon_sec = 2 * Math.pow(i2_rms, 2) * params.Ron_sec;

    var Ptr_dcr = Math.pow(i1_rms, 2) * params.DCR_pri + Math.pow(i2_rms, 2) * params.DCR_sec;
    var Pl_dcr = Math.pow(iL_rms, 2) * params.DCR_ind;

    var is_zvs_pri = (converterMode === "tps") ? true : (i1_sw > 0);
    var is_zvs_sec = (converterMode === "tps") ? true : (i2_sw > 0);

    var Psw_on_pri = is_zvs_pri ? 0 : 4 * (0.5 * V1 * Math.abs(i1_sw) * params.tr * Fs);
    var Psw_on_sec = is_zvs_sec ? 0 : 4 * (0.5 * V2 * Math.abs(i2_sw) * params.tr * Fs);

    var Psw_off_pri = 4 * (0.5 * V1 * Math.abs(i1_sw) * params.tf * Fs);
    var Psw_off_sec = 4 * (0.5 * V2 * Math.abs(i2_sw) * params.tf * Fs);

    var Psw_pri = Psw_on_pri + Psw_off_pri;
    var Psw_sec = Psw_on_sec + Psw_off_sec;

    var Pcoss_pri = is_zvs_pri ? 0 : 4 * (0.5 * params.Coss_pri * Math.pow(V1, 2) * Fs);
    var Pcoss_sec = is_zvs_sec ? 0 : 4 * (0.5 * params.Coss_sec * Math.pow(V2, 2) * Fs);
    var Pcoss = Pcoss_pri + Pcoss_sec;

    var Pgate = 8 * params.Qg * params.Vgs * Fs;
    var Pic = V1 * params.Icc;

    var Iout = Pout / V2;
    var Pcout = (Math.pow(i2_rms, 2) - Math.pow(Iout, 2)) * params.ESR_Cout;
    if (Pcout < 0) Pcout = 0;

    var Ptotal = Pon_pri + Pon_sec + Ptr_dcr + Pl_dcr + Psw_pri + Psw_sec + Pcoss + Pgate + Pic + Pcout;
    var efficiency = (Pout / (Pout + Ptotal)) * 100;

    return {
        totalLossW: Ptotal,
        efficiencyPercent: Math.max(0, efficiency),
        breakdown: { Pon_pri, Pon_sec, Psw_pri, Psw_sec, Pcoss, Ptr_dcr, Pl_dcr, Pgate, Pic, Pcout }
    };
}

function generateEfficiencyVsPowerCurve(V1, V2, N, L, Fs, pOut_nom, verim_pct, isIdeal, converterMode) {
    var p_arr = [], eff_arr = [];
    var params = isIdeal ? null : getRealParamsDAB();
    for (let percent = 10; percent <= 120; percent += 5) {
        let p = pOut_nom * (percent / 100);
        let phi = dabPhiFromPower(N, V1, V2, p, Fs, L);
        if (isNaN(phi) || phi <= 0) continue;

        if (isIdeal) {
            let eta_nom = verim_pct / 100;
            let phi_opt = Math.PI / 4;
            let k_loss = 0.03;
            let eta_inst = eta_nom - k_loss * Math.pow(phi - phi_opt, 2);
            eta_inst = Math.max(0.80, Math.min(0.999, eta_inst));
            p_arr.push(percent + "%");
            eff_arr.push((eta_inst * 100).toFixed(2));
        } else {
            let res = calculateRealEfficiencyDAB(N, V1, V2, p, Fs, L, params, converterMode);
            p_arr.push(percent + "%");
            eff_arr.push((res.efficiencyPercent).toFixed(2));
        }
    }
    return { labels: p_arr, values: eff_arr };
}

function generateDABWaveforms(V1, V2, N, L, Fs, pOut, converterMode) {
    var Ts = 1 / Fs;

    var opt = findOptimalModulationFast(V1, V2, N, L, Fs, pOut, converterMode);
    var phi = opt.phi;
    var d1 = opt.d1;
    var d2 = opt.d2;

    var t_shift = (phi / (2 * Math.PI)) * Ts;
    var t1_inner = (d1 / (2 * Math.PI)) * Ts;
    var t2_inner = (d2 / (2 * Math.PI)) * Ts;

    var t_arr = [], v1_arr = [], v3_arr = [], il_arr = [], phi_arr = [];
    var t_step = Ts / 200;

    var iL_current = 0;

    for (let i = 0; i <= 400; i++) {
        var t = i * t_step;
        var t_mod = t % Ts;

        var vab = 0;
        var vcd_p = 0;

        if (t_mod < t1_inner) {
            vab = 0;
        } else if (t_mod < Ts / 2) {
            vab = V1;
        } else if (t_mod < Ts / 2 + t1_inner) {
            vab = 0;
        } else {
            vab = -V1;
        }

        if (t_mod < t_shift) {
            vcd_p = (t_mod < t_shift - t2_inner + (Ts / 2) && t_mod > t_shift - (Ts / 2)) ? -(N * V2) : 0;
        } else if (t_mod < t_shift + t2_inner) {
            vcd_p = 0;
        } else if (t_mod < t_shift + Ts / 2) {
            vcd_p = (N * V2);
        } else if (t_mod < t_shift + Ts / 2 + t2_inner) {
            vcd_p = 0;
        } else {
            vcd_p = -(N * V2);
        }

        if (i === 0) {
            iL_current = 0;
        } else {
            var dt = t_step;
            var di = ((vab - vcd_p) / L) * dt;
            iL_current += di;
        }

        t_arr.push((t * 1e6).toFixed(2));
        v1_arr.push(vab);
        v3_arr.push(vcd_p);
        il_arr.push(iL_current);
        phi_arr.push(phi * 180 / Math.PI);
    }

    var sum = 0;
    for (let j = 200; j <= 400; j++) sum += il_arr[j];
    var avg = sum / 201;
    for (let j = 0; j <= 400; j++) il_arr[j] -= avg;

    return { t: t_arr, v1: v1_arr, v3: v3_arr, il: il_arr, phi: phi_arr };
}

function updateChartsAndTable() {
    var vin_min = parseFloat(document.getElementById('vin_min').value);
    var vin_max = parseFloat(document.getElementById('vin_max').value);
    var vout_min = parseFloat(document.getElementById('vout_min').value);
    var vout_max = parseFloat(document.getElementById('vout_max').value);
    var ilout = parseFloat(document.getElementById('ilout').value);
    var f_khz = parseFloat(document.getElementById('f_khz').value);
    var verim = parseFloat(document.getElementById('verim').value);
    var effMode = document.getElementById("effMode").value;
    var converterMode = document.getElementById("mode").value;

    var getT = window.getT || function (k) { return k; };

    var warningDiv = document.getElementById("modeWarning");
    var warnings = [];

    if (f_khz > 200) {
        warnings.push("<strong>⚠️ " + getT("alert_freq_limit_title") + "</strong> " + getT("alert_freq_limit_desc"));
    }

    if (converterMode === "dps") {
        warnings.push("<strong>💡 " + getT("alert_mode_dps_title") + "</strong> " + getT("alert_mode_dps_desc"));
    } else if (converterMode === "sps") {
        warnings.push("<strong>💡 " + getT("alert_mode_sps_title") + "</strong> " + getT("alert_mode_sps_desc"));
    } else if (converterMode === "tps") {
        warnings.push("<strong>💡 " + getT("alert_mode_tps_title") + "</strong> " + getT("alert_mode_tps_desc"));
    }

    if (warnings.length > 0) {
        warningDiv.style.display = "block";
        warningDiv.innerHTML = warnings.join("<br><br>");
    } else {
        warningDiv.style.display = "none";
    }

    var vin_nom_input = parseFloat(document.getElementById('vin_nom').value);
    var vin_nom = (!isNaN(vin_nom_input) && vin_nom_input > 0) ? vin_nom_input : (vin_min + vin_max) / 2;
    var vout_nom_input = parseFloat(document.getElementById('vout_nom').value);
    var vout_nom = (!isNaN(vout_nom_input) && vout_nom_input > 0) ? vout_nom_input : (vout_min + vout_max) / 2;

    var Fs = f_khz * 1000;
    var pOutput = vout_nom * ilout;
    var rOutput = vout_nom / ilout;
    var N = Math.round((vin_nom / vout_nom) * 100) / 100;

    var phi_design = Math.PI / 4;
    var lOutput_H = (N * vin_min * vout_min * phi_design * (Math.PI - phi_design)) / (2 * Math.PI * Math.PI * Fs * pOutput);
    var lOutput = lOutput_H * 1e6;

    var opt = findOptimalModulationFast(vin_nom, vout_nom, N, lOutput_H, Fs, pOutput, converterMode);
    var exact = calcFastDAB(vin_nom, N * vout_nom, opt.d1, opt.d2, opt.phi, 2 * Math.PI * Fs * lOutput_H);

    var J = MagneticUtils.getCurrentDensity(f_khz);

    window.il_rms = exact.Irms;
    window.i1_rms_global = exact.Irms;
    window.i2_rms_global = exact.Irms * N;

    window.A1_req = window.i1_rms_global / J;
    window.A2_req = window.i2_rms_global / J;
    window.d1_req = 2 * Math.sqrt(window.A1_req / Math.PI);
    window.d2_req = 2 * Math.sqrt(window.A2_req / Math.PI);

    window.A_coil_req = window.il_rms / J;
    window.d_coil_req = 2 * Math.sqrt(window.A_coil_req / Math.PI);

    window.max_wire_d_mm = 2 * (65.6 / Math.sqrt(Fs));

    var phi_nom = dabPhiFromPower(N, vin_nom, vout_nom, pOutput, Fs, lOutput_H);
    var sw_nom = dabI1I2(N, vin_nom, vout_nom, phi_nom, Fs, lOutput_H);

    var corners = [
        { v1: vin_min, v2: vout_min }, { v1: vin_min, v2: vout_max },
        { v1: vin_max, v2: vout_min }, { v1: vin_max, v2: vout_max }, { v1: vin_nom, v2: vout_nom }
    ];

    var Ipeak_max = 0;
    for (let c of corners) {
        let phi_c = dabPhiFromPower(N, c.v1, c.v2, pOutput, Fs, lOutput_H);
        let sw_c = dabI1I2(N, c.v1, c.v2, phi_c, Fs, lOutput_H);
        let peak_c = Math.max(Math.abs(sw_c.i1), Math.abs(sw_c.i2));
        if (peak_c > Ipeak_max) Ipeak_max = peak_c;
    }

    var deltaVout = vout_nom * 0.01;
    var deltaQ = ilout * (phi_nom / (2 * Math.PI)) * (1 / Fs);
    var cOutput = (deltaQ / deltaVout) * 1e6;

    var finalKullanilacakVerim = verim;
    var effData;

    if (effMode === "ideal") {
        effData = generateEfficiencyVsPowerCurve(vin_nom, vout_nom, N, lOutput_H, Fs, pOutput, verim, true, converterMode);
        var loss = Math.abs(100 - verim);
        document.getElementById('loss').innerText = loss.toFixed(2);
    } else {
        var params = getRealParamsDAB();
        effData = generateEfficiencyVsPowerCurve(vin_nom, vout_nom, N, lOutput_H, Fs, pOutput, verim, false, converterMode);
        var realRes = calculateRealEfficiencyDAB(N, vin_nom, vout_nom, pOutput, Fs, lOutput_H, params, converterMode);

        finalKullanilacakVerim = realRes.efficiencyPercent;

        document.getElementById("res_pon_pri").innerText = realRes.breakdown.Pon_pri.toFixed(4) + " W";
        document.getElementById("res_pon_sec").innerText = realRes.breakdown.Pon_sec.toFixed(4) + " W";
        document.getElementById("res_psw_pri").innerText = realRes.breakdown.Psw_pri.toFixed(4) + " W";
        document.getElementById("res_psw_sec").innerText = realRes.breakdown.Psw_sec.toFixed(4) + " W";
        document.getElementById("res_pcoss").innerText = realRes.breakdown.Pcoss.toFixed(4) + " W";
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

    var wmax1 = 0.5 * lOutput_H * Math.pow(Ipeak_max, 2) * 1e6;
    var Bmax_nom = 0.2 * Math.pow(50000 / Fs, 0.6);
    var Ku = 0.4, J_nom = 5;
    var Ap_req = (pOutput * 1e6) / (4 * Fs * Bmax_nom * Ku * J_nom);
    var VeOpt = 52000 * Math.pow(pOutput / 800, 1.2) * Math.sqrt(50000 / Fs);
    var pin = pOutput / (finalKullanilacakVerim / 100);
    var iin = pin / vin_nom;

    window.lOutput_global = lOutput;
    window.wmax1_global = wmax1;
    window.Imax_global = Ipeak_max;
    window.VeOpt_global = VeOpt;
    window.dabPhaseShift = (opt.d1 > 0) ? opt.d1 : opt.phi;

    document.getElementById('lOutput').innerText = lOutput.toFixed(2);
    document.getElementById('cOutput').innerText = cOutput.toFixed(2);
    document.getElementById('rOutput').innerText = rOutput.toFixed(2);
    document.getElementById('Ipeak').innerText = Ipeak_max.toFixed(2);
    document.getElementById('nOutput').innerText = N.toFixed(3) + " : 1";
    document.getElementById('wmax1').innerText = wmax1.toFixed(2);
    document.getElementById('vin1').innerText = vin_nom.toFixed(2);
    document.getElementById('VeOpt').innerText = VeOpt.toFixed(0);
    document.getElementById('ApOpt').innerText = Ap_req.toFixed(0);
    document.getElementById('f').innerText = Fs.toFixed(0);
    document.getElementById('iin').innerText = iin.toFixed(2);

    var waveforms = generateDABWaveforms(vin_nom, vout_nom, N, lOutput_H, Fs, pOutput, converterMode);
    drawCharts(waveforms.t, waveforms.v1, waveforms.v3, waveforms.il, effData.labels, effData.values);

    var tbody = document.getElementById('resultTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = "";
    var step = Math.max(1, Math.floor(waveforms.t.length / 20));
    for (var i = 0; i <= 20; i++) {
        var idx = Math.min(i * step, waveforms.t.length - 1);
        var row = tbody.insertRow(-1);
        row.insertCell(0).innerHTML = waveforms.t[idx] + " µs";
        row.insertCell(1).innerHTML = (waveforms.v1[idx] || 0).toFixed(2) + " V";
        row.insertCell(2).innerHTML = (waveforms.v3[idx] || 0).toFixed(2) + " V";
        row.insertCell(3).innerHTML = (waveforms.il[idx] || 0).toFixed(2) + " A";
        row.insertCell(4).innerHTML = (waveforms.phi[idx] || 0).toFixed(2) + " °";
    }
}

// ================================================================
// FALSTAD API & IFRAME MANAGEMENT
// ================================================================
var falstadSim = null;

function embedFalstadSimulation(circuitString) {
    var iframe = document.getElementById("circuitFrame");

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
                    falstadSim = cw.CircuitJS1;
                    cw.CircuitJS1.importCircuit(circuitString, false);
                }
            } catch (e) { }
        }, 50);
    };
}

function openFalstadDabSimulation() {
    var vin_nom = parseFloat(document.getElementById('vin_nom').value) || 400;
    var vout_nom = parseFloat(document.getElementById('vout_nom').value) || 24;
    var ilout = parseFloat(document.getElementById('ilout').value) || 20;
    var f_khz = parseFloat(document.getElementById('f_khz').value) || 100;

    var freq_hz = f_khz * 1000;
    var r_val = vout_nom / ilout;
    var pOutput = vout_nom * ilout;

    var l_val_uH = parseFloat(document.getElementById('lOutput').innerText) || 247.45;
    var l_val = l_val_uH * 1e-6;

    var c_val_uF = parseFloat(document.getElementById('cOutput').innerText) || 75.55;
    var c_val = c_val_uF * 1e-6;

    var nOutputText = document.getElementById('nOutput').innerText || "16.667";
    var N = parseFloat(nOutputText.split(':')[0]);
    var ratio = 1 / N;

    var phi_nom = dabPhiFromPower(N, vin_nom, vout_nom, pOutput, freq_hz, l_val);
    var phase_shift = (2 * Math.PI) - phi_nom;

    var sim_timestep = 1.0 / (freq_hz * 100);
    var timestep_str = sim_timestep.toExponential(2).toUpperCase();

    var current_iin = ilout * ratio;

    var vscale_out_5 = 40.0 * (24.0 / vout_nom);
    var iscale_out_5 = 25.6 * (20.0 / ilout);
    var vscale_in_2 = 1280.0 * (400.0 / vin_nom);
    var iscale_in_2 = 12.8 * (1.2 / (current_iin || 1));
    var vscale_in_28 = 40.0 * (400.0 / vin_nom);
    var iscale_out_28 = 204.8 * (20.0 / ilout);

    var l_mag_val = (100 * l_val).toExponential(6);

    var omega_L = 2 * Math.PI * freq_hz * l_val;
    var V2p = N * vout_nom;
    var il_init_val = -(vin_nom * Math.PI - 2 * V2p * phi_nom) / (2 * omega_L);

    var il_clamp = ilout * 1.5;
    if (il_init_val > il_clamp) il_init_val = il_clamp;
    if (il_init_val < -il_clamp) il_init_val = -il_clamp;

    var c_zvs = 1 / (Math.pow(2 * Math.PI * freq_hz * 3, 2) * l_val);
    if (c_zvs < 100e-12) c_zvs = 100e-12;
    if (c_zvs > 2e-9) c_zvs = 2e-9;
    var c_zvs_str = c_zvs.toExponential(4);

    var falstadTemplate = `<cir f="1" ts="{TIMESTEP}" ic="242.03481360272136" cb="72" pb="50" vr="5" mts="5e-11">
  <v x="112 432 112 160" f="16" wf="0" maxv="{VIN}"/>
  <g x="112 432 112 464" f="0"/>
  <l x="320 272 624 272" f="0" l="{L_VAL}" ic="{IL_INIT}" i="0"/>
  <T x="624 272 736 336" f="0" in="{L_MAG}" ra="{RATIO}" co="0.9999" wi="64" c0="0" c1="0"/>
  <c x="1088 128 1088 432" f="0" c="{C_VAL}" iv="{VOUT_INIT}" sr="0" vd="0"/>
  <r x="1152 128 1152 432" f="0" r="{R_VAL}"/>
  <w x="112 160 112 128" f="0"/>
  <w x="112 128 320 128" f="0"/>
  <w x="320 128 320 176" f="0"/>
  <w x="320 128 512 128" f="0"/>
  <w x="512 128 512 176" f="0"/>
  <w x="320 208 320 272" f="0"/>
  <w x="320 384 320 272" f="0"/>
  <w x="112 432 320 432" f="0"/>
  <w x="320 432 320 416" f="0"/>
  <w x="512 208 512 336" f="0"/>
  <w x="512 416 512 432" f="0"/>
  <w x="320 432 512 432" f="0"/>
  <w x="624 336 512 336" f="0"/>
  <w x="512 336 512 384" f="0"/>
  <w x="848 416 848 432" f="0"/>
  <w x="848 272 848 208" f="0"/>
  <w x="1040 208 1040 336" f="0"/>
  <w x="1040 416 1040 432" f="0"/>
  <w x="1040 432 848 432" f="0"/>
  <w x="848 176 848 128" f="0"/>
  <w x="848 128 1040 128" f="0"/>
  <w x="1040 128 1040 176" f="0"/>
  <w x="736 272 848 272" f="0"/>
  <w x="736 336 1040 336" f="0"/>
  <w x="848 272 848 384" f="0"/>
  <w x="1040 336 1040 384" f="0"/>
  <w x="1040 128 1088 128" f="0"/>
  <w x="1152 128 1088 128" f="0"/>
  <w x="1152 432 1088 432" f="0"/>
  <w x="1088 432 1040 432" f="0"/>
  <R x="192 272 160 272" f="17" wf="2" fr="{FREQ}" maxv="2.5" bias="2.5"/>
  <I x="192 272 272 272" f="0" sl="0.5" hi="5"/>
  <w x="304 192 192 192" f="0"/>
  <w x="192 192 192 272" f="0"/>
  <w x="432 400 432 368" f="0"/>
  <w x="432 368 192 368" f="0"/>
  <w x="192 368 192 272" f="0"/>
  <w x="272 272 272 400" f="0"/>
  <w x="496 192 368 192" f="0"/>
  <w x="368 192 368 240" f="0"/>
  <w x="368 240 272 240" f="0"/>
  <w x="272 240 272 272" f="0"/>
  <R x="912 288 880 288" f="17" wf="2" fr="{FREQ}" maxv="2.5" bias="2.5" phaseShift="{PHASE_SHIFT}"/>
  <I x="912 288 976 288" f="0" sl="0.5" hi="5"/>
  <w x="768 192 768 240" f="0"/>
  <w x="768 240 912 240" f="0"/>
  <w x="912 240 912 288" f="0"/>
  <w x="1024 400 912 400" f="0"/>
  <w x="912 400 912 288" f="0"/>
  <w x="768 400 768 368" f="0"/>
  <w x="768 368 976 368" f="0"/>
  <w x="976 368 976 288" f="0"/>
  <w x="1024 192 976 192" f="0"/>
  <w x="976 192 976 288" f="0"/>
  <g x="1152 432 1152 464" f="0"/>
  <as x="512 176 512 208" f="2" ron="0.001" roff="10000000000" th="2.5"/>
  <as x="512 384 512 416" f="2" ron="0.001" roff="10000000000" th="2.5"/>
  <as x="320 384 320 416" f="2" ron="0.001" roff="10000000000" th="2.5"/>
  <as x="320 176 320 208" f="2" ron="0.001" roff="10000000000" th="2.5"/>
  <w x="272 400 304 400" f="0"/>
  <w x="432 400 496 400" f="0"/>
  <as x="848 384 848 416" f="2" ron="0.001" roff="10000000000" th="2.5"/>
  <as x="848 176 848 208" f="2" ron="0.001" roff="10000000000" th="2.5"/>
  <as x="1040 176 1040 208" f="2" ron="0.001" roff="10000000000" th="2.5"/>
  <as x="1040 384 1040 416" f="2" ron="0.001" roff="10000000000" th="2.5"/>
  <w x="768 192 832 192" f="0"/>
  <w x="768 400 832 400" f="0"/>
  <dm nm="ideal" f="1" is="1.7143528192810002e-7" rs="0" n="2.0000000000000084" bv="0" fi="1"/>
  <d x="544 208 544 176" f="0" mo="ideal"/>
  <d x="544 416 544 384" f="0" mo="ideal"/>
  <d x="352 208 352 176" f="0" mo="ideal"/>
  <d x="352 416 352 384" f="0" mo="ideal"/>
  <d x="1072 416 1072 384" f="0" mo="ideal"/>
  <d x="1072 208 1072 176" f="0" mo="ideal"/>
  <d x="880 208 880 176" f="0" mo="ideal"/>
  <d x="880 416 880 384" f="0" mo="ideal"/>
  <w x="544 176 512 176" f="0"/>
  <w x="544 208 512 208" f="0"/>
  <w x="544 384 512 384" f="0"/>
  <w x="544 416 512 416" f="0"/>
  <w x="352 384 320 384" f="0"/>
  <w x="352 416 320 416" f="0"/>
  <w x="352 176 320 176" f="0"/>
  <w x="352 208 320 208" f="0"/>
  <w x="880 176 848 176" f="0"/>
  <w x="880 208 848 208" f="0"/>
  <w x="880 384 848 384" f="0"/>
  <w x="880 416 848 416" f="0"/>
  <w x="1072 176 1040 176" f="0"/>
  <w x="1072 208 1040 208" f="0"/>
  <w x="1072 384 1040 384" f="0"/>
  <w x="1072 416 1040 416" f="0"/>
  <c x="320 176 320 208" f="0" c="{C_ZVS}" iv="0"/>
  <c x="320 384 320 416" f="0" c="{C_ZVS}" iv="0"/>
  <c x="512 176 512 208" f="0" c="{C_ZVS}" iv="0"/>
  <c x="512 384 512 416" f="0" c="{C_ZVS}" iv="0"/>
  <c x="848 176 848 208" f="0" c="{C_ZVS}" iv="0"/>
  <c x="848 384 848 416" f="0" c="{C_ZVS}" iv="0"/>
  <c x="1040 176 1040 208" f="0" c="{C_ZVS}" iv="0"/>
  <c x="1040 384 1040 416" f="0" c="{C_ZVS}" iv="0"/>
  <o en="5" sp="5" f="x3" p="0">
    <p v="0" sc="{VSCALE_OUT_5}"/>
    <p v="3" sc="{ISCALE_OUT_5}"/>
  </o>
  <o en="2" sp="5" f="x3" p="1">
    <p v="0" sc="{VSCALE_IN_2}"/>
    <p v="3" sc="{ISCALE_IN_2}"/>
  </o>
  <o en="28" sp="5" f="x3" p="2">
    <p v="0" sc="{VSCALE_IN_28}"/>
    <p v="3" sc="{ISCALE_OUT_28}"/>
  </o>
</cir>`;

    var circuitString = falstadTemplate
        .replace(/{TIMESTEP}/g, timestep_str)
        .replace(/{VIN}/g, vin_nom)
        .replace(/{L_VAL}/g, l_val)
        .replace(/{IL_INIT}/g, il_init_val.toFixed(6))
        .replace(/{L_MAG}/g, l_mag_val)
        .replace(/{RATIO}/g, ratio)
        .replace(/{C_VAL}/g, c_val)
        .replace(/{VOUT_INIT}/g, vout_nom.toFixed(4))
        .replace(/{R_VAL}/g, r_val)
        .replace(/{FREQ}/g, freq_hz)
        .replace(/{PHASE_SHIFT}/g, phase_shift.toFixed(5))
        .replace(/{C_ZVS}/g, c_zvs_str)
        .replace(/{VSCALE_OUT_5}/g, vscale_out_5.toFixed(2))
        .replace(/{ISCALE_OUT_5}/g, iscale_out_5.toFixed(2))
        .replace(/{VSCALE_IN_2}/g, vscale_in_2.toFixed(2))
        .replace(/{ISCALE_IN_2}/g, iscale_in_2.toFixed(2))
        .replace(/{VSCALE_IN_28}/g, vscale_in_28.toFixed(2))
        .replace(/{ISCALE_OUT_28}/g, iscale_out_28.toFixed(2));

    if (typeof embedFalstadSimulation === "function") {
        embedFalstadSimulation(circuitString);

        var simContainer = document.getElementById("simulationContainer");
        if (simContainer) {
            simContainer.style.display = "block";
            simContainer.scrollIntoView({ behavior: 'smooth' });
        }

        var liveDataBox = document.getElementById("liveDataBox");
        if (liveDataBox) {
            liveDataBox.style.display = "block";
            liveDataBox.innerHTML = "Fitcore SMPS Designer: Dual Active Bridge (DAB) Converter Simulation";
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

function drawCharts(t, v1, v3, il, p_arr, eff_arr) {
    const textColor = '#e0e0e0';
    const gridColor = 'rgba(255, 255, 255, 0.1)';
    const getT = window.getT || function (k) { return k; };

    const commonOpts = {
        responsive: true, animation: false,
        elements: { point: { radius: 0 }, line: {} },
        scales: {
            x: { display: false, grid: { color: gridColor } },
            y: { ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }
        },
        plugins: { legend: { position: 'top', labels: { color: textColor } } }
    };

    function mk(id, datasets, isStepped) {
        var canvas = document.getElementById(id);
        if (!canvas) return;
        if (canvas.chart) canvas.chart.destroy();
        let opts = JSON.parse(JSON.stringify(commonOpts));
        if (isStepped) opts.elements.line.stepped = true;
        canvas.chart = new Chart(canvas.getContext('2d'), { type: 'line', data: { labels: t, datasets: datasets }, options: opts });
    }

    mk('vinChart', [{ label: getT('chart_1_name'), data: v1, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false }], true);
    mk('v3Chart', [{ label: getT('chart_2_name'), data: v3, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, fill: false }], true);
    mk('ilChart', [{ label: getT('chart_3_name'), data: il, borderColor: 'rgba(105, 240, 174, 1)', borderWidth: 2, fill: false }], false);

    var idCanvas = document.getElementById('idChart');
    if (idCanvas) {
        if (idCanvas.chart) idCanvas.chart.destroy();
        idCanvas.chart = new Chart(idCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: t,
                datasets: [
                    { label: getT('col_v1'), data: v1, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false, pointRadius: 0, stepped: true },
                    { label: getT('col_v3'), data: v3, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: false, pointRadius: 0, stepped: true, borderDash: [6, 4] }
                ]
            },
            options: { responsive: true, animation: false, scales: { x: { title: { display: true, text: getT('chart_time_us'), color: textColor }, ticks: { color: textColor, maxTicksLimit: 9 }, grid: { color: gridColor } }, y: { ticks: { color: textColor }, grid: { color: gridColor } } }, plugins: commonOpts.plugins }
        });
    }

    var effCanvas = document.getElementById('effChart');
    if (effCanvas) {
        if (effCanvas.chart) effCanvas.chart.destroy();
        effCanvas.chart = new Chart(effCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: p_arr,
                datasets: [{
                    label: getT('chart_eff_pct'),
                    data: eff_arr,
                    borderColor: 'rgba(129, 199, 132, 1)',
                    backgroundColor: 'rgba(129, 199, 132, 0.15)',
                    borderWidth: 2, fill: true, tension: 0.4, pointRadius: 2
                }]
            },
            options: { responsive: true, animation: false, scales: { x: { title: { display: true, text: getT('chart_load_pct'), color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } }, y: { min: 0, max: 100, title: { display: true, text: getT('chart_eff_pct'), color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } } }, plugins: commonOpts.plugins }
        });
    }
}

function printPage() { window.print(); }

// ================================================================
// TABLO & MODAL ENTEGRASYONU (Modern Architecture)
// ================================================================
window.openSelectedTable = function () {
    const modeElement = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeElement ? modeElement.value : "standard";

    var lOutputStr = document.getElementById('lOutput')?.innerText;
    var wmax1Str = document.getElementById('wmax1')?.innerText;
    var veOptStr = document.getElementById('VeOpt')?.innerText;

    if (!lOutputStr || isNaN(parseFloat(lOutputStr)) || !veOptStr || isNaN(parseFloat(veOptStr))) {
        var getT = window.getT || function (key) { return key; };
        alert(getT('adv_alert_calc_first') || "Lütfen önce hesaplama yapın!");
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
    var vin_test = parseFloat(document.getElementById('vin_nom')?.value) || 400; // DAB'da vin_nom referans
    var f_hz = parseFloat(document.getElementById('f')?.innerText) || 100000;
    var nOutput = parseFloat(document.getElementById('nOutput')?.innerText.split(':')[0]) || 1; // N:1 formatını parse ediyoruz
    var Imax = window.Imax_global;

    var trafoParams = {
        title: (window.getT && window.getT('btn_transformer')) ? window.getT('btn_transformer') : "Transformer Data",
        topology: 'dab',
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
