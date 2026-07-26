const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
// Я без понятия, кто будет читать этот код))
// Но, почему бы, из вежливости, не оставить комменты для всех, чтобы можно было кастомить
// Настройки сетки (как GitHub: 7x52)
const COLS = 7;
const ROWS = 52;
const CELL = 20;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;

canvas.width = WIDTH;
canvas.height = HEIGHT;

// Цвета GitHub
const COLORS = {
  bg: "#0d1117",
  grid: "#161b22",
  player: "#2ea043",      // зелёный (защита)
  enemy: "#8b5cf6",       // фиолетовый (атака)
  bullet: "#f0f6fc",
  text: "#c9d1d9"
};

// Состояние
let score = 0;
let hp = 3;
let gameOver = false;

// Игрок (внизу, 1 ячейка)
const player = { x: 3, y: ROWS - 1, w: 1, h: 1 };

// Враги (сверху, 2 ряда)
const enemies = [];
for (let i = 0; i < COLS; i++) {
  enemies.push({ x: i, y: 1, alive: true });
  enemies.push({ x: i, y: 2, alive: true });
}

// Пули
const bullets = [];

// Управление
const keys = {};
document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);

// Игровой цикл
let lastTime = 0;
let enemyMoveTimer = 0;
const enemyMoveInterval = 500; // мс

function update(dt) {
  if (gameOver) return;

  // Движение игрока
  if (keys["ArrowLeft"] && player.x > 0) player.x--;
  if (keys["ArrowRight"] && player.x < COLS - 1) player.x++;

  // Выстрел
  if (keys["Space"] && !player.cooldown) {
    bullets.push({ x: player.x, y: player.y - 1 });
    player.cooldown = true;
    setTimeout(() => player.cooldown = false, 200);
  }

  // Движение пуль
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= 0.1; // плавное движение
    if (bullets[i].y < 0) bullets.splice(i, 1);
  }

  // Движение врагов
  enemyMoveTimer += dt;
  if (enemyMoveTimer > enemyMoveInterval) {
    enemyMoveTimer = 0;
    let hitBottom = false;
    enemies.forEach(e => {
      if (!e.alive) return;
      e.y += 1;
      if (e.y >= player.y) hitBottom = true;
    });
    if (hitBottom) {
      hp--;
      if (hp <= 0) gameOver = true;
      // Сброс врагов
      enemies.forEach((e, i) => {
        e.y = (i < COLS) ? 1 : 2;
        e.alive = true;
      });
    }
  }

  // Коллизии пуля-враг
  bullets.forEach((b, bi) => {
    enemies.forEach(e => {
      if (!e.alive) return;
      if (Math.round(b.x) === e.x && Math.round(b.y) === e.y) {
        e.alive = false;
        bullets.splice(bi, 1);
        score += 10;
      }
    });
  });

  // Обновление UI
  document.getElementById("score").textContent = score;
  document.getElementById("hp").textContent = hp;
}

function draw() {
  // Фон
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Сетка
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(WIDTH, y * CELL);
    ctx.stroke();
  }

  // Игрок
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(player.x * CELL, player.y * CELL, CELL, CELL);

  // Враги
  enemies.forEach(e => {
    if (!e.alive) return;
    ctx.fillStyle = COLORS.enemy;
    ctx.fillRect(e.x * CELL, e.y * CELL, CELL, CELL);
  });

  // Пули
  ctx.fillStyle = COLORS.bullet;
  bullets.forEach(b => {
    ctx.fillRect(b.x * CELL, b.y * CELL, 4, 8);
  });

  // Game Over
  if (gameOver) {
    ctx.fillStyle = COLORS.text;
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2);
    ctx.font = "14px monospace";
    ctx.fillText("Press F5 to restart", WIDTH / 2, HEIGHT / 2 + 20);
  }
}

function loop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);