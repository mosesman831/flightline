# SPEC.md — Flightline (Flighty-style iOS Web App)

## 1. Problem & User Value

Frequent flyers want a fast, calm, beautiful flight tracker that surfaces the important stuff before the airline app does. The core anxiety is: "Is my flight actually going to leave on time, and what is changing right now?"

Flightline is a free, open-source, iOS-first PWA that gives:
- Instant glanceable delay status
- Predicted departure/arrival times
- Pilot-grade weather + NOTAM context
- Inbound aircraft tracking (up to 25 hours out)
- Push alerts for status, gate, and inbound delays

Because it is open source and self-hosted, users bring their own API keys, so usage limits are their own.

## 2. Target User

- iOS PWA users who want Flighty-like polish without the price.
- Travelers who track 1-10 flights per month.
- Aviation-curious users who want METAR/TAF/NOTAM context.
- People who prefer a simple list over airline-app bloat.

## 3. Product Positioning

- Free forever, no accounts, no upsells.
- Open source (MIT).
- Self-hosted backend via Cloudflare Worker; user brings API keys.
- iOS PWA first; works on Android and desktop as secondary.
- Premium feel through motion, typography, and data density, not paywalls.

## 4. Core Features

### 4.1 Add a Flight
- Searchable airline picker (IATA code + name + logo).
- Flight number input (numeric with optional suffix).
- Date picker defaulting to today and the next 3 days.
- One-tap "Track Flight" CTA.
- Auto-detect timezone from route.

### 4.2 Flight Detail (Hero Screen)
- Route header: origin city/code → destination city/code.
- Airline name + flight number.
- Giant status: "On Time", "Delayed 18 min", "Cancelled", "Landed".
- Live countdown to departure, boarding, or arrival.
- Delay prediction ring: "% chance of delay" with micro-explanation.
- Predicted departure time and predicted arrival time.
- Quick-action row: Share, Refresh, Remove.

### 4.3 Timeline Card
- Chronological list of status changes (departure moved, gate changed, aircraft swapped).
- Each event shows field, old value, new value, timestamp, source.
- Highlight most recent change.

### 4.4 Gate / Terminal / Aircraft Card
- Gate, terminal, aircraft type, tail number.
- Boarding time if available.
- Seat map link (optional external).

### 4.5 My Flights List
- Sort by soonest departure.
- Each row: route, flight number, status pill, countdown, delay %.
- Pull-to-refresh feel.
- Swipe to delete / archive.

### 4.6 Settings
- Theme (system / light / dark).
- Units (metric / imperial, 12h / 24h).
- Data sources toggle (live vs demo).
- API key input (Aviationstack).
- Notification permissions.
- Import / export tracked flights (JSON).

## 5. Pro-Tier Feature Parity (Flighty Pro)

All free in this open-source version because the user self-hosts and brings API keys.

| Feature | What it means in Flightline | Implementation |
|---|---|---|
| Unlimited Flights | No arbitrary limit | IndexedDB stores any number |
| Live Pilot-Grade Data | METAR, TAF, NOTAMs, PIREPs | aviationweather.gov API (free, no key) |
| Push Alerts | Status/gate/inbound/delay changes | Web Push API + service worker |
| Live Activities | Lock-screen live card | **Not possible in a PWA.** Fallback: rich persistent notification + in-app "Now Tracking" view. Document native iOS widget as future path. |
| 25Hr Where's My Plane | Show inbound aircraft rotations up to 25 hours before departure | Link tail number to prior flights via Aviationstack / ADS-B |
| Late Inbound Aircraft Alerts | Notify if the inbound aircraft is running late | Compare scheduled vs actual inbound arrival |
| Storm, Wind, Traffic Delays | Surface delay reasons from FAA/weather/traffic data | Parse delay causes from Aviationstack + METAR wind/gusts + storm cells from Open-Meteo / NOAA |
| Predicted Departure Time | ML/heuristic prediction of actual departure | Cloudflare Worker heuristic |
| Arrival Forecast | Predicted arrival time + destination weather snapshot | Heuristic arrival + Open-Meteo forecast |

## 6. Non-Goals

- Booking flights.
- Check-in or boarding pass management.
- Native App Store app for MVP.
- Frequent-flyer point tracking.
- Multi-user accounts or sync.
- Social sharing beyond a status card.

## 7. Architecture

```
[iOS PWA]  <-- HTTPS -->  [Cloudflare Pages]  <-- static assets -->
  |
  +-- API calls --> [Cloudflare Worker]  <-- proxy/caching -->
          |
          +-- Aviationstack (status, schedules, routes)
          +-- aviationweather.gov (METAR/TAF/NOTAM)
          +-- Open-Meteo (weather forecasts)
          +-- ADS-B One / OpenSky (live aircraft position)
```

The Worker holds the user's API key in an environment secret. The front end never stores or exposes the key. Demo mode uses deterministic mock data in the Worker.

## 8. Data Model

```ts
interface Flight {
  id: string;
  airlineIata: string;
  airlineName: string;
  flightNumber: string;
  date: string;                       // local departure date
  scheduledDeparture: ISOString;
  scheduledArrival: ISOString;
  predictedDeparture: ISOString | null;
  predictedArrival: ISOString | null;
  actualDeparture: ISOString | null;
  actualArrival: ISOString | null;
  origin: Airport;
  destination: Airport;
  status: FlightStatus;
  delayMinutes: number | null;
  delayChance: number;                // 0-100
  delayReasons: DelayReason[];
  gate: string | null;
  terminal: string | null;
  aircraft: string | null;            // A320
  tailNumber: string | null;
  addedAt: ISOString;
  lastUpdatedAt: ISOString;
}

type FlightStatus =
  | "scheduled"
  | "active"
  | "landed"
  | "delayed"
  | "cancelled"
  | "diverted";

interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  timezone: string;
  lat: number;
  lon: number;
}

interface StatusEvent {
  id: string;
  flightId: string;
  field: string;
  oldValue: any;
  newValue: any;
  recordedAt: ISOString;
}

interface DelayReason {
  type: "inbound" | "weather" | "wind" | "traffic" | "airline" | "atc";
  severity: "low" | "medium" | "high";
  description: string;
}

interface InboundLeg {
  flightNumber: string;
  origin: Airport;
  destination: Airport;
  scheduledArrival: ISOString;
  actualArrival: ISOString | null;
  tailNumber: string;
  status: FlightStatus;
}

interface PilotData {
  metar: string | null;               // raw METAR
  taf: string | null;                 // raw TAF
  notams: Notam[];
  pireps: Pirep[];
  windSpeedKts: number | null;
  windGustKts: number | null;
  visibility: number | null;
  ceiling: number | null;
}

interface WeatherForecast {
  time: ISOString;
  tempC: number;
  precipChance: number;
  windSpeedKmh: number;
  conditionCode: string;
}
```

## 9. API Provider Summary

This table is the single source of truth for which APIs we use and why.

| Data Need | Provider | Cost | Notes |
|---|---|---|---|
| Flight schedules + live status + routes + aircraft | Aviationstack | Free 100 calls/mo; paid tiers from ~$50/mo | Proxied through Cloudflare Worker; user brings own key |
| METAR, TAF, NOTAMs | aviationweather.gov | Free, no key | US NOAA service; good global coverage for major airports |
| Departure / arrival weather forecast | Open-Meteo | Free, no key | No API key required; generous rate limits |
| Live aircraft position (optional map) | OpenSky Network | Free | ADS-B only; rate-limited; fallback to mock |
| Airline logos | Static repo or Simple Icons CDN | Free | Fallback monogram generated locally |
| Aircraft type photos | JetPhotos / Planespotters.net | Free with attribution | Optional; fallback to aircraft type icon |

## 10. API / Integration Surface

### 10.1 Aviationstack
- Endpoint: `https://api.aviationstack.com/v1/flights`
- Data: live status, schedules, airport timetables, aircraft, routes.
- Worker stores `AVIATIONSTACK_API_KEY` as a secret.
- Cache TTL: 45 seconds for active flights, 5 minutes for scheduled flights.

### 10.2 aviationweather.gov
- Endpoints:
  - `/cgi-bin/data/metar.php`
  - `/cgi-bin/data/taf.php`
  - `/cgi-bin/data/notam.php` (if public endpoint available)
- No API key required.
- Cache TTL: 10 minutes.

### 10.3 Open-Meteo
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Data: departure/arrival weather, hourly forecast, precipitation, wind.
- No API key required.
- Cache TTL: 30 minutes.

### 10.4 ADS-B / Live Position
- Option A: OpenSky Network (free, rate-limited).
- Option B: adsB.one / ADS-B Exchange (varies).
- Used only for "Where's My Plane" map visualization.
- Cache TTL: 15 seconds.

### 10.5 Worker Endpoints

```
POST /api/track
  body: { airlineIata, flightNumber, date }
  returns: Flight

GET /api/flights?ids=...
  returns: Flight[]

GET /api/flight/:id/timeline
  returns: StatusEvent[]

GET /api/flight/:id/inbound
  returns: InboundLeg[]

GET /api/flight/:id/pilot-data
  returns: PilotData

GET /api/flight/:id/forecast
  returns: { departure: WeatherForecast[], arrival: WeatherForecast[] }
```

## 11. Delay Prediction Heuristic

Implemented in the Cloudflare Worker. Version 1 is a deterministic scoring model, not an LLM.

Inputs:
1. Historical route delay rate by day-of-week (lookup table from public DOT data, updated quarterly).
2. Airline on-time performance (DOT monthly Air Travel Consumer Report).
3. Departure time bucket (early morning = -5%, late evening = +15%).
4. Current weather at origin (wind gust > 20 kts +10%, visibility < 3 mi +15%, precipitation +10%).
5. Inbound aircraft status (late inbound +20% to +40% depending on minutes).
6. Current status already delayed (already delayed + proportional remaining risk).

Output:
- delayChance: integer 0-100.
- predictedDeparture: scheduledDeparture + baseDelayMinutes.
- predictedArrival: scheduledArrival + baseDelayMinutes + enroute adjustment.
- delayReasons: ranked list of contributing factors.

We will ship with realistic seed lookup tables and document how users can update them.

## 12. UI Screens / Exact Elements

### 12.1 Splash / Onboarding
- Logo mark.
- Headline: "Know before the gate does."
- Subheadline (max 12 words): "Track flights, predict delays, and see the aircraft coming your way."
- CTA: "Add Your First Flight".
- Small link: "Use demo data".
- Auto-skip onboarding if a flight is already saved.
- Haptic tap on CTA press (10ms).

### 12.1a Easy Win: Smart Defaults
- Date picker defaults to today.
- Airline picker remembers last selected airline.
- Suggest common routes from tracked-flight history (origin/destination pairs).
- Pre-fill route if user arrived from a deep link.

### 12.1b Easy Win: One-Tap Demo Mode
- Onboarding includes "See how it works" secondary CTA.
- Instantly adds a realistic demo flight with a predicted delay, gate, and inbound aircraft.
- Demo flight auto-updates status on refresh to show prediction changes.

### 12.1c Easy Win: Accessibility First
- Every status, countdown, and prediction has ARIA labels.
- Status ring has a text alternative (e.g., "23 percent chance of delay").
- All motion respects `prefers-reduced-motion`.
- Inputs use proper labels and focus rings.
- Color is never the only signal; icons and text accompany every status.

### 12.2 Add Flight Screen
- Back button.
- Section title: "Track a flight".
- Airline field: searchable dropdown with IATA codes and airline names.
- Flight number field: numeric keyboard, max 4 digits + optional suffix.
- Date field: native date picker, default today, allow +2 days.
- Primary CTA: "Track Flight" (disabled until valid).
- Loading skeleton while fetching.
- Error inline: "Flight not found. Check number and date."
- Haptic confirmation on successful add (50ms).

### 12.2a Easy Win: Natural Language Add
- A single text input accepts phrases like "AA123 July 9" or "Delta 405 tomorrow".
- Parses airline name, flight number, and date into structured fields.
- If parsing fails, falls back to manual fields.

### 12.2b Easy Win: Airline Logos
- Fetch airline logos from a reliable CDN or static repo.
- Show logo in add-flight dropdown, list cards, and detail header.
- Fallback to a generated monogram (first letter of airline name, single accent color) if logo missing.
- Cache logos in IndexedDB.

### 12.2c Easy Win: Flight Number Deep Links
- Route `/add/:airline/:flight/:date` opens add screen pre-filled.
- Route `/add/:airline/:flight` defaults to today.
- Share links so friends can track the same flight in one tap.
- Store referral source so shared flights surface a "Track this flight" banner.

### 12.3 Flight Detail Screen
- Sticky top bar: route + back + share.
- Hero card:
  - Large route text: "JFK → LAX".
  - Airline + flight number.
  - Giant status label.
  - Countdown timer: "Departs in 2h 14m".
  - Countdown digit animation: each digit crossfades independently when minute/second changes; no layout shift.
  - Predicted departure/arrival row.
- Delay prediction ring:
  - Circular progress ring (SVG).
  - Center: "23%".
  - Below: one-line explanation.
- Quick actions: Share, Refresh, View Inbound.
- Status timeline card with status diff animation: old value slides out, new value slides in, and changed row pulses for 3 seconds.
- Gate / Terminal / Aircraft card with aircraft photo if available.
- Pilot-grade data card (METAR, TAF, NOTAM count, wind/visibility).
- Weather forecast strip (departure + arrival).
- Inbound aircraft card (tail, prior flight, estimated arrival, status).
- Where's My Plane map card: expandable card showing aircraft position on a MapLibre GL JS map with OpenStreetMap vector tiles; dark/light basemap matches app theme; plane marker oriented to heading; route line from origin to destination; tap to expand full-screen.
- Last updated: "Updated 28s ago".
- Shake-to-refresh: physical shake gesture triggers immediate status refresh; haptic pulse confirms.

### 12.3a Easy Win: Pull-to-Refresh Physics
- Custom iOS-style elastic pull on the flight list and detail.
- Animated plane icon rotates as the user pulls past the threshold.
- Spring release when refresh fires.
- Degrades to a static refresh button on Android / desktop.

### 12.3b Easy Win: Countdown Lock-Screen Approximation
- User can opt into a persistent high-priority notification that updates every minute.
- Shows: route, countdown, gate, status.
- Re-uses the same Web Push subscription.
- Clear notification when flight lands or is removed.

### 12.3c Easy Win: Smart Notification Timing
- "Leave for airport" alert: departure time minus user-set transit minus 30 min buffer.
- "Boarding soon" alert: 30 minutes before scheduled boarding (or gate arrival).
- "Gate change" alert: within 30 seconds of detecting a change.
- "Inbound aircraft late" alert: when inbound actual arrival exceeds scheduled by 10+ minutes.
- "Status changed" alert: delayed, cancelled, diverted.
- All notifications batch rapid changes within a 2-minute window to avoid spam.

### 12.4 My Flights List
- Floating add button (bottom right or top-right plus).
- Pull-to-refresh feel.
- Empty state (onboarding) when no flights.
- List cards:
  - Left: airline code + flight number.
  - Center: route, time, gate/terminal if known.
  - Right: status pill + delay %.
- Swipe left: delete / archive.
- Haptic feedback on swipe completion (30ms).

### 12.4a Easy Win: Trip Grouping
- Automatically group flights into trips if:
  - Two flights are within 24 hours of each other, and
  - The destination of flight A matches the origin of flight B, or
  - The pair forms a round trip (A→B then B→A) within 14 days.
- Show a trip header with total duration and trip status summary.
- Collapsible trip card on the list.

### 12.4b Easy Win: Flight Archive
- Swiped/deleted flights move to an archive, not void.
- View archived flights from Settings.
- Each archived flight shows final status, actual departure/arrival, and prediction accuracy.
- Prediction accuracy badge: "Nailed it", "3 min off", "12 min off".
- Builds trust in the model and gives users a sense of closure.

### 12.4c Easy Win: Timezone Intelligence
- When the user's current timezone differs from the flight's local timezone, show both times:
  - "Departs 10:23 AM your time / 1:23 PM local".
- Auto-detect reference timezone from device; allow override in settings.
- Show countdown relative to user's current time.

### 12.4d Easy Win: Calendar Export
- One-tap export a tracked flight to device calendar.
- Includes: departure, arrival, terminal, gate, flight number, deep link back to Flightline.
- Uses the Web Share API with a calendar MIME type where supported; falls back to `.ics` download.

### 12.4e Easy Win: Share Status as Image
- Generate a clean PNG status card.
- Card contains: route, airline/flight, status, countdown, delay %, predicted times, gate.
- Optimized for iMessage / WhatsApp / stories.
- Uses html-to-image or canvas; falls back to text share on older devices.

### 12.5 Settings Screen
- Theme selector (system / light / dark).
- Time format toggle (12h / 24h).
- Units toggle (metric / imperial).
- Timezone override toggle.
- API key input (password field) saved to Worker via secure setup.
- Demo mode toggle.
- Notification toggle + permission request.
- Transit time input for smart "leave for airport" alerts.
- Archive viewer.
- Export / import JSON.
- About / GitHub link.
- Keyboard shortcuts hint (`r` refresh, `n` add flight, `esc` close detail).

### 12.5a Easy Win: Notification Permission Friction Reduction
- Only request permission when user toggles notifications ON.
- Explain exactly what they will get before the system prompt.
- If denied, show a one-line helper to re-enable in iOS Settings.

### 12.5b Easy Win: Persistent Notification Preview
- Show a fake notification card in settings so users see what alerts look like.
- Tapping it triggers a haptic pulse and a preview animation.

## 13. Design Direction

### 12.1 Visual Style
- iOS-native, premium, calm.
- Light default, dark system-aware.
- Background: warm off-white (#FAFAF8) / dark charcoal (#0F0F10).
- Accent colors:
  - on-time: emerald (#10B981)
  - delayed: amber (#F59E0B)
  - cancelled: rose (#F43F5E)
  - info: blue (#3B82F6)
- Typography:
  - Display: Geist or Satoshi, large tight tracking.
  - Body: Geist, readable 16-18px.
- Radius system: 16px cards, 999px pills, 12px buttons.
- Shadows: extremely soft, tinted to background.

### 12.2 Motion
- Page transitions: 280ms ease-out.
- Status changes: spring pulse on the status label.
- Countdown: crossfade on digit change, not layout shift.
- Pull-to-refresh: spring physics.
- Card hover / active: scale(0.98) on press.
- All motion gated by `prefers-reduced-motion`.

## 13. Tech Stack

- Frontend: React 19, Vite 6, Tailwind CSS v4, Motion.
- State: IndexedDB via idb-keyval, React Query (TanStack Query) for server state.
- Backend: Cloudflare Worker, Hono, TypeScript.
- PWA: Vite PWA plugin, web manifest, service worker.
- Icons: Phosphor Icons (light weight).
- Date/time: date-fns-tz.
- Maps (optional): Leaflet or static map image from OpenStreetMap.

## 14. Security & Privacy

- API keys live only in Cloudflare Worker secrets.
- No user accounts; no telemetry by default.
- All external API calls go through the Worker.
- CORS restricted to the deployed Pages domain.
- No flight data stored server-side.

## 15. Performance & Caching

- Worker caches aggressively at the edge.
- Front end caches flight objects in IndexedDB.
- Images (airline logos, maps) lazy loaded.
- Bundle split by route.
- Countdown timer local, no API polling.
- Refresh interval: 60 seconds when app is active; push triggers immediate refresh.

## 16. PWA / Offline

- `display: standalone`, theme color matches surface.
- Icons: 192x192 and 512x512 maskable.
- Splash screens via Apple meta tags and manifest.
- Service worker caches shell and recent flight data.
- Offline: read cached flights, show stale banner, cannot add new flight.
- Web Push: prompt only after user enables in settings.

## 17. Open Source & Deployment

- License: MIT.
- Repo includes:
  - `web/` (React PWA).
  - `worker/` (Cloudflare Worker).
  - `data/` (seed delay lookup tables).
  - `README.md` with self-host instructions.
- One-click deploy buttons for Cloudflare Pages + Workers.
- Users add their own `AVIATIONSTACK_API_KEY` via Wrangler secret.

## 18. Milestones

1. **M0 — Repo + Spec Approval:** You approve this SPEC.md.
2. **M1 — Static PWA Shell:** Vite setup, routing, design tokens, onboarding, add-flight UI, settings UI.
3. **M2 — Flight Status + Detail:** Mock flight data, flight detail screen, countdown, status, timeline.
4. **M3 — Worker + Live Data:** Cloudflare Worker, Aviationstack proxy, real lookups, caching.
5. **M4 — Prediction + Delays:** Heuristic model, delay ring, reasons, predicted times.
6. **M5 — Pro Features:** Inbound aircraft, pilot-grade data, weather forecast, delay reasons.
7. **M6 — Polish + PWA:** Push notifications, manifest, icons, offline mode, share card.

## 19. Open Questions / Decisions

1. Confirm the name "Flightline" or pick another.
2. Confirm push notifications as the Live Activities fallback.
3. Confirm demo mode ships with M2 or M1.
4. Should the Worker support multiple aviation data providers (Aviationstack primary, mock fallback)?
5. Should we include a map for "Where's My Plane" in MVP, or defer to a later milestone?
