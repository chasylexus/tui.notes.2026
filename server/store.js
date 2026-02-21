import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const ROOT_CONFIG_FILE = path.join(process.cwd(), "tui-notes.config.json");
const ROOT_DIR_ENV_NAME = "TUI_NOTES_ROOT_DIR";

function expandHomePrefix(inputPath) {
  if (typeof inputPath !== "string") {
    return "";
  }

  const value = inputPath.trim();
  if (!value) {
    return "";
  }

  if (value === "~") {
    return process.env.HOME || value;
  }

  if (value.startsWith("~/")) {
    return path.join(process.env.HOME || "~", value.slice(2));
  }

  return value;
}

function resolveStorageRootDir() {
  const envPath = expandHomePrefix(process.env[ROOT_DIR_ENV_NAME]);
  if (envPath) {
    return path.resolve(envPath);
  }

  const config = safeReadJson(ROOT_CONFIG_FILE);
  const configPath = expandHomePrefix(config?.notesRootDir);
  if (configPath) {
    return path.resolve(configPath);
  }

  return path.join(process.cwd(), "data");
}

const DATA_DIR = resolveStorageRootDir();
const NOTES_DIR = path.join(DATA_DIR, "notes");
const TRASH_DIR = path.join(DATA_DIR, "trash");
const STATE_FILE = path.join(DATA_DIR, "state.json");

const starterContent = `# Welcome to TUI Notes 2026

This storage is persisted on disk.

- Notes are saved as .md files.
- Deleted notes move to Trash for 30 days.
`;

function createId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultNoteContent(title) {
  const normalized = String(title || "Untitled").trim() || "Untitled";
  return `# ${normalized}\n`;
}

function ensureDataLayout() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(NOTES_DIR, { recursive: true });
  fs.mkdirSync(TRASH_DIR, { recursive: true });
}

function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) {
      return null;
    }
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function toStringId(value) {
  if (value == null) {
    return null;
  }
  const id = String(value).trim();
  return id || null;
}

function sanitizeMdFileName(fileName, noteId) {
  const fallback = `${noteId}.md`;
  if (typeof fileName !== "string") {
    return fallback;
  }

  const trimmed = fileName.trim();
  if (!trimmed) {
    return fallback;
  }

  const noSlashes = trimmed.replace(/[\\/]/g, "-");
  const safe = noSlashes.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe === "." || safe === "..") {
    return fallback;
  }
  if (safe.toLowerCase().endsWith(".md")) {
    return safe;
  }
  return `${safe}.md`;
}

function createDefaultStatePayload() {
  const now = Date.now();
  const workId = createId();
  const personalId = createId();
  const noteId = createId();

  const state = {
    folders: [
      { id: workId, name: "Work", parentId: null, createdAt: now },
      { id: personalId, name: "Personal", parentId: null, createdAt: now + 1 },
    ],
    notes: [
      {
        id: noteId,
        title: "Welcome",
        folderId: null,
        fileName: `${noteId}.md`,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ],
    ui: {
      expandedFolderIds: [workId, personalId],
    },
  };

  const noteContents = new Map([[noteId, starterContent]]);
  return { state, noteContents };
}

function normalizeStatePayload(rawPayload) {
  const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};

  const foldersInput = Array.isArray(payload.folders) ? payload.folders : [];
  const normalizedFolders = [];
  const folderIds = new Set();

  for (const rawFolder of foldersInput) {
    if (!rawFolder || rawFolder.id == null || rawFolder.name == null) {
      continue;
    }

    const id = toStringId(rawFolder.id);
    if (!id || folderIds.has(id)) {
      continue;
    }

    const name = String(rawFolder.name).trim() || "Untitled Folder";
    normalizedFolders.push({
      id,
      name,
      parentId: rawFolder.parentId == null ? null : toStringId(rawFolder.parentId),
      createdAt: Number(rawFolder.createdAt) || Date.now(),
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

  const validFolderIds = new Set(normalizedFolders.map((folder) => folder.id));

  const notesInput = Array.isArray(payload.notes) ? payload.notes : [];
  const normalizedNotes = [];
  const noteIds = new Set();
  const noteContents = new Map();

  for (const rawNote of notesInput) {
    if (!rawNote || rawNote.id == null) {
      continue;
    }

    const id = toStringId(rawNote.id);
    if (!id || noteIds.has(id)) {
      continue;
    }

    const title = String(rawNote.title || "Untitled").trim() || "Untitled";
    const folderIdCandidate = rawNote.folderId == null ? null : toStringId(rawNote.folderId);
    const folderId = folderIdCandidate && validFolderIds.has(folderIdCandidate) ? folderIdCandidate : null;
    const createdAt = Number(rawNote.createdAt) || Date.now();
    const updatedAt = Number(rawNote.updatedAt) || createdAt;
    const deletedAt = rawNote.deletedAt ? Number(rawNote.deletedAt) || null : null;
    const fileName = sanitizeMdFileName(rawNote.fileName, id);

    normalizedNotes.push({
      id,
      title,
      folderId,
      fileName,
      createdAt,
      updatedAt,
      deletedAt,
    });

    if (typeof rawNote.content === "string") {
      noteContents.set(id, rawNote.content);
    }

    noteIds.add(id);
  }

  let uiExpanded = [];
  if (payload.ui && typeof payload.ui === "object" && Array.isArray(payload.ui.expandedFolderIds)) {
    uiExpanded = payload.ui.expandedFolderIds
      .map((folderId) => toStringId(folderId))
      .filter((folderId) => folderId && validFolderIds.has(folderId));
  }

  const state = {
    folders: normalizedFolders,
    notes: normalizedNotes,
    ui: {
      expandedFolderIds: [...new Set(uiExpanded)],
    },
  };

  return { state, noteContents };
}

function getNoteFilePath(note) {
  const fileName = sanitizeMdFileName(note.fileName, note.id);
  note.fileName = fileName;
  const targetDir = note.deletedAt ? TRASH_DIR : NOTES_DIR;
  return path.join(targetDir, fileName);
}

function readNoteContentFromDisk(note) {
  const filePath = getNoteFilePath(note);
  if (!fs.existsSync(filePath)) {
    const fallback = defaultNoteContent(note.title);
    fs.writeFileSync(filePath, fallback, "utf8");
    return fallback;
  }

  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_error) {
    const fallback = defaultNoteContent(note.title);
    fs.writeFileSync(filePath, fallback, "utf8");
    return fallback;
  }
}

function deleteNoteFileIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_error) {
    // Ignore unlink errors to keep operations resilient.
  }
}

function deleteNoteFiles(note) {
  const fileName = sanitizeMdFileName(note.fileName, note.id);
  deleteNoteFileIfExists(path.join(NOTES_DIR, fileName));
  deleteNoteFileIfExists(path.join(TRASH_DIR, fileName));
  deleteNoteFileIfExists(path.join(NOTES_DIR, `${note.id}.md`));
  deleteNoteFileIfExists(path.join(TRASH_DIR, `${note.id}.md`));
}

function purgeExpiredNotes(state) {
  const now = Date.now();
  const keptNotes = [];
  const removedNotes = [];

  for (const note of state.notes) {
    if (!note.deletedAt) {
      keptNotes.push(note);
      continue;
    }

    if (now - note.deletedAt >= THIRTY_DAYS_MS) {
      removedNotes.push(note);
      continue;
    }

    keptNotes.push(note);
  }

  state.notes = keptNotes;
  return removedNotes;
}

function ensureMissingFilesFromPayload(state, noteContents) {
  for (const note of state.notes) {
    const filePath = getNoteFilePath(note);
    if (fs.existsSync(filePath)) {
      continue;
    }

    const content = noteContents.has(note.id)
      ? noteContents.get(note.id)
      : defaultNoteContent(note.title);
    fs.writeFileSync(filePath, content, "utf8");
  }
}

function cleanupOrphanMarkdownFiles(state) {
  const expectedPaths = new Set(state.notes.map((note) => getNoteFilePath(note)));

  for (const dir of [NOTES_DIR, TRASH_DIR]) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      if (!entry.name.toLowerCase().endsWith(".md")) {
        continue;
      }

      const filePath = path.join(dir, entry.name);
      if (!expectedPaths.has(filePath)) {
        deleteNoteFileIfExists(filePath);
      }
    }
  }
}

function writeStateMetadata(state) {
  writeJson(STATE_FILE, {
    folders: state.folders,
    notes: state.notes,
    ui: state.ui,
  });
}

function loadStateFromDisk() {
  ensureDataLayout();

  const rawPayload = safeReadJson(STATE_FILE);
  const { state, noteContents } = rawPayload
    ? normalizeStatePayload(rawPayload)
    : createDefaultStatePayload();

  const removedNotes = purgeExpiredNotes(state);
  for (const note of removedNotes) {
    deleteNoteFiles(note);
  }

  ensureMissingFilesFromPayload(state, noteContents);
  cleanupOrphanMarkdownFiles(state);
  writeStateMetadata(state);

  return state;
}

function saveIncomingState(rawPayload) {
  const previousState = loadStateFromDisk();
  const previousNotesById = new Map(previousState.notes.map((note) => [note.id, note]));

  const { state, noteContents } = normalizeStatePayload(rawPayload);

  for (const note of state.notes) {
    const previousNote = previousNotesById.get(note.id);
    if (previousNote) {
      note.fileName = sanitizeMdFileName(previousNote.fileName, note.id);
    } else {
      note.fileName = sanitizeMdFileName(note.fileName, note.id);
    }
  }

  const removedNotes = purgeExpiredNotes(state);
  for (const note of removedNotes) {
    deleteNoteFiles(note);
  }

  for (const note of state.notes) {
    const previousNote = previousNotesById.get(note.id);
    const previousPath = previousNote ? getNoteFilePath(previousNote) : null;
    const targetPath = getNoteFilePath(note);

    const content = noteContents.has(note.id)
      ? noteContents.get(note.id)
      : previousPath && fs.existsSync(previousPath)
        ? fs.readFileSync(previousPath, "utf8")
        : fs.existsSync(targetPath)
          ? fs.readFileSync(targetPath, "utf8")
          : defaultNoteContent(note.title);

    fs.writeFileSync(targetPath, content, "utf8");
  }

  cleanupOrphanMarkdownFiles(state);
  writeStateMetadata(state);

  return state;
}

function hydrateState(state) {
  return {
    folders: state.folders.map((folder) => ({ ...folder })),
    notes: state.notes.map((note) => ({
      ...note,
      content: readNoteContentFromDisk(note),
    })),
    ui: {
      expandedFolderIds: Array.isArray(state.ui?.expandedFolderIds)
        ? [...state.ui.expandedFolderIds]
        : [],
    },
  };
}

export function getHydratedState() {
  const state = loadStateFromDisk();
  return hydrateState(state);
}

export function replaceState(rawPayload) {
  const state = saveIncomingState(rawPayload);
  return hydrateState(state);
}

export function getStorageRootDir() {
  return DATA_DIR;
}
