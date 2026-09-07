/** Внутриигровые файлы, почта, поиск и инструменты цифрового анализа. */
import { escapeHtml, formatClock, pluralRu } from '../core/utils.js';

// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderComputer(_app) {
  const { dom, caseData, state } = _app;
  const { renderComputerApp } = _app;
  const app = state.computer.app;
  const apps = [
    ["mail", "Почта", "@"],
    ["files", "Файлы", "▤"],
    ["search", "Поиск", "⌕"],
    ["network", "Сеть", "≋"],
    ["tools", "Инструменты", "◇"],
  ];
  dom.workspace.innerHTML = `
    <div class="view view-wide computer-view">
      <header class="view-header">
        <div><span class="eyebrow">АРМ следователя / изолированный контур</span><h2>Рабочий компьютер</h2><p>Локальные копии, образы и инструменты анализа. Система не подсказывает, какая находка важна.</p></div>
        <div class="computer-clock"><span id="computer-clock">${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span><small>ТО-OS / READ ONLY</small></div>
      </header>
      <section class="computer-shell">
        <div class="computer-menubar"><span>ТО-OS</span><span>ДЕЛО ${escapeHtml(caseData.number)} · ОБРАЗ ПОДКЛЮЧЁН ТОЛЬКО ДЛЯ ЧТЕНИЯ</span><span>● ЗАЩИЩЕНО</span></div>
        <div class="computer-body">
          <nav class="computer-dock" aria-label="Программы компьютера">
            ${apps.map(([value, label, glyph]) => `<button type="button" class="computer-app-button${app === value ? " is-active" : ""}" data-computer-app="${value}" title="${label}"><i>${glyph}</i><span>${label}</span></button>`).join("")}
          </nav>
          <div class="computer-window">
            ${renderComputerApp(app)}
          </div>
        </div>
        <div class="computer-status"><span>CASE://LOCAL/${escapeHtml(caseData.seed)}</span><span>${state.computer.finds.length} ${pluralRu(state.computer.finds.length, "цифровая находка зафиксирована", "цифровые находки зафиксированы", "цифровых находок зафиксировано")}</span></div>
      </section>
    </div>
  `;
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderComputerApp(_app, app) {
  const { renderMailApp, renderFilesApp, renderSearchApp, renderNetworkApp, renderToolsApp } = _app;
  if (app === "mail") return renderMailApp();
  if (app === "files") return renderFilesApp();
  if (app === "search") return renderSearchApp();
  if (app === "network") return renderNetworkApp();
  return renderToolsApp();
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderMailApp(_app) {
  const { caseData, state } = _app;
  const selected = caseData.computer.mail.find((mail) => mail.id === state.computer.opened) || caseData.computer.mail[0];
  return `
    <div class="computer-app-head"><div><span class="micro-label">Локальная копия · несколько папок</span><h3>Почтовый ящик: ${escapeHtml(caseData.victim.name)}</h3></div><span>${caseData.computer.mail.length} сообщений</span></div>
    <div class="mail-layout">
      <div class="mail-list">
        ${caseData.computer.mail.map((mail) => `<button class="mail-item${selected.id === mail.id ? " is-active" : ""}${mail.important ? " is-suspicious" : ""}" type="button" data-mail-id="${mail.id}">
          <span><strong>${escapeHtml(mail.from)}</strong><time>${escapeHtml(mail.time)} · ${escapeHtml(mail.folder || "Входящие")}</time></span>
          <b>${escapeHtml(mail.subject)}</b>
          <small>${escapeHtml(mail.body.slice(0, 66))}</small>
        </button>`).join("")}
      </div>
      <article class="mail-reader">
        <div class="mail-reader-head"><span>От: <b>${escapeHtml(selected.from)}</b> · ${escapeHtml(selected.folder || "Входящие")}</span><time>${escapeHtml(selected.time)}</time></div>
        <h3>${escapeHtml(selected.subject)}</h3>
        <div class="mail-body">${escapeHtml(selected.body).replaceAll("\n", "<br>")}</div>
        ${selected.unlock ? `<button class="button button-primary button-small" type="button" data-action="fix-computer-find" data-find="${selected.unlock}">${state.computer.finds.includes(selected.unlock) ? "Добавлено в дело" : "Зафиксировать как улику"}</button>` : ""}
      </article>
    </div>
  `;
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderFilesApp(_app) {
  const { caseData, state } = _app;
  const selected = caseData.computer.files.find((file) => file.id === state.computer.opened);
  return `
    <div class="computer-app-head"><div><span class="micro-label">Образ QD-${escapeHtml(caseData.seed)}</span><h3>Файловая система</h3></div><span>${caseData.computer.files.length} объектов · скрытые показаны</span></div>
    <div class="files-layout">
      <div class="file-grid">
        ${caseData.computer.files.map((file) => `<button class="file-item${selected?.id === file.id ? " is-active" : ""}" type="button" data-file-id="${file.id}">
          <i>${escapeHtml(file.kind)}</i><span><b>${escapeHtml(file.name)}</b><small>${escapeHtml(file.size)}</small></span>
        </button>`).join("")}
      </div>
      <article class="file-preview">
        ${selected ? `
          <div class="file-preview-head"><span>${escapeHtml(selected.kind)} / ${escapeHtml(selected.size)}</span><b>${escapeHtml(selected.name)}</b></div>
          <pre>${escapeHtml(selected.body)}</pre>
          ${selected.metadata ? `<div class="view-actions"><button class="button button-ghost button-small" type="button" data-action="inspect-file-meta" data-file="${selected.id}">Прочитать метаданные</button>${selected.unlock ? `<button class="button button-primary button-small" type="button" data-action="fix-computer-find" data-find="${selected.unlock}">${state.computer.finds.includes(selected.unlock) ? "Добавлено в дело" : "Зафиксировать"}</button>` : ""}</div>` : ""}
          ${state.computer.toolOutput && state.computer.opened === "file-3" ? `<div class="terminal-output">${escapeHtml(state.computer.toolOutput).replaceAll("\n", "<br>")}</div>` : ""}
        ` : '<div class="computer-empty">Выберите файл для безопасного просмотра.</div>'}
      </article>
    </div>
  `;
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderSearchApp(_app) {
  const { caseData, state } = _app;
  const results = state.computer.searchResults || [];
  return `
    <div class="computer-app-head"><div><span class="micro-label">Локальный индекс</span><h3>Поиск по массиву</h3></div><span>${caseData.evidence.length + 18642} записей индексировано</span></div>
    <div class="database-search">
      <form class="computer-search-form" id="computer-search-form">
        <label class="sr-only" for="computer-query">Запрос</label>
        <input id="computer-query" type="search" autocomplete="off" placeholder="Имя, псевдоним, время, роль…" value="${escapeHtml(state.computer.query)}">
        <button class="button button-primary" type="submit">Искать</button>
      </form>
      <p class="query-help">Поиск буквальный. Попробуйте данные из писем, допросов или сетевого журнала.</p>
      <div class="database-results">
        ${results.length ? results.map((result) => `<button type="button" data-evidence-id="${result.id}" class="database-row"><span>${escapeHtml(result.code)}</span><b>${escapeHtml(result.title)}</b><small>${escapeHtml(result.excerpt)}</small></button>`).join("") : `<div class="computer-empty">${state.computer.query ? "Совпадений нет. Уточните форму запроса." : "Введите запрос. Автоматическая выдача приоритетов отключена."}</div>`}
      </div>
    </div>
  `;
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderNetworkApp(_app) {
  const { caseData } = _app;
  return `
    <div class="computer-app-head"><div><span class="micro-label">Восстановленный фрагмент</span><h3>Сетевой журнал</h3></div><span>UTC+3 · время нормализовано</span></div>
    <div class="network-terminal">
      <div class="terminal-title"><span>qd-netview --case ${escapeHtml(caseData.number)}</span><span>LIVE IMAGE / NO WRITE</span></div>
      <pre>${caseData.computer.network.map((line, index) => `<span class="${index === 1 || index === 2 ? "log-hit" : ""}">${escapeHtml(line)}</span>`).join("\n")}</pre>
      <div class="terminal-command">$ correlate --window ${formatClock(caseData.incidentMinute - 30)}..${formatClock(caseData.incidentMinute + 10)} <i>█</i></div>
    </div>
    <div class="computer-callout">Устройство может быть связано с человеком только через независимый идентификатор. Сам по себе псевдоним <b>${escapeHtml(caseData.alias)}</b> — ещё не личность.</div>
  `;
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderToolsApp(_app) {
  const { state } = _app;
  return `
    <div class="computer-app-head"><div><span class="micro-label">Безопасная лаборатория</span><h3>Инструменты</h3></div><span>локальное выполнение</span></div>
    <div class="tool-grid">
      <button type="button" class="computer-tool" data-computer-tool="hex"><i>HEX</i><span><b>Декодер HEX</b><small>Преобразовать байты UTF-8 из .cache_note</small></span></button>
      <button type="button" class="computer-tool" data-computer-tool="hash"><i>#</i><span><b>Сверка хешей</b><small>Проверить целостность образов без изменения</small></span></button>
      <button type="button" class="computer-tool" data-computer-tool="meta"><i>EXIF</i><span><b>Метаданные</b><small>Найти временные и географические хвосты</small></span></button>
      <button type="button" class="computer-tool" data-computer-tool="strings"><i>STR</i><span><b>Строки файла</b><small>Извлечь печатные фрагменты и нулевые символы</small></span></button>
    </div>
    ${state.computer.toolOutput ? `<div class="network-terminal compact"><div class="terminal-title"><span>Результат последней операции</span></div><pre>${escapeHtml(state.computer.toolOutput)}</pre></div>` : '<div class="computer-callout">Инструмент выполняет только техническую операцию. Интерпретировать результат должен следователь.</div>'}
  `;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function fixComputerFind(_app, findId) {
  const { caseData, state } = _app;
  const { saveCase, toast, updateChrome, renderComputer } = _app;
  if (!state.computer.finds.includes(findId)) {
    state.computer.finds.push(findId);
    const evidence = caseData.evidence.find((item) => item.lockedBy === findId);
    if (evidence && !state.importantIds.includes(evidence.id)) state.importantIds.push(evidence.id);
    toast("Цифровая находка зафиксирована и добавлена в архив.");
    saveCase();
    updateChrome();
  }
  renderComputer();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function runComputerTool(_app, tool) {
  const { caseData, state } = _app;
  const { saveCase, renderComputer } = _app;
  const routeArtifact = caseData.computer.files.find((file) => file.id === "file-3");
  const outputs = {
    hex: `HEX → UTF-8\nnode=${caseData.alias}; terminal=shared; role_group=multi_user\nСтатус: строка восстановлена, личность пользователя не атрибутирована`,
    hash: "SHA-256 images: MATCH\nSHA-256 archive: MATCH\nЦелостность копий подтверждена.",
    meta: `Выберите ${routeArtifact?.name || "маршрутный артефакт"} в разделе «Файлы», затем прочитайте сохранённый блок метаданных.`,
    strings: "Найдено: 214 печатных строк\nНайдено: 96 символов U+200B/U+200C\nНеобычный блок передан в лабораторию.",
  };
  state.computer.toolOutput = outputs[tool] || "Операция не поддерживается.";
  saveCase();
  renderComputer();
}
