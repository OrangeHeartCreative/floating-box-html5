# Changelog

## [Unreleased] - 2026-02-23

### Added
- `record_walkthrough.html` — autopilot + recorder for generating short gameplay trailers (WebM output).
- `test_smoke.html` — smoke test verifying leaderboard sorting and data normalization.
- `README.md` updated with run and recording instructions.

### Changed
- Leaderboard now ranks by **points** (primary) then airtime (secondary) to prevent airtime exploits.
- Title/start flow refined so the game only accepts input after pressing `Start Game`.

### Fixed
- Resolved a merge conflict in `script.js` and added safety checks for optional DOM elements used by test/recorder pages.
- Improved synthetic input handling for the recorder page so autopilot commands are more reliable across browsers.

---

For release: consider tagging `v0.2.0` after review.