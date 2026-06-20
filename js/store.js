/* GoTravel Mart — universal data client.
 * Tries the real backend (/api/*). If there's no backend (e.g. opened on
 * GitHub Pages / static host / file://), it transparently falls back to a
 * localStorage-backed store with demo data, so every page still works.
 *
 * Usage:  const data = await gtmApi('GET', '/packages');
 *         await gtmApi('POST', '/admin/packages', {...});
 */
(function () {
  'use strict';

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ---- seed packages (same as the backend's first-run seed) ---- */
  const SEED = [
    { title: 'Bali Honeymoon Escape', place: 'Bali, Indonesia', category: 'international', price_inr: 42999, strike_inr: 55999, image: 'bg-bali', duration: '6N / 7D', rating: '★ 4.9 (1.2k)', tag: 'Bestseller', features: ['🌙 6N / 7D', '🍽 Meals incl.', '🛏 4★ Stays'] },
    { title: 'Dubai Luxury & Desert', place: 'Dubai, UAE', category: 'international', price_inr: 55999, strike_inr: 72000, image: 'bg-dubai', duration: '5N / 6D', rating: '★ 4.8 (980)', tag: '-22%', features: ['🌙 5N / 6D', '🏜 Safari', '🛏 5★ Stays'] },
    { title: 'Maldives Overwater Villas', place: 'Maldives', category: 'international', price_inr: 89999, strike_inr: 120000, image: 'bg-maldives', duration: '4N / 5D', rating: '★ 5.0 (640)', tag: 'Honeymoon', features: ['🌙 4N / 5D', '🐠 Snorkel', '🛥 Speedboat'] },
    { title: 'Kerala Backwaters Family Tour', place: 'Kerala, India', category: 'domestic', price_inr: 18999, strike_inr: 24000, image: 'bg-kerala', duration: '5N / 6D', rating: '★ 4.9 (1.5k)', tag: 'Family', features: ['🌙 5N / 6D', '🛶 Houseboat', '👨‍👩‍👧 Family'] },
    { title: 'Paradise on Earth — Kashmir', place: 'Kashmir, India', category: 'domestic', price_inr: 22999, strike_inr: 32000, image: 'bg-kashmir', duration: '5N / 6D', rating: '★ 4.8 (820)', tag: 'New', features: ['🌙 5N / 6D', '⛷ Gondola', '🚣 Shikara'] },
    { title: 'Thailand Bangkok + Phuket', place: 'Thailand', category: 'international', price_inr: 38999, strike_inr: 48000, image: 'bg-thailand', duration: '6N / 7D', rating: '★ 4.7 (2.1k)', tag: 'Hot Deal', features: ['🌙 6N / 7D', '🏝 2 Islands', '🛏 4★'] },
    { title: 'Swiss Alps Romance', place: 'Switzerland', category: 'international', price_inr: 129999, strike_inr: 160000, image: 'bg-switzerland', duration: '8N / 9D', rating: '★ 4.9 (540)', tag: 'Premium', features: ['🌙 8N / 9D', '🚞 Glacier Express', '🛏 4★'] },
    { title: 'Goa Beach Getaway', place: 'Goa, India', category: 'domestic', price_inr: 12999, strike_inr: 18000, image: 'bg-goa', duration: '3N / 4D', rating: '★ 4.6 (3.4k)', tag: 'Weekend', features: ['🌙 3N / 4D', '🏖 Beach', '🍹 Cruise'] },
  ];
  function packages() {
    let p = read('gtm_pkgs', null);
    if (!p) { p = SEED.map((s, i) => ({ id: i + 1, active: true, sort: i, description: '', ...s })); write('gtm_pkgs', p); }
    return p;
  }
  const savePackages = p => write('gtm_pkgs', p);

  /* ---- demo flights / hotels / locations (client-side) ---- */
  const LOCS = [
    { iata: 'DEL', city: 'New Delhi' }, { iata: 'BOM', city: 'Mumbai' }, { iata: 'BLR', city: 'Bengaluru' },
    { iata: 'GOI', city: 'Goa' }, { iata: 'MAA', city: 'Chennai' }, { iata: 'CCU', city: 'Kolkata' },
    { iata: 'HYD', city: 'Hyderabad' }, { iata: 'DXB', city: 'Dubai' }, { iata: 'SIN', city: 'Singapore' }, { iata: 'BKK', city: 'Bangkok' },
  ];
  const AIRLINES = [['6E', 'IndiGo'], ['AI', 'Air India'], ['UK', 'Vistara'], ['SG', 'SpiceJet']];
  const isoDur = m => `${Math.floor(m / 60)}h ${m % 60}m`;
  function demoFlights(o = 'DEL', d = 'BOM', date, adults = 1) {
    const day = date || new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    return Array.from({ length: 6 }, (_, i) => {
      const [code, name] = AIRLINES[i % 4];
      const durMin = 95 + (i % 3) * 40, stops = i % 3 === 2 ? 1 : 0;
      const dep = `${day}T${String(6 + i * 2).padStart(2, '0')}:${i % 2 ? '30' : '05'}:00`;
      const arr = new Date(new Date(dep).getTime() + durMin * 6e4).toISOString().slice(0, 19);
      return { id: 'fl' + i, price: { amount: (3200 + i * 850 + (stops ? -400 : 0)) * adults, currency: 'INR' }, airline: name, airlineCode: code, flightNumber: code + (100 + i * 7), from: o, to: d, departAt: dep, arriveAt: arr, stops, duration: isoDur(durMin), segments: [], raw: null };
    }).sort((a, b) => a.price.amount - b.price.amount);
  }
  function demoHotels(city = 'GOI', ci, co) {
    const n = [['Seaside Grand Resort', '5'], ['Palm Court Hotel', '4'], ['Heritage Stay Villas', '4'], ['Budget Inn Express', '3'], ['Lagoon Boutique Hotel', '5']];
    return n.map((h, i) => ({ id: 'ht' + i, hotelId: 'D' + i, name: h[0], rating: h[1], cityCode: city, price: { amount: 2500 + i * 1800, currency: 'INR' }, checkIn: ci, checkOut: co, room: ['Deluxe Room', 'Suite', 'Standard Room'][i % 3], raw: null })).sort((a, b) => a.price.amount - b.price.amount);
  }

  const nextId = list => (list.reduce((m, x) => Math.max(m, x.id), 0) + 1);
  const normPkg = b => ({
    title: b.title || 'Untitled package', place: b.place || '',
    category: b.category === 'domestic' ? 'domestic' : 'international',
    price_inr: Number(b.price_inr) || 0, strike_inr: b.strike_inr ? Number(b.strike_inr) : null,
    image: b.image || 'bg-bali', duration: b.duration || '', rating: b.rating || '', tag: b.tag || '',
    features: Array.isArray(b.features) ? b.features.filter(Boolean) : String(b.features || '').split(',').map(s => s.trim()).filter(Boolean),
    description: b.description || '', active: !(b.active === false || b.active === 0), sort: Number(b.sort) || 0,
  });

  /* ---- local (no-backend) request handler ---- */
  function local(method, path, body) {
    const [p, q] = path.split('?');
    const seg = p.split('/').filter(Boolean);
    const key = method + ' /' + seg.join('/');

    // packages (public)
    if (key === 'GET /packages') return packages().filter(x => x.active).sort((a, b) => a.sort - b.sort || a.id - b.id);
    if (method === 'GET' && seg[0] === 'packages' && seg[1]) return packages().find(x => x.id == seg[1]) || null;

    // admin
    if (key === 'GET /admin/status') return { authRequired: false };
    if (key === 'POST /admin/login') return { token: 'local' };
    if (key === 'POST /admin/logout') return { ok: true };
    if (key === 'GET /admin/packages') return packages().sort((a, b) => a.sort - b.sort || a.id - b.id);
    if (key === 'POST /admin/packages') { const list = packages(); const rec = { id: nextId(list), ...normPkg(body) }; list.push(rec); savePackages(list); return rec; }
    if (method === 'PUT' && seg[0] === 'admin' && seg[1] === 'packages' && seg[2]) { const list = packages(); const idx = list.findIndex(x => x.id == seg[2]); if (idx < 0) { const e = new Error('Not found'); e.status = 404; throw e; } list[idx] = { id: list[idx].id, ...normPkg(body) }; savePackages(list); return list[idx]; }
    if (method === 'DELETE' && seg[0] === 'admin' && seg[1] === 'packages' && seg[2]) { savePackages(packages().filter(x => x.id != seg[2])); return { ok: true }; }
    if (key === 'GET /admin/enquiries') return read('gtm_leads', []).map(l => ({ ...l, package_name: l.package || l.package_name, travel_date: l.travelDate || l.travel_date, crm_status: 'local', messages: l.appointment && l.appointment.requested ? [{ type: 'confirmation', status: 'local' }] : [], created_at: l.createdAt || l.created_at }));
    if (key === 'GET /admin/bookings') return read('gtm_bookings', []);
    if (key === 'GET /admin/stats') { const pk = packages(); return { enquiries: read('gtm_leads', []).length, appointments: read('gtm_leads', []).filter(l => l.appointment && l.appointment.requested).length, packages: pk.length, active: pk.filter(x => x.active).length, bookings: read('gtm_bookings', []).length }; }

    // enquiries — ref only; the page keeps its own localStorage copy
    if (key === 'POST /enquiries') { if (!body.name || !body.phone || !body.email) { const e = new Error('Name, phone and email are required'); e.status = 400; throw e; } return { ok: true, ref: 'GTM-' + Date.now().toString().slice(-6), crm: false, appointment: body.appointment && body.appointment.requested ? body.appointment : null }; }

    // flights / hotels / locations
    if (key === 'GET /locations') { const kw = decodeURIComponent((q || '').replace(/^keyword=/, '')).toLowerCase(); return LOCS.filter(l => (l.city + l.iata).toLowerCase().includes(kw)).map(l => ({ iata: l.iata, name: l.city, city: l.city, country: '', type: 'AIRPORT' })); }
    if (key === 'POST /flights/search') return { mode: 'demo', data: demoFlights(body.origin, body.destination, body.date, body.adults) };
    if (key === 'POST /hotels/search') return { mode: 'demo', data: demoHotels(body.cityCode, body.checkIn, body.checkOut) };

    // payments — manage bookings locally
    if (key === 'POST /payments/create') {
      const type = body.type === 'hotel' ? 'hotel' : 'flight';
      const o = body.offer || {}, amount = Math.round((o.price && o.price.amount) || 0);
      const ref = (type === 'flight' ? 'FL-' : 'HT-') + Date.now().toString().slice(-6);
      const summary = type === 'flight' ? `${o.airline} ${o.from}→${o.to} ${(o.departAt || '').slice(0, 10)}` : `${o.name} (${o.checkIn || ''}→${o.checkOut || ''})`;
      const c = body.contact || {};
      const list = read('gtm_bookings', []);
      list.unshift({ ref, type, name: c.name, phone: c.phone, email: c.email, summary, amount_inr: amount, provider_ref: '', provider_mode: 'demo', pay_status: 'created', pay_mode: 'mock', status: 'pending', created_at: new Date().toISOString() });
      write('gtm_bookings', list);
      return { ref, amount, currency: 'INR', order_id: 'order_local_' + ref, key_id: 'mock', mode: 'mock' };
    }
    if (key === 'POST /payments/verify') {
      const list = read('gtm_bookings', []); const b = list.find(x => x.ref === body.ref);
      const pnr = (b && b.type === 'flight' ? 'TEST' : 'CONF') + Math.floor(1000 + Math.random() * 8999);
      if (b) { b.pay_status = 'paid'; b.status = 'confirmed'; b.provider_ref = pnr; write('gtm_bookings', list); }
      return { ok: true, ref: body.ref, status: 'confirmed', provider_ref: pnr, provider_mode: 'demo' };
    }

    const e = new Error('Unknown endpoint: ' + key); e.status = 404; throw e;
  }

  /* ---- the universal client ---- */
  async function gtmApi(method, path, body) {
    try {
      const headers = { 'content-type': 'application/json' };
      const tok = (typeof localStorage !== 'undefined') && localStorage.getItem('gtm_admin_token');
      if (tok) headers.authorization = 'Bearer ' + tok;
      const r = await fetch('/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('no-backend'); // static host returns HTML
      const d = await r.json();
      if (!r.ok) { const e = new Error(d.error || 'Request failed'); e.status = r.status; throw e; }
      return d;
    } catch (err) {
      if (err.status) throw err;          // a real backend error → propagate
      return local(method, path, body);   // backend unreachable → local fallback
    }
  }

  window.gtmApi = gtmApi;
  window.GTM_OFFLINE_READY = true;
})();
