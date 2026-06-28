# UI Module Contracts — my-budget v1.0.0

## Overview

Frontend SPA vanilla JS, dipecah jadi modul kecil di `ui/modules/`.
Setiap modul ekspos function ke `window` (no build step).
Di-load via multiple `<script>` tags di `index.html`.

## Module: `api.js`

### `API.get(path) → Promise<{data: any}>`
- **Input:** `path: string` — API path (e.g. `/api/summary`)
- **Output:** `{ data: any }` — parsed JSON response
- **Exceptions:** `Error('Session expired')` jika 401 → auto-logout. `Error(text)` jika non-2xx.
- **Contract:** Bearer token dari `authToken` variable. Timeout: tidak ada (browser default).

### `API.post(path, body) → Promise<{data: any}>`
- **Input:** `path: string`, `body: object`
- **Output:** `{ data: any }`
- **Exceptions:** sama dengan `get`

### `API.put(path, body) → Promise<{data: any}>`
- **Input:** `path: string`, `body: object`
- **Output:** `{ data: any }`
- **Exceptions:** sama dengan `get`

### `API.del(path) → Promise<{data: any}>`
- **Input:** `path: string`
- **Output:** `{ data: any }`
- **Exceptions:** sama dengan `get`

### `handleLogin(e) → void`
- **Input:** `e: SubmitEvent` — form with `email`, `password` fields
- **Output:** none — calls `setAuth()` on success, shows error on fail
- **Exceptions:** caught internally, displayed in `#login-error`

### `setAuth(token, user) → void`
- **Input:** `token: string`, `user: {name?, email, id}`
- **Output:** none — sets `authToken`, `currentUser`, navigates to `summary`

### `logout() → void`
- **Input:** none
- **Output:** none — clears auth, shows login screen

---

## Module: `utils.js`

### `formatIDR(n) → string`
- **Input:** `n: number` (positive, negative, or 0)
- **Output:** `string` — formatted IDR currency (e.g. `Rp 1.500.000`)
- **Edge cases:** `null/undefined → "Rp 0"`, `NaN → "Rp 0"`

### `formatDate(d) → string`
- **Input:** `d: string | Date | null | undefined`
- **Output:** `string` — `"Jan 5, 2026"` format or `"-"` if null/undefined
- **Edge cases:** PB date format `"2026-06-27 00:00:00.000Z"` (space separator) → handled

### `toast(msg, type) → void`
- **Input:** `msg: string`, `type: 'success' | 'error'` (default: `'success'`)
- **Output:** none — shows toast element for 2.5s then hides

### `showModal(title, bodyHtml) → void`
- **Input:** `title: string`, `bodyHtml: string` (HTML content)
- **Output:** none — shows modal overlay

### `closeModal() → void`
- **Input:** none
- **Output:** none — hides modal

### `emptyState(iconSvg, title, desc) → string`
- **Input:** `iconSvg: string` (SVG HTML), `title: string`, `desc: string`
- **Output:** `string` — HTML for empty state component

### `loadingState() → string`
- **Input:** none
- **Output:** `string` — HTML for loading spinner

### `pctColor(pct) → 'green' | 'yellow' | 'red'`
- **Input:** `pct: number` (0-100+)
- **Output:** `'red'` if >90, `'yellow'` if >70, `'green'` otherwise

### `badge(text, type) → string`
- **Input:** `text: string`, `type: 'green'|'red'|'yellow'|'accent'|'neutral'`
- **Output:** `string` — HTML badge span

### `h(s) → string`
- **Input:** `s: any` (string, null, undefined)
- **Output:** `string` — HTML-escaped text (`&`, `<`, `>`, `"` replaced)
- **Edge cases:** `null/undefined → ""`

### `SVG` — object
- **Keys:** `wallet`, `receipt`, `chart`, `target`, `repeat`, `scissors`, `tag`, `debt`
- **Value:** `string` — inline SVG HTML (48x48, Lucide-style)

---

## Module: `router.js`

### `navigate(page) → void`
- **Input:** `page: string` — one of: `summary`, `transactions`, `budgets`, `debts`, `pockets`, `savings-targets`, `recurring-transactions`, `recurring-budgets`, `insights`, `cutoffs`, `categories`
- **Output:** none — updates active nav link, topbar title, calls `renderPage(page)`

### `renderPage(page) → void`
- **Input:** `page: string`
- **Output:** none — sets `#app` innerHTML to loading, calls the appropriate render function

### `toggleSidebar(forceOpen) → void`
- **Input:** `forceOpen: boolean | undefined`
- **Output:** none — toggles sidebar `.open` class

### `PAGE_TITLES` — object
- **Keys:** page names
- **Value:** `string` — display title for mobile topbar

---

## Module: `summary.js`

### `renderSummary() → Promise<void>`
- **Input:** none — reads from `API.get('/api/summary')`
- **Output:** none — renders HTML into `#app`
- **API response shape:**
  ```
  { data: {
    totalIncome: number, totalSpent: number, transactionCount: number,
    totalBudget: number, cutoffDate: string|null,
    pockets: [{id, name, icon, color, balance, isArchived}],
    budgets: [{name, amount, spentAmount}],
    recentTransactions: [{id, title, amount, date}],
    debtSummary: {totalRemaining, activeDebts, totalPaid, paidOffDebts, upcomingPayments},
    totalTransactionsAll: number
  }}
  ```
- **Error handling:** catch → render error message in `#app`

---

## Module: `transactions.js` (v1.1.0)

### `renderTransactions() → Promise<void>`
- Renders table with columns: Date, Title, Category, Type (Income/Expense badge), Amount, Actions

### `showTransactionForm(id?) → Promise<void>`
- Form includes type toggle (Expense/Income) at top
- Categories filtered by selected type (expense→expense cats, income→income cats)
- Amount field is always positive; sign determined by type
- Date defaults to today
- `onTxTypeChange(newType)` — re-fetches categories filtered by new type, updates pocket hint

### `saveTransaction(e, id) → Promise<void>`
- POST/PUT body: `{ title, amount (positive int), type: 'expense'|'income', date, categoryId?, pocketId?, notes? }`
- Backend converts: income → `+amount`, expense → `-amount`

### `deleteTransaction(id) → Promise<void>`

---

## Module: `budgets.js`

### `renderBudgets() → Promise<void>`
### `showBudgetForm(id?) → Promise<void>`
### `saveBudget(e, id) → Promise<void>`
### `deleteBudget(id) → Promise<void>`
- Pattern sama dengan transactions module

---

## Module: `debts.js`

### `renderDebts() → Promise<void>`
### `showDebtForm(id?) → Promise<void>`
### `saveDebt(e, id) → Promise<void>`
### `deleteDebt(id) → Promise<void>`
### `showPayDebtForm(debtId) → Promise<void>`
### `payDebt(e, debtId) → Promise<void>`
- Pattern sama, plus payment form

---

## Module: `pockets.js`

### `renderPockets() → Promise<void>`
### `showPocketForm(id?) → Promise<void>`
### `savePocket(e, id) → Promise<void>`
### `deletePocket(id) → Promise<void>`
### `showTransferForm() → Promise<void>`
### `doTransfer(e) → Promise<void>`
- Pattern sama, plus transfer between pockets

---

## Module: `categories.js` (v1.1.0)

### `renderCategories() → Promise<void>`
- Shows table with columns: Name, Type (Expense/Income badge), Color, Actions

### `showCategoryForm(id?) → Promise<void>`
- Form fields: name, type (select: expense/income, default: expense), color, icon

### `saveCategory(e, id) → Promise<void>`
- POST/PUT body: `{ name, type, icon?, color? }`

### `deleteCategory(id) → Promise<void>`

---

## Module: `cutoffs.js`

### `renderCutoffs() → Promise<void>`
### `showCutoffForm(id?) → Promise<void>`
### `saveCutoff(e, id) → Promise<void>`
### `deleteCutoff(id) → Promise<void>`

---

## Module: `targets.js`

### `renderSavingsTargets() → Promise<void>`
### `showSavingsTargetForm(id?) → Promise<void>`
### `saveSavingsTarget(e, id) → Promise<void>`
### `deleteSavingsTarget(id) → Promise<void>`

---

## Module: `recurring.js`

### `renderRecurringTransactions() → Promise<void>`
### `showRecurringForm(id?) → Promise<void>`
### `saveRecurring(e, id) → Promise<void>`
### `deleteRecurring(id) → Promise<void>`
### `toggleRecurring(id, makeActive) → Promise<void>`
### `generateRecurring() → Promise<void>`

---

## Module: `recurring-budgets.js`

### `renderRecurringBudgets() → Promise<void>`
### `showRecurringBudgetForm(id?) → Promise<void>`
### `saveRecurringBudget(e, id) → Promise<void>`
### `deleteRecurringBudget(id) → Promise<void>`
### `toggleRecurringBudget(id, makeActive) → Promise<void>`
### `generateRecurringBudgets() → Promise<void>`

---

## Module: `insights.js`

### `renderInsights() → Promise<void>`
### `generatePredictions() → Promise<void>`

---

## API Endpoints Reference

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/api/auth/login` | `{email, password}` | `{data: {token, user}}` |
| GET | `/api/auth/me` | — | `{data: user}` |
| GET | `/api/summary` | — | `{data: summary}` |
| GET | `/api/transactions` | — | `{data: [tx]}` |
| POST | `/api/transactions` | `{title, amount, type, date, categoryId?, pocketId?, notes?}` | `{data: tx}` |
| PUT | `/api/transactions/:id` | partial | `{data: tx}` |
| DELETE | `/api/transactions/:id` | — | `{success: true}` |
| GET | `/api/budgets` | — | `{data: [budget]}` |
| POST | `/api/budgets` | `{categoryId?, amount, periodStart?, periodEnd?}` | `{data: budget}` |
| PUT | `/api/budgets/:id` | partial | `{data: budget}` |
| DELETE | `/api/budgets/:id` | — | `{success: true}` |
| GET | `/api/debts` | — | `{data: [debt]}` |
| GET | `/api/debts/summary` | — | `{data: summary}` |
| POST | `/api/debts` | `{name, originalAmount, ...}` | `{data: debt}` |
| PUT | `/api/debts/:id` | partial | `{data: debt}` |
| DELETE | `/api/debts/:id` | — | `{success: true}` |
| POST | `/api/debts/:id/payments` | `{amount, paymentDate, ...}` | `{data: payment}` |
| GET | `/api/pockets` | — | `{data: [pocket]}` |
| POST | `/api/pockets` | `{name, balance, type?, ...}` | `{data: pocket}` |
| PUT | `/api/pockets/:id` | partial | `{data: pocket}` |
| DELETE | `/api/pockets/:id` | — | `{success: true}` |
| POST | `/api/pockets/transfer` | `{fromId, toId, amount}` | `{success: true}` |
| GET | `/api/categories` | — | `{data: [category]}` |
| POST | `/api/categories` | `{name, type?, icon?, color?}` | `{data: category}` |
| PUT | `/api/categories/:id` | partial (name?, type?, icon?, color?) | `{data: category}` |
| DELETE | `/api/categories/:id` | — | `{success: true}` |
| GET | `/api/cutoffs` | — | `{data: [cutoff]}` |
| POST | `/api/cutoffs` | `{title, cutoffDate, notes?}` | `{data: cutoff}` |
| PUT | `/api/cutoffs/:id` | partial | `{data: cutoff}` |
| DELETE | `/api/cutoffs/:id` | — | `{success: true}` |
| GET | `/api/savings-targets` | — | `{data: [target]}` |
| POST | `/api/savings-targets` | `{title, targetAmount, ...}` | `{data: target}` |
| PUT | `/api/savings-targets/:id` | partial | `{data: target}` |
| DELETE | `/api/savings-targets/:id` | — | `{success: true}` |
| GET | `/api/recurring-transactions` | — | `{data: [recurring]}` |
| POST | `/api/recurring-transactions` | `{title, amount, type, ...}` | `{data: recurring}` |
| PUT | `/api/recurring-transactions/:id` | partial | `{data: recurring}` |
| DELETE | `/api/recurring-transactions/:id` | — | `{success: true}` |
| POST | `/api/recurring-transactions/generate` | `{}` | `{data: {generated: n}}` |
| GET | `/api/recurring-budgets` | — | `{data: [recurring]}` |
| POST | `/api/recurring-budgets` | `{title, amount, ...}` | `{data: recurring}` |
| PUT | `/api/recurring-budgets/:id` | partial | `{data: recurring}` |
| DELETE | `/api/recurring-budgets/:id` | — | `{success: true}` |
| POST | `/api/recurring-budgets/generate` | `{}` | `{data: {generated: n}}` |
| GET | `/api/predictions` | — | `{data: [prediction]}` |
| POST | `/api/predictions/generate` | `{monthsHistory?}` | `{data: {generated: n}}` |
| GET | `/api/ai-summaries?limit=10` | — | `{data: [summary]}` |

---

## UI/UX Redesign Requirements

1. **All text in English** — no Indonesian in UI
2. **Lucide-style SVG icons** — no emoji in page headers/titles
3. **Inter font** for text, **JetBrains Mono** for numbers
4. **Grouped sidebar:** Main / Planning / Management
5. **Mobile bottom nav:** Summary, Transactions, Pockets, More
6. **FAB** for Add Transaction (floating action button)
7. **Progress bars** with conditional color: green ≤70%, yellow 71-90%, red >90%
8. **Empty state components** with SVG icon + title + description
9. **Minimalist dark theme** — card-based, clean spacing