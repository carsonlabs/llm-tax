#!/usr/bin/env node
/**
 * llm-tax — Scan your codebase and find out how much money
 * you're wasting feeding bloated API responses to LLMs.
 *
 * Usage:
 *   npx llm-tax ./src
 *   npx llm-tax .               # scan current directory
 *   npx llm-tax ./src --calls 5000  # estimate at 5000 calls/day
 *   npx llm-tax ./src --json    # output as JSON
 *   npx llm-tax ./src --dry-run # scan only, don't call APIs
 */
import { resolve } from "path";
import { scanCodebase } from "./scanner.js";
import { callApis } from "./caller.js";
import { analyzeWaste, buildSummary } from "./calculator.js";
import { printBanner, printScanning, printProgress, printSummary, printNoApis, printUnreachable, } from "./output.js";
function parseArgs(args) {
    let dir = ".";
    let callsPerDay = 1000;
    let json = false;
    let dryRun = false;
    let help = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--help" || arg === "-h") {
            help = true;
        }
        else if (arg === "--json") {
            json = true;
        }
        else if (arg === "--dry-run") {
            dryRun = true;
        }
        else if ((arg === "--calls" || arg === "-c") && args[i + 1]) {
            callsPerDay = parseInt(args[++i]);
        }
        else if (!arg.startsWith("-")) {
            dir = arg;
        }
    }
    return { dir: resolve(dir), callsPerDay, json, dryRun, help };
}
function printHelp() {
    console.log(`
  Usage: llm-tax [directory] [options]

  Scan your codebase for API calls and calculate how much money
  you're wasting on bloated responses in LLM context windows.

  Options:
    --calls, -c <n>   Estimated API calls per day (default: 1000)
    --json            Output as JSON instead of pretty terminal output
    --dry-run         Scan for API calls but don't hit them
    --help, -h        Show this help

  Examples:
    npx llm-tax ./src
    npx llm-tax . --calls 5000
    npx llm-tax ./api --json > report.json
    npx llm-tax . --dry-run
`);
}
async function main() {
    const { dir, callsPerDay, json, dryRun, help } = parseArgs(process.argv.slice(2));
    if (help) {
        printHelp();
        process.exit(0);
    }
    if (!json)
        printBanner();
    if (!json)
        printScanning(dir);
    // Step 1: Scan codebase
    const calls = await scanCodebase(dir);
    if (calls.length === 0) {
        if (json) {
            console.log(JSON.stringify({ error: "No API calls found", apis: 0 }));
        }
        else {
            printNoApis();
        }
        process.exit(0);
    }
    if (!json) {
        console.log(`  ${calls.length} API endpoint${calls.length === 1 ? "" : "s"} found\n`);
    }
    // Step 2: Hit APIs (unless dry-run)
    if (dryRun) {
        if (!json) {
            console.log("  --dry-run: skipping API calls\n");
            for (const call of calls) {
                console.log(`  ${call.method} ${call.url}`);
                console.log(`    ${call.file}:${call.line}`);
                console.log(`    Fields used: ${call.usedFields.length > 0 ? call.usedFields.join(", ") : "(none detected)"}\n`);
            }
        }
        else {
            console.log(JSON.stringify({ apis: calls.length, calls, dryRun: true }, null, 2));
        }
        process.exit(0);
    }
    const results = await callApis(calls, json ? undefined : printProgress);
    // Step 3: Analyze waste
    const reports = analyzeWaste(results);
    const summary = buildSummary(reports, callsPerDay);
    // Step 4: Output
    if (json) {
        console.log(JSON.stringify(summary, null, 2));
    }
    else {
        printUnreachable(reports);
        printSummary(summary);
    }
}
main().catch((err) => {
    console.error("Error:", err.message ?? err);
    process.exit(1);
});
