// ===== BUDGETS MODULE v1.1.0 =====
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
    (categories || []).forEach(c => { catMap[c.id] = c; });

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Budgets</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="showBudgetForm()">+ Add Budget</button>
        </div>
      </div>

      ${(budgets && budgets.length) ? budgets.map(b => {
        const cat = catMap[b.categoryId] || {};
        const spent = b.spentAmount || 0;
        const remaining = b.remaining != null ? b.remaining : (b.amount - spent);
        const daysLeft = b.daysLeft;
        const daily = b.dailyAllowance;
        const pct = b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0;
        const overBudget = remaining < 0;
        const barColor = overBudget ? 'red' : pct > 80 ? 'yellow' : 'green';
        const catColor = cat.color || '#3b82f6';
        const catIcon = cat.icon || '💰';

        return `
        <div class="card budget-card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:1.2rem">${h(catIcon)}</span>
                <h3 style="margin:0;font-size:1rem">${h(b.name || cat.name || '-')}</h3>
              </div>
              <div style="font-size:0.75rem;color:var(--text2)">
                ${formatDate(b.periodStart)} → ${formatDate(b.periodEnd)}
              </div>
            </div>
            <div style="text-align:right;white-space:nowrap">
              <div class="num-cell" style="font-size:1.1rem;font-weight:600;${overBudget ? 'color:var(--red)' : ''}">${formatIDR(remaining)}</div>
              <div style="font-size:0.7rem;color:var(--text2)">remaining of ${formatIDR(b.amount)}</div>
            </div>
          </div>

          <!-- Progress bar -->
          <div style="margin:10px 0 6px;height:8px;border-radius:4px;background:var(--surface3);overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--${barColor});border-radius:4px;transition:width 0.3s"></div>
          </div>

          <!-- Stats row -->
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:0.8rem">
            <div>
              <span style="color:var(--text2)">Spent: </span>
              <span style="font-weight:600;color:var(--red)">${formatIDR(spent)}</span>
              <span style="color:var(--text2)"> (${pct}%)</span>
            </div>
            ${daysLeft != null ? `
            <div>
              <span style="color:var(--text2)">Days left: </span>
              <span style="font-weight:600;${daysLeft <= 0 ? 'color:var(--red)' : ''}">${daysLeft}</span>
            </div>` : ''}
          </div>

          <!-- Daily allowance highlight -->
          ${daily != null && daysLeft > 0 ? `
          <div style="margin-top:8px;padding:8px 12px;border-radius:8px;background:var(--surface2);border-left:3px solid var(--${barColor})">
            <div style="font-size:0.7rem;color:var(--text2);margin-bottom:2px">💸 Harus habis maksimal per hari:</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--${barColor})">${formatIDR(daily)}<span style="font-size:0.75rem;font-weight:400;color:var(--text2)"> /hari</span></div>
          </div>` : ''}
          ${daysLeft != null && daysLeft <= 0 ? `
          <div style="margin-top:8px;padding:8px 12px;border-radius:8px;background:var(--surface2);border-left:3px solid var(--red)">
            <div style="font-size:0.8rem;color:var(--red);font-weight:600">⏰ Periode budget sudah berakhir</div>
          </div>` : ''}
          ${overBudget && daysLeft > 0 ? `
          <div style="margin-top:8px;padding:8px 12px;border-radius:8px;background:var(--surface2);border-left:3px solid var(--red)">
            <div style="font-size:0.8rem;color:var(--red);font-weight:600">⚠️ Over budget! Pengeluaran melebihi budget</div>
          </div>` : ''}

          <!-- Actions -->
          <div style="margin-top:10px;display:flex;gap:8px">
            <button class="btn btn-sm btn-outline" onclick="showBudgetForm('${h(b.id)}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteBudget('${h(b.id)}')">Delete</button>
          </div>
        </div>`;
      }).join('') : emptyState(SVG.target, 'No budgets yet', 'Create a budget to track your spending limits per category.')}
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
  const btn = e.target.querySelector('button[type=submit], button:not([type])');
  if (!lockForm(btn)) return;
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
    unlockForm(btn);
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