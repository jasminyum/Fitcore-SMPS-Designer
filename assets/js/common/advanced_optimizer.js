// ================================================================
// Common Advanced Mode
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================

const sanitizeHTML = (str) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"'`=\/]/g, function (s) {
        return {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
            "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
        }[s];
    });
};

const sanitizeURL = (url) => {
    if (!url || url === '#') return '#';
    const strUrl = String(url);
    if (strUrl.trim().toLowerCase().startsWith('javascript:')) return '#';
    return sanitizeHTML(strUrl);
};

let lastOptimizationResults = { coilCores: [], trafoCores: [], priWires: [], secWires: [], coilWires: [], switches: [] };

const safeGetT = function (key) {
    if (typeof window.getT === 'function') return window.getT(key);
    return key;
};

window.loadThreeJS = function () {
    return new Promise((resolve, reject) => {
        if (typeof THREE !== 'undefined' && typeof THREE.OrbitControls !== 'undefined') {
            return resolve();
        }
        const s1 = document.createElement('script');
        s1.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
        s1.onload = () => {
            const s2 = document.createElement('script');
            s2.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";
            s2.onload = resolve;
            s2.onerror = reject;
            document.head.appendChild(s2);
        };
        s1.onerror = reject;
        document.head.appendChild(s1);
    });
};

// ================================================================
// Table Window (Injected Into the Modal)
// ================================================================
window.openAdvancedTable = function () {
    const pageTitle = (document.title || "").toLowerCase();
    const isSepic = pageTitle.includes('sepic');
    const isCuk = pageTitle.includes('cuk');
    const isZeta = pageTitle.includes('zeta');
    const isInterleaved = pageTitle.includes('interleaved');
    const isDualCoil = isSepic || isCuk || isZeta || isInterleaved;

    let lOutputValid = false;
    let veOptValid = false;

    if (isDualCoil) {
        const lOutput1Str = document.getElementById('lOutput1')?.innerText;
        const lOutput2Str = document.getElementById('lOutput2')?.innerText;
        const l1Valid = lOutput1Str && lOutput1Str !== "-" && lOutput1Str !== "" && !isNaN(parseFloat(lOutput1Str)) && parseFloat(lOutput1Str) > 0;
        const l2Valid = lOutput2Str && lOutput2Str !== "-" && lOutput2Str !== "" && !isNaN(parseFloat(lOutput2Str)) && parseFloat(lOutput2Str) > 0;
        lOutputValid = l1Valid && l2Valid;
    } else {
        const lOutputStr = document.getElementById('lOutput')?.innerText;
        const veOptStr = document.getElementById('VeOpt')?.innerText;
        lOutputValid = lOutputStr && lOutputStr !== "-" && lOutputStr !== "" && !isNaN(parseFloat(lOutputStr));
        veOptValid = veOptStr && veOptStr !== "-" && veOptStr !== "" && !isNaN(parseFloat(veOptStr));
    }

    if (!lOutputValid && !veOptValid) {
        alert(safeGetT('adv_alert_calc_first') || "Lütfen önce hesaplama yapın!");
        return;
    }

    const pType = (window._pageType || "").toLowerCase();
    let pageFreq = 100;

    if (pType.includes('linear') && window.lastTrafoResults) {
        pageFreq = window.lastTrafoResults.freq / 1000;
    } else {
        const freqEl = document.getElementById('f_khz') || document.getElementById('p_fsw');
        pageFreq = parseFloat(freqEl?.value || 0);
        if (!pageFreq || isNaN(pageFreq)) pageFreq = 100;

        if (pageTitle.includes('llc') || pageTitle.includes('resonant')) {
            const vNom = parseFloat(document.getElementById('vin_nom')?.value) || 390;
            const vTest = parseFloat(document.getElementById('vin_test')?.value) || vNom;
            pageFreq = pageFreq * (vTest / Math.max(vNom, 1));
        }
    }

    let titleStr = sanitizeHTML(safeGetT('adv_page_title') || 'Gelişmiş Optimizasyon');

    const estVout = Math.abs(parseFloat((document.getElementById('vout') || document.getElementById('vout_nom'))?.value)) || 12;
    const ioutEl = document.getElementById('ilout') || document.getElementById('iout') || document.getElementById('Iout');
    let estIout = parseFloat(ioutEl?.value) || 0;
    if (estIout <= 0) estIout = 10;

    const estEff = parseFloat(document.getElementById('verim')?.value || 85) / 100;
    const estPout = estVout * estIout;
    const estPloss = estPout * ((1 / estEff) - 1);

    let autoRth = estPloss > 0 ? (10 / estPloss) : 2.0;
    autoRth = Math.max(0.5, Math.min(autoRth, 5)).toFixed(1);

    let biasHtml = "";
    if (pageTitle.includes('flyback')) {
        biasHtml = `
            <div class="input-group input-group-sm" style="width:auto;">
                <div class="input-group-text bg-dark border-secondary">
                    <input class="form-check-input mt-0" type="checkbox" id="advHasBias" onchange="document.getElementById('biasSettings').style.display = this.checked ? 'flex' : 'none'">
                </div>
                <span class="input-group-text bg-dark text-light border-secondary">${sanitizeHTML(safeGetT('adv_add_bias') || 'Bias (Aux) Ekle')}</span>
            </div>
            <div class="input-group input-group-sm" id="biasSettings" style="display:none; width:auto;">
                <span class="input-group-text bg-dark text-light border-secondary">V(bias)</span>
                <input type="number" id="advVbias" class="form-control bg-dark text-light border-secondary" value="12" style="max-width:60px;">
                <span class="input-group-text bg-dark text-light border-secondary">I(bias)</span>
                <input type="number" id="advIbias" class="form-control bg-dark text-light border-secondary" value="0.2" step="0.1" style="max-width:60px;">
            </div>
        `;
    }

    const htmlContent = `
    <style>
        .adv-wrapper { color: var(--text-main); font-size:13px; }
        .adv-box { background: var(--surface-dark); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden; margin-bottom: 20px;}
        .adv-table { border-collapse: collapse; width: 100%; color: var(--text-main); font-size: 13px; margin-top:10px; margin-bottom: 25px; min-width: 600px; }
        .adv-table th, .adv-table td { border: 1px solid var(--border-color); text-align: center; padding: 10px 8px; }
        .adv-table th { background-color: #272727; position: sticky; top: 0; color: var(--color-yellow); }
        .adv-table tbody tr { transition: background 0.2s; }
        .adv-table tbody tr:hover { background-color: rgba(255,255,255,0.05); color: white; }
        .row-best-opt { background-color: rgba(129, 199, 132, 0.15); border-left: 4px solid var(--color-green); }
        .section-title { color: var(--color-green); border-bottom: 2px dashed var(--border-color); padding-bottom: 5px; margin-top: 15px; margin-bottom: 10px; }
    </style>

    <div class="adv-wrapper">
        <div class="adv-box" style="box-shadow:0 3px 6px rgba(0,0,0,0.5);">
            <h4 style="color:#ffb74d; border-bottom: 1px solid #444; padding-bottom:10px; margin-bottom:15px; margin-top:0; font-size: 16px;">
                ${sanitizeHTML(safeGetT('adv_opt_priority_settings') || 'Optimizasyon Önceliği Ayarları')}
            </h4>
            
            <div class="d-flex flex-wrap align-items-center gap-3">
                <!-- Radio Group -->
                <div class="d-flex flex-wrap align-items-center gap-3">
                    <div class="form-check m-0">
                        <input class="form-check-input" type="radio" name="optMode" id="optBalanced" value="balanced" checked>
                        <label class="form-check-label text-light" for="optBalanced">${sanitizeHTML(safeGetT('adv_opt_balanced') || 'Dengeli')}</label>
                    </div>
                    <div class="form-check m-0">
                        <input class="form-check-input" type="radio" name="optMode" id="optLowCost" value="low_cost">
                        <label class="form-check-label text-light" for="optLowCost">${sanitizeHTML(safeGetT('adv_opt_low_cost') || 'Düşük Maliyet')}</label>
                    </div>
                    <div class="form-check m-0">
                        <input class="form-check-input" type="radio" name="optMode" id="optHighEff" value="high_eff">
                        <label class="form-check-label text-light" for="optHighEff">${sanitizeHTML(safeGetT('adv_opt_high_eff') || 'Yüksek Verim')}</label>
                    </div>
                    <div class="form-check m-0">
                        <input class="form-check-input" type="radio" name="optMode" id="optCompact" value="compact">
                        <label class="form-check-label text-light" for="optCompact">${sanitizeHTML(safeGetT('adv_opt_compact') || 'Kompakt Boyut')}</label>
                    </div>
                </div>

                <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mt-lg-0 w-100">
                    <div class="input-group input-group-sm" style="width: auto;">
                        <span class="input-group-text bg-dark text-light border-secondary">${sanitizeHTML(safeGetT('adv_temp_label') || 'Sıcaklık (°C)')}</span>
                        <input type="number" id="operatingTemp" class="form-control bg-dark text-light border-secondary" value="80" style="max-width: 70px;">
                    </div>

                    <div class="input-group input-group-sm" style="width: auto;" title="${sanitizeHTML(safeGetT('adv_cooling_tooltip') || 'Sistem termal direnci ve soğutma profili seçiminiz.')}">
                        <span class="input-group-text bg-dark text-light border-secondary">${sanitizeHTML(safeGetT('adv_cooling_label') || 'Sistem Soğutma Tipi')}</span>
                        <select id="advRthSelect" class="form-select bg-dark text-light border-secondary" style="max-width: 170px;" onchange="document.getElementById('manualRthWrapper').style.display = (this.value === 'manual') ? 'flex' : 'none'">
                            <option value="manual" selected>${sanitizeHTML(safeGetT('adv_cool_manual') || 'Manuel Değer Gir')}</option>
                            <option value="5.0">${sanitizeHTML(safeGetT('adv_cool_closed') || 'Doğal Konveksiyon (Kapalı Kutu)')}</option>
                            <option value="3.0">${sanitizeHTML(safeGetT('adv_cool_open') || 'Doğal Konveksiyon (Açık Sistem)')}</option>
                            <option value="1.5">${sanitizeHTML(safeGetT('adv_cool_small_hs') || 'Küçük Alüminyum Soğutucu')}</option>
                            <option value="0.8">${sanitizeHTML(safeGetT('adv_cool_large_hs') || 'Büyük Alüminyum Soğutucu')}</option>
                            <option value="0.3">${sanitizeHTML(safeGetT('adv_cool_fan') || 'Fan Soğutma (Zorlanmış Akış)')}</option>
                            <option value="0.1">${sanitizeHTML(safeGetT('adv_cool_water') || 'Özel / Sıvı Soğutma')}</option>
                        </select>
                    </div>
                    
                    <div id="manualRthWrapper" class="input-group input-group-sm" style="width: auto;">
                        <input type="number" id="advRth" class="form-control bg-dark text-light border-secondary" value="${autoRth}" step="0.1" style="max-width: 70px;">
                        <span class="input-group-text bg-dark text-muted border-secondary">°C/W</span>
                    </div>

                    <div class="input-group input-group-sm" style="width: auto;">
                        <span class="input-group-text bg-dark text-light border-secondary">${sanitizeHTML(safeGetT('adv_freq_label') || 'Frekans (kHz)')}</span>
                        <input type="number" id="advFreq" class="form-control bg-dark text-light border-secondary" value="${pageFreq}" style="max-width: 80px;" ${pType.includes('linear') ? 'disabled' : ''}>
                    </div>
                    
                    ${biasHtml}

                    <div class="input-group input-group-sm" style="width: auto;">
                        <span class="input-group-text bg-dark text-light border-secondary">${sanitizeHTML(safeGetT('adv_manufacturer_label') || 'Üretici')}</span>
                        <select id="manufacturerFilter" class="form-select bg-dark text-light border-secondary" style="max-width: 120px;" onchange="window.filterResultsByManufacturer()">
                            <option value="all">${sanitizeHTML(safeGetT('adv_manufacturer_all') || 'Tümü')}</option>
                        </select>
                    </div>

                    <div class="input-group input-group-sm" style="width:auto;">
                        <div class="input-group-text bg-dark border-secondary">
                            <input class="form-check-input mt-0" type="checkbox" id="advOnlyKnownStock" onchange="window.filterResultsByManufacturer()">
                        </div>
                        <span class="input-group-text bg-dark text-light border-secondary">${sanitizeHTML(safeGetT('adv_only_known_stock') || 'Sadece Stok Bilinenler')}</span>
                    </div>

                    <div class="ms-auto d-flex gap-2 mt-2 mt-lg-0">
                        <button class="btn btn-primary btn-sm px-3 fw-bold" onclick="window.executeAdvancedOptimization()">${sanitizeHTML(safeGetT('adv_btn_run_ai') || 'Yapay Zekayı Çalıştır')}</button>
                        <button class="btn btn-success btn-sm px-3 fw-bold" id="exportBtn" style="display:none;" onclick="window.exportAdvancedResultsToCSV()">CSV</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="advancedResults" class="adv-box mt-3">
            <div id="viewer3D" style="width:100%; height:350px; background: linear-gradient(135deg, #547A95 0%, #a2b0c1 100%); border: 1px solid var(--border-color); border-radius: 10px; margin-top:10px; margin-bottom:20px; display:none; position: relative;">
                <h4 style="position:absolute; top:10px; left:10px; color:#ffb74d; margin:0; z-index:10; border:none;">3D Nüve Önizlemesi</h4>
            </div>
            <p style="color:var(--text-muted);text-align:center;padding:40px 20px;">${sanitizeHTML(safeGetT('adv_init_msg') || 'Başlamak için butona tıklayın.')}</p>
        </div>
    </div>`;

    document.getElementById('coreModalTitle').innerText = titleStr;
    document.getElementById('modalDynamicBody').innerHTML = htmlContent;

    if (typeof THREE === 'undefined') {
        const s1 = document.createElement('script');
        s1.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
        document.head.appendChild(s1);
        s1.onload = () => {
            const s2 = document.createElement('script');
            s2.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";
            document.head.appendChild(s2);
        };
    }

    if (typeof UIModal !== 'undefined') {
        UIModal.showSafeModal();
    }
};

// ================================================================
// Global Methods
// ================================================================

let currentAnimationId = null;
let currentScene = null;
let currentRenderer = null;

window.addEventListener('resize', function () {
    if (!currentRenderer || !currentScene) return;
    const viewerDiv = document.getElementById("viewer3D");
    if (!viewerDiv || viewerDiv.style.display === "none") return;
    if (window.currentCamera) {
        window.currentCamera.aspect = viewerDiv.clientWidth / viewerDiv.clientHeight;
        window.currentCamera.updateProjectionMatrix();
    }
    currentRenderer.setSize(viewerDiv.clientWidth, viewerDiv.clientHeight);
}, false);

window.showIgseModal = function (coreDataString) {
    if (!coreDataString || coreDataString === '{}') return alert(safeGetT('igse_no_data') || "Veri yok.");
    const item = JSON.parse(decodeURIComponent(coreDataString));
    const bd = item.igseBreakdown;
    if (!bd) return alert(safeGetT('igse_no_data') || "Detay verisi bulunamadı.");

    const confColor = bd.confidence === "high" ? "#81c784" : (bd.confidence === "medium" ? "#ffb74d" : "#ef5350");
    const confLabel = bd.confidence === "high" ? (safeGetT('igse_conf_high') || "Yüksek Güven")
        : (bd.confidence === "medium" ? (safeGetT('igse_conf_med') || "Orta Güven")
            : (safeGetT('igse_conf_low') || "Düşük Güven"));

    const tdStyleL = "padding:12px 8px; color:#9e9e9e; border:none; border-bottom:1px solid #333; font-size:13px; vertical-align:top;";
    const tdStyleR = "padding:12px 8px; text-align:right; border:none; border-bottom:1px solid #333; font-weight: 500; font-size:13px; word-break: break-word;";

    const safeNote = sanitizeHTML(bd.note);
    const safeK = sanitizeHTML(bd.k);
    const safeAlpha = sanitizeHTML(bd.alpha);
    const safeBeta = sanitizeHTML(bd.beta);
    const safeKt = sanitizeHTML(bd.K_t);
    const safeIa = sanitizeHTML(bd.I_a);
    const safeKi = sanitizeHTML(bd.k_i);
    const safeDeltaB = sanitizeHTML(bd.delta_B_T);
    const safeFkhz = sanitizeHTML(bd.f_kHz);
    const safeDUsed = sanitizeHTML(bd.D_used);
    const safeWaveForm = sanitizeHTML(bd.waveform_factor);
    const safeFinalPv = sanitizeHTML(bd.final_Pv);

    const existingModal = document.getElementById('igseOverlayModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="igseOverlayModal" style="position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999; display:flex; align-items:center; justify-content:center; padding:15px; backdrop-filter: blur(4px);" onclick="this.remove()">
            
            <div style="background:#1e1e1e; border:1px solid #444; border-radius:12px; max-width:550px; width:100%; max-height:85vh; display:flex; flex-direction:column; box-shadow: 0 10px 40px rgba(0,0,0,0.6);" onclick="event.stopPropagation()">
                
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 16px 20px; border-bottom: 1px solid #333; background: rgba(255,255,255,0.02); border-radius: 12px 12px 0 0;">
                    <h4 style="color:#ffb74d; margin:0; font-size: 16px; font-weight: 600;">
                        ${sanitizeHTML(safeGetT('igse_modal_title') || 'iGSE Core Loss Calculation Details')}
                    </h4>
                    <button onclick="document.getElementById('igseOverlayModal').remove()" style="background:transparent; border:none; color:#888; font-size:24px; cursor:pointer; line-height:1; padding:0 5px; margin:0; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#888'" title="Kapat">&times;</button>
                </div>

                <div style="padding: 20px; overflow-y: auto; flex: 1;">
                    
                    <div style="background:${confColor}1A; border-left:4px solid ${confColor}; padding:12px 16px; margin-bottom:20px; border-radius:6px;">
                        <b style="color:${confColor}; font-size: 14px;">${sanitizeHTML(confLabel)}</b>
                        <p style="font-size:13px; color:#d0d0d0; margin:8px 0 0 0; line-height: 1.5;">${safeNote}</p>
                    </div>
                    
                    <div style="overflow-x: auto; margin-bottom: 20px;">
                        <table style="width:100%; min-width:300px; color:#e0e0e0; border-collapse:collapse; margin:0;">
                            <tr><td style="${tdStyleL}">${sanitizeHTML(safeGetT('igse_mat_steinmetz') || 'Material Steinmetz (k, α, β)')}</td><td style="${tdStyleR}">${safeK},<br>${safeAlpha},<br>${safeBeta}</td></tr>
                            <tr><td style="${tdStyleL}">${sanitizeHTML(safeGetT('igse_temp_coef') || 'Temperature Coefficient (K_t)')}</td><td style="${tdStyleR}">${safeKt}</td></tr>
                            <tr><td style="${tdStyleL}">${sanitizeHTML(safeGetT('igse_num_integral') || 'Numerical Integral (I_α)')}</td><td style="${tdStyleR}">${safeIa}</td></tr>
                            <tr><td style="${tdStyleL}">${sanitizeHTML(safeGetT('igse_ki_const') || 'Derived k_i Constant')}</td><td style="${tdStyleR}">${safeKi}</td></tr>
                            <tr><td style="${tdStyleL}">${sanitizeHTML(safeGetT('igse_delta_b') || 'ΔB (Peak-to-Peak, T)')}</td><td style="${tdStyleR}">${safeDeltaB}</td></tr>
                            <tr><td style="${tdStyleL}">${sanitizeHTML(safeGetT('igse_freq') || 'Frequency (kHz)')}</td><td style="${tdStyleR}">${safeFkhz}</td></tr>
                            <tr><td style="${tdStyleL}">${sanitizeHTML(safeGetT('igse_duty_used') || 'Used Duty Cycle (D)')}</td><td style="${tdStyleR}">${safeDUsed}</td></tr>
                            <tr><td style="${tdStyleL}">${sanitizeHTML(safeGetT('igse_waveform_factor') || 'Waveform Factor')}</td><td style="${tdStyleR}">${safeWaveForm}</td></tr>
                            <tr>
                                <td style="padding:16px 8px 10px 8px; color:#81c784; font-weight:bold; border:none; font-size: 14px;">${sanitizeHTML(safeGetT('igse_result_pv') || 'Result (Pv)')}</td>
                                <td style="text-align:right; padding:16px 8px 10px 8px; color:#81c784; font-weight:bold; border:none; font-size: 15px;">${safeFinalPv} mW/cm³</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px dashed #555;">
                        <p style="font-size:12px; color:#999; margin:0; line-height: 1.5;">
                            ${sanitizeHTML(safeGetT('igse_validation_note') || 'Validation: Measure the core surface temperature on the prototype with a thermal camera or thermocouple...')}
                        </p>
                    </div>

                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.render3DCore = async function (coreDataString) {
    try {
        await window.loadThreeJS();
    } catch (e) {
        alert("3D Motoru yüklenemedi. Lütfen internet bağlantınızı kontrol edin.");
        return;
    }

    const coreData = JSON.parse(decodeURIComponent(coreDataString));
    const viewerDiv = document.getElementById("viewer3D");
    if (!viewerDiv) return;

    viewerDiv.style.display = "block";
    if (currentAnimationId !== null) {
        cancelAnimationFrame(currentAnimationId);
        currentAnimationId = null;
    }

    if (currentScene) {
        currentScene.traverse(function (child) {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose());
                    else child.material.dispose();
                }
            }
        });
    }

    if (currentRenderer) currentRenderer.dispose();
    while (viewerDiv.firstChild) viewerDiv.removeChild(viewerDiv.firstChild);

    const _tr = function (key, defaultText) {
        const translated = safeGetT(key);
        return translated === key ? defaultText : translated;
    };

    let titlePrefix = "3D: ";
    if (coreData.componentType === 'flyback' || coreData.componentType === 'trafo' || coreData.componentType === 'linear_trafo') {
        titlePrefix = _tr('adv_3d_prefix_trafo', "3D Trafo: ");
    } else if (coreData.componentType === 'coil') {
        titlePrefix = _tr('adv_3d_prefix_coil', "3D Bobin: ");
    }

    const t_controls = sanitizeHTML(_tr('adv_3d_controls', 'Fare ile çevirebilir, tekerlek ile yakınlaştırabilirsiniz.'));
    const t_core = sanitizeHTML(_tr('adv_3d_core_halves', '2 Parça Ferrit Nüve'));
    const t_winding = sanitizeHTML(_tr('adv_3d_winding', 'Sargı (Bakır Tel)'));
    const t_bobbin = sanitizeHTML(_tr('adv_3d_flange', 'Karkas (Plastik)'));

    const gapVal = coreData.gap_mm ? coreData.gap_mm.toFixed(3) : "0.000";
    const gapLabel = coreData.gap_is_builtin
        ? _tr('adv_3d_gap_builtin', 'Air Gap (Datasheet)')
        : _tr('adv_3d_gap_calculated', 'Gerekli Air Gap');

    let gapHTML = '';
    if (coreData.gap_mm > 0) {
        let extraGapInfo = "";
        if (coreData.gap_is_builtin && coreData.required_gap_mm > 0) {
            extraGapInfo = ` <span style="color:#aaa; font-size:11px; font-weight:normal;">(Required: ${coreData.required_gap_mm.toFixed(3)} mm)</span>`;
        }

        gapHTML = '<p style="margin:3px 0; color:#00AEEF;">🟦 <b>' + sanitizeHTML(gapLabel) + ': ' + sanitizeHTML(gapVal) + ' mm</b>' + extraGapInfo + '</p>';
    }

    const advMeasTitle = sanitizeHTML(_tr("adv_meas_title", "Ölçüm Araçları"));
    const advMeasOff = sanitizeHTML(_tr("adv_meas_off", "Kapat"));
    const advMeasPointDesc = sanitizeHTML(_tr("adv_meas_point_desc", "İki noktaya tıklayarak ölçüm yapın"));
    const advMeasPoint = sanitizeHTML(_tr("adv_meas_point", "Nokta"));
    const advMeasBoxDesc = sanitizeHTML(_tr("adv_meas_box_desc", "Dış boyutlar (X,Y,Z) ve Hacim"));
    const advMeasBox = sanitizeHTML(_tr("adv_meas_box", "Kutu"));
    const advMeasUnit = sanitizeHTML(_tr("adv_meas_unit", "Birim:"));
    const advMeasClear = sanitizeHTML(_tr("adv_meas_clear", "Temizle"));
    const advMeasModeOff = sanitizeHTML(_tr("adv_meas_mode_off", "Ölçüm Modu Kapalı"));
    const advEstWeightLabel = sanitizeHTML(_tr("adv_est_weight", "Tahmini Ağırlık:"));

    viewerDiv.innerHTML =
        '<style>' +
        '.v3d-title { position:absolute; top:10px; left:10px; color:#ffb74d; margin:0; z-index:10; text-shadow: 1px 1px 2px #000; pointer-events:none; border:none; max-width: calc(100% - 270px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
        '.v3d-legend { position:absolute; bottom:10px; left:10px; background:rgba(18, 18, 18, 0.75); padding:10px; border-radius:8px; font-size:12px; color:#e0e0e0; z-index:10; pointer-events:none; border: 1px solid #333; backdrop-filter: blur(4px); max-width: 50%; }' +
        '.v3d-meas { position:absolute; top:10px; right:10px; background:rgba(18, 18, 18, 0.88); padding:10px; border-radius:8px; font-size:12px; color:#e0e0e0; z-index:20; border: 1px solid #444; backdrop-filter: blur(4px); box-shadow: 0 4px 6px rgba(0,0,0,0.5); width: 240px; box-sizing: border-box; }' +
        '@media (max-width: 768px) {' +
        '    #viewer3D { height: 450px !important; }' +
        '    .v3d-title { max-width: calc(100% - 20px); white-space: normal; font-size: 14px; top: 5px; left: 10px; }' +
        '    .v3d-legend { top: 45px; bottom: auto; max-width: calc(100% - 20px); font-size: 11px; padding: 8px; }' +
        '    .v3d-meas { top: auto; bottom: 10px; right: 10px; width: calc(100% - 20px); max-width: 400px; padding: 8px; font-size: 11px; }' +
        '}' +
        '</style>' +
        '<h4 class="v3d-title">' + sanitizeHTML(titlePrefix) + sanitizeHTML(coreData.name) + '</h4>' +
        '<div class="v3d-legend">' +
        '<p style="margin:0 0 6px 0; border-bottom:1px solid #444; padding-bottom:5px;">🖱️ <i>' + t_controls + '</i></p>' +
        '<p style="margin:3px 0; color:#aaa;">⬛ <b>' + t_core + '</b></p>' +
        '<p style="margin:3px 0; color:#b87333;">🟤 <b>' + t_winding + '</b></p>' +
        '<p style="margin:3px 0; color:#666;">⚫ <b>' + t_bobbin + '</b></p>' +
        gapHTML +
        '</div>' +
        '<div class="v3d-meas">' +
        '<div style="margin-bottom:8px; font-weight:bold; color:#ffb74d; border-bottom:1px solid #444; padding-bottom:4px;">📐 ' + advMeasTitle + '</div>' +
        '<div style="display:flex; gap:5px; margin-bottom:8px;">' +
        '<button id="btnMeasOff" style="flex:1; padding:4px; font-size:11px; background:#3f51b5; border:none; color:white; border-radius:3px; cursor:pointer;">' + advMeasOff + '</button>' +
        '<button id="btnMeasPoint" style="flex:1; padding:4px; font-size:11px; background:#333; border:1px solid #555; color:white; border-radius:3px; cursor:pointer;" title="' + advMeasPointDesc + '">' + advMeasPoint + '</button>' +
        '<button id="btnMeasBox" style="flex:1; padding:4px; font-size:11px; background:#333; border:1px solid #555; color:white; border-radius:3px; cursor:pointer;" title="' + advMeasBoxDesc + '">' + advMeasBox + '</button>' +
        '</div>' +
        '<div style="display:flex; gap:5px; margin-bottom:5px; align-items:center;">' +
        '<span style="color:#aaa;">' + advMeasUnit + '</span>' +
        '<select id="measUnit" style="background:#222; color:#fff; border:1px solid #555; border-radius:3px; padding:2px; font-size:11px; outline:none; cursor:pointer;">' +
        '<option value="mm">mm</option>' +
        '<option value="cm">cm</option>' +
        '</select>' +
        '<button id="btnMeasClear" style="padding:3px 8px; font-size:11px; background:#d32f2f; border:none; color:white; border-radius:3px; cursor:pointer; margin-left:auto;">' + advMeasClear + '</button>' +
        '</div>' +
        '<div id="measResult" style="margin-top:8px; color:#81c784; font-size:11px; min-height:36px; background:#111; padding:6px 8px; border-radius:4px; border:1px inset #333; display:flex; flex-direction:column; justify-content:center; gap:3px; box-sizing:border-box;">' + advMeasModeOff + '</div>' +
        '<div style="margin-top:8px; padding-top:6px; border-top:1px dashed #555; display:flex; justify-content:space-between; align-items:center;">' +
        '<span style="color:#aaa; font-weight:bold;">' + advEstWeightLabel + '</span>' +
        '<span id="estWeightDisp" style="color:#ffb74d; font-weight:bold; font-size:14px;">...</span>' +
        '</div>' +
        '</div>' +
        '<div id="measDistLabel" style="position:absolute; color:#000; background:#ffeb3b; padding:2px 6px; border-radius:4px; font-size:12px; font-weight:bold; pointer-events:none; display:none; transform:translate(-50%, -50%); z-index:30; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>';

    const scene = new THREE.Scene();
    currentScene = scene;

    const measurementGroup = new THREE.Group();
    scene.add(measurementGroup);

    const camera = new THREE.PerspectiveCamera(45, viewerDiv.clientWidth / viewerDiv.clientHeight, 0.1, 1000);
    window.currentCamera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    currentRenderer = renderer;
    renderer.setSize(viewerDiv.clientWidth, viewerDiv.clientHeight);
    viewerDiv.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 50, 40);
    scene.add(ambientLight, dirLight);

    let A = coreData.dim_A || 42;
    let B = coreData.dim_B || 21;
    let C = coreData.dim_C || 15;
    let D = coreData.dim_D || 11;
    let E = coreData.dim_E || 29;
    let F = coreData.dim_F || 0;
    if (A < 1) { A *= 1000; B *= 1000; C *= 1000; D *= 1000; E *= 1000; F *= 1000; }

    const family = coreData.family || "E";
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.5 });
    const coreGroup = new THREE.Group();

    if (E >= A) E = A * 0.8;
    if (D >= E) D = E * 0.5;

    let legHeight = F > 0 ? F : (B - D / 2);

    if (legHeight >= B) {
        legHeight = (F / 2 > 0) ? (F / 2) : (B * 0.8);
    }
    if (legHeight >= B) {
        legHeight = B * 0.8;
    }

    const backPlateThick = B - legHeight;
    const outerLegThick = (A - E) / 2;

    const gap_mm = coreData.gap_mm || 0;
    const visualGap = gap_mm > 0 ? Math.max(gap_mm, legHeight * 0.05) : 0;
    const activeLegHeight = Math.max(0.1, legHeight - (visualGap / 2));
    const isDistributedGap = /distributed/i.test(coreData.name || "");

    function createCoreHalf(isTop) {
        const halfGroup = new THREE.Group();
        const dir = isTop ? 1 : -1;

        let backGeom;
        if (family === "RM" || family === "PQ" || family === "PM") {
            backGeom = new THREE.CylinderGeometry(A / 2, A / 2, backPlateThick, 32);
        } else {
            backGeom = new THREE.BoxGeometry(A, backPlateThick, C);
        }
        const backMesh = new THREE.Mesh(backGeom, coreMat);
        backMesh.position.y = dir * (legHeight + backPlateThick / 2);
        halfGroup.add(backMesh);

        let centerLegGeom;
        if (family === "ETD" || family === "RM" || family === "PQ" || family === "PM" || family === "ER" || family === "EP") {
            centerLegGeom = new THREE.CylinderGeometry(D / 2, D / 2, activeLegHeight, 32);
        } else {
            centerLegGeom = new THREE.BoxGeometry(D, activeLegHeight, C);
        }
        const centerMesh = new THREE.Mesh(centerLegGeom, coreMat);
        centerMesh.position.y = dir * (legHeight - activeLegHeight / 2);
        halfGroup.add(centerMesh);

        const outerLegH = isDistributedGap ? activeLegHeight : legHeight;
        const outerLegY = isDistributedGap ? (legHeight - activeLegHeight / 2) : (legHeight / 2);

        if (family === "RM" || family === "PQ" || family === "PM") {
            const outerLegGeom = new THREE.BoxGeometry(outerLegThick, outerLegH, A * 0.7);
            const leftLeg = new THREE.Mesh(outerLegGeom, coreMat);
            leftLeg.position.set(-(A / 2 - outerLegThick / 2), dir * outerLegY, 0);
            const rightLeg = new THREE.Mesh(outerLegGeom, coreMat);
            rightLeg.position.set((A / 2 - outerLegThick / 2), dir * outerLegY, 0);
            halfGroup.add(leftLeg, rightLeg);
        } else {
            const outerLegGeom = new THREE.BoxGeometry(outerLegThick, outerLegH, C);
            const leftLeg = new THREE.Mesh(outerLegGeom, coreMat);
            leftLeg.position.set(-(A / 2 - outerLegThick / 2), dir * outerLegY, 0);
            const rightLeg = new THREE.Mesh(outerLegGeom, coreMat);
            rightLeg.position.set((A / 2 - outerLegThick / 2), dir * outerLegY, 0);
            halfGroup.add(leftLeg, rightLeg);
        }
        return halfGroup;
    }

    coreGroup.add(createCoreHalf(true));
    coreGroup.add(createCoreHalf(false));

    if (gap_mm > 0) {
        const gapWidth = isDistributedGap ? (A * 1.05) : (D * 1.3);
        const visualGapRender = Math.max(visualGap, D * 0.08);
        const gapGeom = new THREE.BoxGeometry(gapWidth, visualGapRender, C * 1.05);
        const gapMat = new THREE.MeshStandardMaterial({
            color: 0x00AEEF, transparent: true, opacity: 0.5, emissive: 0x00AEEF, emissiveIntensity: 0.4
        });
        const gapMesh = new THREE.Mesh(gapGeom, gapMat);
        gapMesh.position.y = 0;
        gapMesh.name = "visualGapMarker";
        coreGroup.add(gapMesh);
    }

    const n1 = coreData.n1_calc || coreData.n1 || 20;
    const innerRadius = (D / 2) + 0.5;
    const maxCoilRadius = (E / 2) - 0.5;
    const availableRadialSpace = Math.max(0.3, maxCoilRadius - innerRadius);

    const windowHeight = legHeight * 2 - visualGap;
    const topBottomMargin = 0.5;
    const coilHeight = Math.max(1, windowHeight - 2 * topBottomMargin);

    const priMat = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.4, metalness: 0.7 });
    const secMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.5, metalness: 0.5 });

    let totalCopperVolumeMm3 = 0;

    function createWinding(radiusIn, radiusOut, material, turns, fillFactor = 0.6) {
        const group = new THREE.Group();
        const availableThick = radiusOut - radiusIn;
        const availableHeight = coilHeight;

        let wireD = Math.sqrt((availableThick * availableHeight * fillFactor) / turns);

        if (wireD > availableThick) wireD = availableThick;
        if (wireD > (availableHeight * 0.9)) wireD = availableHeight * 0.9;
        if (wireD > 2.0) wireD = 2.0;
        if (wireD < 0.1) wireD = 0.1;

        const actualWireArea = Math.PI * Math.pow(wireD / 2, 2);
        const R_avg = radiusIn + availableThick / 2;
        const copperVol = actualWireArea * turns * 2 * Math.PI * R_avg;
        totalCopperVolumeMm3 += copperVol;

        const layerPitch = wireD * 0.866;
        const turnPitch = wireD * 1.02;

        let layers = Math.floor(availableThick / layerPitch) || 1;
        let turnsPerLayer = Math.floor(availableHeight / turnPitch) || 1;

        let renderLayers = layers;
        let renderTurnsPerLayer = turnsPerLayer;
        let renderWireD = wireD;
        let renderTurnPitch = turnPitch;

        const MAX_TORUS = 250;
        if (renderLayers * renderTurnsPerLayer > MAX_TORUS) {
            const scale = Math.sqrt(MAX_TORUS / (renderLayers * renderTurnsPerLayer));
            renderLayers = Math.max(1, Math.floor(renderLayers * scale));
            renderTurnsPerLayer = Math.max(1, Math.floor(renderTurnsPerLayer * scale));
            renderWireD = (availableHeight * 0.95) / renderTurnsPerLayer;
            renderTurnPitch = renderWireD * 1.02;
        }

        const startRadius = radiusIn + renderWireD / 2;

        for (let l = 0; l < renderLayers; l++) {
            const currentRadius = startRadius + (l * (renderWireD * 0.866));
            const isOddLayer = l % 2 !== 0;
            const yOffsetHex = isOddLayer ? (renderWireD / 2) : 0;
            const currentLayerTurns = isOddLayer ? Math.max(1, renderTurnsPerLayer - 1) : renderTurnsPerLayer;

            const startY = -((currentLayerTurns * renderTurnPitch) / 2) + (renderTurnPitch / 2) + yOffsetHex;

            for (let t = 0; t < currentLayerTurns; t++) {
                const radialSegs = renderWireD < 0.3 ? 5 : 8;
                const tubulSegs = renderWireD < 0.3 ? 16 : 32;

                const torusGeom = new THREE.TorusGeometry(currentRadius, renderWireD / 2.1, radialSegs, tubulSegs);
                const torus = new THREE.Mesh(torusGeom, material);
                torus.rotation.x = Math.PI / 2;
                torus.position.y = startY + (t * renderTurnPitch);
                group.add(torus);
            }
        }
        return group;
    }

    if (coreData.componentType === 'trafo' || coreData.componentType === 'flyback' || coreData.componentType === 'linear_trafo') {
        const priThick = availableRadialSpace * 0.45;
        const insulationThick = availableRadialSpace * 0.1;
        const secThick = availableRadialSpace * 0.45;

        const priOutR = innerRadius + priThick;
        const secInR = priOutR + insulationThick;
        const secOutR = secInR + secThick;

        const n2 = coreData.n2_calc || coreData.n2 || Math.max(4, Math.floor(n1 / 2));

        const parentTitle = (document.title).toLowerCase();
        const isLLC_3D = parentTitle.includes("llc") && !parentTitle.includes("full");
        const actual_n2_turns = isLLC_3D ? (n2 * 2) : n2;

        const primaryWinding = createWinding(innerRadius, priOutR, priMat, n1, 0.6);
        const secondaryWinding = createWinding(secInR, secOutR, secMat, actual_n2_turns, 0.6);
        coreGroup.add(primaryWinding, secondaryWinding);
    } else {
        const outerRadius = innerRadius + availableRadialSpace;
        const singleWinding = createWinding(innerRadius, outerRadius, priMat, n1, 0.6);
        coreGroup.add(singleWinding);
    }

    const flangeOuter = innerRadius + availableRadialSpace + 0.5;
    const flangeGeom = new THREE.RingGeometry(innerRadius - 0.2, flangeOuter, 32);
    const flangeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, side: THREE.DoubleSide });

    const topFlange = new THREE.Mesh(flangeGeom, flangeMat);
    topFlange.rotation.x = Math.PI / 2;
    topFlange.position.y = (coilHeight / 2) + 0.1;

    const botFlange = new THREE.Mesh(flangeGeom, flangeMat);
    botFlange.rotation.x = Math.PI / 2;
    botFlange.position.y = -(coilHeight / 2) - 0.1;

    coreGroup.add(topFlange, botFlange);
    scene.add(coreGroup);

    const copperWeightGrams = totalCopperVolumeMm3 * 0.00896;

    let coreMaterialVolMm3 = 0;

    if (family === "RM" || family === "PQ" || family === "PM") {
        coreMaterialVolMm3 += 2 * (Math.PI * (Math.pow(A / 2, 2) - Math.pow(E / 2, 2) + Math.pow(D / 2, 2)) * backPlateThick);
    } else {
        coreMaterialVolMm3 += 2 * (A * backPlateThick * C);
    }

    if (family === "ETD" || family === "RM" || family === "PQ" || family === "PM" || family === "ER") {
        coreMaterialVolMm3 += 2 * (Math.PI * Math.pow(D / 2, 2) * activeLegHeight);
    } else {
        coreMaterialVolMm3 += 2 * (D * activeLegHeight * C);
    }

    const coreOuterLegH = isDistributedGap ? activeLegHeight : legHeight;
    if (family === "RM" || family === "PQ" || family === "PM") {
        coreMaterialVolMm3 += 2 * (Math.PI * (Math.pow(A / 2, 2) - Math.pow(E / 2, 2)) * coreOuterLegH);
    } else {
        coreMaterialVolMm3 += 4 * (outerLegThick * coreOuterLegH * C);
    }

    const coreWeightGrams = coreMaterialVolMm3 * 0.0048;
    const totalEstWeightGrams = Math.round(copperWeightGrams + coreWeightGrams);
    const weightDispEl = document.getElementById('estWeightDisp');
    if (weightDispEl) {
        weightDispEl.innerText = totalEstWeightGrams + "g";
        weightDispEl.title = sanitizeHTML("Nüve: " + coreWeightGrams.toFixed(1) + "g | Bakır Tel: " + copperWeightGrams.toFixed(1) + "g");
    }

    const maxDim = Math.max(A, B * 2, C);
    camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.8);
    camera.lookAt(0, 0, 0);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let measureMode = 'off';
    let measureUnit = 'mm';
    let clickedPoints = [];
    let isDragging = false;
    let mouseDownPos = { x: 0, y: 0 };

    const btnOff = document.getElementById('btnMeasOff');
    const btnPoint = document.getElementById('btnMeasPoint');
    const btnBox = document.getElementById('btnMeasBox');
    const btnClear = document.getElementById('btnMeasClear');
    const selUnit = document.getElementById('measUnit');
    const divResult = document.getElementById('measResult');
    const distLabel = document.getElementById('measDistLabel');

    function updateBtnStyles() {
        btnOff.style.background = measureMode === 'off' ? '#3f51b5' : '#333';
        btnPoint.style.background = measureMode === 'point' ? '#3f51b5' : '#333';
        btnBox.style.background = measureMode === 'box' ? '#3f51b5' : '#333';

        btnOff.style.border = measureMode === 'off' ? 'none' : '1px solid #555';
        btnPoint.style.border = measureMode === 'point' ? 'none' : '1px solid #555';
        btnBox.style.border = measureMode === 'box' ? 'none' : '1px solid #555';
    }

    function clearMeasurements() {
        while (measurementGroup.children.length > 0) {
            const child = measurementGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            measurementGroup.remove(child);
        }
        clickedPoints = [];
        divResult.innerHTML = sanitizeHTML(_tr('adv_meas_pending', 'Ölçüm bekleniyor...'));
        if (distLabel) distLabel.style.display = 'none';
    }

    function formatVal(val) {
        return measureUnit === 'cm' ? (val / 10).toFixed(3) : val.toFixed(2);
    }

    function recalculateDistance() {
        if (clickedPoints.length !== 2) return;
        const dist = clickedPoints[0].distanceTo(clickedPoints[1]);
        divResult.innerHTML =
            '<div style="font-size:11px; color:#aaa;">' + sanitizeHTML(_tr('adv_meas_distance', 'Mesafe:')) + '</div>' +
            '<div style="font-size:13px; color:#81c784; font-weight:bold;">' + sanitizeHTML(formatVal(dist)) + ' ' + sanitizeHTML(measureUnit) + '</div>';
        if (distLabel) distLabel.innerHTML = sanitizeHTML(formatVal(dist)) + ' ' + sanitizeHTML(measureUnit);
    }

    function drawBoundingBox() {
        const savedRotY = coreGroup.rotation.y;
        coreGroup.rotation.y = 0;
        coreGroup.updateMatrixWorld(true);

        const gapMarker = coreGroup.getObjectByName("visualGapMarker");
        if (gapMarker) gapMarker.visible = false;

        const box = new THREE.Box3().setFromObject(coreGroup);
        const size = box.getSize(new THREE.Vector3());

        if (gapMarker) gapMarker.visible = true;

        coreGroup.rotation.y = savedRotY;
        coreGroup.updateMatrixWorld(true);

        const boxHelper = new THREE.Box3Helper(box, 0xffeb3b);
        measurementGroup.add(boxHelper);

        const x = size.x; const y = size.y; const z = size.z;
        const vol = x * y * z;

        let unitStr = sanitizeHTML(measureUnit);
        let volUnitStr = measureUnit === 'cm' ? 'cm³' : 'mm³';

        let dx = sanitizeHTML(formatVal(x)); let dy = sanitizeHTML(formatVal(y)); let dz = sanitizeHTML(formatVal(z));
        let dVol = sanitizeHTML(measureUnit === 'cm' ? (vol / 1000).toFixed(3) : (vol).toFixed(0));

        divResult.innerHTML =
            '<div style="display:flex; justify-content:space-between; gap:2px; color:#e0e0e0; font-size:11px;">' +
            '<span><b style="color:#aaa;">X:</b>' + dx + '</span>' +
            '<span><b style="color:#aaa;">Y:</b>' + dy + '</span>' +
            '<span><b style="color:#aaa;">Z:</b>' + dz + ' ' + unitStr + '</span>' +
            '</div>' +
            '<div style="margin-top:2px; font-size:11px;">' +
            '<span style="color:#aaa;">' + sanitizeHTML(_tr('adv_meas_volume', 'Hacim:')) + '</span> ' +
            '<span style="color:#81c784; font-weight:bold;">' + dVol + ' ' + volUnitStr + '</span>' +
            '</div>';
    }

    btnOff.onclick = () => { measureMode = 'off'; updateBtnStyles(); clearMeasurements(); divResult.innerHTML = sanitizeHTML(_tr('adv_meas_mode_off', 'Ölçüm Modu Kapalı')); };
    btnPoint.onclick = () => { measureMode = 'point'; updateBtnStyles(); clearMeasurements(); divResult.innerHTML = sanitizeHTML(_tr('adv_meas_click_1', '1. Noktayı tıklayın...')); };
    btnBox.onclick = () => {
        measureMode = 'box';
        updateBtnStyles();
        clearMeasurements();
        coreGroup.rotation.y = 0;
        coreGroup.updateMatrixWorld(true);
        drawBoundingBox();
    };

    btnClear.onclick = () => {
        clearMeasurements();
        if (measureMode === 'box') drawBoundingBox();
        else if (measureMode === 'point') divResult.innerHTML = sanitizeHTML(_tr('adv_meas_click_1', '1. Noktayı tıklayın...'));
    };

    selUnit.onchange = (e) => {
        measureUnit = e.target.value;
        if (measureMode === 'box') { clearMeasurements(); drawBoundingBox(); }
        else if (clickedPoints.length === 2) recalculateDistance();
    };

    renderer.domElement.addEventListener('pointerdown', (e) => {
        isDragging = false;
        mouseDownPos = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener('pointermove', (e) => {
        if (Math.abs(e.clientX - mouseDownPos.x) > 3 || Math.abs(e.clientY - mouseDownPos.y) > 3) {
            isDragging = true;
        }
    });

    renderer.domElement.addEventListener('pointerup', (event) => {
        if (isDragging || measureMode !== 'point') return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(coreGroup.children, true);

        if (intersects.length > 0) {
            if (clickedPoints.length >= 2) {
                clearMeasurements();
            }

            const p = intersects[0].point;
            clickedPoints.push(p);

            const geo = new THREE.SphereGeometry(Math.max(A, B, C) * 0.015, 16, 16);
            const mat = new THREE.MeshBasicMaterial({ color: 0xff3d00, depthTest: false });
            const sphere = new THREE.Mesh(geo, mat);
            sphere.position.copy(p);
            measurementGroup.add(sphere);

            if (clickedPoints.length === 2) {
                const origin = clickedPoints[0];
                const dest = clickedPoints[1];
                const distance = origin.distanceTo(dest);

                const direction = new THREE.Vector3().subVectors(dest, origin).normalize();
                const arrowHelper = new THREE.ArrowHelper(direction, origin, distance, 0xffeb3b, distance * 0.1, distance * 0.05);

                if (arrowHelper.line) arrowHelper.line.material.depthTest = false;
                if (arrowHelper.cone) arrowHelper.cone.material.depthTest = false;
                arrowHelper.renderOrder = 999;

                measurementGroup.add(arrowHelper);
                recalculateDistance();
                if (distLabel) distLabel.style.display = 'block';
            } else {
                divResult.innerHTML = sanitizeHTML(_tr('adv_meas_click_2', '2. Noktayı tıklayın...'));
            }
        }
    });

    let angle = 0;
    function animate() {
        currentAnimationId = requestAnimationFrame(animate);

        if (measureMode === 'off') {
            angle += 0.002;
            coreGroup.rotation.y = Math.PI / 6 + Math.sin(angle) * 0.15;
        }

        if (clickedPoints.length === 2 && distLabel && distLabel.style.display !== 'none') {
            const midPoint = new THREE.Vector3().addVectors(clickedPoints[0], clickedPoints[1]).multiplyScalar(0.5);
            midPoint.project(camera);

            const x = (midPoint.x * .5 + .5) * viewerDiv.clientWidth;
            const y = (midPoint.y * -.5 + .5) * viewerDiv.clientHeight;

            distLabel.style.left = x + 'px';
            distLabel.style.top = y + 'px';
            distLabel.style.display = 'block';
        }

        controls.update();
        renderer.domElement.style.cursor = measureMode === 'point' ? 'crosshair' : 'default';
        renderer.render(scene, camera);
    }
    animate();

    viewerDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ================================================================
// Leakage Inductance and Snubber Estimation Module
// ================================================================
function estimateLeakageInductance(L_pri_uH) {
    const leakageFactor = 0.025;
    return L_pri_uH * leakageFactor;
}

// ================================================================
// MAIN OPTIMIZATION FUNCTION
// ================================================================
window.executeAdvancedOptimization = async function () {
    const optMode = document.querySelector('input[name="optMode"]:checked').value;
    const resultsContainer = document.getElementById("advancedResults");
    const T_op = parseFloat(document.getElementById("operatingTemp").value) || 80;
    const f_sw_khz = parseFloat(document.getElementById("advFreq").value) || 100;
    const f_sw = f_sw_khz * 1000;

    const selectedManufacturer = document.getElementById("manufacturerFilter")?.value || "all";

    resultsContainer.innerHTML = `<div id="viewer3D" style="width:100%; height:350px; background: linear-gradient(135deg, #547A95 0%, #a2b0c1 100%); border: 1px solid var(--border-color); border-radius: 10px; margin-top:20px; margin-bottom:20px; display:none; position: relative;"></div>
        <p id="loadingMsgText" style='color:#00AEEF;text-align:center;padding:40px 20px;font-size:16px;'><b>${sanitizeHTML(safeGetT('adv_loading_msg') || 'Sunucuda Yapay Zeka Hesaplanıyor... Lütfen Bekleyin.')}</b></p>`;

    try {
        const pageTitle = (document.title || "").toLowerCase();
        const pType = (window._pageType || "").toLowerCase();
        const isSepic = pageTitle.includes('sepic');
        const isCuk = pageTitle.includes('cuk');
        const isZeta = pageTitle.includes('zeta');
        const isInterleaved = pageTitle.includes('interleaved');
        const isDualCoil = isSepic || isCuk || isZeta || isInterleaved;

        let veOptEl = document.getElementById('VeOpt');
        let nOutputEl = document.getElementById('nOutput');

        const iinEl = document.getElementById('iin');
        const voutEl = document.getElementById('vout') || document.getElementById('vout_nom');
        const vinNomEl = document.getElementById('vin_nom') || document.getElementById('Vs_mag');
        const ioutEl = document.getElementById('ilout') || document.getElementById('iout') || document.getElementById('Iout');
        const I_out = parseFloat(ioutEl?.value) || 0;
        const eff = parseFloat(document.getElementById('verim')?.value || 85) / 100;

        const hasVeOpt = veOptEl && veOptEl.innerText !== "-" && veOptEl.innerText !== "" && !isNaN(parseFloat(veOptEl.innerText));
        const hasNOutput = nOutputEl && nOutputEl.innerText !== "-" && nOutputEl.innerText !== "" && !isNaN(parseFloat(nOutputEl.innerText));

        const isLinear = pType.includes('linear') || pageTitle.includes('lineer');

        const vinNom = parseFloat(vinNomEl?.value) || 24;
        const vinMaxEl = document.getElementById('vin_max') || document.getElementById('Vs_max');
        const vinMax = parseFloat(vinMaxEl?.value) || vinNom;
        const voutVal = Math.abs(parseFloat(voutEl?.value)) || 12;
        const ioutVal = I_out > 0 ? I_out : 10;

        let estD = 0.5;
        let sw_Irms = 1;
        let sw_Vmax = vinMax;
        let topology = "unknown";

        if (isSepic || isCuk || isZeta) topology = "buckboost";
        else if (isInterleaved) topology = "interleaved_boost";

        if (isInterleaved) {
            estD = Math.max(0.05, 1 - (vinNom / Math.max(voutVal, vinNom + 1)));
            const I_in_est = (voutVal * ioutVal) / (vinNom * eff);
            sw_Irms = (I_in_est / 2) * Math.sqrt(estD);
            sw_Vmax = voutVal;
        } else {
            estD = Math.min(0.95, Math.max(0.05, voutVal / (vinNom + voutVal)));
            const I_in_est = (voutVal * ioutVal) / (vinNom * eff);
            sw_Irms = (I_in_est + ioutVal) * Math.sqrt(estD);
            sw_Vmax = vinMax + voutVal;
        }

        const isTopology = true;

        const modeEl = document.getElementById("mode");
        const uiMode = modeEl ? modeEl.value.toLowerCase() : "";
        let smpsMode = "CCM";
        let extraModeParams = {};

        if (uiMode === 'continuous') {
            smpsMode = "CCM";
        } else if (uiMode === 'critical') {
            smpsMode = "CRM";
        } else if (uiMode === 'discontinuous') {
            smpsMode = "DCM";
        }

        const J_freq_based = MagneticUtils.getCurrentDensity(f_sw_khz);
        const CMA_base = 1973.525 / Math.max(J_freq_based, 0.1);
        const CMA_scale = optMode === "high_eff" ? 1.25 : (optMode === "compact" ? 0.6 : 1.0);
        let CMA_target = CMA_base * CMA_scale;

        const T_op_actual = T_op || 80;
        const rho_20 = 1.68e-8;
        const alpha_cu = 0.00393;
        const rho_T = rho_20 * (1 + alpha_cu * (T_op_actual - 20));
        const mu_0 = 4 * Math.PI * 1e-7;
        const delta_m = Math.sqrt(rho_T / (Math.PI * mu_0 * f_sw));
        const maxStrandD = delta_m * 1000; 

        let safeData = typeof CoreDB !== 'undefined' ? CoreDB.inductorCores : [];
        let safeKerne = typeof CoreDB !== 'undefined' ? CoreDB.flybackCores : [];
        let safeVeriler = typeof CoreDB !== 'undefined' ? CoreDB.smpsTrafoCores : [];
        let safeTrafoData = typeof CoreDB !== 'undefined' ? CoreDB.linearTrafoCores : [];

        if (isDualCoil) {
            let lOutput1 = parseFloat(document.getElementById('lOutput1')?.innerText);
            let lOutput2 = parseFloat(document.getElementById('lOutput2')?.innerText);
            let wmax1 = parseFloat(document.getElementById('wmaxL1')?.innerText);
            let wmax2 = parseFloat(document.getElementById('wmaxL2')?.innerText);
            let deltaIL1 = parseFloat(document.getElementById('deltaIL1Max')?.innerText) || 0;
            let deltaIL2 = parseFloat(document.getElementById('deltaIL2Max')?.innerText) || 0;

            const missing = [];
            if (isNaN(lOutput1) || lOutput1 <= 0) missing.push('L1');
            if (isNaN(lOutput2) || lOutput2 <= 0) missing.push('L2');
            if (missing.length > 0) {
                throw new Error((safeGetT('adv_error_missing_inductance') || 'Geçerli endüktans değeri bulunamadı') + `: ${missing.join(', ')}`);
            }

            const hasWmax1 = !isNaN(wmax1) && wmax1 > 0;
            const hasWmax2 = !isNaN(wmax2) && wmax2 > 0;
            if (!hasWmax1) wmax1 = 0;
            if (!hasWmax2) wmax2 = 0;

            let _l1_rms = window.l1_rms || 1;
            let _l2_rms = window.l2_rms || 1;

            const basePayload = {
                optMode: optMode, f_sw_khz: f_sw_khz, T_op: T_op,
                hasVeOpt: false, veOpt: 0,
                trafoGapReq: "any", coilGapReq: "gapped_only",
                isFlyback: false, isCoilOnly: true, isTransformerWithCoil: false,
                calculateSwitches: isTopology, sw_Irms: sw_Irms, sw_Vmax: sw_Vmax, turnsRatio: 0,
                CMA_target: CMA_target, maxStrandD: maxStrandD,
                selectedManufacturer: selectedManufacturer, hasBias: false, biasWire_Irms: 0, isLinearTrafo: false,
                staticDbsPayload: [safeData, safeKerne, safeVeriler, safeTrafoData],
                vin_nom: vinNom, vout: voutVal, topology: topology, smpsMode: smpsMode, D_switch: estD, extraModeParams: extraModeParams
            };

            const payloadL1 = { ...basePayload, hasWmax: hasWmax1, wmax: wmax1, L_H: lOutput1 * 1e-6, deltaIL: deltaIL1, coilWire_Irms: _l1_rms, pri_Irms: 0, sec_Irms: 0 };
            const payloadL2 = { ...basePayload, hasWmax: hasWmax2, wmax: wmax2, L_H: lOutput2 * 1e-6, deltaIL: deltaIL2, coilWire_Irms: _l2_rms, pri_Irms: 0, sec_Irms: 0, calculateSwitches: false };

            const [settledL1, settledL2] = await window.apiService.runSmpsOptimizationDual(payloadL1, payloadL2);

            if (settledL1.status === 'rejected' && settledL2.status === 'rejected') {
                throw settledL1.reason;
            }

            const coilLabel1 = safeGetT('adv_coil_l1_label') || 'L1';
            const coilLabel2 = safeGetT('adv_coil_l2_label') || 'L2';
            let partialWarning = "";
            if (settledL1.status === 'rejected') {
                console.error(`Advanced Mode Error (${coilLabel1}):`, settledL1.reason);
                partialWarning += `${coilLabel1}: ${settledL1.reason?.message || 'INTERNAL'}. `;
            }
            if (settledL2.status === 'rejected') {
                console.error(`Advanced Mode Error (${coilLabel2}):`, settledL2.reason);
                partialWarning += `${coilLabel2}: ${settledL2.reason?.message || 'INTERNAL'}. `;
            }

            lastOptimizationResults = {
                isDualCoil: true,
                coil1Cores: settledL1.status === 'fulfilled' ? settledL1.value.data.coilCores : [],
                coil1Wires: settledL1.status === 'fulfilled' ? settledL1.value.data.coilWires : [],
                coil2Cores: settledL2.status === 'fulfilled' ? settledL2.value.data.coilCores : [],
                coil2Wires: settledL2.status === 'fulfilled' ? settledL2.value.data.coilWires : [],
                switches: settledL1.status === 'fulfilled' ? settledL1.value.data.switches : (settledL2.status === 'fulfilled' ? settledL2.value.data.switches : [])
            };

            window.lastOptimizationCurrents = { isDualCoil: true, l1_rms: _l1_rms, l2_rms: _l2_rms, T_op: T_op };
            window.lastOptimizationWarning = partialWarning || null;

        } else {
            let wmax1El = document.getElementById('wmax1');
            let lOutputEl = document.getElementById('lOutput');
            let deltaILEl = document.getElementById('deltaILMax');

            var J_val = MagneticUtils.getCurrentDensity(f_sw_khz);

            let _il_rms = 0; try { if (window.il_rms > 0) _il_rms = window.il_rms; } catch (e) { }
            let _A_coil_req = 0; try { if (window.A_coil_req > 0) _A_coil_req = window.A_coil_req; } catch (e) { }
            let _A1_req = 0; try { if (window.A1_req > 0) _A1_req = window.A1_req; } catch (e) { }
            let _A2_req = 0; try { if (window.A2_req > 0) _A2_req = window.A2_req; } catch (e) { }

            const hasWmax = wmax1El && wmax1El.innerText !== "-" && wmax1El.innerText !== "" && !isNaN(parseFloat(wmax1El.innerText));
            const isFlyback = hasWmax && hasNOutput && !hasVeOpt;
            const isTransformerWithCoil = hasVeOpt && hasWmax;
            let isCoilOnly = hasWmax && !hasVeOpt && !hasNOutput;

            let L_H_value = hasWmax && lOutputEl ? (parseFloat(lOutputEl.innerText) * 1e-6) : 0;
            let coilWire_Irms = 0, pri_Irms = 0, sec_Irms = 0;

            if (isLinear && window.lastTrafoResults) {
                pri_Irms = window.lastTrafoResults.I1 ? Math.sqrt(window.lastTrafoResults.I1.r ** 2 + window.lastTrafoResults.I1.i ** 2) : 1;
                sec_Irms = window.lastTrafoResults.I2 ? Math.sqrt(window.lastTrafoResults.I2.r ** 2 + window.lastTrafoResults.I2.i ** 2) : 1;
                L_H_value = window.lastTrafoResults.L1 || 0;
            }
            else if (isCoilOnly) {
                if (_il_rms > 0) {
                    coilWire_Irms = _il_rms;
                } else if (_A_coil_req > 0) {
                    coilWire_Irms = _A_coil_req * (J_val || 5);
                } else {
                    const deltaIL = parseFloat(deltaILEl?.innerText) || 0;
                    coilWire_Irms = Math.sqrt(Math.pow(I_out, 2) + Math.pow(deltaIL / 2, 2) / 3);
                    if (coilWire_Irms <= 0 || isNaN(coilWire_Irms)) coilWire_Irms = I_out;
                }
            } else if (isFlyback) {
                const nOut = parseFloat(nOutputEl?.innerText) || 1;
                const estD_flyback = Math.min(0.95, Math.max(0.05, (voutVal * nOut) / (vinNom + voutVal * nOut)));

                if (_A1_req > 0) pri_Irms = _A1_req * (J_val || 5);
                else if (_il_rms > 0) pri_Irms = _il_rms;
                else {
                    let I_in = iinEl ? (parseFloat(iinEl.innerText) || parseFloat(iinEl.value) || 0) : 0;
                    if (I_in <= 0) I_in = (voutVal * I_out) / (vinNom * eff);
                    pri_Irms = I_in * (2 / Math.sqrt(3 * estD_flyback));
                }

                if (_A2_req > 0) sec_Irms = _A2_req * (J_val || 5);
                else {
                    const secD = 1 - estD_flyback;
                    sec_Irms = I_out * (2 / Math.sqrt(3 * secD));
                }
            } else if (isTransformerWithCoil) {
                pri_Irms = (_A1_req > 0) ? _A1_req * (J_val || 5) : 0;
                if (pri_Irms <= 0) {
                    let I_in = iinEl ? (parseFloat(iinEl.innerText) || parseFloat(iinEl.value) || 0) : 0;
                    if (I_in <= 0) {
                        I_in = (voutVal * I_out) / (vinNom * eff);
                    }
                    pri_Irms = I_in * 1.5;
                }

                if (_A2_req > 0) {
                    sec_Irms = _A2_req * (J_val || 5);
                } else {
                    const isCenterTapped = pageTitle.includes('llc') && !pageTitle.includes('full');
                    if (isCenterTapped) {
                        sec_Irms = I_out * 0.785;
                    } else if (pageTitle.includes('llc') && pageTitle.includes('full')) {
                        sec_Irms = I_out * 1.11;
                    } else {
                        sec_Irms = I_out * 1.4;
                    }
                }

                if (_A_coil_req > 0) coilWire_Irms = _A_coil_req * (J_val || 5);
                else if (_il_rms > 0) coilWire_Irms = _il_rms;
                else {
                    const deltaIL = parseFloat(deltaILEl?.innerText) || 0;
                    coilWire_Irms = Math.sqrt(Math.pow(I_out, 2) + Math.pow(deltaIL / 2, 2) / 3);
                    if (coilWire_Irms <= 0 || isNaN(coilWire_Irms)) coilWire_Irms = I_out;
                }
            }

            coilWire_Irms = (isNaN(coilWire_Irms) || coilWire_Irms <= 0) ? (I_out > 0 ? I_out : 1) : coilWire_Irms;
            pri_Irms = (isNaN(pri_Irms) || pri_Irms <= 0) ? 1 : pri_Irms;
            sec_Irms = (isNaN(sec_Irms) || sec_Irms <= 0) ? 1 : sec_Irms;

            let biasWire_Irms = 0;
            const hasBias = document.getElementById("advHasBias")?.checked || false;
            const i_bias = parseFloat(document.getElementById("advIbias")?.value) || 0.2;
            if (isFlyback && hasBias && I_out > 0) {
                biasWire_Irms = sec_Irms * (i_bias / I_out);
            }

            let volt_sec = 0;
            let trafoGapReq = "any";
            let coilGapReq = "gapped_only";

            if (pageTitle.includes('llc') || pageTitle.includes('resonant')) {
                const isFullBridge = pageTitle.includes('full') || pageTitle.includes('tam');
                volt_sec = isFullBridge ? (vinNom * (0.5 / f_sw)) : ((vinNom / 2) * (0.5 / f_sw));
                trafoGapReq = "ungapped_only";
                coilGapReq = "gapped_only";
            } else if (pageTitle.includes('push-pull') || pageTitle.includes('dab') || pageTitle.includes('bridge')) {
                volt_sec = vinNom * (0.5 / f_sw);
                trafoGapReq = "ungapped_only";
            } else if (pageTitle.includes('forward')) {
                const nOutFwd = parseFloat(nOutputEl?.innerText) || 1;
                const D_forward = Math.min(0.49, Math.max(0.05, (voutVal * nOutFwd) / vinNom));
                volt_sec = vinNom * (D_forward / f_sw);
                trafoGapReq = "ungapped_only";
            } else if (pageTitle.includes('flyback')) {
                const nOutFly = parseFloat(nOutputEl?.innerText) || 1;
                const D_flyback = Math.min(0.95, Math.max(0.05, (voutVal * nOutFly) / (vinNom + voutVal * nOutFly)));
                volt_sec = vinNom * (D_flyback / f_sw);
                trafoGapReq = "gapped_only";
            } else if (isLinear) {
                volt_sec = vinNom * (0.45 / f_sw);
                trafoGapReq = "ungapped_only";
            } else {
                volt_sec = vinNom * (0.5 / f_sw);
            }

            const isBuck = pageTitle.includes('buck') && !pageTitle.includes('boost');
            const isBoost = pageTitle.includes('boost') && !pageTitle.includes('buck');
            const isBuckBoost = pageTitle.includes('buck-boost') || pageTitle.includes('buck boost');
            const isForward = pageTitle.includes('forward');
            const isBridge = pageTitle.includes('bridge') || pageTitle.includes('llc') || pageTitle.includes('dab');
            const isPushPull = pageTitle.includes('push-pull') || pageTitle.includes('push pull');
            const isPfc = pageTitle.includes('pfc');
            const isTopologySingle = isBuck || isBoost || isBuckBoost || isFlyback || isForward || isBridge || isPushPull || isPfc;

            if (isBuck && !isBuckBoost) {
                topology = "buck";
            } else if ((isBoost && !isBuckBoost) || isPfc) {
                topology = "boost";
            } else if (isBuckBoost) {
                topology = "buckboost";
            } else if (isFlyback) {
                topology = "flyback";
            } else if (isForward) {
                topology = "forward";
            } else if (isPushPull) {
                topology = "pushpull";
            } else if (isBridge && !pageTitle.includes('llc') && !pageTitle.includes('dab')) {
                topology = "bridge";
            } else if (isInterleaved) {
                topology = "interleaved_boost";
            } 

            if (isBuck && !isBuckBoost) {
                estD = Math.min(0.95, Math.max(0.05, voutVal / vinNom));
                sw_Irms = ioutVal * Math.sqrt(estD);
                sw_Vmax = vinMax;
            } else if ((isBoost && !isBuckBoost) || isPfc) {
                estD = Math.max(0.05, 1 - (vinNom / Math.max(voutVal, vinNom + 1)));
                sw_Irms = (ioutVal / (1 - estD)) * Math.sqrt(estD);
                sw_Vmax = voutVal;
            } else if (isBuckBoost) {
                estD = Math.min(0.95, Math.max(0.05, voutVal / (vinNom + voutVal)));
                const I_in = (voutVal * ioutVal) / (vinNom * eff);
                sw_Irms = (I_in + ioutVal) * Math.sqrt(estD);
                sw_Vmax = vinMax + voutVal;
            } else if (isFlyback) {
                const nOut = parseFloat(nOutputEl?.innerText) || 1;
                estD = Math.min(0.95, Math.max(0.05, (voutVal * nOut) / (vinNom + voutVal * nOut)));
                sw_Vmax = vinMax + (voutVal * nOut);
                sw_Irms = pri_Irms;
            } else if (isForward || isPushPull) {
                sw_Vmax = vinMax * 2;
                sw_Irms = pri_Irms;
            } else if (isBridge) {
                sw_Vmax = vinMax;
                sw_Irms = pri_Irms / Math.SQRT2;
            }

            if (!uiMode && deltaILEl && parseFloat(deltaILEl.innerText) > (ioutVal * 2)) {
                smpsMode = "DCM";
            }
            if (isPfc) {
                extraModeParams.D1 = estD;
                extraModeParams.D2 = 1 - estD;
            }

            if (pageTitle.includes('llc')) {
                topology = "llc";
                const vinNomStr = document.getElementById('vin_nom') ? parseFloat(document.getElementById('vin_nom').value) : vinNom;
                const vinTest = parseFloat(document.getElementById('vin_test')?.value) || vinNomStr;
                extraModeParams.f_sw_over_fr = vinTest / Math.max(vinNomStr, 1);

                if (vinTest < vinNomStr) extraModeParams.llcMode = "below";
                else if (vinTest > vinNomStr) extraModeParams.llcMode = "above";
                else extraModeParams.llcMode = "at";
            } else if (pageTitle.includes('dab')) {
                topology = "dab";
                extraModeParams.dabMode = uiMode || "sps";
                extraModeParams.phaseShift = window.dabPhaseShift || 0;
            }

            let turnsRatio = 0;
            if (hasNOutput) {
                turnsRatio = parseFloat(nOutputEl.innerText) || 0;
            } else if (hasVeOpt && !isLinear) {
                const isHalfBridge = pageTitle.includes('half') || pageTitle.includes('yarım');
                if (isHalfBridge) {
                    turnsRatio = (vinNom / 2) / Math.max(voutVal, 1);
                } else {
                    turnsRatio = vinNom / Math.max(voutVal, 1);
                }
            }

            const payload = {
                optMode: optMode,
                f_sw_khz: f_sw_khz,
                T_op: T_op,
                hasVeOpt: hasVeOpt,
                veOpt: hasVeOpt ? parseFloat(veOptEl.innerText) : 0,
                hasWmax: hasWmax,
                wmax: hasWmax ? parseFloat(wmax1El.innerText) : 0,
                L_H: L_H_value,
                deltaIL: hasWmax ? (parseFloat(deltaILEl?.innerText) || 0) : 0,
                vin_nom: vinNom,
                vout: voutVal,
                volt_sec: volt_sec,
                trafoGapReq: trafoGapReq,
                coilGapReq: coilGapReq,
                isFlyback: isFlyback,
                isCoilOnly: isCoilOnly,
                isTransformerWithCoil: isTransformerWithCoil,

                pri_Irms: pri_Irms,
                sec_Irms: sec_Irms,
                coilWire_Irms: coilWire_Irms,

                calculateSwitches: isTopologySingle,
                sw_Irms: sw_Irms,
                sw_Vmax: sw_Vmax,

                CMA_target: CMA_target,
                maxStrandD: maxStrandD,
                selectedManufacturer: selectedManufacturer,
                staticDbsPayload: [safeData, safeKerne, safeVeriler, safeTrafoData],
                hasBias: hasBias,
                biasWire_Irms: biasWire_Irms,
                isLinearTrafo: isLinear,
                turnsRatio: turnsRatio,

                topology: topology,
                smpsMode: smpsMode,
                D_switch: estD,
                extraModeParams: extraModeParams
            };

            const response = await window.apiService.runSmpsOptimizationSingle(payload);
            lastOptimizationResults = response.data;

            window.lastOptimizationCurrents = {
                pri_Irms: pri_Irms,
                sec_Irms: sec_Irms,
                coilWire_Irms: coilWire_Irms,
                T_op: T_op,
                isDualCoil: false
            };
            window.lastOptimizationWarning = null;
        }

        window.populateManufacturerDropdown();

        const selectEl = document.getElementById("manufacturerFilter");
        if (selectEl && Array.from(selectEl.options).some(opt => opt.value === selectedManufacturer)) {
            selectEl.value = selectedManufacturer;
        }

        window.filterResultsByManufacturer();

    } catch (error) {
        console.error("Advanced Mode Error: ", error);
        resultsContainer.innerHTML = `<p style="color:#ef5350;text-align:center;padding:20px;">
            ${sanitizeHTML(safeGetT('adv_error_msg') || 'Hata:')} ${sanitizeHTML(error.message)}</p>`;
    }
};

window.filterResultsByManufacturer = function () {
    const currents = window.lastOptimizationCurrents || { pri_Irms: 1, sec_Irms: 1, coilWire_Irms: 1, T_op: 80, isDualCoil: false };
    const selectedMfg = document.getElementById("manufacturerFilter")?.value || "all";
    let filteredResults = JSON.parse(JSON.stringify(lastOptimizationResults));

    if (selectedMfg !== "all") {
        const filterFn = (core) => (core.mfgName || "").toLowerCase().includes(selectedMfg);
        if (filteredResults.trafoCores) filteredResults.trafoCores = filteredResults.trafoCores.filter(filterFn);
        if (filteredResults.coilCores) filteredResults.coilCores = filteredResults.coilCores.filter(filterFn);
        if (filteredResults.coil1Cores) filteredResults.coil1Cores = filteredResults.coil1Cores.filter(filterFn);
        if (filteredResults.coil2Cores) filteredResults.coil2Cores = filteredResults.coil2Cores.filter(filterFn);

        const filterSwFn = (sw) => (sw.manufacturer || "").toLowerCase().includes(selectedMfg);
        if (filteredResults.switches) filteredResults.switches = filteredResults.switches.filter(filterSwFn);
    }

    const onlyKnownStock = document.getElementById("advOnlyKnownStock")?.checked || false;
    if (onlyKnownStock) {
        const knownStockFn = (core) => !!core.distributor && core.distributor !== "Unknown Stock";
        if (filteredResults.trafoCores) filteredResults.trafoCores = filteredResults.trafoCores.filter(knownStockFn);
        if (filteredResults.coilCores) filteredResults.coilCores = filteredResults.coilCores.filter(knownStockFn);
        if (filteredResults.coil1Cores) filteredResults.coil1Cores = filteredResults.coil1Cores.filter(knownStockFn);
        if (filteredResults.coil2Cores) filteredResults.coil2Cores = filteredResults.coil2Cores.filter(knownStockFn);
    }

    const getUniqueItems = (arr, keyExtractor) => {
        if (!arr || !Array.isArray(arr)) return [];
        const seen = new Set();
        return arr.filter(item => {
            const val = typeof keyExtractor === 'function' ? keyExtractor(item) : item[keyExtractor];
            const normalizedVal = String(val).trim().toLowerCase();

            if (seen.has(normalizedVal)) return false;
            seen.add(normalizedVal);
            return true;
        });
    };

    const coreSwKey = (item) => item.name;

    if (filteredResults.trafoCores) filteredResults.trafoCores = getUniqueItems(filteredResults.trafoCores, coreSwKey).slice(0, 10);
    if (filteredResults.coilCores) filteredResults.coilCores = getUniqueItems(filteredResults.coilCores, coreSwKey).slice(0, 10);
    if (filteredResults.coil1Cores) filteredResults.coil1Cores = getUniqueItems(filteredResults.coil1Cores, coreSwKey).slice(0, 10);
    if (filteredResults.coil2Cores) filteredResults.coil2Cores = getUniqueItems(filteredResults.coil2Cores, coreSwKey).slice(0, 10);
    if (filteredResults.switches) filteredResults.switches = getUniqueItems(filteredResults.switches, coreSwKey).slice(0, 10);

    const wireKey = (w) => {
        const std = w.standard || '';
        const strands = w.strands || w.parallel || w.parallelStrands || w.parallel_strands || 1;
        const coating = w.coating || '';
        return `${std}_${strands}_${coating}`;
    };

    if (filteredResults.priWires) filteredResults.priWires = getUniqueItems(filteredResults.priWires, wireKey);
    if (filteredResults.secWires) filteredResults.secWires = getUniqueItems(filteredResults.secWires, wireKey);
    if (filteredResults.coilWires) filteredResults.coilWires = getUniqueItems(filteredResults.coilWires, wireKey);
    if (filteredResults.coil1Wires) filteredResults.coil1Wires = getUniqueItems(filteredResults.coil1Wires, wireKey);
    if (filteredResults.coil2Wires) filteredResults.coil2Wires = getUniqueItems(filteredResults.coil2Wires, wireKey);

    const resultsContainer = document.getElementById("advancedResults");

    let viewerHTML = "";
    const viewerDiv = document.getElementById("viewer3D");
    if (viewerDiv) {
        viewerHTML = viewerDiv.outerHTML;
    } else {
        viewerHTML = `<div id="viewer3D" style="width:100%; height:350px; background: linear-gradient(135deg, #547A95 0%, #a2b0c1 100%); border: 1px solid var(--border-color); border-radius: 10px; margin-top:20px; margin-bottom:20px; display:none; position: relative;"><h4 style="position:absolute; top:10px; left:10px; color:#ffb74d; margin:0; z-index:10;">${sanitizeHTML(safeGetT('adv_3d_preview_title') || '3D Nüve Önizlemesi')}</h4></div>`;
    }

    resultsContainer.innerHTML = viewerHTML;

    if (window.lastOptimizationWarning) {
        const warnEl = document.createElement('p');
        warnEl.style.cssText = "color:#ffb74d;text-align:center;padding:10px;";
        warnEl.textContent = (safeGetT('adv_partial_error_msg') || 'Bazı sonuçlar alınamadı') + ': ' + window.lastOptimizationWarning;
        resultsContainer.appendChild(warnEl);
    }

    const f_sw = (parseFloat(document.getElementById("advFreq").value) || 100) * 1000;
    const maxStrandD = 2 * (65.6 / Math.sqrt(f_sw));

    const pageTitle = (document.title || "").toLowerCase();
    const isSepic = pageTitle.includes('sepic');
    const isCuk = pageTitle.includes('cuk');
    const isZeta = pageTitle.includes('zeta');

    const voutVal = Math.abs(parseFloat((document.getElementById('vout') || document.getElementById('vout_nom'))?.value)) || 12;
    const ioutEl = document.getElementById('ilout') || document.getElementById('iout') || document.getElementById('iout_dab') || document.getElementById('Iout');
    const I_out = parseFloat(ioutEl?.value) || 0;
    const ioutVal = I_out > 0 ? I_out : 10;
    const eff = parseFloat(document.getElementById('verim')?.value || 85) / 100;

    let R_th = parseFloat(document.getElementById("advRthSelect")?.value);
    if (isNaN(R_th) || document.getElementById("advRthSelect")?.value === 'manual') {
        R_th = parseFloat(document.getElementById("advRth")?.value) || 2.0;
    }

    const P_out = voutVal * ioutVal;

    let defaultSwitchQty = 1;
    if (pageTitle.includes('interleaved') || pageTitle.includes('push-pull') || pageTitle.includes('half-bridge') || pageTitle.includes('half bridge')) {
        defaultSwitchQty = 2;
    } else if (pageTitle.includes('full-bridge') || pageTitle.includes('full bridge') || pageTitle.includes('dab')) {
        defaultSwitchQty = 4;
    }

    let bestSwitchLoss = (filteredResults.switches && filteredResults.switches.length > 0) ? (filteredResults.switches[0].p_tot_W || 0) : 0;

    bestSwitchLoss *= defaultSwitchQty;

    let bestCoreLoss = 0;
    let bestCopperLoss = 0;

    const currentTemp = currents.T_op || 80;
    const rho = 1.68e-8 * (1 + 0.00393 * (currentTemp - 20));

    if (currents.isDualCoil) {
        const bestCoil1 = (filteredResults.coil1Cores && filteredResults.coil1Cores.length > 0) ? filteredResults.coil1Cores[0] : null;
        const bestCoil2 = (filteredResults.coil2Cores && filteredResults.coil2Cores.length > 0) ? filteredResults.coil2Cores[0] : null;

        const bestCoil1Loss = bestCoil1 ? (bestCoil1.coreLossW || 0) : 0;
        const bestCoil2Loss = bestCoil2 ? (bestCoil2.coreLossW || 0) : 0;
        bestCoreLoss = bestCoil1Loss + bestCoil2Loss;

        const wire1 = filteredResults.coil1Wires?.[0];
        const wire2 = filteredResults.coil2Wires?.[0];

		if (bestCoil1 && wire1 && wire1.totalArea) {
			let Ae = bestCoil1.Ae_mm2 || 100;
            let dimA = bestCoil1.dim_A || 0;
            let dimD = bestCoil1.dim_D || 0;
            let dimE = bestCoil1.dim_E || 0;
            let family = bestCoil1.family || "E";
            let w_width = 0;

            if (family === "RM" || family === "PQ" || family === "PM") {
                if (dimA > 0 && dimD > 0) w_width = (dimA - dimD) / 3;
                else if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
            } else {
                if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
                else if (dimA > 0 && dimD > 0) w_width = (dimA - 2 * dimD) / 2;
            }

            w_width = Math.max(0, w_width - 1.0);

            const legPerimeter_mm = 4 * Math.sqrt(Ae);
            let MLT_mm = legPerimeter_mm + (Math.PI * w_width);
            if (w_width === 0) MLT_mm = 4.5 * Math.sqrt(Ae);

            let MLT = MLT_mm / 1000;
			let n1 = bestCoil1.n1_calc || 10;
			let parsedArea = parseFloat(wire1.totalArea) || 0.5;
			let dcr = rho * ((n1 * MLT) / 1000) / (parsedArea * 1e-6);
			bestCopperLoss += dcr * Math.pow(currents.l1_rms, 2);
		}
		if (bestCoil2 && wire2 && wire2.totalArea) {
			let Ae = bestCoil2.Ae_mm2 || 100;
            let dimA = bestCoil2.dim_A || 0;
            let dimD = bestCoil2.dim_D || 0;
            let dimE = bestCoil2.dim_E || 0;
            let family = bestCoil2.family || "E";
            let w_width = 0;

            if (family === "RM" || family === "PQ" || family === "PM") {
                if (dimA > 0 && dimD > 0) w_width = (dimA - dimD) / 3;
                else if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
            } else {
                if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
                else if (dimA > 0 && dimD > 0) w_width = (dimA - 2 * dimD) / 2;
            }

            w_width = Math.max(0, w_width - 1.0);

            const legPerimeter_mm = 4 * Math.sqrt(Ae);
            let MLT_mm = legPerimeter_mm + (Math.PI * w_width);
            if (w_width === 0) MLT_mm = 4.5 * Math.sqrt(Ae);

            let MLT = MLT_mm / 1000;
			let n1 = bestCoil2.n1_calc || 10;
			let parsedArea2 = parseFloat(wire2.totalArea) || 0.5; 
			let dcr = rho * ((n1 * MLT) / 1000) / (parsedArea2 * 1e-6);
			bestCopperLoss += dcr * Math.pow(currents.l2_rms, 2);
		}
    } else {
        const bestTrafoCore = (filteredResults.trafoCores && filteredResults.trafoCores.length > 0) ? filteredResults.trafoCores[0] : null;
        const bestCoilCore = (filteredResults.coilCores && filteredResults.coilCores.length > 0) ? filteredResults.coilCores[0] : null;
        const bestTrafoCoreLoss = bestTrafoCore ? (bestTrafoCore.coreLossW || 0) : 0;
        const bestCoilCoreLoss = bestCoilCore ? (bestCoilCore.coreLossW || 0) : 0;

        bestCoreLoss = bestTrafoCoreLoss + bestCoilCoreLoss;

        const priWire = filteredResults.priWires?.[0];
        const secWire = filteredResults.secWires?.[0];
        const coilWire = filteredResults.coilWires?.[0];

        const priIrmsEst = currents.pri_Irms || 1;
        const secIrmsEst = currents.sec_Irms || ioutVal;
        const coilIrmsEst = currents.coilWire_Irms || ioutVal;

		if (bestTrafoCore) {
            let Ae = bestTrafoCore.Ae_mm2 || 100;
            let dimA = bestTrafoCore.dim_A || 0;
            let dimD = bestTrafoCore.dim_D || 0;
            let dimE = bestTrafoCore.dim_E || 0;
            let family = bestTrafoCore.family || "E";
            let w_width = 0;

            if (family === "RM" || family === "PQ" || family === "PM") {
                if (dimA > 0 && dimD > 0) w_width = (dimA - dimD) / 3;
                else if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
            } else {
                if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
                else if (dimA > 0 && dimD > 0) w_width = (dimA - 2 * dimD) / 2;
            }

            w_width = Math.max(0, w_width - 1.0);

            const legPerimeter_mm = 4 * Math.sqrt(Ae);
            let MLT_mm = legPerimeter_mm + (Math.PI * w_width);
            if (w_width === 0) MLT_mm = 4.5 * Math.sqrt(Ae);

            let MLT_m = MLT_mm / 1000;
            let n1 = bestTrafoCore.n1_calc || 10;
            let n2 = bestTrafoCore.n2_calc || Math.max(4, Math.floor(n1 / 2));

            if (priWire && priWire.totalArea) {
                let A_wire_m2 = parseFloat(priWire.totalArea) * 1e-6;
                let dcr = rho * (n1 * MLT_m) / A_wire_m2;
                bestCopperLoss += dcr * Math.pow(priIrmsEst, 2);
            }
            if (secWire && secWire.totalArea) {
                let A_wire_m2 = parseFloat(secWire.totalArea) * 1e-6;
                let dcr = rho * (n2 * MLT_m) / A_wire_m2;
                const isCenterTapped = pageTitle.includes('llc') && !pageTitle.includes('full');

                if (isCenterTapped) {
                    bestCopperLoss += 2 * dcr * Math.pow(secIrmsEst, 2);
                } else {
                    bestCopperLoss += dcr * Math.pow(secIrmsEst, 2);
                }
            }
        }

        if (bestCoilCore) {
            let Ae = bestCoilCore.Ae_mm2 || 100;
            let dimA = bestCoilCore.dim_A || 0;
            let dimD = bestCoilCore.dim_D || 0;
            let dimE = bestCoilCore.dim_E || 0;
            let family = bestCoilCore.family || "E";
            let w_width = 0;

            if (family === "RM" || family === "PQ" || family === "PM") {
                if (dimA > 0 && dimD > 0) w_width = (dimA - dimD) / 3;
                else if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
            } else {
                if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
                else if (dimA > 0 && dimD > 0) w_width = (dimA - 2 * dimD) / 2;
            }

            w_width = Math.max(0, w_width - 1.0);

            const legPerimeter_mm = 4 * Math.sqrt(Ae);
            let MLT_mm = legPerimeter_mm + (Math.PI * w_width);
            if (w_width === 0) MLT_mm = 4.5 * Math.sqrt(Ae);

            let MLT_m = MLT_mm / 1000;
            let n1 = bestCoilCore.n1_calc || bestCoilCore.n1 || 10;

            let targetWire = coilWire || priWire;
            if (targetWire) {
                let A_wire = parseFloat(targetWire.totalArea) || 0.5;
                let dcr = rho * ((n1 * MLT_mm) / 1000) / (A_wire * 1e-6);
                bestCopperLoss += dcr * Math.pow(coilIrmsEst, 2);
            }
        }
    }

    if (bestCopperLoss === 0 || isNaN(bestCopperLoss)) {
        let uiCu = 0;
        ['res_pl_dcr', 'res_ptr_dcr', 'res_pl1_dcr', 'res_pl2_dcr'].forEach(id => {
            let el = document.getElementById(id);
            if (el) {
                let val = parseFloat(el.innerText);
                if (!isNaN(val)) uiCu += val;
            }
        });
        if (uiCu > 0) bestCopperLoss = uiCu;
    }

    bestCopperLoss = bestCopperLoss || 0;

    let P_loss;
    let isEstimatedLoss = false;

    const hasRealData = bestSwitchLoss > 0 || bestCoreLoss > 0 || bestCopperLoss > 0;
    if (hasRealData) {
        P_loss = bestSwitchLoss + bestCoreLoss + bestCopperLoss;
        isEstimatedLoss = false;
    } else {
        P_loss = P_out * ((1 / eff) - 1);
        isEstimatedLoss = true;
    }

    const Delta_T = P_loss * R_th;

    const isInductorPage = pageTitle.includes('inductor') || pageTitle.includes('indüktör');

    const states = {
        isDualCoil: currents.isDualCoil,
        calculateSwitches: !isInductorPage,
        P_out: P_out,
        P_loss: P_loss,
        R_th: R_th,
        Delta_T: Delta_T,
        eff: eff,
        isEstimatedLoss: isEstimatedLoss,
        bestSwitchLoss: bestSwitchLoss,
        bestCoreLoss: bestCoreLoss,
        bestCopperLoss: bestCopperLoss,

        hasWmax: document.getElementById('wmax1') && document.getElementById('wmax1').innerText !== "-",
        hasVeOpt: document.getElementById('VeOpt') && document.getElementById('VeOpt').innerText !== "-",
        isFlyback: document.getElementById('wmax1') && document.getElementById('nOutput') && !document.getElementById('VeOpt'),
        isLinear: (window._pageType || "").toLowerCase().includes('linear') || pageTitle.includes('lineer'),
        hasBias: document.getElementById("advHasBias")?.checked || false,
        v_bias: parseFloat(document.getElementById("advVbias")?.value) || 12,
        i_bias: parseFloat(document.getElementById("advIbias")?.value) || 0.2
    };

    if (!states.isDualCoil) {
        states.isCoilOnly = states.hasWmax && !states.hasVeOpt && !document.getElementById('nOutput');
    }

    if (states.isLinear) {
        states.calculateSwitches = false;
    }

    renderAdvancedResults(filteredResults, maxStrandD, states);
};

function renderAdvancedResults(res, skinDepthD, states) {
    const loadingEl = document.getElementById('loadingMsgText');
    if (loadingEl) loadingEl.remove();

    const infoText1 = sanitizeHTML((safeGetT('adv_skin_effect_info') || "Tavsiye edilen maksimum tek damar (Litz) çapı: {0} mm").replace('{0}', skinDepthD.toFixed(3)));
    const infoText2 = sanitizeHTML(safeGetT('adv_core_loss_info') || "Akıllı Mod Aktif: Frekansa bağlı olarak optimum akım yoğunluğu (J) otomatik olarak ayarlanmıştır.");
    const infoText4 = sanitizeHTML(safeGetT('adv_gap_info') || "Tasarımın topoloji gereksinimlerine göre uygun manyetik hava boşluklu (Gapped) veya boşluksuz (Ungapped) yapılar otomatik olarak filtrelenmiştir.");
    const infoText5 = sanitizeHTML(safeGetT('adv_note_info') || "Not: Yapay zeka önerileri, mevcut veri tabanına ve tahmin modellerine dayanmaktadır. Gerçek dünya sonuçları farklı olabilir, lütfen tasarımlarınızı prototiplemeden önce doğrulayın.");
    const infoText3 = sanitizeHTML(safeGetT('adv_fuzzy_score_info') || "Uygunluk Skoru (0-100): Seçtiğiniz metoda (Maliyet, Verim, Boyut) göre bileşenin kriterlerinizi ne oranda karşıladığını gösterir.");

    let html = `<div style="padding-bottom:20px;border-bottom:1px solid var(--border-color);margin-bottom:20px;">
    <p style="font-size:13px;color:var(--color-yellow);margin:5px 0;"><b>* </b> ${infoText4}</p>
    <p style="font-size:13px;color:var(--text-muted);margin:5px 0;">${infoText1}</p>
    <p style="font-size:13px;color:var(--text-muted);margin:5px 0;">${infoText2}</p>
    <p style="font-size:13px;color:var(--text-muted);margin:5px 0;">${infoText5}</p>
    <p style="font-size:13px;color:#81c784;margin:5px 0;"><b>* </b> ${infoText3}</p>
</div>`;

    const genCoreTable = (title, data) => {
        const bestCoreJson = (data && data.length > 0) ? encodeURIComponent(JSON.stringify(data[0])).replace(/'/g, "%27") : "{}";

        let t = `
            <div class="d-flex justify-content-between align-items-center mb-2 mt-3">
                <h4 class="section-title" style="margin:0;">${sanitizeHTML(title)}</h4>
                ${(data && data.length > 0) ? `<button class="btn btn-sm btn-outline-info fw-bold" onclick="window.runMonteCarloCore('${bestCoreJson}')">${sanitizeHTML(safeGetT('adv_monte_carlo_switch') || 'Monte Carlo Analizi (1#)')}</button>` : ''}
            </div>
            <div class="table-responsive"><table class="adv-table">
            <thead><tr>
                <th>${sanitizeHTML(safeGetT('adv_tbl_rank') || 'Sıra')}</th><th>${sanitizeHTML(safeGetT('adv_tbl_core_name') || 'Nüve')}</th>
                <th>${sanitizeHTML(safeGetT('adv_tbl_material') || 'Malzeme')}</th><th>${sanitizeHTML(safeGetT('adv_tbl_bobbin') || 'Karkas')}</th>
                <th>${sanitizeHTML(safeGetT('adv_tbl_bmax') || 'Bm (AC Genlik mT)')}</th>
                <th>
                    ${sanitizeHTML(safeGetT('adv_tbl_core_loss') || 'Nüve Kaybı')}
                    <span class="info-icon" onclick="event.stopPropagation(); window.showIgseModal('${bestCoreJson}')" title="${sanitizeHTML(safeGetT('igse_tooltip_how') || 'Nasıl hesaplandı?')}" style="cursor:pointer;color:#00AEEF;font-size:14px;margin-left:4px;">ⓘ</span><br>
                    <span style="font-size:10px;color:#aaa;">(Pv = mW/cm³)</span>
                </th>
                <th>${sanitizeHTML(safeGetT('adv_tbl_vendor_cost') || 'Maliyet / Satıcı')}</th><th>${sanitizeHTML(safeGetT('adv_tbl_score') || 'Skor')}</th>
            </tr></thead><tbody>`;

        if (!data || data.length === 0)
            return t + `<tr><td colspan="8" style="color:#ef5350;padding:15px;">${sanitizeHTML(safeGetT('adv_no_core_found') || 'Uygun nüve bulunamadı.')}</td></tr></tbody></table></div>`;

        if (data[0] && data[0].pv > 600)
            t += `<tr><td colspan="8" style="background-color:#3b0000;color:#ffab91;padding:15px;font-size:14px;border:1px solid #ff5252;">
                <b>${sanitizeHTML(safeGetT('adv_high_core_loss_warning') || 'DİKKAT: Nüve kaybı çok yüksek! Lütfen frekansı düşürün veya daha büyük bir nüve seçin.')}</b></td></tr>`;

        data.forEach((item, index) => {
            let costDisplay = "";

            if (!item.totalCost || item.totalCost === 999 || item.costPerUnit === 999) {
                costDisplay = `<span style='color:#9e9e9e; font-weight:bold;'>no-cost</span>`;
            } else {
                const setLabel = item.isTwoPieceSet ? "(2-piece set)" : "(Single core)";
                costDisplay = `<b>${sanitizeHTML(item.totalCost.toFixed(2))} $</b> <br>` +
                    `<span style="font-size:10px;color:#aaa;">${setLabel} | One: ${sanitizeHTML(item.costPerUnit.toFixed(2))} $</span>`;
            }

            const lossColor = item.pv > 600 ? "#ef5350" : "#81c784";
            const formattedLossW = item.coreLossW < 0.01 ? "< 0.01 W" : `${item.coreLossW.toFixed(2)} W`;
            const formattedPv = item.pv < 1 ? "< 1" : item.pv.toFixed(0);

            const safeName = sanitizeHTML(item.name);
            const safeMaterial = sanitizeHTML(item.material);
            const safeBobbin = sanitizeHTML(item.bobbinName);
            const safeDistributor = sanitizeHTML(item.distributor);
            const safeUrl = sanitizeURL(item.url);

            const n1_val = item.n1_calc || "-";
            const n2_val = item.n2_calc > 0 ? ` / N2: ${item.n2_calc}` : "";
            const turnsDisplay = `<br><span style="font-size:11px; color:#ffb74d; background: rgba(255,183,77,0.1); padding: 2px 4px; border-radius: 3px; display:inline-block; margin-top:3px;">N1: ${n1_val}${n2_val}</span>`;

            let rowStyling = index === 0 ? "class='row-best-opt'" : "";
            if (item.windowExceeded) {
                rowStyling = `style="background-color: rgba(229, 57, 53, 0.15); border-left: 4px solid #e53935;"`;
            }

            const fillPct = item.fillRatio ? ` (%${(item.fillRatio * 100).toFixed(0)})` : "";

            const fitWarningBadge = item.windowExceeded
                ? `<br><span style="font-size:11px; color:#fff; background:#e53935; padding:2px 5px; border-radius:3px; display:inline-block; margin-top:4px;">${safeGetT('too_small')} ${fillPct}</span>`
                : "";

            const coreDataJson = encodeURIComponent(JSON.stringify(item)).replace(/'/g, "%27");

            t += `<tr ${rowStyling} 
      style="cursor:pointer;" title="Click for 3D view!"
      onclick="window.render3DCore('${coreDataJson}')">
            <td><strong>#${index + 1}</strong><span style="color:#81c784;font-size:11px;">
                ${index === 0 && !item.windowExceeded ? "<br>" + sanitizeHTML(safeGetT('adv_best') || 'En İyi') : ""}</span></td>
            <td style="text-align:left; color:#00AEEF; font-weight:bold;">
                ${safeName} <br>
                <span style="font-size:10px;color:#888;">(${sanitizeHTML(safeGetT('adv_show_3d') || '3D Göster')})</span>
                ${turnsDisplay}
                ${fitWarningBadge}
            </td>
            <!-- Diğer td elemanları aynı kalacak -->
            <td><strong>${safeMaterial}</strong></td>
            <td>${safeBobbin}</td>
            <td style="color:#00AEEF;">${sanitizeHTML(parseFloat(item.bmax).toFixed(2))}</td>
            <td style="color:${lossColor};"><b>${sanitizeHTML(formattedLossW)}</b><br>
                <span style="font-size:11px;opacity:0.8;">${sanitizeHTML(formattedPv)} mW/cm³</span>
                <span onclick="event.stopPropagation(); window.showIgseModal('${coreDataJson}')" style="cursor:pointer;color:#00AEEF;margin-left:5px;">ⓘ</span>
            </td>
            <td>${safeDistributor}<br>${costDisplay}</td>
            <td><b>${sanitizeHTML(item.fuzzyScore.toFixed(1))}</b>
            <span style="font-size:11px; color:var(--text-muted);">/100</span></td>
        </tr>`;
        });
        return t + `</tbody></table></div>`;
    };

    const genWireTable = (title, data) => {
        let t = `<h4 class="section-title">${sanitizeHTML(title)}</h4><div class="table-responsive"><table class="adv-table">
            <thead><tr>
                <th>${sanitizeHTML(safeGetT('adv_tbl_awg') || 'Standart')}</th><th>${sanitizeHTML(safeGetT('adv_tbl_wire_dia') || 'Çap (mm)')}</th>
                <th>${sanitizeHTML(safeGetT('adv_tbl_strands') || 'Paralel Damar')}</th><th>${sanitizeHTML(safeGetT('adv_tbl_total_area') || 'Top. Kesit (mm²)')}</th>
                <th>${sanitizeHTML(safeGetT('adv_tbl_cma') || 'CMA')}</th><th>${sanitizeHTML(safeGetT('adv_tbl_coating') || 'Kaplama')}</th>
            </tr></thead><tbody>`;

        if (!data || data.length === 0)
            return t + `<tr><td colspan="6" style="color:#ef5350;padding:15px;">${sanitizeHTML(safeGetT('adv_no_wire_found') || 'Tel seçimi yapılamadı.')}</td></tr></tbody></table></div>`;

        data.forEach((wire, index) => {
            let cmaColor = wire.cma < 200 ? "#ef5350" : (wire.cma > 500 ? "#ffb74d" : "#81c784");
            const safeStandard = sanitizeHTML(wire.standard);

            let safeCoating = sanitizeHTML(wire.coating);
            if (wire.coating.includes("Foil") || wire.coating.includes("Folyo")) {
                safeCoating = `<span style="color:#ffb74d; font-weight:bold;">${safeCoating}</span>`;
            } else if (wire.coating.includes("Litz")) {
                safeCoating = `<span style="color:#00AEEF; font-weight:bold;">${safeCoating}</span>`;
            }

            t += `<tr ${index === 0 ? "class='row-best-opt'" : ""}>
                <td><strong>${safeStandard}</strong></td>
                <td>${sanitizeHTML(wire.d_mm)}</td>
                <td>${wire.strands > 1
                    ? `<span style="color:#00AEEF;font-weight:bold;">${sanitizeHTML(wire.strands)} ${sanitizeHTML(safeGetT('adv_parallel_strands') || 'Paralel')}</span>`
                    : sanitizeHTML(safeGetT('adv_single_wire') || 'Tek Tel')}</td>
                <td>${sanitizeHTML(wire.totalArea)}</td>
                <td style="color:${cmaColor};font-weight:bold;">${sanitizeHTML(wire.cma)}</td>
                <td>${safeCoating}</td>
            </tr>`;
        });
        return t + `</tbody></table></div>`;
    };

    const genSwitchTable = (title, data) => {
        let t = `
            <div class="d-flex justify-content-between align-items-center mb-2 mt-3">
                <h4 class="section-title" style="color: #00AEEF; border-bottom-color: #00AEEF; margin:0;">${sanitizeHTML(title)}</h4>
                <button class="btn btn-sm btn-outline-info fw-bold" onclick="window.runMonteCarloSwitch(0)">${sanitizeHTML(safeGetT('adv_monte_carlo_switch') || 'Monte Carlo Analizi (1#)')}</button>
            </div>
            <div class="table-responsive"><table class="adv-table">
            <thead><tr style="background-color: #004d40;">
                <th>${sanitizeHTML(safeGetT('adv_tbl_rank') || 'Sıra')}</th><th>${sanitizeHTML(safeGetT('adv_tbl_semi_name') || 'Model')}</th>
                <th>${sanitizeHTML(safeGetT('adv_tbl_semi_type') || 'Teknoloji')}</th><th>${sanitizeHTML(safeGetT('adv_tbl_semi_v_i') || 'V/I Rating')}</th>
                <th>${sanitizeHTML(safeGetT('adv_tbl_semi_pcond') || 'İletim Kaybı (W)')}</th>
                <th>${sanitizeHTML(safeGetT('adv_tbl_semi_psw') || 'Anahtarlama Kaybı (W)')}</th>
                <th>${sanitizeHTML(safeGetT('adv_tbl_semi_ptot') || 'Tahmini Toplam Kayıp (W)')}</th>
                <th>Datasheet</th>
            </tr></thead><tbody>`;

        if (!data || data.length === 0)
            return t + `<tr><td colspan="8" style="color:#ef5350;padding:15px;">Bu voltaj seviyesi için uygun anahtarlama elemanı bulunamadı.</td></tr></tbody></table></div>`;

        data.forEach((item, index) => {
            let techColor = item.type.includes("GaN") ? "#b388ff" : (item.type.includes("SiC") ? "#8c9eff" : "#ffcc80");
            const formattedPCond = item.p_cond_W < 0.01 ? "< 0.01 W" : `${item.p_cond_W.toFixed(2)} W`;
            const formattedPSw = item.p_sw_W < 0.01 ? "< 0.01 W" : `${item.p_sw_W.toFixed(2)} W`;
            const formattedPTot = item.p_tot_W < 0.01 ? "< 0.01 W" : `${item.p_tot_W.toFixed(2)} W`;

            const safeName = sanitizeHTML(item.name);
            const safeMfg = sanitizeHTML(item.manufacturer);
            const safeHousing = sanitizeHTML(item.housing);
            const safeType = sanitizeHTML(item.type);
            const safeLink = sanitizeURL(item.link);

            t += `<tr ${index === 0 ? "class='row-best-opt' style='border-left: 4px solid #00AEEF; background-color: rgba(0, 174, 239, 0.1);'" : ""}>
                <td><strong>#${index + 1}</strong></td>
                <td style="text-align:left; color:#e0e0e0; font-weight:bold;">${safeName} <br><span style="font-size:10px;color:#888;">(${safeMfg} - ${safeHousing})</span></td>
                <td style="color:${techColor}; font-weight:bold;">${safeType}</td>
                <td>${sanitizeHTML(item.v_max)}V / ${sanitizeHTML(item.i_max)}A</td>
                <td style="color:#ffd54f;">${sanitizeHTML(formattedPCond)}</td>
                <td style="color:#4fc3f7;">${sanitizeHTML(formattedPSw)}</td>
                <td style="color:#81c784; font-size:14px;"><b>${sanitizeHTML(formattedPTot)}</b></td>
                <td><a href="${safeLink}" target="_blank" class="btn btn-sm btn-outline-info" style="padding:2px 5px; font-size:11px;">PDF</a></td>
            </tr>`;
        });
        return t + `</tbody></table></div>`;
    };

    const pageTitle = (document.title || "").toLowerCase();

    if (states.isDualCoil) {
        html += genCoreTable(safeGetT('adv_title_l1_cores') || 'L1 (Giriş) Bobini Nüveleri', res.coil1Cores || []);
        html += genWireTable(safeGetT('adv_title_l1_wires') || 'L1 Bobin Telleri', res.coil1Wires || []);
        html += genCoreTable(safeGetT('adv_title_l2_cores') || 'L2 (Çıkış) Bobini Nüveleri', res.coil2Cores || []);
        html += genWireTable(safeGetT('adv_title_l2_wires') || 'L2 Bobin Telleri', res.coil2Wires || []);
    } else {
        if (states.hasVeOpt) {
            html += genCoreTable(safeGetT('adv_title_trafo_cores') || 'Trafo Nüveleri', res.trafoCores || []);
            html += genWireTable(safeGetT('adv_title_pri_wires') || 'Primer Telleri', res.priWires || []);
            html += genWireTable(safeGetT('adv_title_sec_wires') || 'Sekonder Telleri', res.secWires || []);
        }

        if (states.hasWmax) {
            if (states.isFlyback) {
                html += genCoreTable(safeGetT('adv_title_flyback_cores') || 'Flyback Trafo Nüveleri', res.coilCores || []);
                html += genWireTable(safeGetT('adv_title_flyback_pri_wires') || 'Primer Telleri', res.priWires || []);
                html += genWireTable(safeGetT('adv_title_flyback_sec_wires') || 'Sekonder Telleri', res.secWires || []);

                if (states.hasBias && res.biasWires && res.biasWires.length > 0) {
                    html += genWireTable(safeGetT('adv_title_flyback_bias_wires') || 'Bias (Aux) Sargı Telleri', res.biasWires);

                    if (res.coilCores && res.coilCores.length > 0) {
                        const bestN1 = res.coilCores[0].n1_calc;
                        const nOutput = parseFloat(document.getElementById('nOutput')?.innerText) || 1;
                        const vout = parseFloat(document.getElementById('vout')?.value) || parseFloat(document.getElementById('vout_nom')?.value) || 12;
                        const N3 = Math.max(1, Math.round(bestN1 * (states.v_bias + 0.7) / ((vout + 0.7) * nOutput)));

                        html += `
                        <div style="background: rgba(63,81,181,0.1); border-left: 4px solid #3f51b5; padding: 12px; margin-bottom: 25px; border-radius: 4px;">
                            <h4 style="margin: 0 0 8px 0; color: #7986cb;">${sanitizeHTML(safeGetT('adv_bias_info_title') || 'Bias (Aux) Sargı Referansı')}</h4>
                            <p style="margin: 0; font-size: 13px; color: var(--text-main);">
                                ${sanitizeHTML(safeGetT('adv_bias_info_desc') || 'En ideal nüve tercihine (#1) göre hesaplanan Bias sarım sayısı')} 
                                (<b>N3</b>) : <b style="color: var(--color-yellow); font-size: 15px;">${sanitizeHTML(N3)} ${sanitizeHTML(safeGetT('adv_bias_info_unit') || 'Tur')}</b>
                            </p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: var(--text-muted);">
                                * V_bias = ${sanitizeHTML(states.v_bias)}V | I_bias = ${sanitizeHTML(states.i_bias)}
                            </p>
                        </div>`;
                    }
                }
            } else if (pageTitle.includes('llc') || pageTitle.includes('dab')) {
                html += `<div style="background: rgba(255, 183, 77, 0.1); border-left: 3px solid #ffb74d; padding: 10px; margin-top: 15px; border-radius: 4px;">
                    <p style="font-size: 12px; color: #ffb74d; margin: 0;"><b>${sanitizeHTML(safeGetT('alt_bobin') || 'Alternatif Harici Bobin:')} </b> <i>${sanitizeHTML(safeGetT('rez_bobin') || 'LLC/DAB topolojilerinde kaçak endüktansı trafoya entegre etmek yerine harici bir rezonans/seri bobin kullanmayı tercih ederseniz aşağıdaki önerileri değerlendirebilirsiniz.')}</i></p>
                </div><br>`;
                html += genCoreTable(safeGetT('adv_title_resonant_inductor_cores') || 'Rezonans Bobini (L_r) İçin Nüve Önerileri', res.coilCores || []);
                html += genWireTable(safeGetT('adv_title_resonant_inductor_wires') || 'Rezonans Bobini Tel Önerileri', res.coilWires || []);
            } else if (states.isCoilOnly) {
                html += genCoreTable(safeGetT('adv_title_inductor_cores') || 'Bobin Nüveleri', res.coilCores || []);
                html += genWireTable(safeGetT('adv_title_inductor_wires') || 'Bobin Telleri', res.coilWires || []);
            } else {
                html += genCoreTable(safeGetT('adv_title_filter_inductor_cores') || 'Çıkış Filtre Bobini Nüveleri', res.coilCores || []);
                html += genWireTable(safeGetT('adv_title_filter_inductor_wires') || 'Bobin Telleri', res.coilWires || []);
            }
        }
    }

    if (states.calculateSwitches !== false) {
        html += genSwitchTable(safeGetT('adv_title_switches') || "Yarı İletken Anahtarlama Elemanı", res.switches || []);
    }

    if (states.isLinear && window.lastTrafoResults) {
        const trRes = window.lastTrafoResults;
        const La = trRes.La !== undefined ? trRes.La.toFixed(3) : '-';
        const Lb = trRes.Lb !== undefined ? trRes.Lb.toFixed(3) : '-';
        const Lc = trRes.Lc !== undefined ? trRes.Lc.toFixed(3) : '-';
        const zrMag = trRes.Z_R ? Math.sqrt(trRes.Z_R.r ** 2 + trRes.Z_R.i ** 2).toFixed(3) : '-';
        const kVal = trRes.k !== undefined ? trRes.k.toFixed(4) : '-';

        html += `
        <div class="adv-box" style="border: 1px solid #3f51b5; margin-top: 10px; background: rgba(63,81,181,0.07);">
            <h4 style="color:#7986cb;">${sanitizeHTML(safeGetT('adv_label_t_equivalent_summary') || 'T-Eşdeğer Devre Özeti (Trafo)')}</h4>
            <table class="adv-table">
                <tr>
                    <th>L_a = L₁ − M</th>
                    <th>L_b = L₂ − M</th>
                    <th>L_c = M</th>
                </tr>
                <tr>
                    <td>${sanitizeHTML(La)} mH</td>
                    <td>${sanitizeHTML(Lb)} mH</td>
                    <td>${sanitizeHTML(Lc)} mH</td>
                </tr>
            </table>
            <p style="font-size:12px; color:var(--text-muted); margin-top:8px;">
                ${sanitizeHTML(safeGetT('adv_label_coupling_coefficient') || 'Bağlaşım Katsayısı (k)')} = <b>${sanitizeHTML(kVal)}</b> &nbsp;|&nbsp;
                ${sanitizeHTML(safeGetT('adv_label_reflected_impedance') || 'Yansıyan Empedans |Z_R|')} = <b>${sanitizeHTML(zrMag)} Ω</b>
            </p>
        </div>`;
    }

    const currentFreqKhz = parseFloat(document.getElementById('f_khz')?.value) || parseFloat(document.getElementById('p_fsw')?.value) || 100;
    const isLLC = pageTitle.includes('llc') || pageTitle.includes('resonance') || pageTitle.includes('rezonans');
    const isDAB = pageTitle.includes('dab') || pageTitle.includes('dual active');
    const isIsolated = states.hasVeOpt || states.isFlyback;
    const isHardSwitchedIsolated = isIsolated && !isLLC && !isDAB && !states.isLinear;

    if (isHardSwitchedIsolated && !states.isDualCoil) {
        let L_primary_uH = 0;
        let I_peak = parseFloat(document.getElementById('ipeak')?.innerText) ||
            parseFloat(document.getElementById('Ipeak')?.innerText) ||
            parseFloat(document.getElementById('deltaILMax')?.innerText) || 0;
        let bestCore = null;

        if (I_peak <= 0) {
            const ioutEl = document.getElementById('ilout') || document.getElementById('iout') || document.getElementById('iout_dab') || document.getElementById('Iout');
            const P_out = (parseFloat(document.getElementById('vout')?.value) || 24) * (parseFloat(ioutEl?.value) || 1);
            const V_in = parseFloat(document.getElementById('vin_nom')?.value) || 24;
            I_peak = (P_out / V_in) * 1.5;
        }

        if (states.isFlyback) {
            L_primary_uH = parseFloat(document.getElementById('lOutput')?.innerText) || 0;
        } else if (res.trafoCores && res.trafoCores.length > 0) {
            bestCore = res.trafoCores[0];
            if (bestCore.al_nH && bestCore.Ae_mm2) {
                let n1_est = bestCore.n1_calc || 1;
                L_primary_uH = Math.pow(n1_est, 2) * bestCore.al_nH * 1e-3;
            }
        }

        const L_leak_est = estimateLeakageInductance(L_primary_uH);
        const E_leak = 0.5 * (L_leak_est * 1e-6) * Math.pow(I_peak, 2);

        if (L_primary_uH > 0) {
            const V_in_val = parseFloat(document.getElementById('vin_nom')?.value) || 24;

            let V_clamp = V_in_val * 2.5;
            if (V_clamp < 40) V_clamp = 40;

            const snubNOutputEl = document.getElementById('nOutput');
            const snubNOutput = (snubNOutputEl && !isNaN(parseFloat(snubNOutputEl.innerText))) ? parseFloat(snubNOutputEl.innerText) : 0;
            const snubVout = parseFloat((document.getElementById('vout') || document.getElementById('vout_nom'))?.value) || 0;
            const V_ref = snubNOutput * snubVout;

            const V_margin = Math.max(V_clamp - V_ref, V_clamp * 0.1);
            const R_snub_est = E_leak > 0 ? Math.round((V_clamp * V_margin) / (E_leak * (currentFreqKhz * 1000))) : 0;

            html += `
            <div class="adv-box" style="border: 1px solid var(--color-orange); margin-top: 10px; background: rgba(255, 165, 0, 0.05);">
                <h4 style="color:var(--color-orange); border-bottom: 1px solid var(--color-orange); padding-bottom: 5px; margin-top: 0;">${sanitizeHTML(safeGetT('adv_leakage_title') || '⚠️ Kaçak Endüktans ve Güvenlik Analizi')}</h4>
                <p style="font-size:13px; margin: 5px 0;">${sanitizeHTML(safeGetT('adv_leakage_est') || 'Tahmini Kaçak Endüktans (L_leak):')} <b style="color:var(--text-main);">${L_leak_est.toFixed(2)} µH</b> <span style="opacity:0.7;">${sanitizeHTML(safeGetT('adv_leakage_base') || "(Primerin %2.5'i baz alınmıştır)")}</span></p>
                <p style="font-size:13px; margin: 5px 0;">${sanitizeHTML(safeGetT('adv_leakage_energy') || 'Her anahtarlamada sönümlenmesi gereken enerji:')} <b style="color:#ef5350;">${(E_leak * 1000).toFixed(3)} mJ</b></p>
                <div class="table-responsive" style="margin-top:10px;">
                    <table class="adv-table" style="margin-bottom:0;">
                        <thead>
                            <tr>
                                <th style="background-color: var(--surface-dark); color: var(--color-yellow); border-color: var(--border-color);">${sanitizeHTML(safeGetT('adv_snubber_suggested') || 'Önerilen Sönümleme Ağı')}</th>
                                <th style="background-color: var(--surface-dark); color: var(--color-yellow); border-color: var(--border-color);">${sanitizeHTML(safeGetT('adv_snubber_critical') || 'Kritik Bileşen Değeri')}</th>
                                <th style="background-color: var(--surface-dark); color: var(--color-yellow); border-color: var(--border-color);">${sanitizeHTML(safeGetT('adv_snubber_winding') || 'Tavsiye Edilen Sarım')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border-color: var(--border-color);">RCD Snubber / Active Clamp</td>
                                <td style="border-color: var(--border-color); color:var(--color-green); font-weight:bold;">
                                    R_snub ≈ ${R_snub_est} Ω<br>
                                    <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">(V_clamp ≈ ${Math.round(V_clamp)}V)</span>
                                </td>
                                <td style="border-color: var(--border-color); color:#00AEEF;">Sandwich (P-S-P)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p style="font-size:11px; color:var(--text-muted); margin-top:5px; margin-bottom:0;">${sanitizeHTML(safeGetT('adv_snubber_note') || '* Sandwich sarım kullanarak kaçak endüktansı %50 azaltabilir ve anahtarlama kayıplarını minimuma indirebilirsiniz.')}</p>
            </div>`;
        }
    } else if (isLLC || isDAB) {
        let bestCore = res.trafoCores && res.trafoCores.length > 0 ? res.trafoCores[0] : null;
        let L_primary_uH = 0;
        if (bestCore && bestCore.al_nH && bestCore.n1_calc) {
            L_primary_uH = Math.pow(bestCore.n1_calc, 2) * bestCore.al_nH * 1e-3;
        }
        const L_leak_est = estimateLeakageInductance(L_primary_uH);
        const L_required_uH = parseFloat(document.getElementById('lOutput')?.innerText) || parseFloat(document.getElementById('Lr')?.innerText) || 0;
        const al_val = bestCore?.al_nH?.toFixed(0) || '?';
        const advice_str = sanitizeHTML((safeGetT('adv_leakage_winding_advice') || "").replace('{0}', L_required_uH.toFixed(2)));

        html += `
        <div class="adv-box" style="border: 1px solid var(--color-green); margin-top: 10px; background: rgba(129, 199, 132, 0.05);">
            <h4 style="color:var(--color-green); border-bottom: 1px solid var(--color-green); padding-bottom: 5px; margin-top: 0;">${sanitizeHTML(safeGetT('adv_leakage_util_title') || 'Kaçak Endüktans Kullanımı')}</h4>
            <p style="font-size:13px; margin:5px 0;">${sanitizeHTML(safeGetT('adv_leakage_req_l') || 'Gereken Lr:')} <b style="color:var(--text-main);">${L_required_uH.toFixed(2)} µH</b></p>
            <p style="font-size:13px; margin:5px 0;">${sanitizeHTML(safeGetT('adv_leakage_est_natural') || 'Tahmini Kaçak (L_leak):')} <b style="color:#00AEEF;">${L_leak_est.toFixed(2)} µH</b> <span style="opacity:0.7;">(AL=${sanitizeHTML(al_val)})</span></p>
            <p style="font-size:12px; color:var(--text-muted); margin-top:10px;">${sanitizeHTML(safeGetT('adv_leakage_useful_desc') || 'Rezonans topolojilerinde kaçak endüktans faydalı olarak kullanılabilir.')}</p>
            <p style="font-size:12px; color:var(--color-yellow); margin-top:5px; margin-bottom:0;">${advice_str}</p>
        </div>`;
    }

    if (currentFreqKhz >= 150) {
        const hfDesc = sanitizeHTML((safeGetT('adv_hf_warning_desc') || "Devreniz {0} kHz frekansında çalışıyor. Cilt etkisi (Skin effect) ve yakınlık etkisi (Proximity effect) kayıplarını azaltmak için Litz teli kullanmanız zorunludur.").replace('{0}', currentFreqKhz));
        html += `
        <div class="adv-box" style="border: 1px dashed var(--color-orange); margin-top: 10px; background: rgba(255, 183, 77, 0.05);">
            <p style="color:var(--color-orange); font-size:12px; margin:0;">
                <b>${sanitizeHTML(safeGetT('adv_hf_warning_title') || 'Yüksek Frekans Uyarısı:')}</b> ${hfDesc}
            </p>
        </div>`;
    }

    window.lastThermalStates = states;

    const isInductorPage = pageTitle.includes('inductor') || pageTitle.includes('indüktör');

    if (!isInductorPage && !states.isLinear && states.P_out && states.P_loss !== undefined) {
        let noteText = "";
        if (states.isEstimatedLoss) {
            noteText = sanitizeHTML((safeGetT('adv_thermal_note_est') || "")
                .replace('{0}', (states.eff * 100).toFixed(1))
                .replace('{1}', states.R_th.toFixed(1)));
        } else {
            noteText = sanitizeHTML((safeGetT('adv_thermal_note_real') || "")
                .replace('{0}', states.bestSwitchLoss.toFixed(2))
                .replace('{1}', states.bestCoreLoss.toFixed(2))
                .replace('{2}', states.bestCopperLoss.toFixed(2))
                .replace('{3}', states.R_th.toFixed(1)));
        }

        html += `
        <div class="adv-box" style="border: 1px solid #e53935; margin-top: 15px; background: rgba(229, 57, 53, 0.05);">
            <h4 style="color:#e53935; margin-bottom: 10px;">${sanitizeHTML(safeGetT('adv_thermal_title') || 'Termal Analiz ve Isı Üretimi Tahmini')}</h4>
            <div style="display:flex; flex-wrap:wrap; gap:15px;">
                <div style="flex:1; min-width:150px; padding:12px; background:#272727; border-radius:6px; border:1px solid var(--border-color); text-align:center;">
                    <span style="font-size:11px; color:var(--text-muted);">${sanitizeHTML(safeGetT('adv_thermal_pout') || 'Çıkış Gücü (P_out)')}</span><br>
                    <b style="color:var(--text-main); font-size:18px;">${states.P_out.toFixed(2)} W</b>
                </div>
                <div style="flex:1; min-width:150px; padding:12px; background:#272727; border-radius:6px; border:1px solid var(--border-color); text-align:center;">
                    <span style="font-size:11px; color:var(--text-muted);">${sanitizeHTML(safeGetT('adv_thermal_ploss') || 'Isıl Kayıp (P_loss)')}</span><br>
                    <b style="color:#ffb74d; font-size:18px;">${states.P_loss.toFixed(2)} W</b>
                </div>
                <div style="flex:1; min-width:150px; padding:12px; background:#272727; border-radius:6px; border:1px solid var(--border-color); text-align:center;">
                    <span style="font-size:11px; color:var(--text-muted);">${sanitizeHTML(safeGetT('adv_thermal_deltat') || 'Sıcaklık Artışı (ΔT)')}</span><br>
                    <b style="color:#ef5350; font-size:18px;">+${states.Delta_T.toFixed(1)} °C</b>
                </div>
            </div>
            <p style="font-size:11px; color:var(--text-muted); margin-top:10px; margin-bottom:0;">
                ${noteText}
            </p>
            
            <div class="mt-3 text-center">
                <button class="btn btn-sm btn-outline-danger fw-bold" onclick="window.openCustomThermalModal()">${sanitizeHTML(safeGetT('adv_btn_custom_thermal') || 'Gerçek Seçime Göre Termal Analiz')}</button>
            </div>

        </div>`;

        const getPhysicalVol = (core) => {
            if (!core) return 0;
            let A = core.dim_A || 42;
            let B = core.dim_B || 21;
            let C = core.dim_C || 15;
            let D = core.dim_D || 11;
            let E = core.dim_E || 29;

            if (A < 1 && A > 0) { A *= 1000; B *= 1000; C *= 1000; D *= 1000; E *= 1000; }

            const family = core.family || "E";

            const innerRadius = (D / 2) + 0.5;
            const maxCoilRadius = (E / 2) - 0.5;
            const availableRadialSpace = Math.max(0.3, maxCoilRadius - innerRadius);
            const flangeOuter = innerRadius + availableRadialSpace + 0.5;
            const coilDiameter = flangeOuter * 2;

            let sizeX = A;
            let sizeY = B * 2;
            let sizeZ = (family === "RM" || family === "PQ" || family === "PM") ? A : C;

            if (coilDiameter > sizeX) sizeX = coilDiameter;
            if (coilDiameter > sizeZ) sizeZ = coilDiameter;

            return (sizeX * sizeY * sizeZ) / 1000;
        };

        let volSelectsHtml = '';
        let initialTotalVol = 0;

        const createVolSelect = (id, label, cores) => {
            if (!cores || cores.length === 0) return '';
            const seen = new Set();
            let opts = '';
            cores.forEach((c) => {
                const coreName = (c.name || '').trim();
                if (!seen.has(coreName)) {
                    seen.add(coreName);
                    const vol = getPhysicalVol(c);
                    opts += `<option value="${vol}">${coreName} (${vol.toFixed(2)} cm³)</option>`;
                }
            });
            initialTotalVol += getPhysicalVol(cores[0]);
            return `
            <div style="margin-bottom: 5px; text-align: left;">
                <label style="font-size:10px; color:var(--text-muted); display:block; margin-bottom:2px;">${label}</label>
                <select class="form-select form-select-sm bg-dark text-light border-secondary pd-vol-select" style="font-size:12px; padding:2px 5px;" onchange="window.updatePowerDensity()">
                    ${opts}
                </select>
            </div>`;
        };

        if (states.isDualCoil) {
            volSelectsHtml += createVolSelect('selVolL1', safeGetT('adv_pd_sel_l1') || 'L1 Nüvesi', res.coil1Cores);
            volSelectsHtml += createVolSelect('selVolL2', safeGetT('adv_pd_sel_l2') || 'L2 Nüvesi', res.coil2Cores);
        } else {
            if (states.hasVeOpt && res.trafoCores && res.trafoCores.length > 0) {
                volSelectsHtml += createVolSelect('selVolTrafo', safeGetT('adv_pd_sel_trafo') || 'Trafo Nüvesi', res.trafoCores);
            }

            if (states.hasWmax && res.coilCores && res.coilCores.length > 0) {
                const pageTitle = (document.title || "").toLowerCase();
                const isLLCorDAB = pageTitle.includes('llc') || pageTitle.includes('dab');

                const hasExternalCoil = res.coilCores && res.coilCores.length > 0;

                if (!isLLCorDAB || states.isCoilOnly || hasExternalCoil) {
                    volSelectsHtml += createVolSelect(
                        'selVolCoil',
                        states.isFlyback ? (safeGetT('adv_pd_sel_flyback') || 'Flyback Nüvesi')
                            : (safeGetT('adv_pd_sel_coil') || 'Harici Bobin Nüvesi'),
                        res.coilCores
                    );
                }
            }
        }

        window._currentPoutForDensity = states.P_out;

        if (volSelectsHtml !== '' && states.P_out > 0) {
            const corePowerDensity = states.P_out / initialTotalVol; // W/cm³

            // When heatsinks, PCBs, capacitors, etc. are included in SMPS designs,
            // the total system volume is typically between ~3.5 and 5 times the external volume of the magnetic components.
            const estSystemVol_cm3 = initialTotalVol * 3.5;
            const sysPowerDensity = states.P_out / estSystemVol_cm3; // W/cm³

            html += `
        <div class="adv-box" style="border: 1px solid #00AEEF; margin-top: 15px; background: rgba(0, 174, 239, 0.05);">
            <h4 style="color:#00AEEF; margin-bottom: 10px;">${sanitizeHTML(safeGetT('adv_pd_title') || 'Güç Yoğunluğu (Power Density) Analizi')}</h4>
            <div style="display:flex; flex-wrap:wrap; gap:15px;">
                <div style="flex:1; min-width:180px; padding:12px; background:#272727; border-radius:6px; border:1px solid var(--border-color); text-align:center;">
                    <span style="font-size:11px; color:var(--text-muted);">${sanitizeHTML(safeGetT('adv_pd_total_vol') || 'Toplam Fiziksel Hacim (V_core)')}</span><br>
                    <div style="margin-top: 8px;">
                        ${volSelectsHtml}
                    </div>
                    <div style="margin-top: 10px; border-top: 1px dashed #444; padding-top: 8px;">
                        <span style="font-size:10px; color:var(--text-muted);">${sanitizeHTML(safeGetT('adv_pd_total') || 'Toplam:')} </span>
                        <b id="pdTotalVolDisp" style="color:var(--text-main); font-size:16px;">${initialTotalVol.toFixed(2)} cm³</b>
                    </div>
                </div>
                <div style="flex:1; min-width:150px; padding:12px; background:#272727; border-radius:6px; border:1px solid var(--border-color); text-align:center; display:flex; flex-direction:column; justify-content:center;">
                    <span style="font-size:11px; color:var(--text-muted);">${sanitizeHTML(safeGetT('adv_pd_core_density') || 'Manyetik Bileşen Güç Yoğunluğu')}</span><br>
                    <b id="pdCoreDensityDisp" style="color:#81c784; font-size:18px;">${corePowerDensity.toFixed(1)} W/cm³</b>
                </div>
                <div style="flex:1; min-width:150px; padding:12px; background:#272727; border-radius:6px; border:1px solid var(--border-color); text-align:center; display:flex; flex-direction:column; justify-content:center;">
                    <span style="font-size:11px; color:var(--text-muted);">${sanitizeHTML(safeGetT('adv_pd_sys_density') || 'Tahmini Sistem Güç Yoğunluğu')}</span><br>
                    <b id="pdSysDensityDisp" style="color:#ffb74d; font-size:18px;">${sysPowerDensity.toFixed(1)} W/cm³</b>
                </div>
            </div>
            <p style="font-size:11px; color:var(--text-muted); margin-top:10px; margin-bottom:0;">
                ${safeGetT('adv_pd_note') || '* Tahmini sistem güç yoğunluğu, genel SMPS karakteristikleri baz alınarak manyetik bileşenlerin dış hacminin ~3.5 katı (PCB, soğutucu, vb. dahil) varsayılarak hesaplanmıştır.'}
            </p>
        </div>`;
        }
    }

    document.getElementById("advancedResults").insertAdjacentHTML("beforeend", html);
    document.getElementById("exportBtn").style.display = "inline-block";
}

window.updatePowerDensity = function () {
    const selects = document.querySelectorAll('.pd-vol-select');
    let totalVol = 0;
    selects.forEach(sel => {
        totalVol += parseFloat(sel.value) || 0;
    });

    const pout = window._currentPoutForDensity || 0;
    if (totalVol > 0 && pout > 0) {
        const coreDensity = pout / totalVol;
        const sysDensity = pout / (totalVol * 3.5);

        const volDisp = document.getElementById('pdTotalVolDisp');
        const coreDisp = document.getElementById('pdCoreDensityDisp');
        const sysDisp = document.getElementById('pdSysDensityDisp');

        if (volDisp) volDisp.innerText = totalVol.toFixed(2) + " cm³";
        if (coreDisp) coreDisp.innerText = coreDensity.toFixed(1) + " W/cm³";
        if (sysDisp) sysDisp.innerText = sysDensity.toFixed(1) + " W/cm³";
    }
};

window.exportAdvancedResultsToCSV = function () {
    if ((!lastOptimizationResults.trafoCores || lastOptimizationResults.trafoCores.length === 0) &&
        (!lastOptimizationResults.coilCores || lastOptimizationResults.coilCores.length === 0) &&
        (!lastOptimizationResults.coil1Cores || lastOptimizationResults.coil1Cores.length === 0)) {
        return alert(safeGetT('adv_alert_no_data_export') || 'Dışa aktarılacak veri bulunamadı.');
    }

    const csvEscape = (val) => {
        if (val === null || val === undefined) return '""';
        let str = String(val).replace(/"/g, '""');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) str = `"${str}"`;
        return str;
    };

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";

    const addCoreToCSV = (title, data) => {
        if (!data || data.length === 0) return;
        csvContent += `\n--- ${title} ---\n`;
        csvContent += "ID,Core_Name,Material,Bobbin,Bmax_mT,Pv(mW/cm3),Core_Loss(W),Manufacturer,Single_Piece_Price,Total_Set_Price,Fuzzy_Score\n";
        data.forEach((row, index) => {
            const isNoCost = (!row.totalCost || row.totalCost === 999 || row.costPerUnit === 999);
            const singlePriceStr = isNoCost ? "no-cost" : row.costPerUnit.toFixed(2);
            const totCostStr = isNoCost ? "no-cost" : row.totalCost.toFixed(2);

            csvContent += `${index + 1},${csvEscape(row.name)},${csvEscape(row.material)},` +
                `${csvEscape(row.bobbinName)},${row.bmax},${row.pv.toFixed(0)},${row.coreLossW.toFixed(2)},` +
                `${csvEscape(row.distributor)},${singlePriceStr},${totCostStr},${row.fuzzyScore.toFixed(2)}\n`;
        });
    };

    const addSwitchToCSV = (title, data) => {
        if (!data || data.length === 0) return;
        csvContent += `\n--- ${title} ---\n`;
        csvContent += "ID,Model,Technology,V/I_Rating,Conduction_Loss(W),Switching_Loss(W),Total_Loss(W),Manufacturer\n";
        data.forEach((row, index) => {
            csvContent += `${index + 1},${csvEscape(row.name)},${csvEscape(row.type)},${row.v_max}V/${row.i_max}A,${row.p_cond_W.toFixed(2)},${row.p_sw_W.toFixed(2)},${row.p_tot_W.toFixed(2)},${csvEscape(row.manufacturer)}\n`;
        });
    };

    addCoreToCSV("TRANSFORMER CORE", lastOptimizationResults.trafoCores);
    addCoreToCSV("BOBBIN CORE", lastOptimizationResults.coilCores);
    addCoreToCSV("L1 BOBIN CORE", lastOptimizationResults.coil1Cores);
    addCoreToCSV("L2 BOBIN CORE", lastOptimizationResults.coil2Cores);
    addSwitchToCSV("SWITCHING DEVICES (TRANSISTORS)", lastOptimizationResults.switches);

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "SMPS_BOM_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.populateManufacturerDropdown = function () {
    const selectEl = document.getElementById("manufacturerFilter");
    if (!selectEl) return;

    const manufacturers = new Set();
    const addMfg = (cores) => {
        if (!cores) return;
        cores.forEach(c => {
            if (c.mfgName && c.mfgName !== "Bilinmiyor") {
                manufacturers.add(c.mfgName);
            }
        });
    };

    addMfg(lastOptimizationResults.trafoCores);
    addMfg(lastOptimizationResults.coilCores);
    addMfg(lastOptimizationResults.coil1Cores);
    addMfg(lastOptimizationResults.coil2Cores);

    if (lastOptimizationResults.switches) {
        lastOptimizationResults.switches.forEach(sw => {
            if (sw.manufacturer && sw.manufacturer !== "Bilinmiyor") {
                manufacturers.add(sw.manufacturer);
            }
        });
    }

    const currentVal = selectEl.value;
    selectEl.innerHTML = `<option value="all">${sanitizeHTML(safeGetT('adv_manufacturer_all') || 'Tümü')}</option>`;

    Array.from(manufacturers).sort().forEach(mfg => {
        if (mfg.trim() === "") return;
        const option = document.createElement("option");
        option.value = mfg.toLowerCase();
        option.text = mfg;
        selectEl.appendChild(option);
    });

    if (Array.from(selectEl.options).some(opt => opt.value === currentVal)) {
        selectEl.value = currentVal;
    } else {
        selectEl.value = "all";
    }
};

window.openCustomThermalModal = function () {
    const states = window.lastThermalStates;
    const res = lastOptimizationResults;

    if (!states || !res) return alert("Lütfen önce yapay zeka analizini çalıştırın.");

    let coreHtml = '';

    const createSelect = (id, label, cores) => {
        if (!cores || cores.length === 0) return '';

        const seen = new Set();
        let opts = '';

        cores.forEach((c, i) => {
            const coreName = (c.name || '').trim().toLowerCase();
            if (!seen.has(coreName)) {
                seen.add(coreName);
                opts += `<option value="${i}">${c.name} (${c.material}) - Pv: ${c.pv.toFixed(0)} mW/cm³ - Pcore: ${c.coreLossW.toFixed(2)}W</option>`;
            }
        });

        return `
            <div class="mb-2">
                <label class="form-label fw-bold" style="font-size:12px; color:var(--color-yellow);">${label}</label>
                <select id="${id}" class="form-select form-select-sm bg-dark text-light border-secondary">
                    ${opts}
                </select>
            </div>
        `;
    };

    if (states.isDualCoil) {
        coreHtml += createSelect('selCoreL1', safeGetT('adv_thermal_select_core_l1') || 'L1 Nüvesi', res.coil1Cores);
        coreHtml += createSelect('selCoreL2', safeGetT('adv_thermal_select_core_l2') || 'L2 Nüvesi', res.coil2Cores);
    } else {
        if (states.hasVeOpt) {
            coreHtml += createSelect('selCoreTrafo', safeGetT('adv_thermal_select_core_trafo') || 'Trafo Nüvesi', res.trafoCores);
        }
        if (states.hasWmax) {
            if (states.isFlyback) {
                coreHtml += createSelect('selCoreFlyback', safeGetT('adv_thermal_select_core_flyback') || 'Flyback Nüvesi', res.coilCores);
            } else if (states.isCoilOnly) {
                coreHtml += createSelect('selCoreCoil', safeGetT('adv_thermal_select_core_coil') || 'Bobin Nüvesi', res.coilCores);
            } else {
                coreHtml += createSelect('selCoreCoil', safeGetT('adv_thermal_select_core_coil') || 'Çıkış Bobini Nüvesi', res.coilCores);
            }
        }
    }

    let switchHtml = '';
    if (states.calculateSwitches !== false && res.switches && res.switches.length > 0) {
        let opts = res.switches.map((s, i) => `<option value="${i}">${s.name} (${s.type}) - P_tot: ${s.p_tot_W.toFixed(2)}W</option>`).join('');

        let defaultQty = 1;
        const pt = (document.title || "").toLowerCase();
        if (pt.includes('interleaved') || pt.includes('push-pull') || pt.includes('half-bridge') || pt.includes('half bridge')) defaultQty = 2;
        else if (pt.includes('full-bridge') || pt.includes('full bridge') || pt.includes('dab')) defaultQty = 4;

        switchHtml = `
            <div class="mb-2">
                <label class="form-label fw-bold" style="font-size:12px; color:var(--color-yellow);">${safeGetT('adv_thermal_select_switch') || 'Anahtarlama Elemanı (MOSFET/Diyot)'}</label>
                <select id="selSwitch" class="form-select form-select-sm bg-dark text-light border-secondary">
                    ${opts}
                </select>
            </div>
            <div class="mb-3">
                <label class="form-label fw-bold" style="font-size:12px; color:var(--color-yellow);">${safeGetT('adv_thermal_switch_qty') || 'Paralel Adet'}</label>
                <!-- value="1" yerine value="${defaultQty}" yazıldı -->
                <input type="number" id="selSwitchQty" class="form-control form-control-sm bg-dark text-light border-secondary" value="${defaultQty}" min="1" max="10">
            </div>
            <div class="mb-3 form-check" title="${sanitizeHTML(safeGetT('adv_thermal_gate_scale_tooltip') || 'İşaretliyse: paralel MOSFET sayısı arttıkça sürücünün de güçlendirildiği varsayılır, anahtarlama kaybı toplamda sabit kalır. İşaretli değilse: sürücü gücü sabit kabul edilir, toplam gate yükü arttığı için anahtarlama kaybı adet ile orantılı büyür (kötümser / güvenli taraf).')}">
                <input type="checkbox" id="selSwitchGateScales" class="form-check-input">
                <label class="form-check-label" for="selSwitchGateScales" style="font-size:12px;">${safeGetT('adv_thermal_gate_scale_label') || 'Sürücü paralel adede göre güçlendirildi (anahtarlama kaybı sabit kalır)'}</label>
            </div>
        `;
    }

    const modalId = 'customThermalModal';
    let existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();

    const html = `
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true" style="z-index: 1060;">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" style="background-color: var(--bg-dark); color: var(--text-main); border: 1px solid #e53935; box-shadow: 0 0 20px rgba(229,57,53,0.3);">
                <div class="modal-header" style="border-bottom: 1px solid #e53935;">
                    <h5 class="modal-title" style="color:#e53935;">${safeGetT('adv_thermal_modal_title') || 'Özel Termal Simülasyon'}</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    ${coreHtml}
                    ${switchHtml}
                    <button class="btn btn-danger w-100 mt-2 fw-bold" onclick="window.runCustomThermalTest()">${safeGetT('adv_thermal_btn_test') || 'Test Et'}</button>
                    
                    <div id="customThermalResult" class="mt-4 p-3 rounded" style="display:none; background-color: rgba(255,255,255,0.05); border: 1px solid #444;">
                        <!-- Results will be injected here -->
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    const m = new bootstrap.Modal(document.getElementById(modalId));
    m.show();
};

window.runCustomThermalTest = function () {
    const states = window.lastThermalStates;
    const res = lastOptimizationResults;
    const currents = window.lastOptimizationCurrents;
    const currentTemp = currents.T_op || 80;
    const rho = 1.68e-8 * (1 + 0.00393 * (currentTemp - 20));

    let totalCoreLoss = 0;
    let totalCopperLoss = 0;
    let switchLoss = 0;

    const getCoreDetails = (selId, coresData, wire1Data, wire2Data, irms1, irms2, isCenterTapped) => {
        const el = document.getElementById(selId);
        if (!el || !coresData || coresData.length === 0) return { coreLoss: 0, cuLoss: 0 };
        const idx = parseInt(el.value);
        const core = coresData[idx];
        let cLoss = core.coreLossW || 0;
        let cuLoss = 0;

        let Ae = core.Ae_mm2 || 100;
        let dimA = core.dim_A || 0;
        let dimD = core.dim_D || 0;
        let dimE = core.dim_E || 0;
        let family = core.family || "E";
        let w_width = 0;

        if (family === "RM" || family === "PQ" || family === "PM") {
            if (dimA > 0 && dimD > 0) w_width = (dimA - dimD) / 3;
            else if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
        } else {
            if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
            else if (dimA > 0 && dimD > 0) w_width = (dimA - 2 * dimD) / 2;
        }

        w_width = Math.max(0, w_width - 1.0);

        const legPerimeter_mm = 4 * Math.sqrt(Ae);
        let MLT_mm = legPerimeter_mm + (Math.PI * w_width);
        if (w_width === 0) MLT_mm = 4.5 * Math.sqrt(Ae);

        let MLT_m = MLT_mm / 1000;
        let n1 = core.n1_calc || core.n1 || 10;
        let n2 = core.n2_calc || Math.max(4, Math.floor(n1 / 2));

        if (wire1Data && wire1Data.length > 0) {
            let A_wire = parseFloat(wire1Data[0].totalArea) || 0.5;
            let dcr = rho * ((n1 * MLT_mm) / 1000) / (A_wire * 1e-6);
            cuLoss += dcr * Math.pow(irms1, 2);
        }
        if (wire2Data && wire2Data.length > 0 && irms2 > 0) {
            let A_wire = parseFloat(wire2Data[0].totalArea) || 0.5;
            let dcr = rho * ((n2 * MLT_mm) / 1000) / (A_wire * 1e-6);
            if (isCenterTapped) {
                cuLoss += 2 * dcr * Math.pow(irms2, 2);
            } else {
                cuLoss += dcr * Math.pow(irms2, 2);
            }
        }
        return { coreLoss: cLoss, cuLoss: cuLoss };
    };

    const ioutVal = states.P_out / (Math.abs(parseFloat((document.getElementById('vout') || document.getElementById('vout_nom'))?.value)) || 12);
    const priIrmsEst = currents.pri_Irms || 1;
    const secIrmsEst = currents.sec_Irms || ioutVal;
    const coilIrmsEst = currents.coilWire_Irms || ioutVal;

    const pageTitle = (document.title || "").toLowerCase();
    const isCenterTapped = pageTitle.includes('llc') && !pageTitle.includes('full');

    if (states.isDualCoil) {
        let d1 = getCoreDetails('selCoreL1', res.coil1Cores, res.coil1Wires, null, currents.l1_rms, 0, false);
        let d2 = getCoreDetails('selCoreL2', res.coil2Cores, res.coil2Wires, null, currents.l2_rms, 0, false);
        totalCoreLoss = d1.coreLoss + d2.coreLoss;
        totalCopperLoss = d1.cuLoss + d2.cuLoss;
    } else {
        if (states.hasVeOpt) {
            let d = getCoreDetails('selCoreTrafo', res.trafoCores, res.priWires, res.secWires, priIrmsEst, secIrmsEst, isCenterTapped);
            totalCoreLoss += d.coreLoss;
            totalCopperLoss += d.cuLoss;
        }
        if (states.hasWmax) {
            if (states.isFlyback) {
                let d = getCoreDetails('selCoreFlyback', res.coilCores, res.priWires, res.secWires, priIrmsEst, secIrmsEst, false);
                totalCoreLoss += d.coreLoss;
                totalCopperLoss += d.cuLoss;
            } else {
                let d = getCoreDetails('selCoreCoil', res.coilCores, res.coilWires || res.priWires, null, coilIrmsEst, 0, false);
                totalCoreLoss += d.coreLoss;
                totalCopperLoss += d.cuLoss;
            }
        }
    }

    const swEl = document.getElementById('selSwitch');
    const qtyEl = document.getElementById('selSwitchQty');
    const gateScalesEl = document.getElementById('selSwitchGateScales');
    let selSwitchName = "-";

    if (swEl && res.switches && res.switches.length > 0) {
        const idx = parseInt(swEl.value);
        const qty = parseInt(qtyEl.value) || 1;
        const sw = res.switches[idx];
        const gateScales = !!gateScalesEl?.checked;
        selSwitchName = `${sw.name} (x${qty})${gateScales ? '' : ' - worst-case Psw'}`;

        switchLoss = (sw.p_cond_W / qty) + (gateScales ? sw.p_sw_W : sw.p_sw_W * qty);
    } else {
        switchLoss = states.bestSwitchLoss;
    }

    if (totalCopperLoss === 0 || isNaN(totalCopperLoss)) {
        let uiCu = 0;
        ['res_pl_dcr', 'res_ptr_dcr', 'res_pl1_dcr', 'res_pl2_dcr'].forEach(id => {
            let el = document.getElementById(id);
            if (el) { let val = parseFloat(el.innerText); if (!isNaN(val)) uiCu += val; }
        });
        if (uiCu > 0) totalCopperLoss = uiCu;
    }

    const P_loss = switchLoss + totalCoreLoss + totalCopperLoss;
    const Delta_T = P_loss * states.R_th;

    const resDiv = document.getElementById('customThermalResult');
    resDiv.style.display = 'block';

    window.lastCustomThermalData = {
        P_out: states.P_out, P_loss: P_loss, Delta_T: Delta_T,
        switchLoss: switchLoss, coreLoss: totalCoreLoss, copperLoss: totalCopperLoss,
        switchName: selSwitchName, rTh: states.R_th
    };

    resDiv.innerHTML = `
        <h6 style="color:var(--color-yellow); border-bottom:1px solid #444; padding-bottom:5px; margin-bottom: 15px;">${safeGetT('adv_thermal_result_title') || 'Custom Thermal Simulation Result'}</h6>
        <div class="d-flex justify-content-between mb-1" style="font-size:13px;"><span>${safeGetT('adv_thermal_ploss') || 'Total Thermal Loss'}:</span> <strong class="text-warning">${P_loss.toFixed(2)} W</strong></div>
        <div class="d-flex justify-content-between mb-1" style="font-size:13px;"><span>${safeGetT('adv_thermal_sw_loss') || 'Switching Loss'}:</span> <strong class="text-light">${switchLoss.toFixed(2)} W</strong></div>
        <div class="d-flex justify-content-between mb-1" style="font-size:13px;"><span>${safeGetT('adv_thermal_core_loss') || 'Core Loss'}:</span> <strong class="text-light">${totalCoreLoss.toFixed(2)} W</strong></div>
        <div class="d-flex justify-content-between mb-1" style="font-size:13px;"><span>${safeGetT('adv_thermal_cu_loss') || 'Copper (Conduction) Loss'}:</span> <strong class="text-light">${totalCopperLoss.toFixed(2)} W</strong></div>
        <hr style="border-color:#555; margin:8px 0;">
        <div class="d-flex justify-content-between align-items-center" style="font-size:15px;">
            <span>${safeGetT('adv_thermal_deltat') || 'Temperature Rise (ΔT)'}:</span> 
            <strong class="text-danger bg-dark px-2 py-1 rounded border border-danger">+${Delta_T.toFixed(1)} °C</strong>
        </div>
        <button class="btn btn-sm btn-outline-success w-100 mt-3 fw-bold" onclick="window.downloadCustomThermalCSV()">${safeGetT('adv_thermal_btn_csv') || 'Download Thermal Report (CSV)'}</button>
        
        <button class="btn btn-sm btn-outline-warning w-100 mt-2 fw-bold" onclick="window.runMonteCarloThermal()">Monte Carlo Analysis</button>
    `;
};

window.downloadCustomThermalCSV = function () {
    const data = window.lastCustomThermalData;
    if (!data) return;

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Parameter,Value,Unit\n";
    csvContent += `Output Power (P_out),${data.P_out.toFixed(2)},W\n`;
    csvContent += `Total Thermal Loss (P_loss),${data.P_loss.toFixed(2)},W\n`;
    csvContent += `Temperature Rise (Delta_T),${data.Delta_T.toFixed(1)},C\n`;
    csvContent += `Thermal Resistance (R_th),${data.rTh.toFixed(2)},C/W\n`;
    csvContent += `Selected Switch,${data.switchName},-\n`;
    csvContent += `Switching Loss,${data.switchLoss.toFixed(2)},W\n`;
    csvContent += `Core Loss,${data.coreLoss.toFixed(2)},W\n`;
    csvContent += `Copper (Conduction) Loss,${data.copperLoss.toFixed(2)},W\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Custom_Thermal_Analysis_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.mcValue = function (baseValue, tolPercent) {
    const tol = tolPercent / 100;
    const min = baseValue * (1 - tol);
    const max = baseValue * (1 + tol);
    return min + Math.random() * (max - min);
};

window.runMonteCarloThermal = function () {
    const data = window.lastCustomThermalData;
    if (!data) return alert(safeGetT('adv_mc_no_data') || "Lütfen önce standart termal testi çalıştırın.");

    const iterations = 1000;
    const tolerance = 10;

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Iteration,Core_Loss(W),Copper_Loss(W),Switch_Loss(W),Total_Loss(W),R_th(C/W),Delta_T(C)\n";

    for (let i = 1; i <= iterations; i++) {
        let cLoss = window.mcValue(data.coreLoss, tolerance);
        let cuLoss = window.mcValue(data.copperLoss, tolerance);
        let swLoss = window.mcValue(data.switchLoss, tolerance);
        let rth = window.mcValue(data.rTh, tolerance);

        let pLoss = cLoss + cuLoss + swLoss;
        let dT = pLoss * rth;

        csvContent += `${i},${cLoss.toFixed(3)},${cuLoss.toFixed(3)},${swLoss.toFixed(3)},${pLoss.toFixed(3)},${rth.toFixed(3)},${dT.toFixed(2)}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MonteCarlo_Thermal_${iterations}_runs.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.runMonteCarloSwitch = function (switchIdx = 0) {
    if (!lastOptimizationResults || !lastOptimizationResults.switches || lastOptimizationResults.switches.length === 0) {
        return alert(safeGetT('adv_mc_no_switch') || "Anahtarlama elemanı verisi bulunamadı.");
    }

    const sw = lastOptimizationResults.switches[switchIdx];
    const iterations = 1000;

    const tolCond = 20; // Rds(on) / Vf tolerance
    const tolSw = 20;   // Capacitance and E_on/E_off tolerances

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += `Iteration,Component,Conduction_Loss_Tolerance(%),Switching_Loss_Tolerance(%),Conduction_Loss(W),Switching_Loss(W),Total_Loss(W)\n`;

    for (let i = 1; i <= iterations; i++) {
        let pCond = window.mcValue(sw.p_cond_W, tolCond);
        let pSw = window.mcValue(sw.p_sw_W, tolSw);
        let pTot = pCond + pSw;

        csvContent += `${i},${sw.name},±${tolCond},±${tolSw},${pCond.toFixed(3)},${pSw.toFixed(3)},${pTot.toFixed(3)}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MonteCarlo_Switch_${sw.name}_${iterations}_runs.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.runMonteCarloCore = function (coreDataString) {
    if (!coreDataString || coreDataString === '{}') {
        return alert(safeGetT('adv_mc_no_data') || "Nüve verisi bulunamadı.");
    }

    const core = JSON.parse(decodeURIComponent(coreDataString));
    const iterations = 1000;

    const tolBmax = 15;     // AL ve Ae tolerances (±15%)
    const tolCoreLoss = 20; // Steinmetz (k, alpha, beta) tolerances and material property variations (±20%)
    const tolCuLoss = 10;   // DCR and temperature coefficient tolerances (±10%)

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += `Iteration,Component,Bmax_Tolerance(%),Loss_Tolerance(%),Bmax(mT),Core_Loss(W),Copper_Loss(W),Total_Inductor_Loss(W)\n`;

    for (let i = 1; i <= iterations; i++) {
        let simBmax = window.mcValue(core.bmax, tolBmax);
        let simCoreLoss = window.mcValue(core.coreLossW, tolCoreLoss);
        let simCuLoss = window.mcValue(core.copperLossW, tolCuLoss);
        let pTot = simCoreLoss + simCuLoss;

        csvContent += `${i},${core.name},±${tolBmax},±${tolCoreLoss},${simBmax.toFixed(2)},${simCoreLoss.toFixed(3)},${simCuLoss.toFixed(3)},${pTot.toFixed(3)}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MonteCarlo_Core_${core.name}_${iterations}_runs.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ================================================================
// SMPSApp Namespace
// The global window.* assignments are kept as-is for backward
// compatibility (onclick handlers and other topology files bind
// directly to names like window.getT / window.openAdvancedTable).
// window.SMPSApp gives the same functions a single, documented
// entry point; developers writing new code are encouraged to use
// window.SMPSApp.xxx() instead. A full ESM migration (import/export)
// is tracked separately on the roadmap as a larger refactor.
// ================================================================
window.SMPSApp = window.SMPSApp || {};
Object.assign(window.SMPSApp, {
    loadThreeJS: window.loadThreeJS,
    openAdvancedTable: window.openAdvancedTable,
    showIgseModal: window.showIgseModal,
    render3DCore: window.render3DCore,
    executeAdvancedOptimization: window.executeAdvancedOptimization,
    filterResultsByManufacturer: window.filterResultsByManufacturer,
    exportAdvancedResultsToCSV: window.exportAdvancedResultsToCSV,
    populateManufacturerDropdown: window.populateManufacturerDropdown,
    openCustomThermalModal: window.openCustomThermalModal,
    runCustomThermalTest: window.runCustomThermalTest,
    downloadCustomThermalCSV: window.downloadCustomThermalCSV,
    updatePowerDensity: window.updatePowerDensity,
    runMonteCarloThermal: window.runMonteCarloThermal,
    runMonteCarloSwitch: window.runMonteCarloSwitch,
    runMonteCarloCore: window.runMonteCarloCore
});
// Live access to state values that change at runtime:
Object.defineProperties(window.SMPSApp, {
    currentCamera: { get: () => window.currentCamera, enumerable: true },
    lastOptimizationCurrents: { get: () => window.lastOptimizationCurrents, enumerable: true },
    lastOptimizationWarning: { get: () => window.lastOptimizationWarning, enumerable: true },
    lastThermalStates: { get: () => window.lastThermalStates, enumerable: true },
    lastCustomThermalData: { get: () => window.lastCustomThermalData, enumerable: true }
});
