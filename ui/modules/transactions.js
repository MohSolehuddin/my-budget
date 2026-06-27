// ===== TRANSACTIONS MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderTransactions, showTransactionForm, saveTransaction, deleteTransaction
// Dependencies (global): API, h, formatIDR, formatDate, toast, showModal, closeModal,
//                         emptyState, SVG

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
                  <td class="num-cell ${t.amount < 0 ? 'red' : 'green'}">${formatIDR(t.amount)}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="showTransactionForm('${h(t.id)}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTransaction('${h(t.id)}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : emptyState(SVG.receipt, 'No transactions yet', 'Add your first transaction to start tracking your spending.')}
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
  };
  let title = 'Add Transaction';

  if (id) {
    title = 'Edit Transaction';
    try {
      const { data: all } = await API.get('/api/transactions');
      const found = (all || []).find(t => t.id === id);
      if (found) tx = { ...tx, ...found };
    } catch (e) {
      toast('Failed to load transaction: ' + e.message, 'error');
      return;
    }
  }

  try {
    const { data: categories } = await API.get('/api/categories');
    const { data: pockets } = await API.get('/api/pockets');
    const catOptions = (categories || []).map(c =>
      `<option value="${h(c.id)}" ${tx.categoryId === c.id ? 'selected' : ''}>${h(c.name)}</option>`
    ).join('');
    const pocketOptions = (pockets || []).filter(p => !p.isArchived).map(p =>
      `<option value="${h(p.id)}" ${tx.pocketId === p.id ? 'selected' : ''}>${h(p.icon || '')} ${h(p.name)}</option>`
    ).join('');

    showModal(title, `
      <form onsubmit="saveTransaction(event, '${id || ''}')">
        <div class="form-group">
          <label>Title</label>
          <input name="title" value="${h(tx.title)}" required>
          <div class="form-hint">Brief description of this transaction.</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Amount (IDR)</label>
            <input name="amount" type="number" class="num" value="${tx.amount || ''}" required>
            <div class="form-hint">Use negative for expenses, positive for income.</div>
          </div>
          <div class="form-group">
            <label>Date</label>
            <input name="date" type="date" value="${h(tx.date || '')}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <select name="categoryId"><option value="">-- None --</option>${catOptions}</select>
          </div>
          <div class="form-group">
            <label>Pocket</label>
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
  if (!confirm('Delete this transaction? This cannot be undone.')) return;
  try {
    await API.del(`/api/transactions/${id}`);
    toast('Transaction deleted');
    renderTransactions();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}