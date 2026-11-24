/**
 * Signed-reasoning cache: replay verified thinking onto history turns.
 *
 * Ported from devin_proxy/reasoning.py.
 */

import { createHash } from "node:crypto"

const CAP = 256

interface CacheEntry {
  thinking: string
  signature: string
  signatureType: string
}

const cache = new Map<string, CacheEntry>()

const key = (content: string): string => {
  const norm = (content ?? "").replace(/\s+/g, " ").slice(0, 700)
  return createHash("sha256").update(norm, "utf-8").digest("hex")
}

export function remember(content: string, thinking: string, signature: string, signatureType: string): boolean {
  if (!content || !thinking || !signature) return false
  const k = key(content)
  cache.set(k, { thinking: thinking.slice(0, 65000), signature, signatureType: signatureType ?? "" })
  cache.delete(k)
  cache.set(k, { thinking: thinking.slice(0, 65000), signature, signatureType: signatureType ?? "" })
  while (cache.size > CAP) {
    const first = cache.keys().next().value!
    cache.delete(first)
  }
  return true
}

interface Message {
  role?: string
  content?: string | unknown
  signature?: string
  thinking?: string
  signature_type?: string
  [k: string]: unknown
}

/** Attach previously captured signed reasoning to assistant history turns. */
export function attach(messages: Message[], maxTurns = 0, maxChars = 0): { count: number; chars: number } {
  if (!Array.isArray(messages)) return { count: 0, chars: 0 }
  const hits: Array<{ idx: number; hit: CacheEntry }> = []
  for (let idx = 0; idx < messages.length; idx++) {
    const m = messages[idx]!
    if (m.role !== "assistant" || m.signature) continue
    const content = m.content
    if (typeof content !== "string") continue
    const hit = cache.get(key(content))
    if (hit) hits.push({ idx, hit })
  }
  const limited = maxTurns > 0 ? hits.slice(-maxTurns) : hits
  let count = 0
  let chars = 0
  for (const { idx, hit } of limited) {
    let thinking = hit.thinking
    if (maxChars > 0 && chars + thinking.length > maxChars) {
      if (chars) break
      thinking = thinking.slice(0, maxChars)
    }
    const m = messages[idx]!
    m.thinking = thinking
    m.signature = hit.signature
    m.signature_type = hit.signatureType
    count++
    chars += thinking.length
  }
  return { count, chars }
}
