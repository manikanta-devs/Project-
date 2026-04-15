/* ============================================================
   transactions.js  –  Transactions page logic
   ============================================================ */

let currentMonth = PFT.currentMonth();
let selectedType = 'income';
let editingId    = null;
let pendingDeleteId = null;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const picker = document.getElementById('month-picker');
  picker.value = currentMonth;
  picker.addEventListener('change', e => {
    currentMonth = e.target.value;
    renderPage();
  });

  // Category filter
  buildCategoryFilter();

  // Live filters
  ['f-search','f-type','f-category','f-sort'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderTransactions);
    document.getElementById(id).addEventListener('change', renderTransactions);
  });

  renderPage();
});

function renderPage() {
  renderSummary();
  renderTransactions();
}

// ── Summary ───────────────────────────────────────────────
function renderSummary() {
  const s = PFT.getSummary(currentMonth);
  document.getElementById('s-income').textContent  = PFT.formatCurrency(s.income);
  document.getElementById('s-expense').textContent = PFT.formatCurrency(s.expense);
  document.getElementById('s-balance').textContent = PFT.formatCurrency(s.balance);
}

// ── Transactions ──────────────────────────────────────────
function renderTransactions() {
  const search   = document.getElementById('f-search').value.trim();
  const type     = document.getElementById('f-type').value;
  const category = document.getElementById('f-category').value;
  const sortBy   = document.getElementById('f-sort').value;

  const txs = PFT.getTransactions({
    month: currentMonth,
    search: search || undefined,
    type: type || undefined,
    category: category || undefined,
    sortBy
  });

  document.getElementById('filter-count').textContent =
    txs.length === 0 ? '' : `Showing ${txs.length} transaction${txs.length !== 1 ? 's' : ''}`;

  const container = document.getElementById('tx-list-container');
  if (txs.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>No transactions found</h3>
      <p>Try adjusting the filters or add a new transaction.</p>
    </div>`;
    return;
  }

  container.innerHTML = '<div class="tx-list">' +
    txs.map(t => txItemHTML(t)).join('') +
    '</div>';
}

function txItemHTML(t) {
  const icon = PFT.CATEGORY_ICONS[t.category] || '💳';
  const sign = t.type === 'income' ? '+' : '-';
  return `<div class="tx-item">
    <div class="tx-icon ${t.type}">${icon}</div>
    <div class="tx-info">
      <div class="tx-desc">${t.description || t.category}</div>
      <div class="tx-meta">
        <span class="badge badge-${t.type}">${t.type}</span>
        &nbsp;${t.category} · ${formatDate(t.date)}
      </div>
    </div>
    <div class="tx-amount ${t.type}">${sign}${PFT.formatCurrency(t.amount)}</div>
    <div class="tx-actions">
      <button class="btn btn-outline btn-sm btn-icon" title="Edit"   onclick="openEditModal(${t.id})">✏️</button>
      <button class="btn btn-outline btn-sm btn-icon" title="Delete" onclick="openDeleteModal(${t.id})">🗑️</button>
    </div>
  </div>`;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildCategoryFilter() {
  const all = [...PFT.INCOME_CATEGORIES, ...PFT.EXPENSE_CATEGORIES];
  const sel = document.getElementById('f-category');
  all.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = (PFT.CATEGORY_ICONS[c] || '') + ' ' + c;
    sel.appendChild(opt);
  });
}

function clearFilters() {
  document.getElementById('f-search').value   = '';
  document.getElementById('f-type').value     = '';
  document.getElementById('f-category').value = '';
  document.getElementById('f-sort').value     = 'date_desc';
  renderTransactions();
}

// ── Add modal ─────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Transaction';
  document.getElementById('save-btn').textContent    = 'Save';
  document.getElementById('f-amount').value = '';
  document.getElementById('f-date').value   = new Date().toISOString().slice(0, 10);
  document.getElementById('f-desc').value   = '';
  document.getElementById('modal-error').style.display = 'none';
  setType('income');
  document.getElementById('add-modal').style.display = 'flex';
}

// ── Edit modal ────────────────────────────────────────────
function openEditModal(id) {
  const txs = PFT.getTransactions();
  const tx  = txs.find(t => t.id === id);
  if (!tx) return;

  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Transaction';
  document.getElementById('save-btn').textContent    = 'Update';
  document.getElementById('modal-error').style.display = 'none';

  setType(tx.type);

  document.getElementById('f-amount').value = tx.amount;
  document.getElementById('f-date').value   = tx.date;
  document.getElementById('f-desc').value   = tx.description || '';

  // Set category after building select
  setTimeout(() => {
    document.getElementById('f-category-modal').value = tx.category;
  }, 0);

  document.getElementById('add-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('add-modal').style.display = 'none';
  editingId = null;
}

function setType(type) {
  selectedType = type;
  document.getElementById('type-income').classList.toggle('active', type === 'income');
  document.getElementById('type-expense').classList.toggle('active', type === 'expense');
  buildModalCategorySelect();
}

function buildModalCategorySelect() {
  const cats = selectedType === 'income' ? PFT.INCOME_CATEGORIES : PFT.EXPENSE_CATEGORIES;
  const sel  = document.getElementById('f-category-modal');
  sel.innerHTML = cats.map(c =>
    `<option value="${c}">${PFT.CATEGORY_ICONS[c] || ''} ${c}</option>`
  ).join('');
}

function saveTransaction() {
  const amount = parseFloat(document.getElementById('f-amount').value);
  const date   = document.getElementById('f-date').value;
  const cat    = document.getElementById('f-category-modal').value;
  const desc   = document.getElementById('f-desc').value.trim();
  const errEl  = document.getElementById('modal-error');

  if (!amount || amount <= 0) {
    errEl.textContent = '⚠️ Please enter a valid amount.';
    errEl.style.display = 'block';
    return;
  }
  if (!date) {
    errEl.textContent = '⚠️ Please select a date.';
    errEl.style.display = 'block';
    return;
  }

  errEl.style.display = 'none';

  if (editingId) {
    PFT.updateTransaction(editingId, { type: selectedType, amount, date, category: cat, description: desc });
    showToast('Transaction updated!', 'info');
  } else {
    PFT.addTransaction({ type: selectedType, amount, date, category: cat, description: desc });
    showToast('Transaction added!', 'success');
  }

  closeModal();
  renderPage();
}

// ── Delete modal ──────────────────────────────────────────
function openDeleteModal(id) {
  pendingDeleteId = id;
  document.getElementById('del-modal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('del-modal').style.display = 'none';
  pendingDeleteId = null;
}

function confirmDelete() {
  if (pendingDeleteId !== null) {
    PFT.deleteTransaction(pendingDeleteId);
    showToast('Transaction deleted.', 'danger');
    closeDeleteModal();
    renderPage();
  }
}

// ── CSV Export ────────────────────────────────────────────
function exportCSV() {
  const search   = document.getElementById('f-search').value.trim();
  const type     = document.getElementById('f-type').value;
  const category = document.getElementById('f-category').value;
  const sortBy   = document.getElementById('f-sort').value;

  const txs = PFT.getTransactions({
    month: currentMonth,
    search: search || undefined,
    type: type || undefined,
    category: category || undefined,
    sortBy
  });

  if (!txs.length) { showToast('No transactions to export.', 'warning'); return; }

  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
  const rows = txs.map(t => [
    t.date,
    '"' + (t.description || '').replace(/"/g, '""') + '"',
    '"' + (t.category || '').replace(/"/g, '""') + '"',
    t.type,
    t.type === 'income' ? t.amount : -t.amount
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fintrack-${currentMonth}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showToast(`Exported ${txs.length} transactions as CSV.`, 'success');
}
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.id === 'add-modal') closeModal();
  if (e.target.id === 'del-modal') closeDeleteModal();
});
