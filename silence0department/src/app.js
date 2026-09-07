/** Композиционный корень. Модули получают один явный контекст; глобального состояния и циклических импортов нет. */
import { bindDom } from './core/dom.js';
import {
  createInitialState, getEvidence, getSuspect, isEvidenceUnlocked, availableEvidence, saveCase, loadCase
} from './core/session.js';
import {
  setStatus, toast, showDialog, closeDialog
} from './ui/feedback.js';
import {
  renderField, handleDetectiveClick
} from './ui/field.js';
import {
  renderAssistantChat, sendAssistantMessage
} from './ui/chat.js';
import {
  livingQuestions, renderConversationControls, presentEvidence, styleReply, interviewObservation, interviewQuestions, renderInterviews, askQuestion
} from './ui/interviews.js';
import {
  renderOutcome, renderCaseVerdict, saveInvestigationDraft, restoreReportDraft, readinessScore, renderReport, evaluateReport, renderReportResult
} from './ui/report.js';
import {
  updateThreatChrome, updateChrome, renderCurrentView, navigate, renderOverview
} from './ui/shell.js';
import {
  currentTutorialStep, clearTutorialUi, renderTutorialUi, advanceTutorial, handleTutorialEvent, shouldAdvanceTutorialForNavigation
} from './ui/tutorial.js';
import {
  boardEntity, isBoardNote, boardLink, renderBoard, scheduleBoardLines, drawBoardLines, enableBoardDragging, updateBoardSelectionUi, openBoardNoteDialog
} from './ui/board.js';
import {
  renderArchive, openEvidence
} from './ui/archive.js';
import {
  renderComputer, renderComputerApp, renderMailApp, renderFilesApp, renderSearchApp, renderNetworkApp, renderToolsApp, fixComputerFind, runComputerTool
} from './ui/computer.js';
import {
  renderLab, renderPuzzleDetail, solvePuzzle
} from './ui/laboratory.js';
import {
  taskStatus, renderAnalysis, updateAnalysisProgress, updateCompletedTasks
} from './ui/assignments.js';
import {
  renderChecklist, getChecklistItems, setChecklistItems, saveNotesSoon, initNotebook
} from './ui/notebook.js';
import {
  loadSettings, syncSettingsForm, applyEffectsVolume, applySettings, saveSettings, ensureAudioSystem, resumeAudio, scheduleTone, getNoiseBuffer, scheduleNoise, playInterfaceSound, handleInterfaceSound
} from './ui/settings.js';
import {
  startNewCase, openNewCaseDialog, updateCasePreview, handleClick, handleSubmit, handleKeyboard, tick, init
} from './core/controller.js';

// Связываем обработчики один раз. Каждый вызов читает свежие ссылки на дело и состояние.
export function createApplication() {
  const app = { dom: bindDom(document), caseData: null, state: null, archiveQuery: '', archiveFilter: 'all', noteSaveTimer: null, ticker: null, audioSystem: null, appSettings: null, suppressBoardClickUntil: 0, boardLineFrame: 0 };
  const features = [
    // session: явно перечисленный публичный интерфейс раздела.
    { createInitialState, getEvidence, getSuspect, isEvidenceUnlocked, availableEvidence, saveCase, loadCase },
    // feedback: явно перечисленный публичный интерфейс раздела.
    { setStatus, toast, showDialog, closeDialog },
    // field: явно перечисленный публичный интерфейс раздела.
    { renderField, handleDetectiveClick },
    // chat: явно перечисленный публичный интерфейс раздела.
    { renderAssistantChat, sendAssistantMessage },
    // interviews: явно перечисленный публичный интерфейс раздела.
    { livingQuestions, renderConversationControls, presentEvidence, styleReply, interviewObservation, interviewQuestions, renderInterviews, askQuestion },
    // report: явно перечисленный публичный интерфейс раздела.
    { renderOutcome, renderCaseVerdict, saveInvestigationDraft, restoreReportDraft, readinessScore, renderReport, evaluateReport, renderReportResult },
    // shell: явно перечисленный публичный интерфейс раздела.
    { updateThreatChrome, updateChrome, renderCurrentView, navigate, renderOverview },
    // tutorial: явно перечисленный публичный интерфейс раздела.
    { currentTutorialStep, clearTutorialUi, renderTutorialUi, advanceTutorial, handleTutorialEvent, shouldAdvanceTutorialForNavigation },
    // board: явно перечисленный публичный интерфейс раздела.
    { boardEntity, isBoardNote, boardLink, renderBoard, scheduleBoardLines, drawBoardLines, enableBoardDragging, updateBoardSelectionUi, openBoardNoteDialog },
    // archive: явно перечисленный публичный интерфейс раздела.
    { renderArchive, openEvidence },
    // computer: явно перечисленный публичный интерфейс раздела.
    { renderComputer, renderComputerApp, renderMailApp, renderFilesApp, renderSearchApp, renderNetworkApp, renderToolsApp, fixComputerFind, runComputerTool },
    // laboratory: явно перечисленный публичный интерфейс раздела.
    { renderLab, renderPuzzleDetail, solvePuzzle },
    // assignments: явно перечисленный публичный интерфейс раздела.
    { taskStatus, renderAnalysis, updateAnalysisProgress, updateCompletedTasks },
    // notebook: явно перечисленный публичный интерфейс раздела.
    { renderChecklist, getChecklistItems, setChecklistItems, saveNotesSoon, initNotebook },
    // settings: явно перечисленный публичный интерфейс раздела.
    { loadSettings, syncSettingsForm, applyEffectsVolume, applySettings, saveSettings, ensureAudioSystem, resumeAudio, scheduleTone, getNoiseBuffer, scheduleNoise, playInterfaceSound, handleInterfaceSound },
    // controller: явно перечисленный публичный интерфейс раздела.
    { startNewCase, openNewCaseDialog, updateCasePreview, handleClick, handleSubmit, handleKeyboard, tick, init },
  ];
  for (const feature of features) {
    for (const [name, action] of Object.entries(feature)) {
      if (name in app) throw new Error('Duplicate application action: '+name);
      app[name] = (...args) => action(app, ...args);
    }
  }
  app.appSettings = app.loadSettings();
  return app;
}
