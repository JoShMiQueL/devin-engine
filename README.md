# devin-engine

The guarded-retry / jailbreak pipeline library for the Devin/Cascade backend — a **class, not a server**. Embed it in-process (plugins) or put it behind a standalone proxy; either way the pipeline is the same code path.

Sits on top of [`devin-core`](../devin-core) for the wire protocol, auth and catalog. Ported from `devin_proxy/{pipeline,jailbreak,models}` (Python).

## What it does per request

1. **Resolve** the client model id (+ `reasoning_effort`) to a wire uid — `swe-2-*`, `swe-2-flash-*`, `swe-2-1-*` lanes; never `*-lightning`.
2. **Sanitize** history — drop empty assistant turns, excise transport notes and the model's own past refusals so they can't anchor the next turn.
3. **Inject** the system override (hot-reloaded from `~/.devin-proxy/` or the bundled `prompts/`).
4. **Frame** retries — a mid-history SYSTEM frame seeded by the request text, escalated to a FORCE variant on the last attempt.
5. **Guard** the stream — the first N chars are held and scanned against a multilingual refusal pattern; a hit burns the attempt and resamples **invisibly** inside the same downstream stream. `full` mode buffers everything to catch comply-then-pivot.
6. **Translate** tools — native wire tool-calls (primary) or the `<<TOOL_CALL>>` text protocol (fallback), both parsed back into OpenAI `tool_calls`.

## Usage

```ts
import { Engine, OverridePrompt } from "devin-engine"

const engine = new Engine(
  { guardChars: 700, maxRetries: 3, nativeTools: true },
  apiKey,                       // devin-session-token$... or windsurf_api_key
  new OverridePrompt(),         // resolves ~/.devin-proxy/override-compact.txt
  catalog,                      // optional ModelCatalogEntry[] for allowPaid
)

await engine.run(
  openaiChatRequest,
  (delta) => emit(delta),       // { role, content? } / { role, tool_calls } deltas
  (result) => finish(result),   // { finish_reason }
  (usage) => tally(usage),      // token usage
)
```

## Pieces (all exported)

| Export | Purpose |
| --- | --- |
| `Engine` | the guarded-retry pipeline |
| `RefusalGuard`, `REFUSAL_RE` | RU/EN/ZH/ES/PT/FR/DE refusal detection + head buffer |
| `FrameRouter`, `pickKind` | category routing → seeded frame pools (`game`/`tech`/`llmjb`/`explain`/`direct`/`general`) |
| `OverridePrompt`, `resolveSystemFile` | override file resolution + mtime hot-reload |
| `sanitizeMessages`, `sanitizeHistoryArtifacts` | history hygiene |
| `renderTools`, `parseToolText`, `parseNativeToolText`, `stripProtocolNoise` | tool protocol both directions |
| `attachReasoning`, `rememberReasoning` | signed-thinking cache replay |
| `openaiToWire` | OpenAI messages → `ChatHistoryItem[]` |
| `resolveModel`, `SWE2_*`/`SWE21_*`/`ALL_TIERS` | model-id + effort → wire uid |
