/**
 * Codebase scanner — finds API calls (fetch, axios, requests) in source files
 * and extracts the URLs being called.
 */
import { readFileSync } from "fs";
import { glob } from "glob";
import { resolve } from "path";
// Patterns to match API calls across JS/TS/Python files
const URL_PATTERNS = [
    // fetch("url") or fetch(`url`)
    /fetch\(\s*["'`](https?:\/\/[^"'`\s]+)["'`]/g,
    // axios.get("url"), axios.post("url"), etc.
    /axios\.(get|post|put|patch|delete)\(\s*["'`](https?:\/\/[^"'`\s]+)["'`]/g,
    // requests.get("url"), requests.post("url"), etc. (Python)
    /requests\.(get|post|put|patch|delete)\(\s*["'`](https?:\/\/[^"'`\s]+)["'`]/g,
    // httpx.get("url"), httpx.post("url") (Python)
    /httpx\.(get|post|put|patch|delete)\(\s*["'`](https?:\/\/[^"'`\s]+)["'`]/g,
    // url: "https://..." in config objects
    /url:\s*["'`](https?:\/\/[^"'`\s]+)["'`]/g,
    // Generic string URLs that look like API endpoints
    /["'`](https?:\/\/api\.[^"'`\s]+)["'`]/g,
    /["'`](https?:\/\/[^"'`\s]*\/api\/[^"'`\s]+)["'`]/g,
];
// Patterns to extract field usage from response (e.g. data.name, resp["email"])
const FIELD_ACCESS_PATTERNS = [
    // data.fieldName or response.fieldName
    /(?:data|response|result|res|resp|body|json)\.([\w]+)/g,
    // data["fieldName"] or data['fieldName']
    /(?:data|response|result|res|resp|body|json)\[["']([\w]+)["']\]/g,
    // Python: data["field"] or data.get("field")
    /(?:data|response|result|res|resp|body|json)\.get\(["']([\w]+)["']/g,
];
const IGNORE_DIRS = [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/__pycache__/**",
    "**/.venv/**",
    "**/venv/**",
    "**/.next/**",
    "**/coverage/**",
    "**/*.min.js",
    "**/*.map",
];
function extractMethod(line) {
    const lower = line.toLowerCase();
    if (lower.includes(".post(") || lower.includes("method: 'post'") || lower.includes('method: "post"'))
        return "POST";
    if (lower.includes(".put(") || lower.includes("method: 'put'") || lower.includes('method: "put"'))
        return "PUT";
    if (lower.includes(".patch(") || lower.includes("method: 'patch'") || lower.includes('method: "patch"'))
        return "PATCH";
    if (lower.includes(".delete(") || lower.includes("method: 'delete'") || lower.includes('method: "delete"'))
        return "DELETE";
    return "GET";
}
function extractUsedFields(content) {
    const fields = new Set();
    for (const pattern of FIELD_ACCESS_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(content)) !== null) {
            const field = match[1];
            if (field && field.length > 1 && field.length < 50) {
                fields.add(field);
            }
        }
    }
    return [...fields];
}
function isTemplateUrl(url) {
    return url.includes("${") || url.includes("{") || url.includes("<%");
}
function cleanUrl(url) {
    // Remove trailing quotes, parens, commas
    return url.replace(/['"`,;\s)}\]]+$/, "");
}
export async function scanCodebase(dir) {
    const absDir = resolve(dir);
    const files = await glob("**/*.{ts,tsx,js,jsx,mjs,py}", {
        cwd: absDir,
        absolute: true,
        ignore: IGNORE_DIRS,
    });
    const calls = [];
    const seenUrls = new Set();
    for (const file of files) {
        let content;
        try {
            content = readFileSync(file, "utf-8");
        }
        catch {
            continue;
        }
        const lines = content.split("\n");
        const usedFields = extractUsedFields(content);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pattern of URL_PATTERNS) {
                const regex = new RegExp(pattern.source, pattern.flags);
                let match;
                while ((match = regex.exec(line)) !== null) {
                    // URL is in the last capture group
                    const rawUrl = match[match.length - 1];
                    if (!rawUrl)
                        continue;
                    const url = cleanUrl(rawUrl);
                    // Skip template URLs, localhost, and duplicates
                    if (isTemplateUrl(url))
                        continue;
                    if (url.includes("localhost") || url.includes("127.0.0.1"))
                        continue;
                    if (url.includes("example.com") || url.includes("placeholder"))
                        continue;
                    if (seenUrls.has(url))
                        continue;
                    seenUrls.add(url);
                    calls.push({
                        url,
                        method: extractMethod(line),
                        file: file.replace(absDir, ".").replace(/\\/g, "/"),
                        line: i + 1,
                        usedFields,
                    });
                }
            }
        }
    }
    return calls;
}
