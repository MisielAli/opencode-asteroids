'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Skins de la nave ──────────────────────────────────────────────────────────
const SHIP_SKIN_STORAGE_KEY = 'asteroids.shipSkin';
const SHIP_SKINS = [
  {
    id: 'classic',
    name: 'CLASICA',
    color: '#fff',
    flameColor: 'rgba(255, 130, 0, 0.85)',
    thrusterX: -8,
    thrusterWidth: 4,
    points: [[20, 0], [-12, -9], [-7, 0], [-12, 9]],
  },
  {
    id: 'interceptor',
    name: 'INTERCEPTOR',
    color: '#35d9ff',
    flameColor: 'rgba(95, 235, 255, 0.9)',
    thrusterX: -12,
    thrusterWidth: 3,
    points: [
      [21, 0], [5, -5], [-11, -10], [-7, -2],
      [-15, 0], [-7, 2], [-11, 10], [5, 5],
    ],
  },
  {
    id: 'explorer',
    name: 'EXPLORADORA',
    color: '#ff9f43',
    flameColor: 'rgba(255, 196, 92, 0.9)',
    thrusterX: -9,
    thrusterWidth: 5,
    points: [
      [18, 0], [10, -7], [-5, -12], [-12, -6],
      [-8, 0], [-12, 6], [-5, 12], [10, 7],
    ],
  },
];

function loadShipSkinIndex() {
  try {
    const savedId = localStorage.getItem(SHIP_SKIN_STORAGE_KEY);
    const index = SHIP_SKINS.findIndex(skin => skin.id === savedId);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

let shipSkinIndex = loadShipSkinIndex();
let shipSkinMessageTimer = 0;

function getShipSkin() {
  return SHIP_SKINS[shipSkinIndex];
}

function cycleShipSkin() {
  shipSkinIndex = (shipSkinIndex + 1) % SHIP_SKINS.length;
  shipSkinMessageTimer = 1.8;
  try {
    localStorage.setItem(SHIP_SKIN_STORAGE_KEY, getShipSkin().id);
  } catch {
    // El juego sigue funcionando si el navegador bloquea el almacenamiento.
  }
}

function drawShipShape(skin, scale = 1, thrusting = false, lineWidth = 1.5) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.strokeStyle = skin.color;
  ctx.lineWidth   = lineWidth / scale;
  ctx.lineJoin    = 'round';

  ctx.beginPath();
  ctx.moveTo(skin.points[0][0], skin.points[0][1]);
  for (let i = 1; i < skin.points.length; i++)
    ctx.lineTo(skin.points[i][0], skin.points[i][1]);
  ctx.closePath();
  ctx.stroke();

  if (thrusting && Math.random() > 0.35) {
    ctx.beginPath();
    ctx.moveTo(skin.thrusterX, -skin.thrusterWidth);
    ctx.lineTo(skin.thrusterX - rand(6, 14), 0);
    ctx.lineTo(skin.thrusterX, skin.thrusterWidth);
    ctx.strokeStyle = skin.flameColor;
    ctx.stroke();
  }

  ctx.restore();
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño
const SHOOTING_STAR_TTL = 6;
const SHOOTING_STAR_POINTS = 250;

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;
    this.points = POINTS[size];
    this.countsForLevel = true;
    this.color = '#fff';

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

class ShootingStar extends Asteroid {
  constructor(x, y, angle) {
    super(x, y, 1);
    const speed = rand(240, 300);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.ttl = SHOOTING_STAR_TTL;
    this.points = SHOOTING_STAR_POINTS;
    this.countsForLevel = false;
    this.color = '#35d9ff';
  }

  update(dt) {
    super.update(dt);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  split() {
    return [];
  }

  draw() {
    const speed = Math.hypot(this.vx, this.vy);
    const nx = this.vx / speed;
    const ny = this.vy / speed;
    const tailLength = 80;

    ctx.save();
    const trail = ctx.createLinearGradient(
      this.x, this.y,
      this.x - nx * tailLength, this.y - ny * tailLength,
    );
    trail.addColorStop(0, 'rgba(53,217,255,0.9)');
    trail.addColorStop(1, 'rgba(53,217,255,0)');
    ctx.strokeStyle = trail;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.x - nx * this.radius * 0.6, this.y - ny * this.radius * 0.6);
    ctx.lineTo(this.x - nx * tailLength, this.y - ny * tailLength);
    ctx.stroke();

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    super.draw();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedBoostTimer = 0;
    this.tripleShotTimer = 0;
    this.shieldTimer = 0;
    this.shieldCooldown = 0;
    this.shieldRadius = 28;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
    if (this.tripleShotTimer > 0) this.tripleShotTimer -= dt;
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldTimer = 0;
        this.shieldCooldown = 10;
      }
    } else if (this.shieldCooldown > 0) {
      this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
    }

    const ROT   = 3.5;   // rad/s
    const THRUST = 260 * (this.speedBoostTimer > 0 ? 2 : 1);  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShotTimer > 0) {
      const SPACING = 8;
      const px = -Math.sin(this.angle);
      const py = Math.cos(this.angle);
      return [-SPACING, 0, SPACING].map(offset =>
        new Bullet(ox + px * offset, oy + py * offset, this.angle)
      );
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  activateSpeedBoost() {
    this.speedBoostTimer = 5;
  }

  activateTripleShot() {
    this.tripleShotTimer = 5;
  }

  activateShield() {
    if (this.shieldTimer > 0 || this.shieldCooldown > 0 || this.dead) return;
    this.shieldTimer = 3;
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    drawShipShape(getShipSkin(), 1, this.thrusting);
    ctx.restore();

    if (this.shieldTimer > 0) {
      const pulse = 1 + Math.sin(performance.now() * 0.012) * 0.06;
      ctx.save();
      ctx.strokeStyle = 'rgba(53,217,255,0.9)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#35d9ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.shieldRadius * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── Power-up de velocidad ─────────────────────────────────────────────────────
class SpeedPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.phase = 0;
    this.dead = false;
  }

  update(dt) {
    this.phase += dt * 3;
  }

  draw() {
    const pulse = 1 + Math.sin(this.phase * 2) * 0.08;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#35d9ff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.lineTo(0, 0);
    ctx.lineTo(-7, 7);
    ctx.moveTo(1, -7);
    ctx.lineTo(8, 0);
    ctx.lineTo(1, 7);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-up de triple disparo ────────────────────────────────────────────────
class TripleShotPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.phase = 0;
    this.dead = false;
  }

  update(dt) {
    this.phase += dt * 3;
  }

  draw() {
    const pulse = 1 + Math.sin(this.phase * 2) * 0.08;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#ffcc45';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    for (const x of [-6, 0, 6]) {
      ctx.moveTo(x, 7);
      ctx.lineTo(x, -7);
      ctx.moveTo(x - 3, -4);
      ctx.lineTo(x, -7);
      ctx.lineTo(x + 3, -4);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let shootingStarTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function spawnShootingStar() {
  const edge = randInt(0, 3);
  let x, y;

  if (edge === 0) { x = 0; y = rand(0, H); }
  if (edge === 1) { x = W; y = rand(0, H); }
  if (edge === 2) { x = rand(0, W); y = 0; }
  if (edge === 3) { x = rand(0, W); y = H; }

  const targetX = rand(W * 0.25, W * 0.75);
  const targetY = rand(H * 0.25, H * 0.75);
  const angle = Math.atan2(targetY - y, targetX - x);
  asteroids.push(new ShootingStar(x, y, angle));
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  shootingStarTimer = rand(10, 18);
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (shipSkinMessageTimer > 0) shipSkinMessageTimer -= dt;
  if (pressed('KeyS')) cycleShipSkin();

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    powerUps.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    powerUps.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    asteroids = asteroids.filter(a => !a.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }
  if (pressed('KeyE')) ship.activateShield();

  shootingStarTimer -= dt;
  if (shootingStarTimer <= 0) {
    spawnShootingStar();
    shootingStarTimer = rand(10, 18);
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += a.points;
        explode(a.x, a.y, a.size * 5);
        if (Math.random() < 0.15) {
          const PowerUp = Math.random() < 0.5 ? SpeedPowerUp : TripleShotPowerUp;
          powerUps.push(new PowerUp(a.x, a.y));
        }
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs power-up
  for (const powerUp of powerUps) {
    if (!powerUp.dead && dist(ship, powerUp) < ship.radius + powerUp.radius) {
      powerUp.dead = true;
      if (powerUp instanceof TripleShotPowerUp) ship.activateTripleShot();
      else ship.activateSpeedBoost();
    }
  }
  powerUps = powerUps.filter(p => !p.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (ship.shieldTimer > 0 && dist(ship, a) < ship.shieldRadius + a.radius * 0.82) {
        a.dead = true;
        explode(a.x, a.y, a.size * 5);
      } else if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
    asteroids = asteroids.filter(a => !a.dead);
  }

  // Nivel completado
  if (!asteroids.some(a => a.countsForLevel)) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  drawShipShape(getShipSkin(), 0.45, false, 1.2);
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  let statusY = 48;
  if (ship.speedBoostTimer > 0) {
    ctx.fillStyle = '#35d9ff';
    ctx.fillText(`VELOCIDAD x2  ${ship.speedBoostTimer.toFixed(1)}s`, 14, statusY);
    statusY += 22;
  }
  if (ship.tripleShotTimer > 0) {
    ctx.fillStyle = '#ffcc45';
    ctx.fillText(`TRIPLE SHOT  ${ship.tripleShotTimer.toFixed(1)}s`, 14, statusY);
    statusY += 22;
  }

  if (ship.shieldTimer > 0) {
    ctx.fillStyle = '#35d9ff';
    ctx.fillText(`ESCUDO  ${ship.shieldTimer.toFixed(1)}s`, 14, statusY);
  } else if (ship.shieldCooldown > 0) {
    ctx.fillStyle = 'rgba(53,217,255,0.7)';
    ctx.fillText(`ESCUDO RECARGANDO  ${ship.shieldCooldown.toFixed(1)}s`, 14, statusY);
  } else {
    ctx.fillStyle = '#35d9ff';
    ctx.fillText('ESCUDO LISTO  E', 14, statusY);
  }
  ctx.fillStyle = '#fff';

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  if (shipSkinMessageTimer > 0) {
    ctx.fillStyle = getShipSkin().color;
    ctx.textAlign = 'center';
    ctx.fillText(`NAVE: ${getShipSkin().name}`, W / 2, H - 18);
  }

}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
