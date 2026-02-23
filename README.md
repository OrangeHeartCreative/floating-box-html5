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
- Fixed all Codacy/ESLint numeric literal warnings (canonical forms, constants)
- Replaced insecure Math.random usages with window.crypto-based secure random helpers
- Refactored loops for code style and security
- Declared browser globals for ESLint compliance
- Removed unused variables and silenced debug logs
- Improved object injection safety
- Fixed all declaration/statement errors and unused variable warnings
- All random number generation is now cryptographically secure
- Improved leaderboard logic and UI for clarity and fairness
- Improved game robustness and maintainability
- Fixed all known gameplay bugs and improved collision/physics accuracy
- Enhanced security and code quality for future extensibility

### Gameplay Changes
- Leaderboard now saves top 50 scores, sorted by airtime and points
- Game Over overlay now reliably shows final airtime and score
- All random events (obstacle placement, particle effects) are now fair and secure
- Improved collision detection and physics for more consistent gameplay
- Audio feedback is more reliable and robust
- Game is now more resistant to exploits and browser quirks

These changes make the game more secure, fair, and enjoyable, while ensuring the codebase is robust and maintainable for future updates.

