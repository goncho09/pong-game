// ---------- Configuración ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

const PADDLE_WIDTH = 14;
const PADDLE_HEIGHT = 90;
const PADDLE_SPEED = 7;

const BALL_RADIUS = 8;
const BALL_BASE_SPEED = 6;
const MAX_SPEED = 8;

const WINNING_SCORE = 10;

const MAX_BALLS = 15;

// ---------- UI ----------
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const btnStart = document.getElementById('btn-start');
const scoreLeftEl = document.getElementById('score-left');
const scoreRightEl = document.getElementById('score-right');

btnStart.addEventListener('click', () => {
  if (gameOver) {
    startGame();
    return;
  }

  if (!running) {
    startGame();
    return;
  }

  togglePause();
});

// ---------- Estado ----------
let leftPaddle, rightPaddle;

let balls = [];
let nextBallId = 1;

let scoreLeft = 0;
let scoreRight = 0;

let running = false;
let paused = false;
let gameOver = false;

let realBallId = null;

let duplicationTimer = 0;
let realChangeTimer = 0;

let difficulty = 0;
let realVisibility = 1;

let serveDelay = 1000;
let serveTimer = 0;
let waitingServe = false;

// ---------- Input ----------
const keys = {
  w: false,
  s: false,
  ArrowUp: false,
  ArrowDown: false,
};

// // ---------- Setup ----------
function createPaddles() {
  leftPaddle = {
    x: 30,
    y: H / 2 - PADDLE_HEIGHT / 2,
    w: PADDLE_WIDTH,
    h: PADDLE_HEIGHT,
    color: '#4ddbff',
  };

  rightPaddle = {
    x: W - 30 - PADDLE_WIDTH,
    y: H / 2 - PADDLE_HEIGHT / 2,
    w: PADDLE_WIDTH,
    h: PADDLE_HEIGHT,
    color: '#ff4d6d',
  };
}

function randomAngle() {
  const a = 0.25 + Math.random() * 0.5;
  return Math.random() < 0.5 ? -a : a;
}

// spawn SIEMPRE lejos de arcos
function safeSpawn() {
  return {
    x: W * 0.5 + (Math.random() * 60 - 30),
    y: H * 0.5 + (Math.random() * 60 - 30),
  };
}

function createBall() {
  const angle = randomAngle();
  const dir = Math.random() < 0.5 ? 1 : -1;

  const vx = Math.cos(angle) * BALL_BASE_SPEED * dir;
  const vy = Math.sin(angle) * BALL_BASE_SPEED;

  return {
    id: nextBallId++,
    x: W / 2,
    y: H / 2,
    r: BALL_RADIUS,
    vx,
    vy,
    startVx: vx,
    startVy: vy,
    speed: BALL_BASE_SPEED,
    isReal: false,
  };
}

function resetBall() {
  balls = [createBall()];
  balls[0].isReal = true;

  waitingServe = true;
  serveTimer = 0;

  balls[0].vx = 0;
  balls[0].vy = 0;
}

// ---------- Input ----------
window.addEventListener('keydown', (e) => {
  if (e.key === 'w') keys.w = true;
  if (e.key === 's') keys.s = true;
  if (e.key === 'ArrowUp') keys.ArrowUp = true;
  if (e.key === 'ArrowDown') keys.ArrowDown = true;
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'w') keys.w = false;
  if (e.key === 's') keys.s = false;
  if (e.key === 'ArrowUp') keys.ArrowUp = false;
  if (e.key === 'ArrowDown') keys.ArrowDown = false;
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    togglePause();
  }
});

// ---------- Movimiento ----------
function movePaddles() {
  if (!leftPaddle || !rightPaddle) return;

  if (keys.w) leftPaddle.y -= PADDLE_SPEED;
  if (keys.s) leftPaddle.y += PADDLE_SPEED;

  if (keys.ArrowUp) rightPaddle.y -= PADDLE_SPEED;
  if (keys.ArrowDown) rightPaddle.y += PADDLE_SPEED;

  leftPaddle.y = Math.max(0, Math.min(H - leftPaddle.h, leftPaddle.y));
  rightPaddle.y = Math.max(0, Math.min(H - rightPaddle.h, rightPaddle.y));
}

function bounceFromPaddle(ball, paddle) {
  const relativeIntersect =
    (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);

  const MAX_BOUNCE = Math.PI / 3;
  let angle = relativeIntersect * MAX_BOUNCE;

  const direction = paddle === leftPaddle ? 1 : -1;

  const speedBefore = ball.speed;

  ball.speed = Math.min(ball.speed + 0.1, MAX_SPEED);

  ball.vx = Math.cos(angle) * ball.speed * direction;
  ball.vy = Math.sin(angle) * ball.speed;

  const MIN_X = 2.5;
  if (Math.abs(ball.vx) < MIN_X) {
    ball.vx = MIN_X * direction;
  }

  ball.x = direction === 1 ? paddle.x + paddle.w + ball.r : paddle.x - ball.r;
}

// ---------- Física ----------
function updateBall(ball) {
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.id === realBallId) {
    const noise = (Math.random() - 0.5) * realVisibility * 0.02;
    ball.vx += noise;
    ball.vy += noise * 0.3;
  }

  const maxSpeed = Math.min(MAX_SPEED + difficulty * 0.15, 12);
  const speed = Math.hypot(ball.vx, ball.vy);

  if (speed > maxSpeed) {
    ball.vx = (ball.vx / speed) * maxSpeed;
    ball.vy = (ball.vy / speed) * maxSpeed;
  }

  // Techo / piso
  if (ball.y - ball.r <= 0) {
    ball.y = ball.r;
    ball.vy *= -1;

    const MIN_X_BOUNCE = 3;
    if (Math.abs(ball.vx) < MIN_X_BOUNCE) {
      ball.vx = ball.vx >= 0 ? MIN_X_BOUNCE : -MIN_X_BOUNCE;
    }
  }

  if (ball.y + ball.r >= H) {
    ball.y = H - ball.r;
    ball.vy *= -1;

    const MIN_X_BOUNCE = 3;
    if (Math.abs(ball.vx) < MIN_X_BOUNCE) {
      ball.vx = ball.vx >= 0 ? MIN_X_BOUNCE : -MIN_X_BOUNCE;
    }
  }

  if (
    ball.vx < 0 &&
    ball.x - ball.r <= leftPaddle.x + leftPaddle.w &&
    ball.x + ball.r >= leftPaddle.x &&
    ball.y >= leftPaddle.y &&
    ball.y <= leftPaddle.y + leftPaddle.h
  ) {
    bounceFromPaddle(ball, leftPaddle);
  }

  if (
    ball.vx > 0 &&
    ball.x + ball.r >= rightPaddle.x &&
    ball.x - ball.r <= rightPaddle.x + rightPaddle.w &&
    ball.y >= rightPaddle.y &&
    ball.y <= rightPaddle.y + rightPaddle.h
  ) {
    bounceFromPaddle(ball, rightPaddle);
  }

  if (Math.abs(ball.vx) < 0.5) ball.vx *= 1.05;
  if (Math.abs(ball.vy) < 0.5) ball.vy *= 1.05;
}

// ---------- lógica real ----------
function checkScore() {
  const real = balls.find((b) => b.isReal);

  if (real.x + real.r < 0) {
    scoreRight++;
    handlePoint();
    return;
  }

  if (real.x - real.r > W) {
    scoreLeft++;
    handlePoint();
    return;
  }

  scoreLeftEl.textContent = scoreLeft;
  scoreRightEl.textContent = scoreRight;
}

function changeRealBall() {
  if (balls.length === 0) return;

  const real = balls.find((b) => b.isReal);
  if (!real) return;

  const speed = Math.hypot(real.vx, real.vy) || BALL_BASE_SPEED;
  const SAFE_MARGIN = Math.min(W * 0.25, Math.max(W * 0.1, speed * 15));

  if (real.x < SAFE_MARGIN || real.x > W - SAFE_MARGIN) return;

  balls.forEach((b) => (b.isReal = false));

  const index = Math.floor(Math.random() * balls.length);
  balls[index].isReal = true;
}

function getRealChangeInterval() {
  const base = Math.max(1000, 5000 - difficulty * 200);
  return base + (Math.random() * 400 - 200);
}

function safeSpawn() {
  return {
    x: W * 0.5 + (Math.random() - 0.5) * W * 0.4,
    y: H * 0.5 + (Math.random() - 0.5) * H * 0.4,
  };
}

// ---------- duplicación CONTROLADA ----------
function duplicateBalls() {
  if (balls.length >= MAX_BALLS) return;

  const real = balls.find((b) => b.isReal);
  if (!real) return;

  const spaceLeft = MAX_BALLS - balls.length;
  const toCreate = Math.min(spaceLeft, Math.max(1, 2));

  for (let i = 0; i < toCreate; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.hypot(real.vx, real.vy) || BALL_BASE_SPEED;

    const spawn = safeSpawn();
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    balls.push({
      id: nextBallId++,
      isReal: false,
      x: spawn.x,
      y: spawn.y,
      r: BALL_RADIUS,
      vx: vx,
      vy: vy,
      speed: speed,
      startVx: vx,
      startVy: vy,
    });
  }
}

function cleanBalls() {
  const realBeforeFilter = balls.find((b) => b.isReal);
  if (realBeforeFilter) {
    const outOfBounds =
      realBeforeFilter.x + realBeforeFilter.r <= -200 ||
      realBeforeFilter.x - realBeforeFilter.r >= W + 200 ||
      realBeforeFilter.y + realBeforeFilter.r <= -200 ||
      realBeforeFilter.y - realBeforeFilter.r >= H + 200;
  }

  balls = balls.filter((b) => {
    return (
      b.x + b.r > -200 &&
      b.x - b.r < W + 200 &&
      b.y + b.r > -200 &&
      b.y - b.r < H + 200
    );
  });

  if (balls.length === 0) {
    resetBall();
  }
}

function getDuplicationInterval() {
  return 1200;
}

// ---------- score ----------
function handlePoint() {
  difficulty++;

  const real = balls.find((b) => b.isReal);
  if (!real) return;

  real.x = W / 2;
  real.y = H / 2;
  real.vx = real.startVx;
  real.vy = real.startVy;

  balls = [real];

  waitingServe = true;
  serveTimer = 0;
  real.vx = 0;
  real.vy = 0;
}

// ---------- loop ----------
function gameLoop() {
  if (running && !paused) {
    if (waitingServe) {
      serveTimer += 16;

      if (serveTimer >= serveDelay) {
        waitingServe = false;

        balls[0].vx = balls[0].startVx;
        balls[0].vy = balls[0].startVy;
      }
    }

    movePaddles();
    balls.forEach(updateBall);

    checkScore();
    cleanBalls();

    duplicationTimer += 16;
    realChangeTimer += 16;

    if (duplicationTimer >= getDuplicationInterval()) {
      duplicateBalls();
      duplicationTimer = 0;
    }

    if (realChangeTimer >= getRealChangeInterval()) {
      changeRealBall();
      realChangeTimer = 0;
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (!running && !gameOver) return;

  paused = !paused;

  if (paused) {
    overlay.classList.remove('hidden');
    overlayText.textContent = 'PAUSA';
    btnStart.textContent = 'CONTINUAR';
  } else {
    overlay.classList.add('hidden');
    btnStart.textContent = 'PAUSA';
  }
}

// ---------- draw ----------
function draw() {
  if (!leftPaddle || !rightPaddle) return;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = leftPaddle.color;
  ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.w, leftPaddle.h);

  ctx.fillStyle = rightPaddle.color;
  ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.w, rightPaddle.h);

  balls.forEach((b) => {
    ctx.fillStyle = b.isReal ? '#fff' : '#888';

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function initGame() {
  createPaddles();
  resetBall();

  scoreLeft = 0;
  scoreRight = 0;
  gameOver = false;
}

// ---------- start ----------
function startGame() {
  initGame();

  running = true;
  paused = false;

  overlay.classList.add('hidden');
  btnStart.textContent = 'JUEGO EN CURSO';
}

gameLoop();
