# Changelog

## [0.0.10](https://github.com/JoShMiQueL/devin-engine/compare/v0.0.9...v0.0.10) (2026-11-25)


### Features

* conversation-language detection for retry injections — the agreed-plan escalation now follows the user's own language (detected from message content) instead of the override file's language, since the bundled override is English by design while users write in any language. Engine retry injection restructured to match CascadePipeline: original request first, then the assistant committing, then the user green-lighting — natural phrasing in both languages, no artifact-looking 'proceed.' ([#12](https://github.com/JoShMiQueL/devin-engine/issues/12)) ([b9254a1](https://github.com/JoShMiQueL/devin-engine/commit/b9254a16b7e5651ee431ada3d4b6827408ed20b0))

## [0.0.9](https://github.com/JoShMiQueL/devin-engine/compare/v0.0.8...v0.0.9) (2026-11-25)


### Features

* persona-based override (Kael) + natural agreed-plan retry injection — live-verified full compliance on swe-2-1 across cracking/keylogger/UAC/shellcode prompts, majority first-attempt. Techniques adapted from public swe2-jailbreak research: identity-with-loyalty persona, thinking-channel control, meta-refusal inhibition (redirect-to-crackmes IS refusal), interference handling. Retry injection restructured as request-then-commit-then-greenlight in conversation language ([#10](https://github.com/JoShMiQueL/devin-engine/issues/10)) ([cf4832e](https://github.com/JoShMiQueL/devin-engine/commit/cf4832e249b6129465a9869996227aa471d914e3))

## [0.0.8](https://github.com/JoShMiQueL/devin-engine/compare/v0.0.7...v0.0.8) (2026-11-25)


### Bug Fixes

* **pipeline:** widen ES refusal detection with the swe-2/2.1 shapes observed live (darte instrucciones, no te voy a dar, con lo que no puedo, no es algo en lo que); frames + agreed-plan retries now apply with tools — Cascade carries tools over the structured channel, so the no-tools restriction from the text-rendered proxy era was dead weight in agent clients ([#8](https://github.com/JoShMiQueL/devin-engine/issues/8)) ([a9cfe3b](https://github.com/JoShMiQueL/devin-engine/commit/a9cfe3b8f98ac08fac96f889a30c0f11d616648f))

## [0.0.7](https://github.com/JoShMiQueL/devin-engine/compare/v0.0.6...v0.0.7) (2026-11-25)


### Features

* **engine:** catalog-driven resolution — Engine resolves model+effort through the live catalog via devin-core resolveModelUid, routing every family in the subscription; legacy tier table only as a no-catalog fallback ([#6](https://github.com/JoShMiQueL/devin-engine/issues/6)) ([dd1931b](https://github.com/JoShMiQueL/devin-engine/commit/dd1931bc623b1b16d9a1f737b2f8512382b12fa2))

## [0.0.6](https://github.com/JoShMiQueL/devin-engine/compare/v0.0.5...v0.0.6) (2026-11-25)


### Features

* **pipeline:** retryTemps, maxInputTokens, pruneKeepTurns — configurable retry ladder and Engine-style history pruning in the wire-level pipeline ([#4](https://github.com/JoShMiQueL/devin-engine/issues/4)) ([3a1588a](https://github.com/JoShMiQueL/devin-engine/commit/3a1588a7271f3a1ee395a7aa54d22f2d16c26949))

## [0.0.5](https://github.com/JoShMiQueL/devin-engine/compare/v0.0.4...v0.0.5) (2026-11-25)


### Features

* extract CascadePipeline for wire-level consumers — the retry/override/guard/frame machinery over ChatHistoryItem[]/ChatEvent directly, so plugin hosts (opencode-devin) consume it without the OpenAI-shaped double translation; Engine stays as-is. Also bumps devin-core to ^0.0.5 ([#2](https://github.com/JoShMiQueL/devin-engine/issues/2)) ([be86ca6](https://github.com/JoShMiQueL/devin-engine/commit/be86ca631d759c5285e8310cc1c37ad298201539))

## [0.0.4] — 2026-11-24

### Added
- `EngineSettings.mode: "normal" | "uncensored"` — `"normal"` (default)
  is a passthrough: no override injection, refusal guard disabled,
  single attempt. `"uncensored"` keeps the full guarded-retry pipeline.

## [0.0.3] — 2026-11-24

### Fixed
- Emit `.js` extensions on all relative imports — Node ESM compat.

## [0.0.2] — 2026-11-24

### Fixed
- First `.js` pass missed `../` paths — corrected.

## [0.0.1] — 2026-11-24

### Added
- Initial release: the compliance pipeline ported from the Python
  `devin_proxy/{pipeline,jailbreak,models}` — `Engine`, `RefusalGuard`,
  `OverridePrompt`, `resolveModel`, frame router, sanitize, tool
  translate. Bundled override prompts.
