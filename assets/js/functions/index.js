/**
* ===========================================================================
* HYBRID CORE LOSS MODEL & THEORETICAL BACKGROUND
* ==============================================================================
* This module uses an advanced Hybrid Core Loss Model to calculate magnetic core losses in non-sinusoidal, asymmetric, and temperature-variable conditions.
* Mathematical Foundations and Physical Corrections are based on the following academic literature:
*
* 1. iGSE (Improved Generalized Steinmetz Equation) and k_i Calculation:
* - Losses for non-sinusoidal (triangular, square, etc.) waveforms are calculated using the iGSE
* approach [cite: 15, 24].
* - The numerical integral (I_a) required to find the k_i constant is solved analytically using Gamma functions in a way that perfectly matches the definition 
* in the original articles [cite: 15, 24].
*
* 2. Duty Cycle Asymmetry and DT-IGSE:
* - Standard iGSE loses its accuracy
* at extremely asymmetric duty cycles (D != 0.5). To compensate for this, in the DT-IGSE (Duty-Temperature IGSE) model,
* the proposed asymmetry weighting factor (D_sym) is integrated into the equation [cite: 18, 27].
*
* 3. Trapezoidal Flux and Relaxation Losses:
* - In topologies containing dead-time or "zero voltage" periods such as DAB and LLC, additional losses arise from magnetic relaxation [cite: 16, 25].
* - Asymmetry multipliers and effective waveform parameters are designed to compensate for these "off-time" relaxation effects [cite: 16, 25].
*
* 4. Temperature Dependence and Multiplicative Correction:
* - Core losses are highly dependent on temperature (T_op). Empirical loss modeling
* In accordance with the literature, second-order polynomial corrections and empirical parabolic formulas for MnZn cores have been used [cite: 13, 22].
* - In addition; the temperature factor was proposed as "additive" (+ TEMP) in the original DT-IGSE article, which leads to an error that produces losses 
* even at zero flux [cite: 18, 27]. In this module, the theory in question has been transformed into a "multiplicative" form (DT_TEMP_multiplier) through 
* engineering optimization, ensuring 100% physical consistency.
*
*
* REFERENCES:
* [1] Mühlethaler, J., Biela, J., Kolar, J. W., & Ecklebe, A. (2012). "Improved 
*     Core-Loss Calculation for Magnetic Components Employed in Power Electronic 
*     Systems." IEEE Transactions on Power Electronics[cite: 15, 24].
* [2] Wang, Y., Liu, X., & Li, J. (2026). "Improved equations for core loss prediction 
*     under asymmetric triangular excitation waveforms based on improved generalized 
*     Steinmetz equation." Journal of Magnetism and Magnetic Materials[cite: 18, 27].
* [3] Barg, S., & Bertilsson, K. (2021). "Core Loss Calculation of Symmetric Trapezoidal 
*     Magnetic Flux Density Waveform." IEEE Open Journal of Power Electronics[cite: 16, 25].
* [4] Ridley, R., & Nace, A. (2006). "Modeling Ferrite Core Losses." 
*     Switching Power Magazine[cite: 13, 22].
* [5] Zhang, W., Yang, Q., Li, Y., Lin, Z., & Yang, M. (2022). "Temperature Dependence 
*     of Powder Cores Magnetic Properties for Medium-Frequency Applications." 
*     IEEE Transactions on Magnetics[cite: 17, 26].
* ============================================================================
*/

// ================================================================
// Server Section
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const staticDbData = require("./smps_database.json");

// ================================================================
// HELPER FUNCTIONS
// ================================================================
function findShapeInfo(cleanShape, shapeName, coreShapes) {
    if (!coreShapes || !Array.isArray(coreShapes)) return null;

    let match = coreShapes.find(s => 
        (s.name && s.name.replace(/[\s\-_]+/g, '').toUpperCase() === cleanShape)
    );

    if (!match && shapeName) {
        const firstPart = shapeName.split(/[\s/]+/)[0].toUpperCase(); 
        if (firstPart.length > 2) { 
            const regex = new RegExp(`^${firstPart}(?![0-9])`, 'i');
            match = coreShapes.find(s => 
                s.name && regex.test(s.name.replace(/[\s\-_]+/g, '').toUpperCase())
            );
        }
    }
    return match;
}

function getFuzzyWeights(mode) {
    switch (mode) {
        case "low_cost": return { cost: 0.50, eff: 0.30, size: 0.20 };
        case "high_eff": return { cost: 0.20, eff: 0.50, size: 0.30 };
        case "compact": return { cost: 0.20, eff: 0.30, size: 0.50 };
        case "balanced":
        default: return { cost: 0.33, eff: 0.34, size: 0.33 };
    }
}

function getCurrentDensity(fsw_khz) {
    const F_MIN = 10;
    const F_MAX = 1500;
    const J_MAX = 5.0;
    const J_MIN = 3.0;
    if (fsw_khz <= F_MIN) return J_MAX;
    if (fsw_khz >= F_MAX) return J_MIN;
    const logF = Math.log10(fsw_khz);
    const logMin = Math.log10(F_MIN);
    const logMax = Math.log10(F_MAX);
    const result = J_MAX - (J_MAX - J_MIN) * ((logF - logMin) / (logMax - logMin));
    return Math.round(result * 1000) / 1000;
}

function sanitizeForJSON(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeForJSON);
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const key in value) {
            out[key] = sanitizeForJSON(value[key]);
        }
        return out;
    }
    return value;
}

function optimizeWires(Irms, targetCMA, maxStrandD, wiresData, f_sw_hz = 0) {
    const candidates = [];
    if (Irms <= 0 || !Array.isArray(wiresData)) return candidates;

    const safeCMA = (Number.isFinite(targetCMA) && targetCMA > 0) ? targetCMA : 400;
    
    let safeMaxStrandD = (Number.isFinite(maxStrandD) && maxStrandD > 0) ? maxStrandD : 2.5;

    if (f_sw_hz > 0) {
        const skinDepth_mm = 66 / Math.sqrt(f_sw_hz);
        const maxSkinD_mm = skinDepth_mm * 2; 
        if (safeMaxStrandD > maxSkinD_mm) {
            safeMaxStrandD = maxSkinD_mm;
        }
    }

    const reqArea_mm2 = (Irms * safeCMA) / 1973.525;
    
    const practicalMaxParallelCables = 6;

    wiresData.forEach(wire => {
        let d_mm = 0;
        let strandsPerCable = 1;
        const isLitz = wire.type === "litz";

        if (isLitz) {
            strandsPerCable = wire.numberConductors || 1;
            const strandMatch = wire.strand?.match(/[\d.]+/);
            if (strandMatch) {
                d_mm = parseFloat(strandMatch[0]);
            } else {
                const nameMatch = wire.name?.match(/x\s*([0-9.]+)/);
                if (nameMatch) d_mm = parseFloat(nameMatch[1]);
            }
        } else {
            const d_nom = wire.conductingDiameter?.nominal;
            if (d_nom) d_mm = d_nom * 1000;
        }

        if (!d_mm || d_mm <= 0) return;

        let singleStrandArea_mm2 = Math.PI * Math.pow(d_mm / 2, 2);
        let effectiveStrandArea_mm2 = singleStrandArea_mm2;

        if (!isLitz && d_mm > safeMaxStrandD) {
            const skinDepth = safeMaxStrandD / 2;
            const innerD = d_mm - (2 * skinDepth);
            const deadArea_mm2 = Math.PI * Math.pow(innerD / 2, 2);
            effectiveStrandArea_mm2 = singleStrandArea_mm2 - deadArea_mm2;
        }

        const singleCableEffectiveArea_mm2 = effectiveStrandArea_mm2 * strandsPerCable;
        const singleCablePhysicalArea_mm2 = singleStrandArea_mm2 * strandsPerCable;
        const singleCableArea_cmil = singleCablePhysicalArea_mm2 * 1973.525;

        const parallelCables = Math.ceil(reqArea_mm2 / singleCableEffectiveArea_mm2);

        if (parallelCables > practicalMaxParallelCables) return; 

        const actualCMA = (parallelCables * singleCableArea_cmil) / Irms;
        const totalStrandsInBundle = parallelCables * strandsPerCable;

        candidates.push({
            name: wire.name,
            
            standard: isLitz ? wire.name : (wire.standardName || wire.name || "-"), 
            
            type: isLitz ? "Litz" : "Solid",
            d_mm: d_mm.toFixed(3),
            
            strands: parallelCables, 
            
            parallelCables: parallelCables,
            strandsPerCable: strandsPerCable,
            totalStrands: totalStrandsInBundle,
            totalArea: (singleCableArea_mm2 * parallelCables).toFixed(3),
            cma: Math.round(actualCMA),
            coating: isLitz ? (wire.coating?.type || "Bare/Served") : (wire.coating?.type || "Enamelled")
        });
    });

    candidates.sort((a, b) => {
        const cmaErrorA = Math.abs(a.cma - safeCMA) / safeCMA;
        const cmaErrorB = Math.abs(b.cma - safeCMA) / safeCMA;
        
        const cablePenaltyA = (a.parallelCables - 1) * 0.15; 
        const cablePenaltyB = (b.parallelCables - 1) * 0.15;

        const scoreA = cmaErrorA + cablePenaltyA;
        const scoreB = cmaErrorB + cablePenaltyB;

        return scoreA - scoreB;
    });

    return candidates.slice(0, 5);
}

function gamma(z) {
    const g = 7;
    const p = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    let x = p[0];
    for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
    let t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function calculate_Ia(alpha) {
    const num = Math.pow(2, alpha + 1) * Math.pow(gamma((alpha + 1) / 2), 2);
    const den = gamma(alpha + 1);
    return num / den;
}

function getEffectiveWaveformParams(topology, mode, D_switch, extra = {}) {
    const safeD = Math.max(0.05, Math.min(0.95, D_switch || 0.5));
    switch (topology) {
        case "buck": case "boost": case "buckboost":
        case "flyback": case "forward": case "pushpull":
        case "sepic": case "cuk": case "zeta":
            if (mode === "CCM") return { D1: safeD, D2: 1 - safeD, confidence: "high", note: "CCM: switch duty cycle is used directly." };
            if (mode === "DCM" || mode === "CRM") {
                const D1 = extra.D1 ?? safeD;
                const D2 = extra.D2 ?? Math.max(0.05, 1 - D1);
                return { D1: D1, D2: D2, confidence: "medium", note: `DCM/CRM: active flux segments (D1=${D1.toFixed(2)}, D2=${D2.toFixed(2)}) used directly; zero-current interval is assumed lossless.` };
            }
            return { D1: safeD, D2: 1 - safeD, confidence: "low", note: "Mode could not be detected, CCM assumed." };
        case "bridge": return { D1: 0.5, D2: 0.5, confidence: "high", note: "Bridge topology: symmetrical square wave." };
        case "llc": {
            const fr_ratio = extra.f_sw_over_fr || 1.0;
            const llcMode = extra.llcMode || (Math.abs(fr_ratio - 1) < 0.01 ? "at" : (fr_ratio < 1 ? "below" : "above"));
            if (llcMode === "at") {
                return { D1: 0.5, D2: 0.5, confidence: "medium", note: "LLC at resonance point: flux waveform is close to sinusoidal, iGSE may give slightly conservative results." };
            } else if (llcMode === "below") {
                return { D1: 0.5, D2: 0.5, confidence: "medium", note: "Below resonance LLC: continuous symmetric flux with frequency modulation." };
            } else {
                return { D1: 0.5, D2: 0.5, confidence: "medium", note: "Above resonance LLC: sinusoidal segments." };
            }
        }
        case "dab": {
            const phaseShift = extra.phaseShift || 0;
            const modulation = extra.dabMode || "sps";
            const estD = Math.max(0.1, Math.min(0.9, 0.5 - phaseShift * 0.2));
            if (modulation === "sps") {
                return { D1: 0.5, D2: 0.5, confidence: "high", note: "DAB-SPS: both bridges generate a constant 50% duty cycle." };
            } else {
                return { D1: estD, D2: 1 - estD, confidence: "medium", note: `DAB-${modulation.toUpperCase()} active.` };
            }
        }
        default: return { D1: 0.5, D2: 0.5, confidence: "low", note: "Unknown topology, default D1=D2=0.5 used." };
    }
}

function calculateLoss_iGSE_Dynamic(k_steinmetz, alpha, beta, f_kHz, delta_B_mT, T_op, wfMeta = {}, matParams = {}) {
    const I_a = calculate_Ia(alpha);
    const k_i = k_steinmetz / (Math.pow(2, beta - alpha) * Math.pow(2 * Math.PI, alpha - 1) * I_a);
    
    const f_Hz = f_kHz * 1000; 
    const delta_B_Tesla = delta_B_mT / 1000;
    
    let D1 = Math.max(0.001, Math.min(0.999, wfMeta.D1 ?? 0.5));
    let D2 = Math.max(0.001, Math.min(0.999, wfMeta.D2 ?? 0.5));
    
    if (D1 + D2 > 1.0) {
        const sum = D1 + D2;
        D1 /= sum;
        D2 /= sum;
    }
    
    const D_sym = D1 <= 0.5 ? D1 : (1 - D1);
    const gamma_factor = matParams.gamma ?? 0; 
    const duty_correction = Math.pow(D_sym, -gamma_factor);

    const base_waveform_factor = Math.pow(D1, 1 - alpha) + Math.pow(D2, 1 - alpha);
    const corrected_waveform_factor = base_waveform_factor * duty_correction;

    // Temperature Multiplier (K_t)
    let K_t = 1.0;
    if (matParams.ct0 !== null && matParams.ct0 !== undefined) {
        K_t = matParams.ct0 - (matParams.ct1 * T_op) + (matParams.ct2 * Math.pow(T_op, 2));
    } else if (matParams.isMnZn) {
        K_t = 1 + Math.pow((T_op - 90) / 40, 2); 
    }
    if (K_t <= 0.1) K_t = 0.1;

    // DT-IGSE Temperature Correction (Multiplicative)
    const temp_a = matParams.temp_a ?? 0; 
    const temp_b = matParams.temp_b ?? 1;
    const DT_TEMP_multiplier = 1 + (temp_a * Math.pow(T_op, temp_b));

    // Final Volumetric Loss
    let Pv_W_m3 = k_i * Math.pow(delta_B_Tesla, beta) * Math.pow(f_Hz, alpha) * corrected_waveform_factor;
    Pv_W_m3 = Pv_W_m3 * K_t * DT_TEMP_multiplier;
    
    const Pv_mW_cm3 = Pv_W_m3 / 1000; 

    return {
        Pv_mW_cm3: Number.isFinite(Pv_mW_cm3) && Pv_mW_cm3 > 0 ? Pv_mW_cm3 : 0.1,
        Pv_W_m3: Pv_W_m3,
        breakdown: {
            k: k_steinmetz, alpha, beta, I_a: I_a.toFixed(4), k_i: k_i.toExponential(4),
            K_t: K_t.toFixed(3), delta_B_T: delta_B_Tesla.toFixed(4), f_kHz: f_kHz.toFixed(1),
            D_used: `D1:${D1.toFixed(3)}, D2:${D2.toFixed(3)}`, 
            waveform_factor: corrected_waveform_factor.toFixed(4),
            gamma_used: gamma_factor.toFixed(3),
            confidence: wfMeta.confidence || "high", 
            note: (wfMeta.note || "") + " Real DB temperature correction applied with pure SI k coefficient.", 
            final_Pv: Pv_mW_cm3.toFixed(2)
        }
    };
}

async function optimizeCores(reqVal, mode, type, L_H, f_sw_hz, T_op, deltaIL, volt_sec, gapRequirement, componentType, dbData, staticDbsPayload, pri_Irms = 0, turnsRatio = 0, topology = "unknown", smpsMode = "CCM", D_switch = 0.5, extraModeParams = {}) {
    let candidates = [];
    
    let minCost = Infinity, maxCost = 0, minLoss = Infinity, minVol = Infinity;
    const mu0 = 4 * Math.PI * 1e-7;
    const f_kHz = f_sw_hz / 1000;

    const coreList = Array.isArray(dbData?.cores) ? dbData.cores : [];
    const bobbinList = Array.isArray(dbData?.bobbins) ? dbData.bobbins : [];
    let errorCount = 0;

    const CHUNK_SIZE = 1000; 

    for (let i = 0; i < coreList.length; i += CHUNK_SIZE) {
        const chunk = coreList.slice(i, i + CHUNK_SIZE);

        chunk.forEach(core => {
          try {
            const gappingInfo = core.functionalDescription?.gapping;
            const coreName = (core.name || "").toLowerCase();
            const materialLower = (core.functionalDescription?.material || "").toLowerCase();
            const isPowderCore = materialLower.includes("kool mu") || materialLower.includes("sendust") || materialLower.includes("iron") || materialLower.includes("mpp") || materialLower.includes("flux") || materialLower.includes("edge");
            let isGapped = false;

            if (gappingInfo && gappingInfo.length > 0) isGapped = true;
            else if (coreName.includes("gapped") && !coreName.includes("ungapped")) isGapped = true;
            else if (isPowderCore) isGapped = true;

            if (gapRequirement === "ungapped_only" && isGapped) return;
            if (gapRequirement === "gapped_only" && !isGapped) return;

            let datasheet_gap_mm = 0;
            if (gappingInfo && gappingInfo.length > 0) {
                const subGap = gappingInfo.find(g => g.type === "subtractive" || g.type === "spacer") || gappingInfo[0];
                if (subGap && subGap.type !== "residual") {
                    const rawGap = parseFloat(subGap.length ?? subGap.value ?? subGap.nominal ?? subGap.gap ?? 0);
                    if (rawGap > 1e-4) {
                        datasheet_gap_mm = rawGap < 0.05 ? rawGap * 1000 : rawGap;
                    }
                }
            }
            if (datasheet_gap_mm <= 0) {
                const nameMatch = coreName.match(/gapped\s+([\d.]+)\s*mm/i);
                if (nameMatch) datasheet_gap_mm = parseFloat(nameMatch[1]);
            }

            const shapeName = core.functionalDescription?.shape || "";
            const cleanShape = shapeName.replace(/[\s\-_]+/g, '').toUpperCase();
            
            let raw_AL_db = (parseFloat(core.AL) || parseFloat(core.al) || 0) * 1e-9;
            let Ae = (parseFloat(core.Ae) || parseFloat(core.ae) || 0) * 1e-6;
            let le = (parseFloat(core.le) || 0) * 1e-3;
            let Amin = (parseFloat(core.Amin) || parseFloat(core.amin) || 0) * 1e-6;

            let physData = null;
            if (staticDbsPayload && Array.isArray(staticDbsPayload)) {
                for (const db of staticDbsPayload) {
                    if (Array.isArray(db)) {
                        physData = db.find(d => String(d[1]).replace(/\s+/g, '').toUpperCase() === cleanShape && d.length >= 8);
                        if (physData) break;
                    }
                }
            }
            
            const shapeInfo = findShapeInfo(cleanShape, shapeName, dbData.coreShapes);
            
            let fallback_AL = 0;
            if (physData) {
                fallback_AL = parseFloat(physData[4]) * 1e-9;
                if (!Ae || isNaN(Ae) || Ae <= 0) Ae = parseFloat(physData[5]) * 1e-6;
                if (!le || isNaN(le) || le <= 0) le = parseFloat(physData[6]) * 1e-3;
                if (!Amin || isNaN(Amin) || Amin <= 0) Amin = parseFloat(physData[7]) * 1e-6;
            } else if (shapeInfo && shapeInfo.dimensions) {
                fallback_AL = parseFloat(shapeInfo.al) * 1e-9;
                if (!Ae || isNaN(Ae) || Ae <= 0) Ae = (parseFloat(shapeInfo.ain) || parseFloat(core.Ae) || 0) * 1e-6;
                if (!le || isNaN(le) || le <= 0) le = (parseFloat(shapeInfo.lin) || parseFloat(core.le) || 0) * 1e-3;
                if (!Amin || isNaN(Amin) || Amin <= 0) Amin = (parseFloat(shapeInfo.amin) || parseFloat(shapeInfo.ain) || parseFloat(core.Amin) || parseFloat(core.Ae) || 0) * 1e-6;
            }

            let AL = raw_AL_db || fallback_AL;

            if (datasheet_gap_mm > 0 && !isPowderCore) {
                let explicit_al = 0;
                if (gappingInfo && gappingInfo.length > 0) {
                    const g = gappingInfo[0];
                    const rawAlVal = parseFloat(g.alValue ?? g.al ?? g.AL ?? g.Al ?? 0);
                    if (rawAlVal > 0) explicit_al = rawAlVal * 1e-9;
                }
                if (explicit_al > 0) AL = explicit_al;
                else if (raw_AL_db > 0 && fallback_AL > 0 && raw_AL_db < fallback_AL * 0.8) AL = raw_AL_db;
                else {
                    const base_AL = fallback_AL > 0 ? fallback_AL : (raw_AL_db > 0 ? raw_AL_db : 0);
                    if (base_AL > 0 && Ae > 0) {
                        const lg_m = datasheet_gap_mm / 1000;
                        const reluctance_core = 1 / base_AL;
                        const reluctance_gap = lg_m / (mu0 * Ae);
                        AL = 1 / (reluctance_core + reluctance_gap);
                    }
                }
            }

            if (!AL || !Ae || !le || isNaN(AL) || isNaN(Ae) || isNaN(le) || AL <= 0 || Ae <= 0 || le <= 0) return;

            const Aele = Ae * le;
            const volume_cm3 = Aele * 1e6;
            const mue = (AL * le) / (mu0 * Ae);
            if (!mue || mue <= 0 || isNaN(mue)) return;

            const mu0e = mu0 * mue;
            let isValid = false;
            let Bmax_calc_mT = 0;
            let N1_calc = 1;
            let actualReqVal = 0;
            let l_actual_H = 0; 

            let dynamic_B_sat_T = 0.35; 
            if (isPowderCore) {
                if (materialLower.includes("xflux")) dynamic_B_sat_T = 1.6;
                else if (materialLower.includes("high flux")) dynamic_B_sat_T = 1.4;
                else if (materialLower.includes("kool mu ultra")) dynamic_B_sat_T = 0.8;
                else if (materialLower.includes("mpp")) dynamic_B_sat_T = 0.7;
                else dynamic_B_sat_T = 1.0; 
            } else {
                let B_base = 0.48;
                if (materialLower.includes("n27") || materialLower.includes("3c81") || materialLower.includes("n87")) {
                    B_base = 0.45;
                }
                let currentTemp = Math.max(25, Math.min(150, T_op));
                dynamic_B_sat_T = B_base - ((currentTemp - 25) * 0.0013);
                dynamic_B_sat_T = Math.max(0.25, Math.min(0.55, dynamic_B_sat_T));
            }

            const wf = getEffectiveWaveformParams(topology, smpsMode, D_switch, extraModeParams);
            
            // 1) Name standardization (Removes spaces, dashes, and µ characters, converts to lowercase)
            const materialName = core.functionalDescription?.material || 'Unknown';
            const normalizeName = (name) => (name || "").replace(/[\s\-_µμ]+/gi, '').toLowerCase();
            const normTargetMat = normalizeName(materialName);
            
            let dbMatParams = null;
            let matAbsMinFreq = Infinity;
            let matAbsMaxFreq = 0;

            const coreMats = dbData.coreMaterials || dbData.materials || dbData.core_materials || [];
            
            // 2) Find Material in the Database
            const matData = coreMats.find(m => normalizeName(m.name) === normTargetMat);

            // 3) Extract Steinmetz data from the correct JSON path or apply a fallback
            let steinmetzRanges = [];
            let isFallback = false;

            if (matData && matData.volumetricLosses && Array.isArray(matData.volumetricLosses.default)) {
                // Find data defined with the "steinmetz" method
                const sData = matData.volumetricLosses.default.find(d => d.method === "steinmetz");
                if (sData && Array.isArray(sData.ranges)) {
                    steinmetzRanges = sData.ranges;
                }
            }

            // 4) Match Frequency Range or Apply Fallbacks
            if (steinmetzRanges.length > 0) {
                steinmetzRanges.forEach(r => {
                    const minF = parseFloat(r.minimumFrequency) || 0;
                    const maxF = parseFloat(r.maximumFrequency) || Infinity;
                    if (minF < matAbsMinFreq) matAbsMinFreq = minF;
                    if (maxF > matAbsMaxFreq) matAbsMaxFreq = maxF;
                });

                dbMatParams = steinmetzRanges.find(r => {
                    const minF = parseFloat(r.minimumFrequency) || 0;
                    const maxF = parseFloat(r.maximumFrequency) || Infinity;
                    return f_sw_hz >= minF && f_sw_hz <= maxF;
                });
                
                if (!dbMatParams) {
                    // Select the closest band if outside range
                    dbMatParams = steinmetzRanges.reduce((prev, curr) => {
                        const pMin = parseFloat(prev.minimumFrequency) || 0;
                        const pMax = parseFloat(prev.maximumFrequency) || Infinity;
                        const cMin = parseFloat(curr.minimumFrequency) || 0;
                        const cMax = parseFloat(curr.maximumFrequency) || Infinity;
                        
                        const prevDiff = Math.min(Math.abs(f_sw_hz - pMin), Math.abs(f_sw_hz - pMax));
                        const currDiff = Math.min(Math.abs(f_sw_hz - cMin), Math.abs(f_sw_hz - cMax));
                        return currDiff < prevDiff ? curr : prev;
                    });
                }
            } else {
                // SPECIAL ADJUSTMENT FOR MATERIALS LACKING STEINMETZ COEFFICIENTS!!!
                isFallback = true;
                const comp = (matData?.materialComposition || "").toLowerCase();
                const mName = (matData?.name || materialName).toLowerCase();
                
                // Assign generic Steinmetz parameters based on material properties - Pure SI Units from Datasheets
                if (comp.includes("nizn") || mName.includes("61") || mName.includes("4f1")) {
                    dbMatParams = { k: 7.9244e-5, alpha: 1.6, beta: 2.6 };
                } else if (comp.includes("mnzn") || mName.includes("3c") || mName.includes("n87") || mName.includes("n97")) {
                    dbMatParams = { k: 1.6917e-5, alpha: 1.65, beta: 2.5 }; 
                } else if (isPowderCore) {
                    dbMatParams = { k: 1.8974e-3, alpha: 1.5, beta: 2.2 };
                } else {
                    dbMatParams = { k: 7.9244e-5, alpha: 1.6, beta: 2.5 }; // General fallback
                }
                matAbsMinFreq = 10000;
                matAbsMaxFreq = 1000000;
            }

            if (!dbMatParams) return;

            // 5) Strictly parse data to FLOAT
            const hasCT = dbMatParams.ct0 !== undefined && dbMatParams.ct0 !== null;
            
            const matParams = {
                k: parseFloat(dbMatParams.k) || 0,
                alpha: parseFloat(dbMatParams.alpha) || 0,
                beta: parseFloat(dbMatParams.beta) || 0,
                ct0: hasCT ? parseFloat(dbMatParams.ct0) : null,
                ct1: hasCT ? parseFloat(dbMatParams.ct1) : null,
                ct2: hasCT ? parseFloat(dbMatParams.ct2) : null,
                gamma: parseFloat(dbMatParams.gamma) || 0.0,
                temp_a: parseFloat(dbMatParams.temp_a) || 0.0,
                temp_b: parseFloat(dbMatParams.temp_b) || 1.0,
                isMnZn: (matData?.materialComposition || "").toLowerCase().includes("mnzn") || 
                        (materialLower.includes("mnzn") && isFallback)
            };

            // Skip if missing critical Steinmetz data
            if (matParams.k <= 0 || matParams.alpha <= 0 || matParams.beta <= 0) return;

            let dimA = 0, dimB = 0, dimC = 0, dimD = 0, dimE = 0, dimF = 0;
            let familyType = "E";

            if (shapeInfo && shapeInfo.dimensions) {
                familyType = (shapeInfo.family || "E").toUpperCase();
                if (familyType === "E" || familyType === "") {
                    if (cleanShape.includes("ETD")) familyType = "ETD";
                    else if (cleanShape.includes("RM")) familyType = "RM";
                    else if (cleanShape.includes("PQ")) familyType = "PQ";
                    else if (cleanShape.includes("PM")) familyType = "PM";
                    else if (cleanShape.includes("ER")) familyType = "ER";
                    else if (cleanShape.includes("EFD")) familyType = "EFD";
                }
                const d = shapeInfo.dimensions;
                const getVal = (dim) => {
                    if (!dim) return 0;
                    let v = dim.nominal || ((dim.minimum || 0) + (dim.maximum || 0)) / 2;
                    return v < 1 ? v * 1000 : v; 
                };
                dimA = getVal(d.A); dimB = getVal(d.B); dimC = getVal(d.C);
                dimD = getVal(d.D); dimE = getVal(d.E); dimF = getVal(d.F);
            }

            const Wmax_core_J = (0.5 * Math.pow(dynamic_B_sat_T, 2) * Math.pow(Amin, 2)) / AL;
            let delta_B_mT = 0;

            if (componentType === "linear_trafo") {
                const Ve_mm3 = Aele * 1e9;
                actualReqVal = reqVal; 
                if (Ve_mm3 >= reqVal) {
                    N1_calc = Math.max(1, Math.ceil(Math.sqrt(L_H / AL)));
                    const I1_peak = pri_Irms * Math.SQRT2;
                    Bmax_calc_mT = ((AL * N1_calc * I1_peak) / Ae) * 1000;
                    
                    delta_B_mT = Bmax_calc_mT * 2; 
                    
                    if (Bmax_calc_mT <= (dynamic_B_sat_T * 1000)) isValid = true;
                }
            } else if (type === "energy") {
                const safe_Ipeak = Math.max(pri_Irms, 0.1) * 1.5; 
                actualReqVal = reqVal > 0 ? reqVal : (0.5 * L_H * Math.pow(safe_Ipeak, 2));

                if (Wmax_core_J >= actualReqVal && L_H > 0) {
                    const I_peak_est = Math.sqrt((actualReqVal * 2) / L_H);
                    const B_design_limit_T = dynamic_B_sat_T * 0.85;
                    const N1_sat = Math.ceil((L_H * I_peak_est) / (B_design_limit_T * Amin));

                    if (datasheet_gap_mm > 0) {
                        const N1_al = Math.round(Math.sqrt(L_H / AL));
                        N1_calc = Math.max(1, N1_al, N1_sat);
                    } else {
                        N1_calc = Math.max(1, N1_sat);
                    }

                    if (AL > 0) l_actual_H = AL * Math.pow(N1_calc, 2);

                    const B_peak_T = (L_H * I_peak_est) / (N1_calc * Amin);
                    if (deltaIL > 0) {
                        delta_B_mT = ((L_H * deltaIL) / (N1_calc * Ae)) * 1000; 
                        Bmax_calc_mT = delta_B_mT / 2;
                    } else {
                        delta_B_mT = B_peak_T * 1000; 
                        Bmax_calc_mT = B_peak_T * 500;
                    }
                    if (B_peak_T <= dynamic_B_sat_T) isValid = true;
                }
            } else if (type === "volume") {
                const Ve_mm3 = Aele * 1e9;
                actualReqVal = reqVal;
                if (Ve_mm3 >= reqVal) {
                    const deltaB_satCeiling = 2 * dynamic_B_sat_T * 0.85; 
                    const targetPv_mW_cm3 = 300; // mW/cm³
                    const targetPv_W_m3 = targetPv_mW_cm3 * 1000;
                    
                    const I_a = calculate_Ia(matParams.alpha); 
                    const k_i = matParams.k / (Math.pow(2, matParams.beta - matParams.alpha) * Math.pow(2 * Math.PI, matParams.alpha - 1) * I_a);
                    
                    let D1 = Math.max(0.001, Math.min(0.999, wf.D1 ?? 0.5));
                    let D2 = Math.max(0.001, Math.min(0.999, wf.D2 ?? 0.5));
                    if (D1 + D2 > 1.0) { const sum = D1 + D2; D1 /= sum; D2 /= sum; }
                    
                    const D_sym = D1 <= 0.5 ? D1 : (1 - D1);
                    const gamma_factor = matParams.gamma ?? 0;
                    const duty_correction = Math.pow(D_sym, -gamma_factor);
                    const waveform_factor = (Math.pow(D1, 1 - matParams.alpha) + Math.pow(D2, 1 - matParams.alpha)) * duty_correction;
                    
                    let K_t = 1.0;
                    if (matParams.ct0 !== null && matParams.ct0 !== undefined) {
                        K_t = matParams.ct0 - (matParams.ct1 * T_op) + (matParams.ct2 * Math.pow(T_op, 2));
                    } else if (matParams.isMnZn) {
                        K_t = 1 + Math.pow((T_op - 90) / 40, 2);
                    }
                    if (K_t <= 0.1) K_t = 0.1;
                    
                    const temp_a = matParams.temp_a ?? 0;
                    const temp_b = matParams.temp_b ?? 1;
                    const DT_TEMP_multiplier = 1 + (temp_a * Math.pow(T_op, temp_b));
                    
                    const denom = k_i * Math.pow(f_kHz * 1000, matParams.alpha) * waveform_factor * K_t * DT_TEMP_multiplier;
                    
                    const deltaB_lossTarget = Math.pow(targetPv_W_m3 / denom, 1 / matParams.beta);
                    const deltaB_limit_new = Math.min(deltaB_satCeiling, Number.isFinite(deltaB_lossTarget) && deltaB_lossTarget > 0 ? deltaB_lossTarget : deltaB_satCeiling);

                    if (volt_sec > 0) {
                        N1_calc = Math.ceil(volt_sec / (deltaB_limit_new * Ae));
                        delta_B_mT = (volt_sec / (N1_calc * Ae)) * 1000;
                        Bmax_calc_mT = delta_B_mT / 2;
                    } else {
                        delta_B_mT = Math.round(deltaB_limit_new * 1000);
                        Bmax_calc_mT = delta_B_mT / 2;
                    }
                    
                    if ((Bmax_calc_mT / 1000) <= dynamic_B_sat_T) isValid = true;
                }
            }

            let copper_loss_W = 0;

            if (isValid) {
                let Aw_mm2 = 0, w_width = 0, w_height = 0;
                if (familyType === "RM" || familyType === "PQ" || familyType === "PM") {
                    if (dimA > 0 && dimD > 0) w_width = (dimA - dimD) / 3; 
                    else if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
                    if (dimF > 0) w_height = dimF;
                    else if (dimB > 0 && dimD > 0) w_height = (dimB - dimD / 2);
                } else {
                    if (dimE > 0 && dimD > 0) w_width = (dimE - dimD) / 2;
                    else if (dimA > 0 && dimD > 0) w_width = (dimA - 2 * dimD) / 2;
                    if (dimF > 0) w_height = dimF * 2;
                    else if (dimB > 0 && dimD > 0) w_height = (dimB - dimD / 2) * 2;
                }
				
				const bobbin_margin_mm = 1.0;

				if (w_width > bobbin_margin_mm) w_width -= bobbin_margin_mm;
				else w_width = 0;

				if (w_height > bobbin_margin_mm) w_height -= bobbin_margin_mm;
				else w_height = 0;

				if (w_width > 0 && w_height > 0) Aw_mm2 = w_width * w_height;
				else {
					isValid = false;
				}

                if (w_width > 0 && w_height > 0) Aw_mm2 = w_width * w_height;
                else return;

                let J_target = getCurrentDensity(f_kHz);
                
                if (volume_cm3 < 3.0) J_target *= 1.25; 
                else if (volume_cm3 > 15.0) J_target *= 0.85; 

				let N2_calc = turnsRatio > 0 ? Math.round(N1_calc / turnsRatio) : 0;

				if (turnsRatio > 0) {
					if (N2_calc < 1) {
						N2_calc = 1;
					}
					N1_calc = Math.round(N2_calc * turnsRatio);
				}
				
                const safe_pri_Irms = Math.max(pri_Irms, 0.05);
                const safe_sec_Irms = turnsRatio > 0 ? (safe_pri_Irms * turnsRatio) : 0;

                let primary_Cu_mm2 = N1_calc * (safe_pri_Irms / J_target);
                let secondary_Cu_mm2 = (N2_calc > 0) ? (N2_calc * (safe_sec_Irms / J_target)) : 0;

                const packing_and_insulation_factor = 1.25; 
                let total_Cu_mm2 = (primary_Cu_mm2 + secondary_Cu_mm2) * packing_and_insulation_factor;

                if (!componentType.includes("trafo") && !componentType.includes("flyback")) {
                    total_Cu_mm2 = N1_calc * (safe_pri_Irms / J_target) * packing_and_insulation_factor;
                }

                let Ku_limit = 0.40;
                if (familyType === "RM" || familyType === "PQ" || familyType === "PM" || familyType === "EP") {
                    Ku_limit = 0.30;
                }

                if (total_Cu_mm2 > (Aw_mm2 * Ku_limit)) isValid = false; 

                const Ae_mm2_est = Ae * 1e6;
                const legPerimeter_mm = 4 * Math.sqrt(Ae_mm2_est);
                const MLT_mm = legPerimeter_mm + Math.PI * w_width;
                const MLT_m = MLT_mm / 1000;

                const RHO_CU_20C = 1.68e-8; // ohm*m, 20°C cu 
                const ALPHA_CU = 0.00393;   // 1/°C
                const rho_cu_T = RHO_CU_20C * (1 + ALPHA_CU * (T_op - 20));

                copper_loss_W = (N1_calc * safe_pri_Irms * rho_cu_T * MLT_m) * (J_target * 1e6);

                if ((componentType.includes("trafo") || componentType.includes("flyback")) && turnsRatio > 0) {
                    const n2_est = Math.max(1, Math.round(N1_calc / turnsRatio));
                    const sec_Irms_est = safe_pri_Irms * turnsRatio;
                    copper_loss_W += n2_est * sec_Irms_est * rho_cu_T * MLT_m * J_target * 1e6;
                }

                if (!Number.isFinite(copper_loss_W) || copper_loss_W < 0) copper_loss_W = 0;
            }

            if (!isValid) return;

            let utilizationRatio = 1.0;
            if (type === "energy" && actualReqVal > 0) {
                 utilizationRatio = actualReqVal / Wmax_core_J;
            } else if (type === "volume" && actualReqVal > 0) {
                 utilizationRatio = actualReqVal / (Aele * 1e9);
            }

            const igseResult = calculateLoss_iGSE_Dynamic(matParams.k, matParams.alpha, matParams.beta, f_kHz, delta_B_mT, T_op, wf, matParams);
            const Pv_mW_cm3 = igseResult.Pv_mW_cm3;
            const Pv_W_m3 = igseResult.Pv_W_m3;

            const core_loss_W = Pv_W_m3 * Aele; 
            const lossFactor = core_loss_W;
            const totalLossW = core_loss_W + copper_loss_W;

            let overLossPenalty = 1.0;
            if (Pv_mW_cm3 > 600) {
                overLossPenalty = 0.02;
            }

            let lowestCost = null;
            let selectedDistributor = null;

            if (core.distributorsInfo && Array.isArray(core.distributorsInfo) && core.distributorsInfo.length > 0) {
                core.distributorsInfo.forEach(dist => {
                    const rawCost = dist?.cost;
                    if (rawCost !== undefined && rawCost !== null) {
                        const val = typeof rawCost === 'object' ? parseFloat(rawCost.value) : parseFloat(rawCost);
                        if (!isNaN(val) && val > 0) {
                            if (lowestCost === null || val < lowestCost) {
                                lowestCost = val;
                                selectedDistributor = dist;
                            }
                        }
                    }
                });
            }

            const isTwoPieceSet = (core.functionalDescription?.type === "twoPieceSet");
            let singlePiecePrice = 999;
            let totalSetCost = 999;

            if (lowestCost !== null) {
                singlePiecePrice = lowestCost; 
                
                if (isTwoPieceSet) {
                    totalSetCost = lowestCost * 2;
                } else {
                    totalSetCost = lowestCost;
                }
            }

            const cost = totalSetCost;
            const stackCount = core.functionalDescription?.numberStacks || 1;
            const totalCost = (cost === 999) ? 999 : cost * stackCount;

            const compatibleBobbin = bobbinList.find(
                b => b.functionalDescription?.shape?.replace(/\s+/g, '').toUpperCase() === cleanShape
            );

            let gap_mm = 0;
            let gap_is_builtin = false;
            if (datasheet_gap_mm > 0) {
                gap_mm = datasheet_gap_mm;
                gap_is_builtin = true;
            } else if (!isPowderCore && gapRequirement !== "ungapped_only" && L_H > 0 && N1_calc > 0 && componentType !== "linear_trafo") {
                
                const lg_initial_m = Math.max(0, (mu0 * Ae * Math.pow(N1_calc, 2)) / L_H - le / mue);
                let final_lg_m = lg_initial_m;

                if (lg_initial_m > 0) {
                    const window_length_m = w_height > 0 ? (w_height / 1000) : (Math.sqrt(Ae) * 2);
                    
                    let lg_iter = lg_initial_m;
                    for (let i = 0; i < 10; i++) {
                        if (lg_iter <= 0 || !isFinite(lg_iter)) { lg_iter = 0; break; }
                        const F = 1 + (lg_iter / Math.sqrt(Ae)) * Math.log((2 * window_length_m) / lg_iter);
                        if (!isFinite(F)) { lg_iter = lg_initial_m; break; }
                        lg_iter = Math.max(0, F * ((mu0 * Ae * Math.pow(N1_calc, 2)) / L_H - le / mue));
                    }
                    final_lg_m = lg_iter;
                }
                
                gap_mm = final_lg_m * 1000;
                if (!isFinite(gap_mm) || isNaN(gap_mm) || gap_mm < 0.005) gap_mm = 0;
            }

            let n2_calc = 0;
            if (turnsRatio > 0 && (componentType === "trafo" || componentType === "flyback")) {
                n2_calc = Math.max(1, Math.round(N1_calc / turnsRatio));
            }

            let l_deviation_pct = 0;
            if (l_actual_H > 0 && L_H > 0) {
                l_deviation_pct = ((l_actual_H - L_H) / L_H) * 100;
                if (Math.abs(l_deviation_pct) > 3 && igseResult.breakdown) {
                    igseResult.breakdown.note = (igseResult.breakdown.note || "") +
                        ` Achieved inductance ${(l_actual_H * 1e6).toFixed(2)}uH vs target ${(L_H * 1e6).toFixed(2)}uH ` +
                        `(${l_deviation_pct > 0 ? '+' : ''}${l_deviation_pct.toFixed(1)}%) — N1 was raised above the AL-based turn ` +
                        `count to respect the saturation limit.`;
                }
            }

            candidates.push({
                name: core.name || shapeName,
                mfgName: core.manufacturerInfo?.name || core.manufacturer || core.brand || "Unknown",
                componentType: componentType,
                material: materialName,
                costPerUnit: singlePiecePrice,
                totalCost: totalCost,
                volume: volume_cm3,
                lossFactor: lossFactor,
                fuzzyScore: 0,
                pv: Pv_mW_cm3,
                igseBreakdown: igseResult.breakdown,
                coreLossW: core_loss_W,
                copperLossW: copper_loss_W,
                totalLossW: totalLossW,
                bmax: Bmax_calc_mT,
                n1_calc: N1_calc,
                n2_calc: n2_calc,
                al_nH: AL * 1e9,
                Ae_mm2: Ae * 1e6,
                bobbinName: compatibleBobbin ? compatibleBobbin.name : "-",
                distributor: selectedDistributor ? selectedDistributor.name : (core.distributorsInfo?.[0]?.name || "Unknown Stock"),
                url: selectedDistributor ? selectedDistributor.link : (core.distributorsInfo?.[0]?.link || "#"),
                family: familyType,
                dim_A: dimA, dim_B: dimB, dim_C: dimC, dim_D: dimD, dim_E: dimE, dim_F: dimF,
                gap_mm: gap_mm,
                gap_is_builtin: gap_is_builtin,
                utilizationRatio: utilizationRatio,
                windowAreaSource: "dims",
                l_target_H: (type === "energy" && L_H > 0) ? L_H : null,
                l_actual_H: l_actual_H > 0 ? l_actual_H : null,
                l_deviation_pct: l_actual_H > 0 ? l_deviation_pct : null,
                matAbsMinFreq: matAbsMinFreq,
                matAbsMaxFreq: matAbsMaxFreq
            });

            if (singlePiecePrice !== 999 && singlePiecePrice > 0) {
                if (singlePiecePrice < minCost) minCost = singlePiecePrice;
                if (singlePiecePrice > maxCost) maxCost = singlePiecePrice;
            }
            
            if (totalLossW < minLoss) minLoss = totalLossW;
            if (volume_cm3 < minVol) minVol = volume_cm3;

          } catch (e) {
            errorCount++;
            if (errorCount > 20) {
                throw new Error(`Critical error while processing the core database: ${e.message}`);
            }
          }
        });

        await new Promise(resolve => setImmediate(resolve));
    }

    const BASE_LOSS_W = 0.1;
    const weights = getFuzzyWeights(mode);
    
    const logMin = (minCost !== Infinity && minCost > 0) ? Math.log(minCost) : 0;
    const logMax = (maxCost > 0) ? Math.log(maxCost) : 0;
    const logDiff = logMax - logMin;

    let robustMinLoss = Infinity, robustMinVol = Infinity;
    candidates.forEach(c => {
        if (c.utilizationRatio >= 0.15) {
            if (c.totalLossW < robustMinLoss) robustMinLoss = c.totalLossW;
            if (c.volume < robustMinVol) robustMinVol = c.volume;
        }
    });
    if (robustMinLoss === Infinity) robustMinLoss = minLoss;
    if (robustMinVol === Infinity) robustMinVol = minVol;

    candidates.forEach(c => {
        let scoreCost = 0.01;

        if (c.costPerUnit !== 999 && c.costPerUnit > 0) {
            if (logDiff > 0) {
                const logPrice = Math.log(c.costPerUnit);
                scoreCost = Math.max(0.01, (logMax - logPrice) / logDiff);
            } else {
                scoreCost = 1.0;
            }
        }

        const scoreEff = Math.min(1.0, (robustMinLoss + BASE_LOSS_W) / (c.totalLossW + BASE_LOSS_W));
        const scoreSize = Math.min(1.0, robustMinVol / c.volume);

        let overSizePenalty = 1.0;
        if (c.utilizationRatio < 0.4) {
            overSizePenalty = Math.max(0.1, c.utilizationRatio * 2.5);
        }

        let matSuitability = 1.0;
        let matNote = "";

        const f_Hz = f_sw_hz; 

        if (f_Hz < c.matAbsMinFreq) {
            matSuitability = 0.6 + (0.4 * (f_Hz / c.matAbsMinFreq));
            matNote = ` Operating frequency is below the material's ideal frequency band (${(c.matAbsMinFreq/1000).toFixed(0)} kHz). (Multiplier: ${matSuitability.toFixed(2)}).`;
        } else if (f_Hz > c.matAbsMaxFreq) {
            matSuitability = Math.max(0.4, 1.0 - ((f_Hz - c.matAbsMaxFreq) / c.matAbsMaxFreq));
            matNote = ` WARNING: Operating frequency exceeds the material's supported maximum frequency (${(c.matAbsMaxFreq/1000).toFixed(0)} kHz)! Losses may drastically increase (Multiplier: ${matSuitability.toFixed(2)}).`;
        } else {
            matSuitability = 1.2; 
            matNote = ` Material is used in its ideal operating frequency band. (Bonus: 1.20).`;
        }

        if (c.igseBreakdown) {
            c.igseBreakdown.note = (c.igseBreakdown.note || "") + matNote;
            if (overSizePenalty < 1.0) {
                c.igseBreakdown.note += ` Core capacity is well above the design target; an unnecessary volume penalty was applied (Multiplier: ${overSizePenalty.toFixed(2)}).`;
            }
            c.igseBreakdown.note += ` Loss Distribution: Core ${c.coreLossW.toFixed(3)}W + Copper ${c.copperLossW.toFixed(3)}W = Total ${c.totalLossW.toFixed(3)}W.`;
        }

        const effectiveScoreEff = Math.min(1.0, scoreEff * matSuitability);

        let rawFuzzyScore = ((weights.cost * scoreCost) + (weights.size * scoreSize) + (weights.eff * effectiveScoreEff)) * 100;
        c.fuzzyScore = Math.min(100, rawFuzzyScore * overSizePenalty);
    });

    candidates.sort((a, b) => b.fuzzyScore - a.fuzzyScore);

    const KNOWN_STOCK_GUARANTEE = 30;
    const OVERALL_LIMIT = 30;

    const topOverall = candidates.slice(0, OVERALL_LIMIT);
    const topKnownStock = candidates
        .filter(c => !!c.distributor && c.distributor !== "Unknown Stock")
        .slice(0, KNOWN_STOCK_GUARANTEE);

    const merged = [...topOverall];
    const seen = new Set(merged.map(c => `${c.name}|${c.mfgName}`));
    topKnownStock.forEach(c => {
        const key = `${c.name}|${c.mfgName}`;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(c);
        }
    });

    merged.sort((a, b) => b.fuzzyScore - a.fuzzyScore);
    return merged;
}

// ================================================================
// EXPORTS AND UTILS REMAINING
// ================================================================

function interp1(xs, ys, xq, scaleToZero = false) {
    if (!xs || !ys || xs.length === 0 || xs.length !== ys.length) return null;
    if (xs.length === 1) return ys[0];
    const pts = xs.map((x, i) => [x, ys[i]]).sort((a, b) => a[0] - b[0]);
    if (xq <= pts[0][0]) {
        if (scaleToZero && pts[0][0] > 0) return pts[0][1] * (xq / pts[0][0]);
        return pts[0][1];
    }
    if (xq >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        if (xq >= x0 && xq <= x1) {
            if (x1 === x0) return y0;
            const t = (xq - x0) / (x1 - x0);
            return y0 + t * (y1 - y0);
        }
    }
    return pts[pts.length - 1][1];
}

function findClosestEntry(entries, targets) {
    let best = null;
    let bestScore = Infinity;
    for (const e of entries) {
        let score = 0;
        for (const key in targets) {
            let val = e[key];
            if (val === undefined || val === null) continue;
            if (Array.isArray(val)) continue;
            const denom = Math.max(Math.abs(targets[key]), 1);
            score += Math.abs(val - targets[key]) / denom;
        }
        if (score < bestScore) {
            bestScore = score;
            best = e;
        }
    }
    return best || entries[0];
}

const parseCurve = (data) => {
    if (!data) return null;
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return null; }
    }
    return data;
};

function interpMatrixValue(entry, T_op, V_op) {
    if (!entry) return null;
    let sub = parseCurve(entry.values);
    if (!Array.isArray(sub)) return null;

    let tArr = parseCurve(entry.T);
    if (Array.isArray(tArr) && tArr.length > 0) {
        let tIdx = 0, bestT = Infinity;
        tArr.forEach((t, idx) => {
            const diff = Math.abs(t - T_op);
            if (diff < bestT) { bestT = diff; tIdx = idx; }
        });
        let tempT = parseCurve(sub[tIdx]);
        if (Array.isArray(tempT)) sub = tempT;
    }

    let vArr = parseCurve(entry.v);
    if (Array.isArray(vArr) && vArr.length > 0) {
        let vIdx = 0, bestV = Infinity;
        vArr.forEach((v, idx) => {
            if (V_op > 0 && v <= 0) return; 
            const diff = Math.abs(v - V_op);
            if (diff < bestV) { bestV = diff; vIdx = idx; }
        });
        let tempV = parseCurve(sub[vIdx]);
        if (Array.isArray(tempV)) sub = tempV;
    }
    if (!Array.isArray(sub)) return null;
    return sub;
}

function extractConductionCurve(iRaw, valRaw, isMainSwitch) {
    let max_x = 0, max_y = 0;
    for (let k = 0; k < iRaw.length; k++) {
        let x = Math.abs(parseFloat(iRaw[k])) || 0;
        let y = Math.abs(parseFloat(valRaw[k])) || 0;
        if (x > max_x) max_x = x;
        if (y > max_y) max_y = y;
    }

    let actualI = iRaw;
    let actualV = valRaw;
    
    if (max_x < 40 && max_y > max_x * 2) {
        actualI = valRaw; 
        actualV = iRaw;   
    }

    let ptsMap = new Map();
    ptsMap.set(0, 0); 
    
    for (let k = 0; k < actualI.length; k++) {
        let i = parseFloat(actualI[k]);
        let v = parseFloat(actualV[k]);
        if (isNaN(i) || isNaN(v)) continue;
        
        if (isMainSwitch) {
            if (i > 0) ptsMap.set(i, Math.abs(v));
        } else {
            let absI = Math.abs(i);
            let absV = Math.abs(v);
            
            if (absI > 0.01 && absV < 0.01) continue;
            
            if (!ptsMap.has(absI) || ptsMap.get(absI) < absV) {
                ptsMap.set(absI, absV);
            }
        }
    }
    
    let pts = Array.from(ptsMap.entries()).sort((a, b) => a[0] - b[0]);
    if (pts.length < 2) {
        let fallbackI = actualI.map(x => Math.abs(parseFloat(x)||0)).sort((a,b)=>a-b);
        let fallbackV = actualV.map(x => Math.abs(parseFloat(x)||0)).sort((a,b)=>a-b);
        return { iClean: fallbackI, vClean: fallbackV };
    }
    
    return { iClean: pts.map(p => p[0]), vClean: pts.map(p => p[1]) };
}

function extractEnergyCurve(iRaw, eRaw) {
    let ptsMap = new Map();
    ptsMap.set(0, 0); 
    for (let k = 0; k < iRaw.length; k++) {
        let i = Math.abs(parseFloat(iRaw[k]));
        let e = Math.abs(parseFloat(eRaw[k]));
        if (isNaN(i) || isNaN(e)) continue;
        if (!ptsMap.has(i) || ptsMap.get(i) < e) {
            ptsMap.set(i, e);
        }
    }
    let pts = Array.from(ptsMap.entries()).sort((a, b) => a[0] - b[0]);
    return { iClean: pts.map(p => p[0]), eClean: pts.map(p => p[1]) };
}

function estimateConductionDrop(sw, T_op, I_op) {
    const typeStr = (sw.type || "").toUpperCase();
    const nameStr = (sw.name || "").toUpperCase();
    const isDiode = typeStr.includes("DIODE") || nameStr.includes("DIODE");
    const isMosLike = typeStr.includes("MOSFET") || typeStr.includes("GAN") || typeStr.includes("SIC");

    let targetData = sw.switch;
    if (isDiode && sw.diode && sw.diode.channel && sw.diode.channel.length > 0) {
        targetData = sw.diode;
    } else if (!targetData || !targetData.channel || targetData.channel.length === 0) {
        if (sw.diode && sw.diode.channel && sw.diode.channel.length > 0) {
            targetData = sw.diode;
        } else {
            return null;
        }
    }

    if (!targetData || !targetData.channel || targetData.channel.length === 0) return null;
    const safe_I_op = Math.max(Math.abs(I_op), 0.01);

    if (isMosLike && !isDiode) {
        let rThArr = parseCurve(targetData.r_channel_th);
        if (Array.isArray(rThArr) && rThArr.length > 0) {
            const usable = rThArr.filter(e => e.graph_t_r || (Array.isArray(parseCurve(e.T)) && Array.isArray(parseCurve(e.values))));
            if (usable.length > 0) {
                const maxVg = Math.max(...usable.map(e => e.v_g ?? 0));
                const entry = findClosestEntry(usable.filter(e => (e.v_g ?? 0) === maxVg), { i_channel: safe_I_op });
                if (entry) {
                    let raw = null;
                    const curve = parseCurve(entry.graph_t_r);
                    if (curve && curve[0]?.length > 0) raw = interp1(curve[0], curve[1], T_op);
                    else {
                        let tArr = parseCurve(entry.T);
                        let vArr = parseCurve(entry.values);
                        if (Array.isArray(tArr) && Array.isArray(vArr)) raw = interp1(tArr, vArr, T_op);
                    }
                    if (raw !== null && raw > 0) {
                        if (entry.dataset_type === "t_factor" && entry.r_channel_nominal) return { type: "mosfet", r_ds_on: entry.r_channel_nominal * raw };
                        return { type: "mosfet", r_ds_on: raw };
                    }
                    if (entry.r_channel_nominal) return { type: "mosfet", r_ds_on: entry.r_channel_nominal };
                }
            }
        }
        
        let channelArr = parseCurve(targetData.channel);
        if (Array.isArray(channelArr) && channelArr.length > 0) {
            const matrixEntries = channelArr.filter(e => Array.isArray(parseCurve(e.i)) && Array.isArray(parseCurve(e.values)));
            if (matrixEntries.length > 0) {
                const maxVg = Math.max(...matrixEntries.map(e => e.v_g ?? 15));
                const entry = findClosestEntry(matrixEntries.filter(e => (e.v_g ?? 15) === maxVg), { t_j: T_op }) || matrixEntries[0];
                const vArrRaw = interpMatrixValue(entry, T_op, maxVg);
                if (vArrRaw) {
                    const { iClean, vClean } = extractConductionCurve(parseCurve(entry.i), vArrRaw, true);
                    const v_at_i = interp1(iClean, vClean, safe_I_op);
                    if (v_at_i !== null && v_at_i > 0) return { type: "mosfet", r_ds_on: v_at_i / safe_I_op };
                }
            } else {
                const legacy = channelArr.filter(e => e.graph_v_i);
                if (legacy.length > 0) {
                    const entry = findClosestEntry(legacy, { t_j: T_op, v_g: 15 });
                    const curve = parseCurve(entry.graph_v_i);
                    if (curve && curve[0]?.length > 1) {
                        const { iClean, vClean } = extractConductionCurve(curve[1], curve[0], true);
                        const v_at_i = interp1(iClean, vClean, safe_I_op);
                        if (v_at_i !== null && v_at_i > 0) return { type: "mosfet", r_ds_on: v_at_i / safe_I_op };
                    }
                }
            }
        }
        return null;
    } else {
        let channelArr = parseCurve(targetData.channel);
        if (Array.isArray(channelArr) && channelArr.length > 0) {
            const matrixEntries = channelArr.filter(e => Array.isArray(parseCurve(e.i)) && Array.isArray(parseCurve(e.values)));
            const isMainSwitch = !isDiode;
            
            if (matrixEntries.length > 0) {
                const maxVg = Math.max(...matrixEntries.map(e => e.v_g ?? 0));
                const entry = findClosestEntry(matrixEntries, { t_j: T_op }) || matrixEntries[0];
                const vArrRaw = interpMatrixValue(entry, T_op, maxVg);
                if (vArrRaw) {
                    const { iClean, vClean } = extractConductionCurve(parseCurve(entry.i), vArrRaw, isMainSwitch);
                    const v_drop = interp1(iClean, vClean, safe_I_op);
                    if (v_drop !== null && v_drop > 0) return { type: "diode", v_drop: v_drop };
                }
            } else {
                const legacy = channelArr.filter(e => e.graph_v_i);
                if (legacy.length > 0) {
                    const entry = findClosestEntry(legacy, { t_j: T_op });
                    const curve = parseCurve(entry.graph_v_i);
                    if (curve && curve[0]?.length > 1) {
                        const { iClean, vClean } = extractConductionCurve(curve[1], curve[0], isMainSwitch);
                        const v_drop = interp1(iClean, vClean, safe_I_op);
                        if (v_drop !== null && v_drop > 0) return { type: "diode", v_drop: v_drop };
                    }
                }
            }
        }
        return null;
    }
}

function estimateSwitchingEnergy(sw, V_op, I_op, T_op) {
    const typeStr = (sw.type || "").toUpperCase();
    const nameStr = (sw.name || "").toUpperCase();
    const isDiode = typeStr.includes("DIODE") || nameStr.includes("DIODE");

    let targetData = sw.switch;
    if (isDiode && sw.diode && (sw.diode.e_on?.length > 0 || sw.diode.e_off?.length > 0)) {
        targetData = sw.diode;
    } else if (!targetData || (!targetData.e_on?.length && !targetData.e_off?.length)) {
        if (sw.diode && (sw.diode.e_on?.length > 0 || sw.diode.e_off?.length > 0)) targetData = sw.diode;
    }

    if (!targetData) return { e_on_J: 0, e_off_J: 0, v_supply_on: V_op, v_supply_off: V_op };

    function pickEnergy(rawList) {
        let list = parseCurve(rawList);
        if (!Array.isArray(list) || list.length === 0) return { e_J: 0, v_supply: V_op };

        for (const entry of list) {
            let iArr = parseCurve(entry.i);
            let valArr = parseCurve(entry.values);

            if (Array.isArray(iArr) && Array.isArray(valArr)) {
                const eArrRaw = interpMatrixValue(entry, T_op, V_op);
                if (eArrRaw && eArrRaw.length === iArr.length) {
                    const { iClean, eClean } = extractEnergyCurve(iArr, eArrRaw);
                    const e_at_i = interp1(iClean, eClean, Math.abs(I_op), true);
                    if (e_at_i !== null) {
                        let vRef = V_op;
                        let vArr = parseCurve(entry.v);
                        if (Array.isArray(vArr) && vArr.length > 0) {
                            let bestDiff = Infinity;
                            vArr.forEach(v => {
                                if (V_op > 0 && v <= 0) return; 
                                const d = Math.abs(v - V_op);
                                if (d < bestDiff) { bestDiff = d; vRef = v; }
                            });
                        }
                        return { e_J: Math.max(0, e_at_i), v_supply: Math.max(1, vRef) };
                    }
                }
            }
            
            if (entry.dataset_type === "graph_i_e" && entry.graph_i_e) {
                const curve = parseCurve(entry.graph_i_e);
                if (curve && curve[0]?.length > 0) {
                    const { iClean, eClean } = extractEnergyCurve(curve[0], curve[1]);
                    const e_at_i = interp1(iClean, eClean, Math.abs(I_op), true);
                    if (e_at_i !== null) return { e_J: Math.max(0, e_at_i), v_supply: entry.v_supply || V_op };
                }
            }
        }
        return { e_J: 0, v_supply: V_op };
    }

    const onRes = pickEnergy(targetData.e_on);
    const offRes = pickEnergy(targetData.e_off);

    if (onRes.e_J === 0 && offRes.e_J === 0 && sw.switching_times_reference) {
        const tr_val = sw.switching_times_reference.tr_ns ?? sw.switching_times_reference.t_r_ns;
        const tf_val = sw.switching_times_reference.tf_ns ?? sw.switching_times_reference.t_f_ns;
        
        const tr = parseFloat(tr_val) || 0;
        const tf = parseFloat(tf_val) || 0;
        const I_safe = Math.abs(I_op);

        if (tr > 0) {
            onRes.e_J = 0.5 * V_op * I_safe * (tr * 1e-9);
            onRes.v_supply = V_op;
        }
        if (tf > 0) {
            offRes.e_J = 0.5 * V_op * I_safe * (tf * 1e-9);
            offRes.v_supply = V_op;
        }
    }

    return { e_on_J: onRes.e_J, e_off_J: offRes.e_J, v_supply_on: onRes.v_supply, v_supply_off: offRes.v_supply };
}

async function optimizeSwitches(topology, V_op, I_peak, Irms, f_sw_hz, switchesData, T_op = 100, P_est = 100, smpsMode = "CCM", extraModeParams = {}) {
    let candidates = [];
    const V_MARGIN_MIN = 1.1;
    const f_sw_khz = f_sw_hz / 1000;
    
    let errorCount = 0; 

    const CHUNK_SIZE = 250;
    for (let i = 0; i < switchesData.length; i += CHUNK_SIZE) {
        const chunk = switchesData.slice(i, i + CHUNK_SIZE);

        chunk.forEach(sw => {
            if (!sw.v_abs_max || sw.v_abs_max < V_op * V_MARGIN_MIN) return;
            const voltageRatio = sw.v_abs_max / V_op;
            if (voltageRatio > 4.0) return;
            
            let safe_i_max = sw.i_cont || sw.i_abs_max || 0; 
            
            if (safe_i_max === 0) {
                let max_i = 0;
                const checkMaxI = (data) => {
                    const arr = parseCurve(data);
                    if (Array.isArray(arr)) {
                        arr.forEach(entry => {
                            const iArr = parseCurve(entry.i);
                            if (Array.isArray(iArr)) {
                                iArr.forEach(val => {
                                    if (Math.abs(val) > max_i) max_i = Math.abs(val);
                                });
                            } else if (entry.graph_v_i) {
                                const c = parseCurve(entry.graph_v_i);
                                if (c && c[1]) c[1].forEach(val => {
                                    if (Math.abs(val) > max_i) max_i = Math.abs(val);
                                });
                            }
                        });
                    }
                };
                if (sw.switch) { checkMaxI(sw.switch.channel); checkMaxI(sw.switch.e_on); }
                if (sw.diode) { checkMaxI(sw.diode.channel); checkMaxI(sw.diode.e_on); }
                
                safe_i_max = max_i > 0 ? max_i : 9999;
            }

            if (safe_i_max < I_peak * 1.05) return;

            const housingStr = (sw.housing_type || "").toLowerCase();
            const commentStr = (sw.comment || "").toLowerCase();
            const isDualBlock = housingStr.includes("dual") || housingStr.includes("asymmetric") || housingStr.includes("half-bridge") || commentStr.includes("dual asymmetric");
            
            const singleSwitchTopologies = ["buck", "boost", "buckboost", "flyback", "forward", "sepic", "cuk", "zeta"];
            const currentTopo = (topology || "").toLowerCase();
            if (singleSwitchTopologies.includes(currentTopo) && isDualBlock) {
                return; 
            }

            const typeUp = (sw.type || "").toUpperCase();

            let p_cond_W = 0, p_sw_W = 0;
            try {
                const safeIrms = Math.max(Irms, 0.01);
                const safeIpeak = Math.max(I_peak, 0.01);
                
                const cond = estimateConductionDrop(sw, T_op, safeIrms);
                if (!cond) return; 

                if (cond.type === "mosfet") p_cond_W = Math.pow(safeIrms, 2) * cond.r_ds_on;
                else p_cond_W = cond.v_drop * safeIrms; 

                const sw_e = estimateSwitchingEnergy(sw, V_op, safeIpeak, T_op);
                const onFactor = V_op / (sw_e.v_supply_on || V_op || 1);
                const offFactor = V_op / (sw_e.v_supply_off || V_op || 1);

                let e_on_multiplier = 1.0;
                let e_off_multiplier = 1.0;

                if (currentTopo === "llc") {
                    const llcModeUsed = extraModeParams?.llcMode || "at";
                    if (llcModeUsed === "above") {
                        e_on_multiplier = 0.6;  
                        e_off_multiplier = 1.0;
                    } else {
                        e_on_multiplier = 0.1;  
                        e_off_multiplier = 1.0;
                    }
                } else if (currentTopo === "dab") {
                    const dabModulation = extraModeParams?.dabMode || "sps";
                    if (dabModulation === "sps") {
                        e_on_multiplier = 0.1;  
                        e_off_multiplier = 1.0;
                    } else {
                        e_on_multiplier = 0.35; 
                        e_off_multiplier = 1.0;
                    }
                }

                let qrr_loss_W = 0;
                const hardSwitchedTopologies = ["buck", "boost", "buckboost", "forward"];

                if (smpsMode === "CCM" && hardSwitchedTopologies.includes(currentTopo)) {
                    let qrr_nC = 0;
                    if (sw.diode && sw.diode.qrr) qrr_nC = parseFloat(sw.diode.qrr);
                    else if (sw.reverse_recovery && sw.reverse_recovery.qrr_nc) qrr_nC = parseFloat(sw.reverse_recovery.qrr_nc);
                    else if (typeUp.includes("SIC") || typeUp.includes("GAN")) qrr_nC = 0;
                    else qrr_nC = Math.max(I_peak * 50, 150); 
                    
                    const qrr_C = qrr_nC * 1e-9;
                    qrr_loss_W = qrr_C * V_op * f_sw_hz; 
                }

                p_sw_W = ((sw_e.e_on_J * onFactor * e_on_multiplier) + (sw_e.e_off_J * offFactor * e_off_multiplier)) * f_sw_hz + qrr_loss_W;
                
            } catch (e) { 
                if (e instanceof TypeError || e instanceof ReferenceError) {
                    throw e; 
                }
                
                errorCount++;
                if (errorCount > 20) {
                    throw new Error(`Critical calculation error detected. Please check your circuit parameters. Detail: ${e.message}`);
                }
                console.warn(`[optimizeSwitches] Calculation skipped (Switch: ${sw.name || sw.type || 'Unknown'}): ${e.message}`);
                return; 
            }

            const p_tot_W = p_cond_W + p_sw_W;
            if (p_tot_W > 75.0) return;

            let techPenalty = 1.0;
            if (typeUp.includes("SIC") || typeUp.includes("GAN")) {
                if (P_est < 300) techPenalty = 8.0;
                else if (P_est < 800) techPenalty = 2.0;
            } else if (typeUp.includes("IGBT")) {
                techPenalty = 1.0;
                if (f_sw_khz > 50) techPenalty *= 10.0;
                if (V_op < 300) techPenalty *= 5.0;
            } else {
                if (P_est > 2000) techPenalty = 4.0;
            }

            const currentRatio = safe_i_max / Math.max(I_peak, 1);
            let currentPenalty = 1.0;
            if (currentRatio > 5.0) {
                currentPenalty = Math.max(1, Math.pow(currentRatio / 5.0, 1.3)); 
            }

            const overratingPenalty = Math.max(1, Math.pow(voltageRatio, 1.5)) * currentPenalty;
            const finalRankScore = p_tot_W * overratingPenalty * techPenalty;

            if (isNaN(p_cond_W) || isNaN(p_sw_W) || isNaN(p_tot_W) || isNaN(finalRankScore)) return;

            candidates.push({
                name: sw.name || "-", manufacturer: sw.manufacturer || "Unknown", type: sw.type || "Unknown",
                housing: sw.housing_type || "-", v_max: sw.v_abs_max, i_max: safe_i_max, p_cond_W: p_cond_W,
                p_sw_W: p_sw_W, p_tot_W: p_tot_W, rankScore: finalRankScore, link: sw.datasheet_hyperlink || "#"
            });
        });

        await new Promise(resolve => setTimeout(resolve, 0));
    }

    candidates.sort((a, b) => a.rankScore - b.rankScore);
    return candidates.slice(0, 50);
}

exports.runSmpsOptimization = onCall({
    cors: true,
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "1GiB"
}, async (request) => {
    const data = request.data;
    const {
        optMode, f_sw_khz, T_op,
        hasVeOpt, veOpt,
        hasWmax, wmax, L_H, deltaIL,
        volt_sec,
        trafoGapReq, coilGapReq,
        isFlyback, isCoilOnly, isTransformerWithCoil,
        pri_Irms, sec_Irms, coilWire_Irms,
        CMA_target, maxStrandD,
        staticDbsPayload,
        selectedManufacturer,
        hasBias, biasWire_Irms,
        isLinearTrafo,
        vin_nom, vout,
        calculateSwitches,
        sw_Irms, sw_Vmax, turnsRatio,
        topology, smpsMode, D_switch, extraModeParams
    } = data;

    try {
        const dbData = staticDbData; 
        
        let result = { trafoCores: [], coilCores: [], priWires: [], secWires: [], coilWires: [], biasWires: [], switches: [] };
        const f_sw = f_sw_khz * 1000;
        const v_in = parseFloat(vin_nom) || 24;

        if (calculateSwitches !== false && dbData.switches && dbData.switches.length > 0) {
            let availableSwitches = dbData.switches;
            if (selectedManufacturer && selectedManufacturer.trim() !== "" && selectedManufacturer.toLowerCase() !== "all") {
                const targetMfg = selectedManufacturer.toLowerCase().trim();
                const mfgFiltered = availableSwitches.filter(sw => {
                    const mfgName = (sw.manufacturer || "").toLowerCase();
                    const swName = (sw.name || "").toLowerCase();
                    return mfgName.includes(targetMfg) || swName.includes(targetMfg);
                });
                if (mfgFiltered.length > 0) availableSwitches = mfgFiltered;
            }

            let v_switch_max = sw_Vmax || v_in;
            let actual_sw_Irms = sw_Irms || pri_Irms || coilWire_Irms || 1;
            let i_peak = actual_sw_Irms * Math.SQRT2;
            let P_est = v_in * actual_sw_Irms;
            if (isNaN(P_est) || P_est <= 0) P_est = 150;

            result.switches = await optimizeSwitches(topology, v_switch_max, i_peak, actual_sw_Irms, f_sw, availableSwitches, T_op, P_est, smpsMode, extraModeParams);
        } else {
            result.switches = [];
        }

        if (hasVeOpt) {
            const trafoType = isLinearTrafo ? "linear_trafo" : "trafo";
            result.trafoCores = await optimizeCores(veOpt, optMode, "volume", L_H, f_sw, T_op, 0, volt_sec, trafoGapReq, trafoType, dbData, staticDbsPayload, pri_Irms, turnsRatio, topology, smpsMode, D_switch, extraModeParams);
            
            result.priWires = optimizeWires(pri_Irms, CMA_target, maxStrandD, dbData.wires, f_sw);
            result.secWires = optimizeWires(sec_Irms, CMA_target, maxStrandD, dbData.wires, f_sw);
        }

        if (hasWmax) {
            const cType = isFlyback ? "flyback" : "coil";
            const effective_Irms = isFlyback ? pri_Irms : coilWire_Irms;

            result.coilCores = await optimizeCores(
                wmax * 1e-6, optMode, "energy", L_H, f_sw, T_op, deltaIL, volt_sec,
                isFlyback ? trafoGapReq : coilGapReq, cType, dbData, staticDbsPayload,
                effective_Irms, turnsRatio, topology, smpsMode, D_switch, extraModeParams
            );

            if (isFlyback) {
                result.priWires = optimizeWires(pri_Irms, CMA_target, maxStrandD, dbData.wires, f_sw);
                result.secWires = optimizeWires(sec_Irms, CMA_target, maxStrandD, dbData.wires, f_sw);
                if (hasBias && biasWire_Irms > 0) result.biasWires = optimizeWires(biasWire_Irms, CMA_target, maxStrandD, dbData.wires, f_sw);
            } else {
                result.coilWires = optimizeWires(coilWire_Irms, CMA_target, maxStrandD, dbData.wires, f_sw);
            }
        }
        return sanitizeForJSON(result);

    } catch (error) {
        console.error("Server Optimization Error:", error);
        throw new HttpsError('internal', 'An error occurred during optimization: ' + error.message);
    }
});
