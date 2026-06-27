// ===== SUMMARY MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderSummary

async function renderSummary() {
  const app = document.getElementById('app');
  if (!app) return;
  try {
    const { data } = await API.get('/api/summary');
    const ds = data.debtSummary || {};
    const net = (data.totalIncome || 0) - (data.totalSpent || 0);
    const spentPct = data.totalBudget > 0 ? Math.round((data.totalSpent / data.totalBudget) * 100) : 0;

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
      </div>

      ${data.cutoffDate ? `
      <div class="cutoff-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
        <span>Cutoff active: <strong>${formatDate(data.cutoffDate)}</strong> — earlier transactions excluded</span>
      </div>` : ''}

      ${data.pockets && data.pockets.length ? `
      <div class="card">
        <div class="card-header"><div class="card-title">Pocket Balances</div></div>
        <div class="stat-grid">
          ${data.pockets.filter(p => !p.isArchived).map(p => `
            <div class="stat-card">
              <div class="stat-label">${h(p.icon || '')} ${h(p.name)}</div>
              <div class="stat-value num ${p.balance < 0 ? 'red' : 'green'}">${formatIDR(p.balance)}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="stat-grid">
        <div class="stat-card hero">
          <div class="stat-label">Net Balance</div>
          <div class="stat-value num ${net < 0 ? 'red' : 'green'}">${formatIDR(net)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Income</div>
          <div class="stat-value num green">${formatIDR(data.totalIncome || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Spent</div>
          <div class="stat-value num red">${formatIDR(data.totalSpent || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Transactions</div>
          <div class="stat-value">${data.transactionCount || 0}</div>
        </div>
        ${ds.totalRemaining !== undefined ? `
        <div class="stat-card">
          <div class="stat-label">Total Debt</div>
          <div class="stat-value num yellow">${formatIDR(ds.totalRemaining || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Debts</div>
          <div class="stat-value">${ds.activeDebts || 0}</div>
        </div>` : ''}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Budget Progress</div></div>
        ${data.budgets && data.budgets.length ? data.budgets.map(b => {
          const pct = b.amount > 0 ? Math.round((b.spentAmount / b.amount) * 100) : 0;
          const c = pctColor(pct);
          return `<div style="margin-bottom:16px">
            <div class="progress-row">
              <span class="progress-label">${h(b.name)}</span>
              <span class="progress-amount num">${formatIDR(b.spentAmount)} / ${formatIDR(b.amount)}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill ${c}" style="width:${Math.min(pct, 100)}%"></div></div>
          </div>`;
        }).join('') : emptyState(SVG.target, 'No budgets yet', 'Create a budget to track your spending limits.')}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Recent Transactions</div></div>
        ${data.recentTransactions && data.recentTransactions.length ? `
        <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Title</th><th>Amount</th></tr></thead>
          <tbody>${data.recentTransactions.map(t => `
            <tr>
              <td>${formatDate(t.date)}</td>
              <td>${h(t.title)}</td>
              <td class="num-cell ${t.amount < 0 ? 'text-red' : 'text-green'}">${formatIDR(t.amount)}</td>
            </tr>
          `).join('')}</tbody>
        </table>
        </div>` : emptyState(SVG.receipt, 'No transactions yet', 'Tap the + button to add your first transaction.')}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.chart, 'Failed to load', h(e.message))}</div>`;
  }
}