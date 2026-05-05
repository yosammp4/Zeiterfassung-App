'use strict';

// ============================================================
// STATE
// ============================================================

var DATA = { customers: [], projects: [], timeEntries: [], activeTimer: null };
var currentView = 'dashboard';
var currentParams = {};
var timerInterval = null;

function loadData() {
  try {
    var s = localStorage.getItem('ze_data');
    if (s) {
      var d = JSON.parse(s);
      DATA.customers = d.customers || [];
      DATA.projects = d.projects || [];
      DATA.timeEntries = d.timeEntries || [];
      DATA.activeTimer = d.activeTimer || null;
    }
  } catch (e) { console.error('Load error', e); }
}

function saveData() {
  try {
    localStorage.setItem('ze_data', JSON.stringify(DATA));
  } catch (e) { console.error('Save error', e); }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ============================================================
// ROUTING
// ============================================================

function navigate(view, params) {
  currentView = view;
  currentParams = params || {};
  render();
  document.querySelectorAll('.nav-item').forEach(function(btn) {
    var base = ['dashboard','kunden','projekte','zeiten','berichte'];
    btn.classList.toggle('active', btn.dataset.view === view && base.indexOf(view) !== -1);
  });
  document.getElementById('content').scrollTop = 0;
}

// ============================================================
// RENDER
// ============================================================

function render() {
  clearInterval(timerInterval);
  timerInterval = null;

  var content = document.getElementById('content');
  var addBtn = document.getElementById('add-btn');
  var backBtn = document.getElementById('back-btn');
  var title = document.getElementById('page-title');

  addBtn.classList.remove('hidden');
  addBtn.onclick = null;
  backBtn.classList.add('hidden');
  backBtn.onclick = null;

  switch (currentView) {
    case 'dashboard':
      title.textContent = 'Übersicht';
      addBtn.classList.add('hidden');
      content.innerHTML = renderDashboard();
      break;

    case 'kunden':
      title.textContent = 'Kunden';
      addBtn.onclick = function() { showModal('kunde', {}); };
      content.innerHTML = renderKunden();
      break;

    case 'projekte':
      title.textContent = 'Projekte';
      addBtn.onclick = function() { showModal('projekt', {}); };
      content.innerHTML = renderProjekte();
      break;

    case 'zeiten':
      title.textContent = 'Zeiterfassung';
      addBtn.onclick = function() { showModal('zeiteintrag', {}); };
      content.innerHTML = renderZeiten();
      break;

    case 'berichte':
      title.textContent = 'Berichte';
      addBtn.classList.add('hidden');
      content.innerHTML = renderBerichte();
      break;

    case 'kunde-detail': {
      var k = DATA.customers.find(function(c) { return c.id === currentParams.id; });
      title.textContent = k ? k.name : 'Kunde';
      backBtn.classList.remove('hidden');
      backBtn.onclick = function() { navigate('kunden'); };
      addBtn.onclick = function() { showModal('projekt', { kundeId: currentParams.id }); };
      content.innerHTML = renderKundeDetail(currentParams.id);
      break;
    }

    case 'projekt-detail': {
      var p = DATA.projects.find(function(pr) { return pr.id === currentParams.id; });
      title.textContent = p ? p.name : 'Projekt';
      backBtn.classList.remove('hidden');
      backBtn.onclick = function() { navigate('projekte'); };
      addBtn.onclick = function() { showModal('zeiteintrag', { projektId: currentParams.id }); };
      content.innerHTML = renderProjektDetail(currentParams.id);
      break;
    }
  }

  attachListeners();
  if (DATA.activeTimer) startTimerDisplay();
}

// ============================================================
// HELPERS
// ============================================================

function fmtDur(mins) {
  if (!mins && mins !== 0) return '0:00';
  var m = Math.round(Math.abs(mins));
  return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
}

function fmtEur(v) {
  if (v === null || v === undefined || isNaN(v)) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function typLabel(t) { return { dreh: 'Dreh', schnitt: 'Schnitt', plan: 'Planung' }[t] || t; }
function typClass(t) { return { dreh: 'type-dreh', schnitt: 'type-schnitt', plan: 'type-plan' }[t] || ''; }

function stundensatzOf(proj) {
  if (!proj) return 0;
  if (proj.stundensatz && parseFloat(proj.stundensatz) > 0) return parseFloat(proj.stundensatz);
  var gb = parseFloat(proj.gesamtbetrag);
  var gs = parseFloat(proj.geplanteStunden);
  if (gb > 0 && gs > 0) return gb / gs;
  return 0;
}

function projStats(projektId) {
  var proj = DATA.projects.find(function(p) { return p.id === projektId; });
  var ss = stundensatzOf(proj);
  var stats = { total: 0, dreh: 0, schnitt: 0, plan: 0, cost: 0 };
  DATA.timeEntries.filter(function(e) { return e.projektId === projektId; }).forEach(function(e) {
    var m = parseFloat(e.dauer) || 0;
    stats.total += m;
    if (e.typ === 'dreh') stats.dreh += m;
    if (e.typ === 'schnitt') stats.schnitt += m;
    if (e.typ === 'plan') stats.plan += m;
    stats.cost += (m / 60) * ss;
  });
  return stats;
}

function entryCost(entry) {
  var proj = DATA.projects.find(function(p) { return p.id === entry.projektId; });
  return (parseFloat(entry.dauer) || 0) / 60 * stundensatzOf(proj);
}

function entryDate(e) { return e.startTime || e.datum || ''; }

// ============================================================
// VIEWS
// ============================================================

function renderDashboard() {
  var today = new Date().toDateString();
  var weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  var todayMins = 0, weekMins = 0;
  DATA.timeEntries.forEach(function(e) {
    var d = new Date(entryDate(e));
    var m = parseFloat(e.dauer) || 0;
    if (d.toDateString() === today) todayMins += m;
    if (d >= weekStart) weekMins += m;
  });

  var activeProjekte = DATA.projects.filter(function(p) { return p.status !== 'abgeschlossen'; });

  var timerHtml = '';
  if (DATA.activeTimer) {
    var tp = DATA.projects.find(function(p) { return p.id === DATA.activeTimer.projektId; });
    timerHtml = '<div class="card active-timer-card">' +
      '<div class="timer-running-indicator"></div>' +
      '<div class="timer-info">' +
        '<span class="type-badge ' + typClass(DATA.activeTimer.typ) + '">' + typLabel(DATA.activeTimer.typ) + '</span>' +
        '<span class="timer-project">' + esc(tp ? tp.name : '–') + '</span>' +
      '</div>' +
      '<div id="timer-display" class="timer-display">0:00:00</div>' +
      '<button class="btn btn-danger btn-full" onclick="stopTimer()">Timer stoppen</button>' +
    '</div>';
  }

  var quickHtml = '';
  if (activeProjekte.length === 0) {
    quickHtml = '<div class="empty-state"><div class="empty-icon">🎬</div><p>Noch keine Projekte.</p><p class="hint">Lege einen Kunden und ein Projekt an.</p></div>';
  } else {
    quickHtml = '<div style="display:flex;flex-direction:column;gap:10px">' +
      activeProjekte.slice(0, 4).map(function(proj) {
        var kd = DATA.customers.find(function(c) { return c.id === proj.kundeId; });
        return '<div class="card project-quick-card">' +
          '<div class="project-quick-info">' +
            '<div class="project-name">' + esc(proj.name) + '</div>' +
            '<div class="project-customer">' + esc(kd ? kd.name : '–') + '</div>' +
          '</div>' +
          '<div class="type-buttons">' +
            '<button class="type-btn type-btn-dreh" onclick="startTimer(\'' + proj.id + '\',\'dreh\')">▶ Dreh</button>' +
            '<button class="type-btn type-btn-schnitt" onclick="startTimer(\'' + proj.id + '\',\'schnitt\')">▶ Schnitt</button>' +
            '<button class="type-btn type-btn-plan" onclick="startTimer(\'' + proj.id + '\',\'plan\')">▶ Plan</button>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  var recent = DATA.timeEntries.slice().sort(function(a, b) {
    return new Date(entryDate(b)) - new Date(entryDate(a));
  }).slice(0, 5);

  return '<div class="view-content">' +
    timerHtml +
    '<div class="stats-grid">' +
      '<div class="stat-card"><div class="stat-value">' + fmtDur(todayMins) + '</div><div class="stat-label">Heute</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + fmtDur(weekMins) + '</div><div class="stat-label">Diese Woche</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + activeProjekte.length + '</div><div class="stat-label">Projekte</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + DATA.customers.length + '</div><div class="stat-label">Kunden</div></div>' +
    '</div>' +
    '<div class="section-title">Schnellstart</div>' +
    quickHtml +
    '<div class="section-title">Letzte Einträge</div>' +
    renderEntryList(recent) +
  '</div>';
}

function renderKunden() {
  if (DATA.customers.length === 0) {
    return '<div class="view-content"><div class="empty-state">' +
      '<div class="empty-icon">👥</div><p>Noch keine Kunden.</p>' +
      '<button class="btn btn-primary" onclick="showModal(\'kunde\',{})">Ersten Kunden anlegen</button>' +
    '</div></div>';
  }
  return '<div class="view-content"><div class="list">' +
    DATA.customers.map(function(k) {
      var pz = DATA.projects.filter(function(p) { return p.kundeId === k.id; }).length;
      return '<div class="list-item" onclick="navigate(\'kunde-detail\',{id:\'' + k.id + '\'})">' +
        '<div class="list-item-avatar">' + esc(k.name.charAt(0).toUpperCase()) + '</div>' +
        '<div class="list-item-content">' +
          '<div class="list-item-title">' + esc(k.name) + '</div>' +
          '<div class="list-item-subtitle">' + pz + ' Projekt' + (pz !== 1 ? 'e' : '') + '</div>' +
        '</div>' +
        '<div class="list-item-actions">' +
          '<button class="icon-btn-small" data-action="edit-kunde" data-id="' + k.id + '" title="Bearbeiten">✎</button>' +
          '<button class="icon-btn-small delete-btn" data-action="del-kunde" data-id="' + k.id + '" title="Löschen">×</button>' +
          '<span class="list-item-arrow">›</span>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div></div>';
}

function renderKundeDetail(id) {
  var k = DATA.customers.find(function(c) { return c.id === id; });
  if (!k) return '<div class="view-content"><div class="empty-state">Kunde nicht gefunden.</div></div>';
  var projekte = DATA.projects.filter(function(p) { return p.kundeId === id; });

  return '<div class="view-content">' +
    '<div class="card">' +
      '<div class="detail-row"><span class="detail-label">Name</span><span>' + esc(k.name) + '</span></div>' +
      (k.email ? '<div class="detail-row"><span class="detail-label">E-Mail</span><a href="mailto:' + esc(k.email) + '">' + esc(k.email) + '</a></div>' : '') +
      (k.telefon ? '<div class="detail-row"><span class="detail-label">Telefon</span><a href="tel:' + esc(k.telefon) + '">' + esc(k.telefon) + '</a></div>' : '') +
      (k.notiz ? '<div class="detail-row"><span class="detail-label">Notiz</span><span>' + esc(k.notiz) + '</span></div>' : '') +
    '</div>' +
    '<div class="section-title">Projekte</div>' +
    (projekte.length === 0
      ? '<div class="empty-state"><p>Noch keine Projekte.</p><button class="btn btn-primary" onclick="showModal(\'projekt\',{kundeId:\'' + id + '\'})">Projekt anlegen</button></div>'
      : '<div class="list">' + projekte.map(renderProjektItem).join('') + '</div>'
    ) +
  '</div>';
}

function renderProjekte() {
  var filterKId = currentParams.kundeId || '';
  var list = filterKId
    ? DATA.projects.filter(function(p) { return p.kundeId === filterKId; })
    : DATA.projects;

  var filterHtml = '';
  if (DATA.customers.length > 0) {
    filterHtml = '<div class="filter-bar"><select id="kunde-filter" onchange="currentParams.kundeId=this.value||\'\';">' +
      '<option value="">Alle Kunden</option>' +
      DATA.customers.map(function(c) {
        return '<option value="' + c.id + '"' + (filterKId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      }).join('') +
    '</select></div>';
  }

  if (list.length === 0) {
    return '<div class="view-content">' + filterHtml +
      '<div class="empty-state"><div class="empty-icon">📁</div><p>Noch keine Projekte.</p>' +
      (DATA.customers.length === 0 ? '<p class="hint">Erstelle zuerst einen Kunden.</p>' : '') +
      '<button class="btn btn-primary" onclick="showModal(\'projekt\',{})"' + (DATA.customers.length === 0 ? ' disabled' : '') + '>Projekt anlegen</button>' +
    '</div></div>';
  }

  return '<div class="view-content">' + filterHtml +
    '<div class="list">' + list.map(renderProjektItem).join('') + '</div>' +
  '</div>';
}

function renderProjektItem(proj) {
  var k = DATA.customers.find(function(c) { return c.id === proj.kundeId; });
  var st = projStats(proj.id);
  var budget = parseFloat(proj.gesamtbetrag) || 0;
  var pct = budget > 0 ? Math.min(100, (st.cost / budget) * 100) : 0;
  var ss = stundensatzOf(proj);

  var budgetHtml = '';
  if (budget > 0) {
    var cls = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : '';
    budgetHtml = '<div class="budget-bar"><div class="budget-bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
      '<div class="budget-text">' + fmtEur(st.cost) + ' / ' + fmtEur(budget) + '</div>';
  } else if (ss > 0) {
    budgetHtml = '<div class="rate-text">' + fmtEur(ss) + '/h · ' + fmtEur(st.cost) + ' gesamt</div>';
  }

  return '<div class="list-item" onclick="navigate(\'projekt-detail\',{id:\'' + proj.id + '\'})">' +
    '<div class="list-item-content">' +
      '<div class="list-item-title">' + esc(proj.name) + '</div>' +
      '<div class="list-item-subtitle">' + esc(k ? k.name : '–') + ' · ' + fmtDur(st.total) + '</div>' +
      budgetHtml +
    '</div>' +
    '<div class="list-item-actions">' +
      '<button class="icon-btn-small" data-action="edit-projekt" data-id="' + proj.id + '" title="Bearbeiten">✎</button>' +
      '<button class="icon-btn-small delete-btn" data-action="del-projekt" data-id="' + proj.id + '" title="Löschen">×</button>' +
      '<span class="list-item-arrow">›</span>' +
    '</div>' +
  '</div>';
}

function renderProjektDetail(id) {
  var proj = DATA.projects.find(function(p) { return p.id === id; });
  if (!proj) return '<div class="view-content"><div class="empty-state">Projekt nicht gefunden.</div></div>';

  var k = DATA.customers.find(function(c) { return c.id === proj.kundeId; });
  var st = projStats(id);
  var ss = stundensatzOf(proj);
  var budget = parseFloat(proj.gesamtbetrag) || 0;
  var pct = budget > 0 ? Math.min(100, (st.cost / budget) * 100) : 0;

  var timerHtml = '';
  if (DATA.activeTimer && DATA.activeTimer.projektId === id) {
    timerHtml = '<div class="card active-timer-card">' +
      '<div class="timer-running-indicator"></div>' +
      '<span class="type-badge ' + typClass(DATA.activeTimer.typ) + '">' + typLabel(DATA.activeTimer.typ) + '</span>' +
      '<div id="timer-display" class="timer-display">0:00:00</div>' +
      '<button class="btn btn-danger btn-full" onclick="stopTimer()">Stoppen</button>' +
    '</div>';
  } else {
    timerHtml = '<div class="card">' +
      '<div class="type-buttons type-buttons-big">' +
        '<button class="type-btn type-btn-dreh" onclick="startTimer(\'' + id + '\',\'dreh\')">▶ Dreh</button>' +
        '<button class="type-btn type-btn-schnitt" onclick="startTimer(\'' + id + '\',\'schnitt\')">▶ Schnitt</button>' +
        '<button class="type-btn type-btn-plan" onclick="startTimer(\'' + id + '\',\'plan\')">▶ Plan</button>' +
      '</div>' +
    '</div>';
  }

  var entries = DATA.timeEntries.filter(function(e) { return e.projektId === id; })
    .sort(function(a, b) { return new Date(entryDate(b)) - new Date(entryDate(a)); });

  return '<div class="view-content">' +
    '<div class="card">' +
      '<div class="detail-row"><span class="detail-label">Kunde</span><span>' + esc(k ? k.name : '–') + '</span></div>' +
      (proj.beschreibung ? '<div class="detail-row"><span class="detail-label">Beschreibung</span><span>' + esc(proj.beschreibung) + '</span></div>' : '') +
      (ss > 0 ? '<div class="detail-row"><span class="detail-label">Stundensatz</span><span>' + fmtEur(ss) + '/h</span></div>' : '') +
      (budget > 0
        ? '<div class="detail-row"><span class="detail-label">Budget</span><span>' + fmtEur(budget) + '</span></div>' +
          '<div class="budget-bar large"><div class="budget-bar-fill ' + (pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : '') + '" style="width:' + pct + '%"></div></div>' +
          '<div class="budget-text">' + fmtEur(st.cost) + ' von ' + fmtEur(budget) + ' (' + Math.round(pct) + '%)</div>'
        : (st.cost > 0 ? '<div class="detail-row"><span class="detail-label">Kosten</span><span>' + fmtEur(st.cost) + '</span></div>' : '')
      ) +
    '</div>' +
    '<div class="stats-grid">' +
      '<div class="stat-card stat-dreh"><div class="stat-value">' + fmtDur(st.dreh) + '</div><div class="stat-label">Dreh</div></div>' +
      '<div class="stat-card stat-schnitt"><div class="stat-value">' + fmtDur(st.schnitt) + '</div><div class="stat-label">Schnitt</div></div>' +
      '<div class="stat-card stat-plan"><div class="stat-value">' + fmtDur(st.plan) + '</div><div class="stat-label">Planung</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + fmtDur(st.total) + '</div><div class="stat-label">Gesamt</div></div>' +
    '</div>' +
    timerHtml +
    '<div class="section-title">Zeiteinträge</div>' +
    renderEntryList(entries, true) +
  '</div>';
}

function renderZeiten() {
  var today = new Date().toISOString().split('T')[0];
  var fd = currentParams.filterDate || today;

  var list = DATA.timeEntries.filter(function(e) {
    return (entryDate(e) || '').split('T')[0] === fd;
  }).sort(function(a, b) { return new Date(entryDate(b)) - new Date(entryDate(a)); });

  var totalMins = list.reduce(function(s, e) { return s + (parseFloat(e.dauer) || 0); }, 0);

  var timerHtml = '';
  if (DATA.activeTimer) {
    var tp = DATA.projects.find(function(p) { return p.id === DATA.activeTimer.projektId; });
    timerHtml = '<div class="card active-timer-card">' +
      '<div class="timer-running-indicator"></div>' +
      '<div class="timer-info">' +
        '<span class="type-badge ' + typClass(DATA.activeTimer.typ) + '">' + typLabel(DATA.activeTimer.typ) + '</span>' +
        '<span class="timer-project">' + esc(tp ? tp.name : '–') + '</span>' +
      '</div>' +
      '<div id="timer-display" class="timer-display">0:00:00</div>' +
      '<button class="btn btn-danger btn-full" onclick="stopTimer()">Timer stoppen</button>' +
    '</div>';
  }

  return '<div class="view-content">' +
    timerHtml +
    '<div class="filter-bar"><input type="date" id="date-filter" value="' + fd + '" onchange="currentParams.filterDate=this.value;render()"></div>' +
    (list.length > 0 ? '<div class="day-total">Gesamt: ' + fmtDur(totalMins) + '</div>' : '') +
    renderEntryList(list) +
  '</div>';
}

function renderEntryList(entries, showTime) {
  if (entries.length === 0) return '<div class="empty-state"><p>Keine Einträge vorhanden.</p></div>';
  return '<div class="entries-list">' +
    entries.map(function(e) {
      var proj = DATA.projects.find(function(p) { return p.id === e.projektId; });
      var ss = stundensatzOf(proj);
      var cost = (parseFloat(e.dauer) || 0) / 60 * ss;
      var metaStr = showTime
        ? fmtDate(entryDate(e)) + (fmtTime(entryDate(e)) ? ' ' + fmtTime(entryDate(e)) : '')
        : (fmtDate(entryDate(e)) + (fmtTime(entryDate(e)) ? ' · ' + fmtTime(entryDate(e)) : ''));

      return '<div class="entry-card">' +
        '<span class="type-badge ' + typClass(e.typ) + '">' + typLabel(e.typ) + '</span>' +
        '<div class="entry-info">' +
          (proj ? '<div class="entry-project">' + esc(proj.name) + '</div>' : '') +
          '<div class="entry-meta">' + metaStr + '</div>' +
          '<div class="entry-duration">' + fmtDur(e.dauer) + '</div>' +
          (e.notiz ? '<div class="entry-note">' + esc(e.notiz) + '</div>' : '') +
        '</div>' +
        (ss > 0 ? '<div class="entry-cost">' + fmtEur(cost) + '</div>' : '') +
        '<button class="icon-btn-small delete-btn" data-action="del-entry" data-id="' + e.id + '" title="Löschen">×</button>' +
      '</div>';
    }).join('') +
  '</div>';
}

function renderBerichte() {
  var now = new Date();
  var firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  var fromDate = currentParams.fromDate || firstDay.toISOString().split('T')[0];
  var toDate = currentParams.toDate || now.toISOString().split('T')[0];

  var from = new Date(fromDate);
  var to = new Date(toDate + 'T23:59:59');

  var filtered = DATA.timeEntries.filter(function(e) {
    var d = new Date(entryDate(e));
    return d >= from && d <= to;
  });

  var totals = { dreh: 0, schnitt: 0, plan: 0, total: 0, cost: 0 };
  var byProj = {};

  filtered.forEach(function(e) {
    var m = parseFloat(e.dauer) || 0;
    var proj = DATA.projects.find(function(p) { return p.id === e.projektId; });
    var ss = stundensatzOf(proj);
    var c = (m / 60) * ss;

    totals.total += m;
    totals.cost += c;
    if (e.typ === 'dreh') totals.dreh += m;
    if (e.typ === 'schnitt') totals.schnitt += m;
    if (e.typ === 'plan') totals.plan += m;

    if (!byProj[e.projektId]) byProj[e.projektId] = { dreh: 0, schnitt: 0, plan: 0, total: 0, cost: 0 };
    byProj[e.projektId].total += m;
    byProj[e.projektId].cost += c;
    if (e.typ === 'dreh') byProj[e.projektId].dreh += m;
    if (e.typ === 'schnitt') byProj[e.projektId].schnitt += m;
    if (e.typ === 'plan') byProj[e.projektId].plan += m;
  });

  var projRows = Object.keys(byProj).map(function(pid) {
    var proj = DATA.projects.find(function(p) { return p.id === pid; });
    var k = proj ? DATA.customers.find(function(c) { return c.id === proj.kundeId; }) : null;
    var d = byProj[pid];
    return '<div class="list-item">' +
      '<div class="list-item-content">' +
        '<div class="list-item-title">' + esc(proj ? proj.name : 'Unbekannt') + '</div>' +
        '<div class="list-item-subtitle">' + esc(k ? k.name : '–') + '</div>' +
        '<div class="type-breakdown">' +
          '<span class="type-badge type-dreh-sm">D: ' + fmtDur(d.dreh) + '</span>' +
          '<span class="type-badge type-schnitt-sm">S: ' + fmtDur(d.schnitt) + '</span>' +
          '<span class="type-badge type-plan-sm">P: ' + fmtDur(d.plan) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="list-item-right">' +
        '<div class="entry-duration">' + fmtDur(d.total) + '</div>' +
        (d.cost > 0 ? '<div class="entry-cost">' + fmtEur(d.cost) + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  return '<div class="view-content">' +
    '<div class="filter-bar filter-bar-range">' +
      '<input type="date" value="' + fromDate + '" onchange="currentParams.fromDate=this.value;render()">' +
      '<span style="flex-shrink:0;color:var(--text-2)">bis</span>' +
      '<input type="date" value="' + toDate + '" onchange="currentParams.toDate=this.value;render()">' +
    '</div>' +
    '<div class="stats-grid">' +
      '<div class="stat-card stat-dreh"><div class="stat-value">' + fmtDur(totals.dreh) + '</div><div class="stat-label">Dreh</div></div>' +
      '<div class="stat-card stat-schnitt"><div class="stat-value">' + fmtDur(totals.schnitt) + '</div><div class="stat-label">Schnitt</div></div>' +
      '<div class="stat-card stat-plan"><div class="stat-value">' + fmtDur(totals.plan) + '</div><div class="stat-label">Planung</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + fmtDur(totals.total) + '</div><div class="stat-label">Gesamt</div></div>' +
    '</div>' +
    (totals.cost > 0 ? '<div class="total-cost-card"><span>Gesamtkosten</span><span>' + fmtEur(totals.cost) + '</span></div>' : '') +
    '<div class="section-title">Nach Projekt</div>' +
    (projRows ? '<div class="list">' + projRows + '</div>' : '<div class="empty-state"><p>Keine Einträge im Zeitraum.</p></div>') +
    (filtered.length > 0 ? '<button class="export-btn" onclick="exportCSV(\'' + fromDate + '\',\'' + toDate + '\')">📥 Als CSV exportieren</button>' : '') +
  '</div>';
}

// ============================================================
// TIMER
// ============================================================

function startTimer(projektId, typ) {
  if (DATA.activeTimer) {
    if (!confirm('Es läuft bereits ein Timer. Stoppen und neu starten?')) return;
    finishTimer(false);
  }
  DATA.activeTimer = { projektId: projektId, typ: typ, startTime: new Date().toISOString() };
  saveData();
  render();
}

function stopTimer() {
  finishTimer(true);
}

function finishTimer(save) {
  if (!DATA.activeTimer) return;
  if (save) {
    var start = new Date(DATA.activeTimer.startTime);
    var end = new Date();
    var dauer = Math.round((end - start) / 60000);
    if (dauer < 1) dauer = 1;
    DATA.timeEntries.push({
      id: genId(),
      projektId: DATA.activeTimer.projektId,
      typ: DATA.activeTimer.typ,
      startTime: DATA.activeTimer.startTime,
      endTime: end.toISOString(),
      datum: DATA.activeTimer.startTime,
      dauer: dauer,
      notiz: '',
      manuell: false
    });
  }
  DATA.activeTimer = null;
  clearInterval(timerInterval);
  timerInterval = null;
  saveData();
  render();
}

function startTimerDisplay() {
  if (!DATA.activeTimer) return;
  function update() {
    var el = document.getElementById('timer-display');
    if (!el) { clearInterval(timerInterval); timerInterval = null; return; }
    var secs = Math.floor((Date.now() - new Date(DATA.activeTimer.startTime)) / 1000);
    var h = Math.floor(secs / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;
    el.textContent = h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  update();
  timerInterval = setInterval(update, 1000);
}

// ============================================================
// MODALS
// ============================================================

function showModal(type, params) {
  var overlay = document.getElementById('modal-overlay');
  var mc = document.getElementById('modal-content');

  if (type === 'kunde') mc.innerHTML = buildKundeForm(params);
  else if (type === 'projekt') mc.innerHTML = buildProjektForm(params);
  else if (type === 'zeiteintrag') mc.innerHTML = buildZeitForm(params);

  overlay.classList.remove('hidden');

  var form = mc.querySelector('form');
  if (form) {
    form.onsubmit = function(e) {
      e.preventDefault();
      handleSubmit(type, form, params);
    };
    if (type === 'zeiteintrag') {
      var von = form.querySelector('[name=vonZeit]');
      var bis = form.querySelector('[name=bisZeit]');
      var dur = form.querySelector('[name=dauer]');
      function calcDur() {
        if (von && bis && von.value && bis.value) {
          var parts = function(t) { return t.split(':').map(Number); };
          var vm = parts(von.value); var bm = parts(bis.value);
          var diff = (bm[0]*60+bm[1]) - (vm[0]*60+vm[1]);
          if (diff > 0 && dur) dur.value = diff;
        }
      }
      von && von.addEventListener('change', calcDur);
      bis && bis.addEventListener('change', calcDur);
    }
    if (type === 'projekt') {
      var gb = form.querySelector('[name=gesamtbetrag]');
      var gs = form.querySelector('[name=geplanteStunden]');
      var ss = form.querySelector('[name=stundensatz]');
      var preview = form.querySelector('#ss-preview');
      function updatePreview() {
        if (!preview) return;
        var gbv = parseFloat(gb && gb.value);
        var gsv = parseFloat(gs && gs.value);
        var ssv = parseFloat(ss && ss.value);
        if (ssv > 0) {
          preview.textContent = 'Stundensatz: ' + fmtEur(ssv) + '/h (direkt)';
          preview.classList.add('visible');
        } else if (gbv > 0 && gsv > 0) {
          preview.textContent = 'Stundensatz: ' + fmtEur(gbv / gsv) + '/h (' + fmtEur(gbv) + ' ÷ ' + gsv + 'h)';
          preview.classList.add('visible');
        } else {
          preview.classList.remove('visible');
        }
      }
      gb && gb.addEventListener('input', updatePreview);
      gs && gs.addEventListener('input', updatePreview);
      ss && ss.addEventListener('input', updatePreview);
      updatePreview();
    }
  }

  mc.querySelector('.btn-cancel') && (mc.querySelector('.btn-cancel').onclick = hideModal);
  overlay.onclick = function(e) { if (e.target === overlay) hideModal(); };
}

function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function buildKundeForm(p) {
  var k = p && p.id ? DATA.customers.find(function(c) { return c.id === p.id; }) : null;
  return '<div class="modal-header"><h2>' + (k ? 'Kunde bearbeiten' : 'Neuer Kunde') + '</h2></div>' +
    '<form>' +
      (k ? '<input type="hidden" name="id" value="' + k.id + '">' : '') +
      field('text', 'name', 'Name *', k ? k.name : '', 'Firmen- oder Kontaktname', true) +
      field('email', 'email', 'E-Mail', k ? k.email : '', 'email@beispiel.de') +
      field('tel', 'telefon', 'Telefon', k ? k.telefon : '', '+49 ...') +
      '<div class="form-group"><label>Notiz</label><textarea name="notiz" placeholder="Optional...">' + esc(k ? k.notiz || '' : '') + '</textarea></div>' +
      '<div class="form-actions"><button type="button" class="btn btn-cancel">Abbrechen</button><button type="submit" class="btn btn-primary">Speichern</button></div>' +
    '</form>';
}

function buildProjektForm(p) {
  var proj = p && p.id ? DATA.projects.find(function(pr) { return pr.id === p.id; }) : null;
  var preKId = p && p.kundeId ? p.kundeId : (proj ? proj.kundeId : '');
  var opts = DATA.customers.map(function(c) {
    return '<option value="' + c.id + '"' + (preKId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
  }).join('');
  return '<div class="modal-header"><h2>' + (proj ? 'Projekt bearbeiten' : 'Neues Projekt') + '</h2></div>' +
    '<form>' +
      (proj ? '<input type="hidden" name="id" value="' + proj.id + '">' : '') +
      field('text', 'name', 'Projektname *', proj ? proj.name : '', 'z.B. Werbefilm XY', true) +
      '<div class="form-group"><label>Kunde *</label><select name="kundeId" required><option value="">– Kunde wählen –</option>' + opts + '</select></div>' +
      '<div class="form-group"><label>Beschreibung</label><textarea name="beschreibung" placeholder="Optional...">' + esc(proj ? proj.beschreibung || '' : '') + '</textarea></div>' +
      field('number', 'gesamtbetrag', 'Gesamtbudget (€)', proj ? proj.gesamtbetrag : '', 'z.B. 5000', false, 'min="0" step="0.01"') +
      field('number', 'geplanteStunden', 'Geplante Stunden', proj ? proj.geplanteStunden : '', 'z.B. 40', false, 'min="0" step="0.5"') +
      field('number', 'stundensatz', 'Direkter Stundensatz (€/h)', proj ? proj.stundensatz : '', 'z.B. 125 – hat Vorrang', false, 'min="0" step="0.01"') +
      '<div id="ss-preview" class="stundensatz-preview"></div>' +
      '<div class="form-actions"><button type="button" class="btn btn-cancel">Abbrechen</button><button type="submit" class="btn btn-primary">Speichern</button></div>' +
    '</form>';
}

function buildZeitForm(p) {
  var preId = p && p.projektId ? p.projektId : '';
  var today = new Date().toISOString().split('T')[0];
  var nowT = new Date().toTimeString().slice(0, 5);
  var opts = DATA.projects.map(function(pr) {
    var k = DATA.customers.find(function(c) { return c.id === pr.kundeId; });
    return '<option value="' + pr.id + '"' + (preId === pr.id ? ' selected' : '') + '>' + esc(pr.name) + (k ? ' (' + esc(k.name) + ')' : '') + '</option>';
  }).join('');
  return '<div class="modal-header"><h2>Zeit erfassen</h2></div>' +
    '<form>' +
      '<div class="form-group"><label>Projekt *</label><select name="projektId" required><option value="">– Projekt wählen –</option>' + opts + '</select></div>' +
      '<div class="form-group"><label>Typ *</label>' +
        '<div class="type-selector">' +
          '<label class="type-radio dreh"><input type="radio" name="typ" value="dreh" required> Dreh</label>' +
          '<label class="type-radio schnitt"><input type="radio" name="typ" value="schnitt"> Schnitt</label>' +
          '<label class="type-radio plan"><input type="radio" name="typ" value="plan"> Planung</label>' +
        '</div></div>' +
      field('date', 'datum', 'Datum *', today, '', true) +
      '<div class="form-row">' +
        field('time', 'vonZeit', 'Von', nowT, '') +
        field('time', 'bisZeit', 'Bis', '', '') +
      '</div>' +
      field('number', 'dauer', 'Dauer (Minuten) *', '', 'z.B. 90', true, 'min="1"') +
      '<div class="form-group"><label>Notiz</label><textarea name="notiz" placeholder="Was wurde gemacht?"></textarea></div>' +
      '<div class="form-actions"><button type="button" class="btn btn-cancel">Abbrechen</button><button type="submit" class="btn btn-primary">Speichern</button></div>' +
    '</form>';
}

function field(type, name, label, val, ph, req, extra) {
  return '<div class="form-group">' +
    '<label>' + label + '</label>' +
    '<input type="' + type + '" name="' + name + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '"' +
    (req ? ' required' : '') + (extra ? ' ' + extra : '') + '>' +
  '</div>';
}

// ============================================================
// FORM SUBMIT
// ============================================================

function handleSubmit(type, form, params) {
  var fd = new FormData(form);
  var d = {};
  fd.forEach(function(v, k) { d[k] = v; });

  if (type === 'kunde') {
    if (d.id) {
      var idx = DATA.customers.findIndex(function(c) { return c.id === d.id; });
      if (idx >= 0) Object.assign(DATA.customers[idx], d);
    } else {
      DATA.customers.push(Object.assign({ id: genId(), createdAt: new Date().toISOString() }, d));
    }
  } else if (type === 'projekt') {
    if (d.id) {
      var idx = DATA.projects.findIndex(function(p) { return p.id === d.id; });
      if (idx >= 0) Object.assign(DATA.projects[idx], d);
    } else {
      DATA.projects.push(Object.assign({ id: genId(), createdAt: new Date().toISOString(), status: 'aktiv' }, d));
    }
  } else if (type === 'zeiteintrag') {
    if (d.vonZeit && d.bisZeit) {
      var vp = d.vonZeit.split(':').map(Number);
      var bp = d.bisZeit.split(':').map(Number);
      var diff = (bp[0]*60+bp[1]) - (vp[0]*60+vp[1]);
      if (diff > 0) d.dauer = diff;
    }
    var st = d.datum && d.vonZeit
      ? new Date(d.datum + 'T' + d.vonZeit).toISOString()
      : new Date(d.datum + 'T00:00').toISOString();
    DATA.timeEntries.push({
      id: genId(),
      projektId: d.projektId,
      typ: d.typ,
      startTime: st,
      datum: st,
      dauer: parseFloat(d.dauer) || 0,
      notiz: d.notiz || '',
      manuell: true
    });
  }

  saveData();
  hideModal();
  render();
}

// ============================================================
// EVENT DELEGATION
// ============================================================

function attachListeners() {
  var content = document.getElementById('content');
  content.addEventListener('click', handleContentClick, { once: true });

  var kf = document.getElementById('kunde-filter');
  if (kf) kf.addEventListener('change', function() {
    currentParams.kundeId = this.value || '';
    render();
  });
}

function handleContentClick(e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  e.stopPropagation();
  var action = btn.dataset.action;
  var id = btn.dataset.id;

  if (action === 'del-entry') {
    if (confirm('Eintrag löschen?')) {
      DATA.timeEntries = DATA.timeEntries.filter(function(en) { return en.id !== id; });
      saveData(); render();
    }
  } else if (action === 'edit-kunde') {
    showModal('kunde', { id: id });
  } else if (action === 'del-kunde') {
    var pz = DATA.projects.filter(function(p) { return p.kundeId === id; }).length;
    if (confirm('Kunden löschen?' + (pz > 0 ? '\nHinweis: ' + pz + ' Projekt(e) bleiben erhalten.' : ''))) {
      DATA.customers = DATA.customers.filter(function(c) { return c.id !== id; });
      saveData(); render();
    }
  } else if (action === 'edit-projekt') {
    showModal('projekt', { id: id });
  } else if (action === 'del-projekt') {
    var ez = DATA.timeEntries.filter(function(e) { return e.projektId === id; }).length;
    if (confirm('Projekt und ' + ez + ' Zeiteintrag/Einträge löschen?')) {
      DATA.projects = DATA.projects.filter(function(p) { return p.id !== id; });
      DATA.timeEntries = DATA.timeEntries.filter(function(e) { return e.projektId !== id; });
      saveData(); render();
    }
  }
}

// ============================================================
// EXPORT
// ============================================================

function exportCSV(from, to) {
  var f = new Date(from), t = new Date(to + 'T23:59:59');
  var rows = [['Datum', 'Uhrzeit', 'Typ', 'Projekt', 'Kunde', 'Minuten', 'Stunden', 'Kosten (€)', 'Notiz']];
  DATA.timeEntries
    .filter(function(e) { var d = new Date(entryDate(e)); return d >= f && d <= t; })
    .sort(function(a, b) { return new Date(entryDate(a)) - new Date(entryDate(b)); })
    .forEach(function(e) {
      var proj = DATA.projects.find(function(p) { return p.id === e.projektId; });
      var k = proj ? DATA.customers.find(function(c) { return c.id === proj.kundeId; }) : null;
      var ss = stundensatzOf(proj);
      var mins = parseFloat(e.dauer) || 0;
      rows.push([
        fmtDate(entryDate(e)),
        fmtTime(entryDate(e)),
        typLabel(e.typ),
        proj ? proj.name : '',
        k ? k.name : '',
        mins,
        (mins / 60).toFixed(2),
        ss > 0 ? (mins / 60 * ss).toFixed(2) : '',
        e.notiz || ''
      ]);
    });
  var csv = rows.map(function(r) {
    return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\r\n');
  var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'zeiterfassung_' + from + '_' + to + '.csv';
  a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

// ============================================================
// SECURITY HELPER
// ============================================================

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// INIT
// ============================================================

function init() {
  loadData();

  document.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.addEventListener('click', function() {
      currentParams = {};
      navigate(btn.dataset.view);
    });
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function(e) { console.warn('SW:', e); });
  }

  navigate('dashboard');
}

window.navigate = navigate;
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.showModal = showModal;
window.hideModal = hideModal;
window.exportCSV = exportCSV;
window.currentParams = currentParams;

document.addEventListener('DOMContentLoaded', init);
