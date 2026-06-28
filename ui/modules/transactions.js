// ===== TRANSACTIONS MODULE v1.1.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderTransactions, showTransactionForm, saveTransaction, deleteTransaction
// Dependencies (global): API, h, formatIDR, formatDate, toast, showModal, closeModal,
//                         emptyState, SVG, badge

async function renderTransactions() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();
  try {
    const { data: transactions } = await API.get('/api/transactions');
    const { data: categories } = await API.get('/api/categories');
    const catMap = {};
    (categories || []).forEach(c => { catMap[c.id] = c.name; });

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Transactions</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="showTransactionForm()">+ Add Transaction</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">All Transactions</div></div>
        ${(transactions && transactions.length) ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Category</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map(t => `
                <tr>
                  <td>${formatDate(t.date)}</td>
                  <td>${h(t.title)}</td>
                  <td>${h(catMap[t.categoryId] || '-')}</td>
                  <td>${badge(t.amount >= 0 ? 'Income' : 'Expense', t.amount >= 0 ? 'green' : 'red')}</td>
                  <td class="num-cell ${t.amount < 0 ? 'red' : 'green'}">${formatIDR(t.amount)}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="showTransactionForm('${h(t.id)}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTransaction('${h(t.id)}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : emptyState(SVG.receipt, 'No transactions yet', 'Add your first transaction to start tracking your spending.') }
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.receipt, 'Failed to load', h(e.message))}</div>`;
  }
}

async function showTransactionForm(id) {
  let tx = {
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
    pocketId: '',
    notes: '',
    type: 'expense',
  };
  let title = 'Add Transaction';

  if (id) {
    title = 'Edit Transaction';
    try {
      const { data: all } = await API.get('/api/transactions');
      const found = (all || []).find(t => t.id === id);
      if (found) {
        tx = { ...tx, ...found };
        // Derive type from amount sign
        tx.type = found.amount >= 0 ? 'income' : 'expense';
      }
    } catch (e) {
      toast('Failed to load transaction: ' + e.message, 'error');
      return;
    }
  }

  try {
    const { data: categories } = await API.get('/api/categories');
    const { data: pockets } = await API.get('/api/pockets');

    // Build category options filtered by type
    const catOptions = (categories || [])
      .filter(c => c.type === tx.type)
      .map(c => `<option value="${h(c.id)}" ${tx.categoryId === c.id ? 'selected' : ''}>${h(c.name)}</option>`)
      .join('');
    const pocketOptions = (pockets || []).filter(p => !p.isArchived).map(p =>
      `<option value="${h(p.id)}" ${tx.pocketId === p.id ? 'selected' : ''}>${h(p.icon || '')} ${h(p.name)}</option>`
    ).join('');

    showModal(title, `
      <form onsubmit="saveTransaction(event, '${id || ''}')">
        <div class="form-group">
          <label>Transaction Type</label>
          <div class="type-toggle" style="display:flex;gap:8px;margin-bottom:4px">
            <label style="flex:1;text-align:center;padding:10px;border:2px solid ${tx.type === 'expense' ? 'var(--red,#ef4444)' : 'var(--border,#333)'};border-radius:8px;cursor:pointer;font-weight:600;color:${tx.type === 'expense' ? 'var(--red,#ef4444)' : 'inherit'}">
              <input type="radio" name="txType" value="expense" ${tx.type !== 'income' ? 'checked' : ''} onchange="onTxTypeChange(this.value)" style="display:none"> 💸 Expense
            </label>
            <label style="flex:1;text-align:center;padding:10px;border:2px solid ${tx.type === 'income' ? 'var(--green,#22c55e)' : 'var(--border,#333)'};border-radius:8px;cursor:pointer;font-weight:600;color:${tx.type === 'income' ? 'var(--green,#22c55e)' : 'inherit'}">
              <input type="radio" name="txType" value="income" ${tx.type === 'income' ? 'checked' : ''} onchange="onTxTypeChange(this.value)" style="display:none"> 💰 Income
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Title</label>
          <input name="title" value="${h(tx.title)}" required>
          <div class="form-hint">Brief description of this transaction.</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Amount (IDR)</label>
            <input name="amount" type="number" class="num" value="${tx.amount ? Math.abs(tx.amount) : ''}" required min="1">
            <div class="form-hint">Enter the amount (always positive).</div>
          </div>
          <div class="form-group">
            <label>Date</label>
            <input name="date" type="date" value="${h(tx.date || '')}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Category <span id="catTypeLabel" style="font-size:.75rem;color:var(--muted,#888)">(${tx.type === 'income' ? 'Income' : 'Expense'} categories)</span></label>
            <select name="categoryId" id="categoryId"><option value="">-- None --</option>${catOptions}</select>
          </div>
          <div class="form-group">
            <label>Pocket</label>
            <select name="pocketId"><option value="">-- None --</option>${pocketOptions}</select>
            <div class="form-hint" id="pocketHint">${tx.type === 'income' ? 'Selected pocket will be filled with this income.' : 'Selected pocket will be reduced by this expense.'}</div>
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

// Handle type toggle: re-fetch categories filtered by type and update pocket hint
async function onTxTypeChange(newType) {
  // Update category options
  try {
    const { data: categories } = await API.get('/api/categories');
    const filtered = (categories || []).filter(c => c.type === newType);
    const sel = document.getElementById('categoryId');
    if (sel) {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">-- None --</option>' + filtered.map(c =>
        `<option value="${h(c.id)}" ${currentVal === c.id ? 'selected' : ''}>${h(c.name)}</option>`
      ).join('');
    }
    // Update label
    const label = document.getElementById('catTypeLabel');
    if (label) label.textContent = `(${newType === 'income' ? 'Income' : 'Expense'} categories)`;
    // Update pocket hint
    const hint = document.getElementById('pocketHint');
    if (hint) hint.textContent = newType === 'income' ? 'Selected pocket will be filled with this income.' : 'Selected pocket will be reduced by this expense.';
    // Update toggle styling
    document.querySelectorAll('input[name="txType"]').forEach(radio => {
      const labelEl = radio.parentElement;
      if (radio.value === 'expense') {
        labelEl.style.borderColor = radio.checked ? 'var(--red,#ef4444)' : 'var(--border,#333)';
        labelEl.style.color = radio.checked ? 'var(--red,#ef4444)' : 'inherit';
      } else {
        labelEl.style.borderColor = radio.checked ? 'var(--green,#22c55e)' : 'var(--border,#333)';
        labelEl.style.color = radio.checked ? 'var(--green,#22c55e)' : 'inherit';
      }
    });
  } catch (e) {
    // silent
  }
}

async function saveTransaction(e, id) {
  e.preventDefault();
  const f = e.target;
  const type = f.txType?.value || 'expense';
  const rawAmount = parseInt(f.amount.value) || 0;
  // Backend handles sign: income → positive, expense → negative
  const body = {
    title: f.title.value,
    amount: rawAmount,
    type: type,
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
  if (!confirm('Delete this transaction? This cannot be undone.')) return;
  try {
    await API.del(`/api/transactions/${id}`);
    toast('Transaction deleted');
    renderTransactions();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}