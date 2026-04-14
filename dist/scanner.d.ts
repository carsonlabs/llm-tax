/**
 * Codebase scanner — finds API calls (fetch, axios, requests) in source files
 * and extracts the URLs being called.
 */
export interface DiscoveredCall {
    /** The URL or URL pattern found */
    url: string;
    /** HTTP method (GET, POST, etc.) */
    method: string;
    /** File where the call was found */
    file: string;
    /** Line number */
    line: number;
    /** Which fields from the response are actually used (best effort) */
    usedFields: string[];
}
export declare function scanCodebase(dir: string): Promise<DiscoveredCall[]>;
