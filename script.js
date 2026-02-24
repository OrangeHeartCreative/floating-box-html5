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
canvas.removeEventListener('click', (e) => {
  box.vy -= physics.thrust;
  try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e){}
  playThrust();
});

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
  obstacleCount: 10,
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
    const x = getRandomFloat(0, Math.max(0, viewW - w));
    const y = spawnMinY + getRandomFloat(0, spawnMaxY - spawnMinY);
    const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#8b5cf6'];
    const color = colors[getRandomInt(0, colors.length - 1)];
    const points = Math.max(1, Math.round((120 - w) / 10));
    // horizontal drift speed (slow, random direction)
    const dx = getRandomFloat(15, 45) * (getRandomInt(0,1) === 0 ? -1 : 1);
    // ~50% of obstacles also drift vertically
    const dy = getRandomInt(0,1) === 0
      ? getRandomFloat(10, 30) * (getRandomInt(0,1) === 0 ? -1 : 1)
      : 0;
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
*** End JSON