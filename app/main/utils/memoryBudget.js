// memory-budget.js 
import { FileOpsConstants } from "../constants/constants.js";

const MB = 1024 * 1024;
const GB = 1024 * MB;
const TEN_MB = 10 * MB;

const MAX_PROCESSING_BUDGET = 400 * MB;
const DEFAULT_BUDGET = FileOpsConstants.STREAM_ENCRYPTION_MIN_SIZE;
const HEADROOM_FRACTION = 0.5;

function isMobile() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
    return navigator.userAgentData.mobile;
  }
  return /Mobi|Android|iPhone|iPad|iPod|IEMobile|BlackBerry/i.test(navigator.userAgent);
}

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

function readDeviceMemoryGB() {
  const dm = Number(navigator.deviceMemory);
  return Number.isFinite(dm) && dm > 0 ? dm : undefined;
}

function budgetFromDeviceRam(deviceGB, mobile) {
  if (!deviceGB) return undefined;
  // Conservative slice of total RAM for this tab/process.
  const fraction = mobile
    ? (deviceGB <= 2 ? 0.02 : deviceGB <= 4 ? 0.03 : 0.04)
    : (deviceGB <= 4 ? 0.04 : deviceGB <= 8 ? 0.06 : 0.08);
  return deviceGB * GB * fraction;
}

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
 * Returns the estimated safe processing budget (bytes) for in-memory work,
 * rounded down to the nearest 10 MB, capped at 400 MB.
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

  // Cap and round down to nearest 10 MB.
  budget = Math.min(budget, MAX_PROCESSING_BUDGET);

  // Ensure we never return 0 due to rounding.
  return Math.max(TEN_MB, budget);
}

export default getInMemoryProcessingBudgetBytes;