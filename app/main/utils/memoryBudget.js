// memory-budget.js

/**
 * @fileoverview
 * Heuristics to estimate a safe, per-tab in-memory processing budget (in bytes)
 * for client-side operations like chunking, compression, or encryption.
 *
 * The estimator pulls from several browser hints—`performance.memory`,
 * `navigator.deviceMemory`, CPU core count, and a coarse mobile/desktop check—
 * then chooses the most conservative (smallest) candidate. The result is
 * clamped to a maximum of 400 MB and a minimum of 10 MB to avoid returning 0.
 *
 * Environment notes:
 * - Designed for modern browsers. `performance.memory` is Chromium-specific and
 *   may be absent elsewhere; we fall back gracefully when unavailable.
 * - `navigator.deviceMemory` is an approximation (in **GB**) and may be
 *   undefined on some platforms; we guard against that as well.
 */

import { FileOpsConstants } from "../constants/constants.js";

/**
 * One megabyte in bytes.
 * @constant {number}
 */
const MB = 1024 * 1024;

/**
 * One gigabyte in bytes.
 * @constant {number}
 */
const GB = 1024 * MB;

/**
 * Ten megabytes in bytes (also used as a minimum floor).
 * @constant {number}
 */
const TEN_MB = 10 * MB;

/**
 * Hard cap for the returned processing budget, in bytes.
 * Prevents overly aggressive allocations on high-end devices.
 * @constant {number}
 */
const MAX_PROCESSING_BUDGET = 400 * MB;

/**
 * Fallback budget (bytes) when the browser provides no reliable hints.
 * Delegates to a product-level constant so the platform can define a safe
 * default consistent with other file operations (e.g., streaming thresholds).
 * @constant {number}
 */
const DEFAULT_BUDGET = FileOpsConstants.STREAM_ENCRYPTION_MIN_SIZE;

/**
 * Fraction of observed free heap to consider “safely usable.”
 * This headroom helps reduce the chance of GC thrash or OOM during bursts.
 * @constant {number}
 */
const HEADROOM_FRACTION = 0.5;

/**
 * Lightweight check for mobile environments.
 *
 * Prefers `navigator.userAgentData.mobile` when available (Chromium),
 * falling back to a conservative user-agent substring test.
 *
 * @returns {boolean} `true` if the device appears to be mobile, else `false`.
 */
function isMobile() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
    return navigator.userAgentData.mobile;
  }
  return /Mobi|Android|iPhone|iPad|iPod|IEMobile|BlackBerry/i.test(navigator.userAgent);
}

/**
 * Snapshot a conservative estimate of free JS heap space (in bytes).
 *
 * Uses the non-standard `performance.memory` object when present. If available,
 * we compute `freeHeap = max(0, jsHeapSizeLimit - usedJSHeapSize)`.
 *
 * @typedef {Object} HeapBudgetReading
 * @property {number} freeHeap - Estimated free JS heap in bytes at call time.
 *
 * @returns {HeapBudgetReading|null}
 *   A reading with `freeHeap`, or `null` if unsupported/inaccessible.
 */
function readPerformanceMemory() {
  try {
    const m = performance && performance.memory;
    if (!m || typeof m.jsHeapSizeLimit !== "number") return null;
    const { jsHeapSizeLimit, usedJSHeapSize } = m;
    const freeHeap = Math.max(0, jsHeapSizeLimit - usedJSHeapSize);
    return { freeHeap };
  } catch {
    return null;
  }
}

/**
 * Read coarse device RAM (in GB) via `navigator.deviceMemory`.
 *
 * The value is a **rounded bucket** (e.g., 4, 8) rather than exact RAM.
 * Returns `undefined` if the hint is missing or clearly invalid.
 *
 * @returns {number|undefined} Device memory in GB, or `undefined` when unknown.
 */
function readDeviceMemoryGB() {
  const dm = Number(navigator.deviceMemory);
  return Number.isFinite(dm) && dm > 0 ? dm : undefined;
}

/**
 * Convert total device RAM (GB) into a per-tab budget (bytes).
 *
 * Applies conservative fractions that vary by mobile/desktop and lower/higher
 * RAM tiers. These fractions represent a safe slice of total memory that a
 * single tab/process may attempt to use for transient processing.
 *
 * | Device Type | ≤2GB | ≤4GB | ≤8GB | >8GB |
 * |-------------|------|------|------|------|
 * | Mobile      | 2%   | 3%   | 4%   | 4%   |
 * | Desktop     | —    | 4%   | 6%   | 8%   |
 *
 * @param {number|undefined} deviceGB - Total device RAM in GB (bucketed).
 * @param {boolean} mobile - Result of {@link isMobile}.
 * @returns {number|undefined} Candidate budget in bytes, or `undefined` if no input.
 */
function budgetFromDeviceRam(deviceGB, mobile) {
  if (!deviceGB) return undefined;
  // Conservative slice of total RAM for this tab/process.
  const fraction = mobile
    ? (deviceGB <= 2 ? 0.02 : deviceGB <= 4 ? 0.03 : 0.04)
    : (deviceGB <= 4 ? 0.04 : deviceGB <= 8 ? 0.06 : 0.08);
  return deviceGB * GB * fraction;
}

/**
 * Coarse fallback derived from CPU core count and mobile/desktop posture.
 *
 * When higher-fidelity signals are not available, use a small set of buckets:
 *
 * - **Mobile**
 *   - ≤2 cores → 64 MB
 *   - ≤4 cores → 96 MB
 *   - >4 cores → 128 MB
 * - **Desktop**
 *   - ≤2 cores → 128 MB
 *   - ≤4 cores → 192 MB
 *   - ≤8 cores → 256 MB
 *   - >8 cores → 384 MB
 *
 * @returns {number} Candidate budget in bytes based on coarse hints.
 */
function budgetFromCoarseHints() {
  const mobile = isMobile();
  const cores = Math.max(1, Number(navigator.hardwareConcurrency) || 1);
  if (mobile) {
    if (cores <= 2) return 64 * MB;
    if (cores <= 4) return 96 * MB;
    return 128 * MB;
  } else {
    if (cores <= 2) return 128 * MB;
    if (cores <= 4) return 192 * MB;
    if (cores <= 8) return 256 * MB;
    return 384 * MB;
  }
}

/**
 * Compute a safe per-tab in-memory processing budget (in bytes).
 *
 * Strategy:
 * 1. Read **free JS heap** via `performance.memory` (if available) and apply a
 *    headroom factor (50%) to avoid GC churn and transient spikes.
 * 2. Derive a budget from **device RAM buckets** (`navigator.deviceMemory`),
 *    adjusting for mobile vs. desktop.
 * 3. Use **coarse CPU hints** as a last-resort baseline.
 * 4. Choose the **most conservative** candidate (minimum of available values).
 * 5. Fall back to {@link DEFAULT_BUDGET} if no hint is usable.
 * 6. Clamp to **[10 MB, 400 MB]**.
 *
 * Note: We do **not** round to the nearest 10 MB; we simply enforce a minimum
 * of 10 MB and a maximum of 400 MB.
 *
 * @returns {number} Estimated safe budget in bytes.
 *
 * @example
 * import getInMemoryProcessingBudgetBytes from "./memory-budget.js";
 *
 * const budget = getInMemoryProcessingBudgetBytes();
 * // Example: choose a per-chunk size that respects the budget
 * const CHUNK_DEFAULT = 16 * 1024 * 1024; // 16 MB
 * const chunkSize = Math.min(budget, CHUNK_DEFAULT);
 */
export function getInMemoryProcessingBudgetBytes() {
  const mobile = isMobile();
  const perfMem = readPerformanceMemory();
  const deviceGB = readDeviceMemoryGB();

  const fromHeap = perfMem ? perfMem.freeHeap * HEADROOM_FRACTION : undefined;
  const fromRam  = budgetFromDeviceRam(deviceGB, mobile);
  const fromHints = budgetFromCoarseHints();

  // Pick the most conservative available estimate.
  const candidates = [fromHeap, fromRam, fromHints].filter(v => Number.isFinite(v) && v > 0);
  let budget = candidates.length ? Math.min(...candidates) : DEFAULT_BUDGET;

  // Cap to a safe maximum.
  budget = Math.min(budget, MAX_PROCESSING_BUDGET);

  // Ensure we never return 0 due to oddities or misreads.
  return Math.max(TEN_MB, budget);
}

export default getInMemoryProcessingBudgetBytes;