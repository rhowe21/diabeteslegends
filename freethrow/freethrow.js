(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Campaign config — the only part that needs editing during the campaign.
  // Paste 99Pledges URLs here once the campaign and shooter pages exist.
  // Any shooter link left blank falls back to the main pledge link.
  // ---------------------------------------------------------------------------
  var CONFIG = {
    links: {
      pledge: 'https://app.99pledges.com/fund/DiabetesLegends',  // main campaign page (search all shooters)
      signup: 'https://app.99pledges.com/fund/DiabetesLegends/addme',  // camper families create their own page
      rob:    'https://app.99pledges.com/fund/DiabetesLegends/rob-howe',
      gary:   ''
    },
    goal: 15000,
    pledged: 0,                                // update by hand from the 99Pledges dashboard
    shootTime: '2026-11-14T12:00:00-06:00'     // livestream start, Central time
  };

  // Footer year
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav toggle (same behavior as the home page)
  var navToggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.primary-nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Wire 99Pledges links. Before launch, buttons scroll to the pledge section
  // and the "opening soon" note shows.
  var live = !!CONFIG.links.pledge;
  document.querySelectorAll('[data-ft-link]').forEach(function (el) {
    var key = el.getAttribute('data-ft-link');
    if (key === 'signup' && !CONFIG.links.signup) {
      // Camper self-signup not open yet: route families to the contact form.
      el.href = '../#contact';
      return;
    }
    var url = CONFIG.links[key] || CONFIG.links.pledge;
    if (url) {
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener';
      el.addEventListener('click', function () {
        if (window.gtag) gtag('event', 'ft_click', { link: key });
      });
    } else if (el.closest('#pledge')) {
      el.classList.add('is-disabled');
      el.setAttribute('aria-disabled', 'true');
    }
  });
  var prelaunch = document.getElementById('ft-prelaunch');
  if (prelaunch && !live) prelaunch.hidden = false;

  // Goal bar
  function money(n) {
    return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: n % 1 ? 2 : 0, minimumFractionDigits: n % 1 ? 2 : 0 });
  }
  var pct = Math.min(100, Math.round((CONFIG.pledged / CONFIG.goal) * 100));
  var raisedEl = document.getElementById('ft-raised');
  var goalEl = document.getElementById('ft-goal');
  var fillEl = document.getElementById('ft-goal-fill');
  if (raisedEl) raisedEl.textContent = money(CONFIG.pledged);
  if (goalEl) goalEl.textContent = money(CONFIG.goal);
  if (fillEl) {
    requestAnimationFrame(function () { fillEl.style.width = pct + '%'; });
    fillEl.parentElement.setAttribute('aria-valuenow', String(pct));
  }

  // Countdown
  var target = new Date(CONFIG.shootTime).getTime();
  var cd = document.getElementById('ft-countdown');
  var caption = document.getElementById('ft-count-caption');
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function tick() {
    if (!cd) return;
    var diff = target - Date.now();
    if (diff <= 0) {
      cd.querySelectorAll('.ft-count-unit').forEach(function (u) { u.hidden = true; });
      if (caption) caption.textContent = 'Shot day is here. Thank you for every pledge.';
      return;
    }
    var mins = Math.floor(diff / 60000);
    cd.querySelector('[data-unit="days"]').textContent = Math.floor(mins / 1440);
    cd.querySelector('[data-unit="hours"]').textContent = pad(Math.floor((mins % 1440) / 60));
    cd.querySelector('[data-unit="minutes"]').textContent = pad(mins % 60);
    setTimeout(tick, 30000);
  }
  tick();

  // Pledge calculator
  var rate = 1;
  var makesEl = document.getElementById('ft-makes');
  var makesOut = document.getElementById('ft-makes-out');
  var totalEl = document.getElementById('ft-calc-total');
  var noteEl = document.getElementById('ft-calc-note');
  var chips = document.querySelectorAll('.ft-chip');
  function calc() {
    var makes = Number(makesEl.value);
    makesOut.textContent = makes;
    totalEl.textContent = money(rate * makes);
    noteEl.textContent = 'Most you’d give: ' + money(rate * 100) + ' (a perfect 100 for 100)';
  }
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('is-active'); c.setAttribute('aria-checked', 'false'); });
      chip.classList.add('is-active');
      chip.setAttribute('aria-checked', 'true');
      rate = Number(chip.getAttribute('data-rate'));
      calc();
    });
  });
  if (makesEl) { makesEl.addEventListener('input', calc); calc(); }
})();
