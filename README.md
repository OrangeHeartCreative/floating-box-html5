# BrickBreaker (previously Floating Box)

A compact HTML5 canvas game where you pilot a box and collect obstacles for points.

## Run

Serve the project folder and open the game in your browser:

```bash
python3 -m http.server 8000
# then open http://127.0.0.1:8000/floating-box-html5/
```

## Controls

- `Space` or click/tap: thrust (upward impulse)
- Left/Right arrows or `A` / `D`: move left/right
- `P`: pause / resume

## Leaderboard

After Game Over you can enter 3-character initials and submit your score. The leaderboard stores the top 50 entries in `localStorage` and ranks by points (primary) then airtime (secondary).

## Dev / Testing Utilities

- `test_smoke.html` — a small smoke test page that programmatically verifies leaderboard sorting.
- `record_walkthrough.html` — an autopilot + recorder page that auto-runs the game and records the canvas to a downloadable WebM (`floating-box-trailer.webm`). Useful for generating trailers.

## Recording / Trailer

Open `record_walkthrough.html` in a browser (served from the same folder). It will auto-start a short autopilot run and produce a WebM you can download.

To convert to MP4 (optional):

```bash
ffmpeg -i floating-box-trailer.webm -c:v libx264 -crf 18 -preset medium trailer.mp4
```

## Recent Changes (2026-02-23)

- Leaderboard: switched primary ranking to points to prevent airtime exploits.
- Obstacles: reduced default count to 6, obstacles now physically bump each other (exchange velocities) instead of disintegrating on contact.
- Spawn logic: obstacles are placed to avoid overlapping on spawn (attempts multiple placements), preventing immediate collisions at start.
- Added `test_smoke.html` and `record_walkthrough.html` to aid validation and create trailers.
- Fixed start/title flow and improved obstacle behavior.

---

If you'd like, I can open a pull request with this change.
