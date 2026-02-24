import Editor from "@techie_doubts/tui.editor.2026";
import chart from "@techie_doubts/editor-plugin-chart";
import codeSyntaxHighlight from "@techie_doubts/editor-plugin-code-syntax-highlight";
import colorSyntax from "@techie_doubts/editor-plugin-color-syntax";
import exportPlugin from "@techie_doubts/editor-plugin-export";
import katexPlugin from "@techie_doubts/editor-plugin-katex";
import mermaidPlugin from "@techie_doubts/editor-plugin-mermaid";
import tableMergedCell from "@techie_doubts/editor-plugin-table-merged-cell";
import uml from "@techie_doubts/editor-plugin-uml";
import Prism from "prismjs";
import "./prism-languages.generated.js";

import "@techie_doubts/tui.editor.2026/dist/td-editor.css";
import "@techie_doubts/tui.editor.2026/dist/theme/td-editor-dark.css";
import "@techie_doubts/tui.chart.2026/dist/td-chart.css";
import "@techie_doubts/tui.color-picker.2026/dist/tui-color-picker.css";
import "prismjs/themes/prism.css";
import "@techie_doubts/editor-plugin-code-syntax-highlight/dist/td-editor-plugin-code-syntax-highlight.css";
import "@techie_doubts/editor-plugin-color-syntax/dist/td-editor-plugin-color-syntax.css";
import "@techie_doubts/editor-plugin-table-merged-cell/dist/td-editor-plugin-table-merged-cell.css";
import "katex/dist/katex.min.css";
import "./style.css";

const STATE_API_ENDPOINT = "/api/state";
const THEME_STORAGE_KEY = "themeMode";
const LAYOUT_STORAGE_KEY = "layoutPrefs";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ROOT_FOLDER_ID = "all";
const TRASH_FOLDER_ID = "trash";
const FOLDERS_PANEL_MIN_WIDTH = 220;
const NOTES_PANEL_MIN_WIDTH = 240;
const MIN_EDITOR_WIDTH = 520;
const PANEL_RESIZER_WIDTH = 6;
const DESKTOP_BREAKPOINT = 860;
const NOTE_TITLE_SUFFIX_LENGTH = 6;
const REMOTE_SYNC_INTERVAL_MS = 1500;

const ICONS = {
  folder:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"></path></svg>',
  notes:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path><path d="M9 14h6"></path><path d="M9 10h3"></path></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path><path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>',
  newFolder:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v1"></path><path d="M21 14v6"></path><path d="M18 17h6"></path><path d="M3 10v8a3 3 0 0 0 3 3h8"></path></svg>',
  newNote:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path><path d="M12 11v6"></path><path d="M9 14h6"></path></svg>',
  collapsePanel:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v16H3z"></path><path d="M9 4v16"></path><path d="M14 12h5"></path><path d="M16 9l-3 3 3 3"></path></svg>',
};

const chartPluginOptions = {
  minWidth: 100,
  maxWidth: 600,
  minHeight: 100,
  maxHeight: 300,
  chartOptions: {
    series: {
      eventDetectType: "grouped",
    },
  },
};

const starterContent = `# Welcome to TUI Notes 2026

This is a clean build from scratch with nested folders and drag-and-drop.

| Feature | Status |
| --- | --- |
| Full editor | ready |
| Folder tree | ready |
| Notes panel | ready |

\`\`\`chart
Month,Plan,Actual
Jan,15,12
Feb,35,28
Mar,55,51
Apr,75,67

type: line
title: Demo Budget
x.title: Month
y.title: mln
\`\`\`

Inline math: $E = mc^2$.
`;

const app = document.querySelector("#app");
app.innerHTML = `
  <div class="app-shell">
    <aside id="folders-panel" class="panel folders-panel">
      <div class="panel-header">
        <span class="panel-title">Folders</span>
        <div id="folders-header-actions" class="panel-header-actions">
          <button id="new-folder-btn" class="panel-icon-btn" title="New folder" aria-label="New folder" type="button">
            <span class="ui-icon">${ICONS.newFolder}</span>
          </button>
          <button id="toggle-folders-btn" class="panel-icon-btn" title="Collapse folders panel" aria-label="Collapse folders panel" type="button">
            <span class="ui-icon">${ICONS.collapsePanel}</span>
          </button>
        </div>
      </div>
      <div id="folder-list" class="panel-scroll folder-list-root"></div>
      <div class="panel-footer">
        <button id="trash-btn" class="folder-row folder-row-trash" data-drop-folder-id="${TRASH_FOLDER_ID}" type="button">
          <span class="folder-main folder-main-static" style="--depth:0">
            <span class="folder-icon">${ICONS.trash}</span>
            <span class="folder-label">Trash</span>
            <span id="trash-count" class="row-meta">0</span>
          </span>
        </button>
      </div>
    </aside>

    <div id="folders-resizer" class="panel-resizer folders-resizer" role="separator" aria-label="Resize folders panel"></div>

    <aside id="notes-panel" class="panel notes-panel">
      <div class="panel-header notes-panel-header">
        <div id="notes-leading" class="notes-leading">
          <span id="notes-title" class="panel-title">All Notes</span>
        </div>
        <div id="notes-header-actions" class="panel-header-actions">
          <button id="new-note-btn" class="panel-icon-btn" title="New note" aria-label="New note" type="button">
            <span class="ui-icon">${ICONS.newNote}</span>
          </button>
        </div>
      </div>
      <div id="note-list" class="panel-scroll"></div>
    </aside>

    <div id="notes-resizer" class="panel-resizer notes-resizer" role="separator" aria-label="Resize notes panel"></div>

    <main class="editor-pane">
      <div class="editor-header">
        <input id="note-title-input" class="note-title-input" placeholder="Untitled" />
        <div class="editor-header-actions">
          <span id="save-indicator" class="save-indicator">Saved</span>
        </div>
      </div>
      <div id="editor"></div>
    </main>

    <div id="global-top-controls" class="global-top-controls">
      <label id="theme-mode-control" class="theme-mode-control" for="theme-mode-select">
        <span class="theme-mode-label">Theme</span>
        <select id="theme-mode-select" class="theme-mode-select" aria-label="Theme mode">
          <option value="auto">Auto</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </div>
  </div>
  <div id="context-menu" class="context-menu" aria-hidden="true"></div>
`;

const elements = {
  appShell: document.querySelector(".app-shell"),
  foldersPanel: document.querySelector("#folders-panel"),
  foldersHeaderActions: document.querySelector("#folders-header-actions"),
  folderList: document.querySelector("#folder-list"),
  trashBtn: document.querySelector("#trash-btn"),
  trashCount: document.querySelector("#trash-count"),
  foldersResizer: document.querySelector("#folders-resizer"),
  notesPanel: document.querySelector("#notes-panel"),
  notesLeading: document.querySelector("#notes-leading"),
  notesTitle: document.querySelector("#notes-title"),
  noteList: document.querySelector("#note-list"),
  notesResizer: document.querySelector("#notes-resizer"),
  newFolderBtn: document.querySelector("#new-folder-btn"),
  toggleFoldersBtn: document.querySelector("#toggle-folders-btn"),
  newNoteBtn: document.querySelector("#new-note-btn"),
  noteTitleInput: document.querySelector("#note-title-input"),
  saveIndicator: document.querySelector("#save-indicator"),
  themeModeControl: document.querySelector("#theme-mode-control"),
  themeModeSelect: document.querySelector("#theme-mode-select"),
  contextMenu: document.querySelector("#context-menu"),
};

const state = {
  folders: [],
  notes: [],
  ui: {
    expandedFolderIds: [],
  },
};
const expandedFolders = new Set();
let selectedFolderId = ROOT_FOLDER_ID;
let activeNoteId = null;
let editor;
let ignoreEditorChange = false;
let saveTimer = null;
let currentThemeMode = resolveInitialThemeMode();
const layoutPrefs = resolveInitialLayoutPrefs();
let dragState = null;
let dragSourceEl = null;
let dropTargetEl = null;
let contextMenuTarget = null;
let resizeState = null;
let persistInFlight = false;
let persistQueued = false;
let stateReady = false;
let titleInputNoteId = null;
let serverRevision = 0;
let remoteSyncInFlight = false;
let remoteSyncTimer = null;

ensureValidStateShape();
initializeExpandedFolders();
purgeExpiredTrash();
applyLayoutPrefs(false);

initEditor();
renderAll();
wireEvents();
ensureActiveNote();
void bootstrapState();

function resolveInitialThemeMode() {
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" || value === "auto" ? value : "auto";
}

function resolveInitialLayoutPrefs() {
  const defaults = {
    foldersWidth: 280,
    notesWidth: 340,
    foldersCollapsed: false,
  };

  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw);
    return {
      foldersWidth:
        Number.isFinite(parsed?.foldersWidth) && parsed.foldersWidth > 0
          ? parsed.foldersWidth
          : defaults.foldersWidth,
      notesWidth:
        Number.isFinite(parsed?.notesWidth) && parsed.notesWidth > 0
          ? parsed.notesWidth
          : defaults.notesWidth,
      foldersCollapsed: Boolean(parsed?.foldersCollapsed),
    };
  } catch (error) {
    console.error("[tui.notes.2026] failed to parse layout prefs", error);
    return defaults;
  }
}

function persistLayoutPrefs() {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutPrefs));
}

function clampNumber(value, min, max) {
  const safeMax = Math.max(min, max);
  return Math.min(Math.max(value, min), safeMax);
}

function isDesktopLayout() {
  return window.innerWidth > DESKTOP_BREAKPOINT;
}

function moveToggleButton(
  targetContainer,
  beforeElement = null,
  animate = false,
) {
  const toggleButton = elements.toggleFoldersBtn;
  if (!(toggleButton instanceof HTMLElement) || !(targetContainer instanceof HTMLElement)) {
    return;
  }

  if (toggleButton.parentElement === targetContainer) {
    if (!beforeElement || toggleButton.nextElementSibling === beforeElement) {
      return;
    }
  }

  const firstRect = toggleButton.getBoundingClientRect();

  if (beforeElement instanceof HTMLElement && beforeElement.parentElement === targetContainer) {
    targetContainer.insertBefore(toggleButton, beforeElement);
  } else {
    targetContainer.appendChild(toggleButton);
  }

  if (!animate) {
    toggleButton.style.transform = "";
    toggleButton.style.transition = "";
    toggleButton.classList.remove("is-flying");
    return;
  }

  const lastRect = toggleButton.getBoundingClientRect();
  const deltaX = firstRect.left - lastRect.left;
  const deltaY = firstRect.top - lastRect.top;

  if (
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY) ||
    (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5)
  ) {
    return;
  }

  toggleButton.classList.add("is-flying");
  toggleButton.style.transition = "none";
  toggleButton.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

  requestAnimationFrame(() => {
    toggleButton.style.transition = "transform 170ms ease";
    toggleButton.style.transform = "translate(0, 0)";
  });

  const finishAnimation = () => {
    toggleButton.style.transform = "";
    toggleButton.style.transition = "";
    toggleButton.classList.remove("is-flying");
  };

  toggleButton.addEventListener("transitionend", finishAnimation, { once: true });
  setTimeout(finishAnimation, 260);
}

function syncToggleButtonPlacement(animate = false) {
  const shouldBeInNotesHeader = isDesktopLayout() && layoutPrefs.foldersCollapsed;
  if (shouldBeInNotesHeader) {
    moveToggleButton(elements.notesLeading, elements.notesTitle, animate);
  } else {
    moveToggleButton(elements.foldersHeaderActions, null, animate);
  }
}

function updateFoldersToggleButtonState() {
  const collapsed = Boolean(layoutPrefs.foldersCollapsed) && isDesktopLayout();
  elements.toggleFoldersBtn.classList.toggle("is-collapsed", collapsed);
  elements.toggleFoldersBtn.title = collapsed ? "Expand folders panel" : "Collapse folders panel";
  elements.toggleFoldersBtn.setAttribute(
    "aria-label",
    collapsed ? "Expand folders panel" : "Collapse folders panel",
  );
}

function applyLayoutPrefs(
  shouldPersist = true,
  { syncToggle = true, animateToggle = false } = {},
) {
  if (!isDesktopLayout()) {
    elements.appShell.classList.remove("folders-collapsed");
    elements.foldersPanel.style.width = "";
    elements.foldersPanel.style.minWidth = "";
    elements.notesPanel.style.width = "";
    elements.notesPanel.style.minWidth = "";
    elements.foldersResizer.hidden = true;
    elements.notesResizer.hidden = true;
    elements.toggleFoldersBtn.disabled = true;
    if (syncToggle) {
      syncToggleButtonPlacement(animateToggle);
    }
    updateFoldersToggleButtonState();
    return;
  }

  const totalResizerWidth = layoutPrefs.foldersCollapsed
    ? PANEL_RESIZER_WIDTH
    : PANEL_RESIZER_WIDTH * 2;
  const maxFoldersWidth = Math.max(
    FOLDERS_PANEL_MIN_WIDTH,
    window.innerWidth - NOTES_PANEL_MIN_WIDTH - MIN_EDITOR_WIDTH - totalResizerWidth,
  );
  layoutPrefs.foldersWidth = clampNumber(layoutPrefs.foldersWidth, FOLDERS_PANEL_MIN_WIDTH, maxFoldersWidth);

  const foldersWidth = layoutPrefs.foldersCollapsed ? 0 : layoutPrefs.foldersWidth;
  const maxNotesWidth = Math.max(
    NOTES_PANEL_MIN_WIDTH,
    window.innerWidth - foldersWidth - MIN_EDITOR_WIDTH - totalResizerWidth,
  );
  layoutPrefs.notesWidth = clampNumber(layoutPrefs.notesWidth, NOTES_PANEL_MIN_WIDTH, maxNotesWidth);

  elements.appShell.classList.toggle("folders-collapsed", layoutPrefs.foldersCollapsed);
  elements.foldersPanel.style.width = layoutPrefs.foldersCollapsed ? "0px" : `${layoutPrefs.foldersWidth}px`;
  elements.foldersPanel.style.minWidth = layoutPrefs.foldersCollapsed
    ? "0px"
    : `${FOLDERS_PANEL_MIN_WIDTH}px`;
  elements.notesPanel.style.width = `${layoutPrefs.notesWidth}px`;
  elements.notesPanel.style.minWidth = `${NOTES_PANEL_MIN_WIDTH}px`;
  elements.foldersResizer.hidden = layoutPrefs.foldersCollapsed;
  elements.notesResizer.hidden = false;
  elements.toggleFoldersBtn.disabled = false;
  if (syncToggle) {
    syncToggleButtonPlacement(animateToggle);
  }
  updateFoldersToggleButtonState();

  if (shouldPersist) {
    persistLayoutPrefs();
  }
}

function toggleFoldersPanel() {
  if (!isDesktopLayout()) {
    return;
  }

  const nextCollapsed = !layoutPrefs.foldersCollapsed;
  layoutPrefs.foldersCollapsed = nextCollapsed;

  if (nextCollapsed) {
    syncToggleButtonPlacement(true);
    applyLayoutPrefs(true, { syncToggle: false });
    return;
  }

  applyLayoutPrefs(false, { syncToggle: false });
  syncToggleButtonPlacement(true);
  persistLayoutPrefs();
}

function startResize(panel, event) {
  if (!isDesktopLayout() || event.button !== 0) {
    return;
  }

  event.preventDefault();
  resizeState = {
    panel,
    startX: event.clientX,
    foldersWidth: layoutPrefs.foldersWidth,
    notesWidth: layoutPrefs.notesWidth,
  };
  document.body.classList.add("is-resizing");
}

function handleResizeDrag(event) {
  if (!resizeState || !isDesktopLayout()) {
    return;
  }

  const deltaX = event.clientX - resizeState.startX;

  if (resizeState.panel === "folders" && !layoutPrefs.foldersCollapsed) {
    layoutPrefs.foldersWidth = resizeState.foldersWidth + deltaX;
  } else if (resizeState.panel === "notes") {
    layoutPrefs.notesWidth = resizeState.notesWidth + deltaX;
  }

  applyLayoutPrefs(false);
}

function stopResize() {
  if (!resizeState) {
    return;
  }

  resizeState = null;
  document.body.classList.remove("is-resizing");
  persistLayoutPrefs();
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRandomToken(length = NOTE_TITLE_SUFFIX_LENGTH) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const size = Number.isFinite(length) && length > 0 ? Math.floor(length) : NOTE_TITLE_SUFFIX_LENGTH;
  if (size <= 0) {
    return "";
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }

  let value = "";
  while (value.length < size) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

function createDefaultState() {
  const now = Date.now();
  const workId = createId();
  const personalId = createId();

  return {
    folders: [
      { id: workId, name: "Work", parentId: null, createdAt: now, updatedAt: now },
      { id: personalId, name: "Personal", parentId: null, createdAt: now + 1, updatedAt: now + 1 },
    ],
    notes: [
      {
        id: createId(),
        title: "Welcome",
        folderId: null,
        content: starterContent,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ],
    ui: {
      expandedFolderIds: [workId, personalId],
    },
  };
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }
    const error = new Error(payload?.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return response.json();
}

function getPayloadRevision(payload) {
  const parsed = Number(payload?._meta?.revision);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function updateServerRevision(payload) {
  serverRevision = Math.max(serverRevision, getPayloadRevision(payload));
}

function applyStatePayload(payload) {
  state.folders = Array.isArray(payload?.folders) ? payload.folders : [];
  state.notes = Array.isArray(payload?.notes) ? payload.notes : [];
  state.ui = payload?.ui && typeof payload.ui === "object" ? payload.ui : {};
  ensureValidStateShape();
  purgeExpiredTrash();
  initializeExpandedFolders();
}

function snapshotStateForPersistence() {
  persistExpandedFolders();
  return {
    folders: state.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId ?? null,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt ?? folder.createdAt,
    })),
    notes: state.notes.map((note) => ({
      id: note.id,
      title: note.title,
      folderId: note.folderId ?? null,
      content: note.content || "",
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: note.deletedAt || null,
      fileName: note.fileName || `${note.id}.md`,
    })),
    ui: {
      expandedFolderIds: Array.from(expandedFolders),
    },
  };
}

function getFolderTimestamp(folder) {
  return Number(folder?.updatedAt) || Number(folder?.createdAt) || 0;
}

function getNoteTimestamp(note) {
  return Number(note?.updatedAt) || Number(note?.createdAt) || 0;
}

function cloneConflictEntity(entity) {
  return entity && typeof entity === "object" ? { ...entity } : entity;
}

function mergeConflictPayload(localSnapshot, remotePayload) {
  const remoteState = {
    folders: Array.isArray(remotePayload?.folders) ? remotePayload.folders : [],
    notes: Array.isArray(remotePayload?.notes) ? remotePayload.notes : [],
    ui: remotePayload?.ui && typeof remotePayload.ui === "object" ? remotePayload.ui : {},
  };

  const folderById = new Map();
  for (const folder of remoteState.folders) {
    if (!folder?.id) {
      continue;
    }
    folderById.set(String(folder.id), cloneConflictEntity(folder));
  }
  for (const folder of localSnapshot.folders || []) {
    if (!folder?.id) {
      continue;
    }
    const folderId = String(folder.id);
    const remoteFolder = folderById.get(folderId);
    if (!remoteFolder || getFolderTimestamp(folder) >= getFolderTimestamp(remoteFolder)) {
      folderById.set(folderId, cloneConflictEntity(folder));
    }
  }

  const mergedFolders = Array.from(folderById.values()).sort((left, right) => {
    const byCreatedAt = (left.createdAt || 0) - (right.createdAt || 0);
    if (byCreatedAt !== 0) {
      return byCreatedAt;
    }
    return String(left.id).localeCompare(String(right.id), undefined, { sensitivity: "base" });
  });
  const validFolderIds = new Set(mergedFolders.map((folder) => String(folder.id)));

  const noteById = new Map();
  for (const note of remoteState.notes) {
    if (!note?.id) {
      continue;
    }
    noteById.set(String(note.id), cloneConflictEntity(note));
  }
  for (const note of localSnapshot.notes || []) {
    if (!note?.id) {
      continue;
    }
    const noteId = String(note.id);
    const remoteNote = noteById.get(noteId);
    if (!remoteNote || getNoteTimestamp(note) >= getNoteTimestamp(remoteNote)) {
      noteById.set(noteId, cloneConflictEntity(note));
    }
  }

  const mergedNotes = Array.from(noteById.values())
    .map((note) => {
      const folderId = note.folderId == null ? null : String(note.folderId);
      return {
        ...note,
        folderId: folderId && validFolderIds.has(folderId) ? folderId : null,
      };
    })
    .sort((left, right) => {
      const byCreatedAt = (left.createdAt || 0) - (right.createdAt || 0);
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }
      return String(left.id).localeCompare(String(right.id), undefined, { sensitivity: "base" });
    });

  const remoteExpanded = Array.isArray(remoteState.ui?.expandedFolderIds)
    ? remoteState.ui.expandedFolderIds
    : [];
  const localExpanded = Array.isArray(localSnapshot.ui?.expandedFolderIds)
    ? localSnapshot.ui.expandedFolderIds
    : [];
  const mergedExpanded = [...new Set([...remoteExpanded, ...localExpanded])]
    .map((folderId) => String(folderId))
    .filter((folderId) => validFolderIds.has(folderId));

  return {
    folders: mergedFolders,
    notes: mergedNotes,
    ui: {
      expandedFolderIds: mergedExpanded,
    },
  };
}

function hasPendingLocalChanges() {
  return Boolean(saveTimer || persistInFlight || persistQueued);
}

function isEditorFocused() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof Element)) {
    return false;
  }
  return Boolean(activeElement.closest(".toastui-editor-defaultUI"));
}

function commitActiveNoteContentFromEditor() {
  if (!stateReady || ignoreEditorChange) {
    return;
  }

  const note = getActiveNote();
  if (!note || selectedFolderId === TRASH_FOLDER_ID || isNoteInTrash(note)) {
    return;
  }

  let markdown = "";
  try {
    markdown = editor.getMarkdown();
  } catch (error) {
    console.error("[tui.notes.2026] failed to read markdown from editor", error);
    return;
  }

  if (typeof markdown !== "string") {
    return;
  }

  if (markdown !== note.content) {
    note.content = markdown;
    note.updatedAt = Date.now();
    scheduleSaveIndicator("Saving...");
    renderNotes();
  }
}

function shouldDeferRemoteApply() {
  if (!stateReady) {
    return true;
  }
  if (hasPendingLocalChanges()) {
    return true;
  }
  if (document.activeElement === elements.noteTitleInput) {
    return true;
  }

  if (isEditorFocused()) {
    commitActiveNoteContentFromEditor();
    if (hasPendingLocalChanges()) {
      return true;
    }
  }
  return false;
}

function syncActiveEditorFromState() {
  const note = getActiveNote();
  if (!note || selectedFolderId === TRASH_FOLDER_ID || isNoteInTrash(note)) {
    return;
  }

  ignoreEditorChange = true;
  try {
    editor.setMarkdown(note.content || "", false, false, true);
  } catch (error) {
    console.error("[tui.notes.2026] failed to sync editor content", error);
  } finally {
    ignoreEditorChange = false;
  }
}

function applyRemoteState(payload, { refreshEditor = true } = {}) {
  const previousActiveNoteId = activeNoteId;
  const previousActiveContent = getActiveNote()?.content || "";
  const preferredFolderId = selectedFolderId;

  applyStatePayload(payload);
  updateServerRevision(payload);

  if (
    preferredFolderId === ROOT_FOLDER_ID ||
    preferredFolderId === TRASH_FOLDER_ID ||
    folderExists(preferredFolderId)
  ) {
    selectedFolderId = preferredFolderId;
  } else {
    selectedFolderId = ROOT_FOLDER_ID;
  }

  renderAll();
  ensureActiveNote();

  const activeNote = getActiveNote();
  const hasSameActiveNote =
    Boolean(previousActiveNoteId) && activeNote?.id === previousActiveNoteId;
  const activeContentChanged =
    hasSameActiveNote && (activeNote.content || "") !== previousActiveContent;

  if (refreshEditor && activeContentChanged) {
    syncActiveEditorFromState();
  }
}

async function persistStateToServer(snapshot) {
  return apiRequest(STATE_API_ENDPOINT, {
    method: "PUT",
    body: JSON.stringify({
      ...snapshot,
      _meta: {
        baseRevision: serverRevision,
      },
    }),
  });
}

async function flushPersistQueue() {
  if (persistInFlight) {
    return;
  }

  persistInFlight = true;
  try {
    do {
      persistQueued = false;
      const snapshot = snapshotStateForPersistence();
      try {
        const response = await persistStateToServer(snapshot);
        updateServerRevision(response);
      } catch (error) {
        const isConflict =
          Number(error?.status) === 409 &&
          error?.payload &&
          typeof error.payload === "object" &&
          error.payload.state;

        if (!isConflict) {
          throw error;
        }

        const mergedState = mergeConflictPayload(snapshot, error.payload.state);
        applyRemoteState({
          ...mergedState,
          _meta: error.payload.state?._meta,
        });
        persistQueued = true;
      }
    } while (persistQueued);

    elements.saveIndicator.textContent = "Saved";
  } catch (error) {
    console.error("[tui.notes.2026] save failed", error);
    elements.saveIndicator.textContent = "Save failed";
  } finally {
    persistInFlight = false;
  }
}

async function bootstrapState() {
  elements.saveIndicator.textContent = "Syncing...";
  try {
    const remoteState = await apiRequest(STATE_API_ENDPOINT);
    applyRemoteState(remoteState, { refreshEditor: false });
  } catch (error) {
    console.error("[tui.notes.2026] bootstrap failed, seeding default state", error);
    applyStatePayload(createDefaultState());
    saveState();
  }

  stateReady = true;
  renderAll();
  ensureActiveNote();
  elements.saveIndicator.textContent = "Saved";
  startRemoteSyncLoop();
}

function startRemoteSyncLoop() {
  if (remoteSyncTimer) {
    clearInterval(remoteSyncTimer);
  }
  remoteSyncTimer = window.setInterval(() => {
    void syncStateFromServer();
  }, REMOTE_SYNC_INTERVAL_MS);
}

async function syncStateFromServer({ force = false } = {}) {
  if (!stateReady) {
    return;
  }
  if (remoteSyncInFlight) {
    return;
  }
  if (!force && document.hidden) {
    return;
  }
  if (shouldDeferRemoteApply()) {
    return;
  }

  remoteSyncInFlight = true;
  try {
    const remoteState = await apiRequest(STATE_API_ENDPOINT);
    const remoteRevision = getPayloadRevision(remoteState);
    if (!force && remoteRevision <= serverRevision) {
      updateServerRevision(remoteState);
      return;
    }
    if (shouldDeferRemoteApply()) {
      return;
    }
    applyRemoteState(remoteState);
  } catch (error) {
    console.error("[tui.notes.2026] remote sync failed", error);
  } finally {
    remoteSyncInFlight = false;
  }
}

function flushStateWithBeacon() {
  if (!stateReady) {
    return;
  }

  commitActiveNoteContentFromEditor();

  try {
    const payload = JSON.stringify({
      ...snapshotStateForPersistence(),
      _meta: {
        baseRevision: serverRevision,
      },
    });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(
        STATE_API_ENDPOINT,
        new Blob([payload], { type: "application/json" }),
      );
    }
  } catch (error) {
    console.error("[tui.notes.2026] beacon flush failed", error);
  }
}

function ensureValidStateShape() {
  const normalizedFolders = [];
  const folderIds = new Set();

  for (const rawFolder of state.folders) {
    if (!rawFolder || rawFolder.id == null || rawFolder.name == null) {
      continue;
    }

    const id = String(rawFolder.id);
    if (!id || folderIds.has(id)) {
      continue;
    }

    const name = String(rawFolder.name).trim() || "Untitled Folder";
    normalizedFolders.push({
      id,
      name,
      parentId: rawFolder.parentId == null ? null : String(rawFolder.parentId),
      createdAt: Number(rawFolder.createdAt) || Date.now(),
      updatedAt: Number(rawFolder.updatedAt) || Number(rawFolder.createdAt) || Date.now(),
    });
    folderIds.add(id);
  }

  const folderById = new Map(normalizedFolders.map((folder) => [folder.id, folder]));

  for (const folder of normalizedFolders) {
    if (!folder.parentId || folder.parentId === folder.id || !folderById.has(folder.parentId)) {
      folder.parentId = null;
      continue;
    }

    const seen = new Set([folder.id]);
    let nextParentId = folder.parentId;
    let hasCycle = false;

    while (nextParentId) {
      if (seen.has(nextParentId)) {
        hasCycle = true;
        break;
      }
      seen.add(nextParentId);
      nextParentId = folderById.get(nextParentId)?.parentId || null;
    }

    if (hasCycle) {
      folder.parentId = null;
    }
  }

  state.folders = normalizedFolders;

  const validFolderIds = new Set(state.folders.map((folder) => folder.id));
  const normalizedNotes = [];
  const noteIds = new Set();

  for (const rawNote of state.notes) {
    if (!rawNote || rawNote.id == null) {
      continue;
    }

    const id = String(rawNote.id);
    if (!id || noteIds.has(id)) {
      continue;
    }

    const title = String(rawNote.title || "Untitled").trim() || "Untitled";
    const folderIdCandidate = rawNote.folderId == null ? null : String(rawNote.folderId);
    const folderId = folderIdCandidate && validFolderIds.has(folderIdCandidate) ? folderIdCandidate : null;
    const createdAt = Number(rawNote.createdAt) || Date.now();
    const updatedAt = Number(rawNote.updatedAt) || createdAt;
    const deletedAt = rawNote.deletedAt ? Number(rawNote.deletedAt) || null : null;
    const fileNameCandidate =
      typeof rawNote.fileName === "string" ? rawNote.fileName.trim() : "";
    const fileName =
      fileNameCandidate && fileNameCandidate.toLowerCase().endsWith(".md")
        ? fileNameCandidate
        : `${id}.md`;

    normalizedNotes.push({
      id,
      title,
      folderId,
      content: String(rawNote.content || ""),
      fileName,
      createdAt,
      updatedAt,
      deletedAt,
    });
    noteIds.add(id);
  }

  state.notes = normalizedNotes;

  if (!state.ui || typeof state.ui !== "object") {
    state.ui = {};
  }
  if (!Array.isArray(state.ui.expandedFolderIds)) {
    state.ui.expandedFolderIds = [];
  }

  state.ui.expandedFolderIds = [
    ...new Set(
      state.ui.expandedFolderIds
        .map((folderId) => String(folderId))
        .filter((folderId) => validFolderIds.has(folderId)),
    ),
  ];
}

function initializeExpandedFolders() {
  expandedFolders.clear();

  if (state.ui.expandedFolderIds.length) {
    for (const folderId of state.ui.expandedFolderIds) {
      expandedFolders.add(folderId);
    }
    return;
  }

  for (const folder of state.folders) {
    if (!folder.parentId) {
      expandedFolders.add(folder.id);
    }
  }
}

function persistExpandedFolders() {
  state.ui.expandedFolderIds = Array.from(expandedFolders);
}

function saveState() {
  persistExpandedFolders();
  if (persistInFlight) {
    persistQueued = true;
    return;
  }
  void flushPersistQueue();
}

function scheduleSaveIndicator(status) {
  elements.saveIndicator.textContent = status;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (status === "Saved") {
    return;
  }
  saveTimer = setTimeout(() => {
    saveState();
    saveTimer = null;
  }, 250);
}

function purgeExpiredTrash() {
  const now = Date.now();
  state.notes = state.notes.filter((note) => {
    if (!note.deletedAt) {
      return true;
    }
    return now - note.deletedAt < THIRTY_DAYS_MS;
  });
}

function getFolderById(folderId) {
  return state.folders.find((folder) => folder.id === folderId) || null;
}

function folderExists(folderId) {
  return Boolean(getFolderById(folderId));
}

function getFolderChildren(parentId) {
  return state.folders
    .filter((folder) => (folder.parentId || null) === (parentId || null))
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (byName !== 0) {
        return byName;
      }
      return a.createdAt - b.createdAt;
    });
}

function folderHasChildren(folderId) {
  return state.folders.some((folder) => folder.parentId === folderId);
}

function getFolderDescendantIds(folderId) {
  const descendants = [];
  const queue = [folderId];

  while (queue.length) {
    const currentId = queue.shift();
    for (const folder of state.folders) {
      if (folder.parentId === currentId) {
        descendants.push(folder.id);
        queue.push(folder.id);
      }
    }
  }

  return descendants;
}

function isFolderAncestor(ancestorId, folderId) {
  let current = getFolderById(folderId);
  while (current && current.parentId) {
    if (current.parentId === ancestorId) {
      return true;
    }
    current = getFolderById(current.parentId);
  }
  return false;
}

function isNoteInTrash(note) {
  return Boolean(note.deletedAt);
}

function getActiveNotes() {
  return state.notes.filter((note) => !isNoteInTrash(note));
}

function getTrashNotes() {
  return state.notes.filter((note) => isNoteInTrash(note));
}

function getVisibleNotes() {
  if (selectedFolderId === TRASH_FOLDER_ID) {
    return getTrashNotes().sort((a, b) => b.deletedAt - a.deletedAt);
  }

  const source = getActiveNotes();
  if (selectedFolderId === ROOT_FOLDER_ID) {
    return source.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  if (!folderExists(selectedFolderId)) {
    return source.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return source
    .filter((note) => note.folderId === selectedFolderId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function getFolderLabel(folderId) {
  if (folderId === ROOT_FOLDER_ID) {
    return "All Notes";
  }
  if (folderId === TRASH_FOLDER_ID) {
    return "Trash";
  }
  return getFolderById(folderId)?.name || "Notes";
}

function getNoteFolderLabel(folderId) {
  if (!folderId) {
    return "Root";
  }
  return getFolderById(folderId)?.name || "Root";
}

function folderNoteCount(folderId) {
  if (folderId === ROOT_FOLDER_ID) {
    return getActiveNotes().length;
  }
  if (folderId === TRASH_FOLDER_ID) {
    return getTrashNotes().length;
  }
  return getActiveNotes().filter((note) => note.folderId === folderId).length;
}

function getActiveNote() {
  return state.notes.find((note) => note.id === activeNoteId) || null;
}

function initEditor() {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const initialTheme =
    currentThemeMode === "dark" || (currentThemeMode === "auto" && media.matches)
      ? "dark"
      : "light";

  editor = new Editor({
    el: document.querySelector("#editor"),
    previewStyle: "vertical",
    height: "100%",
    initialEditType: "wysiwyg",
    initialValue: "",
    theme: initialTheme,
    usageStatistics: false,
    plugins: [
      [chart, chartPluginOptions],
      [codeSyntaxHighlight, { highlighter: Prism }],
      colorSyntax,
      tableMergedCell,
      uml,
      mermaidPlugin,
      katexPlugin,
      [exportPlugin, { toolbarGroupIndex: 99, toolbarItemIndex: 1 }],
    ],
    events: {
      change: handleEditorChange,
    },
  });

  installThemeControl(editor, media);
}

function installThemeControl(editorInstance, mediaQuery) {
  const rootEl = document.querySelector(".toastui-editor-defaultUI");
  const bodyEl = document.body;
  const themeSelect = elements.themeModeSelect;
  if (!(themeSelect instanceof HTMLSelectElement)) {
    return;
  }

  const applyTheme = (mode, shouldPersist = true) => {
    const useDark = mode === "dark" || (mode === "auto" && mediaQuery.matches);

    rootEl?.classList.toggle("toastui-editor-dark", useDark);
    bodyEl.classList.toggle("dark", useDark);
    editorInstance.eventEmitter.emit("changeTheme", useDark ? "dark" : "light");
    editorInstance.eventEmitter.emit("change");

    currentThemeMode = mode;
    themeSelect.value = mode;
    if (shouldPersist) {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  };

  themeSelect.value = currentThemeMode;
  themeSelect.addEventListener("change", () => {
    const nextMode = themeSelect.value;
    if (nextMode === "auto" || nextMode === "light" || nextMode === "dark") {
      applyTheme(nextMode);
    }
  });

  mediaQuery.addEventListener("change", () => {
    if (currentThemeMode === "auto") {
      applyTheme("auto", false);
    }
  });

  applyTheme(currentThemeMode, false);
}

function renderAll() {
  renderFolders();
  renderNotes();
  renderEditorHeader();
}

function renderFolders() {
  if (
    selectedFolderId !== ROOT_FOLDER_ID &&
    selectedFolderId !== TRASH_FOLDER_ID &&
    !folderExists(selectedFolderId)
  ) {
    selectedFolderId = ROOT_FOLDER_ID;
  }

  const rows = [];

  rows.push(`
    <div class="folder-row ${selectedFolderId === ROOT_FOLDER_ID ? "is-active" : ""}" data-drop-folder-id="${ROOT_FOLDER_ID}" style="--depth:0">
      <span class="folder-toggle-placeholder" aria-hidden="true"></span>
      <button class="folder-main" data-action="select-folder" data-folder-id="${ROOT_FOLDER_ID}" type="button">
        <span class="folder-icon">${ICONS.notes}</span>
        <span class="folder-label">All Notes</span>
        <span class="row-meta">${folderNoteCount(ROOT_FOLDER_ID)}</span>
      </button>
    </div>
  `);

  rows.push(...buildFolderRows(null, 0));

  if (rows.length === 1) {
    rows.push(`<div class="empty-hint">No folders yet</div>`);
  }

  elements.folderList.innerHTML = rows.join("");
  elements.trashBtn.classList.toggle("is-active", selectedFolderId === TRASH_FOLDER_ID);
  elements.trashCount.textContent = String(folderNoteCount(TRASH_FOLDER_ID));
}

function buildFolderRows(parentId, depth) {
  const rows = [];
  const folders = getFolderChildren(parentId);

  for (const folder of folders) {
    const hasChildren = folderHasChildren(folder.id);
    const expanded = expandedFolders.has(folder.id);

    rows.push(`
      <div
        class="folder-row ${selectedFolderId === folder.id ? "is-active" : ""}"
        data-folder-id="${folder.id}"
        data-drop-folder-id="${folder.id}"
        data-draggable="folder"
        draggable="true"
        style="--depth:${depth}"
      >
        ${
          hasChildren
            ? `<button class="folder-toggle ${expanded ? "is-expanded" : ""}" type="button" data-action="toggle-folder" data-folder-id="${folder.id}" aria-label="Toggle folder"><span class="folder-chevron">></span></button>`
            : '<span class="folder-toggle-placeholder" aria-hidden="true"></span>'
        }
        <button class="folder-main" data-action="select-folder" data-folder-id="${folder.id}" type="button">
          <span class="folder-icon">${ICONS.folder}</span>
          <span class="folder-label">${escapeHtml(folder.name)}</span>
          <span class="row-meta">${folderNoteCount(folder.id)}</span>
        </button>
      </div>
    `);

    if (hasChildren && expanded) {
      rows.push(...buildFolderRows(folder.id, depth + 1));
    }
  }

  return rows;
}

function renderNotes() {
  const visibleNotes = getVisibleNotes();
  elements.notesTitle.textContent = getFolderLabel(selectedFolderId);
  elements.newNoteBtn.disabled = selectedFolderId === TRASH_FOLDER_ID;

  if (!visibleNotes.length) {
    elements.noteList.innerHTML = `<div class="empty-hint">No notes</div>`;
    return;
  }

  const rows = visibleNotes
    .map((note) => {
      const active = note.id === activeNoteId ? "is-active" : "";
      const meta =
        selectedFolderId === TRASH_FOLDER_ID
          ? formatDeletedAt(note.deletedAt)
          : selectedFolderId === ROOT_FOLDER_ID
            ? `${escapeHtml(getNoteFolderLabel(note.folderId))} · ${escapeHtml(formatUpdatedAt(note.updatedAt))}`
            : escapeHtml(formatUpdatedAt(note.updatedAt));

      return `
        <div class="note-row ${active}" data-note-id="${note.id}" ${
          selectedFolderId === TRASH_FOLDER_ID ? "" : 'draggable="true"'
        }>
          <button class="note-main" data-note-id="${note.id}" type="button">
            <span class="note-title">${escapeHtml(note.title)}</span>
            <span class="note-meta">${meta}</span>
          </button>
        </div>
      `;
    })
    .join("");

  elements.noteList.innerHTML = rows;
}

function renderEditorHeader() {
  const note = getActiveNote();
  const hasActiveEditableNote =
    Boolean(note) && selectedFolderId !== TRASH_FOLDER_ID && !isNoteInTrash(note);

  elements.appShell.classList.toggle("editor-hidden", !hasActiveEditableNote);

  if (!hasActiveEditableNote) {
    elements.noteTitleInput.value = "";
    elements.noteTitleInput.disabled = true;
    titleInputNoteId = null;
    return;
  }

  elements.noteTitleInput.disabled = false;
  elements.noteTitleInput.value = note.title;
  titleInputNoteId = note.id;
}

function clearEditorSelection() {
  activeNoteId = null;
  ignoreEditorChange = true;
  editor.setMarkdown("");
  resetEditorUndoRedoHistory();
  ignoreEditorChange = false;
  renderEditorHeader();
}

function ensureActiveNote() {
  if (selectedFolderId === TRASH_FOLDER_ID) {
    clearEditorSelection();
    renderNotes();
    return;
  }

  const visibleNotes = getVisibleNotes();
  if (!visibleNotes.length) {
    clearEditorSelection();
    renderNotes();
    return;
  }

  const stillVisible = visibleNotes.some((note) => note.id === activeNoteId);
  if (!stillVisible) {
    setActiveNote(visibleNotes[0].id);
  } else {
    renderEditorHeader();
  }
}

function setActiveNote(noteId) {
  commitActiveNoteTitleFromInput();
  commitActiveNoteContentFromEditor();

  const note = state.notes.find((item) => item.id === noteId && !isNoteInTrash(item));
  if (!note) {
    return;
  }

  activeNoteId = note.id;
  ignoreEditorChange = true;
  try {
    editor.setMarkdown(note.content || "", false, false, true);

    if (editor.isMarkdownMode()) {
      editor.setSelection([1, 1], [1, 1]);
    } else {
      editor.moveCursorToStart(true);
      editor.setSelection(1, 1);
      requestAnimationFrame(() => {
        if (activeNoteId !== note.id || editor.isMarkdownMode()) {
          return;
        }
        editor.setSelection(1, 1);
      });
    }
    resetEditorUndoRedoHistory();
  } catch (error) {
    console.error("[tui.notes.2026] failed to switch active note", error);
  } finally {
    ignoreEditorChange = false;
  }
  renderNotes();
  renderEditorHeader();
}

function resetEditorUndoRedoHistory() {
  if (!editor || typeof editor !== "object") {
    return;
  }

  const editorCore = editor;
  const snapshotHistory = editorCore.snapshotHistory;
  if (!snapshotHistory || typeof snapshotHistory !== "object") {
    return;
  }

  if (Array.isArray(snapshotHistory.undoStack)) {
    snapshotHistory.undoStack.length = 0;
  }
  if (Array.isArray(snapshotHistory.redoStack)) {
    snapshotHistory.redoStack.length = 0;
  }

  if (
    typeof editorCore.pushSnapshot === "function" &&
    typeof editorCore.getMarkdown === "function"
  ) {
    editorCore.pushSnapshot(editorCore.getMarkdown());
  }
}

function selectFolder(folderId) {
  if (!stateReady) {
    return;
  }
  commitActiveNoteTitleFromInput();
  commitActiveNoteContentFromEditor();
  hideContextMenu();

  if (folderId === TRASH_FOLDER_ID || folderId === ROOT_FOLDER_ID || folderExists(folderId)) {
    selectedFolderId = folderId;
  } else {
    selectedFolderId = ROOT_FOLDER_ID;
  }

  renderAll();
  ensureActiveNote();
}

function hasFolderNameInParent(name, parentId, excludeFolderId = null) {
  const normalizedName = name.toLowerCase();
  return state.folders.some(
    (folder) =>
      folder.id !== excludeFolderId &&
      (folder.parentId || null) === (parentId || null) &&
      folder.name.toLowerCase() === normalizedName,
  );
}

function getSelectedParentFolderId() {
  return folderExists(selectedFolderId) ? selectedFolderId : null;
}

function createFolder() {
  if (!stateReady) {
    return;
  }
  const value = window.prompt("Folder name");
  if (!value) {
    return;
  }

  const name = value.trim();
  if (!name) {
    return;
  }

  const parentId = getSelectedParentFolderId();
  if (hasFolderNameInParent(name, parentId)) {
    window.alert("A folder with this name already exists in the same location.");
    return;
  }

  const now = Date.now();
  const folderId = createId();
  state.folders.push({ id: folderId, name, parentId, createdAt: now, updatedAt: now });

  if (parentId) {
    expandedFolders.add(parentId);
  }
  expandedFolders.add(folderId);
  selectedFolderId = folderId;

  saveState();
  renderAll();
  ensureActiveNote();
}

function renameFolder(folderId) {
  if (!stateReady) {
    return;
  }
  const folder = getFolderById(folderId);
  if (!folder) {
    return;
  }

  const value = window.prompt("Folder name", folder.name);
  if (!value) {
    return;
  }

  const name = value.trim();
  if (!name || name === folder.name) {
    return;
  }

  if (hasFolderNameInParent(name, folder.parentId, folder.id)) {
    window.alert("A folder with this name already exists in the same location.");
    return;
  }

  folder.name = name;
  folder.updatedAt = Date.now();
  saveState();
  renderFolders();
  renderNotes();
}

function deleteFolder(folderId) {
  if (!stateReady) {
    return;
  }
  const folder = getFolderById(folderId);
  if (!folder) {
    return;
  }

  const confirmed = window.confirm(`Delete folder "${folder.name}"? Notes inside will be moved to Trash.`);
  if (!confirmed) {
    return;
  }

  const now = Date.now();
  const toDelete = new Set([folderId, ...getFolderDescendantIds(folderId)]);

  state.folders = state.folders.filter((item) => !toDelete.has(item.id));

  for (const note of state.notes) {
    if (note.folderId && toDelete.has(note.folderId)) {
      note.folderId = null;
      if (!note.deletedAt) {
        note.deletedAt = now;
      }
      note.updatedAt = now;
    }
  }

  for (const deletedId of toDelete) {
    expandedFolders.delete(deletedId);
  }

  if (selectedFolderId !== ROOT_FOLDER_ID && selectedFolderId !== TRASH_FOLDER_ID && !folderExists(selectedFolderId)) {
    selectedFolderId = ROOT_FOLDER_ID;
  }

  saveState();
  renderAll();
  ensureActiveNote();
}

function nextDefaultNoteTitle(folderId) {
  const inFolder = getActiveNotes().filter((note) => (note.folderId || null) === (folderId || null));
  const existing = new Set(inFolder.map((note) => note.title.toLowerCase()));

  let index = 1;
  while (index < 1000) {
    const title = index === 1 ? "New Note" : `New Note ${index}`;
    if (!existing.has(title.toLowerCase())) {
      return title;
    }
    index += 1;
  }

  return `Note ${Date.now()}`;
}

function normalizeNoteTitle(value) {
  const title = String(value || "").trim();
  return title || "Untitled";
}

function hasNoteTitleCollisionInFolder(title, folderId, excludeNoteId = null) {
  const normalizedTitle = normalizeNoteTitle(title).toLowerCase();
  const normalizedFolderId = folderId || null;

  return getActiveNotes().some((note) => {
    if (note.id === excludeNoteId) {
      return false;
    }
    if ((note.folderId || null) !== normalizedFolderId) {
      return false;
    }
    return note.title.toLowerCase() === normalizedTitle;
  });
}

function buildUniqueNoteTitleWithSuffix(baseTitle, folderId, excludeNoteId = null) {
  const normalizedBase = normalizeNoteTitle(baseTitle);

  let attempt = 0;
  while (attempt < 1000) {
    const candidate = `${normalizedBase}-${createRandomToken()}`;
    if (!hasNoteTitleCollisionInFolder(candidate, folderId, excludeNoteId)) {
      return candidate;
    }
    attempt += 1;
  }

  return `${normalizedBase}-${Date.now()}`;
}

function resolveUniqueNoteTitleWithPrompt(title, folderId, excludeNoteId = null) {
  let candidate = normalizeNoteTitle(title);

  while (hasNoteTitleCollisionInFolder(candidate, folderId, excludeNoteId)) {
    window.alert("A note with this name already exists in this folder. Please choose another name.");
    const nextValue = window.prompt("Note name", candidate);
    if (nextValue === null) {
      return buildUniqueNoteTitleWithSuffix(candidate, folderId, excludeNoteId);
    }
    candidate = normalizeNoteTitle(nextValue);
  }

  return candidate;
}

function commitActiveNoteTitleFromInput() {
  if (!stateReady) {
    return;
  }

  const note = getActiveNote();
  if (!note || selectedFolderId === TRASH_FOLDER_ID || isNoteInTrash(note)) {
    return;
  }
  if (titleInputNoteId !== note.id) {
    return;
  }

  const requestedTitle = normalizeNoteTitle(elements.noteTitleInput.value);
  const uniqueTitle = resolveUniqueNoteTitleWithPrompt(requestedTitle, note.folderId, note.id);

  if (uniqueTitle !== note.title) {
    note.title = uniqueTitle;
    note.updatedAt = Date.now();
    scheduleSaveIndicator("Saving...");
    renderNotes();
  }

  if (elements.noteTitleInput.value !== uniqueTitle) {
    elements.noteTitleInput.value = uniqueTitle;
  }
  titleInputNoteId = note.id;
}

function createNote() {
  if (!stateReady) {
    return;
  }
  if (selectedFolderId === TRASH_FOLDER_ID) {
    return;
  }
  commitActiveNoteTitleFromInput();
  commitActiveNoteContentFromEditor();

  const folderId = getSelectedParentFolderId();
  const title = nextDefaultNoteTitle(folderId);
  const now = Date.now();
  const note = {
    id: createId(),
    title,
    folderId,
    content: `# ${title}\n`,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  state.notes.push(note);
  saveState();
  renderAll();
  setActiveNote(note.id);
  elements.noteTitleInput.focus();
  elements.noteTitleInput.select();
}

function renameNote(noteId) {
  if (!stateReady) {
    return;
  }
  const note = state.notes.find((item) => item.id === noteId);
  if (!note || isNoteInTrash(note)) {
    return;
  }

  const value = window.prompt("Note name", note.title);
  if (value === null) {
    return;
  }

  const nextTitle = resolveUniqueNoteTitleWithPrompt(value, note.folderId, note.id);
  if (!nextTitle || nextTitle === note.title) {
    return;
  }

  note.title = nextTitle;
  note.updatedAt = Date.now();
  saveState();
  renderNotes();
  renderEditorHeader();
}

function moveNoteToTrash(noteId) {
  if (!stateReady) {
    return;
  }
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) {
    return;
  }

  const now = Date.now();
  note.deletedAt = now;
  note.updatedAt = now;
  saveState();
  renderAll();
  ensureActiveNote();
}

function restoreNoteFromTrash(noteId) {
  if (!stateReady) {
    return;
  }
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) {
    return;
  }

  note.deletedAt = null;
  note.updatedAt = Date.now();
  saveState();
  renderAll();
  ensureActiveNote();
}

function purgeNote(noteId) {
  if (!stateReady) {
    return;
  }
  state.notes = state.notes.filter((note) => note.id !== noteId);
  if (activeNoteId === noteId) {
    activeNoteId = null;
  }
  saveState();
  renderAll();
  ensureActiveNote();
}

function moveNoteToFolder(noteId, targetFolderId) {
  if (!stateReady) {
    return;
  }
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) {
    return;
  }

  const normalizedFolderId = targetFolderId || null;
  const wasDeleted = Boolean(note.deletedAt);
  if (note.folderId === normalizedFolderId && !wasDeleted) {
    return;
  }

  note.folderId = normalizedFolderId;
  note.deletedAt = null;
  note.updatedAt = Date.now();
  saveState();
  renderAll();
  ensureActiveNote();
}

function canMoveFolderToParent(folderId, newParentId) {
  if (!folderExists(folderId)) {
    return false;
  }

  if (newParentId == null) {
    return true;
  }

  if (!folderExists(newParentId)) {
    return false;
  }

  if (folderId === newParentId) {
    return false;
  }

  if (isFolderAncestor(folderId, newParentId)) {
    return false;
  }

  return true;
}

function moveFolder(folderId, targetParentId) {
  if (!stateReady) {
    return;
  }
  const folder = getFolderById(folderId);
  if (!folder) {
    return;
  }

  const normalizedParentId = targetParentId || null;
  if (!canMoveFolderToParent(folderId, normalizedParentId)) {
    return;
  }

  if ((folder.parentId || null) === normalizedParentId) {
    return;
  }

  folder.parentId = normalizedParentId;
  folder.updatedAt = Date.now();
  if (normalizedParentId) {
    expandedFolders.add(normalizedParentId);
  }

  saveState();
  renderAll();
  ensureActiveNote();
}

function toggleFolderExpanded(folderId) {
  if (!stateReady) {
    return;
  }
  if (!folderHasChildren(folderId)) {
    return;
  }

  if (expandedFolders.has(folderId)) {
    expandedFolders.delete(folderId);
  } else {
    expandedFolders.add(folderId);
  }

  saveState();
  renderFolders();
}

function handleEditorChange() {
  if (!stateReady) {
    return;
  }
  if (ignoreEditorChange) {
    return;
  }

  const note = getActiveNote();
  if (!note || selectedFolderId === TRASH_FOLDER_ID || isNoteInTrash(note)) {
    return;
  }

  note.content = editor.getMarkdown();
  note.updatedAt = Date.now();
  scheduleSaveIndicator("Saving...");
  renderNotes();
}

function formatUpdatedAt(timestamp) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatDeletedAt(timestamp) {
  if (!timestamp) {
    return "";
  }
  return `Deleted ${formatUpdatedAt(timestamp)}`;
}

function openContextMenu(items, x, y, target) {
  if (!items.length) {
    hideContextMenu();
    return;
  }

  contextMenuTarget = target;
  elements.contextMenu.innerHTML = items
    .map(
      (item) =>
        `<button class="context-menu-item ${item.danger ? "danger" : ""}" data-action="${item.action}" type="button">${escapeHtml(item.label)}</button>`,
    )
    .join("");

  elements.contextMenu.style.left = `${x}px`;
  elements.contextMenu.style.top = `${y}px`;
  elements.contextMenu.classList.add("is-open");
  elements.contextMenu.setAttribute("aria-hidden", "false");

  const rect = elements.contextMenu.getBoundingClientRect();
  const clampedX = Math.min(Math.max(8, x), window.innerWidth - rect.width - 8);
  const clampedY = Math.min(Math.max(8, y), window.innerHeight - rect.height - 8);

  elements.contextMenu.style.left = `${clampedX}px`;
  elements.contextMenu.style.top = `${clampedY}px`;
}

function hideContextMenu() {
  contextMenuTarget = null;
  elements.contextMenu.classList.remove("is-open");
  elements.contextMenu.setAttribute("aria-hidden", "true");
  elements.contextMenu.innerHTML = "";
}

function handleContextAction(action) {
  if (!contextMenuTarget) {
    return;
  }

  if (contextMenuTarget.type === "folder") {
    if (action === "rename-folder") {
      renameFolder(contextMenuTarget.id);
    }
    if (action === "delete-folder") {
      deleteFolder(contextMenuTarget.id);
    }
    return;
  }

  if (contextMenuTarget.type === "note") {
    if (action === "rename-note") {
      renameNote(contextMenuTarget.id);
    }
    if (action === "trash-note") {
      moveNoteToTrash(contextMenuTarget.id);
    }
    if (action === "restore-note") {
      restoreNoteFromTrash(contextMenuTarget.id);
    }
    if (action === "purge-note") {
      purgeNote(contextMenuTarget.id);
    }
  }
}

function selectorEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replace(/(["'\\.#:[\]()])/g, "\\$1");
}

function setDropTarget(folderId) {
  clearDropTarget();

  const dropEl = app.querySelector(`[data-drop-folder-id="${selectorEscape(folderId)}"]`);
  if (dropEl) {
    dropEl.classList.add("is-drop-target");
    dropTargetEl = dropEl;
  }
}

function clearDropTarget() {
  if (dropTargetEl) {
    dropTargetEl.classList.remove("is-drop-target");
    dropTargetEl = null;
  }
}

function clearDragState() {
  if (dragSourceEl) {
    dragSourceEl.classList.remove("is-dragging");
    dragSourceEl = null;
  }
  dragState = null;
  clearDropTarget();
}

function getDropFolderIdFromEventTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  const dropHost = target.closest("[data-drop-folder-id]");
  return dropHost ? dropHost.getAttribute("data-drop-folder-id") : null;
}

function canDropOnTarget(targetFolderId) {
  if (!dragState || !targetFolderId) {
    return false;
  }

  if (dragState.type === "note") {
    if (targetFolderId === TRASH_FOLDER_ID) {
      return true;
    }
    if (targetFolderId === ROOT_FOLDER_ID) {
      return true;
    }
    return folderExists(targetFolderId);
  }

  if (dragState.type === "folder") {
    if (targetFolderId === TRASH_FOLDER_ID) {
      return false;
    }
    const parentId = targetFolderId === ROOT_FOLDER_ID ? null : targetFolderId;
    return canMoveFolderToParent(dragState.id, parentId);
  }

  return false;
}

function applyDrop(targetFolderId) {
  if (!dragState) {
    return;
  }

  if (dragState.type === "note") {
    if (targetFolderId === TRASH_FOLDER_ID) {
      moveNoteToTrash(dragState.id);
      return;
    }

    const folderId = targetFolderId === ROOT_FOLDER_ID ? null : targetFolderId;
    moveNoteToFolder(dragState.id, folderId);
    return;
  }

  if (dragState.type === "folder") {
    const parentId = targetFolderId === ROOT_FOLDER_ID ? null : targetFolderId;
    moveFolder(dragState.id, parentId);
  }
}

function handleFolderDropZoneDragOver(event) {
  if (!dragState) {
    return;
  }

  const targetFolderId = getDropFolderIdFromEventTarget(event.target);
  if (!targetFolderId || !canDropOnTarget(targetFolderId)) {
    clearDropTarget();
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  setDropTarget(targetFolderId);
}

function handleFolderDropZoneDrop(event) {
  if (!dragState) {
    return;
  }

  const targetFolderId = getDropFolderIdFromEventTarget(event.target);
  if (!targetFolderId || !canDropOnTarget(targetFolderId)) {
    clearDragState();
    return;
  }

  event.preventDefault();
  applyDrop(targetFolderId);
  clearDragState();
}

function wireEvents() {
  elements.newFolderBtn.addEventListener("click", createFolder);
  elements.toggleFoldersBtn.addEventListener("click", toggleFoldersPanel);
  elements.newNoteBtn.addEventListener("click", createNote);

  elements.foldersResizer.addEventListener("mousedown", (event) => {
    startResize("folders", event);
  });

  elements.notesResizer.addEventListener("mousedown", (event) => {
    startResize("notes", event);
  });

  window.addEventListener("mousemove", handleResizeDrag);
  window.addEventListener("mouseup", stopResize);
  window.addEventListener("blur", stopResize);

  elements.folderList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const toggleBtn = target.closest('[data-action="toggle-folder"]');
    if (toggleBtn) {
      const folderId = toggleBtn.getAttribute("data-folder-id");
      if (folderId) {
        toggleFolderExpanded(folderId);
      }
      return;
    }

    const selectBtn = target.closest('[data-action="select-folder"]');
    if (!selectBtn) {
      return;
    }

    const folderId = selectBtn.getAttribute("data-folder-id");
    if (folderId) {
      selectFolder(folderId);
    }
  });

  elements.trashBtn.addEventListener("click", () => {
    selectFolder(TRASH_FOLDER_ID);
  });

  elements.noteList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const noteId =
      target.getAttribute("data-note-id") ||
      target.closest("[data-note-id]")?.getAttribute("data-note-id");
    if (!noteId || selectedFolderId === TRASH_FOLDER_ID) {
      return;
    }

    setActiveNote(noteId);
  });

  elements.noteTitleInput.addEventListener("blur", () => {
    commitActiveNoteTitleFromInput();
  });

  elements.noteTitleInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    commitActiveNoteTitleFromInput();
    elements.noteTitleInput.blur();
  });

  elements.folderList.addEventListener("contextmenu", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const folderRow = target.closest(".folder-row[data-folder-id]");
    if (!folderRow) {
      hideContextMenu();
      return;
    }

    const folderId = folderRow.getAttribute("data-folder-id");
    if (!folderId || !folderExists(folderId)) {
      hideContextMenu();
      return;
    }

    event.preventDefault();
    openContextMenu(
      [
        { label: "Rename", action: "rename-folder" },
        { label: "Delete", action: "delete-folder", danger: true },
      ],
      event.clientX,
      event.clientY,
      { type: "folder", id: folderId },
    );
  });

  elements.noteList.addEventListener("contextmenu", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const noteRow = target.closest(".note-row[data-note-id]");
    if (!noteRow) {
      hideContextMenu();
      return;
    }

    const noteId = noteRow.getAttribute("data-note-id");
    if (!noteId) {
      return;
    }

    event.preventDefault();

    if (selectedFolderId === TRASH_FOLDER_ID) {
      openContextMenu(
        [
          { label: "Restore", action: "restore-note" },
          { label: "Delete Permanently", action: "purge-note", danger: true },
        ],
        event.clientX,
        event.clientY,
        { type: "note", id: noteId },
      );
      return;
    }

    openContextMenu(
      [
        { label: "Rename", action: "rename-note" },
        { label: "Delete", action: "trash-note", danger: true },
      ],
      event.clientX,
      event.clientY,
      { type: "note", id: noteId },
    );
  });

  elements.contextMenu.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const action = target.getAttribute("data-action");
    if (!action) {
      return;
    }

    handleContextAction(action);
    hideContextMenu();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("#context-menu")) {
      return;
    }
    hideContextMenu();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideContextMenu();
    }
  });

  window.addEventListener("resize", () => {
    hideContextMenu();
    applyLayoutPrefs(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void syncStateFromServer({ force: true });
    }
  });

  window.addEventListener("focus", () => {
    void syncStateFromServer({ force: true });
  });

  elements.folderList.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const row = target.closest('.folder-row[data-draggable="folder"]');
    if (!row) {
      return;
    }

    const folderId = row.getAttribute("data-folder-id");
    if (!folderId) {
      return;
    }

    dragState = { type: "folder", id: folderId };
    dragSourceEl = row;
    row.classList.add("is-dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `folder:${folderId}`);
    }
  });

  elements.noteList.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const row = target.closest('.note-row[draggable="true"]');
    if (!row) {
      return;
    }

    const noteId = row.getAttribute("data-note-id");
    if (!noteId) {
      return;
    }

    dragState = { type: "note", id: noteId };
    dragSourceEl = row;
    row.classList.add("is-dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `note:${noteId}`);
    }
  });

  elements.folderList.addEventListener("dragover", handleFolderDropZoneDragOver);
  elements.trashBtn.addEventListener("dragover", handleFolderDropZoneDragOver);

  elements.folderList.addEventListener("drop", handleFolderDropZoneDrop);
  elements.trashBtn.addEventListener("drop", handleFolderDropZoneDrop);

  elements.folderList.addEventListener("dragend", clearDragState);
  elements.noteList.addEventListener("dragend", clearDragState);
  elements.trashBtn.addEventListener("dragend", clearDragState);

  elements.folderList.addEventListener("dragleave", (event) => {
    const related = event.relatedTarget;
    if (!(related instanceof Node) || !elements.folderList.contains(related)) {
      clearDropTarget();
    }
  });

  elements.trashBtn.addEventListener("dragleave", (event) => {
    const related = event.relatedTarget;
    if (!(related instanceof Node) || !elements.trashBtn.contains(related)) {
      clearDropTarget();
    }
  });

  window.addEventListener("beforeunload", () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    if (remoteSyncTimer) {
      clearInterval(remoteSyncTimer);
      remoteSyncTimer = null;
    }

    stopResize();
    persistLayoutPrefs();
    flushStateWithBeacon();
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
