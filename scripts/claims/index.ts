// Public surface of the claim checker: scan MDX for claims, run them, compare.
export { claimKey, formatBroken, normalizeOutput, problems, verifyAll } from "./verify.ts";
export type { BrokenClaim, ClaimRecord, Outcome, Runner, Verification } from "./verify.ts";
export { ScanError, scanSource } from "./scan.ts";
export type { ClaimSite, ClaimSpec } from "./scan.ts";
