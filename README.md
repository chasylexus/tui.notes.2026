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

## Auth and ACL

Environment flags:

- `TUI_NOTES_AUTH_MODE=off|observe|enforce` (default: `off`)
- `TUI_NOTES_BOOTSTRAP_OWNER_EMAIL=<email>` (optional owner bootstrap for first login)
- `TUI_NOTES_BOOTSTRAP_OWNER_USER=<userId>` (optional, overrides bootstrap email)
- `TUI_NOTES_AUTH_DB_URL=<postgres-connection-string>` (optional; if unset, ACL is stored in `${rootDir}/acl.json`)

API endpoints:

- `GET /api/me`
- `GET /api/me/capabilities?type=workspace|folder|note&externalId=<id>`
- `GET /api/acl/resource/:resourceType/:resourceExternalId`
- `POST /api/acl/grant`
- `DELETE /api/acl/grant/:bindingId`

UI support:

- In auth modes `observe`/`enforce`, right-click folder/note -> `Access...`
- Supports grants/removals for `user|group|public` with roles `viewer|editor|owner`
- Access writes are sent through ACL API and applied live through SSE

Local ACL tests:

```bash
npm test
```

### Local Keycloak test stack

Ready-to-run local auth stack (Keycloak + OAuth2 Proxy + notes) is in:

- `/Users/alexanderacosta/tui.notes.2026/dev/local-auth-stack`

Includes two precreated users:

- `alice / Alice123!` (owner bootstrap)
- `bob / Bob123!`

Clean reset (recommended before a fresh ACL test run):

```bash
cd /Users/alexanderacosta/tui.notes.2026/dev/local-auth-stack
docker-compose down -v
docker-compose up -d
```

## Future Work

- Delta persistence protocol: send and apply only changed entities/operations instead of full snapshots.
- Release alignment:
  - publish updated `@techie_doubts/tui.editor.2026`, `@techie_doubts/editor-plugin-chart`, `@techie_doubts/tui.chart.2026`;
  - bump dependencies here to published versions and run end-to-end regression pass in Notes UI.

## License

0BSD
