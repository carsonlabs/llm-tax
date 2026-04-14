/**
 * Token calculator — estimates token waste and dollar cost
 * for feeding API responses into LLM context windows.
 */
// Pricing per 1M input tokens (USD)
const INPUT_PRICING = {
    "gpt-4o": 2.50,
    "gpt-4o-mini": 0.15,
    "claude-sonnet": 3.00,
    "claude-haiku": 0.80,
};
/** Rough estimate: ~4 characters per token */
function charsToTokens(chars) {
    return Math.ceil(chars / 4);
}
function estimateUsedTokens(result) {
    if (!result.parsedJson || typeof result.parsedJson !== "object") {
        // Can't analyze non-JSON — assume 50% used
        return Math.ceil(charsToTokens(result.responseSizeBytes) * 0.5);
    }
    const usedFields = result.call.usedFields;
    if (usedFields.length === 0) {
        // No field usage detected — assume agent uses everything (conservative)
        return charsToTokens(result.responseSizeBytes);
    }
    // Build a subset of the response containing only used fields
    const json = result.parsedJson;
    const usedData = {};
    // Handle arrays (take first element)
    const obj = Array.isArray(json) ? (json[0] ?? {}) : json;
    for (const field of usedFields) {
        if (field in obj) {
            usedData[field] = obj[field];
        }
        // Check nested — look one level deep
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                const nested = value;
                if (field in nested) {
                    usedData[`${key}.${field}`] = nested[field];
                }
            }
        }
    }
    const usedStr = JSON.stringify(usedData);
    return Math.max(charsToTokens(usedStr.length), 1);
}
function costPer1KCalls(tokens) {
    const costs = {};
    for (const [model, pricePerMillion] of Object.entries(INPUT_PRICING)) {
        costs[model] = Number(((tokens * 1000 * pricePerMillion) / 1_000_000).toFixed(4));
    }
    return costs;
}
export function analyzeWaste(results) {
    return results.map((result) => {
        const totalTokens = charsToTokens(result.responseSizeBytes);
        const usedTokens = result.reachable ? estimateUsedTokens(result) : 0;
        const wastedTokens = Math.max(0, totalTokens - usedTokens);
        const wastePercent = totalTokens > 0 ? Math.round((wastedTokens / totalTokens) * 100) : 0;
        return {
            url: result.call.url,
            method: result.call.method,
            file: result.call.file,
            line: result.call.line,
            reachable: result.reachable,
            statusCode: result.statusCode,
            responseTimeMs: result.responseTimeMs,
            totalTokens,
            usedTokens,
            wastedTokens,
            wastePercent,
            totalFields: result.totalFields,
            usedFieldCount: result.call.usedFields.length,
            costPer1K: costPer1KCalls(wastedTokens),
            error: result.error,
        };
    });
}
export function buildSummary(reports, callsPerDay = 1000) {
    const reachable = reports.filter((r) => r.reachable);
    const totalWasted = reachable.reduce((sum, r) => sum + r.wastedTokens, 0);
    const totalUsed = reachable.reduce((sum, r) => sum + r.usedTokens, 0);
    const avgWaste = reachable.length > 0
        ? Math.round(reachable.reduce((sum, r) => sum + r.wastePercent, 0) / reachable.length)
        : 0;
    const monthlyCallsPerApi = callsPerDay * 30;
    const monthlyCost = { callsPerDay };
    const monthlyWaste = { callsPerDay };
    for (const model of Object.keys(INPUT_PRICING)) {
        const totalTokensPerCall = reachable.reduce((sum, r) => sum + r.totalTokens, 0);
        const wastedTokensPerCall = totalWasted;
        monthlyCost[model] = Number(((totalTokensPerCall * monthlyCallsPerApi * INPUT_PRICING[model]) / 1_000_000).toFixed(2));
        monthlyWaste[model] = Number(((wastedTokensPerCall * monthlyCallsPerApi * INPUT_PRICING[model]) / 1_000_000).toFixed(2));
    }
    return {
        reports: reachable.sort((a, b) => b.wastePercent - a.wastePercent),
        totalApis: reports.length,
        reachableApis: reachable.length,
        totalWastedTokensPerCall: totalWasted,
        totalUsedTokensPerCall: totalUsed,
        avgWastePercent: avgWaste,
        monthlyCost,
        monthlyWaste,
    };
}
