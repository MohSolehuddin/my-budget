// ===== DEBTS MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderDebts, showDebtForm, saveDebt, deleteDebt, showPayDebtForm, payDebt
// Dependencies (global): API, h, formatIDR, formatDate, toast, showModal, closeModal,
//                         emptyState, badge, SVG

const DEBT_STATUS_BADGE = {
  active: 'yellow',
  paid_off: 'green',
  defaulted: 'red',
  on_hold: 'neutral',
};

const DEBT_TYPE_LABEL = {
  loan: 'Loan',
  credit_card: 'Credit Card',
  paylater: 'Paylater',
  installment: 'Installment',
  other: 'Other',
};

async function renderDebts() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();
  try {
    const { data: debts } = await API.get('/api/debts');
    const { data: summary } = await API.get('/api/debts/summary');
    const s = summary || {};

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Debts</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="showDebtForm()">+ Add Debt</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Total Debt</div>
          <div class="stat-value num yellow">${formatIDR(s.totalRemaining || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Paid</div>
          <div class="stat-value num green">${formatIDR(s.totalPaid || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active</div>
          <div class="stat-value">${s.activeDebts || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Paid Off</div>
          <div class="stat-value green">${s.paidOffDebts || 0}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">All Debts</div></div>
        ${(debts && debts.length) ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Remaining</th>
                <th>Original</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${debts.map(d => `
                <tr>
                  <td>
                    <strong>${h(d.name)}</strong>
                    ${d.creditor ? `<br><small style="color:var(--text2)">${h(d.creditor)}</small>` : ''}
                  </td>
                  <td>${h(DEBT_TYPE_LABEL[d.type] || d.type || '-')}</td>
                  <td class="num-cell">${formatIDR(d.remainingAmount)}</td>
                  <td class="num-cell">${formatIDR(d.originalAmount)}</td>
                  <td>${badge(h(d.status || 'active'), DEBT_STATUS_BADGE[d.status] || 'neutral')}</td>
                  <td>
                    ${d.status !== 'paid_off' ? `<button class="btn btn-sm btn-green" onclick="showPayDebtForm('${h(d.id)}')">Pay</button>` : ''}
                    <button class="btn btn-sm btn-outline" onclick="showDebtForm('${h(d.id)}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDebt('${h(d.id)}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : emptyState(SVG.debt, 'No debts yet', 'Track loans, credit cards, and other debts here.')}
      </div>

      ${(s.upcomingPayments && s.upcomingPayments.length) ? `
      <div class="card">
        <div class="card-header"><div class="card-title">Upcoming Payments (30 days)</div></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Debt</th>
                <th>Amount</th>
                <th>Due</th>
                <th>Days Left</th>
              </tr>
            </thead>
            <tbody>
              ${s.upcomingPayments.map(p => {
                const days = p.daysUntilDue;
                const urgency = days <= 3 ? 'red' : days <= 7 ? 'yellow' : 'green';
                return `
                <tr>
                  <td>${h(p.name)}</td>
                  <td class="num-cell">${formatIDR(p.amount)}</td>
                  <td>${formatDate(p.dueDate)}</td>
                  <td class="num-cell"><span class="badge badge-${urgency}">${days} days</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.debt, 'Failed to load', h(e.message))}</div>`;
  }
}

async function showDebtForm(id) {
  let debt = {
    name: '',
    type: 'loan',
    creditor: '',
    originalAmount: '',
    remainingAmount: '',
    interestRate: '',
    termMonths: '',
    startDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'active',
    notes: '',
  };
  let title = 'Add Debt';

  if (id) {
    title = 'Edit Debt';
    try {
      const { data: all } = await API.get('/api/debts');
      const found = (all || []).find(d => d.id === id);
      if (found) debt = { ...debt, ...found };
    } catch (e) {
      toast('Failed to load debt: ' + e.message, 'error');
      return;
    }
  }

  showModal(title, `
    <form onsubmit="saveDebt(event, '${id || ''}')">
      <div class="form-group">
        <label>Name</label>
        <input name="name" value="${h(debt.name)}" required>
        <div class="form-hint">A label for this debt, e.g. "Car Loan" or "Credit Card A".</div>
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
          <input name="creditor" value="${h(debt.creditor || '')}" placeholder="e.g. Bank BCA">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Original Amount (IDR)</label>
          <input name="originalAmount" type="number" class="num" value="${debt.originalAmount || ''}" required>
        </div>
        <div class="form-group">
          <label>Remaining Amount (IDR)</label>
          <input name="remainingAmount" type="number" class="num" value="${debt.remainingAmount || ''}">
          <div class="form-hint">Defaults to original amount if left blank.</div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Interest Rate (%)</label>
          <input name="interestRate" type="number" step="0.01" class="num" value="${debt.interestRate || ''}">
        </div>
        <div class="form-group">
          <label>Term (months)</label>
          <input name="termMonths" type="number" class="num" value="${debt.termMonths || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Start Date</label>
          <input name="startDate" type="date" value="${h(debt.startDate || '')}">
        </div>
        <div class="form-group">
          <label>Due Date</label>
          <input name="dueDate" type="date" value="${h(debt.dueDate || '')}">
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
  if (id) body.status = f.status ? f.status.value : undefined;

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
  if (!confirm('Delete this debt? Payment history will also be removed.')) return;
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
    const debt = (all || []).find(d => d.id === debtId);
    if (!debt) {
      toast('Debt not found', 'error');
      return;
    }

    showModal(`Pay: ${h(debt.name)}`, `
      <div style="margin-bottom:16px;padding:12px 16px;background:var(--surface2);border-radius:8px;color:var(--text2)">
        Remaining balance: <strong class="num" style="color:var(--yellow)">${formatIDR(debt.remainingAmount)}</strong>
      </div>
      <form onsubmit="payDebt(event, '${h(debtId)}')">
        <div class="form-group">
          <label>Payment Amount (IDR)</label>
          <input name="amount" type="number" class="num" value="${debt.remainingAmount}" required>
          <div class="form-hint">Enter the amount you are paying off.</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Payment Date</label>
            <input name="paymentDate" type="date" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label>Payment Method</label>
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