/** Точка входа: HTML уже загружен, создаём модули и подключаем жизненный цикл. */
import { createApplication } from './src/app.js';

const app = createApplication();
app.init();

// Последний снимок прогресса и освобождение звукового контекста при уходе со страницы.
window.addEventListener('beforeunload', () => {
  app.saveCase();
  window.clearInterval(app.ticker);
  if (app.audioSystem?.context && app.audioSystem.context.state !== 'closed') void app.audioSystem.context.close();
});
