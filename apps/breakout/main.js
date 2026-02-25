'use strict';

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nctx = nextCanvas.getContext('2d');

const COLS = 10, ROWS = 20, CELL = 30;

// Tetromino shapes (0=empty, 1=filled)
const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};
const COLORS = {
  I: '#00e5ff', O: '#ffea00', T: '#d500f9',
  S: '#00e676', Z: '#ff1744', J: '#2979ff', L: '#ff6d00',
};
const TYPES = Object.keys(SHAPES);
const LINE_SCORES = [0, 100, 300, 500, 800];

// DAS settings
const DAS = 150, ARR = 40;

let board, piece, bag, nextType, score, lines, level;
let state, keys, dropTimer, dropInterval, lastTime;
let dasL, dasR, dasD;

// 7-bag randomizer
function nextFromBag() {
  if (bag.length === 0) {
    bag = [...TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function spawnPiece(type) {
  const matrix = SHAPES[type].map(r => [...r]);
  return {
    type, matrix,
    row: type === 'I' ? -1 : 0,
    col: Math.floor((COLS - matrix[0].length) / 2),
  };
}

function getCells(p) {
  const cells = [];
  for (let r = 0; r < p.matrix.length; r++)
    for (let c = 0; c < p.matrix[r].length; c++)
      if (p.matrix[r][c]) cells.push([p.row + r, p.col + c]);
  return cells;
}

function isValid(p) {
  for (const [r, c] of getCells(p)) {
    if (c < 0 || c >= COLS || r >= ROWS) return false;
    if (r >= 0 && board[r][c]) return false;
  }
  return true;
}

function rotateCW(mat) {
  const n = mat.length, m = mat[0].length;
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) => mat[n - 1 - j][i])
  );
}

function tryMove(dr, dc) {
  const np = { ...piece, row: piece.row + dr, col: piece.col + dc };
  if (isValid(np)) { piece = np; return true; }
  return false;
}

function tryRotate() {
  const rot = rotateCW(piece.matrix);
  for (const k of [0, -1, 1, -2, 2]) {
    const np = { ...piece, matrix: rot, col: piece.col + k };
    if (isValid(np)) { piece = np; return; }
  }
}

function getGhost() {
  let g = { ...piece };
  while (isValid({ ...g, row: g.row + 1 })) g = { ...g, row: g.row + 1 };
  return g;
}

function lockPiece() {
  for (const [r, c] of getCells(piece))
    if (r >= 0) board[r][c] = COLORS[piece.type];
  clearLines();
  piece = spawnPiece(nextType);
  nextType = nextFromBag();
  drawNext();
  dropTimer = 0;
  if (!isValid(piece)) { state = 'gameover'; setMessage('ゲームオーバー — スペースでリスタート'); }
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++; r++;
    }
  }
  if (cleared > 0) {
    score += LINE_SCORES[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(80, 1000 - (level - 1) * 90);
    updateUI();
  }
}

function softDrop() {
  if (!tryMove(1, 0)) lockPiece();
  else { score++; updateUI(); dropTimer = 0; }
}

function hardDrop() {
  let n = 0;
  while (tryMove(1, 0)) n++;
  score += n * 2;
  updateUI();
  lockPiece();
}

function reset() {
  board = createBoard(); bag = [];
  score = 0; lines = 0; level = 1;
  dropInterval = 1000; dropTimer = 0; lastTime = 0;
  state = 'idle'; keys = {};
  dasL = 0; dasR = 0; dasD = 0;
  piece = spawnPiece(nextFromBag());
  nextType = nextFromBag();
  updateUI(); drawNext();
}

function updateUI() {
  document.getElementById('score').textContent = score;
  document.getElementById('lines').textContent = lines;
  document.getElementById('level').textContent = level;
}
function setMessage(msg) { document.getElementById('message').textContent = msg; }

// --- Input ---
document.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space','KeyZ','KeyP'].includes(e.code))
    e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;

  if (e.code === 'Space') {
    if (state === 'idle' || state === 'paused') { state = 'playing'; setMessage(''); }
    else if (state === 'playing') hardDrop();
    else if (state === 'gameover') { reset(); state = 'playing'; setMessage(''); }
    return;
  }
  if (e.code === 'KeyP') {
    if (state === 'playing') { state = 'paused'; setMessage('ポーズ — Pで再開'); }
    else if (state === 'paused') { state = 'playing'; setMessage(''); }
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'ArrowLeft')  { tryMove(0, -1); dasL = DAS; }
  if (e.code === 'ArrowRight') { tryMove(0,  1); dasR = DAS; }
  if (e.code === 'ArrowDown')  { softDrop();     dasD = DAS; }
  if (e.code === 'ArrowUp' || e.code === 'KeyZ') tryRotate();
});

document.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'ArrowLeft')  dasL = 0;
  if (e.code === 'ArrowRight') dasR = 0;
  if (e.code === 'ArrowDown')  dasD = 0;
});

// --- Draw ---
function drawCell(cx, r, c, color) {
  if (r < 0) return;
  const x = c * CELL, y = r * CELL;
  cx.fillStyle = color;
  cx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
  cx.fillStyle = 'rgba(255,255,255,0.22)';
  cx.fillRect(x + 1, y + 1, CELL - 2, 6);
  cx.fillStyle = 'rgba(255,255,255,0.08)';
  cx.fillRect(x + 1, y + 1, 6, CELL - 2);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(canvas.width, r * CELL); ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, canvas.height); ctx.stroke();
  }

  // Board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) drawCell(ctx, r, c, board[r][c]);

  if (state !== 'gameover') {
    // Ghost
    const ghost = getGhost();
    ctx.globalAlpha = 0.18;
    for (const [r, c] of getCells(ghost)) {
      if (r >= 0) { ctx.fillStyle = COLORS[piece.type]; ctx.fillRect(c*CELL+1, r*CELL+1, CELL-2, CELL-2); }
    }
    ctx.globalAlpha = 1;
    // Piece
    for (const [r, c] of getCells(piece)) drawCell(ctx, r, c, COLORS[piece.type]);
  }

  // Dim overlay when not playing
  if (state !== 'playing') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawNext() {
  nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextType) return;
  const NCELL = 20;
  const mat = SHAPES[nextType];
  const rows = mat.length, cols = mat[0].length;
  const sx = Math.floor((nextCanvas.width  - cols * NCELL) / 2);
  const sy = Math.floor((nextCanvas.height - rows * NCELL) / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mat[r][c]) continue;
      const x = sx + c * NCELL, y = sy + r * NCELL;
      nctx.fillStyle = COLORS[nextType];
      nctx.fillRect(x + 1, y + 1, NCELL - 2, NCELL - 2);
      nctx.fillStyle = 'rgba(255,255,255,0.22)';
      nctx.fillRect(x + 1, y + 1, NCELL - 2, 6);
    }
  }
}

// --- Game Loop ---
function gameLoop(ts) {
  const dt = lastTime ? Math.min(ts - lastTime, 100) : 0;
  lastTime = ts;

  if (state === 'playing') {
    if (dasL > 0) { dasL -= dt; if (dasL <= 0) { tryMove(0, -1); dasL = ARR; } }
    if (dasR > 0) { dasR -= dt; if (dasR <= 0) { tryMove(0,  1); dasR = ARR; } }
    if (dasD > 0) { dasD -= dt; if (dasD <= 0) { softDrop();     dasD = ARR; } }

    dropTimer += dt;
    if (dropTimer >= dropInterval) {
      dropTimer = 0;
      if (!tryMove(1, 0)) lockPiece();
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

reset();
setMessage('スペースキーでスタート');
requestAnimationFrame(gameLoop);
