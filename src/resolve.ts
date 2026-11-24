/**
 * Client-facing model-id resolution — OpenAI id + reasoning_effort -> wire uid.
 *
 * Ported from devin_proxy/models/catalog.py (the resolve_model half; the
 * catalog parse lives in devin-core).
 */

/** Wire uids for the base SWE-2 lanes. */
export const SWE2_TIERS = ["swe-2-medium", "swe-2-high", "swe-2-max"] as const

/** SWE-2 Flash lanes — the fast strawberry-pancake family. */
export const SWE2_FLASH_TIERS = ["swe-2-flash-medium", "swe-2-flash-high", "swe-2-flash-max"] as const

/** SWE-2.1 lanes — five effort levels, no flash. */
export const SWE21_TIERS = [
  "swe-2-1-low",
  "swe-2-1-medium",
  "swe-2-1-high",
  "swe-2-1-xhigh",
  "swe-2-1-max",
] as const

/** Every lane we know how to route, in stable order. Lightning excluded — bills fast-mode credits. */
export const ALL_TIERS = [...SWE2_TIERS, ...SWE2_FLASH_TIERS, ...SWE21_TIERS] as const

/** Effort word -> index inside a family tuple (cheapest->strongest). */
const EFFORT_RANK: Record<string, number> = {
  off: 0,
  none: 0,
  minimal: 0,
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 4,
  max: 5,
}

/** (family tiers, effort-name tuple) for a model id. */
function familyTiers(m: string): { tiers: readonly string[]; names: readonly string[] } {
  if (m.includes("flash")) {
    return { tiers: SWE2_FLASH_TIERS, names: ["medium", "high", "max"] }
  }
  if (m.includes("2-1") || m.includes("2.1") || m.includes("2p1")) {
    return { tiers: SWE21_TIERS, names: ["low", "medium", "high", "xhigh", "max"] }
  }
  return { tiers: SWE2_TIERS, names: ["medium", "high", "max"] }
}

export interface ResolveOptions {
  effort?: string
  allowed?: readonly string[]
  default?: string
}

/**
 * Map an OpenAI model id + reasoning_effort to a wire uid.
 *
 * Anything outside `allowed` falls back to `default`. A bare "flash" /
 * "swe-2-flash" id lands on the flash-high lane; "swe-2-1"/"swe-2.1"
 * selects the 2.1 family. Effort picks a tier inside whatever family
 * the model id selected (default: the base family), clamping to the
 * nearest defined level when the family lacks that effort name.
 */
export function resolveModel(model: string, opts: ResolveOptions = {}): string {
  const { effort = "", allowed = ALL_TIERS, default: def = "swe-2-high" } = opts
  const m = (model ?? "").trim().toLowerCase()
  const e = (effort ?? "").trim().toLowerCase()

  // explicit lane always wins
  for (const cand of allowed) {
    if (m === cand || m === cand.replace("swe-2-", "swe2-") || m === cand.replace("swe-2-1-", "swe-2.1-")) {
      return cand
    }
  }

  const { tiers, names } = familyTiers(m)

  let tier: string
  if (e in EFFORT_RANK) {
    const rank = EFFORT_RANK[e]!
    // nearest defined level by rank distance; ties resolve upward so an
    // effort the family lacks lands on the stronger neighbor
    let idx = 0
    let best = Infinity
    for (let i = 0; i < names.length; i++) {
      const d = Math.abs(EFFORT_RANK[names[i]!]! - rank)
      if (d < best || (d === best && EFFORT_RANK[names[i]!]! > EFFORT_RANK[names[idx]!]!)) {
        best = d
        idx = i
      }
    }
    tier = tiers[idx]!
  } else {
    tier = tiers.includes(def) ? def : tiers[Math.floor(tiers.length / 2)]!
  }

  if (allowed.includes(tier)) return tier
  if (allowed.includes(def)) return def
  return allowed[0] ?? tier
}
