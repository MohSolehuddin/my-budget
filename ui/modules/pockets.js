// ===== POCKETS MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderPockets, showPocketForm, savePocket, deletePocket,
//          showTransferForm, doTransfer
// Dependencies (global): API, h, formatIDR, formatDate, toast, showModal, closeModal,
//                         emptyState, badge, SVG

const POCKET_TYPE_LABEL = {
  cash: 'Cash',
  bank: 'Bank',
  ewallet: 'E-Wallet',
  investment: 'Investment',
  other: 'Other',
};

async function renderPockets() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();
  try {
    const { data: pockets } = await API.get('/api/pockets');
    const active = (pockets || []).filter(p => !p.isArchived);
    const totalBalance = active.reduce((sum, p) => sum + (p.balance || 0), 0);

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Pockets</h1>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="showTransferForm()">Transfer</button>
          <button class="btn btn-primary" onclick="showPocketForm()">+ Add Pocket</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Total Balance</div>
          <div class="stat-value num ${totalBalance < 0 ? 'red' : 'green'}">${formatIDR(totalBalance)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pocket Count</div>
          <div class="stat-value">${active.length}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">All Pockets</div></div>
        ${(pockets && pockets.length) ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Account</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pockets.map(p => `
                <tr style="${p.isArchived ? 'opacity:0.5' : ''}">
                  <td>
                    <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${h(p.color || '#3b82f6')};margin-right:8px;vertical-align:middle"></span>
                    ${h(p.icon || '')} <strong>${h(p.name)}</strong>
                    ${p.isArchived ? '<span style="color:var(--text2);font-size:.75rem;margin-left:8px">(archived)</span>' : ''}
                  </td>
                  <td>${h(POCKET_TYPE_LABEL[p.type] || p.type || '-')}</td>
                  <td>
                    ${p.accountNumber ? `
                      <span style="font-size:.8rem;color:var(--text2)">${h(p.accountNumber)}</span>
                      ${p.bankName ? `<br><small style="color:var(--text2)">${h(p.bankName)}</small>` : ''}
                    ` : '<span style="color:var(--text2)">-</span>'}
                  </td>
                  <td class="num-cell ${p.balance < 0 ? 'red' : 'green'}">${formatIDR(p.balance)}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="showPocketForm('${h(p.id)}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deletePocket('${h(p.id)}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : emptyState(SVG.wallet, 'No pockets yet', 'Add a pocket to track cash, bank accounts, e-wallets, and more.')}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.wallet, 'Failed to load', h(e.message))}</div>`;
  }
}

async function showPocketForm(id) {
  let pocket = {
    name: '',
    balance: '',
    type: 'cash',
    accountNumber: '',
    bankName: '',
    icon: '',
    color: '#3b82f6',
    isArchived: false,
    notes: '',
  };
  let title = 'Add Pocket';

  if (id) {
    title = 'Edit Pocket';
    try {
      const { data: all } = await API.get('/api/pockets');
      const found = (all || []).find(p => p.id === id);
      if (found) pocket = { ...pocket, ...found };
    } catch (e) {
      toast('Failed to load pocket: ' + e.message, 'error');
      return;
    }
  }

  showModal(title, `
    <form onsubmit="savePocket(event, '${id || ''}')">
      <div class="form-group">
        <label>Name</label>
        <input name="name" value="${h(pocket.name)}" required>
        <div class="form-hint">A label for this pocket, e.g. "Main Bank" or "Grocery Cash".</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Initial Balance (IDR)</label>
          <input name="balance" type="number" class="num" value="${pocket.initialBalance !== undefined ? pocket.initialBalance : (pocket.balance || '')}" required>
          <div class="form-hint">Starting balance before any transactions. Current actual balance: ${formatIDR(pocket.balance || 0)}</div>
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
          <label>Account Number <small style="color:var(--text2)">(optional)</small></label>
          <input name="accountNumber" value="${h(pocket.accountNumber || '')}" placeholder="e.g. 1234567890">
        </div>
        <div class="form-group">
          <label>Bank Name <small style="color:var(--text2)">(optional)</small></label>
          <input name="bankName" value="${h(pocket.bankName || '')}" placeholder="e.g. BCA, Mandiri">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Icon</label>
          <input name="icon" value="${h(pocket.icon || '')}" placeholder="emoji or short text">
        </div>
        <div class="form-group">
          <label>Color</label>
          <input name="color" type="color" value="${h(pocket.color || '#3b82f6')}" style="height:42px;padding:4px">
        </div>
      </div>
      ${id ? `
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" name="isArchived" ${pocket.isArchived ? 'checked' : ''} style="width:auto">
          Archived
        </label>
        <div class="form-hint">Archived pockets are hidden from totals but kept for history.</div>
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
    accountNumber: f.accountNumber.value || undefined,
    bankName: f.bankName.value || undefined,
    icon: f.icon.value || undefined,
    color: f.color.value || undefined,
    notes: f.notes.value || undefined,
  };
  if (id) body.isArchived = f.isArchived ? f.isArchived.checked : false;

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
  if (!confirm('Delete this pocket? Related transactions will keep their records but lose the pocket reference.')) return;
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
    const active = (pockets || []).filter(p => !p.isArchived);
    if (active.length < 2) {
      toast('Need at least 2 active pockets to transfer', 'error');
      return;
    }

    const options = active.map(p =>
      `<option value="${h(p.id)}">${h(p.icon || '')} ${h(p.name)} (${formatIDR(p.balance)})</option>`
    ).join('');

    showModal('Transfer Between Pockets', `
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
          <label>Amount (IDR)</label>
          <input name="amount" type="number" class="num" required>
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
  if (f.fromId.value === f.toId.value) {
    toast('Cannot transfer to the same pocket', 'error');
    return;
  }
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