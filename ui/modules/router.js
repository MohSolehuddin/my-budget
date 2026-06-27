// ===== ROUTER MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: navigate, renderPage, toggleSidebar, bindNavLinks, PAGE_TITLES, currentPage

const PAGE_TITLES = {
  'summary': 'Summary',
  'transactions': 'Transactions',
  'budgets': 'Budgets',
  'debts': 'Debts',
  'pockets': 'Pockets',
  'savings-targets': 'Targets',
  'recurring-transactions': 'Recurring',
  'recurring-budgets': 'Recurring Budgets',
  'insights': 'Insights',
  'cutoffs': 'Cutoffs',
  'categories': 'Categories',
};

let currentPage = 'summary';

function toggleSidebar(forceOpen) {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  if (forceOpen === false) { sb.classList.remove('open'); return; }
  sb.classList.toggle('open');
}

function bindNavLinks() {
  document.querySelectorAll('.nav-link, .bottom-nav-link').forEach(link => {
    if (link.dataset.bound === '1') return;
    link.dataset.bound = '1';
    link.addEventListener('click', (e) => {
      if (!link.dataset.page) return;
      e.preventDefault();
      navigate(link.dataset.page);
      toggleSidebar(false);
    });
  });
}

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-link, .bottom-nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll(`[data-page="${page}"]`).forEach(l => l.classList.add('active'));
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;
  renderPage(page);
}

function renderPage(page) {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();
  switch (page) {
    case 'summary': renderSummary(); break;
    case 'transactions': renderTransactions(); break;
    case 'budgets': renderBudgets(); break;
    case 'debts': renderDebts(); break;
    case 'pockets': renderPockets(); break;
    case 'savings-targets': renderSavingsTargets(); break;
    case 'recurring-transactions': renderRecurringTransactions(); break;
    case 'recurring-budgets': renderRecurringBudgets(); break;
    case 'insights': renderInsights(); break;
    case 'cutoffs': renderCutoffs(); break;
    case 'categories': renderCategories(); break;
    default: app.innerHTML = emptyState(SVG.chart, 'Page not found', 'This page does not exist.');
  }
}

// Bind nav links on load
bindNavLinks();