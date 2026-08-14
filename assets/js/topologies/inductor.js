// ================================================================
// INDUCTOR CALCULATOR
// ================================================================

var il_rms = 0;
var A_coil_req = 0;
var d_coil_req = 0;
var il_peak_absolute_global = 0;

// TDK N87 typical fit range: (25kHz - 300kHz, 50mT - 300mT, 100°C)
var coreMaterialParams = { k: 16.9, alpha: 1.25, beta: 2.35 };

async function fetchSteinmetzParams() {
    try {
        if (typeof db === 'undefined') return;
        const snap = await db.collection("core_materials").limit(1).get();
        if (!snap.empty) {
            const data = snap.docs[0].data();
            coreMaterialParams.k = data.k_steinmetz || data.k || 16.9;
            coreMaterialParams.alpha = data.alpha || 1.25;
            coreMaterialParams.beta = data.beta || 2.35;
        }
    } catch (e) {
        console.warn("Firebase materyal verisi çekilemedi, varsayılan katsayılar kullanılıyor.", e);
    }
}
document.addEventListener('DOMContentLoaded', fetchSteinmetzParams);

function toggleEffMode() {
    var mode = document.getElementById("effMode").value;
    if (mode === "ideal") {
        document.getElementById("idealInputGroup").style.display = "contents";
        document.getElementById("realInputGroup").style.display = "none";
        document.getElementById("powerLossSection").style.display = "none";
        if (document.getElementById("lossResultRow")) document.getElementById("lossResultRow").style.display = "none";
    } else {
        document.getElementById("idealInputGroup").style.display = "none";
        document.getElementById("realInputGroup").style.display = "block";
        if (document.getElementById("lossResultRow")) document.getElementById("lossResultRow").style.display = "table-row";
    }
}

function designInductor(imax, params) {
    var Ku = params.Ku || 0.4;
    var Bmax_est = params.Bmax_est || 0.25;

    var J_val = MagneticUtils.getCurrentDensity(params.fsw);
    var J_est = J_val * 1e6;
    var Ap = (params.L_H * imax * imax) / (Ku * Bmax_est * J_est);

    var Ae_est = Math.sqrt(Ap);
    var Ve_est = 10 * Math.pow(Ae_est, 1.5);
    var N_est = Math.max(1, Math.round((params.L_H * imax) / (Bmax_est * Ae_est)));

    var I_ripple_pp_nom = imax * (params.ripplePct / 100);

    return {
        Ae: Ae_est,
        Ve: Ve_est,
        N: N_est,
        I_ripple_pp_nom: I_ripple_pp_nom
    };
}

function calculateRealEfficiency(currentLoad, params, designParams) {
    var I_ripple_pp = designParams.I_ripple_pp_nom;
    var I_ripple_rms = I_ripple_pp / (2 * Math.sqrt(3));

    var I_rms = Math.sqrt(Math.pow(currentLoad, 2) + (Math.pow(I_ripple_pp, 2) / 12));

    var P_DCR = Math.pow(I_rms, 2) * params.DCR;
    var ACR = params.DCR * params.ACR_Mult;
    var P_ACR = Math.pow(I_ripple_rms, 2) * ACR;

    var k_steinmetz = coreMaterialParams.k;
    var alpha = coreMaterialParams.alpha;
    var beta = coreMaterialParams.beta;

    var delta_B_T = (params.L_H * I_ripple_pp) / (designParams.N * designParams.Ae);
    var B_m = delta_B_T / 2;

    var f_khz = params.fsw;
    var P_core_kW_m3 = k_steinmetz * Math.pow(f_khz, alpha) * Math.pow(B_m, beta);
    var P_core_W_m3 = P_core_kW_m3 * 1000;

    var P_Core = P_core_W_m3 * designParams.Ve;

    if (isNaN(P_Core) || P_Core < 0) P_Core = 0;

    var P_Total = P_DCR + P_ACR + P_Core;
    var P_out_real = currentLoad * (params.Vout || 24);
    var efficiency = (P_out_real / (P_out_real + P_Total)) * 100;

    return {
        totalLossW: P_Total,
        efficiencyPercent: Math.max(0, efficiency),
        breakdown: { P_DCR: P_DCR, P_ACR: P_ACR, P_Core: P_Core }
    };
}

function generateRealEffCurve(max_iout, params) {
    var values = [], labels = [];
    var physicalDesign = designInductor(max_iout, params);

    for (var pct = 10; pct <= 120; pct += 5) {
        var currentLoad = max_iout * (pct / 100);
        if (currentLoad <= 0.001) currentLoad = 0.001;

        var res = calculateRealEfficiency(currentLoad, params, physicalDesign);
        values.push(parseFloat(Math.min(99.5, Math.max(0, res.efficiencyPercent)).toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
}

function generateIdealEffCurve(eff_full_load) {
    var values = [], labels = [];
    var k_fix = 0.01, k_cond = 0.02;

    function raw_eff(p) {
        if (p < 0.001) p = 0.001;
        var loss = k_fix + k_cond * p * p;
        return p / (p + loss);
    }
    var scale = eff_full_load / raw_eff(1.0);

    for (var pct = 10; pct <= 120; pct += 5) {
        var p = pct / 100.0;
        var e = raw_eff(p) * scale * 100;
        values.push(parseFloat(Math.min(99.5, Math.max(0, e)).toFixed(1)));
        labels.push(pct + "%");
    }
    return { values: values, labels: labels };
}

// ================================================================
// WAVEFORM GENERATOR
// ================================================================
function generateInductorWaveforms(imax, ripplePct, fsw_khz) {
    var labels = [], il_avg = [], il_ripple_max = [], il_ripple_min = [];
    var PTS = 100;
    var T_mains_half = 10.0;
    var omega = Math.PI / T_mains_half;

    var deltaILMax = imax * (ripplePct / 100);

    for (var k = 0; k <= PTS; k++) {
        var t_ms = (k / PTS) * T_mains_half;
        labels.push(t_ms.toFixed(2));

        var sin_wt = Math.sin(omega * t_ms);
        var current_il_avg = imax * sin_wt;
        var current_delta = deltaILMax * sin_wt;

        il_avg.push(current_il_avg);
        il_ripple_max.push(current_il_avg + (current_delta / 2));
        il_ripple_min.push(Math.max(0, current_il_avg - (current_delta / 2)));
    }

    return { labels: labels, il_avg: il_avg, il_ripple_max: il_ripple_max, il_ripple_min: il_ripple_min };
}

function drawCharts(wf, effData) {
    var N = wf.labels.length;
    var tickStep = Math.max(1, Math.floor(N / 10));
    var textColor = '#e0e0e0';
    var gridColor = 'rgba(255, 255, 255, 0.1)';

    var getT = window.getT || function (key) { return key; };

    function baseOpts(yTitle) {
        return {
            responsive: true, animation: false,
            elements: { point: { radius: 0 }, line: { tension: 0.4 } },
            scales: {
                x: { type: 'category', ticks: { color: textColor, maxTicksLimit: 11, callback: function (v, i) { return (i % tickStep === 0) ? wf.labels[i] + "ms" : ''; } }, title: { display: true, text: 'Time (ms)', color: textColor }, grid: { color: gridColor, borderColor: gridColor } },
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
                    borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: 'rgba(129, 199, 132, 1)'
                }]
            },
            options: { responsive: true, animation: false, scales: { x: { title: { display: true, text: getT('chart_load_pct') || 'Load (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } }, y: { min: 0, max: 100, title: { display: true, text: getT('chart_eff_pct') || 'Efficiency (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor, borderColor: gridColor } } }, plugins: { legend: { display: true, position: 'top', labels: { color: textColor } } } }
        });
    }
}

// ================================================================
// MAIN CALCULATION & DOM UPDATE
// ================================================================
async function updateChartsAndTable() {
    var L_uH_input = parseFloat(document.getElementById('vin_min').value);
    var I_max_input = parseFloat(document.getElementById('vin_max').value);

    var effMode = document.getElementById("effMode").value;
    var getT = window.getT || function (key) { return key; };

    if (isNaN(L_uH_input) || isNaN(I_max_input) || L_uH_input <= 0 || I_max_input <= 0) {
        alert(getT('alert_fill_fields'));
        return;
    }

    var L_H = L_uH_input * 1e-6;
    var wmax1 = 0.5 * L_H * Math.pow(I_max_input, 2) * 1e6;
    var lOutput = L_uH_input;
    var imax = I_max_input;

    il_peak_absolute_global = imax;

    var finalKullanilacakVerim = 95.0;
    var effData;
    var params = {
        ripplePct: parseFloat(document.getElementById('p_ripple_pct')?.value) || 30,
        fsw: parseFloat(document.getElementById('p_fsw')?.value) || 100,
        Vout: parseFloat(document.getElementById('p_vout')?.value) || 24,
        L_H: L_H,
        Ku: 0.4,
        Bmax_est: 0.25
    };

    var deltaIL = imax * (params.ripplePct / 100);

    if (effMode === "ideal") {
        var verim = parseFloat(document.getElementById('verim')?.value) || 95;
        effData = generateIdealEffCurve(verim / 100);
        document.getElementById("powerLossSection").style.display = "none";
        if (document.getElementById("lossResultRow")) document.getElementById("lossResultRow").style.display = "none";
        var loss = Math.abs(100 - verim);
        if (document.getElementById('loss')) document.getElementById('loss').innerText = loss.toFixed(2);
    } else {
        params.DCR = parseFloat(document.getElementById('p_dcr').value) || 0.045;
        params.ACR_Mult = parseFloat(document.getElementById('p_acr_mult').value) || 1.5;

        effData = generateRealEffCurve(imax, params);
        var physicalDesign = designInductor(imax, params);
        var realRes = calculateRealEfficiency(imax, params, physicalDesign);

        finalKullanilacakVerim = realRes.efficiencyPercent;
        document.getElementById("powerLossSection").style.display = "flex";
        if (document.getElementById("lossResultRow")) document.getElementById("lossResultRow").style.display = "table-row";

        document.getElementById("res_pdcr").innerText = realRes.breakdown.P_DCR.toFixed(4) + " W";
        document.getElementById("res_pacr").innerText = realRes.breakdown.P_ACR.toFixed(4) + " W";
        document.getElementById("res_pcore").innerText = realRes.breakdown.P_Core.toFixed(4) + " W";
        document.getElementById("res_ptotal").innerText = realRes.totalLossW.toFixed(4) + " W";
        document.getElementById("res_peff").innerText = realRes.efficiencyPercent.toFixed(2) + " %";

        var loss = Math.abs(100 - finalKullanilacakVerim);
        if (document.getElementById('loss')) document.getElementById('loss').innerText = loss.toFixed(2);
    }

    document.getElementById('lOutput').innerText = lOutput.toFixed(2);
    document.getElementById('wmax1').innerText = wmax1.toFixed(2);

    if (document.getElementById('deltaILMax')) {
        document.getElementById('deltaILMax').innerText = deltaIL.toFixed(2);
    }

    // ----------------------------------------------------
    // DCM WARNING MANAGEMENT
    // ----------------------------------------------------
    let dcmWarningEl = document.getElementById('dcmWarningMessage');
    if (!dcmWarningEl) {
        dcmWarningEl = document.createElement('div');
        dcmWarningEl.id = 'dcmWarningMessage';
        dcmWarningEl.className = 'alert alert-warning mt-3 mb-0 py-2 px-3 border border-warning text-dark';
        dcmWarningEl.style.fontSize = '12px';
        dcmWarningEl.style.display = 'none';
        dcmWarningEl.style.backgroundColor = '#fff3cd';

        let chartsDiv = document.getElementById('charts');
        if (chartsDiv) {
            chartsDiv.appendChild(dcmWarningEl);
        }
    }

    // Limit control for 10% load: If Iavg < I_ripple/2, the circuit enters DCM.
    let isDcmAtLightLoad = (imax * 0.1) < (deltaIL / 2);

    if (isDcmAtLightLoad && effMode === "real") {
        let boundaryPct = Math.ceil(((deltaIL / 2) / imax) * 100);

        let warningTemplate = getT("dcm_warning_message");

        if (warningTemplate === "dcm_warning_message") {
            warningTemplate = "<strong>* Süreksiz İletim (DCM) Varsayımı:</strong> Seçilen %{0} ripple oranıyla düşük yüklerde (≈%{1} altı) indüktör akımı sıfıra inerek Süreksiz İletim Moduna (DCM) geçmektedir. Verim grafiğindeki RMS formülleri Sürekli İletim Modu (CCM) varsayımıyla hesaplandığından, düşük yük ucundaki verim gerçekte bir miktar farklılaşabilir.";
        }

        dcmWarningEl.innerHTML = warningTemplate.replace('{0}', params.ripplePct).replace('{1}', boundaryPct);
        dcmWarningEl.style.display = 'block';
    } else {
        dcmWarningEl.style.display = 'none';
    }

    var J_val = MagneticUtils.getCurrentDensity(params.fsw);

    il_rms = Math.sqrt(Math.pow(imax, 2) + (Math.pow(deltaIL, 2) / 12));
    A_coil_req = il_rms / J_val;
    d_coil_req = 2 * Math.sqrt(A_coil_req / Math.PI);

    var wf = generateInductorWaveforms(imax, params.ripplePct, params.fsw);
    drawCharts(wf, effData);
}

function hesapla() {
    updateChartsAndTable();
}

// ================================================================
// TABLO & MODAL ENTEGRASYONU
// ================================================================
window.openSelectedTable = function () {
    const modeEl = document.querySelector('input[name="coreSelectionMode"]:checked');
    const mode = modeEl ? modeEl.value : 'standard';

    var lOutput = parseFloat(document.getElementById('lOutput').innerText);
    var wmax1 = parseFloat(document.getElementById('wmax1').innerText);

    var getT = window.getT || function (key) { return key; };

    if (isNaN(lOutput) || lOutput <= 0) {
        alert(getT('alert_fill_fields') || "Lütfen önce hesaplama yapın!");
        return;
    }

    if (mode === 'advanced') {
        if (typeof window.openAdvancedTable === 'function') {
            window.openAdvancedTable(1);
        } else {
            alert(getT('alert_advanced_module_error') || 'Advanced mod modülü yüklenemedi.');
        }
    } else {
        if (typeof UIModal !== 'undefined') {
            var f_khz = parseFloat(document.getElementById('p_fsw') ? document.getElementById('p_fsw').value : 100) || 100;
            UIModal.openStandardModal({
                title: getT('title_coil_data') || "İndüktör Bobin Seçimi",
                L_H: lOutput * 1e-6,
                L_uH: lOutput,
                Wmax: wmax1,
                Imax: il_peak_absolute_global,
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

// Event Listeners
if (document.getElementById('calculateButton')) {
    document.getElementById('calculateButton').addEventListener('click', hesapla);
}
if (document.getElementById('openButton')) {
    document.getElementById('openButton').addEventListener('click', window.openSelectedTable);
}