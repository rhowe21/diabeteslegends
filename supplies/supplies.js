(function () {
  'use strict';

  var DAY = 86400000;
  var STORE_KEY = 'dlSupplyTracker.v1';

  // Wear-duration catalog. "Early" means the change happened more than
  // EARLY_GRACE_DAYS before the supply's full wear duration was up —
  // changing a 7-day set on the morning of day 7 is still "on time".
  var EARLY_GRACE_DAYS = 0.75;

  var SETS = [
    { id: 'std3', label: 'MiniMed Quick-set / Mio (3-day)', days: 3 },
    { id: 'ext7', label: 'MiniMed Extended infusion set (7-day)', days: 7 }
  ];
  var SENSORS = [
    { id: 'simplera7', label: 'Simplera Sync sensor (7-day)', days: 7 },
    { id: 'guardian4', label: 'Guardian 4 sensor (7-day)', days: 7 },
    { id: 'instinct15', label: 'Instinct sensor by Abbott (15-day)', days: 15 }
  ];

  var KINDS = {
    site: {
      label: 'Infusion site',
      products: SETS,
      settingKey: 'setId',
      changeVerb: 'I changed my site',
      reasons: [
        'Kinked cannula',
        'Occlusion / delivery alarm',
        'Adhesive failed / fell off',
        'Site pain or bleeding',
        'Unexplained high blood sugars',
        'Pulled out by accident',
        'Other'
      ]
    },
    sensor: {
      label: 'Sensor',
      products: SENSORS,
      settingKey: 'sensorId',
      changeVerb: 'I changed my sensor',
      reasons: [
        'Sensor error / lost signal',
        'Inaccurate readings',
        'Adhesive failed / fell off',
        'Failed on insertion',
        'Pulled out by accident',
        'Other'
      ]
    }
  };

  // ---- State -------------------------------------------------------------

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to fresh state */ }
    return { settings: null, events: [] };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      alert('Could not save — this device’s storage is full. Try removing a photo from an older entry.');
      return false;
    }
  }

  function product(kind) {
    var k = KINDS[kind];
    var id = state.settings ? state.settings[k.settingKey] : null;
    for (var i = 0; i < k.products.length; i++) {
      if (k.products[i].id === id) return k.products[i];
    }
    return k.products[0];
  }

  function latestEvent(kind) {
    var found = null;
    state.events.forEach(function (ev) {
      if (ev.kind === kind && (!found || ev.at > found.at)) found = ev;
    });
    return found;
  }

  function eventById(id) {
    for (var i = 0; i < state.events.length; i++) {
      if (state.events[i].id === id) return state.events[i];
    }
    return null;
  }

  var idCounter = 0;
  function newId() {
    idCounter += 1;
    return 'ev' + Date.now().toString(36) + '-' + idCounter + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  // ---- Formatting helpers -------------------------------------------------

  function fmtDateTime(ms) {
    return new Date(ms).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function fmtWorn(ms) {
    if (ms == null) return null;
    var days = Math.floor(ms / DAY);
    var hours = Math.round((ms % DAY) / 3600000);
    if (hours === 24) { days += 1; hours = 0; }
    if (days === 0) return hours + ' hr' + (hours === 1 ? '' : 's');
    var out = days + ' day' + (days === 1 ? '' : 's');
    if (hours > 0) out += ' ' + hours + ' hr' + (hours === 1 ? '' : 's');
    return out;
  }

  function toLocalInputValue(ms) {
    var d = new Date(ms);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- Elements ------------------------------------------------------------

  var $ = function (id) { return document.getElementById(id); };

  var setupEl = $('setup');
  var trackerEl = $('tracker');
  var cards = { site: $('card-site'), sensor: $('card-sensor') };
  var historyEl = $('history');

  var modalEl = $('modal');
  var modalTitle = $('modal-title');
  var modalWhenField = $('modal-when-field');
  var modalWhen = $('modal-when');
  var modalEarlyNote = $('modal-earlynote');
  var incidentForm = $('incident-form');
  var incReason = $('inc-reason');
  var incBg = $('inc-bg');
  var incLot = $('inc-lot');
  var incSerial = $('inc-serial');
  var incNotes = $('inc-notes');
  var incPhoto = $('inc-photo');
  var incPhotoPreview = $('inc-photo-preview');
  var modalSave = $('modal-save');
  var modalCancel = $('modal-cancel');
  var modalSkip = $('modal-skip');

  // ---- Product selects ------------------------------------------------------

  function fillProductSelect(selectEl, products, selectedId) {
    selectEl.innerHTML = products.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' +
        escapeHtml(p.label) + '</option>';
    }).join('');
  }

  // ---- Setup ----------------------------------------------------------------

  function showSetup() {
    fillProductSelect($('setup-set'), SETS, 'ext7');
    fillProductSelect($('setup-sensor'), SENSORS, 'simplera7');
    setupEl.hidden = false;
    trackerEl.hidden = true;
  }

  $('setup-save').addEventListener('click', function () {
    state.settings = {
      setId: $('setup-set').value,
      sensorId: $('setup-sensor').value
    };
    var siteLast = $('setup-site-last').value;
    var sensorLast = $('setup-sensor-last').value;
    if (siteLast) addEvent('site', new Date(siteLast).getTime(), null, true);
    if (sensorLast) addEvent('sensor', new Date(sensorLast).getTime(), null, true);
    if (!save()) return;
    renderAll();
  });

  // ---- Events ----------------------------------------------------------------

  function isEarly(kind, wornMs) {
    if (wornMs == null) return false;
    var wearDays = product(kind).days;
    return wornMs < (wearDays - EARLY_GRACE_DAYS) * DAY;
  }

  // Adds a change event. Returns the event, or null if the timestamp is
  // invalid relative to the previous change of the same kind.
  function addEvent(kind, at, incident, quiet) {
    var prev = latestEvent(kind);
    if (prev && at <= prev.at) {
      if (!quiet) alert('That time is before your last logged ' + KINDS[kind].label.toLowerCase() + ' change (' + fmtDateTime(prev.at) + '). Adjust the date and time.');
      return null;
    }
    var wornMs = prev ? at - prev.at : null;
    var p = product(kind);
    var ev = {
      id: newId(),
      kind: kind,
      at: at,
      product: p.label,
      wearDays: p.days,
      wornMs: wornMs,
      early: isEarly(kind, wornMs),
      incident: incident || null
    };
    state.events.push(ev);
    return ev;
  }

  // ---- Modal -----------------------------------------------------------------

  // mode: { type: 'log', kind } | { type: 'both' } | { type: 'details', eventId }
  var modalMode = null;
  var pendingPhoto = null;
  var detailsQueue = [];

  function resetIncidentForm(kind) {
    incReason.innerHTML = '<option value="">Choose one</option>' + KINDS[kind].reasons.map(function (r) {
      return '<option>' + escapeHtml(r) + '</option>';
    }).join('');
    incBg.value = '';
    incLot.value = '';
    incSerial.value = '';
    incNotes.value = '';
    incPhoto.value = '';
    incPhotoPreview.hidden = true;
    incPhotoPreview.src = '';
    pendingPhoto = null;
  }

  function openLogModal(kind) {
    modalMode = { type: 'log', kind: kind };
    modalTitle.textContent = KINDS[kind].changeVerb;
    modalWhenField.hidden = false;
    modalWhen.value = toLocalInputValue(Date.now());
    resetIncidentForm(kind);
    updateEarlyUI();
    modalEl.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function openBothModal() {
    modalMode = { type: 'both' };
    modalTitle.textContent = 'I changed both';
    modalWhenField.hidden = false;
    modalWhen.value = toLocalInputValue(Date.now());
    resetIncidentForm('site');
    updateEarlyUI();
    modalEl.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function openDetailsModal(eventId) {
    var ev = eventById(eventId);
    if (!ev) return;
    modalMode = { type: 'details', eventId: eventId };
    modalTitle.textContent = 'Add details — ' + KINDS[ev.kind].label.toLowerCase();
    modalWhenField.hidden = true;
    resetIncidentForm(ev.kind);
    if (ev.incident) {
      incReason.value = ev.incident.reason || '';
      incBg.value = ev.incident.bg || '';
      incLot.value = ev.incident.lot || '';
      incSerial.value = ev.incident.serial || '';
      incNotes.value = ev.incident.notes || '';
      if (ev.incident.photo) {
        pendingPhoto = ev.incident.photo;
        incPhotoPreview.src = ev.incident.photo;
        incPhotoPreview.hidden = false;
      }
    }
    modalEarlyNote.hidden = false;
    modalEarlyNote.textContent = detailsNoteText(ev);
    incidentForm.hidden = false;
    modalSave.textContent = 'Save details';
    modalSkip.hidden = detailsQueue.length === 0;
    modalSkip.textContent = 'Skip this one';
    modalEl.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function detailsNoteText(ev) {
    var dayOfWear = ev.wornMs != null ? Math.floor(ev.wornMs / DAY) + 1 : null;
    var lead = dayOfWear
      ? 'That was day ' + dayOfWear + ' of a ' + ev.wearDays + '-day ' + KINDS[ev.kind].label.toLowerCase() + ' — early.'
      : 'Early change.';
    return lead + ' Grab the details now so they’re ready when you call for a replacement.';
  }

  function closeModal() {
    modalEl.hidden = true;
    document.body.style.overflow = '';
    modalMode = null;
    // If more early changes are waiting on details, keep the flow going.
    if (detailsQueue.length > 0) {
      var next = detailsQueue.shift();
      openDetailsModal(next);
    }
  }

  function updateEarlyUI() {
    if (!modalMode || modalMode.type === 'details') return;
    var at = new Date(modalWhen.value).getTime();
    if (isNaN(at)) at = Date.now();
    var earlyKinds = [];
    var checkKinds = modalMode.type === 'both' ? ['site', 'sensor'] : [modalMode.kind];
    checkKinds.forEach(function (kind) {
      var prev = latestEvent(kind);
      if (prev && at > prev.at && isEarly(kind, at - prev.at)) earlyKinds.push(kind);
    });

    if (modalMode.type === 'log' && earlyKinds.length > 0) {
      var kind = modalMode.kind;
      var prev = latestEvent(kind);
      var dayOfWear = Math.floor((at - prev.at) / DAY) + 1;
      modalEarlyNote.textContent = 'That’s day ' + dayOfWear + ' of a ' + product(kind).days +
        '-day ' + KINDS[kind].label.toLowerCase() +
        ' — early. Add the details now so you have them ready when you call for a replacement.';
      modalEarlyNote.hidden = false;
      incidentForm.hidden = false;
      modalSave.textContent = 'Log with details';
      modalSkip.hidden = false;
      modalSkip.textContent = 'Skip the details — just log the change';
    } else if (modalMode.type === 'both' && earlyKinds.length > 0) {
      var names = earlyKinds.map(function (k) { return KINDS[k].label.toLowerCase(); }).join(' and ');
      modalEarlyNote.textContent = 'Your ' + names + ' ' + (earlyKinds.length > 1 ? 'are' : 'is') +
        ' coming off early — after logging, you’ll be asked for the failure details.';
      modalEarlyNote.hidden = false;
      incidentForm.hidden = true;
      modalSave.textContent = 'Log both';
      modalSkip.hidden = true;
    } else {
      modalEarlyNote.hidden = true;
      incidentForm.hidden = true;
      modalSave.textContent = modalMode.type === 'both' ? 'Log both' : 'Log it';
      modalSkip.hidden = true;
    }
  }

  modalWhen.addEventListener('change', updateEarlyUI);
  modalWhen.addEventListener('input', updateEarlyUI);

  function collectIncident() {
    var inc = {
      reason: incReason.value || '',
      bg: incBg.value ? Number(incBg.value) : null,
      lot: incLot.value.trim(),
      serial: incSerial.value.trim(),
      notes: incNotes.value.trim(),
      photo: pendingPhoto || null
    };
    var hasContent = inc.reason || inc.bg != null || inc.lot || inc.serial || inc.notes || inc.photo;
    return hasContent ? inc : null;
  }

  function handleSave(withDetails) {
    if (!modalMode) return;

    if (modalMode.type === 'details') {
      var ev = eventById(modalMode.eventId);
      if (ev && withDetails) ev.incident = collectIncident();
      if (!save()) return;
      renderAll();
      closeModal();
      return;
    }

    var at = new Date(modalWhen.value).getTime();
    if (isNaN(at)) { alert('Pick a valid date and time.'); return; }
    if (at > Date.now() + 3600000) { alert('That time is in the future — double-check the date.'); return; }

    if (modalMode.type === 'log') {
      var incident = (withDetails && !incidentForm.hidden) ? collectIncident() : null;
      var ev2 = addEvent(modalMode.kind, at, incident, false);
      if (!ev2) return;
      if (!save()) { state.events.pop(); return; }
      renderAll();
      closeModal();
      return;
    }

    if (modalMode.type === 'both') {
      var site = addEvent('site', at, null, false);
      if (!site) return;
      var sensor = addEvent('sensor', at, null, false);
      if (!sensor) { state.events.pop(); return; }
      if (!save()) { state.events.pop(); state.events.pop(); return; }
      renderAll();
      // Queue detail capture for whichever came off early.
      detailsQueue = [];
      if (site.early) detailsQueue.push(site.id);
      if (sensor.early) detailsQueue.push(sensor.id);
      closeModal();
    }
  }

  modalSave.addEventListener('click', function () { handleSave(true); });
  modalSkip.addEventListener('click', function () { handleSave(false); });
  modalCancel.addEventListener('click', function () {
    detailsQueue = [];
    modalEl.hidden = true;
    document.body.style.overflow = '';
    modalMode = null;
  });
  modalEl.addEventListener('click', function (e) {
    if (e.target === modalEl) modalCancel.click();
  });

  // ---- Photo handling ----------------------------------------------------------

  incPhoto.addEventListener('change', function () {
    var file = incPhoto.files && incPhoto.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var maxDim = 900;
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        pendingPhoto = canvas.toDataURL('image/jpeg', 0.72);
        incPhotoPreview.src = pendingPhoto;
        incPhotoPreview.hidden = false;
      };
      img.onerror = function () { alert('Could not read that image.'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  var photoViewer = $('photo-viewer');
  var photoViewerImg = photoViewer.querySelector('img');
  photoViewer.querySelector('.photo-viewer-close').addEventListener('click', function () {
    photoViewer.hidden = true;
    photoViewerImg.src = '';
  });
  photoViewer.addEventListener('click', function (e) {
    if (e.target === photoViewer) {
      photoViewer.hidden = true;
      photoViewerImg.src = '';
    }
  });

  // ---- Status cards ---------------------------------------------------------------

  function renderCard(kind) {
    var el = cards[kind];
    var k = KINDS[kind];
    var p = product(kind);
    var last = latestEvent(kind);
    var html = '<div class="status-kind">' + escapeHtml(k.label) + '</div>' +
      '<div class="status-product">' + escapeHtml(p.label) + '</div>';

    if (!last) {
      html += '<p class="status-empty">Nothing logged yet.</p>' +
        '<button class="btn btn-primary btn-block" data-log="' + kind + '">' + escapeHtml(k.changeVerb) + '</button>';
      el.innerHTML = html;
      return;
    }

    var now = Date.now();
    var wornMs = now - last.at;
    var wearMs = p.days * DAY;
    var dayNum = Math.min(Math.floor(wornMs / DAY) + 1, 99);
    var pct = Math.max(0, Math.min(wornMs / wearMs, 1));
    var due = last.at + wearMs;

    var status, pillText;
    if (wornMs > wearMs) { status = 'over'; pillText = 'Overdue'; }
    else if (pct >= 0.8) { status = 'soon'; pillText = 'Due soon'; }
    else { status = 'ok'; pillText = 'On track'; }

    var dueText = wornMs > wearMs
      ? 'Was due ' + fmtDate(due)
      : 'Change due ' + fmtDate(due);

    html +=
      '<div class="status-day"><span class="day-num">Day ' + dayNum + '</span><span class="day-of">of ' + p.days + '</span></div>' +
      '<div class="bar"><div class="bar-fill ' + status + '" style="width:' + Math.round(pct * 100) + '%"></div></div>' +
      '<div class="status-meta"><span class="pill ' + status + '">' + pillText + '</span><span class="due">' + dueText + '</span></div>' +
      '<button class="btn btn-primary btn-block" data-log="' + kind + '">' + escapeHtml(k.changeVerb) + '</button>' +
      '<button class="linklike" data-ics="' + kind + '">+ Add change-day reminder to calendar</button>';
    el.innerHTML = html;
  }

  document.addEventListener('click', function (e) {
    var logBtn = e.target.closest('[data-log]');
    if (logBtn) { openLogModal(logBtn.getAttribute('data-log')); return; }
    var icsBtn = e.target.closest('[data-ics]');
    if (icsBtn) { downloadICS(icsBtn.getAttribute('data-ics')); return; }
  });

  $('log-both').addEventListener('click', openBothModal);

  // ---- Calendar reminder (.ics) ------------------------------------------------------

  function icsStamp(ms) {
    return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function downloadICS(kind) {
    var last = latestEvent(kind);
    if (!last) return;
    var p = product(kind);
    var due = last.at + p.days * DAY;
    if (due < Date.now()) {
      alert('You’re already past due — log the change instead.');
      return;
    }
    var title = kind === 'site' ? 'Change your infusion set' : 'Change your sensor';
    var ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Diabetes Legends//Supply Tracker//EN',
      'BEGIN:VEVENT',
      'UID:' + newId() + '@diabeteslegends.org',
      'DTSTAMP:' + icsStamp(Date.now()),
      'DTSTART:' + icsStamp(due),
      'DTEND:' + icsStamp(due + 1800000),
      'SUMMARY:' + title + ' (' + p.label.replace(/,/g, '\\,') + ')',
      'DESCRIPTION:Logged in the Diabetes Legends Supply Tracker — diabeteslegends.org/supplies/',
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + title,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    var blob = new Blob([ics], { type: 'text/calendar' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (kind === 'site' ? 'change-site' : 'change-sensor') + '-reminder.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  // ---- History -------------------------------------------------------------------------

  function renderHistory() {
    var events = state.events.slice().sort(function (a, b) { return b.at - a.at; });
    if (events.length === 0) {
      historyEl.innerHTML = '<p class="history-empty">Your changes will show up here.</p>';
      return;
    }
    historyEl.innerHTML = events.map(function (ev) {
      var k = KINDS[ev.kind];
      var dayOfWear = ev.wornMs != null ? Math.floor(ev.wornMs / DAY) + 1 : null;
      var badge = ev.wornMs == null ? '' :
        (ev.early
          ? '<span class="badge early">Early — day ' + dayOfWear + ' of ' + ev.wearDays + '</span>'
          : '<span class="badge ontime">Full wear</span>');
      var html = '<div class="history-item" data-id="' + ev.id + '">' +
        '<div class="history-top">' +
        '<span class="history-kind">' + escapeHtml(k.label) + '</span>' +
        '<span class="history-date">' + fmtDateTime(ev.at) + '</span>' +
        badge +
        '</div>' +
        '<p class="history-product">' + escapeHtml(ev.product) + '</p>';
      if (ev.wornMs != null) {
        html += '<p class="history-worn">Previous one worn ' + fmtWorn(ev.wornMs) + '</p>';
      }
      if (ev.incident) {
        var inc = ev.incident;
        var parts = [];
        if (inc.reason) parts.push('<strong>' + escapeHtml(inc.reason) + '</strong>');
        if (inc.bg != null) parts.push('BG ' + inc.bg + ' mg/dL');
        if (inc.lot) parts.push('Lot ' + escapeHtml(inc.lot));
        if (inc.serial) parts.push('SN ' + escapeHtml(inc.serial));
        if (inc.notes) parts.push(escapeHtml(inc.notes));
        html += '<div class="history-incident">' + parts.join(' · ') + '</div>';
        if (inc.photo) {
          html += '<img class="history-photo" src="' + inc.photo + '" alt="Attached photo" data-photo="1" />';
        }
      }
      html += '<div class="history-actions">';
      if (ev.early || ev.incident) {
        html += '<button class="linklike" data-copy="' + ev.id + '">Copy report</button>';
        html += '<button class="linklike" data-details="' + ev.id + '">' + (ev.incident ? 'Edit details' : 'Add details') + '</button>';
      }
      html += '<button class="linklike danger" data-delete="' + ev.id + '">Delete</button>' +
        '</div></div>';
      return html;
    }).join('');
  }

  historyEl.addEventListener('click', function (e) {
    var t = e.target;
    if (t.dataset.photo) {
      photoViewerImg.src = t.src;
      photoViewer.hidden = false;
      return;
    }
    var copyBtn = t.closest('[data-copy]');
    if (copyBtn) { copyReport(copyBtn.getAttribute('data-copy'), copyBtn); return; }
    var detailsBtn = t.closest('[data-details]');
    if (detailsBtn) { detailsQueue = []; openDetailsModal(detailsBtn.getAttribute('data-details')); return; }
    var deleteBtn = t.closest('[data-delete]');
    if (deleteBtn) {
      if (!confirm('Delete this entry? This can’t be undone.')) return;
      var id = deleteBtn.getAttribute('data-delete');
      state.events = state.events.filter(function (ev) { return ev.id !== id; });
      if (!save()) return;
      renderAll();
    }
  });

  // ---- Copy report -----------------------------------------------------------------------

  function buildReport(ev) {
    var k = KINDS[ev.kind];
    var dayOfWear = ev.wornMs != null ? Math.floor(ev.wornMs / DAY) + 1 : null;
    var lines = [
      'SUPPLY FAILURE REPORT',
      'Product: ' + ev.product,
      'Removed/failed: ' + fmtDateTime(ev.at) + (dayOfWear ? ' (day ' + dayOfWear + ' of ' + ev.wearDays + ')' : ''),
      'Worn for: ' + (fmtWorn(ev.wornMs) || 'unknown')
    ];
    var inc = ev.incident || {};
    if (inc.reason) lines.push('What happened: ' + inc.reason);
    if (inc.bg != null) lines.push('Blood sugar at the time: ' + inc.bg + ' mg/dL');
    if (inc.lot) lines.push('Lot #: ' + inc.lot);
    if (inc.serial) lines.push('Serial/REF: ' + inc.serial);
    if (inc.notes) lines.push('Notes: ' + inc.notes);
    lines.push('');
    lines.push('Also have ready: pump serial number, date of birth, shipping address.');
    lines.push('— logged with the Diabetes Legends Supply Tracker');
    return lines.join('\n');
  }

  function copyReport(eventId, btn) {
    var ev = eventById(eventId);
    if (!ev) return;
    var text = buildReport(ev);
    var done = function () {
      var old = btn.textContent;
      btn.textContent = 'Copied ✓';
      setTimeout(function () { btn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { alert(text); }
    ta.remove();
  }

  // ---- Settings & data ------------------------------------------------------------------------

  function renderSettings() {
    fillProductSelect($('settings-set'), SETS, state.settings.setId);
    fillProductSelect($('settings-sensor'), SENSORS, state.settings.sensorId);
  }

  $('settings-set').addEventListener('change', function () {
    state.settings.setId = this.value;
    if (save()) renderAll();
  });
  $('settings-sensor').addEventListener('change', function () {
    state.settings.sensorId = this.value;
    if (save()) renderAll();
  });

  $('export-data').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'supply-tracker-data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  });

  $('clear-data').addEventListener('click', function () {
    if (!confirm('Erase all supply-tracker data on this device? Export first if you want a copy.')) return;
    localStorage.removeItem(STORE_KEY);
    state = { settings: null, events: [] };
    renderAll();
  });

  // ---- Render ------------------------------------------------------------------------------------

  function renderAll() {
    if (!state.settings) {
      showSetup();
      return;
    }
    setupEl.hidden = true;
    trackerEl.hidden = false;
    renderCard('site');
    renderCard('sensor');
    renderHistory();
    renderSettings();
  }

  renderAll();

  // Keep the day counters fresh if the tab stays open.
  setInterval(function () {
    if (state.settings) {
      renderCard('site');
      renderCard('sensor');
    }
  }, 60000);
})();
