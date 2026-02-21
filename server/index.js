import express from "express";
import { getHydratedState, getStorageRootDir, replaceState } from "./store.js";

const app = express();

const PORT = Number(process.env.TUI_NOTES_API_PORT || 8787);
const HOST = process.env.TUI_NOTES_API_HOST || "127.0.0.1";

app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, storageRootDir: getStorageRootDir() });
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

app.use((error, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error("[tui.notes.2026][api]", error);
  res.status(500).json({ message: "Unknown server error." });
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[tui.notes.2026][api] listening on http://${HOST}:${PORT} (storage: ${getStorageRootDir()})`,
  );
});
