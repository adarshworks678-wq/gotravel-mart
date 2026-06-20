# GoTravel Mart — Travel Marketplace (Full-Stack)

**Tagline:** *Explore More. Travel Better.*

A premium, responsive travel marketplace **with a backend**: enquiries are stored
and pushed to your CRM, appointment confirmations + reminders go out over WhatsApp,
and an admin panel lets staff add / edit / remove packages — no code, no redeploy.

There is **no customer login** by design: visitors browse packages, open a package,
submit an enquiry, and optionally book a free online appointment for booking &
payment assistance.

---

## Quick start

Requires **Node.js ≥ 22.5** (uses the built-in `node:sqlite` — there are **no npm
dependencies to install**).

```bash
cd gotravel-mart
cp .env.example .env        # then edit values (a ready-to-run .env is already included)
npm start                   # → http://localhost:3000
```

- **Website:** http://localhost:3000
- **Admin panel:** http://localhost:3000/admin/  (default password `admin123` — change it!)

`npm run dev` starts with auto-reload while editing.

---

## How it works

```
Visitor → Website ──fetch──► /api/packages         (homepage loads packages from the DB)
        → Enquiry form ─POST► /api/enquiries
                                   │
                                   ├─► SQLite (data.db)         every enquiry + appointment
                                   ├─► Your CRM API             src/crm.js
                                   └─► WhatsApp confirmation     src/whatsapp.js (sent now)
                                            + reminder queued    src/scheduler.js (sent later)

Admin → /admin/ ─Bearer token─► /api/admin/*        add / edit / remove packages, view leads
```

Until you add credentials, **CRM and WhatsApp run in "log-only" mode** — the server
prints exactly what it *would* send, so you can test the whole flow with zero setup.

---

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 3000) |
| `ADMIN_PASSWORD` | Password for the admin panel |
| `CRM_API_URL` | Your CRM endpoint. Each enquiry is `POST`ed here as JSON. Blank = log-only. |
| `CRM_API_KEY` / `CRM_AUTH_HEADER` / `CRM_AUTH_PREFIX` | How the key is sent, e.g. `Authorization: Bearer <key>` |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Cloud API creds. Blank = log-only. |
| `WHATSAPP_CONFIRM_TEMPLATE` / `WHATSAPP_REMINDER_TEMPLATE` | Names of your approved templates |
| `REMINDER_LEAD_MINUTES` | How long before the appointment the reminder fires (default 120) |
| `DEFAULT_COUNTRY_CODE` | Prepended to bare 10-digit phone numbers (default 91) |
| `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` | Flight + hotel search/booking. Free test keys from developers.amadeus.com. Blank = demo data. |
| `AMADEUS_ENV` | `test` (free sandbox) or `production` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payments. Test keys instant from Razorpay dashboard. Blank = mock (simulated success). |

### Connecting your CRM
Set `CRM_API_URL` (and key if needed). The JSON payload sent per enquiry contains:
`ref, name, phone, email, city, package_id, package_name, place, price_inr,
travel_date, travellers, budget, source, message, appointment{date,slot,mode}, created_at`.
If your CRM expects a different shape, adjust the body in `src/crm.js`.

### Connecting WhatsApp (Meta Cloud API)
1. Create a Meta Business app → add **WhatsApp** → get a permanent **token** and **phone number ID**.
2. In WhatsApp Manager, create & get approved two **message templates** with 4 body
   variables (`{{1}}` name, `{{2}}` package, `{{3}}` date+time, `{{4}}` mode).
3. Put the token, phone id and template names in `.env`. Done.

To switch provider later (Twilio, Interakt, AiSensy…), only `src/whatsapp.js` changes.

### Flights & hotels (Amadeus) + payments (Razorpay)
The Flights and Hotels pages do **live search → booking → payment**:

```
Search (/api/flights|hotels/search) → pick offer → checkout.html
   → /api/payments/create   (creates a booking + Razorpay order)
   → Razorpay Checkout       (or simulated success in mock mode)
   → /api/payments/verify    (verifies signature, books with Amadeus, confirms)
```

- **No keys → demo mode:** realistic sample flights/hotels, mock payment that always
  succeeds, and a test PNR/confirmation — so the entire flow is clickable offline.
- **Amadeus test keys → live search** against the sandbox (limited sample inventory,
  test PNRs). Real production inventory/ticketing needs a production Amadeus contract.
- **Razorpay test keys → real Checkout** in test mode. Switch to live keys for real charges.
- The provider/payment logic is isolated in `src/amadeus.js` and `src/payment.js` — to
  move to an Indian consolidator (TBO/TripJack) later, only `src/amadeus.js` changes.

> Note: live flight ticketing needs full traveller details (DOB, passport for
> international) and a production agreement; the checkout collects lead-traveller
> details and is structured to extend to multiple passengers.

---

## Admin panel
`/admin/` → log in → two tabs:
- **Packages** — add, edit, delete; toggle visibility; set price, category
  (Domestic/International), image (a `bg-*` gradient preset *or* a real image URL),
  duration, rating, tag, features, description, sort order. Changes are **live on the
  website immediately**.
- **Enquiries** — every lead with its appointment, WhatsApp message status, and CRM
  sync status.

---

## Project structure

```
gotravel-mart/
├── server.js               # HTTP server: static files + /api/* router
├── package.json            # scripts only — zero dependencies
├── .env / .env.example     # configuration
├── src/
│   ├── db.js               # node:sqlite schema + seeds the 8 starter packages
│   ├── api.js              # REST API: packages, enquiries, admin CRUD
│   ├── crm.js              # CRM adapter (configurable)
│   ├── whatsapp.js         # WhatsApp Cloud API adapter
│   ├── amadeus.js          # flight + hotel search/booking + location autocomplete
│   ├── payment.js          # Razorpay order create + signature verify
│   ├── scheduler.js        # sends reminders before appointments (runs every 60s)
│   └── util.js             # .env loader + helpers
├── admin/index.html        # admin panel (login, packages, enquiries, bookings)
├── index.html              # homepage — packages load from /api/packages
├── css/style.css           # design system
├── js/
│   ├── main.js             # nav, dark mode, currency, filters, card wiring
│   └── packages.js         # renders homepage packages from the API
└── pages/
    ├── inquiry.html        # enquiry + appointment page → POSTs to /api/enquiries
    ├── flights.html        # live flight search
    ├── hotels.html         # live hotel search
    ├── checkout.html       # passenger details → payment → confirmation
    ├── package-details.html, destinations.html, contact.html,
    └── leads.html          # customer's local copy of their enquiries/bookings
```

`data.db` is created on first run and holds packages, enquiries, appointments and
messages. It is git-ignored. Delete it to reset to the seeded 8 packages.

---

## Deploying (live prototype)
> This app has a **Node backend**, so GitHub Pages (static-only) can't run it.
> Use a Node host. CI runs automatically on every push via `.github/workflows/ci.yml`.

**Fastest — Render (free, auto-deploy from GitHub):**
1. Push this repo to GitHub (already configured).
2. On [render.com](https://render.com): **New + → Blueprint** → pick the repo → Render reads `render.yaml`.
3. (Optional) add your real keys (Amadeus, Razorpay, WhatsApp, CRM, `ADMIN_PASSWORD`) in the dashboard — blank = demo/log-only mode.
4. Every push to `main` now auto-deploys. That's the CD.

**Other hosts:** a `Dockerfile` and `Procfile` are included — works on Railway, Fly.io,
Cloud Run, or any VPS (`node server.js` behind pm2 + Nginx).

**Notes:**
- Free tiers may sleep on idle — a sleeping server can't send reminders. Use a small
  paid/always-on instance for production.
- Free tiers have an ephemeral disk, so `data.db` resets on redeploy (re-seeds 8 packages).
  For persistence, attach a disk and set `DB_PATH` to a path on it.

## API reference (brief)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/packages` | – | Active packages (website) |
| GET | `/api/packages/:id` | – | One package |
| POST | `/api/enquiries` | – | Create enquiry (+ appointment, CRM push, WhatsApp) |
| GET | `/api/locations?keyword=` | – | Airport/city autocomplete |
| POST | `/api/flights/search` | – | Live flight search |
| POST | `/api/hotels/search` | – | Live hotel search |
| POST | `/api/payments/create` | – | Create booking + payment order |
| POST | `/api/payments/verify` | – | Verify payment + issue booking |
| POST | `/api/admin/login` | – | `{password}` → `{token}` |
| GET | `/api/admin/packages` | Bearer | All packages |
| POST/PUT/DELETE | `/api/admin/packages[/:id]` | Bearer | Create / update / delete |
| GET | `/api/admin/enquiries` | Bearer | All leads |
| GET | `/api/admin/bookings` | Bearer | All flight/hotel bookings |
| GET | `/api/admin/stats` | Bearer | Counts |
```
