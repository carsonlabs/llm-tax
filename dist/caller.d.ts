/**
 * API caller — hits discovered endpoints and measures response size.
 * Respects timeouts, handles errors gracefully, never sends auth.
 */
import type { DiscoveredCall } from "./scanner.js";
export interface ApiResult {
    call: DiscoveredCall;
    /** Whether the API was reachable */
    reachable: boolean;
    /** HTTP status code */
    statusCode: number;
    /** Raw response body */
    responseBody: string;
    /** Response size in bytes */
    responseSizeBytes: number;
    /** Response time in ms */
    responseTimeMs: number;
    /** Parsed JSON response (if valid JSON) */
    parsedJson: unknown;
    /** Total fields in the response */
    totalFields: number;
    /** Error message if unreachable */
    error?: string;
}
export declare function callApi(call: DiscoveredCall): Promise<ApiResult>;
export declare function callApis(calls: DiscoveredCall[], onProgress?: (done: number, total: number) => void): Promise<ApiResult[]>;
