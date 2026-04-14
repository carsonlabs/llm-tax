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
export {};
