
import * as THREE from 'three';
import { buildCity } from './city.js';

// SHADOW SURVIVOR

const $ = id => document.getElementById(id);
const canvas = $('game');
const isTouch = matchMedia('(pointer: coarse)').matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isTouch,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050b1a);
scene.fog = new THREE.FogExp2(0x050b1a, 0.012);

const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 500);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// LIGHTING
scene.add(new THREE.HemisphereLight(0x7aaaff, 0x080b16, 0.8));

const moon = new THREE.DirectionalLight(0x8abaff, 1.1);
moon.position.set(-30, 60, 20);
scene.add(moon);

const rimLight = new THREE.DirectionalLight(0x00c8ff, 0.45);
rimLight.position.set(20, 12, -25);
scene.add(rimLight);

// CITY
const colliders = [];
const lowPower = isTouch;
const city = buildCity(scene, renderer, colliders, lowPower);

// SAFE ZONE
const ring = new THREE.Mesh(
  new THREE.RingGeometry(9.6, 10, 96),
  new THREE.MeshBasicMaterial({
    color: 0x00c8ff,
    side: THREE.DoubleSide
  })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.035;
scene.add(ring);

// PLAYER
const player = new THREE.Group();

const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, 0.9, 4, 12),
  new THREE.MeshStandardMaterial({
    color: 0x152a48,
    roughness: 0.32,
    metalness: 0.65
  })
);
body.position.y = 0.9;

const visor = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.15, 0.2),
  new THREE.MeshBasicMaterial({ color: 0x00e5ff })
);
visor.position.set(0, 1.45, 0.3);

player.add(body, visor);
scene.add(player);

const START_POS = { x: 0, z: 4 };
player.position.set(START_POS.x, 0, START_POS.z);

// GAME STATE
let state = 'intro';
let score = 0;
let progress;
let tutorialDone = false;

// ENERGY ORBS
const orbs = [];
const orbGeo = new THREE.IcosahedronGeometry(0.35, 1);
const orbMat = new THREE.MeshBasicMaterial({ color: 0x00ffd5 });

for (let k = 0; k < 6; k++) {
  const a = (k / 6) * Math.PI * 2 + 0.5;
  const high = k % 3 === 2;
  const baseY = high ? 2.4 : 1.2;

  const mesh = new THREE.Mesh(orbGeo, orbMat);
  mesh.position.set(Math.cos(a) * 7, baseY, Math.sin(a) * 7);
  scene.add(mesh);

  orbs.push({ mesh, baseY, taken: false, phase: k });
}

// TUTORIAL
const STEPS = [
  {
    id: 'move',
    title: 'Move around the ring',
    goal: 6,
    points: 50,
    hint: isTouch ? 'Hold the left stick' : 'Press W A S D or arrows'
  },
  {
    id: 'look',
    title: 'Look around',
    goal: 3,
    points: 50,
    hint: isTouch ? 'Drag your finger' : 'Drag the mouse'
  },
  {
    id: 'run',
    title: 'Run for two seconds',
    goal: 2,
    points: 50,
    hint: isTouch ? 'Hold RUN while moving' : 'Hold Shift while moving'
  },
  {
    id: 'jump',
    title: 'Jump twice',
    goal: 2,
    points: 50,
    hint: isTouch ? 'Tap JUMP' : 'Press Space'
  },
  {
    id: 'orbs',
    title: 'Collect the 6 energy orbs',
    goal: 6,
    points: 0,
    hint: 'Walk into the glowing orbs'
  }
];

const ORB_POINTS = 100;
const TUTORIAL_BONUS = 250;
const taskEls = {};

STEPS.forEach(s => {
  const li = document.createElement('li');
  li.innerHTML = '<span class="tick"></span><span class="t"></span><span class="n"></span>';
  li.querySelector('.t').textContent = s.title;
  $('tasks').appendChild(li);
  taskEls[s.id] = li;
});

// POPUP
function popup(message) {
  const el = document.createElement('div');
  el.className = 'm2-pop';
  el.textContent = message;
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// SCORE
function addScore(amount, label) {
  score += amount;
  const el = $('scoreVal');
  el.textContent = score;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');

  if (label) popup(label + (amount ? ' +' + amount : ''));
}

// TASKS
function refreshTasks() {
  let current = null;

  STEPS.forEach(s => {
    const done = progress[s.id] >= s.goal;
    taskEls[s.id].classList.toggle('done', done);

    taskEls[s.id].querySelector('.n').textContent =
      s.id === 'orbs'
        ? Math.min(progress.orbs, 6) + '/6'
        : '';

    if (!done && !current) current = s;
  });

  $('orbVal').textContent = 'Orbs ' + Math.min(progress.orbs, 6) + ' / 6';

  if (current) {
    $('objTitle').textContent = current.title;
    $('objHint').textContent = current.hint;
  } else {
    $('objTitle').textContent = 'Training complete';
    $('objHint').textContent = 'Step outside the ring to explore the city.';
  }
}

function addProgress(id, amount) {
  const step = STEPS.find(s => s.id === id);
  if (!step || progress[id] >= step.goal) return;

  progress[id] = Math.min(step.goal, progress[id] + amount);

  if (progress[id] >= step.goal) {
    if (step.points) addScore(step.points, 'Step complete');

    if (!tutorialDone && STEPS.every(s => progress[s.id] >= s.goal)) {
      tutorialDone = true;
      addScore(TUTORIAL_BONUS, 'Training complete');
    }
  }

  refreshTasks();
}

// INPUT
const keys = {};
const touch = { x: 0, y: 0, run: false, jump: false };

function clearInputs() {
  for (const key in keys) keys[key] = false;
  touch.x = 0;
  touch.y = 0;
  touch.run = false;
  touch.jump = false;
  joyEnd();
}

// JOYSTICK
const joy = $('joy');
const knob = $('knob');
let joyId = null;

function joyMove(e) {
  const r = joy.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);

  const length = Math.hypot(dx, dy);
  const max = 50;

  if (length > max) {
    dx = dx / length * max;
    dy = dy / length * max;
  }

  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  touch.x = dx / max;
  touch.y = dy / max;
}

function joyEnd() {
  joyId = null;
  touch.x = 0;
  touch.y = 0;
  if (knob) knob.style.transform = 'translate(0,0)';
}

if (joy && knob) {
  joy.addEventListener('pointerdown', e => {
    joyId = e.pointerId;
    joy.setPointerCapture(joyId);
    joyMove(e);
  });

  joy.addEventListener('pointermove', e => {
    if (e.pointerId === joyId) joyMove(e);
  });

  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);
}

// RUN AND JUMP BUTTONS
function hold(id, prop) {
  const el = $(id);
  if (!el) return;

  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    touch[prop] = true;
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
    el.addEventListener(type, () => touch[prop] = false);
  });
}

hold('runBtn', 'run');
hold('jumpBtn', 'jump');

// CAMERA LOOK
let yaw = 0;
let pitch = 0.35;
let lookId = null;
let lx = 0;
let ly = 0;

canvas.addEventListener('pointerdown', e => {
  if (state !== 'playing' || e.target !== canvas) return;

  lookId = e.pointerId;
  lx = e.clientX;
  ly = e.clientY;
  canvas.setPointerCapture(lookId);
});

canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== lookId || state !== 'playing') return;

  const dx = e.clientX - lx;
  const dy = e.clientY - ly;

  yaw -= dx * 0.006;
  pitch = Math.max(0.05, Math.min(1, pitch + dy * 0.004));

  addProgress('look', Math.abs(dx) * 0.006 + Math.abs(dy) * 0.004);

  lx = e.clientX;
  ly = e.clientY;
});

function lookEnd(e) {
  if (e.pointerId === lookId) lookId = null;
}

canvas.addEventListener('pointerup', lookEnd);
canvas.addEventListener('pointercancel', lookEnd);

// KEYBOARD
addEventListener('keydown', e => {
  keys[e.code] = true;

  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }

  if (e.code === 'Enter' && state === 'intro') startGame();
});

addEventListener('keyup', e => {
  keys[e.code] = false;
});

// MENUS
function showOnly(id) {
  $('intro').classList.toggle('m2-hidden', id !== 'intro');
  $('pauseMenu').classList.toggle('m2-hidden', id !== 'pause');
}

function resetGame() {
  score = 0;
  $('scoreVal').textContent = '0';

  progress = { move: 0, look: 0, run: 0, jump: 0, orbs: 0 };
  tutorialDone = false;

  orbs.forEach(o => {
    o.taken = false;
    o.mesh.visible = true;
  });

  player.position.set(START_POS.x, 0, START_POS.z);

  vy = 0;
  onGround = true;
  faceAngle = 0;
  player.rotation.y = 0;

  yaw = 0;
  pitch = 0.35;

  clearInputs();
  refreshTasks();
}

function startGame() {
  if (state !== 'intro') return;
  resetGame();
  state = 'playing';
  showOnly(null);
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  clearInputs();
  showOnly('pause');
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  showOnly(null);
}

function restartGame() {
  if (state === 'intro') return;
  resetGame();
  state = 'playing';
  showOnly(null);
}

// BUTTON EVENTS
$('startBtn').addEventListener('click', startGame);
$('pauseBtn').addEventListener('click', pauseGame);
$('resumeBtn').addEventListener('click', resumeGame);
$('restartBtn').addEventListener('click', restartGame);
$('pauseRestartBtn').addEventListener('click', restartGame);

$('pauseControls').textContent = isTouch
  ? 'Left stick: move | Drag screen: look'
  : 'WASD/Arrows: move | Shift: run | Space: jump | Drag mouse: look';

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

// HUD
const hudCache = {};

function setText(id, value) {
  if (hudCache[id] !== value) {
    hudCache[id] = value;
    $(id).textContent = value;
  }
}

function updateStatus(moving, running) {
  const p = player.position;

  setText(
    'stateVal',
    !onGround ? 'Jumping' : moving ? (running ? 'Running' : 'Walking') : 'Idle'
  );

  setText(
    'zoneVal',
    Math.hypot(p.x, p.z) <= 10 ? 'Safe zone' : 'Outside the ring'
  );

  setText('hpVal', '100%');
}

// PHYSICS
let vy = 0;
let onGround = true;
let faceAngle = 0;

const clock = new THREE.Clock();
const playerCenter = new THREE.Vector3();

function update(dt) {
  const active = state === 'playing';

  let f = 0;
  let s = 0;

  if (active) {
    f =
      (keys.KeyW || keys.ArrowUp ? 1 : 0) -
      (keys.KeyS || keys.ArrowDown ? 1 : 0) -
      touch.y;

    s =
      (keys.KeyD || keys.ArrowRight ? 1 : 0) -
      (keys.KeyA || keys.ArrowLeft ? 1 : 0) +
      touch.x;
  }

  const mag = Math.hypot(f, s);

  if (mag > 1) {
    f /= mag;
    s /= mag;
  }

  const running = active && (
    keys.ShiftLeft ||
    keys.ShiftRight ||
    touch.run
  );

  const speed = running ? 8 : 4.5;

  const mx = (-Math.sin(yaw) * f + Math.cos(yaw) * s) * speed * dt;
  const mz = (-Math.cos(yaw) * f - Math.sin(yaw) * s) * speed * dt;

  player.position.x += mx;
  player.position.z += mz;

  if (mag > 0.1) {
    const target = Math.atan2(mx, mz);
    let diff = target - faceAngle;

    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    faceAngle += diff * Math.min(1, dt * 12);
    player.rotation.y = faceAngle;

    if (active) {
      addProgress('move', Math.hypot(mx, mz));
      if (running && onGround) addProgress('run', dt);
    }
  }

  // JUMP
  if (active && (keys.Space || touch.jump) && onGround) {
    vy = 8;
    onGround = false;
    addProgress('jump', 1);
  }

  vy -= 22 * dt;
  player.position.y += vy * dt;

  if (player.position.y <= 0) {
    player.position.y = 0;
    vy = 0;
    onGround = true;
  }

  // BUILDING COLLISION
  const radius = 0.5;

  for (const c of colliders) {
    const nx = Math.max(c.x - c.hw, Math.min(player.position.x, c.x + c.hw));
    const nz = Math.max(c.z - c.hd, Math.min(player.position.z, c.z + c.hd));

    const dx = player.position.x - nx;
    const dz = player.position.z - nz;
    const dist = Math.hypot(dx, dz);

    if (dist < radius) {
      if (dist > 0.0001) {
        player.position.x += dx / dist * (radius - dist);
        player.position.z += dz / dist * (radius - dist);
      } else {
        player.position.x += radius;
      }
    }
  }

  // ORBS
  const t = clock.elapsedTime;

  playerCenter.set(
    player.position.x,
    player.position.y + 1,
    player.position.z
  );

  for (const o of orbs) {
    if (o.taken) continue;

    o.mesh.rotation.y += dt * 2;
    o.mesh.position.y = o.baseY + Math.sin(t * 2 + o.phase) * 0.15;

    if (
      active &&
      o.mesh.position.distanceTo(playerCenter) < 1.3
    ) {
      o.taken = true;
      o.mesh.visible = false;
      addScore(ORB_POINTS, 'Energy orb');
      addProgress('orbs', 1);
    }
  }

  updateStatus(mag > 0.1, running);

  // INTRO CAMERA
  if (state === 'intro') yaw += dt * 0.12;

  // THIRD-PERSON CAMERA
  const dist = 6.5;
  const p = player.position;

  camera.position.set(
    p.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    p.y + 1.5 + Math.sin(pitch) * dist,
    p.z + Math.cos(yaw) * Math.cos(pitch) * dist
  );

  camera.lookAt(p.x, p.y + 1.4, p.z);

  // CITY SKY FOLLOW
  city.update(camera.position);
}

// GAME LOOP
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);

  update(dt);
  renderer.render(scene, camera);

  requestAnimationFrame(loop);
}

// START
resetGame();
loop();
