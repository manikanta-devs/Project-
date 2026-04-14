(function () {
  'use strict';

  /* ===== Constants ===== */
  var STORAGE_KEY = 'taskflow_data';

  /* ===== State ===== */
  var tasks = loadTasks();
  var editingTaskId = null;
  var deletingTaskId = null;

  /* ===== DOM References ===== */
  var addTaskBtn = document.getElementById('add-task-btn');
  var taskModal = document.getElementById('task-modal');
  var taskForm = document.getElementById('task-form');
  var modalTitle = document.getElementById('modal-title');
  var modalSaveBtn = document.getElementById('modal-save-btn');
  var modalCloseBtn = document.getElementById('modal-close-btn');
  var modalCancelBtn = document.getElementById('modal-cancel-btn');
  var titleInput = document.getElementById('task-title');
  var descInput = document.getElementById('task-desc');
  var priorityInput = document.getElementById('task-priority');
  var dueInput = document.getElementById('task-due');
  var taskIdInput = document.getElementById('task-id');
  var titleError = document.getElementById('title-error');
  var deleteModal = document.getElementById('delete-modal');
  var deleteTaskName = document.getElementById('delete-task-name');
  var deleteConfirmBtn = document.getElementById('delete-confirm-btn');
  var deleteCancelBtn = document.getElementById('delete-cancel-btn');
  var deleteCloseBtn = document.getElementById('delete-close-btn');
  var toastContainer = document.getElementById('toast-container');

  var columns = {
    todo: document.getElementById('list-todo'),
    inprogress: document.getElementById('list-inprogress'),
    done: document.getElementById('list-done')
  };

  /* ===== Persistence ===== */
  function loadTasks() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      // storage full or unavailable
    }
  }

  /* ===== Unique ID ===== */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  /* ===== Toast Notifications ===== */
  function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // trigger reflow to enable transition
    toast.offsetHeight; // eslint-disable-line no-unused-expressions
    toast.classList.add('show');

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2500);
  }

  /* ===== Date Helpers ===== */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    var parts = dateStr.split('-');
    var due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }

  /* ===== Render ===== */
  function render() {
    // Clear columns
    Object.keys(columns).forEach(function (status) {
      columns[status].innerHTML = '';
    });

    // Count per column
    var counts = { todo: 0, inprogress: 0, done: 0 };

    tasks.forEach(function (task) {
      counts[task.status] = (counts[task.status] || 0) + 1;
      var card = createCardElement(task);
      columns[task.status].appendChild(card);
    });

    // Update counts and empty states
    Object.keys(counts).forEach(function (status) {
      document.getElementById('count-' + status).textContent = counts[status];
      var emptyEl = document.getElementById('empty-' + status);
      if (counts[status] === 0) {
        emptyEl.classList.add('visible');
      } else {
        emptyEl.classList.remove('visible');
      }
    });
  }

  function createCardElement(task) {
    var card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('draggable', 'true');
    card.dataset.id = task.id;

    // Header row
    var header = document.createElement('div');
    header.className = 'task-card-header';

    var title = document.createElement('span');
    title.className = 'task-card-title';
    title.textContent = task.title;

    var actions = document.createElement('div');
    actions.className = 'task-card-actions';

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.title = 'Edit task';
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openEditModal(task.id);
    });

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.title = 'Delete task';
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openDeleteModal(task.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(title);
    header.appendChild(actions);
    card.appendChild(header);

    // Description
    if (task.description) {
      var desc = document.createElement('p');
      desc.className = 'task-card-desc';
      desc.textContent = task.description;
      card.appendChild(desc);
    }

    // Meta row
    var meta = document.createElement('div');
    meta.className = 'task-card-meta';

    var badge = document.createElement('span');
    badge.className = 'priority-badge ' + task.priority;
    badge.textContent = task.priority;
    meta.appendChild(badge);

    if (task.dueDate) {
      var due = document.createElement('span');
      due.className = 'task-due';
      if (isOverdue(task.dueDate) && task.status !== 'done') {
        due.classList.add('overdue');
        due.textContent = '⚠ ' + formatDate(task.dueDate);
      } else {
        due.textContent = '📅 ' + formatDate(task.dueDate);
      }
      meta.appendChild(due);
    }

    card.appendChild(meta);

    // Drag events
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    return card;
  }

  /* ===== Drag & Drop ===== */
  var draggedId = null;

  function handleDragStart(e) {
    draggedId = this.dataset.id;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    draggedId = null;
    document.querySelectorAll('.column').forEach(function (col) {
      col.classList.remove('drag-over');
    });
  }

  function setupDropZones() {
    document.querySelectorAll('.column').forEach(function (col) {
      col.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', function (e) {
        // Only remove if we truly left the column
        if (!col.contains(e.relatedTarget)) {
          col.classList.remove('drag-over');
        }
      });

      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('drag-over');
        var id = e.dataTransfer.getData('text/plain');
        var newStatus = col.dataset.status;
        if (!id || !newStatus) return;

        var task = tasks.find(function (t) { return t.id === id; });
        if (task && task.status !== newStatus) {
          var oldStatus = task.status;
          task.status = newStatus;
          saveTasks();
          render();

          var statusLabels = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
          showToast('Moved to ' + statusLabels[newStatus]);
        }
      });
    });
  }

  /* ===== Task Modal (Add/Edit) ===== */
  function openAddModal() {
    editingTaskId = null;
    modalTitle.textContent = 'New Task';
    modalSaveBtn.textContent = 'Add Task';
    taskForm.reset();
    priorityInput.value = 'medium';
    taskIdInput.value = '';
    clearValidation();
    openModal(taskModal);
    titleInput.focus();
  }

  function openEditModal(id) {
    var task = tasks.find(function (t) { return t.id === id; });
    if (!task) return;

    editingTaskId = id;
    modalTitle.textContent = 'Edit Task';
    modalSaveBtn.textContent = 'Save Changes';
    titleInput.value = task.title;
    descInput.value = task.description || '';
    priorityInput.value = task.priority;
    dueInput.value = task.dueDate || '';
    taskIdInput.value = task.id;
    clearValidation();
    openModal(taskModal);
    titleInput.focus();
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    var titleVal = titleInput.value.trim();

    if (!titleVal) {
      titleInput.classList.add('invalid');
      titleError.classList.add('visible');
      titleInput.focus();
      return;
    }

    if (editingTaskId) {
      // Update existing
      var task = tasks.find(function (t) { return t.id === editingTaskId; });
      if (task) {
        task.title = titleVal;
        task.description = descInput.value.trim();
        task.priority = priorityInput.value;
        task.dueDate = dueInput.value || '';
        saveTasks();
        render();
        showToast('Task updated');
      }
    } else {
      // Create new
      var newTask = {
        id: generateId(),
        title: titleVal,
        description: descInput.value.trim(),
        priority: priorityInput.value,
        dueDate: dueInput.value || '',
        status: 'todo',
        createdAt: new Date().toISOString()
      };
      tasks.push(newTask);
      saveTasks();
      render();
      showToast('Task added');
    }

    closeModal(taskModal);
  }

  function clearValidation() {
    titleInput.classList.remove('invalid');
    titleError.classList.remove('visible');
  }

  /* ===== Delete Modal ===== */
  function openDeleteModal(id) {
    var task = tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    deletingTaskId = id;
    deleteTaskName.textContent = task.title;
    openModal(deleteModal);
  }

  function confirmDelete() {
    if (!deletingTaskId) return;
    tasks = tasks.filter(function (t) { return t.id !== deletingTaskId; });
    saveTasks();
    render();
    closeModal(deleteModal);
    showToast('Task deleted');
    deletingTaskId = null;
  }

  /* ===== Modal Helpers ===== */
  function openModal(overlay) {
    overlay.classList.add('active');
  }

  function closeModal(overlay) {
    overlay.classList.remove('active');
  }

  /* ===== Event Listeners ===== */
  addTaskBtn.addEventListener('click', openAddModal);
  taskForm.addEventListener('submit', handleFormSubmit);

  titleInput.addEventListener('input', function () {
    if (titleInput.value.trim()) clearValidation();
  });

  // Close modals
  modalCloseBtn.addEventListener('click', function () { closeModal(taskModal); });
  modalCancelBtn.addEventListener('click', function () { closeModal(taskModal); });
  deleteCloseBtn.addEventListener('click', function () { closeModal(deleteModal); });
  deleteCancelBtn.addEventListener('click', function () { closeModal(deleteModal); });
  deleteConfirmBtn.addEventListener('click', confirmDelete);

  // Close modals on overlay click
  taskModal.addEventListener('click', function (e) {
    if (e.target === taskModal) closeModal(taskModal);
  });
  deleteModal.addEventListener('click', function (e) {
    if (e.target === deleteModal) closeModal(deleteModal);
  });

  // Escape key closes modals
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (taskModal.classList.contains('active')) closeModal(taskModal);
      if (deleteModal.classList.contains('active')) closeModal(deleteModal);
    }
  });

  /* ===== Init ===== */
  setupDropZones();
  render();
})();
