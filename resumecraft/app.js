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
      fontFamily:  'inter',
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
    el.setAttribute('data-fontfamily', state.fontFamily || 'inter');
    el.innerHTML = buildResumeHTML();
    updateStrengthMeter();
  }, PREVIEW_DEBOUNCE);

  function buildResumeHTML() {
    switch (state.template) {
      case 'classic':      return buildClassicHTML();
      case 'minimal':      return buildMinimalHTML();
      case 'professional': return buildProfessionalHTML();
      case 'executive':    return buildExecutiveHTML();
      default:             return buildModernHTML();
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

    /* Font family select */
    var ffSelect = $('fontFamilySelect');
    if (ffSelect) {
      ffSelect.addEventListener('change', function () {
        state.fontFamily = ffSelect.value;
        var el = $('resumePreview');
        if (el) el.setAttribute('data-fontfamily', state.fontFamily);
        saveState();
      });
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

    /* Font family */
    var ffSel = $('fontFamilySelect');
    if (ffSel) ffSel.value = state.fontFamily || 'inter';
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
    initCoverLetter();
    initModeTabs();
    initParser();
    initATS();
    initImprover();
    initDNA();
    initPredictor();
    initVoice();
    initPortfolio();
    initSkillGap();
  }

  /* Run after DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ──────────────────────────────────────────────────────────────
   *  TEMPLATE: PROFESSIONAL  (clean corporate, left-accent rules)
   * ──────────────────────────────────────────────────────────── */
  function buildProfessionalHTML() {
    var p = state.personal;

    var cParts = [];
    if (p.email)    cParts.push(esc(p.email));
    if (p.phone)    cParts.push(esc(p.phone));
    if (p.location) cParts.push(esc(p.location));
    if (p.linkedin) cParts.push(esc(p.linkedin));
    if (p.website)  cParts.push(esc(p.website));
    var cBar = cParts.join('<span class="pro-sep"> · </span>');

    var body = '';

    if (state.summary) {
      body += '<div class="pro-section">' +
        '<h2 class="pro-heading">Professional Summary</h2>' +
        '<p class="pro-summary">' + esc(state.summary) + '</p>' +
      '</div>';
    }

    if (state.experience.length) {
      body += '<div class="pro-section"><h2 class="pro-heading">Experience</h2>';
      state.experience.forEach(function (exp) {
        var dates = exp.current
          ? esc(exp.startDate) + ' – Present'
          : esc(exp.startDate) + (exp.endDate ? ' – ' + esc(exp.endDate) : '');
        var company = [exp.company, exp.location].filter(Boolean).map(esc).join(' · ');
        body +=
          '<div class="pro-exp-entry">' +
            '<div class="pro-exp-hd">' +
              '<div>' +
                '<div class="pro-exp-title">' + esc(exp.jobTitle) + '</div>' +
                (company ? '<div class="pro-exp-co">' + company + '</div>' : '') +
              '</div>' +
              '<div class="pro-exp-dates">' + dates + '</div>' +
            '</div>' +
            buildBullets(exp.description, 'pro-bullets') +
          '</div>';
      });
      body += '</div>';
    }

    if (state.education.length) {
      body += '<div class="pro-section"><h2 class="pro-heading">Education</h2>';
      state.education.forEach(function (edu) {
        var school = [edu.institution, edu.location].filter(Boolean).map(esc).join(' · ');
        body +=
          '<div class="pro-edu-entry">' +
            '<div class="pro-edu-hd">' +
              '<div>' +
                '<div class="pro-edu-degree">' + esc(edu.degree) + '</div>' +
                (school ? '<div class="pro-edu-school">' + school + '</div>' : '') +
              '</div>' +
              '<div class="pro-edu-right">' +
                '<span class="pro-edu-year">' + esc(edu.year) + '</span>' +
                (edu.gpa ? '<span class="pro-edu-gpa"> · GPA ' + esc(edu.gpa) + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</div>';
      });
      body += '</div>';
    }

    if (state.skills.length) {
      body += '<div class="pro-section"><h2 class="pro-heading">Core Competencies</h2>' +
        '<div class="pro-skills-grid">';
      state.skills.forEach(function (sk) {
        var lvl = sk.level !== 'Intermediate' ? ' <span class="pro-skill-lvl">(' + esc(sk.level) + ')</span>' : '';
        body += '<div class="pro-skill-item"><span class="pro-skill-dot"></span>' +
          esc(sk.name) + lvl + '</div>';
      });
      body += '</div></div>';
    }

    if (state.projects.length) {
      body += '<div class="pro-section"><h2 class="pro-heading">Projects</h2>';
      state.projects.forEach(function (proj) {
        body +=
          '<div class="pro-proj-entry">' +
            '<div class="pro-proj-hd">' +
              '<span class="pro-proj-name">' + esc(proj.name) + '</span>' +
              (proj.techStack ? '<span class="pro-proj-stack">' + esc(proj.techStack) + '</span>' : '') +
              (proj.url ? '<span class="pro-proj-url">' + esc(proj.url) + '</span>' : '') +
            '</div>' +
            (proj.description ? '<div class="pro-proj-desc">' + esc(proj.description) + '</div>' : '') +
          '</div>';
      });
      body += '</div>';
    }

    if (state.certifications.length) {
      body += '<div class="pro-section"><h2 class="pro-heading">Certifications</h2>' +
        '<div class="pro-cert-list">';
      state.certifications.forEach(function (cert) {
        var sub = [cert.issuer, cert.year].filter(Boolean).map(esc).join(' · ');
        body += '<div class="pro-cert-item">' +
          '<span class="pro-cert-dot"></span>' +
          '<div><div class="pro-cert-name">' + esc(cert.name) + '</div>' +
          (sub ? '<div class="pro-cert-sub">' + sub + '</div>' : '') +
          '</div></div>';
      });
      body += '</div></div>';
    }

    return '<div class="tpl-professional">' +
      '<div class="pro-header">' +
        '<h1 class="pro-name">' + (esc(p.name) || 'Your Name') + '</h1>' +
        (p.jobTitle ? '<div class="pro-jobtitle">' + esc(p.jobTitle) + '</div>' : '') +
        (cBar ? '<div class="pro-contact-bar">' + cBar + '</div>' : '') +
      '</div>' +
      body +
    '</div>';
  }

  /* ──────────────────────────────────────────────────────────────
   *  TEMPLATE: EXECUTIVE  (label-column layout)
   * ──────────────────────────────────────────────────────────── */
  function buildExecutiveHTML() {
    var p = state.personal;

    var contactItems = '';
    if (p.email)    contactItems += execCI('Email',    p.email);
    if (p.phone)    contactItems += execCI('Phone',    p.phone);
    if (p.location) contactItems += execCI('Location', p.location);
    if (p.linkedin) contactItems += execCI('LinkedIn', p.linkedin);
    if (p.website)  contactItems += execCI('Website',  p.website);

    var body = '';

    if (state.summary) {
      body += execRow('Profile',
        '<p class="exec-summary">' + esc(state.summary) + '</p>');
    }

    if (state.experience.length) {
      var expContent = '';
      state.experience.forEach(function (exp) {
        var dates = exp.current
          ? esc(exp.startDate) + ' – Present'
          : esc(exp.startDate) + (exp.endDate ? ' – ' + esc(exp.endDate) : '');
        var company = [exp.company, exp.location].filter(Boolean).map(esc).join(', ');
        expContent +=
          '<div class="exec-exp-entry">' +
            '<div class="exec-exp-hd">' +
              '<span class="exec-exp-title">' + esc(exp.jobTitle) + '</span>' +
              '<span class="exec-exp-dates">' + dates + '</span>' +
            '</div>' +
            (company ? '<div class="exec-exp-co">' + company + '</div>' : '') +
            buildBullets(exp.description, 'exec-bullets') +
          '</div>';
      });
      body += execRow('Experience', expContent);
    }

    if (state.education.length) {
      var eduContent = '';
      state.education.forEach(function (edu) {
        var school = [edu.institution, edu.location].filter(Boolean).map(esc).join(', ');
        eduContent +=
          '<div class="exec-edu-entry">' +
            '<div class="exec-edu-hd">' +
              '<span class="exec-edu-degree">' + esc(edu.degree) + '</span>' +
              '<span class="exec-edu-year">' + esc(edu.year) + '</span>' +
            '</div>' +
            (school ? '<div class="exec-edu-school">' + school + '</div>' : '') +
          '</div>';
      });
      body += execRow('Education', eduContent);
    }

    if (state.skills.length) {
      var skillsContent = '<div class="exec-skills-wrap">';
      state.skills.forEach(function (sk) {
        var cls = sk.level === 'Expert' ? ' exec-sk-expert' : sk.level === 'Beginner' ? ' exec-sk-beginner' : '';
        skillsContent += '<span class="exec-skill' + cls + '">' + esc(sk.name) + '</span>';
      });
      skillsContent += '</div>';
      body += execRow('Skills', skillsContent);
    }

    if (state.projects.length) {
      var projContent = '';
      state.projects.forEach(function (proj) {
        projContent +=
          '<div class="exec-proj-entry">' +
            '<span class="exec-proj-name">' + esc(proj.name) + '</span>' +
            (proj.techStack ? '<span class="exec-proj-stack"> — ' + esc(proj.techStack) + '</span>' : '') +
            (proj.url ? '<span class="exec-proj-url"> · ' + esc(proj.url) + '</span>' : '') +
            (proj.description ? '<div class="exec-proj-desc">' + esc(proj.description) + '</div>' : '') +
          '</div>';
      });
      body += execRow('Projects', projContent);
    }

    if (state.certifications.length) {
      var certContent = '';
      state.certifications.forEach(function (cert) {
        certContent += '<div class="exec-cert-item">' +
          '<span class="exec-cert-name">' + esc(cert.name) + '</span>' +
          (cert.issuer ? '<span class="exec-cert-issuer"> · ' + esc(cert.issuer) + '</span>' : '') +
          (cert.year   ? '<span class="exec-cert-year"> · ' + esc(cert.year) + '</span>' : '') +
        '</div>';
      });
      body += execRow('Certifications', certContent);
    }

    return '<div class="tpl-executive">' +
      '<div class="exec-header">' +
        '<div class="exec-header-left">' +
          '<h1 class="exec-name">' + (esc(p.name) || 'Your Name') + '</h1>' +
          (p.jobTitle ? '<div class="exec-jobtitle">' + esc(p.jobTitle) + '</div>' : '') +
        '</div>' +
        (contactItems ? '<div class="exec-header-right">' + contactItems + '</div>' : '') +
      '</div>' +
      '<div class="exec-body">' + body + '</div>' +
    '</div>';
  }

  function execRow(label, content) {
    return '<div class="exec-row">' +
      '<div class="exec-label">' + label + '</div>' +
      '<div class="exec-content">' + content + '</div>' +
    '</div>';
  }

  function execCI(label, text) {
    return '<div class="exec-c-item">' +
      '<span class="exec-c-label">' + label + '</span>' +
      '<span>' + esc(text) + '</span>' +
    '</div>';
  }

  /* ──────────────────────────────────────────────────────────────
   *  RESUME STRENGTH METER
   * ──────────────────────────────────────────────────────────── */
  function updateStrengthMeter() {
    var fill = $('strengthFill');
    var pct  = $('strengthPct');
    var tips = $('strengthTips');
    if (!fill || !pct) return;

    var score   = 0;
    var missing = [];
    var p = state.personal;

    /* Personal — 28 pts */
    if (p.name)     score += 8; else missing.push('Add your full name');
    if (p.email)    score += 6; else missing.push('Add email address');
    if (p.phone)    score += 4; else missing.push('Add phone number');
    if (p.location) score += 4; else missing.push('Add location');
    if (p.jobTitle) score += 4; else missing.push('Add job title');
    if (p.linkedin) score += 1;
    if (p.website)  score += 1;

    /* Summary — 10 pts */
    if (state.summary && state.summary.length > 60)       score += 10;
    else if (state.summary && state.summary.length > 0)   score += 5;
    else missing.push('Add a professional summary');

    /* Experience — 25 pts */
    if (state.experience.length >= 2)       score += 25;
    else if (state.experience.length === 1) score += 14;
    else missing.push('Add work experience');

    /* Education — 15 pts */
    if (state.education.length >= 1) score += 15;
    else missing.push('Add education');

    /* Skills — 15 pts */
    if (state.skills.length >= 5)       score += 15;
    else if (state.skills.length >= 2)  score += 8;
    else if (state.skills.length === 1) score += 4;
    else missing.push('Add at least 5 skills');

    /* Projects — 7 pts */
    if (state.projects.length >= 1) score += 7;
    else missing.push('Add a project');

    score = Math.min(score, 100);

    fill.style.width = score + '%';
    fill.className = 'rc-strength-fill' +
      (score >= 85 ? ' great' : score >= 65 ? ' good' : score >= 40 ? ' ok' : ' weak');
    pct.textContent = score + '%';
    pct.className = 'rc-strength-pct' +
      (score >= 85 ? ' great' : score >= 65 ? ' good' : score >= 40 ? ' ok' : ' weak');

    if (tips) {
      var tipHTML = missing.slice(0, 2).map(function (t) {
        return '<span class="rc-strength-tip">💡 ' + t + '</span>';
      }).join('');
      tips.innerHTML = tipHTML;
    }
  }

  /* ──────────────────────────────────────────────────────────────
   *  COVER LETTER
   * ──────────────────────────────────────────────────────────── */
  var CL_STORAGE_KEY = 'resumecraft_cl';

  function clDefaultState() {
    return {
      recipientName: '', recipientTitle: '', company: '',
      companyAddress: '', position: '', jobRef: '',
      tone: 'professional',
      opening: '', body1: '', body2: '', body3: '', closing: ''
    };
  }

  var clState = clDefaultState();

  function saveCLState() {
    try { localStorage.setItem(CL_STORAGE_KEY, JSON.stringify(clState)); } catch (e) {}
    var badge = $('clSaveBadge');
    if (badge) {
      badge.textContent = 'Saving…';
      badge.style.color = '#f59e0b';
      setTimeout(function () {
        badge.textContent = '✓ Saved';
        badge.style.color = '#10b981';
      }, 450);
    }
  }

  function loadCLState() {
    try {
      var raw = localStorage.getItem(CL_STORAGE_KEY);
      if (raw) clState = Object.assign(clDefaultState(), JSON.parse(raw));
    } catch (e) { clState = clDefaultState(); }
  }

  var CL_META_FIELDS = [
    { id: 'cl-recipientName',  key: 'recipientName',  label: 'Hiring Manager Name',   ph: 'e.g. Sarah Johnson',        half: true },
    { id: 'cl-recipientTitle', key: 'recipientTitle', label: 'Their Title',            ph: 'e.g. Engineering Manager',  half: true },
    { id: 'cl-company',        key: 'company',        label: 'Company Name',           ph: 'e.g. Acme Corp',            half: true },
    { id: 'cl-companyAddress', key: 'companyAddress', label: 'Company Address',        ph: 'e.g. 123 Main St, NY 10001',half: true },
    { id: 'cl-position',       key: 'position',       label: 'Position Applied For',   ph: 'e.g. Senior Software Engineer', half: true },
    { id: 'cl-jobRef',         key: 'jobRef',         label: 'Job Reference # (opt.)', ph: 'e.g. JR-1234',              half: true }
  ];

  var CL_PARAGRAPHS = [
    { id: 'cl-opening', key: 'opening', label: '✍️ Opening Paragraph',  rows: 4, ph: 'I am writing to express my interest in the [position] role…' },
    { id: 'cl-body1',   key: 'body1',   label: '💼 Experience Highlight', rows: 5, ph: 'With X years of experience in…' },
    { id: 'cl-body2',   key: 'body2',   label: '⚡ Skills & Strengths',   rows: 5, ph: 'My core competencies include…' },
    { id: 'cl-body3',   key: 'body3',   label: '🎯 Company Fit & Value',  rows: 4, ph: 'I am particularly drawn to [company] because…' },
    { id: 'cl-closing', key: 'closing', label: '🤝 Closing Statement',    rows: 3, ph: 'I would welcome the opportunity to discuss how I can contribute…' }
  ];

  function buildCLEditor() {
    var container = $('clSections');
    if (!container) return;

    /* ── Section 01: Job & Recipient ── */
    var html = clSection('01', '📋', 'Job &amp; Recipient Details', 'job',
      (function () {
        var s = '';
        for (var i = 0; i < CL_META_FIELDS.length; i += 2) {
          s += '<div class="rc-form-row">';
          s += clTextField(CL_META_FIELDS[i]);
          if (CL_META_FIELDS[i + 1]) s += clTextField(CL_META_FIELDS[i + 1]);
          s += '</div>';
        }
        return s;
      }())
    );

    /* ── Section 02: Tone & Auto-fill ── */
    html += clSection('02', '🎨', 'Tone &amp; Auto-Fill', 'tone',
      '<div class="rc-field">' +
        '<label class="rc-label">Letter Tone</label>' +
        '<div class="cl-tone-btns" id="clToneBtns">' +
          ['professional','enthusiastic','concise'].map(function (t) {
            return '<button class="rc-ctrl-btn' + (clState.tone === t ? ' active' : '') +
              '" data-tone="' + t + '">' +
              (t === 'professional' ? '🎩 Professional' : t === 'enthusiastic' ? '🔥 Enthusiastic' : '⚡ Concise') +
              '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<button class="cl-autofill-btn" id="clAutoFillBtn" type="button">' +
        '✨ Auto-Fill from Resume Data' +
      '</button>' +
      '<p class="cl-autofill-note">Generates a complete letter based on your resume. You can edit it freely.</p>'
    );

    /* ── Section 03: Letter Content ── */
    var paraHTML = '';
    CL_PARAGRAPHS.forEach(function (para) {
      paraHTML += '<div class="rc-field">' +
        '<label class="rc-label">' + para.label + '</label>' +
        '<textarea class="rc-textarea cl-textarea" id="' + para.id + '" rows="' + para.rows + '" ' +
          'data-cl-key="' + para.key + '" ' +
          'placeholder="' + esc(para.ph) + '">' + esc(clState[para.key] || '') + '</textarea>' +
        '</div>';
    });
    html += clSection('03', '✍️', 'Letter Content', 'content', paraHTML);

    container.innerHTML = html;
  }

  function clSection(num, icon, title, bodyId, bodyHTML) {
    return '<div class="rc-section">' +
      '<button class="rc-section-toggle" data-cl-toggle="' + bodyId + '" type="button">' +
        '<span class="rc-sec-num">' + num + '</span>' +
        '<span class="rc-sec-icon">' + icon + '</span>' +
        '<span class="rc-sec-title">' + title + '</span>' +
        '<span class="rc-sec-chev">▾</span>' +
      '</button>' +
      '<div class="rc-section-body" id="cl-body-' + bodyId + '">' +
        bodyHTML +
      '</div>' +
    '</div>';
  }

  function clTextField(meta) {
    return '<div class="rc-field">' +
      '<label class="rc-label">' + meta.label + '</label>' +
      '<input class="rc-input" type="text" id="' + meta.id + '" ' +
        'data-cl-key="' + meta.key + '" ' +
        'value="' + esc(clState[meta.key] || '') + '" ' +
        'placeholder="' + esc(meta.ph) + '">' +
    '</div>';
  }

  var updateCLPreview = debounce(function () {
    var el = $('clLetterPreview');
    if (!el) return;
    el.innerHTML = buildCLHTML();
  }, 150);

  function buildCLHTML() {
    var p = state.personal;
    var cl = clState;

    /* Date */
    var today = new Date();
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    var dateStr = months[today.getMonth()] + ' ' + today.getDate() + ', ' + today.getFullYear();

    /* Sender header */
    var senderHTML = '';
    if (p.name)     senderHTML += '<div class="cl-sender-name">' + esc(p.name) + '</div>';
    if (p.jobTitle) senderHTML += '<div class="cl-sender-title">' + esc(p.jobTitle) + '</div>';
    var cParts = [p.email, p.phone, p.location].filter(Boolean).map(esc);
    if (cParts.length) senderHTML += '<div class="cl-sender-contact">' + cParts.join(' · ') + '</div>';
    if (p.linkedin || p.website) {
      var links = [p.linkedin, p.website].filter(Boolean).map(esc);
      senderHTML += '<div class="cl-sender-contact">' + links.join(' · ') + '</div>';
    }

    /* Recipient block */
    var recipHTML = '<div class="cl-date">' + dateStr + '</div>';
    if (cl.recipientName || cl.company) {
      recipHTML += '<div class="cl-recipient">';
      if (cl.recipientName)    recipHTML += '<div>' + esc(cl.recipientName) + '</div>';
      if (cl.recipientTitle)   recipHTML += '<div>' + esc(cl.recipientTitle) + '</div>';
      if (cl.company)          recipHTML += '<div>' + esc(cl.company) + '</div>';
      if (cl.companyAddress)   recipHTML += '<div>' + esc(cl.companyAddress) + '</div>';
      recipHTML += '</div>';
    }

    /* Salutation */
    var salutation = cl.recipientName
      ? 'Dear ' + esc(cl.recipientName) + ','
      : 'Dear Hiring Manager,';

    /* Body paragraphs */
    var bodyHTML = '';
    ['opening','body1','body2','body3','closing'].forEach(function (k) {
      if (cl[k]) bodyHTML += '<p class="cl-para">' + esc(cl[k]).replace(/\n/g, '<br>') + '</p>';
    });
    if (!bodyHTML) {
      bodyHTML = '<p class="cl-para cl-placeholder">Use the editor on the left to write your cover letter, or click "✨ Auto-Fill from Resume Data" to generate a complete draft.</p>';
    }

    return '<div class="tpl-coverletter">' +
      '<div class="cl-header">' +
        '<div class="cl-header-stripe"></div>' +
        '<div class="cl-header-body">' + senderHTML + '</div>' +
      '</div>' +
      '<div class="cl-body">' +
        recipHTML +
        '<div class="cl-salutation">' + salutation + '</div>' +
        bodyHTML +
        '<div class="cl-sign">' +
          '<div>Sincerely,</div>' +
          (p.name ? '<div class="cl-sign-name">' + esc(p.name) + '</div>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Auto-fill: generate letter text from resume data ── */
  function autoFillCoverLetter() {
    var p = state.personal;
    var tone = clState.tone || 'professional';
    var company  = clState.company  || '[Company Name]';
    var position = clState.position || p.jobTitle || '[Position]';

    var topSkills = state.skills.slice(0, 3).map(function (s) { return s.name; });
    var skillList = topSkills.length ? topSkills.join(', ') : 'my technical expertise';

    var latestExp = state.experience[0];
    var expYears  = state.experience.length;
    var expIntro  = latestExp
      ? 'In my most recent role as ' + (latestExp.jobTitle || 'a professional') +
        (latestExp.company ? ' at ' + latestExp.company : '') + ', I '
      : 'Throughout my career, I have ';

    var openings = {
      professional: 'I am writing to express my strong interest in the ' + position + ' position at ' + company + '. With ' + (expYears > 1 ? expYears + ' years of progressive experience' : 'dedicated experience') + ' in ' + (p.jobTitle || 'the field') + ', I am confident that my background and skills align well with your requirements.',
      enthusiastic: 'I am thrilled to apply for the ' + position + ' role at ' + company + '! Your company\'s innovative approach has genuinely impressed me, and I am excited by the prospect of contributing my skills to such a dynamic team.',
      concise:      'I am applying for the ' + position + ' position at ' + company + '. My ' + (expYears > 1 ? expYears + '-year' : '') + ' background in ' + (p.jobTitle || 'the field') + ' makes me a strong candidate for this role.'
    };

    var body1s = {
      professional: expIntro + 'built a strong foundation with hands-on experience delivering impactful results. I have consistently demonstrated the ability to manage complex challenges while collaborating effectively with cross-functional teams to achieve strategic objectives.',
      enthusiastic: expIntro + 'had the incredible opportunity to work on exciting projects that have truly shaped my skills! I am passionate about ' + (p.jobTitle || 'my field') + ' and bring an infectious energy and drive to everything I do.',
      concise:      expIntro + 'delivered measurable results in ' + (p.jobTitle || 'my area of expertise') + '. I focus on execution and have a track record of meeting and exceeding expectations.'
    };

    var body2s = {
      professional: 'My core competencies include ' + skillList + ', which have been instrumental in my professional success. I am committed to continuous learning and ensuring my skill set remains current with industry best practices and emerging technologies.',
      enthusiastic: 'I am especially skilled in ' + skillList + ' — areas I am genuinely passionate about. I love diving deep into challenging problems and am always looking for new ways to grow and improve. My team would describe me as resourceful, driven, and a great collaborator!',
      concise:      'Key skills: ' + skillList + '. I apply these competencies pragmatically to deliver quality results on schedule and within scope.'
    };

    var body3s = {
      professional: 'I am particularly drawn to ' + company + ' because of your commitment to excellence and innovation. I believe my values and professional approach align strongly with your culture, and I am eager to bring my expertise to contribute to your continued success.',
      enthusiastic: 'What excites me most about ' + company + ' is the amazing impact you are making in the industry! I would love nothing more than to channel my enthusiasm and skills into helping your team reach new heights. I am ready to hit the ground running!',
      concise:      'I see a strong alignment between my experience and ' + company + '\'s needs. I am confident I can add immediate value to your team.'
    };

    var closings = {
      professional: 'I would welcome the opportunity to discuss how my background and skills can benefit ' + company + '. Thank you for considering my application. I look forward to the possibility of speaking with you and am reachable at ' + (p.email || 'the contact details above') + '.',
      enthusiastic: 'I would absolutely love to connect and discuss this exciting opportunity further! Please feel free to reach out at ' + (p.email || 'the contact information above') + '. Thank you so much for your time — I truly cannot wait to hear from you!',
      concise:      'Thank you for your consideration. I am available for an interview at your convenience. Contact: ' + (p.email || '') + (p.phone ? ' · ' + p.phone : '') + '.'
    };

    clState.opening = openings[tone] || openings.professional;
    clState.body1   = body1s[tone]   || body1s.professional;
    clState.body2   = body2s[tone]   || body2s.professional;
    clState.body3   = body3s[tone]   || body3s.professional;
    clState.closing = closings[tone] || closings.professional;

    /* Update textareas in DOM */
    CL_PARAGRAPHS.forEach(function (para) {
      var ta = $(para.id);
      if (ta) ta.value = clState[para.key] || '';
    });

    saveCLState();
    updateCLPreview();
  }

  function bindCLEditor() {
    var clSec = $('clSections');
    if (!clSec) return;

    clSec.addEventListener('input', function (e) {
      var key = e.target.dataset.clKey;
      if (!key) return;
      clState[key] = e.target.value;
      saveCLState();
      updateCLPreview();
    });

    clSec.addEventListener('change', function (e) {
      var key = e.target.dataset.clKey;
      if (!key) return;
      clState[key] = e.target.value;
      saveCLState();
      updateCLPreview();
    });

    clSec.addEventListener('click', function (e) {
      /* Accordion toggle */
      var toggle = e.target.closest('[data-cl-toggle]');
      if (toggle && !e.target.closest('[data-tone]')) {
        var bodyEl = $('cl-body-' + toggle.dataset.clToggle);
        if (bodyEl) {
          var hidden = bodyEl.classList.toggle('hidden');
          toggle.classList.toggle('collapsed', hidden);
        }
        return;
      }
      /* Tone buttons */
      var toneBtn = e.target.closest('[data-tone]');
      if (toneBtn) {
        clState.tone = toneBtn.dataset.tone;
        var toneBtns = $('clToneBtns');
        if (toneBtns) {
          toneBtns.querySelectorAll('.rc-ctrl-btn').forEach(function (b) {
            b.classList.toggle('active', b === toneBtn);
          });
        }
        saveCLState();
        return;
      }
    });

    var afBtn = $('clAutoFillBtn');
    if (afBtn) afBtn.addEventListener('click', autoFillCoverLetter);
  }

  function initCoverLetter() {
    loadCLState();
    buildCLEditor();
    bindCLEditor();
    updateCLPreview();
  }

  /* ──────────────────────────────────────────────────────────────
   *  MODE TABS  (Resume / Cover Letter / 8 new tools)
   * ──────────────────────────────────────────────────────────── */
  var currentMode = 'resume';

  var MODE_LAYOUT_MAP = {
    'resume':      'resumeLayout',
    'coverletter': 'clLayout',
    'parser':      'parserLayout',
    'ats':         'atsLayout',
    'improver':    'improverLayout',
    'dna':         'dnaLayout',
    'predictor':   'predictorLayout',
    'voice':       'voiceLayout',
    'portfolio':   'portfolioLayout',
    'skillgap':    'skillGapLayout'
  };

  function switchMode(mode) {
    currentMode = mode;
    var activeId = MODE_LAYOUT_MAP[mode];

    Object.keys(MODE_LAYOUT_MAP).forEach(function (m) {
      var el = $(MODE_LAYOUT_MAP[m]);
      if (el) el.classList.toggle('hidden', MODE_LAYOUT_MAP[m] !== activeId);
    });

    var modeTabs = $('modeTabs');
    if (modeTabs) {
      modeTabs.querySelectorAll('.rc-mode-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
    }

    var resumeCtrls = document.querySelectorAll('.rc-resume-ctrl');
    resumeCtrls.forEach(function (el) {
      el.style.display = (mode === 'resume') ? '' : 'none';
    });

    if (mode === 'coverletter') updateCLPreview();
  }

  function initModeTabs() {
    var modeTabs = $('modeTabs');
    if (!modeTabs) return;
    modeTabs.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-mode]');
      if (btn) switchMode(btn.dataset.mode);
    });
  }

  /* ══════════════════════════════════════════════════════════════
   *  FEATURE 1 — RESUME PARSER
   * ══════════════════════════════════════════════════════════════ */
  function initParser() {
    if (typeof window.pdfjsLib !== 'undefined') {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    var btn       = $('btnUpload');
    var fileInput = $('resumeFile');
    var zone      = $('uploadZone');

    if (btn && fileInput) {
      btn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'txt') { parseTxtFile(file); }
        else if (ext === 'pdf') { parsePdfFile(file); }
        else { setParserStatus('Unsupported file type. Please use .txt or .pdf', 'error'); }
        fileInput.value = '';
      });
    }

    if (zone) {
      zone.addEventListener('dragover', function (e) {
        e.preventDefault();
        zone.classList.add('dragover');
      });
      zone.addEventListener('dragleave', function () {
        zone.classList.remove('dragover');
      });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('dragover');
        var file = e.dataTransfer.files[0];
        if (!file) return;
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'txt') { parseTxtFile(file); }
        else if (ext === 'pdf') { parsePdfFile(file); }
      });
    }
  }

  function parseTxtFile(file) {
    setParserStatus('Reading file…', 'info');
    var reader = new FileReader();
    reader.onload = function (e) { parseResumeText(e.target.result); };
    reader.onerror = function () { setParserStatus('Error reading file.', 'error'); };
    reader.readAsText(file);
  }

  function parsePdfFile(file) {
    setParserStatus('Extracting text from PDF…', 'info');
    var reader = new FileReader();
    reader.onload = function (e) {
      if (typeof window.pdfjsLib === 'undefined') {
        setParserStatus('PDF library not loaded. Please try a .txt file.', 'error');
        return;
      }
      var loadingTask = window.pdfjsLib.getDocument({ data: e.target.result });
      loadingTask.promise.then(function (pdf) {
        var promises = [];
        for (var i = 1; i <= pdf.numPages; i++) {
          promises.push(
            pdf.getPage(i).then(function (page) {
              return page.getTextContent().then(function (c) {
                return c.items.map(function (it) { return it.str; }).join(' ');
              });
            })
          );
        }
        Promise.all(promises).then(function (pages) {
          parseResumeText(pages.join('\n'));
        });
      }).catch(function () {
        setParserStatus('Could not parse PDF. Try saving your resume as plain text (.txt) first.', 'error');
      });
    };
    reader.readAsArrayBuffer(file);
  }

  function setParserStatus(msg, type) {
    var el = $('parserStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'rc-parser-status rc-parser-status--' + type;
    el.classList.remove('hidden');
  }

  function parseResumeText(text) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var extracted = { name:'', email:'', phone:'', location:'', linkedin:'', website:'', summary:'', skills:[] };

    var emailMatch = text.match(/[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) extracted.email = emailMatch[0];

    var phoneMatch = text.match(/(\+?[\d][\d\s\-().]{6,}\d)/);
    if (phoneMatch) extracted.phone = phoneMatch[1].replace(/\s{2,}/g, ' ').trim();

    var liMatch = text.match(/linkedin\.com\/in\/[\w\-]+/i);
    if (liMatch) extracted.linkedin = liMatch[0];

    var webMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[\w\-]+\.(?:com|io|dev|me|co|net|org)(?:\/[\w\-]*)?/i);
    if (webMatch && !webMatch[0].toLowerCase().includes('linkedin')) extracted.website = webMatch[0];

    for (var i = 0; i < Math.min(5, lines.length); i++) {
      if (!lines[i].match(/[@/\\()\d|·•:]/)) { extracted.name = lines[i]; break; }
    }

    var sectionRe = {
      summary:    /^(summary|profile|objective|about\s*me|professional\s*summary)/i,
      skills:     /^(skills?|technical\s*skills?|core\s*competenc|key\s*skills?|technologies)/i,
      experience: /^(experience|work\s*experience|employment|work\s*history|professional\s*experience)/i
    };
    var curSec = null;
    var secContent = { summary:[], skills:[], experience:[] };
    lines.forEach(function (line) {
      for (var sec in sectionRe) {
        if (sectionRe[sec].test(line) && line.length < 45) { curSec = sec; return; }
      }
      if (curSec && secContent[curSec]) secContent[curSec].push(line);
    });

    if (secContent.summary.length) extracted.summary = secContent.summary.slice(0, 4).join(' ').slice(0, 250);

    var skillsText = secContent.skills.join(', ');
    extracted.skills = skillsText.split(/[,•|\n\/]/)
      .map(function (s) { return s.replace(/^\s*[-–]\s*/, '').trim(); })
      .filter(function (s) { return s.length > 1 && s.length < 35; })
      .slice(0, 20);

    showParserPreview(extracted);
  }

  function showParserPreview(data) {
    var container = $('parserPreview');
    if (!container) return;
    var skillsPrev = data.skills.slice(0, 5).join(', ') + (data.skills.length > 5 ? '…' : '');
    var count = ['name','email','phone','linkedin','website','summary'].filter(function (k) { return data[k]; }).length + (data.skills.length ? 1 : 0);

    container.innerHTML =
      '<div class="rc-parser-found">' +
        '<h3 class="rc-parser-found-title">✅ ' + count + ' fields extracted</h3>' +
        (data.name     ? pRow('Name',      data.name)    : '') +
        (data.email    ? pRow('Email',     data.email)   : '') +
        (data.phone    ? pRow('Phone',     data.phone)   : '') +
        (data.linkedin ? pRow('LinkedIn',  data.linkedin): '') +
        (data.website  ? pRow('Website',   data.website) : '') +
        (data.summary  ? pRow('Summary',   data.summary.slice(0, 100) + (data.summary.length > 100 ? '…' : '')) : '') +
        (data.skills.length ? pRow('Skills (' + data.skills.length + ')', skillsPrev) : '') +
      '</div>' +
      '<div class="rc-parser-actions">' +
        '<button class="rc-btn-primary" id="btnApplyParsed" type="button">✅ Apply to Resume Editor</button>' +
        '<button class="rc-btn-secondary" id="btnDiscardParsed" type="button">✕ Discard</button>' +
      '</div>';
    container.classList.remove('hidden');
    setParserStatus('Review the extracted data, then click Apply.', 'success');

    container._parsedData = data;
    $('btnApplyParsed').addEventListener('click', function () { applyParsedData(container._parsedData); });
    $('btnDiscardParsed').addEventListener('click', function () {
      container.classList.add('hidden');
      $('parserStatus').classList.add('hidden');
    });
  }

  function pRow(label, value) {
    return '<div class="rc-prow"><span class="rc-prow-label">' + esc(label) + '</span><span class="rc-prow-value">' + esc(value) + '</span></div>';
  }

  function applyParsedData(data) {
    var personalMap = { name:'name', email:'email', phone:'phone', linkedin:'linkedin', website:'website' };
    Object.keys(personalMap).forEach(function (k) {
      if (data[k]) {
        state.personal[k] = data[k];
        var el = $('f-personal-' + k);
        if (el) el.value = data[k];
      }
    });
    if (data.summary) {
      state.summary = data.summary;
      var ta = $('summaryTA');
      if (ta) { ta.value = data.summary; updateSummaryCount(); }
    }
    if (data.skills.length) {
      data.skills.forEach(function (name) {
        if (!name) return;
        var exists = false;
        for (var i = 0; i < state.skills.length; i++) {
          if (state.skills[i].name.toLowerCase() === name.toLowerCase()) { exists = true; break; }
        }
        if (!exists) state.skills.push({ id: uid(), name: name, level: 'Intermediate' });
      });
      renderSkillsChips();
    }
    saveState();
    updatePreview();
    setParserStatus('✅ Data applied! Switch to the Resume tab to review.', 'success');
    var prev = $('parserPreview');
    if (prev) prev.classList.add('hidden');
  }

  /* ══════════════════════════════════════════════════════════════
   *  FEATURE 2 + 6 — ATS SCORE CALCULATOR & JD TAILORING
   * ══════════════════════════════════════════════════════════════ */
  var STOPWORDS = (function () {
    var sw = 'a an the and or but in on at to for of with by from as is was are were be been being have has had do does did will would could should may might shall can need must am i my we our you your they their it its this that these those not no nor so yet both either neither each few more most some such than then there when where while who which what all any about up out if how her him his she he us them into over also just now only even still get very new first last between back through during since before after under per etc ie eg'.split(' ');
    var set = {};
    sw.forEach(function (w) { set[w] = true; });
    return set;
  }());

  function getKeywords(text) {
    return (text || '').toLowerCase()
      .replace(/[^a-z0-9+#.\-\s]/g, ' ')
      .split(/\s+/)
      .filter(function (w) { return w.length > 2 && !STOPWORDS[w]; });
  }

  function getResumeText() {
    var p = state.personal;
    var parts = [p.name, p.jobTitle, p.location, state.summary];
    state.experience.forEach(function (e) { parts.push(e.jobTitle, e.company, e.description); });
    state.education.forEach(function (e) { parts.push(e.degree, e.institution); });
    state.skills.forEach(function (s) { parts.push(s.name); });
    state.projects.forEach(function (pr) { parts.push(pr.name, pr.techStack, pr.description); });
    state.certifications.forEach(function (c) { parts.push(c.name, c.issuer); });
    return parts.filter(Boolean).join(' ');
  }

  function initATS() {
    var btn = $('btnATSAnalyze');
    if (btn) btn.addEventListener('click', calcATSScore);

    var jdEl = $('atsJD');
    if (jdEl) {
      jdEl.addEventListener('input', debounce(function () {
        var cc = $('atsJDCount');
        if (cc) cc.textContent = jdEl.value.length + ' chars';
      }, 100));
    }
  }

  function calcATSScore() {
    var jdEl = $('atsJD');
    if (!jdEl) return;
    var jdText = jdEl.value.trim();
    if (!jdText) {
      $('atsResults').innerHTML = '<p class="rc-tool-hint">Paste a job description and click Analyze.</p>';
      return;
    }

    var jdWords = getKeywords(jdText);
    var resumeSet = {};
    getKeywords(getResumeText()).forEach(function (w) { resumeSet[w] = true; });

    var freq = {};
    jdWords.forEach(function (w) { freq[w] = (freq[w] || 0) + 1; });
    var jdKeywords = Object.keys(freq)
      .sort(function (a, b) { return freq[b] - freq[a]; })
      .slice(0, 30);

    var matched = jdKeywords.filter(function (k) { return resumeSet[k]; });
    var missing = jdKeywords.filter(function (k) { return !resumeSet[k]; });
    var score = Math.round((matched.length / Math.max(jdKeywords.length, 1)) * 100);
    window._atsScore = score;

    var cls   = score >= 75 ? 'great' : score >= 50 ? 'good' : score >= 30 ? 'ok' : 'weak';
    var label = score >= 75 ? 'Excellent Match' : score >= 50 ? 'Good Match' : score >= 30 ? 'Fair Match' : 'Needs Work';

    var html =
      '<div class="ats-score-wrap">' +
        '<div class="ats-score-circle ' + cls + '">' +
          '<span class="ats-sn">' + score + '</span><span class="ats-sp">%</span>' +
        '</div>' +
        '<div class="ats-score-info">' +
          '<div class="ats-score-label ' + cls + '">' + label + '</div>' +
          '<div class="ats-score-sub">Matched ' + matched.length + ' of ' + jdKeywords.length + ' keywords</div>' +
        '</div>' +
      '</div>' +
      '<div class="ats-bar-wrap"><div class="ats-bar-track"><div class="ats-bar-fill ' + cls + '" style="width:' + score + '%"></div></div></div>';

    if (matched.length) {
      html += '<div class="ats-kw-sec"><h4 class="ats-kw-hd ats-matched">✅ Matched (' + matched.length + ')</h4>' +
        '<div class="ats-chips">' + matched.map(function (k) { return '<span class="ats-chip matched">' + esc(k) + '</span>'; }).join('') + '</div></div>';
    }
    if (missing.length) {
      html += '<div class="ats-kw-sec"><h4 class="ats-kw-hd ats-missing">❌ Missing (' + missing.length + ')</h4>' +
        '<div class="ats-chips">' + missing.map(function (k) { return '<span class="ats-chip missing">' + esc(k) + '</span>'; }).join('') + '</div>' +
        '<button class="rc-btn-primary ats-insert-btn" id="btnInsertKW" type="button">⚡ Insert Missing Keywords into Skills</button>' +
        '</div>';
    }

    $('atsResults').innerHTML = html;

    var insertBtn = $('btnInsertKW');
    if (insertBtn) {
      insertBtn.addEventListener('click', function () {
        missing.forEach(function (kw) {
          var exists = false;
          for (var i = 0; i < state.skills.length; i++) {
            if (state.skills[i].name.toLowerCase() === kw.toLowerCase()) { exists = true; break; }
          }
          if (!exists) state.skills.push({ id: uid(), name: kw, level: 'Intermediate' });
        });
        renderSkillsChips();
        saveState();
        updatePreview();
        insertBtn.textContent = '✅ Keywords added to Skills!';
        insertBtn.disabled = true;
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════
   *  FEATURE 3 + 4 — AI RESUME IMPROVER & WEAKNESS ANALYZER
   * ══════════════════════════════════════════════════════════════ */
  var WEAK_MAP = {
    'worked on':           'Developed',
    'worked with':         'Collaborated with',
    'helped with':         'Contributed to',
    'helped to':           'Enabled',
    'helped':              'Assisted',
    'was responsible for': 'Managed',
    'responsible for':     'Led',
    'assisted with':       'Supported',
    'assisted in':         'Facilitated',
    'was part of':         'Participated in',
    'participated in':     'Contributed to',
    'used':                'Leveraged',
    'tried to':            'Achieved',
    'made':                'Delivered',
    'did work on':         'Engineered',
    'was involved in':     'Drove'
  };

  var GENERIC_PHRASES = [
    'team player','hard worker','fast learner','go-getter',
    'detail-oriented','self-starter','results-oriented',
    'think outside the box','synergy','dynamic','proactive'
  ];

  var POWER_VERBS = [
    'Accelerated','Achieved','Architected','Automated','Built',
    'Championed','Created','Delivered','Designed','Developed',
    'Directed','Drove','Eliminated','Engineered','Enhanced',
    'Executed','Generated','Grew','Implemented','Improved',
    'Increased','Launched','Led','Managed','Modernized',
    'Optimized','Overhauled','Pioneered','Reduced','Refactored',
    'Scaled','Shipped','Simplified','Spearheaded','Streamlined',
    'Transformed','Unified','Accelerated','Validated','Won'
  ];

  function initImprover() {
    var btn = $('btnAnalyzeResume');
    if (btn) btn.addEventListener('click', analyzeResume);
  }

  function analyzeResume() {
    var issues = [];
    var suggestions = [];

    var allBullets = [];
    state.experience.forEach(function (exp) {
      if (!exp.description) return;
      exp.description.split('\n').forEach(function (line) {
        var t = line.replace(/^[\s•\-*]+/, '').trim();
        if (t) allBullets.push({ text: t, source: exp.jobTitle || 'Experience' });
      });
    });

    allBullets.forEach(function (bullet) {
      var lower = bullet.text.toLowerCase();
      for (var phrase in WEAK_MAP) {
        if (lower.indexOf(phrase) !== -1) {
          suggestions.push({ original: bullet.text, phrase: phrase, replacement: WEAK_MAP[phrase], source: bullet.source });
          break;
        }
      }
    });

    var bulletsNoMetrics = allBullets.filter(function (b) { return !/\d/.test(b.text); });
    if (bulletsNoMetrics.length > 2) {
      issues.push({ severity: 'warning', message: bulletsNoMetrics.length + ' experience bullets lack numbers or metrics (%, $, counts).', examples: bulletsNoMetrics.slice(0, 2).map(function (b) { return b.text; }) });
    }

    var fullText = (state.summary + ' ' + state.experience.map(function (e) { return e.description || ''; }).join(' ')).toLowerCase();
    var foundGeneric = GENERIC_PHRASES.filter(function (p) { return fullText.indexOf(p.toLowerCase()) !== -1; });
    if (foundGeneric.length) {
      issues.push({ severity: 'warning', message: 'Generic phrases weaken your resume.', phrases: foundGeneric });
    }

    if (!state.summary) issues.push({ severity: 'error', message: 'Professional summary is missing — recruiters read this first.' });
    if (!state.experience.length) issues.push({ severity: 'error', message: 'No work experience added.' });
    if (state.skills.length < 5) issues.push({ severity: 'warning', message: 'Add at least 5 skills (you have ' + state.skills.length + ').' });
    if (!state.education.length) issues.push({ severity: 'warning', message: 'No education entries added.' });
    if (!state.projects.length) issues.push({ severity: 'info', message: 'No projects listed — projects showcase practical skills.' });
    if (state.summary && state.summary.length < 50) issues.push({ severity: 'warning', message: 'Summary is very short (' + state.summary.length + ' chars). Aim for 80–200.' });

    renderImproverResults(issues, suggestions);
  }

  function renderImproverResults(issues, suggestions) {
    var el = $('improverResults');
    if (!el) return;

    if (!issues.length && !suggestions.length) {
      el.innerHTML = '<div class="imp-success"><span class="imp-success-icon">🎉</span><p>No major weaknesses detected. Great work!</p></div>';
      return;
    }

    var html = '';

    if (issues.length) {
      html += '<div class="imp-section"><h3 class="imp-heading">⚠️ Issues Found (' + issues.length + ')</h3>';
      issues.forEach(function (issue) {
        var icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
        html += '<div class="imp-issue imp-issue--' + issue.severity + '">' +
          '<div class="imp-issue-msg">' + icon + ' ' + esc(issue.message) + '</div>';
        if (issue.examples) {
          issue.examples.forEach(function (ex) {
            html += '<div class="imp-example">&ldquo;' + esc(ex) + '&rdquo;</div>';
          });
        }
        if (issue.phrases) {
          html += '<div class="imp-chips">' + issue.phrases.map(function (p) { return '<span class="imp-phrase-chip">' + esc(p) + '</span>'; }).join('') + '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    if (suggestions.length) {
      html += '<div class="imp-section"><h3 class="imp-heading">✍️ Rewrite Suggestions (' + suggestions.length + ')</h3>';
      suggestions.forEach(function (sug) {
        var improved = sug.original.replace(new RegExp(sug.phrase, 'i'), sug.replacement);
        html += '<div class="imp-sug">' +
          '<div class="imp-sug-row imp-sug-from"><span class="imp-sug-label">Original</span><span class="imp-sug-txt weak">' + esc(sug.original) + '</span></div>' +
          '<div class="imp-sug-row imp-sug-to"><span class="imp-sug-label">Improved</span><span class="imp-sug-txt strong">' + esc(improved) + '</span></div>' +
          '<div class="imp-sug-src">From: ' + esc(sug.source) + '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '<div class="imp-section"><h3 class="imp-heading">⚡ Power Verbs to Strengthen Your Bullets</h3>' +
      '<div class="imp-verbs">' + POWER_VERBS.slice(0, 24).map(function (v) { return '<span class="imp-verb">' + v + '</span>'; }).join('') + '</div></div>';

    el.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════════
   *  FEATURE 5 — RESUME DNA REPORT
   * ══════════════════════════════════════════════════════════════ */
  var _dnaChart = null;

  function initDNA() {
    var btn = $('btnGenerateDNA');
    if (btn) btn.addEventListener('click', renderDNAReport);
  }

  function calcDNAScores() {
    var skillBreadth = Math.min(100, state.skills.length * 10);

    var expScore = 0;
    state.experience.forEach(function (e) {
      expScore += 20;
      if (e.description) expScore += Math.min(20, e.description.split('\n').filter(Boolean).length * 4);
    });
    var experienceDepth = Math.min(100, expScore);

    var totalB = 0, metricB = 0;
    state.experience.forEach(function (e) {
      if (!e.description) return;
      var bullets = e.description.split('\n').filter(Boolean);
      totalB += bullets.length;
      bullets.forEach(function (b) { if (/\d/.test(b)) metricB++; });
    });
    var impactScore = totalB > 0 ? Math.round((metricB / totalB) * 100) : 0;

    var uniqueWords = {};
    getKeywords(getResumeText()).forEach(function (w) { uniqueWords[w] = true; });
    var keywordDensity = Math.min(100, Object.keys(uniqueWords).length * 2);

    var comp = 0;
    var p = state.personal;
    if (p.name) comp += 10; if (p.email) comp += 5; if (p.phone) comp += 5;
    if (state.summary && state.summary.length > 60) comp += 20;
    if (state.experience.length >= 2) comp += 25;
    if (state.education.length) comp += 15;
    if (state.skills.length >= 5) comp += 15;
    if (state.projects.length) comp += 5;
    var completeness = Math.min(100, comp);

    return { skillBreadth: skillBreadth, experienceDepth: experienceDepth, impactScore: impactScore, keywordDensity: keywordDensity, completeness: completeness };
  }

  function renderDNAReport() {
    var scores = calcDNAScores();
    var dims = [
      { key: 'skillBreadth',    label: 'Skill Breadth',    icon: '⚡' },
      { key: 'experienceDepth', label: 'Experience Depth', icon: '💼' },
      { key: 'impactScore',     label: 'Impact Score',     icon: '🎯' },
      { key: 'keywordDensity',  label: 'Keyword Density',  icon: '📝' },
      { key: 'completeness',    label: 'Completeness',     icon: '✅' }
    ];
    var overall = Math.round((scores.skillBreadth + scores.experienceDepth + scores.impactScore + scores.keywordDensity + scores.completeness) / 5);

    var html = '<div class="dna-overall"><div class="dna-overall-num">' + overall + '</div><div class="dna-overall-lbl">Overall DNA Score</div></div><div class="dna-dims">';
    dims.forEach(function (d) {
      var v = scores[d.key];
      var cls = v >= 75 ? 'great' : v >= 50 ? 'good' : v >= 25 ? 'ok' : 'weak';
      html += '<div class="dna-dim">' +
        '<div class="dna-dim-hd"><span>' + d.icon + ' ' + d.label + '</span><span class="dna-dim-val ' + cls + '">' + v + '</span></div>' +
        '<div class="dna-bar-track"><div class="dna-bar-fill ' + cls + '" style="width:' + v + '%"></div></div>' +
      '</div>';
    });
    html += '</div>';

    var breakdown = $('dnaBreakdown');
    if (breakdown) breakdown.innerHTML = html;

    renderDNAChart(scores);
  }

  function renderDNAChart(scores) {
    if (typeof Chart === 'undefined') return;
    var canvas = $('dnaRadarChart');
    if (!canvas) return;
    if (_dnaChart) { _dnaChart.destroy(); _dnaChart = null; }
    var accent = state.accentColor || '#6366f1';
    var ctx = canvas.getContext('2d');
    _dnaChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Skill Breadth', 'Exp. Depth', 'Impact', 'Keywords', 'Complete'],
        datasets: [{
          label: 'Resume DNA',
          data: [scores.skillBreadth, scores.experienceDepth, scores.impactScore, scores.keywordDensity, scores.completeness],
          backgroundColor: accent.replace(/^#/, '') !== accent ? hexToRgba(accent, 0.2) : 'rgba(99,102,241,0.2)',
          borderColor: accent,
          borderWidth: 2,
          pointBackgroundColor: accent,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: accent
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: { min: 0, max: 100, stepSize: 25,
            ticks: { color: '#94a3b8', backdropColor: 'transparent' },
            pointLabels: { color: '#f1f5f9', font: { size: 11 } },
            grid: { color: '#334155' },
            angleLines: { color: '#334155' }
          }
        },
        plugins: { legend: { labels: { color: '#f1f5f9' } } }
      }
    });
  }

  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  /* ══════════════════════════════════════════════════════════════
   *  FEATURE 7 — INTERVIEW PROBABILITY PREDICTOR
   * ══════════════════════════════════════════════════════════════ */
  function initPredictor() {
    var btn = $('btnPredict');
    if (btn) btn.addEventListener('click', calcProbability);
  }

  function calcProbability() {
    var atsScore = (typeof window._atsScore === 'number') ? window._atsScore : 50;
    var dna = calcDNAScores();
    var pctEl = $('strengthPct');
    var strength = pctEl ? (parseInt(pctEl.textContent, 10) || 0) : 0;

    var prob = Math.round(atsScore * 0.4 + dna.completeness * 0.3 + strength * 0.3);
    prob = Math.min(Math.max(prob, 5), 95);

    var band = prob >= 70 ? { label: 'Strong', cls: 'great', icon: '🔥' } :
               prob >= 45 ? { label: 'Moderate', cls: 'good', icon: '👍' } :
                            { label: 'Low', cls: 'weak', icon: '📈' };

    var factors = [
      { label: 'ATS Keyword Match',   score: atsScore,       weight: '40%' },
      { label: 'Resume Completeness', score: dna.completeness, weight: '30%' },
      { label: 'Resume Strength',     score: strength,         weight: '30%' }
    ];

    var html =
      '<div class="pred-gauge-wrap">' +
        '<div class="pred-gauge">' +
          '<svg viewBox="0 0 200 110" class="pred-gauge-svg">' +
            '<path d="M10,100 A90,90 0 0,1 190,100" fill="none" stroke="#1e293b" stroke-width="18" stroke-linecap="round"/>' +
            '<path d="M10,100 A90,90 0 0,1 190,100" fill="none" stroke="' + (band.cls === 'great' ? '#10b981' : band.cls === 'good' ? '#f59e0b' : '#f43f5e') + '" stroke-width="18" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="' + Math.round(283 * (1 - prob / 100)) + '"/>' +
          '</svg>' +
          '<div class="pred-gauge-center">' +
            '<div class="pred-prob-num ' + band.cls + '">' + prob + '%</div>' +
            '<div class="pred-prob-lbl">Chance</div>' +
          '</div>' +
        '</div>' +
        '<div class="pred-band-tag ' + band.cls + '">' + band.icon + ' ' + band.label + ' Probability</div>' +
      '</div>' +
      '<div class="pred-factors">' +
        '<h4 class="pred-factors-hd">Score Breakdown</h4>';
    factors.forEach(function (f) {
      var cls = f.score >= 70 ? 'great' : f.score >= 45 ? 'good' : 'weak';
      html += '<div class="pred-factor">' +
        '<div class="pred-factor-hd"><span>' + f.label + '</span><span class="pred-factor-meta">' + f.score + '/100 <em>(' + f.weight + ')</em></span></div>' +
        '<div class="pred-factor-track"><div class="pred-factor-fill ' + cls + '" style="width:' + f.score + '%"></div></div>' +
      '</div>';
    });
    html += '</div><div class="pred-tip">💡 Run the ATS Calculator with a job description to improve accuracy.</div>';

    $('predictorResults').innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════════
   *  FEATURE 8 — VOICE INTERVIEW ANALYZER
   * ══════════════════════════════════════════════════════════════ */
  var _recognition   = null;
  var _voiceStart    = 0;
  var _voiceText     = '';
  var _voiceActive   = false;
  var FILLERS = ['um','uh','like','you know','basically','literally','actually','so','right','okay','well'];

  function initVoice() {
    var btn = $('btnVoiceRecord');
    if (!btn) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      var st = $('voiceStatus');
      if (st) st.textContent = '❌ Speech Recognition is not supported. Please use Chrome or Edge.';
      btn.disabled = true;
      return;
    }
    btn.addEventListener('click', function () {
      if (_voiceActive) { stopVoice(); } else { startVoice(); }
    });
  }

  function startVoice() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    _recognition = new SR();
    _recognition.continuous = true;
    _recognition.interimResults = true;
    _recognition.lang = 'en-US';
    _voiceText = '';
    _voiceStart = Date.now();
    _voiceActive = true;

    var btn = $('btnVoiceRecord');
    var status = $('voiceStatus');
    var transcript = $('voiceTranscript');
    if (btn) { btn.textContent = '⏹ Stop Recording'; btn.classList.add('voice-recording'); }
    if (status) status.textContent = '🎙 Recording… speak now!';
    if (transcript) transcript.textContent = '';

    _recognition.onresult = function (e) {
      var finalChunk = '';
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { finalChunk += e.results[i][0].transcript; }
        else { interim += e.results[i][0].transcript; }
      }
      _voiceText += finalChunk;
      if (transcript) {
        transcript.innerHTML =
          '<span class="vt-final">' + esc(_voiceText) + '</span>' +
          (interim ? '<span class="vt-interim"> ' + esc(interim) + '</span>' : '');
      }
    };
    _recognition.onerror = function (e) {
      var st = $('voiceStatus');
      if (st) st.textContent = '❌ Error: ' + e.error;
      stopVoice();
    };
    _recognition.onend = function () { if (_voiceActive) _recognition.start(); };
    _recognition.start();
  }

  function stopVoice() {
    _voiceActive = false;
    if (_recognition) { _recognition.stop(); _recognition = null; }
    var btn = $('btnVoiceRecord');
    var status = $('voiceStatus');
    if (btn) { btn.textContent = '🎙 Start Recording'; btn.classList.remove('voice-recording'); }
    if (status) status.textContent = '✅ Stopped. Analyzing…';
    analyzeVoice();
  }

  function analyzeVoice() {
    var el = $('voiceResults');
    if (!el) return;
    if (!_voiceText.trim()) {
      el.innerHTML = '<p class="rc-tool-hint">No speech detected. Record for at least 10 seconds.</p>';
      return;
    }
    var dur = (Date.now() - _voiceStart) / 1000;
    var words = _voiceText.trim().split(/\s+/).filter(Boolean);
    var wpm = dur > 0 ? Math.round((words.length / dur) * 60) : 0;

    var fillerCount = 0;
    var fillerBreakdown = {};
    var lowerText = _voiceText.toLowerCase();
    FILLERS.forEach(function (f) {
      var re = new RegExp('\\b' + f + '\\b', 'gi');
      var m = lowerText.match(re);
      if (m) { fillerCount += m.length; fillerBreakdown[f] = m.length; }
    });

    var sentences = _voiceText.split(/[.!?]+/).filter(function (s) { return s.trim().length > 0; });

    var fluencyScore = Math.max(0, Math.min(100, 100 - fillerCount * 8));
    var speedScore = (wpm >= 120 && wpm <= 160) ? 100 : (wpm >= 100 && wpm <= 180) ? 75 : (wpm >= 80 && wpm <= 200) ? 50 : 25;
    var confidenceScore = Math.min(100, Math.max(0,
      (sentences.length >= 3 ? 35 : 15) + (fluencyScore >= 70 ? 35 : 20) + (speedScore >= 70 ? 30 : 15)
    ));
    var speedLabel = wpm < 80 ? 'Too Slow' : wpm < 120 ? 'Slow' : wpm <= 160 ? '✓ Ideal' : wpm <= 200 ? 'Fast' : 'Too Fast';

    el.innerHTML =
      '<div class="voice-scores">' +
        voiceCard('Fluency', fluencyScore, fillerCount + ' filler words') +
        voiceCard('Speed', speedScore, wpm + ' WPM — ' + speedLabel) +
        voiceCard('Confidence', confidenceScore, 'Pace & clarity') +
      '</div>' +
      '<div class="voice-stats">' +
        vStat(words.length, 'Words') + vStat(Math.round(dur) + 's', 'Duration') +
        vStat(wpm, 'WPM') + vStat(fillerCount, 'Fillers') +
      '</div>' +
      (fillerCount > 0 ?
        '<div class="voice-filler-section"><h4>Filler Word Breakdown</h4><div class="voice-filler-chips">' +
        Object.keys(fillerBreakdown).map(function (f) {
          return '<span class="voice-filler-chip">"' + f + '" &times;' + fillerBreakdown[f] + '</span>';
        }).join('') + '</div></div>' : '') +
      '<div class="voice-tip">💡 Ideal interview pace: 120–160 WPM. Aim for fewer than 1 filler word per 20 words.</div>';
  }

  function voiceCard(label, score, sub) {
    var cls = score >= 75 ? 'great' : score >= 50 ? 'good' : score >= 25 ? 'ok' : 'weak';
    return '<div class="voice-card">' +
      '<div class="voice-card-num ' + cls + '">' + score + '</div>' +
      '<div class="voice-card-label">' + label + '</div>' +
      '<div class="voice-card-sub">' + esc(sub) + '</div>' +
    '</div>';
  }

  function vStat(val, label) {
    return '<div class="voice-stat"><div class="voice-stat-num">' + val + '</div><div class="voice-stat-lbl">' + label + '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════════
   *  FEATURE 9 — AUTO PORTFOLIO GENERATOR
   * ══════════════════════════════════════════════════════════════ */
  function initPortfolio() {
    var dl = $('btnDownloadPortfolio');
    if (dl) dl.addEventListener('click', downloadPortfolio);
    var pv = $('btnPreviewPortfolio');
    if (pv) {
      pv.addEventListener('click', function () {
        var blob = new Blob([buildPortfolioHTML()], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      });
    }
  }

  function downloadPortfolio() {
    var html = buildPortfolioHTML();
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = ((state.personal.name || 'portfolio').replace(/\s+/g, '-').toLowerCase()) + '-portfolio.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function buildPortfolioHTML() {
    var p = state.personal;
    var accent = state.accentColor || '#6366f1';

    var skillsH = state.skills.map(function (s) { return '<span class="sk">' + s.name + '</span>'; }).join('');

    var expH = state.experience.map(function (e) {
      var dates = e.current ? (e.startDate || '') + ' — Present' : (e.startDate || '') + (e.endDate ? ' — ' + e.endDate : '');
      var bullets = e.description
        ? e.description.split('\n').filter(Boolean).map(function (l) { return '<li>' + l.replace(/^[\s•\-*]+/, '').trim() + '</li>'; }).join('')
        : '';
      return '<div class="ei"><div class="ei-hd"><strong>' + (e.jobTitle || '') + '</strong><span class="ei-d">' + dates + '</span></div>' +
        (e.company ? '<div class="ei-co">' + e.company + (e.location ? ', ' + e.location : '') + '</div>' : '') +
        (bullets ? '<ul>' + bullets + '</ul>' : '') + '</div>';
    }).join('');

    var projH = state.projects.map(function (pr) {
      return '<div class="pc"><div class="pc-n">' + (pr.name || '') + '</div>' +
        (pr.techStack ? '<div class="pc-s">' + pr.techStack + '</div>' : '') +
        (pr.description ? '<p>' + pr.description + '</p>' : '') +
        (pr.url ? '<a href="' + pr.url + '" target="_blank" rel="noopener">🔗 View Project</a>' : '') + '</div>';
    }).join('');

    var eduH = state.education.map(function (e) {
      return '<div class="edu"><strong>' + (e.degree || '') + '</strong>' +
        (e.institution ? ' — ' + e.institution : '') +
        (e.year ? ' <span class="ey">(' + e.year + ')</span>' : '') + '</div>';
    }).join('');

    var certH = state.certifications.map(function (c) {
      return '<div class="cert"><strong>' + (c.name || '') + '</strong>' +
        (c.issuer ? ' · ' + c.issuer : '') + (c.year ? ' · ' + c.year : '') + '</div>';
    }).join('');

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>' + (p.name || 'Portfolio') + '</title>\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">\n' +
      '<style>\n:root{--a:' + accent + '}\n' +
      '*{box-sizing:border-box;margin:0;padding:0}\nbody{font-family:Inter,sans-serif;background:#0f172a;color:#e2e8f0;line-height:1.6}\n' +
      '.hero{background:linear-gradient(135deg,var(--a) 0%,#0f172a 70%);padding:80px 24px;text-align:center}\n' +
      '.hn{font-size:clamp(2rem,5vw,3.2rem);font-weight:700;color:#fff;margin-bottom:8px}\n' +
      '.ht{font-size:1.1rem;color:rgba(255,255,255,.8);margin-bottom:20px}\n' +
      '.hc{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}\n' +
      '.hc a{color:rgba(255,255,255,.7);text-decoration:none;font-size:.9rem}\n.hc a:hover{color:#fff}\n' +
      '.wrap{max-width:880px;margin:0 auto;padding:48px 24px}\n.sec{margin-bottom:52px}\n' +
      '.sec-t{font-size:1.3rem;font-weight:700;color:var(--a);border-bottom:2px solid var(--a);padding-bottom:8px;margin-bottom:22px}\n' +
      '.sk{display:inline-block;padding:5px 13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:100px;font-size:.85rem;margin:3px}\n' +
      '.ei{padding:14px 0;border-bottom:1px solid #1e293b}\n.ei-hd{display:flex;justify-content:space-between;flex-wrap:wrap;margin-bottom:4px}\n' +
      '.ei-hd strong{color:#f1f5f9}\n.ei-d{font-size:.85rem;color:#64748b}\n.ei-co{font-size:.9rem;color:#94a3b8;margin-bottom:8px}\n' +
      '.ei ul{padding-left:18px;color:#cbd5e1;font-size:.9rem}\n.ei li{margin-bottom:4px}\n' +
      '.pc{background:#1e293b;border-radius:10px;padding:18px;margin-bottom:14px}\n' +
      '.pc-n{font-size:1.05rem;font-weight:600;color:var(--a);margin-bottom:5px}\n' +
      '.pc-s{font-size:.8rem;color:#64748b;margin-bottom:7px}\n.pc p{font-size:.9rem;color:#cbd5e1}\n' +
      '.pc a{display:inline-block;margin-top:9px;color:var(--a);font-size:.9rem;text-decoration:none}\n' +
      '.edu{padding:10px 0;border-bottom:1px solid #1e293b;color:#e2e8f0}\n.ey{color:#64748b;font-size:.9rem}\n' +
      '.cert{padding:10px 0;border-bottom:1px solid #1e293b;color:#e2e8f0}\n' +
      '.footer{text-align:center;padding:28px;color:#475569;font-size:.85rem;border-top:1px solid #1e293b}\n' +
      '.footer a{color:var(--a);text-decoration:none}\n' +
      '</style>\n</head>\n<body>\n' +
      '<div class="hero">' +
        '<h1 class="hn">' + (p.name || 'My Portfolio') + '</h1>' +
        (p.jobTitle ? '<div class="ht">' + p.jobTitle + '</div>' : '') +
        '<div class="hc">' +
          (p.email    ? '<a href="mailto:' + p.email    + '">' + p.email    + '</a>' : '') +
          (p.phone    ? '<a href="tel:'    + p.phone    + '">' + p.phone    + '</a>' : '') +
          (p.linkedin ? '<a href="https://' + p.linkedin + '" target="_blank" rel="noopener">' + p.linkedin + '</a>' : '') +
          (p.website  ? '<a href="https://' + p.website  + '" target="_blank" rel="noopener">' + p.website  + '</a>' : '') +
        '</div>' +
      '</div>\n' +
      '<div class="wrap">' +
        (state.summary ? '<div class="sec"><h2 class="sec-t">About Me</h2><p>' + state.summary + '</p></div>' : '') +
        (skillsH ? '<div class="sec"><h2 class="sec-t">Skills</h2><div>' + skillsH + '</div></div>' : '') +
        (expH   ? '<div class="sec"><h2 class="sec-t">Experience</h2>' + expH + '</div>' : '') +
        (projH  ? '<div class="sec"><h2 class="sec-t">Projects</h2>' + projH + '</div>' : '') +
        (eduH   ? '<div class="sec"><h2 class="sec-t">Education</h2>' + eduH + '</div>' : '') +
        (certH  ? '<div class="sec"><h2 class="sec-t">Certifications</h2>' + certH + '</div>' : '') +
      '</div>\n' +
      '<div class="footer">Built with <a href="#">ResumeCraft</a> &mdash; ' + new Date().getFullYear() + '</div>\n' +
      '</body>\n</html>';
  }

  /* ══════════════════════════════════════════════════════════════
   *  FEATURE 10 — SKILL GAP DETECTOR
   * ══════════════════════════════════════════════════════════════ */
  var SKILL_DB = {
    'Frontend Developer': {
      skills: ['HTML','CSS','JavaScript','React','TypeScript','Git','REST API','Tailwind CSS','Testing','Webpack'],
      resources: { 'React':'https://react.dev/', 'TypeScript':'https://www.typescriptlang.org/docs/', 'Tailwind CSS':'https://tailwindcss.com/docs', 'Testing':'https://testing-library.com/', 'Webpack':'https://webpack.js.org/guides/' }
    },
    'Backend Developer': {
      skills: ['Node.js','Python','SQL','MongoDB','REST API','Docker','Git','Linux','Authentication','Redis'],
      resources: { 'Docker':'https://docs.docker.com/', 'MongoDB':'https://www.mongodb.com/docs/', 'Python':'https://docs.python.org/3/', 'Redis':'https://redis.io/docs/' }
    },
    'Full Stack Developer': {
      skills: ['JavaScript','TypeScript','React','Node.js','SQL','MongoDB','Docker','Git','REST API','CI/CD'],
      resources: { 'TypeScript':'https://www.typescriptlang.org/docs/', 'Docker':'https://docs.docker.com/', 'CI/CD':'https://docs.github.com/en/actions' }
    },
    'Data Scientist': {
      skills: ['Python','Machine Learning','Statistics','Pandas','NumPy','SQL','TensorFlow','Data Visualization','NLP','Jupyter'],
      resources: { 'Machine Learning':'https://www.coursera.org/learn/machine-learning', 'TensorFlow':'https://www.tensorflow.org/tutorials', 'NLP':'https://www.nltk.org/', 'Pandas':'https://pandas.pydata.org/docs/' }
    },
    'DevOps Engineer': {
      skills: ['Docker','Kubernetes','CI/CD','Linux','Terraform','AWS','Python','Git','Monitoring','Security'],
      resources: { 'Kubernetes':'https://kubernetes.io/docs/', 'Terraform':'https://developer.hashicorp.com/terraform/docs', 'AWS':'https://aws.amazon.com/training/', 'Monitoring':'https://prometheus.io/docs/' }
    },
    'UI/UX Designer': {
      skills: ['Figma','User Research','Prototyping','Wireframing','Design Systems','CSS','Accessibility','HTML','Typography','Adobe XD'],
      resources: { 'Figma':'https://www.figma.com/resources/learn-design/', 'Accessibility':'https://www.w3.org/WAI/WCAG21/quickref/', 'Design Systems':'https://designsystemsrepo.com/' }
    },
    'Mobile Developer': {
      skills: ['React Native','Swift','Kotlin','Flutter','REST API','Git','UI Design','Authentication','Push Notifications','Testing'],
      resources: { 'React Native':'https://reactnative.dev/docs/', 'Flutter':'https://docs.flutter.dev/', 'Kotlin':'https://kotlinlang.org/docs/', 'Swift':'https://www.swift.org/documentation/' }
    },
    'Cloud Architect': {
      skills: ['AWS','Azure','GCP','Docker','Kubernetes','Terraform','Networking','Security','Cost Optimization','Monitoring'],
      resources: { 'AWS':'https://aws.amazon.com/training/', 'Azure':'https://learn.microsoft.com/azure/', 'GCP':'https://cloud.google.com/training', 'Terraform':'https://developer.hashicorp.com/terraform/docs' }
    }
  };

  function initSkillGap() {
    var btn  = $('btnDetectGap');
    var sel  = $('skillGapRole');
    if (btn) btn.addEventListener('click', detectSkillGap);
    if (sel) sel.addEventListener('change', detectSkillGap);
  }

  function detectSkillGap() {
    var sel = $('skillGapRole');
    if (!sel || !sel.value) return;
    var role = sel.value;
    var db = SKILL_DB[role];
    if (!db) return;

    var userSkills = state.skills.map(function (s) { return s.name.toLowerCase(); });
    var hasSkills     = db.skills.filter(function (s) { return userSkills.some(function (u) { return u.indexOf(s.toLowerCase()) !== -1 || s.toLowerCase().indexOf(u) !== -1; }); });
    var missingSkills = db.skills.filter(function (s) { return !userSkills.some(function (u) { return u.indexOf(s.toLowerCase()) !== -1 || s.toLowerCase().indexOf(u) !== -1; }); });
    var pct = Math.round((hasSkills.length / db.skills.length) * 100);
    var cls = pct >= 80 ? 'great' : pct >= 60 ? 'good' : pct >= 40 ? 'ok' : 'weak';

    var html =
      '<div class="sg-match">' +
        '<div class="sg-pct ' + cls + '">' + pct + '%</div>' +
        '<div class="sg-pct-lbl">Role Readiness for <strong>' + esc(role) + '</strong></div>' +
      '</div>' +
      '<div class="sg-cols">' +
        '<div class="sg-col">' +
          '<h4 class="sg-col-hd sg-has">✅ You Have (' + hasSkills.length + '/' + db.skills.length + ')</h4>' +
          '<div class="sg-chips">' + hasSkills.map(function (s) { return '<span class="sg-chip sg-has-chip">' + esc(s) + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="sg-col">' +
          '<h4 class="sg-col-hd sg-miss">❌ To Learn (' + missingSkills.length + ')</h4>' +
          '<div class="sg-chips">' + missingSkills.map(function (s) {
            var link = db.resources && db.resources[s]
              ? ' <a href="' + db.resources[s] + '" target="_blank" rel="noopener" class="sg-learn">Learn →</a>'
              : '';
            return '<span class="sg-chip sg-miss-chip">' + esc(s) + link + '</span>';
          }).join('') + '</div>' +
        '</div>' +
      '</div>' +
      (missingSkills.length
        ? '<div class="sg-tip">💡 Focus on learning the ' + missingSkills.length + ' missing skill' + (missingSkills.length > 1 ? 's' : '') + ' to boost your role readiness.</div>'
        : '<div class="sg-tip sg-tip-ok">🎉 You have all the core skills for this role!</div>');

    $('skillGapResults').innerHTML = html;
  }

}());
