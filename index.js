const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("scoreEl");
const bestScoreElement = document.getElementById("bestScoreEl");
const stageElement = document.getElementById("stageEl");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayScore = document.getElementById("overlayScore");
const overlayInstructions = document.getElementById("overlayInstructions");
const modalBestScoreElement = document.getElementById("modalBestScoreEl");
const primaryButton = document.getElementById("primaryButton");

const storagePath = location.pathname.replace(/\/index\.html$/, "/");
const HIGH_SCORE_KEY = `ball-game-high-score:${storagePath}`;
const MAX_PARTICLES = 520;
const PLAYER_RADIUS = 11;
const PROJECTILE_SPEED = 380;
const PROJECTILE_RADIUS = 5;
const STAGES = [
  { number: 1, score: 0, enemySpeed: 38, speedSpread: 10, spawnDelay: 1500 },
  { number: 2, score: 100, enemySpeed: 46, speedSpread: 12, spawnDelay: 1325 },
  { number: 3, score: 250, enemySpeed: 54, speedSpread: 14, spawnDelay: 1150 },
  { number: 4, score: 450, enemySpeed: 64, speedSpread: 16, spawnDelay: 980 },
  { number: 5, score: 700, enemySpeed: 76, speedSpread: 18, spawnDelay: 850 },
];

const projectiles = [];
const enemies = [];
const particles = [];

let width = 0;
let height = 0;
let centerX = 0;
let centerY = 0;
let animationId = 0;
let lastFrameTime = 0;
let spawnAccumulator = 0;
let score = 0;
let stage = 1;
let bestScore = readBestScore();
let gameState = "ready";
let player;

class Player {
  constructor(x, y, radius, color) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

class Enemy {
  constructor(x, y, radius, color, velocity) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.velocity = velocity;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  update(delta) {
    this.x += this.velocity.x * delta;
    this.y += this.velocity.y * delta;
    this.draw();
  }
}

class Projectile {
  constructor(x, y, radius, color, velocity) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.velocity = velocity;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  update(delta) {
    this.x += this.velocity.x * delta;
    this.y += this.velocity.y * delta;
    this.draw();
  }
}

class Particle {
  constructor(x, y, radius, color, velocity) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.velocity = velocity;
    this.alpha = 1;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }

  update(delta) {
    this.draw();

    const drag = Math.pow(0.99, delta * 60);
    this.velocity.x *= drag;
    this.velocity.y *= drag;
    this.x += this.velocity.x * delta;
    this.y += this.velocity.y * delta;
    this.alpha -= delta * 0.6;
  }
}

function readBestScore() {
  try {
    const storedScore = Number(localStorage.getItem(HIGH_SCORE_KEY));
    return Number.isFinite(storedScore) ? storedScore : 0;
  } catch {
    return 0;
  }
}

function saveBestScore() {
  if (score <= bestScore) {
    return;
  }

  bestScore = score;
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(bestScore));
  } catch {
    // The visible best score still updates if storage is unavailable.
  }
  updateScoreUI();
}

function updateScoreUI() {
  scoreElement.textContent = String(score);
  bestScoreElement.textContent = String(bestScore);
  modalBestScoreElement.textContent = String(bestScore);
  stageElement.textContent = String(stage);
}

function addScore(points) {
  score += points;
  stage = getStageForScore(score).number;

  saveBestScore();
  updateScoreUI();
}

function getStageForScore(scoreValue) {
  return STAGES.reduce((currentStage, stageConfig) => {
    return scoreValue >= stageConfig.score ? stageConfig : currentStage;
  }, STAGES[0]);
}

function setOverlay(title, buttonText, scoreText, showInstructions = false) {
  overlayTitle.textContent = title;
  primaryButton.textContent = buttonText;
  overlayScore.textContent = scoreText;
  modalBestScoreElement.textContent = bestScore;
  overlayInstructions.classList.toggle("is-visible", showInstructions);
}

function showOverlay() {
  overlay.classList.remove("is-hidden");
}

function hideOverlay() {
  overlay.classList.add("is-hidden");
}

function updateControls() {
  pauseButton.disabled = gameState === "ready" || gameState === "over";
  restartButton.disabled = gameState === "ready";
  pauseButton.textContent = gameState === "paused" ? "Resume" : "Pause";
}

function resizeCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  centerX = width / 2;
  centerY = height / 2;

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  if (!player) {
    player = new Player(centerX, centerY, PLAYER_RADIUS, "#ffffff");
  } else {
    player.x = centerX;
    player.y = centerY;
  }

  drawBackground(1);
  player.draw();
}

function drawBackground(alpha) {
  ctx.fillStyle = `rgba(3, 7, 18, ${alpha})`;
  ctx.fillRect(0, 0, width, height);
}

function resetGame() {
  projectiles.length = 0;
  enemies.length = 0;
  particles.length = 0;
  score = 0;
  stage = 1;
  spawnAccumulator = 0;
  player.x = centerX;
  player.y = centerY;
  updateScoreUI();
}

function startGame() {
  cancelAnimationFrame(animationId);
  resetGame();
  hideOverlay();
  gameState = "running";
  lastFrameTime = performance.now();
  updateControls();
  animationId = requestAnimationFrame(animate);
}

function pauseGame() {
  if (gameState !== "running") {
    return;
  }

  gameState = "paused";
  cancelAnimationFrame(animationId);
  setOverlay("Paused", "Resume", `Score ${score} | Stage ${stage}`);
  showOverlay();
  updateControls();
}

function resumeGame() {
  if (gameState !== "paused") {
    return;
  }

  gameState = "running";
  hideOverlay();
  lastFrameTime = performance.now();
  updateControls();
  animationId = requestAnimationFrame(animate);
}

function endGame() {
  if (gameState === "over") {
    return;
  }

  gameState = "over";
  cancelAnimationFrame(animationId);
  saveBestScore();
  setOverlay("Game Over", "Play Again", `Score ${score} | Stage ${stage}`);
  showOverlay();
  updateControls();
}

function spawnEnemy() {
  const radius = Math.random() * 22 + 9;
  let enemyX = 0;
  let enemyY = 0;

  if (Math.random() < 0.5) {
    enemyX = Math.random() < 0.5 ? -radius : width + radius;
    enemyY = Math.random() * height;
  } else {
    enemyX = Math.random() * width;
    enemyY = Math.random() < 0.5 ? -radius : height + radius;
  }

  const color = `hsl(${Math.random() * 360}, 72%, 58%)`;
  const angle = Math.atan2(centerY - enemyY, centerX - enemyX);
  const stageConfig = getStageForScore(score);
  const speed = stageConfig.enemySpeed + Math.random() * stageConfig.speedSpread;
  const velocity = {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed,
  };

  enemies.push(new Enemy(enemyX, enemyY, radius, color, velocity));
}

function spawnEnemies(delta) {
  const spawnDelay = getStageForScore(score).spawnDelay;
  spawnAccumulator += delta * 1000;

  if (spawnAccumulator >= spawnDelay) {
    spawnAccumulator = 0;
    spawnEnemy();
  }
}

function createExplosion(x, y, color, radius) {
  const particleCount = Math.floor(radius * 2);
  const oldSplashSpeed = () => (Math.random() - 0.5) * (Math.random() * 8) * 60;

  for (let i = 0; i < particleCount; i += 1) {
    particles.push(
      new Particle(x, y, Math.random() * 2, color, {
        x: oldSplashSpeed(),
        y: oldSplashSpeed(),
      })
    );
  }

  if (particles.length > MAX_PARTICLES) {
    particles.splice(0, particles.length - MAX_PARTICLES);
  }
}

function updateParticles(delta) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];

    if (particle.alpha <= 0) {
      particles.splice(index, 1);
    } else {
      particle.update(delta);
    }
  }
}

function updateProjectiles(delta) {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.update(delta);

    if (
      projectile.x + projectile.radius < 0 ||
      projectile.x - projectile.radius > width ||
      projectile.y + projectile.radius < 0 ||
      projectile.y - projectile.radius > height
    ) {
      projectiles.splice(index, 1);
    }
  }
}

function updateEnemies(delta) {
  for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
    const enemy = enemies[enemyIndex];
    enemy.update(delta);

    const playerDistance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (playerDistance < player.radius + enemy.radius) {
      endGame();
      return;
    }

    for (let projectileIndex = projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
      const projectile = projectiles[projectileIndex];
      const projectileDistance = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);

      if (projectileDistance >= projectile.radius + enemy.radius) {
        continue;
      }

      createExplosion(projectile.x, projectile.y, enemy.color, enemy.radius);
      projectiles.splice(projectileIndex, 1);

      if (enemy.radius > 18) {
        enemy.radius -= 8;
        enemy.velocity.x *= 1.03;
        enemy.velocity.y *= 1.03;
        addScore(10);
      } else {
        enemies.splice(enemyIndex, 1);
        addScore(30);
      }

      break;
    }
  }
}

function animate(timestamp) {
  if (gameState !== "running") {
    return;
  }

  const delta = Math.min((timestamp - lastFrameTime) / 1000, 0.033);
  lastFrameTime = timestamp;
  animationId = requestAnimationFrame(animate);

  drawBackground(0.1);
  player.draw();
  spawnEnemies(delta);
  updateParticles(delta);
  updateProjectiles(delta);
  updateEnemies(delta);
}

function shootAt(targetX, targetY) {
  if (gameState !== "running") {
    return;
  }

  const angle = Math.atan2(targetY - centerY, targetX - centerX);
  const velocity = {
    x: Math.cos(angle) * PROJECTILE_SPEED,
    y: Math.sin(angle) * PROJECTILE_SPEED,
  };

  projectiles.push(new Projectile(centerX, centerY, PROJECTILE_RADIUS, "#ffffff", velocity));
}

canvas.addEventListener("pointerdown", (event) => {
  shootAt(event.clientX, event.clientY);
});

pauseButton.addEventListener("click", () => {
  if (gameState === "paused") {
    resumeGame();
  } else {
    pauseGame();
  }
});

restartButton.addEventListener("click", startGame);

primaryButton.addEventListener("click", () => {
  if (gameState === "paused") {
    resumeGame();
  } else {
    startGame();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "p") {
    if (gameState === "running") {
      pauseGame();
    } else if (gameState === "paused") {
      resumeGame();
    }
  }

  if (event.key === "Enter" && (gameState === "ready" || gameState === "over")) {
    startGame();
  }
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateScoreUI();
setOverlay("Ball Game", "Start", "Stage goals and controls", true);
updateControls();
