// ===== SAVINGS TARGETS MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderSavingsTargets, showSavingsTargetForm, saveSavingsTarget, deleteSavingsTarget

async function renderSavingsTargets() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();
  try {
    const [{ data: targets }, { data: pockets }] = await Promise.all([
      API.get('/api/savings-targets'),
      API.get('/api/pockets'),
    ]);
    const pocketMap = {};
    pockets.forEach(p => { pocketMap[p.id] = p; });

    const totalSaved = targets.reduce((s, t) => s + (t.currentAmount || 0), 0);
    const totalTarget = targets.reduce((s, t) => s + (t.targetAmount || 0), 0);
    const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
    const overallColor = pctColor(overallPct);

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Savings Targets</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="showSavingsTargetForm()">+ Add Target</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Total Targets</div>
          <div class="stat-value">${targets.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Saved</div>
          <div class="stat-value num green">${formatIDR(totalSaved)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Target</div>
          <div class="stat-value num">${formatIDR(totalTarget)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Overall Progress</div>
          <div class="stat-value ${overallColor}">${overallPct}%</div>
          <div class="progress-bar sm"><div class="progress-fill ${overallColor}" style="width:${Math.min(overallPct, 100)}%"></div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">All Targets</div></div>
        <div class="table-wrap">
        ${targets.length ? `
        <table>
          <thead><tr><th>Target</th><th>Saved / Target</th><th>Progress</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${targets.map(t => {
            const pct = t.targetAmount > 0 ? Math.min(100, Math.round(((t.currentAmount || 0) / t.targetAmount) * 100)) : 0;
            const c = pctColor(pct);
            const pk = t.pocketId ? pocketMap[t.pocketId] : null;
            const statusType = t.status === 'completed' ? 'green' : t.status === 'paused' ? 'yellow' : 'accent';
            const targetTypeLabel = t.targetType === 'investment' ? 'Investment' : 'Pocket';
            return `
            <tr>
              <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${h(t.color || '#3b82f6')};margin-right:8px;vertical-align:middle"></span>
                ${h(t.icon || '')} <strong>${h(t.title)}</strong>
                ${pk ? `<br><small style="color:var(--text2)">${h(pk.icon || '')} ${h(pk.name)}</small>` : ''}
              </td>
              <td>
                <span class="num" style="color:var(--green)">${formatIDR(t.currentAmount || 0)}</span>
                <span class="num" style="color:var(--text2)"> / ${formatIDR(t.targetAmount || 0)}</span>
              </td>
              <td style="min-width:120px">
                <div style="font-size:.8rem;color:var(--text2);margin-bottom:4px">${pct}%</div>
                <div class="progress-bar sm"><div class="progress-fill ${c}" style="width:${pct}%"></div></div>
              </td>
              <td>${formatDate(t.targetDate)}</td>
              <td>
                ${badge(h(t.status || 'active'), statusType)}
                <br><small style="color:var(--text2)">${badge(targetTypeLabel, 'neutral')}</small>
              </td>
              <td>
                <button class="btn btn-sm btn-outline" onclick="showSavingsTargetForm('${h(t.id)}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSavingsTarget('${h(t.id)}')">Delete</button>
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : emptyState(SVG.target, 'No savings targets yet', 'Add a target to start tracking your savings goals and progress.')}
        </div>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.target, 'Failed to load', h(e.message))}</div>`;
  }
}

async function showSavingsTargetForm(id) {
  let target = {
    title: '',
    targetAmount: '',
    currentAmount: '',
    pocketId: '',
    targetDate: '',
    targetType: 'pocket',
    icon: '',
    color: '#3b82f6',
    status: 'active',
    notes: '',
  };
  let title = 'Add Savings Target';

  if (id) {
    title = 'Edit Savings Target';
    try {
      const { data: all } = await API.get('/api/savings-targets');
      target = { ...target, ...(all.find(t => t.id === id) || {}) };
    } catch (e) { /* use defaults */ }
  }

  let pocketOptions = '';
  try {
    const { data: pockets } = await API.get('/api/pockets');
    pocketOptions = pockets.filter(p => !p.isArchived).map(p =>
      `<option value="${h(p.id)}" ${target.pocketId === p.id ? 'selected' : ''}>${h(p.icon || '')} ${h(p.name)}</option>`
    ).join('');
  } catch (e) { /* ignore */ }

  const dateVal = (target.targetDate || '').split('T')[0].split(' ')[0];

  showModal(title, `
    <form onsubmit="saveSavingsTarget(event, '${id || ''}')">
      <div class="form-group">
        <label>Title</label>
        <input name="title" value="${h(target.title)}" placeholder="e.g. Emergency Fund, Vacation" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Target Amount (IDR)</label>
          <input name="targetAmount" type="number" value="${h(target.targetAmount || '')}" required>
        </div>
        <div class="form-group">
          <label>Current Amount (IDR)</label>
          <input name="currentAmount" type="number" value="${h(target.currentAmount || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Target Date</label>
          <input name="targetDate" type="date" value="${h(dateVal)}">
        </div>
        <div class="form-group">
          <label>Pocket</label>
          <select name="pocket"><option value="">-- None --</option>${pocketOptions}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Target Type</label>
        <select name="targetType">
          <option value="pocket" ${(target.targetType || 'pocket') === 'pocket' ? 'selected' : ''}>Pocket / Bank</option>
          <option value="investment" ${target.targetType === 'investment' ? 'selected' : ''}>Investment</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Icon (emoji)</label>
          <input name="icon" value="${h(target.icon || '')}" placeholder="e.g. 🎯">
        </div>
        <div class="form-group">
          <label>Color</label>
          <input name="color" type="color" value="${h(target.color || '#3b82f6')}">
        </div>
      </div>
      ${id ? `
      <div class="form-group">
        <label>Status</label>
        <select name="status">
          <option value="active" ${target.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="paused" ${target.status === 'paused' ? 'selected' : ''}>Paused</option>
          <option value="completed" ${target.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </div>` : ''}
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes" rows="2" placeholder="Optional notes...">${h(target.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary btn-block">Save</button>
    </form>
  `);
}

async function saveSavingsTarget(e, id) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit], button:not([type])');
  if (!lockForm(btn)) return;
  const f = e.target;
  const body = {
    title: f.title.value,
    targetAmount: parseInt(f.targetAmount.value) || 0,
    currentAmount: parseInt(f.currentAmount.value) || 0,
    targetDate: f.targetDate.value || undefined,
    pocketId: f.pocket.value || undefined,
    targetType: f.targetType.value || 'pocket',
    icon: f.icon.value || undefined,
    color: f.color.value || undefined,
    notes: f.notes.value || undefined,
  };
  if (id && f.status) body.status = f.status.value;
  try {
    if (id) {
      await API.put(`/api/savings-targets/${id}`, body);
      toast('Target updated');
    } else {
      await API.post('/api/savings-targets', body);
      toast('Target added');
    }
    closeModal();
    renderSavingsTargets();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
    unlockForm(btn);
  }
}

async function deleteSavingsTarget(id) {
  if (!confirm('Delete this savings target?')) return;
  try {
    await API.del(`/api/savings-targets/${id}`);
    toast('Target deleted');
    renderSavingsTargets();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}