'use strict';
/*
 * Amadeus Self-Service adapter — flights, hotels and location autocomplete.
 * Configure AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET in .env (free test keys
 * from https://developers.amadeus.com). With no keys it runs in DEMO mode and
 * returns realistic sample results so the whole flow is testable offline.
 */

function live() { return !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET); }
function base() { return (process.env.AMADEUS_ENV === 'production') ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com'; }
function currency() { return process.env.AMADEUS_CURRENCY || 'INR'; }

/* ---------- OAuth token (cached in memory) ---------- */
let _token = null, _exp = 0;
async function token() {
  if (_token && Date.now() < _exp - 30000) return _token;
  const r = await fetch(base() + '/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_CLIENT_ID,
      client_secret: process.env.AMADEUS_CLIENT_SECRET,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Amadeus auth failed: ' + (d.error_description || r.status));
  _token = d.access_token;
  _exp = Date.now() + (d.expires_in || 1800) * 1000;
  return _token;
}
async function apiGet(path, params) {
  const url = new URL(base() + path);
  Object.entries(params || {}).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v));
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + (await token()) } });
  const d = await r.json();
  if (!r.ok) throw new Error('Amadeus ' + path + ' → ' + (d.errors?.[0]?.detail || r.status));
  return d;
}
async function apiPost(path, body) {
  const r = await fetch(base() + path, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + (await token()), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Amadeus ' + path + ' → ' + (d.errors?.[0]?.detail || r.status));
  return d;
}

/* ---------- helpers ---------- */
function isoDur(mins) { const h = Math.floor(mins / 60), m = mins % 60; return `${h}h ${m}m`; }
function parseIsoDur(s) { // PT2H30M -> minutes
  const m = String(s || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return m ? (Number(m[1] || 0) * 60 + Number(m[2] || 0)) : 0;
}

/* =====================================================================
   FLIGHTS
   ===================================================================== */
async function searchFlights({ origin, destination, date, returnDate, adults = 1 }) {
  if (!live()) return { mode: 'demo', data: demoFlights(origin, destination, date, adults) };

  const params = {
    originLocationCode: origin, destinationLocationCode: destination,
    departureDate: date, adults, currencyCode: currency(), max: 20,
  };
  if (returnDate) params.returnDate = returnDate;
  const res = await apiGet('/v2/shopping/flight-offers', params);
  const carriers = res.dictionaries?.carriers || {};
  const data = (res.data || []).map(o => normalizeFlight(o, carriers));
  return { mode: 'live', data };
}

function normalizeFlight(offer, carriers) {
  const it = offer.itineraries[0];
  const segs = it.segments.map(s => ({
    from: s.departure.iataCode, to: s.arrival.iataCode,
    departAt: s.departure.at, arriveAt: s.arrival.at,
    carrier: carriers[s.carrierCode] || s.carrierCode, carrierCode: s.carrierCode,
    number: s.carrierCode + s.number, duration: isoDur(parseIsoDur(s.duration)),
  }));
  const first = segs[0];
  return {
    id: offer.id,
    price: { amount: Number(offer.price.grandTotal || offer.price.total), currency: offer.price.currency },
    airline: first.carrier, airlineCode: first.carrierCode, flightNumber: first.number,
    from: first.from, to: segs[segs.length - 1].to,
    departAt: first.departAt, arriveAt: segs[segs.length - 1].arriveAt,
    stops: segs.length - 1, duration: isoDur(parseIsoDur(it.duration)),
    segments: segs, raw: offer,
  };
}

async function priceFlight(offer) {
  if (!live()) return { mode: 'demo', offer, price: offer.price };
  const res = await apiPost('/v1/shopping/flight-offers/pricing', {
    data: { type: 'flight-offers-pricing', flightOffers: [offer.raw || offer] },
  });
  const priced = res.data.flightOffers[0];
  return { mode: 'live', offer: priced, price: { amount: Number(priced.price.grandTotal), currency: priced.price.currency } };
}

async function bookFlight(offer, travelers) {
  if (!live()) {
    return { mode: 'demo', id: 'DEMO-FL-' + Math.random().toString(36).slice(2, 8).toUpperCase(), pnr: 'TEST' + Math.floor(1000 + Math.random() * 8999) };
  }
  const res = await apiPost('/v1/booking/flight-orders', {
    data: { type: 'flight-order', flightOffers: [offer.raw || offer], travelers },
  });
  return { mode: 'live', id: res.data.id, pnr: res.data.associatedRecords?.[0]?.reference || null, raw: res.data };
}

/* =====================================================================
   HOTELS
   ===================================================================== */
async function searchHotels({ cityCode, checkIn, checkOut, adults = 1 }) {
  if (!live()) return { mode: 'demo', data: demoHotels(cityCode, checkIn, checkOut) };

  const listing = await apiGet('/v1/reference-data/locations/hotels/by-city', { cityCode });
  const ids = (listing.data || []).slice(0, 20).map(h => h.hotelId).join(',');
  if (!ids) return { mode: 'live', data: [] };
  const res = await apiGet('/v3/shopping/hotel-offers', {
    hotelIds: ids, adults, checkInDate: checkIn, checkOutDate: checkOut, currency: currency(), bestRateOnly: true,
  });
  const data = (res.data || []).map(normalizeHotel);
  return { mode: 'live', data };
}

function normalizeHotel(h) {
  const offer = h.offers?.[0] || {};
  return {
    id: offer.id || h.hotel.hotelId,
    hotelId: h.hotel.hotelId,
    name: h.hotel.name,
    rating: h.hotel.rating || '',
    cityCode: h.hotel.cityCode,
    price: offer.price ? { amount: Number(offer.price.total), currency: offer.price.currency } : null,
    checkIn: offer.checkInDate, checkOut: offer.checkOutDate,
    room: offer.room?.typeEstimated?.category || offer.room?.description?.text || 'Standard room',
    raw: h,
  };
}

async function bookHotel(offer, guests, payment) {
  if (!live()) {
    return { mode: 'demo', id: 'DEMO-HT-' + Math.random().toString(36).slice(2, 8).toUpperCase(), confirmation: 'TESTCONF' + Math.floor(100 + Math.random() * 899) };
  }
  // Amadeus Hotel Booking v2 (requires production access for real bookings)
  const res = await apiPost('/v2/booking/hotel-orders', {
    data: {
      type: 'hotel-order',
      guests, roomAssociations: [{ hotelOfferId: offer.id, guestReferences: [{ guestReference: '1' }] }],
      payment,
    },
  });
  return { mode: 'live', id: res.data.id, confirmation: res.data.hotelBookings?.[0]?.hotelProviderInformation?.[0]?.confirmationNumber || null, raw: res.data };
}

/* =====================================================================
   LOCATIONS (airport / city autocomplete)
   ===================================================================== */
async function searchLocations(keyword) {
  if (!live()) return DEMO_LOCATIONS.filter(l => (l.name + l.iata + l.city).toLowerCase().includes(String(keyword).toLowerCase())).slice(0, 8);
  const res = await apiGet('/v1/reference-data/locations', { subType: 'AIRPORT,CITY', keyword, 'page[limit]': 8 });
  return (res.data || []).map(l => ({ iata: l.iataCode, name: l.name, city: l.address?.cityName || '', country: l.address?.countryName || '', type: l.subType }));
}

/* =====================================================================
   DEMO DATA (used when no Amadeus keys are set)
   ===================================================================== */
const DEMO_LOCATIONS = [
  { iata: 'DEL', name: 'Indira Gandhi Intl', city: 'New Delhi', country: 'India', type: 'AIRPORT' },
  { iata: 'BOM', name: 'Chhatrapati Shivaji', city: 'Mumbai', country: 'India', type: 'AIRPORT' },
  { iata: 'BLR', name: 'Kempegowda Intl', city: 'Bengaluru', country: 'India', type: 'AIRPORT' },
  { iata: 'GOI', name: 'Goa Dabolim', city: 'Goa', country: 'India', type: 'AIRPORT' },
  { iata: 'MAA', name: 'Chennai Intl', city: 'Chennai', country: 'India', type: 'AIRPORT' },
  { iata: 'CCU', name: 'Netaji Subhas', city: 'Kolkata', country: 'India', type: 'AIRPORT' },
  { iata: 'HYD', name: 'Rajiv Gandhi Intl', city: 'Hyderabad', country: 'India', type: 'AIRPORT' },
  { iata: 'DXB', name: 'Dubai Intl', city: 'Dubai', country: 'UAE', type: 'AIRPORT' },
  { iata: 'SIN', name: 'Changi', city: 'Singapore', country: 'Singapore', type: 'AIRPORT' },
  { iata: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'Thailand', type: 'AIRPORT' },
];
const DEMO_AIRLINES = [
  { code: '6E', name: 'IndiGo' }, { code: 'AI', name: 'Air India' },
  { code: 'UK', name: 'Vistara' }, { code: 'SG', name: 'SpiceJet' },
];
function demoFlights(origin = 'DEL', destination = 'BOM', date, adults = 1) {
  const day = date || new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = DEMO_AIRLINES[i % DEMO_AIRLINES.length];
    const depH = 6 + i * 2;
    const durMin = 95 + (i % 3) * 40;
    const stops = i % 3 === 2 ? 1 : 0;
    const dep = `${day}T${String(depH).padStart(2, '0')}:${i % 2 ? '30' : '05'}:00`;
    const arr = new Date(new Date(dep).getTime() + durMin * 60000).toISOString().slice(0, 19);
    const price = (3200 + i * 850 + (stops ? -400 : 0)) * adults;
    out.push({
      id: 'demo-fl-' + i,
      price: { amount: price, currency: 'INR' },
      airline: a.name, airlineCode: a.code, flightNumber: a.code + (100 + i * 7),
      from: origin, to: destination, departAt: dep, arriveAt: arr,
      stops, duration: isoDur(durMin),
      segments: [{ from: origin, to: destination, departAt: dep, arriveAt: arr, carrier: a.name, carrierCode: a.code, number: a.code + (100 + i * 7), duration: isoDur(durMin) }],
      raw: null,
    });
  }
  return out.sort((x, y) => x.price.amount - y.price.amount);
}
function demoHotels(cityCode = 'GOI', checkIn, checkOut) {
  const names = [
    ['Seaside Grand Resort', '5', 'Beachfront, Calangute'],
    ['Palm Court Hotel', '4', 'City Centre'],
    ['Heritage Stay Villas', '4', 'Old Town'],
    ['Budget Inn Express', '3', 'Near Airport'],
    ['Lagoon Boutique Hotel', '5', 'Lakeside'],
  ];
  return names.map((n, i) => ({
    id: 'demo-ht-' + i, hotelId: 'DEMO' + i, name: n[0], rating: n[1], cityCode,
    price: { amount: 2500 + i * 1800, currency: 'INR' },
    checkIn, checkOut, room: ['Deluxe Room', 'Suite', 'Standard Room'][i % 3], raw: null,
  })).sort((a, b) => a.price.amount - b.price.amount);
}

module.exports = { live, searchFlights, priceFlight, bookFlight, searchHotels, bookHotel, searchLocations };
