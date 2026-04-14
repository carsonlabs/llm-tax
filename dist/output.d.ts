/**
 * Pretty terminal output with colors and formatting.
 */
import type { TaxSummary, WasteReport } from "./calculator.js";
export declare function printBanner(): void;
export declare function printScanning(dir: string): void;
export declare function printProgress(done: number, total: number): void;
export declare function printReport(report: WasteReport): void;
export declare function printSummary(summary: TaxSummary): void;
export declare function printNoApis(): void;
export declare function printUnreachable(reports: WasteReport[]): void;
