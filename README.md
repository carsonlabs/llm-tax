# llm-tax

**Scan your codebase and find out how much money you're wasting feeding bloated API responses to LLMs.**

[![npm version](https://img.shields.io/npm/v/llm-tax)](https://www.npmjs.com/package/llm-tax)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

Most APIs return 2-5x more data than your AI agent actually uses. Every extra field is wasted tokens — and wasted money.

`llm-tax` scans your codebase, finds every API call, hits the endpoints, measures the responses, and tells you exactly how much you're overpaying.

## Quick Start

```bash
npx llm-tax ./src
```

That's it. No install, no config, no signup.

## What It Does

1. **Scans** your `.ts`, `.js`, `.py` files for `fetch()`, `axios`, `requests`, `httpx` calls
2. **Extracts** which response fields your code actually uses (static analysis)
3. **Hits** each API endpoint and measures the response size
4. **Calculates** token waste, dollar cost, and monthly estimates across GPT-4o, Claude, etc.
5. **Shows** a color-coded report with your worst offenders

## Example Output

```
  ╔═══════════════════════════════════════╗
  ║          💸 llm-tax                     ║
  ╚═══════════════════════════════════════╝

  APIs found:        17 (17 reachable)
  Avg waste:         76%
  Tokens per call:   6610 total, 3474 wasted

  Per-API Breakdown
  ────────────────────────────────────────────────────────

  GET https://api.stripe.com/v1/charges
  ./extensions.test.ts:37
  ████████████████████ 99% waste  │  86 tokens → 1 used, 85 wasted

  GET https://api.openai.com/v1/chat/completions
  ./extensions.test.ts:9
  ████████████████████ 98% waste  │  40 tokens → 1 used, 39 wasted

  GET https://api.github.com/user
  ./_core/sdk.ts:57
  ███████████████████░ 97% waste  │  30 tokens → 1 used, 29 wasted

  Monthly Cost Estimate (1000 calls/day)
  ────────────────────────────────────────────────────────
  Model                Total Cost      Wasted          Savings
  gpt-4o               $495.75         $260.55         53%
  gpt-4o-mini          $29.75          $15.63          53%
  claude-sonnet        $594.90         $312.66         53%
  claude-haiku         $158.64         $83.38          53%

  WORST OFFENDER  GET https://api.stripe.com/v1/charges
  99% waste — 85 tokens thrown away per call
```

## Options

```bash
npx llm-tax ./src                    # Scan a directory
npx llm-tax .                        # Scan current directory
npx llm-tax ./src --calls 5000       # Estimate at 5000 calls/day
npx llm-tax ./src --json             # Output as JSON (pipe to file)
npx llm-tax ./src --dry-run          # Scan only, don't hit APIs
npx llm-tax ./src --json > report.json  # Save report
```

## What It Scans

| Pattern | Languages |
|---------|-----------|
| `fetch("https://...")` | JS, TS |
| `axios.get("https://...")` | JS, TS |
| `requests.get("https://...")` | Python |
| `httpx.get("https://...")` | Python |
| `url: "https://..."` | Config objects |
| `"https://api.*/..."` | Any API URL |

## How Token Waste Is Calculated

1. **Total tokens** = response size / 4 (standard approximation)
2. **Used tokens** = size of only the fields your code accesses (detected via static analysis of `data.fieldName`, `response["key"]`, etc.)
3. **Wasted tokens** = total - used
4. **Cost** = tokens * model pricing (GPT-4o: $2.50/M, Claude Sonnet: $3.00/M, etc.)

## Fix It

The waste `llm-tax` reveals is exactly what [SelfHeal](https://selfheal.dev) fixes.

Send a `target_schema` with your API calls through SelfHeal's proxy, and it normalizes bloated responses down to exactly the fields you need — using LLM-powered transformation with x402 outcome-based pricing.

- Already compliant? **Free.**
- Needs normalization? **$0.001 USDC.** Only charged when it delivers value.

```bash
curl -X POST https://selfheal.dev/api/x402/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.example.com/users",
    "method": "GET",
    "target_schema": {
      "type": "object",
      "properties": {
        "id": { "type": "number" },
        "name": { "type": "string" },
        "email": { "type": "string" }
      }
    }
  }'
```

47 fields in, 3 fields out. Token savings: ~85%.

## Privacy

- `llm-tax` **never sends your code** anywhere
- It only hits the API URLs it finds in your code (GET requests with no auth)
- No data is uploaded, tracked, or stored
- The `--dry-run` flag lets you see what it found without hitting any APIs

## License

MIT

---

Built by [Freedom Engineers](https://freedomengineers.tech)
