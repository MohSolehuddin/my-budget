# My Budget

Personal finance manager — PocketBase + Fastify backend, vanilla JS SPA frontend, Tauri v2 Android app.

## Architecture

```
my-budget/
├── src/                          # Backend (Bun + Fastify + TypeScript)
│   ├── domain/
│   │   ├── entities/             # Transaction, Debt
│   │   └── interfaces/           # BudgetService, DebtRepository, ITelegramBotService
│   ├── infrastructure/
│   │   ├── database/pocketbase/  # PocketBaseService (CRUD for all collections)
│   │   ├── web/Server.ts         # Fastify REST API + static file serving
│   │   └── telegram/             # TelegramBot (Telegraf)
│   ├── use-cases/                # Budget logic, daily allowance, debt tracking
│   └── index.ts                  # Entry point — starts server + bot
├── ui/                           # Frontend (vanilla JS SPA, no build step)
│   ├── index.html                # SPA shell — loads 15 modules via <script> tags
│   ├── style.css                 # Dark theme, Inter font, responsive, safe-area
│   ├── contracts/UI_CONTRACTS.md # Module contracts (signatures, API shapes)
│   ├── modules/                  # 15 JS modules (api, utils, router, pages, init)
│   └── tests/                    # Unit tests (api, utils, router, summary)
├── pocketbase/                   # PocketBase Docker setup
├── schema/                       # PB collection schema JSON
├── scripts/                      # PB schema export/seed
├── .env                          # Config (POCKETBASE_URL, TOKEN, TELEGRAM_BOT_TOKEN, PORT)
├── package.json                  # Bun project
└── tsconfig.json
```

## Quick Start

### 1. PocketBase

```bash
cd ~/projects/my-budget/pocketbase
docker compose up -d
# PB runs at http://localhost:8091
```

### 2. Backend

```bash
cd ~/projects/my-budget
cp .env.example .env
# Edit .env: POCKETBASE_URL, POCKETBASE_TOKEN, TELEGRAM_BOT_TOKEN, PORT
bun install
bun run dev          # Development (hot reload)
# OR
bun start            # Production
```

Server runs at `http://localhost:3012`.

### 3. Frontend

No build step needed. UI is served directly by Fastify from `ui/` directory.
Open `http://localhost:3012` in browser.

### 4. Android App

```bash
cd ~/projects/my-budget-app
cargo tauri android build --apk
# APK: src-tauri/gen/android/app/build/outputs/apk/universal/release/
apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android \
  --ks-key-alias androiddebugkey --key-pass pass:android \
  --out my-budget.apk app-universal-release-unsigned.apk
```

## PocketBase Collections

| Collection | Key Fields | Notes |
|---|---|---|
| `users` | email, name | Auth collection. Registration disabled — admin only. |
| `transactions` | title, amount, date, type, categoryId, pocketId, user, source | amount: +income / -expense. source: manual/telegram/import |
| `budgets` | categoryId, amount, periodStart, periodEnd | Period-based budget per category |
| `debts` | name, type, originalAmount, remainingAmount, status | type: loan/credit_card/paylater/installment |
| `debt_payments` | debtId, amount, paymentDate, paymentMethod | Linked to debts |
| `pockets` | name, balance, type, icon, color, accountNumber, bankName | type: cash/bank/ewallet/investment |
| `categories` | name, icon, color | Transaction categories |
| `cutoffs` | title, cutoffDate, notes | Pre-cutoff transactions excluded from dashboard |
| `savings_targets` | title, targetAmount, currentAmount, targetDate, targetType | targetType: pocket/investment |
| `recurring_transactions` | title, amount, type, dayOfMonth, frequency, isActive | Auto-generate transactions |
| `recurring_budgets` | title, amount, categoryId, dayOfMonth, frequency, isActive | Auto-generate budgets |
| `predictions` | type, predictedAmount, targetMonth, confidence | AI-generated predictions |
| `ai_summaries` | summaryText, summaryDate, totalIncome, totalExpense, net | AI daily summary (cron 19:00) |

**Collection rules:** `@request.auth.id != ""` for all collections.

**PB date format:** `"2026-06-27 00:00:00.000Z"` (space separator, not T).

## API Endpoints

### Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/login` | `{email, password}` | `{data: {token, user}}` |
| GET | `/api/auth/me` | — | `{data: user}` |
| POST | `/api/auth/register` | — | 403 (disabled) |

### Summary
| Method | Path | Returns |
|---|---|---|
| GET | `/api/summary` | Income, spent, net, pockets, budgets, recent transactions, debt summary, cutoff info |

### Transactions
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/transactions` | — | `{data: [tx]}` (filtered by cutoff) |
| POST | `/api/transactions` | `{title, amount, date, categoryId?, pocketId?, notes?}` | `{data: tx}` |
| PUT | `/api/transactions/:id` | partial | `{data: tx}` |
| DELETE | `/api/transactions/:id` | — | `{success: true}` |

### Budgets, Debts, Pockets, Categories, Cutoffs, Savings Targets, Recurring Transactions, Recurring Budgets, Predictions, AI Summaries
All follow standard CRUD pattern: `GET /api/<resource>`, `POST /api/<resource>`, `PUT /api/:id`, `DELETE /api/:id`.

Special endpoints:
| Method | Path | Notes |
|---|---|---|
| POST | `/api/debts/:id/payments` | Record debt payment |
| GET | `/api/debts/summary` | Debt stats + upcoming payments |
| POST | `/api/pockets/transfer` | `{fromId, toId, amount}` |
| POST | `/api/recurring-transactions/generate` | Auto-generate due transactions |
| POST | `/api/recurring-budgets/generate` | Auto-generate due budgets |
| POST | `/api/predictions/generate` | Generate predictions from history |
| GET | `/api/ai-summaries?limit=N` | Recent AI summaries |

## UI Architecture

### Module System (no build step)

`index.html` loads 15 modules via `<script>` tags in order:

```
utils.js → api.js → router.js → summary.js → transactions.js → budgets.js →
debts.js → pockets.js → categories.js → cutoffs.js → targets.js →
recurring.js → recurring-budgets.js → insights.js → init.js
```

All functions are global (no imports/exports). See `ui/contracts/UI_CONTRACTS.md` for full signatures.

### Key Design Decisions

- **Vanilla JS** — no React/Vue/Vite, no build step, no npm for frontend
- **Dark theme** — `#0b0f14` background, Inter font, JetBrains Mono for numbers
- **Safe area** — `env(safe-area-inset-*)` CSS variables for Android notch/status bar
- **Grouped sidebar** — Main (Summary, Transactions, Insights) / Planning (Budgets, Targets, Recurring) / Management (Pockets, Debts, Categories, Cutoffs)
- **Mobile** — hamburger drawer + bottom nav (4 items + More) + FAB for Add Transaction
- **Cutoff strategy** — pre-cutoff transactions excluded from dashboard but still counted for pocket balances
- **Auth** — JWT from PocketBase, stored in `localStorage['pb_token']`. Auto-logout on 401.
- **Registration disabled** — only PB admin can create users

### Cutoff System

Cutoff date = boundary. Transactions before cutoff are:
- **Excluded** from: dashboard stats, transactions list, budget progress
- **Included** in: pocket balance calculations (all-time)

This lets users "start fresh" without losing historical data.

## Environment Variables

```env
POCKETBASE_URL=http://localhost:8091
POCKETBASE_TOKEN=<superuser token>
TELEGRAM_BOT_TOKEN=<bot token>
HOST=0.0.0.0
PORT=3012
LOG_LEVEL=info
```

**Important:** `POCKETBASE_TOKEN` must be regenerated if admin password is changed via PB panel.

## Production Deployment

### systemd service

```bash
# ~/.config/systemd/user/my-budget.service
[Unit]
Description=My Budget Service
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/projects/my-budget
ExecStart=%h/.npm-global/bin/bun run src/index.ts
Restart=on-failure
Environment=PATH=%h/.bun/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable my-budget
systemctl --user start my-budget
```

### Reverse proxy

Caddy/Nginx proxies `budget.msytc.my.id` → `localhost:3012`.

## Tauri Android App

Located at `~/projects/my-budget-app/`. Web-wrapper that opens `https://budget.msytc.my.id`.

```
my-budget-app/
├── src/
│   └── index.html       # Loading screen → redirect to budget.msytc.my.id
└── src-tauri/
    ├── Cargo.toml        # tauri 2, tauri-plugin-opener, serde, serde_json
    ├── tauri.conf.json   # com.msytc.mybudget, CSP allows HTTPS
    ├── capabilities/main.json
    ├── build.rs
    ├── src/lib.rs        # Entry point (mobile_entry_point)
    └── src/main.rs       # Desktop fallback
```

**Build:**
```bash
export JAVA_HOME=~/jdk17
export ANDROID_HOME=~/android-sdk
export NDK_HOME="$ANDROID_HOME/ndk/27.0.12077973"
cd ~/projects/my-budget-app
cargo tauri android build --apk
apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android \
  --ks-key-alias androiddebugkey --key-pass pass:android \
  --out my-budget.apk <unsigned-apk>
```

**Safe area:** CSS in `ui/style.css` uses `env(safe-area-inset-*)` variables. The Tauri app renders behind the status bar — without these, content overlaps the clock/battery bar.

## Cron Jobs

| Job | Schedule | Description |
|---|---|---|
| AI Summary | 19:00 UTC | Fetch data, generate AI summary, save to PB, send to Telegram |

## Tech Stack

- **Runtime:** Bun
- **Backend:** Fastify 5, TypeScript, `@fastify/static`, `@fastify/cookie`
- **Database:** PocketBase 0.36 (Docker container `my-budget-pb`, port 8091)
- **Frontend:** Vanilla JS, Inter + JetBrains Mono fonts, dark theme
- **Mobile:** Tauri v2 (Rust + Android NDK)
- **Bot:** Telegraf 4
- **Tests:** Node.js built-in test runner

## Development Rules

1. **Contract first** — write/update `ui/contracts/UI_CONTRACTS.md` before implementing
2. **Unit tests** — every new utility function needs tests in `ui/tests/`
3. **Anti-crash** — all API calls wrapped in try-catch, graceful fallback
4. **Null safety** — optional chaining, validate all external data
5. **HTML escape** — use `h()` for all user-generated content in templates
6. **Git** — prefix: `feat:`/`fix:`/`docs:`/`refactor:`/`test:`/`chore:`, max 72 char, imperative
7. **Push** — 1x per feature
8. **Safe area** — always handle `env(safe-area-inset-*)` for mobile

## License

MIT