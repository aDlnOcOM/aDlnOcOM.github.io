/** Единственная точка привязки постоянной HTML-оболочки. Вызывается после загрузки документа. */
export function bindDom(document) {
  return {
    workspace: document.querySelector("#workspace"),
    caseHeading: document.querySelector("#case-heading"),
    sidebarBrief: document.querySelector("#sidebar-brief"),
    boardCount: document.querySelector("#board-count"),
    archiveCount: document.querySelector("#archive-count"),
    puzzleCount: document.querySelector("#puzzle-count"),
    taskIndicator: document.querySelector("#task-indicator"),
    computerIndicator: document.querySelector("#computer-indicator"),
    timer: document.querySelector("#case-timer"),
    status: document.querySelector("#status-message"),
    newCaseDialog: document.querySelector("#new-case-dialog"),
    newCaseForm: document.querySelector("#new-case-form"),
    detailDialog: document.querySelector("#detail-dialog"),
    detailContent: document.querySelector("#detail-content"),
    helpDialog: document.querySelector("#help-dialog"),
    settingsDialog: document.querySelector("#settings-dialog"),
    settingsForm: document.querySelector("#settings-form"),
    settingsButton: document.querySelector("#settings-button"),
    notes: document.querySelector("#global-notes"),
    quotes: document.querySelector("#global-quotes"),
    noteSaveState: document.querySelector("#notes-save-state"),
    checklist: document.querySelector("#checklist"),
    checklistForm: document.querySelector("#checklist-form"),
    toastRegion: document.querySelector("#toast-region"),
  };

  }
