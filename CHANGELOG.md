# Changelog

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
