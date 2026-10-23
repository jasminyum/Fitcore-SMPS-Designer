// ================================================================
// Weinberg Converter (current-fed push-pull + flyback)
// Reference: TI Power Topologies Handbook, Chapter 15 (pp. 137-146)
// SPDX-License-Identifier: AGPL-3.0-only
//
// Two magnetic components:
//   1) Flyback coupled inductor Np/Ns  -> GAPPED   (energy storage)
//   2) Push-pull transformer Np1,Np2/Ns1,Ns2 -> UNGAPPED
// Both share the same turns ratio n = np/ns.
// ================================================================

window.il_rms = 0;            // Np (flyback primary) RMS
window.i1_rms_global = 0;     // push-pull primary winding RMS (= one FET RMS)
window.i2_rms_global = 0;     // push-pull secondary winding RMS
window.i2_rms_calc = 0;       // Ns (flyback secondary) RMS
window.Imax_global = 0;
window.lOutput_global = 0;    // uH
window.wmax1_global = 0;      // uWs
window.A1_req = 0;
window.A2_req = 0;
window.A_coil_req = 0;
window.d1_req = 0;
window.d2_req = 0;
window.d_coil_req = 0;
window.max_wire_d_mm = 0;
window.weinbergLastCalc = null;

var WB_UF = 0.7;          // design diode drop (same as the other topology pages)
var WB_DMAX = 0.8;        // max Vr/Vin at Vin_min used to pick the turns ratio
var WB_TXT = {
    en: {
        coil: "Flyback Coupled Inductor (gapped)",
        trafo: "Push-Pull Transformer (ungapped)",
        w1: "⚠️ Warning: selected mode is ",
        w2: ", but with these values the flyback inductor operates in ",
        w3: " mode!",
        crm: "Info: CRM is active. Ideal operating frequency at nominal load: ",
        badRatio: "Error: reflected voltage (Vout+Vf)·Np/Ns must be lower than Vin_min. Reduce Np/Ns.",
        calcFirst: "Please calculate first!"
    },
    tr: {
        coil: "Flyback Kuplajlı Bobin (gaplı)",
        trafo: "Push-Pull Trafo (gapsiz)",
        w1: "⚠️ Uyarı: Seçilen mod ",
        w2: ", ancak girilen değerlere göre flyback bobini ",
        w3: " modunda çalışacak!",
        crm: "Bilgi: CRM aktif. Nominal yükte ideal çalışma frekansı ",
        badRatio: "Hata: yansıyan gerilim (Vout+Vf)·Np/Ns, Vin_min değerinden küçük olmalı. Np/Ns oranını düşürün.",
        calcFirst: "Lütfen önce hesaplama yapın!"
    },
    de: {
        coil: "Flyback-Koppelinduktivität (mit Luftspalt)",
        trafo: "Gegentakt-Transformator (ohne Luftspalt)",
        w1: "⚠️ Warnung: Gewählter Modus ist ",
        w2: ", aber mit diesen Werten arbeitet die Flyback-Drossel im ",
        w3: "-Modus!",
        crm: "Info: CRM ist aktiv. Ideale Betriebsfrequenz bei Nennlast: ",
        badRatio: "Fehler: Die reflektierte Spannung (Vout+Vf)·Np/Ns muss kleiner als Vin_min sein. Np/Ns verringern.",
        calcFirst: "Bitte zuerst berechnen!"
    }
};
function wbT() {
    var l = (document.documentElement.lang || 'en').toLowerCase().slice(0, 2);
    return WB_TXT[l] || WB_TXT.en;
}

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

window.toggleCustomDesign = function () {
    var chk = document.getElementById("testOwnDesignCheck");
    var box = document.getElementById("inductance");
    if (box) box.style.display = (chk && chk.checked) ? "flex" : "none";
};

window.addEventListener('DOMContentLoaded', function () {
    window.toggleEffMode();
    window.toggleCustomDesign();
});

// ================================================================
// INPUT VALIDATION / DEFAULTS
// ================================================================
function checkUserInput() {
    var g = function (id) { return parseFloat(document.getElementById(id).value); };
    var vin_min = g('vin_min'), vin_max = g('vin_max'), vin_nom = g('vin_nom');
    var vout = g('vout'), ilout = g('ilout'), f_khz = g('f_khz'), verim = g('verim');

    if (isNaN(vin_min) || vin_min <= 0) vin_min = 18.0;
    if (isNaN(vin_max) || vin_max <= 0) vin_max = 36.0;
    if (isNaN(vout) || vout <= 0) vout = 48.0;
    if (isNaN(ilout) || ilout <= 0) ilout = 2.5;
    if (isNaN(f_khz) || f_khz <= 0) f_khz = 100.0;
    if (isNaN(verim) || verim <= 0) verim = 92.0;
    if (vin_min > vin_max) vin_max = vin_min;
    if (isNaN(vin_nom) || vin_nom <= 0 || vin_nom < vin_min || vin_nom > vin_max) vin_nom = 24.0;
    if (vin_nom < vin_min || vin_nom > vin_max) vin_nom = (vin_min + vin_max) / 2;

    if (f_khz < 0.1 || f_khz > 2000) {
        alert(window.getT ? window.getT('alert_freq_warning') : "Switching frequency must be between 100 Hz and 2 MHz!");
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
    var set = function (id, v) { var e = document.getElementById(id); if (e) e.value = v; };
    set('vin_min', 18); set('vin_max', 36); set('vin_nom', 24);
    set('vout', 48); set('ilout', 2.5); set('f_khz', 100); set('verim', 92);
    set('custom_nRatio', 0.3); set('custom_L_uH', "");
    set('mode', "continuous");
    if (document.getElementById('effMode')) { set('effMode', "real"); toggleEffMode(); }
    set('p_ron_h', 0.020); set('p_coss_h', 300); set('p_qg_h', 40); set('p_vgs', 10.0);
    set('p_tr_h', 10); set('p_tf_h', 10); set('p_vd', 0.7); set('p_trr', 20); set('p_irr', 1.0);
    set('p_dcr', 0.005); set('p_dcr_sec', 0.010); set('p_dcr_pp_pri', 0.004); set('p_dcr_pp_sec', 0.012);
    set('p_icc', 6.0); set('p_esrcin', 0.005); set('p_esrcout', 0.004);
}

// ================================================================
// CORE MODEL  (TI handbook ch.15, extended to CRM/DCM of the flyback inductor)
//
//   Vr   = (Vout+Vf)*n                (reflected voltage, n = np/ns)
//   t1   = 1/(2f) * Vr/Vin            (FET on-time, one per half period)
//   t2   = 1/(2f) - t1
//   Np sees (Vin-Vr) during t1 and -Vr during t2 -> volt-second balance gives t1.
//   Input pulse current:  Ipulse = Iin / (2*f*t1),  Iin = (Vout+Vf)*Iout/Vin
//   Ripple:  Iripple = (Vin-Vr)*t1/Lp
//   Imin/Imax = Ipulse -/+ Iripple/2   (CCM)
// ================================================================
function wbSeg(a, b, tau) { return tau * (a * a + a * b + b * b) / 3; }   // integral of i^2 on a linear segment

function wbSolve(vin, vout, iout, f, L, n, Vf) {
    var Vr = (vout + Vf) * n;
    var T2 = 1 / (2 * f);
    var op = { ok: false, Vr: Vr, n: n, T2: T2, vin: vin, f: f, L: L };
    if (!(Vr > 0) || Vr >= vin * 0.995) return op;

    var Iin = (vout + Vf) * iout / vin;
    var D2c = Vr / vin;                   // = 2*f*t1 in CCM/CRM
    var t1c = D2c * T2;
    var Ip = Iin / D2c;                   // average Np current while a FET conducts
    var rip = (vin - Vr) * t1c / L;       // ripple if CCM

    var mode, t1, t2, Imin, Imax;
    var tol = 0.03 * Ip;
    if (Math.abs(rip - 2 * Ip) <= tol) mode = "critical";
    else if (rip > 2 * Ip) mode = "discontinuous";
    else mode = "continuous";

    if (mode === "continuous") {
        t1 = t1c; t2 = T2 - t1;
        Imin = Ip - rip / 2; Imax = Ip + rip / 2;
    } else if (mode === "critical") {
        t1 = t1c; t2 = T2 - t1;
        Imin = 0; Imax = 2 * Ip; rip = Imax;
    } else {
        t1 = Math.sqrt(L * Iin / (f * (vin - Vr)));
        Imax = (vin - Vr) * t1 / L; Imin = 0; rip = Imax;
        t2 = (vin - Vr) * t1 / Vr;
        if (t1 > T2) { t1 = T2; }
        if (t1 + t2 > T2) t2 = T2 - t1;
    }

    var S1 = wbSeg(Imin, Imax, t1);
    var S2 = wbSeg(Imax * n, Imin * n, t2);
    var tdead = Math.max(0, T2 - t1 - t2);

    // output capacitor current: x(t) = n*i(t) - Iout
    var xa1 = n * Imin - iout, xb1 = n * Imax - iout, xa2 = n * Imax - iout, xb2 = n * Imin - iout;
    var Icout_sq = 2 * f * (wbSeg(xa1, xb1, t1) + wbSeg(xa2, xb2, t2) + tdead * iout * iout);
    var Icin_sq = 2 * f * (wbSeg(Iin - Imin, Iin - Imax, t1) + (T2 - t1) * Iin * Iin);

    // charge ripple of Co (numerical, one half period)
    var N = 400, q = 0, qmin = 0, qmax = 0, dt = T2 / N;
    for (var k = 0; k < N; k++) {
        var t = (k + 0.5) * dt, x;
        if (t < t1) x = n * (Imin + (Imax - Imin) * t / t1) - iout;
        else if (t < t1 + t2) x = n * (Imax - (Imax - Imin) * (t - t1) / t2) - iout;
        else x = -iout;
        q += x * dt; if (q < qmin) qmin = q; if (q > qmax) qmax = q;
    }

    op.ok = true; op.mode = mode;
    op.Iin = Iin; op.D2 = t1 / T2; op.Dfet = t1 * f;
    op.t1 = t1; op.t2 = t2; op.tdead = tdead;
    op.Ip = Ip; op.Imin = Imin; op.Imax = Imax; op.rip = (mode === "continuous") ? rip : Imax;
    op.S1 = S1; op.S2 = S2;
    op.np_rms = Math.sqrt(2 * f * S1);              // flyback primary Np
    op.q_rms = Math.sqrt(f * S1);                   // each FET and each push-pull primary half
    op.ns_rms = Math.sqrt(2 * f * S2);              // flyback secondary Ns
    op.ns1_rms = n * Math.sqrt(f * S1);             // each push-pull secondary half
    op.icin_rms = Math.sqrt(Math.max(0, Icin_sq));
    op.icout_rms = Math.sqrt(Math.max(0, Icout_sq));
    op.dQ = qmax - qmin;
    op.Vds_max = vin + 2 * Vr;
    op.Vr_D2 = Vr / vin;
    return op;
}

// ================================================================
// LOSSES
// ================================================================
function getRealParams() {
    var getVal = function (id, def) {
        var el = document.getElementById(id);
        var v = el ? parseFloat(el.value) : NaN;
        return isNaN(v) ? def : v;
    };
    return {
        Ron_H: getVal('p_ron_h', 0.020),
        tr_H: getVal('p_tr_h', 10) * 1e-9,
        tf_H: getVal('p_tf_h', 10) * 1e-9,
        Coss_H: getVal('p_coss_h', 300) * 1e-12,
        Qg_H: getVal('p_qg_h', 40) * 1e-9,
        Vgs: getVal('p_vgs', 10.0),
        Vd: getVal('p_vd', 0.7),
        trr: getVal('p_trr', 20) * 1e-9,
        Irr: getVal('p_irr', 1.0),
        DCR_pri: getVal('p_dcr', 0.005),
        DCR_sec: getVal('p_dcr_sec', 0.010),
        DCR_pp_pri: getVal('p_dcr_pp_pri', 0.004),
        DCR_pp_sec: getVal('p_dcr_pp_sec', 0.012),
        Icc: getVal('p_icc', 6.0) * 1e-3,
        ESR_Cin: getVal('p_esrcin', 0.005),
        ESR_Cout: getVal('p_esrcout', 0.004)
    };
}

function calculateRealEfficiency(op, vin, vout, iout, p) {
    var f = op.f, n = op.n, Vr = op.Vr;
    var ccm = (op.mode === "continuous");

    // two FETs, each conducts once per period
    var Pon = op.np_rms * op.np_rms * p.Ron_H;     // = 2 * Iq_rms^2 * Ron
    var Vsw = op.Vds_max;
    var Pon_sw = ccm ? 0.5 * Vsw * op.Imin * p.tr_H * f * 2 : 0;
    var Poff_sw = 0.5 * Vsw * op.Imax * p.tf_H * f * 2;
    var Psw = Pon_sw + Poff_sw;
    var Pcoss = 2 * 0.5 * p.Coss_H * Vsw * Vsw * f;
    var Pg = 2 * p.Qg_H * p.Vgs * f;

    // every instant the whole output current flows through one rectifier
    var Pdiode_cond = p.Vd * iout;
    var Prr = 0;
    if (ccm) {
        var V12 = 2 * (vout + p.Vd);                       // D1/D2 reverse voltage (handbook 15.7)
        var V3 = (vin - Vr) / n + vout;                    // D3 reverse voltage (handbook 15.8)
        Prr = (2 * 0.5 * V12 + 2 * 0.5 * V3) * p.Irr * p.trr * f;
    }

    var Pic = vin * p.Icc;
    var Pl_fly_pri = op.np_rms * op.np_rms * p.DCR_pri;
    var Pl_fly_sec = op.ns_rms * op.ns_rms * p.DCR_sec;
    var Ppp_pri = 2 * op.q_rms * op.q_rms * p.DCR_pp_pri;
    var Ppp_sec = 2 * op.ns1_rms * op.ns1_rms * p.DCR_pp_sec;
    var Pcin = op.icin_rms * op.icin_rms * p.ESR_Cin;
    var Pcout = op.icout_rms * op.icout_rms * p.ESR_Cout;

    var Ptotal = Pon + Psw + Pcoss + Pg + Pdiode_cond + Prr + Pic + Pl_fly_pri + Pl_fly_sec + Ppp_pri + Ppp_sec + Pcin + Pcout;
    var Pout = vout * iout;
    return {
        totalLossW: Ptotal,
        efficiencyPercent: Pout / (Pout + Ptotal) * 100,
        breakdown: {
            Pon: Pon, Psw: Psw, Pcoss: Pcoss, Pg: Pg, Pdiode_cond: Pdiode_cond, Prr: Prr, Pic: Pic,
            Pl_fly_pri: Pl_fly_pri, Pl_fly_sec: Pl_fly_sec, Ppp_pri: Ppp_pri, Ppp_sec: Ppp_sec,
            Pcin: Pcin, Pcout: Pcout
        }
    };
}

function generateIdealEffCurve(eff_full_load, f_hz) {
    var values = [], labels = [];
    var k_fix = 0.028 * (f_hz / 50000), k_cond = 0.038;
    function raw_eff(p) { if (p < 0.001) p = 0.001; return p / (p + k_fix + k_cond * p * p); }
    var scale = eff_full_load / raw_eff(1.0);
    for (var pct = 10; pct <= 120; pct += 5) {
        var e = Math.min(99.5, Math.max(0, raw_eff(pct / 100) * scale * 100));
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
}

function generateRealEffCurve(vin, vout, max_iout, f_hz, L_H, n, params) {
    var values = [], labels = [];
    for (var pct = 10; pct <= 120; pct += 5) {
        var load = Math.max(0.001, max_iout * pct / 100);
        var op = wbSolve(vin, vout, load, f_hz, L_H, n, WB_UF);
        var e = 0;
        if (op.ok) e = calculateRealEfficiency(op, vin, vout, load, params).efficiencyPercent;
        if (e > 99.5) e = 99.5; if (e < 0) e = 0;
        values.push(parseFloat(e.toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
}

// ================================================================
// MAIN
// ================================================================
function updateChartsAndTable() {
    var gv = function (id) { return parseFloat(document.getElementById(id).value); };
    var vin_min = gv('vin_min'), vin_max = gv('vin_max'), vin_nom = gv('vin_nom');
    var vout = gv('vout'), ilout = gv('ilout'), f_khz = gv('f_khz'), verim = gv('verim');
    var modeEl = document.getElementById("mode");
    var userMode = modeEl ? modeEl.value : "continuous";
    var effMode = document.getElementById("effMode").value;
    var f_hz = f_khz * 1000;
    var Uem = (vin_min + vin_max) / 2;
    var Uf = WB_UF;
    var Ue = vin_nom;

    // ---- turns ratio n = np/ns (shared by flyback inductor and push-pull transformer)
    var chk = document.getElementById("testOwnDesignCheck");
    var isCustom = chk ? chk.checked : false;
    var rEl = document.getElementById('custom_nRatio');
    var userRatio = (isCustom && rEl) ? parseFloat(rEl.value) : 0;
    var n = (userRatio > 0) ? userRatio : (WB_DMAX * vin_min) / (vout + Uf);

    var Vr = (vout + Uf) * n;
    var warnEl = document.getElementById('modeWarning');
    if (Vr >= vin_min * 0.995) {
        warnEl.style.display = 'block';
        warnEl.style.color = '#721c24'; warnEl.style.border = '1px solid #f5c6cb'; warnEl.style.backgroundColor = '#f8d7da';
        warnEl.textContent = wbT().badRatio;
        return;
    }

    // ---- flyback inductor value from the selected ripple ratio
    var D2_nom = Vr / Ue;
    var T2 = 1 / (2 * f_hz);
    var t1_nom = D2_nom * T2;
    var Iin_nom = (vout + Uf) * ilout / Ue;
    var Ip_nom = Iin_nom / D2_nom;
    var K_r = (userMode === "continuous") ? 0.4 : (userMode === "critical" ? 2.0 : 2.5);

    var cL = document.getElementById('custom_L_uH');
    var userL_uH = (isCustom && cL) ? parseFloat(cL.value) : 0;
    var L_H = (userL_uH > 0) ? userL_uH * 1e-6 : ((Ue - Vr) * t1_nom) / (K_r * Ip_nom);
    var lOutput = L_H * 1e6;

    var op = wbSolve(Ue, vout, ilout, f_hz, L_H, n, Uf);
    var actualMode = op.mode;

    // ---- worst case current (Vin_min) for Imax used in core selection
    var opLo = wbSolve(vin_min, vout, ilout, f_hz, L_H, n, Uf);
    var opHi = wbSolve(vin_max, vout, ilout, f_hz, L_H, n, Uf);
    var Imax_wc = op.Imax;
    [opLo, opHi].forEach(function (o) { if (o.ok && o.Imax > Imax_wc) Imax_wc = o.Imax; });

    var modeNames = { "continuous": "CCM", "discontinuous": "DCM", "critical": "CRM" };
    if (userMode !== actualMode) {
        warnEl.style.display = 'block';
        warnEl.style.color = '#856404'; warnEl.style.border = '1px solid #ffeeba'; warnEl.style.backgroundColor = '#fff3cd';
        warnEl.textContent = wbT().w1 + modeNames[userMode] + wbT().w2 + modeNames[actualMode] + wbT().w3;
    } else if (userMode === "critical") {
        warnEl.style.display = 'block';
        warnEl.style.color = '#004085'; warnEl.style.border = '1px solid #b8daff'; warnEl.style.backgroundColor = '#cce5ff';
        var t1c = (L_H * op.Imax) / (Ue - Vr), t2c = (L_H * op.Imax) / Vr;
        warnEl.textContent = wbT().crm + (1 / (2 * (t1c + t2c)) / 1000).toFixed(1) + " kHz.";
    } else {
        warnEl.style.display = 'none'; warnEl.textContent = '';
    }

    // ---- wire / core quantities
    var J = MagneticUtils.getCurrentDensity(f_khz);
    var A_np = op.np_rms / J, A_ns = op.ns_rms / J, A_q = op.q_rms / J, A_ns1 = op.ns1_rms / J;
    var dia = function (A) { return 2 * Math.sqrt(A / Math.PI); };
    window.il_rms = op.np_rms;
    window.i2_rms_calc = op.ns_rms;
    window.i1_rms_global = op.q_rms;
    window.i2_rms_global = op.ns1_rms;
    window.Imax_global = Imax_wc;
    window.A_coil_req = A_np; window.d_coil_req = dia(A_np);
    window.A1_req = A_q; window.d1_req = dia(A_q);
    window.A2_req = A_ns1; window.d2_req = dia(A_ns1);
    window.wb_d_np = dia(A_np); window.wb_d_ns = dia(A_ns);
    window.max_wire_d_mm = 2 * (65.6 / Math.sqrt(f_hz));

    var wmax1 = 0.5 * L_H * Imax_wc * Imax_wc * 1e6;                     // uWs
    var Vripple = vout * 0.01;
    var cOutput = op.dQ / Vripple * 1e6;                                  // uF
    var rOutput = vout / ilout;
    var Pout = vout * ilout;

    var eta = verim;
    var effData, calculated_Iin;
    if (effMode === "ideal") {
        effData = generateIdealEffCurve(verim / 100, f_hz);
        document.getElementById("powerLossSection").style.display = "none";
        calculated_Iin = Pout / (Ue * (verim / 100));
        document.getElementById('loss').innerText = Math.abs(100 - verim).toFixed(2);
    } else {
        var params = getRealParams();
        effData = generateRealEffCurve(Ue, vout, ilout, f_hz, L_H, n, params);
        var rr = calculateRealEfficiency(op, Ue, vout, ilout, params);
        eta = rr.efficiencyPercent;
        document.getElementById("powerLossSection").style.display = "block";
        var setText = function (id, t) { var e = document.getElementById(id); if (e) e.innerText = t; };
        var b = rr.breakdown;
        setText("res_pon", b.Pon.toFixed(4) + " W");
        setText("res_psw", b.Psw.toFixed(4) + " W");
        setText("res_pcoss", b.Pcoss.toFixed(4) + " W");
        setText("res_pg", b.Pg.toFixed(4) + " W");
        setText("res_pon_d", b.Pdiode_cond.toFixed(4) + " W");
        setText("res_prr", b.Prr.toFixed(4) + " W");
        setText("res_pic", b.Pic.toFixed(4) + " W");
        setText("res_pl_fly_pri", b.Pl_fly_pri.toFixed(4) + " W");
        setText("res_pl_fly_sec", b.Pl_fly_sec.toFixed(4) + " W");
        setText("res_ppp_pri", b.Ppp_pri.toFixed(4) + " W");
        setText("res_ppp_sec", b.Ppp_sec.toFixed(4) + " W");
        setText("res_pcin", b.Pcin.toFixed(4) + " W");
        setText("res_pcout", b.Pcout.toFixed(4) + " W");
        setText("res_ptotal", rr.totalLossW.toFixed(4) + " W");
        setText("res_peff", rr.efficiencyPercent.toFixed(2) + " %");
        setText("loss", Math.abs(100 - eta).toFixed(2));
        calculated_Iin = Pout / (Ue * (eta / 100));
    }

    // Push-pull transformer volume estimate. Only the directly transferred part (Pa*Vr/Vin_min) passes through it.
    // eta: Ideal mode -> user efficiency input; Real mode -> efficiency computed by the loss model above.
    var Pa = ilout * (vout + Uf) / (eta / 100);
    var Pa_tr = Pa * Math.min(1, Vr / vin_min);
    var VeOpt = 52000 * Math.pow(Pa_tr / 800, 1.2) * Math.sqrt(50000 / f_hz);
    var Vds_max_wc = vin_max + 2 * Vr;

    var setT = function (id, v) { var e = document.getElementById(id); if (e) e.innerText = v; };
    setT('lOutput', lOutput.toFixed(2));
    setT('cOutput', cOutput.toFixed(2));
    setT('rOutput', rOutput.toFixed(2));
    setT('deltaILMax', op.rip.toFixed(2));
    setT('nOutput', n.toFixed(3));
    setT('wmax1', wmax1.toFixed(2));
    setT('vrefl', Vr.toFixed(2));
    setT('vdsmax', Vds_max_wc.toFixed(2));
    setT('VeOpt', VeOpt.toFixed(2));
    setT('f', f_hz.toFixed(2));
    window.lOutput_global = lOutput;
    window.wmax1_global = wmax1;

    var iinEl = document.getElementById('iin');
    if (iinEl) { iinEl.innerText = calculated_Iin.toFixed(2); document.getElementById('iin_container').style.display = "inline"; }

    window.weinbergLastCalc = {
        Vin: Ue, Vin_min: vin_min, Vin_max: vin_max, Vout: vout, Iout: ilout, fs: f_hz, L: L_H, n: n, Vr: Vr,
        D2nom: D2_nom, Dfet: op.Dfet, mode: actualMode,
        Imin: op.Imin, Imax: Imax_wc, Q_Irms: op.q_rms, Np_Irms: op.np_rms, Ns_Irms: op.ns_rms,
        Vds_max: Vds_max_wc, VeOpt: VeOpt,
        t1: op.t1, Ip: op.Ip, Iin: op.Iin, cOut_uF: cOutput
    };
    window.weinbergDnom = D2_nom;

    var wf = generateAllWaveforms(Ue, vout, n, f_hz, op, ilout);
    drawCharts(wf, ilout, effData);
    updateResultTable(wf);
}

// ================================================================
// WAVEFORMS  (two switching periods = four half periods, Q1 / Q2 alternate)
// ================================================================
function generateAllWaveforms(vin, vout, n, f, op, iout) {
    var Vr = op.Vr, T2 = op.T2, t1 = op.t1, t2 = op.t2, tdead = op.tdead;
    var Imin = op.Imin, Imax = op.Imax;
    var labels = [], v_np = [], v_np1 = [], vds1 = [], vds2 = [], i_np = [], i_q1 = [], i_q2 = [], i_ns = [], i_d12 = [], i_d3 = [];

    function push(t, vnp, vnp1, v1, v2, inp, iq1, iq2, ins, id12, id3) {
        labels.push((t * 1e6).toFixed(2));
        v_np.push(vnp); v_np1.push(vnp1); vds1.push(v1); vds2.push(v2);
        i_np.push(inp); i_q1.push(iq1); i_q2.push(iq2); i_ns.push(ins); i_d12.push(id12); i_d3.push(id3);
    }

    for (var h = 0; h < 4; h++) {
        var q = h % 2;                 // 0: Q1 conducts in t1, 1: Q2 conducts in t1
        var t0 = h * T2;
        var sgn = q === 0 ? 1 : -1;    // Np1 voltage polarity pattern (+Vr,-Vr,-Vr,+Vr)
        var k;
        // t1
        for (k = 0; k < 50; k++) {
            var fr = k / 50, i = Imin + (Imax - Imin) * fr;
            push(t0 + fr * t1, vin - Vr, sgn * Vr,
                q === 0 ? 0 : 2 * Vr, q === 1 ? 0 : 2 * Vr,
                i, q === 0 ? i : 0, q === 1 ? i : 0, 0, q === 0 ? n * i : 0, 0);
        }
        // t2: flyback energy delivered by Ns through D3
        var N2 = Math.max(10, Math.round(50 * t2 / Math.max(t1, 1e-12)));
        N2 = Math.min(N2, 80);
        for (k = 0; k < N2; k++) {
            var fr2 = k / N2, is = n * (Imax - (Imax - Imin) * fr2);
            push(t0 + t1 + fr2 * t2, -Vr, -sgn * Vr,
                q === 0 ? vin + 2 * Vr : vin, q === 1 ? vin + 2 * Vr : vin,
                0, 0, 0, is, 0, is);
        }
        // dead time (DCM only)
        if (tdead > 1e-12) {
            for (k = 0; k < 20; k++) {
                var fr3 = k / 20, ring = 2 * Vr * Math.exp(-6 * fr3) * Math.cos(2 * Math.PI * 3 * fr3);
                push(t0 + t1 + t2 + fr3 * tdead, 0, -sgn * Vr,
                    q === 0 ? vin + ring : vin, q === 1 ? vin + ring : vin, 0, 0, 0, 0, 0, 0);
            }
        }
    }
    return { labels: labels, vl1: v_np, vl2: v_np1, vds1: vds1, vds2: vds2, i1: i_np, iq1: i_q1, iq2: i_q2, i2: i_ns, id12: i_d12, id3: i_d3 };
}

// ================================================================
// CHARTS
// ================================================================
function drawCharts(wf, ilout, effData) {
    var N = wf.labels.length;
    var tickStep = Math.max(1, Math.floor(N / 8));
    var textColor = '#e0e0e0', gridColor = 'rgba(255, 255, 255, 0.1)', refLineColor = 'rgba(255, 255, 255, 0.5)';

    function baseOpts(yTitle) {
        return {
            responsive: true, animation: false,
            elements: { point: { radius: 0 }, line: { tension: 0 } },
            scales: {
                x: { type: 'category', ticks: { color: textColor, maxTicksLimit: 9, callback: function (v, i) { return (i % tickStep === 0) ? wf.labels[i] + "µs" : ''; } }, title: { display: true, text: 'Time (µs)', color: textColor }, grid: { color: gridColor, borderColor: gridColor } },
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

    mk('vinChart', [
        { label: 'V_Np (Flyback)', data: wf.vl1, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false },
        { label: 'V_Np1 (Push-Pull)', data: wf.vl2, borderColor: 'rgba(186, 104, 200, 1)', borderWidth: 1.5, fill: false }
    ], 'Voltage (V)');

    mk('vdsChart', [
        { label: 'Vds Q1', data: wf.vds1, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: false },
        { label: 'Vds Q2', data: wf.vds2, borderColor: 'rgba(255, 238, 88, 1)', borderWidth: 1.5, fill: false }
    ], 'Voltage (V)');

    mk('ilChart', [
        { label: 'I_Np (Flyback)', data: wf.i1, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, fill: false },
        { label: 'I_Q1', data: wf.iq1, borderColor: 'rgba(255, 138, 101, 1)', borderWidth: 1.5, fill: false }
    ], 'Current (A)');

    mk('idChart', [
        { label: 'I_Ns = I_D3 (Flyback)', data: wf.i2, borderColor: 'rgba(105, 240, 174, 1)', borderWidth: 2, fill: false },
        { label: 'I_D1 (Push-Pull)', data: wf.id12, borderColor: 'rgba(77, 208, 225, 1)', borderWidth: 1.5, fill: false },
        { label: 'Iout', data: Array(N).fill(ilout), borderColor: refLineColor, borderWidth: 1.5, borderDash: [6, 3], fill: false, pointRadius: 0 }
    ], 'Current (A)');

    var effCanvas = document.getElementById('effChart');
    if (effCanvas) {
        if (effCanvas.chart) { effCanvas.chart.destroy(); effCanvas.chart = null; }
        effCanvas.chart = new Chart(effCanvas.getContext('2d'), {
            type: 'line',
            data: { labels: effData.labels, datasets: [{ label: 'Efficiency vs Load', data: effData.values, borderColor: 'rgba(129, 199, 132, 1)', backgroundColor: 'rgba(129, 199, 132, 0.15)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: 'rgba(129, 199, 132, 1)' }] },
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
    var step = Math.max(1, Math.floor(N / 40));
    for (var i = 0; i <= 40; i++) {
        var idx = Math.min(i * step, N - 1);
        var row = tbody.insertRow(-1);
        row.insertCell(0).innerHTML = wf.labels[idx] + " µs";
        row.insertCell(1).innerHTML = (wf.vl1[idx] || 0).toFixed(2) + " V";
        row.insertCell(2).innerHTML = (wf.vds1[idx] || 0).toFixed(2) + " V";
        row.insertCell(3).innerHTML = (wf.i1[idx] || 0).toFixed(2) + " A";
        row.insertCell(4).innerHTML = (wf.i2[idx] || 0).toFixed(2) + " A";
    }
}

// ================================================================
// CIRCUITJS (FALSTAD) WEINBERG CONVERTER INTEGRATION
// Template: current-fed push-pull (2 x T, ungapped) + flyback coupled inductor (1 x T, gapped)
//  - Falstad "primary" (top coil of the vertical T) = Ns, "secondary" (bottom coil) = Np
//    ratio = N2/N1 -> flyback T: ratio = n = Np/Ns, push-pull T: ratio = 1/n
//  - push-pull transformers use flags=4 (reversed dot): the original template with flags=0
//    never lets D1/D2 conduct while their own FET is on.
//  - coupling 0.9999: with 0.999 the leakage of the push-pull magnetizing inductance
//    (0.2 % of Lm) becomes comparable with Lp and the output collapses.
// ================================================================
var falstadSim = null;
var WB_IMAG_PP = 0.02;        // push-pull magnetizing ripple, fraction of the pulse current (sizes Lm in the simulation)
var WB_COUPLING = 0.9999;
var WB_PP_FLAGS = 4;          // set to 0 to get the original (unflipped) template

function embedFalstadSimulation(circuitString) {
    var encodedCircuit = encodeURIComponent(circuitString);
    var iframe = document.getElementById("circuitFrame");
    iframe.src = "/falstad/circuitjs.html?hideHeader=true&hideControls=false&noPowerCheck=true&cct=" + encodedCircuit;
    iframe.contentWindow.oncircuitjsloaded = function () {
        falstadSim = iframe.contentWindow.CircuitJS1;
    };
}

function wbNice(x, step) { return Math.max(step, Math.ceil(x / step) * step); }

function openFalstadWeinbergSimulation() {
    if (!window.weinbergLastCalc) { updateChartsAndTable(); }
    var c = window.weinbergLastCalc;
    if (!c) { alert(wbT().calcFirst); return; }

    var f = c.fs, n = c.n, Vin = c.Vin, Vout = c.Vout, Iout = c.Iout;
    var T2 = 1 / (2 * f);
    var Lp = c.L;                                   // Np, gapped coupled inductor
    var Ls = Lp / (n * n);                          // Ns
    var Lm = Math.min(5e-3, Math.max(50e-6, c.Vr * T2 / (WB_IMAG_PP * c.Ip)));   // push-pull magnetizing (per half)
    var ratioPP = 1 / n;
    var duty = Math.min(0.49, Math.max(0.02, c.t1 * f));                        // per FET (t1 per half period)
    var Rload = Vout / Iout;
    var Cout = Math.max(c.cOut_uF, 1) * 1e-6;
    var Cin = Math.max(2e-6, Math.min(1e-3, (c.Ip - c.Iin) * c.t1 / (0.01 * Vin)));
    var Ron = Math.max(0.001, getRealParams().Ron_H);
    var ts = (1 / (f * 100)).toExponential(3);
    var vsDs = wbNice(c.Vds_max * 1.1, 10), vsOut = wbNice(Vout * 1.2, 10);
    var isc = Math.max(0.5, Math.ceil(c.Imax * 0.5 * 2) / 2);

    document.getElementById("simulationContainer").style.display = "block";
    var box = document.getElementById("liveDataBox");
    box.style.display = "block";
    box.innerHTML = "Fitcore SMPS Designer: WEINBERG Converter (current-fed push-pull + flyback coupled inductor)<br/>" +
        "Np/Ns = " + n.toFixed(3) + " | Lp = " + (Lp * 1e6).toFixed(2) + " μH | Lm(push-pull) = " + (Lm * 1e6).toFixed(0) + " μH | duty/FET = " + duty.toFixed(3) +
        " | Vr = " + c.Vr.toFixed(2) + " V | Vds,max = " + c.Vds_max.toFixed(1) + " V<br/>" +
        "Open loop, ideal duty: simulated Vout will be a few % below " + Vout + " V (diode drops, Ron, leakage).";
    if (document.getElementById("simulationContainer").scrollIntoView) {
        document.getElementById("simulationContainer").scrollIntoView({ behavior: 'smooth' });
    }

    var el = [];
    function add(s) { el.push(s); return el.length - 1; }
    var k = WB_COUPLING;
    var iBat = add('v 64 432 64 224 0 0 40 ' + Vin + ' 0 0 0.5');
    add('d 128 96 480 96 2 default');                                                    // D3
    add('d 352 160 480 160 2 default');                                                  // D1
    add('d 352 288 480 288 2 default');                                                  // D2
    add('T 256 160 352 224 ' + WB_PP_FLAGS + ' ' + Lm + ' ' + ratioPP.toFixed(5) + ' 0 0 ' + k);   // push-pull Np1/Ns1
    add('T 256 224 352 288 ' + WB_PP_FLAGS + ' ' + Lm + ' ' + ratioPP.toFixed(5) + ' 0 0 ' + k);   // push-pull Np2/Ns2
    add('T 176 176 128 224 28 ' + Ls + ' ' + n.toFixed(5) + ' 0 0 ' + k);                // flyback: top = Ns, bottom = Np
    var iQ2 = add('159 288 336 288 368 2 ' + Ron + ' 1e10 2.5');
    var iCin = add('c 128 224 128 432 0 ' + Cin + ' ' + Vin);
    var iCout = add('c 544 160 544 224 0 ' + Cout + ' ' + Vout);
    [['480 96 480 160'], ['480 160 480 288'], ['368 224 544 224'], ['480 160 544 160'], ['368 224 368 128'], ['368 128 176 128'],
     ['176 128 176 176'], ['352 224 368 224'], ['256 160 208 160'], ['208 160 208 384'], ['256 224 176 224'], ['128 96 128 176'],
     ['256 288 256 320'], ['256 320 288 320'], ['288 368 288 432'], ['288 432 208 432'], ['208 432 128 432'], ['128 224 64 224'],
     ['128 432 64 432']].forEach(function (w) { add('w ' + w[0] + ' 0'); });
    add('g 64 432 64 448 0');
    add('g 544 224 544 240 0');
    add('R 192 400 160 400 0 2 ' + f + ' 2.5 2.5 0 ' + duty.toFixed(4));                // Q1 gate
    add('R 272 352 240 352 0 2 ' + f + ' 2.5 2.5 3.14159265 ' + duty.toFixed(4));       // Q2 gate (180 deg)
    add('d 304 368 304 336 2 default');                                                  // Q2 body diode
    add('w 288 320 288 336 0'); add('w 288 336 304 336 0'); add('w 288 368 304 368 0');
    add('w 208 416 224 416 0'); add('w 208 384 224 384 0');
    add('d 224 416 224 384 2 default');                                                  // Q1 body diode
    var iQ1 = add('159 208 384 208 416 2 ' + Ron + ' 1e10 2.5');
    add('w 208 416 208 432 0');
    add('r 608 160 608 224 0 ' + Rload.toFixed(4));                                       // load
    add('w 544 160 608 160 0'); add('w 544 224 608 224 0');

    var scopes = [
        'o ' + iCout + ' 1 0 34 ' + vsOut + ' 0.05 0 -1',
        'o ' + iQ1 + ' 1 0 34 ' + vsDs + ' 0.05 1 -1',
        'o ' + iBat + ' 1 0 33 ' + isc + ' 0.1 2 -1'
    ];
    var header = '$ 1 ' + ts + ' 10.2 50 5 50 5e-11';
    embedFalstadSimulation([header].concat(el, scopes).join('\n'));
}

// ================================================================
// MAIN TRIGGER AND UI MODAL INTEGRATION
// ================================================================
function hesapla() {
    if (!checkUserInput()) { setDefaultValues(); }
    updateChartsAndTable();
    if (typeof window.openSelectedTable === "function") window.openSelectedTable();
}

window.openSelectedTable = function () {
    var modeElement = document.querySelector('input[name="coreSelectionMode"]:checked');
    var mode = modeElement ? modeElement.value : "standard";
    var chk = document.getElementById("testOwnDesignCheck");
    var isCustomDesign = chk ? chk.checked : false;

    var lStr = document.getElementById('lOutput') && document.getElementById('lOutput').innerText;
    var veStr = document.getElementById('VeOpt') && document.getElementById('VeOpt').innerText;
    if (!lStr || isNaN(parseFloat(lStr)) || !veStr || isNaN(parseFloat(veStr)) || !window.weinbergLastCalc) {
        alert(window.getT && window.getT('adv_alert_calc_first') !== 'adv_alert_calc_first' ? window.getT('adv_alert_calc_first') : wbT().calcFirst);
        return;
    }

    if (mode === "advanced") {
        // Generic "transformer + coil" path of advanced_optimizer.js (VeOpt + wmax1 present on the page).
        if (isCustomDesign) {
            if (typeof window.openAdvancedPreCheck === "function") window.openAdvancedPreCheck('weinberg');
            else alert("Advanced module could not be loaded.");
        } else {
            window.customSelections = { core: null, coreL1: null, coreL2: null, coreTrafo: null, coreCoil: null, switch: null };
            if (typeof window.openAdvancedTable === "function") window.openAdvancedTable();
            else alert("Advanced module could not be loaded.");
        }
        return;
    }

    var c = window.weinbergLastCalc;
    var L_uH = parseFloat(lStr);

    // Tab 1: flyback coupled inductor (GAPPED) -> UIModal 'flyback' tab
    var coilParams = {
        title: wbT().coil,
        L_uH: L_uH, L_H: L_uH * 1e-6,
        Wmax: window.wmax1_global,
        Imax: window.Imax_global,
        nOutput: c.n,
        I1_rms_sq: Math.pow(window.il_rms, 2),
        I2_rms_sq: Math.pow(window.i2_rms_calc, 2),
        d1_req: window.wb_d_np || 0.5,
        d2_req: window.wb_d_ns || 0.5,
        max_litz: window.max_wire_d_mm || 0.5,
        userMode: document.getElementById("mode") ? document.getElementById("mode").value : "continuous"
    };

    // Tab 2: push-pull transformer (UNGAPPED) -> UIModal 'trafo' tab; winding sees +/-Vr
    var trafoParams = {
        title: wbT().trafo,
        topology: 'push_pull',
        VeOpt: parseFloat(veStr),
        f_hz: c.fs,
        vin_min: c.Vr,
        vin1: c.Vr,
        nOutput: c.n,
        I1_rms_sq: Math.pow(window.i1_rms_global, 2),
        I2_rms_sq: Math.pow(window.i2_rms_global, 2),
        d1_req: window.d1_req || 0.5,
        d2_req: window.d2_req || 0.5,
        max_litz: window.max_wire_d_mm || 0.5
    };

    if (typeof UIModal !== 'undefined' && UIModal.openDualModal) {
        UIModal.openDualModal([
            { type: 'flyback', title: coilParams.title, params: coilParams },
            { type: 'trafo', title: trafoParams.title, params: trafoParams }
        ]);
    } else {
        alert("UI module (UIModal) could not be loaded.");
    }
};

// ================================================================
// EVENT LISTENERS
// ================================================================
document.getElementById('calculateButton').addEventListener('click', updateChartsAndTable);
document.getElementById('printButton').addEventListener('click', function () { window.print(); });
document.getElementById('openButton').addEventListener('click', window.openSelectedTable);
