import { describe, expect, it } from "vitest"

import { calculateGp, emptyHammerCounts, type HammerCounts } from "./index"

const LEGACY_POINTS = { wooden: 1, iron: 10, copper: 20, silver: 50, gold: 0 } as const
const LEGACY_NORMAL = [
  [10, "iron"],
  [20, "iron"],
  [30, "copper"],
  [40, "silver"],
  [80, "silver"],
  [100, "silver"],
  [70, "copper"],
  [50, "silver"],
  [100, "gold"],
] as const
const LEGACY_WEEKLY = [
  1000, 2000, 4000, 6000, 8000, 9000, 10000, 12000, 14000, 16000,
  17000, 18000, 20000, 22000, 24000, 25000, 26000, 28000, 30000,
] as const

function legacyReference(hammers: Partial<HammerCounts>, weeklyEvent: boolean) {
  let processing: HammerCounts = {
    wooden: Math.max(0, Math.trunc(hammers.wooden ?? 0)),
    iron: Math.max(0, Math.trunc(hammers.iron ?? 0)),
    copper: Math.max(0, Math.trunc(hammers.copper ?? 0)),
    silver: Math.max(0, Math.trunc(hammers.silver ?? 0)),
    gold: Math.max(0, Math.trunc(hammers.gold ?? 0)),
  }
  const gained = emptyHammerCounts()
  let totalPoints = 0
  let accumulated = 0
  let normalIndex = 0
  let weeklyIndex = 0
  let iterations = 0

  while (iterations < 2000) {
    const points =
      processing.wooden + processing.iron * 10 + processing.copper * 20 + processing.silver * 50
    const normal = LEGACY_NORMAL[normalIndex]!
    const canGainNormal = accumulated + points >= normal[0]
    const canGainWeekly =
      weeklyEvent && weeklyIndex < LEGACY_WEEKLY.length && totalPoints + points >= LEGACY_WEEKLY[weeklyIndex]!

    if (points === 0 && !canGainNormal && !canGainWeekly) break

    totalPoints += points
    accumulated += points
    processing = emptyHammerCounts()

    while (accumulated >= LEGACY_NORMAL[normalIndex]![0]) {
      const [cost, hammer] = LEGACY_NORMAL[normalIndex]!
      accumulated -= cost
      gained[hammer] += 1
      processing[hammer] += 1
      normalIndex = (normalIndex + 1) % LEGACY_NORMAL.length
    }

    if (weeklyEvent) {
      while (weeklyIndex < LEGACY_WEEKLY.length && totalPoints >= LEGACY_WEEKLY[weeklyIndex]!) {
        gained.iron += 10
        processing.iron += 10
        weeklyIndex += 1
      }
    }

    iterations += 1
  }

  return { totalPoints, gainedHammers: gained, iterations }
}

function expectLegacyParity(hammers: Partial<HammerCounts>, weeklyEvent: boolean) {
  const optimized = calculateGp({ hammers, weeklyEvent })
  const legacy = legacyReference(hammers, weeklyEvent)
  expect(optimized.totalPoints).toBe(legacy.totalPoints)
  expect(optimized.gainedHammers).toEqual(legacy.gainedHammers)
  expect(optimized.iterations).toBe(legacy.iterations)
  expect(optimized.converged).toBe(true)
}

describe("calculateGp", () => {
  it("returns zero for an empty inventory", () => {
    expect(calculateGp({ hammers: emptyHammerCounts(), weeklyEvent: false })).toMatchObject({
      totalPoints: 0,
      gainedHammers: emptyHammerCounts(),
      converged: true,
    })
  })

  it("preserves representative legacy results", () => {
    expectLegacyParity({ wooden: 10 }, false)
    expectLegacyParity({ wooden: 500 }, false)
    expectLegacyParity({ wooden: 1000 }, true)
  })

  it("matches the legacy implementation exhaustively for small inventories", () => {
    for (let wooden = 0; wooden <= 4; wooden += 1) {
      for (let iron = 0; iron <= 4; iron += 1) {
        for (let copper = 0; copper <= 4; copper += 1) {
          for (let silver = 0; silver <= 4; silver += 1) {
            for (let gold = 0; gold <= 4; gold += 1) {
              const hammers = { wooden, iron, copper, silver, gold }
              expectLegacyParity(hammers, false)
              expectLegacyParity(hammers, true)
            }
          }
        }
      }
    }
  })

  it("matches the legacy implementation for deterministic randomized inventories", () => {
    let state = 0x0a71f00d
    const next = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state
    }

    for (let index = 0; index < 500; index += 1) {
      const hammers = {
        wooden: next() % 2001,
        iron: next() % 2001,
        copper: next() % 2001,
        silver: next() % 2001,
        gold: next() % 2001,
      }
      expectLegacyParity(hammers, (next() & 1) === 1)
    }
  })

  it("collapses large normal cycles while preserving the legacy result", () => {
    expectLegacyParity({ wooden: 10_000_000 }, false)
    expect(calculateGp({ hammers: { wooden: 10_000_000 }, weeklyEvent: false }).iterations).toBeLessThan(64)
  })
})
