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
const WINNING_SCORE = 10;
const DUPLICATION_INTERVAL = 3000;

const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const btnStart = document.getElementById('btn-start');
const scoreLeftEl = document.getElementById('score-left');
const scoreRightEl = document.getElementById('score-right');

// ---------- Estado del juego ----------
let leftPaddle, rightPaddle;
let balls = [];
let nextBallId = 1; // para identificar pelotas
let scoreLeft = 0;
let scoreRight = 0;
let running = false; // arranca pausado
let gameOver = false;
let paused = false;
let duplicationTimer = 0;
let realBallId = null;
let changeWarning = false;

const keys = {
  w: false,
  s: false,
  ArrowUp: false,
  ArrowDown: false,
};

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
  const min = 0.25;
  const max = 0.75;
  let angle = min + Math.random() * (max - min);

  if (Math.random() < 0.5) angle = -angle;

  return angle;
}

function createBall() {
  const angle = randomAngle();
  const direction = Math.random() < 0.5 ? 1 : -1;
  return {
    x: W / 2 + (Math.random() * 30 - 15),
    y: H / 2 + (Math.random() * 30 - 15),
    r: BALL_RADIUS,
    speed: BALL_BASE_SPEED,
    vx: Math.cos(angle) * BALL_BASE_SPEED * direction,
    vy: Math.sin(angle) * BALL_BASE_SPEED,

    // para las multiples pelotas
    real: false,
    id: nextBallId++,
  };
}

function addBall() {
  balls.push(createBall());
}

function resetBall() {
  balls = [createBall()];
  realBallId = balls[0].id;
}

function initGame() {
  createPaddles();
  resetBall();
  scoreLeft = 0;
  scoreRight = 0;
  gameOver = false;
  updateScoreboard();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'W') keys.w = true;
  if (e.key === 's' || e.key === 'S') keys.s = true;
  if (e.key === 'q' || e.key === 'Q') {
    addBall();
  }
  if (e.key === 'ArrowUp') {
    keys.ArrowUp = true;
    e.preventDefault();
  }
  if (e.key === 'ArrowDown') {
    keys.ArrowDown = true;
    e.preventDefault();
  }
  if (e.key === 'Escape') togglePause();
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'w' || e.key === 'W') keys.w = false;
  if (e.key === 's' || e.key === 'S') keys.s = false;
  if (e.key === 'ArrowUp') keys.ArrowUp = false;
  if (e.key === 'ArrowDown') keys.ArrowDown = false;
});

function movePaddles() {
  if (keys.w) leftPaddle.y -= PADDLE_SPEED;
  if (keys.s) leftPaddle.y += PADDLE_SPEED;
  if (keys.ArrowUp) rightPaddle.y -= PADDLE_SPEED;
  if (keys.ArrowDown) rightPaddle.y += PADDLE_SPEED;

  leftPaddle.y = Math.max(0, Math.min(H - leftPaddle.h, leftPaddle.y));
  rightPaddle.y = Math.max(0, Math.min(H - rightPaddle.h, rightPaddle.y));
}

function getOutOfBounds(ball) {
  if (ball.x + ball.r < 0) return 'RIGHT';
  if (ball.x - ball.r > W) return 'LEFT';
  return null;
}

// ---------- Física de la pelota ----------
function updateBall(ball) {
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Colisión con techo/piso
  if (ball.y - ball.r <= 0) {
    ball.y = ball.r;
    ball.vy *= -1;
  } else if (ball.y + ball.r >= H) {
    ball.y = H - ball.r;
    ball.vy *= -1;
  }

  // Colisión con paleta izquierda
  if (
    ball.x - ball.r <= leftPaddle.x + leftPaddle.w &&
    ball.x - ball.r >= leftPaddle.x &&
    ball.y >= leftPaddle.y &&
    ball.y <= leftPaddle.y + leftPaddle.h &&
    ball.vx < 0
  ) {
    bounceFromPaddle(ball, leftPaddle);
  }

  // Colisión con paleta derecha
  if (
    ball.x + ball.r >= rightPaddle.x &&
    ball.x + ball.r <= rightPaddle.x + rightPaddle.w &&
    ball.y >= rightPaddle.y &&
    ball.y <= rightPaddle.y + rightPaddle.h &&
    ball.vx > 0
  ) {
    bounceFromPaddle(ball, rightPaddle);
  }
}

function bounceFromPaddle(ball, paddle) {
  const relativeIntersect =
    (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
  const bounceAngle = relativeIntersect * (Math.PI / 3);

  // pelota cada vez mas rapida
  ball.speed = Math.min(ball.speed + 0.4, 14);

  const direction = paddle === leftPaddle ? 1 : -1;
  ball.vx = Math.cos(bounceAngle) * ball.speed * direction;
  ball.vy = Math.sin(bounceAngle) * ball.speed;

  ball.x = direction === 1 ? paddle.x + paddle.w + ball.r : paddle.x - ball.r;
}

function duplicateBalls() {
  const currentBalls = [...balls];
  balls = [];

  currentBalls.forEach((ball) => {
    for (let i = 0; i < 2; i++) {
      balls.push({
        ...ball,
        vx: ball.vx + (Math.random() * 2 - 1),
        vy: ball.vy + (Math.random() * 2 - 1),
        real: false,
        id: nextBallId++,
      });
    }
  });

  const randomIndex = Math.floor(Math.random() * balls.length);
  realBallId = balls[randomIndex].id;
}

function duplicationWarning() {
  changeWarning = true;

  setTimeout(() => {
    duplicateBalls();
    changeWarning = false;
  }, 200);
}

function handlePoint() {
  updateScoreboard();

  if (scoreLeft >= WINNING_SCORE || scoreRight >= WINNING_SCORE) {
    endGame();
  } else {
    resetBall();
  }
}

function updateScoreboard() {
  scoreLeftEl.textContent = scoreLeft;
  scoreRightEl.textContent = scoreRight;
}

function endGame() {
  running = false;
  gameOver = true;
  const winner =
    scoreLeft >= WINNING_SCORE
      ? 'Jugador Izquierdo (azul)'
      : 'Jugador Derecho (rojo)';
  overlayText.textContent = `¡${winner} gana!`;
  btnStart.textContent = 'JUGAR DE NUEVO';
  overlay.classList.remove('hidden');
}

function startGame() {
  if (paused) {
    togglePause();
    return;
  }
  if (gameOver) {
    initGame();
  }
  running = true;
  paused = false;
  overlay.classList.add('hidden');
}

function togglePause() {
  // Solo se puede pausar si la partida está en curso (no antes de iniciar ni terminada)
  if (!running && !paused) return;
  if (gameOver) return;

  paused = !paused;

  if (paused) {
    overlayText.textContent = 'Pausa';
    btnStart.textContent = 'CONTINUAR';
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

btnStart.addEventListener('click', startGame);

// ---------- Dibujo ----------
function draw() {
  // fondo
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // linea del medio
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // paletas
  ctx.fillStyle = leftPaddle.color;
  ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.w, leftPaddle.h);

  ctx.fillStyle = rightPaddle.color;
  ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.w, rightPaddle.h);

  if (changeWarning) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, W, H);
  }

  // pelotas
  balls.forEach((ball) => {
    ctx.fillStyle =
      ball.id === realBallId
        ? '#ffffff'
        : changeWarning
          ? '#aaaaaa'
          : '#666666';

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function gameLoop() {
  if (running && !paused) {
    movePaddles();

    balls.forEach((ball) => updateBall(ball));

    const realBall = balls.find((b) => b.id === realBallId);

    if (realBall) {
      const out = getOutOfBounds(realBall);

      if (out === 'LEFT') {
        scoreLeft++;
        handlePoint();
      }

      if (out === 'RIGHT') {
        scoreRight++;
        handlePoint();
      }
    }

    duplicationTimer += 16.6;

    if (duplicationTimer >= DUPLICATION_INTERVAL) {
      duplicateBalls();
      duplicationTimer = 0;
    }

    if (duplicationTimer >= DUPLICATION_INTERVAL - 500 && !changeWarning) {
      duplicationWarning();
      duplicationTimer = 0;
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

initGame();
draw();
gameLoop();
