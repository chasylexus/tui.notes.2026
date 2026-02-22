import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const ROOT_CONFIG_FILE = path.join(process.cwd(), "tui-notes.config.json");
const ROOT_DIR_ENV_NAME = "TUI_NOTES_ROOT_DIR";
const NOTES_DIR_ENV_NAME = "TUI_NOTES_NOTES_DIR";
const DEFAULT_NOTES_DIR = path.join(process.env.HOME || process.cwd(), ".tui.notes.2026", "notes");

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

function createStoragePathsFromRootDir(rootDir) {
  const appRootDir = path.resolve(rootDir);
  return {
    appRootDir,
    notesDir: path.join(appRootDir, "notes"),
    trashDir: path.join(appRootDir, "trash"),
    stateFile: path.join(appRootDir, "state.json"),
  };
}

function createStoragePathsFromNotesDir(notesDir) {
  const resolvedNotesDir = path.resolve(notesDir);
  const appRootDir = path.dirname(resolvedNotesDir);
  return {
    appRootDir,
    notesDir: resolvedNotesDir,
    trashDir: path.join(appRootDir, "trash"),
    stateFile: path.join(appRootDir, "state.json"),
  };
}

function resolveStoragePaths() {
  const envNotesDir = expandHomePrefix(process.env[NOTES_DIR_ENV_NAME]);
  if (envNotesDir) {
    return createStoragePathsFromNotesDir(envNotesDir);
  }

  const envRootDir = expandHomePrefix(process.env[ROOT_DIR_ENV_NAME]);
  if (envRootDir) {
    return createStoragePathsFromRootDir(envRootDir);
  }

  const config = safeReadJson(ROOT_CONFIG_FILE);

  const configNotesDir = expandHomePrefix(config?.notesDir);
  if (configNotesDir) {
    return createStoragePathsFromNotesDir(configNotesDir);
  }

  const configRootDir = expandHomePrefix(config?.notesRootDir);
  if (configRootDir) {
    return createStoragePathsFromRootDir(configRootDir);
  }

  return createStoragePathsFromNotesDir(DEFAULT_NOTES_DIR);
}

const STORAGE_PATHS = resolveStoragePaths();
const DATA_DIR = STORAGE_PATHS.appRootDir;
const NOTES_DIR = STORAGE_PATHS.notesDir;
const TRASH_DIR = STORAGE_PATHS.trashDir;
const STATE_FILE = STORAGE_PATHS.stateFile;

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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function toStringId(value) {
  if (value == null) {
    return null;
  }
  const id = String(value).trim();
  return id || null;
}

function sanitizePathSegment(segment) {
  const trimmed = String(segment || "").trim();
  if (!trimmed || trimmed === "." || trimmed === "..") {
    return "";
  }

  const cleaned = trimmed.replace(/[<>:"|?*\u0000-\u001f]/g, "");
  return cleaned || "";
}

function sanitizeMdRelativePath(fileName, noteId) {
  const fallback = `${noteId || "note"}.md`;
  if (typeof fileName !== "string") {
    return fallback;
  }

  const rawValue = fileName.trim().replaceAll("\\", "/");
  if (!rawValue) {
    return fallback;
  }

  const normalized = path.posix
    .normalize(rawValue)
    .replace(/^\/+/, "")
    .replace(/^(\.\/)+/, "");

  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    return fallback;
  }

  const parts = normalized.split("/").filter(Boolean);
  const safeParts = parts.map(sanitizePathSegment).filter(Boolean);
  if (!safeParts.length) {
    return fallback;
  }

  const lastIndex = safeParts.length - 1;
  if (!safeParts[lastIndex].toLowerCase().endsWith(".md")) {
    safeParts[lastIndex] = `${safeParts[lastIndex]}.md`;
  }

  return safeParts.join("/");
}

function normalizeFileTitleBase(title) {
  const raw = String(title || "")
    .replaceAll("\\", " ")
    .replaceAll("/", " ")
    .replace(/\s+/g, " ")
    .trim();
  const withoutExt = raw.replace(/\.md$/i, "").trim();
  const safe = sanitizePathSegment(withoutExt);
  return safe || "Untitled";
}

function createRandomFileSuffix(length = 6) {
  const bytesLength = Number.isFinite(length) && length > 0 ? Math.ceil(length / 2) : 3;
  return crypto.randomBytes(bytesLength).toString("hex").slice(0, Math.max(length, 1));
}

function resolveFolderPathSegments(state) {
  const folderById = new Map(state.folders.map((folder) => [folder.id, folder]));
  const cache = new Map();

  function resolve(folderId) {
    if (!folderId || !folderById.has(folderId)) {
      return [];
    }
    if (cache.has(folderId)) {
      return cache.get(folderId);
    }

    const parts = [];
    const visited = new Set();
    let current = folderById.get(folderId);

    while (current) {
      if (visited.has(current.id)) {
        break;
      }
      visited.add(current.id);

      const segment = sanitizePathSegment(current.name);
      if (segment) {
        parts.push(segment);
      }

      if (!current.parentId || !folderById.has(current.parentId)) {
        break;
      }
      current = folderById.get(current.parentId);
    }

    const resolved = parts.reverse();
    cache.set(folderId, resolved);
    return resolved;
  }

  return resolve;
}

function joinRelativePath(dirPath, fileName) {
  if (!dirPath) {
    return fileName;
  }
  return `${dirPath}/${fileName}`;
}

function assignNoteFileNamesFromTitles(state) {
  const resolveFolderSegments = resolveFolderPathSegments(state);
  const usedPaths = new Set();

  const notesOrdered = [...state.notes].sort((left, right) => {
    const byCreatedAt = (left.createdAt || 0) - (right.createdAt || 0);
    if (byCreatedAt !== 0) {
      return byCreatedAt;
    }
    return String(left.id).localeCompare(String(right.id), undefined, { sensitivity: "base" });
  });

  for (const note of notesOrdered) {
    const folderSegments = resolveFolderSegments(note.folderId);
    const folderPath = folderSegments.join("/");
    const baseName = normalizeFileTitleBase(note.title);
    const legacyRelativePath = sanitizeMdRelativePath(note.fileName, note.id);
    const legacyDirPath = path.posix.dirname(legacyRelativePath) === "." ? "" : path.posix.dirname(legacyRelativePath);
    const legacyBaseName = path.posix.basename(legacyRelativePath, ".md");
    const storageKeyPrefix = note.deletedAt ? "trash" : "notes";

    const defaultCandidate = joinRelativePath(folderPath, `${baseName}.md`);
    const defaultCandidateKey = `${storageKeyPrefix}:${defaultCandidate.toLowerCase()}`;

    if (!usedPaths.has(defaultCandidateKey)) {
      note.fileName = defaultCandidate;
      usedPaths.add(defaultCandidateKey);
      continue;
    }

    const canReuseLegacyPath =
      legacyDirPath === folderPath &&
      legacyBaseName.toLowerCase().startsWith(baseName.toLowerCase());
    const legacyCandidateKey = `${storageKeyPrefix}:${legacyRelativePath.toLowerCase()}`;
    if (canReuseLegacyPath && !usedPaths.has(legacyCandidateKey)) {
      note.fileName = legacyRelativePath;
      usedPaths.add(legacyCandidateKey);
      continue;
    }

    let attempt = 0;
    while (attempt < 1000) {
      const candidate = joinRelativePath(folderPath, `${baseName}-${createRandomFileSuffix()}.md`);
      const candidateKey = `${storageKeyPrefix}:${candidate.toLowerCase()}`;
      if (!usedPaths.has(candidateKey)) {
        note.fileName = candidate;
        usedPaths.add(candidateKey);
        break;
      }
      attempt += 1;
    }

    if (!note.fileName) {
      note.fileName = joinRelativePath(folderPath, `${baseName}-${Date.now()}.md`);
      usedPaths.add(`${storageKeyPrefix}:${note.fileName.toLowerCase()}`);
    }
  }
}

function toPosixRelativePath(baseDir, absolutePath) {
  return path.relative(baseDir, absolutePath).split(path.sep).join("/");
}

function ensureStateUiObject(state) {
  if (!state.ui || typeof state.ui !== "object") {
    state.ui = {};
  }
  if (!Array.isArray(state.ui.expandedFolderIds)) {
    state.ui.expandedFolderIds = [];
  }
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

function listMarkdownFilesRecursively(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const files = [];
  const stack = [rootDir];

  while (stack.length) {
    const currentDir = stack.pop();
    let entries = [];

    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_error) {
      continue;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!entry.name.toLowerCase().endsWith(".md")) {
        continue;
      }

      files.push(absolutePath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function folderNameEquals(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function findFolderByParentAndName(state, parentId, name) {
  const normalizedParentId = parentId || null;
  for (const folder of state.folders) {
    if ((folder.parentId || null) !== normalizedParentId) {
      continue;
    }
    if (folderNameEquals(folder.name, name)) {
      return folder;
    }
  }
  return null;
}

function ensureFolderPath(state, folderSegments) {
  let parentId = null;
  const folderChainIds = [];

  for (const segment of folderSegments) {
    const folderName = String(segment || "").trim();
    if (!folderName) {
      continue;
    }

    let folder = findFolderByParentAndName(state, parentId, folderName);
    if (!folder) {
      folder = {
        id: createId(),
        name: folderName,
        parentId,
        createdAt: Date.now(),
      };
      state.folders.push(folder);
    }

    parentId = folder.id;
    folderChainIds.push(folder.id);
  }

  return { folderId: parentId, folderChainIds };
}

function deriveTitleFromFileName(relativePath) {
  const baseName = path.posix.basename(relativePath, ".md");
  const readable = baseName.replace(/[-_]+/g, " ").trim();
  return readable || "Untitled";
}

function importMarkdownNotesFromDisk(state) {
  ensureStateUiObject(state);

  const activePathSet = new Set();
  for (const note of state.notes) {
    if (note.deletedAt) {
      continue;
    }
    const relativePath = sanitizeMdRelativePath(note.fileName, note.id).toLowerCase();
    activePathSet.add(relativePath);
  }

  const expandedFolderIds = new Set(
    state.ui.expandedFolderIds
      .map((folderId) => toStringId(folderId))
      .filter((folderId) => folderId),
  );

  const files = listMarkdownFilesRecursively(NOTES_DIR);
  for (const absolutePath of files) {
    const relativeRawPath = toPosixRelativePath(NOTES_DIR, absolutePath);
    const tempId = createId();
    const relativePath = sanitizeMdRelativePath(relativeRawPath, tempId);
    const pathKey = relativePath.toLowerCase();

    if (activePathSet.has(pathKey)) {
      continue;
    }

    const rawSegments = relativeRawPath.replaceAll("\\", "/").split("/").filter(Boolean);
    const folderSegments = rawSegments.slice(0, -1);
    const { folderId, folderChainIds } = ensureFolderPath(state, folderSegments);

    for (const folderChainId of folderChainIds) {
      expandedFolderIds.add(folderChainId);
    }

    let modifiedAt = Date.now();
    try {
      const stat = fs.statSync(absolutePath);
      modifiedAt = Number(stat.mtimeMs) || modifiedAt;
    } catch (_error) {
      // Keep default timestamp.
    }

    state.notes.push({
      id: tempId,
      title: deriveTitleFromFileName(relativePath),
      folderId,
      fileName: relativePath,
      createdAt: modifiedAt,
      updatedAt: modifiedAt,
      deletedAt: null,
    });
    activePathSet.add(pathKey);
  }

  state.ui.expandedFolderIds = Array.from(expandedFolderIds);
}

function createImportedStatePayload() {
  const state = {
    folders: [],
    notes: [],
    ui: {
      expandedFolderIds: [],
    },
  };
  importMarkdownNotesFromDisk(state);
  return { state, noteContents: new Map() };
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
    const fileNameInput =
      typeof rawNote.fileName === "string"
        ? rawNote.fileName
        : typeof rawNote.filePath === "string"
          ? rawNote.filePath
          : "";
    const fileName = sanitizeMdRelativePath(fileNameInput, id);

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

function getNoteRelativePath(note) {
  const relativePath = sanitizeMdRelativePath(note.fileName, note.id);
  note.fileName = relativePath;
  return relativePath;
}

function getNoteFilePath(note) {
  const relativePath = getNoteRelativePath(note);
  const targetDir = note.deletedAt ? TRASH_DIR : NOTES_DIR;
  return path.join(targetDir, ...relativePath.split("/"));
}

function readNoteContentFromDisk(note) {
  const filePath = getNoteFilePath(note);
  if (!fs.existsSync(filePath)) {
    const fallback = defaultNoteContent(note.title);
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, fallback, "utf8");
    return fallback;
  }

  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_error) {
    const fallback = defaultNoteContent(note.title);
    ensureParentDir(filePath);
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
  const relativePath = sanitizeMdRelativePath(note.fileName, note.id);
  const relativeParts = relativePath.split("/");

  deleteNoteFileIfExists(path.join(NOTES_DIR, ...relativeParts));
  deleteNoteFileIfExists(path.join(TRASH_DIR, ...relativeParts));

  const legacyName = `${note.id}.md`;
  deleteNoteFileIfExists(path.join(NOTES_DIR, legacyName));
  deleteNoteFileIfExists(path.join(TRASH_DIR, legacyName));
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
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, content, "utf8");
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
  let payload;

  if (rawPayload) {
    payload = normalizeStatePayload(rawPayload);
  } else {
    payload = createImportedStatePayload();
    if (!payload.state.notes.length) {
      payload = createDefaultStatePayload();
    }
  }

  const { state, noteContents } = payload;

  importMarkdownNotesFromDisk(state);

  const removedNotes = purgeExpiredNotes(state);
  for (const note of removedNotes) {
    deleteNoteFiles(note);
  }

  ensureMissingFilesFromPayload(state, noteContents);
  writeStateMetadata(state);

  return state;
}

function moveFileSafely(sourcePath, targetPath) {
  if (sourcePath === targetPath || !fs.existsSync(sourcePath)) {
    return;
  }

  ensureParentDir(targetPath);

  try {
    fs.renameSync(sourcePath, targetPath);
  } catch (_error) {
    const content = fs.readFileSync(sourcePath, "utf8");
    fs.writeFileSync(targetPath, content, "utf8");
    deleteNoteFileIfExists(sourcePath);
  }
}

function saveIncomingState(rawPayload) {
  const previousState = loadStateFromDisk();
  const previousNotesById = new Map(previousState.notes.map((note) => [note.id, note]));

  const { state, noteContents } = normalizeStatePayload(rawPayload);

  const removedNotes = purgeExpiredNotes(state);
  for (const note of removedNotes) {
    deleteNoteFiles(note);
  }

  assignNoteFileNamesFromTitles(state);

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

    if (previousPath && previousPath !== targetPath) {
      moveFileSafely(previousPath, targetPath);
    }

    ensureParentDir(targetPath);
    fs.writeFileSync(targetPath, content, "utf8");
  }

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

export function getNotesDir() {
  return NOTES_DIR;
}

export function getTrashDir() {
  return TRASH_DIR;
}
