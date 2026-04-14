/* ================================================================
   ResumeCraft — app.js
   Pure ES5-compatible IIFE, XSS-safe, no external dependencies
   localStorage key: resumecraft_data
   ================================================================ */
(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────────
   *  CONSTANTS
   * ──────────────────────────────────────────────────────────── */
  var STORAGE_KEY = 'resumecraft_data';
  var PREVIEW_DEBOUNCE = 100;

  var SECTION_META = [
    { id: 'personal',       num: '01', icon: '👤', title: 'Personal Info' },
    { id: 'summary',        num: '02', icon: '📝', title: 'Professional Summary' },
    { id: 'experience',     num: '03', icon: '💼', title: 'Work Experience' },
    { id: 'education',      num: '04', icon: '🎓', title: 'Education' },
    { id: 'skills',         num: '05', icon: '⚡', title: 'Skills' },
    { id: 'projects',       num: '06', icon: '🚀', title: 'Projects' },
    { id: 'certifications', num: '07', icon: '🏆', title: 'Certifications' }
  ];

  /* ──────────────────────────────────────────────────────────────
   *  DEFAULT STATE
   * ──────────────────────────────────────────────────────────── */
  function defaultState() {
    return {
      template:    'modern',
      accentColor: '#6366f1',
      fontSize:    'medium',
      personal: {
        name: '', jobTitle: '', email: '',
        phone: '', location: '', linkedin: '', website: ''
      },
      summary: '',
      experience:     [],
      education:      [],
      skills:         [],
      projects:       [],
      certifications: []
    };
  }

  var state = defaultState();

  /* Tracks which editor sections are collapsed */
  var collapsed = {
    personal: false, summary: false, experience: false,
    education: false, skills: false, projects: false, certifications: false
  };

  /* Tracks which entry cards inside sections are expanded */
  var entryExpanded = {};  /* { id: bool } */

  /* ──────────────────────────────────────────────────────────────
   *  UTILITIES
   * ──────────────────────────────────────────────────────────── */
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  var _uidCounter = 0;
  function uid() {
    _uidCounter++;
    return Date.now().toString(36) + '-' + _uidCounter.toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function $(id) { return document.getElementById(id); }

  /* ──────────────────────────────────────────────────────────────
   *  STORAGE
   * ──────────────────────────────────────────────────────────── */
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* quota or private-mode */ }
    flashSaved();
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state = Object.assign(defaultState(), parsed);
        /* ensure arrays */
        ['experience','education','skills','projects','certifications'].forEach(function (k) {
          if (!Array.isArray(state[k])) state[k] = [];
        });
        if (!state.personal || typeof state.personal !== 'object') {
          state.personal = defaultState().personal;
        }
      }
    } catch (e) {
      state = defaultState();
    }
  }

  var _saveTimer;
  function flashSaved() {
    var badge = $('saveBadge');
    if (!badge) return;
    badge.textContent = 'Saving…';
    badge.style.color = '#f59e0b';
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      badge.textContent = '✓ Saved';
      badge.style.color = '#10b981';
    }, 450);
  }

  /* ──────────────────────────────────────────────────────────────
   *  ACCENT COLOR
   * ──────────────────────────────────────────────────────────── */
  function applyAccent(color) {
    var r = parseInt(color.slice(1, 3), 16);
    var g = parseInt(color.slice(3, 5), 16);
    var b = parseInt(color.slice(5, 7), 16);
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-rgb', r + ', ' + g + ', ' + b);
  }

  /* ──────────────────────────────────────────────────────────────
   *  EDITOR  — build skeleton HTML (called once)
   * ──────────────────────────────────────────────────────────── */
  function buildEditor() {
    var container = $('rcSections');
    if (!container) return;

    var html = '';
    SECTION_META.forEach(function (meta) {
      var bodyHtml = buildSectionBody(meta.id);
      var isCollapsed = collapsed[meta.id];
      html += '<div class="rc-section" id="sec-' + meta.id + '">' +
        '<button class="rc-section-toggle' + (isCollapsed ? ' collapsed' : '') + '" ' +
          'data-toggle="' + meta.id + '" type="button">' +
          '<span class="rc-sec-drag">⠿</span>' +
          '<span class="rc-sec-num">' + meta.num + '</span>' +
          '<span class="rc-sec-icon">' + meta.icon + '</span>' +
          '<span class="rc-sec-title">' + meta.title + '</span>' +
          '<span class="rc-sec-chev">▾</span>' +
        '</button>' +
        '<div class="rc-section-body' + (isCollapsed ? ' hidden' : '') + '" id="body-' + meta.id + '">' +
          bodyHtml +
        '</div>' +
      '</div>';
    });

    container.innerHTML = html;
  }

  function buildSectionBody(id) {
    switch (id) {
      case 'personal':       return buildPersonalBody();
      case 'summary':        return buildSummaryBody();
      case 'experience':     return buildListBody('experience',     'Add Experience');
      case 'education':      return buildListBody('education',      'Add Education');
      case 'skills':         return buildSkillsBody();
      case 'projects':       return buildListBody('projects',       'Add Project');
      case 'certifications': return buildListBody('certifications', 'Add Certification');
      default: return '';
    }
  }

  function buildPersonalBody() {
    return '<div class="rc-form-row">' +
        field('personal','name',    'Full Name',  'Jane Smith') +
        field('personal','jobTitle','Job Title',  'Senior Product Designer') +
      '</div>' +
      '<div class="rc-form-row">' +
        field('personal','email',   'Email',      'jane@example.com') +
        field('personal','phone',   'Phone',      '+1 (555) 000-0000') +
      '</div>' +
      '<div class="rc-form-row">' +
        field('personal','location','Location',   'San Francisco, CA') +
        field('personal','linkedin','LinkedIn',   'linkedin.com/in/jane') +
      '</div>' +
      '<div class="rc-form-row full">' +
        field('personal','website', 'Website',    'janesmith.dev') +
      '</div>';
  }

  function buildSummaryBody() {
    return '<div class="rc-field">' +
      '<label class="rc-label">Summary</label>' +
      '<textarea class="rc-textarea" id="summaryTA" ' +
        'data-section="summary" data-field="summary" ' +
        'maxlength="250" rows="5" ' +
        'placeholder="Results-driven professional with 5+ years of experience…"></textarea>' +
      '</div>' +
      '<div class="rc-summary-foot">' +
        '<span class="rc-char-count" id="summaryCount">0 / 250</span>' +
      '</div>';
  }

  function buildListBody(section, addLabel) {
    return '<div class="rc-entries" id="entries-' + section + '"></div>' +
      '<button class="rc-btn-add" type="button" data-add="' + section + '">+ ' + addLabel + '</button>';
  }

  function buildSkillsBody() {
    return '<div class="rc-skill-add">' +
        '<div class="rc-field">' +
          '<label class="rc-label">Skill Name</label>' +
          '<input class="rc-input" id="skillInput" type="text" placeholder="e.g. JavaScript">' +
        '</div>' +
        '<div class="rc-field">' +
          '<label class="rc-label">Level</label>' +
          '<select class="rc-select" id="skillLevel">' +
            '<option value="Beginner">Beginner</option>' +
            '<option value="Intermediate" selected>Intermediate</option>' +
            '<option value="Expert">Expert</option>' +
          '</select>' +
        '</div>' +
        '<button class="rc-btn-add-skill" type="button" data-add="skill">+ Add</button>' +
      '</div>' +
      '<div class="rc-skill-chips" id="skillChips"></div>';
  }

  /* Small helper that returns a two-cell field HTML */
  function field(section, key, label, placeholder) {
    return '<div class="rc-field">' +
      '<label class="rc-label">' + label + '</label>' +
      '<input class="rc-input" type="text" ' +
        'data-section="' + section + '" data-field="' + key + '" ' +
        'id="f-' + section + '-' + key + '" ' +
        'placeholder="' + esc(placeholder) + '">' +
      '</div>';
  }

  /* ──────────────────────────────────────────────────────────────
   *  EDITOR  — populate static fields from state
   * ──────────────────────────────────────────────────────────── */
  function populateEditor() {
    /* Personal */
    ['name','jobTitle','email','phone','location','linkedin','website'].forEach(function (k) {
      var el = $('f-personal-' + k);
      if (el) el.value = state.personal[k] || '';
    });

    /* Summary */
    var ta = $('summaryTA');
    if (ta) {
      ta.value = state.summary || '';
      updateSummaryCount();
    }

    /* Lists */
    renderExperienceList();
    renderEducationList();
    renderSkillsChips();
    renderProjectsList();
    renderCertificationsList();
  }

  function updateSummaryCount() {
    var ta = $('summaryTA');
    var counter = $('summaryCount');
    if (!ta || !counter) return;
    var len = ta.value.length;
    counter.textContent = len + ' / 250';
    counter.className = 'rc-char-count' + (len >= 240 ? ' danger' : len >= 200 ? ' warn' : '');
  }

  /* ──────────────────────────────────────────────────────────────
   *  ENTRY LIST RENDERERS
   * ──────────────────────────────────────────────────────────── */
  function renderExperienceList() {
    var container = $('entries-experience');
    if (!container) return;
    if (!state.experience.length) { container.innerHTML = ''; return; }
    var html = '';
    state.experience.forEach(function (exp, i) {
      var preview = [exp.jobTitle, exp.company].filter(Boolean).join(' — ') || 'New Entry';
      var open = entryExpanded[exp.id] !== false; /* default open */
      html += '<div class="rc-entry" data-entry-id="' + esc(exp.id) + '">' +
        '<div class="rc-entry-hd" data-toggle-entry="' + esc(exp.id) + '">' +
          '<span class="rc-entry-drag">⠿</span>' +
          '<span class="rc-entry-preview">' + esc(preview) + '</span>' +
          '<button class="rc-entry-del" type="button" data-del="experience" data-id="' + esc(exp.id) + '">✕</button>' +
        '</div>' +
        '<div class="rc-entry-body' + (open ? '' : ' hidden') + '" id="eb-' + esc(exp.id) + '">' +
          '<div class="rc-form-row">' +
            entryField('experience', exp.id, 'jobTitle', 'Job Title', 'Senior Developer', exp.jobTitle) +
            entryField('experience', exp.id, 'company',  'Company',   'Acme Corp',        exp.company) +
          '</div>' +
          '<div class="rc-form-row">' +
            entryField('experience', exp.id, 'location',  'Location',   'New York, NY',  exp.location) +
            entryField('experience', exp.id, 'startDate', 'Start Date', 'Jan 2020',      exp.startDate) +
          '</div>' +
          '<div class="rc-form-row">' +
            '<div class="rc-field">' +
              '<label class="rc-label">End Date</label>' +
              '<input class="rc-input" type="text" ' +
                'data-section="experience" data-id="' + esc(exp.id) + '" data-field="endDate" ' +
                'value="' + esc(exp.endDate) + '" placeholder="Dec 2023"' +
                (exp.current ? ' disabled' : '') + '>' +
            '</div>' +
            '<div class="rc-field">' +
              '<label class="rc-checkbox-wrap">' +
                '<input type="checkbox" ' +
                  'data-section="experience" data-id="' + esc(exp.id) + '" data-field="current" ' +
                  (exp.current ? 'checked' : '') + '>' +
                '<span>Currently here</span>' +
              '</label>' +
            '</div>' +
          '</div>' +
          '<div class="rc-form-row full">' +
            '<div class="rc-field">' +
              '<label class="rc-label">Description <span style="font-weight:400;text-transform:none;letter-spacing:0">(one bullet per line)</span></label>' +
              '<textarea class="rc-textarea" rows="4" ' +
                'data-section="experience" data-id="' + esc(exp.id) + '" data-field="description" ' +
                'placeholder="Developed key features&#10;Led a team of 5 engineers&#10;Increased performance by 40%">' + esc(exp.description) + '</textarea>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  function renderEducationList() {
    var container = $('entries-education');
    if (!container) return;
    if (!state.education.length) { container.innerHTML = ''; return; }
    var html = '';
    state.education.forEach(function (edu) {
      var preview = [edu.degree, edu.institution].filter(Boolean).join(' — ') || 'New Entry';
      var open = entryExpanded[edu.id] !== false;
      html += '<div class="rc-entry" data-entry-id="' + esc(edu.id) + '">' +
        '<div class="rc-entry-hd" data-toggle-entry="' + esc(edu.id) + '">' +
          '<span class="rc-entry-drag">⠿</span>' +
          '<span class="rc-entry-preview">' + esc(preview) + '</span>' +
          '<button class="rc-entry-del" type="button" data-del="education" data-id="' + esc(edu.id) + '">✕</button>' +
        '</div>' +
        '<div class="rc-entry-body' + (open ? '' : ' hidden') + '" id="eb-' + esc(edu.id) + '">' +
          '<div class="rc-form-row">' +
            entryField('education', edu.id, 'degree',      'Degree',      'B.S. Computer Science', edu.degree) +
            entryField('education', edu.id, 'institution', 'Institution', 'MIT',                   edu.institution) +
          '</div>' +
          '<div class="rc-form-row">' +
            entryField('education', edu.id, 'location', 'Location', 'Cambridge, MA', edu.location) +
            entryField('education', edu.id, 'year',     'Year',     '2018',          edu.year) +
          '</div>' +
          '<div class="rc-form-row full">' +
            entryField('education', edu.id, 'gpa', 'GPA (optional)', '3.9 / 4.0', edu.gpa) +
          '</div>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  function renderSkillsChips() {
    var container = $('skillChips');
    if (!container) return;
    if (!state.skills.length) { container.innerHTML = ''; return; }
    var html = '';
    state.skills.forEach(function (sk) {
      html += '<span class="rc-skill-chip">' +
        esc(sk.name) +
        '<span class="rc-skill-chip-lv">' + esc(sk.level) + '</span>' +
        '<button class="rc-chip-del" type="button" data-del="skill" data-id="' + esc(sk.id) + '">✕</button>' +
      '</span>';
    });
    container.innerHTML = html;
  }

  function renderProjectsList() {
    var container = $('entries-projects');
    if (!container) return;
    if (!state.projects.length) { container.innerHTML = ''; return; }
    var html = '';
    state.projects.forEach(function (proj) {
      var preview = proj.name || 'New Project';
      var open = entryExpanded[proj.id] !== false;
      html += '<div class="rc-entry" data-entry-id="' + esc(proj.id) + '">' +
        '<div class="rc-entry-hd" data-toggle-entry="' + esc(proj.id) + '">' +
          '<span class="rc-entry-drag">⠿</span>' +
          '<span class="rc-entry-preview">' + esc(preview) + '</span>' +
          '<button class="rc-entry-del" type="button" data-del="projects" data-id="' + esc(proj.id) + '">✕</button>' +
        '</div>' +
        '<div class="rc-entry-body' + (open ? '' : ' hidden') + '" id="eb-' + esc(proj.id) + '">' +
          '<div class="rc-form-row">' +
            entryField('projects', proj.id, 'name',      'Project Name', 'Portfolio Website', proj.name) +
            entryField('projects', proj.id, 'techStack', 'Tech Stack',   'React, Node.js',    proj.techStack) +
          '</div>' +
          '<div class="rc-form-row full">' +
            entryField('projects', proj.id, 'url', 'URL (optional)', 'https://github.com/...', proj.url) +
          '</div>' +
          '<div class="rc-form-row full">' +
            '<div class="rc-field">' +
              '<label class="rc-label">Description</label>' +
              '<textarea class="rc-textarea" rows="3" ' +
                'data-section="projects" data-id="' + esc(proj.id) + '" data-field="description" ' +
                'placeholder="Built a responsive portfolio with dark mode...">' + esc(proj.description) + '</textarea>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  function renderCertificationsList() {
    var container = $('entries-certifications');
    if (!container) return;
    if (!state.certifications.length) { container.innerHTML = ''; return; }
    var html = '';
    state.certifications.forEach(function (cert) {
      var preview = cert.name || 'New Certification';
      var open = entryExpanded[cert.id] !== false;
      html += '<div class="rc-entry" data-entry-id="' + esc(cert.id) + '">' +
        '<div class="rc-entry-hd" data-toggle-entry="' + esc(cert.id) + '">' +
          '<span class="rc-entry-drag">⠿</span>' +
          '<span class="rc-entry-preview">' + esc(preview) + '</span>' +
          '<button class="rc-entry-del" type="button" data-del="certifications" data-id="' + esc(cert.id) + '">✕</button>' +
        '</div>' +
        '<div class="rc-entry-body' + (open ? '' : ' hidden') + '" id="eb-' + esc(cert.id) + '">' +
          '<div class="rc-form-row">' +
            entryField('certifications', cert.id, 'name',   'Certification', 'AWS Solutions Architect', cert.name) +
            entryField('certifications', cert.id, 'issuer', 'Issuer',        'Amazon Web Services',     cert.issuer) +
          '</div>' +
          '<div class="rc-form-row full">' +
            entryField('certifications', cert.id, 'year', 'Year', '2023', cert.year) +
          '</div>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  function entryField(section, id, field, label, placeholder, value) {
    return '<div class="rc-field">' +
      '<label class="rc-label">' + label + '</label>' +
      '<input class="rc-input" type="text" ' +
        'data-section="' + section + '" data-id="' + esc(id) + '" data-field="' + field + '" ' +
        'value="' + esc(value || '') + '" placeholder="' + esc(placeholder) + '">' +
      '</div>';
  }

  /* ──────────────────────────────────────────────────────────────
   *  PREVIEW  —  debounced full re-render
   * ──────────────────────────────────────────────────────────── */
  var updatePreview = debounce(function () {
    var el = $('resumePreview');
    if (!el) return;
    el.setAttribute('data-fontsize', state.fontSize);
    el.innerHTML = buildResumeHTML();
  }, PREVIEW_DEBOUNCE);

  function buildResumeHTML() {
    switch (state.template) {
      case 'classic': return buildClassicHTML();
      case 'minimal': return buildMinimalHTML();
      default:        return buildModernHTML();
    }
  }

  /* ──────────────────────────────────────────────────────────────
   *  TEMPLATE: MODERN
   * ──────────────────────────────────────────────────────────── */
  function buildModernHTML() {
    var p = state.personal;
    var initials = (p.name || 'RC').split(' ')
      .map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase() || 'RC';

    /* ── sidebar: contact ── */
    var contactHTML = '';
    if (p.email)    contactHTML += cItem('✉', p.email);
    if (p.phone)    contactHTML += cItem('📱', p.phone);
    if (p.location) contactHTML += cItem('📍', p.location);
    if (p.linkedin) contactHTML += cItem('🔗', p.linkedin);
    if (p.website)  contactHTML += cItem('🌐', p.website);

    /* ── sidebar: skills ── */
    var skillsHTML = '';
    state.skills.forEach(function (sk) {
      var widths = { Beginner: 33, Intermediate: 66, Expert: 100 };
      var w = widths[sk.level] || 66;
      skillsHTML +=
        '<div class="m-skill">' +
          '<div class="m-skill-hd">' +
            '<span class="m-skill-name">' + esc(sk.name) + '</span>' +
            '<span class="m-skill-level">' + esc(sk.level) + '</span>' +
          '</div>' +
          '<div class="m-skill-track"><div class="m-skill-fill" style="width:' + w + '%"></div></div>' +
        '</div>';
    });

    /* ── main: summary ── */
    var mainHTML = '';
    if (state.summary) {
      mainHTML += '<div class="m-section"><h2 class="m-heading">Summary</h2>' +
        '<p class="m-summary">' + esc(state.summary) + '</p></div>';
    }

    /* ── main: experience ── */
    if (state.experience.length) {
      var expHTML = '<div class="m-section"><h2 class="m-heading">Experience</h2>';
      state.experience.forEach(function (exp) {
        var dates = exp.current
          ? esc(exp.startDate) + ' — Present'
          : esc(exp.startDate) + (exp.endDate ? ' — ' + esc(exp.endDate) : '');
        var company = [exp.company, exp.location].filter(Boolean).map(esc).join(', ');
        expHTML +=
          '<div class="m-exp-entry">' +
            '<div class="m-exp-hd">' +
              '<span class="m-exp-title">' + esc(exp.jobTitle) + '</span>' +
              '<span class="m-exp-dates">' + dates + '</span>' +
            '</div>' +
            (company ? '<div class="m-exp-company">' + company + '</div>' : '') +
            buildBullets(exp.description, 'm-bullets') +
          '</div>';
      });
      mainHTML += expHTML + '</div>';
    }

    /* ── main: education ── */
    if (state.education.length) {
      var eduHTML = '<div class="m-section"><h2 class="m-heading">Education</h2>';
      state.education.forEach(function (edu) {
        var school = [edu.institution, edu.location].filter(Boolean).map(esc).join(', ');
        eduHTML +=
          '<div class="m-edu-entry">' +
            '<div class="m-edu-hd">' +
              '<span class="m-edu-degree">' + esc(edu.degree) + '</span>' +
              '<span class="m-edu-year">' + esc(edu.year) + '</span>' +
            '</div>' +
            (school ? '<div class="m-edu-school">' + school + '</div>' : '') +
            (edu.gpa ? '<div class="m-edu-gpa">GPA: ' + esc(edu.gpa) + '</div>' : '') +
          '</div>';
      });
      mainHTML += eduHTML + '</div>';
    }

    /* ── main: projects ── */
    if (state.projects.length) {
      var projHTML = '<div class="m-section"><h2 class="m-heading">Projects</h2>';
      state.projects.forEach(function (proj) {
        projHTML +=
          '<div class="m-proj-entry">' +
            '<div class="m-proj-hd">' +
              '<span class="m-proj-name">' + esc(proj.name) + '</span>' +
              (proj.url ? '<span class="m-proj-url">' + esc(proj.url) + '</span>' : '') +
            '</div>' +
            (proj.techStack ? '<div class="m-proj-stack">' + esc(proj.techStack) + '</div>' : '') +
            (proj.description ? '<div class="m-proj-desc">' + esc(proj.description) + '</div>' : '') +
          '</div>';
      });
      mainHTML += projHTML + '</div>';
    }

    /* ── main: certifications ── */
    if (state.certifications.length) {
      var certHTML = '<div class="m-section"><h2 class="m-heading">Certifications</h2>';
      state.certifications.forEach(function (cert) {
        certHTML +=
          '<div class="m-cert-entry">' +
            '<div>' +
              '<div class="m-cert-name">' + esc(cert.name) + '</div>' +
              (cert.issuer ? '<div class="m-cert-issuer">' + esc(cert.issuer) + '</div>' : '') +
            '</div>' +
            '<span class="m-cert-year">' + esc(cert.year) + '</span>' +
          '</div>';
      });
      mainHTML += certHTML + '</div>';
    }

    return '<div class="tpl-modern">' +
      '<div class="m-sidebar">' +
        '<div class="m-profile">' +
          '<div class="m-avatar">' + esc(initials) + '</div>' +
          '<h1 class="m-name">' + (esc(p.name) || 'Your Name') + '</h1>' +
          (p.jobTitle ? '<p class="m-jobtitle">' + esc(p.jobTitle) + '</p>' : '') +
        '</div>' +
        (contactHTML ? '<div class="m-sb-sec"><h3 class="m-sb-heading">Contact</h3>' + contactHTML + '</div>' : '') +
        (skillsHTML  ? '<div class="m-sb-sec" style="padding-bottom:14px"><h3 class="m-sb-heading">Skills</h3>' + skillsHTML + '</div>' : '') +
      '</div>' +
      '<div class="m-main">' + mainHTML + '</div>' +
    '</div>';
  }

  function cItem(icon, text) {
    return '<div class="m-contact-item">' +
      '<span class="m-contact-ico">' + icon + '</span>' +
      '<span>' + esc(text) + '</span>' +
    '</div>';
  }

  /* ──────────────────────────────────────────────────────────────
   *  TEMPLATE: CLASSIC
   * ──────────────────────────────────────────────────────────── */
  function buildClassicHTML() {
    var p = state.personal;

    /* Contact bar */
    var cParts = [];
    if (p.email)    cParts.push(esc(p.email));
    if (p.phone)    cParts.push(esc(p.phone));
    if (p.location) cParts.push(esc(p.location));
    if (p.linkedin) cParts.push(esc(p.linkedin));
    if (p.website)  cParts.push(esc(p.website));
    var contactBar = cParts.join('<span class="cls-sep"> | </span>');

    var body = '';

    /* Summary */
    if (state.summary) {
      body += '<div class="cls-section">' +
        '<h2 class="cls-heading">Professional Summary</h2>' +
        '<p class="cls-summary">' + esc(state.summary) + '</p>' +
      '</div>';
    }

    /* Experience */
    if (state.experience.length) {
      body += '<div class="cls-section"><h2 class="cls-heading">Experience</h2>';
      state.experience.forEach(function (exp) {
        var dates = exp.current
          ? esc(exp.startDate) + ' — Present'
          : esc(exp.startDate) + (exp.endDate ? ' — ' + esc(exp.endDate) : '');
        var company = [exp.company, exp.location].filter(Boolean).map(esc).join(', ');
        body +=
          '<div class="cls-exp-entry">' +
            '<div class="cls-exp-hd">' +
              '<div>' +
                '<div class="cls-exp-title">' + esc(exp.jobTitle) + '</div>' +
                (company ? '<div class="cls-exp-company">' + company + '</div>' : '') +
              '</div>' +
              '<span class="cls-exp-dates">' + dates + '</span>' +
            '</div>' +
            buildBullets(exp.description, 'cls-bullets') +
          '</div>';
      });
      body += '</div>';
    }

    /* Education */
    if (state.education.length) {
      body += '<div class="cls-section"><h2 class="cls-heading">Education</h2>';
      state.education.forEach(function (edu) {
        var school = [edu.institution, edu.location].filter(Boolean).map(esc).join(', ');
        body +=
          '<div class="cls-edu-entry">' +
            '<div>' +
              '<div class="cls-edu-degree">' + esc(edu.degree) + '</div>' +
              (school ? '<div class="cls-edu-school">' + school + '</div>' : '') +
            '</div>' +
            '<div class="cls-edu-right">' +
              '<span class="cls-edu-year">' + esc(edu.year) + '</span>' +
              (edu.gpa ? '<span class="cls-edu-gpa">GPA ' + esc(edu.gpa) + '</span>' : '') +
            '</div>' +
          '</div>';
      });
      body += '</div>';
    }

    /* Skills */
    if (state.skills.length) {
      body += '<div class="cls-section"><h2 class="cls-heading">Skills</h2>' +
        '<div class="cls-skills-row">';
      state.skills.forEach(function (sk) {
        var lvClass = sk.level === 'Expert' ? ' expert' : sk.level === 'Intermediate' ? ' intermediate' : '';
        body += '<span class="cls-skill' + lvClass + '">' + esc(sk.name) + '</span>';
      });
      body += '</div></div>';
    }

    /* Projects */
    if (state.projects.length) {
      body += '<div class="cls-section"><h2 class="cls-heading">Projects</h2>';
      state.projects.forEach(function (proj) {
        body +=
          '<div class="cls-proj-entry">' +
            '<div class="cls-proj-hd">' +
              '<span class="cls-proj-name">' + esc(proj.name) + '</span>' +
              (proj.url ? '<span class="cls-proj-url">' + esc(proj.url) + '</span>' : '') +
            '</div>' +
            (proj.techStack ? '<div class="cls-proj-stack">Stack: ' + esc(proj.techStack) + '</div>' : '') +
            (proj.description ? '<div class="cls-proj-desc">' + esc(proj.description) + '</div>' : '') +
          '</div>';
      });
      body += '</div>';
    }

    /* Certifications */
    if (state.certifications.length) {
      body += '<div class="cls-section"><h2 class="cls-heading">Certifications</h2>' +
        '<div class="cls-cert-grid">';
      state.certifications.forEach(function (cert) {
        body +=
          '<div class="cls-cert-entry">' +
            '<div class="cls-cert-name">' + esc(cert.name) + '</div>' +
            (cert.issuer ? '<div class="cls-cert-issuer">' + esc(cert.issuer) + '</div>' : '') +
            (cert.year   ? '<div class="cls-cert-year">'   + esc(cert.year)   + '</div>' : '') +
          '</div>';
      });
      body += '</div></div>';
    }

    return '<div class="tpl-classic">' +
      '<div class="cls-header">' +
        '<h1 class="cls-name">' + (esc(p.name) || 'Your Name') + '</h1>' +
        (p.jobTitle ? '<p class="cls-jobtitle">' + esc(p.jobTitle) + '</p>' : '') +
        (contactBar ? '<div class="cls-contact-bar">' + contactBar + '</div>' : '') +
      '</div>' +
      '<div class="cls-rule"></div>' +
      body +
    '</div>';
  }

  /* ──────────────────────────────────────────────────────────────
   *  TEMPLATE: MINIMAL
   * ──────────────────────────────────────────────────────────── */
  function buildMinimalHTML() {
    var p = state.personal;

    /* Right-side contact items (email, phone) */
    var rightContact = '';
    if (p.email) rightContact += '<span class="min-cr-item">✉ ' + esc(p.email) + '</span>';
    if (p.phone) rightContact += '<span class="min-cr-item">📱 ' + esc(p.phone) + '</span>';

    /* Bottom contact row */
    var bottomContact = '';
    if (p.location) bottomContact += minCI('📍', p.location);
    if (p.linkedin) bottomContact += minCI('🔗', p.linkedin);
    if (p.website)  bottomContact += minCI('🌐', p.website);

    var body = '';

    if (state.summary) {
      body += '<div class="min-section">' +
        '<h2 class="min-heading">Summary</h2>' +
        '<p class="min-summary">' + esc(state.summary) + '</p>' +
      '</div>';
    }

    if (state.experience.length) {
      body += '<div class="min-section"><h2 class="min-heading">Experience</h2>';
      state.experience.forEach(function (exp) {
        var dates = exp.current
          ? esc(exp.startDate) + ' — Present'
          : esc(exp.startDate) + (exp.endDate ? ' — ' + esc(exp.endDate) : '');
        var company = [exp.company, exp.location].filter(Boolean).map(esc).join(', ');
        body +=
          '<div class="min-exp-entry">' +
            '<div>' +
              '<div class="min-exp-title">' + esc(exp.jobTitle) + '</div>' +
              (company ? '<div class="min-exp-company">' + company + '</div>' : '') +
            '</div>' +
            '<div class="min-exp-dates">' + dates + '</div>' +
            buildBullets(exp.description, 'min-bullets') +
          '</div>';
      });
      body += '</div>';
    }

    if (state.education.length) {
      body += '<div class="min-section"><h2 class="min-heading">Education</h2>';
      state.education.forEach(function (edu) {
        var school = [edu.institution, edu.location].filter(Boolean).map(esc).join(', ');
        body +=
          '<div class="min-edu-entry">' +
            '<div>' +
              '<div class="min-edu-degree">' + esc(edu.degree) + '</div>' +
              (school ? '<div class="min-edu-school">' + school + '</div>' : '') +
            '</div>' +
            '<div class="min-edu-right">' +
              '<span class="min-edu-year">' + esc(edu.year) + '</span>' +
              (edu.gpa ? '<span class="min-edu-gpa">GPA ' + esc(edu.gpa) + '</span>' : '') +
            '</div>' +
          '</div>';
      });
      body += '</div>';
    }

    if (state.skills.length) {
      body += '<div class="min-section"><h2 class="min-heading">Skills</h2>' +
        '<div class="min-skills-wrap">';
      state.skills.forEach(function (sk) {
        var lvClass = sk.level === 'Expert' ? ' expert' : sk.level === 'Intermediate' ? ' intermediate' : '';
        body += '<span class="min-skill' + lvClass + '">' + esc(sk.name) + '</span>';
      });
      body += '</div></div>';
    }

    if (state.projects.length) {
      body += '<div class="min-section"><h2 class="min-heading">Projects</h2>';
      state.projects.forEach(function (proj) {
        body +=
          '<div class="min-proj-entry">' +
            '<div class="min-proj-hd">' +
              '<span class="min-proj-name">' + esc(proj.name) + '</span>' +
              (proj.url ? '<span class="min-proj-url">' + esc(proj.url) + '</span>' : '') +
            '</div>' +
            (proj.techStack ? '<div class="min-proj-stack">' + esc(proj.techStack) + '</div>' : '') +
            (proj.description ? '<div class="min-proj-desc">' + esc(proj.description) + '</div>' : '') +
          '</div>';
      });
      body += '</div>';
    }

    if (state.certifications.length) {
      body += '<div class="min-section"><h2 class="min-heading">Certifications</h2>' +
        '<div class="min-cert-list">';
      state.certifications.forEach(function (cert) {
        var sub = [cert.issuer, cert.year].filter(Boolean).map(esc).join(' · ');
        body +=
          '<div class="min-cert-item">' +
            '<div class="min-cert-name">' + esc(cert.name) + '</div>' +
            (sub ? '<div class="min-cert-sub">' + sub + '</div>' : '') +
          '</div>';
      });
      body += '</div></div>';
    }

    return '<div class="tpl-minimal">' +
      '<div class="min-header">' +
        '<div class="min-name-row">' +
          '<h1 class="min-name">' + (esc(p.name) || 'Your Name') + '</h1>' +
          (rightContact ? '<div class="min-contact-right">' + rightContact + '</div>' : '') +
        '</div>' +
        (p.jobTitle ? '<p class="min-jobtitle">' + esc(p.jobTitle) + '</p>' : '') +
        (bottomContact ? '<div class="min-contact-row">' + bottomContact + '</div>' : '') +
      '</div>' +
      body +
    '</div>';
  }

  function minCI(icon, text) {
    return '<span class="min-c-item"><span class="min-c-ico">' + icon + '</span>' + esc(text) + '</span>';
  }

  /* ── shared bullet builder ── */
  function buildBullets(description, cls) {
    if (!description) return '';
    var lines = description.split('\n').map(function (l) { return l.replace(/^[\s•\-\*]+/, '').trim(); }).filter(Boolean);
    if (!lines.length) return '';
    return '<ul class="' + cls + '">' +
      lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') +
    '</ul>';
  }

  /* ──────────────────────────────────────────────────────────────
   *  EVENT HANDLERS
   * ──────────────────────────────────────────────────────────── */

  /* ── Navbar ── */
  function bindNavbar() {
    /* Template buttons */
    var tBtns = $('templateBtns');
    if (tBtns) {
      tBtns.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-template]');
        if (!btn) return;
        state.template = btn.dataset.template;
        tBtns.querySelectorAll('.rc-ctrl-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        saveState();
        updatePreview();
      });
    }

    /* Color swatches */
    var swatches = $('colorSwatches');
    if (swatches) {
      swatches.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-color]');
        if (!btn) return;
        state.accentColor = btn.dataset.color;
        swatches.querySelectorAll('.rc-swatch').forEach(function (s) {
          s.classList.toggle('active', s === btn);
        });
        applyAccent(state.accentColor);
        saveState();
        /* No need to re-render — CSS var update handles it */
      });
    }

    /* Font size buttons */
    var fsBtns = $('fontSizeBtns');
    if (fsBtns) {
      fsBtns.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-size]');
        if (!btn) return;
        state.fontSize = btn.dataset.size;
        fsBtns.querySelectorAll('.rc-ctrl-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        var el = $('resumePreview');
        if (el) el.setAttribute('data-fontsize', state.fontSize);
        saveState();
      });
    }

    /* Export PDF */
    var exportBtn = $('btnExport');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () { window.print(); });
    }
  }

  /* ── Editor: input / change ── */
  function bindEditor() {
    var sections = $('rcSections');
    if (!sections) return;

    /* INPUT & CHANGE events — update state, debounce preview */
    sections.addEventListener('input', handleEditorInput);
    sections.addEventListener('change', handleEditorInput);

    /* CLICK events — toggles, add, delete */
    sections.addEventListener('click', handleEditorClick);
  }

  function handleEditorInput(e) {
    var target = e.target;
    var section = target.dataset.section;
    var fieldKey = target.dataset.field;

    if (!section || !fieldKey) return;

    if (section === 'personal') {
      state.personal[fieldKey] = target.value;
    } else if (section === 'summary') {
      state.summary = target.value;
      updateSummaryCount();
    } else {
      var entryId = target.dataset.id;
      if (!entryId) return;
      var list = state[section];
      if (!Array.isArray(list)) return;
      var entry = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === entryId) { entry = list[i]; break; }
      }
      if (!entry) return;

      if (target.type === 'checkbox') {
        entry[fieldKey] = target.checked;
        /* Toggle end-date field for "currently working here" */
        if (fieldKey === 'current') {
          var edInput = sections.querySelector(
            '[data-section="experience"][data-id="' + entryId + '"][data-field="endDate"]'
          );
          if (edInput) edInput.disabled = target.checked;
        }
      } else {
        entry[fieldKey] = target.value;
      }

      /* Re-render entry header preview text (experience / education) */
      updateEntryPreview(section, entryId);
    }

    saveState();
    updatePreview();
  }

  function handleEditorClick(e) {
    /* Section accordion toggle */
    var toggle = e.target.closest('[data-toggle]');
    if (toggle && !e.target.closest('[data-add]') && !e.target.closest('[data-del]') && !e.target.closest('[data-toggle-entry]')) {
      var secId = toggle.dataset.toggle;
      var body = $('body-' + secId);
      if (body) {
        var isHidden = body.classList.toggle('hidden');
        toggle.classList.toggle('collapsed', isHidden);
        collapsed[secId] = isHidden;
      }
      return;
    }

    /* Entry card toggle */
    var entryToggle = e.target.closest('[data-toggle-entry]');
    if (entryToggle && !e.target.closest('[data-del]')) {
      var eid = entryToggle.dataset.toggleEntry;
      var entryBody = $('eb-' + eid);
      if (entryBody) {
        var hidden = entryBody.classList.toggle('hidden');
        entryExpanded[eid] = !hidden;
      }
      return;
    }

    /* Delete entry */
    var delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      e.stopPropagation();
      var section = delBtn.dataset.del;
      var id = delBtn.dataset.id;

      if (section === 'skill') {
        state.skills = state.skills.filter(function (s) { return s.id !== id; });
        renderSkillsChips();
      } else if (Array.isArray(state[section])) {
        state[section] = state[section].filter(function (item) { return item.id !== id; });
        reRenderList(section);
      }

      saveState();
      updatePreview();
      return;
    }

    /* Add entry */
    var addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      var addType = addBtn.dataset.add;
      if (addType === 'skill') {
        addSkill();
      } else {
        addEntry(addType);
      }
      return;
    }
  }

  function addSkill() {
    var input = $('skillInput');
    var levelSel = $('skillLevel');
    if (!input) return;
    var name = input.value.trim();
    if (!name) return;
    var level = levelSel ? levelSel.value : 'Intermediate';
    var newSkill = { id: uid(), name: name, level: level };
    state.skills.push(newSkill);
    input.value = '';
    renderSkillsChips();
    saveState();
    updatePreview();
  }

  function addEntry(section) {
    var newEntry = { id: uid() };
    if (section === 'experience') {
      Object.assign(newEntry, { jobTitle:'', company:'', location:'', startDate:'', endDate:'', current: false, description:'' });
    } else if (section === 'education') {
      Object.assign(newEntry, { degree:'', institution:'', location:'', year:'', gpa:'' });
    } else if (section === 'projects') {
      Object.assign(newEntry, { name:'', techStack:'', description:'', url:'' });
    } else if (section === 'certifications') {
      Object.assign(newEntry, { name:'', issuer:'', year:'' });
    }
    entryExpanded[newEntry.id] = true;
    state[section].push(newEntry);
    reRenderList(section);
    saveState();
    updatePreview();

    /* Scroll new entry into view */
    setTimeout(function () {
      var newEl = document.querySelector('[data-entry-id="' + newEntry.id + '"]');
      if (newEl) newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  function reRenderList(section) {
    switch (section) {
      case 'experience':     renderExperienceList(); break;
      case 'education':      renderEducationList(); break;
      case 'projects':       renderProjectsList(); break;
      case 'certifications': renderCertificationsList(); break;
    }
  }

  function updateEntryPreview(section, id) {
    var entry = null;
    var list = state[section];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { entry = list[i]; break; }
    }
    if (!entry) return;

    var text = '';
    if (section === 'experience')     text = [entry.jobTitle, entry.company].filter(Boolean).join(' — ');
    else if (section === 'education') text = [entry.degree, entry.institution].filter(Boolean).join(' — ');
    else if (section === 'projects')  text = entry.name || '';
    else if (section === 'certifications') text = entry.name || '';

    var previewEl = document.querySelector('[data-entry-id="' + id + '"] .rc-entry-preview');
    if (previewEl) previewEl.textContent = text || 'New Entry';
  }

  /* ──────────────────────────────────────────────────────────────
   *  SYNC NAVBAR UI WITH STATE  (after loading from storage)
   * ──────────────────────────────────────────────────────────── */
  function syncNavbarUI() {
    /* Template buttons */
    var tBtns = $('templateBtns');
    if (tBtns) {
      tBtns.querySelectorAll('.rc-ctrl-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.template === state.template);
      });
    }

    /* Swatches */
    var swatches = $('colorSwatches');
    if (swatches) {
      swatches.querySelectorAll('.rc-swatch').forEach(function (s) {
        s.classList.toggle('active', s.dataset.color === state.accentColor);
      });
    }

    /* Font size */
    var fsBtns = $('fontSizeBtns');
    if (fsBtns) {
      fsBtns.querySelectorAll('.rc-ctrl-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.size === state.fontSize);
      });
    }
  }

  /* ──────────────────────────────────────────────────────────────
   *  ENTER key on skill input → add skill
   * ──────────────────────────────────────────────────────────── */
  function bindSkillEnter() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'skillInput') {
        e.preventDefault();
        addSkill();
      }
    });
  }

  /* ──────────────────────────────────────────────────────────────
   *  INIT
   * ──────────────────────────────────────────────────────────── */
  function init() {
    loadState();
    applyAccent(state.accentColor);
    buildEditor();
    populateEditor();
    syncNavbarUI();
    bindNavbar();
    bindEditor();
    bindSkillEnter();
    updatePreview();
  }

  /* Run after DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
