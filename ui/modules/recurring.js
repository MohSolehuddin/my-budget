// ===== RECURRING TRANSACTIONS MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderRecurringTransactions, showRecurringForm, saveRecurring,
//          deleteRecurring, toggleRecurring, generateRecurring

async function renderRecurringTransactions() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();
  try {
    const [{ data: recurrings }, { data: categories }, { data: pockets }] = await Promise.all([
      API.get('/api/recurring-transactions'),
      API.get('/api/categories'),
      API.get('/api/pockets'),
    ]);
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c; });
    const pocketMap = {};
    pockets.forEach(p => { pocketMap[p.id] = p; });

    const active = recurrings.filter(r => r.isActive);
    const monthlyIncome = active
      .filter(r => r.type === 'income' && (r.frequency || 'monthly') === 'monthly')
      .reduce((s, r) => s + (r.amount || 0), 0);
    const monthlyExpense = active
      .filter(r => r.type === 'expense' && (r.frequency || 'monthly') === 'monthly')
      .reduce((s, r) => s + (r.amount || 0), 0);
    const net = monthlyIncome - monthlyExpense;

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Recurring Transactions</h1>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="generateRecurring()">Generate Now</button>
          <button class="btn btn-primary" onclick="showRecurringForm()">+ Add Recurring</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Active</div>
          <div class="stat-value green">${active.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Monthly Income</div>
          <div class="stat-value num green">${formatIDR(monthlyIncome)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Monthly Expense</div>
          <div class="stat-value num red">${formatIDR(monthlyExpense)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Net / Month</div>
          <div class="stat-value num ${net < 0 ? 'red' : 'green'}">${formatIDR(net)}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">All Recurring Transactions</div></div>
        <div class="table-wrap">
        ${recurrings.length ? `
        <table>
          <thead><tr><th>Title</th><th>Type</th><th>Amount</th><th>Schedule</th><th>Active</th><th>Last Gen</th><th>Actions</th></tr></thead>
          <tbody>${recurrings.map(r => `
            <tr>
              <td>
                <strong>${h(r.title)}</strong>
                ${r.categoryId && catMap[r.categoryId] ? `<br><small style="color:var(--text2)">${h(catMap[r.categoryId].icon || '')} ${h(catMap[r.categoryId].name)}</small>` : ''}
                ${r.pocketId && pocketMap[r.pocketId] ? `<br><small style="color:var(--text2)">${h(pocketMap[r.pocketId].icon || '')} ${h(pocketMap[r.pocketId].name)}</small>` : ''}
              </td>
              <td>${badge(h(r.type), r.type === 'income' ? 'green' : 'red')}</td>
              <td class="num" style="color:${r.type === 'income' ? 'var(--green)' : 'var(--red)'};font-weight:600">${formatIDR(r.amount || 0)}</td>
              <td>
                <span style="font-size:.8rem;color:var(--text2)">${h(r.frequency || 'monthly')} • day ${h(r.dayOfMonth || '-')}</span>
                ${r.startDate ? `<br><small style="color:var(--text2)">${formatDate(r.startDate)}${r.endDate ? ' &rarr; ' + formatDate(r.endDate) : ''}</small>` : ''}
              </td>
              <td>
                <span class="status-dot ${r.isActive ? 'on' : 'off'}"></span>
                <button class="btn btn-sm ${r.isActive ? 'btn-outline' : 'btn-green'}" onclick="toggleRecurring('${h(r.id)}', ${!r.isActive})">${r.isActive ? 'Deactivate' : 'Activate'}</button>
              </td>
              <td><span style="font-size:.78rem;color:var(--text2)">${formatDate(r.lastGenerated)}</span></td>
              <td>
                <button class="btn btn-sm btn-outline" onclick="showRecurringForm('${h(r.id)}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRecurring('${h(r.id)}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>` : emptyState(SVG.repeat, 'No recurring transactions yet', 'Add subscriptions, rent, salary, and other repeating transactions to automate your tracking.')}
        </div>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.repeat, 'Failed to load', h(e.message))}</div>`;
  }
}

async function showRecurringForm(id) {
  let rec = {
    title: '',
    amount: '',
    type: 'expense',
    categoryId: '',
    pocketId: '',
    dayOfMonth: 1,
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isActive: true,
    notes: '',
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
    catOptions = categories.map(c =>
      `<option value="${h(c.id)}" ${rec.categoryId === c.id ? 'selected' : ''}>${h(c.icon || '')} ${h(c.name)}</option>`
    ).join('');
    pocketOptions = pockets.filter(p => !p.isArchived).map(p =>
      `<option value="${h(p.id)}" ${rec.pocketId === p.id ? 'selected' : ''}>${h(p.icon || '')} ${h(p.name)}</option>`
    ).join('');
  } catch (e) { /* ignore */ }

  const dayOptions = Array.from({ length: 31 }, (_, i) =>
    `<option value="${i + 1}" ${String(rec.dayOfMonth) === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`
  ).join('');

  const startVal = (rec.startDate || '').split('T')[0].split(' ')[0];
  const endVal = (rec.endDate || '').split('T')[0].split(' ')[0];

  showModal(title, `
    <form onsubmit="saveRecurring(event, '${id || ''}')">
      <div class="form-group">
        <label>Title</label>
        <input name="title" value="${h(rec.title)}" placeholder="e.g. Netflix, Rent, Salary" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Amount (IDR)</label>
          <input name="amount" type="number" value="${h(rec.amount || '')}" required>
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
          <input name="startDate" type="date" value="${h(startVal)}">
        </div>
        <div class="form-group">
          <label>End Date <span style="color:var(--text3)">(optional)</span></label>
          <input name="endDate" type="date" value="${h(endVal)}">
        </div>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="isActive" ${rec.isActive ? 'checked' : ''}>
          Active
        </label>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes" rows="2" placeholder="Optional notes...">${h(rec.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary btn-block">Save</button>
    </form>
  `);
}

async function saveRecurring(e, id) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit], button:not([type])');
  if (!lockForm(btn)) return;
  const f = e.target;
  const body = {
    title: f.title.value,
    amount: parseInt(f.amount.value) || 0,
    type: f.type.value,
    categoryId: f.category.value || undefined,
    pocketId: f.pocket.value || undefined,
    dayOfMonth: parseInt(f.dayOfMonth.value) || 1,
    frequency: f.frequency.value,
    startDate: f.startDate.value || new Date().toISOString().split('T')[0],
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
    unlockForm(btn);
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