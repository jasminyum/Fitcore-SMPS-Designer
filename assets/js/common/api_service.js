// ================================================================
// API Service Layer
// All Firebase Cloud Functions calls are centralized here.
// Page/optimizer code never calls firebase.app().functions(...)
// directly — it goes through the functions in this file instead.
// ================================================================

(function () {
    "use strict";

    const REGION = "us-central1";
    const CALLABLE_NAME = "runSmpsOptimization";

    function getCallable() {
        const functions = firebase.app().functions(REGION);
        return functions.httpsCallable(CALLABLE_NAME);
    }

    /**
     * Runs an optimization with a single payload (single/transformer mode).
     * Returns the Firebase callable response (response.data) as-is,
     * for backward compatibility.
     * @param {Object} payload
     * @returns {Promise<Object>} response (access via response.data)
     */
    async function runSmpsOptimizationSingle(payload) {
        const runOptimization = getCallable();
        return runOptimization(payload);
    }

    /**
     * Runs parallel optimizations for two independent coils (L1/L2).
     * Returns the raw Promise.allSettled result (does not unwrap it),
     * so calling code can keep using the existing access pattern,
     * e.g. settledL1.value.data.coilCores, unchanged.
     * @param {Object} payloadL1
     * @param {Object} payloadL2
     * @returns {Promise<[PromiseSettledResult, PromiseSettledResult]>}
     */
    async function runSmpsOptimizationDual(payloadL1, payloadL2) {
        const runOptimization = getCallable();
        return Promise.allSettled([
            runOptimization(payloadL1),
            runOptimization(payloadL2)
        ]);
    }

    window.apiService = {
        runSmpsOptimizationSingle: runSmpsOptimizationSingle,
        runSmpsOptimizationDual: runSmpsOptimizationDual
    };
})();
