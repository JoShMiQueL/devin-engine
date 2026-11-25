# Changelog

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
