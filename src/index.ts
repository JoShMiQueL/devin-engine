/**
 * devin-engine — embeddable compliance engine over devin-core.
 *
 * The value-add of devin-proxy, packaged as a class (not a server) so
 * plugins (devin-opencode, devin-claude) and the standalone proxy wrap the
 * same implementation:
 *
 * ```ts
 * import { createEngine } from "devin-engine"
 * const eng = createEngine({ catalog, override, settings })
 * for await (const delta of eng.chat(messages, { model, effort })) { ... }
 * eng.billingTag("swe-2-1-max") // -> "free" | "promo:2026-12-09" | "6.0cr"
 * ```
 *
 * Ported from devin_proxy/{pipeline,jailbreak,models} (Python reference).
 */
export {}
