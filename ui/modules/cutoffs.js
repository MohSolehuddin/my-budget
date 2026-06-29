// ===== CUTOFFS MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderCutoffs, showCutoffForm, saveCutoff, deleteCutoff

async function renderCutoffs() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();
  try {
    const { data: cutoffs } = await API.get('/api/cutoffs');
    const { data: summary } = await API.get('/api/summary');
    const activeCutoff = summary.cutoffDate || null;

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Cutoffs</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="showCutoffForm()">+ Add Cutoff</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Active Cutoff</div>
          <div class="stat-value ${activeCutoff ? 'yellow' : ''}">${activeCutoff ? formatDate(activeCutoff) : '-'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Cutoffs</div>
          <div class="stat-value">${cutoffs.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Dashboard Tx Count</div>
          <div class="stat-value">${summary.transactionCount || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Tx (All)</div>
          <div class="stat-value">${summary.totalTransactionsAll || 0}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Cutoff History</div></div>
        <div class="info-box" style="margin-bottom:16px;padding:12px 16px;background:var(--surface2);border-radius:var(--radius-sm);font-size:.85rem;color:var(--text2);line-height:1.6">
          <strong style="color:var(--text)">Cutoff</strong> is a boundary date. Transactions <strong>before</strong> the cutoff date are excluded from dashboard calculations (income, spent, budget progress), but remain saved and still affect pocket balances.
        </div>
        ${cutoffs.length ? `
        <div class="table-wrap">
        <table>
          <thead><tr><th>Title</th><th>Cutoff Date</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>${cutoffs.map(c => `
            <tr>
              <td><strong>${h(c.title)}</strong></td>
              <td>${formatDate(c.cutoffDate)}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h(c.notes || '-')}</td>
              <td>
                <button class="btn btn-sm btn-outline" onclick="showCutoffForm('${h(c.id)}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCutoff('${h(c.id)}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
        </div>` : emptyState(SVG.scissors, 'No cutoffs yet', 'Add a cutoff to start fresh from a specific date. Transactions before it will be excluded from the dashboard.')}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.scissors, 'Failed to load', h(e.message))}</div>`;
  }
}

async function showCutoffForm(id) {
  let cutoff = {
    title: '',
    cutoffDate: new Date().toISOString().split('T')[0],
    notes: '',
  };
  let title = 'Add Cutoff';

  if (id) {
    title = 'Edit Cutoff';
    try {
      const { data: all } = await API.get('/api/cutoffs');
      cutoff = all.find(c => c.id === id) || cutoff;
    } catch (e) { /* use defaults */ }
  }

  const dateVal = (cutoff.cutoffDate || '').split('T')[0].split(' ')[0];

  showModal(title, `
    <form onsubmit="saveCutoff(event, '${id || ''}')">
      <div class="form-group">
        <label>Title</label>
        <input name="title" value="${h(cutoff.title)}" placeholder="e.g. Fresh Start" required>
      </div>
      <div class="form-group">
        <label>Cutoff Date</label>
        <input name="cutoffDate" type="date" value="${h(dateVal)}" required>
        <div class="form-hint">Transactions before this date will be excluded from the dashboard.</div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes" rows="3" placeholder="Optional notes...">${h(cutoff.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary btn-block">Save</button>
    </form>
  `);
}

async function saveCutoff(e, id) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit], button:not([type])');
  if (!lockForm(btn)) return;
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
  } catch (err) {
    toast('Error: ' + err.message, 'error');
    unlockForm(btn);
  }
}

async function deleteCutoff(id) {
  if (!confirm('Delete this cutoff? The dashboard will show all transactions again.')) return;
  try {
    await API.del(`/api/cutoffs/${id}`);
    toast('Cutoff deleted');
    renderCutoffs();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}