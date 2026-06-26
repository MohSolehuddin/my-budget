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

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    navigate(page);
  });
});

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
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
    case 'categories': renderCategories(); break;
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
          <div class="label">Total Budget</div>
          <div class="value">${formatIDR(data.totalBudget)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Spent</div>
          <div class="value ${spentPct > 90 ? 'red' : ''}">${formatIDR(data.totalSpent)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Remaining</div>
          <div class="value ${data.remaining < 0 ? 'red' : 'green'}">${formatIDR(data.remaining)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Spent %</div>
          <div class="value ${pctColor}">${spentPct}%</div>
          <div class="progress-bar"><div class="progress-fill ${pctColor}" style="width:${Math.min(spentPct,100)}%"></div></div>
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
        ${pockets.length ? `
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Balance</th><th></th></tr></thead>
          <tbody>${pockets.map(p => `
            <tr style="${p.isArchived ? 'opacity:0.5' : ''}">
              <td>
                <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${h(p.color || '#3b82f6')};margin-right:8px"></span>
                ${h(p.icon || '💳')} <strong>${h(p.name)}</strong>
                ${p.isArchived ? '<span style="color:var(--text2);font-size:.75rem;margin-left:8px">(archived)</span>' : ''}
              </td>
              <td><span style="font-size:.8rem;color:var(--text2)">${h(p.type)}</span></td>
              <td style="font-weight:700;color:${p.balance < 0 ? 'var(--red)' : 'var(--green)'}">${formatIDR(p.balance)}</td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="showPocketForm('${p.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deletePocket('${p.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<div class="empty">No pockets yet</div>'}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty">Failed to load: ${h(e.message)}</div></div>`;
  }
}

async function showPocketForm(id) {
  let pocket = { name: '', balance: '', icon: '', color: '#3b82f6', type: 'cash', notes: '' };
  let title = 'Add Pocket';

  if (id) {
    title = 'Edit Pocket';
    try {
      const { data: all } = await API.get('/api/pockets');
      pocket = all.find(p => p.id === id) || pocket;
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
          <select name="type">
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
}

async function savePocket(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    name: f.name.value,
    balance: parseInt(f.balance.value) || 0,
    type: f.type.value,
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
