/* ============================================================
   budget.js  –  Budget goals page logic
   ============================================================ */

let currentMonth = PFT.currentMonth();
let editingCategory = null;
let pendingDeleteCat = null;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  PFT.seedDemoData();

  const picker = document.getElementById('month-picker');
  picker.value = currentMonth;
  picker.addEventListener('change', e => {
    currentMonth = e.target.value;
    document.getElementById('month-label').textContent = PFT.monthLabel(currentMonth);
    renderBudgets();
  });

  document.getElementById('month-label').textContent = PFT.monthLabel(currentMonth);
  renderBudgets();
});

// ── Render ────────────────────────────────────────────────
function renderBudgets() {
  const statuses = PFT.getBudgetStatus(currentMonth);

  // Overview
  const totalBudget = statuses.reduce((s, b) => s + b.amount, 0);
  const totalSpent  = statuses.reduce((s, b) => s + b.spent, 0);
  const overallPct  = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  document.getElementById('b-total').textContent = PFT.formatCurrency(totalBudget);
  document.getElementById('b-spent').textContent = PFT.formatCurrency(totalSpent);
  document.getElementById('b-pct').textContent   = overallPct + '%';

  const container = document.getElementById('budget-list-container');

  if (statuses.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🎯</div>
      <h3>No budgets set for this month</h3>
      <p>Click "Set Budget" to create your first spending goal.</p>
    </div>`;
    document.getElementById('budget-info').textContent = '';
  } else {
    const over = statuses.filter(b => b.pct >= 100).length;
    document.getElementById('budget-info').textContent =
      statuses.length + ' budget(s)' + (over > 0 ? ` · ⚠️ ${over} over limit` : ' · ✅ All within limits');

    container.innerHTML = '<div class="budget-list">' +
      statuses.map(b => budgetItemHTML(b)).join('') +
      '</div>';
  }

  // Unbudgeted spending
  const expMap = PFT.getExpenseByCategory(currentMonth);
  const budgetedCats = statuses.map(b => b.category);
  const unbudgeted = Object.entries(expMap)
    .filter(([cat]) => !budgetedCats.includes(cat));

  const card = document.getElementById('unbudgeted-card');
  if (unbudgeted.length > 0) {
    card.style.display = 'block';
    document.getElementById('unbudgeted-list').innerHTML =
      '<div class="tx-list">' +
      unbudgeted.map(([cat, amt]) => `
        <div class="tx-item">
          <div class="tx-icon expense">${PFT.CATEGORY_ICONS[cat] || '📦'}</div>
          <div class="tx-info">
            <div class="tx-desc">${cat}</div>
            <div class="tx-meta">No budget set for this category</div>
          </div>
          <div class="tx-amount expense">-${PFT.formatCurrency(amt)}</div>
          <div class="tx-actions">
            <button class="btn btn-outline btn-sm" onclick="quickSetBudget('${cat}')">Set Budget</button>
          </div>
        </div>`).join('') +
      '</div>';
  } else {
    card.style.display = 'none';
  }
}

function budgetItemHTML(b) {
  let barColor, statusText;
  if (b.pct >= 100) {
    barColor = 'var(--danger)';
    statusText = `<span style="color:var(--danger);font-weight:700;">⚠️ Over by ${PFT.formatCurrency(Math.abs(b.remaining))}</span>`;
  } else if (b.pct >= 80) {
    barColor = 'var(--warning)';
    statusText = `<span style="color:var(--warning);font-weight:600;">${PFT.formatCurrency(b.remaining)} left</span>`;
  } else {
    barColor = 'var(--success)';
    statusText = `<span style="color:var(--success);">${PFT.formatCurrency(b.remaining)} left</span>`;
  }

  return `<div class="budget-item">
    <div class="budget-item-header">
      <div class="budget-cat">
        <span class="cat-icon">${PFT.CATEGORY_ICONS[b.category] || '📦'}</span>
        <span>${b.category}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="budget-amounts">
          <strong>${PFT.formatCurrency(b.spent)}</strong> / ${PFT.formatCurrency(b.amount)}
        </div>
        <button class="btn btn-outline btn-sm btn-icon" title="Edit"   onclick="openEditBudget('${b.category}', ${b.amount})">✏️</button>
        <button class="btn btn-outline btn-sm btn-icon" title="Remove" onclick="openDeleteModal('${b.category}')">🗑️</button>
      </div>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="width:${b.pct}%;background:${barColor};"></div>
    </div>
    <div class="budget-pct-row">
      <div class="pct-text">${statusText}</div>
      <div class="pct-val" style="color:${b.pct >= 100 ? 'var(--danger)' : b.pct >= 80 ? 'var(--warning)' : 'var(--success)'};">${b.pct}%</div>
    </div>
  </div>`;
}

// ── Modal ─────────────────────────────────────────────────
function openAddBudgetModal() {
  editingCategory = null;
  document.getElementById('bmodal-title').textContent = 'Set Budget';
  document.getElementById('b-amount').value = '';
  document.getElementById('bmodal-error').style.display = 'none';
  buildCategorySelect();
  document.getElementById('budget-modal').style.display = 'flex';
}

function openEditBudget(category, amount) {
  editingCategory = category;
  document.getElementById('bmodal-title').textContent = 'Edit Budget';
  document.getElementById('b-amount').value = amount;
  document.getElementById('bmodal-error').style.display = 'none';
  buildCategorySelect(category);
  document.getElementById('budget-modal').style.display = 'flex';
}

function quickSetBudget(category) {
  openAddBudgetModal();
  // Select the category after the select is built
  setTimeout(() => {
    document.getElementById('b-category').value = category;
  }, 0);
}

function buildCategorySelect(selected = null) {
  const cats = PFT.EXPENSE_CATEGORIES;
  const sel = document.getElementById('b-category');
  sel.innerHTML = cats.map(c =>
    `<option value="${c}" ${c === selected ? 'selected' : ''}>${PFT.CATEGORY_ICONS[c] || ''} ${c}</option>`
  ).join('');
  if (editingCategory) sel.disabled = true;
  else sel.disabled = false;
}

function closeBudgetModal() {
  document.getElementById('budget-modal').style.display = 'none';
  editingCategory = null;
}

function saveBudget() {
  const category = document.getElementById('b-category').value;
  const amount   = parseFloat(document.getElementById('b-amount').value);
  const errEl    = document.getElementById('bmodal-error');

  if (!amount || amount <= 0) {
    errEl.textContent = '⚠️ Please enter a valid budget amount.';
    errEl.style.display = 'block';
    return;
  }

  PFT.setBudget(category, amount, currentMonth);
  closeBudgetModal();
  renderBudgets();
  showToast(`Budget set for ${category}!`, 'success');
}

// ── Delete ────────────────────────────────────────────────
function openDeleteModal(category) {
  pendingDeleteCat = category;
  document.getElementById('del-cat-name').textContent = category;
  document.getElementById('del-modal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('del-modal').style.display = 'none';
  pendingDeleteCat = null;
}

function confirmDeleteBudget() {
  if (pendingDeleteCat) {
    PFT.deleteBudget(pendingDeleteCat, currentMonth);
    showToast('Budget removed.', 'danger');
    closeDeleteModal();
    renderBudgets();
  }
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Close modals on backdrop click
document.addEventListener('click', e => {
  if (e.target.id === 'budget-modal') closeBudgetModal();
  if (e.target.id === 'del-modal')    closeDeleteModal();
});
