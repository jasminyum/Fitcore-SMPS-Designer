// ================================================================
// Magnetic Core Database (4 Categories - Unified with Original Formats)
// ================================================================
const CoreDB = {
    // Otomatik Sýralama ve ID Atama Fonksiyonu
    _sortAndAssignIDs: function (arr) {
        // Eðer dizinin ilk elemaný bir sayýysa (eski atanmýþ ID), onu kesip salt veriyi alýyoruz.
        let raw = arr.map(item => typeof item[0] === 'number' ? item.slice(1) : item);

        // Core adýna göre alfabetik sýralama (isimler aynýysa 2. parametreye göre)
        raw.sort((a, b) => {
            let c1 = String(a[0]).toLowerCase();
            let c2 = String(b[0]).toLowerCase();
            if (c1 === c2) {
                let i1 = String(a[1]).toLowerCase();
                let i2 = String(b[1]).toLowerCase();
                return i1.localeCompare(i2, undefined, { numeric: true });
            }
            return c1.localeCompare(c2, undefined, { numeric: true });
        });

        // Orijinal diziyi sýfýrla ve ID'lerle birlikte yeniden oluþtur (ID'ler 1'den baþlar)
        arr.length = 0;
        raw.forEach((item, index) => {
            arr.push([index + 1, ...item]);
        });
    },

    // 1. SMPS Trafolarý (Forward, Push-Pull, Full/Half Bridge vb. Ýçin) - 5 Kolon
    // Format: [Core, Manu, Amin(mm2), Ve(mm3)] (ID'ler otomatik atanacak)
    smpsTrafoCores: [
        ["ETD29", "TDK", 71, 5350], ["ETD34", "TDK", 92, 7630],
        ["ETD39", "TDK", 123, 11500], ["ETD44", "TDK", 172, 17800],
        ["ETD49", "TDK", 209, 24100], ["ETD54", "TDK", 280, 35600],
        ["ETD59", "TDK", 368, 51200], ["E13/7/4", "TDK", 12.6, 367],
        ["E16/8/5", "TDK", 19.4, 756], ["E20/10/6", "TDK", 32, 1490],
        ["E25/13/7", "TDK", 52, 3020], ["E30/15/7", "TDK", 49, 4000],
        ["E32/16/9", "TDK", 82, 6140], ["E36/18/11", "TDK", 112, 9670],
        ["E42/21/15", "TDK", 175, 17600], ["E42/21/20", "TDK", 229, 22700],
        ["E47/20/16", "TDK", 226, 20700], ["E55/28/21", "TDK", 351, 43900],
        ["E55/28/25", "TDK", 420, 52100], ["E56/24/19", "TDK", 327, 36400],
        ["E65/32/27", "TDK", 529, 78600], ["E70/33/32", "TDK", 676, 102000],
        ["E80/38/20", "TDK", 338, 71800], ["2xU10/8/3", "Ferroxcube", 8, 330],
        ["2xU15/11/6", "TDK", 32, 1540], ["2xU17/12/7", "TDK", 32, 1700],
        ["2xU20/16/7", "TDK", 55, 3740], ["2xU21/17/12", "TDK", 66, 5390],
        ["2xU25/20/13", "TDK", 105, 9030], ["2xU26/22/16", "TDK", 129, 12800],
        ["2xU30/25/16", "Ferroxcube", 150, 17400], ["2xU30/26/26", "TDK", 265, 31300],
        ["2xU93/76/16", "TDK", 448, 159000], ["UI93/104/16", "TDK", 448, 116000],
        ["2xU93/76/20", "TDK", 560, 198000], ["UI93/104/20", "TDK", 560, 144000],
        ["2xU93/76/30", "TDK", 840, 297000], ["UI93/104/30", "TDK", 840, 217000],
        ["PM50/39", "TDK", 280, 31000], ["PM62/49", "TDK", 470, 62000],
        ["PM74/59", "TDK", 630, 101000], ["PM87/70", "TDK", 700, 133000],
        ["PM114/93", "TDK", 1380, 344000], ["RM4 LP", "TDK", 11.3, 251],
        ["RM5 LP", "TDK", 18, 430], ["RM6 LP", "TDK", 31.2, 820],
        ["RM7 LP", "TDK", 39.6, 1060], ["RM8 LP", "TDK", 55.4, 1860],
        ["RM10 LP", "TDK", 93.3, 3360], ["RM12 LP", "TDK", 124.7, 6195],
        ["RM14 LP", "TDK", 170, 10230], ["PQ20/20", "TDK", 62, 3320],
        ["PQ26/25", "TDK", 118, 6530], ["PQ32/30", "TDK", 161, 10300],
        ["PQ35/35", "TDK", 196, 14400], ["PQ40/40", "TDK", 201, 19800],
        ["PQ50/50", "TDK", 328, 32900], ["E-PLT38", "Planar", 194, 9150]
    ],

    // 2. Standart Bobinler ve Ýndüktörler - 8 Kolon
    // Format: [Core, Ident, Manu, AL(nH), Ae(mm2), le(mm), Amin(mm2)] (ID'ler otomatik atanacak)
    inductorCores: [
        ["ETD29", 0.2, "TDK", 383, 76, 70, 71], ["ETD29", 0.5, "TDK", 201, 76, 70, 71],
        ["ETD29", 1.0, "TDK", 124, 76, 70, 71], ["ETD34", 0.5, "TDK", 251, 97, 79, 92],
        ["ETD34", 1.0, "TDK", 153, 97, 79, 92], ["ETD39", 0.5, "TDK", 326, 125, 92, 123],
        ["ETD39", 1.0, "TDK", 196, 125, 92, 123], ["ETD44", 0.5, "TDK", 438, 173, 103, 172],
        ["ETD44", 1.0, "TDK", 262, 173, 103, 172], ["ETD44", 1.5, "TDK", 194, 173, 103, 172],
        ["ETD49", 0.5, "TDK", 525, 211, 114, 209], ["ETD49", 1.0, "TDK", 314, 211, 114, 209],
        ["ETD49", 2.0, "TDK", 188, 211, 114, 209], ["ETD54", 1.0, "TDK", 393, 280, 127, 280],
        ["ETD54", 1.5, "TDK", 287, 280, 127, 280], ["ETD54", 2.0, "TDK", 229, 280, 127, 280],
        ["ETD59", 1.0, "TDK", 508, 368, 139, 368], ["ETD59", 1.5, "TDK", 381, 368, 139, 368],
        ["ETD59", 2.0, "TDK", 311, 368, 139, 368], ["E13/7/4", 0.04, "TDK", 250, 12, 30, 12],
        ["E16/8/5", 0.1, "TDK", 212, 20, 38, 19], ["E16/8/5", 0.5, "TDK", 69, 20, 38, 19],
        ["E20/10/6", 0.25, "TDK", 162, 32, 46, 32], ["E20/10/6", 0.5, "TDK", 100, 32, 46, 32],
        ["E25/13/7", 0.25, "TDK", 250, 52, 58, 52], ["E25/13/7", 0.5, "TDK", 151, 52, 58, 52],
        ["E25/13/7", 1.0, "TDK", 91, 52, 58, 52], ["E30/15/7", 0.18, "TDK", 300, 60, 67, 49],
        ["E30/15/7", 0.34, "TDK", 195, 60, 67, 49], ["E32/16/9", 0.5, "TDK", 244, 83, 74, 81],
        ["E32/16/9", 1.0, "TDK", 145, 83, 74, 81], ["E36/18/11", 0.5, "TDK", 312, 120, 81, 112],
        ["E36/18/11", 1.0, "TDK", 183, 120, 81, 112], ["E42/21/15", 0.5, "TDK", 454, 178, 97, 175],
        ["E42/21/15", 0.64, "TDK", 378, 178, 97, 175], ["E42/21/15", 1.0, "TDK", 272, 178, 97, 175],
        ["E42/21/15", 1.5, "TDK", 201, 178, 97, 175], ["E42/21/20", 0.5, "TDK", 603, 234, 97, 229],
        ["E42/21/20", 1.0, "TDK", 354, 234, 97, 229], ["E42/21/20", 1.5, "TDK", 259, 234, 97, 229],
        ["E55/28/21", 1.0, "TDK", 496, 354, 124, 351], ["E55/28/21", 1.5, "TDK", 364, 354, 124, 351],
        ["E55/28/21", 2.0, "TDK", 292, 354, 124, 351], ["E65/32/27", 1.0, "TDK", 716, 535, 147, 529],
        ["E65/32/27", 1.5, "TDK", 526, 535, 147, 529], ["E70/33/32", 1.5, "TDK", 655, 683, 149, 676],
        ["E80/38/20", 1.5, "TDK", 329, 390, 184, 388], ["PM50/39", 2.0, "TDK", 250, 370, 84, 280],
        ["PM62/49", 2.6, "TDK", 315, 570, 109, 470], ["PM74/59", 3.8, "TDK", 315, 790, 128, 630],
        ["PM87/70", 3.5, "TDK", 400, 910, 146, 700], ["PM114/93", 3.8, "TDK", 630, 1720, 200, 1380],
        ["RM12", 0.7, "TDK", 250, 146, 57, 125], ["RM12", 1.3, "TDK", 160, 146, 57, 125],
        ["RM14", 1.0, "TDK", 250, 200, 70, 170], ["RM14", 1.9, "TDK", 160, 200, 70, 170],
        ["R4", "K1", "TDK", 13, 1, 10, 1], ["R4", "M33", "TDK", 123, 1, 10, 1],
        ["R6,3", "K1", "TDK", 20, 3, 15, 3], ["R6,3", "M33", "TDK", 190, 3, 15, 3],
        ["R6,3", "N47", "TDK", 355, 3, 15, 3], ["R10", "K1", "TDK", 33, 8, 24, 8],
        ["R10", "M33", "TDK", 308, 8, 24, 8], ["R10", "N47", "TDK", 570, 8, 24, 8],
        ["R12,5", "N47", "TDK", 715, 12, 30, 12], ["PQ20/20", 0.5, "TDK", 4120, 62, 45, 62],
        ["PQ26/25", 0.5, "TDK", 6010, 118, 55, 118], ["PQ32/30", 0.5, "TDK", 7450, 161, 64, 161],
        ["PQ35/35", 0.5, "TDK", 8120, 196, 73, 196], ["PQ40/40", 0.5, "TDK", 8850, 201, 98, 201],
        ["PQ50/50", 0.5, "TDK", 10200, 328, 100, 328], ["E-PLT38", 0.5, "Planar", 6500, 194, 47, 194]
    ],
    flybackCores: [],
    linearTrafoCores: []
};

const linearExtra = [
    ["EI-42 Sac", 0.0, "Standart", 1200, 160, 65, 160], ["EI-48 Sac", 0.0, "Standart", 1800, 240, 80, 240],
    ["EI-54 Sac", 0.0, "Standart", 2500, 320, 95, 320], ["EI-60 Sac", 0.0, "Standart", 3400, 420, 110, 420],
    ["EI-66 Sac", 0.0, "Standart", 4500, 520, 130, 520], ["EI-75 Sac", 0.0, "Standart", 5500, 680, 145, 680],
    ["EI-78 Sac", 0.0, "Standart", 6000, 750, 155, 750], ["EI-84 Sac", 0.0, "Standart", 6800, 840, 165, 840],
    ["EI-96 Sac", 0.0, "Standart", 9200, 1150, 190, 1150], ["EI-105 Sac", 0.0, "Standart", 12500, 1450, 210, 1450],
    ["EI-114 Sac", 0.0, "Standart", 16000, 1850, 240, 1850], ["EI-120 Sac", 0.0, "Standart", 19500, 2200, 260, 2200],
    ["EI-135 Sac", 0.0, "Standart", 26000, 2900, 310, 2900], ["EI-150 Sac", 0.0, "Standart", 35000, 3800, 370, 3800],
    ["PQ20/16", 0.5, "TDK", 3650, 54, 41, 54], ["PQ26/20", 0.5, "TDK", 5210, 95, 49, 95],
    ["PQ32/20", 0.5, "TDK", 6120, 124, 55, 124], ["EFD15", 0.25, "TDK", 640, 15, 34, 12],
    ["EFD20", 0.25, "TDK", 1020, 31, 42, 28], ["EFD25", 0.5, "TDK", 1580, 58, 56, 51],
    ["EFD30", 0.5, "TDK", 2100, 89, 68, 80], ["U15/11/6", 0.5, "TDK", 180, 42, 55, 40],
    ["U20/16/7", 0.5, "TDK", 290, 78, 68, 75], ["U25/20/13", 1.0, "TDK", 420, 160, 85, 150],
    ["U30/26/16", 1.0, "TDK", 610, 290, 110, 275], ["Toroid T16/9/5", 0.0, "Epcos", 1100, 12, 35, 12],
    ["Toroid T22/14/8", 0.0, "Epcos", 2300, 30, 48, 30], ["Toroid T25/15/10", 0.0, "Epcos", 3150, 52, 54, 52],
    ["Toroid T38/19/13", 0.0, "Epcos", 4850, 110, 72, 110], ["Toroid T50/30/20", 0.0, "Epcos", 7400, 195, 95, 195],
    ["EI-162 Sac", 0.0, "Standart", 44000, 4600, 410, 4600], ["EI-180 Sac", 0.0, "Standart", 58000, 5900, 460, 5900],
    ["EI-192 Sac", 0.0, "Standart", 72000, 7100, 510, 7100], ["UI-30 Sac", 0.0, "Standart", 2100, 290, 85, 290],
    ["UI-39 Sac", 0.0, "Standart", 3900, 480, 115, 480], ["UI-48 Sac", 0.0, "Standart", 6200, 750, 140, 750],
    ["UI-60 Sac", 0.0, "Standart", 9800, 1200, 185, 1200], ["UI-75 Sac", 0.0, "Standart", 16500, 2100, 230, 2100],
    ["UI-90 Sac", 0.0, "Standart", 24000, 3100, 280, 3100], ["UI-120 Sac", 0.0, "Standart", 43000, 5400, 390, 5400],
    ["UI-150 Sac", 0.0, "Standart", 68000, 8200, 510, 8200], ["C-Core C10", 0.0, "Premium-GO", 1850, 220, 75, 220],
    ["C-Core C20", 0.0, "Premium-GO", 3200, 390, 95, 390], ["C-Core C35", 0.0, "Premium-GO", 5100, 610, 125, 610],
    ["C-Core C50", 0.0, "Premium-GO", 7300, 880, 160, 880], ["C-Core C85", 0.0, "Premium-GO", 11200, 1350, 210, 1350],
    ["C-Core C150", 0.0, "Premium-GO", 18500, 2300, 295, 2300], ["C-Core C300", 0.0, "Premium-GO", 33000, 4100, 420, 4100],
    ["EE-20 Sac", 0.0, "Standart", 320, 42, 25, 42], ["EE-25 Sac", 0.0, "Standart", 480, 65, 32, 65],
    ["EE-30 Sac", 0.0, "Standart", 750, 98, 45, 98], ["EE-35 Sac", 0.0, "Standart", 1100, 145, 58, 145],
    ["3EI-60 Trifaze", 0.0, "3-Phase", 7800, 950, 160, 950], ["3EI-75 Trifaze", 0.0, "3-Phase", 12500, 1550, 210, 1550],
    ["3EI-90 Trifaze", 0.0, "3-Phase", 19200, 2400, 265, 2400], ["3EI-114 Trifaze", 0.0, "3-Phase", 31000, 3900, 340, 3900],
    ["3EI-135 Trifaze", 0.0, "3-Phase", 48500, 6100, 420, 6100], ["3EI-150 Trifaze", 0.0, "3-Phase", 64000, 8100, 490, 8100],
    ["3EI-180 Trifaze", 0.0, "3-Phase", 110000, 13800, 620, 13800], ["3EI-240 Trifaze", 0.0, "3-Phase", 260000, 32500, 910, 32500],
    ["EP7", 0.2, "TDK", 10300, 10, 22, 10], ["EP13", 0.3, "TDK", 12500, 20, 29, 20],
    ["EP20", 0.4, "TDK", 14200, 41, 40, 41], ["ER9.5", 0.2, "TDK", 8500, 8, 18, 8],
    ["ER11", 0.25, "TDK", 9600, 12, 24, 12], ["ER14.5", 0.3, "TDK", 11000, 19, 30, 19],
    ["M30 Sac", 0.0, "Standart", 650, 85, 38, 85], ["M42 Sac", 0.0, "Standart", 1300, 180, 68, 180],
    ["M55 Sac", 0.0, "Standart", 2600, 340, 102, 340], ["Pot Core P11/7", 0.2, "TDK", 7400, 16, 25, 16],
    ["Pot Core P18/11", 0.4, "TDK", 9200, 43, 41, 43], ["Pot Core P30/19", 0.5, "TDK", 11500, 137, 74, 137]
];

// Orijinal verileri yükle, alfabetik sýrala ve ID ata
CoreDB._sortAndAssignIDs(CoreDB.smpsTrafoCores);
CoreDB._sortAndAssignIDs(CoreDB.inductorCores);
CoreDB.flybackCores = [...CoreDB.inductorCores];
CoreDB.linearTrafoCores = [...linearExtra];
CoreDB._sortAndAssignIDs(CoreDB.linearTrafoCores);

CoreDB.loadCustomCoresFromFirestore = function () {
    if (typeof db !== 'undefined' && db !== null) {

        db.collection("linear_cores").get().then((snap) => {
            const linearSet = new Set(this.linearTrafoCores.map(c => c[1].toLowerCase() + "_" + String(c[2]).toLowerCase()));

            snap.forEach((doc) => {
                let d = doc.data();
                let key = d.core.toLowerCase() + "_" + String(d.ident).toLowerCase();
                if (!linearSet.has(key)) {
                    this.linearTrafoCores.push([d.core, d.ident, d.manu, parseFloat(d.al), parseFloat(d.ain), parseFloat(d.lin), parseFloat(d.amin)]);
                    linearSet.add(key);
                }
            });
            this._sortAndAssignIDs(this.linearTrafoCores);
        }).catch(err => console.error("Firestore linear cores error:", err));

        db.collection("coils").get().then((snap) => {
            const inductorSet = new Set(this.inductorCores.map(c => c[1].toLowerCase() + "_" + String(c[2]).toLowerCase()));

            snap.forEach((doc) => {
                let d = doc.data();
                let key = d.core.toLowerCase() + "_" + String(d.ident).toLowerCase();
                if (!inductorSet.has(key)) {
                    this.inductorCores.push([d.core, d.ident, d.manu, parseFloat(d.al), parseFloat(d.ain), parseFloat(d.lin), parseFloat(d.amin)]);
                    inductorSet.add(key);
                }
            });

            this._sortAndAssignIDs(this.inductorCores);
            this.flybackCores = [...this.inductorCores];
        }).catch(err => console.error("Firestore inductor error:", err));

        db.collection("transistor").get().then((snap) => {
            const trafoSet = new Set(this.smpsTrafoCores.map(c => c[1].toLowerCase()));

            snap.forEach((doc) => {
                let d = doc.data();
                let key = d.core.toLowerCase();
                if (!trafoSet.has(key)) {
                    this.smpsTrafoCores.push([d.core, d.manu, parseFloat(d.amin), parseFloat(d.vin)]);
                    trafoSet.add(key);
                }
            });
            this._sortAndAssignIDs(this.smpsTrafoCores);
        }).catch(err => console.error("Firestore trafo error:", err));
    }
};

window.addEventListener('DOMContentLoaded', () => {
    CoreDB.loadCustomCoresFromFirestore();
});