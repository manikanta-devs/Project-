/* MarkEdit – Live Markdown Notepad
   Pure vanilla JS application */

(function () {
    'use strict';

    // ===== Constants =====
    var STORAGE_KEY = 'markedit_data';
    var DEBOUNCE_MS = 150;

    // ===== DOM References =====
    var editor = document.getElementById('editor');
    var preview = document.getElementById('preview');
    var noteTitle = document.getElementById('note-title');
    var notesList = document.getElementById('notes-list');
    var wordCountEl = document.getElementById('word-count');
    var charCountEl = document.getElementById('char-count');
    var toastContainer = document.getElementById('toast-container');
    var sidebar = document.getElementById('sidebar');

    // Buttons
    var btnNewNote = document.getElementById('btn-new-note');
    var btnExport = document.getElementById('btn-export');
    var btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    var btnViewEditor = document.getElementById('btn-view-editor');
    var btnViewPreview = document.getElementById('btn-view-preview');

    // ===== State =====
    var state = {
        notes: [],
        activeNoteId: null
    };

    // ===== Storage =====
    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.notes)) {
                    state.notes = parsed.notes;
                    state.activeNoteId = parsed.activeNoteId || null;
                }
            }
        } catch (e) {
            console.warn('Failed to load state from localStorage:', e);
        }

        // Ensure at least one note exists
        if (state.notes.length === 0) {
            createNote(true);
        }

        // Ensure activeNoteId is valid
        if (!state.activeNoteId || !getNoteById(state.activeNoteId)) {
            state.activeNoteId = state.notes[0].id;
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                notes: state.notes,
                activeNoteId: state.activeNoteId
            }));
        } catch (e) {
            console.warn('Failed to save state to localStorage:', e);
        }
    }

    // ===== Note CRUD =====
    function generateId() {
        return 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }

    function getNoteById(id) {
        for (var i = 0; i < state.notes.length; i++) {
            if (state.notes[i].id === id) return state.notes[i];
        }
        return null;
    }

    function createNote(silent) {
        var note = {
            id: generateId(),
            title: 'Untitled Note',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        state.notes.unshift(note);
        state.activeNoteId = note.id;
        saveState();

        if (!silent) {
            showToast('New note created', 'success');
        }

        return note;
    }

    function deleteNote(id) {
        if (state.notes.length <= 1) {
            showToast('Cannot delete the last note', 'error');
            return;
        }

        state.notes = state.notes.filter(function (n) { return n.id !== id; });

        if (state.activeNoteId === id) {
            state.activeNoteId = state.notes[0].id;
        }

        saveState();
        showToast('Note deleted', 'success');
        render();
    }

    function switchNote(id) {
        state.activeNoteId = id;
        saveState();
        render();
    }

    // ===== Markdown Parser (XSS-safe) =====
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeUrl(url) {
        // Decode HTML entities for protocol validation only
        var decoded = url;
        decoded = decoded.replace(/&amp;/g, '&');
        decoded = decoded.replace(/&lt;/g, '<');
        decoded = decoded.replace(/&gt;/g, '>');
        decoded = decoded.replace(/&quot;/g, '"');
        decoded = decoded.replace(/&#39;/g, "'");

        var trimmed = decoded.trim().toLowerCase();

        // Block dangerous protocols
        if (/^(javascript|vbscript|data|file):/i.test(trimmed)) {
            return '';
        }

        // Block event handlers that might be injected
        if (/on\w+\s*=/i.test(decoded)) {
            return '';
        }

        // Return the HTML-safe version for use in attributes
        return url;
    }

    function parseMarkdown(text) {
        // Step 1: Escape all HTML in the raw input
        var html = escapeHtml(text);

        // Step 2: Extract code blocks first to protect them from further processing
        var codeBlocks = [];
        html = html.replace(/```([\s\S]*?)```/g, function (match, code) {
            var index = codeBlocks.length;
            codeBlocks.push('<pre><code>' + code.replace(/^\n/, '').replace(/\n$/, '') + '</code></pre>');
            return '___CODEBLOCK_' + index + '___';
        });

        // Inline code
        var inlineCodes = [];
        html = html.replace(/`([^`\n]+)`/g, function (match, code) {
            var index = inlineCodes.length;
            inlineCodes.push('<code>' + code + '</code>');
            return '___INLINECODE_' + index + '___';
        });

        // Step 3: Apply markdown transformations

        // Headings (must be at start of line)
        html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

        // Horizontal rules (must be on their own line)
        html = html.replace(/^---+$/gm, '<hr>');
        html = html.replace(/^\*\*\*+$/gm, '<hr>');
        html = html.replace(/^___+$/gm, '<hr>');

        // Bold and italic combined
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Images ![alt](url) - sanitize URLs
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (match, alt, url) {
            var safeUrl = sanitizeUrl(url);
            if (!safeUrl) return alt;
            return '<img src="' + safeUrl + '" alt="' + alt + '">';
        });

        // Links [text](url) - sanitize URLs
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (match, text, url) {
            var safeUrl = sanitizeUrl(url);
            if (!safeUrl) return text;
            return '<a href="' + safeUrl + '" rel="noopener noreferrer">' + text + '</a>';
        });

        // Blockquotes (handle multi-line)
        html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');
        // Merge consecutive blockquotes
        html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

        // Unordered lists
        html = html.replace(/^[-*+]\s+(.+)$/gm, '<uli>$1</uli>');

        // Ordered lists
        html = html.replace(/^\d+\.\s+(.+)$/gm, '<oli>$1</oli>');

        // Wrap consecutive <uli> items in <ul>
        html = html.replace(/((?:<uli>.*<\/uli>\n?)+)/g, function (match) {
            return '<ul>' + match.replace(/<\/?uli>/g, function (tag) {
                return tag === '<uli>' ? '<li>' : '</li>';
            }).trim() + '</ul>';
        });

        // Wrap consecutive <oli> items in <ol>
        html = html.replace(/((?:<oli>.*<\/oli>\n?)+)/g, function (match) {
            return '<ol>' + match.replace(/<\/?oli>/g, function (tag) {
                return tag === '<oli>' ? '<li>' : '</li>';
            }).trim() + '</ol>';
        });

        // Paragraphs: wrap lines that aren't already wrapped in block tags
        var lines = html.split('\n');
        var result = [];
        var blockTags = /^<(h[1-6]|pre|ul|ol|li|blockquote|hr|div|table)/;
        var closingBlockTags = /^<\/(ul|ol|blockquote)/;
        var placeholder = /^___(?:CODEBLOCK|INLINECODE)_/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line === '') {
                result.push('');
            } else if (blockTags.test(line) || closingBlockTags.test(line) || placeholder.test(line)) {
                result.push(line);
            } else {
                result.push('<p>' + line + '</p>');
            }
        }
        html = result.join('\n');

        // Remove empty paragraphs
        html = html.replace(/<p><\/p>/g, '');

        // Restore inline codes
        for (var ic = 0; ic < inlineCodes.length; ic++) {
            html = html.replace('___INLINECODE_' + ic + '___', inlineCodes[ic]);
        }

        // Restore code blocks
        for (var cb = 0; cb < codeBlocks.length; cb++) {
            html = html.replace('<p>___CODEBLOCK_' + cb + '___</p>', codeBlocks[cb]);
            html = html.replace('___CODEBLOCK_' + cb + '___', codeBlocks[cb]);
        }

        return html;
    }

    // ===== Toolbar Actions =====
    var toolbarActions = {
        bold: { before: '**', after: '**', placeholder: 'bold text' },
        italic: { before: '*', after: '*', placeholder: 'italic text' },
        h1: { before: '# ', after: '', placeholder: 'Heading 1', lineStart: true },
        h2: { before: '## ', after: '', placeholder: 'Heading 2', lineStart: true },
        h3: { before: '### ', after: '', placeholder: 'Heading 3', lineStart: true },
        link: { before: '[', after: '](https://)', placeholder: 'link text' },
        image: { before: '![', after: '](https://image-url)', placeholder: 'alt text' },
        code: { before: '`', after: '`', placeholder: 'code' },
        codeblock: { before: '```\n', after: '\n```', placeholder: 'code block', newLine: true },
        ul: { before: '- ', after: '', placeholder: 'list item', lineStart: true },
        ol: { before: '1. ', after: '', placeholder: 'list item', lineStart: true },
        quote: { before: '> ', after: '', placeholder: 'quote', lineStart: true },
        hr: { before: '\n---\n', after: '', placeholder: '' }
    };

    function insertToolbarAction(action) {
        var config = toolbarActions[action];
        if (!config) return;

        editor.focus();
        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        var text = editor.value;
        var selectedText = text.substring(start, end) || config.placeholder;

        var insertion;
        if (config.lineStart) {
            // Find start of current line
            var lineStart = text.lastIndexOf('\n', start - 1) + 1;
            insertion = config.before + selectedText + config.after;
            editor.value = text.substring(0, lineStart) + insertion + text.substring(end);
            editor.selectionStart = lineStart + config.before.length;
            editor.selectionEnd = lineStart + config.before.length + selectedText.length;
        } else {
            insertion = config.before + selectedText + config.after;
            editor.value = text.substring(0, start) + insertion + text.substring(end);
            editor.selectionStart = start + config.before.length;
            editor.selectionEnd = start + config.before.length + selectedText.length;
        }

        onEditorInput();
    }

    // ===== Word & Character Count =====
    function updateCounts(text) {
        var charCount = text.length;
        var wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        wordCountEl.textContent = wordCount + ' word' + (wordCount !== 1 ? 's' : '');
        charCountEl.textContent = charCount + ' char' + (charCount !== 1 ? 's' : '');
    }

    // ===== Toast Notifications =====
    function showToast(message, type) {
        var toast = document.createElement('div');
        toast.className = 'toast' + (type ? ' toast-' + type : '');
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('toast-out');
            setTimeout(function () {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 2500);
    }

    // ===== Export =====
    function exportNote() {
        var note = getNoteById(state.activeNoteId);
        if (!note) return;

        var filename = (note.title || 'untitled').replace(/[^a-z0-9_\- ]/gi, '').trim().replace(/\s+/g, '_');
        if (!filename) filename = 'note';
        filename += '.md';

        var blob = new Blob([note.content], { type: 'text/markdown;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Note exported as ' + filename, 'success');
    }

    // ===== Date Formatting =====
    function formatDate(isoString) {
        var d = new Date(isoString);
        var now = new Date();
        var diffMs = now - d;
        var diffMin = Math.floor(diffMs / 60000);
        var diffHr = Math.floor(diffMs / 3600000);
        var diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return diffMin + 'm ago';
        if (diffHr < 24) return diffHr + 'h ago';
        if (diffDay < 7) return diffDay + 'd ago';

        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }

    // ===== Rendering =====
    function renderSidebar() {
        notesList.innerHTML = '';

        for (var i = 0; i < state.notes.length; i++) {
            var note = state.notes[i];
            var li = document.createElement('li');
            li.setAttribute('data-id', note.id);
            if (note.id === state.activeNoteId) {
                li.className = 'active';
            }

            var titleSpan = document.createElement('span');
            titleSpan.className = 'note-item-title';
            titleSpan.textContent = note.title || 'Untitled Note';
            li.appendChild(titleSpan);

            var dateSpan = document.createElement('span');
            dateSpan.className = 'note-item-date';
            dateSpan.textContent = formatDate(note.updatedAt);
            li.appendChild(dateSpan);

            var deleteBtn = document.createElement('button');
            deleteBtn.className = 'note-delete-btn';
            deleteBtn.textContent = '✕';
            deleteBtn.title = 'Delete note';
            deleteBtn.setAttribute('data-id', note.id);
            li.appendChild(deleteBtn);

            notesList.appendChild(li);
        }
    }

    function renderEditor() {
        var note = getNoteById(state.activeNoteId);
        if (!note) return;

        noteTitle.value = note.title || '';
        editor.value = note.content || '';
        updatePreview(note.content || '');
        updateCounts(note.content || '');
    }

    function updatePreview(text) {
        preview.innerHTML = parseMarkdown(text);
    }

    function render() {
        renderSidebar();
        renderEditor();
    }

    // ===== Debounce Utility =====
    function debounce(fn, delay) {
        var timer = null;
        return function () {
            var context = this;
            var args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(context, args);
            }, delay);
        };
    }

    // ===== Event Handlers =====
    function onEditorInput() {
        var note = getNoteById(state.activeNoteId);
        if (!note) return;

        note.content = editor.value;
        note.updatedAt = new Date().toISOString();
        saveState();

        updatePreview(note.content);
        updateCounts(note.content);
        renderSidebar();
    }

    var debouncedEditorInput = debounce(onEditorInput, DEBOUNCE_MS);

    function onTitleInput() {
        var note = getNoteById(state.activeNoteId);
        if (!note) return;

        note.title = noteTitle.value;
        note.updatedAt = new Date().toISOString();
        saveState();
        renderSidebar();
    }

    // ===== Mobile View Toggle =====
    var mobileView = 'editor'; // 'editor' or 'preview'

    function setMobileView(view) {
        mobileView = view;
        var editorPane = document.querySelector('.editor-pane');
        var previewPane = document.querySelector('.preview-pane');

        if (view === 'editor') {
            editorPane.classList.remove('hidden-mobile');
            previewPane.classList.add('hidden-mobile');
            btnViewEditor.classList.add('active');
            btnViewPreview.classList.remove('active');
        } else {
            editorPane.classList.add('hidden-mobile');
            previewPane.classList.remove('hidden-mobile');
            btnViewEditor.classList.remove('active');
            btnViewPreview.classList.add('active');
        }
    }

    // ===== Event Binding =====
    function bindEvents() {
        // Editor input with debounce
        editor.addEventListener('input', debouncedEditorInput);

        // Title input
        noteTitle.addEventListener('input', onTitleInput);

        // Tab key support in editor
        editor.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                var start = this.selectionStart;
                var end = this.selectionEnd;
                this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 4;
                onEditorInput();
            }
        });

        // Toolbar buttons
        document.querySelector('.toolbar').addEventListener('click', function (e) {
            var btn = e.target.closest('.tool-btn');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            if (action) {
                insertToolbarAction(action);
            }
        });

        // Notes list (delegation)
        notesList.addEventListener('click', function (e) {
            // Delete button
            var deleteBtn = e.target.closest('.note-delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                var id = deleteBtn.getAttribute('data-id');
                deleteNote(id);
                return;
            }

            // Note item
            var li = e.target.closest('li');
            if (li) {
                var noteId = li.getAttribute('data-id');
                if (noteId) switchNote(noteId);
            }
        });

        // New note
        btnNewNote.addEventListener('click', function () {
            createNote(false);
            render();
            editor.focus();
        });

        // Export
        btnExport.addEventListener('click', exportNote);

        // Toggle sidebar
        btnToggleSidebar.addEventListener('click', function () {
            sidebar.classList.toggle('collapsed');
        });

        // Mobile view toggles
        btnViewEditor.addEventListener('click', function () {
            setMobileView('editor');
        });

        btnViewPreview.addEventListener('click', function () {
            setMobileView('preview');
        });
    }

    // ===== Initialize =====
    function init() {
        loadState();
        bindEvents();
        render();

        // If on mobile, start with preview pane hidden
        if (window.innerWidth <= 768) {
            setMobileView('editor');
        }
    }

    // Start
    init();
})();
