# @techie_doubts/tui.notes.2026

Local-first notes app with Apple Notes-style UI.

## Quick start

```bash
npm i -g @techie_doubts/tui.notes.2026
tui-notes-2026
```

Open `http://127.0.0.1:8787`

Without global install:

```bash
npx @techie_doubts/tui.notes.2026
```

## Storage

- Notes: `~/.tui.notes.2026/notes`
- Trash: `~/.tui.notes.2026/trash`
- State: `~/.tui.notes.2026/state.json`

On startup, existing `.md` files in the notes directory are imported.

## Config

Use `~/.tui.notes.2026/config.json` (global) or `./tui-notes.config.json` (local override):

```json
{
  "notesDir": "~/Documents/MyNotes"
}
```

Precedence: CLI/env > local config > global config > default path.

## CLI

```text
tui-notes-2026 [options]
--host <host>
--port <port>
--notes-dir <path>
--root-dir <path>
--no-build
--help
```

## Future Work

- Delta persistence protocol: send and apply only changed entities/operations instead of full snapshots.
- Move temporary package patches from this app to upstream packages:
  - `@techie_doubts/tui.editor.2026`: keep paste focus without scroll jumps (`clipboard.focus({ preventScroll: true })` fallback-safe).
  - `@techie_doubts/editor-plugin-chart`: deep-merge plugin `chartOptions` with block options and expose `y.thousands` intent to tooltip formatting.
  - `@techie_doubts/tui.chart.2026` / chart plugin layer: make shared tooltip behavior first-class (all series for hovered X, stable rendering/no flicker, consistent decimals and separators, explicit missing-value rendering).

## License

0BSD
