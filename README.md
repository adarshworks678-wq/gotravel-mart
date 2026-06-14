# GoTravel Mart — Premium Travel Marketplace Prototype

**Tagline:** *Explore More. Travel Better.*

A high-fidelity, fully responsive prototype of a modern travel marketplace inspired by BeyondYatra, designed as a cleaner, premium, next-generation alternative.

## How to view

Open `index.html` in any modern browser — no build step required.

```
open index.html         # macOS
xdg-open index.html     # Linux
start index.html        # Windows
```

For best results serve from a local web server (so relative paths to `/pages` resolve cleanly):

```
python3 -m http.server 5500
# then visit http://localhost:5500
```

## Project structure

```
gotravel-mart/
├── index.html              # Homepage (hero, search, all 11 sections)
├── css/
│   └── style.css           # Full design system + responsive rules + dark mode
├── js/
│   └── main.js             # Tabs, carousel, counters, AI widget, dark mode, currency
└── pages/
    ├── destinations.html   # Destinations listing + filters + map placeholder
    ├── package-details.html# Bali package — gallery, itinerary, inquiry form
    ├── flights.html        # Flight results with airline list, filters, sort
    ├── hotels.html         # Hotel listings with amenities, ratings, filters
    └── contact.html        # Contact info, inquiry form, FAQ, map placeholder
```

## Design system at a glance

- **Brand:** Blue (#0a84ff) → Teal (#00c2b8) gradient, with peach accent (#ff7a59)
- **Typography:** Inter (body) + Plus Jakarta Sans (display)
- **Glassmorphism:** Hero search widget uses `backdrop-filter`
- **Radii:** 8 / 14 / 22 / 32 px scale
- **Cards, buttons, badges, filters** — all reusable via CSS classes
- **Dark mode** — toggle in header (persisted to `localStorage`)
- **Currency switcher** — INR / USD / EUR / GBP / AED (live re-computes prices)

## Built-in interactions

- Glassmorphic flight / hotel / package search tabs
- Sticky header with mobile hamburger menu
- Animated counter stats (intersection-observer driven)
- Carousel for fixed-departure tours with prev/next controls
- Package category filter tabs (All / Domestic / International / Family / Honeymoon)
- Floating WhatsApp + live chat + AI travel recommender (clickable panel with vibe chips)
- Wishlist heart toggles, dark mode, currency switching
- Scroll fade-up animations
- All forms have demo submit handlers (no backend wired)

## Pages mapped to the brief

| Section in brief | Where it lives |
|---|---|
| Hero with flight/hotel/package search | `index.html` § 1 |
| Trending Destinations (10 cards) | `index.html` § 2 |
| Holiday Packages with tabs | `index.html` § 3 |
| Fixed Departure carousel | `index.html` § 4 |
| Spiritual & Pilgrimage (8 destinations) | `index.html` § 5 |
| Adventure Experiences (6 cards) | `index.html` § 6 |
| Why Choose Us + animated counters | `index.html` § 7 |
| Testimonials | `index.html` § 8 |
| Travel Blog | `index.html` § 9 |
| Newsletter | `index.html` § 10 |
| Footer (Company / Destinations / Resources / Contact / Payments / Social) | `index.html` § 11 |
| Destinations page (filters + map + 12 cards) | `pages/destinations.html` |
| Package Details (gallery, itinerary timeline, inclusions/exclusions, inquiry) | `pages/package-details.html` |
| Flight Booking page | `pages/flights.html` |
| Hotel Booking page | `pages/hotels.html` |
| Contact page (form + WhatsApp + map + FAQ) | `pages/contact.html` |

## Notes on images

To keep the prototype self-contained and offline-friendly, destination "photos" are rendered as carefully crafted CSS gradients with light/radial highlights — they're stylized stand-ins. To switch to real photography, replace any `.bg-*` class in CSS with a `background-image: url(...)` and the rest of the design system works unchanged.
