# Floating Box

A tiny demo showing a box floating in midair using a canvas animation.

Run:

Open [index.html](index.html) in your browser.

Controls:

- Click or press Space: apply upward thrust to the box
- Click or press Space: apply upward thrust to the box
- Left/Right arrows or `A`/`D`: move box horizontally
- Press `P`: toggle pause

Airtime

- A small timer in the top-right shows how long the box stays away from the platform.
- The display shows the current airtime while airborne and the best (longest) airtime.

## Recent Updates

### 2026-02-23
- Fixed all Codacy and PMD numeric literal warnings (canonical forms, constants)
- Replaced insecure Math.random usages with window.crypto-based secure random helpers
- Refactored loops for code style and security
- Declared browser globals for ESLint compliance
- Removed unused variables and silenced debug logs
- Improved object injection safety

These changes improve code robustness, security, and maintainability. The game is now resistant to numeric bugs and exploits.

