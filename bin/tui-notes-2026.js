#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_INDEX_FILE = path.join(ROOT_DIR, "dist", "index.html");

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`tui-notes-2026

Usage:
  tui-notes-2026 [options]

Options:
  --host <host>            API/UI host (default: 127.0.0.1)
  --port <port>            API/UI port (default: 8787)
  --notes-dir <path>       Absolute or ~-prefixed notes directory path
  --root-dir <path>        App storage root directory path (legacy mode)
  --no-build               Skip build step even if dist is missing
  -h, --help               Show this help
`);
}

function readOptionValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (value == null || value.startsWith("-")) {
    throw new Error(`Missing value for option ${optionName}`);
  }
  return value;
}

function resolveRuntimeOptions(argv) {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    TUI_NOTES_SERVE_DIST: "1",
  };

  let shouldBuild = true;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "-h" || token === "--help") {
      printHelp();
      process.exit(0);
    }

    if (token === "--no-build") {
      shouldBuild = false;
      continue;
    }

    if (token === "--host") {
      env.TUI_NOTES_API_HOST = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }

    if (token === "--port") {
      env.TUI_NOTES_API_PORT = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }

    if (token === "--notes-dir") {
      env.TUI_NOTES_NOTES_DIR = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }

    if (token === "--root-dir") {
      env.TUI_NOTES_ROOT_DIR = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return { env, shouldBuild };
}

function ensureDistBundle(shouldBuild, env) {
  if (fs.existsSync(DIST_INDEX_FILE)) {
    return;
  }

  if (!shouldBuild) {
    throw new Error("dist is missing and --no-build was requested");
  }

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCmd, ["run", "build"], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env,
  });

  if (result.status !== 0) {
    throw new Error(`Build failed with code ${String(result.status)}`);
  }
}

function startServer(env) {
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env,
  });

  const terminate = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => terminate("SIGINT"));
  process.on("SIGTERM", () => terminate("SIGTERM"));

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

function main() {
  const argv = process.argv.slice(2);
  const { env, shouldBuild } = resolveRuntimeOptions(argv);
  ensureDistBundle(shouldBuild, env);
  startServer(env);
}

try {
  main();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(`[tui.notes.2026][cli] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
