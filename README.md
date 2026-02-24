# BrickBreaker (previously Floating Box)

A compact HTML5 canvas game where you pilot a box, collecting bricks to earn points.

## Run

Open [index.html](index.html) in your browser (or serve the folder on a local web server).

## Controls

- Press `Space`: thrust (upward impulse)
- Left/Right arrows or `A` / `D`: move left/right
- Press `P`: pause / resume

## Title Screen

- The game now shows a title screen (`BrickBreaker`) inside the play area. Press `Start Game` to begin.

## Gameplay Notes

- The hero box is slightly smaller than earlier and starts on the ground when the game begins.
- Obstacles (bricks) move slowly left/right; some also bob up/down within their spawn band.
- Collect bricks to earn points; clearing all bricks respawns a new set after a short delay.
- A small airtime indicator in the top-right shows current and best airtime.

## Leaderboard

- After Game Over you can enter 3-character initials and submit your score. The leaderboard stores the top 50 entries (sorted by airtime, then points) in `localStorage`.

## Recent Notes (2026-02-23)

- Title screen and start flow added; the game no longer responds to controls until you press `Start Game`.
- Controls and hints were updated to match gameplay (no more click-to-thrust).
- Improved obstacle movement: horizontal drift plus optional vertical bobbing.
- UI and CSS tweaks to better match the game's aesthetic.
