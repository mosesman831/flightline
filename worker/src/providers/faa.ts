// FAA National Airspace System (NAS) status adapter — free, no key. The FAA
// endpoint returns XML (AIRPORT_STATUS_INFORMATION). Workers have no DOMParser,
// so parsing is done with resilient regex/string extraction that NEVER throws.
// The airport identifier used inside the feed (<ARPT>) is an IATA code.
import type { NasEvent, NasStatusCore, ProviderResult } from '../types';
import { toIsoOrNull } from '../normalize';
import { recordSuccess, recordError } from '../providerState';
import type { FetchImpl } from './aviationstack';

const NAS_URL = 'https://nasstatus.faa.gov/api/airport-status-information';

// Decode the handful of XML entities the feed may emit.
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

// All inner contents for every `<tag>...</tag>` occurrence in `xml`.
function extractBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

// Trimmed, entity-decoded text of the first `<tag>...</tag>` in `block`, or null.
function extractTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return null;
  const v = decodeEntities(m[1]).trim();
  return v.length > 0 ? v : null;
}

// First element `<tag ...>inner</tag>` (or self-closing) as { openTag, inner }.
function firstElement(block: string, tag: string): { openTag: string; inner: string } | null {
  const paired = block.match(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (paired) return { openTag: paired[1], inner: paired[2] };
  const selfClosing = block.match(new RegExp(`<${tag}\\b([^>]*)\\/>`, 'i'));
  if (selfClosing) return { openTag: selfClosing[1], inner: '' };
  return null;
}

// Value of `name="..."` (single or double quoted) within a tag's attribute text.
function attr(openTag: string, name: string): string | null {
  const m = openTag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')) ??
    openTag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i'));
  return m ? decodeEntities(m[1]).trim() || null : null;
}

// PURE: parse a human duration ("38 minutes", "1 hour and 30 minutes", "2 hours")
// into total minutes. Returns null when no number is present.
export function parseDelayMinutes(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const s = raw.toLowerCase();
  let total = 0;
  let matched = false;

  const hourM = s.match(/(\d+)\s*hour/);
  if (hourM) {
    total += parseInt(hourM[1], 10) * 60;
    matched = true;
  }
  const minM = s.match(/(\d+)\s*min/);
  if (minM) {
    total += parseInt(minM[1], 10);
    matched = true;
  }
  if (!matched) {
    const n = s.match(/\d+/);
    if (n) {
      total = parseInt(n[0], 10);
      matched = true;
    }
  }
  return matched ? total : null;
}

// Read Min/Max either as attributes on the Arrival_Departure tag or as child
// elements, returning parsed minutes.
function arrivalDepartureMinutes(el: { openTag: string; inner: string }): number | null {
  const maxTxt = attr(el.openTag, 'Max') ?? extractTag(el.inner, 'Max');
  const minTxt = attr(el.openTag, 'Min') ?? extractTag(el.inner, 'Min');
  return parseDelayMinutes(maxTxt) ?? parseDelayMinutes(minTxt);
}

// PURE: extract every NAS advisory that applies to `iata` from the feed XML.
// Resilient to missing sections; never throws.
export function parseNasEvents(xml: string, iata: string): NasEvent[] {
  if (typeof xml !== 'string' || xml.length === 0) return [];
  const want = iata.toUpperCase();
  const events: NasEvent[] = [];

  const matchesArpt = (block: string): boolean => {
    const arpt = extractTag(block, 'ARPT');
    return arpt !== null && arpt.toUpperCase() === want;
  };

  // Ground stops: <Ground_Stop_List><Program><ARPT/><Reason/><End_Time/>.
  for (const list of extractBlocks(xml, 'Ground_Stop_List')) {
    for (const program of extractBlocks(list, 'Program')) {
      if (!matchesArpt(program)) continue;
      events.push({
        type: 'ground_stop',
        reason: extractTag(program, 'Reason'),
        avgDelayMinutes: null,
        scope: null,
        endTime: toIsoOrNull(extractTag(program, 'End_Time')),
      });
    }
  }

  // Ground delay programs: <Ground_Delay_List><Ground_Delay><ARPT/><Reason/><Avg/>.
  for (const list of extractBlocks(xml, 'Ground_Delay_List')) {
    for (const gd of extractBlocks(list, 'Ground_Delay')) {
      if (!matchesArpt(gd)) continue;
      events.push({
        type: 'ground_delay',
        reason: extractTag(gd, 'Reason'),
        avgDelayMinutes: parseDelayMinutes(extractTag(gd, 'Avg')),
        scope: extractTag(gd, 'Scope'),
        endTime: null,
      });
    }
  }

  // Airport closures: <Airport_Closure_List><Airport><ARPT/><Reason/><Reopen/>.
  for (const list of extractBlocks(xml, 'Airport_Closure_List')) {
    for (const airport of extractBlocks(list, 'Airport')) {
      if (!matchesArpt(airport)) continue;
      events.push({
        type: 'closure',
        reason: extractTag(airport, 'Reason'),
        avgDelayMinutes: null,
        scope: null,
        endTime: toIsoOrNull(extractTag(airport, 'Reopen')),
      });
    }
  }

  // Arrival/departure delays: <Arrival_Departure_Delay_List><Delay><ARPT/>
  //   <Reason/><Arrival_Departure Type=".." (Min/Max attr or child)/>.
  for (const list of extractBlocks(xml, 'Arrival_Departure_Delay_List')) {
    for (const delay of extractBlocks(list, 'Delay')) {
      if (!matchesArpt(delay)) continue;
      const el = firstElement(delay, 'Arrival_Departure');
      events.push({
        type: 'delay',
        reason: extractTag(delay, 'Reason'),
        avgDelayMinutes: el ? arrivalDepartureMinutes(el) : null,
        scope: el ? attr(el.openTag, 'Type') : null,
        endTime: null,
      });
    }
  }

  return events;
}

// Fetch + parse NAS status for a single airport. Upstream failures surface as a
// discriminated ProviderResult (router maps to 429/502). A body that fetched but
// fails to parse yields graceful empty results (hasIssues:false) rather than an
// error, per the "never throw" contract.
export async function fetchNasStatus(
  iata: string,
  fetchImpl: FetchImpl = fetch,
  nowMs: number = Date.now(),
): Promise<ProviderResult<NasStatusCore>> {
  const code = iata.toUpperCase();

  let resp: Response;
  try {
    resp = await fetchImpl(NAS_URL);
  } catch {
    recordError('faa', 'network error', nowMs);
    return { ok: false, reason: 'error', message: 'network error' };
  }
  if (resp.status === 429) {
    recordError('faa', 'rate limited', nowMs);
    return { ok: false, reason: 'rate_limited', message: 'rate limited' };
  }
  if (!resp.ok) {
    recordError('faa', `upstream ${resp.status}`, nowMs);
    return { ok: false, reason: 'error', message: `upstream ${resp.status}` };
  }

  let xml: string;
  try {
    xml = await resp.text();
  } catch {
    recordError('faa', 'read failed', nowMs);
    return { ok: false, reason: 'error', message: 'read failed' };
  }

  let events: NasEvent[];
  try {
    events = parseNasEvents(xml, code);
  } catch {
    // Resilient contract: a fetched-but-unparseable body is treated as "no
    // advisories" rather than a hard failure.
    events = [];
  }

  recordSuccess('faa', nowMs);
  return {
    ok: true,
    data: { airport: code, hasIssues: events.length > 0, events },
  };
}
