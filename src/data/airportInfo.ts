export interface AirportInfo {
  iata: string;
  terminals: string[];
  securityWaitBand: string;
  walkTimeNote: string;
  amenities: string[];
  tips?: string;
}

/**
 * Generic, "typical" airport guidance for major hubs. This is static reference
 * data — NOT live security queue or terminal information — so the UI labels it
 * as typical guidance rather than a real-time feed.
 */
export const AIRPORT_INFO: Record<string, AirportInfo> = {
  JFK: {
    iata: 'JFK',
    terminals: ['T1', 'T4', 'T5', 'T7', 'T8'],
    securityWaitBand: 'Typically 15–35 min',
    walkTimeNote: 'Gate to gate up to 15 min; AirTrain between terminals',
    amenities: ['Lounges', 'AirTrain link', 'Duty-free', 'Dining'],
    tips: 'Terminals are not connected airside — allow time for AirTrain transfers.',
  },
  EWR: {
    iata: 'EWR',
    terminals: ['T A', 'T B', 'T C'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'Gate to gate up to 15 min; AirTrain between terminals',
    amenities: ['Lounges', 'AirTrain link', 'Dining', 'Shops'],
    tips: 'Terminal A is the newest; check which terminal your airline uses.',
  },
  LGA: {
    iata: 'LGA',
    terminals: ['T A', 'T B', 'T C'],
    securityWaitBand: 'Typically 10–25 min',
    walkTimeNote: 'Compact terminals; gate to gate under 10 min',
    amenities: ['Lounges', 'Dining', 'Shops', 'Local eateries'],
    tips: 'No rail link — use bus, taxi or rideshare to reach Manhattan.',
  },
  LAX: {
    iata: 'LAX',
    terminals: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'TBIT'],
    securityWaitBand: 'Typically 20–40 min',
    walkTimeNote: 'Gate to gate up to 20 min; some transfers landside',
    amenities: ['Lounges', 'Metro link', 'Dining', 'Duty-free'],
    tips: 'The horseshoe layout is congested — arrive early for international departures.',
  },
  SFO: {
    iata: 'SFO',
    terminals: ['T1', 'T2', 'T3', 'International'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'Gate to gate up to 15 min; AirTrain between terminals',
    amenities: ['Lounges', 'BART rail link', 'AirTrain', 'Dining', 'Yoga room'],
    tips: 'BART connects directly to downtown San Francisco.',
  },
  ORD: {
    iata: 'ORD',
    terminals: ['T1', 'T2', 'T3', 'T5'],
    securityWaitBand: 'Typically 15–35 min',
    walkTimeNote: 'Gate to gate up to 20 min; ATS train between terminals',
    amenities: ['Lounges', 'CTA rail link', 'Dining', 'Shops'],
    tips: 'Terminal 5 (international) is a longer transfer — allow extra time.',
  },
  ATL: {
    iata: 'ATL',
    terminals: ['Domestic', 'International (F)'],
    securityWaitBand: 'Typically 15–35 min',
    walkTimeNote: 'Plane Train links all concourses; gate to gate up to 20 min',
    amenities: ['Lounges', 'MARTA rail link', 'Plane Train', 'Dining'],
    tips: "World's busiest airport — use the Plane Train between concourses.",
  },
  DFW: {
    iata: 'DFW',
    terminals: ['T A', 'T B', 'T C', 'T D', 'T E'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'Skylink train connects terminals airside; gate to gate up to 15 min',
    amenities: ['Lounges', 'DART rail link', 'Skylink train', 'Dining'],
    tips: 'Skylink runs airside — no need to re-clear security between terminals.',
  },
  DEN: {
    iata: 'DEN',
    terminals: ['Concourse A', 'Concourse B', 'Concourse C'],
    securityWaitBand: 'Typically 15–35 min',
    walkTimeNote: 'Underground train to concourses; gate to gate up to 20 min',
    amenities: ['Lounges', 'A-Line rail link', 'Concourse train', 'Dining'],
    tips: 'All concourses are reached by the underground train from the main terminal.',
  },
  SEA: {
    iata: 'SEA',
    terminals: ['Main', 'Concourse A–D', 'North & South Satellites'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'Satellite trains for some gates; gate to gate up to 15 min',
    amenities: ['Lounges', 'Link light rail', 'Dining', 'Shops'],
    tips: 'Light rail connects to downtown Seattle in about 40 minutes.',
  },
  BOS: {
    iata: 'BOS',
    terminals: ['T A', 'T B', 'T C', 'T E'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'Shuttle bus between some terminals; gate to gate up to 15 min',
    amenities: ['Lounges', 'Silver Line link', 'Dining', 'Shops'],
    tips: 'Terminal E handles most international flights.',
  },
  MIA: {
    iata: 'MIA',
    terminals: ['North', 'Central', 'South'],
    securityWaitBand: 'Typically 15–35 min',
    walkTimeNote: 'Long concourses; gate to gate up to 20 min; MIA Mover to rail',
    amenities: ['Lounges', 'MIA Mover', 'Metrorail link', 'Dining'],
    tips: 'A busy international hub — allow extra time for connections.',
  },
  IAD: {
    iata: 'IAD',
    terminals: ['Main', 'Concourse A/B', 'Concourse C/D'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'AeroTrain to concourses; gate to gate up to 15 min',
    amenities: ['Lounges', 'Silver Line Metro link', 'AeroTrain', 'Dining'],
    tips: 'The AeroTrain runs airside to the midfield concourses.',
  },
  LHR: {
    iata: 'LHR',
    terminals: ['T2', 'T3', 'T4', 'T5'],
    securityWaitBand: 'Typically 10–25 min',
    walkTimeNote: 'Gate to gate up to 20 min in T5; inter-terminal transfers by train/bus',
    amenities: ['Lounges', 'Rail link', 'Underground', 'Duty-free', 'Dining'],
    tips: 'Terminals are separate — allow 60+ min if transferring between them.',
  },
  LGW: {
    iata: 'LGW',
    terminals: ['North', 'South'],
    securityWaitBand: 'Typically 10–25 min',
    walkTimeNote: 'Inter-terminal shuttle; gate to gate up to 15 min',
    amenities: ['Lounges', 'Rail link', 'Dining', 'Shops'],
    tips: 'A shuttle train connects the North and South terminals.',
  },
  CDG: {
    iata: 'CDG',
    terminals: ['T1', 'T2 (A–G)', 'T3'],
    securityWaitBand: 'Typically 15–35 min',
    walkTimeNote: 'CDGVAL shuttle between terminals; gate to gate up to 20 min',
    amenities: ['Lounges', 'RER & TGV rail link', 'CDGVAL shuttle', 'Duty-free'],
    tips: 'Terminal 2 is large and split into halls A–G — check your hall carefully.',
  },
  AMS: {
    iata: 'AMS',
    terminals: ['Single terminal (Departures 1–3)'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'One terminal; long piers, gate to gate up to 20 min',
    amenities: ['Lounges', 'Rail link', 'Dining', 'Rijksmuseum outpost'],
    tips: 'Schiphol is one connected terminal — easy transfers between piers.',
  },
  FRA: {
    iata: 'FRA',
    terminals: ['T1', 'T2'],
    securityWaitBand: 'Typically 15–35 min',
    walkTimeNote: 'Sky Line train between terminals; gate to gate up to 20 min',
    amenities: ['Lounges', 'Rail link', 'Sky Line train', 'Duty-free'],
    tips: 'A major connecting hub — leave ample time for passport control.',
  },
  MUC: {
    iata: 'MUC',
    terminals: ['T1', 'T2'],
    securityWaitBand: 'Typically 10–25 min',
    walkTimeNote: 'Gate to gate up to 15 min; T2 satellite by underground train',
    amenities: ['Lounges', 'S-Bahn rail link', 'Dining', 'Brewery'],
    tips: 'Terminal 2 serves Lufthansa and Star Alliance partners.',
  },
  MAD: {
    iata: 'MAD',
    terminals: ['T1', 'T2', 'T3', 'T4', 'T4S'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'Shuttle train to T4S satellite; gate to gate up to 20 min',
    amenities: ['Lounges', 'Metro link', 'Dining', 'Shops'],
    tips: 'T4 and its satellite T4S are used by Iberia and oneworld partners.',
  },
  DXB: {
    iata: 'DXB',
    terminals: ['T1', 'T2', 'T3'],
    securityWaitBand: 'Typically 15–35 min',
    walkTimeNote: 'Long concourses; trains within T3; gate to gate up to 20 min',
    amenities: ['Lounges', 'Metro link', 'Duty-free', 'Dining', 'Sleep pods'],
    tips: 'Terminal 3 is dedicated to Emirates and is vast — allow extra walking time.',
  },
  DOH: {
    iata: 'DOH',
    terminals: ['Single terminal (Concourses A–E)'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'One terminal; people-mover to far concourses',
    amenities: ['Lounges', 'Metro link', 'Duty-free', 'Dining', 'Indoor park'],
    tips: 'Hamad International is a single connected terminal with an indoor tropical garden.',
  },
  SIN: {
    iata: 'SIN',
    terminals: ['T1', 'T2', 'T3', 'T4'],
    securityWaitBand: 'Typically 10–25 min',
    walkTimeNote: 'Skytrain between terminals; gate to gate up to 15 min',
    amenities: ['Lounges', 'MRT rail link', 'Skytrain', 'Jewel', 'Gardens'],
    tips: 'Jewel and the terminals are connected — leave time to explore between flights.',
  },
  HKG: {
    iata: 'HKG',
    terminals: ['T1', 'Midfield Concourse'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'Automated People Mover to midfield; gate to gate up to 20 min',
    amenities: ['Lounges', 'Airport Express rail', 'People Mover', 'Dining'],
    tips: 'Airport Express reaches Hong Kong Central in about 24 minutes.',
  },
  NRT: {
    iata: 'NRT',
    terminals: ['T1', 'T2', 'T3'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'Shuttle bus between terminals; T3 is a walk from T2',
    amenities: ['Lounges', 'Rail link', 'Dining', 'Shops'],
    tips: 'Terminal 3 (low-cost carriers) is reached on foot or by bus from Terminal 2.',
  },
  HND: {
    iata: 'HND',
    terminals: ['T1', 'T2', 'T3 (International)'],
    securityWaitBand: 'Typically 10–25 min',
    walkTimeNote: 'Free shuttle & train between terminals; gate to gate up to 15 min',
    amenities: ['Lounges', 'Monorail & rail link', 'Dining', 'Observation decks'],
    tips: 'Closer to central Tokyo than Narita — the monorail is quick to town.',
  },
  SYD: {
    iata: 'SYD',
    terminals: ['T1 (International)', 'T2', 'T3 (Domestic)'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'Train or bus between international and domestic; gate to gate up to 15 min',
    amenities: ['Lounges', 'Train link', 'Dining', 'Shops'],
    tips: 'International (T1) and domestic (T2/T3) are separate — allow time to transfer.',
  },
  YYZ: {
    iata: 'YYZ',
    terminals: ['T1', 'T3'],
    securityWaitBand: 'Typically 15–30 min',
    walkTimeNote: 'LINK train between terminals; gate to gate up to 20 min',
    amenities: ['Lounges', 'UP Express rail link', 'LINK train', 'Dining'],
    tips: 'UP Express connects to downtown Toronto in about 25 minutes.',
  },
};

export function getAirportInfo(iata: string): AirportInfo | null {
  return AIRPORT_INFO[iata.toUpperCase()] ?? null;
}
