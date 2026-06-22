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

const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const btnStart = document.getElementById('btn-start');
const scoreLeftEl = document.getElementById('score-left');
const scoreRightEl = document.getElementById('score-right');

// ---------- Estado del juego ----------
let leftPaddle, rightPaddle, ball;
let scoreLeft = 0;
let scoreRight = 0;
let running = false; // arranca pausado
let gameOver = false;
let paused = false;

const keys = {
  w: false,
  s: false,
  ArrowUp: false,
  ArrowDown: false,
};

// ---------- Inicialización de entidades ----------
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
  // Ángulo aleatorio evitando que salga demasiado plano (cerca de 0°)
  // o demasiado vertical (cerca de 90°), para que el juego sea jugable.
  const min = 0.25; // ~14°
  const max = 0.75; // ~43°
  let angle = min + Math.random() * (max - min);

  // Signo aleatorio para arriba/abajo
  if (Math.random() < 0.5) angle = -angle;

  return angle;
}

function resetBall() {
  const angle = randomAngle();
  const direction = Math.random() < 0.5 ? 1 : -1; // hacia izquierda o derecha

  ball = {
    x: W / 2,
    y: H / 2,
    r: BALL_RADIUS,
    speed: BALL_BASE_SPEED,
    vx: Math.cos(angle) * BALL_BASE_SPEED * direction,
    vy: Math.sin(angle) * BALL_BASE_SPEED,
  };
}

function initGame() {
  createPaddles();
  resetBall();
  scoreLeft = 0;
  scoreRight = 0;
  gameOver = false;
  updateScoreboard();
}

// ---------- Controles ----------
window.addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'W') keys.w = true;
  if (e.key === 's' || e.key === 'S') keys.s = true;
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

  // Limitar paletas dentro del canvas
  leftPaddle.y = Math.max(0, Math.min(H - leftPaddle.h, leftPaddle.y));
  rightPaddle.y = Math.max(0, Math.min(H - rightPaddle.h, rightPaddle.y));
}

// ---------- Física de la pelota ----------
function updateBall() {
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
    bounceFromPaddle(leftPaddle);
  }

  // Colisión con paleta derecha
  if (
    ball.x + ball.r >= rightPaddle.x &&
    ball.x + ball.r <= rightPaddle.x + rightPaddle.w &&
    ball.y >= rightPaddle.y &&
    ball.y <= rightPaddle.y + rightPaddle.h &&
    ball.vx > 0
  ) {
    bounceFromPaddle(rightPaddle);
  }

  // Punto para la derecha (la pelota salió por la izquierda)
  if (ball.x + ball.r < 0) {
    scoreRight++;
    handlePoint();
  }

  // Punto para la izquierda (la pelota salió por la derecha)
  if (ball.x - ball.r > W) {
    scoreLeft++;
    handlePoint();
  }
}

function bounceFromPaddle(paddle) {
  // Calcula en qué punto de la paleta golpeó (entre -1 y 1)
  const relativeIntersect =
    (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
  const bounceAngle = relativeIntersect * (Math.PI / 3); // máx ~60°

  // Aumenta levemente la velocidad en cada rebote
  ball.speed = Math.min(ball.speed + 0.4, 14);

  const direction = paddle === leftPaddle ? 1 : -1;
  ball.vx = Math.cos(bounceAngle) * ball.speed * direction;
  ball.vy = Math.sin(bounceAngle) * ball.speed;

  // Evita que la pelota quede "pegada" a la paleta
  ball.x = direction === 1 ? paddle.x + paddle.w + ball.r : paddle.x - ball.r;
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

// ---------- Estados del juego ----------
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
  // Fondo
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Línea central punteada
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Paletas
  ctx.fillStyle = leftPaddle.color;
  ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.w, leftPaddle.h);

  ctx.fillStyle = rightPaddle.color;
  ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.w, rightPaddle.h);

  // Pelota
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- Loop principal ----------
function gameLoop() {
  if (running && !paused) {
    movePaddles();
    updateBall();
  }
  draw();
  requestAnimationFrame(gameLoop);
}

// ---------- Arranque ----------
initGame();
draw();
gameLoop();
