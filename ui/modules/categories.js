// ===== CATEGORIES MODULE v1.1.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: renderCategories, showCategoryForm, saveCategory, deleteCategory

async function renderCategories() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = loadingState();
  try {
    const { data: categories } = await API.get('/api/categories');

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Categories</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="showCategoryForm()">+ Add Category</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">All Categories</div></div>
        ${categories.length ? `
        <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Color</th><th>Actions</th></tr></thead>
          <tbody>${categories.map(c => `
            <tr>
              <td>
                <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${h(c.color || '#3b82f6')};margin-right:8px;vertical-align:middle"></span>
                ${h(c.icon || '')} <strong>${h(c.name)}</strong>
              </td>
              <td>${badge(c.type === 'income' ? 'Income' : 'Expense', c.type === 'income' ? 'green' : 'red')}</td>
              <td><code style="font-size:.8rem">${h(c.color || '-')}</code></td>
              <td>
                <button class="btn btn-sm btn-outline" onclick="showCategoryForm('${h(c.id)}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory('${h(c.id)}')">Delete</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
        </div>` : emptyState(SVG.tag, 'No categories yet', 'Create categories to organize your transactions.') }
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyState(SVG.tag, 'Failed to load', h(e.message))}</div>`;
  }
}

async function showCategoryForm(id) {
  let cat = { name: '', icon: '', color: '#3b82f6', type: 'expense' };
  let title = 'Add Category';

  if (id) {
    title = 'Edit Category';
    try {
      const { data: all } = await API.get('/api/categories');
      cat = all.find(c => c.id === id) || cat;
    } catch (e) { /* use defaults */ }
  }

  showModal(title, `
    <form onsubmit="saveCategory(event, '${id || ''}')">
      <div class="form-group">
        <label>Name</label>
        <input name="name" value="${h(cat.name)}" placeholder="e.g. Food, Transport" required>
      </div>
      <div class="form-group">
        <label>Type</label>
        <select name="type">
          <option value="expense" ${cat.type !== 'income' ? 'selected' : ''}>Expense</option>
          <option value="income" ${cat.type === 'income' ? 'selected' : ''}>Income</option>
        </select>
        <div class="form-hint">Is this category for income or expense transactions?</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Color</label>
          <input name="color" type="color" value="${h(cat.color || '#3b82f6')}">
        </div>
        <div class="form-group">
          <label>Icon (emoji)</label>
          <input name="icon" value="${h(cat.icon || '')}" placeholder="e.g. 🍔">
        </div>
      </div>
      <button class="btn btn-primary btn-block">Save</button>
    </form>
  `);
}

async function saveCategory(e, id) {
  e.preventDefault();
  const f = e.target;
  const body = {
    name: f.name.value,
    type: f.type.value || 'expense',
    icon: f.icon.value || undefined,
    color: f.color.value || undefined,
  };
  try {
    if (id) {
      await API.put(`/api/categories/${id}`, body);
      toast('Category updated');
    } else {
      await API.post('/api/categories', body);
      toast('Category added');
    }
    closeModal();
    renderCategories();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    await API.del(`/api/categories/${id}`);
    toast('Category deleted');
    renderCategories();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}