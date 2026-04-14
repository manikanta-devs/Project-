/* ============================================================
   dashboard.js  –  Dashboard page logic
   ============================================================ */

let currentMonth = PFT.currentMonth();
let selectedType = 'income';
let editingId = null;
let trendChart = null;
let pieChart = null;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const picker = document.getElementById('month-picker');
  picker.value = currentMonth;
  picker.addEventListener('change', e => {
    currentMonth = e.target.value;
    renderDashboard();
  });
  renderDashboard();
});

// ── Render ────────────────────────────────────────────────
function renderDashboard() {
  document.getElementById('month-label').textContent = PFT.monthLabel(currentMonth);
  renderSummary();
  renderCharts();
  renderRecent();
}

function renderSummary() {
  const s = PFT.getSummary(currentMonth);
  const txs = PFT.getTransactions({ month: currentMonth });
  const incomeCount  = txs.filter(t => t.type === 'income').length;
  const expenseCount = txs.filter(t => t.type === 'expense').length;
  const savingsPct = s.income > 0 ? Math.round((s.balance / s.income) * 100) : 0;

  document.getElementById('s-balance').textContent       = PFT.formatCurrency(s.balance);
  document.getElementById('s-txcount').textContent       = s.count + ' transactions';
  document.getElementById('s-income').textContent        = PFT.formatCurrency(s.income);
  document.getElementById('s-income-count').textContent  = incomeCount + ' income entries';
  document.getElementById('s-expense').textContent       = PFT.formatCurrency(s.expense);
  document.getElementById('s-expense-count').textContent = expenseCount + ' expense entries';
  document.getElementById('s-savings').textContent       = savingsPct + '%';
}

function renderCharts() {
  // Trend chart
  const trend = PFT.getMonthlyTrend(6);
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById('chart-trend'), {
    type: 'bar',
    data: {
      labels: trend.map(t => t.label),
      datasets: [
        {
          label: 'Income',
          data: trend.map(t => t.income),
          backgroundColor: 'rgba(16,185,129,.7)',
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Expense',
          data: trend.map(t => t.expense),
          backgroundColor: 'rgba(239,68,68,.7)',
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: '#e2e8f0' },
          ticks: { callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) }
        }
      }
    }
  });

  // Pie chart
  const expMap = PFT.getExpenseByCategory(currentMonth);
  const cats = Object.keys(expMap);
  if (pieChart) pieChart.destroy();
  if (cats.length === 0) {
    const ctx = document.getElementById('chart-pie').getContext('2d');
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = '14px Segoe UI';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('No expense data', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }
  pieChart = new Chart(document.getElementById('chart-pie'), {
    type: 'doughnut',
    data: {
      labels: cats.map(c => (PFT.CATEGORY_ICONS[c] || '') + ' ' + c),
      datasets: [{
        data: cats.map(c => expMap[c]),
        backgroundColor: cats.map(c => PFT.CATEGORY_COLORS[c] || '#94a3b8'),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + PFT.formatCurrency(ctx.parsed)
          }
        }
      }
    }
  });
}

function renderRecent() {
  const txs = PFT.getTransactions({ month: currentMonth }).slice(0, 8);
  const el = document.getElementById('recent-list');

  if (txs.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💸</div>
      <h3>No transactions this month</h3>
      <p>Click "Add Transaction" to get started.</p>
    </div>`;
    return;
  }

  el.innerHTML = '<div class="tx-list">' +
    txs.map(t => txItemHTML(t, false)).join('') +
    '</div>';
}

function txItemHTML(t, showActions = true) {
  const icon = PFT.CATEGORY_ICONS[t.category] || '💳';
  const sign = t.type === 'income' ? '+' : '-';
  const actionsHtml = showActions ? `
    <div class="tx-actions">
      <button class="btn btn-outline btn-sm btn-icon" title="Delete" onclick="deleteTx(${t.id})">🗑️</button>
    </div>` : '';

  return `<div class="tx-item">
    <div class="tx-icon ${t.type}">${icon}</div>
    <div class="tx-info">
      <div class="tx-desc">${t.description || t.category}</div>
      <div class="tx-meta">${t.category} · ${formatDate(t.date)}</div>
    </div>
    <div class="tx-amount ${t.type}">${sign}${PFT.formatCurrency(t.amount)}</div>
    ${actionsHtml}
  </div>`;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Modal ─────────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Transaction';
  document.getElementById('f-amount').value = '';
  document.getElementById('f-date').value   = new Date().toISOString().slice(0, 10);
  document.getElementById('f-desc').value   = '';
  document.getElementById('modal-error').style.display = 'none';
  setType('income');
  document.getElementById('add-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('add-modal').style.display = 'none';
}

function setType(type) {
  selectedType = type;
  document.getElementById('type-income').classList.toggle('active', type === 'income');
  document.getElementById('type-expense').classList.toggle('active', type === 'expense');
  buildCategorySelect();
}

function buildCategorySelect() {
  const cats = selectedType === 'income' ? PFT.INCOME_CATEGORIES : PFT.EXPENSE_CATEGORIES;
  const sel = document.getElementById('f-category');
  sel.innerHTML = cats.map(c =>
    `<option value="${c}">${PFT.CATEGORY_ICONS[c] || ''} ${c}</option>`
  ).join('');
}

function saveTransaction() {
  const amount = parseFloat(document.getElementById('f-amount').value);
  const date   = document.getElementById('f-date').value;
  const cat    = document.getElementById('f-category').value;
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
  PFT.addTransaction({ type: selectedType, amount, date, category: cat, description: desc });
  closeModal();
  renderDashboard();
  showToast('Transaction added!', 'success');
}

function deleteTx(id) {
  if (!confirm('Delete this transaction?')) return;
  PFT.deleteTransaction(id);
  renderDashboard();
  showToast('Transaction deleted.', 'danger');
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

// Close modal on backdrop click
document.getElementById('add-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('add-modal')) closeModal();
});
