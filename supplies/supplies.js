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

  var LOCATIONS = [
    'Abdomen — left', 'Abdomen — right',
    'Upper thigh — left', 'Upper thigh — right',
    'Lower back — left', 'Lower back — right',
    'Upper arm — left', 'Upper arm — right',
    'Upper buttock — left', 'Upper buttock — right',
    'Other'
  ];

  var KINDS = {
    site: {
      label: 'Infusion site',
      stashLabel: 'Infusion sets',
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
      stashLabel: 'Sensors',
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

  var TRIP_EXTRAS = [
    { key: 'insulin', label: 'Insulin — plus a backup vial or pen' },
    { key: 'reservoirs', label: 'Reservoirs & tubing' },
    { key: 'wipes', label: 'Alcohol wipes / skin prep' },
    { key: 'syringes', label: 'Backup syringes or pen needles' },
    { key: 'snacks', label: 'Low snacks for the travel day' },
    { key: 'meter', label: 'Backup meter & strips' }
  ];

  // ---- State -------------------------------------------------------------

  function migrate(s) {
    if (!s.events) s.events = [];
    if (!s.inventory) s.inventory = {};
    ['site', 'sensor'].forEach(function (k) {
      if (!s.inventory[k]) s.inventory[k] = { count: null, expiry: null };
    });
    if (s.trip === undefined) s.trip = null;
    if (s.settings && (s.settings.leadDays == null || isNaN(s.settings.leadDays))) {
      s.settings.leadDays = 14;
    }
    return s;
  }

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { /* fall through to fresh state */ }
    return migrate({ settings: null, events: [] });
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

  function lastLocation() {
    var events = state.events.filter(function (ev) { return ev.kind === 'site' && ev.location; });
    events.sort(function (a, b) { return b.at - a.at; });
    return events.length ? events[0].location : null;
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

  function fmtDateLong(ms) {
    return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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

  // 'YYYY-MM' -> timestamp of the last minute of that month, or null.
  function monthEnd(val) {
    var m = /^(\d{4})-(\d{2})$/.exec(val || '');
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]), 0, 23, 59).getTime();
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
  var stashRowsEl = $('stash-rows');
  var tripStartEl = $('trip-start');
  var tripEndEl = $('trip-end');
  var tripOutputEl = $('trip-output');

  var modalEl = $('modal');
  var modalTitle = $('modal-title');
  var modalWhenField = $('modal-when-field');
  var modalWhen = $('modal-when');
  var modalEarlyNote = $('modal-earlynote');
  var locationField = $('log-location-field');
  var locationSelect = $('log-location');
  var locationHint = $('location-hint');
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
      sensorId: $('setup-sensor').value,
      leadDays: 14
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
    // Each fresh change consumes one spare from the stash (when counted).
    var inv = state.inventory[kind];
    if (!quiet && inv && inv.count != null && inv.count !== '' && Number(inv.count) > 0) {
      inv.count = Number(inv.count) - 1;
      ev.consumedStock = true;
    }
    state.events.push(ev);
    return ev;
  }

  function removeEvent(id) {
    var ev = eventById(id);
    if (!ev) return;
    if (ev.consumedStock) {
      var inv = state.inventory[ev.kind];
      if (inv && inv.count != null && inv.count !== '') inv.count = Number(inv.count) + 1;
    }
    state.events = state.events.filter(function (e) { return e.id !== id; });
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

  function setupLocationField(show) {
    if (!show) { locationField.hidden = true; return; }
    locationSelect.innerHTML = '<option value="">Choose a spot</option>' + LOCATIONS.map(function (l) {
      return '<option>' + escapeHtml(l) + '</option>';
    }).join('');
    locationHint.hidden = true;
    locationField.hidden = false;
  }

  locationSelect.addEventListener('change', function () {
    var prev = lastLocation();
    locationHint.hidden = !(locationSelect.value && prev && locationSelect.value === prev);
  });

  function openLogModal(kind) {
    modalMode = { type: 'log', kind: kind };
    modalTitle.textContent = KINDS[kind].changeVerb;
    modalWhenField.hidden = false;
    modalWhen.value = toLocalInputValue(Date.now());
    setupLocationField(kind === 'site');
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
    setupLocationField(true);
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
    setupLocationField(false);
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

    var location = locationField.hidden ? '' : locationSelect.value;

    if (modalMode.type === 'log') {
      var incident = (withDetails && !incidentForm.hidden) ? collectIncident() : null;
      var ev2 = addEvent(modalMode.kind, at, incident, false);
      if (!ev2) return;
      if (modalMode.kind === 'site' && location) ev2.location = location;
      if (!save()) { removeEvent(ev2.id); return; }
      renderAll();
      closeModal();
      return;
    }

    if (modalMode.type === 'both') {
      var site = addEvent('site', at, null, false);
      if (!site) return;
      if (location) site.location = location;
      var sensor = addEvent('sensor', at, null, false);
      if (!sensor) { removeEvent(site.id); return; }
      if (!save()) { removeEvent(sensor.id); removeEvent(site.id); return; }
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
      (kind === 'site' && last.location ? '<div class="status-loc">Current spot: ' + escapeHtml(last.location) + '</div>' : '') +
      '<button class="btn btn-primary btn-block" data-log="' + kind + '">' + escapeHtml(k.changeVerb) + '</button>' +
      '<button class="linklike" data-ics="' + kind + '">+ Add change-day reminder to calendar</button>';
    el.innerHTML = html;
  }

  document.addEventListener('click', function (e) {
    var logBtn = e.target.closest('[data-log]');
    if (logBtn) { openLogModal(logBtn.getAttribute('data-log')); return; }
    var icsBtn = e.target.closest('[data-ics]');
    if (icsBtn) { downloadChangeICS(icsBtn.getAttribute('data-ics')); return; }
    var reorderBtn = e.target.closest('[data-reorder-ics]');
    if (reorderBtn) { downloadReorderICS(reorderBtn.getAttribute('data-reorder-ics')); return; }
  });

  $('log-both').addEventListener('click', openBothModal);

  // ---- Stash (inventory) ------------------------------------------------------------

  // Days of coverage left: what's still on your body plus every unopened spare.
  function coverageInfo(kind) {
    var inv = state.inventory[kind];
    if (!inv || inv.count == null || inv.count === '') return null;
    var count = Math.max(0, Number(inv.count));
    var p = product(kind);
    var now = Date.now();
    var ms = 0;
    var last = latestEvent(kind);
    if (last) ms += Math.max(0, last.at + p.days * DAY - now);
    ms += count * p.days * DAY;
    var runout = now + ms;
    var reorderBy = runout - state.settings.leadDays * DAY;
    return { count: count, runout: runout, reorderBy: reorderBy, needsReorder: now >= reorderBy };
  }

  function renderStash() {
    stashRowsEl.innerHTML = ['site', 'sensor'].map(function (kind) {
      var k = KINDS[kind];
      var p = product(kind);
      var inv = state.inventory[kind];
      var cov = coverageInfo(kind);

      var forecast;
      if (!cov) {
        forecast = '<p class="inv-forecast muted-line">Set a count to see your run-out date.</p>';
      } else if (cov.count === 0) {
        forecast = '<p class="inv-forecast"><span class="pill over">Out of spares</span> Reorder now.</p>';
      } else {
        var line = 'Covers you through ~<strong>' + fmtDateLong(cov.runout) + '</strong>. ';
        line += cov.needsReorder
          ? '<span class="pill soon">Time to reorder</span>'
          : 'Reorder by ' + fmtDateLong(cov.reorderBy) + '.';
        forecast = '<p class="inv-forecast">' + line + '</p>';
        var expEnd = monthEnd(inv.expiry);
        if (expEnd && expEnd < cov.runout) {
          forecast += '<p class="inv-forecast inv-warn">Some of these may expire before you use them all — check the boxes.</p>';
        }
      }

      var reorderLink = (cov && cov.count > 0 && !cov.needsReorder)
        ? '<button class="linklike" data-reorder-ics="' + kind + '">+ Reorder reminder to calendar</button>'
        : '';

      return '<div class="inv-row">' +
        '<div class="inv-head"><span class="inv-name">' + escapeHtml(k.stashLabel) + '</span>' +
        '<span class="inv-product">' + escapeHtml(p.label) + '</span></div>' +
        '<div class="inv-counter">' +
        '<button class="inv-btn" data-inv-dec="' + kind + '" aria-label="One fewer">−</button>' +
        '<input type="number" class="inv-count" data-inv-count="' + kind + '" min="0" max="999" inputmode="numeric" value="' + (inv.count == null ? '' : inv.count) + '" placeholder="–" />' +
        '<button class="inv-btn" data-inv-inc="' + kind + '" aria-label="One more">+</button>' +
        '<span class="inv-onhand">on hand</span>' +
        '</div>' +
        forecast +
        '<label class="field inv-expiry"><span>Earliest expiration <em>(optional)</em></span>' +
        '<input type="month" data-inv-exp="' + kind + '" value="' + (inv.expiry || '') + '" /></label>' +
        reorderLink +
        '</div>';
    }).join('');
  }

  stashRowsEl.addEventListener('click', function (e) {
    var dec = e.target.closest('[data-inv-dec]');
    var inc = e.target.closest('[data-inv-inc]');
    if (!dec && !inc) return;
    var kind = (dec || inc).getAttribute(dec ? 'data-inv-dec' : 'data-inv-inc');
    var inv = state.inventory[kind];
    var current = (inv.count == null || inv.count === '') ? 0 : Number(inv.count);
    inv.count = Math.max(0, current + (inc ? 1 : -1));
    if (save()) { renderStash(); renderTrip(); }
  });

  stashRowsEl.addEventListener('change', function (e) {
    var countInput = e.target.closest('[data-inv-count]');
    if (countInput) {
      var kind = countInput.getAttribute('data-inv-count');
      var v = countInput.value;
      state.inventory[kind].count = v === '' ? null : Math.max(0, Math.min(999, Math.round(Number(v)) || 0));
      if (save()) { renderStash(); renderTrip(); }
      return;
    }
    var expInput = e.target.closest('[data-inv-exp]');
    if (expInput) {
      var kind2 = expInput.getAttribute('data-inv-exp');
      state.inventory[kind2].expiry = expInput.value || null;
      if (save()) { renderStash(); renderTrip(); }
    }
  });

  // ---- Trip planner ------------------------------------------------------------------

  function tripPlanFor(kind, startMs, endMs) {
    var p = product(kind);
    var wearMs = p.days * DAY;
    var last = latestEvent(kind);
    var t;
    if (last) {
      t = last.at + wearMs;
      while (t < startMs) t += wearMs; // first change due on/after departure
    } else {
      t = startMs + wearMs; // assume you leave with a fresh one
    }
    var changes = 0;
    var firstDue = null;
    while (t <= endMs) {
      if (firstDue === null) firstDue = t;
      changes++;
      t += wearMs;
    }
    return { product: p, changes: changes, firstDue: firstDue, pack: changes + 1 };
  }

  function renderTrip() {
    var trip = state.trip;
    tripStartEl.value = trip ? trip.start : '';
    tripEndEl.value = trip ? trip.end : '';

    if (!trip || !trip.start || !trip.end) {
      tripOutputEl.innerHTML = '<p class="trip-note">Nothing planned. Add your dates above.</p>';
      return;
    }
    var startMs = new Date(trip.start + 'T00:00').getTime();
    var endMs = new Date(trip.end + 'T23:59').getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) {
      tripOutputEl.innerHTML = '<p class="trip-note">Those dates don’t look right — the return should be after the departure.</p>';
      return;
    }

    var nights = Math.round((new Date(trip.end + 'T12:00') - new Date(trip.start + 'T12:00')) / DAY);
    var html = '<p class="trip-note">' + fmtDate(startMs) + ' → ' + fmtDate(endMs) +
      (nights > 0 ? ' · ' + nights + ' night' + (nights === 1 ? '' : 's') : '') + '</p>';

    var packItems = [];
    ['site', 'sensor'].forEach(function (kind) {
      var plan = tripPlanFor(kind, startMs, endMs);
      var k = KINDS[kind];
      var line = '<strong>' + plan.pack + '× ' + escapeHtml(k.stashLabel.toLowerCase()) + '</strong> — ';
      line += plan.changes > 0
        ? plan.changes + ' scheduled change' + (plan.changes === 1 ? '' : 's') +
          ' (first due ' + fmtDate(plan.firstDue) + '), plus a spare.'
        : 'no scheduled change during the trip, but always pack a spare.';

      var inv = state.inventory[kind];
      if (inv && inv.count != null && inv.count !== '' && plan.pack > Number(inv.count)) {
        line += ' <span class="bad">You only have ' + Number(inv.count) + ' on hand — reorder before you go.</span>';
      }
      var expEnd = monthEnd(inv && inv.expiry);
      if (expEnd && expEnd <= endMs) {
        line += ' <span class="warn">Some expire during or before the trip — check dates when packing.</span>';
      }
      html += '<div class="trip-line">' + line + '</div>';
      packItems.push({ key: 'pack-' + kind, label: plan.pack + '× ' + plan.product.label });
    });

    var checked = trip.checked || {};
    html += '<ul class="checklist">' + packItems.concat(TRIP_EXTRAS).map(function (item) {
      return '<li><label><input type="checkbox" data-check="' + item.key + '"' +
        (checked[item.key] ? ' checked' : '') + ' /><span>' + escapeHtml(item.label) + '</span></label></li>';
    }).join('') + '</ul>';

    html += '<button class="linklike" id="trip-clear">Clear this trip</button>';
    tripOutputEl.innerHTML = html;
  }

  function onTripDateChange() {
    var start = tripStartEl.value;
    var end = tripEndEl.value;
    if (!start && !end) { state.trip = null; }
    else {
      if (!state.trip) state.trip = { start: '', end: '', checked: {} };
      state.trip.start = start;
      state.trip.end = end;
    }
    if (save()) renderTrip();
  }
  tripStartEl.addEventListener('change', onTripDateChange);
  tripEndEl.addEventListener('change', onTripDateChange);

  tripOutputEl.addEventListener('change', function (e) {
    var box = e.target.closest('[data-check]');
    if (!box || !state.trip) return;
    if (!state.trip.checked) state.trip.checked = {};
    state.trip.checked[box.getAttribute('data-check')] = box.checked;
    save();
  });

  tripOutputEl.addEventListener('click', function (e) {
    if (e.target.id === 'trip-clear') {
      state.trip = null;
      if (save()) renderTrip();
    }
  });

  // ---- Calendar reminders (.ics) ------------------------------------------------------

  function icsStamp(ms) {
    return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function downloadICSFile(filename, title, startMs, description) {
    var ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Diabetes Legends//Supply Tracker//EN',
      'BEGIN:VEVENT',
      'UID:' + newId() + '@diabeteslegends.org',
      'DTSTAMP:' + icsStamp(Date.now()),
      'DTSTART:' + icsStamp(startMs),
      'DTEND:' + icsStamp(startMs + 1800000),
      'SUMMARY:' + title.replace(/,/g, '\\,'),
      'DESCRIPTION:' + description,
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + title.replace(/,/g, '\\,'),
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    var blob = new Blob([ics], { type: 'text/calendar' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  function downloadChangeICS(kind) {
    var last = latestEvent(kind);
    if (!last) return;
    var p = product(kind);
    var due = last.at + p.days * DAY;
    if (due < Date.now()) {
      alert('You’re already past due — log the change instead.');
      return;
    }
    var title = (kind === 'site' ? 'Change your infusion set' : 'Change your sensor') + ' (' + p.label + ')';
    downloadICSFile(
      (kind === 'site' ? 'change-site' : 'change-sensor') + '-reminder.ics',
      title, due,
      'Logged in the Diabetes Legends Supply Tracker — diabeteslegends.org/supplies/'
    );
  }

  function downloadReorderICS(kind) {
    var cov = coverageInfo(kind);
    if (!cov || cov.reorderBy <= Date.now()) return;
    var title = 'Reorder ' + KINDS[kind].stashLabel.toLowerCase() + ' (' + product(kind).label + ')';
    downloadICSFile(
      'reorder-' + kind + '-reminder.ics',
      title, cov.reorderBy,
      'Projected run-out: ' + fmtDateLong(cov.runout) + ' — Diabetes Legends Supply Tracker'
    );
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
      if (ev.location) {
        html += '<p class="history-worn">New site: ' + escapeHtml(ev.location) + '</p>';
      }
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
      removeEvent(deleteBtn.getAttribute('data-delete'));
      if (!save()) return;
      renderAll();
    }
  });

  // ---- Copy report -----------------------------------------------------------------------

  function buildReport(ev) {
    var dayOfWear = ev.wornMs != null ? Math.floor(ev.wornMs / DAY) + 1 : null;
    var lines = [
      'SUPPLY FAILURE REPORT',
      'Product: ' + ev.product,
      'Removed/failed: ' + fmtDateTime(ev.at) + (dayOfWear ? ' (day ' + dayOfWear + ' of ' + ev.wearDays + ')' : ''),
      'Worn for: ' + (fmtWorn(ev.wornMs) || 'unknown')
    ];
    if (ev.location) lines.push('Site location: ' + ev.location);
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
    $('settings-lead').value = state.settings.leadDays;
  }

  $('settings-set').addEventListener('change', function () {
    state.settings.setId = this.value;
    if (save()) renderAll();
  });
  $('settings-sensor').addEventListener('change', function () {
    state.settings.sensorId = this.value;
    if (save()) renderAll();
  });
  $('settings-lead').addEventListener('change', function () {
    var v = Math.max(3, Math.min(60, Math.round(Number(this.value)) || 14));
    state.settings.leadDays = v;
    this.value = v;
    if (save()) { renderStash(); renderTrip(); }
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
    state = migrate({ settings: null, events: [] });
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
    renderStash();
    renderTrip();
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
