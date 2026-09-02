// Управляет правилами шахмат, отрисовкой доски и ходами локального соперника.
(() => {
  const PIECES = {
    K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
    k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
  };
  const PIECE_NAMES = { p: "пешка", n: "конь", b: "слон", r: "ладья", q: "ферзь", k: "король" };
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  const KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAGONALS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const STRAIGHTS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const DIFFICULTY_LEVELS = [
    { label: "Новичок", depth: 1, candidates: 12, mistakeChance: 0.82, mistakePool: 18 },
    { label: "Любитель", depth: 1, candidates: 9, mistakeChance: 0.68, mistakePool: 14 },
    { label: "Практик", depth: 1, candidates: 6, mistakeChance: 0.52, mistakePool: 10 },
    { label: "Тактик", depth: 2, candidates: 8, mistakeChance: 0.46, mistakePool: 9 },
    { label: "Стратег", depth: 2, candidates: 6, mistakeChance: 0.34, mistakePool: 7 },
    { label: "Эксперт", depth: 2, candidates: 4, mistakeChance: 0.22, mistakePool: 5 },
    { label: "Мастер", depth: 3, candidates: 6, mistakeChance: 0.24, mistakePool: 5 },
    { label: "Элитный", depth: 3, candidates: 4, mistakeChance: 0.15, mistakePool: 4 },
    { label: "Гроссмейстер", depth: 3, candidates: 2, mistakeChance: 0.06, mistakePool: 3 },
    { label: "Легенда", depth: 4, candidates: 1, mistakeChance: 0, mistakePool: 1 },
    { label: "Алекс", depth: 5, candidates: 1, mistakeChance: 0, mistakePool: 1, engine: "alex" },
    { label: "Леотис", depth: 7, candidates: 1, mistakeChance: 0, mistakePool: 1, engine: "leotis" },
    { label: "Алекс Д’ Леотис", depth: 12, candidates: 1, mistakeChance: 0, mistakePool: 1, engine: "stockfish" }
  ];
  const LEOTIS_TIME_LIMIT = 1200;
  const THEMES = new Set(["midnight", "ivory", "forest", "ember", "contrast"]);
  const PREFERENCES_KEY = "chess-preferences-v1";

  const state = {
    board: [],
    turn: "w",
    selected: null,
    possible: [],
    lastMove: null,
    gameOver: false,
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: null,
    playerColor: "w",
    difficulty: 0,
    theme: "midnight",
    aiTimer: null,
    advanceTimer: null,
    stockfishWorker: null,
    stockfishSearchId: 0,
    squareGrid: [],
    settingsOpen: false,
    leotisAwakened: false,
    moveHistory: [],
    initialPosition: null,
    replayIndex: null,
    finalStatus: ""
  };

  const getElement = id => document.getElementById(id);
  const isWhite = piece => Boolean(piece) && piece === piece.toUpperCase();
  const isBlack = piece => Boolean(piece) && piece === piece.toLowerCase();
  const enemy = color => color === "w" ? "b" : "w";
  const botColor = () => enemy(state.playerColor);
  const currentDifficulty = () => DIFFICULTY_LEVELS[state.difficulty];
  const inBounds = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8;
  const copyBoard = board => board.map(row => [...row]);
  const owns = (piece, color) => color === "w" ? isWhite(piece) : isBlack(piece);

  function copyMove(move) {
    return move ? { ...move } : null;
  }

  function squareName(row, col) {
    return `${String.fromCharCode(97 + col)}${8 - row}`;
  }

  function createPositionSnapshot() {
    return {
      board: copyBoard(state.board),
      turn: state.turn,
      castling: { ...state.castling },
      enPassant: state.enPassant ? [...state.enPassant] : null,
      lastMove: copyMove(state.lastMove),
      leotisAwakened: state.leotisAwakened
    };
  }

  function restorePositionSnapshot(snapshot) {
    state.board = copyBoard(snapshot.board);
    state.turn = snapshot.turn;
    state.castling = { ...snapshot.castling };
    state.enPassant = snapshot.enPassant ? [...snapshot.enPassant] : null;
    state.lastMove = copyMove(snapshot.lastMove);
    state.leotisAwakened = snapshot.leotisAwakened;
    state.selected = null;
    state.possible = [];
  }

  function freshBoard() {
    return [
      ["r", "n", "b", "q", "k", "b", "n", "r"],
      ["p", "p", "p", "p", "p", "p", "p", "p"],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ["P", "P", "P", "P", "P", "P", "P", "P"],
      ["R", "N", "B", "Q", "K", "B", "N", "R"]
    ];
  }

  function init() {
    clearTimers();
    state.board = freshBoard();
    state.turn = "w";
    state.selected = null;
    state.possible = [];
    state.lastMove = null;
    state.gameOver = false;
    state.castling = { K: true, Q: true, k: true, q: true };
    state.enPassant = null;
    state.leotisAwakened = false;
    state.moveHistory = [];
    state.replayIndex = null;
    state.finalStatus = "";
    state.initialPosition = createPositionSnapshot();
    getElement("restart").style.display = "none";
    getElement("thinking").textContent = "";
    applyTheme();
    syncSettingsPanel();
    updateDifficultyDisplay();
    updateStatus();
    render();
    renderMoveHistory();
    syncReplayControls();
    if (state.playerColor === "b") aiMove();
  }

  function clearTimers() {
    if (state.aiTimer !== null) clearTimeout(state.aiTimer);
    if (state.advanceTimer !== null) clearTimeout(state.advanceTimer);
    state.aiTimer = null;
    state.advanceTimer = null;
    stopStockfish();
  }

  function updateDifficultyDisplay() {
    const level = currentDifficulty();
    getElement("difficulty").value = String(state.difficulty);
    getElement("level-indicator").textContent = `Уровень ${state.difficulty + 1} из ${DIFFICULTY_LEVELS.length} · ${level.label}`;
  }

  function restorePreferences() {
    try {
      const preferences = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
      if (Number.isInteger(preferences.difficulty) && preferences.difficulty >= 0 && preferences.difficulty < DIFFICULTY_LEVELS.length) state.difficulty = preferences.difficulty;
      if (THEMES.has(preferences.theme)) state.theme = preferences.theme;
    } catch {
      // Локальное хранилище недоступно — игра продолжит работать с настройками по умолчанию.
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ difficulty: state.difficulty, theme: state.theme }));
    } catch {
      // Настройки необязательно сохранять для работы локальной партии.
    }
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    getElement("theme").value = state.theme;
  }

  function syncSettingsPanel() {
    const settings = getElement("settings");
    const levelIndicator = getElement("level-indicator");
    const settingsControls = getElement("settings-controls");
    const toggle = getElement("settings-toggle");
    settings.hidden = !state.settingsOpen;
    levelIndicator.hidden = !state.settingsOpen;
    settingsControls.hidden = !state.settingsOpen;
    toggle.setAttribute("aria-expanded", String(state.settingsOpen));
    toggle.setAttribute("aria-label", state.settingsOpen ? "Закрыть настройки" : "Открыть настройки");
  }

  function findKing(board, color) {
    const king = color === "w" ? "K" : "k";
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if (board[row][col] === king) return [row, col];
      }
    }
    return null;
  }

  function attacksFromRay(board, row, col, deltas, pieces) {
    for (const [rowStep, colStep] of deltas) {
      let nextRow = row + rowStep;
      let nextCol = col + colStep;
      while (inBounds(nextRow, nextCol)) {
        const piece = board[nextRow][nextCol];
        if (piece) {
          if (pieces.includes(piece)) return true;
          break;
        }
        nextRow += rowStep;
        nextCol += colStep;
      }
    }
    return false;
  }

  function isAttacked(board, row, col, color) {
    const knight = color === "w" ? "N" : "n";
    const king = color === "w" ? "K" : "k";
    const pawn = color === "w" ? "P" : "p";
    for (const [rowStep, colStep] of KNIGHT_STEPS) {
      if (board[row + rowStep]?.[col + colStep] === knight) return true;
    }
    for (const [rowStep, colStep] of KING_STEPS) {
      if (board[row + rowStep]?.[col + colStep] === king) return true;
    }
    const pawnRow = row + (color === "w" ? 1 : -1);
    if (board[pawnRow]?.[col - 1] === pawn || board[pawnRow]?.[col + 1] === pawn) return true;
    const diagonals = color === "w" ? ["B", "Q"] : ["b", "q"];
    const straights = color === "w" ? ["R", "Q"] : ["r", "q"];
    return attacksFromRay(board, row, col, DIAGONALS, diagonals)
      || attacksFromRay(board, row, col, STRAIGHTS, straights);
  }

  function inCheck(board, color) {
    const king = findKing(board, color);
    return !king || isAttacked(board, king[0], king[1], enemy(color));
  }

  function addMove(moves, board, row, col, toRow, toCol, color, extra = {}) {
    if (!inBounds(toRow, toCol) || owns(board[toRow][toCol], color)) return false;
    moves.push({ fr: row, fc: col, tr: toRow, tc: toCol, ...extra });
    return !board[toRow][toCol];
  }

  function pseudoMoves(board, row, col, color, castling, enPassant) {
    const piece = board[row][col];
    if (!piece) return [];
    const moves = [];
    const type = piece.toLowerCase();
    if (type === "p") {
      const direction = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const promotionRow = color === "w" ? 0 : 7;
      const addPawnMove = (toRow, toCol) => {
        if (toRow === promotionRow) {
          for (const promotion of ["q", "r", "b", "n"]) addMove(moves, board, row, col, toRow, toCol, color, { promo: color === "w" ? promotion.toUpperCase() : promotion });
        } else addMove(moves, board, row, col, toRow, toCol, color);
      };
      if (!board[row + direction]?.[col]) {
        addPawnMove(row + direction, col);
        if (row === startRow && !board[row + 2 * direction]?.[col]) addMove(moves, board, row, col, row + 2 * direction, col, color);
      }
      for (const colStep of [-1, 1]) {
        const toRow = row + direction;
        const toCol = col + colStep;
        if (inBounds(toRow, toCol) && board[toRow][toCol] && !owns(board[toRow][toCol], color)) addPawnMove(toRow, toCol);
      }
      if (enPassant && row + direction === enPassant[0] && Math.abs(col - enPassant[1]) === 1) addMove(moves, board, row, col, enPassant[0], enPassant[1], color, { enPassant: true });
    } else if (type === "n") {
      for (const [rowStep, colStep] of KNIGHT_STEPS) addMove(moves, board, row, col, row + rowStep, col + colStep, color);
    } else if (["b", "r", "q"].includes(type)) {
      const directions = type === "b" ? DIAGONALS : type === "r" ? STRAIGHTS : [...DIAGONALS, ...STRAIGHTS];
      for (const [rowStep, colStep] of directions) {
        let toRow = row + rowStep;
        let toCol = col + colStep;
        while (inBounds(toRow, toCol)) {
          const canContinue = addMove(moves, board, row, col, toRow, toCol, color);
          if (!canContinue) break;
          toRow += rowStep;
          toCol += colStep;
        }
      }
    } else if (type === "k") {
      for (const [rowStep, colStep] of KING_STEPS) addMove(moves, board, row, col, row + rowStep, col + colStep, color);
      const homeRow = color === "w" ? 7 : 0;
      const rook = color === "w" ? "R" : "r";
      const kingSide = color === "w" ? "K" : "k";
      const queenSide = color === "w" ? "Q" : "q";
      const attacker = enemy(color);
      if (row === homeRow && col === 4 && castling[kingSide] && board[homeRow][7] === rook && !board[homeRow][5] && !board[homeRow][6] && !isAttacked(board, homeRow, 4, attacker) && !isAttacked(board, homeRow, 5, attacker) && !isAttacked(board, homeRow, 6, attacker)) moves.push({ fr: row, fc: col, tr: homeRow, tc: 6, castle: kingSide });
      if (row === homeRow && col === 4 && castling[queenSide] && board[homeRow][0] === rook && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] && !isAttacked(board, homeRow, 4, attacker) && !isAttacked(board, homeRow, 3, attacker) && !isAttacked(board, homeRow, 2, attacker)) moves.push({ fr: row, fc: col, tr: homeRow, tc: 2, castle: queenSide });
    }
    return moves;
  }

  function updateCastlingRights(rights, piece, move, captured) {
    const next = { ...rights };
    if (piece === "K") { next.K = false; next.Q = false; }
    if (piece === "k") { next.k = false; next.q = false; }
    if ((piece === "R" && move.fr === 7 && move.fc === 0) || (captured === "R" && move.tr === 7 && move.tc === 0)) next.Q = false;
    if ((piece === "R" && move.fr === 7 && move.fc === 7) || (captured === "R" && move.tr === 7 && move.tc === 7)) next.K = false;
    if ((piece === "r" && move.fr === 0 && move.fc === 0) || (captured === "r" && move.tr === 0 && move.tc === 0)) next.q = false;
    if ((piece === "r" && move.fr === 0 && move.fc === 7) || (captured === "r" && move.tr === 0 && move.tc === 7)) next.k = false;
    return next;
  }

  function applyMove(board, move, castling, enPassant) {
    const nextBoard = copyBoard(board);
    const piece = nextBoard[move.fr][move.fc];
    const captured = nextBoard[move.tr][move.tc];
    nextBoard[move.tr][move.tc] = move.promo || piece;
    nextBoard[move.fr][move.fc] = null;
    if (move.enPassant) nextBoard[move.fr][move.tc] = null;
    if (move.castle) {
      const homeRow = move.castle === "K" || move.castle === "Q" ? 7 : 0;
      if (move.tc === 6) { nextBoard[homeRow][5] = nextBoard[homeRow][7]; nextBoard[homeRow][7] = null; }
      if (move.tc === 2) { nextBoard[homeRow][3] = nextBoard[homeRow][0]; nextBoard[homeRow][0] = null; }
    }
    return {
      board: nextBoard,
      castling: updateCastlingRights(castling, piece, move, captured),
      enPassant: piece.toLowerCase() === "p" && Math.abs(move.tr - move.fr) === 2 ? [(move.tr + move.fr) / 2, move.fc] : null
    };
  }

  function legalMoves(board, color, castling, enPassant) {
    const moves = [];
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if (!owns(board[row][col], color)) continue;
        for (const move of pseudoMoves(board, row, col, color, castling, enPassant)) {
          const next = applyMove(board, move, castling, enPassant);
          if (!inCheck(next.board, color)) moves.push(move);
        }
      }
    }
    return moves;
  }

  function evaluate(board) {
    let score = 0;
    for (const row of board) {
      for (const piece of row) {
        if (!piece) continue;
        const value = VALUE[piece.toLowerCase()];
        score += isWhite(piece) ? value : -value;
      }
    }
    return score;
  }

  function alexPieceBonus(type, color, row, col, endgame) {
    const advance = color === "w" ? 6 - row : row - 1;
    const center = Math.max(0, 6 - (Math.abs(3.5 - row) + Math.abs(3.5 - col)) * 2);
    if (type === "p") return advance * 9 + center * 3;
    if (type === "n") return center * 12;
    if (type === "b") return center * 7;
    if (type === "r") return advance * 2 + (col === 0 || col === 7 ? -4 : 0);
    if (type === "q") return center * 3;
    return endgame ? center * 11 : -center * 4 - Math.abs(advance) * 2;
  }

  function alexPawnStructure(board, color) {
    const pawnsByFile = Array.from({ length: 8 }, () => []);
    const pawn = color === "w" ? "P" : "p";
    const enemyPawn = color === "w" ? "p" : "P";
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if (board[row][col] === pawn) pawnsByFile[col].push(row);
      }
    }
    let score = 0;
    for (let col = 0; col < 8; col += 1) {
      for (const row of pawnsByFile[col]) {
        const advance = color === "w" ? 6 - row : row - 1;
        const hasNeighbour = pawnsByFile[col - 1]?.length || pawnsByFile[col + 1]?.length;
        if (!hasNeighbour) score -= 12;
        if (pawnsByFile[col].length > 1) score -= 10;
        let passed = true;
        for (const enemyCol of [col - 1, col, col + 1]) {
          if (enemyCol < 0 || enemyCol > 7) continue;
          for (let enemyRow = 0; enemyRow < 8; enemyRow += 1) {
            const isAhead = color === "w" ? enemyRow < row : enemyRow > row;
            if (isAhead && board[enemyRow][enemyCol] === enemyPawn) passed = false;
          }
        }
        if (passed) score += 18 + advance * 8;
      }
    }
    return score;
  }

  function alexKingSafety(board, color) {
    const king = findKing(board, color);
    if (!king) return -500;
    const pawn = color === "w" ? "P" : "p";
    const shieldRow = king[0] + (color === "w" ? -1 : 1);
    let score = 0;
    for (let col = king[1] - 1; col <= king[1] + 1; col += 1) {
      if (board[shieldRow]?.[col] === pawn) score += 13;
    }
    return score;
  }

  function evaluateAlex(board) {
    let score = 0;
    let whiteMinorPieces = 0;
    let blackMinorPieces = 0;
    let nonKingMaterial = 0;
    for (const row of board) {
      for (const piece of row) {
        if (piece && piece.toLowerCase() !== "k") nonKingMaterial += VALUE[piece.toLowerCase()];
      }
    }
    const endgame = nonKingMaterial < 2600;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const piece = board[row][col];
        if (!piece) continue;
        const color = isWhite(piece) ? "w" : "b";
        const type = piece.toLowerCase();
        const value = VALUE[type] + alexPieceBonus(type, color, row, col, endgame);
        score += color === "w" ? value : -value;
        if (piece === "B") whiteMinorPieces += 1;
        if (piece === "b") blackMinorPieces += 1;
      }
    }
    if (whiteMinorPieces >= 2) score += 32;
    if (blackMinorPieces >= 2) score -= 32;
    score += alexPawnStructure(board, "w") - alexPawnStructure(board, "b");
    if (!endgame) score += alexKingSafety(board, "w") - alexKingSafety(board, "b");
    for (const [row, col] of [[3, 3], [3, 4], [4, 3], [4, 4]]) {
      const piece = board[row][col];
      if (piece) score += isWhite(piece) ? 14 : -14;
    }
    return score;
  }

  function movePriority(board, move) {
    const mover = board[move.fr][move.fc];
    const captured = move.enPassant ? (isWhite(mover) ? "p" : "P") : board[move.tr][move.tc];
    const captureValue = captured ? VALUE[captured.toLowerCase()] : 0;
    const moverValue = mover ? VALUE[mover.toLowerCase()] : 0;
    const promotionValue = move.promo ? VALUE[move.promo.toLowerCase()] - VALUE.p : 0;
    return promotionValue * 12 + captureValue * 16 - moverValue + (move.castle ? 40 : 0);
  }

  function orderAlexMoves(board, moves) {
    return [...moves].sort((first, second) => movePriority(board, second) - movePriority(board, first));
  }

  function isTacticalMove(board, move) {
    return Boolean(board[move.tr][move.tc]) || Boolean(move.enPassant) || Boolean(move.promo);
  }

  function alexSearchDepth(moveCount) {
    if (moveCount > 16) return 3;
    if (moveCount > 10) return 4;
    return 5;
  }

  function quiescence(board, alpha, beta, maximizing, castling, enPassant, remainingDepth) {
    const standPat = evaluateAlex(board);
    if (maximizing) {
      if (standPat >= beta) return standPat;
      alpha = Math.max(alpha, standPat);
    } else {
      if (standPat <= alpha) return standPat;
      beta = Math.min(beta, standPat);
    }
    if (remainingDepth === 0) return standPat;
    const color = maximizing ? "w" : "b";
    const moves = orderAlexMoves(board, legalMoves(board, color, castling, enPassant).filter(move => isTacticalMove(board, move)));
    let score = standPat;
    for (const move of moves) {
      const next = applyMove(board, move, castling, enPassant);
      const candidate = quiescence(next.board, alpha, beta, !maximizing, next.castling, next.enPassant, remainingDepth - 1);
      if (maximizing) {
        score = Math.max(score, candidate);
        alpha = Math.max(alpha, score);
      } else {
        score = Math.min(score, candidate);
        beta = Math.min(beta, score);
      }
      if (beta <= alpha) break;
    }
    return score;
  }

  function minimax(board, depth, alpha, beta, maximizing, castling, enPassant, engine = "standard") {
    if (depth === 0) return engine === "alex"
      ? quiescence(board, alpha, beta, maximizing, castling, enPassant, 1)
      : evaluate(board);
    const color = maximizing ? "w" : "b";
    const moves = legalMoves(board, color, castling, enPassant);
    if (!moves.length) return inCheck(board, color) ? (maximizing ? -99999 + depth : 99999 - depth) : 0;
    const ordered = engine === "alex"
      ? orderAlexMoves(board, moves)
      : [...moves].sort((first, second) => Number(Boolean(board[second.tr][second.tc])) - Number(Boolean(board[first.tr][first.tc])));
    let score = maximizing ? -Infinity : Infinity;
    for (const move of ordered) {
      const next = applyMove(board, move, castling, enPassant);
      const candidate = minimax(next.board, depth - 1, alpha, beta, !maximizing, next.castling, next.enPassant, engine);
      if (maximizing) { score = Math.max(score, candidate); alpha = Math.max(alpha, score); }
      else { score = Math.min(score, candidate); beta = Math.min(beta, score); }
      if (beta <= alpha) break;
    }
    return score;
  }

  function moveKey(move) {
    return `${move.fr}${move.fc}${move.tr}${move.tc}${move.promo || ""}${move.castle || ""}${move.enPassant ? "e" : ""}`;
  }

  function leotisPositionKey(board, color, castling, enPassant, extensionsLeft = 0) {
    const pieces = board.map(row => row.map(piece => piece || ".").join("")).join("/");
    const rights = `${Number(castling.K)}${Number(castling.Q)}${Number(castling.k)}${Number(castling.q)}`;
    return `${pieces}|${color}|${rights}|${enPassant ? enPassant.join("") : "-"}|e${extensionsLeft}`;
  }

  function leotisHistoryKey(board, move) {
    return `${board[move.fr][move.fc] || "?"}:${move.tr}${move.tc}`;
  }

  function leotisMobility(board, color, castling, enPassant) {
    let mobility = 0;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if (owns(board[row][col], color)) mobility += pseudoMoves(board, row, col, color, castling, enPassant).length;
      }
    }
    return mobility;
  }

  function leotisRookFiles(board, color) {
    const rook = color === "w" ? "R" : "r";
    const pawn = color === "w" ? "P" : "p";
    const enemyPawn = color === "w" ? "p" : "P";
    let score = 0;
    for (let col = 0; col < 8; col += 1) {
      let friendlyPawn = false;
      let opposingPawn = false;
      for (let row = 0; row < 8; row += 1) {
        if (board[row][col] === pawn) friendlyPawn = true;
        if (board[row][col] === enemyPawn) opposingPawn = true;
      }
      for (let row = 0; row < 8; row += 1) {
        if (board[row][col] !== rook) continue;
        if (!friendlyPawn) score += opposingPawn ? 12 : 24;
      }
    }
    return score;
  }

  function leotisKingActivity(board, color, endgame) {
    if (!endgame) return 0;
    const king = findKing(board, color);
    if (!king) return -500;
    const distance = Math.abs(3.5 - king[0]) + Math.abs(3.5 - king[1]);
    return Math.max(0, 8 - distance * 2) * 5;
  }

  function nonKingMaterial(board) {
    let material = 0;
    for (const row of board) {
      for (const piece of row) {
        if (piece && piece.toLowerCase() !== "k") material += VALUE[piece.toLowerCase()];
      }
    }
    return material;
  }

  function evaluateLeotis(board, castling, enPassant) {
    const endgame = nonKingMaterial(board) < 2600;
    let score = evaluateAlex(board);
    score += (leotisMobility(board, "w", castling, enPassant) - leotisMobility(board, "b", castling, enPassant)) * 3;
    score += leotisRookFiles(board, "w") - leotisRookFiles(board, "b");
    score += leotisKingActivity(board, "w", endgame) - leotisKingActivity(board, "b", endgame);
    return score;
  }

  function alexDLeotisCenterControl(board) {
    let score = 0;
    for (const [row, col] of [[3, 3], [3, 4], [4, 3], [4, 4]]) {
      if (isAttacked(board, row, col, "w")) score += 9;
      if (isAttacked(board, row, col, "b")) score -= 9;
      if (board[row][col]) score += isWhite(board[row][col]) ? 7 : -7;
    }
    return score;
  }

  function alexDLeotisKingSafety(board, color) {
    const king = findKing(board, color);
    if (!king) return -500;
    let safety = 0;
    for (const [rowStep, colStep] of KING_STEPS) {
      const row = king[0] + rowStep;
      const col = king[1] + colStep;
      if (!inBounds(row, col)) continue;
      if (isAttacked(board, row, col, enemy(color))) safety -= 17;
      if (isAttacked(board, row, col, color)) safety += 4;
    }
    return safety;
  }

  function alexDLeotisHangingPieces(board, color) {
    let score = 0;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const piece = board[row][col];
        if (!piece || !owns(piece, color) || piece.toLowerCase() === "k") continue;
        if (isAttacked(board, row, col, enemy(color)) && !isAttacked(board, row, col, color)) {
          score -= Math.round(VALUE[piece.toLowerCase()] * 0.16);
        }
      }
    }
    return score;
  }

  function alexDLeotisRookActivity(board, color) {
    const rook = color === "w" ? "R" : "r";
    const seventhRank = color === "w" ? 1 : 6;
    let score = 0;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if (board[row][col] === rook && row === seventhRank) score += 18;
      }
    }
    return score;
  }

  function evaluateAlexDLeotis(board, castling, enPassant) {
    const endgame = nonKingMaterial(board) < 2600;
    let score = evaluateLeotis(board, castling, enPassant);
    score += alexDLeotisCenterControl(board);
    score += alexDLeotisRookActivity(board, "w") - alexDLeotisRookActivity(board, "b");
    score += alexDLeotisHangingPieces(board, "w") - alexDLeotisHangingPieces(board, "b");
    if (!endgame) score += alexDLeotisKingSafety(board, "w") - alexDLeotisKingSafety(board, "b");
    return score;
  }

  function leotisMovePriority(board, move, context, ply, principalMove, transpositionMove) {
    const key = moveKey(move);
    if (key === principalMove) return 10000000;
    if (key === transpositionMove) return 9000000;
    const killerMoves = context.killers.get(ply) || [];
    if (killerMoves.includes(key)) return 8000000;
    return movePriority(board, move) * 100 + (context.history.get(leotisHistoryKey(board, move)) || 0);
  }

  function orderLeotisMoves(board, moves, context, ply, principalMove, transpositionMove) {
    return [...moves].sort((first, second) => leotisMovePriority(board, second, context, ply, principalMove, transpositionMove) - leotisMovePriority(board, first, context, ply, principalMove, transpositionMove));
  }

  function leotisCheckTimeout(context) {
    if (performance.now() >= context.deadline) throw context.timeout;
  }

  function leotisRecordCutoff(board, move, context, ply, depth) {
    if (isTacticalMove(board, move)) return;
    const key = moveKey(move);
    const killers = context.killers.get(ply) || [];
    context.killers.set(ply, [key, ...killers.filter(candidate => candidate !== key)].slice(0, 2));
    const historyKey = leotisHistoryKey(board, move);
    context.history.set(historyKey, (context.history.get(historyKey) || 0) + depth * depth);
  }

  function leotisGivesCheck(board, move, castling, enPassant, color) {
    const next = applyMove(board, move, castling, enPassant);
    return inCheck(next.board, enemy(color));
  }

  function leotisQuiescence(board, alpha, beta, maximizing, castling, enPassant, context, ply, remainingDepth) {
    leotisCheckTimeout(context);
    const color = maximizing ? "w" : "b";
    const legal = legalMoves(board, color, castling, enPassant);
    if (!legal.length) return inCheck(board, color) ? (maximizing ? -99999 + ply : 99999 - ply) : 0;
    const checked = inCheck(board, color);
    const standPat = context.evaluate(board, castling, enPassant);
    if (!checked) {
      if (maximizing) {
        if (standPat >= beta) return standPat;
        alpha = Math.max(alpha, standPat);
      } else {
        if (standPat <= alpha) return standPat;
        beta = Math.min(beta, standPat);
      }
    }
    if (remainingDepth === 0) return standPat;
    const tactical = checked ? legal : legal.filter(move => isTacticalMove(board, move) || leotisGivesCheck(board, move, castling, enPassant, color));
    let score = standPat;
    const ordered = orderLeotisMoves(board, tactical, context, ply, "", "");
    for (const move of ordered) {
      leotisCheckTimeout(context);
      const next = applyMove(board, move, castling, enPassant);
      const candidate = leotisQuiescence(next.board, alpha, beta, !maximizing, next.castling, next.enPassant, context, ply + 1, remainingDepth - 1);
      if (maximizing) {
        score = Math.max(score, candidate);
        alpha = Math.max(alpha, score);
      } else {
        score = Math.min(score, candidate);
        beta = Math.min(beta, score);
      }
      if (beta <= alpha) break;
    }
    return score;
  }

  function leotisSearch(board, depth, alpha, beta, maximizing, castling, enPassant, context, ply, extensionsLeft = context.extensions) {
    leotisCheckTimeout(context);
    if (depth === 0) return leotisQuiescence(board, alpha, beta, maximizing, castling, enPassant, context, ply, context.quiescenceDepth);
    const color = maximizing ? "w" : "b";
    const position = leotisPositionKey(board, color, castling, enPassant, extensionsLeft);
    const cached = context.table.get(position);
    if (cached?.depth >= depth) return cached.score;
    const moves = legalMoves(board, color, castling, enPassant);
    if (!moves.length) return inCheck(board, color) ? (maximizing ? -99999 + ply : 99999 - ply) : 0;
    const ordered = orderLeotisMoves(board, moves, context, ply, "", cached?.best || "");
    let score = maximizing ? -Infinity : Infinity;
    let bestMove = "";
    let cutOff = false;
    for (const move of ordered) {
      leotisCheckTimeout(context);
      const next = applyMove(board, move, castling, enPassant);
      const extendsForcingMove = extensionsLeft > 0 && depth <= 4
        && (Boolean(move.promo) || leotisGivesCheck(board, move, castling, enPassant, color));
      const nextExtensions = extensionsLeft - Number(extendsForcingMove);
      const nextDepth = depth - 1 + Number(extendsForcingMove);
      const candidate = leotisSearch(next.board, nextDepth, alpha, beta, !maximizing, next.castling, next.enPassant, context, ply + 1, nextExtensions);
      if (maximizing ? candidate > score : candidate < score) {
        score = candidate;
        bestMove = moveKey(move);
      }
      if (maximizing) alpha = Math.max(alpha, score);
      else beta = Math.min(beta, score);
      if (beta <= alpha) {
        cutOff = true;
        leotisRecordCutoff(board, move, context, ply, depth);
        break;
      }
    }
    if (!cutOff && context.table.size < context.tableLimit) context.table.set(position, { depth, score, best: bestMove });
    return score;
  }

  function leotisRootSearch(board, moves, color, castling, enPassant, depth, context, alpha = -Infinity, beta = Infinity) {
    const maximizing = color === "w";
    const rootKey = leotisPositionKey(board, color, castling, enPassant, context.extensions);
    const cached = context.table.get(rootKey);
    const ordered = orderLeotisMoves(board, moves, context, 0, context.principalMove, cached?.best || "");
    let bestScore = maximizing ? -Infinity : Infinity;
    let bestMove = ordered[0];
    let cutOff = false;
    for (const move of ordered) {
      leotisCheckTimeout(context);
      const next = applyMove(board, move, castling, enPassant);
      const score = leotisSearch(next.board, depth - 1, alpha, beta, !maximizing, next.castling, next.enPassant, context, 1, context.extensions);
      if (maximizing ? score > bestScore : score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (maximizing) alpha = Math.max(alpha, bestScore);
      else beta = Math.min(beta, bestScore);
      if (beta <= alpha) {
        cutOff = true;
        break;
      }
    }
    if (!cutOff && context.table.size < context.tableLimit) context.table.set(rootKey, { depth, score: bestScore, best: moveKey(bestMove) });
    return { move: bestMove, score: bestScore };
  }

  function chooseLeotisMove(board, moves, color, castling, enPassant, profile = {}) {
    const context = {
      deadline: performance.now() + (profile.timeLimit ?? LEOTIS_TIME_LIMIT),
      table: new Map(),
      history: new Map(),
      killers: new Map(),
      principalMove: "",
      timeout: Symbol("leotis-timeout"),
      evaluate: profile.evaluate ?? evaluateLeotis,
      extensions: profile.extensions ?? 0,
      quiescenceDepth: profile.quiescenceDepth ?? 2,
      tableLimit: profile.tableLimit ?? 90000
    };
    const maxDepth = profile.maxDepth ?? 9;
    const aspirationWindow = profile.aspirationWindow ?? 0;
    let best = { move: moves[0], score: 0, depth: 0 };
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      try {
        let result;
        if (best.depth > 0 && aspirationWindow) {
          const lowerBound = best.score - aspirationWindow;
          const upperBound = best.score + aspirationWindow;
          result = leotisRootSearch(board, moves, color, castling, enPassant, depth, context, lowerBound, upperBound);
          if (result.score <= lowerBound || result.score >= upperBound) {
            result = leotisRootSearch(board, moves, color, castling, enPassant, depth, context);
          }
        } else {
          result = leotisRootSearch(board, moves, color, castling, enPassant, depth, context);
        }
        best = { ...result, depth };
        context.principalMove = moveKey(result.move);
        if (Math.abs(result.score) > 99000) break;
      } catch (error) {
        if (error !== context.timeout) throw error;
        break;
      }
    }
    return best;
  }

  function createAlexDLeotisProfile(board, moves, color, castling, enPassant) {
    const endgame = nonKingMaterial(board) < 2600;
    const inCheckNow = inCheck(board, color);
    const forcingMoves = moves.filter(move => isTacticalMove(board, move) || leotisGivesCheck(board, move, castling, enPassant, color)).length;
    let timeLimit = 1700;
    if (forcingMoves >= 4) timeLimit += 700;
    if (inCheckNow) timeLimit += 650;
    if (moves.length <= 10) timeLimit += 500;
    if (endgame) timeLimit += 350;
    if (moves.length >= 28) timeLimit -= 250;
    const boundedTime = Math.max(1500, Math.min(3400, timeLimit));
    const maxDepth = endgame || moves.length <= 10 ? 12 : forcingMoves >= 4 ? 11 : 10;
    const thinkingText = inCheckNow
      ? "Алекс Д’ Леотис ищет защиту…"
      : forcingMoves >= 4
        ? "Алекс Д’ Леотис рассчитывает тактику…"
        : endgame
          ? "Алекс Д’ Леотис анализирует эндшпиль…"
          : "Алекс Д’ Леотис анализирует позицию…";
    return {
      timeLimit: boundedTime,
      maxDepth,
      quiescenceDepth: 3,
      extensions: 2,
      tableLimit: 180000,
      aspirationWindow: 70,
      evaluate: evaluateAlexDLeotis,
      thinkingText
    };
  }

  function positionToFen() {
    const position = state.board.map(row => {
      let emptySquares = 0;
      let fenRow = "";
      for (const piece of row) {
        if (piece) {
          if (emptySquares) fenRow += emptySquares;
          fenRow += piece;
          emptySquares = 0;
        } else {
          emptySquares += 1;
        }
      }
      return fenRow + (emptySquares || "");
    }).join("/");
    const castling = ["K", "Q", "k", "q"].filter(right => state.castling[right]).join("") || "-";
    const enPassant = state.enPassant ? squareName(state.enPassant[0], state.enPassant[1]) : "-";
    const fullMove = Math.floor(state.moveHistory.length / 2) + 1;
    return `${position} ${state.turn} ${castling} ${enPassant} 0 ${fullMove}`;
  }

  function stockfishMoveTime(board, moves, color, castling, enPassant) {
    const profile = createAlexDLeotisProfile(board, moves, color, castling, enPassant);
    return Math.max(2500, Math.min(5600, profile.timeLimit + 1500));
  }

  function moveFromUci(uci, moves) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
    const fromRow = 8 - Number(uci[1]);
    const fromCol = uci.charCodeAt(0) - 97;
    const toRow = 8 - Number(uci[3]);
    const toCol = uci.charCodeAt(2) - 97;
    const promotion = uci[4] || "";
    return moves.find(move => move.fr === fromRow && move.fc === fromCol && move.tr === toRow && move.tc === toCol
      && (move.promo ? move.promo.toLowerCase() === promotion : !promotion)) || null;
  }

  function stopStockfish() {
    state.stockfishSearchId += 1;
    if (!state.stockfishWorker) return;
    state.stockfishWorker.terminate();
    state.stockfishWorker = null;
  }

  function getStockfishWorker() {
    if (state.stockfishWorker) return state.stockfishWorker;
    const worker = new Worker("stockfish/stockfish-18-lite-single.js");
    worker.postMessage("uci");
    worker.postMessage("setoption name Hash value 64");
    state.stockfishWorker = worker;
    return worker;
  }

  function playAlexDLeotisFallback(moves, color) {
    const profile = createAlexDLeotisProfile(state.board, moves, color, state.castling, state.enPassant);
    const selected = chooseLeotisMove(state.board, moves, color, state.castling, state.enPassant, profile).move;
    if (selected) doMove(selected);
    getElement("thinking").textContent = "";
  }

  function requestStockfishMove(moves, color) {
    const searchId = state.stockfishSearchId + 1;
    const moveTime = stockfishMoveTime(state.board, moves, color, state.castling, state.enPassant);
    state.stockfishSearchId = searchId;
    getElement("thinking").textContent = "Алекс Д’ Леотис анализирует позицию…";
    let worker;
    try {
      worker = getStockfishWorker();
    } catch {
      playAlexDLeotisFallback(moves, color);
      return;
    }
    worker.onmessage = event => {
      if (searchId !== state.stockfishSearchId) return;
      const line = String(event.data);
      if (!line.startsWith("bestmove ")) return;
      const selected = moveFromUci(line.split(/\s+/)[1], moves);
      state.stockfishSearchId += 1;
      worker.onmessage = null;
      worker.onerror = null;
      if (selected && !state.gameOver && state.turn === color) doMove(selected);
      else playAlexDLeotisFallback(moves, color);
      getElement("thinking").textContent = "";
    };
    worker.onerror = () => {
      if (searchId !== state.stockfishSearchId) return;
      worker.terminate();
      if (state.stockfishWorker === worker) state.stockfishWorker = null;
      state.stockfishSearchId += 1;
      playAlexDLeotisFallback(moves, color);
    };
    worker.postMessage(`position fen ${positionToFen()}`);
    worker.postMessage(`go movetime ${moveTime}`);
  }

  function chooseLeotisWarmupMove(board, moves, color, castling, enPassant) {
    const ranked = moves.map(move => {
      const next = applyMove(board, move, castling, enPassant);
      return { move, score: evaluateLeotis(next.board, next.castling, next.enPassant) };
    });
    ranked.sort((first, second) => color === "w" ? second.score - first.score : first.score - second.score);
    const start = Math.min(ranked.length - 1, Math.floor(ranked.length * .58));
    const pool = ranked.slice(start, Math.min(ranked.length, start + Math.max(1, Math.ceil(ranked.length * .25))));
    return pool[Math.floor(pool.length / 2)]?.move || ranked.at(-1)?.move || moves[0];
  }

  function awakenLeotis(moverColor, captured, board) {
    if (currentDifficulty().engine !== "leotis" || state.leotisAwakened || moverColor !== state.playerColor) return;
    if ((captured && owns(captured, botColor())) || inCheck(board, botColor())) state.leotisAwakened = true;
  }

  function aiMove(delay = 500) {
    if (state.gameOver) return;
    const color = botColor();
    const level = currentDifficulty();
    getElement("thinking").textContent = level.engine === "stockfish" || level.engine === "alex-d-leotis"
      ? "Алекс Д’ Леотис анализирует позицию…"
      : level.engine === "leotis"
        ? "Леотис анализирует позицию…"
        : "Бот думает…";
    state.aiTimer = setTimeout(() => {
      state.aiTimer = null;
      const moves = legalMoves(state.board, color, state.castling, state.enPassant);
      if (!moves.length) { endGame(inCheck(state.board, color) ? "win" : "draw"); return; }
      if (level.engine === "stockfish") {
        requestStockfishMove(moves, color);
        return;
      }
      if (level.engine === "alex-d-leotis") {
        const profile = createAlexDLeotisProfile(state.board, moves, color, state.castling, state.enPassant);
        getElement("thinking").textContent = profile.thinkingText;
        const selected = chooseLeotisMove(state.board, moves, color, state.castling, state.enPassant, profile).move;
        if (selected) doMove(selected);
        getElement("thinking").textContent = "";
        return;
      }
      if (level.engine === "leotis") {
        const selected = state.leotisAwakened
          ? chooseLeotisMove(state.board, moves, color, state.castling, state.enPassant).move
          : chooseLeotisWarmupMove(state.board, moves, color, state.castling, state.enPassant);
        if (selected) doMove(selected);
        getElement("thinking").textContent = "";
        return;
      }
      const searchDepth = level.engine === "alex" ? alexSearchDepth(moves.length) : level.depth;
      const rankedMoves = [];
      for (const move of moves) {
        const next = applyMove(state.board, move, state.castling, state.enPassant);
        const score = minimax(next.board, searchDepth - 1, -Infinity, Infinity, color === "b", next.castling, next.enPassant, level.engine);
        rankedMoves.push({ move, score });
      }
      rankedMoves.sort((first, second) => color === "w" ? second.score - first.score : first.score - second.score);
      const strongest = rankedMoves.slice(0, Math.min(level.candidates, rankedMoves.length));
      const choicePool = Math.random() < level.mistakeChance
        ? rankedMoves.slice(0, Math.min(level.mistakePool, rankedMoves.length))
        : strongest;
      const selected = choicePool[Math.floor(Math.random() * choicePool.length)];
      if (selected) doMove(selected.move);
      getElement("thinking").textContent = "";
    }, delay);
  }

  function recordMove(move, piece) {
    state.moveHistory.push({
      piece,
      from: squareName(move.fr, move.fc),
      to: squareName(move.tr, move.tc),
      snapshot: createPositionSnapshot()
    });
  }

  function formatMoveCount(count) {
    const lastTwoDigits = count % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} ходов`;
    const lastDigit = count % 10;
    if (lastDigit === 1) return `${count} ход`;
    if (lastDigit >= 2 && lastDigit <= 4) return `${count} хода`;
    return `${count} ходов`;
  }

  function renderMoveHistory() {
    const list = getElement("move-list");
    const count = getElement("move-count");
    count.textContent = formatMoveCount(state.moveHistory.length);
    getElement("undo-turn").disabled = lastPlayerMoveIndex() === -1;
    list.innerHTML = "";
    if (!state.moveHistory.length) {
      const empty = document.createElement("li");
      empty.className = "history-empty";
      empty.textContent = "Пока ходов нет";
      list.appendChild(empty);
      return;
    }
    state.moveHistory.forEach((entry, index) => {
      const item = document.createElement("li");
      const move = document.createElement("button");
      const moveNumber = document.createElement("span");
      const piece = document.createElement("span");
      const path = document.createElement("span");
      move.type = "button";
      move.className = "history-move";
      move.dataset.historyIndex = String(index);
      move.disabled = !state.gameOver;
      move.setAttribute("aria-label", `${describeSquareName(entry.piece)}: ${entry.from} → ${entry.to}`);
      if (state.replayIndex === index + 1) move.classList.add("active");
      moveNumber.className = "history-number";
      moveNumber.textContent = index % 2 === 0 ? `${Math.floor(index / 2) + 1}.` : "…";
      piece.className = `history-piece ${isWhite(entry.piece) ? "white" : "black"}`;
      piece.textContent = PIECES[entry.piece];
      piece.setAttribute("aria-hidden", "true");
      path.className = "history-path";
      path.textContent = `— ${entry.from} → ${entry.to}`;
      move.append(moveNumber, piece, path);
      item.appendChild(move);
      list.appendChild(item);
    });
  }

  function describeSquareName(piece) {
    return `${isWhite(piece) ? "Белые" : "Чёрные"}: ${PIECE_NAMES[piece.toLowerCase()]}`;
  }

  function lastPlayerMoveIndex() {
    for (let index = state.moveHistory.length - 1; index >= 0; index -= 1) {
      if (owns(state.moveHistory[index].piece, state.playerColor)) return index;
    }
    return -1;
  }

  function undoPlayerTurn() {
    const moveIndex = lastPlayerMoveIndex();
    if (moveIndex === -1 || !state.initialPosition) return;
    clearTimers();
    const previousPosition = moveIndex === 0 ? state.initialPosition : state.moveHistory[moveIndex - 1].snapshot;
    restorePositionSnapshot(previousPosition);
    state.moveHistory.splice(moveIndex);
    state.gameOver = false;
    state.replayIndex = null;
    state.finalStatus = "";
    getElement("restart").style.display = "none";
    getElement("thinking").textContent = "";
    updateStatus();
    render();
    renderMoveHistory();
    syncReplayControls();
  }

  function syncReplayControls() {
    const controls = getElement("replay-controls");
    const hasReplay = state.gameOver && state.moveHistory.length > 0;
    controls.hidden = !hasReplay;
    if (!hasReplay) return;
    const total = state.moveHistory.length;
    const index = state.replayIndex ?? total;
    getElement("replay-first").disabled = index === 0;
    getElement("replay-previous").disabled = index === 0;
    getElement("replay-next").disabled = index === total;
    getElement("replay-last").disabled = index === total;
    getElement("replay-position").textContent = index === total ? "Финальная позиция" : `Ход ${index} из ${total}`;
  }

  function viewPosition(index) {
    if (!state.gameOver || !state.initialPosition) return;
    const total = state.moveHistory.length;
    const nextIndex = Math.max(0, Math.min(total, index));
    const snapshot = nextIndex === 0 ? state.initialPosition : state.moveHistory[nextIndex - 1].snapshot;
    restorePositionSnapshot(snapshot);
    state.replayIndex = nextIndex;
    getElement("thinking").textContent = "";
    getElement("status").textContent = nextIndex === total
      ? state.finalStatus
      : `Просмотр партии: ход ${nextIndex} из ${total}`;
    render();
    renderMoveHistory();
    syncReplayControls();
  }

  function doMove(move) {
    const animation = captureMoveAnimation(move);
    const mover = state.board[move.fr][move.fc];
    const captured = move.enPassant ? state.board[move.fr][move.tc] : state.board[move.tr][move.tc];
    const next = applyMove(state.board, move, state.castling, state.enPassant);
    awakenLeotis(isWhite(mover) ? "w" : "b", captured, next.board);
    state.board = next.board;
    state.castling = next.castling;
    state.enPassant = next.enPassant;
    state.lastMove = copyMove(move);
    state.selected = null;
    state.possible = [];
    state.turn = enemy(state.turn);
    recordMove(move, mover);
    render();
    renderMoveHistory();
    playMoveAnimation(animation);
    const moves = legalMoves(state.board, state.turn, state.castling, state.enPassant);
    if (!moves.length) { endGame(inCheck(state.board, state.turn) ? (state.turn === state.playerColor ? "lose" : "win") : "draw"); return; }
    updateStatus();
    if (state.turn === botColor()) aiMove();
  }

  function endGame(result) {
    state.gameOver = true;
    const status = getElement("status");
    if (result === "win" && state.difficulty < DIFFICULTY_LEVELS.length - 1) {
      const nextDifficulty = state.difficulty + 1;
      state.difficulty = nextDifficulty;
      updateDifficultyDisplay();
      savePreferences();
      state.finalStatus = `Победа! Следующий уровень: ${nextDifficulty + 1} · ${DIFFICULTY_LEVELS[nextDifficulty].label}`;
      getElement("thinking").textContent = "Следующий соперник будет выбран после новой партии.";
    } else if (result === "win") {
      state.finalStatus = `Вы прошли все ${DIFFICULTY_LEVELS.length} уровней. Легендарная победа!`;
      getElement("thinking").textContent = "";
    } else {
      state.finalStatus = result === "lose" ? "Вы проиграли" : "Ничья";
      getElement("thinking").textContent = "";
    }
    status.textContent = state.finalStatus;
    state.replayIndex = state.moveHistory.length;
    getElement("restart").style.display = "inline-block";
    renderMoveHistory();
    syncReplayControls();
  }

  function updateStatus() {
    if (state.gameOver) return;
    const side = state.playerColor === "w" ? "белыми" : "чёрными";
    getElement("status").textContent = state.turn === state.playerColor
      ? (inCheck(state.board, state.playerColor) ? `Шах! Ваш ход (${side})` : `Ваш ход (${side})`)
      : (inCheck(state.board, botColor()) ? "Шах! Ход бота" : "Ход бота");
  }

  function toBoard(displayRow, displayCol) {
    return state.playerColor === "w" ? [displayRow, displayCol] : [7 - displayRow, 7 - displayCol];
  }

  function toDisplay(row, col) {
    return state.playerColor === "w" ? [row, col] : [7 - row, 7 - col];
  }

  function captureMoveAnimation(move) {
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
    const piece = state.board[move.fr][move.fc];
    const [displayRow, displayCol] = toDisplay(move.fr, move.fc);
    const sourceSquare = state.squareGrid[displayRow]?.[displayCol];
    if (!piece || !sourceSquare?.getBoundingClientRect || !document.body?.appendChild) return null;
    const sourceRect = sourceSquare.getBoundingClientRect();
    if (!sourceRect.width || !sourceRect.height) return null;
    return { move, piece, sourceRect };
  }

  function playMoveAnimation(animation) {
    if (!animation) return;
    const [displayRow, displayCol] = toDisplay(animation.move.tr, animation.move.tc);
    const targetSquare = state.squareGrid[displayRow]?.[displayCol];
    if (!targetSquare?.getBoundingClientRect) return;
    const targetRect = targetSquare.getBoundingClientRect();
    const targetPiece = targetSquare.pieceElement;
    if (!targetRect.width || !targetRect.height || !targetPiece) return;
    const ghost = document.createElement("span");
    ghost.className = `piece move-ghost ${isWhite(animation.piece) ? "white" : "black"}`;
    ghost.textContent = PIECES[animation.piece];
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.left = `${animation.sourceRect.left}px`;
    ghost.style.top = `${animation.sourceRect.top}px`;
    ghost.style.width = `${animation.sourceRect.width}px`;
    ghost.style.height = `${animation.sourceRect.height}px`;
    ghost.style.fontSize = `${animation.sourceRect.height * 0.76}px`;
    targetPiece.classList.add("moving-target");
    document.body.appendChild(ghost);
    const translateX = targetRect.left - animation.sourceRect.left;
    const translateY = targetRect.top - animation.sourceRect.top;
    const nextFrame = window.requestAnimationFrame || (callback => setTimeout(callback, 0));
    nextFrame(() => { ghost.style.transform = `translate(${translateX}px, ${translateY}px)`; });
    setTimeout(() => {
      targetPiece.classList.remove("moving-target");
      ghost.remove();
    }, 180);
  }

  function describeSquare(row, col, piece) {
    const coordinate = `${String.fromCharCode(97 + col)}${8 - row}`;
    if (!piece) return `Пустая клетка ${coordinate}`;
    const color = isWhite(piece) ? "белая" : "чёрная";
    return `${color} ${PIECE_NAMES[piece.toLowerCase()]} на ${coordinate}`;
  }

  function createBoardGrid() {
    const boardElement = getElement("board");
    boardElement.innerHTML = "";
    state.squareGrid = [];
    for (let displayRow = 0; displayRow < 8; displayRow += 1) {
      const row = [];
      for (let displayCol = 0; displayCol < 8; displayCol += 1) {
        const square = document.createElement("div");
        square.setAttribute("role", "gridcell");
        square.tabIndex = 0;
        const pieceElement = document.createElement("span");
        pieceElement.className = "piece";
        pieceElement.setAttribute("aria-hidden", "true");
        square.appendChild(pieceElement);
        square.pieceElement = pieceElement;
        if (displayCol === 0) {
          const rank = document.createElement("span");
          rank.className = "board-coordinate rank-coordinate";
          square.appendChild(rank);
          square.rankElement = rank;
        }
        if (displayRow === 7) {
          const file = document.createElement("span");
          file.className = "board-coordinate file-coordinate";
          square.appendChild(file);
          square.fileElement = file;
        }
        square.dataset.row = displayRow;
        square.dataset.col = displayCol;
        square.addEventListener("click", onSquareClick);
        square.addEventListener("keydown", onSquareKeyDown);
        boardElement.appendChild(square);
        row.push(square);
      }
      state.squareGrid.push(row);
    }
  }

  function render() {
    if (state.squareGrid.length !== 8) createBoardGrid();
    const availableSquares = new Set(state.possible.map(move => `${move.tr},${move.tc}`));
    const whiteKingInCheck = inCheck(state.board, "w");
    const blackKingInCheck = inCheck(state.board, "b");
    for (let displayRow = 0; displayRow < 8; displayRow += 1) {
      for (let displayCol = 0; displayCol < 8; displayCol += 1) {
        const [row, col] = toBoard(displayRow, displayCol);
        const square = state.squareGrid[displayRow][displayCol];
        const piece = state.board[row][col];
        const isSelected = state.selected?.[0] === row && state.selected?.[1] === col;
        const isLastMove = state.lastMove && ((state.lastMove.fr === row && state.lastMove.fc === col) || (state.lastMove.tr === row && state.lastMove.tc === col));
        const isPossible = availableSquares.has(`${row},${col}`);
        const isCheckedKing = (piece === "K" && whiteKingInCheck) || (piece === "k" && blackKingInCheck);
        square.className = `sq ${(row + col) % 2 === 0 ? "light" : "dark"}`;
        if (isSelected) square.classList.add("selected");
        if (isLastMove) square.classList.add("last");
        if (isPossible) square.classList.add("possible");
        if (isPossible && piece) square.classList.add("capture");
        if (isCheckedKing) square.classList.add("check");
        square.setAttribute("aria-label", describeSquare(row, col, piece));
        square.pieceElement.className = piece ? `piece ${isWhite(piece) ? "white" : "black"}` : "piece";
        square.pieceElement.textContent = piece ? PIECES[piece] : "";
        if (square.rankElement) square.rankElement.textContent = String(8 - row);
        if (square.fileElement) square.fileElement.textContent = String.fromCharCode(97 + col);
      }
    }
  }

  function onSquareClick(event) {
    if (state.gameOver || state.turn !== state.playerColor) return;
    const [row, col] = toBoard(Number(event.currentTarget.dataset.row), Number(event.currentTarget.dataset.col));
    const move = state.possible.find(candidate => candidate.tr === row && candidate.tc === col);
    if (move) { doMove(move); return; }
    if (owns(state.board[row][col], state.playerColor)) {
      state.selected = [row, col];
      state.possible = legalMoves(state.board, state.playerColor, state.castling, state.enPassant).filter(candidate => candidate.fr === row && candidate.fc === col);
    } else {
      state.selected = null;
      state.possible = [];
    }
    render();
  }

  function onSquareKeyDown(event) {
    const movement = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1]
    };
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSquareClick(event);
      return;
    }
    const step = movement[event.key];
    if (!step) return;
    event.preventDefault();
    const row = Number(event.currentTarget.dataset.row) + step[0];
    const col = Number(event.currentTarget.dataset.col) + step[1];
    if (!inBounds(row, col)) return;
    getElement("board").querySelector(`[data-row="${row}"][data-col="${col}"]`)?.focus();
  }

  getElement("restart").addEventListener("click", init);
  getElement("switch").addEventListener("click", () => { state.playerColor = enemy(state.playerColor); init(); });
  getElement("undo-turn").addEventListener("click", undoPlayerTurn);
  getElement("move-list").addEventListener("click", event => {
    const entry = event.target.closest("button[data-history-index]");
    if (!entry || !state.gameOver) return;
    viewPosition(Number(entry.dataset.historyIndex) + 1);
  });
  getElement("replay-first").addEventListener("click", () => viewPosition(0));
  getElement("replay-previous").addEventListener("click", () => viewPosition((state.replayIndex ?? state.moveHistory.length) - 1));
  getElement("replay-next").addEventListener("click", () => viewPosition((state.replayIndex ?? state.moveHistory.length) + 1));
  getElement("replay-last").addEventListener("click", () => viewPosition(state.moveHistory.length));
  getElement("settings-toggle").addEventListener("click", () => {
    state.settingsOpen = !state.settingsOpen;
    syncSettingsPanel();
  });
  getElement("difficulty").addEventListener("change", event => {
    state.difficulty = Number(event.target.value);
    savePreferences();
    init();
  });
  getElement("theme").addEventListener("change", event => {
    state.theme = event.target.value;
    applyTheme();
    savePreferences();
  });
  restorePreferences();
  init();
})();
