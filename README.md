# 🚀 Academic Projects Portfolio

Two complete, product-level projects — built with pure HTML, CSS and JavaScript (no backend, no frameworks).

---

## Project 1 — 💰 FinTrack: Personal Finance Tracker

> **Folder:** `finance/`  |  Open `finance/index.html` to launch

A full-featured personal finance management app with dashboard, transaction management, and budget tracking.

### Features
| Feature | Details |
|---|---|
| 📊 Dashboard | Summary cards, 6-month trend bar chart, expense doughnut chart |
| 💳 Transactions | Full CRUD — add, edit, delete; search & filter by type/category/date/amount |
| 🎯 Budgets | Set monthly category budgets, colour-coded progress bars, over-limit alerts |
| 📌 Smart Defaults | Demo data seeded on first launch so the app looks populated immediately |
| 💾 Persistence | All data stored in browser `localStorage` — survives page refresh |
| 📱 Responsive | Sidebar layout collapses on mobile |

### Tech Stack
- HTML5 · CSS3 (custom properties, Flexbox, Grid)
- Vanilla JavaScript ES6 (module pattern)
- [Chart.js 4](https://www.chartjs.org/) — bar & doughnut charts via CDN

### File Structure
```
finance/
├── index.html        ← Dashboard
├── transactions.html ← Transaction list
├── budget.html       ← Budget goals
├── style.css         ← Design system
├── app.js            ← Data layer (localStorage CRUD)
├── dashboard.js      ← Dashboard logic + Chart.js
├── transactions.js   ← Transactions page logic
└── budget.js         ← Budget page logic
```

---

## Project 2 — 🎓 QuizMaster – Online MCQ Exam System

An academic project built with pure **HTML, CSS and JavaScript** (no backend, no frameworks).  
Students can take a timed 20-question Computer Science exam and instantly see their score, grade and answer review.

---

## 🚀 Live Demo

Open `index.html` in any browser — or deploy for free on **GitHub Pages**.

---

## 📁 File Structure

```
Project-/
├── index.html      ← Home / landing page
├── quiz.html       ← Exam page (setup + questions)
├── result.html     ← Score & answer review page
├── style.css       ← All styling (responsive, mobile-friendly)
├── questions.js    ← 20 MCQ questions (Computer Science)
└── quiz.js         ← Quiz logic (timer, scoring, navigation)
```

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎯 20 MCQ Questions | Computer Science fundamentals |
| ⏱️ Countdown Timer | 10-minute limit, auto-submits on expiry |
| 📊 Instant Results | Score, grade (A/B/C/D), percentage |
| 📖 Answer Review | See correct vs wrong vs skipped |
| 🗺️ Question Navigator | Palette showing answered/visited/unanswered |
| 📱 Responsive | Works on mobile, tablet, and desktop |
| 🔒 No Backend | Uses `sessionStorage` — runs 100% offline |

---

## 🏅 Grading

| Grade | Marks | Percentage |
|---|---|---|
| A | 18–20 | ≥ 90% – Excellent |
| B | 14–17 | ≥ 70% – Good |
| C | 10–13 | ≥ 50% – Average |
| D | 0–9 | < 50% – Needs Improvement |

---

## 🛠️ How to Run

1. Clone or download this repository
2. Open `index.html` in your browser
3. Enter your name → click **Start Exam**
4. Answer all questions and click **Submit Exam**
5. View your result and answer review

---

## 📚 Academic Relevance

- **Web Development** – HTML5, CSS3, JavaScript ES6
- **Software Engineering** – Modular code structure (separation of concerns)
- **DBMS / Storage** – Browser `sessionStorage` for temporary data
- **UI/UX** – Responsive design, accessibility, user feedback

---

## 👨‍💻 Tech Stack

- HTML5
- CSS3 (CSS Variables, Flexbox, Grid)
- Vanilla JavaScript (ES6+)
- No libraries or frameworks required