/** Локальные настройки оформления и звуки интерфейса. */
import { STORAGE, DEFAULT_SETTINGS, THEME_AUDIO_PROFILES } from '../data/catalog.js';
import { randomGenerator } from '../core/utils.js';

// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function loadSettings(_app) {

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE.settings) || "{}");
    const theme = Object.hasOwn(THEME_AUDIO_PROFILES, saved.theme) ? saved.theme : DEFAULT_SETTINGS.theme;
    const holdDuration = [500, 1000, 1500, 2000].includes(Number(saved.holdDuration)) ? Number(saved.holdDuration) : DEFAULT_SETTINGS.holdDuration;
    const effectsVolume = Number.isFinite(Number(saved.effectsVolume)) ? Math.max(0, Math.min(100, Number(saved.effectsVolume))) : DEFAULT_SETTINGS.effectsVolume;
    return { theme, clickSounds: saved.clickSounds !== false, effectsVolume, holdDuration };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function syncSettingsForm(_app) {
  const { dom, appSettings } = _app;
  if (!dom.settingsForm) return;
  dom.settingsForm.querySelector("#settings-theme").value = appSettings.theme;
  dom.settingsForm.querySelector("#settings-click-sounds").checked = appSettings.clickSounds;
  dom.settingsForm.querySelector("#settings-effects-volume").value = String(appSettings.effectsVolume);
  dom.settingsForm.querySelector("#settings-effects-volume-value").textContent = `${appSettings.effectsVolume}%`;
  dom.settingsForm.querySelector("#settings-hold-duration").value = String(appSettings.holdDuration);
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function applyEffectsVolume(_app) {
  const { state, audioSystem, appSettings } = _app;
  if (!audioSystem) return;
  const effectsLevel = (appSettings.effectsVolume / 100) ** 1.4 * 0.58;
  if (audioSystem.context?.state === "closed") return;
  const now = audioSystem.context.currentTime;
  audioSystem.effectsMaster.gain.setTargetAtTime(effectsLevel, now, 0.025);
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function applySettings(_app) {
  const { appSettings } = _app;
  const { syncSettingsForm, applyEffectsVolume } = _app;
  const lightTheme = appSettings.theme === "high-contrast-white";
  document.documentElement.dataset.theme = appSettings.theme;
  document.documentElement.style.colorScheme = lightTheme ? "light" : "dark";
  document.documentElement.style.setProperty("--board-read-hold-duration", `${appSettings.holdDuration}ms`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", lightTheme ? "#ffffff" : appSettings.theme === "cyberpunk" ? "#100a24" : "#171512");
  syncSettingsForm();
  applyEffectsVolume();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function saveSettings(_app, nextSettings) {
  let { appSettings } = _app;
  const { applySettings } = _app;
  _app.appSettings = appSettings = { ...appSettings, ...nextSettings };
  localStorage.setItem(STORAGE.settings, JSON.stringify(appSettings));
  applySettings();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function ensureAudioSystem(_app) {
  const { state } = _app;
  let { audioSystem } = _app;
  const { toast, applyEffectsVolume } = _app;
  if (audioSystem && audioSystem.context.state !== "closed") return audioSystem;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    toast("Аудио недоступно в этом браузере.", true);
    return null;
  }
  const context = new AudioContext();
  const effectsMaster = context.createGain();
  effectsMaster.gain.value = 0.32;
  effectsMaster.connect(context.destination);
  _app.audioSystem = audioSystem = {
    context,
    effectsMaster,
    random: randomGenerator(`audio-${Date.now()}-${Math.random()}`),
    noiseBuffer: null,
  };
  applyEffectsVolume();
  return audioSystem;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function resumeAudio(_app, audio) {
  const { state } = _app;
  if (audio.context.state === "suspended") void audio.context.resume();
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function scheduleTone(_app, context, destination, frequency, start, duration, volume, wave = "sine") {

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.035, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.04);
}


// Возвращает текущие данные без изменения хода расследования.
export function getNoiseBuffer(_app, audio) {

  if (audio.noiseBuffer) return audio.noiseBuffer;
  const length = Math.floor(audio.context.sampleRate * 0.8);
  const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) channel[index] = (audio.random() * 2 - 1) * 0.82;
  audio.noiseBuffer = buffer;
  return buffer;
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function scheduleNoise(_app, audio, destination, start, duration, volume, frequency) {
  const { getNoiseBuffer } = _app;
  const source = audio.context.createBufferSource();
  const filter = audio.context.createBiquadFilter();
  const gain = audio.context.createGain();
  source.buffer = getNoiseBuffer(audio);
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function playInterfaceSound(_app, kind) {
  const { appSettings } = _app;
  const { ensureAudioSystem, resumeAudio, scheduleTone, scheduleNoise } = _app;
  if (!appSettings.clickSounds) return;
  const audio = ensureAudioSystem();
  if (!audio) return;
  resumeAudio(audio);
  const profile = THEME_AUDIO_PROFILES[appSettings.theme];
  const now = audio.context.currentTime + 0.005;
  const style = kind === "computer" ? { first: profile.accent, second: profile.accent * 1.26, duration: 0.045 } : kind === "page" ? { first: profile.click * 0.72, second: profile.click * 0.91, duration: 0.06 } : { first: profile.click, second: profile.accent, duration: 0.04 };
  scheduleTone(audio.context, audio.effectsMaster, style.first, now, style.duration, 0.05, profile.wave);
  scheduleTone(audio.context, audio.effectsMaster, style.second, now + style.duration * 1.1, style.duration * 0.72, 0.024, profile.wave);
  if (kind === "page" || kind === "computer") scheduleNoise(audio, audio.effectsMaster, now, style.duration * 1.7, profile.noise, kind === "computer" ? 2800 : 1500);
}


// Обрабатывает отдельный шаг этого раздела через общий контекст приложения.
export function handleInterfaceSound(_app, event) {
  const { playInterfaceSound } = _app;
  const target = event.target instanceof Element ? event.target.closest("button, input, select, [role='tab']") : null;
  if (!target || target.disabled) return;
  const kind = target.closest(".computer-shell") ? "computer" : target.matches(".nav-item, .notebook-tab, .filter-button, select") ? "page" : "click";
  playInterfaceSound(kind);
}
