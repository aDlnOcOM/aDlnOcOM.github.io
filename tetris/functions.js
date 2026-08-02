/**
 * TETRIS // DUO — Firebase Cloud Functions.
 *
 * Разместите этот файл как functions/src/index.js в Firebase-проекте.
 * Среда: Node.js 22, ESM (package.json: { "type": "module" }).
 * Зависимости: firebase-admin ^13, firebase-functions ^6.
 */
import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

/* ===== Общий детерминированный движок ===== */
/**
 * Deterministic Tetris core shared by the browser and Cloud Functions.
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

/* ===== Доверенные операции Firebase ===== */
initializeApp();
setGlobalOptions({
  region: "europe-west1",
  memory: "256MiB",
  timeoutSeconds: 60,
  maxInstances: 20,
});

const db = getDatabase();
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_LENGTH = 6;
const MAX_SESSION_MS = 24 * 60 * 60 * 1000;
const MAX_SOLO_INPUTS = 12000;
const MAX_COOP_INPUTS = 24000;
const VALID_MODES = new Set(["competitive", "coop"]);
const DISCONNECT_GRACE_MS = 15000;

function requireUid(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Требуется авторизация Firebase.");
  return uid;
}

function sanitizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-zА-Яа-яЁё0-9 _-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 12);
}

function normalizeCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, INVITE_LENGTH);
}

function assertFirebaseKey(value, label = "Идентификатор") {
  const key = String(value ?? "");
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(key)) {
    throw new HttpsError("invalid-argument", `${label} имеет неверный формат.`);
  }
  return key;
}

function randomSeed() {
  return crypto.randomBytes(4).readUInt32BE(0) || 1;
}

function randomInviteCode() {
  let code = "";
  for (let i = 0; i < INVITE_LENGTH; i += 1) {
    code += INVITE_ALPHABET[crypto.randomInt(0, INVITE_ALPHABET.length)];
  }
  return code;
}

function assertDuration(value) {
  const duration = Number(value);
  if (!Number.isInteger(duration) || duration < 0 || duration > MAX_SESSION_MS) {
    throw new HttpsError("invalid-argument", "Некорректная длительность партии.");
  }
  return duration;
}

function assertServerTiming(startedAt, durationMs) {
  const serverElapsed = Date.now() - Number(startedAt || 0);
  if (serverElapsed < -15000) {
    throw new HttpsError("failed-precondition", "Матч ещё не начался.");
  }
  // No minimum duration is used. This deliberately avoids false bans for short games.
  if (durationMs > serverElapsed + 30000) {
    throw new HttpsError("invalid-argument", "Длительность партии находится в будущем.");
  }
}

async function getProfile(uid) {
  const snapshot = await db.ref(`profiles/${uid}`).get();
  return snapshot.val();
}

async function reserveInviteCode(uid, existingCode = null) {
  if (existingCode) {
    const existingRef = db.ref(`inviteCodes/${existingCode}`);
    const result = await existingRef.transaction((current) => {
      if (current === null || current === uid) return uid;
      return undefined;
    }, undefined, false);
    if (result.committed) return existingCode;
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = randomInviteCode();
    const result = await db.ref(`inviteCodes/${code}`).transaction(
      (current) => (current === null ? uid : undefined),
      undefined,
      false,
    );
    if (result.committed) return code;
  }
  throw new HttpsError("resource-exhausted", "Не удалось выделить уникальный код игрока.");
}

async function ensureProfileRecord(uid, requestedName) {
  const profileRef = db.ref(`profiles/${uid}`);
  const existing = (await profileRef.get()).val() ?? {};
  const inviteCode = await reserveInviteCode(uid, existing.inviteCode);
  const requested = sanitizeName(requestedName);
  const fallback = `Игрок${uid.slice(0, 4)}`.slice(0, 12);
  const name = requested.length >= 2
    ? requested
    : sanitizeName(existing.name).length >= 2
      ? sanitizeName(existing.name)
      : fallback;
  const now = Date.now();
  const profile = {
    name,
    inviteCode,
    createdAt: Number(existing.createdAt) || now,
    updatedAt: now,
  };
  await profileRef.set(profile);
  return profile;
}

async function isOnline(uid) {
  const snapshot = await db.ref(`presence/${uid}/connections`).get();
  return snapshot.exists() && snapshot.numChildren() > 0;
}

async function clearStaleLobbyAssignment(uid) {
  const assignmentRef = db.ref(`userLobby/${uid}`);
  const assignment = (await assignmentRef.get()).val();
  if (!assignment) return null;

  const value = String(assignment);
  if (value.startsWith("__joining__")) {
    const timestamp = Number(value.split("_").at(-1));
    const isStale = !Number.isFinite(timestamp) || Date.now() - timestamp > 45_000;
    if (isStale) {
      await assignmentRef.transaction(
        (current) => (current === assignment ? null : undefined),
        undefined,
        false,
      );
      return null;
    }
    return { lobbyId: value, lobby: null, reservation: true };
  }

  const lobby = (await db.ref(`lobbies/${value}`).get()).val();
  if (!lobby || !lobby.members?.[uid]) {
    await assignmentRef.transaction(
      (current) => (current === assignment ? null : undefined),
      undefined,
      false,
    );
    return null;
  }
  return { lobbyId: value, lobby };
}

async function resetLobbyAfterMatch(match) {
  const lobbyId = match.lobbyId;
  if (!lobbyId) return;
  const lobbySnapshot = await db.ref(`lobbies/${lobbyId}`).get();
  const lobby = lobbySnapshot.val();
  if (!lobby) return;
  const updates = {
    [`lobbies/${lobbyId}/status`]: "configuring",
    [`lobbies/${lobbyId}/matchId`]: null,
    [`lobbies/${lobbyId}/pendingMatch`]: null,
    [`lobbies/${lobbyId}/lastResult`]: match.result ?? null,
  };
  for (const uid of Object.keys(lobby.members ?? {})) {
    updates[`lobbies/${lobbyId}/members/${uid}/ready`] = false;
  }
  await db.ref().update(updates);
}

async function updateSoloLeaderboard(uid, profile, snapshot, durationMs) {
  const entryRef = db.ref(`leaderboards/solo/${uid}`);
  await entryRef.transaction((current) => {
    if (current && Number(current.score) >= snapshot.score) return current;
    return {
      uid,
      name: profile.name,
      score: snapshot.score,
      lines: snapshot.lines,
      level: snapshot.level,
      playTimeMs: durationMs,
      timestamp: Date.now(),
      version: GAME_VERSION,
    };
  }, undefined, false);
}

async function updateCompetitiveLeaderboard(uid, profile, { score = 0, win = 0, loss = 0 } = {}) {
  const entryRef = db.ref(`leaderboards/competitive/${uid}`);
  await entryRef.transaction((current) => {
    const wins = Math.max(0, Number(current?.wins) || 0) + win;
    const losses = Math.max(0, Number(current?.losses) || 0) + loss;
    const maxScore = Math.max(Number(current?.maxScore) || 0, Number(score) || 0);
    return {
      uid,
      name: profile.name,
      wins,
      losses,
      maxScore,
      sortKey: wins * 1_000_000_000 + maxScore,
      updatedAt: Date.now(),
      version: GAME_VERSION,
    };
  }, undefined, false);
}

async function updateCoopLeaderboard(memberUids, profiles, snapshot, durationMs, matchId) {
  const sortedUids = [...memberUids].sort();
  const teamId = sortedUids.join("__");
  const entryRef = db.ref(`leaderboards/coop/${teamId}`);
  await entryRef.transaction((current) => {
    if (current?.lastMatchId === matchId) return current;
    const matches = Math.max(0, Number(current?.matches) || 0) + 1;
    const previousMax = Number(current?.maxScore) || 0;
    const maxScore = Math.max(previousMax, snapshot.score);
    const bestDurationMs = snapshot.score > previousMax
      ? durationMs
      : Number(current?.bestDurationMs) || durationMs;
    return {
      teamId,
      memberUids: sortedUids,
      player1Name: profiles[sortedUids[0]]?.name ?? "Игрок 1",
      player2Name: profiles[sortedUids[1]]?.name ?? "Игрок 2",
      maxScore,
      matches,
      bestDurationMs,
      lastMatchId: matchId,
      updatedAt: Date.now(),
      version: GAME_VERSION,
    };
  }, undefined, false);
}

export const ensureProfile = onCall(async (request) => {
  const uid = requireUid(request);
  return ensureProfileRecord(uid, request.data?.name);
});

export const updateProfile = onCall(async (request) => {
  const uid = requireUid(request);
  const name = sanitizeName(request.data?.name);
  if (name.length < 2) {
    throw new HttpsError("invalid-argument", "Имя должно содержать от 2 до 12 символов.");
  }
  const profile = await ensureProfileRecord(uid, name);
  const updates = {
    [`profiles/${uid}/name`]: name,
    [`profiles/${uid}/updatedAt`]: Date.now(),
  };
  const lobbyId = (await db.ref(`userLobby/${uid}`).get()).val();
  if (lobbyId && !String(lobbyId).startsWith("__joining__")) {
    const isMember = (await db.ref(`lobbies/${lobbyId}/members/${uid}`).get()).exists();
    if (isMember) updates[`lobbies/${lobbyId}/members/${uid}/name`] = name;
  }
  await db.ref().update(updates);
  return { ...profile, name };
});

export const sendLobbyMessage = onCall(async (request) => {
  const uid = requireUid(request);
  const lobbyId = assertFirebaseKey(request.data?.lobbyId, "Идентификатор лобби");
  const text = String(request.data?.text ?? "").trim().slice(0, 300);
  if (!text) throw new HttpsError("invalid-argument", "Сообщение не может быть пустым.");

  const lobby = (await db.ref(`lobbies/${lobbyId}`).get()).val();
  const member = lobby?.members?.[uid];
  if (!member) throw new HttpsError("permission-denied", "Вы не состоите в этом лобби.");

  const now = Date.now();
  const rateRef = db.ref(`chatRateLimits/${uid}`);
  const rate = await rateRef.transaction((current) => {
    if (Number(current) > now - 500) return undefined;
    return now;
  }, undefined, false);
  if (!rate.committed) {
    throw new HttpsError("resource-exhausted", "Сообщения отправляются слишком часто.");
  }

  const messageRef = db.ref(`lobbyChats/${lobbyId}`).push();
  const message = {
    uid,
    name: sanitizeName(member.name) || "Игрок",
    text,
    timestamp: now,
  };
  await messageRef.set(message);

  // Keep a bounded chat history. The normal client reads only the newest 50.
  const chatRef = db.ref(`lobbyChats/${lobbyId}`);
  const history = await chatRef.orderByChild("timestamp").get();
  if (history.numChildren() > 100) {
    const removeCount = history.numChildren() - 100;
    const updates = {};
    let index = 0;
    history.forEach((child) => {
      if (index < removeCount) updates[child.key] = null;
      index += 1;
    });
    if (Object.keys(updates).length) await chatRef.update(updates);
  }

  return { messageId: messageRef.key, ...message };
});

export const joinLobbyByCode = onCall(async (request) => {
  const guestUid = requireUid(request);
  const code = normalizeCode(request.data?.code);
  if (code.length !== INVITE_LENGTH) {
    throw new HttpsError("invalid-argument", "Введите шестизначный код игрока.");
  }

  const hostUid = (await db.ref(`inviteCodes/${code}`).get()).val();
  if (!hostUid) throw new HttpsError("not-found", "Игрок с таким кодом не найден.");
  if (hostUid === guestUid) throw new HttpsError("invalid-argument", "Нельзя подключиться к собственному коду.");
  if (!(await isOnline(hostUid))) {
    throw new HttpsError("failed-precondition", "Владелец кода сейчас не в сети.");
  }

  const guestActive = await clearStaleLobbyAssignment(guestUid);
  if (guestActive) throw new HttpsError("already-exists", "Вы уже находитесь в лобби.");

  const token = `__joining__${hostUid}_${Date.now()}`;
  const guestReservation = await db.ref(`userLobby/${guestUid}`).transaction(
    (current) => (current === null ? token : undefined),
    undefined,
    false,
  );
  if (!guestReservation.committed) {
    throw new HttpsError("already-exists", "Вы уже подключаетесь к другому лобби.");
  }

  let hostReservedByThisCall = false;
  let lobbyId = null;
  try {
    const hostActive = await clearStaleLobbyAssignment(hostUid);
    if (hostActive) {
      if (hostActive.reservation || !hostActive.lobby) {
        throw new HttpsError("resource-exhausted", "Игрок уже подключается к другому лобби.");
      }
      const existing = hostActive.lobby;
      if (existing.hostUid !== hostUid || existing.guestUid || existing.status === "playing") {
        throw new HttpsError("resource-exhausted", "Лобби этого игрока уже занято.");
      }
      lobbyId = hostActive.lobbyId;
    } else {
      lobbyId = db.ref("lobbies").push().key;
      const hostReservation = await db.ref(`userLobby/${hostUid}`).transaction(
        (current) => (current === null ? lobbyId : undefined),
        undefined,
        false,
      );
      if (!hostReservation.committed) {
        throw new HttpsError("resource-exhausted", "Игрок уже вошёл в другое лобби.");
      }
      hostReservedByThisCall = true;
    }

    const [hostProfile, guestProfile] = await Promise.all([
      ensureProfileRecord(hostUid),
      ensureProfileRecord(guestUid),
    ]);
    const now = Date.now();
    const lobbyRef = db.ref(`lobbies/${lobbyId}`);
    const transaction = await lobbyRef.transaction((current) => {
      if (current === null) {
        return {
          hostUid,
          guestUid,
          code,
          mode: "competitive",
          status: "configuring",
          createdAt: now,
          updatedAt: now,
          members: {
            [hostUid]: { name: hostProfile.name, side: "left", ready: false },
            [guestUid]: { name: guestProfile.name, side: "right", ready: false },
          },
        };
      }
      if (current.hostUid !== hostUid || current.guestUid || current.status === "playing") {
        return undefined;
      }
      current.guestUid = guestUid;
      current.status = "configuring";
      current.updatedAt = now;
      current.members ??= {};
      current.members[hostUid] = { name: hostProfile.name, side: "left", ready: false };
      current.members[guestUid] = { name: guestProfile.name, side: "right", ready: false };
      return current;
    }, undefined, false);

    if (!transaction.committed) {
      throw new HttpsError("resource-exhausted", "К этому игроку уже подключился кто-то другой.");
    }

    await db.ref().update({
      [`userLobby/${guestUid}`]: lobbyId,
      [`userLobby/${hostUid}`]: lobbyId,
    });
    return { lobbyId };
  } catch (error) {
    const rollback = { [`userLobby/${guestUid}`]: null };
    if (hostReservedByThisCall && lobbyId) {
      rollback[`userLobby/${hostUid}`] = null;
      rollback[`lobbies/${lobbyId}`] = null;
      rollback[`lobbyChats/${lobbyId}`] = null;
    }
    await db.ref().update(rollback);
    throw error;
  }
});

export const leaveLobby = onCall(async (request) => {
  const uid = requireUid(request);
  const lobbyId = (await db.ref(`userLobby/${uid}`).get()).val();
  if (!lobbyId || String(lobbyId).startsWith("__joining__")) {
    await db.ref(`userLobby/${uid}`).remove();
    return { left: true };
  }
  const lobby = (await db.ref(`lobbies/${lobbyId}`).get()).val();
  if (!lobby) {
    await db.ref(`userLobby/${uid}`).remove();
    return { left: true };
  }
  if (["starting", "playing"].includes(lobby.status)) {
    throw new HttpsError("failed-precondition", "Нельзя покинуть лобби во время запуска или активного матча.");
  }
  const updates = {
    [`lobbies/${lobbyId}`]: null,
    [`lobbyChats/${lobbyId}`]: null,
  };
  for (const memberUid of Object.keys(lobby.members ?? {})) {
    updates[`userLobby/${memberUid}`] = null;
  }
  await db.ref().update(updates);
  return { left: true };
});

export const startSoloGame = onCall(async (request) => {
  const uid = requireUid(request);
  await ensureProfileRecord(uid);
  const sessionRef = db.ref(`gameSessions/solo/${uid}`).push();
  const session = {
    seed: randomSeed(),
    status: "playing",
    startedAt: Date.now(),
    version: GAME_VERSION,
  };
  await sessionRef.set(session);
  return { sessionId: sessionRef.key, ...session };
});

export const finishSoloGame = onCall(async (request) => {
  const uid = requireUid(request);
  const sessionId = String(request.data?.sessionId ?? "");
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(sessionId)) {
    throw new HttpsError("invalid-argument", "Некорректный идентификатор партии.");
  }
  const durationMs = assertDuration(request.data?.durationMs);
  const inputLog = request.data?.inputLog;
  if (!Array.isArray(inputLog) || inputLog.length > MAX_SOLO_INPUTS) {
    throw new HttpsError("invalid-argument", "Журнал команд слишком велик или повреждён.");
  }

  const sessionRef = db.ref(`gameSessions/solo/${uid}/${sessionId}`);
  const claim = await sessionRef.transaction((current) => {
    if (!current || current.status !== "playing") return undefined;
    return { ...current, status: "verifying", verifyingAt: Date.now() };
  }, undefined, false);
  if (!claim.committed) {
    throw new HttpsError("failed-precondition", "Партия уже была проверена или не существует.");
  }
  const session = claim.snapshot.val();

  try {
    assertServerTiming(session.startedAt, durationMs);
    const snapshot = replaySolo({
      seed: session.seed,
      inputLog,
      durationMs,
      requireGameOver: true,
    });
    const profile = await ensureProfileRecord(uid);
    await updateSoloLeaderboard(uid, profile, snapshot, durationMs);
    await sessionRef.update({
      status: "finished",
      finishedAt: Date.now(),
      result: {
        score: snapshot.score,
        lines: snapshot.lines,
        level: snapshot.level,
        durationMs,
      },
    });
    return {
      verified: true,
      score: snapshot.score,
      lines: snapshot.lines,
      level: snapshot.level,
      durationMs,
    };
  } catch (error) {
    await sessionRef.update({
      status: "rejected",
      rejectedAt: Date.now(),
      rejectReason: String(error?.message ?? "Replay failed").slice(0, 160),
    });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("invalid-argument", `Результат не прошёл воспроизведение: ${error.message}`);
  }
});

export const startMatch = onCall(async (request) => {
  const uid = requireUid(request);
  const lobbyId = assertFirebaseKey(request.data?.lobbyId, "Идентификатор лобби");
  const lobbyRef = db.ref(`lobbies/${lobbyId}`);
  const initialLobby = (await lobbyRef.get()).val();
  if (!initialLobby || !initialLobby.members?.[uid]) {
    throw new HttpsError("not-found", "Лобби не найдено.");
  }
  if (initialLobby.hostUid !== uid) {
    throw new HttpsError("permission-denied", "Запустить матч может только создатель лобби.");
  }
  if (initialLobby.status === "playing" && initialLobby.matchId) {
    return { matchId: initialLobby.matchId };
  }
  if (!initialLobby.guestUid || Object.keys(initialLobby.members).length !== 2) {
    throw new HttpsError("failed-precondition", "Для старта нужны два игрока.");
  }
  if (!VALID_MODES.has(initialLobby.mode)) {
    throw new HttpsError("failed-precondition", "Не выбран режим матча.");
  }
  if (!Object.values(initialLobby.members).every((member) => member.ready === true)) {
    throw new HttpsError("failed-precondition", "Оба игрока должны подтвердить готовность.");
  }

  // The lobby transaction acts as an idempotent start lock. A second click or
  // retry receives the same match id instead of creating a parallel match.
  const candidateMatchId = db.ref("matches").push().key;
  const pending = {
    matchId: candidateMatchId,
    seed: randomSeed(),
    createdAt: Date.now(),
    startedAt: Date.now() + 3500,
  };
  const claim = await lobbyRef.transaction((current) => {
    if (!current || current.hostUid !== uid) return undefined;
    if ((current.status === "starting" || current.status === "playing") && current.matchId) {
      return current;
    }
    if (
      current.status !== "configuring"
      || !current.guestUid
      || Object.keys(current.members ?? {}).length !== 2
      || !VALID_MODES.has(current.mode)
      || !Object.values(current.members ?? {}).every((member) => member.ready === true)
    ) {
      return undefined;
    }
    return {
      ...current,
      status: "starting",
      matchId: pending.matchId,
      pendingMatch: pending,
      updatedAt: Date.now(),
    };
  }, undefined, false);

  if (!claim.committed) {
    throw new HttpsError("failed-precondition", "Состояние лобби изменилось. Проверьте готовность игроков.");
  }

  const claimedLobby = claim.snapshot.val();
  const matchId = claimedLobby.matchId;
  const metadata = claimedLobby.pendingMatch ?? pending;
  const existingMatch = (await db.ref(`matches/${matchId}`).get()).val();
  if (existingMatch) return { matchId, ...existingMatch };

  const match = {
    lobbyId,
    hostUid: claimedLobby.hostUid,
    guestUid: claimedLobby.guestUid,
    mode: claimedLobby.mode,
    status: "playing",
    seed: metadata.seed,
    createdAt: metadata.createdAt,
    startedAt: metadata.startedAt,
    version: GAME_VERSION,
    members: claimedLobby.members,
  };
  await db.ref().update({
    [`matches/${matchId}`]: match,
    [`lobbies/${lobbyId}/status`]: "playing",
    [`lobbies/${lobbyId}/matchId`]: matchId,
    [`lobbies/${lobbyId}/pendingMatch`]: null,
    [`lobbies/${lobbyId}/updatedAt`]: Date.now(),
  });
  return { matchId, ...match };
});

export const finishCompetitiveMatch = onCall(async (request) => {
  const uid = requireUid(request);
  const matchId = assertFirebaseKey(request.data?.matchId, "Идентификатор матча");
  const durationMs = assertDuration(request.data?.durationMs);
  const inputLog = request.data?.inputLog;
  const claimsGameOver = request.data?.gameOver === true;
  if (!Array.isArray(inputLog) || inputLog.length > MAX_SOLO_INPUTS) {
    throw new HttpsError("invalid-argument", "Журнал команд слишком велик или повреждён.");
  }

  const matchRef = db.ref(`matches/${matchId}`);
  const match = (await matchRef.get()).val();
  if (!match || match.mode !== "competitive" || !match.members?.[uid]) {
    throw new HttpsError("not-found", "Соревновательный матч не найден.");
  }
  if (!["playing", "finished"].includes(match.status)) {
    throw new HttpsError("failed-precondition", "Матч ещё не запущен.");
  }
  assertServerTiming(match.startedAt, durationMs);

  const submissionRef = db.ref(`matches/${matchId}/submissions/${uid}`);
  const existingSubmission = (await submissionRef.get()).val();
  if (existingSubmission?.status === "verified") {
    const currentResult = (await db.ref(`matches/${matchId}/result`).get()).val();
    return { verified: true, ...existingSubmission, result: currentResult };
  }

  const verifyingAt = Date.now();
  const claim = await submissionRef.transaction((current) => {
    if (current?.status === "verified") return undefined;
    if (current?.status === "verifying" && verifyingAt - Number(current.verifyingAt || 0) < 60000) {
      return undefined;
    }
    return {
      status: "verifying",
      verifyingAt,
      durationMs,
      claimsGameOver,
    };
  }, undefined, false);
  if (!claim.committed) {
    const current = (await submissionRef.get()).val();
    if (current?.status === "verified") {
      const currentResult = (await db.ref(`matches/${matchId}/result`).get()).val();
      return { verified: true, ...current, result: currentResult };
    }
    throw new HttpsError("aborted", "Этот результат уже проверяется. Повторите запрос позже.");
  }

  let replay;
  try {
    replay = replaySolo({
      seed: match.seed,
      inputLog,
      durationMs,
      requireGameOver: claimsGameOver,
    });
    if (claimsGameOver && !replay.gameOver) {
      throw new Error("Заявленное поражение не подтверждено движком.");
    }
  } catch (error) {
    await submissionRef.set({
      status: "rejected",
      rejectedAt: Date.now(),
      rejectReason: String(error?.message ?? "Replay failed").slice(0, 160),
    });
    throw new HttpsError("invalid-argument", `Результат не прошёл воспроизведение: ${error.message}`);
  }

  const verifiedSubmission = {
    status: "verified",
    score: replay.score,
    lines: replay.lines,
    level: replay.level,
    durationMs,
    gameOver: replay.gameOver,
    submittedAt: Date.now(),
  };
  await submissionRef.set(verifiedSubmission);

  const profile = await ensureProfileRecord(uid);
  await updateCompetitiveLeaderboard(uid, profile, { score: replay.score });

  let result = (await db.ref(`matches/${matchId}/result`).get()).val();
  if (replay.gameOver && !result) {
    const otherUid = Object.keys(match.members).find((memberUid) => memberUid !== uid);
    const resultTransaction = await db.ref(`matches/${matchId}/result`).transaction((current) => {
      if (current) return undefined;
      return {
        winnerUid: otherUid,
        loserUid: uid,
        reason: "top-out",
        finishedAt: Date.now(),
        loserDurationMs: durationMs,
        loserScore: replay.score,
      };
    }, undefined, false);

    if (resultTransaction.committed) {
      result = resultTransaction.snapshot.val();
      const [winnerProfile, loserProfile] = await Promise.all([
        ensureProfileRecord(otherUid),
        ensureProfileRecord(uid),
      ]);
      await Promise.all([
        updateCompetitiveLeaderboard(otherUid, winnerProfile, { win: 1 }),
        updateCompetitiveLeaderboard(uid, loserProfile, { loss: 1, score: replay.score }),
      ]);
    } else {
      result = (await db.ref(`matches/${matchId}/result`).get()).val();
    }
  }

  if (result) {
    await matchRef.update({ status: "finished", finishedAt: Number(result.finishedAt) || Date.now() });
    await resetLobbyAfterMatch({ ...match, result });
  }

  return {
    verified: true,
    ...verifiedSubmission,
    result,
  };
});

export const finishCoopMatch = onCall(async (request) => {
  const uid = requireUid(request);
  const matchId = assertFirebaseKey(request.data?.matchId, "Идентификатор матча");
  const durationMs = assertDuration(request.data?.durationMs);
  const matchRef = db.ref(`matches/${matchId}`);
  const match = (await matchRef.get()).val();
  if (!match || match.mode !== "coop" || !match.members?.[uid]) {
    throw new HttpsError("not-found", "Кооперативный матч не найден.");
  }
  if (match.hostUid !== uid) {
    throw new HttpsError("permission-denied", "Итог кооперативного матча отправляет ведущий.");
  }
  assertServerTiming(match.startedAt, durationMs);

  const existingResult = (await db.ref(`matches/${matchId}/result`).get()).val();
  if (existingResult) {
    if (existingResult.outcome === "team-game-over") {
      const memberUids = Object.keys(match.members);
      const profiles = {};
      await Promise.all(memberUids.map(async (memberUid) => {
        profiles[memberUid] = await ensureProfileRecord(memberUid);
      }));
      await updateCoopLeaderboard(
        memberUids,
        profiles,
        existingResult,
        Number(existingResult.durationMs) || durationMs,
        matchId,
      );
    }
    await matchRef.update({ status: "finished", finishedAt: Number(existingResult.finishedAt) || Date.now() });
    await resetLobbyAfterMatch({ ...match, result: existingResult });
    return { verified: existingResult.outcome === "team-game-over", ...existingResult };
  }

  const verificationRef = db.ref(`matches/${matchId}/verification/coop`);
  const now = Date.now();
  const claim = await verificationRef.transaction((current) => {
    if (current?.status === "verified") return undefined;
    if (current?.status === "verifying" && now - Number(current.verifyingAt || 0) < 60000) {
      return undefined;
    }
    return { status: "verifying", verifyingAt: now, durationMs };
  }, undefined, false);
  if (!claim.committed) {
    const result = (await db.ref(`matches/${matchId}/result`).get()).val();
    if (result) return { verified: result.outcome === "team-game-over", ...result };
    throw new HttpsError("aborted", "Кооперативный результат уже проверяется.");
  }

  const acceptedValue = (await db.ref(`matches/${matchId}/acceptedCommands`).get()).val() ?? {};
  const inputLog = Object.values(acceptedValue).map((entry, index) => ({
    seq: Number(entry.seq) || index + 1,
    side: entry.side,
    action: entry.action,
    atMs: Number(entry.atMs) || 0,
  }));
  if (inputLog.length > MAX_COOP_INPUTS) {
    await verificationRef.set({ status: "rejected", rejectedAt: Date.now(), reason: "log-too-large" });
    throw new HttpsError("invalid-argument", "Журнал кооперативного матча слишком велик.");
  }

  let replay;
  try {
    replay = replayCoop({
      seed: match.seed,
      inputLog,
      durationMs,
      requireGameOver: true,
    });
  } catch (error) {
    await verificationRef.set({
      status: "rejected",
      rejectedAt: Date.now(),
      rejectReason: String(error?.message ?? "Replay failed").slice(0, 160),
    });
    throw new HttpsError("invalid-argument", `Матч не прошёл воспроизведение: ${error.message}`);
  }

  const resultPayload = {
    outcome: "team-game-over",
    score: replay.score,
    lines: replay.lines,
    level: replay.level,
    durationMs,
    finishedAt: Date.now(),
  };
  const resultTransaction = await db.ref(`matches/${matchId}/result`).transaction(
    (current) => current ?? resultPayload,
    undefined,
    false,
  );
  const result = resultTransaction.snapshot.val() ?? resultPayload;

  const memberUids = Object.keys(match.members);
  const profiles = {};
  await Promise.all(memberUids.map(async (memberUid) => {
    profiles[memberUid] = await ensureProfileRecord(memberUid);
  }));
  await updateCoopLeaderboard(memberUids, profiles, replay, durationMs, matchId);
  await verificationRef.set({ status: "verified", verifiedAt: Date.now(), result });
  await matchRef.update({ status: "finished", finishedAt: Number(result.finishedAt) || Date.now() });
  await resetLobbyAfterMatch({ ...match, result });
  return { verified: true, ...result };
});

export const claimDisconnectResult = onCall(async (request) => {
  const uid = requireUid(request);
  const matchId = assertFirebaseKey(request.data?.matchId, "Идентификатор матча");
  const matchRef = db.ref(`matches/${matchId}`);
  const match = (await matchRef.get()).val();
  if (!match || !match.members?.[uid] || !VALID_MODES.has(match.mode)) {
    throw new HttpsError("not-found", "Сетевой матч не найден.");
  }

  const existingResult = (await db.ref(`matches/${matchId}/result`).get()).val();
  if (existingResult) return { resolved: true, result: existingResult };
  if (match.status !== "playing") {
    throw new HttpsError("failed-precondition", "Матч не находится в активном состоянии.");
  }

  const otherUid = Object.keys(match.members).find((memberUid) => memberUid !== uid);
  if (!otherUid) throw new HttpsError("failed-precondition", "В матче отсутствует второй игрок.");
  if (await isOnline(otherUid)) {
    throw new HttpsError("failed-precondition", "Второй игрок снова в сети.");
  }

  const lastOnlineValue = (await db.ref(`presence/${otherUid}/lastOnline`).get()).val();
  const offlineSince = Number(lastOnlineValue) || Number(match.startedAt) || Date.now();
  const offlineMs = Date.now() - offlineSince;
  if (offlineMs < DISCONNECT_GRACE_MS) {
    throw new HttpsError(
      "failed-precondition",
      `Ожидание переподключения: ${Math.ceil((DISCONNECT_GRACE_MS - offlineMs) / 1000)} сек.`,
    );
  }

  const finishedAt = Date.now();
  const payload = match.mode === "competitive"
    ? {
        winnerUid: uid,
        loserUid: otherUid,
        reason: "disconnect",
        finishedAt,
      }
    : {
        outcome: "team-disconnected",
        disconnectedUid: otherUid,
        reason: "disconnect",
        score: Math.max(0, Number(match.coopState?.score) || 0),
        lines: Math.max(0, Number(match.coopState?.lines) || 0),
        level: Math.max(1, Number(match.coopState?.level) || 1),
        durationMs: Math.max(0, finishedAt - Number(match.startedAt || finishedAt)),
        finishedAt,
      };

  const transaction = await db.ref(`matches/${matchId}/result`).transaction(
    (current) => current ?? payload,
    undefined,
    false,
  );
  const result = transaction.snapshot.val();

  if (transaction.committed && match.mode === "competitive") {
    const loserSubmission = (await db.ref(`matches/${matchId}/submissions/${otherUid}`).get()).val();
    const [winnerProfile, loserProfile] = await Promise.all([
      ensureProfileRecord(uid),
      ensureProfileRecord(otherUid),
    ]);
    await Promise.all([
      updateCompetitiveLeaderboard(uid, winnerProfile, { win: 1 }),
      updateCompetitiveLeaderboard(otherUid, loserProfile, {
        loss: 1,
        score: Number(loserSubmission?.score) || 0,
      }),
    ]);
  }

  await matchRef.update({ status: "finished", finishedAt: Number(result?.finishedAt) || finishedAt });
  await resetLobbyAfterMatch({ ...match, result });
  return { resolved: true, result };
});
