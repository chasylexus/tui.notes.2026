import Editor from "@techie_doubts/tui.editor.2026";
import chart from "@techie_doubts/editor-plugin-chart";
import abcPlugin from "@techie_doubts/editor-plugin-abc";
import codeSyntaxHighlight from "@techie_doubts/editor-plugin-code-syntax-highlight";
import colorSyntax from "@techie_doubts/editor-plugin-color-syntax";
import exportPlugin from "@techie_doubts/editor-plugin-export";
import flowchartPlugin from "@techie_doubts/editor-plugin-flowchart";
import graphvizPlugin from "@techie_doubts/editor-plugin-graphviz";
import katexPlugin from "@techie_doubts/editor-plugin-katex";
import mermaidPlugin from "@techie_doubts/editor-plugin-mermaid";
import sequencePlugin from "@techie_doubts/editor-plugin-sequence";
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
const ME_API_ENDPOINT = "/api/me";
const CAPABILITIES_API_ENDPOINT = "/api/me/capabilities";
const EVENTS_API_ENDPOINT = "/api/events";
const MEDIA_UPLOAD_ENDPOINT = "/api/media/upload";
const MEDIA_FILE_ENDPOINT = "/api/media/file";
const NOTE_LINK_QUERY_PARAM = "note";
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
const REMOTE_EVENTS_RECONNECT_MS = 1500;
const AUDIO_EXTENSIONS = new Set([
  "m4a",
  "mp3",
  "wav",
  "ogg",
  "opus",
  "webm",
  "aac",
  "flac",
  "oga",
  "mp4",
]);
const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "mov",
  "m4v",
  "ogv",
  "avi",
  "mkv",
]);

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
  <div id="acl-modal" class="acl-modal" aria-hidden="true">
    <div class="acl-modal-backdrop" data-action="close-acl-modal"></div>
    <div class="acl-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="acl-modal-title">
      <div class="acl-modal-header">
        <h3 id="acl-modal-title">Access</h3>
      </div>
      <div class="acl-modal-body">
        <p id="acl-resource-label" class="acl-resource-label"></p>
        <label class="acl-field">
          <span>Action</span>
          <select id="acl-action-select">
            <option value="grant">Grant access</option>
            <option value="revoke">Revoke access</option>
          </select>
        </label>

        <div id="acl-grant-fields">
          <label class="acl-field">
            <span>Subject type</span>
            <select id="acl-subject-type">
              <option value="user">User</option>
              <option value="group">Group</option>
            </select>
          </label>
          <label class="acl-field">
            <span>Subject</span>
            <input id="acl-subject-id" type="text" placeholder="bob@example.com or group name" />
          </label>
          <label class="acl-field">
            <span>Role</span>
            <select id="acl-role-select">
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
              <option value="owner">owner</option>
            </select>
          </label>
          <label class="acl-field">
            <span>Propagation</span>
            <select id="acl-inherit-select">
              <option value="inherit">Apply to nested resources</option>
              <option value="direct">Only this resource</option>
            </select>
          </label>
        </div>

        <div id="acl-revoke-fields" hidden>
          <label class="acl-field">
            <span>Binding</span>
            <select id="acl-binding-select"></select>
          </label>
        </div>
      </div>
      <div class="acl-modal-actions">
        <button id="acl-cancel-btn" type="button">Cancel</button>
        <button id="acl-apply-btn" type="button">Apply</button>
      </div>
    </div>
  </div>
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
  aclModal: document.querySelector("#acl-modal"),
  aclResourceLabel: document.querySelector("#acl-resource-label"),
  aclActionSelect: document.querySelector("#acl-action-select"),
  aclGrantFields: document.querySelector("#acl-grant-fields"),
  aclRevokeFields: document.querySelector("#acl-revoke-fields"),
  aclSubjectType: document.querySelector("#acl-subject-type"),
  aclSubjectId: document.querySelector("#acl-subject-id"),
  aclRoleSelect: document.querySelector("#acl-role-select"),
  aclInheritSelect: document.querySelector("#acl-inherit-select"),
  aclBindingSelect: document.querySelector("#acl-binding-select"),
  aclCancelBtn: document.querySelector("#acl-cancel-btn"),
  aclApplyBtn: document.querySelector("#acl-apply-btn"),
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
let remoteEventsSource = null;
let remoteEventsReconnectTimer = null;
let pendingRemoteRevision = 0;
let lastSyncedSnapshot = null;
let authMode = "off";
let workspaceCapabilities = {
  canRead: true,
  canWrite: true,
  canManage: true,
};
let selectedFolderCapabilities = {
  canRead: true,
  canWrite: true,
  canManage: true,
};
let activeNoteCapabilities = {
  canRead: true,
  canWrite: true,
  canManage: true,
};
let aclDialogContext = null;
let aclDialogBindings = [];
let editorReadOnlyActive = false;

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

function isExternalUrl(value) {
  return /^(https?:)?\/\//i.test(String(value || "").trim());
}

function hasUriScheme(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(String(value || "").trim());
}

function isInlineRecorderSource(value) {
  return /^record:(?:\/\/)?audio(?:\?|$)/i.test(String(value || "").trim());
}

function encodePathForMarkdown(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    return encodeURI(decodeURI(raw));
  } catch (_error) {
    return encodeURI(raw);
  }
}

function normalizeInsertedMediaPath(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (isInlineRecorderSource(raw)) {
    if (raw.startsWith("record://")) {
      return raw;
    }
    if (raw.startsWith("record:/")) {
      return raw.replace(/^record:\//i, "record://");
    }
    return raw.replace(/^record:/i, "record://");
  }

  if (hasUriScheme(raw)) {
    return raw;
  }

  if (isExternalUrl(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }

  if (raw.startsWith("~/") || raw.startsWith("/")) {
    return encodePathForMarkdown(raw);
  }

  const normalized = raw.replaceAll("\\", "/");
  if (normalized.startsWith("~/")) {
    return normalized;
  }
  if (
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  ) {
    return encodePathForMarkdown(normalized);
  }

  return encodePathForMarkdown(`./${normalized}`);
}

function inferRuntimeMediaFileName(mediaPath, mediaKind = "") {
  const raw = String(mediaPath || "").trim().replaceAll("\\", "/");
  const kind = mediaKind === "audio" || mediaKind === "video" ? mediaKind : "";
  const fallback = kind === "audio" ? "audio.m4a" : kind === "video" ? "video.mp4" : "media";

  if (!raw) {
    return fallback;
  }

  const withoutQuery = raw.split(/[?#]/, 1)[0] || "";
  const candidate = withoutQuery.split("/").filter(Boolean).pop() || "";
  if (!candidate) {
    return fallback;
  }

  if (/\.[a-z0-9]+$/i.test(candidate)) {
    return candidate;
  }

  if (kind === "audio") {
    return `${candidate}.m4a`;
  }
  if (kind === "video") {
    return `${candidate}.mp4`;
  }

  return candidate;
}

function buildMediaRuntimeUrl(noteId, mediaPath, mediaKind = "") {
  if (!noteId) {
    return mediaPath;
  }
  const normalized = normalizeInsertedMediaPath(mediaPath);
  if (!normalized || isExternalUrl(normalized) || normalized.startsWith("data:") || normalized.startsWith("blob:")) {
    return normalized;
  }
  const kind = mediaKind === "audio" || mediaKind === "video" ? mediaKind : "";
  const runtimeFileName = encodeURIComponent(inferRuntimeMediaFileName(normalized, kind));
  const query = new URLSearchParams({
    noteId: String(noteId),
    path: normalized,
  });
  if (kind) {
    query.set("kind", kind);
  }
  return `${MEDIA_FILE_ENDPOINT}/${runtimeFileName}?${query.toString()}`;
}

function normalizeRuntimeMediaUrl(urlValue, fallbackNoteId = "") {
  const raw = String(urlValue || "").trim();
  if (!raw || !raw.startsWith(MEDIA_FILE_ENDPOINT)) {
    return raw;
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    if (!parsed.pathname.startsWith(MEDIA_FILE_ENDPOINT)) {
      return raw;
    }

    const pathParam = String(parsed.searchParams.get("path") || "").trim();
    if (!pathParam) {
      return raw;
    }

    const noteIdFromQuery = String(parsed.searchParams.get("noteId") || "").trim();
    const noteId = noteIdFromQuery || String(fallbackNoteId || "").trim();
    const kindFromQuery = String(parsed.searchParams.get("kind") || "").trim().toLowerCase();
    const kind = kindFromQuery === "audio" || kindFromQuery === "video" ? kindFromQuery : "";

    return buildMediaRuntimeUrl(noteId || null, pathParam, kind);
  } catch (_error) {
    return raw;
  }
}

function normalizeRuntimeMediaUrlsInMarkdown(markdown, noteId = "") {
  const source = String(markdown || "");
  if (
    !source ||
    (!source.includes(`${MEDIA_FILE_ENDPOINT}?`) && !source.includes(`${MEDIA_FILE_ENDPOINT}/`))
  ) {
    return source;
  }

  return source.replace(
    /\/api\/media\/file(?:\/[^)\s"'<>]*)?\?[^)\s"'<>]+/g,
    (match) => normalizeRuntimeMediaUrl(match, noteId),
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function uploadMediaBlobForActiveNote(blob, kind, fileName) {
  const note = getActiveNote();
  if (!note) {
    throw new Error("Open a note before inserting media.");
  }

  const query = new URLSearchParams({
    noteId: String(note.id),
    kind,
    fileName: fileName || "",
    mimeType: blob.type || "",
  });

  const response = await fetch(`${MEDIA_UPLOAD_ENDPOINT}?${query.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: blob,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.message) {
        message = payload.message;
      }
    } catch (_error) {
      // Ignore malformed error body.
    }
    throw new Error(message);
  }

  return response.json();
}

function getMediaKindFromBlob(blob) {
  const mimeType = String(blob?.type || "").toLowerCase();
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  const fileName = String(blob?.name || "").toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
  if (extension && AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }
  if (extension && VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  return "image";
}

function alertMediaUploadError(error) {
  const message = String(error?.message || "Failed to upload media.");
  const full = `Media insert failed: ${message}`;

  scheduleSaveIndicator("Save failed");
  try {
    window.alert(full);
  } catch (_error) {
    // Ignore alert failures in non-browser test environments.
  }
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

function normalizeCapabilitiesPayload(payload) {
  return {
    canRead: Boolean(payload?.canRead),
    canWrite: Boolean(payload?.canWrite),
    canManage: Boolean(payload?.canManage),
  };
}

function hasWritePermissionForSelectedFolder() {
  if (authMode === "off") {
    return true;
  }
  if (selectedFolderId === TRASH_FOLDER_ID) {
    return false;
  }
  if (selectedFolderId === ROOT_FOLDER_ID) {
    return Boolean(workspaceCapabilities.canWrite);
  }
  return Boolean(selectedFolderCapabilities.canWrite);
}

function hasWritePermissionForActiveNote() {
  if (authMode === "off") {
    return true;
  }
  return Boolean(activeNoteCapabilities.canWrite);
}

function getRequestedNoteIdFromUrl() {
  try {
    const url = new URL(window.location.href);
    const noteId = String(url.searchParams.get(NOTE_LINK_QUERY_PARAM) || "").trim();
    return noteId || null;
  } catch (_error) {
    return null;
  }
}

function updateNoteLinkInUrl(noteId) {
  try {
    const url = new URL(window.location.href);
    if (noteId) {
      url.searchParams.set(NOTE_LINK_QUERY_PARAM, String(noteId));
    } else {
      url.searchParams.delete(NOTE_LINK_QUERY_PARAM);
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  } catch (_error) {
    // Ignore URL rewrite errors.
  }
}

function buildShareLinkForNote(noteId) {
  const url = new URL(window.location.href);
  url.searchParams.set(NOTE_LINK_QUERY_PARAM, String(noteId));
  return url.toString();
}

async function copyShareLinkForNote(noteId) {
  const shareLink = buildShareLinkForNote(noteId);
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareLink);
    return;
  }
  window.prompt("Copy note link", shareLink);
}

function getEditorSurfaceElements() {
  const root = document.querySelector(".toastui-editor-defaultUI");
  const markdownTextarea = root?.querySelector(".toastui-editor-md-container .toastui-editor-md-textarea") || null;
  const wysiwygSurface = root?.querySelector(".toastui-editor-ww-container .ProseMirror") || null;
  return { root, markdownTextarea, wysiwygSurface };
}

function applyEditorReadOnlyState(readOnly) {
  editorReadOnlyActive = Boolean(readOnly);
  const { root, markdownTextarea, wysiwygSurface } = getEditorSurfaceElements();

  if (root instanceof HTMLElement) {
    root.classList.toggle("is-readonly", editorReadOnlyActive);
  }

  if (markdownTextarea instanceof HTMLTextAreaElement) {
    markdownTextarea.readOnly = editorReadOnlyActive;
  }

  if (wysiwygSurface instanceof HTMLElement) {
    wysiwygSurface.setAttribute("contenteditable", editorReadOnlyActive ? "false" : "true");
  }
}

function applyAccessUiState() {
  const canWriteFolder = hasWritePermissionForSelectedFolder();
  const canWriteNote = hasWritePermissionForActiveNote();

  elements.newFolderBtn.disabled = !canWriteFolder;
  elements.newNoteBtn.disabled = selectedFolderId === TRASH_FOLDER_ID || !canWriteFolder;

  const note = getActiveNote();
  const editable =
    Boolean(note) &&
    selectedFolderId !== TRASH_FOLDER_ID &&
    !isNoteInTrash(note) &&
    canWriteNote;

  elements.noteTitleInput.readOnly = !editable;
  elements.noteTitleInput.classList.toggle("is-readonly", !editable);
  applyEditorReadOnlyState(!editable);

  const toolbar = document.querySelector(".toastui-editor-toolbar");
  if (toolbar instanceof HTMLElement) {
    toolbar.classList.toggle("is-readonly", !editable);
  }

  if (authMode !== "off" && !editable) {
    elements.saveIndicator.textContent = "Read-only";
  }
}

async function refreshViewerContext() {
  try {
    const payload = await apiRequest(ME_API_ENDPOINT);
    authMode = String(payload?.authMode || "off");
    workspaceCapabilities = normalizeCapabilitiesPayload(payload?.workspace);
  } catch (error) {
    if (Number(error?.status) === 401 || Number(error?.status) === 403) {
      authMode = "enforce";
      workspaceCapabilities = { canRead: false, canWrite: false, canManage: false };
      return;
    }
    throw error;
  }
}

async function fetchCapabilities(resourceType, externalId) {
  const query = new URLSearchParams({
    type: resourceType,
    externalId: String(externalId),
  });
  const payload = await apiRequest(`${CAPABILITIES_API_ENDPOINT}?${query.toString()}`);
  return normalizeCapabilitiesPayload(payload);
}

function normalizeAclSubjectInput(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return null;
  }
  if (raw === "*" || raw.toLowerCase() === "public:*") {
    return { subjectType: "public", subjectId: "*" };
  }

  const colonIndex = raw.indexOf(":");
  if (colonIndex <= 0) {
    return {
      subjectType: "user",
      subjectId: raw.toLowerCase(),
    };
  }

  const subjectType = raw.slice(0, colonIndex).trim().toLowerCase();
  const subjectId = raw.slice(colonIndex + 1).trim();
  if (!subjectType || !subjectId) {
    return null;
  }
  if (!["user", "group", "public"].includes(subjectType)) {
    return null;
  }
  if (subjectType === "public") {
    return { subjectType, subjectId: "*" };
  }
  return {
    subjectType,
    subjectId: subjectType === "user" ? subjectId.toLowerCase() : subjectId,
  };
}

function normalizeAclRoleInput(rawValue) {
  const role = String(rawValue || "").trim().toLowerCase();
  if (role === "viewer" || role === "editor" || role === "owner") {
    return role;
  }
  return null;
}

async function fetchAclBindings(resourceType, resourceExternalId) {
  const safeType = encodeURIComponent(String(resourceType || ""));
  const safeId = encodeURIComponent(String(resourceExternalId || ""));
  const payload = await apiRequest(`/api/acl/resource/${safeType}/${safeId}`);
  return Array.isArray(payload?.bindings) ? payload.bindings : [];
}

async function grantAclBinding(binding) {
  return apiRequest("/api/acl/grant", {
    method: "POST",
    body: JSON.stringify(binding),
  });
}

async function revokeAclBinding(bindingId) {
  const safeId = encodeURIComponent(String(bindingId || ""));
  return apiRequest(`/api/acl/grant/${safeId}`, {
    method: "DELETE",
  });
}

function formatAclBindingLine(binding, index) {
  const inheritLabel = binding?.inherit === false ? "direct only" : "inherit";
  return `${index + 1}. ${binding.subjectType}:${binding.subjectId} -> ${binding.role} (${inheritLabel}) [${binding.id}]`;
}

function renderAclBindingOptions() {
  if (!(elements.aclBindingSelect instanceof HTMLSelectElement)) {
    return;
  }

  const options = aclDialogBindings.map((binding, index) => {
    const label = formatAclBindingLine(binding, index);
    return `<option value="${escapeHtml(binding.id)}">${escapeHtml(label)}</option>`;
  });

  if (!options.length) {
    options.push('<option value="">No bindings available</option>');
  }

  elements.aclBindingSelect.innerHTML = options.join("");
}

function updateAclDialogSections() {
  if (!aclDialogContext) {
    return;
  }

  const action = String(elements.aclActionSelect?.value || "grant");
  const revokeMode = action === "revoke";
  elements.aclGrantFields.hidden = revokeMode;
  elements.aclRevokeFields.hidden = !revokeMode;
  elements.aclApplyBtn.textContent = revokeMode ? "Remove" : "Apply";
  elements.aclApplyBtn.disabled = revokeMode && !aclDialogBindings.length;
}

function closeAclDialog() {
  aclDialogContext = null;
  aclDialogBindings = [];
  elements.aclModal.setAttribute("aria-hidden", "true");
  elements.aclModal.classList.remove("is-open");
}

async function openAclDialog(resourceType, resourceExternalId, resourceLabel) {
  if (authMode === "off") {
    window.alert("Access control is disabled.");
    return;
  }

  const capabilities = await fetchCapabilities(resourceType, resourceExternalId);
  if (!capabilities.canManage) {
    window.alert("You do not have permission to manage access for this resource.");
    return;
  }

  aclDialogContext = { resourceType, resourceExternalId, resourceLabel };
  aclDialogBindings = await fetchAclBindings(resourceType, resourceExternalId);

  elements.aclResourceLabel.textContent = resourceLabel;
  elements.aclActionSelect.value = "grant";
  elements.aclSubjectType.value = "user";
  elements.aclSubjectId.value = "";
  elements.aclRoleSelect.value = "viewer";
  elements.aclInheritSelect.value = resourceType === "note" ? "direct" : "inherit";
  renderAclBindingOptions();
  updateAclDialogSections();

  elements.aclModal.setAttribute("aria-hidden", "false");
  elements.aclModal.classList.add("is-open");
  elements.aclSubjectId.focus();
}

async function applyAclDialog() {
  if (!aclDialogContext) {
    return;
  }

  const action = String(elements.aclActionSelect?.value || "grant");
  if (action === "revoke") {
    const bindingId = String(elements.aclBindingSelect?.value || "").trim();
    if (!bindingId) {
      window.alert("Select a binding to remove.");
      return;
    }
    await revokeAclBinding(bindingId);
  } else {
    const subjectType = String(elements.aclSubjectType?.value || "user").trim().toLowerCase();
    const subjectIdRaw = String(elements.aclSubjectId?.value || "").trim();
    const role = normalizeAclRoleInput(elements.aclRoleSelect?.value || "");
    const inherit = String(elements.aclInheritSelect?.value || "inherit") !== "direct";

    if (!["user", "group", "public"].includes(subjectType)) {
      window.alert("Unsupported subject type.");
      return;
    }
    if (!subjectIdRaw) {
      window.alert("Subject is required.");
      return;
    }
    if (!role) {
      window.alert("Role is required.");
      return;
    }

    const normalizedSubject = normalizeAclSubjectInput(`${subjectType}:${subjectIdRaw}`);
    if (!normalizedSubject) {
      window.alert("Invalid subject.");
      return;
    }

    await grantAclBinding({
      resourceType: aclDialogContext.resourceType,
      resourceExternalId: aclDialogContext.resourceExternalId,
      subjectType: normalizedSubject.subjectType,
      subjectId: normalizedSubject.subjectId,
      role,
      inherit,
    });
  }

  closeAclDialog();
  await refreshViewerContext();
  await refreshCapabilitiesForSelection();
  await syncStateFromServer({ force: true, bypassDeferral: true });
}

async function refreshCapabilitiesForSelection() {
  if (authMode === "off") {
    selectedFolderCapabilities = { canRead: true, canWrite: true, canManage: true };
    activeNoteCapabilities = { canRead: true, canWrite: true, canManage: true };
    applyAccessUiState();
    return;
  }

  try {
    if (selectedFolderId && selectedFolderId !== ROOT_FOLDER_ID && selectedFolderId !== TRASH_FOLDER_ID) {
      selectedFolderCapabilities = await fetchCapabilities("folder", selectedFolderId);
    } else {
      selectedFolderCapabilities = { ...workspaceCapabilities };
    }
  } catch (error) {
    selectedFolderCapabilities = { canRead: false, canWrite: false, canManage: false };
    console.error("[tui.notes.2026] failed to refresh folder capabilities", error);
  }

  const note = getActiveNote();
  if (!note) {
    activeNoteCapabilities = { ...selectedFolderCapabilities };
    applyAccessUiState();
    return;
  }

  try {
    activeNoteCapabilities = await fetchCapabilities("note", note.id);
  } catch (error) {
    activeNoteCapabilities = { canRead: false, canWrite: false, canManage: false };
    console.error("[tui.notes.2026] failed to refresh note capabilities", error);
  }
  applyAccessUiState();
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
  for (const note of state.notes) {
    if (!note || typeof note !== "object") {
      continue;
    }
    note.content = normalizeRuntimeMediaUrlsInMarkdown(note.content, note.id);
  }
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

function cloneStateSnapshot(snapshot) {
  return {
    folders: Array.isArray(snapshot?.folders)
      ? snapshot.folders.map((folder) => ({ ...folder }))
      : [],
    notes: Array.isArray(snapshot?.notes) ? snapshot.notes.map((note) => ({ ...note })) : [],
    ui:
      snapshot?.ui && typeof snapshot.ui === "object"
        ? {
          expandedFolderIds: Array.isArray(snapshot.ui.expandedFolderIds)
            ? [...snapshot.ui.expandedFolderIds]
            : [],
        }
        : { expandedFolderIds: [] },
  };
}

function createSnapshotFromPayload(payload) {
  return cloneStateSnapshot({
    folders: Array.isArray(payload?.folders) ? payload.folders : [],
    notes: Array.isArray(payload?.notes) ? payload.notes : [],
    ui: payload?.ui && typeof payload.ui === "object" ? payload.ui : {},
  });
}

function updateLastSyncedSnapshot(payload) {
  lastSyncedSnapshot = createSnapshotFromPayload(payload);
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

function mergeScalarConflictValue(baseValue, localValue, remoteValue, { preferLocal }) {
  if (Object.is(localValue, remoteValue)) {
    return localValue;
  }
  const localChanged = !Object.is(localValue, baseValue);
  const remoteChanged = !Object.is(remoteValue, baseValue);

  if (localChanged && !remoteChanged) {
    return localValue;
  }
  if (!localChanged && remoteChanged) {
    return remoteValue;
  }
  if (!localChanged && !remoteChanged) {
    return remoteValue;
  }
  return preferLocal ? localValue : remoteValue;
}

function getSingleReplaceDelta(baseText, nextText) {
  if (baseText === nextText) {
    return null;
  }

  let start = 0;
  while (
    start < baseText.length &&
    start < nextText.length &&
    baseText.charCodeAt(start) === nextText.charCodeAt(start)
  ) {
    start += 1;
  }

  let endBase = baseText.length;
  let endNext = nextText.length;
  while (
    endBase > start &&
    endNext > start &&
    baseText.charCodeAt(endBase - 1) === nextText.charCodeAt(endNext - 1)
  ) {
    endBase -= 1;
    endNext -= 1;
  }

  return {
    start,
    end: endBase,
    insert: nextText.slice(start, endNext),
  };
}

function applySingleReplaceDelta(baseText, delta) {
  if (!delta) {
    return baseText;
  }
  return `${baseText.slice(0, delta.start)}${delta.insert}${baseText.slice(delta.end)}`;
}

function tryMergeSingleReplaceDeltas(baseText, localDelta, remoteDelta) {
  if (!localDelta || !remoteDelta) {
    return null;
  }

  const localPureInsert = localDelta.start === localDelta.end;
  const remotePureInsert = remoteDelta.start === remoteDelta.end;
  if (
    localPureInsert &&
    remotePureInsert &&
    localDelta.start === remoteDelta.start &&
    localDelta.insert !== remoteDelta.insert
  ) {
    return `${baseText.slice(0, localDelta.start)}${localDelta.insert}${remoteDelta.insert}${baseText.slice(localDelta.end)}`;
  }

  const localEndsBeforeRemote = localDelta.end <= remoteDelta.start;
  const remoteEndsBeforeLocal = remoteDelta.end <= localDelta.start;
  if (!localEndsBeforeRemote && !remoteEndsBeforeLocal) {
    return null;
  }

  const ordered = localEndsBeforeRemote
    ? [
      { ...localDelta, source: "local" },
      { ...remoteDelta, source: "remote" },
    ]
    : [
      { ...remoteDelta, source: "remote" },
      { ...localDelta, source: "local" },
    ];

  let merged = applySingleReplaceDelta(baseText, ordered[0]);
  const firstDeltaLength = ordered[0].insert.length - (ordered[0].end - ordered[0].start);
  const second = {
    ...ordered[1],
    start: ordered[1].start + firstDeltaLength,
    end: ordered[1].end + firstDeltaLength,
  };
  merged = applySingleReplaceDelta(merged, second);
  return merged;
}

function mergeNoteContent(baseContent, localContent, remoteContent, { preferLocal }) {
  const baseText = typeof baseContent === "string" ? baseContent : "";
  const localText = typeof localContent === "string" ? localContent : "";
  const remoteText = typeof remoteContent === "string" ? remoteContent : "";

  if (localText === remoteText) {
    return localText;
  }
  if (localText === baseText) {
    return remoteText;
  }
  if (remoteText === baseText) {
    return localText;
  }

  const localDelta = getSingleReplaceDelta(baseText, localText);
  const remoteDelta = getSingleReplaceDelta(baseText, remoteText);
  const merged = tryMergeSingleReplaceDeltas(baseText, localDelta, remoteDelta);
  if (typeof merged === "string") {
    return merged;
  }

  return preferLocal ? localText : remoteText;
}

function mergeConflictNote(baseNote, localNote, remoteNote) {
  const localTimestamp = getNoteTimestamp(localNote);
  const remoteTimestamp = getNoteTimestamp(remoteNote);
  const preferLocal = localTimestamp >= remoteTimestamp;

  const baseContent = baseNote?.content || "";
  const baseTitle = baseNote?.title ?? "Untitled";
  const baseFolderId = baseNote?.folderId ?? null;
  const baseDeletedAt = baseNote?.deletedAt ?? null;
  const baseFileName = baseNote?.fileName ?? `${localNote?.id || remoteNote?.id || "note"}.md`;

  const merged = cloneConflictEntity(preferLocal ? localNote : remoteNote) || {};
  merged.id = String(localNote?.id || remoteNote?.id || merged.id || "");
  merged.title = mergeScalarConflictValue(
    baseTitle,
    localNote?.title ?? "Untitled",
    remoteNote?.title ?? "Untitled",
    { preferLocal },
  );
  merged.folderId = mergeScalarConflictValue(
    baseFolderId,
    localNote?.folderId ?? null,
    remoteNote?.folderId ?? null,
    { preferLocal },
  );
  merged.deletedAt = mergeScalarConflictValue(
    baseDeletedAt,
    localNote?.deletedAt ?? null,
    remoteNote?.deletedAt ?? null,
    { preferLocal },
  );
  merged.fileName = mergeScalarConflictValue(
    baseFileName,
    localNote?.fileName ?? `${merged.id}.md`,
    remoteNote?.fileName ?? `${merged.id}.md`,
    { preferLocal },
  );
  merged.content = mergeNoteContent(
    baseContent,
    localNote?.content || "",
    remoteNote?.content || "",
    { preferLocal },
  );
  merged.createdAt =
    Number(localNote?.createdAt) || Number(remoteNote?.createdAt) || Number(baseNote?.createdAt) || Date.now();
  merged.updatedAt = Math.max(
    localTimestamp,
    remoteTimestamp,
    Number(merged.updatedAt) || 0,
    merged.content !== (baseNote?.content || "") ? Date.now() : 0,
  );

  return merged;
}

function mergeConflictPayload(baseSnapshot, localSnapshot, remotePayload) {
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

  const baseNoteById = new Map();
  for (const note of baseSnapshot?.notes || []) {
    if (!note?.id) {
      continue;
    }
    baseNoteById.set(String(note.id), cloneConflictEntity(note));
  }

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
    if (!remoteNote) {
      noteById.set(noteId, cloneConflictEntity(note));
      continue;
    }

    const baseNote = baseNoteById.get(noteId);
    noteById.set(noteId, mergeConflictNote(baseNote, note, remoteNote));
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

function preventReadOnlyEditorMutation(event) {
  if (!editorReadOnlyActive) {
    return;
  }
  const target = event.target;
  if (!(target instanceof Element) || !target.closest(".toastui-editor-defaultUI")) {
    return;
  }

  if (event.type === "keydown") {
    const keyboardEvent = event;
    if (keyboardEvent.metaKey || keyboardEvent.ctrlKey || keyboardEvent.altKey) {
      return;
    }

    const navigationKeys = new Set([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      "Escape",
      "Tab",
    ]);
    if (navigationKeys.has(keyboardEvent.key)) {
      return;
    }
  }

  event.preventDefault();
  event.stopPropagation();
}

function commitActiveNoteContentFromEditor() {
  if (!stateReady || ignoreEditorChange) {
    return;
  }
  if (!hasWritePermissionForActiveNote()) {
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

  const normalizedMarkdown = normalizeRuntimeMediaUrlsInMarkdown(markdown, note.id);
  if (normalizedMarkdown !== note.content) {
    note.content = normalizedMarkdown;
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

function applyRemoteState(payload, { refreshEditor = true, trackAsSynced = true } = {}) {
  const previousActiveNoteId = activeNoteId;
  const previousActiveContent = getActiveNote()?.content || "";
  const preferredFolderId = selectedFolderId;

  applyStatePayload(payload);
  updateServerRevision(payload);
  if (serverRevision >= pendingRemoteRevision) {
    pendingRemoteRevision = 0;
  }
  if (trackAsSynced) {
    updateLastSyncedSnapshot(payload);
  }

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

  void refreshCapabilitiesForSelection();
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
        updateLastSyncedSnapshot(response);
        if (serverRevision >= pendingRemoteRevision) {
          pendingRemoteRevision = 0;
        }
      } catch (error) {
        const isConflict =
          Number(error?.status) === 409 &&
          error?.payload &&
          typeof error.payload === "object" &&
          error.payload.state;

        if (!isConflict) {
          throw error;
        }

        const mergedState = mergeConflictPayload(lastSyncedSnapshot, snapshot, error.payload.state);
        applyRemoteState({
          ...mergedState,
          _meta: error.payload.state?._meta,
        }, { trackAsSynced: false });
        persistQueued = true;
      }
    } while (persistQueued);

    elements.saveIndicator.textContent = "Saved";
  } catch (error) {
    console.error("[tui.notes.2026] save failed", error);
    if (Number(error?.status) === 401 || Number(error?.status) === 403) {
      elements.saveIndicator.textContent = "Read-only";
      await refreshViewerContext().catch(() => {});
      await refreshCapabilitiesForSelection().catch(() => {});
    } else {
      elements.saveIndicator.textContent = "Save failed";
    }
  } finally {
    persistInFlight = false;
  }
}

async function bootstrapState() {
  elements.saveIndicator.textContent = "Syncing...";
  try {
    await refreshViewerContext();
  } catch (error) {
    console.error("[tui.notes.2026] viewer context bootstrap failed", error);
  }

  try {
    const remoteState = await apiRequest(STATE_API_ENDPOINT);
    applyRemoteState(remoteState, { refreshEditor: false });
  } catch (error) {
    if (Number(error?.status) === 401 || Number(error?.status) === 403) {
      console.error("[tui.notes.2026] access denied while bootstrapping state", error);
      stateReady = true;
      applyStatePayload({ folders: [], notes: [], ui: { expandedFolderIds: [] } });
      renderAll();
      ensureActiveNote();
      elements.saveIndicator.textContent = "Access denied";
      startRemoteEventsStream();
      return;
    }

    console.error("[tui.notes.2026] bootstrap failed, seeding default state", error);
    const defaultState = createDefaultState();
    applyStatePayload(defaultState);
    updateLastSyncedSnapshot(defaultState);
    saveState();
  }

  stateReady = true;
  renderAll();
  ensureActiveNote();
  const requestedNoteId = getRequestedNoteIdFromUrl();
  if (requestedNoteId) {
    setActiveNote(requestedNoteId);
  }
  await refreshCapabilitiesForSelection();
  if (authMode !== "off" && !hasWritePermissionForActiveNote()) {
    elements.saveIndicator.textContent = "Read-only";
  } else {
    elements.saveIndicator.textContent = "Saved";
  }
  startRemoteSyncLoop();
  startRemoteEventsStream();
}

function startRemoteSyncLoop() {
  if (remoteSyncTimer) {
    clearInterval(remoteSyncTimer);
  }
  remoteSyncTimer = window.setInterval(() => {
    void syncStateFromServer();
  }, REMOTE_SYNC_INTERVAL_MS);
}

function stopRemoteEventsStream() {
  if (remoteEventsReconnectTimer) {
    clearTimeout(remoteEventsReconnectTimer);
    remoteEventsReconnectTimer = null;
  }
  if (remoteEventsSource) {
    remoteEventsSource.close();
    remoteEventsSource = null;
  }
}

function scheduleRemoteEventsReconnect() {
  if (remoteEventsReconnectTimer) {
    return;
  }
  remoteEventsReconnectTimer = window.setTimeout(() => {
    remoteEventsReconnectTimer = null;
    startRemoteEventsStream();
  }, REMOTE_EVENTS_RECONNECT_MS);
}

function handleRemoteEventPayload(rawData, eventName = "") {
  if (typeof rawData !== "string" || !rawData.trim()) {
    return;
  }

  let payload = null;
  try {
    payload = JSON.parse(rawData);
  } catch (_error) {
    return;
  }

  if (eventName === "permissions-changed") {
    void refreshViewerContext().catch((error) => {
      console.error("[tui.notes.2026] failed to refresh viewer context after permission update", error);
    });
    void refreshCapabilitiesForSelection().catch((error) => {
      console.error("[tui.notes.2026] failed to refresh capabilities after permission update", error);
    });
    void syncStateFromServer({ force: true, bypassDeferral: true });
    return;
  }

  const revision = Number(payload?.revision);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    return;
  }

  if (revision <= serverRevision) {
    return;
  }

  pendingRemoteRevision = Math.max(pendingRemoteRevision, revision);
  void syncStateFromServer({ force: true, minRevision: pendingRemoteRevision });
}

function startRemoteEventsStream() {
  if (typeof EventSource !== "function") {
    return;
  }
  if (remoteEventsSource) {
    return;
  }

  try {
    const source = new EventSource(EVENTS_API_ENDPOINT);
    remoteEventsSource = source;

    source.addEventListener("connected", (event) => {
      handleRemoteEventPayload(event?.data, "connected");
    });
    source.addEventListener("state-updated", (event) => {
      handleRemoteEventPayload(event?.data, "state-updated");
    });
    source.addEventListener("permissions-changed", (event) => {
      handleRemoteEventPayload(event?.data, "permissions-changed");
    });
    source.onerror = () => {
      if (remoteEventsSource === source) {
        stopRemoteEventsStream();
        scheduleRemoteEventsReconnect();
      }
    };
  } catch (error) {
    console.error("[tui.notes.2026] failed to start SSE stream", error);
    scheduleRemoteEventsReconnect();
  }
}

async function syncStateFromServer({ force = false, minRevision = 0, bypassDeferral = false } = {}) {
  if (!stateReady) {
    return;
  }
  if (remoteSyncInFlight) {
    return;
  }
  if (!force && document.hidden) {
    return;
  }
  if (!bypassDeferral && shouldDeferRemoteApply()) {
    return;
  }

  remoteSyncInFlight = true;
  try {
    const remoteState = await apiRequest(STATE_API_ENDPOINT);
    const remoteRevision = getPayloadRevision(remoteState);
    const requiredRevision = Math.max(
      Number.isSafeInteger(Number(minRevision)) ? Number(minRevision) : 0,
      pendingRemoteRevision,
    );
    if (remoteRevision <= serverRevision && requiredRevision <= serverRevision) {
      updateServerRevision(remoteState);
      return;
    }
    if (remoteRevision <= serverRevision && requiredRevision > serverRevision) {
      return;
    }
    if (!bypassDeferral && shouldDeferRemoteApply()) {
      return;
    }
    applyRemoteState(remoteState);
    if (remoteRevision >= pendingRemoteRevision) {
      pendingRemoteRevision = 0;
    }
  } catch (error) {
    console.error("[tui.notes.2026] remote sync failed", error);
    if (Number(error?.status) === 401 || Number(error?.status) === 403) {
      elements.saveIndicator.textContent = "Access denied";
      await refreshViewerContext().catch(() => {});
      await refreshCapabilitiesForSelection().catch(() => {});
    }
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
    hooks: {
      addImageBlobHook: async (blob, callback) => {
        const kind = getMediaKindFromBlob(blob);
        const fileName = String(blob?.name || kind || "media").trim() || "media";

        if (kind === "image") {
          const dataUrl = await readFileAsDataUrl(blob);
          callback(dataUrl, fileName);
          return;
        }

        try {
          const payload = await uploadMediaBlobForActiveNote(blob, kind, fileName);
          const relativePath = String(payload?.relativePath || "").trim();

          if (!relativePath) {
            throw new Error("Upload did not return media path.");
          }

          callback(relativePath, fileName);
        } catch (error) {
          alertMediaUploadError(error);
        }
      },
      resolveMediaPath: (source, mediaType) => {
        const normalized = normalizeInsertedMediaPath(source);
        if (
          !normalized ||
          isInlineRecorderSource(normalized) ||
          normalized.startsWith(`${MEDIA_FILE_ENDPOINT}?`) ||
          normalized.startsWith(`${MEDIA_FILE_ENDPOINT}/`) ||
          mediaType === "embed" ||
          hasUriScheme(normalized) ||
          isExternalUrl(normalized) ||
          normalized.startsWith("data:") ||
          normalized.startsWith("blob:")
        ) {
          return normalized;
        }

        const note = getActiveNote();
        const kind = mediaType === "audio" || mediaType === "video" ? mediaType : "";
        return buildMediaRuntimeUrl(note?.id || null, normalized, kind);
      },
    },
    plugins: [
      [chart, chartPluginOptions],
      [codeSyntaxHighlight, { highlighter: Prism }],
      colorSyntax,
      tableMergedCell,
      uml,
      sequencePlugin,
      mermaidPlugin,
      flowchartPlugin,
      graphvizPlugin,
      abcPlugin,
      katexPlugin,
      [exportPlugin, { toolbarGroupIndex: 99, toolbarItemIndex: 1 }],
    ],
    events: {
      change: handleEditorChange,
    },
  });
  ensureMediaToolbarButton(editor);
  installThemeControl(editor, media);
  if (typeof editor.on === "function") {
    editor.on("changeMode", () => {
      applyAccessUiState();
    });
  }
}

function ensureMediaToolbarButton(editorInstance) {
  const hasMediaButton = () =>
    Boolean(
      document.querySelector(
        '.toastui-editor-toolbar-icons.image, [aria-label="Insert media"], [aria-label="Insert image"]',
      ),
    );

  const insertMediaButton = () => {
    if (hasMediaButton()) {
      return;
    }
    try {
      editorInstance.insertToolbarItem({ groupIndex: 3, itemIndex: 1 }, "image");
    } catch (error) {
      console.error("[tui.notes.2026] failed to insert media toolbar button", error);
    }
  };

  insertMediaButton();
  requestAnimationFrame(insertMediaButton);
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
    applyAccessUiState();
    return;
  }

  elements.noteTitleInput.disabled = false;
  elements.noteTitleInput.value = note.title;
  titleInputNoteId = note.id;
  applyAccessUiState();
}

function clearEditorSelection() {
  activeNoteId = null;
  updateNoteLinkInUrl(null);
  ignoreEditorChange = true;
  editor.setMarkdown("");
  resetEditorUndoRedoHistory();
  ignoreEditorChange = false;
  renderEditorHeader();
  void refreshCapabilitiesForSelection();
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
    void refreshCapabilitiesForSelection();
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
  updateNoteLinkInUrl(note.id);
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
  void refreshCapabilitiesForSelection();
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
  void refreshCapabilitiesForSelection();
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
  if (!hasWritePermissionForSelectedFolder()) {
    window.alert("You do not have permission to create folders here.");
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
  if (authMode !== "off" && !selectedFolderCapabilities.canWrite && selectedFolderId === folderId) {
    window.alert("You do not have permission to rename this folder.");
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
  if (authMode !== "off" && !selectedFolderCapabilities.canWrite && selectedFolderId === folderId) {
    window.alert("You do not have permission to delete this folder.");
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
  if (!hasWritePermissionForActiveNote()) {
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
  if (!hasWritePermissionForSelectedFolder()) {
    window.alert("You do not have permission to create notes in this folder.");
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
  if (!hasWritePermissionForActiveNote() && noteId === activeNoteId) {
    window.alert("You do not have permission to rename this note.");
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
  if (!hasWritePermissionForActiveNote() && noteId === activeNoteId) {
    window.alert("You do not have permission to delete this note.");
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
  if (!hasWritePermissionForActiveNote() && noteId === activeNoteId) {
    window.alert("You do not have permission to restore this note.");
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
  if (!hasWritePermissionForActiveNote() && noteId === activeNoteId) {
    window.alert("You do not have permission to remove this note.");
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
  if (!hasWritePermissionForActiveNote() && noteId === activeNoteId) {
    window.alert("You do not have permission to move this note.");
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
  if (authMode !== "off" && !selectedFolderCapabilities.canWrite && selectedFolderId === folderId) {
    window.alert("You do not have permission to move this folder.");
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

  let markdown = editor.getMarkdown();
  const normalizedMarkdown = normalizeRuntimeMediaUrlsInMarkdown(markdown, note.id);

  if (normalizedMarkdown !== markdown && editor.isMarkdownMode()) {
    ignoreEditorChange = true;
    try {
      editor.setMarkdown(normalizedMarkdown, false, false, true);
    } catch (error) {
      console.error("[tui.notes.2026] failed to normalize runtime media url", error);
    } finally {
      ignoreEditorChange = false;
    }
    markdown = normalizedMarkdown;
  } else {
    markdown = normalizedMarkdown;
  }

  note.content = markdown;
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
    const folder = getFolderById(contextMenuTarget.id);
    if (action === "rename-folder") {
      renameFolder(contextMenuTarget.id);
    }
    if (action === "delete-folder") {
      deleteFolder(contextMenuTarget.id);
    }
    if (action === "acl-folder") {
      void openAclDialog(
        "folder",
        contextMenuTarget.id,
        folder ? `Folder "${folder.name}"` : `Folder ${contextMenuTarget.id}`,
      ).catch((error) => {
        console.error("[tui.notes.2026] failed to manage folder ACL", error);
        window.alert(error?.message || "Failed to update folder access.");
      });
    }
    return;
  }

  if (contextMenuTarget.type === "note") {
    const note = state.notes.find((item) => item.id === contextMenuTarget.id) || null;
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
    if (action === "acl-note") {
      void openAclDialog(
        "note",
        contextMenuTarget.id,
        note ? `Note "${note.title}"` : `Note ${contextMenuTarget.id}`,
      ).catch((error) => {
        console.error("[tui.notes.2026] failed to manage note ACL", error);
        window.alert(error?.message || "Failed to update note access.");
      });
    }
    if (action === "copy-note-link") {
      if (!note) {
        return;
      }
      void copyShareLinkForNote(note.id).catch((error) => {
        console.error("[tui.notes.2026] failed to copy note link", error);
        window.alert(error?.message || "Failed to copy note link.");
      });
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
  app.addEventListener("keydown", preventReadOnlyEditorMutation, true);
  app.addEventListener("beforeinput", preventReadOnlyEditorMutation, true);
  app.addEventListener("paste", preventReadOnlyEditorMutation, true);
  app.addEventListener("drop", preventReadOnlyEditorMutation, true);
  app.addEventListener("cut", preventReadOnlyEditorMutation, true);

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
    const canMutateFolder =
      authMode === "off" ||
      (folderId === selectedFolderId ? selectedFolderCapabilities.canWrite : workspaceCapabilities.canWrite);
    const folderMenuItems = [];
    if (canMutateFolder) {
      folderMenuItems.push(
        { label: "Rename", action: "rename-folder" },
        { label: "Delete", action: "delete-folder", danger: true },
      );
    }
    if (authMode !== "off") {
      folderMenuItems.push({ label: "Access...", action: "acl-folder" });
    }
    openContextMenu(
      folderMenuItems,
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
      const canMutateTrashNote =
        authMode === "off" || (noteId === activeNoteId ? hasWritePermissionForActiveNote() : selectedFolderCapabilities.canWrite);
      const trashItems = [];
      if (canMutateTrashNote) {
        trashItems.push(
          { label: "Restore", action: "restore-note" },
          { label: "Delete Permanently", action: "purge-note", danger: true },
        );
      }
      if (authMode !== "off") {
        trashItems.push({ label: "Access...", action: "acl-note" });
      }
      openContextMenu(trashItems, event.clientX, event.clientY, { type: "note", id: noteId });
      return;
    }

    const canMutateNote =
      authMode === "off" || (noteId === activeNoteId ? hasWritePermissionForActiveNote() : selectedFolderCapabilities.canWrite);
    const noteItems = [{ label: "Copy Link", action: "copy-note-link" }];
    if (canMutateNote) {
      noteItems.push(
        { label: "Rename", action: "rename-note" },
        { label: "Delete", action: "trash-note", danger: true },
      );
    }
    if (authMode !== "off") {
      noteItems.push({ label: "Access...", action: "acl-note" });
    }
    openContextMenu(
      noteItems,
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

  elements.aclActionSelect.addEventListener("change", () => {
    updateAclDialogSections();
  });
  elements.aclCancelBtn.addEventListener("click", () => {
    closeAclDialog();
  });
  elements.aclApplyBtn.addEventListener("click", () => {
    void applyAclDialog().catch((error) => {
      console.error("[tui.notes.2026] failed to apply ACL update", error);
      window.alert(error?.message || "Failed to update access.");
    });
  });
  elements.aclModal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest('[data-action="close-acl-modal"]')) {
      closeAclDialog();
    }
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
      closeAclDialog();
    }
  });

  window.addEventListener("resize", () => {
    hideContextMenu();
    applyLayoutPrefs(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void refreshViewerContext().catch(() => {});
      void refreshCapabilitiesForSelection().catch(() => {});
      void syncStateFromServer({ force: true, bypassDeferral: true });
    }
  });

  window.addEventListener("focus", () => {
    void refreshViewerContext().catch(() => {});
    void refreshCapabilitiesForSelection().catch(() => {});
    void syncStateFromServer({ force: true, bypassDeferral: true });
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
    stopRemoteEventsStream();
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
