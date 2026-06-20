/* Renders the homepage Holiday Packages grid from the backend (/api/packages).
   Falls back silently to whatever static cards exist if the API is unreachable. */
(function () {
  const grid = document.getElementById('pkg-grid');
  if (!grid) return;

  const HEART = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');

  gtmApi('GET', '/packages')
    .then(list => {
      if (!Array.isArray(list) || !list.length) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--ink-500);padding:30px">No packages yet.</p>'; return; }
      grid.innerHTML = list.map(cardHtml).join('');
      wire(list);
    })
    .catch(() => { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--ink-500);padding:30px">Could not load packages.</p>'; });

  function inquiryHref(p) {
    const params = new URLSearchParams({
      pkg: p.title, place: p.place || '', price: p.price_inr,
      img: p.image || 'bg-bali', id: p.id,
    });
    if (p.duration) params.set('dur', p.duration);
    return 'pages/inquiry.html?' + params.toString();
  }

  function photo(p) {
    const img = p.image || 'bg-bali';
    return img.startsWith('bg-')
      ? `<div class="photo ${esc(img)}">`
      : `<div class="photo" style="background-image:url('${esc(img)}');background-size:cover;background-position:center">`;
  }

  function cardHtml(p) {
    const feats = (p.features || []).map(f => `<span>${esc(f)}</span>`).join('');
    const strike = p.strike_inr
      ? `<span class="strike"><span data-price-inr="${p.strike_inr}">${inr(p.strike_inr)}</span></span>`
      : '';
    return `<article class="pkg-card fade-up visible" data-cat="${esc(p.category)}">
      ${photo(p)}
        ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}
        <button class="wish" aria-label="Add to wishlist">${HEART}</button>
      </div>
      <div class="body">
        <div class="row"><span class="place">${esc(p.place || '')}</span><span class="rating">${esc(p.rating || '')}</span></div>
        <h3>${esc(p.title)}</h3>
        <div class="features">${feats}</div>
        <div class="price-row">
          <div>${strike}<div class="now"><span data-price-inr="${p.price_inr}">${inr(p.price_inr)}</span><span class="per"> /person</span></div></div>
          <a href="${inquiryHref(p)}" class="btn btn-primary btn-sm">Book Now</a>
        </div>
      </div>
    </article>`;
  }

  function wire(list) {
    // whole-card click → enquiry page (links/buttons keep their own behaviour)
    grid.querySelectorAll('.pkg-card').forEach((el, i) => {
      const href = inquiryHref(list[i]);
      el.style.cursor = 'pointer';
      el.addEventListener('click', e => { if (e.target.closest('a, button')) return; location.href = href; });
    });
    // honour a previously chosen non-INR currency for the freshly rendered prices
    const cur = localStorage.getItem('gtm-currency');
    if (cur && cur !== 'INR') {
      const rates = { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095, AED: 0.044 };
      const sym = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ' };
      grid.querySelectorAll('[data-price-inr]').forEach(el => {
        el.textContent = sym[cur] + Math.round((+el.dataset.priceInr) * rates[cur]).toLocaleString('en-IN');
      });
    }
  }
})();
