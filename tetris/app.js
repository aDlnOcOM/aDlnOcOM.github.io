/**
 * TETRIS // DUO — лёгкая браузерная сборка.
 * Все клиентские модули объединены в один ES-модуль без этапа сборки.
 */

/* ===== config.js ===== */
/**
 * Firebase Web configuration is not a secret. Replace these values only if you
 * deploy the application to another Firebase project.
 */
const APP_CONFIG = Object.freeze({
  firebase: {
    apiKey: "AIzaSyCJu7xKBuR_bVal7P2CFGmy5DeVvR2VQGs",
    authDomain: "githubleaderboard-adlnocom.firebaseapp.com",
    databaseURL: "https://githubleaderboard-adlnocom-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "githubleaderboard-adlnocom",
    storageBucket: "githubleaderboard-adlnocom.firebasestorage.app",
    messagingSenderId: "547100842018",
    appId: "1:547100842018:web:ae8d07584a81cb9f22d27b",
    measurementId: "G-10793GQHSE",
  },
  firebaseSdkVersion: "10.12.5",
  firebaseLoadTimeoutMs: 12000,
  appCheckSiteKey: "",
  forceOffline: ["1", "true"].includes(new URLSearchParams(location.search).get("offline"))
    || new URLSearchParams(location.search).get("demo") === "1",
  useEmulators: new URLSearchParams(location.search).get("emulator") === "1",
  autoStartSolo: new URLSearchParams(location.search).get("autostart") === "solo",
  emulatorHost: "127.0.0.1",
});

/* ===== ui/format.js ===== */
function formatScore(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function sanitizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-zА-Яа-яЁё0-9 _-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 12);
}

function normalizeInviteCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, 6);
}

function escapeText(value) {
  return String(value ?? "");
}

/* ===== core/tetris-core.mjs ===== */
/**
 * Deterministic Tetris core used by the browser and local replay validation.
 * No DOM, timers, Firebase, or random global state are used here.
 */

const GAME_VERSION = "3.0.0";

const ACTIONS = Object.freeze({
  LEFT: "left",
  RIGHT: "right",
  ROTATE: "rotate",
  SOFT_DROP: "softDrop",
  HARD_DROP: "hardDrop",
});

const SIDES = Object.freeze({
  LEFT: "left",
  RIGHT: "right",
});

const PIECE_IDS = Object.freeze({
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
});

const PIECE_TYPES = Object.freeze(Object.keys(PIECE_IDS));

const BASE_SHAPES = Object.freeze({
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
});

const LINE_POINTS = Object.freeze([0, 100, 300, 500, 800]);
const VALID_ACTIONS = new Set(Object.values(ACTIONS));
const VALID_SIDES = new Set(Object.values(SIDES));

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function rotateClockwise(matrix) {
  return matrix[0].map((_, x) => matrix.map((row) => row[x]).reverse());
}

function matrixKey(matrix) {
  return matrix.map((row) => row.join("")).join("/");
}

function buildRotations(base) {
  const rotations = [];
  const seen = new Set();
  let current = cloneMatrix(base);

  for (let i = 0; i < 4; i += 1) {
    const key = matrixKey(current);
    if (!seen.has(key)) {
      rotations.push(current);
      seen.add(key);
    }
    current = rotateClockwise(current);
  }

  return rotations;
}

const ROTATIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(BASE_SHAPES).map(([type, shape]) => [type, buildRotations(shape)]),
  ),
);

function getPieceMatrix(type, rotation = 0) {
  const rotations = ROTATIONS[type];
  if (!rotations) {
    throw new TypeError(`Unknown piece type: ${String(type)}`);
  }
  const normalized = ((rotation % rotations.length) + rotations.length) % rotations.length;
  return cloneMatrix(rotations[normalized]);
}

function hashStringToSeed(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 0x9e3779b9;
}

function normalizeSeed(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return (Math.trunc(seed) >>> 0) || 0x9e3779b9;
  }
  return hashStringToSeed(seed);
}

class SeededRandom {
  constructor(seed) {
    this.state = normalizeSeed(seed);
  }

  nextUint32() {
    let x = this.state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  nextFloat() {
    return this.nextUint32() / 0x100000000;
  }

  shuffle(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.nextFloat() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

class SevenBag {
  constructor(seed) {
    this.random = new SeededRandom(seed);
    this.queue = [];
  }

  next() {
    if (this.queue.length === 0) {
      this.queue.push(...this.random.shuffle(PIECE_TYPES));
    }
    return this.queue.shift();
  }

  peek(count = 1) {
    while (this.queue.length < count) {
      this.queue.push(...this.random.shuffle(PIECE_TYPES));
    }
    return this.queue.slice(0, count);
  }
}

function emptyBoard(rows, columns) {
  return Array.from({ length: rows }, () => Array(columns).fill(0));
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function topOccupiedRow(board) {
  const index = board.findIndex((row) => row.some(Boolean));
  return index === -1 ? board.length : index;
}

function validateDimensions(columns, rows) {
  if (!Number.isInteger(columns) || columns < 4 || columns > 40) {
    throw new RangeError("columns must be an integer between 4 and 40");
  }
  if (!Number.isInteger(rows) || rows < 8 || rows > 80) {
    throw new RangeError("rows must be an integer between 8 and 80");
  }
}

function safeElapsed(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function makeListenerMap() {
  return {
    change: new Set(),
    lock: new Set(),
    lines: new Set(),
    gameOver: new Set(),
  };
}

function emit(listeners, event, payload) {
  for (const listener of listeners[event] ?? []) {
    try {
      listener(payload);
    } catch (error) {
      // A UI callback must never corrupt deterministic simulation.
      queueMicrotask(() => {
        throw error;
      });
    }
  }
}

class TetrisEngine {
  constructor({ columns = 10, rows = 20, seed = 1, maxInputs = 12000 } = {}) {
    validateDimensions(columns, rows);
    this.columns = columns;
    this.rows = rows;
    this.seed = normalizeSeed(seed);
    this.maxInputs = maxInputs;
    this.listeners = makeListenerMap();
    this.reset();
  }

  reset() {
    this.board = emptyBoard(this.rows, this.columns);
    this.bag = new SevenBag(this.seed);
    this.current = null;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.piecesLocked = 0;
    this.gameOver = false;
    this.elapsedMs = 0;
    this.nextGravityAt = this.dropIntervalMs;
    this.inputLog = [];
    this.inputSequence = 0;
    this.spawnNextPiece();
    emit(this.listeners, "change", this.getSnapshot());
  }

  get dropIntervalMs() {
    return Math.max(80, 1000 - (this.level - 1) * 90);
  }

  on(event, listener) {
    if (!this.listeners[event]) {
      throw new TypeError(`Unknown engine event: ${event}`);
    }
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  spawnNextPiece() {
    const type = this.bag.next();
    const matrix = getPieceMatrix(type, 0);
    this.current = {
      type,
      id: PIECE_IDS[type],
      rotation: 0,
      matrix,
      x: Math.floor((this.columns - matrix[0].length) / 2),
      y: 0,
    };

    if (this.collides(this.current)) {
      this.gameOver = true;
      emit(this.listeners, "gameOver", this.getSnapshot());
    }
  }

  collides(piece = this.current, matrix = piece?.matrix, x = piece?.x, y = piece?.y) {
    if (!piece || !matrix) return true;

    for (let row = 0; row < matrix.length; row += 1) {
      for (let column = 0; column < matrix[row].length; column += 1) {
        if (!matrix[row][column]) continue;
        const boardX = x + column;
        const boardY = y + row;
        if (boardX < 0 || boardX >= this.columns || boardY >= this.rows) return true;
        if (boardY >= 0 && this.board[boardY][boardX]) return true;
      }
    }
    return false;
  }

  move(deltaX) {
    if (this.gameOver || !this.current) return false;
    const targetX = this.current.x + deltaX;
    if (this.collides(this.current, this.current.matrix, targetX, this.current.y)) return false;
    this.current.x = targetX;
    return true;
  }

  rotate() {
    if (this.gameOver || !this.current) return false;
    const rotations = ROTATIONS[this.current.type];
    const nextRotation = (this.current.rotation + 1) % rotations.length;
    const matrix = getPieceMatrix(this.current.type, nextRotation);
    const kicks = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [-2, 0],
      [2, 0],
      [0, -1],
    ];

    for (const [kickX, kickY] of kicks) {
      const x = this.current.x + kickX;
      const y = this.current.y + kickY;
      if (!this.collides(this.current, matrix, x, y)) {
        this.current.rotation = nextRotation;
        this.current.matrix = matrix;
        this.current.x = x;
        this.current.y = y;
        return true;
      }
    }
    return false;
  }

  stepDown() {
    if (this.gameOver || !this.current) return false;
    if (!this.collides(this.current, this.current.matrix, this.current.x, this.current.y + 1)) {
      this.current.y += 1;
      return true;
    }
    this.lockCurrentPiece();
    return false;
  }

  hardDrop() {
    if (this.gameOver || !this.current) return false;
    while (!this.collides(this.current, this.current.matrix, this.current.x, this.current.y + 1)) {
      this.current.y += 1;
    }
    this.lockCurrentPiece();
    return true;
  }

  lockCurrentPiece() {
    if (!this.current || this.gameOver) return;
    let lockedAboveBoard = false;

    for (let row = 0; row < this.current.matrix.length; row += 1) {
      for (let column = 0; column < this.current.matrix[row].length; column += 1) {
        if (!this.current.matrix[row][column]) continue;
        const boardX = this.current.x + column;
        const boardY = this.current.y + row;
        if (boardY < 0) {
          lockedAboveBoard = true;
        } else {
          this.board[boardY][boardX] = this.current.id;
        }
      }
    }

    this.piecesLocked += 1;
    const lockedPiece = { ...this.current, matrix: cloneMatrix(this.current.matrix) };

    if (lockedAboveBoard) {
      this.gameOver = true;
      emit(this.listeners, "lock", { piece: lockedPiece, snapshot: this.getSnapshot() });
      emit(this.listeners, "gameOver", this.getSnapshot());
      return;
    }

    const cleared = this.clearCompletedLines();
    emit(this.listeners, "lock", { piece: lockedPiece, cleared, snapshot: this.getSnapshot() });

    if (!this.gameOver) {
      this.spawnNextPiece();
    }
  }

  clearCompletedLines() {
    const remaining = this.board.filter((row) => !row.every(Boolean));
    const cleared = this.rows - remaining.length;
    if (cleared === 0) return 0;

    while (remaining.length < this.rows) {
      remaining.unshift(Array(this.columns).fill(0));
    }
    this.board = remaining;
    this.score += (LINE_POINTS[Math.min(cleared, 4)] ?? 0) * this.level;
    this.lines += cleared;
    this.level = Math.floor(this.lines / 10) + 1;
    emit(this.listeners, "lines", { cleared, snapshot: this.getSnapshot() });
    return cleared;
  }

  advanceTo(targetElapsedMs) {
    const target = Math.max(this.elapsedMs, safeElapsed(targetElapsedMs));
    let guard = 0;

    while (!this.gameOver && this.nextGravityAt <= target) {
      this.elapsedMs = this.nextGravityAt;
      this.stepDown();
      this.nextGravityAt = this.elapsedMs + this.dropIntervalMs;
      guard += 1;
      if (guard > 200000) {
        throw new Error("Simulation catch-up limit exceeded");
      }
    }

    this.elapsedMs = target;
    return this.getSnapshot();
  }

  applyAction(action, atMs = this.elapsedMs, { record = true } = {}) {
    if (!VALID_ACTIONS.has(action)) {
      throw new TypeError(`Unknown action: ${String(action)}`);
    }

    const time = Math.max(this.elapsedMs, safeElapsed(atMs));
    this.advanceTo(time);
    if (this.gameOver) return false;

    if (record) {
      if (this.inputLog.length >= this.maxInputs) {
        throw new RangeError("Input log limit exceeded");
      }
      this.inputSequence += 1;
      this.inputLog.push({ seq: this.inputSequence, action, atMs: time });
    }

    let changed = false;
    switch (action) {
      case ACTIONS.LEFT:
        changed = this.move(-1);
        break;
      case ACTIONS.RIGHT:
        changed = this.move(1);
        break;
      case ACTIONS.ROTATE:
        changed = this.rotate();
        break;
      case ACTIONS.SOFT_DROP:
        changed = this.stepDown();
        break;
      case ACTIONS.HARD_DROP:
        changed = this.hardDrop();
        break;
      default:
        break;
    }

    emit(this.listeners, "change", this.getSnapshot());
    return changed;
  }

  getGhostY() {
    if (!this.current) return 0;
    let y = this.current.y;
    while (!this.collides(this.current, this.current.matrix, this.current.x, y + 1)) {
      y += 1;
    }
    return y;
  }

  getSnapshot() {
    return {
      version: GAME_VERSION,
      mode: "solo",
      columns: this.columns,
      rows: this.rows,
      seed: this.seed,
      board: cloneBoard(this.board),
      settled: serializeBoard(this.board),
      current: this.current
        ? {
            type: this.current.type,
            id: this.current.id,
            rotation: this.current.rotation,
            matrix: cloneMatrix(this.current.matrix),
            x: this.current.x,
            y: this.current.y,
          }
        : null,
      nextType: this.bag.peek(1)[0],
      score: this.score,
      lines: this.lines,
      level: this.level,
      piecesLocked: this.piecesLocked,
      gameOver: this.gameOver,
      elapsedMs: this.elapsedMs,
      topRow: topOccupiedRow(this.board),
    };
  }

  exportInputLog() {
    return this.inputLog.map((entry) => ({ ...entry }));
  }
}

function sideLane(side, laneWidth) {
  if (side === SIDES.LEFT) return { minX: 0, maxX: laneWidth - 1 };
  return { minX: laneWidth, maxX: laneWidth * 2 - 1 };
}

function sideSeed(seed, side) {
  return normalizeSeed(seed ^ (side === SIDES.LEFT ? 0x6d2b79f5 : 0x1b873593));
}

class CoopEngine {
  constructor({ rows = 20, laneWidth = 10, seed = 1, maxInputs = 24000 } = {}) {
    if (!Number.isInteger(laneWidth) || laneWidth < 4 || laneWidth > 20) {
      throw new RangeError("laneWidth must be an integer between 4 and 20");
    }
    validateDimensions(laneWidth * 2, rows);
    this.rows = rows;
    this.laneWidth = laneWidth;
    this.columns = laneWidth * 2;
    this.seed = normalizeSeed(seed);
    this.maxInputs = maxInputs;
    this.listeners = makeListenerMap();
    this.reset();
  }

  reset() {
    this.board = emptyBoard(this.rows, this.columns);
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.round = 0;
    this.gameOver = false;
    this.elapsedMs = 0;
    this.nextGravityAt = this.dropIntervalMs;
    this.inputLog = [];
    this.inputSequence = 0;
    this.players = {
      [SIDES.LEFT]: {
        bag: new SevenBag(sideSeed(this.seed, SIDES.LEFT)),
        current: null,
        locked: false,
        piecesLocked: 0,
      },
      [SIDES.RIGHT]: {
        bag: new SevenBag(sideSeed(this.seed, SIDES.RIGHT)),
        current: null,
        locked: false,
        piecesLocked: 0,
      },
    };
    this.spawnPair();
    emit(this.listeners, "change", this.getSnapshot());
  }

  get dropIntervalMs() {
    return Math.max(100, 1000 - (this.level - 1) * 85);
  }

  on(event, listener) {
    if (!this.listeners[event]) {
      throw new TypeError(`Unknown engine event: ${event}`);
    }
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  spawnSide(side) {
    const player = this.players[side];
    const type = player.bag.next();
    const matrix = getPieceMatrix(type, 0);
    const lane = sideLane(side, this.laneWidth);
    const laneStart = lane.minX;
    player.current = {
      type,
      id: PIECE_IDS[type],
      rotation: 0,
      matrix,
      x: laneStart + Math.floor((this.laneWidth - matrix[0].length) / 2),
      y: 0,
    };
    player.locked = false;
  }

  spawnPair() {
    this.round += 1;
    this.spawnSide(SIDES.LEFT);
    this.spawnSide(SIDES.RIGHT);

    if (this.collides(SIDES.LEFT) || this.collides(SIDES.RIGHT)) {
      this.gameOver = true;
      emit(this.listeners, "gameOver", this.getSnapshot());
    }
  }

  collides(side, piece = this.players[side]?.current, matrix = piece?.matrix, x = piece?.x, y = piece?.y) {
    if (!VALID_SIDES.has(side) || !piece || !matrix) return true;
    const lane = sideLane(side, this.laneWidth);

    for (let row = 0; row < matrix.length; row += 1) {
      for (let column = 0; column < matrix[row].length; column += 1) {
        if (!matrix[row][column]) continue;
        const boardX = x + column;
        const boardY = y + row;
        if (boardX < lane.minX || boardX > lane.maxX || boardY >= this.rows) return true;
        if (boardY >= 0 && this.board[boardY][boardX]) return true;
      }
    }
    return false;
  }

  move(side, deltaX) {
    const player = this.players[side];
    if (this.gameOver || player.locked || !player.current) return false;
    const targetX = player.current.x + deltaX;
    if (this.collides(side, player.current, player.current.matrix, targetX, player.current.y)) return false;
    player.current.x = targetX;
    return true;
  }

  rotate(side) {
    const player = this.players[side];
    if (this.gameOver || player.locked || !player.current) return false;
    const rotations = ROTATIONS[player.current.type];
    const nextRotation = (player.current.rotation + 1) % rotations.length;
    const matrix = getPieceMatrix(player.current.type, nextRotation);
    const kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];

    for (const [kickX, kickY] of kicks) {
      const x = player.current.x + kickX;
      const y = player.current.y + kickY;
      if (!this.collides(side, player.current, matrix, x, y)) {
        player.current.rotation = nextRotation;
        player.current.matrix = matrix;
        player.current.x = x;
        player.current.y = y;
        return true;
      }
    }
    return false;
  }

  stepDown(side) {
    const player = this.players[side];
    if (this.gameOver || player.locked || !player.current) return false;
    if (!this.collides(side, player.current, player.current.matrix, player.current.x, player.current.y + 1)) {
      player.current.y += 1;
      return true;
    }
    this.lockSide(side);
    return false;
  }

  hardDrop(side) {
    const player = this.players[side];
    if (this.gameOver || player.locked || !player.current) return false;
    while (!this.collides(side, player.current, player.current.matrix, player.current.x, player.current.y + 1)) {
      player.current.y += 1;
    }
    this.lockSide(side);
    return true;
  }

  lockSide(side) {
    const player = this.players[side];
    if (!player.current || player.locked || this.gameOver) return;
    let lockedAboveBoard = false;

    for (let row = 0; row < player.current.matrix.length; row += 1) {
      for (let column = 0; column < player.current.matrix[row].length; column += 1) {
        if (!player.current.matrix[row][column]) continue;
        const boardX = player.current.x + column;
        const boardY = player.current.y + row;
        if (boardY < 0) {
          lockedAboveBoard = true;
        } else {
          this.board[boardY][boardX] = player.current.id;
        }
      }
    }

    player.locked = true;
    player.piecesLocked += 1;
    emit(this.listeners, "lock", { side, snapshot: this.getSnapshot() });

    if (lockedAboveBoard) {
      this.gameOver = true;
      emit(this.listeners, "gameOver", this.getSnapshot());
      return;
    }

    if (this.players[SIDES.LEFT].locked && this.players[SIDES.RIGHT].locked) {
      this.resolveRound();
    }
  }

  resolveRound() {
    const remaining = this.board.filter((row) => !row.every(Boolean));
    const cleared = this.rows - remaining.length;

    if (cleared > 0) {
      while (remaining.length < this.rows) {
        remaining.unshift(Array(this.columns).fill(0));
      }
      this.board = remaining;
      this.score += (LINE_POINTS[Math.min(cleared, 4)] ?? 0) * this.level;
      this.lines += cleared;
      this.level = Math.floor(this.lines / 10) + 1;
      emit(this.listeners, "lines", { cleared, snapshot: this.getSnapshot() });
    }

    if (!this.gameOver) {
      this.spawnPair();
    }
  }

  advanceTo(targetElapsedMs) {
    const target = Math.max(this.elapsedMs, safeElapsed(targetElapsedMs));
    let guard = 0;

    while (!this.gameOver && this.nextGravityAt <= target) {
      this.elapsedMs = this.nextGravityAt;
      this.stepDown(SIDES.LEFT);
      if (!this.gameOver) this.stepDown(SIDES.RIGHT);
      this.nextGravityAt = this.elapsedMs + this.dropIntervalMs;
      guard += 1;
      if (guard > 200000) {
        throw new Error("Cooperative simulation catch-up limit exceeded");
      }
    }

    this.elapsedMs = target;
    return this.getSnapshot();
  }

  applyAction(side, action, atMs = this.elapsedMs, { record = true } = {}) {
    if (!VALID_SIDES.has(side)) {
      throw new TypeError(`Unknown side: ${String(side)}`);
    }
    if (!VALID_ACTIONS.has(action)) {
      throw new TypeError(`Unknown action: ${String(action)}`);
    }

    const time = Math.max(this.elapsedMs, safeElapsed(atMs));
    this.advanceTo(time);
    if (this.gameOver) return false;

    if (record) {
      if (this.inputLog.length >= this.maxInputs) {
        throw new RangeError("Input log limit exceeded");
      }
      this.inputSequence += 1;
      this.inputLog.push({ seq: this.inputSequence, side, action, atMs: time });
    }

    let changed = false;
    switch (action) {
      case ACTIONS.LEFT:
        changed = this.move(side, -1);
        break;
      case ACTIONS.RIGHT:
        changed = this.move(side, 1);
        break;
      case ACTIONS.ROTATE:
        changed = this.rotate(side);
        break;
      case ACTIONS.SOFT_DROP:
        changed = this.stepDown(side);
        break;
      case ACTIONS.HARD_DROP:
        changed = this.hardDrop(side);
        break;
      default:
        break;
    }

    emit(this.listeners, "change", this.getSnapshot());
    return changed;
  }

  getGhostY(side) {
    const player = this.players[side];
    if (!player.current || player.locked) return player.current?.y ?? 0;
    let y = player.current.y;
    while (!this.collides(side, player.current, player.current.matrix, player.current.x, y + 1)) {
      y += 1;
    }
    return y;
  }

  getSnapshot() {
    const players = {};
    for (const side of [SIDES.LEFT, SIDES.RIGHT]) {
      const player = this.players[side];
      players[side] = {
        locked: player.locked,
        piecesLocked: player.piecesLocked,
        nextType: player.bag.peek(1)[0],
        current: player.current
          ? {
              type: player.current.type,
              id: player.current.id,
              rotation: player.current.rotation,
              matrix: cloneMatrix(player.current.matrix),
              x: player.current.x,
              y: player.current.y,
            }
          : null,
      };
    }

    return {
      version: GAME_VERSION,
      mode: "coop",
      columns: this.columns,
      rows: this.rows,
      laneWidth: this.laneWidth,
      seed: this.seed,
      board: cloneBoard(this.board),
      settled: serializeBoard(this.board),
      players,
      score: this.score,
      lines: this.lines,
      level: this.level,
      round: this.round,
      gameOver: this.gameOver,
      elapsedMs: this.elapsedMs,
      topRow: topOccupiedRow(this.board),
    };
  }

  exportInputLog() {
    return this.inputLog.map((entry) => ({ ...entry }));
  }
}

function serializeBoard(board) {
  if (!Array.isArray(board)) throw new TypeError("board must be an array");
  return board.flat().map((cell) => {
    const value = Number(cell);
    return Number.isInteger(value) && value >= 0 && value <= 7 ? String(value) : "0";
  }).join("");
}

function deserializeBoard(serialized, columns, rows) {
  if (typeof serialized !== "string" || serialized.length !== columns * rows) {
    throw new TypeError("Invalid serialized board length");
  }
  const values = [...serialized].map((character) => {
    const value = Number(character);
    if (!Number.isInteger(value) || value < 0 || value > 7) {
      throw new TypeError("Invalid serialized board cell");
    }
    return value;
  });

  return Array.from({ length: rows }, (_, row) =>
    values.slice(row * columns, (row + 1) * columns),
  );
}

function normalizeSoloInputLog(inputLog, { maxEntries = 12000, maxDurationMs = 86400000 } = {}) {
  if (!Array.isArray(inputLog) || inputLog.length > maxEntries) {
    throw new TypeError("Invalid solo input log");
  }

  let previousTime = 0;
  return inputLog.map((entry, index) => {
    const action = entry?.action;
    const atMs = safeElapsed(entry?.atMs);
    if (!VALID_ACTIONS.has(action)) throw new TypeError(`Invalid action at input ${index}`);
    if (atMs < previousTime || atMs > maxDurationMs) {
      throw new RangeError(`Invalid timestamp at input ${index}`);
    }
    previousTime = atMs;
    return { seq: index + 1, action, atMs };
  });
}

function normalizeCoopInputLog(inputLog, { maxEntries = 24000, maxDurationMs = 86400000 } = {}) {
  if (!Array.isArray(inputLog) || inputLog.length > maxEntries) {
    throw new TypeError("Invalid cooperative input log");
  }

  return inputLog
    .map((entry, index) => {
      const side = entry?.side;
      const action = entry?.action;
      const atMs = safeElapsed(entry?.atMs);
      if (!VALID_SIDES.has(side)) throw new TypeError(`Invalid side at input ${index}`);
      if (!VALID_ACTIONS.has(action)) throw new TypeError(`Invalid action at input ${index}`);
      if (atMs > maxDurationMs) throw new RangeError(`Invalid timestamp at input ${index}`);
      return { seq: Number.isInteger(entry?.seq) ? entry.seq : index + 1, side, action, atMs };
    })
    .sort((a, b) => a.atMs - b.atMs || a.seq - b.seq);
}

function replaySolo({ seed, inputLog, durationMs, requireGameOver = false } = {}) {
  const duration = safeElapsed(durationMs);
  const normalized = normalizeSoloInputLog(inputLog, { maxDurationMs: duration + 1 });
  const engine = new TetrisEngine({ seed });
  for (const entry of normalized) {
    engine.applyAction(entry.action, entry.atMs, { record: false });
  }
  engine.advanceTo(duration);
  if (requireGameOver && !engine.gameOver) {
    throw new Error("The replay did not end in a game over");
  }
  return engine.getSnapshot();
}

function replayCoop({ seed, inputLog, durationMs, requireGameOver = false } = {}) {
  const duration = safeElapsed(durationMs);
  const normalized = normalizeCoopInputLog(inputLog, { maxDurationMs: duration + 1 });
  const engine = new CoopEngine({ seed });
  for (const entry of normalized) {
    engine.applyAction(entry.side, entry.action, entry.atMs, { record: false });
  }
  engine.advanceTo(duration);
  if (requireGameOver && !engine.gameOver) {
    throw new Error("The cooperative replay did not end in a game over");
  }
  return engine.getSnapshot();
}

/* ===== ui/canvas-renderer.js ===== */
const PIECE_COLORS = Object.freeze({
  I: "#2ea043",
  O: "#8b5cf6",
  T: "#f0f6fc",
  S: "#238636",
  Z: "#a371f7",
  J: "#388bfd",
  L: "#f78166",
});

const ID_TO_TYPE = Object.freeze(
  Object.fromEntries(Object.entries(PIECE_IDS).map(([type, id]) => [id, type])),
);

const GRID_BACKGROUND = "#0d1117";
const GRID_LINE = "#161b22";
const BORDER_HIGHLIGHT = "rgba(255,255,255,0.18)";
const BORDER_SHADOW = "rgba(0,0,0,0.25)";

function makeEmptyBoard(rows, columns) {
  return Array.from({ length: rows }, () => Array(columns).fill(0));
}

function boardFromSnapshot(snapshot, rows, columns) {
  if (
    Array.isArray(snapshot?.board)
    && snapshot.board.length === rows
    && snapshot.board.every((row) => Array.isArray(row) && row.length === columns)
  ) {
    return snapshot.board;
  }

  if (typeof snapshot?.settled === "string" && snapshot.settled.length === rows * columns) {
    try {
      return deserializeBoard(snapshot.settled, columns, rows);
    } catch {
      // A transient malformed network frame must not break local rendering.
    }
  }
  return makeEmptyBoard(rows, columns);
}

function matrixFor(piece) {
  if (Array.isArray(piece?.matrix) && piece.matrix.length) return piece.matrix;
  if (piece?.type) return getPieceMatrix(piece.type, Number(piece.rotation) || 0);
  return [];
}

function cellsForPiece(piece, overrideY = null) {
  if (!piece) return [];
  const matrix = matrixFor(piece);
  const baseX = Number(piece.x) || 0;
  const baseY = overrideY === null ? (Number(piece.y) || 0) : overrideY;
  const id = Number(piece.id) || PIECE_IDS[piece.type] || 1;
  const cells = [];

  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix[row].length; column += 1) {
      if (!matrix[row][column]) continue;
      cells.push({ x: baseX + column, y: baseY + row, id });
    }
  }
  return cells;
}

function collides(board, piece, x, y, columns, rows) {
  const matrix = matrixFor(piece);
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix[row].length; column += 1) {
      if (!matrix[row][column]) continue;
      const boardX = x + column;
      const boardY = y + row;
      if (boardX < 0 || boardX >= columns || boardY >= rows) return true;
      if (boardY >= 0 && board[boardY]?.[boardX]) return true;
    }
  }
  return false;
}

function ghostY(board, piece, columns, rows) {
  let y = Number(piece?.y) || 0;
  const x = Number(piece?.x) || 0;
  while (!collides(board, piece, x, y + 1, columns, rows)) y += 1;
  return y;
}

function rendererTopOccupiedRow(board) {
  const index = board.findIndex((row) => row.some(Boolean));
  return index === -1 ? board.length : index;
}

class BoardRenderer {
  constructor(canvas, { columns = 10, rows = 20, cellSize = 24 } = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError("BoardRenderer requires a canvas element");
    }
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.columns = columns;
    this.rows = rows;
    this.cellSize = cellSize;
    canvas.width = columns * cellSize;
    canvas.height = rows * cellSize;
  }

  draw(snapshot = {}, options = {}) {
    const board = boardFromSnapshot(snapshot, this.rows, this.columns);
    this.clear();
    this.drawBoard(board);

    if (options.showGhost) {
      if (snapshot.current && !snapshot.gameOver) {
        this.drawPiece(snapshot.current, ghostY(board, snapshot.current, this.columns, this.rows), 0.22, true);
      }
      for (const player of Object.values(snapshot.players ?? {})) {
        if (!player?.current || player.locked || snapshot.gameOver) continue;
        this.drawPiece(player.current, ghostY(board, player.current, this.columns, this.rows), 0.19, true);
      }
    }

    if (options.showActive !== false) {
      if (snapshot.current && !snapshot.gameOver) this.drawPiece(snapshot.current);
      for (const player of Object.values(snapshot.players ?? {})) {
        if (!player?.current || player.locked || snapshot.gameOver) continue;
        this.drawPiece(player.current);
      }
    }

    const dividerColumn = Number.isInteger(options.dividerX)
      ? options.dividerX
      : Number.isInteger(options.dividerAt)
        ? options.dividerAt
        : null;
    if (dividerColumn !== null) this.drawDivider(dividerColumn);

    if (Array.isArray(options.waitingSides) && snapshot.laneWidth) {
      for (const side of options.waitingSides) this.drawWaitingLane(side, snapshot.laneWidth);
    }

    if (options.fog) {
      const topRow = Number.isInteger(snapshot.topRow)
        ? snapshot.topRow
        : rendererTopOccupiedRow(board);
      this.drawFog(topRow);
    }
  }

  clear() {
    const { context, canvas, cellSize, columns, rows } = this;
    context.fillStyle = GRID_BACKGROUND;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = GRID_LINE;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= columns; x += 1) {
      context.moveTo(Math.round(x * cellSize) + 0.5, 0);
      context.lineTo(Math.round(x * cellSize) + 0.5, canvas.height);
    }
    for (let y = 0; y <= rows; y += 1) {
      context.moveTo(0, Math.round(y * cellSize) + 0.5);
      context.lineTo(canvas.width, Math.round(y * cellSize) + 0.5);
    }
    context.stroke();
  }

  drawBoard(board) {
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const id = Number(board[y]?.[x]) || 0;
        if (id) this.drawCell(x, y, id);
      }
    }
  }

  drawPiece(piece, overrideY = null, alpha = 1, ghost = false) {
    for (const cell of cellsForPiece(piece, overrideY)) {
      if (cell.x < 0 || cell.x >= this.columns || cell.y < 0 || cell.y >= this.rows) continue;
      this.drawCell(cell.x, cell.y, cell.id, alpha, ghost);
    }
  }

  drawCell(x, y, id, alpha = 1, ghost = false) {
    const type = ID_TO_TYPE[id];
    const color = PIECE_COLORS[type] ?? "#94a3b8";
    const left = x * this.cellSize;
    const top = y * this.cellSize;
    const size = this.cellSize;
    const context = this.context;

    context.save();
    context.globalAlpha = alpha;
    if (ghost) {
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.strokeRect(left + 3, top + 3, size - 7, size - 7);
    } else {
      context.fillStyle = color;
      context.fillRect(left, top, size - 1, size - 1);
    }
    context.restore();
  }

  drawDivider(column) {
    const x = column * this.cellSize;
    this.context.save();
    this.context.strokeStyle = "rgba(96, 165, 250, 0.86)";
    this.context.lineWidth = 3;
    this.context.setLineDash([8, 5]);
    this.context.beginPath();
    this.context.moveTo(x, 0);
    this.context.lineTo(x, this.canvas.height);
    this.context.stroke();
    this.context.restore();
  }

  drawWaitingLane(side, laneWidth) {
    const leftColumn = side === "right" ? laneWidth : 0;
    this.context.save();
    this.context.fillStyle = "rgba(8, 12, 20, 0.34)";
    this.context.fillRect(
      leftColumn * this.cellSize,
      0,
      laneWidth * this.cellSize,
      this.canvas.height,
    );
    this.context.fillStyle = "rgba(240, 246, 252, 0.72)";
    this.context.font = `700 ${Math.max(10, Math.floor(this.cellSize * 0.55))}px ui-monospace, monospace`;
    this.context.textAlign = "center";
    this.context.fillText(
      "ОЖИДАНИЕ",
      (leftColumn + laneWidth / 2) * this.cellSize,
      this.cellSize * 1.15,
    );
    this.context.restore();
  }

  drawFog(topRow) {
    const clamped = Math.max(0, Math.min(this.rows, Number(topRow) || 0));
    const fadeBottom = clamped >= this.rows
      ? this.canvas.height
      : Math.max(this.cellSize, Math.min(this.canvas.height, (clamped + 1.2) * this.cellSize));
    const gradient = this.context.createLinearGradient(0, 0, 0, fadeBottom);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(0.58, "rgba(0,0,0,0.93)");
    gradient.addColorStop(0.84, "rgba(0,0,0,0.52)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    this.context.save();
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, this.canvas.width, fadeBottom);
    this.context.restore();
  }
}

class PreviewRenderer {
  constructor(canvas, { cellSize = 18 } = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError("PreviewRenderer requires a canvas element");
    }
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.cellSize = cellSize;
  }

  draw(type) {
    const { canvas, context } = this;
    context.fillStyle = GRID_BACKGROUND;
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!type || !PIECE_IDS[type]) return;

    const matrix = getPieceMatrix(type, 0);
    const unit = this.cellSize;
    const offsetX = Math.floor((4 - matrix[0].length) / 2) * unit;
    const offsetY = Math.floor((4 - matrix.length) / 2) * unit;
    const color = PIECE_COLORS[type];

    context.fillStyle = color;
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) continue;
        context.fillRect(offsetX + x * unit, offsetY + y * unit, unit - 1, unit - 1);
      }
    }
  }
}

/* ===== ui/controls.js ===== */
const KEY_ACTIONS = Object.freeze({
  ArrowLeft: ACTIONS.LEFT,
  KeyA: ACTIONS.LEFT,
  ArrowRight: ACTIONS.RIGHT,
  KeyD: ACTIONS.RIGHT,
  ArrowUp: ACTIONS.ROTATE,
  KeyW: ACTIONS.ROTATE,
  KeyX: ACTIONS.ROTATE,
  ArrowDown: ACTIONS.SOFT_DROP,
  KeyS: ACTIONS.SOFT_DROP,
  Space: ACTIONS.HARD_DROP,
});

const HOLDABLE = new Set([ACTIONS.LEFT, ACTIONS.RIGHT, ACTIONS.SOFT_DROP]);
const REPEAT_DELAY_MS = 175;
const REPEAT_INTERVAL_MS = 65;

class GameControls {
  constructor(root = document) {
    this.root = root;
    this.container = root.getElementById?.("game-controls")
      ?? root.querySelector?.("#game-controls")
      ?? null;
    this.handler = null;
    this.enabled = false;
    this.repeatDelay = null;
    this.repeatInterval = null;
    this.activeButton = null;
    this.activePointerId = null;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.stopPointerAction = this.stopPointerAction.bind(this);

    document.addEventListener("keydown", this.onKeyDown);
    this.container?.addEventListener("pointerdown", this.onPointerDown);
    this.container?.addEventListener("pointerup", this.stopPointerAction);
    this.container?.addEventListener("pointercancel", this.stopPointerAction);
    this.container?.addEventListener("lostpointercapture", this.stopPointerAction);
    this.container?.addEventListener("contextmenu", (event) => event.preventDefault());

    this.refresh();
  }

  setHandler(handler) {
    this.handler = typeof handler === "function" ? handler : null;
    if (!this.handler) this.setEnabled(false);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled && this.handler);
    if (!this.enabled) this.cancelRepeat();
    this.refresh();
  }

  refresh() {
    if (!this.container) return;
    if (this.enabled) this.container.removeAttribute("data-disabled");
    else this.container.setAttribute("data-disabled", "");
    this.container.setAttribute("aria-disabled", String(!this.enabled));
    for (const button of this.container.querySelectorAll("[data-game-action]")) {
      button.disabled = !this.enabled;
    }
  }

  fire(action) {
    if (!this.enabled || !this.handler) return;
    try {
      this.handler(action);
    } catch (error) {
      console.error("Game input failed", error);
    }
  }

  onKeyDown(event) {
    const action = KEY_ACTIONS[event.code];
    if (!action || !this.enabled) return;

    const target = event.target;
    if (
      target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || target?.isContentEditable
    ) {
      return;
    }

    if (event.repeat && !HOLDABLE.has(action)) return;
    event.preventDefault();
    this.fire(action);
  }

  onPointerDown(event) {
    const button = event.target.closest?.("[data-game-action]");
    if (!button || !this.container?.contains(button) || button.disabled || !this.enabled) return;

    const action = button.dataset.gameAction;
    if (!Object.values(ACTIONS).includes(action)) return;

    event.preventDefault();
    this.cancelRepeat();
    this.activeButton = button;
    this.activePointerId = event.pointerId;
    button.classList.add("is-active");
    button.setPointerCapture?.(event.pointerId);
    this.fire(action);

    if (HOLDABLE.has(action)) {
      this.repeatDelay = window.setTimeout(() => {
        this.repeatInterval = window.setInterval(() => this.fire(action), REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    }
  }

  stopPointerAction(event) {
    if (
      this.activePointerId !== null
      && Number.isInteger(event?.pointerId)
      && event.pointerId !== this.activePointerId
    ) {
      return;
    }
    this.cancelRepeat();
  }

  cancelRepeat() {
    if (this.repeatDelay !== null) window.clearTimeout(this.repeatDelay);
    if (this.repeatInterval !== null) window.clearInterval(this.repeatInterval);
    this.repeatDelay = null;
    this.repeatInterval = null;
    this.activeButton?.classList.remove("is-active");
    this.activeButton = null;
    this.activePointerId = null;
  }

  destroy() {
    this.cancelRepeat();
    document.removeEventListener("keydown", this.onKeyDown);
    this.container?.removeEventListener("pointerdown", this.onPointerDown);
    this.container?.removeEventListener("pointerup", this.stopPointerAction);
    this.container?.removeEventListener("pointercancel", this.stopPointerAction);
    this.container?.removeEventListener("lostpointercapture", this.stopPointerAction);
  }
}

/* ===== services/firebase-service.js ===== */
const DEFAULT_FIREBASE_SDK_VERSION = "10.12.5";
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_LENGTH = 6;
const MAX_SESSION_MS = 24 * 60 * 60 * 1000;
const DISCONNECT_GRACE_MS = 15000;

const LEADERBOARD_ORDER = Object.freeze({
  solo: "score",
  competitive: "sortKey",
  coop: "maxScore",
});

function objectValues(snapshotValue) {
  if (!snapshotValue || typeof snapshotValue !== "object") return [];
  return Object.entries(snapshotValue).map(([id, value]) => ({ id, ...value }));
}

function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function makeClientError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function secureRandomSeed() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || 1;
}

function randomInviteCode() {
  const values = new Uint32Array(INVITE_LENGTH);
  crypto.getRandomValues(values);
  let code = "";
  for (const value of values) {
    code += INVITE_ALPHABET[value % INVITE_ALPHABET.length];
  }
  return code;
}

function assertFirebaseKey(value, label = "Идентификатор") {
  const key = String(value ?? "");
  if (!/^[A-Za-z0-9_-]{10,160}$/.test(key)) {
    throw makeClientError("app/invalid-key", `${label} имеет неверный формат.`);
  }
  return key;
}

function assertDuration(value) {
  const duration = Number(value);
  if (!Number.isInteger(duration) || duration < 0 || duration > MAX_SESSION_MS) {
    throw makeClientError("app/invalid-duration", "Некорректная длительность партии.");
  }
  return duration;
}

async function loadFirebaseModules(version, includeAppCheck) {
  const base = `https://www.gstatic.com/firebasejs/${version}`;
  const imports = [
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-database.js`),
  ];
  if (includeAppCheck) imports.push(import(`${base}/firebase-app-check.js`));
  const modules = await Promise.all(imports);
  return Object.assign({}, ...modules);
}

class FirebaseService {
  constructor(config) {
    this.config = config;
    this.api = null;
    this.app = null;
    this.auth = null;
    this.db = null;
    this.user = null;
    this.serverTimeOffset = 0;
    this.connectionRef = null;
    this.initialized = false;
    this.presenceError = null;
    this.presenceUnsubscribe = null;
    this.offsetUnsubscribe = null;
    this.activeSoloSessions = new Map();
    this.lastChatSentAt = 0;
  }

  async initialize() {
    if (this.initialized) return this.user;
    if (this.config.forceOffline) {
      throw makeClientError("app/offline-mode", "Локальный режим включён параметром URL.");
    }

    const version = this.config.firebaseSdkVersion || DEFAULT_FIREBASE_SDK_VERSION;
    const timeoutMs = Math.max(3000, Number(this.config.firebaseLoadTimeoutMs) || 12000);
    this.api = await withTimeout(
      loadFirebaseModules(version, Boolean(this.config.appCheckSiteKey)),
      timeoutMs,
      "Не удалось загрузить Firebase SDK.",
    );

    this.app = this.api.initializeApp(this.config.firebase);
    if (this.config.appCheckSiteKey) {
      this.api.initializeAppCheck(this.app, {
        provider: new this.api.ReCaptchaEnterpriseProvider(this.config.appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }

    this.auth = this.api.getAuth(this.app);
    this.db = this.api.getDatabase(this.app);

    if (this.config.useEmulators) {
      this.api.connectAuthEmulator(
        this.auth,
        `http://${this.config.emulatorHost}:9099`,
        { disableWarnings: true },
      );
      this.api.connectDatabaseEmulator(this.db, this.config.emulatorHost, 9000);
    }

    this.offsetUnsubscribe = this.api.onValue(
      this.api.ref(this.db, ".info/serverTimeOffset"),
      (snapshot) => {
        this.serverTimeOffset = Number(snapshot.val()) || 0;
      },
    );

    this.user = await withTimeout(
      this.ensureAnonymousUser(),
      timeoutMs,
      "Не удалось выполнить анонимную авторизацию Firebase.",
    );

    this.presenceError = null;
    try {
      await this.startPresence(timeoutMs);
    } catch (error) {
      this.presenceError = error;
      console.warn("Firebase presence is unavailable", error);
    }

    this.initialized = true;
    return this.user;
  }

  ensureAnonymousUser() {
    return new Promise((resolve, reject) => {
      let signingIn = false;
      const unsubscribe = this.api.onAuthStateChanged(
        this.auth,
        async (user) => {
          if (user) {
            unsubscribe();
            resolve(user);
            return;
          }
          if (signingIn) return;
          signingIn = true;
          try {
            await this.api.signInAnonymously(this.auth);
          } catch (error) {
            unsubscribe();
            reject(error);
          }
        },
        (error) => {
          unsubscribe();
          reject(error);
        },
      );
    });
  }

  startPresence(timeoutMs = 12000) {
    const uid = this.requireUser().uid;
    const connectedRef = this.api.ref(this.db, ".info/connected");

    return new Promise((resolve, reject) => {
      let initialRegistrationFinished = false;
      let registrationPending = false;
      const timer = window.setTimeout(() => {
        if (initialRegistrationFinished) return;
        initialRegistrationFinished = true;
        this.presenceUnsubscribe?.();
        this.presenceUnsubscribe = null;
        reject(makeClientError("app/presence-timeout", "Не удалось зарегистрировать присутствие в Firebase."));
      }, Math.max(3000, Number(timeoutMs) || 12000));

      const failInitialRegistration = (error) => {
        if (initialRegistrationFinished) {
          console.warn("Presence registration failed", error);
          return;
        }
        initialRegistrationFinished = true;
        window.clearTimeout(timer);
        this.presenceUnsubscribe?.();
        this.presenceUnsubscribe = null;
        reject(error);
      };

      this.presenceUnsubscribe = this.api.onValue(
        connectedRef,
        (snapshot) => {
          if (snapshot.val() !== true || registrationPending) return;
          registrationPending = true;
          void this.registerConnection(uid)
            .then(() => {
              if (!initialRegistrationFinished) {
                initialRegistrationFinished = true;
                window.clearTimeout(timer);
                resolve();
              }
            })
            .catch(failInitialRegistration)
            .finally(() => {
              registrationPending = false;
            });
        },
        failInitialRegistration,
      );
    });
  }

  async registerConnection(uid) {
    const connectionRef = this.api.push(this.api.ref(this.db, `presence/${uid}/connections`));
    this.connectionRef = connectionRef;
    await this.api.onDisconnect(connectionRef).remove();
    await this.api.onDisconnect(this.api.ref(this.db, `presence/${uid}/lastOnline`))
      .set(this.api.serverTimestamp());
    await this.api.set(connectionRef, { connectedAt: this.api.serverTimestamp() });
    await this.api.set(
      this.api.ref(this.db, `presence/${uid}/lastOnline`),
      this.api.serverTimestamp(),
    );
  }

  requireUser() {
    if (!this.user) throw makeClientError("app/not-authenticated", "Firebase user is not authenticated");
    return this.user;
  }

  requireApi() {
    if (!this.api || !this.db) throw makeClientError("app/not-initialized", "Firebase service is not initialized");
    return this.api;
  }

  serverNow() {
    return Date.now() + this.serverTimeOffset;
  }

  async reserveInviteCode(uid, preferredCode = null) {
    const api = this.requireApi();
    const tryReserve = async (candidate) => {
      const code = normalizeInviteCode(candidate);
      if (code.length !== INVITE_LENGTH) return null;
      const result = await api.runTransaction(
        api.ref(this.db, `inviteCodes/${code}`),
        (current) => (current === null || current === uid ? uid : undefined),
        { applyLocally: false },
      );
      return result.committed ? code : null;
    };

    const preferred = await tryReserve(preferredCode);
    if (preferred) return preferred;

    for (let attempt = 0; attempt < 48; attempt += 1) {
      const code = await tryReserve(randomInviteCode());
      if (code) return code;
    }
    throw makeClientError("app/invite-code-exhausted", "Не удалось выделить уникальный код игрока.");
  }

  async ensureProfile(requestedName) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const profileRef = api.ref(this.db, `profiles/${uid}`);
    const existing = (await api.get(profileRef)).val() ?? {};
    const inviteCode = await this.reserveInviteCode(uid, existing.inviteCode);
    const requested = sanitizeName(requestedName);
    const existingName = sanitizeName(existing.name);
    const fallback = `Игрок${uid.slice(0, 4)}`.slice(0, 12);
    const name = requested.length >= 2
      ? requested
      : existingName.length >= 2
        ? existingName
        : fallback;
    const now = this.serverNow();
    const profile = {
      uid,
      name,
      inviteCode,
      createdAt: Number(existing.createdAt) || now,
      updatedAt: now,
      version: GAME_VERSION,
    };
    await api.set(profileRef, profile);
    return profile;
  }

  async updateProfile(requestedName) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const name = sanitizeName(requestedName);
    if (name.length < 2) {
      throw makeClientError("app/invalid-name", "Имя должно содержать от 2 до 12 символов.");
    }
    const profile = await this.ensureProfile(name);
    const lobbyId = (await api.get(api.ref(this.db, `userLobby/${uid}`))).val();
    if (lobbyId && !String(lobbyId).startsWith("__joining__")) {
      const memberRef = api.ref(this.db, `lobbies/${lobbyId}/members/${uid}`);
      if ((await api.get(memberRef)).exists()) {
        await api.set(api.ref(this.db, `lobbies/${lobbyId}/members/${uid}/name`), profile.name);
        await api.set(api.ref(this.db, `lobbies/${lobbyId}/updatedAt`), this.serverNow());
      }
    }
    return profile;
  }

  async isOnline(uid) {
    const api = this.requireApi();
    const snapshot = await api.get(api.ref(this.db, `presence/${uid}/connections`));
    const value = snapshot.val();
    return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
  }

  async clearStaleLobbyAssignment(uid) {
    const api = this.requireApi();
    const pointerRef = api.ref(this.db, `userLobby/${uid}`);
    const pointer = (await api.get(pointerRef)).val();
    if (!pointer) return null;

    const value = String(pointer);
    if (value.startsWith("__joining__")) {
      const timestamp = Number(value.split("_").at(-1));
      const stale = !Number.isFinite(timestamp) || this.serverNow() - timestamp > 45000;
      if (stale) {
        await api.runTransaction(
          pointerRef,
          (current) => (current === pointer ? null : undefined),
          { applyLocally: false },
        );
        return null;
      }
      return { lobbyId: value, lobby: null, reservation: true };
    }

    const lobby = (await api.get(api.ref(this.db, `lobbies/${value}`))).val();
    if (!lobby || !lobby.members?.[uid]) {
      await api.runTransaction(
        pointerRef,
        (current) => (current === pointer ? null : undefined),
        { applyLocally: false },
      );
      return null;
    }
    return { lobbyId: value, lobby };
  }

  async joinLobbyByCode(rawCode) {
    const api = this.requireApi();
    const guestUid = this.requireUser().uid;
    const code = normalizeInviteCode(rawCode);
    if (code.length !== INVITE_LENGTH) {
      throw makeClientError("app/invalid-code", "Введите шестизначный код игрока.");
    }

    const inviteValue = (await api.get(api.ref(this.db, `inviteCodes/${code}`))).val();
    const hostUid = typeof inviteValue === "string" ? inviteValue : inviteValue?.uid;
    if (!hostUid) throw makeClientError("app/player-not-found", "Игрок с таким кодом не найден.");
    if (hostUid === guestUid) throw makeClientError("app/self-join", "Нельзя подключиться к собственному коду.");
    if (!(await this.isOnline(hostUid))) {
      throw makeClientError("app/player-offline", "Владелец кода сейчас не в сети.");
    }

    const guestActive = await this.clearStaleLobbyAssignment(guestUid);
    if (guestActive) throw makeClientError("app/already-in-lobby", "Вы уже находитесь в лобби.");
    const hostActive = await this.clearStaleLobbyAssignment(hostUid);
    if (hostActive) throw makeClientError("app/host-busy", "Этот игрок уже находится в другом лобби.");

    const now = this.serverNow();
    const reservation = `__joining__${hostUid}_${Math.trunc(now)}`;
    const guestReservation = await api.runTransaction(
      api.ref(this.db, `userLobby/${guestUid}`),
      (current) => (current === null ? reservation : undefined),
      { applyLocally: false },
    );
    if (!guestReservation.committed) {
      throw makeClientError("app/join-in-progress", "Вы уже подключаетесь к другому лобби.");
    }

    const lobbyId = hostUid;
    let lobbyCreated = false;
    let hostPointerWritten = false;
    try {
      const [hostProfileValue, guestProfileValue] = await Promise.all([
        api.get(api.ref(this.db, `profiles/${hostUid}`)),
        api.get(api.ref(this.db, `profiles/${guestUid}`)),
      ]);
      const hostProfile = hostProfileValue.val();
      const guestProfile = guestProfileValue.val() ?? await this.ensureProfile();
      if (!hostProfile) throw makeClientError("app/host-profile-missing", "Профиль владельца кода не найден.");

      const lobbyPayload = {
        hostUid,
        guestUid,
        code,
        mode: "competitive",
        status: "configuring",
        createdAt: now,
        updatedAt: now,
        members: {
          [hostUid]: { name: sanitizeName(hostProfile.name) || "Игрок 1", side: "left", ready: false },
          [guestUid]: { name: sanitizeName(guestProfile.name) || "Игрок 2", side: "right", ready: false },
        },
      };

      const lobbyTransaction = await api.runTransaction(
        api.ref(this.db, `lobbies/${lobbyId}`),
        (current) => (current === null ? lobbyPayload : undefined),
        { applyLocally: false },
      );
      if (!lobbyTransaction.committed) {
        throw makeClientError("app/lobby-busy", "К этому игроку уже подключился кто-то другой.");
      }
      lobbyCreated = true;

      // Write the two pointers separately. A parent-level multipath update would
      // require a permissive rule at the database root, which we intentionally avoid.
      await api.set(api.ref(this.db, `userLobby/${hostUid}`), lobbyId);
      hostPointerWritten = true;
      await api.set(api.ref(this.db, `userLobby/${guestUid}`), lobbyId);
      return { lobbyId };
    } catch (error) {
      try {
        await api.runTransaction(
          api.ref(this.db, `userLobby/${guestUid}`),
          (current) => (current === reservation || current === lobbyId ? null : undefined),
          { applyLocally: false },
        );
        if (hostPointerWritten) {
          await api.runTransaction(
            api.ref(this.db, `userLobby/${hostUid}`),
            (current) => (current === lobbyId ? null : undefined),
            { applyLocally: false },
          );
        }
        if (lobbyCreated) await api.remove(api.ref(this.db, `lobbies/${lobbyId}`));
      } catch (rollbackError) {
        console.warn("Lobby rollback failed", rollbackError);
      }
      throw error;
    }
  }

  async leaveLobby() {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const pointerRef = api.ref(this.db, `userLobby/${uid}`);
    const pointer = (await api.get(pointerRef)).val();
    if (!pointer || String(pointer).startsWith("__joining__")) {
      await api.remove(pointerRef);
      return { left: true };
    }

    const lobbyId = String(pointer);
    const lobby = (await api.get(api.ref(this.db, `lobbies/${lobbyId}`))).val();
    if (!lobby) {
      await api.remove(pointerRef);
      return { left: true };
    }
    if (!lobby.members?.[uid]) throw makeClientError("app/not-lobby-member", "Вы не состоите в этом лобби.");
    if (["starting", "playing"].includes(lobby.status)) {
      throw makeClientError("app/match-active", "Нельзя покинуть лобби во время активного матча.");
    }

    // Delete the chat while membership still exists, then clear pointers and
    // finally delete the lobby. Each write is authorized at its exact path.
    // The chat rule permits an idempotent parent delete, so no unrestricted
    // read of the chat node is needed.
    await api.remove(api.ref(this.db, `lobbyChats/${lobbyId}`));
    for (const memberUid of Object.keys(lobby.members ?? {})) {
      await api.runTransaction(
        api.ref(this.db, `userLobby/${memberUid}`),
        (current) => (current === lobbyId ? null : undefined),
        { applyLocally: false },
      );
    }
    await api.runTransaction(
      api.ref(this.db, `lobbies/${lobbyId}`),
      (current) => (current ? null : undefined),
      { applyLocally: false },
    );
    return { left: true };
  }

  async clearOwnLobbyPointer(expectedLobbyId = null) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const pointerRef = api.ref(this.db, `userLobby/${uid}`);
    await api.runTransaction(
      pointerRef,
      (current) => (!expectedLobbyId || current === expectedLobbyId ? null : undefined),
      { applyLocally: false },
    );
  }

  async startSoloGame() {
    const uid = this.requireUser().uid;
    const api = this.requireApi();
    const sessionId = api.push(api.ref(this.db, `_clientKeys/${uid}`)).key;
    const session = {
      sessionId,
      seed: secureRandomSeed(),
      status: "playing",
      startedAt: this.serverNow(),
      version: GAME_VERSION,
    };
    this.activeSoloSessions.set(sessionId, session);
    return session;
  }

  async finishSoloGame(sessionId, durationValue, inputLog) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const durationMs = assertDuration(durationValue);
    const session = this.activeSoloSessions.get(sessionId);
    if (!session) throw makeClientError("app/session-missing", "Локальная сессия партии не найдена.");
    if (durationMs > this.serverNow() - session.startedAt + 30000) {
      throw makeClientError("app/duration-in-future", "Длительность партии находится в будущем.");
    }

    let snapshot;
    try {
      snapshot = replaySolo({
        seed: session.seed,
        inputLog,
        durationMs,
        requireGameOver: true,
      });
    } catch (error) {
      throw makeClientError("app/replay-failed", `Результат не прошёл локальное воспроизведение: ${error.message}`);
    }

    const profile = await this.ensureProfile();
    const entryRef = api.ref(this.db, `leaderboards/solo/${uid}`);
    const updatedAt = this.serverNow();
    const transaction = await api.runTransaction(entryRef, (current) => {
      const currentScore = Number(current?.score);
      const currentPlayTime = Number(current?.playTimeMs);
      const currentIsReusable = Boolean(
        current
        && current.version === GAME_VERSION
        && current.uid === uid
        && Number.isInteger(currentScore)
        && Number.isInteger(Number(current.lines))
        && Number.isInteger(currentPlayTime)
        && Number(current.timestamp) > 0,
      );

      // A worse result must not overwrite a personal best. Returning undefined
      // aborts the transaction cleanly instead of triggering permission_denied.
      if (current && currentScore > snapshot.score) return undefined;

      // For an equal valid personal best, update only the public nickname and
      // metadata while preserving the immutable original timestamp.
      if (currentIsReusable && currentScore === snapshot.score && currentPlayTime <= durationMs) {
        const lines = Number(current.lines);
        return {
          uid,
          name: profile.name,
          score: currentScore,
          lines,
          level: Math.floor(lines / 10) + 1,
          playTimeMs: currentPlayTime,
          timestamp: Number(current.timestamp),
          updatedAt,
          version: GAME_VERSION,
        };
      }

      // Security Rules keep timestamp immutable on updates. Preserve it when a
      // player improves an existing record; use the current time only on create.
      return {
        uid,
        name: profile.name,
        score: snapshot.score,
        lines: snapshot.lines,
        level: snapshot.level,
        playTimeMs: durationMs,
        timestamp: Number(current?.timestamp) || updatedAt,
        updatedAt,
        version: GAME_VERSION,
      };
    }, { applyLocally: false });

    this.activeSoloSessions.delete(sessionId);
    return {
      published: transaction.committed,
      verified: false,
      validation: "client-replay",
      score: snapshot.score,
      lines: snapshot.lines,
      level: snapshot.level,
      durationMs,
    };
  }

  async startMatch(rawLobbyId) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const lobbyId = assertFirebaseKey(rawLobbyId, "Идентификатор лобби");
    const lobbyRef = api.ref(this.db, `lobbies/${lobbyId}`);
    let lobby = (await api.get(lobbyRef)).val();
    if (!lobby || !lobby.members?.[uid]) throw makeClientError("app/lobby-not-found", "Лобби не найдено.");
    if (lobby.hostUid !== uid) throw makeClientError("app/not-host", "Запустить матч может только создатель лобби.");
    if (lobby.status === "playing" && lobby.matchId) {
      const existing = (await api.get(api.ref(this.db, `matches/${lobby.matchId}`))).val();
      return { matchId: lobby.matchId, ...existing };
    }
    if (!lobby.guestUid || Object.keys(lobby.members ?? {}).length !== 2) {
      throw makeClientError("app/two-players-required", "Для старта нужны два игрока.");
    }
    if (!["competitive", "coop"].includes(lobby.mode)) {
      throw makeClientError("app/mode-missing", "Не выбран режим матча.");
    }
    if (!Object.values(lobby.members ?? {}).every((member) => member.ready === true)) {
      throw makeClientError("app/not-ready", "Оба игрока должны подтвердить готовность.");
    }

    const pendingRef = api.ref(this.db, `lobbies/${lobbyId}/pendingMatch`);
    const existingPending = (await api.get(pendingRef)).val();
    if (existingPending?.matchId) {
      const existingMatch = (await api.get(api.ref(this.db, `matches/${existingPending.matchId}`))).val();
      const stale = !existingMatch
        && this.serverNow() - Number(existingPending.createdAt || 0) > 30000;
      if (stale) {
        await api.runTransaction(
          pendingRef,
          (current) => (current?.matchId === existingPending.matchId ? null : undefined),
          { applyLocally: false },
        );
      }
    }

    const candidate = {
      matchId: api.push(api.ref(this.db, "matches")).key,
      seed: secureRandomSeed(),
      createdAt: this.serverNow(),
      startedAt: this.serverNow() + 3500,
    };
    const pendingTransaction = await api.runTransaction(
      pendingRef,
      (current) => (current === null ? candidate : undefined),
      { applyLocally: false },
    );
    const pending = pendingTransaction.committed
      ? pendingTransaction.snapshot.val()
      : (await api.get(pendingRef)).val();
    if (!pending?.matchId) throw makeClientError("app/start-lock-failed", "Не удалось зарезервировать запуск матча.");

    lobby = (await api.get(lobbyRef)).val();
    if (!lobby || lobby.hostUid !== uid) throw makeClientError("app/lobby-changed", "Состояние лобби изменилось.");

    const match = {
      lobbyId,
      hostUid: lobby.hostUid,
      guestUid: lobby.guestUid,
      mode: lobby.mode,
      status: "playing",
      seed: pending.seed,
      createdAt: pending.createdAt,
      startedAt: pending.startedAt,
      version: GAME_VERSION,
      members: lobby.members,
    };
    const matchRef = api.ref(this.db, `matches/${pending.matchId}`);
    const matchTransaction = await api.runTransaction(
      matchRef,
      (current) => (current === null ? match : undefined),
      { applyLocally: false },
    );
    const storedMatch = matchTransaction.committed
      ? matchTransaction.snapshot.val()
      : (await api.get(matchRef)).val();
    if (!storedMatch) {
      throw makeClientError("app/match-create-failed", "Не удалось создать матч.");
    }

    // Security Rules evaluate sibling state from the committed database.
    // Use idempotent transactions so retries or a double click cannot turn a
    // successful start into a permission error.
    await api.runTransaction(
      api.ref(this.db, `lobbies/${lobbyId}/lastResult`),
      (current) => (current ? null : undefined),
      { applyLocally: false },
    );
    const matchIdTransaction = await api.runTransaction(
      api.ref(this.db, `lobbies/${lobbyId}/matchId`),
      (current) => (current === null ? pending.matchId : undefined),
      { applyLocally: false },
    );
    if (!matchIdTransaction.committed) {
      const currentMatchId = (await api.get(api.ref(this.db, `lobbies/${lobbyId}/matchId`))).val();
      if (currentMatchId !== pending.matchId) {
        throw makeClientError("app/parallel-match", "В лобби уже запускается другой матч.");
      }
    }
    await api.runTransaction(
      api.ref(this.db, `lobbies/${lobbyId}/status`),
      (current) => (current === "configuring" ? "playing" : undefined),
      { applyLocally: false },
    );
    await api.runTransaction(
      api.ref(this.db, `lobbies/${lobbyId}/pendingMatch`),
      (current) => (current?.matchId === pending.matchId ? null : undefined),
      { applyLocally: false },
    );
    await api.set(api.ref(this.db, `lobbies/${lobbyId}/updatedAt`), this.serverNow());
    return { matchId: pending.matchId, ...storedMatch };
  }

  async updateCompetitiveEntry(targetUid, matchId, result, scoreCandidate = 0) {
    const api = this.requireApi();
    const profile = (await api.get(api.ref(this.db, `profiles/${targetUid}`))).val() ?? {};
    const outcome = result.winnerUid === targetUid ? "win" : "loss";
    const entryRef = api.ref(this.db, `leaderboards/competitive/${targetUid}`);
    const now = this.serverNow();

    await api.runTransaction(entryRef, (currentValue) => {
      const current = currentValue && typeof currentValue === "object" ? currentValue : {};
      const processedMatches = { ...(current.processedMatches ?? {}) };
      const isNewOutcome = !processedMatches[matchId];
      if (isNewOutcome) processedMatches[matchId] = outcome;
      const wins = Math.max(0, Math.trunc(Number(current.wins) || 0))
        + (isNewOutcome && outcome === "win" ? 1 : 0);
      const losses = Math.max(0, Math.trunc(Number(current.losses) || 0))
        + (isNewOutcome && outcome === "loss" ? 1 : 0);
      const maxScore = Math.max(
        Math.max(0, Math.trunc(Number(current.maxScore) || 0)),
        Math.max(0, Math.trunc(Number(scoreCandidate) || 0)),
      );
      return {
        uid: targetUid,
        name: sanitizeName(profile.name) || "Игрок",
        wins,
        losses,
        maxScore,
        sortKey: wins * 1000000000 + maxScore,
        lastMatchId: matchId,
        processedMatches,
        updatedAt: now,
        version: GAME_VERSION,
      };
    }, { applyLocally: false });
  }

  async updateCompetitiveLeaderboards(matchId, match, result, scoreByUid = {}) {
    const loserScore = Math.max(0, Number(result.loserScore) || 0);
    await Promise.all([
      this.updateCompetitiveEntry(
        result.winnerUid,
        matchId,
        result,
        Number(scoreByUid[result.winnerUid]) || 0,
      ),
      this.updateCompetitiveEntry(
        result.loserUid,
        matchId,
        result,
        Math.max(loserScore, Number(scoreByUid[result.loserUid]) || 0),
      ),
    ]);
  }

  async finishCompetitiveMatch(rawMatchId, durationValue, inputLog, claimsGameOver) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const matchId = assertFirebaseKey(rawMatchId, "Идентификатор матча");
    const durationMs = assertDuration(durationValue);
    const matchRef = api.ref(this.db, `matches/${matchId}`);
    const match = (await api.get(matchRef)).val();
    if (!match || match.mode !== "competitive" || !match.members?.[uid]) {
      throw makeClientError("app/match-not-found", "Соревновательный матч не найден.");
    }
    if (durationMs > this.serverNow() - Number(match.startedAt || 0) + 30000) {
      throw makeClientError("app/duration-in-future", "Длительность матча находится в будущем.");
    }

    let replay;
    try {
      replay = replaySolo({
        seed: match.seed,
        inputLog,
        durationMs,
        requireGameOver: Boolean(claimsGameOver),
      });
    } catch (error) {
      throw makeClientError("app/replay-failed", `Результат не прошёл локальное воспроизведение: ${error.message}`);
    }

    const resultRef = api.ref(this.db, `matches/${matchId}/result`);
    let result = (await api.get(resultRef)).val();
    if (claimsGameOver && replay.gameOver && !result) {
      const otherUid = Object.keys(match.members).find((memberUid) => memberUid !== uid);
      const payload = {
        winnerUid: otherUid,
        loserUid: uid,
        reason: "top-out",
        finishedAt: this.serverNow(),
        loserDurationMs: durationMs,
        loserScore: replay.score,
        version: GAME_VERSION,
      };
      const transaction = await api.runTransaction(
        resultRef,
        (current) => (current === null ? payload : undefined),
        { applyLocally: false },
      );
      result = transaction.committed
        ? transaction.snapshot.val()
        : (await api.get(resultRef)).val();
    }

    if (result) {
      await this.updateCompetitiveLeaderboards(matchId, match, result, { [uid]: replay.score });
      await this.markMatchFinished(matchId);
      await this.resetLobbyAfterMatch(matchId, match, result);
    }

    return {
      verified: false,
      validation: "client-replay",
      score: replay.score,
      lines: replay.lines,
      level: replay.level,
      durationMs,
      gameOver: replay.gameOver,
      result,
    };
  }

  async updateCoopLeaderboard(matchId, match, result) {
    const api = this.requireApi();
    const teamId = `${match.hostUid}__${match.guestUid}`;
    const [hostProfileValue, guestProfileValue] = await Promise.all([
      api.get(api.ref(this.db, `profiles/${match.hostUid}`)),
      api.get(api.ref(this.db, `profiles/${match.guestUid}`)),
    ]);
    const hostProfile = hostProfileValue.val() ?? {};
    const guestProfile = guestProfileValue.val() ?? {};
    const now = this.serverNow();

    await api.runTransaction(
      api.ref(this.db, `leaderboards/coop/${teamId}`),
      (currentValue) => {
        const current = currentValue && typeof currentValue === "object" ? currentValue : {};
        const processedMatches = { ...(current.processedMatches ?? {}) };
        const isNew = !processedMatches[matchId];
        if (isNew) processedMatches[matchId] = true;
        const previousMax = Math.max(0, Math.trunc(Number(current.maxScore) || 0));
        const maxScore = Math.max(previousMax, Math.max(0, Math.trunc(Number(result.score) || 0)));
        return {
          teamId,
          memberUids: [match.hostUid, match.guestUid],
          player1Name: sanitizeName(hostProfile.name) || "Игрок 1",
          player2Name: sanitizeName(guestProfile.name) || "Игрок 2",
          maxScore,
          matches: Math.max(0, Math.trunc(Number(current.matches) || 0)) + (isNew ? 1 : 0),
          bestDurationMs: maxScore > previousMax
            ? Math.max(0, Math.trunc(Number(result.durationMs) || 0))
            : Math.max(0, Math.trunc(Number(current.bestDurationMs) || Number(result.durationMs) || 0)),
          lastMatchId: matchId,
          processedMatches,
          updatedAt: now,
          version: GAME_VERSION,
        };
      },
      { applyLocally: false },
    );
  }

  async finishCoopMatch(rawMatchId, durationValue) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const matchId = assertFirebaseKey(rawMatchId, "Идентификатор матча");
    const durationMs = assertDuration(durationValue);
    const matchRef = api.ref(this.db, `matches/${matchId}`);
    const match = (await api.get(matchRef)).val();
    if (!match || match.mode !== "coop" || !match.members?.[uid]) {
      throw makeClientError("app/match-not-found", "Кооперативный матч не найден.");
    }
    if (match.hostUid !== uid) {
      throw makeClientError("app/not-host", "Итог кооперативного матча отправляет ведущий.");
    }

    const acceptedValue = (await api.get(api.ref(this.db, `matches/${matchId}/acceptedCommands`))).val() ?? {};
    const inputLog = Object.values(acceptedValue)
      .map((entry, index) => ({
        seq: Number(entry?.seq) || index + 1,
        side: entry?.side,
        action: entry?.action,
        atMs: Number(entry?.atMs) || 0,
      }))
      .sort((a, b) => a.atMs - b.atMs || a.seq - b.seq);

    let replay;
    try {
      replay = replayCoop({
        seed: match.seed,
        inputLog,
        durationMs,
        requireGameOver: true,
      });
    } catch (error) {
      throw makeClientError("app/replay-failed", `Матч не прошёл локальное воспроизведение: ${error.message}`);
    }

    const resultRef = api.ref(this.db, `matches/${matchId}/result`);
    const payload = {
      outcome: "team-game-over",
      score: replay.score,
      lines: replay.lines,
      level: replay.level,
      durationMs,
      finishedAt: this.serverNow(),
      version: GAME_VERSION,
    };
    const resultTransaction = await api.runTransaction(
      resultRef,
      (current) => (current === null ? payload : undefined),
      { applyLocally: false },
    );
    const result = resultTransaction.committed
      ? resultTransaction.snapshot.val()
      : (await api.get(resultRef)).val();
    if (!result) throw makeClientError("app/result-missing", "Не удалось сохранить итог матча.");

    await this.updateCoopLeaderboard(matchId, match, result);
    await this.markMatchFinished(matchId);
    await this.resetLobbyAfterMatch(matchId, match, result);
    return { verified: false, validation: "client-replay", ...result };
  }

  async claimDisconnectResult(rawMatchId) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const matchId = assertFirebaseKey(rawMatchId, "Идентификатор матча");
    const matchRef = api.ref(this.db, `matches/${matchId}`);
    const match = (await api.get(matchRef)).val();
    if (!match || !match.members?.[uid] || !["competitive", "coop"].includes(match.mode)) {
      throw makeClientError("app/match-not-found", "Сетевой матч не найден.");
    }

    const existing = (await api.get(api.ref(this.db, `matches/${matchId}/result`))).val();
    if (existing) {
      await this.markMatchFinished(matchId);
      await this.resetLobbyAfterMatch(matchId, match, existing);
      return { resolved: true, result: existing };
    }
    if (match.status !== "playing") throw makeClientError("app/match-not-active", "Матч не находится в активном состоянии.");

    const otherUid = Object.keys(match.members).find((memberUid) => memberUid !== uid);
    if (!otherUid) throw makeClientError("app/opponent-missing", "В матче отсутствует второй игрок.");
    if (await this.isOnline(otherUid)) throw makeClientError("app/opponent-online", "Второй игрок снова в сети.");

    const lastOnline = Number((await api.get(api.ref(this.db, `presence/${otherUid}/lastOnline`))).val());
    const offlineSince = lastOnline || Number(match.startedAt) || this.serverNow();
    const offlineMs = this.serverNow() - offlineSince;
    if (offlineMs < DISCONNECT_GRACE_MS) {
      throw makeClientError(
        "app/reconnect-grace",
        `Ожидание переподключения: ${Math.ceil((DISCONNECT_GRACE_MS - offlineMs) / 1000)} сек.`,
      );
    }

    const finishedAt = this.serverNow();
    const payload = match.mode === "competitive"
      ? {
          winnerUid: uid,
          loserUid: otherUid,
          reason: "disconnect",
          finishedAt,
          loserScore: Math.max(0, Number(match.competitiveState?.[otherUid]?.score) || 0),
          version: GAME_VERSION,
        }
      : {
          outcome: "team-disconnected",
          disconnectedUid: otherUid,
          claimantUid: uid,
          reason: "disconnect",
          score: Math.max(0, Number(match.coopState?.score) || 0),
          lines: Math.max(0, Number(match.coopState?.lines) || 0),
          level: Math.max(1, Number(match.coopState?.level) || 1),
          durationMs: Math.max(0, finishedAt - Number(match.startedAt || finishedAt)),
          finishedAt,
          version: GAME_VERSION,
        };

    const resultRef = api.ref(this.db, `matches/${matchId}/result`);
    const resultTransaction = await api.runTransaction(
      resultRef,
      (current) => (current === null ? payload : undefined),
      { applyLocally: false },
    );
    const result = resultTransaction.committed
      ? resultTransaction.snapshot.val()
      : (await api.get(resultRef)).val();

    if (match.mode === "competitive" && result) {
      await this.updateCompetitiveLeaderboards(matchId, match, result, {
        [uid]: Math.max(0, Number(match.competitiveState?.[uid]?.score) || 0),
        [otherUid]: Math.max(0, Number(match.competitiveState?.[otherUid]?.score) || 0),
      });
    }

    await this.markMatchFinished(matchId);
    await this.resetLobbyAfterMatch(matchId, match, result);
    return { resolved: true, result };
  }

  async markMatchFinished(matchId) {
    const api = this.requireApi();
    const matchRef = api.ref(this.db, `matches/${matchId}`);
    const match = (await api.get(matchRef)).val();
    if (!match?.result) return;

    if (match.status !== "finished") {
      await api.runTransaction(
        api.ref(this.db, `matches/${matchId}/status`),
        (current) => (current === "playing" ? "finished" : undefined),
        { applyLocally: false },
      );
    }

    const finishedAtRef = api.ref(this.db, `matches/${matchId}/finishedAt`);
    const finishedAt = Number((await api.get(finishedAtRef)).val());
    if (!Number.isFinite(finishedAt)) {
      await api.set(finishedAtRef, this.serverNow());
    }
  }

  async resetLobbyAfterMatch(matchId, match, result) {
    const api = this.requireApi();
    const lobbyId = match?.lobbyId;
    if (!lobbyId) return;
    const lobbyRef = api.ref(this.db, `lobbies/${lobbyId}`);
    const lobby = (await api.get(lobbyRef)).val();
    if (!lobby || lobby.matchId !== matchId) return;

    const matchStillAttached = async () => (
      (await api.get(api.ref(this.db, `lobbies/${lobbyId}/matchId`))).val() === matchId
    );
    const setWhileAttached = async (path, value) => {
      if (!(await matchStillAttached())) return false;
      try {
        await api.set(api.ref(this.db, path), value);
        return true;
      } catch (error) {
        if (!(await matchStillAttached())) return false;
        throw error;
      }
    };

    // Keep matchId until every result-dependent child write has passed its rule.
    await api.runTransaction(
      api.ref(this.db, `lobbies/${lobbyId}/status`),
      (current) => (current === "playing" ? "configuring" : undefined),
      { applyLocally: false },
    );
    if (result && !(await setWhileAttached(`lobbies/${lobbyId}/lastResult`, result))) return;
    for (const memberUid of Object.keys(lobby.members ?? {})) {
      if (!(await setWhileAttached(`lobbies/${lobbyId}/members/${memberUid}/ready`, false))) return;
    }
    if (!(await setWhileAttached(`lobbies/${lobbyId}/updatedAt`, this.serverNow()))) return;

    await api.runTransaction(
      api.ref(this.db, `lobbies/${lobbyId}/pendingMatch`),
      (current) => (current?.matchId === matchId ? null : undefined),
      { applyLocally: false },
    );
    await api.runTransaction(
      api.ref(this.db, `lobbies/${lobbyId}/matchId`),
      (current) => (current === matchId ? null : undefined),
      { applyLocally: false },
    );
  }

  subscribeProfile(uid, callback) {
    const api = this.requireApi();
    return api.onValue(api.ref(this.db, `profiles/${uid}`), (snapshot) => callback(snapshot.val()));
  }

  subscribeUserLobby(uid, callback) {
    const api = this.requireApi();
    return api.onValue(api.ref(this.db, `userLobby/${uid}`), (snapshot) => callback(snapshot.val()));
  }

  subscribeLobby(lobbyId, callback) {
    const api = this.requireApi();
    return api.onValue(api.ref(this.db, `lobbies/${lobbyId}`), (snapshot) => callback(snapshot.val()));
  }

  subscribeMatch(matchId, callback) {
    const api = this.requireApi();
    return api.onValue(api.ref(this.db, `matches/${matchId}`), (snapshot) => callback(snapshot.val()));
  }

  subscribePresence(uid, callback) {
    const api = this.requireApi();
    return api.onValue(api.ref(this.db, `presence/${uid}`), (snapshot) => callback(snapshot.val()));
  }

  subscribeChat(lobbyId, callback) {
    const api = this.requireApi();
    const chatQuery = api.query(
      api.ref(this.db, `lobbyChats/${lobbyId}`),
      api.orderByChild("timestamp"),
      api.limitToLast(50),
    );
    return api.onValue(chatQuery, (snapshot) => {
      const messages = objectValues(snapshot.val()).sort(
        (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
      );
      callback(messages);
    });
  }

  async sendChat(lobbyId, profile, text) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const cleanText = String(text ?? "").trim().slice(0, 300);
    if (!cleanText) return null;
    const now = this.serverNow();
    if (now - this.lastChatSentAt < 450) {
      throw makeClientError("app/chat-rate", "Сообщения отправляются слишком часто.");
    }
    this.lastChatSentAt = now;
    const messageRef = api.push(api.ref(this.db, `lobbyChats/${lobbyId}`));
    const message = {
      uid,
      name: sanitizeName(profile?.name) || "Игрок",
      text: cleanText,
      timestamp: api.serverTimestamp(),
    };
    await api.set(messageRef, message);
    return { messageId: messageRef.key, ...message, timestamp: now };
  }

  async setLobbyMode(lobbyId, mode) {
    const api = this.requireApi();
    await api.set(api.ref(this.db, `lobbies/${lobbyId}/mode`), mode);
    await api.set(api.ref(this.db, `lobbies/${lobbyId}/updatedAt`), this.serverNow());
  }

  async setReady(lobbyId, ready) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    await api.set(api.ref(this.db, `lobbies/${lobbyId}/members/${uid}/ready`), Boolean(ready));
    await api.set(api.ref(this.db, `lobbies/${lobbyId}/updatedAt`), this.serverNow());
  }

  publishCompetitiveState(matchId, snapshot, sequence) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    return api.set(api.ref(this.db, `matches/${matchId}/competitiveState/${uid}`), {
      settled: snapshot.settled,
      score: snapshot.score,
      lines: snapshot.lines,
      level: snapshot.level,
      topRow: snapshot.topRow,
      gameOver: snapshot.gameOver,
      sequence,
      updatedAt: api.serverTimestamp(),
    });
  }

  appendRawCommand(matchId, sequence, action, atMs) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const key = String(sequence).padStart(8, "0");
    return api.set(api.ref(this.db, `matches/${matchId}/commands/${uid}/${key}`), {
      seq: sequence,
      action,
      atMs: Math.max(0, Math.trunc(atMs)),
      createdAt: api.serverTimestamp(),
    });
  }

  subscribeCommands(matchId, uid, callback) {
    const api = this.requireApi();
    const commandQuery = api.query(
      api.ref(this.db, `matches/${matchId}/commands/${uid}`),
      api.orderByKey(),
    );
    return api.onChildAdded(commandQuery, (snapshot) => callback(snapshot.key, snapshot.val()));
  }

  appendAcceptedCommand(matchId, command) {
    const api = this.requireApi();
    const key = String(command.seq).padStart(8, "0");
    return api.set(api.ref(this.db, `matches/${matchId}/acceptedCommands/${key}`), {
      ...command,
      createdAt: api.serverTimestamp(),
    });
  }

  publishCoopState(matchId, snapshot, sequence) {
    const api = this.requireApi();
    const uid = this.requireUser().uid;
    const players = Object.fromEntries(
      Object.entries(snapshot.players ?? {}).map(([side, player]) => [side, {
        locked: Boolean(player?.locked),
        piecesLocked: Math.max(0, Math.trunc(Number(player?.piecesLocked) || 0)),
        nextType: player?.nextType,
        current: player?.current
          ? {
              type: player.current.type,
              id: player.current.id,
              rotation: player.current.rotation,
              x: player.current.x,
              y: player.current.y,
            }
          : null,
      }]),
    );
    return api.set(api.ref(this.db, `matches/${matchId}/coopState`), {
      hostUid: uid,
      settled: snapshot.settled,
      players,
      score: snapshot.score,
      lines: snapshot.lines,
      level: snapshot.level,
      round: snapshot.round,
      topRow: snapshot.topRow,
      gameOver: snapshot.gameOver,
      elapsedMs: snapshot.elapsedMs,
      sequence,
      updatedAt: api.serverTimestamp(),
    });
  }

  subscribeLeaderboard(mode, callback, count = 20) {
    const api = this.requireApi();
    const orderKey = LEADERBOARD_ORDER[mode];
    if (!orderKey) throw new TypeError(`Unknown leaderboard mode: ${mode}`);
    const safeCount = Math.max(1, Math.min(50, Math.trunc(count) || 20));
    const boardQuery = api.query(
      api.ref(this.db, `leaderboards/${mode}`),
      api.orderByChild(orderKey),
      api.limitToLast(safeCount),
    );
    return api.onValue(boardQuery, (snapshot) => {
      const entries = objectValues(snapshot.val()).sort(
        (a, b) => (Number(b[orderKey]) || 0) - (Number(a[orderKey]) || 0),
      );
      callback(entries);
    });
  }

  dispose() {
    this.presenceUnsubscribe?.();
    this.offsetUnsubscribe?.();
    this.presenceUnsubscribe = null;
    this.offsetUnsubscribe = null;
  }
}


/* ===== modes/solo-mode.js ===== */
class SoloMode {
  constructor({ canvas, previewCanvas, seed, onUpdate, onGameOver }) {
    this.engine = new TetrisEngine({ seed });
    this.renderer = new BoardRenderer(canvas, { columns: 10, rows: 20, cellSize: 24 });
    this.preview = new PreviewRenderer(previewCanvas, { cellSize: 18 });
    this.onUpdate = onUpdate;
    this.onGameOver = onGameOver;
    this.startedAtPerformance = 0;
    this.animationFrame = 0;
    this.running = false;
    this.finished = false;

    this.engine.on("gameOver", (snapshot) => this.handleGameOver(snapshot));
  }

  start() {
    this.startedAtPerformance = performance.now();
    this.running = true;
    this.frame = this.frame.bind(this);
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (!this.running) return;
    const elapsed = Math.max(0, Math.trunc(now - this.startedAtPerformance));
    this.engine.advanceTo(elapsed);
    this.render();
    if (this.running) this.animationFrame = requestAnimationFrame(this.frame);
  }

  render() {
    const snapshot = this.engine.getSnapshot();
    this.renderer.draw(snapshot, { showActive: true, showGhost: false });
    this.preview.draw(snapshot.nextType);
    this.onUpdate?.(snapshot);
  }

  handleAction(action) {
    if (!this.running || this.engine.gameOver) return;
    const elapsed = Math.max(0, Math.trunc(performance.now() - this.startedAtPerformance));
    this.engine.applyAction(action, elapsed);
    this.render();
  }

  handleGameOver(snapshot) {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.render();
    this.onGameOver?.({
      snapshot,
      durationMs: snapshot.elapsedMs,
      inputLog: this.engine.exportInputLog(),
    });
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
  }
}

/* ===== modes/competitive-mode.js ===== */
class CompetitiveMode {
  constructor({
    service,
    matchId,
    match,
    localUid,
    ownCanvas,
    opponentCanvas,
    previewCanvas,
    onUpdate,
    onStatus,
    onFinished,
  }) {
    this.service = service;
    this.matchId = matchId;
    this.match = match;
    this.localUid = localUid;
    this.otherUid = Object.keys(match.members ?? {}).find((uid) => uid !== localUid) ?? null;
    this.startedAt = Number(match.startedAt) || service.serverNow();
    this.engine = new TetrisEngine({ seed: match.seed });
    this.ownRenderer = new BoardRenderer(ownCanvas, { columns: 10, rows: 20, cellSize: 24 });
    this.opponentRenderer = new BoardRenderer(opponentCanvas, { columns: 10, rows: 20, cellSize: 24 });
    this.preview = new PreviewRenderer(previewCanvas, { cellSize: 18 });
    this.onUpdate = onUpdate;
    this.onStatus = onStatus;
    this.onFinished = onFinished;
    this.running = false;
    this.finished = false;
    this.finishSubmitted = false;
    this.finishNotified = false;
    this.animationFrame = 0;
    this.publishSequence = 0;
    this.lastPublishAt = 0;
    this.opponentState = null;
    this.unsubscribeMatch = null;
    this.unsubscribePresence = null;
    this.disconnectTimer = null;
    this.opponentOffline = false;
    this.disconnectClaimPending = false;
    this.resultRetryTimer = null;
    this.resultRetryCount = 0;

    this.engine.on("lock", () => this.publishState());
    this.engine.on("gameOver", (snapshot) => this.handleOwnGameOver(snapshot));
  }

  start() {
    this.running = true;
    this.unsubscribeMatch = this.service.subscribeMatch(this.matchId, (match) => {
      if (!match) return;
      this.match = match;
      this.opponentState = this.otherUid
        ? match.competitiveState?.[this.otherUid] ?? null
        : null;
      if (match.status === "finished") {
        this.handleServerFinished(match);
      }
    });
    if (this.otherUid) {
      this.unsubscribePresence = this.service.subscribePresence(
        this.otherUid,
        (presence) => this.handleOpponentPresence(presence),
      );
    }
    this.frame = this.frame.bind(this);
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  elapsedNow() {
    return Math.trunc(this.service.serverNow() - this.startedAt);
  }

  frame() {
    if (!this.running) return;
    const elapsed = this.elapsedNow();
    if (elapsed <= 0) {
      this.onStatus?.(`Старт через ${Math.ceil(Math.abs(elapsed) / 1000)}`);
    } else {
      this.engine.advanceTo(elapsed);
      this.onStatus?.(
        this.opponentOffline
          ? "Соперник не в сети · ожидание переподключения"
          : "Соревновательный матч",
      );
    }
    this.render();
    if (elapsed - this.lastPublishAt >= 900) this.publishState();
    if (this.running) this.animationFrame = requestAnimationFrame(this.frame);
  }

  render() {
    const own = this.engine.getSnapshot();
    this.ownRenderer.draw(own, { showActive: true, showGhost: true });
    this.preview.draw(own.nextType);

    const opponent = this.opponentState ?? {
      settled: "0".repeat(200),
      score: 0,
      lines: 0,
      level: 1,
      topRow: 20,
    };
    this.opponentRenderer.draw(opponent, { showActive: false, fog: true });
    this.onUpdate?.({ own, opponent });
  }

  handleAction(action) {
    if (!this.running || this.engine.gameOver || this.elapsedNow() < 0) return;
    this.engine.applyAction(action, this.elapsedNow());
    this.render();
  }

  handleOpponentPresence(presence) {
    const connections = presence?.connections;
    const online = Boolean(
      connections
      && typeof connections === "object"
      && Object.keys(connections).length > 0,
    );
    this.opponentOffline = !online;

    if (online) {
      window.clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
      this.disconnectClaimPending = false;
      return;
    }

    if (this.disconnectTimer || this.finished) return;
    this.disconnectTimer = window.setTimeout(() => {
      this.disconnectTimer = null;
      void this.claimDisconnectedOpponent();
    }, 16500);
  }

  async claimDisconnectedOpponent() {
    if (this.finished || this.disconnectClaimPending || !this.opponentOffline) return;
    this.disconnectClaimPending = true;
    try {
      const response = await this.service.claimDisconnectResult(this.matchId);
      const result = response?.result ?? null;
      if (result) {
        this.handleServerFinished({ ...this.match, status: "finished", result });
      }
    } catch (error) {
      // A failed claim usually means that the player reconnected during the
      // grace period. Presence updates will re-arm the timer if needed.
      console.warn("Disconnect result claim failed", error);
    } finally {
      this.disconnectClaimPending = false;
    }
  }

  async publishState() {
    if (!this.running && !this.engine.gameOver) return;
    const snapshot = this.engine.getSnapshot();
    this.publishSequence += 1;
    this.lastPublishAt = snapshot.elapsedMs;
    try {
      await this.service.publishCompetitiveState(this.matchId, snapshot, this.publishSequence);
    } catch (error) {
      console.warn("Competitive state publish failed", error);
    }
  }

  async submitResult(gameOver) {
    if (this.finishSubmitted) return;
    this.finishSubmitted = true;
    const snapshot = this.engine.getSnapshot();
    try {
      const result = await this.service.finishCompetitiveMatch(
        this.matchId,
        snapshot.elapsedMs,
        this.engine.exportInputLog(),
        gameOver,
      );
      window.clearTimeout(this.resultRetryTimer);
      this.resultRetryTimer = null;
      this.resultRetryCount = 0;
      this.notifyFinished({ result, snapshot, match: this.match });
    } catch (error) {
      this.finishSubmitted = false;
      this.onStatus?.(error?.message || "Не удалось сохранить матч");
      console.error(error);
      if (gameOver && this.engine.gameOver && this.running && !this.finished) {
        const delay = Math.min(15000, 2000 * (2 ** Math.min(this.resultRetryCount, 3)));
        this.resultRetryCount += 1;
        window.clearTimeout(this.resultRetryTimer);
        this.resultRetryTimer = window.setTimeout(() => {
          this.resultRetryTimer = null;
          void this.submitResult(true);
        }, delay);
      }
    }
  }

  handleOwnGameOver() {
    if (this.finished) return;
    this.publishState();
    this.submitResult(true);
  }

  handleServerFinished(match) {
    if (this.finished) return;
    this.finished = true;
    this.match = match;
    if (!this.engine.gameOver) {
      this.engine.advanceTo(this.elapsedNow());
    }
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.render();

    // Submit the local replay once so the winner's maximum score can also be
    // included. Notification is idempotent because the realtime database update
    // and the local replay result can arrive in either order.
    void this.submitResult(this.engine.gameOver);
    this.notifyFinished({
      result: match.result ?? null,
      snapshot: this.engine.getSnapshot(),
      match,
    });
  }

  notifyFinished(context) {
    if (this.finishNotified) return;
    const result = context?.result?.result ?? context?.result ?? context?.match?.result ?? null;
    if (!result) return;
    this.finishNotified = true;
    this.onFinished?.(context);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.unsubscribeMatch?.();
    this.unsubscribePresence?.();
    window.clearTimeout(this.disconnectTimer);
    window.clearTimeout(this.resultRetryTimer);
    this.unsubscribeMatch = null;
    this.unsubscribePresence = null;
    this.disconnectTimer = null;
    this.resultRetryTimer = null;
  }
}

/* ===== modes/coop-mode.js ===== */
class CoopMode {
  constructor({
    service,
    matchId,
    match,
    localUid,
    canvas,
    onUpdate,
    onStatus,
    onFinished,
  }) {
    this.service = service;
    this.matchId = matchId;
    this.match = match;
    this.localUid = localUid;
    this.hostUid = match.hostUid;
    this.isHost = localUid === this.hostUid;
    this.localSide = match.members?.[localUid]?.side ?? SIDES.LEFT;
    this.otherUid = Object.keys(match.members ?? {}).find((uid) => uid !== localUid) ?? null;
    this.otherSide = match.members?.[this.otherUid]?.side ?? (this.localSide === SIDES.LEFT ? SIDES.RIGHT : SIDES.LEFT);
    this.startedAt = Number(match.startedAt) || service.serverNow();
    this.renderer = new BoardRenderer(canvas, { columns: 20, rows: 20, cellSize: 24 });
    this.engine = this.isHost ? new CoopEngine({ seed: match.seed }) : null;
    this.remoteSnapshot = null;
    this.onUpdate = onUpdate;
    this.onStatus = onStatus;
    this.onFinished = onFinished;
    this.running = false;
    this.finished = false;
    this.finishSubmitted = false;
    this.finishNotified = false;
    this.commandSequence = 0;
    this.acceptedSequence = 0;
    this.stateSequence = 0;
    this.lastStatePublish = 0;
    this.processedCommandKeys = new Set();
    this.animationFrame = 0;
    this.unsubscribeMatch = null;
    this.unsubscribeCommands = null;
    this.unsubscribePresence = null;
    this.disconnectTimer = null;
    this.partnerOffline = false;
    this.disconnectClaimPending = false;
    this.pendingCommandWrites = 0;
    this.gameOverPending = false;
    this.resultRetryTimer = null;
    this.resultRetryCount = 0;

    if (this.engine) {
      this.engine.on("lock", () => this.publishState(true));
      this.engine.on("gameOver", () => {
        this.gameOverPending = true;
      });
    }
  }

  start() {
    this.running = true;
    this.unsubscribeMatch = this.service.subscribeMatch(this.matchId, (match) => {
      if (!match) return;
      this.match = match;
      if (!this.isHost && match.coopState) {
        this.remoteSnapshot = this.normalizeRemoteState(match.coopState);
      }
      if (match.status === "finished") this.handleServerFinished(match);
    });

    if (this.isHost && this.otherUid) {
      this.unsubscribeCommands = this.service.subscribeCommands(
        this.matchId,
        this.otherUid,
        (key, command) => this.acceptRemoteCommand(key, command),
      );
    }
    if (this.otherUid) {
      this.unsubscribePresence = this.service.subscribePresence(
        this.otherUid,
        (presence) => this.handlePartnerPresence(presence),
      );
    }

    this.frame = this.frame.bind(this);
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  elapsedNow() {
    return Math.trunc(this.service.serverNow() - this.startedAt);
  }

  frame() {
    if (!this.running) return;
    const elapsed = this.elapsedNow();
    if (elapsed <= 0) {
      this.onStatus?.(`Старт через ${Math.ceil(Math.abs(elapsed) / 1000)}`);
    } else if (this.isHost) {
      this.engine.advanceTo(elapsed);
      if (elapsed - this.lastStatePublish >= 120) this.publishState(false);
      this.maybeFinishGame();
      this.onStatus?.(
        this.partnerOffline
          ? "Напарник не в сети · ожидание переподключения"
          : "Кооперативный матч · ведущий",
      );
    } else {
      this.onStatus?.(
        this.partnerOffline
          ? "Напарник не в сети · ожидание переподключения"
          : `Кооперативный матч · ${this.localSide === SIDES.LEFT ? "левая" : "правая"} половина`,
      );
    }
    this.render();
    if (this.running) this.animationFrame = requestAnimationFrame(this.frame);
  }

  handlePartnerPresence(presence) {
    const connections = presence?.connections;
    const online = Boolean(
      connections
      && typeof connections === "object"
      && Object.keys(connections).length > 0,
    );
    this.partnerOffline = !online;

    if (online) {
      window.clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
      this.disconnectClaimPending = false;
      return;
    }

    if (this.disconnectTimer || this.finished) return;
    this.disconnectTimer = window.setTimeout(() => {
      this.disconnectTimer = null;
      void this.claimDisconnectedPartner();
    }, 16500);
  }

  async claimDisconnectedPartner() {
    if (this.finished || this.disconnectClaimPending || !this.partnerOffline) return;
    this.disconnectClaimPending = true;
    try {
      const response = await this.service.claimDisconnectResult(this.matchId);
      const result = response?.result ?? null;
      if (result) {
        this.handleServerFinished({ ...this.match, status: "finished", result });
      }
    } catch (error) {
      console.warn("Cooperative disconnect result claim failed", error);
    } finally {
      this.disconnectClaimPending = false;
    }
  }

  normalizeRemoteState(state) {
    return {
      mode: "coop",
      columns: 20,
      rows: 20,
      laneWidth: 10,
      settled: state.settled,
      players: state.players ?? {},
      score: Number(state.score) || 0,
      lines: Number(state.lines) || 0,
      level: Number(state.level) || 1,
      round: Number(state.round) || 1,
      topRow: Number(state.topRow) || 20,
      gameOver: Boolean(state.gameOver),
      elapsedMs: Number(state.elapsedMs) || 0,
    };
  }

  render() {
    const snapshot = this.isHost
      ? this.engine.getSnapshot()
      : this.remoteSnapshot ?? {
          mode: "coop",
          columns: 20,
          rows: 20,
          laneWidth: 10,
          settled: "0".repeat(400),
          players: {},
          score: 0,
          lines: 0,
          level: 1,
          round: 1,
          gameOver: false,
          elapsedMs: 0,
        };
    const waitingSides = Object.entries(snapshot.players ?? {})
      .filter(([, player]) => player?.locked)
      .map(([side]) => side);
    this.renderer.draw(snapshot, {
      showActive: true,
      showGhost: this.isHost,
      dividerX: 10,
      localSide: this.localSide,
      waitingSides,
    });
    this.onUpdate?.({ snapshot, localSide: this.localSide, isHost: this.isHost });
  }

  async handleAction(action) {
    if (!this.running || this.elapsedNow() < 0) return;
    const snapshot = this.isHost ? this.engine?.getSnapshot() : this.remoteSnapshot;
    if (snapshot?.players?.[this.localSide]?.locked || snapshot?.gameOver) return;
    this.commandSequence += 1;
    const atMs = this.elapsedNow();

    if (this.isHost) {
      this.pendingCommandWrites += 1;
      try {
        this.engine.applyAction(this.localSide, action, atMs);
        this.acceptedSequence += 1;
        await Promise.allSettled([
          this.service.appendRawCommand(this.matchId, this.commandSequence, action, atMs),
          this.service.appendAcceptedCommand(this.matchId, {
            seq: this.acceptedSequence,
            uid: this.localUid,
            side: this.localSide,
            action,
            atMs: this.engine.elapsedMs,
          }),
        ]);
        this.publishState(true);
        this.render();
      } finally {
        this.pendingCommandWrites -= 1;
        this.maybeFinishGame();
      }
      return;
    }

    try {
      await this.service.appendRawCommand(this.matchId, this.commandSequence, action, atMs);
    } catch (error) {
      console.warn("Command publish failed", error);
      this.onStatus?.("Команда не отправлена: проверьте соединение");
    }
  }

  async acceptRemoteCommand(key, command) {
    if (!this.isHost || !this.running || this.processedCommandKeys.has(key)) return;
    this.processedCommandKeys.add(key);
    const action = command?.action;
    const reportedAt = Math.max(0, Math.trunc(Number(command?.atMs) || 0));
    const acceptedAt = Math.max(
      this.engine.elapsedMs,
      Math.min(this.elapsedNow(), reportedAt),
    );
    this.pendingCommandWrites += 1;
    try {
      this.engine.applyAction(this.otherSide, action, acceptedAt);
      this.acceptedSequence += 1;
      await this.service.appendAcceptedCommand(this.matchId, {
        seq: this.acceptedSequence,
        uid: this.otherUid,
        side: this.otherSide,
        action,
        atMs: this.engine.elapsedMs,
      });
      this.publishState(true);
    } catch (error) {
      console.warn("Remote command rejected", error);
    } finally {
      this.pendingCommandWrites -= 1;
      this.maybeFinishGame();
    }
  }

  async publishState(force) {
    if (!this.isHost || !this.engine) return;
    const snapshot = this.engine.getSnapshot();
    if (!force && snapshot.elapsedMs - this.lastStatePublish < 120) return;
    this.lastStatePublish = snapshot.elapsedMs;
    this.stateSequence += 1;
    try {
      await this.service.publishCoopState(this.matchId, snapshot, this.stateSequence);
    } catch (error) {
      console.warn("Cooperative state publish failed", error);
    }
  }

  maybeFinishGame() {
    if (this.gameOverPending && this.pendingCommandWrites === 0) {
      this.handleGameOver();
    }
  }

  async handleGameOver() {
    if (!this.isHost || this.finishSubmitted) return;
    this.gameOverPending = false;
    this.finishSubmitted = true;
    this.publishState(true);
    try {
      const result = await this.service.finishCoopMatch(
        this.matchId,
        this.engine.getSnapshot().elapsedMs,
      );
      window.clearTimeout(this.resultRetryTimer);
      this.resultRetryTimer = null;
      this.resultRetryCount = 0;
      this.notifyFinished({ result, snapshot: this.engine.getSnapshot(), match: this.match });
    } catch (error) {
      this.finishSubmitted = false;
      this.onStatus?.(error?.message || "Не удалось сохранить кооперативный матч");
      console.error(error);
      if (this.running && this.engine?.gameOver && !this.finished) {
        const delay = Math.min(15000, 2000 * (2 ** Math.min(this.resultRetryCount, 3)));
        this.resultRetryCount += 1;
        window.clearTimeout(this.resultRetryTimer);
        this.resultRetryTimer = window.setTimeout(() => {
          this.resultRetryTimer = null;
          void this.handleGameOver();
        }, delay);
      }
    }
  }

  handleServerFinished(match) {
    if (this.finished) return;
    this.finished = true;
    this.match = match;
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.render();
    this.notifyFinished({
      result: match.result ?? null,
      snapshot: this.isHost ? this.engine.getSnapshot() : this.remoteSnapshot,
      match,
    });
  }

  notifyFinished(context) {
    if (this.finishNotified) return;
    const result = context?.result?.result ?? context?.result ?? context?.match?.result ?? null;
    if (!result) return;
    this.finishNotified = true;
    this.onFinished?.(context);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.unsubscribeMatch?.();
    this.unsubscribeCommands?.();
    this.unsubscribePresence?.();
    window.clearTimeout(this.disconnectTimer);
    window.clearTimeout(this.resultRetryTimer);
    this.unsubscribeMatch = null;
    this.unsubscribeCommands = null;
    this.unsubscribePresence = null;
    this.disconnectTimer = null;
    this.resultRetryTimer = null;
  }
}

/* ===== app.js ===== */
const $ = (id) => document.getElementById(id);

const elements = {
  homeView: $("home-view"),
  lobbyView: $("lobby-view"),
  gameView: $("game-view"),
  networkShell: $("network-shell"),
  networkOpenButton: $("network-open-button"),
  homeLogo: $("home-logo"),
  connectionStatus: $("connection-status"),
  inviteCodeButton: $("invite-code-button"),
  inviteCodeValue: $("invite-code-value"),
  profileButton: $("profile-button"),
  profileName: $("profile-name"),
  leaderboardToggle: $("leaderboard-toggle"),
  leaderboardClose: $("leaderboard-close"),
  leaderboardDrawer: $("leaderboard-drawer"),
  drawerBackdrop: $("drawer-backdrop"),
  leaderboardList: $("leaderboard-list"),
  soloLeaderboardList: $("solo-leaderboard-list"),
  myRank: $("my-rank"),
  offlineBanner: $("offline-banner"),
  startSoloButton: $("start-solo-button"),
  joinLobbyForm: $("join-lobby-form"),
  joinCodeInput: $("join-code-input"),
  joinLobbyButton: $("join-lobby-button"),
  lobbyCodeLabel: $("lobby-code-label"),
  leaveLobbyButton: $("leave-lobby-button"),
  lobbyLayout: $("lobby-layout"),
  chatList: $("chat-list"),
  chatCounter: $("chat-counter"),
  chatForm: $("chat-form"),
  chatInput: $("chat-input"),
  lobbyStatusBadge: $("lobby-status-badge"),
  memberLeft: $("member-left"),
  memberRight: $("member-right"),
  modeFieldset: $("mode-fieldset"),
  readyButton: $("ready-button"),
  startMatchButton: $("start-match-button"),
  lobbyHint: $("lobby-hint"),
  gameModeKicker: $("game-mode-kicker"),
  gameModeTitle: $("game-mode-title"),
  gameScore: $("game-score"),
  gameLines: $("game-lines"),
  gameLevel: $("game-level"),
  gameTime: $("game-time"),
  gameExitButton: $("game-exit-button"),
  compactPreviewWrap: $("compact-preview-wrap"),
  statsPanel: $("stats"),
  soloShell: $("solo-shell"),
  networkMatchShell: $("network-match-shell"),
  soloPreviewSlot: $("solo-preview-slot"),
  soloStatsSlot: $("solo-stats-slot"),
  networkPreviewSlot: $("network-preview-slot"),
  networkStatsSlot: $("network-stats-slot"),
  soloLayout: $("solo-layout"),
  competitiveLayout: $("competitive-layout"),
  coopLayout: $("coop-layout"),
  competitiveOwnName: $("competitive-own-name"),
  competitiveOpponentName: $("competitive-opponent-name"),
  competitiveOwnScore: $("competitive-own-score"),
  competitiveOpponentScore: $("competitive-opponent-score"),
  coopRound: $("coop-round"),
  coopSide: $("coop-side"),
  profileDialog: $("profile-dialog"),
  profileForm: $("profile-form"),
  profileNameInput: $("profile-name-input"),
  profileError: $("profile-error"),
  waitingPlayerName: $("waiting-player-name"),
  resultDialog: $("result-dialog"),
  resultIcon: $("result-icon"),
  resultKicker: $("result-kicker"),
  resultTitle: $("result-title"),
  resultDescription: $("result-description"),
  resultScore: $("result-score"),
  resultLines: $("result-lines"),
  resultTime: $("result-time"),
  resultVerification: $("result-verification"),
  resultPrimaryButton: $("result-primary-button"),
  resultPublishButton: $("result-publish-button"),
  resultSecondaryButton: $("result-secondary-button"),
  toast: $("toast"),
};

const state = {
  service: new FirebaseService(APP_CONFIG),
  controls: null,
  firebaseReady: false,
  firebaseCoreReady: false,
  firebaseDiagnostic: "Firebase ещё не подключён.",
  user: null,
  profile: null,
  currentView: "home",
  activeMode: null,
  activeModeName: null,
  soloSession: null,
  lobbyId: null,
  lobby: null,
  currentMatchId: null,
  startedMatchId: null,
  resultShownFor: new Set(),
  selectedLeaderboard: "solo",
  leaderboards: { solo: [], competitive: [], coop: [] },
  unsubUserLobby: null,
  unsubLobby: null,
  unsubChat: null,
  unsubMatchLoader: null,
  resultPrimaryAction: null,
  resultPublishAction: null,
  resultSecondaryAction: null,
  pendingSoloPublication: null,
  profileSubmitPurpose: "profile",
  toastTimer: null,
};

function clearLegacyFalseBans() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem("tetris_banned_v2");
  }
  document.cookie = "tetris_banned_v2=; Max-Age=0; path=/; SameSite=Lax";
}

function randomLocalSeed() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || 1;
}

function setConnection(kind, text) {
  elements.connectionStatus.className = `connection-status is-${kind}`;
  elements.connectionStatus.querySelector(".status-text").textContent = text;
}

function showView(name) {
  state.currentView = name;
  const networkVisible = name === "home" || name === "lobby";
  elements.networkShell.hidden = !networkVisible;
  elements.homeView.hidden = name !== "home";
  elements.lobbyView.hidden = name !== "lobby";
  elements.gameView.hidden = name !== "game";
  elements.networkOpenButton.hidden = name !== "game" || elements.gameView.dataset.mode !== "solo";
  if (name !== "game") state.controls.setEnabled(false);
}

function showHome({ stopGame = true } = {}) {
  if (stopGame) stopActiveMode();
  closeLeaderboard();
  showView("home");
}

function friendlyError(error) {
  const message = String(error?.message ?? error ?? "Неизвестная ошибка")
    .replace(/^FirebaseError:\s*/i, "")
    .trim();
  return message || "Неизвестная ошибка";
}

function firebaseDiagnostic(error, stage = "Firebase") {
  const code = String(error?.code ?? "").toLowerCase();
  const message = friendlyError(error);
  const host = location.hostname || "текущий домен";

  if (APP_CONFIG.forceOffline) {
    return "Локальный режим включён параметром ?offline=1 или ?demo=1. Удалите его из адреса страницы.";
  }
  if (code.includes("auth/operation-not-allowed")) {
    return "В Firebase Console включите Authentication → Sign-in method → Anonymous.";
  }
  if (code.includes("auth/unauthorized-domain")) {
    return `Добавьте домен ${host} в Firebase Authentication → Settings → Authorized domains.`;
  }
  if (code.includes("auth/too-many-requests")) {
    return "Firebase временно ограничил анонимные входы с этого IP. Подождите или проверьте квоты Authentication.";
  }
  if (/not found|404/i.test(message)) {
    return "Запрашиваемые данные Firebase не найдены. Проверьте URL Realtime Database и опубликованные правила.";
  }
  if (/permission_denied|permission denied/i.test(message) && stage === "presence") {
    return "Firebase Auth работает, но правила Realtime Database запрещают запись presence. Опубликуйте актуальные rules и обновите страницу.";
  }
  if (code.includes("permission-denied") || /permission_denied|permission denied/i.test(message)) {
    return "Firebase отклонил операцию. Опубликуйте database.rules.json и проверьте Anonymous Authentication.";
  }
  if (/failed to fetch|load firebase sdk|network request failed|network-error/i.test(message)) {
    return "Не удалось загрузить Firebase SDK или обратиться к Firebase. Проверьте интернет, блокировщики и доступ к www.gstatic.com.";
  }
  return `${stage}: ${message}`;
}

function setFirebaseUnavailable(message) {
  state.firebaseReady = false;
  state.firebaseDiagnostic = message;
  elements.offlineBanner.textContent = message;
  elements.offlineBanner.hidden = false;
  setConnection("offline", "Firebase недоступен");
}

function showToast(message, { error = false, duration = 3300 } = {}) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", error);
  elements.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, duration);
}

function setBusy(button, busy, busyText = "Подождите…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
}

function configureProfileDialog(purpose = "profile") {
  const publishing = purpose === "publish-solo";
  state.profileSubmitPurpose = publishing ? "publish-solo" : "profile";
  const title = elements.profileDialog.querySelector("h2");
  const hint = elements.profileDialog.querySelector(".modal-content > p");
  if (title) title.textContent = publishing ? "Опубликовать результат" : "Имя игрока";
  if (hint) hint.textContent = publishing
    ? "Введите никнейм для таблицы рекордов (2–12 символов)."
    : "От 2 до 12 символов.";
}

function cancelSoloPublicationName() {
  if (state.profileSubmitPurpose !== "publish-solo") return false;
  configureProfileDialog("profile");
  closeDialog(elements.profileDialog);
  openDialog(elements.resultDialog);
  return true;
}

function renderIdentity() {
  const name = state.profile?.name ?? "Гость";
  elements.profileName.textContent = name;
  elements.inviteCodeValue.textContent = state.profile?.inviteCode ?? "———";
  elements.inviteCodeButton.disabled = !state.profile?.inviteCode;
  if (elements.waitingPlayerName) elements.waitingPlayerName.textContent = `${name} (вы)`;
}

function updateGameStats(snapshot) {
  elements.gameScore.textContent = formatScore(snapshot?.score);
  elements.gameLines.textContent = formatScore(snapshot?.lines);
  elements.gameLevel.textContent = formatScore(snapshot?.level || 1);
  elements.gameTime.textContent = formatDuration(snapshot?.elapsedMs);
}

function configureGameLayout(mode) {
  elements.gameView.dataset.mode = mode;
  elements.soloLayout.hidden = mode !== "solo";
  elements.competitiveLayout.hidden = mode !== "competitive";
  elements.coopLayout.hidden = mode !== "coop";
  elements.compactPreviewWrap.hidden = mode === "coop";
  elements.gameExitButton.hidden = mode === "solo";

  if (mode === "solo") {
    elements.soloPreviewSlot.append(elements.compactPreviewWrap);
    elements.soloStatsSlot.append(elements.statsPanel);
  } else {
    if (mode !== "coop") elements.networkPreviewSlot.append(elements.compactPreviewWrap);
    elements.networkStatsSlot.append(elements.statsPanel);
  }

  elements.networkOpenButton.hidden = state.currentView !== "game" || mode !== "solo";
}

function stopActiveMode() {
  state.activeMode?.stop?.();
  state.activeMode = null;
  state.activeModeName = null;
  state.controls?.setHandler(null);
  state.controls?.setEnabled(false);
}

async function startSolo() {
  state.pendingSoloPublication = null;
  configureProfileDialog("profile");
  stopActiveMode();
  closeDialog(elements.resultDialog);
  closeLeaderboard();
  state.selectedLeaderboard = "solo";
  for (const tab of document.querySelectorAll("[data-leaderboard-tab]")) {
    tab.classList.toggle("is-active", tab.dataset.leaderboardTab === "solo");
  }
  renderLeaderboard();
  let session;
  if (state.firebaseReady) {
    setBusy(elements.startSoloButton, true, "Создание…");
    try {
      session = await state.service.startSoloGame();
    } catch (error) {
      console.warn("Firebase solo session unavailable, using local mode", error);
      showToast("Firebase недоступен. Игра запущена без сохранения рекорда.", { error: true });
    } finally {
      setBusy(elements.startSoloButton, false);
    }
  }
  state.soloSession = session ?? {
    sessionId: null,
    seed: randomLocalSeed(),
    offline: true,
  };

  configureGameLayout("solo");
  elements.gameModeKicker.textContent = "SOLO";
  elements.gameModeTitle.textContent = "Одиночная игра";
  updateGameStats({ score: 0, lines: 0, level: 1, elapsedMs: 0 });
  showView("game");

  const mode = new SoloMode({
    canvas: $("solo-board"),
    previewCanvas: $("next-preview"),
    seed: state.soloSession.seed,
    onUpdate: updateGameStats,
    onGameOver: handleSoloGameOver,
  });
  state.activeMode = mode;
  state.activeModeName = "solo";
  state.controls.setHandler((action) => mode.handleAction(action));
  state.controls.setEnabled(true);
  mode.start();
}

async function handleSoloGameOver({ snapshot, durationMs, inputLog }) {
  state.controls.setEnabled(false);
  const canPublish = Boolean(state.soloSession?.sessionId && state.firebaseReady);
  state.pendingSoloPublication = canPublish
    ? {
        sessionId: state.soloSession.sessionId,
        snapshot,
        durationMs,
        inputLog,
      }
    : null;

  showResult({
    kicker: "GAME OVER",
    title: "Игра окончена",
    description: canPublish
      ? "Результат готов к публикации. Нажмите кнопку и укажите никнейм."
      : "Локальная партия завершена. Рекорд не будет сохранён в Firebase.",
    snapshot,
    verification: "neutral",
    verificationText: canPublish ? "Результат ещё не опубликован" : "Локальный режим",
    primaryText: "Play Again",
    publishText: "Опубликовать результат",
    secondaryText: "Сетевая игра",
    primaryAction: startSolo,
    publishAction: canPublish ? beginSoloPublication : null,
    secondaryAction: () => showHome(),
  });
}

function beginSoloPublication() {
  if (!state.pendingSoloPublication || !state.firebaseReady) {
    showToast(state.firebaseDiagnostic || "Firebase недоступен.", { error: true, duration: 6000 });
    return;
  }
  closeDialog(elements.resultDialog);
  configureProfileDialog("publish-solo");
  const currentName = sanitizeName(
    state.profile?.name ?? localStorage.getItem("tetris_player_name_v3") ?? "",
  );
  elements.profileNameInput.value = currentName.startsWith("Игрок") ? "" : currentName;
  elements.profileError.textContent = "";
  openDialog(elements.profileDialog);
  elements.profileNameInput.focus();
  elements.profileNameInput.select?.();
}

async function publishPendingSoloResult() {
  const pending = state.pendingSoloPublication;
  if (!pending) throw new Error("Нет результата для публикации.");
  const result = await state.service.finishSoloGame(
    pending.sessionId,
    pending.durationMs,
    pending.inputLog,
  );
  state.pendingSoloPublication = null;
  configureProfileDialog("profile");
  elements.resultDescription.textContent = result.published
    ? "Результат воспроизведён локально и опубликован в таблице рекордов."
    : "Ваш предыдущий личный рекорд выше. Таблица рекордов не изменена.";
  setVerification(
    "success",
    result.published
      ? `Опубликовано · ${formatScore(result.score)} очков`
      : `Личный рекорд сохранён без изменений`,
  );
  elements.resultPublishButton.hidden = true;
  return result;
}

function showResult({
  kicker,
  title,
  description,
  snapshot,
  verification,
  verificationText,
  primaryText,
  publishText = "Опубликовать результат",
  secondaryText,
  primaryAction,
  publishAction = null,
  secondaryAction,
  icon = "▦",
}) {
  elements.resultIcon.textContent = icon;
  elements.resultKicker.textContent = kicker;
  elements.resultTitle.textContent = title;
  elements.resultDescription.textContent = description;
  elements.resultScore.textContent = formatScore(snapshot?.score);
  elements.resultLines.textContent = formatScore(snapshot?.lines);
  elements.resultTime.textContent = formatDuration(snapshot?.elapsedMs ?? snapshot?.durationMs);
  elements.resultPrimaryButton.textContent = primaryText;
  elements.resultPublishButton.textContent = publishText;
  elements.resultPublishButton.hidden = typeof publishAction !== "function";
  elements.resultSecondaryButton.textContent = secondaryText;
  state.resultPrimaryAction = primaryAction;
  state.resultPublishAction = publishAction;
  state.resultSecondaryAction = secondaryAction;
  setVerification(verification, verificationText);
  openDialog(elements.resultDialog);
}

function setVerification(kind, text) {
  const classKind = kind === "success" ? "success" : kind === "error" ? "error" : "pending";
  elements.resultVerification.className = `verification-status is-${classKind}`;
  elements.resultVerification.querySelector("span:last-child").textContent = text;
  if (kind === "neutral") {
    elements.resultVerification.className = "verification-status";
  }
}

async function enterLobby(lobbyId) {
  if (!lobbyId || lobbyId === state.lobbyId) return;
  cleanupLobbySubscriptions();
  state.lobbyId = lobbyId;
  state.lobby = null;
  if (state.currentView !== "game") showView("lobby");

  state.unsubLobby = state.service.subscribeLobby(lobbyId, (lobby) => {
    if (!lobby) {
      void state.service.clearOwnLobbyPointer(lobbyId).catch((error) => {
        console.warn("Stale lobby pointer cleanup failed", error);
      });
      state.lobbyId = null;
      state.lobby = null;
      cleanupLobbySubscriptions();
      if (state.currentView !== "game") showHome({ stopGame: false });
      return;
    }
    state.lobby = lobby;
    renderLobby(lobby);
    if (lobby.matchId && lobby.matchId !== state.startedMatchId) {
      loadMatch(lobby.matchId);
    }
  });

  state.unsubChat = state.service.subscribeChat(lobbyId, renderChat);
}

function cleanupLobbySubscriptions() {
  state.unsubLobby?.();
  state.unsubChat?.();
  state.unsubLobby = null;
  state.unsubChat = null;
}

function renderMemberCard(card, member, uid) {
  const name = card.querySelector(".member-name");
  const ready = card.querySelector(".member-ready");
  if (!member) {
    name.textContent = "Ожидание игрока…";
    ready.textContent = "Не подключён";
    card.classList.remove("is-ready");
    return;
  }
  name.textContent = `${member.name || "Игрок"}${uid === state.user?.uid ? " (вы)" : ""}`;
  ready.textContent = member.ready ? "Готов" : "Не готов";
  card.classList.toggle("is-ready", member.ready === true);
}

function renderLobby(lobby) {
  elements.lobbyCodeLabel.textContent = lobby.code ?? state.profile?.inviteCode ?? "———";
  const entries = Object.entries(lobby.members ?? {});
  const leftEntry = entries.find(([, member]) => member.side === "left") ?? entries[0];
  const rightEntry = entries.find(([, member]) => member.side === "right") ?? entries[1];
  renderMemberCard(elements.memberLeft, leftEntry?.[1], leftEntry?.[0]);
  renderMemberCard(elements.memberRight, rightEntry?.[1], rightEntry?.[0]);

  const isHost = lobby.hostUid === state.user?.uid;
  const localMember = lobby.members?.[state.user?.uid];
  const allMembers = Object.values(lobby.members ?? {});
  const allReady = allMembers.length === 2 && allMembers.every((member) => member.ready === true);
  const anyReady = allMembers.some((member) => member.ready === true);
  const configuring = lobby.status === "configuring";

  for (const input of document.querySelectorAll('input[name="lobby-mode"]')) {
    input.checked = input.value === lobby.mode;
    input.disabled = !isHost || !configuring || anyReady;
  }
  elements.modeFieldset.disabled = !isHost || !configuring || anyReady;
  elements.readyButton.disabled = !configuring || allMembers.length !== 2;
  elements.readyButton.textContent = localMember?.ready ? "Отменить готовность" : "Я готов";
  elements.startMatchButton.hidden = !isHost;
  elements.startMatchButton.disabled = !isHost || !configuring || !allReady;
  elements.lobbyStatusBadge.textContent = lobby.status === "playing"
    ? "Матч"
    : lobby.status === "starting"
      ? "Запуск"
      : "Настройка";
  elements.lobbyHint.textContent = lobby.status === "playing" || lobby.status === "starting"
    ? "Матч уже запускается."
    : !isHost
      ? "Выберите готовность и дождитесь запуска создателем лобби."
      : anyReady && !allReady
        ? "Ожидаем готовность второго игрока."
        : allReady
          ? "Оба игрока готовы — можно начинать."
          : "Сначала выберите режим, затем оба игрока нажимают «Я готов».";
}

function renderChat(messages) {
  const nearBottom = elements.chatList.scrollHeight - elements.chatList.scrollTop - elements.chatList.clientHeight < 70;
  elements.chatList.replaceChildren();
  elements.chatCounter.textContent = `${messages.length} / 50`;
  if (!messages.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Сообщений пока нет.";
    elements.chatList.append(empty);
    return;
  }

  for (const message of messages) {
    const item = document.createElement("li");
    item.className = `chat-message${message.uid === state.user?.uid ? " is-own" : ""}`;
    const header = document.createElement("header");
    const name = document.createElement("strong");
    const time = document.createElement("time");
    const text = document.createElement("p");
    name.textContent = message.name || "Игрок";
    time.textContent = message.timestamp
      ? new Date(message.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : "сейчас";
    text.textContent = message.text || "";
    header.append(name, time);
    item.append(header, text);
    elements.chatList.append(item);
  }
  if (nearBottom) elements.chatList.scrollTop = elements.chatList.scrollHeight;
}

function loadMatch(matchId) {
  state.unsubMatchLoader?.();
  let unsubscribe = () => {};
  unsubscribe = state.service.subscribeMatch(matchId, (match) => {
    if (!match || state.startedMatchId === matchId) return;
    unsubscribe();
    state.unsubMatchLoader = null;
    startNetworkMatch(matchId, match);
  });
  state.unsubMatchLoader = unsubscribe;
}

function startNetworkMatch(matchId, match) {
  stopActiveMode();
  closeDialog(elements.resultDialog);
  state.currentMatchId = matchId;
  state.startedMatchId = matchId;
  showView("game");

  const localUid = state.user.uid;
  const otherUid = Object.keys(match.members ?? {}).find((uid) => uid !== localUid);
  const localName = match.members?.[localUid]?.name ?? state.profile?.name ?? "Игрок";
  const otherName = match.members?.[otherUid]?.name ?? "Противник";

  if (match.mode === "competitive") {
    configureGameLayout("competitive");
    elements.gameModeKicker.textContent = "1 VS 1";
    elements.gameModeTitle.textContent = "Соревновательный матч";
    elements.competitiveOwnName.textContent = localName;
    elements.competitiveOpponentName.textContent = otherName;
    elements.competitiveOwnScore.textContent = "0";
    elements.competitiveOpponentScore.textContent = "0";

    const mode = new CompetitiveMode({
      service: state.service,
      matchId,
      match,
      localUid,
      ownCanvas: $("competitive-own-board"),
      opponentCanvas: $("competitive-opponent-board"),
      previewCanvas: $("next-preview"),
      onUpdate: ({ own, opponent }) => {
        updateGameStats(own);
        elements.competitiveOwnScore.textContent = formatScore(own.score);
        elements.competitiveOpponentScore.textContent = formatScore(opponent.score);
      },
      onStatus: (status) => {
        elements.gameModeKicker.textContent = String(status).toUpperCase().slice(0, 30);
      },
      onFinished: (context) => handleNetworkResult("competitive", matchId, context),
    });
    state.activeMode = mode;
    state.activeModeName = "competitive";
    state.controls.setHandler((action) => mode.handleAction(action));
    state.controls.setEnabled(true);
    mode.start();
    return;
  }

  configureGameLayout("coop");
  elements.gameModeKicker.textContent = "CO-OP";
  elements.gameModeTitle.textContent = "Общее поле 20×20";
  elements.coopRound.textContent = "1";
  const localSide = match.members?.[localUid]?.side ?? "left";
  elements.coopSide.textContent = localSide === "left" ? "левая" : "правая";

  const mode = new CoopMode({
    service: state.service,
    matchId,
    match,
    localUid,
    canvas: $("coop-board"),
    onUpdate: ({ snapshot, localSide: side }) => {
      updateGameStats(snapshot);
      elements.coopRound.textContent = String(snapshot.round || 1);
      elements.coopSide.textContent = side === "left" ? "левая" : "правая";
    },
    onStatus: (status) => {
      elements.gameModeKicker.textContent = String(status).toUpperCase().slice(0, 34);
    },
    onFinished: (context) => handleNetworkResult("coop", matchId, context),
  });
  state.activeMode = mode;
  state.activeModeName = "coop";
  state.controls.setHandler((action) => mode.handleAction(action));
  state.controls.setEnabled(true);
  mode.start();
}

function extractMatchResult(context) {
  return context?.result?.result ?? context?.result ?? context?.match?.result ?? null;
}

function handleNetworkResult(mode, matchId, context) {
  if (state.resultShownFor.has(matchId)) return;
  const result = extractMatchResult(context);
  if (!result && mode === "competitive") return;
  state.resultShownFor.add(matchId);
  state.controls.setEnabled(false);
  state.activeMode?.stop?.();

  const snapshot = context?.snapshot ?? {
    score: result?.score ?? 0,
    lines: result?.lines ?? 0,
    elapsedMs: result?.durationMs ?? 0,
  };
  let title;
  let description;
  let icon;

  if (mode === "competitive") {
    const won = result?.winnerUid === state.user.uid;
    const disconnected = result?.reason === "disconnect";
    title = won ? "Победа" : "Поражение";
    icon = won ? "★" : "×";
    if (disconnected) {
      description = won
        ? "Соперник не переподключился за отведённое время. Победа учтена в рейтинге."
        : "Соединение с матчем было потеряно. Сервер присудил техническое поражение.";
    } else {
      description = won
        ? "Противник достиг верхней границы. Победа добавлена в отдельный рейтинг."
        : "Ваше поле достигло верхней границы. Результат записан в Firebase.";
    }
  } else {
    title = "Совместная партия завершена";
    icon = "∞";
    description = result?.outcome === "team-disconnected"
      ? "Один из игроков не переподключился. Партия завершена без обновления кооперативного рейтинга."
      : "Одна из половин достигла верхней границы. Максимальный общий результат обновлён.";
  }

  showResult({
    kicker: mode === "competitive" ? "MATCH FINISHED" : "CO-OP FINISHED",
    title,
    description,
    snapshot,
    verification: "success",
    verificationText: "Результат сохранён в Firebase Spark",
    primaryText: "Вернуться в лобби",
    secondaryText: "Покинуть лобби",
    primaryAction: () => {
      if (state.lobbyId) showView("lobby");
      else showHome();
    },
    secondaryAction: async () => {
      try {
        if (state.firebaseReady && state.lobbyId) await state.service.leaveLobby();
      } catch (error) {
        showToast(friendlyError(error), { error: true });
      }
      state.lobbyId = null;
      state.lobby = null;
      await startSolo();
    },
    icon,
  });
}

function renderLeaderboardInto(list, mode, entries, { compact = false } = {}) {
  if (!list) return;
  list.replaceChildren();
  const visibleEntries = compact ? entries.slice(0, 6) : entries;

  if (!visibleEntries.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = state.firebaseReady ? "Записей пока нет." : "Loading...";
    list.append(empty);
    return;
  }

  visibleEntries.forEach((entry, index) => {
    const isMe = mode === "coop"
      ? Array.isArray(entry.memberUids) && entry.memberUids.includes(state.user?.uid)
      : entry.uid === state.user?.uid || entry.id === state.user?.uid;

    if (compact && mode === "solo") {
      const item = document.createElement("li");
      item.className = "classic-entry";
      item.classList.toggle("is-me", isMe);
      const name = document.createElement("span");
      const score = document.createElement("span");
      const meta = document.createElement("span");
      const date = entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : "—";
      const time = entry.playTimeMs ? `${Math.round(entry.playTimeMs / 1000)}s` : "";
      name.className = "lb-name";
      score.className = "lb-score";
      meta.className = "lb-meta";
      name.textContent = `#${index + 1} ${entry.name || "Anon"}`;
      score.textContent = formatScore(entry.score);
      meta.textContent = `${date} · L${formatScore(entry.level || 1)} · ${formatScore(entry.lines)}ln${time ? ` · ${time}` : ""}`;
      item.append(name, document.createTextNode(" "), score, meta);
      list.append(item);
      return;
    }

    const item = document.createElement("li");
    item.className = "leaderboard-entry";
    item.classList.toggle("is-me", isMe);

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = `#${index + 1}`;
    const player = document.createElement("span");
    player.className = "leaderboard-player";
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const value = document.createElement("span");
    value.className = "leaderboard-value";

    if (mode === "solo") {
      name.textContent = entry.name || "Игрок";
      meta.textContent = `${formatScore(entry.lines)} линий · уровень ${formatScore(entry.level)}`;
      value.textContent = formatScore(entry.score);
    } else if (mode === "competitive") {
      name.textContent = entry.name || "Игрок";
      meta.textContent = `${formatScore(entry.losses)} поражений`;
      value.textContent = `${formatScore(entry.wins)} (${formatScore(entry.maxScore)})`;
    } else {
      name.textContent = `${entry.player1Name || "Игрок 1"} + ${entry.player2Name || "Игрок 2"}`;
      meta.textContent = `${formatScore(entry.matches)} совместных партий`;
      value.textContent = formatScore(entry.maxScore);
    }

    player.append(name, meta);
    item.append(rank, player, value);
    list.append(item);
  });
}

function renderLeaderboard() {
  const soloEntries = state.leaderboards.solo ?? [];
  renderLeaderboardInto(elements.soloLeaderboardList, "solo", soloEntries, { compact: true });

  const selectedEntries = state.leaderboards[state.selectedLeaderboard] ?? [];
  renderLeaderboardInto(elements.leaderboardList, state.selectedLeaderboard, selectedEntries);

  if (elements.myRank) {
    const myIndex = soloEntries.findIndex((entry) => entry.uid === state.user?.uid || entry.id === state.user?.uid);
    elements.myRank.replaceChildren();
    if (myIndex < 0) {
      elements.myRank.textContent = "Your place: —";
    } else {
      const place = document.createElement("span");
      const score = document.createElement("span");
      const name = document.createElement("span");
      place.className = "place";
      score.className = "score";
      name.className = "rank-name";
      place.textContent = `#${myIndex + 1}`;
      score.textContent = ` ${formatScore(soloEntries[myIndex].score)}`;
      name.textContent = ` (${soloEntries[myIndex].name || "Игрок"})`;
      elements.myRank.append(place, score, name);
    }
  }
}

function openLeaderboard() {
  elements.leaderboardDrawer.classList.add("is-open");
  elements.leaderboardDrawer.setAttribute("aria-hidden", "false");
  elements.leaderboardToggle.setAttribute("aria-expanded", "true");
  elements.drawerBackdrop.hidden = false;
}

function closeLeaderboard() {
  elements.leaderboardDrawer.classList.remove("is-open");
  elements.leaderboardDrawer.setAttribute("aria-hidden", "true");
  elements.leaderboardToggle.setAttribute("aria-expanded", "false");
  elements.drawerBackdrop.hidden = true;
}

function subscribeLeaderboards() {
  for (const mode of ["solo", "competitive", "coop"]) {
    state.service.subscribeLeaderboard(mode, (entries) => {
      state.leaderboards[mode] = entries;
      renderLeaderboard();
    });
  }
}

function bindEvents() {
  state.controls = new GameControls(document);

  elements.startSoloButton.addEventListener("click", startSolo);
  elements.homeLogo.addEventListener("click", startSolo);
  elements.networkOpenButton.addEventListener("click", () => {
    closeDialog(elements.resultDialog);
    stopActiveMode();
    if (state.lobbyId) showView("lobby");
    else showHome({ stopGame: false });
    if (!state.firebaseReady) {
      showToast(state.firebaseDiagnostic, { error: true, duration: 7000 });
    }
  });

  elements.gameExitButton.addEventListener("click", () => {
    if (state.activeModeName === "solo") {
      void startSolo();
      return;
    }
    if (state.currentMatchId && state.resultShownFor.has(state.currentMatchId)) {
      showView(state.lobbyId ? "lobby" : "home");
      return;
    }
    showToast("Во время сетевого матча выход отключён, чтобы не рассинхронизировать игру.", { error: true });
  });

  elements.profileButton.addEventListener("click", () => {
    configureProfileDialog("profile");
    elements.profileNameInput.value = state.profile?.name ?? localStorage.getItem("tetris_player_name_v3") ?? "";
    elements.profileError.textContent = "";
    openDialog(elements.profileDialog);
    elements.profileNameInput.focus();
  });

  for (const closeButton of document.querySelectorAll("[data-dialog-close]")) {
    closeButton.addEventListener("click", () => {
      const dialog = $(closeButton.dataset.dialogClose);
      if (dialog === elements.profileDialog && cancelSoloPublicationName()) return;
      closeDialog(dialog);
    });
  }

  elements.profileDialog.addEventListener("cancel", (event) => {
    if (state.profileSubmitPurpose !== "publish-solo") return;
    event.preventDefault();
    cancelSoloPublicationName();
  });

  elements.profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = sanitizeName(elements.profileNameInput.value);
    if (name.length < 2) {
      elements.profileError.textContent = "Имя слишком короткое.";
      return;
    }
    const submit = elements.profileForm.querySelector('button[type="submit"]');
    const publishingSolo = state.profileSubmitPurpose === "publish-solo";
    setBusy(submit, true, publishingSolo ? "Публикация…" : "Сохранение…");
    try {
      if (state.firebaseReady) {
        state.profile = await state.service.updateProfile(name);
      } else {
        state.profile = { ...(state.profile ?? {}), name };
      }
      localStorage.setItem("tetris_player_name_v3", name);
      renderIdentity();
      if (publishingSolo) {
        await publishPendingSoloResult();
        closeDialog(elements.profileDialog);
        openDialog(elements.resultDialog);
      } else {
        closeDialog(elements.profileDialog);
      }
    } catch (error) {
      elements.profileError.textContent = publishingSolo
        ? firebaseDiagnostic(error, "Публикация результата")
        : friendlyError(error);
    } finally {
      setBusy(submit, false);
    }
  });

  elements.inviteCodeButton.addEventListener("click", async () => {
    const code = state.profile?.inviteCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showToast(`Код ${code} скопирован.`);
    } catch {
      showToast(`Ваш код: ${code}`);
    }
  });

  elements.joinCodeInput.addEventListener("input", () => {
    const normalized = normalizeInviteCode(elements.joinCodeInput.value);
    if (elements.joinCodeInput.value !== normalized) elements.joinCodeInput.value = normalized;
  });

  elements.joinLobbyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.firebaseReady) {
      showToast(state.firebaseDiagnostic, { error: true, duration: 7000 });
      return;
    }
    const code = normalizeInviteCode(elements.joinCodeInput.value);
    if (code.length !== 6) {
      showToast("Введите шестизначный код игрока.", { error: true });
      return;
    }
    setBusy(elements.joinLobbyButton, true, "Вход…");
    try {
      const result = await state.service.joinLobbyByCode(code);
      elements.joinCodeInput.value = "";
      if (result.lobbyId) await enterLobby(result.lobbyId);
    } catch (error) {
      showToast(friendlyError(error), { error: true });
    } finally {
      setBusy(elements.joinLobbyButton, false);
    }
  });

  elements.leaveLobbyButton.addEventListener("click", async () => {
    if (!state.firebaseReady) return;
    setBusy(elements.leaveLobbyButton, true, "Выход…");
    try {
      await state.service.leaveLobby();
      state.lobbyId = null;
      state.lobby = null;
      cleanupLobbySubscriptions();
      await startSolo();
    } catch (error) {
      showToast(friendlyError(error), { error: true });
    } finally {
      setBusy(elements.leaveLobbyButton, false);
    }
  });

  elements.readyButton.addEventListener("click", async () => {
    if (!state.lobbyId || !state.lobby) return;
    const current = state.lobby.members?.[state.user.uid]?.ready === true;
    try {
      await state.service.setReady(state.lobbyId, !current);
    } catch (error) {
      showToast(friendlyError(error), { error: true });
    }
  });

  for (const modeInput of document.querySelectorAll('input[name="lobby-mode"]')) {
    modeInput.addEventListener("change", async () => {
      if (!modeInput.checked || !state.lobbyId) return;
      try {
        await state.service.setLobbyMode(state.lobbyId, modeInput.value);
      } catch (error) {
        showToast(friendlyError(error), { error: true });
      }
    });
  }

  elements.startMatchButton.addEventListener("click", async () => {
    if (!state.lobbyId) return;
    setBusy(elements.startMatchButton, true, "Запуск…");
    try {
      const result = await state.service.startMatch(state.lobbyId);
      if (result.matchId) loadMatch(result.matchId);
    } catch (error) {
      showToast(friendlyError(error), { error: true });
    } finally {
      setBusy(elements.startMatchButton, false);
      if (state.lobby) renderLobby(state.lobby);
    }
  });

  elements.chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = elements.chatInput.value.trim().slice(0, 300);
    if (!text || !state.lobbyId || !state.profile) return;
    elements.chatInput.value = "";
    try {
      await state.service.sendChat(state.lobbyId, state.profile, text);
    } catch (error) {
      elements.chatInput.value = text;
      showToast(friendlyError(error), { error: true });
    }
  });

  for (const tab of document.querySelectorAll("[data-lobby-tab]")) {
    tab.addEventListener("click", () => {
      for (const peer of document.querySelectorAll("[data-lobby-tab]")) peer.classList.toggle("is-active", peer === tab);
      elements.lobbyLayout.dataset.mobilePanel = tab.dataset.lobbyTab;
    });
  }

  elements.leaderboardToggle.addEventListener("click", openLeaderboard);
  elements.leaderboardClose.addEventListener("click", closeLeaderboard);
  elements.drawerBackdrop.addEventListener("click", closeLeaderboard);
  for (const tab of document.querySelectorAll("[data-leaderboard-tab]")) {
    tab.addEventListener("click", () => {
      state.selectedLeaderboard = tab.dataset.leaderboardTab;
      for (const peer of document.querySelectorAll("[data-leaderboard-tab]")) peer.classList.toggle("is-active", peer === tab);
      renderLeaderboard();
    });
  }

  elements.resultPrimaryButton.addEventListener("click", async () => {
    const action = state.resultPrimaryAction;
    closeDialog(elements.resultDialog);
    await action?.();
  });
  elements.resultPublishButton.addEventListener("click", async () => {
    const action = state.resultPublishAction;
    await action?.();
  });
  elements.resultSecondaryButton.addEventListener("click", async () => {
    const action = state.resultSecondaryAction;
    closeDialog(elements.resultDialog);
    await action?.();
  });

  window.addEventListener("offline", () => setConnection("offline", "Нет сети"));
  window.addEventListener("online", () => {
    if (state.firebaseReady) setConnection("online", "Firebase online");
    else setConnection("connecting", "Подключение…");
  });

  document.addEventListener("visibilitychange", () => {
    // The next animation frame advances the deterministic engine to the real elapsed time.
    if (!document.hidden && state.activeMode) {
      showToast("Игра продолжалась в фоне — состояние синхронизировано.", { duration: 1700 });
    }
  });
}

async function bootstrap() {
  clearLegacyFalseBans();
  bindEvents();

  state.profile = {
    name: sanitizeName(localStorage.getItem("tetris_player_name_v3")) || "Гость",
    inviteCode: null,
  };
  renderIdentity();
  renderLeaderboard();
  configureGameLayout("solo");
  showView("game");
  setConnection("connecting", "Подключение…");

  // The board starts immediately, just like the original lightweight page.
  // Firebase connects in parallel; the next solo round will then use a
  // client-side session and become eligible for the shared Firebase leaderboard.
  await startSolo();

  try {
    state.user = await state.service.initialize();
    state.firebaseCoreReady = true;
  } catch (error) {
    console.error("Firebase core initialization failed", error);
    state.service.dispose();
    state.profile = {
      name: sanitizeName(localStorage.getItem("tetris_player_name_v3")) || "Гость",
      inviteCode: null,
    };
    renderIdentity();
    const diagnostic = firebaseDiagnostic(error, "Инициализация Firebase");
    setFirebaseUnavailable(diagnostic);
    showToast(diagnostic, { error: true, duration: 8000 });
    return;
  }

  if (state.service.presenceError) {
    const diagnostic = firebaseDiagnostic(state.service.presenceError, "presence");
    setFirebaseUnavailable(diagnostic);
    showToast(diagnostic, { error: true, duration: 8000 });
    return;
  }

  try {
    const savedName = sanitizeName(localStorage.getItem("tetris_player_name_v3"));
    state.profile = await state.service.ensureProfile(savedName);
  } catch (error) {
    console.error("Firebase Spark profile initialization failed", error);
    const diagnostic = firebaseDiagnostic(error, "Firebase Spark");
    setFirebaseUnavailable(diagnostic);
    showToast(diagnostic, { error: true, duration: 9000 });
    return;
  }

  state.firebaseReady = true;
  state.firebaseDiagnostic = "Firebase Spark подключён.";
  localStorage.setItem("tetris_player_name_v3", state.profile.name);
  renderIdentity();
  elements.offlineBanner.hidden = true;
  setConnection("online", APP_CONFIG.useEmulators ? "Emulator online" : "Firebase online");

  state.unsubUserLobby = state.service.subscribeUserLobby(state.user.uid, (lobbyId) => {
    if (lobbyId && !String(lobbyId).startsWith("__joining__")) {
      enterLobby(lobbyId);
    } else if (!lobbyId && state.lobbyId) {
      state.lobbyId = null;
      state.lobby = null;
      cleanupLobbySubscriptions();
      if (state.currentView === "lobby") showHome({ stopGame: false });
    }
  });
  subscribeLeaderboards();
}

bootstrap();

// Keep the imported action constants reachable for quick browser-console diagnostics.
Object.defineProperty(window, "TETRIS_ACTIONS", { value: ACTIONS, writable: false });
