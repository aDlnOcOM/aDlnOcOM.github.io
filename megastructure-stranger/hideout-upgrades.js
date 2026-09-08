(() => {
  "use strict";
  const tiers = Object.freeze(["Самодельный", "Кустарный", "Промышленный", "Заводской", "Идеальный"]);
  const facilities = Object.freeze([
    { id: "generator", name: "Генератор", code: "PWR", color: "#c7ac70", base: 40, dependencies: [], future: "Электроснабжение станков и расход топлива" },
    { id: "battery", name: "Стационарные аккумуляторы", code: "ACC", color: "#8bb899", base: 35, dependencies: ["generator"], future: "Накопление энергии и автономная работа" },
    { id: "solder", name: "Паяльная станция", code: "PCB", color: "#7ab5c7", base: 30, dependencies: ["generator"], future: "Сборка электроники и ремонт модулей" },
    { id: "mill", name: "Фрезер ЧПУ", code: "CNC", color: "#b0a0cb", base: 60, dependencies: ["generator", "solder"], future: "Точная обработка деталей оружия и оснастки" },
    { id: "forming", name: "Металлоформовка ЧПУ", code: "PRS", color: "#c18d7c", base: 55, dependencies: ["generator", "battery"], future: "Изготовление корпусов, брони и заготовок" }
  ].map(facility => Object.freeze({ ...facility, dependencies: Object.freeze(facility.dependencies) })));

  function normalize(saved) {
    return Object.fromEntries(facilities.map(({ id }) => {
      const value = saved?.[id];
      return [id, Number.isFinite(value) ? Math.max(0, Math.min(5, Math.floor(value))) : 0];
    }));
  }

  function quote(progression, id) {
    const facility = facilities.find(item => item.id === id);
    if (!facility) return { allowed: false, reason: "Неизвестная установка" };
    const levels = normalize(progression.hideout);
    const level = levels[id];
    const next = level + 1;
    const cost = facility.base * [1, 2, 4, 7, 11][level];
    const requirements = facility.dependencies.map(dependency => ({ id: dependency, level: next, met: levels[dependency] >= next }));
    let reason = "";
    if (level === 5) reason = "Максимальный уровень";
    else if (requirements.some(item => !item.met)) reason = "Сначала улучшите инфраструктуру";
    else if (!Number.isFinite(progression.salvage) || progression.salvage < cost) reason = "Недостаточно лома";
    return { allowed: !reason, reason, level, next, cost: level === 5 ? 0 : cost, requirements: level === 5 ? [] : requirements };
  }

  // Persist the candidate before applying it: storage failure must not consume funds.
  function purchase(progression, id, persist) {
    const offer = quote(progression, id);
    if (!offer.allowed) return offer;
    const candidate = { ...progression, salvage: progression.salvage - offer.cost, hideout: { ...normalize(progression.hideout), [id]: offer.next } };
    try { persist(candidate); }
    catch { return { allowed: false, reason: "Не удалось сохранить. Лом не списан." }; }
    Object.assign(progression, candidate);
    return { ...offer, reason: "Установка улучшена" };
  }

  function render(container, progression, onPurchase) {
    if (!container) return;
    container.replaceChildren();
    for (const facility of facilities) {
      const offer = quote(progression, facility.id);
      const card = document.createElement("article");
      card.className = "facility-card";
      card.setAttribute("data-facility", facility.id);
      card.style.setProperty("--facility-accent", facility.color);
      const dependencies = offer.requirements.map(item => `${facilities.find(entry => entry.id === item.id).name}: ур. ${item.level} ${item.met ? "✓" : "— требуется"}`).join(" · ");
      card.innerHTML = `<div class="facility-code" aria-hidden="true">${facility.code}<span>${String(offer.level).padStart(2, "0")}</span></div><h3>${facility.name}</h3><p class="facility-current">${offer.level ? tiers[offer.level - 1] : "Не построено"} · ${offer.level}/5</p><ol class="facility-tiers" aria-label="Уровни установки">${tiers.map((tier, index) => `<li class="${index < offer.level ? "built" : ""}"><span>${index + 1}</span>${tier}</li>`).join("")}</ol><p class="facility-future">Назначение: ${facility.future}.</p><p class="facility-requirements">${dependencies || (offer.level === 5 ? "Все ступени освоены" : "Без дополнительных требований")}</p>`;
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = !offer.allowed;
      button.textContent = offer.level === 5 ? "Идеальный · максимум" : `${offer.level ? "Улучшить" : "Построить"} → ${tiers[offer.level]} · ${offer.cost} лома`;
      button.setAttribute("aria-label", `${facility.name}: ${button.textContent}`);
      button.addEventListener("click", () => onPurchase(facility.id));
      card.appendChild(button);
      const status = document.createElement("p");
      status.className = "facility-status";
      status.textContent = offer.reason || "Доступно для установки";
      card.appendChild(status);
      container.appendChild(card);
    }
  }
  window.HideoutUpgrades = Object.freeze({ tiers, facilities, normalize, quote, purchase, render });
})();
