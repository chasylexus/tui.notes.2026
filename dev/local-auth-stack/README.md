# Local auth stack (Keycloak + OAuth2 Proxy + TUI Notes)

This stack starts a local secured environment for ACL checks in two browsers.

## Start

```bash
cd /Users/alexanderacosta/tui.notes.2026/dev/local-auth-stack
docker compose up -d
```

Wait until all services are healthy/running, then open:

- App (through OAuth2 Proxy): http://127.0.0.1:4180
- Keycloak Admin: http://127.0.0.1:8080/admin

Keycloak admin credentials:

- `admin`
- `admin`

Test users (imported automatically):

- `alice` / `Alice123!` (owner bootstrap email: `alice@example.com`)
- `bob` / `Bob123!` (reader group)

## What to test in two browsers

1. Login as `alice` in browser A.
2. Login as `bob` in browser B (incognito or another browser).
3. As `alice`, create a folder and note.
4. Use ACL API (or future UI) to grant `bob` viewer/editor on folder or note.
5. Verify in `bob` session:
   - only allowed data is visible;
   - editing is blocked when only viewer is granted;
   - editing works when editor is granted.

## Stop

```bash
docker compose down
```

To also remove persisted local test data:

```bash
docker compose down -v
```
