import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getHydratedState,
  getNotesDir,
  getStorageRootDir,
  getTrashDir,
  replaceState,
} from "./store.js";

const app = express();

const PORT = Number(process.env.TUI_NOTES_API_PORT || 8787);
const HOST = process.env.TUI_NOTES_API_HOST || "127.0.0.1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "..", "dist");
const DIST_INDEX_FILE = path.join(DIST_DIR, "index.html");
const parsedUploadLimit = Number(process.env.TUI_NOTES_MEDIA_UPLOAD_LIMIT_BYTES);
const MAX_MEDIA_UPLOAD_BYTES =
  Number.isFinite(parsedUploadLimit) && parsedUploadLimit > 0
    ? parsedUploadLimit
    : 500 * 1024 * 1024;
const AUDIO_EXTENSIONS = new Set(["m4a", "mp3", "wav", "ogg", "opus", "webm", "aac", "flac", "oga", "mp4"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "ogv", "avi", "mkv"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp", "ico"]);

function sanitizePathSegment(value) {
  const segment = String(value || "").trim();
  if (!segment || segment === "." || segment === "..") {
    return "";
  }

  const cleaned = segment.replace(/[<>:"|?*\u0000-\u001f]/g, "");
  return cleaned.trim();
}

function normalizeNoteFileName(note) {
  const raw = String(note?.fileName || `${note?.id || "note"}.md`).replaceAll("\\", "/").trim();
  const normalized = path.posix.normalize(raw).replace(/^\/+/, "");
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    return `${note?.id || "note"}.md`;
  }

  const parts = normalized.split("/").filter(Boolean);
  const safeParts = parts.map(sanitizePathSegment).filter(Boolean);
  if (!safeParts.length) {
    return `${note?.id || "note"}.md`;
  }
  return safeParts.join("/");
}

function normalizeMediaRelativePath(value) {
  const raw = String(value || "").trim().replaceAll("\\", "/");
  if (!raw) {
    return null;
  }

  const withoutDotPrefix = raw.replace(/^(\.\/)+/, "");
  const normalized = path.posix.normalize(withoutDotPrefix).replace(/^\/+/, "");
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    return null;
  }

  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) {
    return null;
  }
  for (const part of parts) {
    if (part !== sanitizePathSegment(part)) {
      return null;
    }
  }

  return normalized;
}

function getLowerFileExtension(filePath) {
  const ext = path.extname(String(filePath || "")).replace(/^\./, "").toLowerCase();
  return ext;
}

function isAllowedMediaExtension(filePath, requestedKind) {
  const ext = getLowerFileExtension(filePath);
  if (!ext) {
    return false;
  }
  if (requestedKind === "audio") {
    return AUDIO_EXTENSIONS.has(ext);
  }
  if (requestedKind === "video") {
    return VIDEO_EXTENSIONS.has(ext);
  }
  if (requestedKind === "image") {
    return IMAGE_EXTENSIONS.has(ext);
  }
  return AUDIO_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext);
}

function resolveNoteById(noteId) {
  const state = getHydratedState();
  return state.notes.find((note) => String(note.id) === String(noteId)) || null;
}

function getNoteMediaDirectoryAbsolutePath(note) {
  const noteFileName = normalizeNoteFileName(note);
  const noteDirRelative = path.posix.dirname(noteFileName) === "." ? "" : path.posix.dirname(noteFileName);
  const noteDirAbsolute = path.resolve(getNotesDir(), ...noteDirRelative.split("/").filter(Boolean));
  const notesRoot = path.resolve(getNotesDir());
  const normalizedNoteDir = path.normalize(noteDirAbsolute);
  const rootWithSep = `${notesRoot}${path.sep}`;

  if (normalizedNoteDir !== notesRoot && !normalizedNoteDir.startsWith(rootWithSep)) {
    throw new Error("Unsafe note directory path.");
  }

  return noteDirAbsolute;
}

function inferExtensionFromMime(mimeType, kind) {
  const mime = String(mimeType || "").toLowerCase();

  if (mime.includes("audio/mp4")) return "m4a";
  if (mime.includes("audio/mpeg")) return "mp3";
  if (mime.includes("audio/wav")) return "wav";
  if (mime.includes("audio/ogg")) return "ogg";
  if (mime.includes("audio/webm")) return "webm";
  if (mime.includes("video/mp4")) return "mp4";
  if (mime.includes("video/webm")) return "webm";
  if (mime.includes("video/ogg")) return "ogv";

  return kind === "audio" ? "m4a" : "mp4";
}

function normalizeUploadFileName(input) {
  const value = String(input || "").trim().replaceAll("\\", "/");
  if (!value) {
    return { base: "", extension: "" };
  }

  const fileName = value.split("/").pop() || "";
  const safeFileName = sanitizePathSegment(fileName);
  if (!safeFileName) {
    return { base: "", extension: "" };
  }

  const ext = path.posix.extname(safeFileName).replace(/^\./, "").toLowerCase();
  const base = sanitizePathSegment(path.posix.basename(safeFileName, path.posix.extname(safeFileName)));

  return { base, extension: ext };
}

function normalizeUploadedFileStem(value) {
  const stem = String(value || "").trim();
  if (!stem) {
    return "media";
  }

  const normalized = stem
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

  return normalized || "media";
}

function randomSuffix() {
  return crypto.randomBytes(3).toString("hex");
}

function saveUploadedMediaFile(note, { kind, originalFileName, mimeType, dataBuffer }) {
  if (!Buffer.isBuffer(dataBuffer) || dataBuffer.length <= 0) {
    throw new Error("Uploaded file is empty.");
  }

  const mediaDir = getNoteMediaDirectoryAbsolutePath(note);
  fs.mkdirSync(mediaDir, { recursive: true });

  const { base: rawBase, extension: extFromName } = normalizeUploadFileName(originalFileName);
  const allowedExtensions = kind === "audio" ? AUDIO_EXTENSIONS : VIDEO_EXTENSIONS;
  const extension = allowedExtensions.has(extFromName)
    ? extFromName
    : inferExtensionFromMime(mimeType, kind);
  const safeBase = normalizeUploadedFileStem(rawBase || `${kind}-${Date.now()}`);
  const baseName = safeBase || `${kind}-${Date.now()}`;

  let fileName = `${baseName}.${extension}`;
  let absolutePath = path.join(mediaDir, fileName);
  let guard = 0;

  while (fs.existsSync(absolutePath) && guard < 1000) {
    fileName = `${baseName}-${randomSuffix()}.${extension}`;
    absolutePath = path.join(mediaDir, fileName);
    guard += 1;
  }

  fs.writeFileSync(absolutePath, dataBuffer);

  return {
    fileName,
    relativePath: `./${fileName}`,
    absolutePath,
  };
}

function resolveRequestedMediaFilePath(note, requestedPath, requestedKind = "") {
  const rawInput = String(requestedPath || "").trim().replaceAll("\\", "/");
  let raw = rawInput;
  try {
    raw = decodeURIComponent(rawInput);
  } catch (_error) {
    raw = rawInput;
  }
  if (!raw) {
    return null;
  }

  let absoluteCandidate = null;
  if (raw.startsWith("~/")) {
    absoluteCandidate = path.resolve(os.homedir(), raw.slice(2));
  } else if (raw.startsWith("./~/")) {
    absoluteCandidate = path.resolve(os.homedir(), raw.slice(4));
  } else if (raw.startsWith("file://")) {
    try {
      absoluteCandidate = decodeURIComponent(raw.replace(/^file:\/\//i, ""));
    } catch (_error) {
      absoluteCandidate = raw.replace(/^file:\/\//i, "");
    }
  } else if (path.isAbsolute(raw)) {
    absoluteCandidate = raw;
  }

  if (absoluteCandidate) {
    const absolutePath = path.resolve(absoluteCandidate);
    if (!isAllowedMediaExtension(absolutePath, requestedKind)) {
      return null;
    }
    return absolutePath;
  }

  const normalizedRelativePath = normalizeMediaRelativePath(requestedPath);
  if (!normalizedRelativePath) {
    return null;
  }

  const noteDir = getNoteMediaDirectoryAbsolutePath(note);
  const absolutePath = path.resolve(noteDir, ...normalizedRelativePath.split("/"));
  const normalizedNoteDir = path.normalize(noteDir);
  const rootPrefix = `${normalizedNoteDir}${path.sep}`;
  const normalizedAbsolute = path.normalize(absolutePath);

  if (normalizedAbsolute !== normalizedNoteDir && !normalizedAbsolute.startsWith(rootPrefix)) {
    return null;
  }

  return absolutePath;
}

function resolveServeDistMode() {
  if (process.env.TUI_NOTES_SERVE_DIST === "0") {
    return false;
  }
  if (process.env.TUI_NOTES_SERVE_DIST === "1") {
    return true;
  }
  if (process.env.NODE_ENV === "production") {
    return true;
  }
  return fs.existsSync(DIST_INDEX_FILE);
}

const shouldServeDist = resolveServeDistMode();
if (shouldServeDist && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

app.use(express.json({ limit: "25mb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storageRootDir: getStorageRootDir(),
    notesDir: getNotesDir(),
    trashDir: getTrashDir(),
  });
});

app.get("/api/state", (_req, res) => {
  const state = getHydratedState();
  res.json(state);
});

function handleGetMediaFile(req, res) {
  const noteId = String(req.query?.noteId || "").trim();
  const mediaPath = String(req.query?.path || "").trim();
  const requestedKind = String(req.query?.kind || "").trim().toLowerCase();
  if (!noteId || !mediaPath) {
    res.status(400).json({ message: "noteId and path are required." });
    return;
  }

  const note = resolveNoteById(noteId);
  if (!note || note.deletedAt) {
    res.status(404).json({ message: "Note not found." });
    return;
  }

  const absolutePath = resolveRequestedMediaFilePath(note, mediaPath, requestedKind);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    res.status(404).json({ message: "Media file not found." });
    return;
  }

  const lowerPath = absolutePath.toLowerCase();
  if (requestedKind === "audio") {
    if (lowerPath.endsWith(".webm")) {
      res.type("audio/webm");
    } else if (lowerPath.endsWith(".m4a") || lowerPath.endsWith(".mp4")) {
      res.type("audio/mp4");
    }
  } else if (requestedKind === "video" && lowerPath.endsWith(".webm")) {
    res.type("video/webm");
  }

  res.sendFile(absolutePath);
}

app.get("/api/media/file", handleGetMediaFile);
app.get("/api/media/file/:fileName", handleGetMediaFile);

app.post(
  "/api/media/upload",
  express.raw({
    type: () => true,
    limit: MAX_MEDIA_UPLOAD_BYTES,
  }),
  (req, res) => {
    const noteId = String(req.query?.noteId || "").trim();
    const kindRaw = String(req.query?.kind || "").trim().toLowerCase();
    const originalFileName = String(req.query?.fileName || "").trim();
    const mimeType = String(req.query?.mimeType || "").trim();

    if (!noteId) {
      res.status(400).json({ message: "noteId is required." });
      return;
    }

    const kind = kindRaw === "audio" || kindRaw === "video" ? kindRaw : null;
    if (!kind) {
      res.status(400).json({ message: "kind must be audio or video." });
      return;
    }

    const note = resolveNoteById(noteId);
    if (!note || note.deletedAt) {
      res.status(404).json({ message: "Note not found." });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : req.body instanceof Uint8Array
        ? Buffer.from(req.body)
        : null;

    if (!rawBody || rawBody.length <= 0) {
      res.status(400).json({ message: "Request body must contain binary file data." });
      return;
    }

    try {
      const saved = saveUploadedMediaFile(note, {
        kind,
        originalFileName,
        mimeType,
        dataBuffer: rawBody,
      });

      res.json({
        ok: true,
        kind,
        fileName: saved.fileName,
        relativePath: saved.relativePath,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message || "Failed to save uploaded media.",
      });
    }
  },
);

function handleStateWrite(req, res) {
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ message: "Request body must be a state object." });
    return;
  }

  try {
    const nextState = replaceState(req.body);
    res.json(nextState);
  } catch (error) {
    if (Number(error?.status) === 409) {
      res.status(409).json({
        message: error.message || "State conflict detected.",
        ...(error?.payload && typeof error.payload === "object" ? error.payload : {}),
      });
      return;
    }
    throw error;
  }
}

app.put("/api/state", handleStateWrite);
app.post("/api/state", handleStateWrite);

if (shouldServeDist && fs.existsSync(DIST_INDEX_FILE)) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(DIST_INDEX_FILE);
  });
}

app.use((error, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error("[tui.notes.2026][api]", error);
  res.status(500).json({ message: "Unknown server error." });
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[tui.notes.2026][api] listening on http://${HOST}:${PORT} (storage: ${getStorageRootDir()}, serveDist: ${String(shouldServeDist)})`,
  );
});
