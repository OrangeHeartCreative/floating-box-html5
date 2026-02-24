# Changelog

<<<<<<< HEAD
## [Unreleased]
=======
## [Unreleased] - 2026-02-23
>>>>>>> 1f96d87b1c0f8627443e9eed8e7f00c20f2e29c4

### Added
- `record_walkthrough.html` — autopilot + recorder for generating short gameplay trailers (WebM output).
- `test_smoke.html` — smoke test verifying leaderboard sorting and data normalization.
<<<<<<< HEAD

### Changed
- `README.md` updated with run and recording instructions.
=======
- `README.md` updated with run and recording instructions.

### Changed
>>>>>>> 1f96d87b1c0f8627443e9eed8e7f00c20f2e29c4
- Leaderboard now ranks by **points** (primary) then airtime (secondary) to prevent airtime exploits.
- Title/start flow refined so the game only accepts input after pressing `Start Game`.

- Replaced bundled TTF with optimized WOFF2 and removed the TTF to reduce
	package size and ensure the site uses a single self-hosted font asset.

### Fixed
- Resolved a merge conflict in `script.js` and added safety checks for optional DOM elements used by test/recorder pages.
- Improved synthetic input handling for the recorder page so autopilot commands are more reliable across browsers.

---

<<<<<<< HEAD
=======
For release: consider tagging `v0.2.0` after review.
>>>>>>> 1f96d87b1c0f8627443e9eed8e7f00c20f2e29c4
