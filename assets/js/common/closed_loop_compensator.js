// ================================================================
// Closed Loop Compensator (BETA) - Flyback
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================
(function () {
    "use strict";

    var TWO_PI = 2 * Math.PI;

    function T(key, fallback) {
        if (window.getT && typeof window.getT === "function") {
            var v = window.getT(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    // ------------------------------------------------------------
    // complex number operations
    // ------------------------------------------------------------
    function cmul(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
    function cdiv(a, b) {
        var d = b.re * b.re + b.im * b.im;
        return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
    }
    function cabs(a) { return Math.hypot(a.re, a.im); }
    function carg(a) { return Math.atan2(a.im, a.re); }

    // ------------------------------------------------------------
    // GUC KATI MODELI (Vc -> Vo, peak current mode, Vc = Ipk * Rs)
    //   p: { Vin, Vo, Io, fs, Lm, nPS (Np/Ns), Co, ESR, Rs, mode, Vd }
    //   CCM: K = R*D' / (Nc*(1+D)*Rs), wp=(1+D)/(R*Co), RHPZ = R*D'^2/(D*Lm_sec)
    //   DCM: K = sqrt(0.5*Lm*fs*R)/Rs, wp = 2/(R*Co)
    // ------------------------------------------------------------
    function buildPlant(p) {
        var Vd = (p.Vd != null) ? p.Vd : 0.7;
        var R = p.Vo / p.Io;
        var Vor = p.nPS * (p.Vo + Vd);
        var D = Vor / (Vor + p.Vin);
        var Dp = 1 - D;
        var wz = 1 / (p.ESR * p.Co);
        var K, wp, wrhp = null;

        if (p.mode === "CCM") {
            K = (R * Dp) / (p.nPS * p.Rs * (1 + D));
            wp = (1 + D) / (R * p.Co);
            var Lsec = p.Lm / (p.nPS * p.nPS);
            wrhp = (R * Dp * Dp) / (D * Lsec);
        } else {
            K = Math.sqrt(0.5 * p.Lm * p.fs * R) / p.Rs;
            wp = 2 / (R * p.Co);
        }
        return { R: R, D: D, Dp: Dp, Vor: Vor, K: K, wz: wz, wp: wp, wrhp: wrhp, mode: p.mode };
    }

    function plantAt(pl, f) {
        var w = TWO_PI * f;
        var num = { re: 1, im: w / pl.wz };
        if (pl.wrhp) num = cmul(num, { re: 1, im: -w / pl.wrhp });
        var g = cdiv(num, { re: 1, im: w / pl.wp });
        return { re: pl.K * g.re, im: pl.K * g.im };
    }

    // ------------------------------------------------------------
    //   Type II : Gc = (wi/s)(1+s/wz)/(1+s/wp)
    //   Type III: Gc = (wi/s)(1+s/wz1)(1+s/wz2)/((1+s/wp1)(1+s/wp2))
    // ------------------------------------------------------------
    function compAt(c, f) {
        var w = TWO_PI * f;
        var g = cdiv({ re: c.wi, im: 0 }, { re: 0, im: w });
        g = cmul(g, { re: 1, im: w / c.wz1 });
        g = cdiv(g, { re: 1, im: w / c.wp1 });
        if (c.type === 3) {
            g = cmul(g, { re: 1, im: w / c.wz2 });
            g = cdiv(g, { re: 1, im: w / c.wp2 });
        }
        return g;
    }

    function designCompensator(pl, fc, pmTarget, type) {
        var Gp = plantAt(pl, fc);
        var magP = cabs(Gp);
        var phP = carg(Gp) * 180 / Math.PI;

        var boostReq = pmTarget - 90 - phP;
        var bMax = (type === 3) ? 160 : 80;
        var b = Math.max(0, Math.min(bMax, boostReq));

        var comp = { type: type };
        var w = TWO_PI * fc;
        var fz, fp, shape;

        if (type === 2) {
            var k2 = Math.tan((b / 2 + 45) * Math.PI / 180);
            fz = fc / k2; fp = fc * k2;
            comp.wz1 = TWO_PI * fz; comp.wp1 = TWO_PI * fp;
            shape = Math.hypot(1, w / comp.wz1) / Math.hypot(1, w / comp.wp1);
            comp.fz = [fz]; comp.fp = [fp];
        } else {
            var k3 = Math.tan((b / 4 + 45) * Math.PI / 180);
            fz = fc / k3; fp = fc * k3;
            comp.wz1 = comp.wz2 = TWO_PI * fz;
            comp.wp1 = comp.wp2 = TWO_PI * fp;
            shape = Math.pow(Math.hypot(1, w / comp.wz1) / Math.hypot(1, w / comp.wp1), 2);
            comp.fz = [fz, fz]; comp.fp = [fp, fp];
        }
        comp.wi = (1 / magP) * w / shape;
        comp.boost = b;
        comp.boostReq = boostReq;
        return comp;
    }

    // ------------------------------------------------------------
    // FREQUENCY SWEEP (logaritmik, 1..fs*2)
    // ------------------------------------------------------------
    function unwrapPhase(arr) {
        var o = [arr[0]];
        for (var i = 1; i < arr.length; i++) {
            var d = arr[i] - arr[i - 1];
            while (d > 180) d -= 360;
            while (d < -180) d += 360;
            o.push(o[i - 1] + d);
        }
        return o;
    }

    function sweep(pl, comp, fmin, fmax, N) {
        var f = [], mag = [], ph = [], magP = [], magC = [];
        var lmin = Math.log10(fmin), lmax = Math.log10(fmax);
        for (var i = 0; i < N; i++) {
            var fi = Math.pow(10, lmin + (lmax - lmin) * i / (N - 1));
            var gp = plantAt(pl, fi), gc = compAt(comp, fi), L = cmul(gp, gc);
            f.push(fi);
            mag.push(20 * Math.log10(cabs(L)));
            ph.push(carg(L) * 180 / Math.PI);
            magP.push(20 * Math.log10(cabs(gp)));
            magC.push(20 * Math.log10(cabs(gc)));
        }
        return { f: f, mag: mag, ph: unwrapPhase(ph), magP: magP, magC: magC };
    }

    function margins(s) {
        var fc = null, pm = null, fpi = null, gm = null;
        for (var i = 1; i < s.f.length; i++) {
            if (fc === null && s.mag[i - 1] >= 0 && s.mag[i] < 0) {
                var t = s.mag[i - 1] / (s.mag[i - 1] - s.mag[i]);
                fc = s.f[i - 1] * Math.pow(s.f[i] / s.f[i - 1], t);
                var ph = s.ph[i - 1] + t * (s.ph[i] - s.ph[i - 1]);
                pm = 180 + ph;
            }
            if (fpi === null && s.ph[i - 1] > -180 && s.ph[i] <= -180) {
                var t2 = (s.ph[i - 1] + 180) / (s.ph[i - 1] - s.ph[i]);
                fpi = s.f[i - 1] * Math.pow(s.f[i] / s.f[i - 1], t2);
                gm = -(s.mag[i - 1] + t2 * (s.mag[i] - s.mag[i - 1]));
            }
        }
        return { fc: fc, pm: pm, fpi: fpi, gm: gm };
    }

    // fc upper limits: fs/10, RHPZ/3, ESR zero/3
    function fcLimits(pl, fs) {
        var lim = { fs10: fs / 10, esr: (pl.wz / TWO_PI) / 3 };
        if (pl.wrhp) lim.rhp = (pl.wrhp / TWO_PI) / 3;
        var m = Infinity;
        for (var k in lim) if (lim[k] < m) m = lim[k];
        lim.max = m;
        return lim;
    }

    // ------------------------------------------------------------
    //   kp = CTR*Rc/Rled ; wz = 1/(R1*Cz) ; wp = 1/(Rc*Cp)
    // ------------------------------------------------------------
    function tl431Components(comp, o) {
        var Vref = 2.5;
        var Idiv = o.Idiv_mA * 1e-3;
        var R2 = Vref / Idiv;
        var R1 = (o.Vo - Vref) / Idiv;
        var Rled = (o.Vo - o.Vled - o.Vk_min) / (o.Iled_max_mA * 1e-3);
        var fz = comp.fz[0], fp = comp.fp[comp.fp.length - 1];
        var kp = comp.wi / comp.wz1;
        var Rc = kp * Rled / o.CTR;
        var Cz = 1 / (TWO_PI * fz * R1);
        var Cp = 1 / (TWO_PI * fp * Rc);
        return { R1: R1, R2: R2, Rled: Rled, Rc: Rc, Cz: Cz, Cp: Cp, kp: kp, fz: fz, fp: fp };
    }

    function minGainCriterion(o, Vc_min) {
        return 0.5 * (o.Vcc - Vc_min) / (o.Vo - o.Vled - 2.5);
    }

    function fmtR(v) {
        if (v >= 1e6) return (v / 1e6).toFixed(2) + " MΩ";
        if (v >= 1e3) return (v / 1e3).toFixed(2) + " kΩ";
        return v.toFixed(1) + " Ω";
    }
    function fmtC(v) {
        if (v >= 1e-6) return (v * 1e6).toFixed(2) + " µF";
        if (v >= 1e-9) return (v * 1e9).toFixed(2) + " nF";
        return (v * 1e12).toFixed(1) + " pF";
    }
    function fmtF(v) {
        if (v >= 1e3) return (v / 1e3).toFixed(2) + " kHz";
        return v.toFixed(1) + " Hz";
    }
    function fmtDb(v) { return (v >= 0 ? "+" : "") + v.toFixed(2) + " dB"; }

    // ------------------------------------------------------------
    // MODAL
    // ------------------------------------------------------------
    var bodeChart = null;

    function ensureModal() {
        if (document.getElementById("closedLoopModal")) return;
        var html =
            '<div class="modal fade" id="closedLoopModal" tabindex="-1" aria-hidden="true">' +
            '  <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">' +
            '    <div class="modal-content" style="background-color: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-color);">' +
            '      <div class="modal-header" style="border-bottom: 1px solid var(--border-color);">' +
            '        <h5 class="modal-title" id="closedLoopModalTitle" style="color:var(--color-yellow);"></h5>' +
            '        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>' +
            '      </div>' +
            '      <div class="modal-body p-0"><div id="closedLoopBody" class="p-3"></div></div>' +
            '    </div>' +
            '  </div>' +
            '</div>';
        document.body.insertAdjacentHTML("beforeend", html);

        document.getElementById("closedLoopModal").addEventListener("hidden.bs.modal", function () {
            if (bodeChart) { bodeChart.destroy(); bodeChart = null; }
        });
    }

    function showModal() {
        if (typeof bootstrap === "undefined") {
            alert(T("cl_bootstrap_err", "Bootstrap yüklenemedi. Lütfen sayfayı yenileyin."));
            return;
        }
        bootstrap.Modal.getOrCreateInstance(document.getElementById("closedLoopModal")).show();
    }

    function inputRow(id, label, value, step) {
        return '<div class="input-group input-group-sm mb-2">' +
            '<span class="input-group-text" style="min-width:150px;">' + label + '</span>' +
            '<input type="number" id="' + id + '" class="form-control bg-dark text-light" value="' + value + '" step="' + (step || "any") + '">' +
            '</div>';
    }

    function readConverter() {
        var c = window.flybackLastCalc;
        if (!c) return null;
        return c;
    }

    function readUserParams() {
        function g(id, def) {
            var el = document.getElementById(id);
            var v = el ? parseFloat(el.value) : NaN;
            return isNaN(v) ? def : v;
        }
        return {
            type: (document.getElementById("clType") || {}).value === "3" ? 3 : 2,
            fcKHz: g("clFc", 0),
            pm: g("clPm", 60),
            ESR: g("clEsr", 0.01),
            Rs: g("clRs", 0.1),
            CTR: g("clCtr", 1.0),
            Vled: g("clVled", 1.1),
            Iled: g("clIled", 2.0),
            Vk: g("clVk", 2.5),
            Idiv: g("clIdiv", 0.25),
            Vcc: g("clVcc", 5.0),
            VcMin: g("clVcMin", 1.0)
        };
    }

    function computeAndRender() {
        var c = readConverter();
        if (!c) return;
        var u = readUserParams();

        var plantParams = {
            Vin: c.Vin, Vo: c.Vo, Io: c.Io, fs: c.fs,
            Lm: c.Lm, nPS: 1 / c.nOutput, Co: c.Co,
            ESR: u.ESR, Rs: u.Rs, mode: c.mode, Vd: c.Vd
        };
        var pl = buildPlant(plantParams);
        var lim = fcLimits(pl, c.fs);

        var fc = u.fcKHz > 0 ? u.fcKHz * 1000 : lim.max;
        var warns = [];
        if (fc > lim.max) {
            warns.push(T("cl_warn_fc_clamped", "Seçilen fc, kararlılık sınırını aştığı için otomatik olarak kısıtlandı:") + " " + fmtF(lim.max));
            fc = lim.max;
        }

        var comp = designCompensator(pl, fc, u.pm, u.type);
        var sw = sweep(pl, comp, 1, c.fs * 2, 500);
        var m = margins(sw);

        if (comp.boostReq > comp.boost + 0.5) {
            warns.push(T("cl_warn_boost_short", "İstenen faz marjı için gereken faz ilerletme bu tipin sınırını aşıyor; Type III seçmeyi veya fc'yi düşürmeyi deneyin."));
        }
        if (pl.wrhp) {
            var fr = pl.wrhp / TWO_PI;
            warns.push(T("cl_info_rhpz", "CCM'de sağ yarı düzlem sıfırı (RHPZ) mevcut:") + " " + fmtF(fr) + " (fc ≤ RHPZ/3 " + T("cl_info_rule", "kuralı uygulandı") + ")");
        }
        if (m.pm !== null && m.pm < 45) warns.push(T("cl_warn_pm_low", "Faz marjı 45° altında: sistem kararlı olsa da aşırı salınıma yatkın olabilir."));
        if (m.gm !== null && m.gm < 10) warns.push(T("cl_warn_gm_low", "Kazanç marjı 10 dB altında."));
        if (pl.mode === "CRM") {
            warns.push(T("cl_info_crm", "Sistem CRM (Kritik İletim Modu) sınırında çalışıyor. BETA sürümünde CRM için DCM küçük-sinyal modeli (sabit frekans varsayımıyla) kullanılmaktadır."));
        }

        var compRowsHtml = "";
        if (u.type === 2) {
            var tl = tl431Components(comp, {
                Vo: c.Vo, CTR: u.CTR, Iled_max_mA: u.Iled, Vled: u.Vled, Vk_min: u.Vk, Idiv_mA: u.Idiv
            });
            var kpMin = minGainCriterion({ Vcc: u.Vcc, Vo: c.Vo, Vled: u.Vled }, u.VcMin);
            var kpWarn = tl.kp < kpMin
                ? '<div class="mt-2" style="color:#ffb74d; font-size:12px;">⚠ ' +
                T("cl_warn_min_gain", "Minimum kazanç kriteri sağlanmıyor:") + " kp = " + tl.kp.toFixed(2) + " &lt; " + kpMin.toFixed(2) + "</div>"
                : "";
            compRowsHtml =
                '<h6 class="mt-3" style="color:var(--color-yellow);">' + T("cl_tl431_title", "TL431 + Optokuplör Komponentleri (Type II)") + '</h6>' +
                '<table class="table table-sm table-bordered text-center" style="color:var(--text-main);">' +
                '<tr><th>R1 (' + T("cl_r1_note", "üst bölücü") + ')</th><th>R2 (' + T("cl_r2_note", "alt bölücü") + ')</th><th>Rled</th><th>Rc</th><th>Cz</th><th>Cp</th></tr>' +
                '<tr><td>' + fmtR(tl.R1) + '</td><td>' + fmtR(tl.R2) + '</td><td>' + fmtR(tl.Rled) + '</td><td>' + fmtR(tl.Rc) + '</td><td>' + fmtC(tl.Cz) + '</td><td>' + fmtC(tl.Cp) + '</td></tr>' +
                '</table>' + kpWarn;
        } else {
            compRowsHtml =
                '<div class="mt-3" style="font-size:12px; color:#9e9e9e;">' +
                T("cl_type3_note", "Type III için pasif komponent dönüşümü bu BETA sürümünde yalnızca kutup/sıfır frekansları olarak sunulur.") +
                '</div>';
        }

        var warnHtml = warns.length
            ? '<div class="p-2 mb-3 rounded" style="background:#3a2f12; border:1px solid #ffb74d; color:#ffe0b2; font-size:13px;">' +
            warns.map(function (w) { return "• " + w; }).join("<br>") + "</div>"
            : "";

        var pmOk = m.pm !== null && m.pm >= 45;
        var gmOk = m.gm === null || m.gm >= 10;

        document.getElementById("clResults").innerHTML =
            warnHtml +
            '<div class="row g-2 mb-3">' +
            '  <div class="col-md-3"><div class="p-2 rounded text-center" style="background:var(--surface-dark); border:1px solid var(--border-color);"><div style="font-size:11px; color:#9e9e9e;">' + T("cl_fc_actual", "Kesim Frekansı (fc)") + '</div><div style="font-size:18px;">' + (m.fc ? fmtF(m.fc) : "-") + '</div></div></div>' +
            '  <div class="col-md-3"><div class="p-2 rounded text-center" style="background:var(--surface-dark); border:1px solid ' + (pmOk ? "#66bb6a" : "#ef5350") + ';"><div style="font-size:11px; color:#9e9e9e;">' + T("cl_pm", "Faz Marjı (PM)") + '</div><div style="font-size:18px;">' + (m.pm !== null ? m.pm.toFixed(1) + "°" : "-") + '</div></div></div>' +
            '  <div class="col-md-3"><div class="p-2 rounded text-center" style="background:var(--surface-dark); border:1px solid ' + (gmOk ? "#66bb6a" : "#ef5350") + ';"><div style="font-size:11px; color:#9e9e9e;">' + T("cl_gm", "Kazanç Marjı (GM)") + '</div><div style="font-size:18px;">' + (m.gm !== null ? m.gm.toFixed(1) + " dB" : "∞") + '</div></div></div>' +
            '  <div class="col-md-3"><div class="p-2 rounded text-center" style="background:var(--surface-dark); border:1px solid var(--border-color);"><div style="font-size:11px; color:#9e9e9e;">' + T("cl_mode", "Çalışma Modu") + '</div><div style="font-size:18px;">' + pl.mode + '</div></div></div>' +
            '</div>' +

            '<div class="row">' +
            '  <div class="col-md-6">' +
            '    <h6 style="color:var(--color-yellow);">' + T("cl_plant_title", "Güç Katı Transfer Fonksiyonu") + '</h6>' +
            '    <table class="table table-sm table-bordered" style="color:var(--text-main);">' +
            '      <tr><td>' + T("cl_dc_gain", "DC Kazanç (K)") + '</td><td>' + pl.K.toFixed(2) + ' (' + (20 * Math.log10(pl.K)).toFixed(1) + ' dB)</td></tr>' +
            '      <tr><td>' + T("cl_duty", "Duty (D)") + '</td><td>' + pl.D.toFixed(3) + '</td></tr>' +
            '      <tr><td>' + T("cl_pole", "Kutup (fp)") + '</td><td>' + fmtF(pl.wp / TWO_PI) + '</td></tr>' +
            '      <tr><td>' + T("cl_esr_zero", "ESR Sıfırı (fz,esr)") + '</td><td>' + fmtF(pl.wz / TWO_PI) + '</td></tr>' +
            '      <tr><td>' + T("cl_rhpz", "RHP Sıfırı (fRHPZ)") + '</td><td>' + (pl.wrhp ? fmtF(pl.wrhp / TWO_PI) : "—") + '</td></tr>' +
            '    </table>' +
            '  </div>' +
            '  <div class="col-md-6">' +
            '    <h6 style="color:var(--color-yellow);">' + T("cl_comp_title", "Hata Yükselteci (Kompanzatör)") + ' — Type ' + (u.type === 3 ? "III" : "II") + '</h6>' +
            '    <table class="table table-sm table-bordered" style="color:var(--text-main);">' +
            '      <tr><td>' + T("cl_integ_gain", "İntegratör (fi = wi/2π)") + '</td><td>' + fmtF(comp.wi / TWO_PI) + '</td></tr>' +
            comp.fz.map(function (z, i) { return '<tr><td>fz' + (i + 1) + '</td><td>' + fmtF(z) + '</td></tr>'; }).join("") +
            comp.fp.map(function (p2, i) { return '<tr><td>fp' + (i + 1) + '</td><td>' + fmtF(p2) + '</td></tr>'; }).join("") +
            '      <tr><td>' + T("cl_boost", "Faz İlerletme") + '</td><td>' + comp.boost.toFixed(1) + '°</td></tr>' +
            '    </table>' +
            '  </div>' +
            '</div>' +
            compRowsHtml +

            '<h6 class="mt-3" style="color:var(--color-yellow);">' + T("cl_bode_title", "Bode Grafiği (Açık Çevrim Kazancı L = Gp · Gc)") + '</h6>' +
            '<div class="row">' +
            '  <div class="col-md-6"><canvas id="clBodeMag" height="260"></canvas></div>' +
            '  <div class="col-md-6"><canvas id="clBodePh" height="260"></canvas></div>' +
            '</div>' +
            '<div class="mt-2" style="font-size:11px; color:#9e9e9e;">' +
            T("cl_disclaimer", "BETA: Bu sonuçlar sabit-Vin küçük-sinyal ortalama modeline dayanır. Gerçek devrede optokuplör CTR toleransı, yük değişimi ve parazitikler nedeniyle bench doğrulaması gereklidir.") +
            '</div>';

        drawBode(sw, m);
    }

    function drawBode(sw, m) {
        if (typeof Chart === "undefined") return;
        if (bodeChart && bodeChart.magChart) { bodeChart.magChart.destroy(); }
        if (bodeChart && bodeChart.phChart) { bodeChart.phChart.destroy(); }

        function series(x, y) { return x.map(function (xi, i) { return { x: xi, y: y[i] }; }); }
        function opts(yTitle) {
            return {
                animation: false,
                responsive: true,
                parsing: false,
                plugins: { legend: { labels: { color: "#e0e0e0" } } },
                scales: {
                    x: {
                        type: "logarithmic",
                        title: { display: true, text: "Hz", color: "#e0e0e0" },
                        ticks: { color: "#e0e0e0" },
                        grid: { color: "rgba(255,255,255,0.08)" }
                    },
                    y: {
                        title: { display: true, text: yTitle, color: "#e0e0e0" },
                        ticks: { color: "#e0e0e0" },
                        grid: { color: "rgba(255,255,255,0.08)" }
                    }
                }
            };
        }

        var magCanvas = document.getElementById("clBodeMag");
        var phCanvas = document.getElementById("clBodePh");
        if (!magCanvas || !phCanvas) return;

        var zeroLine = [{ x: sw.f[0], y: 0 }, { x: sw.f[sw.f.length - 1], y: 0 }];
        var m180 = [{ x: sw.f[0], y: -180 }, { x: sw.f[sw.f.length - 1], y: -180 }];

        var magChart = new Chart(magCanvas.getContext("2d"), {
            type: "line",
            data: {
                datasets: [
                    { label: "|L| (dB)", data: series(sw.f, sw.mag), borderColor: "#42a5f5", borderWidth: 2, pointRadius: 0 },
                    { label: "|Gp| (dB)", data: series(sw.f, sw.magP), borderColor: "#9e9e9e", borderWidth: 1, borderDash: [4, 3], pointRadius: 0 },
                    { label: "|Gc| (dB)", data: series(sw.f, sw.magC), borderColor: "#ffb74d", borderWidth: 1, borderDash: [4, 3], pointRadius: 0 },
                    { label: "0 dB", data: zeroLine, borderColor: "#ef5350", borderWidth: 1, pointRadius: 0 }
                ]
            },
            options: opts("dB")
        });

        var phChart = new Chart(phCanvas.getContext("2d"), {
            type: "line",
            data: {
                datasets: [
                    { label: T("cl_phase_label", "Faz L (°)"), data: series(sw.f, sw.ph), borderColor: "#66bb6a", borderWidth: 2, pointRadius: 0 },
                    { label: "-180°", data: m180, borderColor: "#ef5350", borderWidth: 1, pointRadius: 0 }
                ]
            },
            options: opts("deg")
        });

        bodeChart = { magChart: magChart, phChart: phChart, destroy: function () { magChart.destroy(); phChart.destroy(); } };
    }

    // ------------------------------------------------------------
    // MODAL OPENING
    // ------------------------------------------------------------
    window.openClosedLoopModal = function () {
        var c = readConverter();
        if (!c) {
            alert(T("adv_alert_calc_first", "Lütfen önce hesaplama yapın!"));
            return;
        }
        ensureModal();

        document.getElementById("closedLoopModalTitle").innerText =
            T("cl_modal_title", "Kapalı Çevrim Kompanzasyonu") + " (BETA)";

        var fcDefaultKHz = (c.fs / 20 / 1000).toFixed(2);

        document.getElementById("closedLoopBody").innerHTML =
            '<div class="row g-3">' +
            '  <div class="col-md-4">' +
            '    <div class="p-3 rounded" style="background:var(--surface-dark); border:1px solid var(--border-color);">' +
            '      <h6 style="border-bottom:1px solid var(--border-color); padding-bottom:5px;">' + T("cl_design_params", "Tasarım Parametreleri") + '</h6>' +
            '      <div class="input-group input-group-sm mb-2"><span class="input-group-text" style="min-width:150px;">' + T("cl_type", "Kompanzatör Tipi") + '</span>' +
            '        <select id="clType" class="form-select bg-dark text-light"><option value="2">Type II</option><option value="3">Type III</option></select></div>' +
            inputRow("clFc", T("cl_fc_target", "Hedef fc [kHz] (0=otomatik)"), fcDefaultKHz) +
            inputRow("clPm", T("cl_pm_target", "Hedef Faz Marjı [°]"), 60) +
            inputRow("clEsr", T("cl_esr_in", "Cout ESR [Ω]"), (c.ESR_Cout || 0.01)) +
            inputRow("clRs", T("cl_rs_in", "Akım Sense Rs [Ω]"), 0.1) +
            '      <h6 class="mt-3" style="border-bottom:1px solid var(--border-color); padding-bottom:5px;">' + T("cl_tl431_subtitle", "TL431 + Opto (Type II)") + '</h6>' +
            inputRow("clCtr", T("cl_ctr", "CTR"), 1.0) +
            inputRow("clVled", T("cl_vled", "Vled [V]"), 1.1) +
            inputRow("clIled", T("cl_iled_max", "Iled max [mA]"), 2.0) +
            inputRow("clVk", T("cl_vk_min", "Vk min [V]"), 2.5) +
            inputRow("clIdiv", T("cl_idiv", "Bölücü akımı [mA]"), 0.25) +
            inputRow("clVcc", T("cl_vref_ic", "Vref IC [V]"), 5.0) +
            inputRow("clVcMin", T("cl_vc_min", "Vc min [V]"), 1.0) +
            '      <button id="clRecalc" class="btn btn-primary btn-sm w-100 mt-2">' + T("cl_recalc", "Yeniden Hesapla") + '</button>' +
            '    </div>' +
            '  </div>' +
            '  <div class="col-md-8"><div id="clResults"></div></div>' +
            '</div>';

        document.getElementById("clRecalc").addEventListener("click", computeAndRender);
        ["clType"].forEach(function (id) {
            document.getElementById(id).addEventListener("change", computeAndRender);
        });

        showModal();
        var modalEl = document.getElementById("closedLoopModal");
        var once = function () {
            modalEl.removeEventListener("shown.bs.modal", once);
            computeAndRender();
        };
        modalEl.addEventListener("shown.bs.modal", once);
    };

    // ------------------------------------------------------------
    // CHECKBOX
    // ------------------------------------------------------------
    window.toggleClosedLoopButton = function () {
        var chk = document.getElementById("closedLoopCheck");
        var btn = document.getElementById("closedLoopButton");
        if (!btn) return;
        btn.style.display = (chk && chk.checked) ? "" : "none";
    };

    window.ClosedLoopCore = {
        buildPlant: buildPlant, plantAt: plantAt, compAt: compAt,
        designCompensator: designCompensator, sweep: sweep, margins: margins,
        fcLimits: fcLimits, tl431Components: tl431Components
    };
})();
