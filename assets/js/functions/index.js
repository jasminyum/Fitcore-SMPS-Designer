// ================================================================
// Server Section
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
            match = coreShapes.find(s => 
                s.name && s.name.replace(/[\s\-_]+/g, '').toUpperCase().startsWith(firstPart)
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

function optimizeWires(Irms, targetCMA, maxStrandD, wiresData) {
    const candidates = [];
    if (Irms <= 0) return candidates;
    if (!Array.isArray(wiresData)) return candidates;

    const safeCMA = (Number.isFinite(targetCMA) && targetCMA > 0) ? targetCMA : 400;
    const safeMaxStrandD = (Number.isFinite(maxStrandD) && maxStrandD > 0) ? maxStrandD : 5.0;

    const reqArea_mm2 = (Irms * safeCMA) / 1973.525;

    wiresData.forEach(wire => {
        const d_nom = wire.conductingDiameter?.nominal;
        if (!d_nom) return;

        const d_mm = d_nom * 1000;
        const area_mm2 = Math.PI * Math.pow(d_mm / 2, 2);
        const area_cmil = area_mm2 * 1973.525;

        if (d_mm > safeMaxStrandD) return;

        const parallelStrands = Math.ceil(reqArea_mm2 / area_mm2);
        if (parallelStrands > 300) return;

        const actualCMA = (parallelStrands * area_cmil) / Irms;

        candidates.push({
            name: wire.name,
            standard: wire.standardName || "-",
            d_mm: d_mm.toFixed(3),
            strands: parallelStrands,
            totalArea: (area_mm2 * parallelStrands).toFixed(3),
            cma: Math.round(actualCMA),
            coating: wire.coating?.type || "Emaye"
        });
    });

    candidates.sort((a, b) => {
        const diffA = Math.abs(a.cma - safeCMA) + (a.strands * 2);
        const diffB = Math.abs(b.cma - safeCMA) + (b.strands * 2);
        return diffA - diffB;
    });

    return candidates.slice(0, 5);
}

const SteinmetzParams = {
    // === DÜŞÜK FREKANS GRUBU (< 200 kHz) ===
    // Birim Standardı: f -> Hz, B -> Tesla, Pv -> W/m³
    "3c92": { k: 0.115, alpha: 1.58, beta: 2.75 },
    "n41":  { k: 0.142, alpha: 1.25, beta: 2.52 },
    "3c81": { k: 0.085, alpha: 1.45, beta: 2.70 },
    "3c90": { k: 0.160, alpha: 1.46, beta: 2.75 }, 
    "3c94": { k: 0.125, alpha: 1.48, beta: 2.75 },

    // === ORTA FREKANS GRUBU (100 kHz - 500 kHz) ===
    "3c91": { k: 0.068, alpha: 1.59, beta: 2.71 },
    "3c95": { k: 0.092, alpha: 1.51, beta: 2.80 },
    "3c96": { k: 0.071, alpha: 1.63, beta: 2.68 },
    "3c97": { k: 0.062, alpha: 1.64, beta: 2.65 },
    "n72":  { k: 0.025, alpha: 1.65, beta: 2.45 },  
    "pc47": { k: 0.052, alpha: 1.46, beta: 2.64 },
    "pc95": { k: 0.041, alpha: 1.48, beta: 2.68 },   
    "n27":  { k: 0.018, alpha: 1.65, beta: 2.58 },  
    "n30":  { k: 0.021, alpha: 1.65, beta: 2.58 },  
    "n87":  { k: 0.015, alpha: 1.68, beta: 2.35 },  
    "n97":  { k: 0.011, alpha: 1.71, beta: 2.40 },  
    "n92":  { k: 0.012, alpha: 1.68, beta: 2.42 },  
    "n95":  { k: 0.009, alpha: 1.72, beta: 2.45 },  

    // === YÜKSEK FREKANS GRUBU (500 kHz - 1 MHz) ===
    "3f3":  { k: 0.022, alpha: 1.95, beta: 2.55 },
    "3f35": { k: 0.015, alpha: 2.10, beta: 2.50 },
    "3f36": { k: 0.016, alpha: 2.12, beta: 2.50 },  
    "n49":  { k: 0.019, alpha: 1.70, beta: 2.50 },
    "n88":  { k: 0.014, alpha: 1.85, beta: 2.45 }, 

    // === ULTRA YÜKSEK FREKANS GRUBU (> 1 MHz) ===
    "3f4":  { k: 0.008, alpha: 2.35, beta: 2.45 },
    "3f45": { k: 0.005, alpha: 2.50, beta: 2.40 },
    "3f46": { k: 0.003, alpha: 2.62, beta: 2.38 },  
    "pc200":{ k: 0.002, alpha: 2.68, beta: 2.34 },  
    "4f1":  { k: 0.0004, alpha: 3.05, beta: 2.24 }, 
          
    // === TOZ METAL ÇEKİRDEKLER (Magnetics / Micrometals SI Dönüşümü) ===
    "kool mu ultra": { k: 0.450, alpha: 1.58, beta: 2.20 },
    "kool mu":       { k: 0.680, alpha: 1.54, beta: 2.21 },
    "sendust":       { k: 0.680, alpha: 1.54, beta: 2.21 },
    "edge":          { k: 0.380, alpha: 1.62, beta: 2.18 },
    "mpp":           { k: 0.290, alpha: 1.52, beta: 2.15 },
    "high flux":     { k: 0.850, alpha: 1.48, beta: 2.24 },
    "xflux":         { k: 1.120, alpha: 1.45, beta: 2.30 },
    "xflux ultra":   { k: 0.940, alpha: 1.50, beta: 2.26 },
          
    // === DEMİR TOZU ÇEKİRDEKLER ===
    "mix 26":  { k: 3.550, alpha: 1.25, beta: 2.11 },
    "mix 52":  { k: 2.450, alpha: 1.38, beta: 2.14 },
    "mix 2":   { k: 1.850, alpha: 1.44, beta: 2.15 },
    "mix 8":   { k: 0.950, alpha: 1.55, beta: 2.18 },
    "mix 18":  { k: 0.820, alpha: 1.58, beta: 2.19 },
    "default": { k: 0.250, alpha: 1.30, beta: 2.50 }
};



const iaCache = {};
function calculate_Ia(alpha, beta) {
    const cacheKey = `${alpha.toFixed(3)}_${beta.toFixed(3)}`; // Güvenli cache key zinciri
    if (iaCache[cacheKey]) return iaCache[cacheKey];

    let sum = 0;
    const steps = 2000; // iGSE geçiş keskinliği için çözünürlük artırıldı
    const dTheta = (2 * Math.PI) / steps; // Tam periyot (0 - 2pi) integral hesabı
    
    for (let i = 0; i < steps; i++) {
        let theta = i * dTheta;
        sum += Math.pow(Math.abs(Math.cos(theta)), alpha) * dTheta;
    }
    
    // Literatürdeki tam integral çarpanı: (2*pi)^(alpha-1) paydada yer alacak şekilde normalize edilir
    const result = sum; 
    iaCache[cacheKey] = result;
    return result;
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
                const estD = Math.min(0.95, 0.5 + Math.abs(1 - fr_ratio) * 0.3);
                return { D1: estD, D2: 1 - estD, confidence: "medium", note: "Below resonance LLC: continuous flux with varying slopes." };
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

function calculateLoss_iGSE_Dynamic(k_steinmetz, alpha, beta, f_kHz, Bac_mT, T_op, wfMeta = {}) {
    const K_t = 1 + Math.pow((T_op - 90) / 40, 2);
    const I_a = calculate_Ia(alpha, beta);
    const k_i = k_steinmetz / (Math.pow(2, beta - alpha) * Math.pow(2 * Math.PI, alpha - 1) * I_a);
    
    const delta_B_Tesla = (Bac_mT * 2) / 1000;
    const f_Hz = f_kHz * 1000; 
    
    const D1 = Math.max(0.001, Math.min(0.999, wfMeta.D1 ?? 0.5));
    const D2 = Math.max(0.001, Math.min(0.999, wfMeta.D2 ?? 0.5));
    
    // Simetrik olmayan uyarım dalga çarpanı
    const waveform_factor = Math.pow(D1, 1 - alpha) + Math.pow(D2, 1 - alpha);

    // DÜZELTİLDİ: beta yerine (beta - alpha) üssü getirilerek iGSE denklemi doğrulandı
    const Pv_W_m3 = k_i * Math.pow(delta_B_Tesla, beta - alpha) * Math.pow(f_Hz, alpha) * waveform_factor * K_t;
    const Pv_mW_cm3 = Pv_W_m3 * 0.001; // 1 W/m3 = 0.001 mW/cm3

    return {
        Pv_mW_cm3: Number.isFinite(Pv_mW_cm3) && Pv_mW_cm3 > 0 ? Pv_mW_cm3 : 0.1,
        breakdown: {
            k: k_steinmetz, alpha, beta, I_a: I_a.toFixed(4), k_i: k_i.toExponential(4),
            K_t: K_t.toFixed(3), delta_B_T: delta_B_Tesla.toFixed(4), f_kHz: f_kHz.toFixed(1),
            D_used: `D1:${D1.toFixed(3)}, D2:${D2.toFixed(3)}`, waveform_factor: waveform_factor.toFixed(4),
            confidence: wfMeta.confidence || "high", note: wfMeta.note || "", final_Pv: Pv_mW_cm3.toFixed(2)
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

    const CHUNK_SIZE = 250;
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

            const Wmax_core_J = 0.5 * Math.pow(dynamic_B_sat_T, 2) * Aele / mu0e;

            if (componentType === "linear_trafo") {
                const Ve_mm3 = Aele * 1e9;
                actualReqVal = reqVal; 
                if (Ve_mm3 >= reqVal) {
                    N1_calc = Math.max(1, Math.ceil(Math.sqrt(L_H / AL)));
                    const I1_peak = pri_Irms * Math.SQRT2;
                    Bmax_calc_mT = ((AL * N1_calc * I1_peak) / Ae) * 1000;
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

                    const B_peak_T = (L_H * I_peak_est) / (N1_calc * Amin);
                    if (deltaIL > 0) {
                        Bmax_calc_mT = ((L_H * deltaIL) / (N1_calc * Ae) / 2) * 1000;
                    } else {
                        Bmax_calc_mT = (B_peak_T / 2) * 1000;
                    }
                    if (B_peak_T <= dynamic_B_sat_T) isValid = true;
                }
            } else if (type === "volume") {
                const Ve_mm3 = Aele * 1e9;
                actualReqVal = reqVal;
                if (Ve_mm3 >= reqVal) {
                    const deltaB_limit_T = Math.min(dynamic_B_sat_T, 0.2 * Math.pow(50000 / f_sw_hz, 0.6));
                    if (volt_sec > 0) {
                        N1_calc = Math.ceil(volt_sec / (deltaB_limit_T * Ae));
                        Bmax_calc_mT = Math.round(((volt_sec / (N1_calc * Ae)) / 2) * 1000);
                    } else {
                        Bmax_calc_mT = Math.round((deltaB_limit_T / 2) * 1000);
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

                if (w_width > 0 && w_height > 0) Aw_mm2 = w_width * w_height;
                else return;

                let J_target = getCurrentDensity(f_kHz);
                
                if (volume_cm3 < 3.0) J_target *= 1.25; 
                else if (volume_cm3 > 15.0) J_target *= 0.85; 

                let primary_Cu_mm2 = N1_calc * (Math.max(pri_Irms, 0.1) / J_target);
                let total_Cu_mm2 = primary_Cu_mm2;
                if (componentType.includes("trafo") || componentType.includes("flyback")) {
                    total_Cu_mm2 = primary_Cu_mm2 * 2;
                }

                const Ku = 0.40; 
                if (total_Cu_mm2 > (Aw_mm2 * Ku)) isValid = false; 

                // --- Gerçek (DC direnç bazlı) bakır kaybı hesabı ---
                // MLT (Mean Length per Turn) tahmini: orta bacak/bobin kesitini Ae'ye eşdeğer
                // kare kabul edip çevresini alıyoruz, sonra sarım yığınının ortalama yarıçap
                // kadar (w_width/2) dışa taştığını varsayıyoruz. Sabit bir mesafeyle (r) dışa
                // ofsetlenen herhangi bir dışbükey kesitin çevresi tam olarak 2*pi*r kadar
                // artar (şekilden bağımsız geometrik özellik); r = w_width/2 için bu pi*w_width'e
                // eşitlenir.
                const Ae_mm2_est = Ae * 1e6;
                const legPerimeter_mm = 4 * Math.sqrt(Ae_mm2_est);
                const MLT_mm = legPerimeter_mm + Math.PI * w_width;
                const MLT_m = MLT_mm / 1000;

                const RHO_CU_20C = 1.68e-8; // ohm*m, 20°C bakır özdirenci
                const ALPHA_CU = 0.00393;   // 1/°C, bakır direnç sıcaklık katsayısı
                const rho_cu_T = RHO_CU_20C * (1 + ALPHA_CU * (T_op - 20));

                // Sargı teli, akım yoğunluğu J_target'a göre boyutlandırıldığından
                // (a_tel = I / J_target), tek bir sarımın direnci R = rho * MLT / a_tel
                // = rho * MLT * J_target / I olur. Kayıp P = I^2 * R = I * J_target * rho * MLT
                // şeklinde sadeleşir (J_target birimi A/mm^2 olduğundan A/m^2'ye çevirmek için
                // *1e6 uygulanır). N1_calc sarım için toplamda bu değerin N1_calc katı alınır.
                const safe_pri_Irms = Math.max(pri_Irms, 0.05);
                copper_loss_W = N1_calc * safe_pri_Irms * rho_cu_T * MLT_m * J_target * 1e6;

                if ((componentType.includes("trafo") || componentType.includes("flyback")) && turnsRatio > 0) {
                    // İzole (trafo/flyback) tasarımlarda ikincil sargı kaybı da eklenir.
                    // n2 sarım sayısı tahmini, ilerideki n2_calc ile aynı formülü kullanır.
                    // İkincil akım, amper-sarım dengesiyle kabaca I2 ≈ I1 * (N1/N2) = I1 * turnsRatio
                    // olarak tahmin edilir (mıknatıslanma akımı ihmal edilir).
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

            const material = core.functionalDescription?.material || 'Unknown';
            const matKey = material.toLowerCase();
            let matParams = SteinmetzParams["default"];
            let bestKeyLen = -1;
            for (const key in SteinmetzParams) {
                if (matKey.includes(key) && key.length > bestKeyLen) {
                    matParams = SteinmetzParams[key];
                    bestKeyLen = key.length;
                }
            }

            const wf = getEffectiveWaveformParams(topology, smpsMode, D_switch, extraModeParams);
            const igseResult = calculateLoss_iGSE_Dynamic(matParams.k, matParams.alpha, matParams.beta, f_kHz, Bmax_calc_mT, T_op, wf);
            const Pv_mW_cm3 = igseResult.Pv_mW_cm3;

            const core_loss_W = (Pv_mW_cm3 * volume_cm3) / 1000;
            const lossFactor = core_loss_W * (Pv_mW_cm3 > 600 ? 50 : 1);
            // Gerçek toplam kayıp: nüve (lossFactor, aşırı akı yoğunluğu cezası dahil) + gerçek
            // bakır kaybı. Verimlilik skorlaması (scoreEff) artık bunu kullanır.
            const totalLossW = lossFactor + copper_loss_W;

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

			candidates.push({
                name: core.name || shapeName,
                mfgName: core.manufacturerInfo?.name || core.manufacturer || core.brand || "Unknown",
                componentType: componentType,
                material: material,
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
                lossFactor: lossFactor,
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
                windowAreaSource: "dims"
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

    // --- FIX (normalizasyon / outlier hatası) ---
    // minLoss ve minVol, TÜM adaylar (aşırı büyük ve kullanım oranı çok düşük nüveler dahil)
    // üzerinden hesaplanıyordu. Kullanım oranı ~%10-11 olan devasa bir nüve, sırf toplam kaybı
    // düşük diye "minLoss" referansı haline geliyor ve normal/uygun boyuttaki nüvelerin
    // scoreEff değerini neredeyse sıfıra çekiyordu. Bu yüzden baseline'ı, makul bir kullanım
    // oranına (>= %15) sahip adaylardan hesaplıyoruz. Hiçbir aday bu şartı sağlamıyorsa
    // (çok dar bir arama uzayı varsa) tüm adaylara geri dönülür.
    let robustMinLoss = Infinity, robustMinVol = Infinity;
    candidates.forEach(c => {
        if (c.utilizationRatio >= 0.15) {
            if (c.totalLossW < robustMinLoss) robustMinLoss = c.totalLossW;
            if (c.volume < robustMinVol) robustMinVol = c.volume;
        }
    });
    if (robustMinLoss === Infinity) robustMinLoss = minLoss;
    if (robustMinVol === Infinity) robustMinVol = minVol;

    // --- FIX (bakır kaybının ihmal edilmesi) ---
    // scoreEff artık yalnızca nüve (iron) kaybına değil, her adayın gerçek DC direnç bazlı
    // bakır kaybı (MLT, akım yoğunluğu ve sıcaklığa bağlı özdirenç üzerinden hesaplanan
    // copper_loss_W) ile birleştirilmiş c.totalLossW değerine bakıyor. Böylece "high_eff" modu
    // artık sadece nüve kaybını sıfırlayan devasa nüveleri değil, gerçekte en düşük toplam
    // (nüve + bakır) kayba sahip nüveyi öne çıkarır.
    candidates.forEach(c => {
        let scoreCost = 0.01;

        if (c.costPerUnit !== 999 && c.costPerUnit > 0 && logDiff > 0) {
            const logPrice = Math.log(c.costPerUnit);
            scoreCost = Math.max(0.01, (logMax - logPrice) / logDiff);
        }

        const scoreEff = (robustMinLoss + BASE_LOSS_W) / (c.totalLossW + BASE_LOSS_W);
        const scoreSize = robustMinVol / c.volume;

        // --- FIX (cezanın çok geç devreye girmesi) ---
        // Eskiden ceza yalnızca kullanım oranı %10'un ALTINA düşünce başlıyordu; yani
        // ihtiyacın 9 katı büyüklüğündeki bir nüve (%11 kullanım) hiç ceza almıyordu. Artık
        // ceza %40 kullanım oranından itibaren kademeli olarak devreye giriyor ve %10'a kadar
        // sertleşiyor (aynı alt sınır olan 0.1 çarpanı korunuyor).
        let overSizePenalty = 1.0;
        if (c.utilizationRatio < 0.4) {
            overSizePenalty = Math.max(0.1, c.utilizationRatio * 2.5);
        }

        let matSuitability = 1.0;
        let matNote = "";
        const matKey = c.material.toLowerCase();
        
        if (matKey.includes("n27") || matKey.includes("n30") || matKey.includes("3c81")) {
            if (f_kHz <= 50) { matSuitability = 1.0; }
            else if (f_kHz >= 150) { matSuitability = 0.4; }
            else { matSuitability = 1.0 - ((f_kHz - 50) / 100) * 0.6; }
            
            if (matSuitability < 0.9) matNote = ` Material is not ideal for high frequencies (>50kHz), approaching manufacturer limits (Safety multiplier: ${matSuitability.toFixed(2)}).`;
        } 
        else if (matKey.includes("n87") || matKey.includes("n97") || matKey.includes("3c90") || matKey.includes("3c94")) {
            if (f_kHz >= 50 && f_kHz <= 300) { matSuitability = 1.2; matNote = " Most ideal material range for this operating frequency (Suitability bonus: 1.20)."; }
            else if (f_kHz < 50) { matSuitability = 1.0 + (f_kHz / 50) * 0.2; } 
            else if (f_kHz > 300 && f_kHz <= 500) { matSuitability = 1.2 - ((f_kHz - 300) / 200) * 0.2; }
            else { matSuitability = 1.0; }
        } 
        else if (matKey.includes("3f") || matKey.includes("n49") || matKey.includes("n88")) {
            if (f_kHz >= 300) { matSuitability = 1.3; matNote = " Special and ideal material for high frequency (Suitability bonus: 1.30)."; }
            else if (f_kHz <= 50) { matSuitability = 0.6; matNote = " Unnecessarily expensive/unsuitable material for low frequencies, performance cannot be fully utilized (Multiplier: 0.60)."; }
            else { matSuitability = 0.6 + ((f_kHz - 50) / 250) * 0.7; }
        }

        if (c.igseBreakdown) {
            c.igseBreakdown.note = (c.igseBreakdown.note || "") + matNote;
            if (overSizePenalty < 1.0) {
                c.igseBreakdown.note += ` Core capacity is well above the design target, unnecessary volume penalty applied (Multiplier: ${overSizePenalty.toFixed(2)}).`;
            }
            c.igseBreakdown.note += ` Loss breakdown: core ${c.coreLossW.toFixed(3)}W + copper ${c.copperLossW.toFixed(3)}W = ${c.totalLossW.toFixed(3)}W total.`;
        }

		let rawFuzzyScore = ((weights.cost * scoreCost) + (weights.size * scoreSize) + (weights.eff * scoreEff)) * 100;
        c.fuzzyScore = Math.min(100, rawFuzzyScore * matSuitability * overSizePenalty);
    });

    candidates.sort((a, b) => b.fuzzyScore - a.fuzzyScore);
    return candidates.slice(0, 30);
}

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

async function optimizeSwitches(topology, V_op, I_peak, Irms, f_sw_hz, switchesData, T_op = 100, P_est = 100, smpsMode = "CCM") {
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

                if (currentTopo === "dab" || currentTopo === "llc") {
                    e_on_multiplier = 0.1;  // ZVS
                    e_off_multiplier = 0.8; 
                }

                let qrr_loss_W = 0;
                const hardSwitchedTopologies = ["buck", "boost", "buckboost", "forward"];

                if (smpsMode === "CCM" && hardSwitchedTopologies.includes(currentTopo)) {
                    let qrr_nC = 0;
                    if (sw.diode && sw.diode.qrr) {
                        qrr_nC = parseFloat(sw.diode.qrr);
                    } else if (sw.reverse_recovery && sw.reverse_recovery.qrr_nc) {
                        qrr_nC = parseFloat(sw.reverse_recovery.qrr_nc);
                    } else if (typeUp.includes("SIC") || typeUp.includes("GAN")) {
                        qrr_nC = 0;
                    } else {
                        qrr_nC = Math.max(I_peak * 50, 150); 
                    }
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
            if (p_tot_W > (P_est * 2)) return;

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

        await new Promise(resolve => setImmediate(resolve));
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

            result.switches = await optimizeSwitches(topology, v_switch_max, i_peak, actual_sw_Irms, f_sw, availableSwitches, T_op, P_est, smpsMode);
        } else {
            result.switches = [];
        }

        if (hasVeOpt) {
            const trafoType = isLinearTrafo ? "linear_trafo" : "trafo";
            result.trafoCores = await optimizeCores(veOpt, optMode, "volume", L_H, f_sw, T_op, 0, volt_sec, trafoGapReq, trafoType, dbData, staticDbsPayload, pri_Irms, turnsRatio, topology, smpsMode, D_switch, extraModeParams);
            result.priWires = optimizeWires(pri_Irms, CMA_target, maxStrandD, dbData.wires);
            result.secWires = optimizeWires(sec_Irms, CMA_target, maxStrandD, dbData.wires);
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
                result.priWires = optimizeWires(pri_Irms, CMA_target, maxStrandD, dbData.wires);
                result.secWires = optimizeWires(sec_Irms, CMA_target, maxStrandD, dbData.wires);
                if (hasBias && biasWire_Irms > 0) result.biasWires = optimizeWires(biasWire_Irms, CMA_target, maxStrandD, dbData.wires);
            } else {
                result.coilWires = optimizeWires(coilWire_Irms, CMA_target, maxStrandD, dbData.wires);
            }
        }
        return sanitizeForJSON(result);

    } catch (error) {
        console.error("Server Optimization Error:", error);
        throw new HttpsError('internal', 'An error occurred during optimization: ' + error.message);
    }
});
