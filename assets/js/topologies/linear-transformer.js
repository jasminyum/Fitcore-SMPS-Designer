// ================================================================
// LINEAR TRANSFORMER CALCULATOR & TEST MODULE
// ================================================================

function cAdd(a, b) { return { r: a.r + b.r, i: a.i + b.i }; }
function cSub(a, b) { return { r: a.r - b.r, i: a.i - b.i }; }
function cMul(a, b) { return { r: a.r * b.r - a.i * b.i, i: a.r * b.i + a.i * b.r }; }
function cDiv(a, b) {
    const d = b.r * b.r + b.i * b.i;
    return { r: (a.r * b.r + a.i * b.i) / d, i: (a.i * b.r - a.r * b.i) / d };
}
function cMag(a) { return Math.sqrt(a.r * a.r + a.i * a.i); }
function cPhase(a) { return Math.atan2(a.i, a.r) * 180 / Math.PI; }
function cConj(a) { return { r: a.r, i: -a.i }; }
function cFromPolar(mag, deg) {
    const rad = deg * Math.PI / 180;
    return { r: mag * Math.cos(rad), i: mag * Math.sin(rad) };
}
function fmtC(c, prec) {
    prec = prec || 3;
    const re = c.r.toFixed(prec);
    const im = Math.abs(c.i).toFixed(prec);
    const sign = c.i >= 0 ? '+' : '-';
    return `${re} ${sign} j${im}`;
}
function fmtPolar(c, prec) {
    prec = prec || 3;
    return `${cMag(c).toFixed(prec)} ∠ ${cPhase(c).toFixed(2)}°`;
}

window.lastTrafoResults = {};

// ----------------------------------------------------------------
// MAIN CALCULATION FUNCTION
// ----------------------------------------------------------------
window.hesaplaTrafo = function () {
    const R1 = parseFloat(document.getElementById('R1').value) || 0;
    const L1 = (parseFloat(document.getElementById('L1').value) || 0) * 1e-3;
    const R2 = parseFloat(document.getElementById('R2').value) || 0;
    const L2 = (parseFloat(document.getElementById('L2').value) || 0) * 1e-3;
    const M = (parseFloat(document.getElementById('M_val').value) || 0) * 1e-3;
    const ZL_R = parseFloat(document.getElementById('ZL_R').value) || 0;
    const ZL_X = parseFloat(document.getElementById('ZL_X').value) || 0;
    const freq = (parseFloat(document.getElementById('freq').value) || 1) * 1000;
    const Vs_mag = parseFloat(document.getElementById('Vs_mag').value) || 0;
    const Vs_phase = parseFloat(document.getElementById('Vs_phase').value) || 0;

    if (L1 <= 0 || L2 <= 0 || M < 0 || freq <= 0) {
        alert((typeof window.getT === 'function') ? window.getT('alert_fill_fields') : 'Lütfen alanları doldurun.');
        return;
    }

    const omega = 2 * Math.PI * freq;
    const k = M / Math.sqrt(L1 * L2);

    const jwL1 = { r: 0, i: omega * L1 };
    const jwL2 = { r: 0, i: omega * L2 };
    const jwM = { r: 0, i: omega * M };

    const Z_prim = { r: R1, i: omega * L1 };
    const Z_sec = { r: R2 + ZL_R, i: omega * L2 + ZL_X };

    const wM_sq = omega * M * omega * M;
    const Z_R = cDiv({ r: wM_sq, i: 0 }, Z_sec);
    const Z_in = cAdd(Z_prim, Z_R);

    let I1 = { r: 0, i: 0 };
    let I2 = { r: 0, i: 0 };
    let V_L = { r: 0, i: 0 };
    let S_in = { r: 0, i: 0 };
    let S_load = { r: 0, i: 0 };
    let eta = 0;

    if (Vs_mag > 0) {
        const Vs = cFromPolar(Vs_mag, Vs_phase);
        I1 = cDiv(Vs, Z_in);
        I2 = cDiv(cMul(jwM, I1), Z_sec);

        const ZL = { r: ZL_R, i: ZL_X };
        V_L = cMul(ZL, I2);

        S_in = cMul(Vs, cConj(I1));
        S_load = cMul(V_L, cConj(I2));

        const P_in = S_in.r;
        const P_load = S_load.r;
        eta = P_in > 0 ? Math.min(100, (P_load / P_in) * 100) : 0;
    }

    const La = (L1 - M) * 1e3;
    const Lb = (L2 - M) * 1e3;
    const Lc = M * 1e3;

    document.getElementById('res_Zin').innerText = `${fmtC(Z_in)} = ${fmtPolar(Z_in)}`;
    document.getElementById('res_Zprim').innerText = `${fmtC(Z_prim)} = ${fmtPolar(Z_prim)}`;
    document.getElementById('res_ZR').innerText = `${fmtC(Z_R)} = ${fmtPolar(Z_R)}`;
    document.getElementById('res_k').innerText = k.toFixed(4);

    if (Vs_mag > 0) {
        document.getElementById('res_I1').innerText = `${fmtC(I1, 4)} = ${fmtPolar(I1, 4)}`;
        document.getElementById('res_I2').innerText = `${fmtC(I2, 4)} = ${fmtPolar(I2, 4)}`;
        document.getElementById('res_VL').innerText = `${fmtC(V_L, 3)} = ${fmtPolar(V_L, 3)}`;
        document.getElementById('res_Pin').innerText = S_in.r.toFixed(3);
        document.getElementById('res_Pload').innerText = S_load.r.toFixed(3);
        document.getElementById('res_eta').innerText = eta.toFixed(2);
        document.getElementById('powerResultTable').style.display = '';
    } else {
        ['res_I1', 'res_I2', 'res_VL'].forEach(id => document.getElementById(id).innerText = 'N/A (Vs=0)');
        document.getElementById('powerResultTable').style.display = 'none';
    }

    document.getElementById('res_La').innerText = La.toFixed(3);
    document.getElementById('res_Lb').innerText = Lb.toFixed(3);
    document.getElementById('res_Lc').innerText = Lc.toFixed(3);
    document.getElementById('teqDiv').style.display = '';

    const S_apparent = Vs_mag > 0 ? cMag(S_in) : 0;
    const Ve_opt_mm3 = S_apparent > 0 ? (S_apparent / freq) * 1e5 : 0;

    if (document.getElementById('nOutput')) {
        document.getElementById('nOutput').innerText = Math.sqrt(L2 / L1).toFixed(4);
    }
    document.getElementById('VeOpt').innerText = Ve_opt_mm3 > 0 ? Ve_opt_mm3.toFixed(0) : '-';

    window.lastTrafoResults = {
        R1, L1, L2, M, R2, ZL_R, ZL_X, freq, omega,
        k, Z_in, Z_prim, Z_R, I1, I2, V_L,
        La, Lb, Lc,
        S_in, S_load, eta,
        Vs_mag, Vs_phase, Ve_opt_mm3,
        wM_sq
    };

    drawTrafoCharts(window.lastTrafoResults);
};

// ----------------------------------------------------------------
// CHART RENDERING
// ----------------------------------------------------------------
function drawTrafoCharts(res) {
    const textColor = '#e0e0e0';
    const gridColor = 'rgba(255,255,255,0.1)';
    const getT = window.getT || function (k) { return k; };

    function baseOpts(xTitle, yTitle) {
        return {
            responsive: true, animation: false,
            elements: { point: { radius: 3 }, line: { tension: 0.35 } },
            scales: {
                x: { title: { display: true, text: xTitle, color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                y: { title: { display: true, text: yTitle, color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } }
            },
            plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } }
        };
    }

    function mkChart(id, datasets, xTitle, yTitle, labels) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        if (canvas._chart) { canvas._chart.destroy(); }
        canvas._chart = new Chart(canvas.getContext('2d'), {
            type: 'line', data: { labels, datasets }, options: baseOpts(xTitle, yTitle)
        });
    }

    const freqPoints = [], zinMags = [], zrMags = [], freqLabels = [];
    const BASE = res.freq;
    const sweepFactors = [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
    const base_w = res.omega;

    sweepFactors.forEach(f => {
        const fq = BASE * f;
        const w = 2 * Math.PI * fq;
        const zp = { r: res.R1, i: w * res.L1 };
        let current_ZL_X = res.ZL_X * (w / base_w);
        const zs = { r: res.R2 + res.ZL_R, i: w * res.L2 + current_ZL_X };
        const wm2 = (w * res.M) * (w * res.M);
        const zr = cDiv({ r: wm2, i: 0 }, zs);
        const zin = cAdd(zp, zr);
        freqPoints.push(fq);
        zinMags.push(parseFloat(cMag(zin).toFixed(3)));
        zrMags.push(parseFloat(cMag(zr).toFixed(3)));
        freqLabels.push((fq >= 1000 ? (fq / 1000).toFixed(1) + 'k' : fq.toFixed(0)) + 'Hz');
    });

    mkChart('impedanceChart', [
        { label: '|Z_in| (Ω)', data: zinMags, borderColor: 'rgba(129,199,132,1)', borderWidth: 2, fill: false },
        { label: '|Z_R| (Ω)', data: zrMags, borderColor: 'rgba(100,181,246,1)', borderWidth: 2, fill: false }
    ], getT('freq1'), 'Impedance (Ω)', freqLabels);

    const zinPhases = [], zrPhases = [];
    sweepFactors.forEach(f => {
        const fq = BASE * f;
        const w = 2 * Math.PI * fq;
        const zp = { r: res.R1, i: w * res.L1 };
        const zs = { r: res.R2 + res.ZL_R, i: w * res.L2 + res.ZL_X };
        const wm2 = (w * res.M) * (w * res.M);
        const zr = cDiv({ r: wm2, i: 0 }, zs);
        const zin = cAdd(zp, zr);
        zinPhases.push(parseFloat(cPhase(zin).toFixed(2)));
        zrPhases.push(parseFloat(cPhase(zr).toFixed(2)));
    });

    mkChart('phaseChart', [
        { label: '∠Z_in (°)', data: zinPhases, borderColor: 'rgba(255,183,77,1)', borderWidth: 2, fill: false },
        { label: '∠Z_R (°)', data: zrPhases, borderColor: 'rgba(239,83,80,1)', borderWidth: 2, fill: false }
    ], getT('freq1'), getT('aci'), freqLabels);

    if (res.Vs_mag <= 0) return;

    const i1Mags = [], i2Mags = [];
    const Vs = cFromPolar(res.Vs_mag, res.Vs_phase);

    sweepFactors.forEach(f => {
        const fq = BASE * f;
        const w = 2 * Math.PI * fq;
        const jwMv = { r: 0, i: w * res.M };
        const zp = { r: res.R1, i: w * res.L1 };
        const zs = { r: res.R2 + res.ZL_R, i: w * res.L2 + res.ZL_X };
        const wm2 = (w * res.M) * (w * res.M);
        const zr = cDiv({ r: wm2, i: 0 }, zs);
        const zin = cAdd(zp, zr);
        const i1 = cDiv(Vs, zin);
        const i2 = cDiv(cMul(jwMv, i1), zs);
        i1Mags.push(parseFloat(cMag(i1).toFixed(4)));
        i2Mags.push(parseFloat(cMag(i2).toFixed(4)));
    });

    mkChart('currentChart', [
        { label: '|I₁| (A)', data: i1Mags, borderColor: 'rgba(129,199,132,1)', borderWidth: 2, fill: false },
        { label: '|I₂| (A)', data: i2Mags, borderColor: 'rgba(100,181,246,1)', borderWidth: 2, fill: false }
    ], getT('freq1'), getT('chart_current_a'), freqLabels);

    const pinArr = [], ploadArr = [], etaArr = [];
    sweepFactors.forEach(f => {
        const fq = BASE * f;
        const w = 2 * Math.PI * fq;
        const jwMv = { r: 0, i: w * res.M };
        const zp = { r: res.R1, i: w * res.L1 };
        const ZL = { r: res.ZL_R, i: res.ZL_X };
        const zs = { r: res.R2 + res.ZL_R, i: w * res.L2 + res.ZL_X };
        const wm2 = (w * res.M) * (w * res.M);
        const zr = cDiv({ r: wm2, i: 0 }, zs);
        const zin = cAdd(zp, zr);
        const i1 = cDiv(Vs, zin);
        const i2 = cDiv(cMul(jwMv, i1), zs);
        const vl = cMul(ZL, i2);
        const sin = cMul(Vs, cConj(i1));
        const slod = cMul(vl, cConj(i2));
        pinArr.push(parseFloat(sin.r.toFixed(3)));
        ploadArr.push(parseFloat(slod.r.toFixed(3)));
        const e = sin.r > 0 ? Math.min(100, (slod.r / sin.r) * 100) : 0;
        etaArr.push(parseFloat(e.toFixed(2)));
    });

    mkChart('powerChart', [
        { label: 'P_in (W)', data: pinArr, borderColor: 'rgba(129,199,132,1)', borderWidth: 2, fill: false },
        { label: 'P_load (W)', data: ploadArr, borderColor: 'rgba(255,183,77,1)', borderWidth: 2, fill: false },
        { label: 'η (%)', data: etaArr, borderColor: 'rgba(239,83,80,1)', borderWidth: 2, fill: false, yAxisID: 'y2' }
    ], getT('freq1'), 'Power (W)', freqLabels);
}

window.openSelectedTable = function () {
    const modeEl = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeEl ? modeEl.value : 'standard';

    if (!window.lastTrafoResults || Object.keys(window.lastTrafoResults).length === 0) {
        alert(typeof getT === 'function' ? getT('adv_alert_calc_first') : 'Lütfen önce hesaplama yapın!');
        return;
    }

    if (mode === 'advanced') {
        if (typeof window.openAdvancedTable === 'function') {
            window.openAdvancedTable();
        } else {
            alert((typeof getT === 'function') ? getT('alert_advanced_module_error') : 'Advanced mod modülü yüklenemedi.');
        }
    } else {
        const I1_mag = window.lastTrafoResults.Vs_mag > 0 ? cMag(window.lastTrafoResults.I1) : 1;
        const I2_mag = window.lastTrafoResults.Vs_mag > 0 ? cMag(window.lastTrafoResults.I2) : 1;
        const f_hz = window.lastTrafoResults.freq;

        const J = typeof MagneticUtils !== 'undefined' ? MagneticUtils.getCurrentDensity(f_hz / 1000) : 4.0;
        const target_CMA = Math.round(1 / (J * 0.0005067));

        const wireA1 = (I1_mag * target_CMA) * 0.0005067;
        const wireD1 = Math.sqrt((4 * wireA1) / Math.PI);
        const wireA2 = (I2_mag * target_CMA) * 0.0005067;
        const wireD2 = Math.sqrt((4 * wireA2) / Math.PI);

        const params = {
            title: (window.getT && window.getT('title_linear_trafo_suggestions')) ? window.getT('title_linear_trafo_suggestions') : "Lineer Trafo Nüve Önerileri",
            L1_H: window.lastTrafoResults.L1,
            L2_H: window.lastTrafoResults.L2,
            f_hz: f_hz,
            vin_min: window.lastTrafoResults.Vs_mag,
            nOutput: Math.sqrt(window.lastTrafoResults.L2 / window.lastTrafoResults.L1),
            I1_rms_sq: Math.pow(I1_mag, 2),
            I2_rms_sq: Math.pow(I2_mag, 2),
            d1_req: wireD1,
            d2_req: wireD2,
            VeOpt: window.lastTrafoResults.Ve_opt_mm3,
            max_litz: 2 * 65.6 / Math.sqrt(f_hz),
            topology: "linear_trafo"
        };

        if (typeof UIModal !== 'undefined' && UIModal.openTrafoModal) {
            UIModal.openTrafoModal(params);
        } else {
            alert("Arayüz modülü (UIModal) yüklenemedi. Lütfen sayfayı yenileyin.");
        }
    }
};

// transformer test
window.runTrafoTests = function () {
    if (!window.lastTrafoResults || Object.keys(window.lastTrafoResults).length === 0) {
        alert((typeof getT === 'function') ? getT('adv_alert_calc_first') : "Lütfen önce ana hesaplamayı (Hesapla) çalıştırın.");
        return;
    }

    let v_p_rated = window.lastTrafoResults.Vs_mag;
    if (v_p_rated <= 0) v_p_rated = 220.0;

    const turns_ratio = Math.sqrt(window.lastTrafoResults.L2 / window.lastTrafoResults.L1);
    const efficiency = window.lastTrafoResults.eta > 0 ? (window.lastTrafoResults.eta / 100) : 0.95;

    const i_no_load_pct = 0.03;
    const p_iron_loss_pct = 0.015;

    const v_oc = v_p_rated;
    const i_oc = v_p_rated * i_no_load_pct;
    const p_oc = (v_oc * i_oc) * p_iron_loss_pct;
    const v_sec_induced = v_oc * turns_ratio;

    const v_sc_pct = 0.05;
    const p_copper_loss_pct = 0.02;

    const v_sc = v_p_rated * v_sc_pct;
    const current_I1_mag = cMag(window.lastTrafoResults.I1);
    const i_sc = current_I1_mag > 0 ? current_I1_mag : 10.0;
    const p_sc = (v_sc * i_sc) * p_copper_loss_pct;

    const r_eq = p_sc / (i_sc * i_sc);
    const z_eq = v_sc / i_sc;
    const x_eq = (z_eq > r_eq) ? Math.sqrt((z_eq * z_eq) - (r_eq * r_eq)) : 0.0;

    // Translation Getters
    const t_oc_title = (typeof getT === 'function') ? getT('test_oc_title') : "Açık Devre (Boşta Çalışma) Testi";
    const t_oc_voc = (typeof getT === 'function') ? getT('test_oc_voc') : "Uygulanan Primer Gerilim (Voc):";
    const t_oc_ioc = (typeof getT === 'function') ? getT('test_oc_ioc') : "Boşta Çekilen Akım (Ioc):";
    const t_oc_poc = (typeof getT === 'function') ? getT('test_oc_poc') : "Demir Kaybı (Nüve Kaybı / Poc):";
    const t_oc_vsec = (typeof getT === 'function') ? getT('test_oc_vsec') : "Sekonder Açık Devre Gerilimi:";

    const t_sc_title = (typeof getT === 'function') ? getT('test_sc_title') : "Kısa Devre (Empedans) Testi";
    const t_sc_vsc = (typeof getT === 'function') ? getT('test_sc_vsc') : "Uygulama Gerilimi (Vsc):";
    const t_sc_isc = (typeof getT === 'function') ? getT('test_sc_isc') : "Kısa Devre Akımı (Isc):";
    const t_sc_psc = (typeof getT === 'function') ? getT('test_sc_psc') : "Bakır Kaybı (Sargı Kaybı / Psc):";
    const t_sc_req = (typeof getT === 'function') ? getT('test_sc_req') : "Eşdeğer Direnç (Req):";
    const t_sc_zeq = (typeof getT === 'function') ? getT('test_sc_zeq') : "Eşdeğer Empedans (Zeq):";
    const t_sc_xeq = (typeof getT === 'function') ? getT('test_sc_xeq') : "Eşdeğer Reaktans (Xeq):";
    const t_modal_title = (typeof getT === 'function') ? getT('test_modal_title') : "Trafo Test Simülasyonu Sonuçları";

    const htmlContent = `
        <div class="row">
            <div class="col-md-6 mb-3">
                <div class="card h-100" style="background: rgba(0, 174, 239, 0.05); border: 1px solid #00AEEF;">
                    <div class="card-header text-dark fw-bold" style="background-color: #00AEEF;">
                        <i class="bi bi-unlock"></i> ${t_oc_title}
                    </div>
                    <div class="card-body text-light" style="font-size: 14px;">
                        <ul class="list-group list-group-flush" style="--bs-list-group-bg: transparent; --bs-list-group-color: var(--text-main); --bs-list-group-border-color: var(--border-color);">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ${t_oc_voc} <span class="badge bg-secondary rounded-pill">${v_oc.toFixed(2)} V</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ${t_oc_ioc} <span class="badge bg-secondary rounded-pill">${i_oc.toFixed(4)} A</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center text-warning">
                                ${t_oc_poc} <span class="badge bg-warning text-dark rounded-pill">${p_oc.toFixed(2)} W</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ${t_oc_vsec} <span class="badge bg-secondary rounded-pill">${v_sec_induced.toFixed(2)} V</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="col-md-6 mb-3">
                <div class="card h-100" style="background: rgba(255, 183, 77, 0.05); border: 1px solid #ffb74d;">
                    <div class="card-header text-dark fw-bold" style="background-color: #ffb74d;">
                        <i class="bi bi-lightning-charge"></i> ${t_sc_title}
                    </div>
                    <div class="card-body text-light" style="font-size: 14px;">
                        <ul class="list-group list-group-flush" style="--bs-list-group-bg: transparent; --bs-list-group-color: var(--text-main); --bs-list-group-border-color: var(--border-color);">
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ${t_sc_vsc} <span class="badge bg-secondary rounded-pill">${v_sc.toFixed(2)} V</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ${t_sc_isc} <span class="badge bg-secondary rounded-pill">${i_sc.toFixed(2)} A</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center text-danger">
                                ${t_sc_psc} <span class="badge bg-danger rounded-pill">${p_sc.toFixed(2)} W</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ${t_sc_req} <span class="badge bg-secondary rounded-pill">${r_eq.toFixed(4)} Ω</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ${t_sc_zeq} <span class="badge bg-secondary rounded-pill">${z_eq.toFixed(4)} Ω</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ${t_sc_xeq} <span class="badge bg-secondary rounded-pill">${x_eq.toFixed(4)} Ω</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;

    if (typeof UIModal !== 'undefined' && document.getElementById('coreModalTitle')) {
        document.getElementById('coreModalTitle').innerHTML = `<i class="bi bi-cpu"></i> ${t_modal_title}`;
        document.getElementById('modalDynamicBody').innerHTML = htmlContent;
        UIModal.showSafeModal();
    } else {
        alert("UI Modülü yüklenemedi. Lütfen sayfayı yenileyiniz.");
    }
};

window._pageType = 'linear_transformer';