/* GoTravel Mart — interactions */

document.addEventListener('DOMContentLoaded', () => {

  /* -------- Mobile nav toggle -------- */
  const toggle = document.querySelector('.mobile-toggle');
  const nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }

  /* -------- Dark mode -------- */
  const darkBtn = document.querySelector('[data-toggle-dark]');
  const stored = localStorage.getItem('gtm-theme');
  if (stored === 'dark') document.body.classList.add('dark');
  if (darkBtn) {
    darkBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('gtm-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    });
  }

  /* -------- Currency switcher -------- */
  const currencySel = document.querySelector('[data-currency]');
  if (currencySel) {
    const stored = localStorage.getItem('gtm-currency') || 'INR';
    currencySel.value = stored;
    applyCurrency(stored);
    currencySel.addEventListener('change', e => {
      localStorage.setItem('gtm-currency', e.target.value);
      applyCurrency(e.target.value);
    });
  }
  function applyCurrency(curr) {
    const rates = { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095, AED: 0.044 };
    const symbol = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ' };
    document.querySelectorAll('[data-price-inr]').forEach(el => {
      const base = +el.dataset.priceInr;
      const out = Math.round(base * rates[curr]);
      el.textContent = symbol[curr] + out.toLocaleString('en-IN');
    });
  }

  /* -------- Search widget tabs (Flight/Hotel/Package) -------- */
  document.querySelectorAll('.search-tabs').forEach(group => {
    group.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  });

  /* -------- Package category tabs -------- */
  document.querySelectorAll('.pkg-tabs').forEach(group => {
    group.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        const grid = document.querySelector('#pkg-grid');
        if (!grid) return;
        grid.querySelectorAll('.pkg-card').forEach(c => {
          c.style.display = (cat === 'all' || c.dataset.cat === cat) ? '' : 'none';
        });
      });
    });
  });

  /* -------- Wishlist toggle -------- */
  document.body.addEventListener('click', e => {
    const w = e.target.closest('.wish');
    if (w) { e.preventDefault(); w.classList.toggle('active'); }
  });

  /* -------- Carousel scroll -------- */
  document.querySelectorAll('.carousel-wrap').forEach(wrap => {
    const c = wrap.querySelector('.carousel');
    const prev = wrap.querySelector('.prev');
    const next = wrap.querySelector('.next');
    if (!c) return;
    const scrollBy = () => Math.min(660, c.clientWidth * .8);
    if (prev) prev.addEventListener('click', () => c.scrollBy({ left: -scrollBy(), behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => c.scrollBy({ left: scrollBy(), behavior: 'smooth' }));
  });

  /* -------- Counters -------- */
  const counters = document.querySelectorAll('[data-count]');
  const animateCount = el => {
    const target = +el.dataset.count;
    const dur = 1400; const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * ease).toLocaleString('en-IN') + (el.dataset.suffix || '');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { animateCount(en.target); counterObserver.unobserve(en.target); }
    });
  }, { threshold: .4 });
  counters.forEach(c => counterObserver.observe(c));

  /* -------- Fade up on scroll -------- */
  const fade = document.querySelectorAll('.fade-up');
  const fadeOb = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); fadeOb.unobserve(e.target); } });
  }, { threshold: .12 });
  fade.forEach(f => fadeOb.observe(f));

  /* -------- AI recommendation widget -------- */
  const aiBtn = document.querySelector('.ai-widget');
  const aiPanel = document.querySelector('.ai-panel');
  if (aiBtn && aiPanel) {
    aiBtn.addEventListener('click', () => aiPanel.classList.toggle('open'));
    aiPanel.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        aiPanel.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
  }

  /* -------- Forms — friendly demo handler -------- */
  document.querySelectorAll('form[data-demo]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"], .btn-primary');
      const orig = btn ? btn.innerHTML : '';
      if (btn) { btn.innerHTML = '✓ Submitted'; btn.style.background = 'var(--teal)'; }
      form.reset();
      setTimeout(() => { if (btn) { btn.innerHTML = orig; btn.style.background = ''; } }, 2200);
    });
  });

});
