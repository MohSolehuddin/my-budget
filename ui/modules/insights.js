// ===== INSIGHTS MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderInsights, generatePredictions

async function renderInsights() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();

  try {
    // Fetch all data in parallel; tolerate individual failures.
    const fetchSafe = async (p) => {
      try { return (await API.get(p)).data; } catch { return null; }
    };
    const [predictions, summaries, summaryData, transactions] = await Promise.all([
      fetchSafe('/api/predictions'),
      fetchSafe('/api/ai-summaries?limit=10'),
      fetchSafe('/api/summary'),
      fetchSafe('/api/transactions'),
    ]);

    // ---- Averages from last 6 months of transactions ----
    const now = new Date();
    const last6 = (transactions || []).filter(t => {
      const d = new Date(typeof t.date === 'string' ? t.date.replace(' ', 'T') : t.date);
      const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      return months >= 0 && months <= 6;
    });
    const incomeTx = last6.filter(t => t.type === 'income' || t.amount > 0);
    const expenseTx = last6.filter(t => t.type === 'expense' || t.amount < 0);
    const monthsCount = Math.max(1, Math.ceil(last6.length / 30));
    const avgIncome = last6.length ? incomeTx.reduce((s, t) => s + Math.abs(t.amount), 0) / monthsCount : 0;
    const avgExpense = last6.length ? expenseTx.reduce((s, t) => s + Math.abs(t.amount), 0) / monthsCount : 0;

    // Fallback to summary totals if tx history is thin
    let incomeBase = avgIncome || (summaryData?.totalIncome || 0);
    let expenseBase = avgExpense || (summaryData?.totalSpent || 0);
    let netBase = incomeBase - expenseBase;

    // ---- Projections ----
    const proj3 = netBase * 3;
    const proj6 = netBase * 6;
    const proj12 = netBase * 12;

    // ---- Debt payoff projection ----
    const ds = summaryData?.debtSummary || {};
    const totalDebt = ds.totalRemaining || 0;
    let debtFreeMonths = null;
    if (totalDebt > 0 && netBase > 0) {
      debtFreeMonths = Math.ceil(totalDebt / netBase);
    }

    // ---- Next-month prediction (from API, else fallback to avg) ----
    const nextMonthStr = (() => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    })();
    const nextPreds = (predictions || []).filter(p => p.targetMonth === nextMonthStr || !p.targetMonth);
    const predIncome = nextPreds.find(p => p.type === 'income')?.predictedAmount ?? incomeBase;
    const predExpense = nextPreds.find(p => p.type === 'expense')?.predictedAmount ?? expenseBase;
    const predSavings = (nextPreds.find(p => p.type === 'savings')?.predictedAmount) ?? (predIncome - predExpense);

    // ---- Render ----
    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Insights</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="generatePredictions()">Generate Predictions</button>
        </div>
      </div>

      <!-- 1. PREDICTIONS (NEXT MONTH) -->
      <h2 class="section-title">Predictions (Next Month: ${h(nextMonthStr)})</h2>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Predicted Income</div>
          <div class="stat-value num green">${formatIDR(predIncome)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Predicted Expense</div>
          <div class="stat-value num red">${formatIDR(predExpense)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Predicted Savings</div>
          <div class="stat-value num ${predSavings < 0 ? 'red' : 'green'}">${formatIDR(predSavings)}</div>
        </div>
      </div>

      <!-- 2. ALL PREDICTIONS TABLE -->
      <div class="card">
        <div class="card-header"><div class="card-title">All Predictions</div></div>
        ${(predictions && predictions.length) ? `
        <div class="table-wrap">
        <table>
          <thead><tr><th>Type</th><th>Amount</th><th>Target</th><th>Confidence</th><th>Auto</th></tr></thead>
          <tbody>${predictions.map(p => {
            const conf = Math.max(0, Math.min(100, p.confidence || 0));
            const confColor = conf > 70 ? 'var(--green)' : conf > 40 ? 'var(--yellow)' : 'var(--red)';
            const typeColor = p.type === 'income' ? 'var(--green)' : p.type === 'expense' ? 'var(--red)' : 'var(--accent)';
            return `
            <tr>
              <td><span style="color:${typeColor}">${h(p.type)}</span></td>
              <td class="num-cell">${formatIDR(p.predictedAmount || 0)}</td>
              <td><span class="text-muted" style="font-size:.8rem">${h(p.targetMonth || formatDate(p.targetDate))}</span></td>
              <td style="min-width:120px">
                <div style="font-size:.8rem;color:${confColor};margin-bottom:2px">${conf}%</div>
                <div class="confidence-bar"><div class="confidence-fill" style="width:${conf}%;background:${confColor}"></div></div>
              </td>
              <td>${p.isAuto ? badge('Auto', 'accent') : badge('Manual', 'neutral')}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
        </div>` : emptyState(SVG.target, 'No predictions yet', 'Click "Generate Predictions" to create forecasts based on your transaction history.')}
      </div>

      <!-- 3. AI SUMMARIES -->
      <h2 class="section-title">AI Summaries</h2>
      ${(summaries && summaries.length) ? `
        <div class="card">
          <div class="card-header"><div class="card-title">Latest Summary &mdash; ${formatDate(summaries[0].summaryDate || summaries[0].summary_date)}</div></div>
          <div class="insight-card">${h(summaries[0].summaryText || summaries[0].summary_text || '')}</div>
          ${summaries[0].totalIncome != null ? `
          <div class="stat-grid">
            <div class="stat-card"><div class="stat-label">Income</div><div class="stat-value num green">${formatIDR(summaries[0].totalIncome)}</div></div>
            <div class="stat-card"><div class="stat-label">Expense</div><div class="stat-value num red">${formatIDR(summaries[0].totalExpense)}</div></div>
            <div class="stat-card"><div class="stat-label">Net</div><div class="stat-value num ${(summaries[0].net || 0) < 0 ? 'red' : 'green'}">${formatIDR(summaries[0].net)}</div></div>
          </div>` : ''}
          ${summaries[0].insights ? `<div class="insight-card warn"><strong>Insights:</strong> ${h(summaries[0].insights)}</div>` : ''}
          ${summaries[0].recommendations ? `<div class="insight-card good"><strong>Recommendations:</strong> ${h(summaries[0].recommendations)}</div>` : ''}
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">Past Summaries</div></div>
          <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Period</th><th>Net</th><th>Summary</th></tr></thead>
            <tbody>${summaries.map(s => `
              <tr>
                <td>${formatDate(s.summaryDate || s.summary_date)}</td>
                <td><span class="text-muted" style="font-size:.8rem">${h(s.period || '-')}</span></td>
                <td class="num-cell ${(s.net || 0) < 0 ? 'text-red' : 'text-green'}">${formatIDR(s.net || 0)}</td>
                <td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="text-muted">${h((s.summaryText || s.summary_text || '').slice(0, 80))}${(s.summaryText || s.summary_text || '').length > 80 ? '&hellip;' : ''}</td>
              </tr>
            `).join('')}</tbody>
          </table>
          </div>
        </div>` : `<div class="card">${emptyState(SVG.chart, 'No AI summaries yet', 'Generate one from your backend to see AI-powered insights here.')}</div>`}

      <!-- 4. PROJECTIONS -->
      <h2 class="section-title">Projections</h2>
      <div class="insight-card">
        Based on your recent averages:
        <strong>Income ${formatIDR(incomeBase)}</strong> / month,
        <strong>Expense ${formatIDR(expenseBase)}</strong> / month,
        <strong class="${netBase < 0 ? 'text-red' : 'text-green'}">Net ${formatIDR(netBase)}</strong> / month.
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Projected Savings (3 mo)</div>
          <div class="stat-value num ${proj3 < 0 ? 'red' : 'green'}">${formatIDR(proj3)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Projected Savings (6 mo)</div>
          <div class="stat-value num ${proj6 < 0 ? 'red' : 'green'}">${formatIDR(proj6)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Projected Savings (12 mo)</div>
          <div class="stat-value num ${proj12 < 0 ? 'red' : 'green'}">${formatIDR(proj12)}</div>
        </div>
      </div>

      <!-- 5. DEBT PAYOFF -->
      ${totalDebt > 0 ? `
      <div class="card">
        <div class="card-header"><div class="card-title">Debt Payoff Projection</div></div>
        <div class="insight-card ${debtFreeMonths ? 'warn' : 'danger'}">
          Total remaining debt: <strong>${formatIDR(totalDebt)}</strong>.
          ${debtFreeMonths !== null
            ? `If you allocate your full monthly net (<strong>${formatIDR(netBase)}</strong>) to debt, you will be <strong>debt-free in ~${debtFreeMonths} months</strong> (${Math.ceil(debtFreeMonths / 12)} year${Math.ceil(debtFreeMonths / 12) > 1 ? 's' : ''}).`
            : 'Your monthly net is not positive &mdash; increase income or reduce expenses to project a payoff timeline.'}
        </div>
      </div>` : ''}

      <!-- 6. WARNING / SUCCESS -->
      ${netBase < 0 ? `<div class="insight-card danger">Warning: You are spending more than you earn on average. Consider cutting expenses or boosting income to avoid accumulating debt.</div>` : ''}
      ${netBase > 0 && totalDebt === 0 ? `<div class="insight-card good">Great! You are saving ${formatIDR(netBase)} per month on average. Keep it up!</div>` : ''}
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.chart, 'Failed to load insights', h(e.message))}</div>`;
  }
}

// ===== GENERATE PREDICTIONS =====
async function generatePredictions() {
  try {
    toast('Generating predictions...');
    await API.post('/api/predictions/generate', {});
    toast('Predictions generated');
    renderInsights();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}