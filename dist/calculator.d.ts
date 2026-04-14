/**
 * Token calculator — estimates token waste and dollar cost
 * for feeding API responses into LLM context windows.
 */
import type { ApiResult } from "./caller.js";
export interface WasteReport {
    /** The API endpoint */
    url: string;
    /** HTTP method */
    method: string;
    /** Source file */
    file: string;
    /** Line number */
    line: number;
    /** Whether the API was reachable */
    reachable: boolean;
    /** HTTP status */
    statusCode: number;
    /** Response time in ms */
    responseTimeMs: number;
    /** Total estimated tokens in the full response */
    totalTokens: number;
    /** Estimated tokens actually used by the code */
    usedTokens: number;
    /** Wasted tokens */
    wastedTokens: number;
    /** Waste percentage (0-100) */
    wastePercent: number;
    /** Total fields in the response */
    totalFields: number;
    /** Fields actually used by the code */
    usedFieldCount: number;
    /** Cost per 1000 calls across models */
    costPer1K: ModelCosts;
    /** Error if unreachable */
    error?: string;
}
export interface ModelCosts {
    "gpt-4o": number;
    "gpt-4o-mini": number;
    "claude-sonnet": number;
    "claude-haiku": number;
}
export interface TaxSummary {
    /** Individual API reports */
    reports: WasteReport[];
    /** Total APIs scanned */
    totalApis: number;
    /** APIs that were reachable */
    reachableApis: number;
    /** Total tokens wasted across all APIs (per call) */
    totalWastedTokensPerCall: number;
    /** Total tokens used across all APIs (per call) */
    totalUsedTokensPerCall: number;
    /** Average waste percentage */
    avgWastePercent: number;
    /** Monthly cost estimate at given call volume */
    monthlyCost: MonthlyEstimate;
    /** Monthly waste estimate at given call volume */
    monthlyWaste: MonthlyEstimate;
}
export interface MonthlyEstimate {
    callsPerDay: number;
    "gpt-4o": number;
    "gpt-4o-mini": number;
    "claude-sonnet": number;
    "claude-haiku": number;
}
export declare function analyzeWaste(results: ApiResult[]): WasteReport[];
export declare function buildSummary(reports: WasteReport[], callsPerDay?: number): TaxSummary;
