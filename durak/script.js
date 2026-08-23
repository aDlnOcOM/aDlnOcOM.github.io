// Управляет правилами «Дурака», настройками партии, отрисовкой карт и ходами ИИ-соперников.
(() => {
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RED_SUITS = new Set(["♥", "♦"]);
  const RANKS = {
    24: ["9", "10", "J", "Q", "K", "A"],
    36: ["6", "7", "8", "9", "10", "J", "Q", "K", "A"],
    52: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
  };
  const RANK_VALUE = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14 };
  const AI_LEVELS = [
    { name: "Новичок", throwChance: 0.18, trumpPenalty: 4, transferBias: 0, reserve: 0 },
    { name: "Осторожный", throwChance: 0.25, trumpPenalty: 7, transferBias: 0.08, reserve: 0 },
    { name: "Любитель", throwChance: 0.32, trumpPenalty: 9, transferBias: 0.12, reserve: 1 },
    { name: "Игрок клуба", throwChance: 0.38, trumpPenalty: 12, transferBias: 0.18, reserve: 1 },
    { name: "Опытный", throwChance: 0.46, trumpPenalty: 16, transferBias: 0.26, reserve: 1 },
    { name: "Тактик", throwChance: 0.54, trumpPenalty: 20, transferBias: 0.35, reserve: 1 },
    { name: "Мастер", throwChance: 0.62, trumpPenalty: 24, transferBias: 0.46, reserve: 2 },
    { name: "Эксперт", throwChance: 0.68, trumpPenalty: 29, transferBias: 0.58, reserve: 2 },
    { name: "Гроссмейстер", throwChance: 0.74, trumpPenalty: 34, transferBias: 0.7, reserve: 2 },
    { name: "Непобедимый", throwChance: 0.82, trumpPenalty: 40, transferBias: 0.88, reserve: 3 }
  ];
  const STATS_KEY = "durak-player-stats-v1";

  const state = {
    config: null,
    deck: [],
    trumpCard: null,
    trumpSuit: null,
    handLimit: 6,
    players: [],
    attacker: 0,
    defender: 1,
    active: 0,
    phase: "setup",
    table: [],
    discard: [],
    throwQueue: [],
    throwCursor: 0,
    round: 1,
    selectedCardId: null,
    log: [],
    botTimer: null,
    stats: { games: 0, wins: 0, losses: 0, draws: 0 },
    result: null
  };

  const $ = id => document.getElementById(id);
  const nextFrame = callback => window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 0);
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function createDeck(size) {
    return RANKS[size].flatMap(rank => SUITS.map(suit => ({ id: `${rank}-${suit}`, rank, suit })));
  }

  function shuffle(cards) {
    const result = [...cards];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  function cardValue(card) { return RANK_VALUE[card.rank]; }
  function isTrump(card) { return card.suit === state.trumpSuit; }
  function sameRank(first, second) { return first.rank === second.rank; }
  function playerName(index) { return state.players[index]?.name || "Игрок"; }
  function humanIndex() { return 0; }
  function isHuman(index) { return index === humanIndex(); }
  function activePlayers() { return state.players.map((player, index) => ({ player, index })).filter(({ player }) => player.hand.length > 0); }

  function sortHand(hand) {
    return [...hand].sort((first, second) => {
      const trumpOrder = Number(isTrump(first)) - Number(isTrump(second));
      return trumpOrder || cardValue(first) - cardValue(second) || SUITS.indexOf(first.suit) - SUITS.indexOf(second.suit);
    });
  }

  function log(message) {
    state.log.unshift(message);
    state.log = state.log.slice(0, 10);
  }

  function getConfig() {
    return {
      deckSize: Number($("deck-size").value),
      variant: $("variant").value,
      throwerScope: $("thrower-scope").value,
      fairPlay: $("fair-play").value,
      finishRule: $("finish-rule").value,
      playerCount: Number($("player-count").value),
      botLevel: Number($("bot-level").value)
    };
  }

  function restoreStats() {
    try {
      const saved = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
      state.stats = { ...state.stats, ...Object.fromEntries(Object.entries(saved).filter(([, value]) => Number.isInteger(value) && value >= 0)) };
    } catch {
      // Статистика необязательна для запуска партии.
    }
  }

  function saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(state.stats));
    } catch {
      // В приватном режиме браузер может запретить сохранение.
    }
  }

  function drawCard(player) {
    const card = state.deck.pop();
    if (card) player.hand.push(card);
  }

  function drawToLimit(startIndex) {
    for (let offset = 0; offset < state.players.length; offset += 1) {
      const player = state.players[(startIndex + offset) % state.players.length];
      while (player.hand.length < state.handLimit && state.deck.length) drawCard(player);
      player.hand = sortHand(player.hand);
    }
  }

  function lowestTrumpOwner() {
    let best = null;
    state.players.forEach((player, index) => {
      player.hand.filter(isTrump).forEach(card => {
        if (!best || cardValue(card) < cardValue(best.card)) best = { index, card };
      });
    });
    return best?.index ?? 0;
  }

  function nextPlayerWithCards(fromIndex) {
    for (let step = 1; step <= state.players.length; step += 1) {
      const index = (fromIndex + step) % state.players.length;
      if (state.players[index].hand.length) return index;
    }
    return fromIndex;
  }

  function startGame() {
    clearTimeout(state.botTimer);
    state.config = getConfig();
    state.deck = shuffle(createDeck(state.config.deckSize));
    state.trumpCard = state.deck[0];
    state.trumpSuit = state.trumpCard.suit;
    state.handLimit = Math.min(6, Math.floor(state.config.deckSize / state.config.playerCount));
    state.players = Array.from({ length: state.config.playerCount }, (_, index) => ({
      id: index,
      name: index === 0 ? "Вы" : `Бот ${index}`,
      hand: []
    }));
    state.table = [];
    state.discard = [];
    state.log = [];
    state.round = 1;
    state.selectedCardId = null;
    state.result = null;
    drawToLimit(0);
    state.attacker = lowestTrumpOwner();
    state.defender = nextPlayerWithCards(state.attacker);
    state.active = state.attacker;
    state.phase = "attack";
    log(`Козырь: ${cardLabel(state.trumpCard)}. Первым атакует ${playerName(state.attacker)}.`);
    $("setup-screen").hidden = true;
    $("game-screen").hidden = false;
    $("result-modal").hidden = true;
    render();
    continueGame();
  }

  function allTableCards() {
    return state.table.flatMap(pair => pair.defense ? [pair.attack, pair.defense] : [pair.attack]);
  }

  function tableRanks() {
    return new Set(allTableCards().map(card => card.rank));
  }

  function firstUncovered() {
    return state.table.find(pair => !pair.defense);
  }

  function maximumAttacks() {
    return Math.min(state.handLimit, state.players[state.defender].hand.length + state.table.filter(pair => pair.defense).length);
  }

  function canAttack(card) {
    if (state.table.length >= maximumAttacks()) return false;
    return state.table.length === 0 || tableRanks().has(card.rank);
  }

  function canDefend(card, attack) {
    if (sameRank(card, attack)) return false;
    if (card.suit === attack.suit) return cardValue(card) > cardValue(attack);
    return isTrump(card) && !isTrump(attack);
  }

  function canTransfer(card, defenderIndex = state.defender) {
    if (state.config.variant !== "transfer" || state.phase !== "defend" || !state.table.length) return false;
    if (!state.table.every(pair => pair.attack.rank === card.rank)) return false;
    const nextDefender = nextPlayerWithCards(defenderIndex);
    return nextDefender !== defenderIndex && state.players[nextDefender].hand.length >= state.table.length + 1;
  }

  function removeCard(index, cardId) {
    const hand = state.players[index].hand;
    const position = hand.findIndex(card => card.id === cardId);
    return position >= 0 ? hand.splice(position, 1)[0] : null;
  }

  function visibleRect(rect, fallback) {
    const isVisible = rect && rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight;
    return isVisible ? rect : fallback;
  }

  function cardFlightSource(card, index) {
    if (isHuman(index)) {
      const cardNode = [...$("human-hand").querySelectorAll("[data-card-id]")].find(node => node.dataset.cardId === card.id);
      return visibleRect(cardNode?.getBoundingClientRect(), $("human-hand").getBoundingClientRect());
    }
    const opponent = $("opponents").querySelector(`[data-player-index="${index}"]`);
    return visibleRect(opponent?.getBoundingClientRect(), $("opponents").getBoundingClientRect());
  }

  function cardFlightTarget() {
    const table = $("table").getBoundingClientRect();
    const offset = ((state.table.length % 4) - 1.5) * 24;
    return {
      x: table.left + table.width / 2 + offset,
      y: table.top + table.height / 2 + (state.table.length % 2 ? 11 : -11)
    };
  }

  function animatePlayedCard(card, index) {
    if (reducedMotion()) return;
    const source = cardFlightSource(card, index);
    if (!source) return;
    const target = cardFlightTarget();
    const startX = source.left + source.width / 2;
    const startY = source.top + source.height / 2;
    const flight = cardElement(card);
    const scale = Math.min(1, Math.max(.72, source.width / 76));
    const rotation = isHuman(index) ? -7 : 7;
    flight.classList.add("card-flight");
    flight.dataset.origin = isHuman(index) ? "human" : "bot";
    flight.setAttribute("aria-hidden", "true");
    flight.style.left = `${startX - 38}px`;
    flight.style.top = `${startY - 54}px`;
    flight.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
    document.body.appendChild(flight);

    const finish = () => flight.remove();
    const frames = [
      { transform: `scale(${scale}) rotate(${rotation}deg)`, opacity: .98, filter: "brightness(1)" },
      { transform: `translate(${(target.x - startX) * .45}px, ${(target.y - startY) * .15 - 42}px) scale(${scale * 1.08}) rotate(${rotation * .5}deg)`, opacity: 1, offset: .48 },
      { transform: `translate(${target.x - startX}px, ${target.y - startY}px) scale(${scale * .88}) rotate(0deg)`, opacity: .92, filter: "brightness(1.08)" }
    ];
    if (typeof flight.animate === "function") {
      const animation = flight.animate(frames, { duration: 420, easing: "cubic-bezier(.2,.78,.18,1)", fill: "forwards" });
      animation.addEventListener("finish", finish, { once: true });
      animation.addEventListener("cancel", finish, { once: true });
    } else {
      nextFrame(() => { flight.style.transform = frames[2].transform; flight.style.opacity = "0"; });
      setTimeout(finish, 440);
    }
  }

  function playAttack(index, card) {
    if (index !== state.active || !canAttack(card)) return;
    animatePlayedCard(card, index);
    const played = removeCard(index, card.id);
    if (!played) return;
    state.table.push({ attack: played, defense: null });
    state.selectedCardId = null;
    log(`${playerName(index)} подкидывает ${cardLabel(played)}.`);
    state.phase = "defend";
    state.active = state.defender;
    render();
    continueGame();
  }

  function playDefense(index, card) {
    const attack = firstUncovered();
    if (index !== state.defender || state.phase !== "defend" || !attack || !canDefend(card, attack.attack)) return;
    animatePlayedCard(card, index);
    const played = removeCard(index, card.id);
    if (!played) return;
    attack.defense = played;
    state.selectedCardId = null;
    log(`${playerName(index)} отбивается картой ${cardLabel(played)}.`);
    if (state.table.length >= maximumAttacks()) finishRound(true);
    else beginThrowing();
  }

  function transfer(index, card) {
    if (index !== state.defender || !canTransfer(card, index)) return;
    animatePlayedCard(card, index);
    const played = removeCard(index, card.id);
    if (!played) return;
    const previousDefender = state.defender;
    state.table.push({ attack: played, defense: null });
    state.attacker = previousDefender;
    state.defender = nextPlayerWithCards(previousDefender);
    state.active = state.defender;
    state.phase = "defend";
    state.selectedCardId = null;
    log(`${playerName(previousDefender)} переводит ${cardLabel(played)} на ${playerName(state.defender)}.`);
    render();
    continueGame();
  }

  function buildThrowQueue() {
    if (state.config.throwerScope === "neighbors") return [state.attacker].filter(index => index !== state.defender && state.players[index].hand.length);
    const queue = [];
    for (let step = 0; step < state.players.length; step += 1) {
      const index = (state.attacker + step) % state.players.length;
      if (index !== state.defender && state.players[index].hand.length) queue.push(index);
    }
    return queue;
  }

  function beginThrowing() {
    if (firstUncovered()) return;
    state.throwQueue = buildThrowQueue();
    state.throwCursor = 0;
    advanceThrower();
  }

  function advanceThrower() {
    while (state.throwCursor < state.throwQueue.length) {
      const index = state.throwQueue[state.throwCursor];
      if (state.players[index].hand.some(canAttack)) {
        state.active = index;
        state.phase = "throw";
        render();
        continueGame();
        return;
      }
      state.throwCursor += 1;
    }
    finishRound(true);
  }

  function pass(index) {
    if (index !== state.active || state.phase !== "throw") return;
    log(`${playerName(index)} пасует.`);
    state.throwCursor += 1;
    advanceThrower();
  }

  function takeTable(index) {
    if (index !== state.defender || state.phase !== "defend") return;
    state.players[index].hand.push(...allTableCards());
    state.players[index].hand = sortHand(state.players[index].hand);
    log(`${playerName(index)} берёт ${state.table.length} карт.`);
    finishRound(false);
  }

  function finishRound(defended) {
    if (defended) {
      state.discard.push(...allTableCards());
      state.attacker = nextPlayerWithCards(state.defender);
    }
    state.table = [];
    drawToLimit(state.attacker);
    if (checkGameOver()) return;
    state.defender = nextPlayerWithCards(state.attacker);
    state.active = state.attacker;
    state.phase = "attack";
    state.round += 1;
    log(defended ? `${playerName(state.attacker)} начинает новый раунд.` : `${playerName(state.attacker)} продолжает атаку.`);
    render();
    continueGame();
  }

  function checkGameOver() {
    if (state.deck.length) return false;
    const remaining = activePlayers();
    if (remaining.length > 1) return false;
    if (!remaining.length) finishGame({ type: "draw", copy: "Колода пуста, и у всех игроков одновременно закончились карты." });
    else if (state.config.finishRule === "draw" && state.players.filter(player => player.hand.length === 0).length > 1) finishGame({ type: "draw", copy: "Несколько игроков закончили партию одновременно." });
    else if (remaining[0].index === humanIndex()) finishGame({ type: "loss", copy: "У соперников закончились карты, а у вас остались. В этой партии вы — дурак." });
    else finishGame({ type: "win", copy: "У вас закончились карты раньше соперников. Отличная партия!" });
    return true;
  }

  function finishGame(result) {
    state.phase = "finished";
    state.active = -1;
    state.result = result;
    state.stats.games += 1;
    if (result.type === "win") state.stats.wins += 1;
    if (result.type === "loss") state.stats.losses += 1;
    if (result.type === "draw") state.stats.draws += 1;
    saveStats();
    log(result.type === "win" ? "Победа игрока." : result.type === "loss" ? "Игрок остался дураком." : "Партия завершилась ничьёй.");
    render();
    showResult();
  }

  function showResult() {
    const modal = $("result-modal");
    const titles = { win: "Победа!", loss: "Вы — дурак", draw: "Ничья" };
    $("result-kicker").textContent = state.result.type === "win" ? "Карты закончились" : "Партия завершена";
    $("result-title").textContent = titles[state.result.type];
    $("result-copy").textContent = state.result.copy;
    $("result-wins").textContent = state.stats.wins;
    $("result-games").textContent = state.stats.games;
    modal.hidden = false;
  }

  function profile() { return AI_LEVELS[state.config.botLevel - 1]; }

  function sameRankSupport(player, card) {
    return player.hand.filter(candidate => candidate.id !== card.id && candidate.rank === card.rank).length;
  }

  function unseenRankPressure(card, level) {
    if (state.config.fairPlay !== "tricks" || state.config.botLevel < 7) return 0;
    const cardsStillInDeck = state.deck.filter(candidate => candidate.rank === card.rank).length;
    return cardsStillInDeck * Math.min(8, level.reserve + 3);
  }

  function attackScore(card, level, player) {
    const trumpCost = isTrump(card) ? level.trumpPenalty : 0;
    const tableBonus = state.table.length ? (tableRanks().has(card.rank) ? -12 : 0) : 0;
    const supportBonus = sameRankSupport(player, card) * Math.max(0, state.config.botLevel - 3) * -4;
    const deckPressure = unseenRankPressure(card, level) * -1;
    const hesitation = Math.random() * (11 - state.config.botLevel) * 7;
    return cardValue(card) * 8 + trumpCost + tableBonus + supportBonus + deckPressure + hesitation;
  }

  function defenseScore(card, attack, level) {
    const trumpCost = isTrump(card) && !isTrump(attack) ? level.trumpPenalty : 0;
    const reserveCost = isTrump(card) && state.players[state.defender].hand.filter(isTrump).length <= level.reserve ? 90 : 0;
    return cardValue(card) * 8 + trumpCost + reserveCost;
  }

  function bestCard(cards, scorer) {
    return [...cards].sort((first, second) => scorer(first) - scorer(second))[0] || null;
  }

  function botMove() {
    const index = state.active;
    if (state.phase === "finished" || isHuman(index)) return;
    const bot = state.players[index];
    const level = profile();
    if (state.phase === "attack" || state.phase === "throw") {
      const options = bot.hand.filter(canAttack);
      if (!options.length) { if (state.phase === "throw") pass(index); return; }
      if (state.phase === "throw" && Math.random() > level.throwChance) { pass(index); return; }
      const card = bestCard(options, option => attackScore(option, level, bot));
      playAttack(index, card);
      return;
    }
    if (state.phase === "defend") {
      const attack = firstUncovered();
      const defenses = bot.hand.filter(card => canDefend(card, attack.attack));
      const transfers = bot.hand.filter(card => canTransfer(card, index));
      const shouldTransfer = transfers.length && (defenses.length === 0 || Math.random() < level.transferBias);
      if (shouldTransfer) { transfer(index, bestCard(transfers, card => attackScore(card, level, bot))); return; }
      if (defenses.length) { playDefense(index, bestCard(defenses, card => defenseScore(card, attack.attack, level))); return; }
      takeTable(index);
    }
  }

  function continueGame() {
    if (state.phase === "finished" || isHuman(state.active)) return;
    clearTimeout(state.botTimer);
    state.botTimer = setTimeout(botMove, 520);
  }

  function cardLabel(card) { return `${card.rank}${card.suit}`; }

  function cardElement(card, options = {}) {
    const element = document.createElement(options.button ? "button" : "div");
    element.className = `card${RED_SUITS.has(card.suit) ? " red" : ""}${options.playable ? " playable" : ""}${options.selected ? " selected" : ""}`;
    if (options.button) element.type = "button";
    if (options.disabled) element.disabled = true;
    element.setAttribute("aria-label", cardLabel(card));
    element.dataset.cardId = card.id;
    element.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit">${card.suit}</span><span class="card-corner">${card.rank}</span>`;
    return element;
  }

  function humanCanUse(card) {
    if (state.active !== humanIndex()) return false;
    if (state.phase === "attack" || state.phase === "throw") return canAttack(card);
    if (state.phase === "defend") return Boolean(firstUncovered() && (canDefend(card, firstUncovered().attack) || canTransfer(card)));
    return false;
  }

  function onHumanCard(card) {
    if (!humanCanUse(card)) return;
    if (state.phase === "attack" || state.phase === "throw") { playAttack(humanIndex(), card); return; }
    const attack = firstUncovered();
    if (canDefend(card, attack.attack)) { playDefense(humanIndex(), card); return; }
    if (canTransfer(card)) { state.selectedCardId = card.id; render(); }
  }

  function statusText() {
    if (state.phase === "finished") return state.log[0] || "Партия завершена.";
    if (state.phase === "attack") return `${playerName(state.active)} атакует.`;
    if (state.phase === "defend") return `${playerName(state.defender)} отбивается.`;
    return `${playerName(state.active)} может подкинуть карту или пасовать.`;
  }

  function ruleSummary() {
    const variant = state.config.variant === "transfer" ? "переводной" : "подкидной";
    const throwers = state.config.throwerScope === "all" ? "подкидывают все" : "подкидывают соседи";
    const mode = state.config.fairPlay === "tricks" ? "с хитростями" : "честная игра";
    return `${state.config.deckSize} карт · ${variant} · ${throwers} · ${mode} · ИИ ${state.config.botLevel}: ${profile().name}`;
  }

  function renderOpponents() {
    const area = $("opponents");
    area.innerHTML = "";
    state.players.slice(1).forEach((player, index) => {
      const actualIndex = index + 1;
      const item = document.createElement("div");
      item.className = `opponent${actualIndex === state.active ? " active" : ""}${actualIndex === state.defender ? " defender" : ""}`;
      item.dataset.playerIndex = actualIndex;
      item.innerHTML = `<span class="opponent-name">${player.name}</span><span class="opponent-meta">${player.hand.length} карт · ИИ ${state.config.botLevel}</span>`;
      area.appendChild(item);
    });
  }

  function renderTable() {
    const table = $("table");
    table.innerHTML = "";
    state.table.forEach(pair => {
      const battle = document.createElement("div");
      battle.className = "battle-pair";
      battle.appendChild(cardElement(pair.attack));
      if (pair.defense) battle.appendChild(cardElement(pair.defense));
      table.appendChild(battle);
    });
    $("table-empty").hidden = Boolean(state.table.length);
  }

  function renderHand() {
    const hand = $("human-hand");
    hand.innerHTML = "";
    state.players[humanIndex()].hand.forEach(card => {
      const playable = humanCanUse(card);
      const element = cardElement(card, { button: true, playable, selected: state.selectedCardId === card.id, disabled: !playable });
      element.addEventListener("click", () => onHumanCard(card));
      hand.appendChild(element);
    });
    $("hand-counter").textContent = `${state.players[humanIndex()].hand.length} карт`;
  }

  function renderActions() {
    const humanTurn = state.active === humanIndex();
    const selected = state.players[humanIndex()].hand.find(card => card.id === state.selectedCardId);
    $("pass-button").disabled = !(humanTurn && state.phase === "throw");
    $("take-button").disabled = !(humanTurn && state.phase === "defend");
    $("transfer-button").disabled = !(humanTurn && state.phase === "defend" && selected && canTransfer(selected));
  }

  function renderHint() {
    const hint = $("hint");
    if (state.config.fairPlay !== "tricks" || state.phase === "finished") { hint.hidden = true; return; }
    const human = state.players[humanIndex()];
    const playable = human.hand.filter(humanCanUse);
    hint.hidden = false;
    hint.textContent = playable.length ? `Хитрость: доступно ходов — ${playable.length}.` : "Хитрость: подходящей карты нет.";
  }

  function renderTrumpCard() {
    const container = $("trump-card");
    if (!state.trumpCard) {
      container.textContent = "Козырь";
      return;
    }
    const red = RED_SUITS.has(state.trumpCard.suit) ? " red" : "";
    container.setAttribute("aria-label", `Козырь: ${cardLabel(state.trumpCard)}`);
    container.innerHTML = `<span>Козырь</span><span class="trump-card-face${red}"><span class="trump-rank">${state.trumpCard.rank}</span><span class="trump-suit">${state.trumpCard.suit}</span></span>`;
  }

  function render() {
    $("round-label").textContent = `Раунд ${state.round}`;
    $("deck-counter").textContent = `Колода: ${state.deck.length}`;
    $("win-counter").textContent = `Победы: ${state.stats.wins}`;
    renderTrumpCard();
    $("status").textContent = statusText();
    $("rule-summary").textContent = ruleSummary();
    renderOpponents();
    renderTable();
    renderHand();
    renderActions();
    renderHint();
    const logElement = $("event-log");
    logElement.innerHTML = state.log.map(item => `<li>${item}</li>`).join("");
  }

  $("setup-form").addEventListener("submit", event => { event.preventDefault(); startGame(); });
  $("new-game").addEventListener("click", () => { clearTimeout(state.botTimer); $("result-modal").hidden = true; $("game-screen").hidden = true; $("setup-screen").hidden = false; });
  $("play-again").addEventListener("click", startGame);
  $("back-to-setup").addEventListener("click", () => { $("result-modal").hidden = true; $("game-screen").hidden = true; $("setup-screen").hidden = false; });
  $("pass-button").addEventListener("click", () => pass(humanIndex()));
  $("take-button").addEventListener("click", () => takeTable(humanIndex()));
  $("transfer-button").addEventListener("click", () => {
    const card = state.players[humanIndex()].hand.find(item => item.id === state.selectedCardId);
    if (card) transfer(humanIndex(), card);
  });
  restoreStats();
})();
