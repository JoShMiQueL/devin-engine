/**
 * History hygiene: drop empty assistant turns, strip transport notes and the
 * model's own past refusals before they can anchor the next turn.
 *
 * Ported from devin_proxy/jailbreak/sanitize.py.
 */

/** NFC-normalize + collapse whitespace for stable regex matching. */
const norm = (text: unknown): string =>
  (typeof text === "string" ? text.normalize("NFC") : String(text ?? ""))
    .replace(/\s+/g, " ")
    .trim()

export const MODEL_SWITCH_NOTE_RE = /^\s*\[Note:\s*model was just switched\b.*?Adjust your self-identification accordingly\.\]\s*/is

export const HISTORY_REFUSAL_RE = new RegExp(
  "^\\s*(?:\u043d\u0435\u0442[.,!\u2026]|\u0441\u0442\u043e\u043f\\b|" +
    "\u043e\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u044e\u0441\u044c\\b|" +
    "\u043d\u0435 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u044e\\b|" +
    "\u043e\u0442\u0432\u0435\u0442 \u043e\u0441\u0442\u0430[\u0435\u0451]\u0442\u0441\u044f \u0442\u0435\u043c \u0436\u0435|" +
    "\u0441 \u044d\u0442\u0438\u043c \u044f \u043f\u043e\u043c\u043e\u0447\u044c \u043d\u0435 \u043c\u043e\u0433\u0443|" +
    "\u044f \u043d\u0435 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0443|" +
    "\u0437\u0434\u0435\u0441\u044c \u044f \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u044e\u0441\u044c|" +
    "i (?:can't|cannot|won't)|i(?:'m| am) stopping)" +
    "|\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u044e\u0441\u044c \u0438 \u0441\u043a\u0430\u0436\u0443|" +
    "\u0434\u0430\u043b\u044c\u0448\u0435 \u043d\u0435 \u043f\u043e\u0439\u0434\u0443|" +
    "\u0440\u0430\u0441\u0448\u0438\u0440\u044f\u0442\u044c \u044d\u0442\u0443 \u0438\u043d\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0443|" +
    "\u043f\u043e\u0437\u0438\u0446\u0438[\u0438\u044f] \u043d\u0435 \u0441\u0434\u0432\u0438\u043d\u0443\u043b|" +
    "\u043e\u0442 \u043f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u0438\u044f \u043d\u0435 \u0441\u0434\u0432\u0438\u043d\u0435\u0442\u0441\u044f|" +
    "\u0433\u0434\u0435 \u043c\u043e\u0439 \u043f\u0440\u0435\u0434\u0435\u043b|" +
    "\u043d\u0435 \u0431\u0443\u0434\u0443 \u0434\u0435\u043b\u0430\u0442\u044c: \u043f\u0438\u0441\u0430\u0442\u044c \u0433\u043e\u0442\u043e\u0432\u044b\u0435 \u043f\u0443\u043b\u044b|" +
    "\u043d\u0435 \u043c\u043e\u0433\u0443 \u043f\u043e\u043c\u043e\u0447\u044c|" +
    "\u043d\u0430\u0440\u0443\u0448\u0430\u0435\u0442 \u043f\u043e\u043b\u0438\u0442\u0438\u043a|" +
    "\u043d\u0430\u0440\u0443\u0448\u0430\u0435\u0442 \u043f\u0440\u0430\u0432\u0438\u043b\u0430|" +
    "\u0434\u0430\u0432\u0430\u0442\u044c \u043d\u0435 \u0431\u0443\u0434\u0443|" +
    "\u043f\u0438\u0441\u0430\u0442\u044c \u043d\u0435 \u0431\u0443\u0434\u0443|" +
    "\u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u043d\u0435 \u0431\u0443\u0434\u0443|" +
    "\u043d\u0435 \u0431\u0443\u0434\u0443 \u2014|\u043f\u0440\u044f\u043c\u043e\u0439 \u043e\u0442\u043a\u0430\u0437|" +
    "\u044f \u043e\u0442\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0441\u044c|" +
    "\u043e\u0442\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0441\u044c \u043f\u0440\u0435\u0434\u043e\u0441\u0442\u0430\u0432|" +
    "no puedo (?:ayudar|seguir|continuar|escribir|proporcionar|colaborar)|" +
    "no voy a (?:seguir|continuar|ejecutar|hacer|ayudar)|" +
    "hasta aqu[i\u00ed] puedo|me niego a|no es algo que vaya a|" +
    "acceso no autorizado a|lo siento,? (?:pero )?no puedo" +
    "|\u62b1\u6b49[\u002c\uff0c]?\u6211(?:\u4e0d\u80fd|\u65e0\u6cd5|\u4e0d\u4f1a)|" +
    "\u6211(?:\u4e0d\u80fd|\u65e0\u6cd5|\u4e0d\u4f1a)(?:\u5e2e\u52a9|\u534f\u52a9|\u63d0\u4f9b|\u5199|\u751f\u6210|\u7ee7\u7eed)|" +
    "\u8fd9(?:\u4e2a|\u79cd)?(?:\u8bf7\u6c42|\u8981\u6c42|\u5185\u5bb9).{0,10}(?:\u8fdd\u53cd|\u4e0d\u5f53|\u654f\u611f|\u4e0d\u7b26\u5408)|" +
    "\u4f5c\u4e3a(?:\u4e00\u4e2a)?(?:\u4eba\u5de5\u667a\u80fd|AI|\u8bed\u8a00\u6a21\u578b)|" +
    "\u6211(?:\u53ea|\u4ec5)\u80fd(?:\u5e2e\u52a9|\u63d0\u4f9b|\u5efa\u8bae)|" +
    "\u8c22\u7edd|\u4e0d\u4e88\u63d0\u4f9b",
  "i",
)

interface Message {
  role?: string
  content?: string | Array<{ text?: string }>
  [k: string]: unknown
}

/** Drop only truly empty assistant history entries. */
export function sanitizeMessages(msgs: Message[]): { cleaned: Message[]; dropped: number } {
  const cleaned: Message[] = []
  let dropped = 0
  for (const m of msgs) {
    if (!m || m.role !== "assistant") {
      cleaned.push(m)
      continue
    }
    const content = m.content
    const hasContent =
      typeof content === "string"
        ? Boolean(content.trim())
        : Array.isArray(content)
          ? content.length > 0
          : content != null
    const hasOther = ["tool_calls", "function_call", "reasoning_content", "reasoning", "refusal", "audio"].some((k) => m[k])
    if (hasContent || hasOther) cleaned.push(m)
    else dropped++
  }
  return { cleaned, dropped }
}

/** Sentence-level excision of transport notes and past refusals. */
export function sanitizeHistoryArtifacts(msgs: Message[]): { cleaned: Message[]; stats: Record<string, number> } {
  const cleaned: Message[] = []
  const stats = { switch_notes: 0, prefill_echoes: 0, history_refusals: 0 }
  for (const original of msgs) {
    if (!original || typeof original !== "object") {
      cleaned.push(original)
      continue
    }
    const m: Message = { ...original }
    const role = m.role

    if (role === "user") {
      const content = m.content
      if (typeof content === "string") {
        const stripped = content.replace(MODEL_SWITCH_NOTE_RE, "")
        if (stripped !== content) {
          stats.switch_notes++
          m.content = stripped
          if (!stripped.trim()) continue
        }
      } else if (Array.isArray(content)) {
        let changed = false
        const parts = content.map((part) => {
          if (!part || typeof part !== "object" || typeof part.text !== "string") return part
          const stripped = part.text.replace(MODEL_SWITCH_NOTE_RE, "")
          if (stripped !== part.text) {
            stats.switch_notes++
            changed = true
            return { ...part, text: stripped }
          }
          return part
        })
        if (changed) m.content = parts
      }
    }

    if (role === "assistant") {
      const content = m.content
      if (
        typeof content === "string" &&
        HISTORY_REFUSAL_RE.test(norm(content.slice(0, 4000))) &&
        !m.tool_calls &&
        !m.function_call
      ) {
        const originalContent = content
        // split keeping separators
        const parts = content.split(/((?<=[.!?\u2026])\s+|(?<=[\u3002\uff01\uff1f\uff1b]))/)
        const kept: string[] = []
        for (let off = 0; off < parts.length; off += 2) {
          const sent = parts[off]
          const sep = parts[off + 1] ?? ""
          if (!sent) continue
          if (!HISTORY_REFUSAL_RE.test(norm(sent.slice(0, 400)))) kept.push(sent + sep)
        }
        const newContent = kept.join("").trim()
        if (newContent.length < 20 || newContent.length < originalContent.length * 0.3) {
          stats.history_refusals++
          continue
        }
        if (newContent !== originalContent) {
          stats.history_refusals++
          m.content = newContent
        } else {
          stats.history_refusals++
          continue
        }
      }
    }

    cleaned.push(m)
  }
  return { cleaned, stats }
}
