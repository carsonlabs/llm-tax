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

// Pricing per 1M input tokens (USD)
const INPUT_PRICING: Record<string, number> = {
  "gpt-4o": 2.50,
  "gpt-4o-mini": 0.15,
  "claude-sonnet": 3.00,
  "claude-haiku": 0.80,
};

/** Rough estimate: ~4 characters per token */
function charsToTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function estimateUsedTokens(result: ApiResult): number {
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
  const json = result.parsedJson as Record<string, unknown>;
  const usedData: Record<string, unknown> = {};

  // Handle arrays (take first element)
  const obj = Array.isArray(json) ? (json[0] as Record<string, unknown> ?? {}) : json;

  for (const field of usedFields) {
    if (field in obj) {
      usedData[field] = obj[field];
    }
    // Check nested — look one level deep
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const nested = value as Record<string, unknown>;
        if (field in nested) {
          usedData[`${key}.${field}`] = nested[field];
        }
      }
    }
  }

  const usedStr = JSON.stringify(usedData);
  return Math.max(charsToTokens(usedStr.length), 1);
}

function costPer1KCalls(tokens: number): ModelCosts {
  const costs: ModelCosts = {} as ModelCosts;
  for (const [model, pricePerMillion] of Object.entries(INPUT_PRICING)) {
    costs[model as keyof ModelCosts] = Number(((tokens * 1000 * pricePerMillion) / 1_000_000).toFixed(4));
  }
  return costs;
}

export function analyzeWaste(results: ApiResult[]): WasteReport[] {
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

export function buildSummary(reports: WasteReport[], callsPerDay = 1000): TaxSummary {
  const reachable = reports.filter((r) => r.reachable);
  const totalWasted = reachable.reduce((sum, r) => sum + r.wastedTokens, 0);
  const totalUsed = reachable.reduce((sum, r) => sum + r.usedTokens, 0);
  const avgWaste = reachable.length > 0
    ? Math.round(reachable.reduce((sum, r) => sum + r.wastePercent, 0) / reachable.length)
    : 0;

  const monthlyCallsPerApi = callsPerDay * 30;
  const monthlyCost: MonthlyEstimate = { callsPerDay } as MonthlyEstimate;
  const monthlyWaste: MonthlyEstimate = { callsPerDay } as MonthlyEstimate;

  for (const model of Object.keys(INPUT_PRICING) as Array<keyof ModelCosts>) {
    const totalTokensPerCall = reachable.reduce((sum, r) => sum + r.totalTokens, 0);
    const wastedTokensPerCall = totalWasted;

    monthlyCost[model] = Number(
      ((totalTokensPerCall * monthlyCallsPerApi * INPUT_PRICING[model]) / 1_000_000).toFixed(2),
    );
    monthlyWaste[model] = Number(
      ((wastedTokensPerCall * monthlyCallsPerApi * INPUT_PRICING[model]) / 1_000_000).toFixed(2),
    );
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
