// ================================================================
// SAB (SINGLE ACTIVE BRIDGE) CONVERTER CALCULATOR
// SPDX-License-Identifier: AGPL-3.0-only
// ----------------------------------------------------------------
// Model: full bridge (active) primer + diode bridge seconder, series L (for primer),
//        capacitif output filter. There is NO output inductor!
// Reference (Rodriguez et al., Electronics 2022, 11, 601):
//   n  = N2/N1 (seconder/primer), 1:n.  Vr = (Vo + 2·Vf)/n
//   d  = tc/Ts  (d < 0.5),  N = Vo/(n*Vg)
//   k  = 2 L n^2 / (RL * Ts/2)
//   CCM: N = 4(1-d)d / (k + sqrt(k^2 + 4(1-d)d))      (19)
//   DCM: N = 2d / (d + sqrt(d^2 + k))                  (23)
//   line: N = 2 d_crit                                (26)
//   design: n = Vxmax/(2 Vgmin dcritmax) (59),  L = [Vgmin dmax(1-dmax) - Vxmax^2/(4 Vgmin n^2)]/(2 n f Iomax) (60),  Vx = Vo + 2·Vf
//   Mode (CCM/CRM/DCM)
// Also Jha et al., Energies 2022, 15, 666 pu equations (Po,pu=(pi/4)Vo,pu[2b-Vo,pu^2-b^2]) (b = 2*pi*d).
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
window.sabVeq = 0;
window.sabSwitchIrms = 0;
window.sabDutyNom = 0.25;
window.sabDutyEff = 0.5;

// ================================================================
// Core model
// ================================================================
// Mode target: Icrit(nominal Vin/Vout) / I_out,max
//   ccm : 0.5
//   crm : 1.0
//   dcm : 1.5
var SAB_MODE_TARGET = { ccm: 0.5, crm: 1.0, dcm: 1.5 };

function sabSolvePoint(Vg, Vo, Io, n, L, f, Vf) {
    Vf = Vf || 0;
    var Vx = Vo + 2 * Vf;
    var Vr = Vx / n;
    if (!(Vg > 0) || !(Vo > 0) || !(n > 0) || !(L > 0) || !(f > 0)) return { ok: false, reason: "param" };
    if (Vr >= Vg) return { ok: false, reason: "gain" };   // N >= 1: SAB just step-down
    var Ts = 1 / f, h = Ts / 2;
    var d, mode, shape;

    var dDcm = Math.sqrt(Math.max(0, Io * Vx * L * f / (Vg * (Vg - Vr))));
    if (Vr / Vg >= 2 * dDcm * 0.995) {
        shape = "DCM"; d = dDcm;
        mode = (Vr / Vg - 2 * dDcm <= 0.005 * (Vr / Vg)) ? "CRM" : "DCM";
    } else {
        var X = 2 * n * L * f * Io + (Vr * Vr) / (4 * Vg);
        var disc = 1 - 4 * X / Vg;
        if (disc < 0) return { ok: false, reason: "power" };
        d = (1 - Math.sqrt(disc)) / 2;
        shape = "CCM"; mode = "CCM";
    }
    if (d >= 0.5) return { ok: false, reason: "dmax", d: d };

    var a = d * Ts;
    var seg = [];           // {t0,t1,i0,i1,k}  k: A,B,C
    var I0 = 0, iL2 = 0, t1 = 0, tf = 0;
    if (shape === "CCM") {
        I0 = (Vg + Vr) * (Vg * a - Vr * h) / (2 * Vg * L);
        t1 = L * I0 / (Vg + Vr);
        iL2 = (Vg - Vr) * (a - t1) / L;
        seg.push({ t0: 0, t1: t1, i0: -I0, i1: 0, k: "A" });
        seg.push({ t0: t1, t1: a, i0: 0, i1: iL2, k: "B" });
        seg.push({ t0: a, t1: h, i0: iL2, i1: I0, k: "C" });
    } else {
        iL2 = (Vg - Vr) * a / L;
        tf = iL2 * L / Vr;
        seg.push({ t0: 0, t1: a, i0: 0, i1: iL2, k: "B" });
        seg.push({ t0: a, t1: a + tf, i0: iL2, i1: 0, k: "C" });
    }

    var sumAbs = { A: 0, B: 0, C: 0 }, sumSq = { A: 0, B: 0, C: 0 };
    for (var s = 0; s < seg.length; s++) {
        var g = seg[s], tau = g.t1 - g.t0;
        sumAbs[g.k] += tau * (Math.abs(g.i0) + Math.abs(g.i1)) / 2;
        sumSq[g.k] += tau * (g.i0 * g.i0 + g.i0 * g.i1 + g.i1 * g.i1) / 3;
    }
    var totSq = sumSq.A + sumSq.B + sumSq.C;
    var totAbs = sumAbs.A + sumAbs.B + sumAbs.C;
    var iLrms = Math.sqrt(totSq / h);
    var iLabs = totAbs / h;                 // |iL| avg.

    var dev = {
        Slag: { avg: sumAbs.B / Ts, rms: Math.sqrt(sumSq.B / Ts) },                         // S1,S2
        Slead: { avg: (sumAbs.B + sumAbs.C) / Ts, rms: Math.sqrt((sumSq.B + sumSq.C) / Ts) }, // S3,S4
        DSlag: { avg: (sumAbs.A + sumAbs.C) / Ts, rms: Math.sqrt((sumSq.A + sumSq.C) / Ts) }, // DS1,DS2
        DSlead: { avg: sumAbs.A / Ts, rms: Math.sqrt(sumSq.A / Ts) }                        // DS3,DS4
    };

    return {
        ok: true, mode: mode, shape: shape, d: d, N: Vr / Vg, Vr: Vr, Vx: Vx, Vf: Vf, Vg: Vg, Vo: Vo, n: n, L: L, f: f, Ts: Ts, h: h, a: a,
        I0: I0, iL2: iL2, t1: t1, tf: tf, seg: seg,
        iLrms: iLrms, iLpeak: Math.max(iL2, I0), Io: iLabs / n,
        Idpk: Math.max(iL2, I0) / n, dev: dev,
        Ilead_comm: (shape === "CCM") ? I0 : 0,       // leading
        Ilag_comm: iL2,                               // (turn-off)
        Veq: Math.min(Vr, 2 * d * Vg),
        Icrit: Math.pow(Vr / Vg / 2, 2) * Vg * (Vg - Vr) / (Vx * L * f)
    };
}

// CCM/DCM (Vg, Vx=Vo+2Vf, n, L)
function sabIcrit(Vg, Vx, n, L, f) {
    var Vr = Vx / n;
    if (Vr >= Vg) return Infinity;
    var N = Vr / Vg;
    return (N / 2) * (N / 2) * Vg * (Vg - Vr) / (Vx * L * f);
}

// Rodriguez Eq.(60)
function sabLForDmax(Vgmin, Vxmax, Iomax, f, n, dmax) {
    var Vr = Vxmax / n;
    if (Vr / Vgmin >= 2 * dmax) return Vgmin * (Vgmin - Vr) * dmax * dmax / (Vxmax * f * Iomax);
    return (Vgmin * dmax * (1 - dmax) - Vr * Vr / (4 * Vgmin)) / (2 * n * f * Iomax);
}

function sabDesignByMode(sp, mode) {
    var target = SAB_MODE_TARGET[mode] || 0.5;
    var Vxmax = sp.Vomax + 2 * sp.Vf, Vxn = sp.Von + 2 * sp.Vf;
    var hiLim = Math.min(0.449, 0.999 * Math.sqrt(sp.dmax * (1 - sp.dmax)));
    function ratio(dc) {
        var n = Vxmax / (2 * sp.Vgmin * dc);
        var L = sabLForDmax(sp.Vgmin, Vxmax, sp.Io, sp.f, n, sp.dmax);
        if (!(L > 0)) return { r: NaN, n: n, L: L };
        return { r: sabIcrit(sp.Vgn, Vxn, n, L, sp.f) / sp.Io, n: n, L: L };
    }
    var lo = 0.02, hi = hiLim, clamped = false;
    var rl = ratio(lo), rh = ratio(hi);
    var dc;
    if (rl.r >= target) { dc = lo; clamped = true; }
    else if (!(rh.r < Infinity) || rh.r <= target) { dc = hi; clamped = true; }
    else {
        for (var it = 0; it < 80; it++) {
            dc = 0.5 * (lo + hi);
            var r = ratio(dc).r;
            if (!(r < Infinity) || r > target) hi = dc; else lo = dc;
        }
        dc = 0.5 * (lo + hi);
    }
    var res = ratio(dc);
    return { n: res.n, L: res.L, dcrit: dc, clamped: clamped };
}

function sabWaveforms(pt, count) {
    count = count || 400;
    var t_arr = [], vb = [], v2 = [], il = [], ir = [], phiA = [];
    var Ts = pt.Ts, h = pt.h;
    var bx = [], by = [];
    for (var s = 0; s < pt.seg.length; s++) {
        bx.push(pt.seg[s].t0); by.push(pt.seg[s].i0);
        if (s === pt.seg.length - 1) { bx.push(pt.seg[s].t1); by.push(pt.seg[s].i1); }
    }
    if (pt.shape === "DCM") { bx.push(h); by.push(0); }
    function g(t) {
        for (var i = 0; i < bx.length - 1; i++) {
            if (t >= bx[i] && t <= bx[i + 1]) {
                var w = (bx[i + 1] - bx[i]) || 1e-30;
                return by[i] + (by[i + 1] - by[i]) * (t - bx[i]) / w;
            }
        }
        return by[by.length - 1];
    }
    var cum = 0, cumArr = [], dt = Ts / count;
    for (var i = 0; i <= count; i++) {
        var t = i * dt, tm = t % Ts;
        var second = tm >= h, ph = second ? tm - h : tm;
        var sgn = second ? -1 : 1;
        var iL = sgn * g(ph);
        var vB = (ph < pt.a) ? sgn * pt.Vg : 0;
        var v2r;
        if (pt.shape === "CCM") {
            var pos = (ph >= pt.t1);
            v2r = sgn * (pos ? pt.Vr : -pt.Vr);
        } else {
            v2r = (ph < pt.a + pt.tf) ? sgn * pt.Vr : 0;
        }
        t_arr.push((t * 1e6).toFixed(2));
        vb.push(vB); v2.push(v2r); il.push(iL); ir.push(Math.abs(iL) / pt.n);
        phiA.push(pt.shape === "CCM" ? 360 * pt.t1 / Ts : 0);
        if (i > 0) cum += (ir[i] - pt.Io) * dt;
        cumArr.push(cum);
    }
    var dQ = Math.max.apply(null, cumArr) - Math.min.apply(null, cumArr);
    return { t: t_arr, vb: vb, v2: v2, il: il, ir: ir, phi: phiA, dQ: dQ };
}

// real loss model (Gil et al., Electronics 2022, 11, 601; Rodriguez et al., Electronics 2022, 11, 601)
function sabRealLosses(pt, p) {
    var Vg = pt.Vg, f = pt.f, Pout = pt.Vo * pt.Io;
    var Ec = p.Coss_pri * (Vg * Vg + 2 * Vg * pt.Vr);              // Gil et al. Eq.(17) ZVS
    var zvsLead = (pt.shape === "CCM") && (0.5 * pt.L * pt.I0 * pt.I0 > Ec);
    var zvsLag = (0.5 * pt.L * pt.iL2 * pt.iL2 > Ec);

    var Pon_pri = 2 * Math.pow(pt.dev.Slag.rms, 2) * p.Ron_pri + 2 * Math.pow(pt.dev.Slead.rms, 2) * p.Ron_pri;
    var Pbody = 2 * p.Vf_body * pt.dev.DSlag.avg + 2 * p.Vf_body * pt.dev.DSlead.avg;

    // Turn-off
    var Psw_off = Vg * p.tf * f * (pt.Ilag_comm + pt.Ilead_comm);
    var Psw_on = 0, Pcoss = 0;
    if (!zvsLead) { Psw_on += f * Vg * pt.Ilead_comm * p.tr; Pcoss += 2 * 0.5 * p.Coss_pri * Vg * Vg * f; }
    if (!zvsLag) { Psw_on += f * Vg * pt.Ilag_comm * p.tr; Pcoss += 2 * 0.5 * p.Coss_pri * Vg * Vg * f; }
    var Psw_pri = Psw_on + Psw_off;

    var iDrms = pt.iLrms / (pt.n * Math.SQRT2);
    var Pdiode = 4 * (p.Vf_d * pt.Io / 2 + p.Rd * iDrms * iDrms);
    var I2rms = pt.iLrms / pt.n;
    var Ptr = pt.iLrms * pt.iLrms * p.DCR_pri + I2rms * I2rms * p.DCR_sec;
    var Pl = pt.iLrms * pt.iLrms * p.DCR_ind;
    var Pgate = 4 * p.Qg * p.Vgs * f;
    var Pic = Vg * p.Icc;
    var icout2 = I2rms * I2rms - pt.Io * pt.Io; if (icout2 < 0) icout2 = 0;
    var Pcout = icout2 * p.ESR_Cout;

    var Ptotal = Pon_pri + Pbody + Psw_pri + Pcoss + Pdiode + Ptr + Pl + Pgate + Pic + Pcout;
    return {
        totalLossW: Ptotal,
        efficiencyPercent: Math.max(0, Pout / (Pout + Ptotal) * 100),
        zvsLead: zvsLead, zvsLag: zvsLag, Icout_rms: Math.sqrt(icout2),
        breakdown: { Pon_pri: Pon_pri, Pbody: Pbody, Psw_pri: Psw_pri, Pcoss: Pcoss, Pdiode: Pdiode, Ptr_dcr: Ptr, Pl_dcr: Pl, Pgate: Pgate, Pic: Pic, Pcout: Pcout }
    };
}

// ================================================================
// UI YARDIMCILARI
// ================================================================
function sabEl(id) { return document.getElementById(id); }
function sabNum(id, def) { var e = sabEl(id); var v = e ? parseFloat(e.value) : NaN; return isNaN(v) ? def : v; }

function toggleEffMode() {
    var mode = sabEl("effMode").value;
    if (mode === "ideal") {
        sabEl("idealInputGroup").style.display = "contents";
        sabEl("realInputGroup").style.display = "none";
        sabEl("powerLossSection").style.display = "none";
    } else {
        sabEl("idealInputGroup").style.display = "none";
        sabEl("realInputGroup").style.display = "block";
        sabEl("powerLossSection").style.display = "flex";
    }
}

window.toggleCustomDesign = function () {
    var chk = sabEl("testOwnDesignCheck");
    var on = chk ? chk.checked : false;
    var box = sabEl("inductance");
    if (box) box.style.display = on ? "flex" : "none";
};

window.addEventListener('DOMContentLoaded', function () {
    window.toggleEffMode();
    window.toggleCustomDesign();
});

function checkUserInput() {
    var ids = ['vin_min', 'vin_max', 'vout_min', 'vout_max', 'ilout', 'f_khz'];
    for (var i = 0; i < ids.length; i++) { if (isNaN(parseFloat(sabEl(ids[i]).value))) return false; }
    return true;
}

function setDefaultValues() {
    sabEl('vin_min').value = 760;
    sabEl('vin_max').value = 840;
    sabEl('vin_nom').value = 800;
    sabEl('vout_min').value = 350;
    sabEl('vout_max').value = 400;
    sabEl('vout_nom').value = 380;
    sabEl('ilout').value = 5.5;
    sabEl('f_khz').value = 33;
    sabEl('d_max').value = 0.45;
    sabEl('verim').value = 96;
    sabEl('mode').value = "ccm";
}

function sabGetVf() {
    var m = sabEl("effMode") ? sabEl("effMode").value : "ideal";
    return (m === "real") ? Math.max(0, sabNum('p_vf_d', 0.8)) : 0;
}

function getRealParamsSAB() {
    return {
        Ron_pri: sabNum('p_ron_pri', 0.099),
        Vf_body: sabNum('p_vf_body', 0.9),
        Coss_pri: sabNum('p_coss_pri', 100) * 1e-12,
        Qg: sabNum('p_qg', 30) * 1e-9,
        Vgs: sabNum('p_vgs', 10),
        tr: sabNum('p_tr', 20) * 1e-9,
        tf: sabNum('p_tf', 20) * 1e-9,
        Vf_d: sabNum('p_vf_d', 0.8),
        Rd: sabNum('p_rd', 0.010),
        DCR_pri: sabNum('p_dcr_pri', 0.050),
        DCR_sec: sabNum('p_dcr_sec', 0.005),
        DCR_ind: sabNum('p_dcr_ind', 0.020),
        ESR_Cout: sabNum('p_esrcout', 0.003),
        Icc: sabNum('p_icc', 5.0) * 1e-3
    };
}

function generateEfficiencyVsPowerCurve(spec, design, verim_pct, isIdeal) {
    var labels = [], values = [];
    var params = isIdeal ? null : getRealParamsSAB();
    var Pnom = spec.Vo_nom * spec.Io;
    var lossNom = Pnom * (100 / verim_pct - 1);
    for (var percent = 10; percent <= 120; percent += 5) {
        var Io_p = spec.Io * percent / 100;
        var pt = sabSolvePoint(spec.Vg_nom, spec.Vo_nom, Io_p, design.n, design.L, spec.Fs, spec.Vf);
        if (!pt.ok) continue;
        var P = spec.Vo_nom * Io_p;
        labels.push(percent + "%");
        if (isIdeal) {
            var loss = lossNom * (0.3 + 0.7 * Math.pow(percent / 100, 2));
            values.push((P / (P + loss) * 100).toFixed(2));
        } else {
            values.push(sabRealLosses(pt, params).efficiencyPercent.toFixed(2));
        }
    }
    return { labels: labels, values: values };
}

// ================================================================
// Main Calculation Function
// ================================================================
function updateChartsAndTable() {
    var vin_min = sabNum('vin_min', 0), vin_max = sabNum('vin_max', 0);
    var vout_min = sabNum('vout_min', 0), vout_max = sabNum('vout_max', 0);
    var ilout = sabNum('ilout', 0), f_khz = sabNum('f_khz', 0);
    var verim = sabNum('verim', 96);
    var dmax = Math.min(0.49, Math.max(0.1, sabNum('d_max', 0.45)));
    var effMode = sabEl("effMode").value;
    var modeSel = sabEl("mode").value;
    var getT = window.getT || function (k) { return k; };

    var vin_nom_in = sabNum('vin_nom', 0);
    var vin_nom = vin_nom_in > 0 ? vin_nom_in : (vin_min + vin_max) / 2;
    var vout_nom_in = sabNum('vout_nom', 0);
    var vout_nom = vout_nom_in > 0 ? vout_nom_in : (vout_min + vout_max) / 2;
    var Fs = f_khz * 1000;
    var pOutput = vout_nom * ilout;
    var rOutput = vout_nom / ilout;

    // ---- Design (n, L)
    var Vf = sabGetVf();
    var design = sabDesignByMode({ Vgmin: vin_min, Vgn: vin_nom, Vomax: vout_max, Von: vout_nom, Io: ilout, f: Fs, dmax: dmax, Vf: Vf }, modeSel);
    var isCustom = sabEl("testOwnDesignCheck") ? sabEl("testOwnDesignCheck").checked : false;
    var userL = isCustom ? sabNum('custom_L_uH', 0) : 0;
    var n = design.n;
    var L_H = userL > 0 ? userL * 1e-6 : design.L;
    var lOutput = L_H * 1e6;

    // ---- warnings
    var warnings = [];
    if (f_khz > 200) warnings.push("<strong>⚠️ " + getT("alert_freq_limit_title") + "</strong> " + getT("alert_freq_limit_desc"));
    var mk = (modeSel === "crm" || modeSel === "dcm") ? modeSel : "ccm";
    warnings.push("<strong>💡 " + getT("alert_sab_mode_" + mk + "_title") + "</strong> " + getT("alert_sab_mode_" + mk + "_desc"));
    if (design.clamped) {
        warnings.push("<strong>⚠️ " + getT("alert_sab_clamp_title") + "</strong> " + getT("alert_sab_clamp_desc"));
    }
    if (!(L_H > 0) || !(n > 0)) {
        warnings.push("<strong>⛔ " + getT("alert_sab_infeasible_title") + "</strong> " + getT("alert_sab_infeasible_desc"));
    }

    var spec = { Vg_nom: vin_nom, Vo_nom: vout_nom, Io: ilout, Fs: Fs, Vf: Vf };
    var dsg = { n: n, L: L_H };

    // ---- (Vg x Vo) @ Io = ilout
    var corners = [
        { v1: vin_min, v2: vout_min }, { v1: vin_min, v2: vout_max },
        { v1: vin_max, v2: vout_min }, { v1: vin_max, v2: vout_max }, { v1: vin_nom, v2: vout_nom }
    ];
    var Ipeak_max = 0, IrmsWorst = 0, SwRmsWorst = 0, Veq_max = 0, d_worst = 0, Idpk_max = 0, anyBad = false;
    for (var ci = 0; ci < corners.length; ci++) {
        var c = corners[ci];
        var pc = sabSolvePoint(c.v1, c.v2, ilout, n, L_H, Fs, Vf);
        if (!pc.ok) { anyBad = true; continue; }
        if (pc.d > dmax + 1e-9) anyBad = true;
        Ipeak_max = Math.max(Ipeak_max, pc.iLpeak);
        IrmsWorst = Math.max(IrmsWorst, pc.iLrms);
        SwRmsWorst = Math.max(SwRmsWorst, pc.dev.Slead.rms, pc.dev.Slag.rms);
        Veq_max = Math.max(Veq_max, pc.Veq);
        d_worst = Math.max(d_worst, pc.d);
        Idpk_max = Math.max(Idpk_max, pc.Idpk);
    }
    if (anyBad) warnings.push("<strong>⚠️ " + getT("alert_sab_dmax_title") + "</strong> " + getT("alert_sab_dmax_desc"));

    var warningDiv = sabEl("modeWarning");
    warningDiv.style.display = "block";
    warningDiv.innerHTML = warnings.join("<br><br>");

    // ---- Nominal point
    var nom = sabSolvePoint(vin_nom, vout_nom, ilout, n, L_H, Fs, Vf);
    if (!nom.ok) {
        warningDiv.innerHTML += "<br><br><strong>⛔ " + getT("alert_sab_infeasible_title") + "</strong> " + getT("alert_sab_infeasible_desc");
        ["lOutput", "cOutput", "rOutput", "Ipeak", "nOutput"].forEach(function (id) { sabEl(id).innerText = "-"; });
        sabEl('lOutput').innerText = lOutput.toFixed(2);
        sabEl('nOutput').innerText = (1 / n).toFixed(3) + " : 1";
        return;
    }
    var wf = sabWaveforms(nom, 400);
    var deltaVout = vout_nom * 0.01;
    var cOutput = (wf.dQ / deltaVout) * 1e6;

    // ---- efficiency vs. power
    var finalVerim = verim, effData, real = null;
    if (effMode === "ideal") {
        effData = generateEfficiencyVsPowerCurve(spec, dsg, verim, true);
        sabEl('loss').innerText = Math.abs(100 - verim).toFixed(2);
    } else {
        var params = getRealParamsSAB();
        effData = generateEfficiencyVsPowerCurve(spec, dsg, verim, false);
        real = sabRealLosses(nom, params);
        finalVerim = real.efficiencyPercent;
        var b = real.breakdown;
        var setR = function (id, v) { sabEl(id).innerText = v.toFixed(4) + " W"; };
        setR("res_pon_pri", b.Pon_pri); setR("res_pbody", b.Pbody); setR("res_psw_pri", b.Psw_pri);
        setR("res_pcoss", b.Pcoss); setR("res_pdiode", b.Pdiode); setR("res_ptr_dcr", b.Ptr_dcr);
        setR("res_pl_dcr", b.Pl_dcr); setR("res_pcout", b.Pcout); setR("res_pgate", b.Pgate); setR("res_pic", b.Pic);
        sabEl("res_ptotal").innerText = real.totalLossW.toFixed(4) + " W";
        sabEl("res_peff").innerText = real.efficiencyPercent.toFixed(2) + " %";
        sabEl('loss').innerText = Math.abs(100 - finalVerim).toFixed(2);
    }

    var wmax1 = 0.5 * L_H * Ipeak_max * Ipeak_max * 1e6;
    var Bmax_nom = 0.2 * Math.pow(50000 / Fs, 0.6);
    var Ap_req = (pOutput * 1e6) / (4 * Fs * Bmax_nom * 0.4 * 5);
    var VeOpt = 52000 * Math.pow(pOutput / 800, 1.2) * Math.sqrt(50000 / Fs);
    var iin = (pOutput / (finalVerim / 100)) / vin_nom;

    var J = MagneticUtils.getCurrentDensity(f_khz);
    window.il_rms = IrmsWorst;
    window.i1_rms_global = IrmsWorst;
    window.i2_rms_global = IrmsWorst / n;
    window.A1_req = window.i1_rms_global / J;
    window.A2_req = window.i2_rms_global / J;
    window.d1_req = 2 * Math.sqrt(window.A1_req / Math.PI);
    window.d2_req = 2 * Math.sqrt(window.A2_req / Math.PI);
    window.A_coil_req = window.il_rms / J;
    window.d_coil_req = 2 * Math.sqrt(window.A_coil_req / Math.PI);
    window.max_wire_d_mm = 2 * (65.6 / Math.sqrt(Fs));

    window.lOutput_global = lOutput;
    window.wmax1_global = wmax1;
    window.Imax_global = Ipeak_max;
    window.VeOpt_global = VeOpt;
    window.sabVeq = Veq_max;
    window.sabSwitchIrms = SwRmsWorst;
    window.sabDutyNom = nom.d;
    window.sabDutyEff = Math.min(0.5, nom.d / nom.N);   // iGSE effective duty: CCM 0.5, DCM <0.5
    window.sabN_paper = n;
    window.dabPhaseShift = 2 * Math.PI * nom.d;      // β = 2π·d (Jha et al.)

    // ---- Sonuç tabloları
    sabEl('lOutput').innerText = lOutput.toFixed(2);
    sabEl('cOutput').innerText = cOutput.toFixed(2);
    sabEl('rOutput').innerText = rOutput.toFixed(2);
    sabEl('Ipeak').innerText = Ipeak_max.toFixed(2);
    sabEl('nOutput').innerText = (1 / n).toFixed(3) + " : 1";          // N1/N2
    sabEl('wmax1').innerText = wmax1.toFixed(2);
    sabEl('vin1').innerText = vin_nom.toFixed(2);
    sabEl('VeOpt').innerText = VeOpt.toFixed(0);
    sabEl('ApOpt').innerText = Ap_req.toFixed(0);
    sabEl('f').innerText = Fs.toFixed(0);
    sabEl('iin').innerText = iin.toFixed(2);

    var rr = real || sabRealLosses(nom, getRealParamsSAB());
    var okTxt = getT('sab_zvs_ok'), noTxt = getT('sab_zvs_lost');
    sabEl('sab_n').innerText = n.toFixed(3);
    sabEl('sab_vr').innerText = nom.Vr.toFixed(1) + " V";
    sabEl('sab_dnom').innerText = nom.d.toFixed(3);
    sabEl('sab_dworst').innerText = d_worst.toFixed(3) + " / " + dmax.toFixed(2);
    sabEl('sab_mode_nom').innerText = nom.mode === "CCM" ? getT('sab_mode_ccm_txt') : (nom.mode === "CRM" ? getT('sab_mode_crm_txt') : getT('sab_mode_dcm_txt'));
    sabEl('sab_icrit').innerText = nom.Icrit.toFixed(2) + " A";
    sabEl('sab_zvs_lag').innerText = rr.zvsLag ? okTxt : noTxt;
    sabEl('sab_zvs_lead').innerText = rr.zvsLead ? okTxt : noTxt;
    sabEl('sab_vsw').innerText = vin_max.toFixed(0) + " V";
    sabEl('sab_vd').innerText = vout_max.toFixed(0) + " V";
    sabEl('sab_idpk').innerText = Idpk_max.toFixed(2) + " A";
    sabEl('sab_ilrms').innerText = IrmsWorst.toFixed(2) + " A";
    sabEl('sab_icout').innerText = rr.Icout_rms.toFixed(2) + " A";
    sabEl('sab_veq').innerText = Veq_max.toFixed(1) + " V";

    drawCharts(wf.t, wf.vb, wf.v2, wf.il, wf.ir, nom.Io, effData.labels, effData.values);

    var tbody = sabEl('resultTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = "";
    var step = Math.max(1, Math.floor(wf.t.length / 20));
    for (var i = 0; i <= 20; i++) {
        var idx = Math.min(i * step, wf.t.length - 1);
        var row = tbody.insertRow(-1);
        row.insertCell(0).innerHTML = wf.t[idx] + " µs";
        row.insertCell(1).innerHTML = wf.vb[idx].toFixed(2) + " V";
        row.insertCell(2).innerHTML = wf.v2[idx].toFixed(2) + " V";
        row.insertCell(3).innerHTML = wf.il[idx].toFixed(2) + " A";
        row.insertCell(4).innerHTML = wf.ir[idx].toFixed(2) + " A";
        row.insertCell(5).innerHTML = wf.phi[idx].toFixed(2) + " °";
    }
}

// ================================================================
// FALSTAD
// ================================================================
var falstadSim = null;

function embedFalstadSimulation(circuitString) {
    var iframe = document.getElementById("circuitFrame");
    var blankCct = encodeURIComponent("$ 1 0.000005 10.20027730826997 50 5 50 5e-11");
    iframe.src = "./falstad/circuitjs.html"
        + "?hideHeader=true" + "&hideMenuBar=true" + "&hideToolBar=true"
        + "&hideControls=false" + "&noPowerCheck=true" + "&cct=" + blankCct;

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
// FALSTAD (SAB template)
// ================================================================

var SAB_FALSTAD_TEMPLATE = `<cir f="1" ts="{TIMESTEP}" ic="242.03481360272136" cb="72" pb="50" vr="5" mts="5e-11">
<v x="112 432 112 160" f="16" wf="0" maxv="{VIN}"/>
<g x="112 432 112 464" f="0"/>
<l x="320 272 624 272" f="2" l="{L_VAL}" ic="0" i="{IL_INIT}"/>
<T x="624 272 736 336" f="2" in="{L_MAG}" ra="{RATIO}" co="0.9999" wi="64" c0="0" c1="0"/>
<c x="1088 128 1088 432" f="2" c="{C_VAL}" iv="{VOUT_INIT}" sr="0.1" vd="0"/>
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
<w x="272 272 272 400" f="0"/>
<R x="496 192 464 192" f="17" wf="2" fr="{FREQ}" maxv="2.5" bias="2.5" phaseShift="{PH_TOP}"/>
<R x="496 400 464 400" f="17" wf="2" fr="{FREQ}" maxv="2.5" bias="2.5" phaseShift="{PH_BOT}"/>
<g x="1152 432 1152 464" f="0"/>
<as x="512 176 512 208" f="2" ron="0.001" roff="10000000000" th="2.5"/>
<as x="512 384 512 416" f="2" ron="0.001" roff="10000000000" th="2.5"/>
<as x="320 384 320 416" f="2" ron="0.001" roff="10000000000" th="2.5"/>
<as x="320 176 320 208" f="2" ron="0.001" roff="10000000000" th="2.5"/>
<w x="272 400 304 400" f="0"/>
<dm nm="ideal" f="1" is="1.7143528192810002e-7" rs="0" n="2.0000000000000084" bv="0" fi="1"/>
<d x="544 208 544 176" f="0" mo="ideal"/>
<d x="544 416 544 384" f="0" mo="ideal"/>
<d x="352 208 352 176" f="0" mo="ideal"/>
<d x="352 416 352 384" f="0" mo="ideal"/>
<d x="1040 416 1040 384" f="0" mo="ideal"/>
<d x="1040 208 1040 176" f="0" mo="ideal"/>
<d x="848 208 848 176" f="0" mo="ideal"/>
<d x="848 416 848 384" f="0" mo="ideal"/>
<w x="544 176 512 176" f="0"/>
<w x="544 208 512 208" f="0"/>
<w x="544 384 512 384" f="0"/>
<w x="544 416 512 416" f="0"/>
<w x="352 384 320 384" f="0"/>
<w x="352 416 320 416" f="0"/>
<w x="352 176 320 176" f="0"/>
<w x="352 208 320 208" f="0"/>
<c x="320 176 320 208" f="2" c="1e-9" iv="0" sr="0.1" vd="0"/>
<c x="320 384 320 416" f="2" c="1e-9" iv="0" sr="0" vd="0"/>
<c x="512 176 512 208" f="2" c="1e-9" iv="0" sr="0.1" vd="0"/>
<c x="512 384 512 416" f="2" c="1e-9" iv="0" sr="0" vd="0"/>
<o en="5" sp="5" f="x3" p="0">
<p v="0" sc="512"/>
<p v="3" sc="8"/>
</o>
<o en="2" sp="5" f="x3" p="1">
<p v="0" sc="1024"/>
<p v="3" sc="32"/>
</o>
<o en="28" sp="5" f="x3" p="2">
<p v="0" sc="512"/>
<p v="3" sc="32"/>
</o>
</cir>`;

function openFalstadSabSimulation() {
    if (!window.lOutput_global) { hesapla(); }
    var vin_nom = sabNum('vin_nom', 800), vout_nom = sabNum('vout_nom', 380);
    var ilout = sabNum('ilout', 5.5), f_khz = sabNum('f_khz', 33);
    var freq_hz = f_khz * 1000;
    var n = window.sabN_paper || 1;
    var L_val = window.lOutput_global * 1e-6;
    var c_uF = parseFloat(sabEl('cOutput').innerText) || 10;
    var pt = sabSolvePoint(vin_nom, vout_nom, ilout, n, L_val, freq_hz, sabGetVf());

    var P = {
        TIMESTEP: (1.0 / (freq_hz * 100)).toExponential(2).toUpperCase(),
        VIN: vin_nom, VOUT: vout_nom, FREQ: freq_hz,
        L_VAL: L_val,                        // series L [H] (primer)
        L_MAG: (100 * L_val).toExponential(6),
        RATIO: n,                            // N2/N1 = n
        C_VAL: c_uF * 1e-6,
        R_VAL: vout_nom / ilout,
        VOUT_INIT: vout_nom.toFixed(4),
        DUTY: pt.ok ? pt.d : 0.25,           // d = tc/Ts
        TC: pt.ok ? pt.a : 0,                // pulse width [s]
        IL_INIT: pt.ok ? (pt.shape === "CCM" ? -pt.I0 : 0).toFixed(6) : "0",
        PHASE_DEG: pt.ok ? (360 * pt.d).toFixed(3) : "0",  // β = 360·d [degree]
        PH_TOP: (2 * Math.PI * (1 - (pt.ok ? pt.d : 0.25))).toFixed(6),
        PH_BOT: ((2 * Math.PI * (1 - (pt.ok ? pt.d : 0.25)) + Math.PI) % (2 * Math.PI)).toFixed(6)
    };

    var circuitString = SAB_FALSTAD_TEMPLATE;
    Object.keys(P).forEach(function (key) {
        circuitString = circuitString.replace(new RegExp("\\{" + key + "\\}", "g"), P[key]);
    });

    embedFalstadSimulation(circuitString);
    var simContainer = document.getElementById("simulationContainer");
    if (simContainer) { simContainer.style.display = "block"; simContainer.scrollIntoView({ behavior: 'smooth' }); }
    var liveDataBox = document.getElementById("liveDataBox");
    if (liveDataBox) {
        liveDataBox.style.display = "block";
        liveDataBox.innerHTML = "Fitcore SMPS Designer: Single Active Bridge (SAB) Converter Simulation";
    }
}

function hesapla() {
    if (!checkUserInput()) { setDefaultValues(); }
    updateChartsAndTable();
    if (typeof window.openSelectedTable === "function") {
        window.openSelectedTable();
    }
}

// ================================================================
// GRAFİKLER
// ================================================================
function drawCharts(t, vb, v2, il, ir, Io, p_arr, eff_arr) {
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

    mk('vinChart', [{ label: getT('chart_1_name'), data: vb, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false }], true);
    mk('v3Chart', [{ label: getT('sab_chart_2_name'), data: v2, borderColor: 'rgba(239, 83, 80, 1)', borderWidth: 2, fill: false }], true);
    mk('ilChart', [{ label: getT('chart_3_name'), data: il, borderColor: 'rgba(105, 240, 174, 1)', borderWidth: 2, fill: false }], false);

    var ioLine = ir.map(function () { return Io; });
    mk('irChart', [
        { label: getT('sab_chart_5_name'), data: ir, borderColor: 'rgba(186, 104, 200, 1)', borderWidth: 2, fill: false },
        { label: 'Io (DC)', data: ioLine, borderColor: 'rgba(255, 255, 255, 0.6)', borderWidth: 1, borderDash: [5, 4], fill: false }
    ], false);

    var idCanvas = document.getElementById('idChart');
    if (idCanvas) {
        if (idCanvas.chart) idCanvas.chart.destroy();
        idCanvas.chart = new Chart(idCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: t,
                datasets: [
                    { label: getT('col_v1'), data: vb, borderColor: 'rgba(100, 181, 246, 1)', borderWidth: 2, fill: false, pointRadius: 0, stepped: true },
                    { label: getT('col_v3'), data: v2, borderColor: 'rgba(255, 167, 38, 1)', borderWidth: 2, fill: false, pointRadius: 0, stepped: true, borderDash: [6, 4] }
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
                    label: getT('chart_eff_pct'), data: eff_arr,
                    borderColor: 'rgba(129, 199, 132, 1)', backgroundColor: 'rgba(129, 199, 132, 0.15)',
                    borderWidth: 2, fill: true, tension: 0.4, pointRadius: 2
                }]
            },
            options: { responsive: true, animation: false, scales: { x: { title: { display: true, text: getT('chart_load_pct'), color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } }, y: { min: 0, max: 100, title: { display: true, text: getT('chart_eff_pct'), color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } } }, plugins: commonOpts.plugins }
        });
    }
}

function printPage() { window.print(); }

// ================================================================
// TABLO & MODAL ENTEGRASYONU (dab.js ile aynı mimari)
// ================================================================
window.openSelectedTable = function () {
    const modeElement = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeElement ? modeElement.value : "standard";
    const isCustomDesign = sabEl("testOwnDesignCheck") ? sabEl("testOwnDesignCheck").checked : false;

    var lOutputStr = sabEl('lOutput') ? sabEl('lOutput').innerText : "";
    var veOptStr = sabEl('VeOpt') ? sabEl('VeOpt').innerText : "";

    if (!lOutputStr || isNaN(parseFloat(lOutputStr)) || !veOptStr || isNaN(parseFloat(veOptStr))) {
        var getT = window.getT || function (key) { return key; };
        alert(getT('adv_alert_calc_first') || "Lütfen önce hesaplama yapın!");
        return;
    }

    var L_H = window.lOutput_global * 1e-6;
    var Wmax = window.wmax1_global;
    var VeOpt = window.VeOpt_global;
    var vin_test = sabNum('vin_nom', 800);
    var f_hz = parseFloat(sabEl('f').innerText) || 100000;
    var nOutput = parseFloat(sabEl('nOutput').innerText.split(':')[0]) || 1;   // N1/N2
    var Imax = window.Imax_global;

    if (mode === "advanced") {
        if (isCustomDesign) {
            if (typeof window.openAdvancedPreCheck === "function") window.openAdvancedPreCheck('trafo_coil');
            else alert("Advanced modül yüklenemedi.");
        } else {
            window.customSelections = { core: null, coreL1: null, coreL2: null, coreTrafo: null, coreCoil: null, switch: null };
            if (typeof window.openAdvancedTable === "function") window.openAdvancedTable();
            else alert("Advanced modül yüklenemedi.");
        }
    } else {
        var trafoParams = {
            title: (window.getT && window.getT('btn_transformer')) ? window.getT('btn_transformer') : "Transformer Data",
            topology: 'dab',                 // N1 = Vgiren/(4 f ΔB Amin)
            vin_min: window.sabVeq || vin_test,   // SAB: V_eq = min(Vo/n, 2 d Vg)
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
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const printBtn = document.getElementById('printButton');
    if (printBtn) printBtn.removeAttribute('data-dup');
});