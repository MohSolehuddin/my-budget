# CLAUDE.md — Agent Guide for my-budget

> Read this before working on this project.

## Project Overview

Personal finance manager. PocketBase-only persistence (no Actual Budget sync). Backend: Bun + Fastify + TypeScript. Frontend: vanilla JS SPA, no build step. Android: Tauri v2 web-wrapper.

## Paths

- **Backend:** `~/projects/my-budget/src/`
- **Frontend:** `~/projects/my-budget/ui/`
- **Android app:** `~/projects/my-budget-app/`
- **PocketBase:** Docker container `my-budget-pb`, port 8091
- **Server:** systemd service `my-budget`, port 3012
- **URL:** `https://budget.msytc.my.id` (reverse proxy → localhost:3012)

## Critical Knowledge

### PocketBase v0.36
- Auth uses `identity` field, NOT `email` (PB v0.36+ breaking change)
- Superuser auth: `POST /api/collections/_superusers/auth-with-password` with `{identity, password}`
- Date format: `"2026-06-27 00:00:00.000Z"` (space separator, not T)
- `pockets.balance` is optional (required=false) — accepts 0. Acts as **initial balance**; actual balance = initial + sum of all transactions for that pocket.
- Collection rules: `@request.auth.id != ""` for all collections

### Server (Server.ts)
- `getVerifiedUserId()` — decodes JWT + verifies user exists in PB before any create. Returns 401 if expired → UI auto-logout.
- Cutoff filter: summary and transactions endpoints exclude pre-cutoff data. Pocket balances include all transactions.
- Transfer category excluded from income/spent calculations.
- Registration disabled — `/api/auth/register` returns 403.

### Frontend (ui/modules/)
- 15 global JS modules loaded via `<script>` tags in `index.html` (no build step)
- All functions are global — no imports/exports
- Contract: `ui/contracts/UI_CONTRACTS.md` — read before modifying any module
- `h()` for HTML escape, `formatIDR()` for currency, `formatDate()` for dates
- `API.get/post/put/del` — all include Bearer token, auto-logout on 401
- Safe area: CSS variables `--safe-top/bottom/left/right = env(safe-area-inset-*, 0px)`

### Tauri Android (my-budget-app/)
- Web-wrapper: opens `https://budget.msytc.my.id`
- `ANDROID_HOME=~/android-sdk` (NOT `~/Android/Sdk` — that's empty)
- `NDK_HOME=~/android-sdk/ndk/27.0.12077973`
- `JAVA_HOME=~/jdk17` (OpenJDK 17.0.19 Temurin)
- `usesCleartextTraffic=true` in `build.gradle.kts` defaultConfig
- Sign APK: `apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android`

## Common Tasks

### Restart server after code changes
```bash
systemctl --user restart my-budget
```

### Rebuild APK after UI changes
CSS/JS is served from the server — no APK rebuild needed for web UI changes.
Only rebuild APK if Tauri config or native code changes.

### Add a new UI page
1. Create `ui/modules/<page>.js` with `render<Page>()` function
2. Add `<script src="/modules/<page>.js">` to `index.html` before `init.js`
3. Add page to `renderPage()` switch in `ui/modules/router.js`
4. Add nav link in `index.html` sidebar + `PAGE_TITLES` in router
5. Update `ui/contracts/UI_CONTRACTS.md` with new module contract

### Reset user password
```python
import json, urllib.request
# Auth as superuser
req = urllib.request.Request('http://localhost:8091/api/collections/_superusers/auth-with-password',
  data=json.dumps({'identity': 'admin@mybudget.local', 'password': 'admin123'}).encode(),
  headers={'Content-Type': 'application/json'}, method='POST')
token = json.loads(urllib.request.urlopen(req).read())['token']
# Reset user password
req2 = urllib.request.Request('http://localhost:8091/api/collections/users/records/USER_ID',
  data=json.dumps({'password': 'newpass', 'passwordConfirm': 'newpass'}).encode(),
  headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}, method='PATCH')
json.loads(urllib.request.urlopen(req2).read())
```

## Do NOT

- Do NOT install Actual Budget packages or attempt Actual Budget sync — deprecated, removed
- Do NOT use `source: 'web'` for transactions — use `'manual'` (PB select validation)
- Do NOT use `src/infrastructure/actual-budget/` — dead code, do not reference
- Do NOT store session/cache/uploads on local filesystem — stateless
- Do NOT hardcode secrets — use `.env`

## Testing

```bash
# Frontend unit tests (Node.js 18+)
node --test ui/tests/api.test.js     # API helper tests
node --test ui/tests/utils.test.js   # formatIDR, formatDate, h, pctColor, badge, emptyState
node --test ui/tests/router.test.js  # Router function existence
node --test ui/tests/summary.test.js # renderSummary existence

# Backend type check
cd ~/projects/my-budget && bun run build   # tsc --noEmit
```

## Git Conventions

- Prefix: `feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`
- Max 72 chars per subject line
- Imperative mood: "add feature" not "added feature"
- Push 1x per feature