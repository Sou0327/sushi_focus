# Changelog

All notable changes to Sushi Focus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- OSS release preparation (LICENSE, CONTRIBUTING, CI/CD)
- GitHub issue and PR templates
- Security policy documentation

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

[Unreleased]: https://github.com/Sou0327/focus_flow/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Sou0327/focus_flow/releases/tag/v0.1.0
