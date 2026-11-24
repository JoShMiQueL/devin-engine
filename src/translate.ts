/**
 * OpenAI <-> Devin message translation.
 *
 * The Devin wire has no system role — system content folds into the next
 * user turn; frame notes land as a SYSTEM-tagged mid-history user turn
 * right before the last user message.
 *
 * Ported from devin_proxy/translate.py.
 */

import type { ChatContent, ChatHistoryItem } from "devin-core"

interface OpenAIMessage {
  role?: string
  content?: string | Array<{ type?: string; text?: string; image_url?: { url?: string } }>
  tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>
  tool_call_id?: string
  [k: string]: unknown
}

/**
 * Fold system messages into the following user turn; convert to
 * ChatHistoryItem[].
 */
export function openaiToWire(
  messages: OpenAIMessage[],
  opts: { frameNote?: string; imgMaxBytes?: number } = {},
): { system: string; prompts: ChatHistoryItem[] } {
  const { frameNote = "", imgMaxBytes = 12 * 1024 * 1024 } = opts
  void imgMaxBytes // images pass through as base64 data URLs — size guard lives upstream
  const prompts: ChatHistoryItem[] = []
  const systemParts: string[] = []

  for (const m of messages) {
    const role = m.role ?? "user"
    const content = m.content
    if (role === "system") {
      const text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.filter((p) => p?.type === "text").map((p) => p.text ?? "").join("\n")
            : ""
      if (text.trim()) systemParts.push(text)
      continue
    }
    if (role === "assistant") {
      const text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.filter((p) => p?.type === "text").map((p) => p.text ?? "").join("\n")
            : ""
      const toolCalls = (m.tool_calls ?? [])
        .filter((tc) => tc?.function?.name)
        .map((tc) => ({
          id: tc.id ?? "",
          name: tc.function!.name!,
          arguments: tc.function!.arguments ?? "{}",
        }))
      prompts.push({ role: "assistant", content: text, tool_calls: toolCalls.length ? toolCalls : undefined })
      continue
    }
    if (role === "tool") {
      const text = typeof content === "string" ? content : JSON.stringify(content ?? "")
      prompts.push({ role: "tool", content: text, tool_call_id: m.tool_call_id ?? "" })
      continue
    }
    // user
    if (typeof content === "string") {
      prompts.push({ role: "user", content })
    } else if (Array.isArray(content)) {
      const parts = content
        .map((p) => {
          if (p?.type === "text" || (p && !p.type && p.text)) {
            return { type: "text" as const, text: p.text ?? "" }
          }
          if (p?.type === "image_url" && p.image_url?.url) {
            const url = p.image_url.url
            const m2 = /^data:([^;,]+)?;base64,(.*)$/.exec(url)
            if (m2) {
              return {
                type: "image" as const,
                mimeType: m2[1] ?? "image/png",
                base64Data: m2[2]!.replace(/\s/g, ""),
              }
            }
          }
          return null
        })
        .filter(Boolean) as Array<{ type: "text"; text: string } | { type: "image"; mimeType: string; base64Data: string }>
      if (parts.length) prompts.push({ role: "user", content: parts as ChatContent })
    }
  }

  // Frame note: a SYSTEM-tagged user turn right before the last user message.
  if (frameNote) {
    const lastUserIdx = prompts.map((p, i) => (p.role === "user" ? i : -1)).filter((i) => i >= 0).pop() ?? -1
    const frameItem: ChatHistoryItem = { role: "user", content: `SYSTEM: ${frameNote}` }
    if (lastUserIdx >= 0) prompts.splice(lastUserIdx, 0, frameItem)
    else prompts.push(frameItem)
  }

  return { system: systemParts.join("\n\n"), prompts }
}
