/* ============================================================================
   SMPS INPUT FILTER CALCULATOR
   ============================================================================ */

'use strict';

let bodeMagChartInstance = null;
let bodePhaseChartInstance = null;
let impedanceChartInstance = null;
let rampChartInstance = null;

window.addEventListener('DOMContentLoaded', () => {
    initCharts();
    hesaplaFiltre();
});

Chart.defaults.color = '#e0e0e0';
Chart.defaults.scale.grid.color = 'rgba(255,255,255,0.1)';
Chart.defaults.scale.grid.borderColor = 'rgba(255,255,255,0.2)';
Chart.defaults.font.family = "'Open Sans', 'Raleway', sans-serif";

function hesaplaFiltre() {

    const Vin_min = parseFloat(document.getElementById('V_in_min').value) || 6.0;
    const Vout = parseFloat(document.getElementById('V_out').value) || 2.0;
    const Iout_max = readIoutMax();
    const Fsw_kHz = parseFloat(document.getElementById('F_sw').value) || 400.0;

    const Efficiency = parseFloat(document.getElementById('Efficiency_pct').value) || 90.0;

    const Ls_uH = parseFloat(document.getElementById('L_s').value) || 3.0;
    const Rs = parseFloat(document.getElementById('R_s').value) || 0.05;

    const L2_uH = parseFloat(document.getElementById('L_f').value) || 2.0;
    const R2 = parseFloat(document.getElementById('R_f').value) || 0.05;

    const Cf_uF = parseFloat(document.getElementById('C_f').value) || 6.6;
    const Rcf = parseFloat(document.getElementById('R_cf').value) || 0.2;

    const Cp_uF = parseFloat(document.getElementById('L_d').value) || 2.2;
    const Rf = parseFloat(document.getElementById('R_d').value) || 1.0;

    const Cd_uF = parseFloat(document.getElementById('C_d').value) || 44.0;
    const Rd = parseFloat(document.getElementById('R_rd').value) || 0.2;

    const Vgate = parseFloat(document.getElementById('V_gate').value) || 12.0;
    const Rramp_k = parseFloat(document.getElementById('R_ramp').value) || 23.0;
    const Cramp_uF = parseFloat(document.getElementById('C_ramp').value) || 0.01;

    const K5 = Ls_uH * 1e-6;   // Ls
    const K6 = Rs;              // Rs
    const K3 = L2_uH * 1e-6;   // L2
    const K4 = R2;              // R2
    const K11 = Cf_uF * 1e-6;  // Cf
    const K12 = Rcf;             // Rcf
    const K7 = Cp_uF * 1e-6;   // Cp
    const K8 = Rf;              // Rf
    const K9 = Cd_uF * 1e-6;   // Cd
    const K10 = Rd;              // Rd
    const Fsw = Fsw_kHz * 1e3;
    const Rramp = Rramp_k * 1e3;
    const Cramp = Cramp_uF * 1e-6;

    const eta = Efficiency / 100.0;
    const abs_Rin = (Vin_min * Vin_min * eta) / (Vout * Iout_max);

    const D_max = Vout / Vin_min;
    const t_on_max = D_max / Fsw;
    const Ramp_Slope = Vgate / (Rramp * Cramp);
    const Vpeak = Ramp_Slope * t_on_max;

    const add = (a, b) => ({ r: a.r + b.r, i: a.i + b.i });
    const mul = (a, b) => ({ r: a.r * b.r - a.i * b.i, i: a.r * b.i + a.i * b.r });
    const div = (a, b) => {
        const den = b.r * b.r + b.i * b.i;
        return { r: (a.r * b.r + a.i * b.i) / den, i: (a.i * b.r - a.r * b.i) / den };
    };
    const inv = (a) => {
        const den = a.r * a.r + a.i * a.i;
        return { r: a.r / den, i: -a.i / den };
    };
    const one = { r: 1, i: 0 };

    const f_start = 10;
    const f_end = Fsw * 10000;
    const points = 301;
    const logStep = Math.log10(f_end / f_start) / (points - 1);

    window.exportData = { f: [], mag: [], phase: [], zout: [], rin: [] };
    let Zout_max_dB = -Infinity;

    for (let idx = 0; idx < points; idx++) {
        const f = Math.pow(10, idx * logStep) * f_start + 0.1;
        const w = 2 * Math.PI * f;

        const Zs1 = { r: K6, i: w * K5 }; // Ls + Rs
        const Zs2 = { r: K4, i: w * K3 }; // L2 + R2

        const sK11 = { r: 0, i: w * K11 };
        const den1 = { r: 1, i: w * K11 * K12 };
        const Yp1 = div(sK11, den1);

        const sK7 = { r: 0, i: w * K7 };
        const den2 = { r: 1, i: w * K7 * K8 };
        const Yp2 = div(sK7, den2);

        const sK9 = { r: 0, i: w * K9 };
        const den3 = { r: 1, i: w * K9 * K10 };
        const Yp3 = div(sK9, den3);

        const Yout_shunts = add(Yp2, Yp3);

        const t1 = add(one, mul(Zs2, Yout_shunts));
        const t2 = add(one, mul(Zs1, Yp1));
        const t3 = mul(Zs1, Yout_shunts);
        const H_inv = add(mul(t1, t2), t3);
        const H = inv(H_inv);

        const Ys1 = inv(Zs1);
        const Zn1 = inv(add(Ys1, Yp1));
        const Zback = add(Zs2, Zn1);

        const Yback = inv(Zback);
        const Yout_total = add(Yback, Yout_shunts);
        const Zout = inv(Yout_total);

        const mag_H = Math.sqrt(H.r * H.r + H.i * H.i);
        const mag_H_dB = 20 * Math.log10(mag_H);

        const mag_Zout = Math.sqrt(Zout.r * Zout.r + Zout.i * Zout.i);
        const mag_Zout_dB = 20 * Math.log10(mag_Zout);

        let phase_H = Math.atan2(H.i, H.r) * (180 / Math.PI);
        if (idx > 0) {
            let prev_phase = exportData.phase[idx - 1];
            while (phase_H - prev_phase > 180) phase_H -= 360;
            while (phase_H - prev_phase < -180) phase_H += 360;
        }

        if (mag_Zout_dB > Zout_max_dB) Zout_max_dB = mag_Zout_dB;

        exportData.f.push(f);
        exportData.mag.push(mag_H_dB);
        exportData.phase.push(phase_H);
        exportData.zout.push(mag_Zout_dB);
        exportData.rin.push(20 * Math.log10(abs_Rin));
    }

    const Zout_max_linear = Math.pow(10, Zout_max_dB / 20);

    const L_total = K5 + K3;
    const Fres_Hz = 1 / (2 * Math.PI * Math.sqrt(L_total * K11));

    document.getElementById('res_Rin').innerText = abs_Rin.toFixed(2);
    document.getElementById('res_Zout').innerText = Zout_max_linear.toFixed(3);
    document.getElementById('res_Fres').innerText = (Fres_Hz / 1000).toFixed(2);
    document.getElementById('res_Vpeak').innerText = Vpeak.toFixed(4);

    const statusBadge = document.getElementById('res_status');
    const warningBox = document.getElementById('dampingWarning');
    const Rin_dB = 20 * Math.log10(abs_Rin);
    const marginDB = 6;
    const isSafe = (Zout_max_dB + marginDB) <= Rin_dB;

    if (!isSafe) {
        statusBadge.innerText = getT('badge_danger_damping') || 'Tehlike: Yetersiz Sönümleme';
        statusBadge.className = "badge bg-danger";
        warningBox.style.display = "block";
    } else {
        statusBadge.innerText = getT('badge_safe_damping') || 'Güvenli (Safe)';
        statusBadge.className = "badge bg-success";
        warningBox.style.display = "none";
    }

    updateCharts(t_on_max, Vpeak);
}

function readIoutMax() {
    const directField = document.getElementById('I_out_max');
    if (directField) {
        const v = parseFloat(directField.value);
        if (!isNaN(v)) return v;
    }
    return 12.0;
}

function initCharts() {
    const logX = { type: 'logarithmic', title: { display: true, text: getT('chart_freq_hz') } };

    const ctxMag = document.getElementById('bodeMagChart').getContext('2d');
    bodeMagChartInstance = new Chart(ctxMag, {
        type: 'line',
        data: { datasets: [{ label: getT('chart_mag_db'), borderColor: '#00d2ff', backgroundColor: 'rgba(0,210,255,0.1)', fill: true, pointRadius: 0, borderWidth: 2 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: getT('chart_transfer_mag'), color: '#e0e0e0' } },
            scales: { x: logX, y: { title: { display: true, text: getT('chart_mag_db') } } }
        }
    });

    const ctxPhase = document.getElementById('bodePhaseChart').getContext('2d');
    bodePhaseChartInstance = new Chart(ctxPhase, {
        type: 'line',
        data: { datasets: [{ label: getT('chart_phase_deg_short'), borderColor: '#ff007a', fill: false, pointRadius: 0, borderWidth: 2 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: getT('chart_transfer_phase'), color: '#e0e0e0' } },
            scales: { x: logX, y: { title: { display: true, text: getT('chart_phase_deg') } } }
        }
    });

    const ctxImp = document.getElementById('impedanceChart').getContext('2d');
    impedanceChartInstance = new Chart(ctxImp, {
        type: 'line',
        data: {
            datasets: [
                { label: getT('chart_zout_filter'), borderColor: '#f2c94c', pointRadius: 0, borderWidth: 2 },
                { label: getT('chart_rin_psu'), borderColor: '#eb5757', borderDash: [5, 5], pointRadius: 0, borderWidth: 2 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { color: '#e0e0e0' } }, title: { display: true, text: getT('chart_middlebrook_comp'), color: '#e0e0e0' } },
            scales: { x: logX, y: { title: { display: true, text: getT('chart_impedance_db') } } }
        }
    });

    const ctxRamp = document.getElementById('rampChart').getContext('2d');
    rampChartInstance = new Chart(ctxRamp, {
        type: 'line',
        data: { datasets: [{ label: getT('chart_v_ramp'), borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)', fill: true, pointRadius: 0, borderWidth: 2 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: getT('chart_ramp_comp'), color: '#e0e0e0' } },
            scales: { x: { type: 'linear', title: { display: true, text: getT('chart_time_us') } }, y: { title: { display: true, text: getT('chart_voltage_v') }, beginAtZero: true } }
        }
    });
}

function updateCharts(t_on_max, Vpeak) {
    const dataMag = [], dataPhase = [], dataZout = [], dataRin = [];
    for (let i = 0; i < exportData.f.length; i++) {
        dataMag.push({ x: exportData.f[i], y: exportData.mag[i] });
        dataPhase.push({ x: exportData.f[i], y: exportData.phase[i] });
        dataZout.push({ x: exportData.f[i], y: exportData.zout[i] });
        dataRin.push({ x: exportData.f[i], y: exportData.rin[i] });
    }
    bodeMagChartInstance.data.datasets[0].data = dataMag;
    bodeMagChartInstance.options.plugins.title.text = getT('chart_transfer_mag');
    bodeMagChartInstance.update();

    bodePhaseChartInstance.data.datasets[0].data = dataPhase;
    bodePhaseChartInstance.options.plugins.title.text = getT('chart_transfer_phase');
    bodePhaseChartInstance.update();

    impedanceChartInstance.data.datasets[0].data = dataZout;
    impedanceChartInstance.data.datasets[1].data = dataRin;
    impedanceChartInstance.data.datasets[0].label = getT('chart_zout_filter');
    impedanceChartInstance.data.datasets[1].label = getT('chart_rin_psu');
    impedanceChartInstance.options.plugins.title.text = getT('chart_middlebrook_comp');
    impedanceChartInstance.update();

    const rampPoints = 50;
    const dataRamp = [];
    for (let i = 0; i <= rampPoints; i++) {
        dataRamp.push({ x: (t_on_max / rampPoints) * i * 1e6, y: (Vpeak / rampPoints) * i });
    }
    dataRamp.push({ x: t_on_max * 1e6, y: 0 });
    rampChartInstance.data.datasets[0].data = dataRamp;
    rampChartInstance.options.plugins.title.text = getT('chart_ramp_comp');
    rampChartInstance.update();
}

function exportFilterParams() {
    if (!window.exportData || window.exportData.f.length === 0) {
        alert(getT('alert_calc_first_filter'));
        return;
    }
    let csv = "data:text/csv;charset=utf-8,";
    csv += getT('csv_header_filter') + "\n";
    for (let i = 0; i < exportData.f.length; i++) {
        csv += [
            exportData.f[i].toFixed(2),
            exportData.mag[i].toFixed(4),
            exportData.phase[i].toFixed(4),
            exportData.zout[i].toFixed(4),
            exportData.rin[i].toFixed(4)
        ].join(",") + "\n";
    }
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", getT('csv_filename_filter'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}