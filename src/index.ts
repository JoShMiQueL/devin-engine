/**
 * devin-engine — the guarded-retry / jailbreak pipeline library.
 *
 * Embeddable in-process (plugins) or behind a standalone proxy server.
 * Sits on top of devin-core for wire protocol, auth and catalog.
 */

export { Engine, type EngineSettings, type AttemptResult } from "./engine"
export { RefusalGuard, REFUSAL_RE } from "./guard"
export { FrameRouter, pickKind, FRAME_POOLS } from "./frames"
export { OverridePrompt, resolveSystemFile, defaultSystemFile, NAMES, BUNDLED } from "./override"
export { sanitizeMessages, sanitizeHistoryArtifacts, MODEL_SWITCH_NOTE_RE, HISTORY_REFUSAL_RE } from "./sanitize"
export {
  TOOL_OPEN,
  TOOL_CLOSE,
  type ToolCall,
  compactDescription,
  renderTools,
  parseNativeToolText,
  parseToolText,
  stripProtocolNoise,
} from "./tools"
export { attach as attachReasoning, remember as rememberReasoning } from "./reasoning"
export { openaiToWire } from "./translate"
export { resolveModel, SWE2_TIERS, SWE2_FLASH_TIERS, SWE21_TIERS, ALL_TIERS, type ResolveOptions } from "./resolve"
