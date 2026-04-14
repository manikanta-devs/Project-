/* ============================================================
   app.js  –  Core data layer for Personal Finance Tracker
   All data lives in localStorage under key "pft_data"
   ============================================================ */

const PFT = (() => {
  // ── Storage ──────────────────────────────────────────────
  const STORAGE_KEY = 'pft_data';

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || _defaultData();
    } catch {
      return _defaultData();
    }
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function _defaultData() {
    return {
      transactions: [],
      budgets: [],
      nextId: 1
    };
  }

  // ── Categories ───────────────────────────────────────────
  const INCOME_CATEGORIES = [
    'Salary', 'Freelance', 'Investment', 'Gift', 'Other Income'
  ];

  const EXPENSE_CATEGORIES = [
    'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
    'Health & Medical', 'Education', 'Utilities', 'Rent / Housing',
    'Travel', 'Personal Care', 'Other Expense'
  ];

  const CATEGORY_ICONS = {
    'Salary': '💼', 'Freelance': '💻', 'Investment': '📈',
    'Gift': '🎁', 'Other Income': '💰',
    'Food & Dining': '🍔', 'Transport': '🚗', 'Shopping': '🛍️',
    'Entertainment': '🎬', 'Health & Medical': '💊', 'Education': '📚',
    'Utilities': '💡', 'Rent / Housing': '🏠', 'Travel': '✈️',
    'Personal Care': '🧴', 'Other Expense': '📦'
  };

  const CATEGORY_COLORS = {
    'Salary': '#6366f1', 'Freelance': '#8b5cf6', 'Investment': '#06b6d4',
    'Gift': '#f43f5e', 'Other Income': '#10b981',
    'Food & Dining': '#f59e0b', 'Transport': '#3b82f6', 'Shopping': '#ec4899',
    'Entertainment': '#a855f7', 'Health & Medical': '#ef4444', 'Education': '#14b8a6',
    'Utilities': '#f97316', 'Rent / Housing': '#84cc16', 'Travel': '#0ea5e9',
    'Personal Care': '#fb7185', 'Other Expense': '#94a3b8'
  };

  // ── Transactions CRUD ────────────────────────────────────
  function addTransaction(tx) {
    const data = _load();
    const record = {
      id: data.nextId++,
      type: tx.type,            // 'income' | 'expense'
      amount: parseFloat(tx.amount),
      category: tx.category,
      description: tx.description || '',
      date: tx.date,            // 'YYYY-MM-DD'
      createdAt: Date.now()
    };
    data.transactions.unshift(record);
    _save(data);
    return record;
  }

  function deleteTransaction(id) {
    const data = _load();
    data.transactions = data.transactions.filter(t => t.id !== id);
    _save(data);
  }

  function updateTransaction(id, updates) {
    const data = _load();
    const idx = data.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      data.transactions[idx] = { ...data.transactions[idx], ...updates };
      _save(data);
      return data.transactions[idx];
    }
    return null;
  }

  function getTransactions(filters = {}) {
    const data = _load();
    let list = [...data.transactions];

    if (filters.type) list = list.filter(t => t.type === filters.type);
    if (filters.category) list = list.filter(t => t.category === filters.category);
    if (filters.month) list = list.filter(t => t.date.startsWith(filters.month));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    if (filters.sortBy === 'amount_asc')  list.sort((a, b) => a.amount - b.amount);
    if (filters.sortBy === 'amount_desc') list.sort((a, b) => b.amount - a.amount);
    if (filters.sortBy === 'date_asc')    list.sort((a, b) => a.date.localeCompare(b.date));
    if (filters.sortBy === 'date_desc')   list.sort((a, b) => b.date.localeCompare(a.date));

    return list;
  }

  // ── Summary helpers ───────────────────────────────────────
  function getSummary(month) {
    const txs = getTransactions(month ? { month } : {});
    const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense, count: txs.length };
  }

  function getExpenseByCategory(month) {
    const txs = getTransactions(month ? { month, type: 'expense' } : { type: 'expense' });
    const map = {};
    txs.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }

  function getMonthlyTrend(months = 6) {
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.toISOString().slice(0, 7);
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const s = getSummary(month);
      result.push({ month, label, income: s.income, expense: s.expense });
    }
    return result;
  }

  // ── Budgets CRUD ──────────────────────────────────────────
  function setBudget(category, amount, month) {
    const data = _load();
    const existing = data.budgets.find(b => b.category === category && b.month === month);
    if (existing) {
      existing.amount = parseFloat(amount);
    } else {
      data.budgets.push({ category, amount: parseFloat(amount), month });
    }
    _save(data);
  }

  function deleteBudget(category, month) {
    const data = _load();
    data.budgets = data.budgets.filter(b => !(b.category === category && b.month === month));
    _save(data);
  }

  function getBudgets(month) {
    const data = _load();
    return data.budgets.filter(b => b.month === month);
  }

  function getBudgetStatus(month) {
    const budgets = getBudgets(month);
    const expenseMap = getExpenseByCategory(month);
    return budgets.map(b => ({
      ...b,
      spent: expenseMap[b.category] || 0,
      remaining: b.amount - (expenseMap[b.category] || 0),
      pct: Math.min(100, Math.round(((expenseMap[b.category] || 0) / b.amount) * 100))
    }));
  }

  // ── Utilities ─────────────────────────────────────────────
  function formatCurrency(amount) {
    return '₹' + Math.abs(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  function currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  function monthLabel(ym) {
    const [y, m] = ym.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  // Public API
  return {
    INCOME_CATEGORIES, EXPENSE_CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS,
    addTransaction, deleteTransaction, updateTransaction, getTransactions,
    getSummary, getExpenseByCategory, getMonthlyTrend,
    setBudget, deleteBudget, getBudgets, getBudgetStatus,
    formatCurrency, currentMonth, monthLabel
  };
})();
