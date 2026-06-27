// ===== BUDGETS MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderBudgets, showBudgetForm, saveBudget, deleteBudget
// Dependencies (global): API, h, formatIDR, formatDate, toast, showModal, closeModal,
//                         emptyState, SVG

async function renderBudgets() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();
  try {
    const { data: budgets } = await API.get('/api/budgets');
    const { data: categories } = await API.get('/api/categories');
    const catMap = {};
    (categories || []).forEach(c => { catMap[c.id] = c.name; });

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Budgets</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="showBudgetForm()">+ Add Budget</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">All Budgets</div></div>
        ${(budgets && budgets.length) ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>Period</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${budgets.map(b => `
                <tr>
                  <td>${h(catMap[b.categoryId] || b.name || '-')}</td>
                  <td class="num-cell">${formatIDR(b.amount)}</td>
                  <td>${formatDate(b.periodStart)} &rarr; ${formatDate(b.periodEnd)}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="showBudgetForm('${h(b.id)}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteBudget('${h(b.id)}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : emptyState(SVG.target, 'No budgets yet', 'Create a budget to track your spending limits per category.')}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.target, 'Failed to load', h(e.message))}</div>`;
  }
}

async function showBudgetForm(id) {
  let budget = {
    categoryId: '',
    amount: '',
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: '',
  };
  let title = 'Add Budget';

  if (id) {
    title = 'Edit Budget';
    try {
      const { data: all } = await API.get('/api/budgets');
      const found = (all || []).find(b => b.id === id);
      if (found) budget = { ...budget, ...found };
    } catch (e) {
      toast('Failed to load budget: ' + e.message, 'error');
      return;
    }
  }

  try {
    const { data: categories } = await API.get('/api/categories');
    const catOptions = (categories || []).map(c =>
      `<option value="${h(c.id)}" ${budget.categoryId === c.id ? 'selected' : ''}>${h(c.name)}</option>`
    ).join('');

    showModal(title, `
      <form onsubmit="saveBudget(event, '${id || ''}')">
        <div class="form-group">
          <label>Category</label>
          <select name="categoryId" required>
            <option value="">-- Select --</option>
            ${catOptions}
          </select>
          <div class="form-hint">Choose the category this budget applies to.</div>
        </div>
        <div class="form-group">
          <label>Amount (IDR)</label>
          <input name="amount" type="number" class="num" value="${budget.amount || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Period Start</label>
            <input name="periodStart" type="date" value="${h(budget.periodStart || '')}">
          </div>
          <div class="form-group">
            <label>Period End</label>
            <input name="periodEnd" type="date" value="${h(budget.periodEnd || '')}">
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
  if (!confirm('Delete this budget? This cannot be undone.')) return;
  try {
    await API.del(`/api/budgets/${id}`);
    toast('Budget deleted');
    renderBudgets();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}