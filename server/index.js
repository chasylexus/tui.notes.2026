import express from "express";
import fs from "node:fs";
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

function handleStateWrite(req, res) {
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ message: "Request body must be a state object." });
    return;
  }

  const nextState = replaceState(req.body);
  res.json(nextState);
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
