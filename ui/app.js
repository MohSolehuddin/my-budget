// ===== AUTH STATE =====
let authToken = localStorage.getItem('pb_token') || null;
let currentUser = null;

function setAuth(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('pb_token', token);
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('user-display').textContent = user.name || user.email;
  navigate('summary');
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('pb_token');
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('login-form').reset();
  document.getElementById('register-form').reset();
}

// ===== AUTH API =====
async function handleLogin(e) {
  e.preventDefault();
  const f = e.target;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: f.email.value, password: f.password.value }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login failed'; errEl.classList.remove('hidden'); return; }
    setAuth(data.data.token, data.data.user);
  } catch (e) {
    errEl.textContent = 'Network error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const f = e.target;
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');
  if (f.password.value !== f.passwordConfirm.value) {
    errEl.textContent = 'Passwords do not match';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: f.email.value, password: f.password.value, passwordConfirm: f.passwordConfirm.value, name: f.name.value }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Registration failed'; errEl.classList.remove('hidden'); return; }
    toast('Registration successful! Please login.', 'success');
    switchAuthTab('login');
    document.getElementById('login-form').email.value = f.email.value;
  } catch (e) {
    errEl.textContent = 'Network error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.auth-tab:nth-child(${tab === 'login' ? '1' : '2'})`).classList.add('active');
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('register-error').classList.add('hidden');
}

// ===== API HELPERS =====
const API = {
  async get(path) {
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async post(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async put(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async del(path) {
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { method: 'DELETE', headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

// ===== UTILS =====
function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => el.classList.add('hidden'), 2500);
}
function showModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// ===== ROUTER =====
let currentPage = 'summary';

// Mobile sidebar toggle (hamburger). Pass explicit bool to set state.
function toggleSidebar(forceOpen) {
  const sb = document.getElementById('sidebar');
  if (forceOpen === false) { sb.classList.remove('open'); return; }
  sb.classList.toggle('open');
}

function bindNavLinks() {
  document.querySelectorAll('.nav-link, .bottom-nav-link').forEach(link => {
    // Avoid double-binding: mark bound links with a data attribute
    if (link.dataset.bound === '1') return;
    link.dataset.bound = '1';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      navigate(page);
      // Close mobile drawer on navigation
      toggleSidebar(false);
    });
  });
}
bindNavLinks();

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-link, .bottom-nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll(`[data-page="${page}"]`).forEach(l => l.classList.add('active'));
  renderPage(page);
}

function renderPage(page) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">Loading...</div>';
  switch (page) {
    case 'summary': renderSummary(); break;
    case 'transactions': renderTransactions(); break;
    case 'budgets': renderBudgets(); break;
    case 'debts': renderDebts(); break;
    case 'pockets': renderPockets(); break;
    case 'savings-targets': renderSavingsTargets(); break;
    case 'recurring-transactions': renderRecurringTransactions(); break;
    case 'recurring-budgets': renderRecurringBudgets(); break;
    case 'insights': renderInsights(); break;
    case 'cutoffs': renderCutoffs(); break;
    case 'categories': renderCategories(); break;
    default: app.innerHTML = '<div class="card"><div class="empty">Unknown page</div></div>';
  }
}

// ===== SUMMARY PAGE =====
async function renderSummary() {
  const app = document.getElementById('app');
  try {
    const { data } = await API.get('/api/summary');
    const ds = data.debtSummary || {};
    const spentPct = data.totalBudget > 0 ? Math.round((data.totalSpent / data.totalBudget) * 100) : 0;
    const pctColor = spentPct > 90 ? 'red' : spentPct > 70 ? 'yellow' : 'green';

    app.innerHTML = `
      <div class="page-header"><h1>📊 Dashboard</h1></div>
      
      ${data.cutoffDate ? `
      <div style="margin-bottom:16px;padding:10px 16px;background:var(--surface2);border-radius:8px;font-size:.85rem;color:var(--text2);display:flex;align-items:center;gap:8px">
        ✂️ <span>Cutoff aktif: <strong style="color:var(--yellow)">${formatDate(data.cutoffDate)}</strong> — transaksi sebelum ini diexclude dari dashboard</span>
      </div>` : ''}
      
      <!-- Pocket Balances -->
      ${data.pockets && data.pockets.length ? `
      <div class="card" style="margin-bottom:20px">
        <h2>👛 Saldo Kantong</h2>
        <div class="stat-grid">
          ${data.pockets.filter(p => !p.isArchived).map(p => `
            <div class="stat-card">
              <div class="label">${h(p.icon || '💳')} ${h(p.name)}</div>
              <div class="value ${p.balance < 0 ? 'red' : 'green'}">${formatIDR(p.balance)}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Total Income</div>
          <div class="value green">${formatIDR(data.totalIncome || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Spent</div>
          <div class="value red">${formatIDR(data.totalSpent || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Net</div>
          <div class="value ${(data.totalIncome || 0) - (data.totalSpent || 0) < 0 ? 'red' : 'green'}">${formatIDR((data.totalIncome || 0) - (data.totalSpent || 0))}</div>
        </div>
        <div class="stat-card">
          <div class="label">Transactions</div>
          <div class="value">${data.transactionCount}</div>
        </div>
        ${ds.totalDebt !== undefined ? `
        <div class="stat-card">
          <div class="label">Total Debt</div>
          <div class="value yellow">${formatIDR(ds.totalRemaining || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Active Debts</div>
          <div class="value">${ds.activeDebts || 0}</div>
        </div>` : ''}
      </div>

      <div class="card" style="margin-top:20px">
        <h2>Budget Progress</h2>
        ${data.budgets && data.budgets.length ? data.budgets.map(b => {
          const pct = b.amount > 0 ? Math.round((b.spentAmount / b.amount) * 100) : 0;
          const c = pct > 90 ? 'red' : pct > 70 ? 'yellow' : 'green';
          return `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span>${h(b.name)}</span>
              <span style="font-size:.85rem;color:var(--text2)">${formatIDR(b.spentAmount)} / ${formatIDR(b.amount)}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill ${c}" style="width:${Math.min(pct,100)}%"></div></div>
          </div>`;
        }).join('') : '<div class="empty">No budgets yet</div>'}
      </div>

      <div class="card">
        <h2>Recent Transactions</h2>
        ${data.recentTransactions && data.recentTransactions.length ? `
        <table>
          <thead><tr><th>Date</th><th>Title</th><th>Amount</th></tr></thead>
          <tbody>${data.recentTransactions.map(t => `
            <tr><td>${formatDate(t.date)}</td><td>${h(t.title)}</td><td>${formatIDR(t.amount)}</td></tr>
          `).join('')}</tbody>
        </table>` : '<div class="empty">No transactions yet</div>'}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

// ===== TRANSACTIONS PAGE =====
async function renderTransactions() {
  const app = document.getElementById('app');
  try {
    const { data: transactions } = await API.get('/api/transactions');
    const { data: categories } = await API.get('/api/categories');
    const catMap = {};
    categories.forEach(c => catMap[c.id] = c.name);

    app.innerHTML = `
      <div class="page-header">
        <h1>💸 Transactions</h1>
        <button class="btn btn-primary" onclick="showTransactionForm()">+ Add Transaction</button>
      </div>
      <div class="card">
        ${transactions.length ? `
        <table>
          <thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th></th></tr></thead>
          <tbody>${transactions.map(t => `
            <tr>
              <td>${formatDate(t.date)}</td>
              <td>${h(t.title)}</td>
              <td>${h(catMap[t.categoryId] || '-')}</td>
              <td>${formatIDR(t.amount)}</td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="showTransactionForm('${t.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTransaction('${t.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<div class="empty">No transactions yet</div>'}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

async function showTransactionForm(id) {
  let tx = { title: '', amount: '', date: new Date().toISOString().split('T')[0], categoryId: '', notes: '' };
  let title = 'Add Transaction';

  if (id) {
    title = 'Edit Transaction';
    try {
      const { data: all } = await API.get('/api/transactions');
      tx = all.find(t => t.id === id) || tx;
    } catch (e) { /* use defaults */ }
  }

  try {
    const { data: categories } = await API.get('/api/categories');
    const { data: pockets } = await API.get('/api/pockets');
    const catOptions = categories.map(c => `<option value="${c.id}" ${tx.categoryId === c.id ? 'selected' : ''}>${h(c.name)}</option>`).join('');
    const pocketOptions = pockets.filter(p => !p.isArchived).map(p => `<option value="${p.id}" ${tx.pocketId === p.id ? 'selected' : ''}>${h(p.icon || '💳')} ${h(p.name)}</option>`).join('');

    showModal(title, `
      <form onsubmit="saveTransaction(event, '${id || ''}')">
        <div class="form-group">
          <label>Title</label>
          <input name="title" value="${h(tx.title)}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Amount (IDR)</label>
            <input name="amount" type="number" value="${tx.amount || ''}" required>
          </div>
          <div class="form-group">
            <label>Date</label>
            <input name="date" type="date" value="${tx.date || ''}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <select name="categoryId"><option value="">-- None --</option>${catOptions}</select>
          </div>
          <div class="form-group">
            <label>Pocket (Kantong)</label>
            <select name="pocketId"><option value="">-- None --</option>${pocketOptions}</select>
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <input name="notes" value="${h(tx.notes || '')}">
        </div>
        <button class="btn btn-primary" style="width:100%">Save</button>
      </form>
    `);
  } catch (e) {
    toast('Failed to load form: ' + e.message, 'error');
  }
}

async function saveTransaction(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    title: f.title.value,
    amount: parseInt(f.amount.value) || 0,
    date: f.date.value,
    categoryId: f.categoryId.value || undefined,
    pocketId: f.pocketId.value || undefined,
    notes: f.notes.value || undefined,
  };
  try {
    if (id) {
      await API.put(`/api/transactions/${id}`, body);
      toast('Transaction updated');
    } else {
      await API.post('/api/transactions', body);
      toast('Transaction added');
    }
    closeModal();
    renderTransactions();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  try {
    await API.del(`/api/transactions/${id}`);
    toast('Transaction deleted');
    renderTransactions();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

// ===== BUDGETS PAGE =====
async function renderBudgets() {
  const app = document.getElementById('app');
  try {
    const { data: budgets } = await API.get('/api/budgets');
    const { data: categories } = await API.get('/api/categories');
    const catMap = {};
    categories.forEach(c => catMap[c.id] = c.name);

    app.innerHTML = `
      <div class="page-header">
        <h1>🎯 Budgets</h1>
        <button class="btn btn-primary" onclick="showBudgetForm()">+ Add Budget</button>
      </div>
      <div class="card">
        ${budgets.length ? `
        <table>
          <thead><tr><th>Category</th><th>Amount</th><th>Period</th><th></th></tr></thead>
          <tbody>${budgets.map(b => `
            <tr>
              <td>${h(catMap[b.categoryId] || b.name)}</td>
              <td>${formatIDR(b.amount)}</td>
              <td>${formatDate(b.periodStart)} → ${formatDate(b.periodEnd)}</td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="showBudgetForm('${b.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBudget('${b.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<div class="empty">No budgets yet</div>'}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

async function showBudgetForm(id) {
  let budget = { categoryId: '', amount: '', periodStart: new Date().toISOString().split('T')[0], periodEnd: '' };
  let title = 'Add Budget';

  if (id) {
    title = 'Edit Budget';
    try {
      const { data: all } = await API.get('/api/budgets');
      budget = all.find(b => b.id === id) || budget;
    } catch (e) { /* use defaults */ }
  }

  try {
    const { data: categories } = await API.get('/api/categories');
    const catOptions = categories.map(c => `<option value="${c.id}" ${budget.categoryId === c.id ? 'selected' : ''}>${h(c.name)}</option>`).join('');

    showModal(title, `
      <form onsubmit="saveBudget(event, '${id || ''}')">
        <div class="form-group">
          <label>Category</label>
          <select name="categoryId" required><option value="">-- Select --</option>${catOptions}</select>
        </div>
        <div class="form-group">
          <label>Amount (IDR)</label>
          <input name="amount" type="number" value="${budget.amount || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Period Start</label>
            <input name="periodStart" type="date" value="${budget.periodStart || ''}">
          </div>
          <div class="form-group">
            <label>Period End</label>
            <input name="periodEnd" type="date" value="${budget.periodEnd || ''}">
          </div>
        </div>
        <button class="btn btn-primary" style="width:100%">Save</button>
      </form>
    `);
  } catch (e) {
    toast('Failed to load form: ' + e.message, 'error');
  }
}

async function saveBudget(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    categoryId: f.categoryId.value || undefined,
    amount: parseInt(f.amount.value) || 0,
    periodStart: f.periodStart.value || undefined,
    periodEnd: f.periodEnd.value || undefined,
  };
  try {
    if (id) {
      await API.put(`/api/budgets/${id}`, body);
      toast('Budget updated');
    } else {
      await API.post('/api/budgets', body);
      toast('Budget added');
    }
    closeModal();
    renderBudgets();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteBudget(id) {
  if (!confirm('Delete this budget?')) return;
  try {
    await API.del(`/api/budgets/${id}`);
    toast('Budget deleted');
    renderBudgets();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

// ===== DEBTS PAGE =====
async function renderDebts() {
  const app = document.getElementById('app');
  try {
    const { data: debts } = await API.get('/api/debts');
    const { data: summary } = await API.get('/api/debts/summary');

    app.innerHTML = `
      <div class="page-header">
        <h1>🏦 Debts</h1>
        <button class="btn btn-primary" onclick="showDebtForm()">+ Add Debt</button>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Total Debt</div>
          <div class="value yellow">${formatIDR(summary.totalRemaining || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Paid</div>
          <div class="value green">${formatIDR(summary.totalPaid || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Active</div>
          <div class="value">${summary.activeDebts || 0}</div>
        </div>
        <div class="stat-card">
          <div class="label">Paid Off</div>
          <div class="value green">${summary.paidOffDebts || 0}</div>
        </div>
      </div>

      <div class="card" style="margin-top:20px">
        ${debts.length ? `
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Remaining</th><th>Original</th><th>Status</th><th></th></tr></thead>
          <tbody>${debts.map(d => `
            <tr>
              <td><strong>${h(d.name)}</strong>${d.creditor ? `<br><small style="color:var(--text2)">${h(d.creditor)}</small>` : ''}</td>
              <td>${h(d.type)}</td>
              <td>${formatIDR(d.remainingAmount)}</td>
              <td>${formatIDR(d.originalAmount)}</td>
              <td><span style="color:${d.status === 'paid_off' ? 'var(--green)' : d.status === 'active' ? 'var(--yellow)' : 'var(--red)'}">${h(d.status)}</span></td>
              <td class="actions">
                <button class="btn btn-sm btn-green" onclick="showPayDebtForm('${d.id}')">Pay</button>
                <button class="btn btn-sm btn-outline" onclick="showDebtForm('${d.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteDebt('${d.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<div class="empty">No debts yet</div>'}
      </div>

      ${summary.upcomingPayments && summary.upcomingPayments.length ? `
      <div class="card">
        <h2>Upcoming Payments (30 days)</h2>
        <table>
          <thead><tr><th>Debt</th><th>Amount</th><th>Due</th><th>Days Left</th></tr></thead>
          <tbody>${summary.upcomingPayments.map(p => `
            <tr>
              <td>${h(p.name)}</td>
              <td>${formatIDR(p.amount)}</td>
              <td>${formatDate(p.dueDate)}</td>
              <td style="color:${p.daysUntilDue <= 3 ? 'var(--red)' : p.daysUntilDue <= 7 ? 'var(--yellow)' : 'var(--green)'}">${p.daysUntilDue} days</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>` : ''}
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

async function showDebtForm(id) {
  let debt = {
    name: '', type: 'loan', originalAmount: '', remainingAmount: '',
    creditor: '', interestRate: '', termMonths: '', startDate: new Date().toISOString().split('T')[0],
    dueDate: '', notes: '', status: 'active',
  };
  let title = 'Add Debt';

  if (id) {
    title = 'Edit Debt';
    try {
      const { data: all } = await API.get('/api/debts');
      const found = all.find(d => d.id === id);
      if (found) debt = { ...debt, ...found };
    } catch (e) { /* use defaults */ }
  }

  showModal(title, `
    <form onsubmit="saveDebt(event, '${id || ''}')">
      <div class="form-group">
        <label>Name</label>
        <input name="name" value="${h(debt.name)}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select name="type">
            <option value="loan" ${debt.type === 'loan' ? 'selected' : ''}>Loan</option>
            <option value="credit_card" ${debt.type === 'credit_card' ? 'selected' : ''}>Credit Card</option>
            <option value="paylater" ${debt.type === 'paylater' ? 'selected' : ''}>Paylater</option>
            <option value="installment" ${debt.type === 'installment' ? 'selected' : ''}>Installment</option>
            <option value="other" ${debt.type === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Creditor</label>
          <input name="creditor" value="${h(debt.creditor || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Original Amount</label>
          <input name="originalAmount" type="number" value="${debt.originalAmount || ''}" required>
        </div>
        <div class="form-group">
          <label>Remaining Amount</label>
          <input name="remainingAmount" type="number" value="${debt.remainingAmount || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Interest Rate (%)</label>
          <input name="interestRate" type="number" step="0.01" value="${debt.interestRate || ''}">
        </div>
        <div class="form-group">
          <label>Term (months)</label>
          <input name="termMonths" type="number" value="${debt.termMonths || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Start Date</label>
          <input name="startDate" type="date" value="${debt.startDate || ''}">
        </div>
        <div class="form-group">
          <label>Due Date</label>
          <input name="dueDate" type="date" value="${debt.dueDate || ''}">
        </div>
      </div>
      ${id ? `
      <div class="form-group">
        <label>Status</label>
        <select name="status">
          <option value="active" ${debt.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="paid_off" ${debt.status === 'paid_off' ? 'selected' : ''}>Paid Off</option>
          <option value="defaulted" ${debt.status === 'defaulted' ? 'selected' : ''}>Defaulted</option>
          <option value="on_hold" ${debt.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
        </select>
      </div>` : ''}
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes" rows="2">${h(debt.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary" style="width:100%">Save</button>
    </form>
  `);
}

async function saveDebt(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    name: f.name.value,
    type: f.type.value,
    originalAmount: parseInt(f.originalAmount.value) || 0,
    remainingAmount: parseInt(f.remainingAmount.value) || parseInt(f.originalAmount.value) || 0,
    creditor: f.creditor.value || undefined,
    interestRate: f.interestRate.value ? parseFloat(f.interestRate.value) : undefined,
    termMonths: f.termMonths.value ? parseInt(f.termMonths.value) : undefined,
    startDate: f.startDate.value || undefined,
    dueDate: f.dueDate.value || undefined,
    notes: f.notes.value || undefined,
  };
  if (id) body.status = f.status?.value;

  try {
    if (id) {
      await API.put(`/api/debts/${id}`, body);
      toast('Debt updated');
    } else {
      await API.post('/api/debts', body);
      toast('Debt added');
    }
    closeModal();
    renderDebts();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteDebt(id) {
  if (!confirm('Delete this debt?')) return;
  try {
    await API.del(`/api/debts/${id}`);
    toast('Debt deleted');
    renderDebts();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function showPayDebtForm(debtId) {
  try {
    const { data: all } = await API.get('/api/debts');
    const debt = all.find(d => d.id === debtId);
    if (!debt) { toast('Debt not found', 'error'); return; }

    showModal(`Pay: ${debt.name}`, `
      <div style="margin-bottom:16px;color:var(--text2)">
        Remaining: <strong>${formatIDR(debt.remainingAmount)}</strong>
      </div>
      <form onsubmit="payDebt(event, '${debtId}')">
        <div class="form-group">
          <label>Amount</label>
          <input name="amount" type="number" value="${debt.remainingAmount}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Payment Date</label>
            <input name="paymentDate" type="date" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label>Method</label>
            <select name="paymentMethod">
              <option value="transfer">Transfer</option>
              <option value="cash">Cash</option>
              <option value="auto_debit">Auto Debit</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <input name="notes">
        </div>
        <button class="btn btn-green" style="width:100%">Submit Payment</button>
      </form>
    `);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function payDebt(e, debtId) {
  e.preventDefault();
  const f = e.target;
  const body = {
    amount: parseInt(f.amount.value) || 0,
    paymentDate: f.paymentDate.value,
    paymentMethod: f.paymentMethod.value,
    notes: f.notes.value || undefined,
  };
  try {
    await API.post(`/api/debts/${debtId}/payments`, body);
    toast('Payment recorded');
    closeModal();
    renderDebts();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

// ===== POCKETS PAGE =====
async function renderPockets() {
  const app = document.getElementById('app');
  try {
    const { data: pockets } = await API.get('/api/pockets');
    const totalBalance = pockets.filter(p => !p.isArchived).reduce((sum, p) => sum + (p.balance || 0), 0);

    app.innerHTML = `
      <div class="page-header">
        <h1>👛 Pockets</h1>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" onclick="showTransferForm()">🔄 Transfer</button>
          <button class="btn btn-primary" onclick="showPocketForm()">+ Add Pocket</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Total Saldo</div>
          <div class="value ${totalBalance < 0 ? 'red' : 'green'}">${formatIDR(totalBalance)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Jumlah Kantong</div>
          <div class="value">${pockets.filter(p => !p.isArchived).length}</div>
        </div>
      </div>

      <div class="card" style="margin-top:20px">
        <div class="table-wrap">
        ${pockets.length ? `
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Account</th><th>Balance</th><th></th></tr></thead>
          <tbody>${pockets.map(p => `
            <tr style="${p.isArchived ? 'opacity:0.5' : ''}">
              <td>
                <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${h(p.color || '#3b82f6')};margin-right:8px"></span>
                ${h(p.icon || '💳')} <strong>${h(p.name)}</strong>
                ${p.isArchived ? '<span style="color:var(--text2);font-size:.75rem;margin-left:8px">(archived)</span>' : ''}
              </td>
              <td><span style="font-size:.8rem;color:var(--text2)">${h(p.type)}</span></td>
              <td>${p.accountNumber ? `<span style="font-size:.8rem;color:var(--text2)">${h(p.accountNumber)}</span>${p.bankName ? `<br><small style="color:var(--text2)">${h(p.bankName)}</small>` : ''}` : '<span style="color:var(--text2)">-</span>'}</td>
              <td style="font-weight:700;color:${p.balance < 0 ? 'var(--red)' : 'var(--green)'}">${formatIDR(p.balance)}</td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="showPocketForm('${p.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deletePocket('${p.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<div class="empty">No pockets yet</div>'}
        </div>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

async function showPocketForm(id) {
  let pocket = { name: '', balance: '', icon: '', color: '#3b82f6', type: 'cash', accountNumber: '', bankName: '', notes: '' };
  let title = 'Add Pocket';

  if (id) {
    title = 'Edit Pocket';
    try {
      const { data: all } = await API.get('/api/pockets');
      pocket = { ...pocket, ...(all.find(p => p.id === id) || {}) };
    } catch (e) { /* use defaults */ }
  }

  showModal(title, `
    <form onsubmit="savePocket(event, '${id || ''}')">
      <div class="form-group">
        <label>Name</label>
        <input name="name" value="${h(pocket.name)}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Initial Balance</label>
          <input name="balance" type="number" value="${pocket.balance || ''}" required>
        </div>
        <div class="form-group">
          <label>Type</label>
          <select name="type" onchange="toggleBankFields(this)">
            <option value="cash" ${pocket.type === 'cash' ? 'selected' : ''}>Cash</option>
            <option value="bank" ${pocket.type === 'bank' ? 'selected' : ''}>Bank</option>
            <option value="ewallet" ${pocket.type === 'ewallet' ? 'selected' : ''}>E-Wallet</option>
            <option value="investment" ${pocket.type === 'investment' ? 'selected' : ''}>Investment</option>
            <option value="other" ${pocket.type === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Account Number <small style="color:var(--text2)">(optional, bank)</small></label>
          <input name="accountNumber" value="${h(pocket.accountNumber || '')}" placeholder="e.g. 1234567890">
        </div>
        <div class="form-group">
          <label>Bank Name <small style="color:var(--text2)">(optional)</small></label>
          <input name="bankName" value="${h(pocket.bankName || '')}" placeholder="e.g. BCA / Mandiri">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Icon (emoji)</label>
          <input name="icon" value="${h(pocket.icon || '')}" placeholder="e.g. 💵">
        </div>
        <div class="form-group">
          <label>Color</label>
          <input name="color" type="color" value="${h(pocket.color || '#3b82f6')}" style="height:42px;padding:4px">
        </div>
      </div>
      ${id ? `
      <div class="form-group">
        <label>
          <input type="checkbox" name="isArchived" ${pocket.isArchived ? 'checked' : ''} style="width:auto;margin-right:8px">
          Archived
        </label>
      </div>` : ''}
      <div class="form-group">
        <label>Notes</label>
        <input name="notes" value="${h(pocket.notes || '')}">
      </div>
      <button class="btn btn-primary" style="width:100%">Save</button>
    </form>
  `);
  // Apply initial visibility for bank fields
  setTimeout(() => {
    const sel = document.querySelector('.modal-box select[name="type"]');
    if (sel) toggleBankFields(sel);
  }, 0);
}

// Show account/bank fields prominently when type is "bank"; otherwise keep them
// available (still optional) — no hard hiding so users can store e-wallet IDs too.
function toggleBankFields(sel) {
  // Reserved for future strict toggle; currently fields always visible as optional.
  // No-op kept so onchange handler does not error.
}

async function savePocket(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    name: f.name.value,
    balance: parseInt(f.balance.value) || 0,
    type: f.type.value,
    accountNumber: f.accountNumber.value || undefined,
    bankName: f.bankName.value || undefined,
    icon: f.icon.value || undefined,
    color: f.color.value || undefined,
    notes: f.notes.value || undefined,
  };
  if (id) body.isArchived = f.isArchived?.checked ?? false;

  try {
    if (id) {
      await API.put(`/api/pockets/${id}`, body);
      toast('Pocket updated');
    } else {
      await API.post('/api/pockets', body);
      toast('Pocket added');
    }
    closeModal();
    renderPockets();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deletePocket(id) {
  if (!confirm('Delete this pocket? All related transactions will remain but lose their pocket reference.')) return;
  try {
    await API.del(`/api/pockets/${id}`);
    toast('Pocket deleted');
    renderPockets();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function showTransferForm() {
  try {
    const { data: pockets } = await API.get('/api/pockets');
    const active = pockets.filter(p => !p.isArchived);
    if (active.length < 2) { toast('Need at least 2 active pockets to transfer', 'error'); return; }

    const options = active.map(p => `<option value="${p.id}">${h(p.icon || '💳')} ${h(p.name)} (${formatIDR(p.balance)})</option>`).join('');

    showModal('🔄 Transfer Antar Kantong', `
      <form onsubmit="doTransfer(event)">
        <div class="form-group">
          <label>From</label>
          <select name="fromId" required>${options}</select>
        </div>
        <div class="form-group">
          <label>To</label>
          <select name="toId" required>${options}</select>
        </div>
        <div class="form-group">
          <label>Amount</label>
          <input name="amount" type="number" required>
        </div>
        <button class="btn btn-primary" style="width:100%">Transfer</button>
      </form>
    `);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function doTransfer(e) {
  e.preventDefault();
  const f = e.target;
  if (f.fromId.value === f.toId.value) { toast('Cannot transfer to same pocket', 'error'); return; }
  try {
    await API.post('/api/pockets/transfer', {
      fromId: f.fromId.value,
      toId: f.toId.value,
      amount: parseInt(f.amount.value) || 0,
    });
    toast('Transfer completed');
    closeModal();
    renderPockets();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

// ===== CUTOFFS PAGE =====
async function renderCutoffs() {
  const app = document.getElementById('app');
  try {
    const { data: cutoffs } = await API.get('/api/cutoffs');
    const { data: summary } = await API.get('/api/summary');
    const activeCutoff = summary.cutoffDate || '-';

    app.innerHTML = `
      <div class="page-header">
        <h1>✂️ Cutoffs</h1>
        <button class="btn btn-primary" onclick="showCutoffForm()">+ Add Cutoff</button>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Cutoff Aktif</div>
          <div class="value yellow">${activeCutoff !== '-' ? formatDate(activeCutoff) : '-'}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Cutoffs</div>
          <div class="value">${cutoffs.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Tx di Dashboard</div>
          <div class="value">${summary.transactionCount || 0}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Tx (termasuk history)</div>
          <div class="value" style="color:var(--text2)">${summary.totalTransactionsAll || 0}</div>
        </div>
      </div>

      <div class="card" style="margin-top:20px">
        <div style="margin-bottom:12px;padding:12px;background:var(--surface2);border-radius:8px;font-size:.85rem;color:var(--text2)">
          💡 <strong>Cutoff</strong> = tanggal batas. Transaksi <strong>sebelum</strong> tanggal cutoff tidak masuk hitungan dashboard (income, spent, budget progress), tapi tetap tersimpan dan muncul di saldo kantong.
        </div>
        ${cutoffs.length ? `
        <table>
          <thead><tr><th>Title</th><th>Cutoff Date</th><th>Notes</th><th></th></tr></thead>
          <tbody>${cutoffs.map(c => `
            <tr>
              <td><strong>${h(c.title)}</strong></td>
              <td>${formatDate(c.cutoffDate)}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${h(c.notes || '-')}</td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="showCutoffForm('${c.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCutoff('${c.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<div class="empty">No cutoffs yet. Add one to start fresh from a specific date.</div>'}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

async function showCutoffForm(id) {
  let cutoff = { title: '', cutoffDate: new Date().toISOString().split('T')[0], notes: '' };
  let title = 'Add Cutoff';

  if (id) {
    title = 'Edit Cutoff';
    try {
      const { data: all } = await API.get('/api/cutoffs');
      cutoff = all.find(c => c.id === id) || cutoff;
    } catch (e) { /* use defaults */ }
  }

  showModal(title, `
    <form onsubmit="saveCutoff(event, '${id || ''}')">
      <div class="form-group">
        <label>Title</label>
        <input name="title" value="${h(cutoff.title)}" placeholder="e.g. Cutoff Awal" required>
      </div>
      <div class="form-group">
        <label>Cutoff Date</label>
        <input name="cutoffDate" type="date" value="${(cutoff.cutoffDate || '').split('T')[0]}" required>
        <small style="color:var(--text2);font-size:.8rem">Transaksi sebelum tanggal ini tidak masuk hitungan dashboard</small>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes" rows="3" placeholder="Catatan...">${h(cutoff.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary" style="width:100%">Save</button>
    </form>
  `);
}

async function saveCutoff(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    title: f.title.value,
    cutoffDate: f.cutoffDate.value,
    notes: f.notes.value || undefined,
  };
  try {
    if (id) {
      await API.put(`/api/cutoffs/${id}`, body);
      toast('Cutoff updated');
    } else {
      await API.post('/api/cutoffs', body);
      toast('Cutoff added');
    }
    closeModal();
    renderCutoffs();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteCutoff(id) {
  if (!confirm('Delete this cutoff? Dashboard will show all transactions again.')) return;
  try {
    await API.del(`/api/cutoffs/${id}`);
    toast('Cutoff deleted');
    renderCutoffs();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

// ===== CATEGORIES PAGE =====
async function renderCategories() {
  const app = document.getElementById('app');
  try {
    const { data: categories } = await API.get('/api/categories');

    app.innerHTML = `
      <div class="page-header">
        <h1>🏷️ Categories</h1>
        <button class="btn btn-primary" onclick="showCategoryForm()">+ Add Category</button>
      </div>
      <div class="card">
        ${categories.length ? `
        <table>
          <thead><tr><th>Name</th><th>Color</th><th></th></tr></thead>
          <tbody>${categories.map(c => `
            <tr>
              <td><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${h(c.color || '#3b82f6')};margin-right:8px"></span>${h(c.name)}</td>
              <td><code style="font-size:.8rem">${h(c.color || '-')}</code></td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="showCategoryForm('${c.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory('${c.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<div class="empty">No categories yet</div>'}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

async function showCategoryForm(id) {
  let cat = { name: '', icon: '', color: '#3b82f6' };
  let title = 'Add Category';

  if (id) {
    title = 'Edit Category';
    try {
      const { data: all } = await API.get('/api/categories');
      cat = all.find(c => c.id === id) || cat;
    } catch (e) { /* use defaults */ }
  }

  showModal(title, `
    <form onsubmit="saveCategory(event, '${id || ''}')">
      <div class="form-group">
        <label>Name</label>
        <input name="name" value="${h(cat.name)}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Color</label>
          <input name="color" type="color" value="${h(cat.color || '#3b82f6')}" style="height:42px;padding:4px">
        </div>
        <div class="form-group">
          <label>Icon (emoji)</label>
          <input name="icon" value="${h(cat.icon || '')}" placeholder="e.g. 🍔">
        </div>
      </div>
      <button class="btn btn-primary" style="width:100%">Save</button>
    </form>
  `);
}

async function saveCategory(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    name: f.name.value,
    icon: f.icon.value || undefined,
    color: f.color.value || undefined,
  };
  try {
    if (id) {
      await API.put(`/api/categories/${id}`, body);
      toast('Category updated');
    } else {
      await API.post('/api/categories', body);
      toast('Category added');
    }
    closeModal();
    renderCategories();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    await API.del(`/api/categories/${id}`);
    toast('Category deleted');
    renderCategories();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

// ===== SAVINGS TARGETS PAGE =====
async function renderSavingsTargets() {
  const app = document.getElementById('app');
  try {
    const [{ data: targets }, { data: pockets }] = await Promise.all([
      API.get('/api/savings-targets'),
      API.get('/api/pockets'),
    ]);
    const pocketMap = {};
    pockets.forEach(p => { pocketMap[p.id] = p; });

    const totalSaved = targets.reduce((s, t) => s + (t.currentAmount || 0), 0);
    const totalTarget = targets.reduce((s, t) => s + (t.targetAmount || 0), 0);
    const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
    const activeCount = targets.filter(t => t.status !== 'completed').length;

    app.innerHTML = `
      <div class="page-header">
        <h1>🎯 Savings Targets</h1>
        <button class="btn btn-primary" onclick="showSavingsTargetForm()">+ Add Target</button>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Total Targets</div>
          <div class="value">${targets.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Saved</div>
          <div class="value green">${formatIDR(totalSaved)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Target</div>
          <div class="value">${formatIDR(totalTarget)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Overall Progress</div>
          <div class="value ${overallPct > 75 ? 'green' : overallPct > 50 ? 'yellow' : 'red'}">${overallPct}%</div>
          <div class="progress-bar sm"><div class="progress-fill ${overallPct > 75 ? 'green' : overallPct > 50 ? 'yellow' : 'red'}" style="width:${Math.min(overallPct,100)}%"></div></div>
        </div>
      </div>

      <div class="card" style="margin-top:20px">
        <div class="table-wrap">
        ${targets.length ? `
        <table>
          <thead><tr><th>Target</th><th>Saved / Target</th><th>Progress</th><th>Due</th><th>Status</th><th></th></tr></thead>
          <tbody>${targets.map(t => {
            const pct = t.targetAmount > 0 ? Math.min(100, Math.round(((t.currentAmount || 0) / t.targetAmount) * 100)) : 0;
            const c = pct > 75 ? 'green' : pct > 50 ? 'yellow' : 'red';
            const pk = t.pocketId ? pocketMap[t.pocketId] : null;
            return `
            <tr>
              <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${h(t.color || '#3b82f6')};margin-right:8px"></span>
                ${h(t.icon || '🎯')} <strong>${h(t.title)}</strong>
                ${pk ? `<br><small style="color:var(--text2)">${h(pk.icon || '💳')} ${h(pk.name)}</small>` : ''}
                ${t.notes ? `<br><small style="color:var(--text2)">${h(t.notes)}</small>` : ''}
              </td>
              <td>
                <span style="color:var(--green)">${formatIDR(t.currentAmount || 0)}</span>
                <span style="color:var(--text2)"> / ${formatIDR(t.targetAmount || 0)}</span>
              </td>
              <td style="min-width:120px">
                <div style="font-size:.8rem;color:var(--text2);margin-bottom:2px">${pct}%</div>
                <div class="progress-bar sm"><div class="progress-fill ${c}" style="width:${pct}%"></div></div>
              </td>
              <td>${formatDate(t.targetDate)}</td>
              <td>
                <span style="color:${t.status === 'completed' ? 'var(--green)' : t.status === 'paused' ? 'var(--yellow)' : 'var(--accent)'}">${h(t.status || 'active')}</span>
                <br><small style="color:var(--text2)">${t.targetType === 'investment' ? '📈 Investment' : '🏦 Pocket/Bank'}</small>
              </td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="showSavingsTargetForm('${t.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSavingsTarget('${t.id}')">Delete</button>
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : '<div class="empty">No savings targets yet. Add one to start tracking your goals! 🎯</div>'}
        </div>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

async function showSavingsTargetForm(id) {
  let target = {
    title: '', targetAmount: '', currentAmount: '', pocket: '', targetDate: '',
    icon: '🎯', color: '#3b82f6', status: 'active', notes: '',
  };
  let title = 'Add Savings Target';

  if (id) {
    title = 'Edit Savings Target';
    try {
      const { data: all } = await API.get('/api/savings-targets');
      target = { ...target, ...(all.find(t => t.id === id) || {}) };
    } catch (e) { /* use defaults */ }
  }

  let pocketOptions = '';
  try {
    const { data: pockets } = await API.get('/api/pockets');
    pocketOptions = pockets.filter(p => !p.isArchived).map(p => `<option value="${p.id}" ${target.pocketId === p.id ? 'selected' : ''}>${h(p.icon || '💳')} ${h(p.name)}</option>`).join('');
  } catch (e) { /* ignore */ }

  showModal(title, `
    <form onsubmit="saveSavingsTarget(event, '${id || ''}')">
      <div class="form-group">
        <label>Title</label>
        <input name="title" value="${h(target.title)}" placeholder="e.g. Dana Darurat, Liburan" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Target Amount (IDR)</label>
          <input name="targetAmount" type="number" value="${target.targetAmount || ''}" required>
        </div>
        <div class="form-group">
          <label>Current Amount (IDR)</label>
          <input name="currentAmount" type="number" value="${target.currentAmount || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Target Date</label>
          <input name="targetDate" type="date" value="${(target.targetDate || '').split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Pocket</label>
          <select name="pocket"><option value="">-- None --</option>${pocketOptions}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Target Type</label>
        <select name="targetType">
          <option value="pocket" ${(target.targetType || 'pocket') === 'pocket' ? 'selected' : ''}>🏦 Pocket/Bank</option>
          <option value="investment" ${(target.targetType || 'pocket') === 'investment' ? 'selected' : ''}>📈 Investment</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Icon (emoji)</label>
          <input name="icon" value="${h(target.icon || '')}" placeholder="🎯">
        </div>
        <div class="form-group">
          <label>Color</label>
          <input name="color" type="color" value="${h(target.color || '#3b82f6')}" style="height:42px;padding:4px">
        </div>
      </div>
      ${id ? `
      <div class="form-group">
        <label>Status</label>
        <select name="status">
          <option value="active" ${target.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="paused" ${target.status === 'paused' ? 'selected' : ''}>Paused</option>
          <option value="completed" ${target.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </div>` : ''}
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes" rows="2" placeholder="Catatan...">${h(target.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary" style="width:100%">Save</button>
    </form>
  `);
}

async function saveSavingsTarget(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    title: f.title.value,
    targetAmount: parseInt(f.targetAmount.value) || 0,
    currentAmount: parseInt(f.currentAmount.value) || 0,
    targetDate: f.targetDate.value || undefined,
    pocketId: f.pocket.value || undefined,
    targetType: f.targetType.value || 'pocket',
    icon: f.icon.value || undefined,
    color: f.color.value || undefined,
    notes: f.notes.value || undefined,
  };
  if (id) body.status = f.status?.value;
  try {
    if (id) {
      await API.put(`/api/savings-targets/${id}`, body);
      toast('Target updated');
    } else {
      await API.post('/api/savings-targets', body);
      toast('Target added');
    }
    closeModal();
    renderSavingsTargets();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function deleteSavingsTarget(id) {
  if (!confirm('Delete this savings target?')) return;
  try {
    await API.del(`/api/savings-targets/${id}`);
    toast('Target deleted');
    renderSavingsTargets();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

// ===== RECURRING TRANSACTIONS PAGE =====
async function renderRecurringTransactions() {
  const app = document.getElementById('app');
  try {
    const [{ data: recurrings }, { data: categories }, { data: pockets }] = await Promise.all([
      API.get('/api/recurring-transactions'),
      API.get('/api/categories'),
      API.get('/api/pockets'),
    ]);
    const catMap = {}; categories.forEach(c => catMap[c.id] = c.name);
    const pocketMap = {}; pockets.forEach(p => pocketMap[p.id] = p);

    const active = recurrings.filter(r => r.isActive);
    const monthlyIncome = active.filter(r => r.type === 'income' && (r.frequency || 'monthly') === 'monthly').reduce((s, r) => s + (r.amount || 0), 0);
    const monthlyExpense = active.filter(r => r.type === 'expense' && (r.frequency || 'monthly') === 'monthly').reduce((s, r) => s + (r.amount || 0), 0);
    const net = monthlyIncome - monthlyExpense;

    app.innerHTML = `
      <div class="page-header">
        <h1>🔁 Recurring Transactions</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline" onclick="generateRecurring()">⚡ Generate Now</button>
          <button class="btn btn-primary" onclick="showRecurringForm()">+ Add Recurring</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Active</div>
          <div class="value green">${active.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Monthly Income</div>
          <div class="value green">${formatIDR(monthlyIncome)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Monthly Expense</div>
          <div class="value red">${formatIDR(monthlyExpense)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Net / Month</div>
          <div class="value ${net < 0 ? 'red' : 'green'}">${formatIDR(net)}</div>
        </div>
      </div>

      <div class="card" style="margin-top:20px">
        <div class="table-wrap">
        ${recurrings.length ? `
        <table>
          <thead><tr><th>Title</th><th>Type</th><th>Amount</th><th>Schedule</th><th>Active</th><th>Last Gen</th><th></th></tr></thead>
          <tbody>${recurrings.map(r => `
            <tr>
              <td>
                <strong>${h(r.title)}</strong>
                ${r.categoryId ? `<br><small style="color:var(--text2)">${h(catMap[r.categoryId] || '-')}</small>` : ''}
                ${r.pocketId ? `<br><small style="color:var(--text2)">${h(pocketMap[r.pocketId]?.icon || '💳')} ${h(pocketMap[r.pocketId]?.name || '')}</small>` : ''}
              </td>
              <td><span style="color:${r.type === 'income' ? 'var(--green)' : 'var(--red)'}">${h(r.type)}</span></td>
              <td style="font-weight:700;color:${r.type === 'income' ? 'var(--green)' : 'var(--red)'}">${formatIDR(r.amount || 0)}</td>
              <td>
                <span style="font-size:.8rem;color:var(--text2)">
                  ${h(r.frequency || 'monthly')} • day ${h(r.dayOfMonth || '-')}
                </span>
                ${r.startDate ? `<br><small style="color:var(--text2)">${formatDate(r.startDate)}${r.endDate ? ' → ' + formatDate(r.endDate) : ''}</small>` : ''}
              </td>
              <td>
                <span class="status-dot ${r.isActive ? 'on' : 'off'}"></span>
                <button class="btn btn-sm ${r.isActive ? 'btn-outline' : 'btn-green'}" onclick="toggleRecurring('${r.id}', ${!r.isActive})">${r.isActive ? 'Deactivate' : 'Activate'}</button>
              </td>
              <td><span style="font-size:.78rem;color:var(--text2)">${formatDate(r.lastGenerated)}</span></td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="showRecurringForm('${r.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRecurring('${r.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<div class="empty">No recurring transactions yet. Add subscriptions, rent, salary, etc. 🔁</div>'}
        </div>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

async function showRecurringForm(id) {
  let rec = {
    title: '', amount: '', type: 'expense', category: '', pocket: '',
    dayOfMonth: '1', frequency: 'monthly', startDate: new Date().toISOString().split('T')[0],
    endDate: '', isActive: true, notes: '',
  };
  let title = 'Add Recurring Transaction';

  if (id) {
    title = 'Edit Recurring Transaction';
    try {
      const { data: all } = await API.get('/api/recurring-transactions');
      rec = { ...rec, ...(all.find(r => r.id === id) || {}) };
    } catch (e) { /* use defaults */ }
  }

  let catOptions = '', pocketOptions = '';
  try {
    const [{ data: categories }, { data: pockets }] = await Promise.all([
      API.get('/api/categories'),
      API.get('/api/pockets'),
    ]);
    catOptions = categories.map(c => `<option value="${c.id}" ${rec.categoryId === c.id ? 'selected' : ''}>${h(c.name)}</option>`).join('');
    pocketOptions = pockets.filter(p => !p.isArchived).map(p => `<option value="${p.id}" ${rec.pocketId === p.id ? 'selected' : ''}>${h(p.icon || '💳')} ${h(p.name)}</option>`).join('');
  } catch (e) { /* ignore */ }

  const dayOptions = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${String(rec.dayOfMonth) === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`).join('');

  showModal(title, `
    <form onsubmit="saveRecurring(event, '${id || ''}')">
      <div class="form-group">
        <label>Title</label>
        <input name="title" value="${h(rec.title)}" placeholder="e.g. Netflix, Gaji, Kos" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Amount (IDR)</label>
          <input name="amount" type="number" value="${rec.amount || ''}" required>
        </div>
        <div class="form-group">
          <label>Type</label>
          <select name="type">
            <option value="expense" ${rec.type === 'expense' ? 'selected' : ''}>Expense</option>
            <option value="income" ${rec.type === 'income' ? 'selected' : ''}>Income</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <select name="category"><option value="">-- None --</option>${catOptions}</select>
        </div>
        <div class="form-group">
          <label>Pocket</label>
          <select name="pocket"><option value="">-- None --</option>${pocketOptions}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Frequency</label>
          <select name="frequency">
            <option value="monthly" ${rec.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="weekly" ${rec.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
          </select>
        </div>
        <div class="form-group">
          <label>Day of Month</label>
          <select name="dayOfMonth">${dayOptions}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Start Date</label>
          <input name="startDate" type="date" value="${(rec.startDate || '').split('T')[0].split(' ')[0]}">
        </div>
        <div class="form-group">
          <label>End Date <small style="color:var(--text2)">(optional)</small></label>
          <input name="endDate" type="date" value="${(rec.endDate || '').split('T')[0].split(' ')[0]}">
        </div>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="isActive" ${rec.isActive ? 'checked' : ''} style="width:auto;margin-right:8px">
          Active
        </label>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes" rows="2" placeholder="Catatan...">${h(rec.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary" style="width:100%">Save</button>
    </form>
  `);
}

async function saveRecurring(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    title: f.title.value,
    amount: parseInt(f.amount.value) || 0,
    type: f.type.value,
    categoryId: f.category.value || undefined,
    pocketId: f.pocket.value || undefined,
    dayOfMonth: parseInt(f.dayOfMonth.value) || 1,
    frequency: f.frequency.value,
    startDate: f.startDate.value || undefined,
    endDate: f.endDate.value || undefined,
    isActive: f.isActive.checked,
    notes: f.notes.value || undefined,
  };
  try {
    if (id) {
      await API.put(`/api/recurring-transactions/${id}`, body);
      toast('Recurring updated');
    } else {
      await API.post('/api/recurring-transactions', body);
      toast('Recurring added');
    }
    closeModal();
    renderRecurringTransactions();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function deleteRecurring(id) {
  if (!confirm('Delete this recurring transaction?')) return;
  try {
    await API.del(`/api/recurring-transactions/${id}`);
    toast('Recurring deleted');
    renderRecurringTransactions();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function toggleRecurring(id, makeActive) {
  try {
    await API.put(`/api/recurring-transactions/${id}`, { isActive: !!makeActive });
    toast(makeActive ? 'Activated' : 'Deactivated');
    renderRecurringTransactions();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function generateRecurring() {
  if (!confirm('Generate transactions for all active recurring items due now?')) return;
  try {
    const res = await API.post('/api/recurring-transactions/generate', {});
    const generated = res?.data?.generated ?? res?.data?.count ?? (Array.isArray(res?.data) ? res.data.length : 0);
    toast(`Generated ${generated} transaction(s)`);
    renderRecurringTransactions();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

// ===== RECURRING BUDGETS PAGE =====
async function renderRecurringBudgets() {
  const app = document.getElementById('app');
  try {
    const [{ data: recurrings }, { data: categories }, { data: pockets }] = await Promise.all([
      API.get('/api/recurring-budgets'),
      API.get('/api/categories'),
      API.get('/api/pockets'),
    ]);
    const catMap = {}; categories.forEach(c => catMap[c.id] = c.name);
    const pocketMap = {}; pockets.forEach(p => pocketMap[p.id] = p);

    const active = recurrings.filter(r => r.isActive);
    const monthlyTotal = active.filter(r => (r.frequency || 'monthly') === 'monthly').reduce((s, r) => s + (r.amount || 0), 0);

    app.innerHTML = `
      <div class="page-header">
        <h1>📋 Recurring Budgets</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline" onclick="generateRecurringBudgets()">⚡ Generate Now</button>
          <button class="btn btn-primary" onclick="showRecurringBudgetForm()">+ Add Recurring Budget</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Active</div>
          <div class="value green">${active.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Recurring</div>
          <div class="value">${recurrings.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Monthly Total</div>
          <div class="value">${formatIDR(monthlyTotal)}</div>
        </div>
      </div>

      <div class="card" style="margin-top:20px">
        <div class="table-wrap">
        ${recurrings.length ? `
        <table>
          <thead><tr><th>Title</th><th>Category</th><th>Amount</th><th>Schedule</th><th>Active</th><th>Last Gen</th><th></th></tr></thead>
          <tbody>${recurrings.map(r => `
            <tr>
              <td>
                <strong>${h(r.title)}</strong>
                ${r.pocketId ? `<br><small style="color:var(--text2)">${h(pocketMap[r.pocketId]?.icon || '💳')} ${h(pocketMap[r.pocketId]?.name || '')}</small>` : ''}
              </td>
              <td>${r.categoryId ? h(catMap[r.categoryId] || '-') : '<span style="color:var(--text2)">-</span>'}</td>
              <td style="font-weight:700">${formatIDR(r.amount || 0)}</td>
              <td>
                <span style="font-size:.8rem;color:var(--text2)">
                  ${h(r.frequency || 'monthly')} • day ${h(r.dayOfMonth || '-')}
                </span>
                ${r.startDate ? `<br><small style="color:var(--text2)">${formatDate(r.startDate)}${r.endDate ? ' → ' + formatDate(r.endDate) : ''}</small>` : ''}
              </td>
              <td>
                <span class="status-dot ${r.isActive ? 'on' : 'off'}"></span>
                <button class="btn btn-sm ${r.isActive ? 'btn-outline' : 'btn-green'}" onclick="toggleRecurringBudget('${r.id}', ${!r.isActive})">${r.isActive ? 'Deactivate' : 'Activate'}</button>
              </td>
              <td><span style="font-size:.78rem;color:var(--text2)">${formatDate(r.lastGenerated)}</span></td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="showRecurringBudgetForm('${r.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRecurringBudget('${r.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<div class="empty">No recurring budgets yet. Add recurring budget allocations for categories. 📋</div>'}
        </div>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

async function showRecurringBudgetForm(id) {
  let rb = {
    title: '', amount: '', categoryId: '', pocketId: '',
    dayOfMonth: '1', frequency: 'monthly', startDate: new Date().toISOString().split('T')[0],
    endDate: '', isActive: true, notes: '',
  };
  let title = 'Add Recurring Budget';

  if (id) {
    title = 'Edit Recurring Budget';
    try {
      const { data: all } = await API.get('/api/recurring-budgets');
      rb = { ...rb, ...(all.find(r => r.id === id) || {}) };
    } catch (e) { /* use defaults */ }
  }

  let catOptions = '', pocketOptions = '';
  try {
    const [{ data: categories }, { data: pockets }] = await Promise.all([
      API.get('/api/categories'),
      API.get('/api/pockets'),
    ]);
    catOptions = categories.map(c => `<option value="${c.id}" ${rb.categoryId === c.id ? 'selected' : ''}>${h(c.name)}</option>`).join('');
    pocketOptions = pockets.filter(p => !p.isArchived).map(p => `<option value="${p.id}" ${rb.pocketId === p.id ? 'selected' : ''}>${h(p.icon || '💳')} ${h(p.name)}</option>`).join('');
  } catch (e) { /* ignore */ }

  const dayOptions = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${String(rb.dayOfMonth) === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`).join('');

  showModal(title, `
    <form onsubmit="saveRecurringBudget(event, '${id || ''}')">
      <div class="form-group">
        <label>Title</label>
        <input name="title" value="${h(rb.title)}" placeholder="e.g. Budget Makanan, Budget Transport" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Amount (IDR)</label>
          <input name="amount" type="number" value="${rb.amount || ''}" required>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select name="category"><option value="">-- None --</option>${catOptions}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Pocket</label>
        <select name="pocket"><option value="">-- None --</option>${pocketOptions}</select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Frequency</label>
          <select name="frequency">
            <option value="monthly" ${rb.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="weekly" ${rb.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
          </select>
        </div>
        <div class="form-group">
          <label>Day of Month</label>
          <select name="dayOfMonth">${dayOptions}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Start Date</label>
          <input name="startDate" type="date" value="${(rb.startDate || '').split('T')[0].split(' ')[0]}">
        </div>
        <div class="form-group">
          <label>End Date <small style="color:var(--text2)">(optional)</small></label>
          <input name="endDate" type="date" value="${(rb.endDate || '').split('T')[0].split(' ')[0]}">
        </div>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="isActive" ${rb.isActive ? 'checked' : ''} style="width:auto;margin-right:8px">
          Active
        </label>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes" rows="2" placeholder="Catatan...">${h(rb.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary" style="width:100%">Save</button>
    </form>
  `);
}

async function saveRecurringBudget(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    title: f.title.value,
    amount: parseInt(f.amount.value) || 0,
    categoryId: f.category.value || undefined,
    pocketId: f.pocket.value || undefined,
    dayOfMonth: parseInt(f.dayOfMonth.value) || 1,
    frequency: f.frequency.value,
    startDate: f.startDate.value || undefined,
    endDate: f.endDate.value || undefined,
    isActive: f.isActive.checked,
    notes: f.notes.value || undefined,
  };
  try {
    if (id) {
      await API.put(`/api/recurring-budgets/${id}`, body);
      toast('Recurring budget updated');
    } else {
      await API.post('/api/recurring-budgets', body);
      toast('Recurring budget added');
    }
    closeModal();
    renderRecurringBudgets();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function deleteRecurringBudget(id) {
  if (!confirm('Delete this recurring budget?')) return;
  try {
    await API.del(`/api/recurring-budgets/${id}`);
    toast('Recurring budget deleted');
    renderRecurringBudgets();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function toggleRecurringBudget(id, makeActive) {
  try {
    await API.put(`/api/recurring-budgets/${id}`, { isActive: !!makeActive });
    toast(makeActive ? 'Activated' : 'Deactivated');
    renderRecurringBudgets();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function generateRecurringBudgets() {
  if (!confirm('Generate budgets for all active recurring items due now?')) return;
  try {
    const res = await API.post('/api/recurring-budgets/generate', {});
    const generated = res?.data?.generated ?? res?.data?.count ?? (Array.isArray(res?.data) ? res.data.length : 0);
    toast(`Generated ${generated} budget(s)`);
    renderRecurringBudgets();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

// ===== INSIGHTS PAGE =====
async function renderInsights() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">Loading insights...</div>';
  try {
    // Fetch all data in parallel; tolerate individual failures.
    const fetchSafe = async (p) => { try { return (await API.get(p)).data; } catch { return null; } };
    const [predictions, summaries, summaryData, transactions] = await Promise.all([
      fetchSafe('/api/predictions'),
      fetchSafe('/api/ai-summaries?limit=10'),
      fetchSafe('/api/summary'),
      fetchSafe('/api/transactions'),
    ]);

    // ---- Projections calculation ----
    const now = new Date();
    const last6 = (transactions || []).filter(t => {
      const d = new Date(t.date);
      const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      return months >= 0 && months <= 6;
    });
    const avgIncome = last6.length ? last6.filter(t => t.type === 'income' || t.amount > 0).reduce((s, t) => s + Math.abs(t.amount), 0) / Math.max(1, Math.ceil(last6.length / 30)) : 0;
    const avgExpense = last6.length ? last6.filter(t => t.type === 'expense' || t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0) / Math.max(1, Math.ceil(last6.length / 30)) : 0;
    const avgNet = avgIncome - avgExpense;

    // Use summary totals as fallback if tx history thin
    let incomeBase = avgIncome || (summaryData?.totalIncome || 0);
    let expenseBase = avgExpense || (summaryData?.totalSpent || 0);
    let netBase = incomeBase - expenseBase;

    const proj3 = netBase * 3;
    const proj6 = netBase * 6;
    const proj12 = netBase * 12;

    // Debt payoff projection
    const ds = summaryData?.debtSummary || {};
    const totalDebt = ds.totalRemaining || 0;
    let debtFreeMonths = null;
    if (totalDebt > 0 && netBase > 0) {
      debtFreeMonths = Math.ceil(totalDebt / netBase);
    }

    // Next-month prediction cards (from predictions API, else fallback to avg)
    const nextMonthStr = (() => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    })();
    const nextPreds = (predictions || []).filter(p => p.targetMonth === nextMonthStr || !p.targetMonth);
    const predIncome = nextPreds.find(p => p.type === 'income')?.predictedAmount ?? incomeBase;
    const predExpense = nextPreds.find(p => p.type === 'expense')?.predictedAmount ?? expenseBase;
    const predSavings = (nextPreds.find(p => p.type === 'savings')?.predictedAmount) ?? (predIncome - predExpense);

    // ---- Render ----
    app.innerHTML = `
      <div class="page-header">
        <h1>📈 Insights</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="generatePredictions()">⚡ Generate Predictions</button>
        </div>
      </div>

      <!-- PREDICTIONS SECTION -->
      <h2 class="section-title">🔮 Predictions (Next Month: ${nextMonthStr})</h2>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Predicted Income</div>
          <div class="value green">${formatIDR(predIncome)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Predicted Expense</div>
          <div class="value red">${formatIDR(predExpense)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Predicted Savings</div>
          <div class="value ${predSavings < 0 ? 'red' : 'green'}">${formatIDR(predSavings)}</div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h2>All Predictions</h2>
        <div class="table-wrap">
        ${(predictions && predictions.length) ? `
        <table>
          <thead><tr><th>Type</th><th>Amount</th><th>Target</th><th>Confidence</th><th>Auto</th></tr></thead>
          <tbody>${predictions.map(p => {
            const conf = Math.max(0, Math.min(100, p.confidence || 0));
            const cColor = conf > 70 ? 'var(--green)' : conf > 40 ? 'var(--yellow)' : 'var(--red)';
            return `
            <tr>
              <td><span style="color:${p.type === 'income' ? 'var(--green)' : p.type === 'expense' ? 'var(--red)' : 'var(--accent)'}">${h(p.type)}</span></td>
              <td style="font-weight:700">${formatIDR(p.predictedAmount || 0)}</td>
              <td><span style="font-size:.8rem;color:var(--text2)">${h(p.targetMonth || formatDate(p.targetDate))}</span></td>
              <td style="min-width:120px">
                <div style="font-size:.8rem;color:${cColor};margin-bottom:2px">${conf}%</div>
                <div class="confidence-bar"><div class="confidence-fill" style="width:${conf}%;background:${cColor}"></div></div>
              </td>
              <td>${p.isAuto ? '<span style="color:var(--text2)">🤖</span>' : '✋'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : '<div class="empty">No predictions yet. Click "Generate Predictions" to create some. ⚡</div>'}
        </div>
      </div>

      <!-- AI SUMMARIES SECTION -->
      <h2 class="section-title">🤖 AI Summaries</h2>
      ${(summaries && summaries.length) ? `
        <div class="card" style="margin-bottom:16px">
          <h2>Latest Summary — ${formatDate(summaries[0].summaryDate)}</h2>
          <div class="insight-text">${h(summaries[0].summaryText || summaries[0].summary_text || '')}</div>
          ${summaries[0].totalIncome != null ? `
          <div class="stat-grid" style="margin-top:12px">
            <div class="stat-card"><div class="label">Income</div><div class="value green">${formatIDR(summaries[0].totalIncome)}</div></div>
            <div class="stat-card"><div class="label">Expense</div><div class="value red">${formatIDR(summaries[0].totalExpense)}</div></div>
            <div class="stat-card"><div class="label">Net</div><div class="value ${(summaries[0].net || 0) < 0 ? 'red' : 'green'}">${formatIDR(summaries[0].net)}</div></div>
          </div>` : ''}
          ${summaries[0].insights ? `<div class="insight-text" style="margin-top:12px"><strong>Insights:</strong> ${h(summaries[0].insights)}</div>` : ''}
          ${summaries[0].recommendations ? `<div class="insight-text good"><strong>Recommendations:</strong> ${h(summaries[0].recommendations)}</div>` : ''}
        </div>

        <div class="card">
          <h2>Past Summaries</h2>
          <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Period</th><th>Net</th><th>Summary</th></tr></thead>
            <tbody>${summaries.map(s => `
              <tr>
                <td>${formatDate(s.summaryDate || s.summary_date)}</td>
                <td><span style="font-size:.8rem;color:var(--text2)">${h(s.period || '-')}</span></td>
                <td style="color:${(s.net || 0) < 0 ? 'var(--red)' : 'var(--green)'}">${formatIDR(s.net || 0)}</td>
                <td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${h((s.summaryText || s.summary_text || '').slice(0, 80))}${(s.summaryText || s.summary_text || '').length > 80 ? '…' : ''}</td>
              </tr>
            `).join('')}</tbody>
          </table>
          </div>
        </div>` : '<div class="card"><div class="empty">No AI summaries yet. Generate one from your backend to see insights here. 🤖</div></div>'}

      <!-- PROJECTIONS SECTION -->
      <h2 class="section-title">📊 Projections</h2>
      <div class="insight-text">
        Based on your recent averages: <strong>Income ${formatIDR(incomeBase)}</strong> / month,
        <strong>Expense ${formatIDR(expenseBase)}</strong> / month,
        <strong style="color:${netBase < 0 ? 'var(--red)' : 'var(--green)'}">Net ${formatIDR(netBase)}</strong> / month.
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Projected Savings (3 mo)</div>
          <div class="value ${proj3 < 0 ? 'red' : 'green'}">${formatIDR(proj3)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Projected Savings (6 mo)</div>
          <div class="value ${proj6 < 0 ? 'red' : 'green'}">${formatIDR(proj6)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Projected Savings (12 mo)</div>
          <div class="value ${proj12 < 0 ? 'red' : 'green'}">${formatIDR(proj12)}</div>
        </div>
      </div>

      ${totalDebt > 0 ? `
      <div class="card" style="margin-top:16px">
        <h2>🏦 Debt Payoff Projection</h2>
        <div class="insight-text ${debtFreeMonths ? 'warn' : 'danger'}">
          Total remaining debt: <strong>${formatIDR(totalDebt)}</strong>.
          ${debtFreeMonths !== null
            ? `If you allocate your full monthly net (<strong>${formatIDR(netBase)}</strong>) to debt, you'll be <strong>debt-free in ~${debtFreeMonths} months</strong> (${Math.ceil(debtFreeMonths / 12)} year${Math.ceil(debtFreeMonths / 12) > 1 ? 's' : ''}).`
            : 'Your monthly net is not positive — increase income or reduce expenses to project a payoff timeline.'}
        </div>
      </div>` : ''}

      ${netBase < 0 ? `<div class="insight-text danger">⚠️ You're spending more than you earn on average. Consider cutting expenses or boosting income to avoid accumulating debt.</div>` : ''}
      ${netBase > 0 && totalDebt === 0 ? `<div class="insight-text good">✅ Great! You're saving ${formatIDR(netBase)} per month on average. Keep it up!</div>` : ''}
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load insights: ${h(e.message)}</div></div>`;
  }
}

async function generatePredictions() {
  try {
    toast('Generating predictions...');
    await API.post('/api/predictions/generate', {});
    toast('Predictions generated');
    renderInsights();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

// ===== HTML ESCAPE =====
function h(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== INIT =====
(async function init() {
  // Check if already logged in
  if (authToken) {
    try {
      const { data } = await API.get('/api/auth/me');
      currentUser = data;
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-screen').classList.remove('hidden');
      document.getElementById('user-display').textContent = data.name || data.email;
      navigate('summary');
    } catch (e) {
      // Token expired/invalid
      logout();
    }
  }
})();
