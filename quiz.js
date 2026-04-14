/* ===== STATE ===== */
let currentIndex = 0;
let answers = new Array(questions.length).fill(null);
let visited = new Array(questions.length).fill(false);
let timerInterval = null;
let secondsLeft = 10 * 60; // 10 minutes
let startTime = null;
let studentName = '';
let studentRoll = '';

/* ===== SETUP ===== */
function startExam() {
  const nameInput = document.getElementById('student-name').value.trim();
  const errMsg = document.getElementById('setup-error');

  if (!nameInput) {
    errMsg.style.display = 'block';
    return;
  }

  errMsg.style.display = 'none';
  studentName = nameInput;
  studentRoll = document.getElementById('student-roll').value.trim();

  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('quiz-screen').style.display = 'block';

  startTime = Date.now();
  buildPalette();
  loadQuestion(0);
  startTimer();
}

/* ===== TIMER ===== */
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    secondsLeft--;
    updateTimerDisplay();
    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      submitExam(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = document.getElementById('timer-display');
  display.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

  if (secondsLeft <= 60) {
    display.classList.add('danger');
  } else {
    display.classList.remove('danger');
  }
}

/* ===== QUESTION LOADER ===== */
function loadQuestion(index) {
  currentIndex = index;
  visited[index] = true;

  const q = questions[index];

  document.getElementById('q-current').textContent = index + 1;
  document.getElementById('q-label').textContent = 'Question ' + (index + 1);
  document.getElementById('q-text').textContent = q.question;

  // Progress bar
  const pct = ((index + 1) / questions.length) * 100;
  document.getElementById('progress-bar').style.width = pct + '%';

  // Build options
  const optionsList = document.getElementById('options-list');
  optionsList.innerHTML = '';
  const labels = ['A', 'B', 'C', 'D'];

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    if (answers[index] === i) btn.classList.add('selected');

    btn.innerHTML = `<span class="option-label">${labels[i]}</span> ${opt}`;
    btn.addEventListener('click', () => selectOption(i));
    optionsList.appendChild(btn);
  });

  // Show/hide prev, next, submit
  document.getElementById('btn-prev').style.display = index === 0 ? 'none' : 'inline-flex';

  if (index === questions.length - 1) {
    document.getElementById('btn-next').style.display = 'none';
    document.getElementById('btn-submit').style.display = 'inline-flex';
  } else {
    document.getElementById('btn-next').style.display = 'inline-flex';
    document.getElementById('btn-submit').style.display = 'none';
  }

  updatePalette();
}

/* ===== OPTION SELECTION ===== */
function selectOption(optIndex) {
  answers[currentIndex] = optIndex;

  const optionBtns = document.querySelectorAll('.option-btn');
  optionBtns.forEach((btn, i) => {
    btn.classList.toggle('selected', i === optIndex);
  });

  updatePalette();
}

/* ===== NAVIGATION ===== */
function nextQuestion() {
  if (currentIndex < questions.length - 1) {
    loadQuestion(currentIndex + 1);
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    loadQuestion(currentIndex - 1);
  }
}

/* ===== PALETTE ===== */
function buildPalette() {
  const palette = document.getElementById('q-palette');
  palette.innerHTML = '';
  questions.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.id = 'pal-' + i;
    btn.textContent = i + 1;
    btn.style.cssText = `
      width:36px;height:36px;border-radius:8px;border:2px solid var(--border);
      background:#f8fafc;cursor:pointer;font-size:0.82rem;font-weight:600;
      color:var(--text-light);transition:all 0.2s;
    `;
    btn.addEventListener('click', () => loadQuestion(i));
    palette.appendChild(btn);
  });
}

function updatePalette() {
  questions.forEach((_, i) => {
    const btn = document.getElementById('pal-' + i);
    if (!btn) return;

    if (i === currentIndex) {
      btn.style.background = 'var(--primary)';
      btn.style.color = '#fff';
      btn.style.borderColor = 'var(--primary)';
    } else if (answers[i] !== null) {
      btn.style.background = '#dbeafe';
      btn.style.color = '#1d4ed8';
      btn.style.borderColor = '#93c5fd';
    } else if (visited[i]) {
      btn.style.background = '#fef9c3';
      btn.style.color = '#854d0e';
      btn.style.borderColor = '#fcd34d';
    } else {
      btn.style.background = '#f8fafc';
      btn.style.color = 'var(--text-light)';
      btn.style.borderColor = 'var(--border)';
    }
  });
}

/* ===== SUBMIT ===== */
function confirmSubmit() {
  const unanswered = answers.filter(a => a === null).length;
  let msg = 'Submit the exam now?';
  if (unanswered > 0) {
    msg = `You have ${unanswered} unanswered question(s). Submit anyway?`;
  }
  if (window.confirm(msg)) {
    submitExam(false);
  }
}

function submitExam(timeUp) {
  clearInterval(timerInterval);

  if (timeUp) {
    alert('⏰ Time is up! Your exam has been submitted automatically.');
  }

  const timeTaken = Math.round((Date.now() - startTime) / 1000);

  sessionStorage.setItem('quizResult', JSON.stringify({
    name: studentName,
    roll: studentRoll,
    answers: answers,
    timeTaken: timeTaken
  }));

  window.location.href = 'result.html';
}
