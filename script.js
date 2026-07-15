(function () {
  'use strict';

  // Footer year
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav toggle
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

  // Gallery
  var galleries = {
    dallas:  { count: 10, prefix: 'dallas',  label: 'Dallas 2025' },
    denver:  { count: 10, prefix: 'denver',  label: 'Denver 2025' },
    ffl:     { count: 10, prefix: 'ffl',     label: 'Friends for Life' },
    camp23:  { count: 10, prefix: 'camp23',  label: 'Camp 2023' }
  };

  var grid = document.getElementById('gallery-grid');
  var tabs = document.querySelectorAll('.gallery-tab');

  function renderGallery(key) {
    if (!grid || !galleries[key]) return;
    var g = galleries[key];
    var html = '';
    for (var i = 1; i <= g.count; i++) {
      var src = 'assets/photos/' + g.prefix + '/' + g.prefix + '-' + i + '.jpg';
      html += '<img src="' + src + '" alt="' + g.label + ' photo ' + i + '" loading="lazy" data-full="' + src + '" />';
    }
    grid.innerHTML = html;
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      renderGallery(tab.dataset.tab);
    });
  });

  renderGallery('dallas');

  // Lightbox
  var lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML = '<button class="lightbox-close" aria-label="Close">&times;</button><img alt="" />';
  document.body.appendChild(lightbox);
  var lbImg = lightbox.querySelector('img');
  var lbClose = lightbox.querySelector('.lightbox-close');

  if (grid) {
    grid.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.tagName === 'IMG' && t.dataset.full) {
        lbImg.src = t.dataset.full;
        lbImg.alt = t.alt;
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    });
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lbImg.src = '';
    document.body.style.overflow = '';
  }
  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });

  // Contact form — submit to Web3Forms via fetch (stays on-page, robust to
  // Cloudflare challenges that break a plain full-page POST redirect).
  var form = document.getElementById('contact-form');
  if (form) {
    var note = form.querySelector('.form-note');
    var submitBtn = form.querySelector('button[type="submit"]');

    function showError(msg) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; }
      if (note) {
        note.textContent = msg + ' Or email rob@diabeticsdoingthings.com directly.';
        note.classList.add('form-error');
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }
      if (note) { note.classList.remove('form-error'); }

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (r) {
          if (r.ok && r.data && r.data.success) {
            form.innerHTML =
              '<div class="form-success-panel">' +
              '<h3>Thanks — we got your message.</h3>' +
              '<p>We\'ll get back to you at the email you gave us, usually within 2 business days.</p>' +
              '</div>';
          } else {
            showError((r.data && r.data.message) ? r.data.message : 'Something went wrong sending your message.');
          }
        })
        .catch(function () {
          showError('Network error sending your message.');
        });
    });
  }
})();
