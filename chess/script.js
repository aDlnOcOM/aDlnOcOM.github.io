// Управляет правилами шахмат, отрисовкой доски и ходами локального соперника.
(() => {
  const PIECES = {
    K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
    k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
  };
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
    { label: "Легенда", depth: 4, candidates: 1, mistakeChance: 0, mistakePool: 1 }
  ];

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
    advanceTimer: null
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
    getElement("restart").style.display = "none";
    getElement("thinking").textContent = "";
    applyTheme();
    updateDifficultyDisplay();
    updateStatus();
    render();
    if (state.playerColor === "b") aiMove(80);
  }

  function clearTimers() {
    if (state.aiTimer !== null) clearTimeout(state.aiTimer);
    if (state.advanceTimer !== null) clearTimeout(state.advanceTimer);
    state.aiTimer = null;
    state.advanceTimer = null;
  }

  function updateDifficultyDisplay() {
    const level = currentDifficulty();
    getElement("difficulty").value = String(state.difficulty);
    getElement("level-indicator").textContent = `Уровень ${state.difficulty + 1} из 10 · ${level.label}`;
  }

  function applyTheme() {
    document.body.dataset.theme = state.theme;
    getElement("theme").value = state.theme;
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

  function minimax(board, depth, alpha, beta, maximizing, castling, enPassant) {
    if (depth === 0) return evaluate(board);
    const color = maximizing ? "w" : "b";
    const moves = legalMoves(board, color, castling, enPassant);
    if (!moves.length) return inCheck(board, color) ? (maximizing ? -99999 + depth : 99999 - depth) : 0;
    const ordered = [...moves].sort((first, second) => Number(Boolean(board[second.tr][second.tc])) - Number(Boolean(board[first.tr][first.tc])));
    let score = maximizing ? -Infinity : Infinity;
    for (const move of ordered) {
      const next = applyMove(board, move, castling, enPassant);
      const candidate = minimax(next.board, depth - 1, alpha, beta, !maximizing, next.castling, next.enPassant);
      if (maximizing) { score = Math.max(score, candidate); alpha = Math.max(alpha, score); }
      else { score = Math.min(score, candidate); beta = Math.min(beta, score); }
      if (beta <= alpha) break;
    }
    return score;
  }

  function aiMove(delay = 40) {
    if (state.gameOver) return;
    const color = botColor();
    getElement("thinking").textContent = "Бот думает…";
    state.aiTimer = setTimeout(() => {
      state.aiTimer = null;
      const moves = legalMoves(state.board, color, state.castling, state.enPassant);
      if (!moves.length) { endGame(inCheck(state.board, color) ? "win" : "draw"); return; }
      const level = currentDifficulty();
      const rankedMoves = [];
      for (const move of moves) {
        const next = applyMove(state.board, move, state.castling, state.enPassant);
        const score = minimax(next.board, level.depth - 1, -Infinity, Infinity, color === "b", next.castling, next.enPassant);
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

  function doMove(move) {
    const next = applyMove(state.board, move, state.castling, state.enPassant);
    state.board = next.board;
    state.castling = next.castling;
    state.enPassant = next.enPassant;
    state.lastMove = move;
    state.selected = null;
    state.possible = [];
    state.turn = enemy(state.turn);
    render();
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
      status.textContent = `Победа! Следующий уровень: ${nextDifficulty + 1} · ${DIFFICULTY_LEVELS[nextDifficulty].label}`;
      getElement("thinking").textContent = "Переход к следующему сопернику…";
      state.advanceTimer = setTimeout(() => {
        state.difficulty = nextDifficulty;
        init();
      }, 1600);
    } else if (result === "win") {
      status.textContent = "Вы прошли все 10 уровней. Легендарная победа!";
      getElement("thinking").textContent = "";
    } else {
      status.textContent = result === "lose" ? "Вы проиграли" : "Ничья";
      getElement("thinking").textContent = "";
    }
    getElement("restart").style.display = "inline-block";
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

  function render() {
    const boardElement = getElement("board");
    boardElement.innerHTML = "";
    for (let displayRow = 0; displayRow < 8; displayRow += 1) {
      for (let displayCol = 0; displayCol < 8; displayCol += 1) {
        const [row, col] = toBoard(displayRow, displayCol);
        const square = document.createElement("div");
        square.className = `sq ${(row + col) % 2 === 0 ? "light" : "dark"}`;
        if (state.selected?.[0] === row && state.selected?.[1] === col) square.classList.add("selected");
        if (state.lastMove && ((state.lastMove.fr === row && state.lastMove.fc === col) || (state.lastMove.tr === row && state.lastMove.tc === col))) square.classList.add("last");
        if (state.possible.some(move => move.tr === row && move.tc === col)) {
          square.classList.add("possible");
          if (state.board[row][col]) square.classList.add("capture");
        }
        const piece = state.board[row][col];
        if (piece) {
          const pieceElement = document.createElement("span");
          pieceElement.className = `piece ${isWhite(piece) ? "white" : "black"}`;
          pieceElement.textContent = PIECES[piece];
          square.appendChild(pieceElement);
          if ((piece === "K" && inCheck(state.board, "w")) || (piece === "k" && inCheck(state.board, "b"))) square.classList.add("check");
        }
        square.dataset.row = displayRow;
        square.dataset.col = displayCol;
        square.addEventListener("click", onSquareClick);
        boardElement.appendChild(square);
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

  getElement("restart").addEventListener("click", init);
  getElement("switch").addEventListener("click", () => { state.playerColor = enemy(state.playerColor); init(); });
  getElement("difficulty").addEventListener("change", event => {
    state.difficulty = Number(event.target.value);
    init();
  });
  getElement("theme").addEventListener("change", event => {
    state.theme = event.target.value;
    applyTheme();
  });
  init();
})();
