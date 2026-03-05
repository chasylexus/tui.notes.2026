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
import { authContextMiddleware, getAuthMode, requireAuthentication } from "./auth.js";
import { createAclStore } from "./acl-store.js";
import { AclService, getWorkspaceResource } from "./acl-service.js";

const app = express();
const aclStore = await createAclStore({ storageRootDir: getStorageRootDir() });
const aclService = new AclService({
  store: aclStore,
  authModeProvider: getAuthMode,
  logger: console,
});

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
const SSE_KEEPALIVE_MS = 25_000;
const PRESENCE_TTL_MS = 12_000;
const PRESENCE_SWEEP_MS = 4_000;
const sseClients = new Set();
const presenceByClientKey = new Map();
let sseEventId = 0;
const STATE_CLIENT_ID_HEADER = "x-tui-client-id";
const DEBUG_SYNC = process.env.TUI_NOTES_DEBUG_SYNC === "1";

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

function getRequestAuthContext(req) {
  return req.authContext || {
    mode: getAuthMode(),
    user: {
      id: "anonymous",
      userId: "",
      email: "",
      preferredUsername: "",
      groups: [],
      isAuthenticated: false,
      displayName: "anonymous",
    },
    isAuthenticated: false,
    isEnforced: getAuthMode() === "enforce",
    isObserve: getAuthMode() === "observe",
    isOff: getAuthMode() === "off",
  };
}

function ensureAuthOrReject(req, res) {
  const context = getRequestAuthContext(req);
  if (context.isEnforced && !context.isAuthenticated) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  return context;
}

async function ensureAclStateFromState(fullState, req) {
  let nextState = fullState;
  await aclService.syncResourcesFromState(nextState);
  const context = getRequestAuthContext(req);
  if (context?.isAuthenticated) {
    const preservedMeta =
      nextState && typeof nextState === "object" && nextState._meta && typeof nextState._meta === "object"
        ? { ...nextState._meta }
        : null;
    await aclService.ensureBootstrapOwner(context.user);
    const ensuredHome = await aclService.ensureUserHomeFolder(nextState, context.user, {
      mode: context.mode || getAuthMode(),
    });
    nextState = {
      ...ensuredHome.state,
      ...(preservedMeta ? { _meta: preservedMeta } : {}),
    };
    if (ensuredHome.changed) {
      nextState = replaceState({
        ...nextState,
        _meta: nextState?._meta,
      });
      broadcastStateRevision(nextState);
    }
  }
  await aclService.syncResourcesFromState(nextState);
  return nextState;
}

async function toScopedStateForRequest(fullState, req) {
  const context = getRequestAuthContext(req);
  const scoped = await aclService.filterStateForUser(fullState, context.user, {
    mode: context.mode || getAuthMode(),
  });
  return {
    ...scoped,
    _meta: fullState?._meta,
  };
}

function writeSseEvent(response, eventName, payload) {
  const id = String(++sseEventId);
  response.write(`id: ${id}\n`);
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function closeSseClient(clientEntry) {
  if (!clientEntry) {
    return;
  }
  const response = clientEntry.response;
  try {
    response?.end();
  } catch (_endError) {
    // Ignore close errors for dead sockets.
  }
  sseClients.delete(clientEntry);
}

function debugSyncLog(message, extra = null) {
  if (!DEBUG_SYNC) {
    return;
  }
  if (extra && typeof extra === "object") {
    console.log("[tui.notes.2026][sync]", message, extra);
    return;
  }
  console.log("[tui.notes.2026][sync]", message);
}

function resolveStateSourceClientId(req) {
  const fromHeader = normalizePresenceClientId(req.get(STATE_CLIENT_ID_HEADER));
  if (fromHeader) {
    return fromHeader;
  }
  return normalizePresenceClientId(req.body?._meta?.clientId);
}

function broadcastStateRevision(nextState, { sourceClientId = "" } = {}) {
  if (!nextState || typeof nextState !== "object") {
    return;
  }

  const revision = Number(nextState?._meta?.revision);
  if (!Number.isFinite(revision) || revision < 0) {
    return;
  }

  const payload = {
    revision,
    updatedAt: Number(nextState?._meta?.updatedAt) || Date.now(),
    clientId: normalizePresenceClientId(sourceClientId),
  };

  for (const client of sseClients) {
    try {
      writeSseEvent(client.response, "state-updated", payload);
    } catch (_error) {
      closeSseClient(client);
    }
  }
}

function broadcastPermissionsChanged(payload = {}) {
  const data = {
    updatedAt: Date.now(),
    ...payload,
  };

  for (const client of sseClients) {
    try {
      writeSseEvent(client.response, "permissions-changed", data);
    } catch (_error) {
      closeSseClient(client);
    }
  }
}

function normalizePresenceClientId(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value || value.length > 160) {
    return "";
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    return "";
  }
  return value;
}

function normalizePresenceMode(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase();
  return value === "markdown" ? "markdown" : "wysiwyg";
}

function normalizePresenceOffset(rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function getPresenceUserKey(user) {
  const id = String(user?.id || "").trim();
  const email = String(user?.email || "").trim().toLowerCase();
  const userId = String(user?.userId || "").trim();
  return id || email || userId || "anonymous";
}

function getPresenceClientKey(user, clientId) {
  return `${getPresenceUserKey(user)}::${clientId}`;
}

function listPresenceParticipantsForNote(noteId) {
  const now = Date.now();
  const participants = [];

  for (const [entryKey, entry] of presenceByClientKey.entries()) {
    if (!entry?.noteId) {
      continue;
    }
    if (now - Number(entry.updatedAt || 0) > PRESENCE_TTL_MS) {
      presenceByClientKey.delete(entryKey);
      continue;
    }
    if (entry.noteId !== noteId) {
      continue;
    }
    participants.push({
      clientId: entry.clientId,
      userKey: entry.userKey,
      displayName: entry.displayName,
      mode: entry.mode,
      anchor: entry.anchor,
      head: entry.head,
      updatedAt: entry.updatedAt,
    });
  }

  return participants.sort((left, right) =>
    String(left.displayName || left.userKey).localeCompare(
      String(right.displayName || right.userKey),
      undefined,
      { sensitivity: "base" },
    ));
}

async function canClientReadPresenceNote(clientEntry, noteId) {
  if (!noteId) {
    return true;
  }
  const mode = clientEntry?.mode || getAuthMode();
  if (mode === "off" || mode === "observe") {
    return true;
  }
  try {
    const capabilities = await aclService.getCapabilitiesForResource(clientEntry.user, {
      resourceType: "note",
      resourceExternalId: noteId,
      mode,
    });
    return Boolean(capabilities.canRead);
  } catch (_error) {
    return false;
  }
}

async function broadcastPresenceForNote(noteId) {
  const payload = {
    noteId: noteId || null,
    participants: noteId ? listPresenceParticipantsForNote(noteId) : [],
    updatedAt: Date.now(),
  };

  for (const client of sseClients) {
    try {
      if (noteId) {
        const canRead = await canClientReadPresenceNote(client, noteId);
        if (!canRead) {
          continue;
        }
      }
      writeSseEvent(client.response, "presence-updated", payload);
    } catch (_error) {
      closeSseClient(client);
    }
  }
}

function removePresenceForClient(user, clientId) {
  const normalizedClientId = normalizePresenceClientId(clientId);
  if (!normalizedClientId) {
    return;
  }
  const presenceKey = getPresenceClientKey(user, normalizedClientId);
  const existing = presenceByClientKey.get(presenceKey);
  if (!existing) {
    return;
  }
  presenceByClientKey.delete(presenceKey);
  if (existing.noteId) {
    void broadcastPresenceForNote(existing.noteId);
  }
}

function sweepStalePresenceEntries() {
  const now = Date.now();
  const changedNoteIds = new Set();
  for (const [entryKey, entry] of presenceByClientKey.entries()) {
    if (now - Number(entry.updatedAt || 0) <= PRESENCE_TTL_MS) {
      continue;
    }
    presenceByClientKey.delete(entryKey);
    if (entry?.noteId) {
      changedNoteIds.add(entry.noteId);
    }
  }
  for (const noteId of changedNoteIds) {
    void broadcastPresenceForNote(noteId);
  }
}

const presenceSweepTimer = setInterval(sweepStalePresenceEntries, PRESENCE_SWEEP_MS);
presenceSweepTimer.unref?.();

const shouldServeDist = resolveServeDistMode();
if (shouldServeDist && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

app.use(express.json({ limit: "25mb" }));
app.use(authContextMiddleware);
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    authMode: getAuthMode(),
    storageRootDir: getStorageRootDir(),
    notesDir: getNotesDir(),
    trashDir: getTrashDir(),
  });
});

app.get("/api/me", requireAuthentication, async (req, res, next) => {
  try {
    const fullState = await ensureAclStateFromState(getHydratedState(), req);
    const context = getRequestAuthContext(req);
    const viewerContext = await aclService.getViewerContext(context.user, {
      mode: context.mode,
      state: fullState,
    });
    res.json(viewerContext);
  } catch (error) {
    next(error);
  }
});

app.get("/api/me/capabilities", requireAuthentication, async (req, res, next) => {
  try {
    const resourceTypeRaw = String(req.query?.type || "").trim().toLowerCase();
    const resourceExternalIdRaw = String(req.query?.externalId || "").trim();
    const resource = resourceTypeRaw && resourceExternalIdRaw
      ? { type: resourceTypeRaw, externalId: resourceExternalIdRaw }
      : getWorkspaceResource();

    await ensureAclStateFromState(getHydratedState(), req);

    const context = getRequestAuthContext(req);
    const capabilities = await aclService.getCapabilitiesForResource(context.user, {
      resourceType: resource.type,
      resourceExternalId: resource.externalId,
      mode: context.mode,
    });

    res.json({
      resourceType: resource.type,
      resourceExternalId: resource.externalId,
      ...capabilities,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/state", requireAuthentication, async (req, res, next) => {
  try {
    const context = ensureAuthOrReject(req, res);
    if (!context) {
      return;
    }

    const fullState = await ensureAclStateFromState(getHydratedState(), req);
    const scopedState = await toScopedStateForRequest(fullState, req);
    res.json(scopedState);
  } catch (error) {
    next(error);
  }
});

app.get("/api/acl/resource/:resourceType/:resourceExternalId", requireAuthentication, async (req, res, next) => {
  try {
    const context = ensureAuthOrReject(req, res);
    if (!context) {
      return;
    }

    const resourceType = String(req.params?.resourceType || "").trim();
    const resourceExternalId = String(req.params?.resourceExternalId || "").trim();
    const effectiveRaw = String(req.query?.effective || "").trim().toLowerCase();
    const includeEffective = effectiveRaw === "1" || effectiveRaw === "true" || effectiveRaw === "yes";
    if (!resourceType || !resourceExternalId) {
      res.status(400).json({ message: "resourceType and resourceExternalId are required." });
      return;
    }

    await ensureAclStateFromState(getHydratedState(), req);
    let bindings = [];
    let effectiveBindings = [];
    if (includeEffective) {
      const result = await aclService.listEffectiveBindingsForResource({
        actorUser: context.user,
        resourceType,
        resourceExternalId,
        mode: context.mode,
      });
      bindings = result.directBindings;
      effectiveBindings = result.effectiveBindings;
    } else {
      bindings = await aclService.listBindingsForResource({
        actorUser: context.user,
        resourceType,
        resourceExternalId,
        mode: context.mode,
      });
      effectiveBindings = bindings.map((binding) => ({
        ...binding,
        relation: "direct",
        sourceResourceType: resourceType,
        sourceResourceExternalId: resourceExternalId,
        canRevoke: true,
      }));
    }

    res.json({
      resourceType,
      resourceExternalId,
      bindings,
      effectiveBindings,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/acl/grant", requireAuthentication, async (req, res, next) => {
  try {
    const context = ensureAuthOrReject(req, res);
    if (!context) {
      return;
    }
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ message: "Request body must be an object." });
      return;
    }

    await ensureAclStateFromState(getHydratedState(), req);

    const binding = await aclService.grantBinding({
      actorUser: context.user,
      mode: context.mode,
      bindingInput: req.body,
    });

    broadcastPermissionsChanged({
      resourceType: binding.resourceType,
      resourceExternalId: binding.resourceExternalId,
      operation: "grant",
    });

    res.json({ ok: true, binding });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/acl/grant/:bindingId", requireAuthentication, async (req, res, next) => {
  try {
    const context = ensureAuthOrReject(req, res);
    if (!context) {
      return;
    }
    const bindingId = String(req.params?.bindingId || "").trim();
    if (!bindingId) {
      res.status(400).json({ message: "bindingId is required." });
      return;
    }

    await ensureAclStateFromState(getHydratedState(), req);

    const deleted = await aclService.revokeBinding({
      actorUser: context.user,
      mode: context.mode,
      bindingId,
    });

    if (deleted) {
      broadcastPermissionsChanged({
        operation: "revoke",
        bindingId,
      });
    }

    res.json({ ok: true, deleted });
  } catch (error) {
    next(error);
  }
});

app.get("/api/events", requireAuthentication, async (req, res, next) => {
  try {
    const context = ensureAuthOrReject(req, res);
    if (!context) {
      return;
    }

    const fullState = await ensureAclStateFromState(getHydratedState(), req);
    const scopedState = await toScopedStateForRequest(fullState, req);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const eventsClientId = normalizePresenceClientId(req.query?.clientId);
    const clientEntry = {
      response: res,
      user: context.user,
      mode: context.mode,
      clientId: eventsClientId || "",
    };

    sseClients.add(clientEntry);

    writeSseEvent(res, "connected", {
      revision: Number(scopedState?._meta?.revision) || 0,
      connectedAt: Date.now(),
      authMode: context.mode,
      user: context.user?.displayName || context.user?.id || "anonymous",
    });

    const keepalive = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch (_error) {
        clearInterval(keepalive);
        closeSseClient(clientEntry);
      }
    }, SSE_KEEPALIVE_MS);

    res.on("close", () => {
      clearInterval(keepalive);
      sseClients.delete(clientEntry);
      if (eventsClientId) {
        removePresenceForClient(context.user, eventsClientId);
      }
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/presence/heartbeat", requireAuthentication, async (req, res, next) => {
  try {
    const context = ensureAuthOrReject(req, res);
    if (!context) {
      return;
    }
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ message: "Request body must be an object." });
      return;
    }

    const clientId = normalizePresenceClientId(req.body.clientId);
    if (!clientId) {
      res.status(400).json({ message: "clientId is required." });
      return;
    }

    const mode = normalizePresenceMode(req.body.mode);
    const noteId = String(req.body.noteId || "").trim() || null;
    const anchor = normalizePresenceOffset(req.body.anchor);
    const head = normalizePresenceOffset(req.body.head);

    const fullState = await ensureAclStateFromState(getHydratedState(), req);
    const previousKey = getPresenceClientKey(context.user, clientId);
    const previous = presenceByClientKey.get(previousKey) || null;

    if (!noteId) {
      presenceByClientKey.delete(previousKey);
      if (previous?.noteId) {
        void broadcastPresenceForNote(previous.noteId);
      }
      res.json({ ok: true, noteId: null, participants: [] });
      return;
    }

    const note = Array.isArray(fullState?.notes)
      ? fullState.notes.find((item) => String(item.id) === noteId && !item.deletedAt)
      : null;
    if (!note) {
      res.status(404).json({ message: "Note not found." });
      return;
    }

    await aclService.assertAllowed(context.user, {
      action: "read",
      resourceType: "note",
      resourceExternalId: noteId,
      mode: context.mode,
    });

    presenceByClientKey.set(previousKey, {
      clientId,
      userKey: getPresenceUserKey(context.user),
      displayName: context.user?.displayName || context.user?.email || context.user?.userId || context.user?.id || "anonymous",
      noteId,
      mode,
      anchor,
      head,
      updatedAt: Date.now(),
    });

    if (previous?.noteId && previous.noteId !== noteId) {
      void broadcastPresenceForNote(previous.noteId);
    }
    void broadcastPresenceForNote(noteId);

    res.json({
      ok: true,
      noteId,
      participants: listPresenceParticipantsForNote(noteId),
    });
  } catch (error) {
    next(error);
  }
});

async function handleGetMediaFile(req, res) {
  const noteId = String(req.query?.noteId || "").trim();
  const mediaPath = String(req.query?.path || "").trim();
  const requestedKind = String(req.query?.kind || "").trim().toLowerCase();
  if (!noteId || !mediaPath) {
    res.status(400).json({ message: "noteId and path are required." });
    return;
  }

  const fullState = await ensureAclStateFromState(getHydratedState(), req);
  const note = Array.isArray(fullState?.notes)
    ? fullState.notes.find((item) => String(item.id) === noteId)
    : null;
  if (!note || note.deletedAt) {
    res.status(404).json({ message: "Note not found." });
    return;
  }

  const context = ensureAuthOrReject(req, res);
  if (!context) {
    return;
  }
  await aclService.assertAllowed(context.user, {
    action: "read",
    resourceType: "note",
    resourceExternalId: note.id,
    mode: context.mode,
  });

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

app.get("/api/media/file", (req, res, next) => {
  Promise.resolve(handleGetMediaFile(req, res)).catch(next);
});
app.get("/api/media/file/:fileName", (req, res, next) => {
  Promise.resolve(handleGetMediaFile(req, res)).catch(next);
});

app.post(
  "/api/media/upload",
  requireAuthentication,
  express.raw({
    type: () => true,
    limit: MAX_MEDIA_UPLOAD_BYTES,
  }),
  async (req, res, next) => {
    try {
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

    const fullState = await ensureAclStateFromState(getHydratedState(), req);
    const note = Array.isArray(fullState?.notes)
      ? fullState.notes.find((item) => String(item.id) === noteId)
      : null;
    if (!note || note.deletedAt) {
      res.status(404).json({ message: "Note not found." });
      return;
    }

    const context = ensureAuthOrReject(req, res);
    if (!context) {
      return;
    }
    await aclService.assertAllowed(context.user, {
      action: "write",
      resourceType: "note",
      resourceExternalId: note.id,
      mode: context.mode,
    });

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
    } catch (error) {
      next(error);
    }
  }
);

async function handleStateWrite(req, res, next) {
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ message: "Request body must be a state object." });
    return;
  }

  try {
    const context = ensureAuthOrReject(req, res);
    if (!context) {
      return;
    }

    const currentFullState = await ensureAclStateFromState(getHydratedState(), req);
    const sourceClientId = resolveStateSourceClientId(req);
    debugSyncLog("state write:request", {
      user: context.user?.displayName || context.user?.id || "anonymous",
      baseRevision: Number(req.body?._meta?.baseRevision) || 0,
      currentRevision: Number(currentFullState?._meta?.revision) || 0,
      sourceClientId,
    });

    const mergedState = await aclService.mergeScopedStateForWrite({
      currentFullState,
      incomingScopedState: req.body,
      user: context.user,
      mode: context.mode,
    });

    const nextState = replaceState({
      ...mergedState,
      _meta: req.body?._meta,
    });

    const ensuredNextState = await ensureAclStateFromState(nextState, req);
    broadcastStateRevision(ensuredNextState, { sourceClientId });
    debugSyncLog("state write:applied", {
      sourceClientId,
      nextRevision: Number(ensuredNextState?._meta?.revision) || 0,
    });
    const scopedState = await toScopedStateForRequest(ensuredNextState, req);
    res.json(scopedState);
  } catch (error) {
    debugSyncLog("state write:error", {
      status: Number(error?.status) || 0,
      message: error?.message || "unknown",
    });
    if (Number(error?.status) === 409) {
      let scopedConflictState = error?.payload?.state || null;
      if (scopedConflictState && typeof scopedConflictState === "object") {
        try {
          scopedConflictState = await toScopedStateForRequest(scopedConflictState, req);
        } catch (_scopeError) {
          scopedConflictState = null;
        }
      }
      res.status(409).json({
        message: error.message || "State conflict detected.",
        ...(error?.payload && typeof error.payload === "object" ? error.payload : {}),
        ...(scopedConflictState ? { state: scopedConflictState } : {}),
      });
      return;
    }
    next(error);
  }
}

app.put("/api/state", requireAuthentication, handleStateWrite);
app.post("/api/state", requireAuthentication, handleStateWrite);

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
  const status = Number(error?.status);
  const responseStatus = Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
  res.status(responseStatus).json({
    message: error?.message || "Unknown server error.",
    ...(error?.details && typeof error.details === "object" ? { details: error.details } : {}),
  });
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[tui.notes.2026][api] listening on http://${HOST}:${PORT} (storage: ${getStorageRootDir()}, serveDist: ${String(shouldServeDist)}, authMode: ${getAuthMode()})`,
  );
});
