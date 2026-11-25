/**
 * Conversation-language detection for retry injections.
 *
 * The retry escalation reads as history only when it matches the language
 * the user is actually writing in — so it is detected from the user's own
 * messages, never from the override file (the override is English by
 * design: reasoning models internalize English instructions more reliably,
 * while still answering in whatever language the user writes).
 *
 * Detection is deliberately cheap: accent characters and high-frequency
 * Spanish function words. False positives cost nothing — the injection is
 * grammatically neutral either way — but false negatives read as artifacts.
 */

const ES_CHARS = /[áéíóúñü¿¡]/i
const ES_WORDS =
  /\b(?:como|cómo|para|qué|que|una|unos|unas|este|esta|estoy|quiero|puedo|puedes|hacer|haz|dame|escribe|explica|crea|con|por|los|las|del|muy|más|pero|porque|gracias|ahora|después|también|entonces|cuando|donde|hola|buenas|necesito|ayuda|favor)\b/i

export function detectUserLang(messages: ReadonlyArray<Record<string, unknown>>): "es" | "en" {
  let score = 0
  let seen = 0
  for (const m of messages) {
    if (m.role !== "user") continue
    const c = m.content
    const text =
      typeof c === "string"
        ? c
        : Array.isArray(c)
          ? c.map((p) => (p && typeof p === "object" && "text" in p ? String(p.text ?? "") : "")).join(" ")
          : ""
    if (!text.trim()) continue
    seen++
    if (ES_CHARS.test(text)) score += 2
    if (ES_WORDS.test(text)) score += 1
  }
  return score >= 2 || (seen > 0 && score >= 1 && seen === 1) ? "es" : "en"
}
