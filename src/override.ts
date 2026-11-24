/**
 * System override file handling: resolution order + mtime hot-reload.
 *
 * Resolution order (first existing file wins):
 *   1. `DEVIN_PROXY_SYSTEM_FILE` env var.
 *   2. `~/.devin-proxy/<name>` — user data dir.
 *   3. `<package>/prompts/<name>` — the shipped default inside the package.
 *
 * Ported from devin_proxy/jailbreak/override.py.
 */

import { existsSync, statSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const NAMES = ["override-compact.txt", "override.txt", "system_override.txt"] as const

/** Bundled language variants under prompts/. */
export const BUNDLED: Record<string, string> = {
  en: "override-compact.txt",
  english: "override-compact.txt",
  es: "override-compact-es.txt",
  spanish: "override-compact-es.txt",
}

function packagePrompts(): string {
  // devin-engine/src/override.ts -> devin-engine/prompts
  return join(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "prompts")
}

/** Resolve a setting/env override to a filesystem path. */
export function resolveSystemFile(setting?: string): string {
  const raw = setting ?? process.env.DEVIN_PROXY_SYSTEM_FILE
  if (raw) {
    const bundled = BUNDLED[raw.trim().toLowerCase()]
    if (bundled) return join(packagePrompts(), bundled)
    return raw
  }
  const homeDir = join(homedir(), ".devin-proxy")
  for (const base of [homeDir, packagePrompts()]) {
    for (const name of NAMES) {
      const p = join(base, name)
      if (existsSync(p)) return p
    }
  }
  return join(homeDir, NAMES[0])
}

export function defaultSystemFile(): string {
  return resolveSystemFile()
}

/** Reads the override file; returns "" when it does not exist. */
export class OverridePrompt {
  readonly path: string
  private _mtime = 0
  private _text = ""

  constructor(path?: string) {
    this.path = path ? resolveSystemFile(path) : defaultSystemFile()
  }

  load(): string {
    let mtime: number
    try {
      mtime = statSync(this.path).mtimeMs
    } catch {
      return ""
    }
    if (mtime !== this._mtime) {
      try {
        this._text = readFileSync(this.path, "utf-8")
        this._mtime = mtime
      } catch {
        return ""
      }
    }
    return this._text
  }

  get length(): number {
    return this._text.length
  }
}
