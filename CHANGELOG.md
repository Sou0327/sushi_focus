# Changelog

All notable changes to Sushi Focus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.4] - 2026-04-22

### Fixed
- Context Bridge: density tier (Tier 3) regression on SPA pages where only
  the header card was extracted instead of the article body. The 0.3.3
  formula `(textLen / descendantCount) * sizeBonus` favored inline-heavy
  compact cards over paragraph-heavy bodies. Re-architected as a two-phase
  scorer: a cheap union-axis prepass (children + noise-filtered text +
  DOM depth) builds a shortlist, then accurate `innerHTML.length` minus
  noise-tag `outerHTML.length` is used for final ranking. Verified end-to-
  end on the original Immunefi bug-report URL.

### Changed
- Density tier internals: drop the DOM-order 100-candidate cap; replace
  `innerHTML.length` cost with sampled tag-overhead estimation for huge
  subtrees; raise size-bonus saturation from 1K to 3K chars.

## [0.3.3] - 2026-04-21

### Added
- Context Bridge: preserve `<a href>` absolute URLs in captured page text so
  Claude Code can suggest specific follow-up URLs (e.g. on GitHub issue
  trackers with inline sibling issue links).
- Context Bridge: 27 unit tests covering link preservation, same-document
  fragment skipping, nested-anchor handling, pre/code skip, dedup,
  selection-ancestor fallback, and subtree size guards.

### Changed
- Context Bridge: strip `<script>` / `<style>` / `<noscript>` / `<template>`
  from captured text on every extraction path so SSR hydration JSON and
  CSS no longer leak into the prompt context (clone + TreeWalker streaming
  both apply the filter).
- Context Bridge: compress layout whitespace (trim trailing spaces/tabs
  per line, collapse 3+ newlines to 2, trim edges) to free up ~40% of the
  10 KB context budget for real content.
- Context Bridge: uniform subtree-size guard across semantic/density/
  fallback tiers — huge DOMs stream via TreeWalker instead of cloning.
- Context Bridge: density tier now uses live descendant count and bounded
  text streaming instead of `innerHTML.length` / full `innerText` scans,
  avoiding large string allocations on 100+ candidate elements.

## [0.1.0] - 2025-02-02

### Added
- Initial release
- Chrome Extension (Manifest V3)
  - Side Panel dashboard with real-time log streaming
  - Popup for quick settings toggle
  - Options page for detailed configuration
  - Internationalization support (English, Japanese)
  - Dark/Light theme support
- Local daemon (Node.js)
  - REST API for AI agent integration
  - WebSocket for real-time event broadcasting
  - Claude Code hooks support
- Focus management features
  - Auto-return to IDE on task completion
  - Auto-return on input required
  - Configurable countdown and cooldown timers
- Security features
  - CORS restrictions
  - Bearer token authentication
  - Input validation
  - Command injection protection

### Security
- Implemented command whitelisting for `osascript` calls
- Added origin validation for CORS
- Input sanitization on all API endpoints

[Unreleased]: https://github.com/Sou0327/sushi_focus/compare/v0.3.4...HEAD
[0.3.4]: https://github.com/Sou0327/sushi_focus/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/Sou0327/sushi_focus/compare/v0.3.2...v0.3.3
[0.1.0]: https://github.com/Sou0327/sushi_focus/releases/tag/v0.1.0
