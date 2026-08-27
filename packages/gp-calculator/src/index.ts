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

const NORMAL_THRESHOLDS = [
  { thresholdDiff: 10, hammer: "iron" },
  { thresholdDiff: 20, hammer: "iron" },
  { thresholdDiff: 30, hammer: "copper" },
  { thresholdDiff: 40, hammer: "silver" },
  { thresholdDiff: 80, hammer: "silver" },
  { thresholdDiff: 100, hammer: "silver" },
  { thresholdDiff: 70, hammer: "copper" },
  { thresholdDiff: 50, hammer: "silver" },
  { thresholdDiff: 100, hammer: "gold" },
] as const satisfies ReadonlyArray<{ thresholdDiff: number; hammer: HammerType }>

const WEEKLY_THRESHOLDS = [
  1000,
  2000,
  4000,
  6000,
  8000,
  9000,
  10000,
  12000,
  14000,
  16000,
  17000,
  18000,
  20000,
  22000,
  24000,
  25000,
  26000,
  28000,
  30000,
] as const

// One complete normal reward cycle consumes 500 Pt and yields
// 2 iron + 2 copper + 4 silver + 1 gold = 260 Pt worth of hammers.
// Complete cycles can therefore be collapsed into a single arithmetic operation.
const NORMAL_CYCLE_COST = 500
const NORMAL_CYCLE_REWARD_POINTS = 260
const NORMAL_CYCLE_REWARDS: HammerCounts = {
  wooden: 0,
  iron: 2,
  copper: 2,
  silver: 4,
  gold: 1,
}

const WEEKLY_IRON_REWARD_COUNT = 10
const WEEKLY_IRON_REWARD_POINTS = POINTS_PER_HAMMER.iron * WEEKLY_IRON_REWARD_COUNT

// For a safe-integer initial point total, normal rewards shrink each complete
// generation to at most 52% of the previous one. 64 generations is therefore
// a defensive invariant guard rather than a work budget.
const MAX_GENERATIONS = 64

export function emptyHammerCounts(): HammerCounts {
  return { wooden: 0, iron: 0, copper: 0, silver: 0, gold: 0 }
}

function normalizeCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  const normalized = Math.max(0, Math.trunc(value))
  if (!Number.isSafeInteger(normalized)) {
    throw new RangeError("Hammer count exceeds JavaScript's safe integer range")
  }
  return normalized
}

function initialPoints(input: Partial<HammerCounts>): number {
  const wooden = normalizeCount(input.wooden)
  const iron = normalizeCount(input.iron)
  const copper = normalizeCount(input.copper)
  const silver = normalizeCount(input.silver)
  normalizeCount(input.gold) // gold is intentionally worth 0 Pt, but still validate it.

  const points = wooden + iron * 10 + copper * 20 + silver * 50
  if (!Number.isSafeInteger(points)) {
    throw new RangeError("Initial point total exceeds JavaScript's safe integer range")
  }
  return points
}

/**
 * Calculates the legacy GP result without iterating once per reward threshold.
 *
 * The legacy implementation walked every 10/20/.../100 Pt threshold individually.
 * Here we align to a cycle boundary, collapse all complete 500 Pt cycles in O(1),
 * and only walk the at-most-eight thresholds on either edge. Reward generations
 * still feed back recursively, preserving the original externally visible result.
 */
export function calculateGp(input: CalculateGpInput): CalculateGpResult {
  let pendingPoints = initialPoints(input.hammers)
  let totalPoints = 0
  let pointsSinceNormalThreshold = 0
  let normalThresholdIndex = 0
  let weeklyThresholdIndex = 0
  let generations = 0
  const gainedHammers = emptyHammerCounts()

  while (pendingPoints > 0) {
    totalPoints += pendingPoints
    if (!Number.isSafeInteger(totalPoints)) {
      throw new RangeError("Calculated point total exceeds JavaScript's safe integer range")
    }

    pointsSinceNormalThreshold += pendingPoints
    let nextGenerationPoints = 0

    // If the previous generation stopped part-way through a cycle, finish only
    // the remaining prefix first. This costs at most eight threshold checks.
    while (normalThresholdIndex !== 0) {
      const threshold = NORMAL_THRESHOLDS[normalThresholdIndex]
      if (threshold === undefined || pointsSinceNormalThreshold < threshold.thresholdDiff) break

      pointsSinceNormalThreshold -= threshold.thresholdDiff
      gainedHammers[threshold.hammer] += 1
      nextGenerationPoints += POINTS_PER_HAMMER[threshold.hammer]
      normalThresholdIndex = (normalThresholdIndex + 1) % NORMAL_THRESHOLDS.length
    }

    if (normalThresholdIndex === 0) {
      // Bulk-process every complete normal cycle instead of visiting nine
      // thresholds for each 500 Pt block.
      const completeCycles = Math.floor(pointsSinceNormalThreshold / NORMAL_CYCLE_COST)
      if (completeCycles > 0) {
        pointsSinceNormalThreshold -= completeCycles * NORMAL_CYCLE_COST
        gainedHammers.iron += completeCycles * NORMAL_CYCLE_REWARDS.iron
        gainedHammers.copper += completeCycles * NORMAL_CYCLE_REWARDS.copper
        gainedHammers.silver += completeCycles * NORMAL_CYCLE_REWARDS.silver
        gainedHammers.gold += completeCycles * NORMAL_CYCLE_REWARDS.gold
        nextGenerationPoints += completeCycles * NORMAL_CYCLE_REWARD_POINTS
      }

      // Less than one cycle remains, so this loop executes at most eight times.
      while (true) {
        const threshold = NORMAL_THRESHOLDS[normalThresholdIndex]
        if (threshold === undefined || pointsSinceNormalThreshold < threshold.thresholdDiff) break

        pointsSinceNormalThreshold -= threshold.thresholdDiff
        gainedHammers[threshold.hammer] += 1
        nextGenerationPoints += POINTS_PER_HAMMER[threshold.hammer]
        normalThresholdIndex = (normalThresholdIndex + 1) % NORMAL_THRESHOLDS.length
      }
    }

    // Weekly thresholds are finite and monotonic. Across the entire calculation
    // this loop can execute only WEEKLY_THRESHOLDS.length (19) times total.
    if (input.weeklyEvent) {
      while (
        weeklyThresholdIndex < WEEKLY_THRESHOLDS.length &&
        totalPoints >= WEEKLY_THRESHOLDS[weeklyThresholdIndex]!
      ) {
        gainedHammers.iron += WEEKLY_IRON_REWARD_COUNT
        nextGenerationPoints += WEEKLY_IRON_REWARD_POINTS
        weeklyThresholdIndex += 1
      }
    }

    pendingPoints = nextGenerationPoints
    generations += 1

    if (generations >= MAX_GENERATIONS && pendingPoints > 0) {
      return {
        totalPoints,
        gainedHammers,
        iterations: generations,
        converged: false,
      }
    }
  }

  return {
    totalPoints,
    gainedHammers,
    iterations: generations,
    converged: true,
  }
}
