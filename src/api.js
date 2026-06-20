'use strict';
const db = require('./db');
const crm = require('./crm');
const wa = require('./whatsapp');
const amadeus = require('./amadeus');
const payment = require('./payment');
const { readJson, send, genRef, genToken, safeParse } = require('./util');

/* ---------- helpers ---------- */
function pkgPublic(p) {
  return {
    id: p.id, title: p.title, place: p.place, category: p.category,
    price_inr: p.price_inr, strike_inr: p.strike_inr, image: p.image,
    duration: p.duration, rating: p.rating, tag: p.tag,
    features: safeParse(p.features, []), description: p.description,
  };
}

function tokenOf(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
function authed(req) {
  const t = tokenOf(req);
  return !!t && !!db.prepare('SELECT token FROM sessions WHERE token = ?').get(t);
}

function parseSlot(slot) {
  if (!slot) return '10:00';
  const m = String(slot).match(/(\d{1,2}):?(\d{0,2})\s*(AM|PM)?/i);
  if (!m) return '10:00';
  let h = Number(m[1]);
  const min = m[2] || '00';
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + min.padStart(2, '0');
}
function reminderTime(date, slot) {
  if (!date) return null;
  const dt = new Date(`${date}T${parseSlot(slot)}:00`);
  if (isNaN(dt)) return null;
  const lead = Number(process.env.REMINDER_LEAD_MINUTES || 120);
  return new Date(dt.getTime() - lead * 60000).toISOString();
}

/* ---------- package create/update ---------- */
function savePackage(id, b) {
  const features = JSON.stringify(
    Array.isArray(b.features)
      ? b.features.filter(Boolean)
      : String(b.features || '').split(',').map(s => s.trim()).filter(Boolean)
  );
  const f = {
    title: b.title || 'Untitled package',
    place: b.place || '',
    category: b.category === 'domestic' ? 'domestic' : 'international',
    price_inr: Number(b.price_inr) || 0,
    strike_inr: b.strike_inr ? Number(b.strike_inr) : null,
    image: b.image || 'bg-bali',
    duration: b.duration || '',
    rating: b.rating || '',
    tag: b.tag || '',
    features,
    description: b.description || '',
    active: b.active === false || b.active === 0 ? 0 : 1,
    sort: Number(b.sort) || 0,
  };
  if (id) {
    if (!db.prepare('SELECT id FROM packages WHERE id = ?').get(id)) return null;
    db.prepare(`UPDATE packages SET title=?,place=?,category=?,price_inr=?,strike_inr=?,image=?,duration=?,rating=?,tag=?,features=?,description=?,active=?,sort=? WHERE id=?`)
      .run(f.title, f.place, f.category, f.price_inr, f.strike_inr, f.image, f.duration, f.rating, f.tag, f.features, f.description, f.active, f.sort, id);
    return pkgPublic(db.prepare('SELECT * FROM packages WHERE id = ?').get(id));
  }
  const info = db.prepare(`INSERT INTO packages (title,place,category,price_inr,strike_inr,image,duration,rating,tag,features,description,active,sort,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(f.title, f.place, f.category, f.price_inr, f.strike_inr, f.image, f.duration, f.rating, f.tag, f.features, f.description, f.active, f.sort, new Date().toISOString());
  return pkgPublic(db.prepare('SELECT * FROM packages WHERE id = ?').get(Number(info.lastInsertRowid)));
}

/* ---------- enquiry create (public) ---------- */
async function createEnquiry(req, res) {
  const b = await readJson(req);
  if (!b.name || !b.phone || !b.email) {
    return send(res, 400, { error: 'Name, phone and email are required' });
  }
  const ref = genRef();
  const now = new Date().toISOString();
  const info = db.prepare(`INSERT INTO enquiries
      (ref,name,phone,email,city,package_id,package_name,place,price_inr,travel_date,travellers,budget,source,message,status,crm_status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'New','pending', ?)`)
    .run(ref, b.name, b.phone, b.email, b.city || '',
      b.package_id ? Number(b.package_id) : null, b.package || '', b.place || '',
      b.price_inr ? Number(b.price_inr) : null, b.travelDate || '', b.travellers || '',
      b.budget || '', b.source || '', b.message || '', now);
  const enquiryId = Number(info.lastInsertRowid);

  let appt = null;
  if (b.appointment && b.appointment.requested) {
    const a = b.appointment;
    appt = { date: a.date || '', slot: a.slot || '', mode: a.mode || '' };
    db.prepare(`INSERT INTO appointments (enquiry_id,requested,date,slot,mode,status,created_at) VALUES (?,?,?,?,?, 'scheduled', ?)`)
      .run(enquiryId, 1, appt.date, appt.slot, appt.mode, now);

    // confirmation — sent immediately
    const params = [b.name, b.package || 'your trip', `${appt.date} ${appt.slot}`.trim(), appt.mode || 'call'];
    const cr = await wa.sendTemplate(b.phone, process.env.WHATSAPP_CONFIRM_TEMPLATE || 'appointment_confirmation', params);
    db.prepare(`INSERT INTO messages (enquiry_id,phone,type,send_at,status,detail,created_at,sent_at) VALUES (?,?, 'confirmation', ?, ?, ?, ?, ?)`)
      .run(enquiryId, b.phone, now, cr.ok ? 'sent' : 'failed', JSON.stringify(cr).slice(0, 300), now, now);

    // reminder — queued for later, picked up by the scheduler
    const remindAt = reminderTime(appt.date, appt.slot);
    if (remindAt) {
      db.prepare(`INSERT INTO messages (enquiry_id,phone,type,send_at,status,created_at) VALUES (?,?, 'reminder', ?, 'queued', ?)`)
        .run(enquiryId, b.phone, remindAt, now);
    }
  }

  // forward to CRM (failure does not block the customer)
  const row = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(enquiryId);
  const crmRes = await crm.pushLead({ ...row, appointment: appt });
  db.prepare('UPDATE enquiries SET crm_status = ?, crm_detail = ? WHERE id = ?')
    .run(crmRes.ok ? 'synced' : 'failed', JSON.stringify(crmRes).slice(0, 500), enquiryId);

  return send(res, 201, { ok: true, ref, crm: crmRes.ok, appointment: appt });
}

/* ---------- flights / hotels: create booking + payment order ---------- */
async function startPayment(req, res) {
  const b = await readJson(req);
  const type = b.type === 'hotel' ? 'hotel' : 'flight';
  const offer = b.offer;
  const contact = b.contact || {};
  if (!offer || !offer.price) return send(res, 400, { error: 'Missing offer' });
  if (!contact.name || !contact.phone || !contact.email) {
    return send(res, 400, { error: 'Name, phone and email are required' });
  }

  const amount = Math.round(Number(offer.price.amount) || 0);
  const ref = (type === 'flight' ? 'FL-' : 'HT-') + Date.now().toString().slice(-6);
  const summary = type === 'flight'
    ? `${offer.airline} ${offer.from}→${offer.to} ${(offer.departAt || '').slice(0, 10)}`
    : `${offer.name} (${offer.checkIn || ''}→${offer.checkOut || ''})`;

  let order;
  try { order = await payment.createOrder(amount, ref); }
  catch (e) { return send(res, 502, { error: 'Payment init failed: ' + e.message }); }

  const now = new Date().toISOString();
  db.prepare(`INSERT INTO bookings (ref,type,name,phone,email,summary,details,amount_inr,pay_order_id,pay_status,pay_mode,status,created_at)
              VALUES (?,?,?,?,?,?,?,?,?, 'created', ?, 'pending', ?)`)
    .run(ref, type, contact.name, contact.phone, contact.email, summary,
      JSON.stringify({ offer, pax: b.pax || [], contact }), amount, order.id, order.mode, now);

  return send(res, 201, {
    ref, amount, currency: 'INR',
    order_id: order.id, key_id: order.key_id, mode: order.mode, // mode: live | mock
  });
}

/* ---------- verify payment + issue the booking with the provider ---------- */
async function verifyPayment(req, res) {
  const b = await readJson(req);
  const row = db.prepare('SELECT * FROM bookings WHERE ref = ?').get(b.ref);
  if (!row) return send(res, 404, { error: 'Booking not found' });

  const ok = payment.verify({
    razorpay_order_id: b.razorpay_order_id || row.pay_order_id,
    razorpay_payment_id: b.razorpay_payment_id || '',
    razorpay_signature: b.razorpay_signature || '',
  });
  if (!ok) {
    db.prepare("UPDATE bookings SET pay_status='failed', status='failed' WHERE id=?").run(row.id);
    return send(res, 400, { error: 'Payment verification failed' });
  }
  db.prepare('UPDATE bookings SET pay_status=?, pay_id=? WHERE id=?')
    .run('paid', b.razorpay_payment_id || ('mock_' + Date.now()), row.id);

  // Issue with the provider
  const snap = safeParse(row.details, {});
  let provider = { mode: 'demo', id: null, ref: null };
  try {
    if (row.type === 'flight') {
      const r = await amadeus.bookFlight(snap.offer, snap.pax || []);
      provider = { mode: r.mode, id: r.id, ref: r.pnr };
    } else {
      const r = await amadeus.bookHotel(snap.offer, snap.pax || [], null);
      provider = { mode: r.mode, id: r.id, ref: r.confirmation };
    }
  } catch (e) {
    provider = { mode: 'error', id: null, ref: null, error: e.message };
  }

  const confirmed = provider.mode !== 'error';
  db.prepare('UPDATE bookings SET provider_ref=?, provider_mode=?, status=? WHERE id=?')
    .run(provider.ref || provider.id || '', provider.mode, confirmed ? 'confirmed' : 'failed', row.id);

  // Forward to CRM + WhatsApp confirmation (best-effort)
  const c = snap.contact || {};
  crm.pushLead({ ref: row.ref, type: row.type, name: c.name, phone: c.phone, email: c.email, summary: row.summary, amount_inr: row.amount_inr, provider_ref: provider.ref }).catch(() => {});
  wa.sendTemplate(c.phone, process.env.WHATSAPP_CONFIRM_TEMPLATE || 'appointment_confirmation',
    [c.name || 'traveller', row.summary, provider.ref || row.ref, row.type]).catch(() => {});

  return send(res, 200, {
    ok: confirmed, ref: row.ref, status: confirmed ? 'confirmed' : 'failed',
    provider_ref: provider.ref, provider_mode: provider.mode,
  });
}

/* ---------- main router ---------- */
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const seg = url.pathname.split('/').filter(Boolean).slice(1); // drop 'api'
  const method = req.method;

  // ----- public -----
  if (method === 'GET' && seg[0] === 'packages' && !seg[1]) {
    const rows = db.prepare('SELECT * FROM packages WHERE active = 1 ORDER BY sort, id').all();
    return send(res, 200, rows.map(pkgPublic));
  }
  if (method === 'GET' && seg[0] === 'packages' && seg[1]) {
    const row = db.prepare('SELECT * FROM packages WHERE id = ?').get(Number(seg[1]));
    return row ? send(res, 200, pkgPublic(row)) : send(res, 404, { error: 'Not found' });
  }
  if (method === 'POST' && seg[0] === 'enquiries') {
    return createEnquiry(req, res);
  }

  // ----- flights / hotels (public) -----
  if (method === 'GET' && seg[0] === 'locations') {
    try { return send(res, 200, await amadeus.searchLocations(url.searchParams.get('keyword') || '')); }
    catch (e) { return send(res, 502, { error: e.message }); }
  }
  if (method === 'POST' && seg[0] === 'flights' && seg[1] === 'search') {
    try { return send(res, 200, await amadeus.searchFlights(await readJson(req))); }
    catch (e) { return send(res, 502, { error: e.message }); }
  }
  if (method === 'POST' && seg[0] === 'hotels' && seg[1] === 'search') {
    try { return send(res, 200, await amadeus.searchHotels(await readJson(req))); }
    catch (e) { return send(res, 502, { error: e.message }); }
  }
  if (method === 'POST' && seg[0] === 'payments' && seg[1] === 'create') {
    return startPayment(req, res);
  }
  if (method === 'POST' && seg[0] === 'payments' && seg[1] === 'verify') {
    return verifyPayment(req, res);
  }

  // ----- admin auth -----
  if (method === 'POST' && seg[0] === 'admin' && seg[1] === 'login') {
    const { password } = await readJson(req);
    if (!password || password !== (process.env.ADMIN_PASSWORD || 'admin123')) {
      return send(res, 401, { error: 'Incorrect password' });
    }
    const token = genToken();
    db.prepare('INSERT INTO sessions (token, created_at) VALUES (?, ?)').run(token, new Date().toISOString());
    return send(res, 200, { token });
  }
  if (method === 'POST' && seg[0] === 'admin' && seg[1] === 'logout') {
    const t = tokenOf(req);
    if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
    return send(res, 200, { ok: true });
  }

  // ----- admin protected -----
  if (seg[0] === 'admin') {
    if (!authed(req)) return send(res, 401, { error: 'Unauthorized' });

    if (method === 'GET' && seg[1] === 'stats') {
      return send(res, 200, {
        enquiries: db.prepare('SELECT COUNT(*) n FROM enquiries').get().n,
        appointments: db.prepare('SELECT COUNT(*) n FROM appointments WHERE requested = 1').get().n,
        packages: db.prepare('SELECT COUNT(*) n FROM packages').get().n,
        active: db.prepare('SELECT COUNT(*) n FROM packages WHERE active = 1').get().n,
        bookings: db.prepare('SELECT COUNT(*) n FROM bookings').get().n,
      });
    }
    if (method === 'GET' && seg[1] === 'packages') {
      const rows = db.prepare('SELECT * FROM packages ORDER BY sort, id').all();
      return send(res, 200, rows.map(r => ({ ...pkgPublic(r), active: !!r.active, sort: r.sort })));
    }
    if (method === 'POST' && seg[1] === 'packages') {
      return send(res, 201, savePackage(null, await readJson(req)));
    }
    if (method === 'PUT' && seg[1] === 'packages' && seg[2]) {
      const r = savePackage(Number(seg[2]), await readJson(req));
      return r ? send(res, 200, r) : send(res, 404, { error: 'Not found' });
    }
    if (method === 'DELETE' && seg[1] === 'packages' && seg[2]) {
      db.prepare('DELETE FROM packages WHERE id = ?').run(Number(seg[2]));
      return send(res, 200, { ok: true });
    }
    if (method === 'GET' && seg[1] === 'enquiries') {
      const rows = db.prepare('SELECT * FROM enquiries ORDER BY id DESC').all();
      return send(res, 200, rows.map(e => ({
        ...e,
        appointment: db.prepare('SELECT * FROM appointments WHERE enquiry_id = ? ORDER BY id DESC').get(e.id) || null,
        messages: db.prepare('SELECT type, status, send_at, sent_at FROM messages WHERE enquiry_id = ?').all(e.id),
      })));
    }
    if (method === 'GET' && seg[1] === 'bookings') {
      return send(res, 200, db.prepare('SELECT id,ref,type,name,phone,email,summary,amount_inr,provider_ref,provider_mode,pay_status,pay_mode,status,created_at FROM bookings ORDER BY id DESC').all());
    }
  }

  return send(res, 404, { error: 'Unknown endpoint' });
}

module.exports = { handle };
