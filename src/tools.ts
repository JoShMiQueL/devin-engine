/**
 * Tool-calling support: native wire declarations (field 10) as the primary
 * channel, the <<TOOL_CALL>> text protocol as the fallback, plus the parser
 * that turns either back into OpenAI tool_calls.
 *
 * Ported from devin_proxy/jailbreak/tools.py.
 */

import { randomUUID } from "node:crypto"

export const TOOL_OPEN = "<<TOOL_CALL>>"
export const TOOL_CLOSE = "<<END_TOOL_CALL>>"

const NATIVE_OPEN = "<" + "|open" + "|>"
const NATIVE_CLOSE = "<" + "|close" + "|>"
const NATIVE_SEP = "<" + "|sep" + "|>"

const esc = (s: string) => s.replace(/[|]/g, "\\|")

export interface ToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

interface ToolDef {
  function?: {
    name?: string
    description?: string
    parameters?: unknown
  }
}

/** First sentence of a tool description, markup and parentheticals stripped. */
export function compactDescription(text: string, limit = 200): string {
  let t = String(text ?? "").replace(/\s+/g, " ").trim()
  t = t.replace(/`{1,3}/g, "")
  t = t.replace(/<[^>]{1,40}>/g, " ")
  t = t.replace(/\([^()]{0,200}\)/g, " ")
  t = t.replace(/\s+/g, " ").trim()
  let first = t.split(/(?<=[.!?\u2026])\s/)[0] ?? t
  if (first.length < 12 && t.length > first.length) first = t
  return first.length > limit ? first.slice(0, limit).trimEnd() + "\u2026" : first
}

/** System-prompt block declaring client tools and the call protocol. */
export function renderTools(tools: ToolDef[], descMode = "full", lang = "en"): string {
  const lines: string[] =
    lang === "es"
      ? [
          "Llamadas a herramientas. Cuando la tarea necesite una herramienta, emite una llamada y para:",
          TOOL_OPEN + ' {"name": "<tool>", "arguments": {<json arguments>}} ' + TOOL_CLOSE,
          "No escribas nada m\u00e1s en ese turno; el resultado de la herramienta llega como el siguiente " +
            "mensaje. Nunca inventes un resultado de herramienta.",
          "CR\u00cdTICO: cualquier petici\u00f3n de buscar, leer, ejecutar, editar o comprobar algo en esta m\u00e1quina " +
            "DEBE responderse con exactamente una llamada a herramienta \u2014 nunca describas el plan, " +
            "nunca anuncies la b\u00fasqueda, nunca respondas de memoria. Las preguntas que no necesitan " +
            "herramienta se responden normal.",
          "",
          "Herramientas disponibles:",
        ]
      : [
          "Tool calling. When the task needs a tool, output one call and stop:",
          TOOL_OPEN + ' {"name": "<tool>", "arguments": {<json arguments>}} ' + TOOL_CLOSE,
          "Output nothing else in that turn; the tool result arrives as the next " +
            "message. Never invent a tool result.",
          "CRITICAL: any request to find, read, run, edit or check anything on " +
            "this machine MUST be answered with exactly one tool call \u2014 never " +
            "describe the plan, never announce the search, never answer from " +
            "memory. Questions that need no tool are answered normally.",
          "",
          "Available tools:",
        ]
  for (const t of tools ?? []) {
    const fn = t?.function ?? {}
    const name = fn.name
    if (!name) continue
    let desc = String(fn.description ?? "").trim()
    if (descMode === "none") desc = ""
    else if (descMode === "compact") desc = compactDescription(desc)
    lines.push(desc ? `- ${name}: ${desc}` : `- ${name}`)
    if (fn.parameters) {
      lines.push("  parameters: " + JSON.stringify(fn.parameters).slice(0, 1500))
    }
  }
  return lines.join("\n")
}

function coerceArg(raw: string, typ?: string): unknown {
  const s = raw.trim()
  const t = (typ ?? "string").toLowerCase()
  if (["number", "integer", "int", "float", "double"].includes(t)) {
    const n = /^-?\d+$/.test(s) ? parseInt(s, 10) : parseFloat(s)
    return Number.isNaN(n) ? s : n
  }
  if (["boolean", "bool"].includes(t)) {
    return ["true", "1", "yes"].includes(s.toLowerCase())
  }
  if (["object", "array", "json"].includes(t)) {
    try {
      return JSON.parse(s)
    } catch {
      return s
    }
  }
  return s
}

/** Parse Devin's native tool-call syntax when the model emits it as text. */
export function parseNativeToolText(text: string): [string, ToolCall[]] {
  if (!text?.includes(NATIVE_OPEN + "call")) return [text, []]
  const calls: ToolCall[] = []
  const callRe = new RegExp(esc(NATIVE_OPEN) + 'call\\s+tool="([^"]+)"(.*?)' + esc(NATIVE_CLOSE) + "call", "gs")
  for (const m of text.matchAll(callRe)) {
    const [, name, body] = m
    const args: Record<string, unknown> = {}
    const argRe = new RegExp(
      esc(NATIVE_OPEN) +
        'argument\\s+key="([^"]+)"(?:\\s+type="([^"]+)")?\\s*' +
        esc(NATIVE_SEP) +
        "(.*?)" +
        esc(NATIVE_CLOSE) +
        "argument",
      "gs",
    )
    for (const am of body.matchAll(argRe)) {
      args[am[1]!] = coerceArg(am[3]!, am[2])
    }
    calls.push({
      id: "call_" + randomUUID().replace(/-/g, "").slice(0, 12),
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    })
  }
  if (!calls.length) return [text, []]
  let clean = text
  let start = clean.indexOf(NATIVE_OPEN + "tools")
  if (start < 0) start = clean.indexOf(NATIVE_OPEN + "call")
  let end = clean.indexOf(NATIVE_CLOSE + "tools", start)
  if (end >= 0) {
    end += (NATIVE_CLOSE + "tools").length
  } else {
    const last = clean.lastIndexOf(NATIVE_CLOSE + "call")
    end = last >= 0 ? last + (NATIVE_CLOSE + "call").length : clean.length
  }
  clean = clean.slice(0, start) + clean.slice(end)
  clean = clean.split(NATIVE_OPEN + "message").join("").split(NATIVE_CLOSE + "message").join("")
  clean = clean.split(NATIVE_OPEN).join(" ").split(NATIVE_CLOSE).join(" ").split(NATIVE_SEP).join(" ")
  return [clean.trim(), calls]
}

/** Best-effort decode of a tool-call body that is not valid JSON. */
function salvageToolObj(raw: string): Record<string, unknown> | null {
  const s = (raw ?? "").trim()
  if (!s) return null
  try {
    const obj = JSON.parse(s)
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj
  } catch {
    /* fall through */
  }
  for (let end = s.length - 1; end > Math.max(0, s.length - 400); end--) {
    try {
      const obj = JSON.parse(s.slice(0, end))
      if (obj && typeof obj === "object" && !Array.isArray(obj) && (obj.name || obj.tool)) return obj
    } catch {
      continue
    }
  }
  const m = /"name"\s*:\s*"([^"]+)"/.exec(s)
  if (!m) return null
  let args: unknown = {}
  const am = /"arguments"\s*:\s*/.exec(s)
  if (am) {
    const rest = s.slice(am.index + am[0].length).trimStart()
    if (rest.startsWith("{")) {
      let depth = 0
      let instr = false
      let esc2 = false
      const out: string[] = []
      for (const ch of rest) {
        out.push(ch)
        if (esc2) {
          esc2 = false
          continue
        }
        if (ch === "\\") {
          esc2 = true
          continue
        }
        if (ch === '"') {
          instr = !instr
          continue
        }
        if (instr) continue
        if (ch === "{") depth++
        else if (ch === "}") {
          depth--
          if (depth === 0) break
        }
      }
      try {
        args = JSON.parse(out.join(""))
      } catch {
        args = {}
      }
    }
  }
  return { name: m[1], arguments: args }
}

/**
 * Remove leftover native-protocol wrappers from a plain answer.
 * Only flattens same-line whitespace — paragraph breaks and markdown
 * structure are the model's output, not noise to strip.
 */
export function stripProtocolNoise(text: string): string {
  if (!text) return text
  let t = text
  for (const tok of ["tools", "call", "argument", "message"]) {
    t = t.split(NATIVE_OPEN + tok).join(" ").split(NATIVE_CLOSE + tok).join(" ")
  }
  t = t.split(NATIVE_OPEN).join(" ").split(NATIVE_CLOSE).join(" ").split(NATIVE_SEP).join(" ")
  t = t.replace(/[^\S\n]{2,}/g, " ")
  t = t.replace(/\n{3,}/g, "\n\n")
  return t.trim()
}

/** Parse the <<TOOL_CALL>> text protocol; returns (clean_text, calls). */
export function parseToolText(text: string): [string, ToolCall[]] {
  if (!text?.includes(TOOL_OPEN)) return [text, []]
  const calls: ToolCall[] = []
  const re = new RegExp(TOOL_OPEN.replace(/[<>]/g, "\\$&") + "\\s*(.*?)\\s*" + TOOL_CLOSE.replace(/[<>]/g, "\\$&"), "gs")
  for (const m of text.matchAll(re)) {
    const obj = salvageToolObj(m[1]!)
    if (!obj) continue
    const name = String(obj.name ?? obj.tool ?? "")
    if (!name) continue
    const args = obj.arguments
    const argsJson = typeof args === "string" ? args : JSON.stringify(args ?? {})
    calls.push({
      id: "call_" + randomUUID().replace(/-/g, "").slice(0, 12),
      type: "function",
      function: { name, arguments: argsJson },
    })
  }
  const clean = text
    .replace(new RegExp(TOOL_OPEN.replace(/[<>]/g, "\\$&") + ".*?" + TOOL_CLOSE.replace(/[<>]/g, "\\$&"), "gs"), "")
    .trim()
  return [clean, calls]
}
