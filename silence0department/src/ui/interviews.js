/** Личные истории, тон беседы, предъявление источников и неизменяемый протокол ответов. */
import { pastTense, escapeHtml, sentenceStart, initials, formatClock } from '../core/utils.js';
import detective from '../domain/engine.js';

// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function livingQuestions(_app, person) {
  const { caseData, state } = _app;
  const { getSuspect } = _app;
  const trust = state.rapport[person.id] || 0;
  const found = state.field.found;
  return [
    { id: "personal", question: "Перед тем как продолжим: что вас сейчас тревожит?", answer: `${person.life.need} ${person.life.boundary}` },
    { id: "memory", question: "Какой обычный момент с этим человеком вы вспоминаете?", locked: trust < 1, lockReason: "нужно доверие: спокойный разговор", answer: person.life.memory },
    ...caseData.relationships.filter((edge) => edge.people.includes(person.id)).map((edge) => {
      const contact = getSuspect(edge.people.find((id) => id !== person.id));
      return { id: `contact-${contact.id}`, question: `В списке контактов есть ${contact.name}. Что вас связывает?`, answer: `У нас ${edge.reason}. Это не тайна, но я не хочу, чтобы обычный контакт превратили в обвинение. Уточните у второй стороны.` };
    }),
    { id: "private", question: "Можно говорить без клиента. Что осталось за пределами первого ответа?", locked: trust < 2, lockReason: "нужно больше доверия", answer: person.isCulprit ? "Я не всё объясняю о личном интересе. В приложении к договору он сформулирован точнее. Но наличие интереса ещё не делает вашу версию доказанной." : `Я ${person.privateStake}. Мне стыдно за это, и я не хочу потерять всё из-за чужого прочтения. Проверьте время отдельно от моего конфликта.` },
    { id: "field-account", question: "У нас есть оригинал выдачи. Объясните путь предмета.", locked: !found.includes("field-identity"), lockReason: "нужен оригинал выдачи из поля", answer: person.isCulprit ? `Да, упаковку ${caseData.story.token} я получал${person.gender === "female" ? "а" : ""}. Но после выдачи она лежала в общей зоне. Вы видели запись того, что происходило потом?` : `В книге выдачи у этой позиции другой получатель. Я не могу подтвердить, что он делал с предметом после этого. Нужен непрерывный источник.` },
    { id: "independent", question: "Сопоставим ваш рассказ с записью соседнего помещения.", locked: !found.includes("field-corroboration") || !(state.askedQuestions[person.id] || []).includes("where"), lockReason: "нужны независимая запись и первый рассказ", answer: person.isCulprit ? "В первом ответе речь шла о телефоне, а вы спрашивали обо мне. Это было намеренно. Присутствие на записи отрицать не стану. Причину и сам механизм всё равно придётся доказать отдельно." : "Сверьте запись целиком, включая начало и конец. Если мой первый ответ неточен, сохраните обе версии: я не хочу, чтобы старые слова исчезли из протокола." },
  ];
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderConversationControls(_app, person) {
  const { caseData, state } = _app;
  const { availableEvidence } = _app;
  const trust = state.rapport[person.id] || 0;
  return `<div class="conversation-controls"><span>Контакт: <b>${trust >= 2 ? "готов говорить о личном" : trust < 0 ? "защищается" : "осторожный"}</b></span><div class="view-actions" role="group" aria-label="Тон беседы">${[["calm", "Спокойно"], ["precise", "По существу"], ["pressure", "Настойчиво"]].map(([key, label]) => `<button class="button button-ghost button-small ${state.approach === key ? "is-active" : ""}" data-approach="${key}" aria-pressed="${state.approach === key}">${label}</button>`).join("")}</div><small>Спокойный тон открывает личные темы. Давление снижает доверие${caseData.profile.timed ? " и увеличивает заметность на 3" : ""}.</small><form id="present-evidence-form" class="present-evidence"><label for="present-evidence">Предъявить материал</label><select id="present-evidence" name="evidence" required><option value="">Выберите найденный источник…</option>${availableEvidence().map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join("")}</select><button type="submit" class="button button-ghost button-small" ${state.outcome ? "disabled" : ""}>Обсудить</button></form></div>`;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function presentEvidence(_app, id) {
  const { caseData, state } = _app;
  const { getEvidence, getSuspect, isEvidenceUnlocked, saveCase, toast, renderCurrentView } = _app;
  if (state.outcome || detective.checkThreat(caseData, state)) { renderCurrentView(); return; }
  const item = getEvidence(id);
  const person = getSuspect(state.activeSuspect);
  if (!item || !isEvidenceUnlocked(item) || !person) return;
  state.presented[person.id] ||= [];
  if (state.presented[person.id].includes(id)) { toast("Ответ по этому материалу уже записан."); return; }
  state.presented[person.id].push(id);
  let answer = `Я вижу документ «${item.title}». ${item.content.includes(person.name) ? "Моё имя здесь есть. Это не означает, что верна любая трактовка документа." : "Здесь нет прямой привязки ко мне. Что именно вы хотите проверить?"}`;
  if (id === "field-exclusion" && person.id === caseData.story.decoyId) answer = "Вот именно. Я скрываю личный конфликт, но в тот час меня не было на месте события. Сохраните оригинал, пожалуйста: одной моей просьбе вы бы не поверили.";
  if (id === "field-identity" && person.isCulprit) answer = `Получение ${caseData.story.token} подтверждаю. Но между выдачей и событием есть время. Докажите, кто держал упаковку тогда.`;
  if (id === "field-corroboration" && person.isCulprit) answer = "Это я на записи. Мой первый рассказ был неполным. Я не хочу объяснять остальное без представителя, но оригинал вы уже получили.";
  if (id === "field-motive" && person.isCulprit) answer = "Переписка подлинная. Да, такой интерес у меня был. Думать о том, что вы получите вторую копию, было страшно.";
  state.transcripts[person.id] ||= [];
  state.transcripts[person.id].push({ speaker: "Детектив", text: `Предъявлен материал: ${item.code} · ${item.title}. Что вы можете объяснить?` }, { speaker: person.name, text: answer });
  detective.spend(caseData, state, 10);
  saveCase();
  renderCurrentView();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function styleReply(_app, person, topic, fact) {

  const variants = {
    controller: {
      where: `Уточню: вы спрашиваете о моём местонахождении или о местонахождении телефона? ${fact}`,
      relation: `«Отношения» — слишком широкое слово. Зафиксируйте: ${fact}`,
      detail: `Не называйте это мелочью, пока не проверили. ${fact}`,
      conflict: `Разделяйте конфликт и преступление. ${fact}`,
      method: `Я не эксперт и не стану подтверждать вашу формулировку. ${fact}`,
      pressure: `Минуты нельзя восстановить по памяти с точностью до протокола. ${fact}`,
    },
    performer: {
      where: `Ночь была такая, что каждый теперь сочинит себе идеальное алиби. Моё хотя бы можно проверить: ${fact}`,
      relation: `Вы хотите короткую версию, а короткой здесь нет. ${fact}`,
      detail: `Вот это я помню почти как кадр: ${fact}`,
      conflict: `Конечно, со стороны всё выглядит отвратительно. Но драма была совсем о другом: ${fact}`,
      method: `Вы говорите так, будто кто-то репетировал эту сцену заранее. ${fact}`,
      pressure: `Я помню вечер цельной сценой, а не таблицей. В этом и разница. ${fact}`,
    },
    anxious: {
      where: `Я уже называл${person.gender === "female" ? "а" : ""} время, но мог${person.gender === "female" ? "ла" : ""} округлить. Это ведь не считается сменой показаний? ${fact}`,
      relation: `Пожалуйста, запишите целиком, не только последнюю фразу. ${fact}`,
      detail: `Не уверен${person.gender === "female" ? "а" : ""}, что это важно… хотя теперь всё кажется важным. ${fact}`,
      conflict: `Я скрывал${person.gender === "female" ? "а" : ""} это, да. Но не из-за основного события. ${fact}`,
      method: `Я не знал${person.gender === "female" ? "а" : ""}, что именно вы нашли. ${fact}`,
      pressure: `Подождите, я хочу назвать это правильно, чтобы потом не исправлять. ${fact}`,
    },
    analytic: {
      where: `По пунктам. Первое — что помню лично. Второе — что подтверждается системой. ${fact}`,
      relation: `Факт контакта подтверждаю. Вашу трактовку причины — нет. ${fact}`,
      detail: `Степень уверенности около семидесяти процентов: ${fact}`,
      conflict: `Это объясняет ложь, но не причинность. ${fact}`,
      method: `Я могу говорить только о доступе и процедуре. ${fact}`,
      pressure: `Вот граница моей уверенности: маршрут помню, отдельные минуты — нет. ${fact}`,
    },
    adaptive: {
      where: `Понимаю, вам нужна точка на карте, а не впечатление. ${fact}`,
      relation: `Если говорить вашим языком — связь была, но её значение вы сейчас завышаете. ${fact}`,
      detail: `Вы правы, такие вещи иногда держат всю картину. ${fact}`,
      conflict: `Да, я бы на вашем месте тоже зацепил${person.gender === "female" ? "ась" : "ся"} за это. ${fact}`,
      method: `Давайте без догадок: я скажу, к чему имел${person.gender === "female" ? "а" : ""} доступ. ${fact}`,
      pressure: `Если вам нужен ориентир, дам ориентир. Если точная минута — её у меня нет. ${fact}`,
    },
    reserved: {
      where: `Я не буду заполнять пробелы догадками. ${fact}`,
      relation: `Связывал конфликт. Не дружба. ${fact}`,
      detail: `Запомнил${person.gender === "female" ? "а" : ""} одно. ${fact}`,
      conflict: `Солгал${person.gender === "female" ? "а" : ""}. Причина была другой. ${fact}`,
      method: `Не знаю. Доступ — был. Намерения — не было. ${fact}`,
      pressure: `Про время скажу только то, в чём не ошибусь. ${fact}`,
    },
  };
  return variants[person.personalityId]?.[topic] || fact;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function interviewObservation(_app, person, topic) {
  const { caseData } = _app;
  const name = person.firstName;
  const observations = {
    controller: {
      where: `${name} на секунду задерживается, прежде чем отделить то, что помнит, от того, что может подтвердить.`,
      relation: `${name} поправляет одно слово в собственном ответе, но не меняет его смысл.`,
      detail: `${name} перечисляет детали ровным голосом, словно сверяет их с внутренним списком.`,
      method: `${name} сразу уводит разговор от предположений к процедуре.`,
      timeline: `${name} не спорит с временем, но очень точно выбирает, за что готов отвечать.`,
    },
    performer: {
      where: `${name} рисует картину вечера выразительнее, чем сам маршрут.`,
      relation: `${name} пытается придать последнему разговору понятную драматургию.`,
      detail: `${name} охотно называет звуки и цвета, но делает паузу перед временем.`,
      method: `${name} отвечает с лёгкой усмешкой, будто примеряет вашу версию на себя.`,
      timeline: `${name} снова говорит «примерно», хотя раньше звучал${person.gender === "female" ? "а" : ""} увереннее.`,
    },
    anxious: {
      where: `${name} следит за вашей реакцией, будто ждёт, что вы поправите ${person.gender === "female" ? "её" : "его"}.`,
      relation: `${name} сжимает пальцы на краю стола, когда звучит имя «${caseData.victim.firstName}».`,
      detail: `${name} сначала отвергает деталь как неважную, затем возвращается к ней сам${person.gender === "female" ? "а" : ""}.`,
      method: `${name} отвечает тише и просит не делать выводов раньше времени.`,
      timeline: `${name} долго считает про себя, прежде чем назвать следующий ориентир.`,
    },
    analytic: {
      where: `${name} строит ответ как последовательность отдельных фактов, не связывая их причинно.`,
      relation: `${name} подтверждает факт контакта, но оставляет оценку его причины вам.`,
      detail: `${name} отмечает степень уверенности так же тщательно, как саму деталь.`,
      method: `${name} различает право доступа и фактическое действие.`,
      timeline: `${name} уточняет границы того, что можно восстановить по памяти.`,
    },
    adaptive: {
      where: `${name} подхватывает ваши слова о маршруте и возвращает их в собственной формулировке.`,
      relation: `${name} подбирает тон ответа под ваш вопрос, не становясь от этого конкретнее.`,
      detail: `${name} будто проверяет, какая деталь вызовет у вас больший интерес.`,
      method: `${name} быстро соглашается с формулировкой, но оставляет себе путь отступления.`,
      timeline: `${name} меняет темп речи, когда разговор снова касается часов.`,
    },
    reserved: {
      where: `${name} отвечает после долгой паузы и не пытается заполнить пробелы догадками.`,
      relation: `${name} смотрит в сторону, прежде чем произнести имя ${caseData.victim.firstName}.`,
      detail: `${name} повторяет одну деталь дословно, как будто боится исказить её.`,
      method: `${name} признаёт пределы своих знаний и не добавляет лишнего.`,
      timeline: `${name} молчит дольше обычного, прежде чем вернуться к времени.`,
    },
  };
  return observations[person.personalityId]?.[topic] || "";
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function interviewQuestions(_app, person) {
  const { caseData, state } = _app;
  const { livingQuestions, styleReply, interviewObservation } = _app;
  const culprit = person.isCulprit;
  const asked = state.askedQuestions[person.id] || [];
  const relationFact = culprit
    ? "Нас связывали рабочие вопросы. Личная встреча в тот вечер заранее не обсуждалась."
    : `Между нами был отдельный контекст: ${person.relationship}. Последний разговор закончился резко, потому что я ${person.privateStake}.`;
  const accessFact = culprit
    ? "К служебной зоне доступ у меня был по должности. Но резервный пропуск не персональный, а устройство с псевдонимом ничего не говорит о том, кто держал его в руках."
    : `По работе я знал${person.gender === "female" ? "а" : ""} только обычную процедуру. О следе «${caseData.trace}» слышу сейчас впервые.`;
  const timelineFact = culprit
    ? `Точное время не назову: телефон мог остаться в машине, а часы я помню приблизительно. Одно могу сказать уверенно: в ${formatClock(caseData.incidentMinute - 24)} я не прикладывал${person.gender === "female" ? "а" : ""} резервный пропуск.`
    : `Я ${pastTense(person, "ошибся", "ошиблась")} на несколько минут. В тот вечер я ${person.privateStake}, поэтому сначала не хотел${person.gender === "female" ? "а" : ""} говорить обо всём. Весь интервал по памяти не восстановлю. Пожалуйста, проверьте по независимому источнику.`;
  const detailFact = `${sentenceStart(person.detail)}; я связываю это примерно с ${formatClock(caseData.incidentMinute - 20)}.`;
  return [
    {
      id: "where",
      question: "Расскажите о вашем вечере после смены.",
      answer: styleReply(person, "where", person.alibi),
      observation: interviewObservation(person, "where"),
    },
    {
      id: "relation",
      question: `Расскажите о последнем разговоре. Имя собеседника: ${caseData.victim.name}.`,
      answer: styleReply(person, "relation", relationFact),
      observation: interviewObservation(person, "relation"),
    },
    {
      id: "detail",
      question: "Что в тот вечер показалось вам не на месте?",
      answer: styleReply(person, "detail", detailFact),
      observation: interviewObservation(person, "detail"),
    },
    {
      id: "method",
      question: "Как в ту смену был устроен доступ в служебную зону?",
      answer: styleReply(person, "method", accessFact),
      observation: interviewObservation(person, "method"),
    },
    {
      id: "timeline",
      question: "Вернёмся к времени: чем можно подтвердить ваш маршрут?",
      locked: !asked.includes("where"),
      lockReason: "после рассказа о вечере",
      answer: styleReply(person, "pressure", timelineFact),
      observation: interviewObservation(person, "timeline"),
    },
    ...livingQuestions(person),
  ];
}


// Формирует представление из актуального состояния; данные пользователя экранируются.
export function renderInterviews(_app) {
  const { dom, caseData, state } = _app;
  const { getSuspect, renderConversationControls, interviewQuestions } = _app;
  const active = getSuspect(state.activeSuspect) || caseData.suspects[0];
  const transcript = state.transcripts[active.id] || [];
  const questions = interviewQuestions(active);
  const asked = state.askedQuestions[active.id] || [];
  dom.workspace.innerHTML = `
    <div class="view">
      <header class="view-header">
        <div><span class="eyebrow">Комната бесед</span><h2>Беседы</h2><p>Собеседники сообщают только то, что помнят или готовы сообщить. Сопоставляйте слова с независимыми фактами.</p></div>
      </header>
      <div class="interview-layout">
        <div class="suspect-list">
          ${caseData.suspects.map((person) => `<button class="suspect-button${person.id === active.id ? " is-active" : ""}" type="button" data-suspect-id="${person.id}">
            <i class="person-avatar">${initials(person.name)}</i><span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role)}</small></span>${(state.askedQuestions[person.id] || []).length ? '<span class="interview-seen">✓</span>' : ""}
          </button>`).join("")}
        </div>
        <section class="interview-room">
          <div class="interview-subject"><i class="person-avatar">${initials(active.name)}</i><div><h3>${escapeHtml(active.name)}</h3><p>${escapeHtml(active.role)} · ${escapeHtml(active.employer)}</p><small>${escapeHtml(active.life.need)}</small></div></div>
          ${renderConversationControls(active)}
          <div class="transcript" id="transcript">
            ${transcript.length ? transcript.map((line) => `<div class="dialogue-line${line.speaker === "Детектив" ? " is-detective" : ""}${line.kind === "observation" ? " is-observation" : ""}"><b>${escapeHtml(line.speaker)}</b><p>${line.kind === "observation" ? `<em>${escapeHtml(line.text)}</em>` : escapeHtml(line.text)}</p></div>`).join("") : `<div class="dialogue-line"><b>${escapeHtml(active.name)}</b><p>${escapeHtml(active.opening)}</p></div>`}
          </div>
          <div class="question-panel"><span>Выберите тему. Вернуться к времени можно после рассказа о вечере.</span><div class="question-grid">
            ${questions.map((item) => `<button type="button" class="question-button${asked.includes(item.id) ? " is-asked" : ""}${item.locked ? " is-locked" : ""}" data-question-id="${item.id}" ${item.locked || asked.includes(item.id) ? "disabled" : ""}>${escapeHtml(item.question)}${item.locked ? `<small class="question-lock">${escapeHtml(item.lockReason || "сначала проверьте источник")}</small>` : ""}</button>`).join("")}
          </div></div>
        </section>
      </div>
    </div>
  `;
  const transcriptElement = document.querySelector("#transcript");
  if (transcriptElement) transcriptElement.scrollTop = transcriptElement.scrollHeight;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function askQuestion(_app, questionId) {
  const { caseData, state } = _app;
  const { getSuspect, saveCase, interviewQuestions, renderInterviews, renderCurrentView } = _app;
  if (state.outcome || detective.checkThreat(caseData, state)) { renderCurrentView(); return; }
  const person = getSuspect(state.activeSuspect);
  if (!person) return;
  const question = interviewQuestions(person).find((item) => item.id === questionId);
  if (!question || question.locked) return;
  state.askedQuestions[person.id] ||= [];
  state.transcripts[person.id] ||= [];
  if (state.askedQuestions[person.id].includes(questionId)) return;
  const approach = state.approach;
  state.rapport[person.id] = Math.max(-3, Math.min(3, (state.rapport[person.id] || 0) + (approach === "calm" ? 1 : approach === "pressure" ? -1 : 0)));
  detective.spend(caseData, state, approach === "pressure" ? 15 : 5, approach === "pressure" ? 3 : 0);
  if (state.outcome) { renderCurrentView(); return; }
  state.askedQuestions[person.id].push(questionId);
  state.transcripts[person.id].push({ speaker: "Детектив", text: question.question });
  if (question.observation) state.transcripts[person.id].push({ speaker: "Наблюдение", text: `Вы замечаете, как ${question.observation}`, kind: "observation" });
  state.transcripts[person.id].push({ speaker: person.name, text: `${approach === "pressure" ? `${person.life.boundary} ` : ""}${question.answer}` });
  saveCase();
  renderInterviews();
}
