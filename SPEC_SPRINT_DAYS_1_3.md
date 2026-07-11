# Flightline Sprint Plan — Days 1–3

## 1. Goal

By the end of Day 3, a user can add a real flight by airline, number, and date; reopen it offline; and see provider-backed schedule/status, gate/terminal, METAR/TAF, and a last-known aircraft position when ADS-B data exists. Live flights refresh without overwriting traveller-entered fields, and material changes are recorded in the timeline.

The installed PWA has one manifest and one service-worker path, clear online/offline and stale-data states, a reliable status-image share flow, and the smart-notification rules from `SPEC.md` §12.3c implemented for foreground/installed-app operation.

This sprint does **not** add accounts, bookings, historical ML, server-side flight storage, full inbound rotation discovery, or guaranteed background Web Push. Those would make the three-day scope unsafe.

## 2. Current State Summary

### Already built

- React 19/Vite application with hash routing, responsive iOS-style screens, light/dark themes, and keyboard shortcuts.
- Flight list, archive, settings, add-flight form, and a visually rich flight-detail route.
- Searchable static airline/airport lists, natural-language add parsing, deep-link prefill with a date, recent routes, and traveller fields.
- A detailed `Flight` model and IndexedDB persistence through `idb-keyval`, including import/export, archive, star, and update helpers.
- Five deterministic demo flights are inserted whenever IndexedDB is empty.
- A 60-second polling hook and frontend Worker client exist.
- Worker endpoints currently exist for flight status, position, METAR/TAF, provider metadata, and health.
- Worker adapters exist for Aviationstack, AirLabs, adsb.lol, OpenSky, aviationweather.gov, and an unused Open-Meteo forecast call.
- The detail page already renders status, countdown, prediction, timetable, timeline, weather, inbound, and map surfaces.
- PNG generation and file sharing already use `html-to-image` and Web Share, with download fallback.
- `vite-plugin-pwa` is configured and 192/512 icons exist.

### Mocked, disconnected, or incomplete

- `AddFlight.tsx` never calls the Worker. It saves a user-selected route with departure fixed at noon and arrival four hours later.
- User-entered flights store only the numeric portion in common flows, while `/api/flight/:flightNumber` needs a full IATA flight number such as `BA178`; lookup date is not sent.
- `FlightDetail.tsx` uses a random distance and a simulated aircraft at 40% of the route. `fetchLivePosition()` is not used.
- Live enrichment updates only selected operational fields and origin METAR. It does not update the real route/schedule, destination weather, timeline, persisted prediction, or map position.
- Polling saves only when gate, terminal, status, or delay changes. Pull-to-refresh and the `r` shortcut only reload IndexedDB; they do not force a network refresh.
- The Worker currently queries AirLabs and Aviationstack in parallel, with AirLabs effectively primary. It does not implement the required ordered fallback.
- adsb.lol and OpenSky are position-only providers. They cannot replace a missing schedule/status record.
- Worker caching is an isolate-local `Map`, so entries disappear on cold starts and are not shared across isolates.
- CORS is `*`. Provider keys are Worker environment variables, but Settings also stores keys in `localStorage` and sends an unsupported `X-API-Key`; these two models are disconnected and conflict with `SPEC.md` §14.
- Provider status always reports healthy and does not probe providers. No automated tests or test scripts exist.
- `NotificationsSection` is local UI state, is hard-coded disabled on detail, and is not connected to notification utilities or polling.
- Notification permission, preferences, transit time, scheduling, change detection, and two-minute batching are absent.
- There are two manifest sources and two service-worker sources (`vite-plugin-pwa` and `public/sw.js`). The static manifest and HTML reference missing 152/167/180 icons.
- Offline data happens to remain readable from IndexedDB, but there is no offline banner, stale marker, add-flight guard, or map/image fallback state.
- The current image capture omits the gate because it captures only the hero card, and its fallback downloads an image instead of first offering the required text share.

## 3. Day 1: Live Data Backend

### Outcome

Deliver a date-aware, normalized Worker contract with deterministic provider order, persistent edge caching, production CORS restricted to the one configured Pages origin, and tests that do not call real providers.

### Exact Worker API for this sprint

All JSON responses include `requestId`, `fetchedAt`, `dataSources`, and `stale`. Provider secrets never appear in responses or logs.

| Method and path | Input | Response and behavior |
|---|---|---|
| `POST /api/track` | `{ "airlineIata": "BA", "flightNumber": "178", "date": "2026-07-11" }` | Validates and canonicalizes to `BA178`; returns the initial normalized flight snapshot. `400` invalid input, `404` no date-matched schedule, `429` all schedule providers rate-limited, `502` providers unavailable. |
| `GET /api/flight/:iataNumber?date=YYYY-MM-DD` | Full IATA number such as `BA178`; date required | Returns the same normalized schedule/status shape for refresh. It may include `livePosition`; it never silently returns another service date. |
| `GET /api/position/:icao24` | Six-character ICAO24 address obtained from a prior position result | Returns normalized position via adsb.lol, then OpenSky. `404` means no recent position. |
| `GET /api/position/callsign/:callsign` | Operational callsign when known | Uses adsb.lol callsign search. If that yields an ICAO24 but no usable position, tries OpenSky by that ICAO24. |
| `GET /api/weather/:icao` | Four-character airport ICAO code | Returns normalized METAR and TAF. Keep forecast work out of this sprint. |
| `GET /api/providers` | No provider key headers | Returns configured/not-configured plus last observed success/error; it must not claim untested providers are healthy. |
| `GET /api/health` | None | Returns Worker health and version without probing paid upstreams. |

`POST /api/track` is the add-flight contract from the main SPEC. The GET endpoints remain stateless: the browser owns tracked-flight IDs and the Worker stores no user flight list.

The normalized flight/status response must add:

- `canonicalKey`: `YYYY-MM-DD:IATA_NUMBER`, for example `2026-07-11:BA178`.
- `serviceDate` and full `iataNumber`.
- Normalized origin/destination, schedule, estimates, actuals, status, delay, gate, terminal, aircraft, registration, and codeshare fields.
- Optional `livePosition` with `icao24`, latitude, longitude, altitude, velocity, heading, `onGround`, and an absolute `observedAt`.
- Separate `statusSource` and `positionSource`; do not imply that ADS-B supplied the schedule.

### Required fallback chain

The required order is **Aviationstack → AirLabs → adsb.lol → OpenSky**, applied by capability:

1. Query Aviationstack first for a record matching both canonical IATA number and requested service date.
2. Query AirLabs only when Aviationstack is unconfigured, errors, is rate-limited, returns no match, or returns an unusable record without route/schedule.
3. Once a valid schedule/status base exists, query adsb.lol for optional live position, preferring a known ICAO24 and otherwise using a provider-supplied operational callsign.
4. Query OpenSky only if adsb.lol has no usable position and an ICAO24 is known.

Use the first usable schedule/status response rather than always merging both paid providers; this preserves quota and makes provenance deterministic. Missing optional gate or aircraft fields do not justify a second paid request during this sprint.

If Aviationstack and AirLabs both fail, `POST /api/track` returns an error. An ADS-B result alone is not enough to create a flight because it has no authoritative route or schedule. Existing saved flights may still refresh position while retaining their last-known schedule/status.

### Provider normalization

- Add the requested date to Aviationstack/AirLabs queries where supported, then independently verify the returned local departure date.
- Use HTTPS for every provider request; never fall back to Aviationstack over plain HTTP.
- Convert all provider datetimes to ISO 8601 with an offset before returning them.
- Normalize provider statuses into the frontend union: `scheduled`, `boarding`, `active`, `landed`, `delayed`, `cancelled`, `diverted`.
- Treat zero as valid for delay, coordinates, altitude, and rates; avoid truthiness-based field mapping.
- Convert adsb.lol's “seconds seen ago” to absolute `observedAt`, matching OpenSky semantics.
- Reject stale ADS-B observations older than 60 seconds for a “live” marker, but retain them as last-known position with `stale: true`.

### Caching strategy

Replace the process-local `Map` with the Cloudflare Cache API. Use versioned, canonical keys that exclude secrets:

- `status:v1:{serviceDate}:{iataNumber}`
- `position:v1:{icao24-or-callsign}`
- `weather:v1:{icao}`

TTLs:

- Active, boarding, or delayed status: **45 seconds**.
- Scheduled status more than three hours away: **5 minutes**.
- Landed, cancelled, or diverted status: **30 minutes**.
- Position: **15 seconds**.
- METAR/TAF: **10 minutes**.
- Confirmed not-found: **30 seconds**; do not negative-cache authentication, rate-limit, or upstream failures.

Keep the last successful status value for up to 15 minutes as stale-if-error and explicitly return `stale: true`. Use `Cache-Control: no-store` on browser responses so browser caching cannot hide manual refreshes; edge reuse is controlled by the Worker cache.

### CORS policy

- Add a non-secret Worker variable `PAGES_ORIGIN` containing the exact production origin, for example `https://flightline.pages.dev` once the actual project domain is confirmed.
- In production, emit `Access-Control-Allow-Origin: ${PAGES_ORIGIN}` only when `request.headers.origin` exactly matches it. Return `403` for a different browser origin and never emit `*`.
- Permit requests with no `Origin` so CLI health checks still work.
- Preflight allows only `GET, POST, OPTIONS` and `Content-Type`; credentials and `X-API-Key` are not allowed.
- Add `Vary: Origin`.
- Local Wrangler development may use a separate `DEV_ORIGIN=http://localhost:5173`; it must not be set in production or combined into a wildcard/regex policy.

### Secrets and configuration

Worker secrets:

- `AVIATIONSTACK_API_KEY`
- `AIRLABS_API_KEY`

Worker variables:

- `PAGES_ORIGIN`
- `ENVIRONMENT=production`

Frontend build configuration:

- `VITE_FLIGHTLINE_API_URL` for the deployed Worker URL.

Rename the current `AVIATIONSTACK_KEY`/`AIRLABS_KEY` bindings to the documented names. Remove `FLIGHTAPI_KEY` from this sprint because no FlightAPI provider exists. The frontend must stop storing provider keys in `localStorage`; self-hosters configure Worker secrets through Wrangler/Cloudflare. Settings should show Worker/provider readiness, not accept secrets.

### Day 1 test plan

Add a lightweight Worker test runner and use mocked `fetch`; CI/unit tests must never consume provider quota.

1. Contract tests for validation, canonical flight number construction, date matching, status normalization, and response/error shapes.
2. Fallback tests proving Aviationstack is called first; AirLabs is called only for each defined failure mode; adsb.lol follows a valid schedule; OpenSky follows adsb.lol only when ICA24 is available.
3. Fixture-based mapper tests for each provider, including zero-valued fields, malformed payloads, 401, 404, 429, and timeout.
4. Cache tests for each TTL, canonical date separation, negative caching, stale-if-error, and no secret material in keys.
5. CORS tests for the exact Pages origin, rejected foreign origin, no-origin request, and valid/invalid preflight.
6. One staging smoke test with a known same-day flight: `/health`, `/providers`, `/track`, `/flight`, `/position` when available, and `/weather`. Record status codes and provenance, not secret values.

## 4. Day 2: Frontend Live Integration

### `AddFlight.tsx`: search and add real flights

1. Keep airline, flight number, and date as the authoritative inputs. Normalize a number-only input by prepending the selected airline; strip a duplicate prefix if the user enters `BA178` after selecting BA.
2. Change the default date from tomorrow to today and constrain it to today through +2 days, matching the existing SPEC.
3. On submit, call `POST /api/track`; show the existing loading state and the exact inline not-found message from the SPEC. Distinguish validation, rate-limit, offline, and provider-unavailable errors.
4. Build the saved `Flight` from the Worker response, not noon/+4 hours. Resolve rich airport metadata by IATA from the local airport table, with a safe API-derived fallback for airports missing locally.
5. Preserve traveller fields from the form. Do not let provider data overwrite seat, cabin, notes, check-in, archive, or star state.
6. Use `canonicalKey` to prevent duplicate tracking. If it exists, update live fields and navigate to the existing record.
7. Save only after a successful date-matched lookup. When offline, disable Track Flight and explain that saved flights remain available.

### `FlightDetail.tsx`: live status, position, and METAR

- Render schedule, estimates, actuals, status, delay, gate, terminal, aircraft, and tail number from the persisted live snapshot.
- Replace random distance with a deterministic great-circle calculation from airport coordinates.
- Add `livePosition` to the detail map. Orient the plane marker by heading and show altitude/speed/observed time. If position is absent or stale, show the route and a “Live position unavailable” or “Last seen …” state; never display a simulated marker for a real flight.
- Fetch/display origin and destination METAR/TAF on initial live load and when their ten-minute TTL expires. Keep the existing pilot card shape.
- Add a real Refresh action that invokes the shared refresh pipeline and reports refreshing, fresh, stale, or failed state.
- Append timeline entries for changes to status, gate, terminal, predicted times, aircraft, and tail number, with old/new values and source.
- Keep synthetic delay prediction clearly labelled “estimate”; persist its output after each successful live merge so list and detail show the same value.

### `flightStore.ts`: persist real flights safely

Continue using the existing IndexedDB database and store; no migration library is needed for this additive change.

Extend saved live flights with:

- `canonicalKey`
- `statusSource`, `positionSource`, and `dataSources`
- `livePosition` plus `positionUpdatedAt`
- `lastLiveAttemptAt`, `lastLiveSuccessAt`, `isStale`, and a non-sensitive `lastLiveError`

Add one merge operation that:

1. Reads the current object.
2. Merges only provider-owned live fields.
3. Preserves traveller/local fields.
4. Generates timeline diffs before writing.
5. Writes once and notifies subscribers once.

`saveFlight()` should not mutate its argument. All store mutations, including star/archive/delete, should consistently call `notifyFlightsChanged()`. Imported or old demo records without new fields remain readable through defaults.

### Polling and refresh strategy

- Expose a single `refreshFlight(id)`/`refreshNow()` pipeline used by polling, pull-to-refresh, detail Refresh, the `r` shortcut, focus, and reconnect.
- Status polling runs only while `document.visibilityState === "visible"`:
  - Every **60 seconds** from three hours before departure until terminal status.
  - Every **5 minutes** for scheduled flights more than three hours away.
  - Stop for archived, demo, landed, cancelled, and diverted flights.
- Poll position every **15 seconds only while the active flight detail map is visible**. Stop on hidden tabs, terminal status, on-ground completion, or component unmount.
- Refresh METAR/TAF on detail open and at most every **10 minutes**.
- Trigger an immediate refresh on `online` and window focus if the last successful refresh exceeds the applicable interval.
- Use an in-flight guard and `AbortController` to prevent overlapping or post-unmount writes. Refresh active flights with bounded concurrency rather than serially blocking the whole list.
- A failed refresh retains last-known data, updates stale/error metadata, and does not advance `lastLiveSuccessAt`.

### Day 2 verification

- Add a real date-matched flight, reload, and confirm the same normalized object survives in IndexedDB.
- Verify duplicate add updates instead of duplicating.
- Verify traveller fields survive live refresh.
- Exercise status/gate diffs and confirm one timeline event per actual change.
- Verify real position, heading, and staleness behavior with fixtures; verify no simulated marker appears for a real flight.
- Toggle offline/online and tab visibility to confirm polling stops/resumes and stale data remains usable.
- Run root typecheck/build and lint after the integration tests.

## 5. Day 3: PWA Polish

### Service worker and manifest

1. Make `vite-plugin-pwa` the only service-worker/manifest source. Remove the legacy `public/sw.js` and static `public/manifest.json` path after transferring any needed metadata.
2. Verify the generated production build registers exactly one Workbox service worker. Use explicit `virtual:pwa-register` registration only if update/error UI needs it; do not maintain a second manual registration path.
3. Keep one manifest with `display: standalone`, `scope: "/"`, and hash-router-compatible `start_url: "/#/"`.
4. Keep 192 and 512 icons with both `any maskable` purposes. Generate a real 180 Apple touch icon from the 512 source or point HTML only at an icon that exists; remove broken 152/167 links.
5. Add a favicon link and retain light/dark `theme-color` metadata.
6. Precache the application shell. Runtime-cache same-origin static assets and airline logos, but keep API truth in IndexedDB rather than a second service-worker data cache.

### Smart notification timing (`SPEC.md` §12.3c)

Day 3 implements notification preferences and local notifications while the installed PWA is running. Guaranteed delivery while iOS has suspended/closed the app requires a push subscription store and server-side scheduler, which is explicitly deferred.

- Add a Settings master toggle, per-alert toggles, transit-minutes input, preview card, and permission explanation.
- Request notification permission only after the user enables notifications. Persist preferences locally and show the iOS Settings recovery hint when denied.
- Rebuild timers whenever flights or preferences change:
  - **Leave for airport:** `scheduledDeparture - transitMinutes - 30 minutes`.
  - **Boarding soon:** `boardingTime - 30 minutes`; skip when no authoritative boarding time exists rather than presenting an invented time.
  - **Gate change:** enqueue immediately when polling detects a different non-empty gate.
  - **Inbound aircraft late:** enqueue when inbound estimated/actual arrival first crosses 10 minutes late.
  - **Status changed:** enqueue only on transition into delayed, cancelled, or diverted.
- Persist a dedupe key per flight/event/value so reloads do not repeat an alert.
- To reconcile “gate change within 30 seconds” with two-minute batching: wait at most 30 seconds for the first event, publish one tagged notification, then coalesce further events into that same notification for the remainder of a rolling two-minute window.
- Remove timers and notifications when a flight is archived/deleted or reaches terminal status.
- Clicking a notification opens `/#/flight/:id`.

Do not claim full Web Push support in Day 3. `subscribeToPushNotifications()` should remain unused or be removed until a VAPID subscription and server persistence design is approved.

### Share status as image

- Render a dedicated, deterministic share card rather than capturing the visible hero.
- Include route, airline/flight, current status, countdown, delay percentage, predicted times, and gate as required by §12.4e.
- Avoid remote images in the capture path; use a local/monogram airline mark so CORS cannot break PNG generation.
- Prefer file sharing when `navigator.canShare({files})` succeeds.
- If file sharing is unsupported, attempt text/URL sharing next; download the PNG only as the final fallback.
- Include the hash deep link for the add-flight route in shared text, without exposing the local IndexedDB ID as a universally resolvable tracking link.

### Offline degraded mode

- Keep the shell and saved flights available from the PWA precache plus IndexedDB.
- Show a global offline banner and per-flight “Last updated … / Offline” state.
- Disable network-only add and refresh actions with useful copy; never replace cached values with blanks on failure.
- Show static route/map fallback when map tiles are unavailable and monograms when logo requests fail.
- On reconnect, dismiss the banner, run one bounded refresh, and display whether fresh data was recovered.
- Treat a cached flight as stale when its last successful status refresh exceeds twice its normal interval.

### Day 3 verification

- Production-build inspection: one manifest, one registered service worker, no missing icon requests, installability, and offline shell reload.
- Install on iOS Safari and one Chromium browser; verify permission is requested only from the toggle.
- Use fake clocks/fixtures for leave, boarding, gate, inbound, status, dedupe, and two-minute coalescing.
- Verify notification click routing and cleanup.
- Verify share file, text-share fallback, and download fallback.
- Verify offline list/detail, blocked add, static map state, stale labels, and reconnect refresh.

## 6. Open Decisions

Each item needs human confirmation before its implementation block; the recommendation is the sprint default.

1. **Exact production Pages origin:** the repository does not identify a deployed Pages domain.  
   **Recommendation:** confirm the Cloudflare Pages project URL before Day 1 and set that exact origin in `PAGES_ORIGIN`; do not guess or use `*`.

2. **Strict fallback or cross-provider merge:** calling both paid providers can fill more fields but doubles quota and creates conflicting truth.  
   **Recommendation:** strict first-usable fallback, Aviationstack then AirLabs, with explicit provenance.

3. **Provider-key ownership:** current Settings stores keys in the browser, contrary to the main SPEC.  
   **Recommendation:** Worker secrets only; remove browser key entry and keep a read-only provider readiness screen.

4. **Free-tier budget versus one-minute status:** Aviationstack's documented free quota cannot sustain continuous minute polling.  
   **Recommendation:** five-minute polling outside T-3h, 60 seconds only in the active window, and document that frequent live use needs an adequate provider plan.

5. **Canonical identity and codeshares:** a flight number alone is ambiguous across dates and codeshares.  
   **Recommendation:** `serviceDate:IATA_NUMBER` is the browser canonical key; retain codeshare as metadata rather than creating duplicate tracked flights automatically.

6. **Date mismatch behavior:** providers may return the nearest flight instead of the requested date.  
   **Recommendation:** reject mismatches as not found; never silently track another day's flight.

7. **Position identity when ICAO24 is unavailable:** OpenSky cannot be efficiently queried by callsign with the current adapter.  
   **Recommendation:** use adsb.lol callsign search to discover ICAO24, persist it, and use OpenSky only after ICAO24 is known; do not fetch/filter the global OpenSky state list.

8. **Persist last position or keep it ephemeral:** persistence improves offline behavior but can show old coordinates.  
   **Recommendation:** persist the last position with `observedAt` and a prominent stale state; never label it live after 60 seconds.

9. **Background notification guarantee:** local timers do not run reliably after iOS suspends the PWA.  
   **Recommendation:** ship foreground/installed-app smart alerts in Day 3 and schedule Web Push/VAPID plus subscription storage as a later milestone.

10. **Boarding fallback when the provider has no boarding time:** inventing a time creates false precision.  
    **Recommendation:** skip the boarding alert and explain “boarding time unavailable”; consider a user-defined fallback later.

11. **Inbound lateness threshold source:** §12.3c says actual arrival, but waiting for actual arrival makes the warning late.  
    **Recommendation:** trigger on estimated or actual arrival crossing +10 minutes, once per inbound leg, and label an estimate as estimated.

12. **Thirty-second gate alert versus two-minute batching:** delaying every event for two minutes violates the gate requirement.  
    **Recommendation:** first alert within 30 seconds, then update/coalesce under the same notification tag for two minutes.

13. **HashRouter or BrowserRouter:** changing routers requires Pages rewrite/deep-link deployment work.  
    **Recommendation:** keep HashRouter for this sprint and align `start_url` and shared links with `/#/`.

14. **Manifest/service-worker ownership:** manual assets and plugin generation currently overlap.  
    **Recommendation:** `vite-plugin-pwa` owns both; no hand-maintained `public/sw.js`.

15. **Open-Meteo forecast and inbound rotation:** code stubs/UI exist, but neither is required to prove live status, position, or METAR.  
    **Recommendation:** defer both; do not expand Days 1–3 beyond the requested live-data/PWA slice.

16. **Test infrastructure:** neither package has a test runner.  
    **Recommendation:** add only one lightweight Worker/frontend unit runner on Day 1; avoid end-to-end framework setup during this sprint and use the documented manual PWA matrix.

## 7. Risks & Mitigations

1. **Paid-provider quotas are exhausted by polling.**  
   Mitigation: strict fallback, status-aware intervals, edge caching, no duplicate requests, visible quota guidance, and mocked automated tests.

2. **Providers return a wrong date, codeshare, timezone, or changed schema.**  
   Mitigation: canonical date/flight validation, fixture tests, runtime response guards, offset-bearing ISO normalization, and explicit provenance.

3. **Flight number cannot be mapped reliably to a live aircraft.**  
   Mitigation: treat position as optional, persist discovered ICAO24, use adsb.lol before OpenSky, reject stale observations, and never synthesize a live marker.

4. **iOS suspends timers/service workers, so local notifications are missed.**  
   Mitigation: state the foreground limitation, rebuild timers on resume, dedupe persisted events, test installed mode, and defer guaranteed delivery to a separately designed Web Push service.

5. **Conflicting service workers or stale offline assets break updates.**  
   Mitigation: one plugin-owned service worker/manifest, versioned caches, production-build inspection, update activation testing, and explicit stale/offline UI.

## 8. Definition of Done

### Day 1

- [ ] All exact endpoints above return documented normalized JSON and errors.
- [ ] A requested date is required and a mismatched provider record is rejected.
- [ ] Tests prove Aviationstack → AirLabs → adsb.lol → OpenSky capability-aware order.
- [ ] ADS-B-only data cannot create an authoritative tracked flight.
- [ ] Cloudflare Cache API replaces the in-memory `Map` with the documented TTLs and stale behavior.
- [ ] Production CORS allows only the confirmed `PAGES_ORIGIN`; foreign origins fail and `*` is absent.
- [ ] Secrets use `AVIATIONSTACK_API_KEY` and `AIRLABS_API_KEY`; no provider key is read from the browser.
- [ ] Mocked contract, provider, cache, and CORS tests pass.
- [ ] One staging smoke test confirms health, provider readiness, flight, optional position, and weather provenance.

### Day 2

- [ ] Add Flight performs a real date-aware lookup and never creates synthetic noon/+4-hour data.
- [ ] Not-found, offline, rate-limit, and provider errors have distinct user-visible states.
- [ ] Real schedule/status, gate/terminal, METAR/TAF, and optional live position survive reload in IndexedDB.
- [ ] Duplicate canonical flights update rather than duplicate.
- [ ] Live merges preserve all traveller/local fields and append accurate timeline diffs.
- [ ] Detail distance is deterministic and real flights never show a simulated position.
- [ ] Manual, focus, reconnect, list, and detail refreshes share one guarded pipeline.
- [ ] Status, position, weather, visibility, and terminal-state polling rules are verified.
- [ ] Offline or failed refresh retains last-known data and marks it stale.
- [ ] Frontend typecheck/build and lint pass.

### Day 3

- [ ] The production build has one manifest and one service worker, valid icons, and an installable standalone PWA.
- [ ] Saved list/detail routes reload offline; add is blocked offline; stale/offline and reconnect states are clear.
- [ ] Notification permission is requested only after opt-in and preferences/transit time persist.
- [ ] Leave, boarding, gate, inbound-late, and qualifying status rules are implemented with dedupe.
- [ ] The first gate alert is emitted within 30 seconds of detection and rapid events coalesce for two minutes.
- [ ] Notification click and flight cleanup behavior work in installed mode.
- [ ] The share card contains every §12.4e field and file, text, and download paths work.
- [ ] iOS Safari and Chromium manual PWA checks pass.
- [ ] Background notification limitations and deferred Web Push work are documented without claiming unsupported behavior.
