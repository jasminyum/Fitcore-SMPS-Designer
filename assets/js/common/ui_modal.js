// ================================================================
// CENTRAL MODAL & TABLE UI MANAGER
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================
const UIModal = {
    paramsStore: {},

    init: function () {
        if (!document.getElementById('coreSelectionModal')) {
            const modalHTML = `
            <div class="modal fade" id="coreSelectionModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content" style="background-color: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-color);">
                        <div class="modal-header" style="border-bottom: 1px solid var(--border-color);">
                            <h5 class="modal-title" id="coreModalTitle" style="color:var(--color-yellow);">Veri Tablosu</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-0">
                            <div id="modalDynamicBody" class="p-3"></div>
                        </div>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
    },

    getT: function (key) {
        return (window.getT && typeof window.getT === 'function') ? window.getT(key) : key;
    },

    showSafeModal: function () {
        if (typeof bootstrap !== 'undefined') {
            const modalEl = document.getElementById('coreSelectionModal');
            const myModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            myModal.show();
        } else {
            alert("Bootstrap yüklenemedi. Lütfen sayfayı yenileyin.");
        }
    },

    // ----------------------------------------------------
    // SHARED DATA-ENTRY HTML BLOCK
    // ----------------------------------------------------
    getDataEntryHTML: function (coreType, prefix) {
        let isLinear = false;
        if (typeof document !== 'undefined') {
            const pt = (document.title || "").toLowerCase();
            const pt2 = (window._pageType || "").toLowerCase();
            if (pt.includes('lineer') || pt2.includes('linear')) isLinear = true;
        }

        // Ident is not used for SMPS transformers, hide it.
        let hideIdent = (coreType === 'trafo' && !isLinear) ? 'style="display:none;"' : '';

        return `
        <div class="p-3 rounded" style="background: var(--surface-dark); border: 1px solid var(--border-color);">
            <h6 style="border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${this.getT('data_entry') || 'Veri Girişi'}</h6>
            <div style="font-size:12px;">
                <input type="text" id="${prefix}coreInput" class="form-control form-control-sm bg-dark text-light mb-1" placeholder="${this.getT('label_core') || 'Core'}">
                <input type="text" id="${prefix}identInput" class="form-control form-control-sm bg-dark text-light mb-1" ${hideIdent} placeholder="${this.getT('label_ident') || 'Ident'}">
                <input type="text" id="${prefix}manufacturer" class="form-control form-control-sm bg-dark text-light mb-1" placeholder="${this.getT('label_manufacturer') || 'Manufacturer'}">
                <div class="d-flex gap-1 mb-1">
                    <input type="number" id="${prefix}alInput" class="form-control form-control-sm bg-dark text-light" placeholder="${this.getT('label_al') || 'AL'}">
                    <input type="number" id="${prefix}ainInput" class="form-control form-control-sm bg-dark text-light" placeholder="${this.getT('label_ain') || 'Ain'}">
                </div>
                <div class="d-flex gap-1 mb-1">
                    <input type="number" id="${prefix}linInput" class="form-control form-control-sm bg-dark text-light" placeholder="${this.getT('label_lin') || 'lin'}">
                    <input type="number" id="${prefix}aminInput" class="form-control form-control-sm bg-dark text-light" placeholder="${this.getT('label_amin') || 'Amin'}">
                </div>
                <button class="btn btn-primary btn-sm w-100 mt-2" onclick="UIModal.addCoreToFirestore('${coreType}', '${prefix}')">${this.getT('btn_add') || 'Ekle'}</button>
            </div>
        </div>`;
    },

    // ----------------------------------------------------
    // TABBED MULTI-MODAL MANAGEMENT
    // ----------------------------------------------------
    openDualModal: function (tabs) {
        document.getElementById('coreModalTitle').innerText = tabs.map(t => t.title).join(' & ');

        let navHtml = `<ul class="nav nav-tabs mb-3" id="dualModalTab" role="tablist" style="border-bottom: 1px solid var(--border-color);">`;
        let contentHtml = `<div class="tab-content" id="dualModalTabContent">`;

        tabs.forEach((tab, index) => {
            const isActive = index === 0 ? 'active' : '';
            const isShow = index === 0 ? 'show active' : '';
            const prefix = `tab${index}_`;

            navHtml += `
            <li class="nav-item" role="presentation">
                <button class="nav-link ${isActive}" id="${prefix}tab" data-bs-toggle="tab" data-bs-target="#${prefix}pane" type="button" role="tab" style="color: var(--text-main); background: transparent; border-color: ${index === 0 ? 'var(--border-color) var(--border-color) transparent' : 'transparent'};">${tab.title}</button>
            </li>`;

            let innerHTML = '';
            if (tab.type === 'trafo') innerHTML = this._getTrafoHTML(tab.params, prefix);
            else if (tab.type === 'inductor') innerHTML = this._getInductorHTML(tab.params, prefix);
            else if (tab.type === 'flyback') innerHTML = this._getFlybackHTML(tab.params, prefix);

            contentHtml += `
            <div class="tab-pane fade ${isShow}" id="${prefix}pane" role="tabpanel">
                ${innerHTML}
            </div>`;
        });

        navHtml += `</ul>`;
        contentHtml += `</div>`;

        document.getElementById('modalDynamicBody').innerHTML = navHtml + contentHtml;

        tabs.forEach((tab, index) => {
            const prefix = `tab${index}_`;
            if (tab.type === 'trafo') this._renderTrafoTable(prefix);
            else if (tab.type === 'inductor') this._renderInductorTable(prefix);
            else if (tab.type === 'flyback') this._renderFlybackTable(prefix);
        });

        const tabBtns = document.querySelectorAll('#dualModalTab .nav-link');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                tabBtns.forEach(b => {
                    b.style.color = 'var(--text-main)';
                    b.style.borderColor = 'transparent';
                });
                this.style.color = 'var(--color-yellow)';
                this.style.borderColor = 'var(--border-color) var(--border-color) transparent';
            });
        });
        if (tabBtns.length > 0) tabBtns[0].style.color = 'var(--color-yellow)';

        this.showSafeModal();
    },

    openStandardModal: function (params) {
        this.openDualModal([{ type: 'inductor', title: params.title || this.getT('title_coil_data'), params: params }]);
    },

    openTrafoModal: function (params) {
        this.openDualModal([{ type: 'trafo', title: params.title || this.getT('title_transformer_data'), params: params }]);
    },

    openFlybackModal: function (params) {
        this.openDualModal([{ type: 'flyback', title: params.title || this.getT('title_transformer_data'), params: params }]);
    },

    // ----------------------------------------------------
    // STANDARD INDUCTOR (COIL) HTML & RENDER
    // ----------------------------------------------------
    _getInductorHTML: function (params, prefix) {
        this.paramsStore[prefix] = params;
        return `
        <div class="row">
            <div class="col-lg-9">
                <div class="d-flex justify-content-between align-items-center mb-3" style="position: sticky; top: -1px; background-color: var(--bg-dark, #212529); z-index: 10; padding-top: 10px; padding-bottom: 10px; margin-top: -10px;">
                    <h6 style="color:var(--text-muted); margin:0;">L=${params.L_uH.toFixed(2)} µH | Wmax=${params.Wmax.toFixed(2)} µWs | Imax=${params.Imax.toFixed(2)} A</h6>
                    <div class="btn-group" role="group">
                        <input type="radio" class="btn-check" name="${prefix}tableMode" id="${prefix}modeNormal" value="normal" checked onchange="UIModal._renderInductorTable('${prefix}')">
                        <label class="btn btn-outline-info btn-sm" for="${prefix}modeNormal">${this.getT('label_normal_list')}</label>
                        <input type="radio" class="btn-check" name="${prefix}tableMode" id="${prefix}modeOpt" value="opt" onchange="UIModal._renderInductorTable('${prefix}')">
                        <label class="btn btn-outline-info btn-sm" for="${prefix}modeOpt">${this.getT('label_power_loss_opt')}</label>
                    </div>
                </div>
                <table class="table table-dark table-hover table-bordered text-center" style="font-size: 13px;">
                    <thead id="${prefix}tableHead" style="background-color: #272727; position: sticky; top: 48px; z-index: 9; box-shadow: 0 1px 1px rgba(0,0,0,0.5);"></thead>
                    <tbody id="${prefix}tableBody"></tbody>
                </table>
            </div>
            
            <div class="col-lg-3 d-flex flex-column gap-3" style="position: sticky; top: -1px; align-self: flex-start; padding-top: 10px; margin-top: -10px; z-index: 10;">
                <div class="p-3 rounded" id="${prefix}boxNormalLegend" style="background: var(--surface-dark); border: 1px solid var(--border-color);">
                    <h6 style="color:var(--text-main); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${this.getT('core_preference') || 'Nüve Tercihi'}</h6>
                    <div style="font-size: 13px;">
                        <div style="color: #81c784; font-weight: bold; margin-bottom: 4px;">■ ${this.getT('text_very_good') || 'Çok İyi'}</div>
                        <div style="color: #ffb74d; font-weight: bold; margin-bottom: 4px;">■ ${this.getT('text_good') || 'İyi'}</div>
                        <div style="color: #ff8a65; font-weight: bold; margin-bottom: 4px;">■ ${this.getT('text_appropriate') || 'Uygun'}</div>
                        <div style="color: #9e9e9e; margin-bottom: 4px;">■ ${this.getT('text_very_small') || 'Çok Küçük / Yetersiz'}</div>
                    </div>
                </div>

                <div class="p-3 rounded" id="${prefix}boxOptSettings" style="display:none; background: var(--surface-dark); border: 1px solid var(--border-color);">
                    <h6 style="color:var(--color-yellow); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${this.getT('label_opt_settings')}</h6>
                    <p style="font-size: 12px; color: var(--text-muted); margin:5px 0;">${this.getT('text_suggested_wire')} <strong>${params.d_wire_default.toFixed(2)} mm</strong></p>
                    <label style="font-size:12px;">${this.getT('text_wire_to_use')}</label>
                    <input type="number" id="${prefix}wireDiameter" class="form-control form-control-sm bg-dark text-light mt-1" value="${params.d_wire_default.toFixed(2)}" step="0.1" onchange="UIModal._renderInductorTable('${prefix}')">
                </div>
                
                <div class="p-3 rounded" style="background: var(--surface-dark); border: 1px solid var(--border-color);">
                    <h6 style="border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${this.getT('wire_dimensions')}</h6>
                    <p style="font-size: 12px; margin:5px 0;">d ≥ ${params.d_wire_default.toFixed(2)} mm</p>
                    <p style="font-size: 12px; margin:5px 0;">A ≥ ${params.min_area.toFixed(2)} mm²</p>
                    <span style="font-size: 11px; color: var(--text-muted);">${this.getT('text_litz_max')} ${params.max_litz.toFixed(2)} mm)</span>
                </div>
                ${this.getDataEntryHTML('inductor', prefix)}
            </div>
        </div>`;
    },

    _renderInductorTable: function (prefix) {
        const p = this.paramsStore[prefix];
        const d_wire = parseFloat(document.getElementById(`${prefix}wireDiameter`).value) || p.d_wire_default;
        const mode = document.querySelector(`input[name="${prefix}tableMode"]:checked`).value;
        const thead = document.getElementById(`${prefix}tableHead`);
        const tbody = document.getElementById(`${prefix}tableBody`);

        const processedCores = MagneticUtils.calculateInductorCores(CoreDB.inductorCores, p.L_H, p.Irms_sq, d_wire, p.Imax);

        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (mode === "normal") {
            processedCores.sort((a, b) => {
                let aValid = a.wmax >= p.Wmax;
                let bValid = b.wmax >= p.Wmax;

                if (aValid && !bValid) return -1;
                if (!aValid && bValid) return 1;

                return a.wmax - b.wmax;
            });

            document.getElementById(`${prefix}boxNormalLegend`).style.display = 'block';
            document.getElementById(`${prefix}boxOptSettings`).style.display = 'none';

            thead.innerHTML = `<tr>
                <th>No</th><th>${this.getT('col_core') || 'Core'}</th><th>${this.getT('col_ident') || 'Ident'}</th><th>${this.getT('col_manu') || 'Manu'}</th>
                <th>AL(nH)</th><th>Ae(mm²)</th><th>le(mm)</th><th>Amin(mm²)</th><th>Wmax</th><th>Bmax(mT)</th><th>N</th>
            </tr>`;

            processedCores.forEach((c, idx) => {
                const trClass = (c.bmax > 300 || c.wmax < p.Wmax) ? "" : MagneticUtils.getRowColorClass(c.wmax, p.Wmax);
                tbody.innerHTML += `<tr style="${trClass}">
                    <td>${idx + 1}</td><td>${c.core}</td><td>${c.ident}</td><td>${c.manu}</td>
                    <td>${c.al}</td><td>${c.ain}</td><td>${c.lin}</td><td>${c.amin}</td><td>${c.wmax}</td><td>${c.bmax}</td><td>${c.n1}</td>
                </tr>`;
            });
        } else {
            document.getElementById(`${prefix}boxNormalLegend`).style.display = 'none';
            document.getElementById(`${prefix}boxOptSettings`).style.display = 'block';

            thead.innerHTML = `<tr>
                <th>${this.getT('col_core')}</th><th>${this.getT('col_ident')}</th><th>AL(nH)</th><th>Ae(mm²)</th>
                <th>Wmax</th><th>Bmax(mT)</th><th>N</th>
                <th class="text-warning">${this.getT('table_dcr')}</th>
                <th class="text-warning">${this.getT('table_ploss')}</th>
            </tr>`;

            const validCores = processedCores.filter(c => c.bmax <= 300 && c.wmax >= p.Wmax).sort((a, b) => a.ploss - b.ploss);

            if (validCores.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-danger p-3">${this.getT('text_no_core_found')}</td></tr>`;
            } else {
                validCores.forEach((c, idx) => {
                    const rowStyle = (idx === 0) ? "background-color: rgba(129, 199, 132, 0.15); border-left: 4px solid #81c784;" : "";
                    tbody.innerHTML += `<tr style="${rowStyle}">
                        <td>${c.core}</td><td>${c.ident}</td><td>${c.al}</td><td>${c.ain}</td>
                        <td>${c.wmax}</td><td>${c.bmax}</td><td>${c.n1}</td>
                        <td class="text-warning">${c.dcr_mohm.toFixed(2)}</td>
                        <td class="text-warning"><strong>${c.ploss.toFixed(3)}</strong></td>
                    </tr>`;
                });
            }
        }
    },

    // ----------------------------------------------------
    // TRAFO HTML & RENDER
    // ----------------------------------------------------
    _getTrafoHTML: function (params, prefix) {
        this.paramsStore[prefix] = params;
        return `
        <div class="row">
            <div class="col-lg-9">
                <div class="d-flex justify-content-between align-items-center mb-3" style="position: sticky; top: -1px; background-color: var(--bg-dark, #212529); z-index: 10; padding-top: 10px; padding-bottom: 10px; margin-top: -10px;">
                    <h6 style="color:var(--text-muted); margin:0;">F=${params.f_hz.toFixed(0)} Hz | VeOpt=${params.VeOpt.toFixed(2)} mm³ | N1/N2=${params.nOutput.toFixed(2)}</h6>
                    <div class="btn-group" role="group">
                        <input type="radio" class="btn-check" name="${prefix}tableMode" id="${prefix}modeNormal" value="normal" checked onchange="UIModal._renderTrafoTable('${prefix}')">
                        <label class="btn btn-outline-info btn-sm" for="${prefix}modeNormal">${this.getT('label_normal_list')}</label>
                        <input type="radio" class="btn-check" name="${prefix}tableMode" id="${prefix}modeOpt" value="opt" onchange="UIModal._renderTrafoTable('${prefix}')">
                        <label class="btn btn-outline-info btn-sm" for="${prefix}modeOpt">${this.getT('label_power_loss_opt')}</label>
                    </div>
                </div>
                <table class="table table-dark table-hover table-bordered text-center" style="font-size: 13px;">
                    <thead id="${prefix}tableHead" style="background-color: #272727; position: sticky; top: 48px; z-index: 9; box-shadow: 0 1px 1px rgba(0,0,0,0.5);"></thead>
                    <tbody id="${prefix}tableBody"></tbody>
                </table>
            </div>
            
            <div class="col-lg-3 d-flex flex-column gap-3" style="position: sticky; top: -1px; align-self: flex-start; padding-top: 10px; margin-top: -10px; z-index: 10;">
                <div class="p-3 rounded" id="${prefix}boxNormalLegend" style="background: var(--surface-dark); border: 1px solid var(--border-color);">
                    <h6 style="color:var(--text-main); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${this.getT('core_preference') || 'Nüve Tercihi'}</h6>
                    <div style="font-size: 13px;">
                        <div style="color: #81c784; font-weight: bold; margin-bottom: 4px;">■ ${this.getT('text_very_good')}</div>
                        <div style="color: #ffb74d; font-weight: bold; margin-bottom: 4px;">■ ${this.getT('text_good')}</div>
                        <div style="color: #ff8a65; font-weight: bold; margin-bottom: 4px;">■ ${this.getT('text_appropriate')}</div>
                        <div style="color: #9e9e9e; margin-bottom: 4px;">■ ${this.getT('text_very_small')}</div>
                    </div>
                </div>

                <div class="p-3 rounded" id="${prefix}boxOptSettings" style="display:none; background: var(--surface-dark); border: 1px solid var(--border-color);">
                    <h6 style="color:var(--color-yellow); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${this.getT('label_opt_settings')}</h6>
                    <label style="font-size:12px;">Pri. Tel (mm):</label>
                    <input type="number" id="${prefix}wireDia1" class="form-control form-control-sm bg-dark text-light mt-1" value="${params.d1_req.toFixed(2)}" step="0.1" onchange="UIModal._renderTrafoTable('${prefix}')">
                    <label style="font-size:12px; margin-top:10px;">Sec. Tel (mm):</label>
                    <input type="number" id="${prefix}wireDia2" class="form-control form-control-sm bg-dark text-light mt-1" value="${params.d2_req.toFixed(2)}" step="0.1" onchange="UIModal._renderTrafoTable('${prefix}')">
                </div>
                
                <div class="p-3 rounded" style="background: var(--surface-dark); border: 1px solid var(--border-color);">
                    <h6 style="border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${this.getT('wire_dimensions')}</h6>
                    <p style="font-size: 12px; margin:5px 0;">Pri: d1 ≥ ${params.d1_req.toFixed(2)} mm</p>
                    <p style="font-size: 12px; margin:5px 0;">Sec: d2 ≥ ${params.d2_req.toFixed(2)} mm</p>
                    <span style="font-size: 11px; color: var(--text-muted);">${this.getT('text_litz_max')} ${params.max_litz.toFixed(2)} mm)</span>
                </div>
                ${this.getDataEntryHTML('trafo', prefix)}
            </div>
        </div>`;
    },

    _renderTrafoTable: function (prefix) {
        const p = this.paramsStore[prefix];
        const d1 = parseFloat(document.getElementById(`${prefix}wireDia1`).value) || p.d1_req;
        const d2 = parseFloat(document.getElementById(`${prefix}wireDia2`).value) || p.d2_req;
        const mode = document.querySelector(`input[name="${prefix}tableMode"]:checked`).value;
        const thead = document.getElementById(`${prefix}tableHead`);
        const tbody = document.getElementById(`${prefix}tableBody`);

        let coreList = [];
        let isLinear = false;
        if (typeof CoreDB !== 'undefined') {
            const pageTitle = (document.title || "").toLowerCase();
            const pType = (window._pageType || "").toLowerCase();
            if (pType.includes('linear') || pageTitle.includes('lineer')) {
                coreList = CoreDB.linearTrafoCores || [];
                isLinear = true;
            } else {
                coreList = CoreDB.smpsTrafoCores || [];
            }
        }

        const processedCores = MagneticUtils.calculateTrafoCores(coreList, p.L1_H, p.L2_H, p.f_hz, p.vin_min || p.vin1, p.nOutput, p.I1_rms_sq, p.I2_rms_sq, d1, d2, p.topology);

        thead.innerHTML = '';
        tbody.innerHTML = '';

        const identTh = isLinear ? `<th>${this.getT('col_ident') || 'Ident'}</th>` : '';
        const extraTh = isLinear ? `<th>AL(nH)</th><th>Ae(mm²)</th><th>le(mm)</th>` : '';

        if (mode === "normal") {
            processedCores.sort((a, b) => {
                let aValid = a.ve >= p.VeOpt;
                let bValid = b.ve >= p.VeOpt;

                if (aValid && !bValid) return -1;
                if (!aValid && bValid) return 1;
                return a.ve - b.ve;
            });

            document.getElementById(`${prefix}boxNormalLegend`).style.display = 'block';
            document.getElementById(`${prefix}boxOptSettings`).style.display = 'none';

            thead.innerHTML = `<tr>
                <th>No</th><th>${this.getT('col_core')}</th>${identTh}<th>${this.getT('col_manu')}</th>
                ${extraTh}
                <th>${this.getT('label_amin') || 'Amin(mm²)'}</th><th>${this.getT('table_ve_mm3') || 'Ve(mm³)'}</th><th>${this.getT('table_deltaB') || 'ΔB/T'}</th><th>${this.getT('table_n1') || 'N1'}</th><th>${this.getT('table_n2') || 'N2'}</th>
            </tr>`;

            processedCores.forEach((c, idx) => {
                const trClass = MagneticUtils.getRowColorClass(c.ve, p.VeOpt);
                const identTd = isLinear ? `<td>${c.ident}</td>` : '';
                const extraTd = isLinear ? `<td>${c.al}</td><td>${c.ain}</td><td>${c.lin}</td>` : '';
                tbody.innerHTML += `<tr style="${c.ve < p.VeOpt ? "" : trClass}">
                    <td>${idx + 1}</td><td>${c.core}</td>${identTd}<td>${c.manu}</td>
                    ${extraTd}
                    <td>${c.amin}</td><td>${c.ve}</td><td>${c.deltaB}</td><td>${c.N1}</td><td>${c.N2}</td>
                </tr>`;
            });
        } else {
            document.getElementById(`${prefix}boxNormalLegend`).style.display = 'none';
            document.getElementById(`${prefix}boxOptSettings`).style.display = 'block';

            thead.innerHTML = `<tr>
                <th>${this.getT('col_core')}</th>${identTh}<th>${this.getT('col_manu')}</th>
                <th>${this.getT('table_ve_mm3') || 'Ve(mm³)'}</th><th>${this.getT('table_deltaB') || 'ΔB/T'}</th><th>${this.getT('table_n1') || 'N1'}</th><th>${this.getT('table_n2') || 'N2'}</th>
                <th class="text-warning">${this.getT('table_dcr1') || 'DCR_1 (mΩ)'}</th>
                <th class="text-warning">${this.getT('table_dcr2') || 'DCR_2 (mΩ)'}</th>
                <th class="text-warning">${this.getT('table_pcu') || 'P_cu (W)'}</th>
            </tr>`;

            const validCores = processedCores.filter(c => c.ve >= p.VeOpt).sort((a, b) => a.P_cu - b.P_cu);

            if (validCores.length === 0) {
                const colspan = isLinear ? 10 : 9;
                tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-danger p-3">${this.getT('text_no_core_found')}</td></tr>`;
            } else {
                validCores.forEach((c, idx) => {
                    const rowStyle = (idx === 0) ? "background-color: rgba(129, 199, 132, 0.15); border-left: 4px solid #81c784;" : "";
                    const identTd = isLinear ? `<td>${c.ident}</td>` : '';
                    tbody.innerHTML += `<tr style="${rowStyle}">
                        <td>${c.core}</td>${identTd}<td>${c.manu}</td>
                        <td>${c.ve}</td><td>${c.deltaB}</td><td>${c.N1}</td><td>${c.N2}</td>
                        <td class="text-warning">${c.dcr1_mohm.toFixed(2)}</td>
                        <td class="text-warning">${c.dcr2_mohm.toFixed(2)}</td>
                        <td class="text-warning"><strong>${c.P_cu.toFixed(3)}</strong></td>
                    </tr>`;
                });
            }
        }
    },

    // ----------------------------------------------------
    // FLYBACK HTML & RENDER
    // ----------------------------------------------------
    _getFlybackHTML: function (params, prefix) {
        this.paramsStore[prefix] = params;
        return `
        <div class="row">
            <div class="col-lg-9">
                <div class="d-flex justify-content-between align-items-center mb-3" style="position: sticky; top: -1px; background-color: var(--bg-dark, #212529); z-index: 10; padding-top: 10px; padding-bottom: 10px; margin-top: -10px;">
                    <h6 style="color:var(--text-muted); margin:0;">
                        L=${params.L_uH.toFixed(2)} µH | Wmax=${params.Wmax.toFixed(2)} µWs | N1/N2=${params.nOutput.toFixed(2)} | Imax=${params.Imax.toFixed(2)}A
                    </h6>
                    <div class="btn-group" role="group">
                        <input type="radio" class="btn-check" name="${prefix}tableMode" id="${prefix}modeNormal" value="normal" checked onchange="UIModal._renderFlybackTable('${prefix}')">
                        <label class="btn btn-outline-info btn-sm" for="${prefix}modeNormal">${this.getT('label_normal_list')}</label>
                        <input type="radio" class="btn-check" name="${prefix}tableMode" id="${prefix}modeOpt" value="opt" onchange="UIModal._renderFlybackTable('${prefix}')">
                        <label class="btn btn-outline-info btn-sm" for="${prefix}modeOpt">${this.getT('label_power_loss_opt')}</label>
                    </div>
                </div>
                <table class="table table-dark table-hover table-bordered text-center" style="font-size: 13px;">
                    <thead id="${prefix}tableHead" style="background-color: #272727; position: sticky; top: 48px; z-index: 9; box-shadow: 0 1px 1px rgba(0,0,0,0.5);"></thead>
                    <tbody id="${prefix}tableBody"></tbody>
                </table>
            </div>
            
            <div class="col-lg-3 d-flex flex-column gap-3" style="position: sticky; top: -1px; align-self: flex-start; padding-top: 10px; margin-top: -10px; z-index: 10;">
                <div class="p-3 rounded" id="${prefix}boxNormalLegend" style="background: var(--surface-dark); border: 1px solid var(--border-color);">
                    <h6 style="color:var(--text-main); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${this.getT('core_preference')}</h6>
                    <div style="font-size: 13px;">
                        <div style="color: #81c784; font-weight: bold; margin-bottom: 4px;">■ ${this.getT('text_very_good')}</div>
                        <div style="color: #ffb74d; font-weight: bold; margin-bottom: 4px;">■ ${this.getT('text_good')}</div>
                        <div style="color: #ff8a65; font-weight: bold; margin-bottom: 4px;">■ ${this.getT('text_appropriate')}</div>
                        <div style="color: #9e9e9e; margin-bottom: 4px;">■ ${this.getT('text_very_small')}</div>
                    </div>
                </div>

                <div class="p-3 rounded" id="${prefix}boxOptSettings" style="display:none; background: var(--surface-dark); border: 1px solid var(--border-color);">
                    <h6 style="color:var(--color-yellow); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${this.getT('label_opt_settings')}</h6>
                    <label style="font-size:12px;">Pri. Tel (mm):</label>
                    <input type="number" id="${prefix}wireDia1" class="form-control form-control-sm bg-dark text-light mt-1" value="${params.d1_req.toFixed(2)}" step="0.1" onchange="UIModal._renderFlybackTable('${prefix}')">
                    <label style="font-size:12px; margin-top:10px;">Sec. Tel (mm):</label>
                    <input type="number" id="${prefix}wireDia2" class="form-control form-control-sm bg-dark text-light mt-1" value="${params.d2_req.toFixed(2)}" step="0.1" onchange="UIModal._renderFlybackTable('${prefix}')">
                    <p style="font-size: 11px; color: var(--color-yellow); margin-top:10px;">* Bmax > 300mT olan nüveler filtrelenir.</p>
                </div>
                
                <div class="p-3 rounded" style="background: var(--surface-dark); border: 1px solid var(--border-color);">
                    <h6 style="border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">${this.getT('wire_dimensions')}</h6>
                    <p style="font-size: 12px; margin:5px 0;">Pri: d1 ≥ ${params.d1_req.toFixed(2)} mm</p>
                    <p style="font-size: 12px; margin:5px 0;">Sec: d2 ≥ ${params.d2_req.toFixed(2)} mm</p>
                    <span style="font-size: 11px; color: var(--text-muted);">${this.getT('text_litz_max')} ${params.max_litz.toFixed(2)} mm)</span>
                </div>
                ${this.getDataEntryHTML('flyback', prefix)}
            </div>
        </div>`;
    },

    _renderFlybackTable: function (prefix) {
        const p = this.paramsStore[prefix];
        const d1 = parseFloat(document.getElementById(`${prefix}wireDia1`).value) || p.d1_req;
        const d2 = parseFloat(document.getElementById(`${prefix}wireDia2`).value) || p.d2_req;
        const mode = document.querySelector(`input[name="${prefix}tableMode"]:checked`).value;
        const thead = document.getElementById(`${prefix}tableHead`);
        const tbody = document.getElementById(`${prefix}tableBody`);

        const coreList = typeof CoreDB !== 'undefined' ? CoreDB.flybackCores : [];
        const processedCores = MagneticUtils.calculateFlybackCores(coreList, p.L_H, p.nOutput, p.Imax, p.Wmax, p.I1_rms_sq, p.I2_rms_sq, d1, d2);

        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (mode === "normal") {
            processedCores.sort((a, b) => {
                let aValid = a.wmax >= p.Wmax;
                let bValid = b.wmax >= p.Wmax;

                if (aValid && !bValid) return -1;
                if (!aValid && bValid) return 1;
                return a.wmax - b.wmax;
            });

            document.getElementById(`${prefix}boxNormalLegend`).style.display = 'block';
            document.getElementById(`${prefix}boxOptSettings`).style.display = 'none';

            thead.innerHTML = `<tr>
                <th>No</th><th>${this.getT('col_core')}</th><th>${this.getT('col_ident') || 'Ident'}</th><th>${this.getT('col_manu')}</th>
                <th>AL(nH)</th><th>Ae(mm²)</th><th>le(mm)</th><th>Amin(mm²)</th><th>${this.getT('table_wmax') || 'Wmax'}</th><th>${this.getT('table_bmax_mt') || 'Bmax(mT)'}</th><th>${this.getT('table_n1') || 'N1'}</th><th>${this.getT('table_n2') || 'N2'}</th>
            </tr>`;

            processedCores.forEach((c, idx) => {
                const trClass = (c.bmax > 300 || c.wmax < p.Wmax) ? "" : MagneticUtils.getRowColorClass(c.wmax, p.Wmax);
                tbody.innerHTML += `<tr style="${trClass}">
                    <td>${idx + 1}</td><td>${c.core}</td><td>${c.ident}</td><td>${c.manu}</td>
                    <td>${c.al}</td><td>${c.ain}</td><td>${c.lin}</td><td>${c.amin}</td><td>${c.wmax}</td><td>${c.bmax}</td><td>${c.n1}</td><td>${c.n2}</td>
                </tr>`;
            });
        } else {
            document.getElementById(`${prefix}boxNormalLegend`).style.display = 'none';
            document.getElementById(`${prefix}boxOptSettings`).style.display = 'block';

            thead.innerHTML = `<tr>
                <th>${this.getT('col_core')}</th><th>${this.getT('col_manu')}</th>
                <th>${this.getT('table_wmax') || 'Wmax'}</th><th>${this.getT('table_bmax_mt') || 'Bmax(mT)'}</th><th>${this.getT('table_n1') || 'N1'}</th><th>${this.getT('table_n2') || 'N2'}</th>
                <th class="text-warning">${this.getT('table_dcr_pri') || 'DCR_Pri (mΩ)'}</th>
                <th class="text-warning">${this.getT('table_dcr_sec') || 'DCR_Sec (mΩ)'}</th>
                <th class="text-warning">${this.getT('table_pcu') || 'P_cu (W)'}</th>
            </tr>`;

            const validCores = processedCores.filter(c => c.bmax <= 300 && c.wmax >= p.Wmax).sort((a, b) => a.ploss - b.ploss);

            if (validCores.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-danger p-3">${this.getT('text_no_core_found')}</td></tr>`;
            } else {
                validCores.forEach((c, idx) => {
                    const rowStyle = (idx === 0) ? "background-color: rgba(129, 199, 132, 0.15); border-left: 4px solid #81c784;" : "";
                    tbody.innerHTML += `<tr style="${rowStyle}">
                        <td>${c.core}</td><td>${c.manu}</td>
                        <td>${c.wmax}</td><td>${c.bmax}</td><td>${c.n1}</td><td>${c.n2}</td>
                        <td class="text-warning">${c.dcr1_mohm.toFixed(2)}</td>
                        <td class="text-warning">${c.dcr2_mohm.toFixed(2)}</td>
                        <td class="text-warning"><strong>${c.ploss.toFixed(3)}</strong></td>
                    </tr>`;
                });
            }
        }
    },

    // ----------------------------------------------------
    // ADD-TO-GENERAL-DATABASE OPERATION
    // ----------------------------------------------------
    addCoreToFirestore: function (coreType, prefix) {
        const core = document.getElementById(`${prefix}coreInput`).value.trim();
        const ident = document.getElementById(`${prefix}identInput`) ? document.getElementById(`${prefix}identInput`).value.trim() : "-";
        const manu = document.getElementById(`${prefix}manufacturer`).value.trim();
        const al = parseFloat(document.getElementById(`${prefix}alInput`).value);
        const ain = parseFloat(document.getElementById(`${prefix}ainInput`).value);
        const lin = parseFloat(document.getElementById(`${prefix}linInput`).value);
        const amin = parseFloat(document.getElementById(`${prefix}aminInput`).value);

        let isLinear = false;
        if (typeof document !== 'undefined') {
            const pt = (document.title || "").toLowerCase();
            const pt2 = (window._pageType || "").toLowerCase();
            if (pt.includes('lineer') || pt2.includes('linear')) isLinear = true;
        }

        if (coreType === 'trafo' && !isLinear) {
            // SMPS Trafosu - Sadece 5 parametre
            if (!core || !manu || isNaN(ain) || isNaN(lin) || isNaN(amin)) {
                alert(this.getT('alert_fill_fields'));
                return;
            }

            // We calculate the Ve (Volume) value ourselves as Ain * lin
            let ve = Math.round(ain * lin);

            let exists = CoreDB.smpsTrafoCores.some(c => c[1].toLowerCase() === core.toLowerCase());
            if (exists) {
                alert(this.getT('alert_record_exists') || "Bu Core zaten mevcut!");
                return;
            }

            db.collection("transistor").add({
                core: core, manu: manu, amin: amin, vin: ve
            }).then(() => {
                CoreDB.smpsTrafoCores.push([core, manu, amin, ve]);
                CoreDB._sortAndAssignIDs(CoreDB.smpsTrafoCores);

                alert(this.getT('alert_core_added'));
                ['coreInput', 'manufacturer', 'alInput', 'ainInput', 'linInput', 'aminInput'].forEach(id => {
                    if (document.getElementById(`${prefix}${id}`)) document.getElementById(`${prefix}${id}`).value = '';
                });
                this._renderTrafoTable(prefix);
            }).catch((e) => alert("Hata: " + e.message));

        } else {
            // Inductor, Flyback, Lineer Trafo - 8 Parameter
            if (!core || !ident || !manu || isNaN(al) || isNaN(ain) || isNaN(lin) || isNaN(amin)) {
                alert(this.getT('alert_fill_fields'));
                return;
            }

            let targetArray, collectionName;
            if (coreType === 'trafo' && isLinear) {
                targetArray = CoreDB.linearTrafoCores;
                collectionName = "linear_cores";
            } else if (coreType === 'flyback') {
                targetArray = CoreDB.flybackCores;
                collectionName = "coils";
            } else {
                targetArray = CoreDB.inductorCores;
                collectionName = "coils";
            }

            let exists = targetArray.some(c => c[1].toLowerCase() === core.toLowerCase() && String(c[2]).toLowerCase() === ident.toLowerCase());
            if (exists) {
                alert(this.getT('alert_record_exists') || "Bu Core ve Ident kaydı zaten mevcut!");
                return;
            }

            db.collection(collectionName).add({
                core: core, ident: ident, manu: manu, al: al, ain: ain, lin: lin, amin: amin
            }).then(() => {
                targetArray.push([core, ident, manu, al, ain, lin, amin]);
                CoreDB._sortAndAssignIDs(targetArray);

                if (collectionName === "coils") {
                    CoreDB.flybackCores = [...CoreDB.inductorCores];
                }

                alert(this.getT('alert_core_added'));
                ['coreInput', 'identInput', 'manufacturer', 'alInput', 'ainInput', 'linInput', 'aminInput'].forEach(id => {
                    if (document.getElementById(`${prefix}${id}`)) document.getElementById(`${prefix}${id}`).value = '';
                });

                if (coreType === 'inductor') this._renderInductorTable(prefix);
                else if (coreType === 'trafo') this._renderTrafoTable(prefix);
                else if (coreType === 'flyback') this._renderFlybackTable(prefix);
            }).catch((e) => alert("Hata: " + e.message));
        }
    },

    openFilterModal: function (htmlString) {
        document.getElementById('coreModalTitle').innerText = this.getT('filter_design_title') || "Converter Filtre Mimarisi";
        document.getElementById('modalDynamicBody').innerHTML = htmlString;
        this.showSafeModal();
    }
};

document.addEventListener("DOMContentLoaded", () => UIModal.init());
