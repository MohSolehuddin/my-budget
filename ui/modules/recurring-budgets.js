// ===== RECURRING BUDGETS MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderRecurringBudgets, showRecurringBudgetForm,
//          saveRecurringBudget, deleteRecurringBudget,
//          toggleRecurringBudget, generateRecurringBudgets

// ===== RECURRING BUDGETS PAGE =====
async function renderRecurringBudgets() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();
  try {
    const [{ data: recurrings }, { data: categories }, { data: pockets }] = await Promise.all([
      API.get('/api/recurring-budgets'),
      API.get('/api/categories'),
      API.get('/api/pockets'),
    ]);
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name; });
    const pocketMap = {};
    pockets.forEach(p => { pocketMap[p.id] = p; });

    const active = recurrings.filter(r => r.isActive);
    const monthlyTotal = active
      .filter(r => (r.frequency || 'monthly') === 'monthly')
      .reduce((s, r) => s + (r.amount || 0), 0);

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Recurring Budgets</h1>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="generateRecurringBudgets()">Generate Now</button>
          <button class="btn btn-primary" onclick="showRecurringBudgetForm()">Add Recurring Budget</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Active</div>
          <div class="stat-value green">${active.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Recurring</div>
          <div class="stat-value">${recurrings.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Monthly Total</div>
          <div class="stat-value num">${formatIDR(monthlyTotal)}</div>
        </div>
      </div>

      <div class="card">
        ${recurrings.length ? `
        <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th><th>Category</th><th>Amount</th>
              <th>Schedule</th><th>Active</th><th>Last Gen</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${recurrings.map(r => `
            <tr>
              <td>
                <strong>${h(r.title)}</strong>
                ${r.pocketId ? `<br><small class="text-muted">${h(pocketMap[r.pocketId]?.icon || '')} ${h(pocketMap[r.pocketId]?.name || '')}</small>` : ''}
              </td>
              <td>${r.categoryId ? h(catMap[r.categoryId] || '-') : '<span class="text-muted">-</span>'}</td>
              <td class="num-cell">${formatIDR(r.amount || 0)}</td>
              <td>
                <span class="text-muted" style="font-size:.8rem">
                  ${h(r.frequency || 'monthly')} • day ${h(r.dayOfMonth || '-')}
                </span>
                ${r.startDate ? `<br><small class="text-muted">${formatDate(r.startDate)}${r.endDate ? ' &rarr; ' + formatDate(r.endDate) : ''}</small>` : ''}
              </td>
              <td>
                <span class="status-dot ${r.isActive ? 'on' : 'off'}"></span>
                <button class="btn btn-sm ${r.isActive ? 'btn-outline' : 'btn-green'}" onclick="toggleRecurringBudget('${r.id}', ${!r.isActive})">${r.isActive ? 'Deactivate' : 'Activate'}</button>
              </td>
              <td><span class="text-muted" style="font-size:.78rem">${formatDate(r.lastGenerated)}</span></td>
              <td>
                <button class="btn btn-sm btn-outline" onclick="showRecurringBudgetForm('${r.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRecurringBudget('${r.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
        </div>` : emptyState(SVG.repeat, 'No recurring budgets yet', 'Add recurring budget allocations for categories to auto-generate them each period.')}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.chart, 'Failed to load', h(e.message))}</div>`;
  }
}

// ===== FORM =====
async function showRecurringBudgetForm(id) {
  let rb = {
    title: '', amount: '', categoryId: '', pocketId: '',
    dayOfMonth: 1, frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
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
    catOptions = categories
      .map(c => `<option value="${c.id}" ${rb.categoryId === c.id ? 'selected' : ''}>${h(c.name)}</option>`)
      .join('');
    pocketOptions = pockets
      .filter(p => !p.isArchived)
      .map(p => `<option value="${p.id}" ${rb.pocketId === p.id ? 'selected' : ''}>${h(p.icon || '')} ${h(p.name)}</option>`)
      .join('');
  } catch (e) { /* ignore — selects will be empty */ }

  const dayOptions = Array.from({ length: 31 }, (_, i) =>
    `<option value="${i + 1}" ${String(rb.dayOfMonth) === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`
  ).join('');

  const startVal = (rb.startDate || '').split('T')[0].split(' ')[0];
  const endVal = (rb.endDate || '').split('T')[0].split(' ')[0];

  showModal(title, `
    <form onsubmit="saveRecurringBudget(event, '${id || ''}')">
      <div class="form-group">
        <label>Title</label>
        <input name="title" value="${h(rb.title)}" placeholder="e.g. Food Budget, Transport Budget" required>
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
          <input name="startDate" type="date" value="${startVal}">
        </div>
        <div class="form-group">
          <label>End Date <span class="text-muted">(optional)</span></label>
          <input name="endDate" type="date" value="${endVal}">
        </div>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="isActive" ${rb.isActive ? 'checked' : ''}>
          Active
        </label>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes" rows="2" placeholder="Notes...">${h(rb.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary btn-block">Save</button>
    </form>
  `);
}

// ===== SAVE =====
async function saveRecurringBudget(e, id) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit], button:not([type])');
  if (!lockForm(btn)) return;
  const f = e.target;
  const today = new Date().toISOString().split('T')[0];
  const body = {
    title: f.title.value,
    amount: parseInt(f.amount.value) || 0,
    categoryId: f.category.value || undefined,
    pocketId: f.pocket.value || undefined,
    dayOfMonth: parseInt(f.dayOfMonth.value) || 1,
    frequency: f.frequency.value,
    startDate: f.startDate.value || today,
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
    unlockForm(btn);
  }
}

// ===== DELETE =====
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

// ===== TOGGLE ACTIVE =====
async function toggleRecurringBudget(id, makeActive) {
  try {
    await API.put(`/api/recurring-budgets/${id}`, { isActive: !!makeActive });
    toast(makeActive ? 'Activated' : 'Deactivated');
    renderRecurringBudgets();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

// ===== GENERATE =====
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