export type HammerType = "wooden" | "iron" | "copper" | "silver" | "gold"

export type HammerCounts = Record<HammerType, number>

export interface CalculateGpInput {
  hammers: Partial<HammerCounts>
  weeklyEvent: boolean
}

export interface CalculateGpResult {
  totalPoints: number
  gainedHammers: HammerCounts
  iterations: number
  converged: boolean
}

const POINTS_PER_HAMMER: HammerCounts = {
  wooden: 1,
  iron: 10,
  copper: 20,
  silver: 50,
  gold: 0,
}

const NORMAL_THRESHOLDS: ReadonlyArray<{
  thresholdDiff: number
  hammer: HammerType
}> = [
  { thresholdDiff: 10, hammer: "iron" },
  { thresholdDiff: 20, hammer: "iron" },
  { thresholdDiff: 30, hammer: "copper" },
  { thresholdDiff: 40, hammer: "silver" },
  { thresholdDiff: 80, hammer: "silver" },
  { thresholdDiff: 100, hammer: "silver" },
  { thresholdDiff: 70, hammer: "copper" },
  { thresholdDiff: 50, hammer: "silver" },
  { thresholdDiff: 100, hammer: "gold" },
]

const WEEKLY_THRESHOLDS: ReadonlyArray<{
  threshold: number
  hammer: HammerType
  count: number
}> = [
  { threshold: 1000, hammer: "iron", count: 10 },
  { threshold: 2000, hammer: "iron", count: 10 },
  { threshold: 4000, hammer: "iron", count: 10 },
  { threshold: 6000, hammer: "iron", count: 10 },
  { threshold: 8000, hammer: "iron", count: 10 },
  { threshold: 9000, hammer: "iron", count: 10 },
  { threshold: 10000, hammer: "iron", count: 10 },
  { threshold: 12000, hammer: "iron", count: 10 },
  { threshold: 14000, hammer: "iron", count: 10 },
  { threshold: 16000, hammer: "iron", count: 10 },
  { threshold: 17000, hammer: "iron", count: 10 },
  { threshold: 18000, hammer: "iron", count: 10 },
  { threshold: 20000, hammer: "iron", count: 10 },
  { threshold: 22000, hammer: "iron", count: 10 },
  { threshold: 24000, hammer: "iron", count: 10 },
  { threshold: 25000, hammer: "iron", count: 10 },
  { threshold: 26000, hammer: "iron", count: 10 },
  { threshold: 28000, hammer: "iron", count: 10 },
  { threshold: 30000, hammer: "iron", count: 10 },
]

const HAMMER_TYPES: readonly HammerType[] = [
  "wooden",
  "iron",
  "copper",
  "silver",
  "gold",
]

const MAX_ITERATIONS = 2000

export function emptyHammerCounts(): HammerCounts {
  return { wooden: 0, iron: 0, copper: 0, silver: 0, gold: 0 }
}

function normalizeCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

function normalizeHammers(input: Partial<HammerCounts>): HammerCounts {
  return {
    wooden: normalizeCount(input.wooden),
    iron: normalizeCount(input.iron),
    copper: normalizeCount(input.copper),
    silver: normalizeCount(input.silver),
    gold: normalizeCount(input.gold),
  }
}

function pointsFromHammers(hammers: HammerCounts): number {
  return HAMMER_TYPES.reduce(
    (total, type) => total + hammers[type] * POINTS_PER_HAMMER[type],
    0,
  )
}

/**
 * Legacy calculator behavior expressed as a deterministic, UI-independent function.
 * Reward hammers are fed back into the next iteration exactly as in the old implementation.
 */
export function calculateGp(input: CalculateGpInput): CalculateGpResult {
  let hammersForProcessing = normalizeHammers(input.hammers)
  let totalPoints = 0
  let pointsSinceNormalThreshold = 0
  let normalThresholdIndex = 0
  let weeklyThresholdIndex = 0
  let iterations = 0
  const gainedHammers = emptyHammerCounts()

  while (iterations < MAX_ITERATIONS) {
    const pointsThisIteration = pointsFromHammers(hammersForProcessing)
    const normalThreshold = NORMAL_THRESHOLDS[normalThresholdIndex]
    const weeklyThreshold = WEEKLY_THRESHOLDS[weeklyThresholdIndex]

    const canGainNormal =
      normalThreshold !== undefined &&
      pointsSinceNormalThreshold + pointsThisIteration >= normalThreshold.thresholdDiff
    const canGainWeekly =
      input.weeklyEvent &&
      weeklyThreshold !== undefined &&
      totalPoints + pointsThisIteration >= weeklyThreshold.threshold

    if (pointsThisIteration === 0 && !canGainNormal && !canGainWeekly) break

    totalPoints += pointsThisIteration
    pointsSinceNormalThreshold += pointsThisIteration
    hammersForProcessing = emptyHammerCounts()

    while (true) {
      const threshold = NORMAL_THRESHOLDS[normalThresholdIndex]
      if (threshold === undefined || pointsSinceNormalThreshold < threshold.thresholdDiff) break

      gainedHammers[threshold.hammer] += 1
      hammersForProcessing[threshold.hammer] += 1
      pointsSinceNormalThreshold -= threshold.thresholdDiff
      normalThresholdIndex = (normalThresholdIndex + 1) % NORMAL_THRESHOLDS.length
    }

    if (input.weeklyEvent) {
      while (true) {
        const threshold = WEEKLY_THRESHOLDS[weeklyThresholdIndex]
        if (threshold === undefined || totalPoints < threshold.threshold) break

        gainedHammers[threshold.hammer] += threshold.count
        hammersForProcessing[threshold.hammer] += threshold.count
        weeklyThresholdIndex += 1
      }
    }

    iterations += 1
  }

  return {
    totalPoints,
    gainedHammers,
    iterations,
    converged: iterations < MAX_ITERATIONS,
  }
}
