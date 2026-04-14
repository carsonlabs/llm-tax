/**
 * API caller — hits discovered endpoints and measures response size.
 * Respects timeouts, handles errors gracefully, never sends auth.
 */
const TIMEOUT_MS = 10_000;
function countFields(obj, depth = 0) {
    if (depth > 10)
        return 0;
    if (typeof obj !== "object" || obj === null)
        return 0;
    if (Array.isArray(obj)) {
        // Count fields in first element only (representative)
        return obj.length > 0 ? countFields(obj[0], depth + 1) : 0;
    }
    let count = 0;
    for (const [, value] of Object.entries(obj)) {
        count++; // count this field
        if (typeof value === "object" && value !== null) {
            count += countFields(value, depth + 1);
        }
    }
    return count;
}
export async function callApi(call) {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(call.url, {
            method: call.method === "GET" ? "GET" : "POST",
            headers: {
                "Accept": "application/json",
                "User-Agent": "llm-tax/1.0 (https://github.com/carsonlabs/llm-tax)",
            },
            signal: controller.signal,
            // Don't send bodies for GET
            ...(call.method !== "GET" ? { body: "{}" } : {}),
        });
        const responseBody = await response.text();
        const responseTimeMs = Date.now() - start;
        let parsedJson = null;
        let totalFields = 0;
        try {
            parsedJson = JSON.parse(responseBody);
            totalFields = countFields(parsedJson);
        }
        catch {
            // Not JSON
        }
        return {
            call,
            reachable: true,
            statusCode: response.status,
            responseBody,
            responseSizeBytes: new TextEncoder().encode(responseBody).length,
            responseTimeMs,
            parsedJson,
            totalFields,
        };
    }
    catch (err) {
        return {
            call,
            reachable: false,
            statusCode: 0,
            responseBody: "",
            responseSizeBytes: 0,
            responseTimeMs: Date.now() - start,
            parsedJson: null,
            totalFields: 0,
            error: err instanceof Error ? err.message : String(err),
        };
    }
    finally {
        clearTimeout(timer);
    }
}
export async function callApis(calls, onProgress) {
    const results = [];
    // Call sequentially to avoid hammering APIs
    for (let i = 0; i < calls.length; i++) {
        onProgress?.(i, calls.length);
        results.push(await callApi(calls[i]));
    }
    onProgress?.(calls.length, calls.length);
    return results;
}
