/** Совместимые сюжетные оси, расширяющие базовые сценарии без ослабления логики дела. */
import { CASE_ARCHETYPES, PERSONALITIES, SCENARIOS } from './catalog.js';

// Десять мотивов сопоставлены с уже поддерживаемыми генератором причинами и уликами.
export const MOTIVE_ARCHETYPES = [
  { id: 'jealousy', motive: 'ревность, ошибочно принятая за финансовый конфликт', incidents: ['death', 'disappearance', 'blackmail', 'theft'] },
  { id: 'inheritance', motive: 'борьба за наследство', incidents: ['death', 'disappearance', 'blackmail', 'theft'] },
  { id: 'revenge', motive: 'месть за давнее предательство', incidents: ['death', 'disappearance', 'blackmail', 'theft', 'sabotage'] },
  { id: 'competition', motive: 'защита профессиональной репутации', incidents: ['death', 'blackmail', 'theft', 'sabotage'] },
  { id: 'blackmail', motive: 'шантаж', incidents: ['death', 'disappearance', 'blackmail', 'theft', 'sabotage'] },
  { id: 'ideology', motive: 'идеологическая убеждённость', incidents: ['death', 'disappearance', 'blackmail', 'sabotage'] },
  { id: 'panic', motive: 'паническая реакция без первоначального намерения убить', incidents: ['death'] },
  { id: 'contract', motive: 'устранение свидетеля старого преступления', incidents: ['death', 'disappearance'] },
  { id: 'compulsion', motive: 'навязчивая потребность восстановить контроль', incidents: ['death', 'disappearance', 'blackmail', 'sabotage'] },
  { id: 'protection', motive: 'принуждение к молчанию ради третьего лица', incidents: ['death', 'disappearance', 'blackmail', 'theft', 'sabotage'] },
];

// Контекст меняет детали поручения, профессию сторон и словарь материалов.
export const STORY_SETTINGS = [
  { id: 'technology', label: 'IT, стартапы и кибербезопасность', scenarios: ['radio', 'laboratory', 'terminal'], sectors: ['инфраструктура цифрового сервиса', 'защита данных и кибербезопасность', 'технологический стартап'] },
  { id: 'business', label: 'Классический бизнес и финансы', scenarios: ['archive', 'hotel', 'laboratory', 'museum', 'terminal'], sectors: ['аудит и корпоративные финансы', 'страхование и оценка активов', 'контрактные поставки'] },
  { id: 'personal', label: 'Семья и личные отношения', scenarios: ['club', 'hotel', 'museum'], sectors: ['семейный архив и наследство', 'личные коллекции', 'сеть частных знакомств'] },
  { id: 'creative', label: 'Творчество, медиа и шоу-бизнес', scenarios: ['club', 'hotel', 'radio', 'museum'], sectors: ['музыкальная индустрия и гастроли', 'редакция и права на публикацию', 'кино, сцена и авторские права'] },
  { id: 'science', label: 'Наука и медицина', scenarios: ['archive', 'laboratory', 'museum'], sectors: ['медицинские исследования', 'научный грант и авторство', 'лабораторный контроль качества'] },
];

// Полевой эпизод выбирается из восьми мест, совместимых с выбранной сферой.
export const SCENE_LOCATIONS = [
  { id: 'home', name: 'квартира с общей лестницей и закрытым внутренним двором', district: 'жилой квартал старых домов', settings: ['personal', 'creative'] },
  { id: 'office', name: 'офисный этаж с переговорной и общей серверной', district: 'деловой квартал у грузовой ветки', settings: ['technology', 'business', 'creative', 'science'] },
  { id: 'restaurant', name: 'бар-ресторан с отдельным залом и служебным входом', district: 'старый речной квартал', settings: ['personal', 'business', 'creative'] },
  { id: 'street', name: 'переулок у подземной парковки и остановки ночного маршрута', district: 'узел ночного транспорта', settings: ['technology', 'business', 'personal', 'creative', 'science'] },
  { id: 'country-house', name: 'загородный дом с гостевой пристройкой и мастерской', district: 'дачный пояс у старой дороги', settings: ['personal', 'business', 'creative', 'science'] },
  { id: 'data-center', name: 'серверный зал с резервным питанием и пропускным шлюзом', district: 'северная промышленная зона', settings: ['technology', 'business', 'science'] },
  { id: 'hotel', name: 'служебный этаж гостиницы рядом с конференц-залом', district: 'вокзальная площадь', settings: ['technology', 'business', 'personal', 'creative', 'science'] },
  { id: 'public-space', name: 'общественная галерея на площади между городским парком и вокзалом', district: 'административный центр', settings: ['technology', 'business', 'personal', 'creative', 'science'] },
];

// Шестнадцать игровых темпераментов сохраняют шесть проверенных голосов реплик.
const MBTI_DEFINITIONS = [
  ['ISTJ', 'analytic', 'проверяет порядок действий и держится процедуры', 'увереннее описывает расписание, чем чужие намерения'],
  ['ISFJ', 'reserved', 'бережно говорит о людях и опасается несправедливого вывода', 'вспоминает небольшие жесты, но уклоняется от оценки мотивов'],
  ['INFJ', 'adaptive', 'ищет скрытый смысл отношений и следит за реакцией собеседника', 'подбирает слова осторожно там, где затронут чужой секрет'],
  ['INTJ', 'analytic', 'строит объяснение по причинам и отделяет наблюдение от вывода', 'не замечает, что оставляет важную причинную связь подразумеваемой'],
  ['ISTP', 'reserved', 'описывает действия и инструменты, избегая эмоциональных оценок', 'вспоминает движение предмета, но не всегда время'],
  ['ISFP', 'performer', 'говорит через образы и личные впечатления', 'ярко помнит обстановку и смутнее — порядок событий'],
  ['INFP', 'anxious', 'старается быть честным и болезненно реагирует на несправедливость', 'путается, когда боится подвести другого человека'],
  ['INTP', 'analytic', 'уточняет термины и рассматривает несколько объяснений', 'не проговаривает очевидную ему самому причинную связь'],
  ['ESTP', 'performer', 'быстро отвечает и переводит разговор в конкретные действия', 'становится точнее, если попросить назвать проверяемый шаг'],
  ['ESFP', 'performer', 'считывает настроение комнаты и заполняет паузы деталями', 'делает длинную паузу перед точным временем'],
  ['ENFP', 'adaptive', 'легко устанавливает контакт и предлагает новые версии', 'может увлечься версией прежде, чем проверит её источник'],
  ['ENTP', 'controller', 'оспаривает формулировку вопроса и ищет слабое место версии', 'перестаёт спорить, когда предъявлена независимая запись'],
  ['ESTJ', 'controller', 'уверенно ссылается на регламент и распределение ролей', 'замолкает, когда личное решение расходится с официальной процедурой'],
  ['ESFJ', 'adaptive', 'сначала заботится о последствиях для группы и репутации', 'говорит откровеннее после спокойного подтверждения, что его услышали'],
  ['ENFJ', 'adaptive', 'быстро понимает интересы участников и подбирает точные слова', 'отводит разговор от собственной выгоды к благополучию группы'],
  ['ENTJ', 'controller', 'старается управлять ходом разговора и задавать его рамки', 'теряет уверенность, если факты не укладываются в его план'],
];

// Каждый тип получает собственные слова, а знакомые шаблоны задают тон ответа на допросе.
export const MBTI_PERSONALITIES = MBTI_DEFINITIONS.map(([mbti, voiceId, tell, openingFocus]) => {
  const voice = PERSONALITIES.find(personality => personality.id === voiceId);
  return {
    ...voice,
    id: 'mbti-' + mbti.toLowerCase(),
    mbti,
    voiceId,
    tell,
    signal: voice.signal + '; ' + tell,
    opening: voice.opening + ' ' + openingFocus + '.',
  };
});

// Пять стилей определяются по реальному методу и его инсценировке.
export const CRIME_STYLES = [
  { id: 'force', label: 'Прямое физическое воздействие', matches: /удар|удуш|удержан|фургон|поражен|травма|вывоз/i },
  { id: 'poison', label: 'Отравление или подстроенная авария', matches: /отрав|токсич|угар|аэрозоль|реагент|криоген|охлажден|перегруз|перекрытие|авар|гликозид|гипогликем|передоз/i },
  { id: 'digital', label: 'Цифровое вмешательство или подмена данных', matches: /цифров|контроллер|переадрес|калибров|образц|резервн|сигнальн|монтаж|документ/i },
  { id: 'social', label: 'Социальная инженерия и обман', matches: /заманив|подменённ.*встреч|посредник|задани|шантаж|требован|под видом/i },
  { id: 'staging', label: 'Инсценировка и ложный след', matches: /инсцен|падени|подмен|маскиров|имитац|выдан.*за|фальшив|ложн/i },
];

// Ведущий стиль берётся из способа действия, а явная подмена учитывается как отдельная тактика.
export function identifyCrimeStyle(method, staging) {
  const methodStyles = CRIME_STYLES.filter(style => ['poison', 'digital', 'social'].includes(style.id));
  const directMethod = methodStyles.find(style => style.matches.test(method));
  if (directMethod) return directMethod;
  if (/(инсцен|двухэтапн.*подмен|контейнер-двойник|подменённ.*встреч|фотографирован.*монтаж|тело перемещ|предмет подлож|отключён под видом|запись.*задним числом|имитир|накладная.*подмен)/i.test(method + ' ' + staging)) {
    return CRIME_STYLES.find(style => style.id === 'staging');
  }
  const direct = CRIME_STYLES.find(style => style.id === 'force');
  if (direct.matches.test(method)) return direct;
  const stagingStyle = CRIME_STYLES.find(style => style.id === 'staging');
  if (stagingStyle.matches.test(staging)) return stagingStyle;
  return CRIME_STYLES.find(style => style.id === 'social');
}

// Подсчитывает совместимые, а не фиктивные произведения независимых списков.
export function countPlayableStoryVariants() {
  let count = 0;
  const scenarios = SCENARIOS.flatMap(scenario => STORY_SETTINGS
    .filter(setting => setting.scenarios.includes(scenario.id))
    .map(setting => ({ scenario, setting })));
  for (const incident of CASE_ARCHETYPES) {
    const sceneCount = scenarios.reduce((sum, { setting }) => sum + SCENE_LOCATIONS.filter(scene => scene.settings.includes(setting.id)).length, 0);
    const motives = MOTIVE_ARCHETYPES.filter(motive => motive.incidents.includes(incident.id));
    for (const motive of motives) {
      const patterns = motive.id === 'panic'
        ? incident.patterns.filter(pattern => pattern.method.includes('незапланированной'))
        : incident.patterns;
      const styles = new Set(patterns.map(pattern => identifyCrimeStyle(pattern.method, pattern.staging).id));
      count += sceneCount * styles.size;
    }
  }
  return count;
}

// Теоретическая цель покрытий публикуется рядом с числом допустимых сочетаний.
export const PLAYABLE_STORY_VARIANTS = countPlayableStoryVariants();
