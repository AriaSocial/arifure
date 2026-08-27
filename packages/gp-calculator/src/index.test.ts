import { describe, expect, it } from "vitest"

import { calculateGp, emptyHammerCounts } from "./index"

describe("calculateGp", () => {
  it("returns zero for an empty inventory", () => {
    expect(calculateGp({ hammers: emptyHammerCounts(), weeklyEvent: false })).toMatchObject({
      totalPoints: 0,
      gainedHammers: emptyHammerCounts(),
      converged: true,
    })
  })

  it("feeds a normal threshold reward back into the calculation", () => {
    const result = calculateGp({ hammers: { wooden: 10 }, weeklyEvent: false })

    expect(result.totalPoints).toBe(20)
    expect(result.gainedHammers).toEqual({
      wooden: 0,
      iron: 1,
      copper: 0,
      silver: 0,
      gold: 0,
    })
  })

  it("preserves the legacy 500 point-cycle behavior", () => {
    const result = calculateGp({ hammers: { wooden: 500 }, weeklyEvent: false })

    expect(result.totalPoints).toBe(1040)
    expect(result.gainedHammers).toEqual({
      wooden: 0,
      iron: 6,
      copper: 4,
      silver: 8,
      gold: 2,
    })
  })

  it("applies weekly rewards and recursively processes the rewarded hammers", () => {
    const result = calculateGp({ hammers: { wooden: 1000 }, weeklyEvent: true })

    expect(result.totalPoints).toBe(2500)
    expect(result.gainedHammers).toEqual({
      wooden: 0,
      iron: 30,
      copper: 10,
      silver: 20,
      gold: 5,
    })
  })
})
