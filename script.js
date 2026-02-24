/* global document, window, performance, localStorage, requestAnimationFrame, console */

// Secure random number helpers
function getRandomInt(min, max) {
  // Ensure min and max are integers
  min = Math.ceil(min);
  max = Math.floor(max);
  if (max < min) return min;
  const range = max - min + 1;
  const randomBuffer = new Uint32Array(1);
  window.crypto.getRandomValues(randomBuffer);
  return min + (randomBuffer[0] % range);
}
function getRandomFloat(min, max) {
  // Use canonical max uint32 value
  const randomBuffer = new Uint32Array(1);
  window.crypto.getRandomValues(randomBuffer);
  const MAX_UINT32 = 4294967295.0;
  const random = randomBuffer[0] / (MAX_UINT32 + 1);
  return min + random * (max - min);
}
const canvas = document.getElementById('game');
const wrapper = document.getElementById('gameWrap') || document.body;
const ctx = canvas.getContext('2d');

// logical viewport size in CSS pixels (updated in resize)
let viewW = 0;
let viewH = 0;

// --- Audio (WebAudio) ---
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playThrust() {
  try {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 180 + getRandomFloat(0, 60);
    // Use canonical form for small value
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    g.gain.linearRampToValueAtTime(0.12, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.start(now);
    o.stop(now + 0.25);
  } catch (e) { /* silently fail if not allowed */ }
}

function playHit() {
  try {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = 300 + getRandomFloat(0, 700);
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    g.gain.linearRampToValueAtTime(0.16, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    o.start(now);
    o.stop(now + 0.36);
  } catch (e) {}
}

function playSubmit() {
  try {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.value = 440;
    g.gain.value = 1e-4;
    o.connect(g);
    g.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    g.gain.linearRampToValueAtTime(0.12, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    o.start(now);
    o.stop(now + 0.36);
  } catch (e) {}
}

function resize(){
  const rect = wrapper.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  viewW = Math.max(64, Math.floor(rect.width));
  viewH = Math.max(64, Math.floor(rect.height));
  canvas.style.width = viewW + 'px';
  canvas.style.height = viewH + 'px';
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);
resize();
// (obstacles will be spawned after box and DOM are initialized)

// Physics parameters
const physics = {
  gravity: 980, // px/s^2
  damping: 0.7, // bounce damping
  thrust: 420, // impulse applied on click/space
};

const box = {
  w: 80,
  h: 54,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
};

// position box at the ground initially (safe if resize ran earlier)
function alignBoxToGround(){
  box.x = viewW/2 - box.w/2;
  box.y = getBaseY();
}

let last = performance.now();
let paused = false;
let gameStarted = false;

// Controls: click/Space to thrust; Arrow keys / A D for horizontal movement
const controls = { left: false, right: false };

// Click / touch handler for thrust (keep a named reference so it can be removed later)
function handleClickThrust(e) {
  // If the initials input is focused, allow normal typing
  if (initialsEl && document.activeElement === initialsEl) return;
  // ignore input until the game has started
  if (!gameStarted) return;
  try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch (err) {}
  box.vy -= physics.thrust;
  if (!inAir) { inAir = true; currentAirtime = 0; }
  try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e){}
  playThrust();
}

canvas.addEventListener('click', handleClickThrust);
canvas.addEventListener('touchstart', handleClickThrust, { passive: false });

window.addEventListener('keydown', (e) => {
  // If the initials input is focused, allow normal typing (don't treat A/D as controls)
  if (initialsEl && document.activeElement === initialsEl) return;
  // Ignore game input until the game has started
  if (!gameStarted) return;
  if (e.code === 'Space') {
    e.preventDefault();
    box.vy -= physics.thrust;
    if (!inAir) {
      inAir = true;
      currentAirtime = 0;
    }
    try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e){}
    playThrust();
  }
  if (e.code === 'KeyP') paused = !paused;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    controls.left = true;
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    controls.right = true;
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') controls.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') controls.right = false;
});

const horiz = { accel: 2400, drag: 5, spring: 4 };

// layout constants (controls where the "ground" sits and where obstacles spawn)
const layout = {
  groundOffset: 48, // distance from bottom of viewport to bottom of the box when resting
  obstacleBand: 260, // vertical band above the ground where obstacles can spawn
  obstacleCount: 6,
};


function getBaseY(){
  return viewH - layout.groundOffset - box.h;
}

// Obstacles
const obstacles = [];
const particles = [];
let respawnTimer = 0;
function spawnObstacles(){
  obstacles.length = 0;
  const baseY = getBaseY();
  const count = layout.obstacleCount;
  const spawnMinY = Math.max(24, baseY - layout.obstacleBand);
  const spawnMaxY = Math.max(spawnMinY + 24, baseY - 40);
  for (let i=0;i<count;i++){
    const w = 40 + getRandomFloat(0, 80);
    const h = 18 + getRandomFloat(0, 30);
    const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#8b5cf6'];
    const color = colors[getRandomInt(0, colors.length - 1)];
    const points = Math.max(1, Math.round((120 - w) / 10));
    // horizontal drift speed (slow, random direction)
    const dxBase = getRandomFloat(15, 45) * (getRandomInt(0,1) === 0 ? -1 : 1);
    // ~50% of obstacles also drift vertically
    const dyBase = getRandomInt(0,1) === 0
      ? getRandomFloat(10, 30) * (getRandomInt(0,1) === 0 ? -1 : 1)
      : 0;

    // choose a spawn position that does not overlap previously placed obstacles (or the player box)
    let x = 0, y = spawnMinY;
    let tries = 0;
    const maxTries = 80;
    let placed = false;
    while (!placed && tries < maxTries) {
      x = getRandomFloat(0, Math.max(0, viewW - w));
      y = spawnMinY + getRandomFloat(0, spawnMaxY - spawnMinY);
      const candidate = { x, y, w, h };
      let overlap = false;
      for (const other of obstacles) {
        if (rectsIntersect(candidate, other)) { overlap = true; break; }
      }
      // also avoid spawning directly on top of the hero box
      if (!overlap && rectsIntersect(candidate, box)) overlap = true;
      if (!overlap) placed = true;
      tries++;
    }
    // if we failed to find a non-overlapping spot after many tries, accept the last position
    const dx = dxBase;
    const dy = dyBase;
    obstacles.push({x,y,w,h,color,points,dx,dy,spawnMinY,spawnMaxY});
  }
}

function createDisintegrate(ob){
  const area = ob.w * ob.h;
  const count = Math.min(120, Math.max(12, Math.round(area / 150)));
  const baseColor = ob.color || '#ffffff';
  for (let i=0;i<count;i++){
    const px = ob.x + getRandomFloat(0, ob.w);
    const py = ob.y + getRandomFloat(0, ob.h);
    const ang = getRandomFloat(0, Math.PI*2);
    const sp = 30 + getRandomFloat(0, 260);
    const vx = Math.cos(ang) * sp * (0.6 + getRandomFloat(0, 0.9));
    const vy = Math.sin(ang) * sp * (0.4 + getRandomFloat(0, 0.9)) - 40 * getRandomFloat(0, 1);
    const size = 2 + getRandomFloat(0, 6);
    const life = 0.6 + getRandomFloat(0, 1.0);
    const rgb = hexToRgb(baseColor);
    // slight tint variation
    const r = Math.max(0, Math.min(255, rgb.r + Math.floor((getRandomFloat(-0.5,0.5))*60)));
    const g = Math.max(0, Math.min(255, rgb.g + Math.floor((getRandomFloat(-0.5,0.5))*60)));
    const b = Math.max(0, Math.min(255, rgb.b + Math.floor((getRandomFloat(-0.5,0.5))*60)));
    const col = `rgb(${r},${g},${b})`;
    const rot = getRandomFloat(0, Math.PI*2);
    const drot = getRandomFloat(-5, 5);
    particles.push({x:px,y:py,vx,vy,size,life,ttl:life,color:col,rot,drot});
  }
}

function rectsIntersect(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// color helpers
function hexToRgb(hex){
  const m = hex.replace('#','');
  const r = parseInt(m.substring(0,2),16);
  const g = parseInt(m.substring(2,4),16);
  const b = parseInt(m.substring(4,6),16);
  return {r,g,b};
}
function hexToRgba(hex, a){
  const c = hexToRgb(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

// Airtime tracking
const airtimeEl = document.getElementById('airtime');
const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('gameOver');
const finalAirEl = document.getElementById('final-air');
const initialsEl = document.getElementById('initials');
const submitBtn = document.getElementById('submitScore');
const restartBtn = document.getElementById('restart');
const clearBtn = document.getElementById('clearLeaderboard');
const leaderboardEmptyEl = document.getElementById('leaderboardEmpty');
const confirmModal = document.getElementById('confirmModal');
const confirmText = document.getElementById('confirmText');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');
let inAir = false;
let currentAirtime = 0;
let bestAirtime = 0;
let gameOverShown = false;
const scoresKey = 'floating_box_scores_v1';
let score = 0;
let finalAirtimeValue = 0;
let finalScoreValue = 0;

function loadScores(){
  try{
    const raw = localStorage.getItem(scoresKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // normalize legacy entries (some older entries used 'score' for airtime)
    return parsed.map(p => {
      const entry = Object.assign({}, p);
      if (entry.score !== undefined && entry.airtime === undefined) {
        entry.airtime = Number(entry.score) || 0;
        delete entry.score;
      }
      entry.airtime = Number(entry.airtime) || 0;
      entry.points = Number(entry.points) || 0;
      entry.initials = (entry.initials || '---').toString().substring(0,3).toUpperCase();
      entry.date = Number(entry.date) || Date.now();
      return entry;
    });
  }catch(e){ return [] }
}

function saveScore(entry){
  const list = loadScores();
  // normalize incoming entry
  const e = Object.assign({}, entry);
  if (e.score !== undefined && e.airtime === undefined) {
    e.airtime = Number(e.score) || 0;
    delete e.score;
  }
  e.airtime = Number(e.airtime) || 0;
  e.points = Number(e.points) || 0;
  e.initials = (e.initials || '---').toString().substring(0,3).toUpperCase();
  e.date = Number(e.date) || Date.now();

  list.push(e);
  // sort primarily by points, then by airtime
  list.sort((a,b)=> (b.points - a.points) || (b.airtime - a.airtime));
  const trimmed = list.slice(0,50);
  localStorage.setItem(scoresKey, JSON.stringify(trimmed));
  return trimmed;
}

function renderLeaderboard() {
  const listEl = document.getElementById('scoresList');
  if (!listEl) return;
  const scores = loadScores();
  // ensure leaderboard shown sorted by points (primary) then airtime
  scores.sort((a,b)=> (b.points - a.points) || (b.airtime - a.airtime));
  listEl.innerHTML = '';
  if (!scores.length) {
    if (leaderboardEmptyEl) leaderboardEmptyEl.style.display = 'block';
    return;
  }
  if (leaderboardEmptyEl) leaderboardEmptyEl.style.display = 'none';
  scores.slice(0, 50).forEach((s, idx) => {
    const li = document.createElement('li');
    if (idx === 0) li.classList.add('top1');
    else if (idx === 1) li.classList.add('top2');
    else if (idx === 2) li.classList.add('top3');
    const medal = document.createElement('span');
    medal.className = 'medal';
    medal.textContent = idx < 3 ? (idx + 1) : '';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = s.initials || '---';
    const airtimeNum = Number(s.airtime) || 0;
    const pointsNum = Number(s.points) || 0;
    const meta = document.createElement('span');
    meta.className = 'meta';
    // show points first (primary ranking key), then airtime
    const pts = document.createElement('span');
    pts.className = 'points-val';
    pts.textContent = `${pointsNum}pts`;
    const airt = document.createElement('span');
    airt.className = 'airtime-val';
    airt.textContent = `${airtimeNum.toFixed(2)}s`;
    meta.appendChild(pts);
    meta.appendChild(document.createTextNode(' • '));
    meta.appendChild(airt);
    li.appendChild(medal);
    li.appendChild(name);
    li.appendChild(meta);
    listEl.appendChild(li);
  });
}

// allow Enter in initials to submit
if (initialsEl) {
  initialsEl.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter') {
      e.preventDefault();
      submitBtn.click();
    }
  });
}

// render leaderboard on load
renderLeaderboard();

// position box at ground and spawn obstacles after the page has loaded
window.addEventListener('load', () => {
  resize();
  try{ alignBoxToGround(); }catch(e){}
  spawnObstacles();
});

// when the window resizes, refresh canvas, align box and respawn obstacles
window.addEventListener('resize', () => {
  resize();
  try{ alignBoxToGround(); }catch(e){}
  spawnObstacles();
});

function update(dt){
  if (paused) return; // Prevent updates if the game is paused

  // vertical integration
  box.vy += physics.gravity * dt;

  // horizontal acceleration from input
  let ax = 0;
  if (controls.left) ax -= horiz.accel;
  if (controls.right) ax += horiz.accel;
  box.vx += ax * dt;

  // gentle spring back to center when no horizontal input
  if (!controls.left && !controls.right) {
    const centerX = viewW/2 - box.w/2;
    const spring = (centerX - box.x) * horiz.spring;
    box.vx += spring * dt;
  }

  // simple drag
  box.vx *= Math.max(0, 1 - horiz.drag * dt);

  // integrate positions
  box.x += box.vx * dt;
  box.y += box.vy * dt;

  // platform collision
  const baseY = getBaseY();

  // accumulate airtime while flagged inAir
  if (inAir) {
    currentAirtime += dt;
  }

  // move obstacles and bounce off screen edges
  for (const ob of obstacles) {
    ob.x += ob.dx * dt;
    if (ob.x < 0) { ob.x = 0; ob.dx = Math.abs(ob.dx); }
    if (ob.x + ob.w > viewW) { ob.x = viewW - ob.w; ob.dx = -Math.abs(ob.dx); }
    // vertical drift (clamped to the obstacle spawn band)
    if (ob.dy) {
      ob.y += ob.dy * dt;
      const bandH = ob.spawnMaxY - ob.spawnMinY;
      if (bandH > ob.h) {
        if (ob.y < ob.spawnMinY) { ob.y = ob.spawnMinY; ob.dy = Math.abs(ob.dy); }
        if (ob.y + ob.h > ob.spawnMaxY) { ob.y = ob.spawnMaxY - ob.h; ob.dy = -Math.abs(ob.dy); }
      } else {
        ob.y = ob.spawnMinY; ob.dy = 0; // obstacle fills the band; pin it
      }
    }
  }

  // obstacle-obstacle collisions: bump and exchange velocity (no disintegration)
  for (let i = 0; i < obstacles.length; i++) {
    for (let j = i + 1; j < obstacles.length; j++) {
      const a = obstacles[i];
      const b = obstacles[j];
      if (rectsIntersect(a, b)) {
        // compute overlap extents
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (overlapX < overlapY) {
          // separate horizontally
          const push = overlapX / 2 + 0.5;
          if (a.x < b.x) { a.x -= push; b.x += push; } else { a.x += push; b.x -= push; }
          // swap horizontal velocities with slight damping
          const t = a.dx; a.dx = b.dx * 0.9; b.dx = t * 0.9;
        } else {
          // separate vertically
          const push = overlapY / 2 + 0.5;
          if (a.y < b.y) { a.y -= push; b.y += push; } else { a.y += push; b.y -= push; }
          const t = a.dy; a.dy = b.dy * 0.9; b.dy = t * 0.9;
        }
        // small random perturbation to avoid stuck pairs
        a.dx += getRandomFloat(-10, 10);
        b.dx += getRandomFloat(-10, 10);
        a.dy += getRandomFloat(-5, 5);
        b.dy += getRandomFloat(-5, 5);
        // clamp speeds
        a.dx = Math.max(-240, Math.min(240, a.dx));
        b.dx = Math.max(-240, Math.min(240, b.dx));
        a.dy = Math.max(-120, Math.min(120, a.dy));
        b.dy = Math.max(-120, Math.min(120, b.dy));
      }
    }
  }

  // check collisions with obstacles -> award points and remove obstacle
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    if (rectsIntersect(box, ob)) {
      // award points
      score += ob.points;
      // create disintegration particles
      createDisintegrate(ob);
      // audio feedback
      playHit();
      // remove obstacle
      obstacles.splice(i, 1);
      // small bounce feedback
      box.vy = -Math.abs(box.vy) * 0.6;
      // start respawn timer if cleared
      if (obstacles.length === 0) respawnTimer = 1.2; // seconds until respawn
    }
  }

  if (box.y > baseY) {
    // collision with platform/ground
    box.y = baseY;
    if (Math.abs(box.vy) > 1) box.vy = -box.vy * physics.damping;
    else box.vy = 0;
    // finalize airtime the moment box hits the ground
    if (inAir) {
      inAir = false;
      if (currentAirtime > bestAirtime) bestAirtime = currentAirtime;
      // show Game Over overlay with final airtime
      showGameOver(currentAirtime);
    }
  }

  // ceiling collision: prevent the box from floating off the top of the canvas
  if (box.y < 0) {
    box.y = 0;
    if (Math.abs(box.vy) > 1) box.vy = -box.vy * physics.damping;
    else box.vy = 0;
  }

  // clamp to viewport horizontally
  if (box.x < 0) { box.x = 0; box.vx = 0; }
  if (box.x + box.w > viewW) { box.x = viewW - box.w; box.vx = 0; }

  // update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    // apply gravity and air drag
    p.vy += physics.gravity * dt * 0.24;
    p.vx *= Math.max(0, 1 - 1.2 * dt);
    p.vy *= Math.max(0, 1 - 0.06 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // rotation
    if (p.rot !== undefined) p.rot += (p.drot || 0) * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i,1);
  }

  // handle respawn timer
  if (respawnTimer > 0) {
    respawnTimer -= dt;
    if (respawnTimer <= 0) {
      spawnObstacles();
    }
  }
}

function draw(){
  ctx.clearRect(0,0,viewW,viewH);

  const baseY = getBaseY();

  // draw ground / platform band so players can clearly see the safe area
  const groundTop = baseY + box.h + 6;
  if (groundTop < viewH) {
    // pick a ground color matching the first obstacle (fallback to a blue)
    const groundColor = (obstacles && obstacles.length) ? obstacles[0].color : '#3b82f6';
    const gGrad = ctx.createLinearGradient(0, groundTop, 0, viewH);
    // stronger top tint to make the ground visually obvious
    gGrad.addColorStop(0, hexToRgba(groundColor, 0.8)); // canonical form
    gGrad.addColorStop(1, hexToRgba(groundColor, 0.28));
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, groundTop, viewW, viewH - groundTop);

    // neon-ish separator glow and rim using the same color
    ctx.save();
    ctx.shadowColor = hexToRgba(groundColor, 0.92);
    ctx.shadowBlur = 24;
    ctx.fillStyle = hexToRgba(groundColor, 0.48);
    ctx.fillRect(0, groundTop - 12, viewW, 8);
    ctx.restore();

    // thin bright line for contrast (very visible)
    ctx.fillStyle = hexToRgba(groundColor, 0.95);
    ctx.fillRect(0, groundTop - 4, viewW, 4);

    // subtle stripes for texture (slightly tinted)
    ctx.fillStyle = hexToRgba(groundColor, 0.1); // canonical form
    for (let y = groundTop + 8; y < viewH; y += 10) {
      ctx.fillRect(0, y, viewW, 1);
    }
  }

  // fallback: draw a strong visible rim at the very bottom so the ground is always obvious
  const fallbackHeight = 36;
  const rimColor = (obstacles && obstacles.length) ? obstacles[0].color : '#3b82f6';
  ctx.fillStyle = hexToRgba(rimColor, 0.95);
  ctx.fillRect(0, viewH - fallbackHeight, viewW, 6);
  ctx.fillStyle = hexToRgba(rimColor, 0.2); // canonical form
  ctx.fillRect(0, viewH - fallbackHeight + 6, viewW, fallbackHeight - 6);

  // draw obstacles
  for (const ob of obstacles){
    // retro gradient for obstacle
    const grad = ctx.createLinearGradient(ob.x, ob.y, ob.x, ob.y + ob.h);
    grad.addColorStop(0, hexToRgba(ob.color || '#9f7aea', 1));
    grad.addColorStop(1, hexToRgba(ob.color || '#6d28d9', 0.6));
    ctx.fillStyle = grad;
    ctx.fillRect(ob.x, ob.y, ob.w, ob.h);

    // subtle top highlight
    ctx.fillStyle = hexToRgba('#ffffff', 0.06);
    ctx.fillRect(ob.x+4, ob.y+3, Math.max(6, ob.w-8), 4);

    // neon stroke
    ctx.save();
    ctx.strokeStyle = hexToRgba('#ffffff', 0.08);
    ctx.lineWidth = 1;
    ctx.strokeRect(ob.x+0.5, ob.y+0.5, ob.w-1, ob.h-1);
    ctx.restore();

    // draw points small (contrasting)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '12px system-ui, Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`+${ob.points}`, ob.x + ob.w - 6, ob.y + ob.h - 6);
  }

  // draw particles
  for (const p of particles){
    const t = Math.max(0, Math.min(1, p.life / p.ttl));
    ctx.save();
    ctx.globalApha = t;
    ctx.translate(p.x, p.y);
    if (p.rot) ctx.rotate(p.rot);
    ctx.fillStyle = p.color || '#fff';
    // draw a small rotated rectangle for a more organic look
    ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.8);
    ctx.restore();
  }

  // shadow scales with distance from baseY
  const dist = Math.max(0, box.y - baseY);
  const shadowScale = 1 - Math.min(0.8, dist / 300);

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(box.x + box.w/2, baseY + box.h + 18, box.w * 0.6 * shadowScale, 12 * shadowScale, 0, 0, Math.PI*2);
  ctx.fill();

  // box with simple shading
  // box with Atari-like gradient + neon outline
  const boxGrad = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
  boxGrad.addColorStop(0, '#ffd54d');
  boxGrad.addColorStop(0.6, '#ff8b38');
  boxGrad.addColorStop(1, '#ff3b3b');
  ctx.fillStyle = boxGrad;
  ctx.fillRect(box.x, box.y, box.w, box.h);

  // subtle top sheen
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(box.x + 8, box.y + 6, box.w - 16, 10);

  // neon stroke/glow
  ctx.save();
  ctx.shadowColor = hexToRgba('#ffd54d', 0.25);
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2;
  ctx.strokeStyle = hexToRgba('#ffd54d', 0.9);
  ctx.strokeRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2);
  ctx.restore();
}

function loop(t){
  const now = t || performance.now();
  const dt = Math.min(0.033, (now - last) / 1000); // clamp to 33ms
  last = now;

  if (!paused) update(dt);
  draw();
  // update airtime UI
  if (airtimeEl) {
    airtimeEl.textContent = `Air: ${currentAirtime.toFixed(2)}s (best: ${bestAirtime.toFixed(2)}s)`;
  }
  if (scoreEl) {
    scoreEl.textContent = `Score: ${score}`;
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

function showGameOver(airtime){
  if (!gameOverEl || gameOverShown) return;
  // hide title screen if it's still present to ensure overlay is clickable
  try{ if (titleScreen) titleScreen.style.display = 'none'; }catch(e){}
  gameOverShown = true;
  paused = true;
  finalAirtimeValue = Number(airtime) || 0;
  finalScoreValue = Number(score) || 0; // capture current points at Game Over
  finalAirEl.textContent = `${finalAirtimeValue.toFixed(2)}s`;
  console.debug('showGameOver captured', { finalAirtimeValue, finalScoreValue });
  initialsEl.value = '';
  initialsEl.disabled = false;
  submitBtn.disabled = false;
  gameOverEl.setAttribute('aria-hidden','false');
  initialsEl.focus();
}

function hideGameOver(){
  if (!gameOverEl) return;
  // if a descendant inside overlay still has focus, blur it first to avoid aria-hidden focus blocking
  try{ if (gameOverEl.contains(document.activeElement)) document.activeElement.blur(); }catch(e){}
  gameOverShown = false;
  gameOverEl.setAttribute('aria-hidden','true');
  paused = false;
}

if (submitBtn) {
  submitBtn.addEventListener('click', () => {
  let initials = initialsEl.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);
  if (!initials) initials = '---';
  initialsEl.value = initials;
  initialsEl.disabled = true;
  submitBtn.disabled = true;
  // use the captured final values from the Game Over moment to avoid race conditions
  const airtimeVal = Math.round((finalAirtimeValue || 0) * 100) / 100;
  const pointsVal = Math.round(finalScoreValue || 0);
  const entry = { initials, airtime: airtimeVal, points: pointsVal, date: Date.now() };
  const updated = saveScore(entry);
  renderLeaderboard();
  try { playSubmit(); } catch(e){}
  // ensure overlay visible so user sees leaderboard immediately
  if (gameOverEl) gameOverEl.setAttribute('aria-hidden','false');
  // find rank
  const idx = updated.findIndex(e => e.date === entry.date);
  const saveMsg = document.getElementById('saveMsg');
  if (saveMsg) saveMsg.textContent = idx >= 0 ? `Saved — rank #${idx+1}` : 'Saved';
  console.log('Score submitted', { initials, airtime: airtimeVal, points: pointsVal, rank: idx+1 });
  });
}

function showConfirm(message, onConfirm) {
  if (!confirmModal) return onConfirm();
  confirmText.textContent = message;
  confirmModal.setAttribute('aria-hidden', 'false');
  if (confirmYes) confirmYes.focus();

  function cleanup() {
    if (confirmModal) confirmModal.setAttribute('aria-hidden', 'true');
    confirmYes.removeEventListener('click', yesHandler);
    confirmNo.removeEventListener('click', noHandler);
    window.removeEventListener('keydown', escHandler);
  }

  function yesHandler() { cleanup(); onConfirm(); }
  function noHandler() { cleanup(); }
  function escHandler(e) { if (e.key === 'Escape') { cleanup(); } }

  confirmYes.addEventListener('click', yesHandler);
  confirmNo.addEventListener('click', noHandler);
  window.addEventListener('keydown', escHandler);
}

function clearLeaderboard(){
  showConfirm('Clear all leaderboard entries?', ()=>{
    localStorage.removeItem(scoresKey);
    renderLeaderboard();
    const saveMsg = document.getElementById('saveMsg');
    if (saveMsg) saveMsg.textContent = 'Leaderboard cleared';
  });
}

if (clearBtn) clearBtn.addEventListener('click', clearLeaderboard);

if (restartBtn) {
  restartBtn.addEventListener('click', () => {
  // reset box position and state
  alignBoxToGround();
  box.vx = 0;
  box.vy = 0;
  currentAirtime = 0;
  inAir = false;
  score = 0;
  particles.length = 0;
  respawnTimer = 0;
  spawnObstacles();
  hideGameOver();
  });
}

// Title screen logic
const titleScreen = document.getElementById('titleScreen');
const startGameButton = document.getElementById('startGame');
const canvasEl = document.getElementById('game');

function startGame(e) {
  try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch (err) {}
  if (titleScreen) titleScreen.style.display = 'none';
  if (canvasEl) {
    canvasEl.style.display = 'block';
    try { canvasEl.focus(); } catch (err) {}
  }
  // Now that the canvas is visible, resize canvas and set up the game properly
  resize();
  alignBoxToGround();
  spawnObstacles();
  // reset loop timing to avoid large dt after the page was idle or in fullscreen transition
  last = performance.now();
  gameStarted = true;
  paused = false;
  try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e){}
}

if (startGameButton) {
  startGameButton.addEventListener('click', startGame);
  startGameButton.addEventListener('pointerdown', startGame);
  startGameButton.addEventListener('touchstart', startGame, { passive: false });
}

// Prevent the game from running until the start button is clicked
paused = true;
