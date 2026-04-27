/**
 * Pretty terminal output with colors and formatting.
 */

import type { TaxSummary, WasteReport, ModelCosts } from "./calculator.js";

// ANSI colors
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

function wasteColor(percent: number): string {
  if (percent >= 70) return c.red;
  if (percent >= 40) return c.yellow;
  return c.green;
}

function wasteBar(percent: number, width = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const color = wasteColor(percent);
  return `${color}${"█".repeat(filled)}${c.dim}${"░".repeat(empty)}${c.reset}`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

function formatDollars(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

export function printBanner(): void {
  console.log(`
${c.bold}${c.cyan}  ╔═══════════════════════════════════════╗
  ║          ${c.white}💸 llm-tax${c.cyan}                     ║
  ║  ${c.dim}How much are you wasting on bloated${c.cyan}   ║
  ║  ${c.dim}API responses in LLM context?${c.cyan}          ║
  ╚═══════════════════════════════════════╝${c.reset}
`);
}

export function printScanning(dir: string): void {
  console.log(`${c.dim}Scanning${c.reset} ${c.bold}${dir}${c.reset} ${c.dim}for API calls...${c.reset}\n`);
}

export function printProgress(done: number, total: number): void {
  const pct = Math.round((done / total) * 100);
  process.stdout.write(`\r${c.dim}  Testing APIs... ${done}/${total} (${pct}%)${c.reset}`);
  if (done === total) process.stdout.write("\n\n");
}

export function printReport(report: WasteReport): void {
  const urlStr = truncate(report.url, 50);
  const waste = `${report.wastePercent}%`;
  const bar = wasteBar(report.wastePercent);

  console.log(
    `  ${c.bold}${report.method}${c.reset} ${urlStr}`,
  );
  console.log(
    `  ${c.dim}${report.file}:${report.line}${c.reset}`,
  );
  console.log(
    `  ${bar} ${wasteColor(report.wastePercent)}${c.bold}${waste} waste${c.reset}  ${c.dim}│${c.reset}  ${report.totalTokens} tokens → ${report.usedTokens} used, ${c.red}${report.wastedTokens} wasted${c.reset}`,
  );
  console.log(
    `  ${c.dim}Fields: ${report.totalFields} total, ${report.usedFieldCount} used  │  ${report.responseTimeMs}ms  │  HTTP ${report.statusCode}${c.reset}`,
  );
  console.log();
}

export function printSummary(summary: TaxSummary): void {
  const { avgWastePercent, totalWastedTokensPerCall, totalUsedTokensPerCall, monthlyWaste, monthlyCost } = summary;

  // Header
  console.log(`${c.bold}${"═".repeat(65)}${c.reset}`);
  console.log(`${c.bold}  LLM TAX REPORT${c.reset}`);
  console.log(`${c.bold}${"═".repeat(65)}${c.reset}\n`);

  // Summary stats
  console.log(`  ${c.dim}APIs found:${c.reset}        ${c.bold}${summary.totalApis}${c.reset} ${c.dim}(${summary.reachableApis} reachable)${c.reset}`);
  console.log(`  ${c.dim}Avg waste:${c.reset}         ${wasteColor(avgWastePercent)}${c.bold}${avgWastePercent}%${c.reset}`);
  console.log(`  ${c.dim}Tokens per call:${c.reset}   ${c.bold}${totalUsedTokensPerCall + totalWastedTokensPerCall}${c.reset} total, ${c.red}${c.bold}${totalWastedTokensPerCall} wasted${c.reset}`);
  console.log();

  // Per-API breakdown
  if (summary.reports.length > 0) {
    console.log(`${c.bold}  Per-API Breakdown${c.reset}`);
    console.log(`  ${c.dim}${"─".repeat(60)}${c.reset}`);

    for (const report of summary.reports) {
      printReport(report);
    }
  }

  // Monthly cost table
  console.log(`${c.bold}  Monthly Cost Estimate${c.reset} ${c.dim}(${monthlyCost.callsPerDay} calls/day)${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(60)}${c.reset}`);
  console.log(`  ${c.dim}Model                Total Cost      Wasted          Savings${c.reset}`);

  for (const model of ["gpt-4o", "gpt-4o-mini", "claude-sonnet", "claude-haiku"] as Array<keyof ModelCosts>) {
    const total = monthlyCost[model] as number;
    const waste = monthlyWaste[model] as number;
    const pct = total > 0 ? Math.round((waste / total) * 100) : 0;
    console.log(
      `  ${c.bold}${model.padEnd(21)}${c.reset}${formatDollars(total).padEnd(16)}${c.red}${formatDollars(waste).padEnd(16)}${c.reset}${wasteColor(pct)}${pct}%${c.reset}`,
    );
  }

  console.log();

  // Worst offender callout
  let worstUrl: string | null = null;
  if (summary.reports.length > 0) {
    const worst = summary.reports[0];
    worstUrl = worst.url;
    console.log(`  ${c.bgRed}${c.white}${c.bold} WORST OFFENDER ${c.reset} ${c.bold}${worst.method} ${truncate(worst.url, 40)}${c.reset}`);
    console.log(`  ${c.red}${worst.wastePercent}% waste — ${worst.wastedTokens} tokens thrown away per call${c.reset}`);
    console.log();
  }

  // CTA — sharp, specific, with a one-line fix
  console.log(`  ${c.dim}${"─".repeat(60)}${c.reset}`);
  console.log(`  ${c.bold}${c.cyan}Fix this in 1 line${c.reset} ${c.dim}→${c.reset} ${c.cyan}https://selfheal.dev/llm-tax${c.reset}`);
  console.log();
  if (worstUrl) {
    console.log(`  ${c.dim}# Before:${c.reset}`);
    console.log(`  ${c.dim}fetch("${truncate(worstUrl, 40)}")${c.reset}`);
    console.log();
    console.log(`  ${c.dim}# After (proxy through SelfHeal, normalize to just what you need):${c.reset}`);
    console.log(`  ${c.green}fetch("https://selfheal.dev/api/proxy", {${c.reset}`);
    console.log(`  ${c.green}  method: "POST",${c.reset}`);
    console.log(`  ${c.green}  headers: { "X-Destination-URL": "${truncate(worstUrl, 30)}" },${c.reset}`);
    console.log(`  ${c.green}  body: JSON.stringify({ target_schema: { /* fields you actually use */ } })${c.reset}`);
    console.log(`  ${c.green}})${c.reset}`);
    console.log();
  }
  console.log(`  ${c.dim}Pay-per-fix in USDC ($0.001), or $29/mo flat for teams.${c.reset}`);
  console.log(`  ${c.dim}Already compliant? Free pass-through. Only pay when SelfHeal delivers a slimmer payload.${c.reset}`);
  console.log();
}

export function printNoApis(): void {
  console.log(`${c.yellow}  No API calls found in this directory.${c.reset}`);
  console.log(`${c.dim}  llm-tax looks for fetch(), axios, requests, and httpx calls${c.reset}`);
  console.log(`${c.dim}  in .ts, .tsx, .js, .jsx, .mjs, and .py files.${c.reset}\n`);
}

export function printUnreachable(reports: WasteReport[]): void {
  const unreachable = reports.filter((r) => !r.reachable);
  if (unreachable.length === 0) return;

  console.log(`${c.dim}  Unreachable APIs (${unreachable.length}):${c.reset}`);
  for (const r of unreachable) {
    console.log(`  ${c.dim}  ${r.method} ${truncate(r.url, 50)} — ${r.error ?? "timeout"}${c.reset}`);
  }
  console.log();
}
