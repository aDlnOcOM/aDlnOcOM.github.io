/** Названия для игрока отделены от внутренних идентификаторов материалов и задач. */
const LABELS = {
  document: 'Документ', log: 'Журнал', forensics: 'Экспертиза', lab: 'Экспертиза',
  conflict: 'Противоречие', digital: 'Цифровой след', crypto: 'Шифр', cipher: 'Шифр',
  stego: 'Скрытое сообщение', timeline: 'Хронология', choice: 'Сопоставление',
  password: 'Пароль', logic: 'Логическая проверка', profile: 'Досье', testimony: 'Показания',
};

export function materialLabel(key) {
  return LABELS[key] || 'Материал';
}
