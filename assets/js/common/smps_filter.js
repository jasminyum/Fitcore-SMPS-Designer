// ================================================================
// SMPS FILTER CALCULATOR
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================

'use strict';

class SMPSFilterCalculator {
    constructor() {
        this.mu0 = 4 * Math.PI * 1e-7;
    }

	getStandardValue(value) {
        if (!value || isNaN(value) || value <= 0) return 0;
        
        const e12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2, 10.0];
        const exponent = Math.floor(Math.log10(value));
        const normalized = value / Math.pow(10, exponent);

        let closest = e12[0];
        let minDiff = Math.abs(normalized - e12[0]);

        for (let i = 1; i < e12.length; i++) {
            let diff = Math.abs(normalized - e12[i]);
            if (diff < minDiff) {
                minDiff = diff;
                closest = e12[i];
            }
        }
        return closest * Math.pow(10, exponent);
    }

    calculateInputFilter(topology, Vin, Vout, Pout, f_sw_khz, efficiency = 0.85) {
        Vin = Vin > 0 ? Vin : 1;
        const f_sw_hz = (f_sw_khz > 0 ? f_sw_khz : 50) * 1000;
        const Pin = Pout / (efficiency > 0 ? efficiency : 0.85);
        const Iin_avg = Pin / Vin;
        const Rin_psu = Vin / (Iin_avg > 0 ? Iin_avg : 1);

        const Uf = 0.7;
        const Vout_mag = Math.abs(Vout);
        const dV_in = Vin * 0.01 || 0.1;

        let D = 0.5;
        let isPulsedInput = true;
        let Iin_ripple = 0;
        let Cin_raw = 1e-6;

        const topo = (topology || "buck").toLowerCase();

        if (topo.includes('sepic') || topo.includes('cuk')) {
            D = (Vout_mag + Uf) / (Vin + Vout_mag + Uf);
            isPulsedInput = false;
        } else if (topo.includes('buck') && !topo.includes('boost')) {
            D = (Vout_mag + Uf) / (Vin + Uf);
            isPulsedInput = true;
        } else if (topo.includes('boost') && !topo.includes('buck')) {
            D = (Vout_mag + Uf - Vin) / (Vout_mag + Uf);
            isPulsedInput = false;
        } else if (topo.includes('buck-boost') || topo.includes('inverting') || topo.includes('zeta')) {
            D = (Vout_mag + Uf) / (Vin + Vout_mag + Uf);
            isPulsedInput = true;
        } else if (topo.includes('flyback')) {
            D = 0.45;
            isPulsedInput = true;
        } else if (topo.includes('forward')) {
            D = 0.40;
            isPulsedInput = true;
        } else if (topo.includes('push-pull') || topo.includes('full-bridge') || topo.includes('half-bridge')) {
            D = 0.5;
            isPulsedInput = true;
        } else if (topo.includes('llc') || topo.includes('dab')) {
            D = 0.5;
            isPulsedInput = false;
        }

        if (D <= 0.05) D = 0.05;
        if (D >= 0.95) D = 0.95;

        if (isPulsedInput) {
            Iin_ripple = Iin_avg / D;
            Cin_raw = (Iin_avg * (1 - D)) / (f_sw_hz * dV_in);
        } else {
            Iin_ripple = Iin_avg * 0.30;
            Cin_raw = Iin_ripple / (8 * f_sw_hz * dV_in);
        }

        if (isNaN(Cin_raw) || Cin_raw < 1e-6) Cin_raw = 1e-6;
        if (Cin_raw > 2000e-6) Cin_raw = 2000e-6;
        const Cin = this.getStandardValue(Cin_raw);

        let fc = f_sw_hz / 10;
        if (fc > 50000) fc = 50000;
        const wc = 2 * Math.PI * fc;

        let L_raw = 1 / (Math.pow(wc, 2) * (Cin || 1e-6));
        if (isNaN(L_raw) || L_raw < 0.47e-6) L_raw = 0.47e-6;
        const L = this.getStandardValue(L_raw);

        let Cd_raw = 4 * Cin;
        const Cd = this.getStandardValue(Cd_raw);

        let Rd_raw = 0.4 * Math.sqrt(L / (Cin || 1e-6));
        const Rd = this.getStandardValue(Rd_raw);

        return {
            cutoff_freq_hz: 1 / (2 * Math.PI * Math.sqrt(L * Cin) || 1),
            psu_input_impedance_ohms: Rin_psu,
            L_uH: L * 1e6,
            C_uF: Cin * 1e6,
            Cd_damping_uF: Cd * 1e6,
            Rd_damping_ohms: Rd,
            Iin_ripple_A: Iin_ripple,
            calculated_duty_cycle: D
        };
    }

    calculateOutputFilter(topology, Vout, Iout, f_sw_khz, target_attenuation_db = 40) {
        const f_sw_hz = (f_sw_khz > 0 ? f_sw_khz : 50) * 1000;
        const decades = target_attenuation_db / 40;
        const fc = f_sw_hz / Math.pow(10, decades);
        const wc = 2 * Math.PI * fc;

        let L_out_raw = 1.0e-6;
        if (Iout < 1.0) L_out_raw = 4.7e-6;
        else if (Iout < 3.0) L_out_raw = 2.2e-6;
        else if (Iout <= 10.0) L_out_raw = 1.0e-6;
        else L_out_raw = 0.47e-6;

        const L_out = this.getStandardValue(L_out_raw);

        let C_out_raw = 1 / (Math.pow(wc, 2) * (L_out || 1e-6));
        if (isNaN(C_out_raw) || C_out_raw < 1e-6) C_out_raw = 1e-6;
        const C_out = this.getStandardValue(C_out_raw);

        const R_damp_raw = Math.sqrt(L_out / (C_out || 1e-6)) * 0.5;
        let R_damp = this.getStandardValue(R_damp_raw);
        if (R_damp < 0.01) R_damp = 0.01;
        if (R_damp > 10.0) R_damp = 10.0;

        return {
            cutoff_freq_hz: 1 / (2 * Math.PI * Math.sqrt(L_out * C_out) || 1),
            L_out_uH: L_out * 1e6,
            C_out_uF: C_out * 1e6,
            R_damp_ohms: R_damp,
            attenuation_at_fsw_db: target_attenuation_db
        };
    }

    calculatePFCFilter(Vin_ac_min, Vout, Pout, f_sw_khz, efficiency = 0.90, v_ripple_ui = 0, i_ripple_ui = 0) {
        const f_sw_hz = (f_sw_khz > 0 ? f_sw_khz : 50) * 1000;
        const f_line = 50;

        const v_ripple_pp = v_ripple_ui > 0 ? v_ripple_ui : (Vout * 0.05);
        const C_ripple = Pout / (2 * Math.PI * f_line * v_ripple_pp * (Vout || 1));

        const t_holdup_s = 0.016;
        const v_min_holdup = Vout * 0.75;
        let denominator = Math.pow(Vout, 2) - Math.pow(v_min_holdup, 2);
        const C_holdup = (2 * Pout * t_holdup_s) / (denominator > 0 ? denominator : 1);

        const C_out_raw = Math.max(C_ripple, C_holdup);
        const C_out = this.getStandardValue(isNaN(C_out_raw) ? 100e-6 : C_out_raw);

        const I_ripple_percent = i_ripple_ui > 0 ? (i_ripple_ui > 1 ? i_ripple_ui / 100 : i_ripple_ui) : 0.30;

        const Vin_pk = Math.sqrt(2) * (Vin_ac_min > 0 ? Vin_ac_min : 1);

        let L_raw = (Math.pow(Vin_pk, 2) * (1 - (Vin_pk / (Vout || 1)))) /
            (2 * I_ripple_percent * f_sw_hz * Pout * efficiency || 1);

        if (isNaN(L_raw) || L_raw < 0) L_raw = 100e-6;
        const L_out = this.getStandardValue(L_raw);

        let C_in_raw = (Pout / ((Vin_ac_min > 0 ? Vin_ac_min : 1) * 1000)) * 1e-6;
        if (isNaN(C_in_raw) || C_in_raw > 1.5e-6) C_in_raw = 1.5e-6;
        if (C_in_raw < 0.1e-6) C_in_raw = 0.1e-6;
        const C_in = this.getStandardValue(C_in_raw);

        return {
            L_pfc_uH: L_out * 1e6,
            C_bulk_uF: C_out * 1e6,
            C_in_bypass_uF: C_in * 1e6,
            V_ripple_expected: v_ripple_pp || 0
        };
    }

    generateFilterReport(topology, Vin, Vout, Iout, f_sw_khz, efficiency = 0.85, v_ripple_ui = 0, i_ripple_ui = 0) {
        const Pout = Math.abs(Vout) * Iout;
        const topoLower = (topology || "buck").toLowerCase();

        if (topoLower === 'power factor') {
            const pfcFilter = this.calculatePFCFilter(Vin, Math.abs(Vout), Pout, f_sw_khz, efficiency, v_ripple_ui, i_ripple_ui);
            return {
                topology: topology,
                isPFC: true,
                specs: { Vin, Vout, Iout, Fsw_kHz: f_sw_khz },
                pfc_data: pfcFilter
            };
        }

        const inputFilter = this.calculateInputFilter(topology, Vin, Math.abs(Vout), Pout, f_sw_khz, efficiency);
        const outputFilter = this.calculateOutputFilter(topology, Math.abs(Vout), Iout, f_sw_khz, 40);

        return {
            topology: topology,
            isPFC: false,
            specs: { Vin, Vout, Iout, Fsw_kHz: f_sw_khz },
            input_filter: inputFilter,
            output_filter: outputFilter
        };
    }
}

// ----------------------------------------------------
// FILTER DESIGN UI (MODAL) CONNECTION
// ----------------------------------------------------
window.openFilterDesign = function (topologyOverride = null) {
    function safeVal(id) {
        var el = document.getElementById(id);
        if (!el) return 0;
        var val = el.value !== undefined ? el.value : el.innerText;
        var parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    }

    var pageTitle = (document.title || "").toLowerCase();
    var topology = topologyOverride;

    if (!topology) {
        if (pageTitle.includes('sepic')) topology = 'sepic';
        else if (pageTitle.includes('cuk')) topology = 'cuk';
        else if (pageTitle.includes('zeta')) topology = 'zeta';
        else if (pageTitle.includes('buck-boost')) topology = 'buck-boost';
        else if (pageTitle.includes('buck')) topology = 'buck';
        else if (pageTitle.includes('boost')) topology = 'boost';
        else if (pageTitle.includes('flyback')) topology = 'flyback';
        else if (pageTitle.includes('forward')) topology = 'forward';
        else if (pageTitle.includes('push-pull')) topology = 'push-pull';
        else if (pageTitle.includes('power factor')) topology = 'power factor';
        else if (pageTitle.includes('llc')) topology = 'llc';
        else if (pageTitle.includes('dab')) topology = 'dab';
        else topology = 'buck';
    }

    var vin_nom = safeVal('vin_nom');
    if (vin_nom === 0) {
        var vin_min = safeVal('vin_min');
        var vin_max = safeVal('vin_max');
        vin_nom = (vin_min + vin_max) / 2;
    }

    var vout = safeVal('vout') || safeVal('vout_nom');
    var ilout = safeVal('ilout') || safeVal('iout');
    var f_khz = safeVal('f_khz') || 50;

    var effModeEl = document.getElementById("effMode");
    var effMode = effModeEl ? effModeEl.value : "ideal";

    var verim = 90;
    if (effMode === "ideal") {
        var userEff = safeVal('verim');
        if (userEff > 0) verim = userEff;
    } else {
        var calcEff = safeVal('res_peff');
        if (calcEff > 0) verim = calcEff;
    }

    if (vin_nom === 0 || vout === 0 || ilout === 0) {
        alert(window.getT ? window.getT('alert_fill_fields') : "Lütfen önce hesaplama yapın veya giriş değerlerini kontrol edin.");
        return;
    }

    var v_ripple_ui = safeVal('v_ripple') || safeVal('vripple');
    var i_ripple_ui = safeVal('i_ripple') || safeVal('iripple');

    // Initialize the class and calculate (fallback and validation are embedded in the class)
    var filterCalc = new SMPSFilterCalculator();
    var report = filterCalc.generateFilterReport(topology, vin_nom, vout, ilout, f_khz, verim / 100, v_ripple_ui, i_ripple_ui);

    var getTrans = function (key) { return window.getT ? window.getT(key) : key; };
    var topoName = topology.toUpperCase();

    var t_eff = getTrans('filter_used_eff') || "Kullanılan Verim Değeri:";
    var htmlContent = "";

    if (report.isPFC) {
        var pfc_L = report.pfc_data.L_pfc_uH.toFixed(2);
        var pfc_Cbulk = report.pfc_data.C_bulk_uF.toFixed(2);
        var pfc_Cin = report.pfc_data.C_in_bypass_uF.toFixed(2);
        var pfc_Vripple = report.pfc_data.V_ripple_expected.toFixed(2);

        var t_pfc_desc = getTrans('pfc_design_desc') || "Aşağıdaki görsel, AC şebeke dinamiklerini dikkate alarak PFC topolojisine özel hesaplanmış güç katı mimarisini göstermektedir.";
        var t_expected_ripple = getTrans('pfc_expected_ripple') || "Beklenen Max Ripple:";
        var t_pfc_components = getTrans('pfc_components_title') || "PFC Güç Katı & Filtre Bileşenleri";
        var t_pfc_comp_desc = getTrans('pfc_components_desc') || "Şebeke gerilimi rektifiye edildikten sonra <b>EMI Bypass Kapasitörü (Cin)</b> yüksek frekanslı gürültüyü engeller. <b>PFC Bobini (L)</b> akım dalgalanmasını kontrol eder ve <b>Bulk Kapasitör (Cbulk)</b> şebeke frekansı dalgalanmasını kompanze eder.";
        var t_cin_bypass = getTrans('pfc_cin_bypass') || "Cin (Bypass)";
        var t_boost_diode1 = getTrans('pfc_boost') || "Boost";
        var t_boost_diode2 = getTrans('pfc_diode') || "Diode";
        var t_cbulk = getTrans('pfc_cbulk') || "Cbulk";
        var t_vin_rectified1 = getTrans('pfc_vin') || "VIN";
        var t_vin_rectified2 = getTrans('pfc_rectified') || "(Rectified)";
        var t_gnd = getTrans('pfc_gnd') || "GND";
        var t_vdc_bulk = getTrans('pfc_vdc_bulk') || "VDC (Bulk)";

        htmlContent = `
            <div class="text-center mb-4">
                <span class="badge bg-warning text-dark mb-2" style="font-size:14px;">Topology: ${topoName}</span>
                <p class="text-muted" style="font-size:14px;">${t_pfc_desc}</p>
                <span class="badge" style="background-color:#1557A0;">
					%${verim.toFixed(2)}
				</span>
            </div>
            
            <div class="p-3 mb-4 rounded" style="background: var(--surface-dark); border: 1px solid var(--border-color);">
                <h5 class="text-info">${t_pfc_components}</h5>
                <p style="font-size:13px; color:var(--text-muted);">${t_pfc_comp_desc}</p>
                <div style="width:100%; overflow-x:auto;">
                    <svg viewBox="0 0 750 260" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="min-width:600px; max-width:100%;">
                        <path d="M 50 120 L 150 120" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 150 120 L 200 120" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 300 120 L 350 120" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 380 120 L 480 120" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 480 120 L 600 120" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 50 200 L 600 200" stroke="#42a5f5" stroke-width="3" fill="none"/>

                        <path d="M 150 120 L 150 150" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 130 150 L 170 150" stroke="#e0e0e0" stroke-width="3" fill="none"/>
                        <path d="M 130 165 L 170 165" stroke="#e0e0e0" stroke-width="3" fill="none"/>
                        <path d="M 150 165 L 150 200" stroke="#42a5f5" stroke-width="3" fill="none"/>
                        <text x="150" y="95" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="middle">${t_cin_bypass}</text>
                        <text x="150" y="110" fill="#ffb74d" font-family="sans-serif" font-size="13" text-anchor="middle" font-weight="bold">${pfc_Cin} µF</text>
                        <circle cx="150" cy="120" r="4" fill="#ef5350"/>
                        <circle cx="150" cy="200" r="4" fill="#42a5f5"/>

                        <rect x="200" y="100" width="100" height="40" rx="5" fill="#2a2a2a" stroke="#81c784" stroke-width="2"/>
                        <text x="250" y="125" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="middle" alignment-baseline="middle">L = ${pfc_L} µH</text>

                        <polygon points="350,105 350,135 380,120" fill="#2a2a2a" stroke="#ffb74d" stroke-width="2"/>
                        <path d="M 380 105 L 380 135" stroke="#ffb74d" stroke-width="2" fill="none"/>
                        <text x="365" y="95" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="middle">${t_boost_diode1}</text>
                        <text x="365" y="150" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="middle">${t_boost_diode2}</text>

                        <path d="M 480 120 L 480 150" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 460 150 L 500 150" stroke="#e0e0e0" stroke-width="3" fill="none"/>
                        <path d="M 460 165 L 500 165" stroke="#e0e0e0" stroke-width="3" fill="none"/>
                        <path d="M 480 165 L 480 200" stroke="#42a5f5" stroke-width="3" fill="none"/>
                        <text x="480" y="95" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="middle">${t_cbulk}</text>
                        <text x="480" y="110" fill="#ffb74d" font-family="sans-serif" font-size="13" text-anchor="middle" font-weight="bold">${pfc_Cbulk} µF</text>
                        <circle cx="480" cy="120" r="4" fill="#ef5350"/>
                        <circle cx="480" cy="200" r="4" fill="#42a5f5"/>

                        <text x="50" y="110" fill="#ef5350" font-family="sans-serif" font-size="16" font-weight="bold">${t_vin_rectified1}</text>
                        <text x="50" y="140" fill="#ef5350" font-family="sans-serif" font-size="16" font-weight="bold">${t_vin_rectified2}</text>
                        <text x="50" y="190" fill="#42a5f5" font-family="sans-serif" font-size="16" font-weight="bold">${t_gnd}</text>
                        <text x="610" y="125" fill="#ef5350" font-family="sans-serif" font-size="16" font-weight="bold">${t_vdc_bulk}</text>
                    </svg>
                </div>
            </div>
        `;

    } else {
        var in_L = report.input_filter.L_uH.toFixed(2);
        var in_C = report.input_filter.C_uF.toFixed(2);
        var in_Cd = report.input_filter.Cd_damping_uF.toFixed(2);
        var in_Rd = report.input_filter.Rd_damping_ohms.toFixed(3);

        var out_L = report.output_filter.L_out_uH.toFixed(2);
        var out_C = report.output_filter.C_out_uF.toFixed(2);
        var out_Rdamp = report.output_filter.R_damp_ohms.toFixed(3);

        var t_desc = getTrans('filter_design_desc') || "Aşağıdaki görseller, güç kaynağı parametrelerinize özel olarak hesaplanmış, <strong>Middlebrook osilasyon kriterlerini</strong> dikkate alan paralel sönümlemeli giriş filtresi ve ikinci aşama (second stage) çıkış sönümleme filtresi devrelerini göstermektedir.";
        var t_in_title = getTrans('filter_input_title') || "1. Giriş Filtresi (Parallel Damped Input Filter)";
        var t_out_title = getTrans('filter_output_title') || "2. Çıkış Filtresi (Second-Stage Output Filter)";
        var t_to_buck = getTrans('filter_to_buck') || "To Buck";
        if (t_to_buck.includes('Buck') && topology !== 'buck') {
            t_to_buck = "To " + topoName;
        }
        var t_vload = getTrans('filter_v_load') || "V_LOAD";

        htmlContent = `
            <div class="text-center mb-4">
                <span class="badge bg-warning text-dark mb-2" style="font-size:14px;">Topology: ${topoName}</span>
                <p class="text-muted" style="font-size:14px;">${t_desc}</p>
                <p style="font-size:14px;">${t_eff} <span class="badge bg-info">%${verim.toFixed(2)}</span></p>
            </div>
            
            <div class="p-3 mb-4 rounded" style="background: var(--surface-dark); border: 1px solid var(--border-color);">
                <h5 class="text-info">${t_in_title}</h5>
                <div style="width:100%; overflow-x:auto;">
                    <svg viewBox="0 0 750 260" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="min-width:600px; max-width:100%;">
                        <path d="M 50 80 L 120 80" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 280 80 L 560 80" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 50 200 L 560 200" stroke="#42a5f5" stroke-width="3" fill="none"/>
                        
                        <rect x="120" y="60" width="160" height="40" rx="5" fill="#2a2a2a" stroke="#81c784" stroke-width="2"/>
                        <text x="200" y="85" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="middle" alignment-baseline="middle">L = ${in_L} µH</text>

                        <path d="M 360 80 L 360 120" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 330 120 L 390 120" stroke="#e0e0e0" stroke-width="3" fill="none"/>
                        <path d="M 330 135 L 390 135" stroke="#e0e0e0" stroke-width="3" fill="none"/>
                        <path d="M 360 135 L 360 200" stroke="#42a5f5" stroke-width="3" fill="none"/>
                        <text x="320" y="132" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="end">C = ${in_C} µF</text>
                        <circle cx="360" cy="80" r="4" fill="#ef5350"/>
                        <circle cx="360" cy="200" r="4" fill="#42a5f5"/>

                        <path d="M 480 80 L 480 90" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <rect x="440" y="90" width="80" height="40" fill="#2a2a2a" stroke="#ffb74d" stroke-width="2"/>
                        <text x="530" y="115" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="start" alignment-baseline="middle">Rd = ${in_Rd} Ω</text>
                        <path d="M 480 130 L 480 155" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 450 155 L 510 155" stroke="#e0e0e0" stroke-width="3" fill="none"/>
                        <path d="M 450 170 L 510 170" stroke="#e0e0e0" stroke-width="3" fill="none"/>
                        <path d="M 480 170 L 480 200" stroke="#42a5f5" stroke-width="3" fill="none"/>
                        <text x="530" y="167" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="start">Cd = ${in_Cd} µF</text>
                        <circle cx="480" cy="80" r="4" fill="#ef5350"/>
                        <circle cx="480" cy="200" r="4" fill="#42a5f5"/>

                        <text x="50" y="70" fill="#ef5350" font-family="sans-serif" font-size="16" font-weight="bold">VIN</text>
                        <text x="50" y="190" fill="#42a5f5" font-family="sans-serif" font-size="16" font-weight="bold">GND</text>
                        <text x="570" y="85" fill="#ef5350" font-family="sans-serif" font-size="16" font-weight="bold">${t_to_buck}</text>
                    </svg>
                </div>
            </div>

            <div class="p-3 rounded" style="background: var(--surface-dark); border: 1px solid var(--border-color);">
                <h5 class="text-info">${t_out_title}</h5>
                <div style="width:100%; overflow-x:auto;">
                    <svg viewBox="0 0 750 260" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="min-width:600px; max-width:100%;">
                        <path d="M 50 120 L 120 120" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 280 120 L 560 120" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 50 200 L 560 200" stroke="#42a5f5" stroke-width="3" fill="none"/>

                        <rect x="120" y="100" width="160" height="40" rx="5" fill="#2a2a2a" stroke="#81c784" stroke-width="2"/>
                        <text x="200" y="125" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="middle" alignment-baseline="middle">L2 = ${out_L} µH</text>

                        <path d="M 80 120 L 80 60 L 120 60" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 280 60 L 320 60 L 320 120" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <rect x="120" y="40" width="160" height="40" fill="#2a2a2a" stroke="#ffb74d" stroke-width="2"/>
                        <text x="200" y="65" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="middle" alignment-baseline="middle">Rdamp = ${out_Rdamp} Ω</text>
                        <circle cx="80" cy="120" r="4" fill="#ef5350"/>
                        <circle cx="320" cy="120" r="4" fill="#ef5350"/>

                        <path d="M 440 120 L 440 150" stroke="#ef5350" stroke-width="3" fill="none"/>
                        <path d="M 410 150 L 470 150" stroke="#e0e0e0" stroke-width="3" fill="none"/>
                        <path d="M 410 165 L 470 165" stroke="#e0e0e0" stroke-width="3" fill="none"/>
                        <path d="M 440 165 L 440 200" stroke="#42a5f5" stroke-width="3" fill="none"/>
                        <text x="480" y="162" fill="#e0e0e0" font-family="sans-serif" font-size="14" text-anchor="start">C2 = ${out_C} µF</text>
                        <circle cx="440" cy="120" r="4" fill="#ef5350"/>
                        <circle cx="440" cy="200" r="4" fill="#42a5f5"/>

                        <text x="50" y="110" fill="#ef5350" font-family="sans-serif" font-size="16" font-weight="bold">Vo</text>
                        <text x="50" y="190" fill="#42a5f5" font-family="sans-serif" font-size="16" font-weight="bold">GND</text>
                        <text x="570" y="125" fill="#ef5350" font-family="sans-serif" font-size="16" font-weight="bold">${t_vload}</text>
                    </svg>
                </div>
            </div>
        `;
    }

    if (typeof UIModal !== 'undefined' && UIModal.openFilterModal) {
        UIModal.openFilterModal(htmlContent);
    } else {
        alert("Arayüz modülü (UIModal) yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.");
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var filterBtn = document.getElementById('filterButton');
    if (filterBtn) {
        filterBtn.addEventListener('click', function () {
            window.openFilterDesign();
        });
    }
});
