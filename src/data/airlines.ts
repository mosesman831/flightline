export interface AirlineInfo {
  iata: string;
  icao: string;
  name: string;
  country: string;
  color: string;
}

export const AIRLINES: Record<string, AirlineInfo> = {
  AA: { iata: 'AA', icao: 'AAL', name: 'American Airlines', country: 'US', color: '#0078D2' },
  DL: { iata: 'DL', icao: 'DAL', name: 'Delta Air Lines', country: 'US', color: '#003366' },
  UA: { iata: 'UA', icao: 'UAL', name: 'United Airlines', country: 'US', color: '#002244' },
  BA: { iata: 'BA', icao: 'BAW', name: 'British Airways', country: 'GB', color: '#2E5C99' },
  LH: { iata: 'LH', icao: 'DLH', name: 'Lufthansa', country: 'DE', color: '#002855' },
  AF: { iata: 'AF', icao: 'AFR', name: 'Air France', country: 'FR', color: '#002157' },
  EK: { iata: 'EK', icao: 'UAE', name: 'Emirates', country: 'AE', color: '#D7191A' },
  QR: { iata: 'QR', icao: 'QTR', name: 'Qatar Airways', country: 'QA', color: '#8A1538' },
  SQ: { iata: 'SQ', icao: 'SIA', name: 'Singapore Airlines', country: 'SG', color: '#F0AB00' },
  CX: { iata: 'CX', icao: 'CPA', name: 'Cathay Pacific', country: 'HK', color: '#006747' },
  JL: { iata: 'JL', icao: 'JAL', name: 'Japan Airlines', country: 'JP', color: '#C00000' },
  NH: { iata: 'NH', icao: 'ANA', name: 'ANA', country: 'JP', color: '#13276A' },
  KE: { iata: 'KE', icao: 'KAL', name: 'Korean Air', country: 'KR', color: '#00256C' },
  TK: { iata: 'TK', icao: 'THY', name: 'Turkish Airlines', country: 'TR', color: '#E30A17' },
  VS: { iata: 'VS', icao: 'VIR', name: 'Virgin Atlantic', country: 'GB', color: '#CC0000' },
  WN: { iata: 'WN', icao: 'SWA', name: 'Southwest Airlines', country: 'US', color: '#304CB2' },
  JB: { iata: 'B6', icao: 'JBU', name: 'JetBlue', country: 'US', color: '#003366' },
  AS: { iata: 'AS', icao: 'ASA', name: 'Alaska Airlines', country: 'US', color: '#00467F' },
  NK: { iata: 'NK', icao: 'NKS', name: 'Spirit Airlines', country: 'US', color: '#FFCC00' },
  F9: { iata: 'F9', icao: 'FFT', name: 'Frontier Airlines', country: 'US', color: '#006837' },
  FR: { iata: 'FR', icao: 'RYR', name: 'Ryanair', country: 'IE', color: '#003A70' },
  U2: { iata: 'U2', icao: 'EZY', name: 'easyJet', country: 'GB', color: '#FF6600' },
  DY: { iata: 'DY', icao: 'NAX', name: 'Norwegian', country: 'NO', color: '#005A93' },
  EI: { iata: 'EI', icao: 'EIN', name: 'Aer Lingus', country: 'IE', color: '#006F44' },
  IB: { iata: 'IB', icao: 'IBE', name: 'Iberia', country: 'ES', color: '#C4122E' },
  KL: { iata: 'KL', icao: 'KLM', name: 'KLM', country: 'NL', color: '#00A1DE' },
  AY: { iata: 'AY', icao: 'FIN', name: 'Finnair', country: 'FI', color: '#003580' },
  SK: { iata: 'SK', icao: 'SAS', name: 'SAS', country: 'SE', color: '#002855' },
  TP: { iata: 'TP', icao: 'TAP', name: 'TAP Air Portugal', country: 'PT', color: '#003366' },
  AC: { iata: 'AC', icao: 'ACA', name: 'Air Canada', country: 'CA', color: '#DA291C' },
  WS: { iata: 'WS', icao: 'WJA', name: 'WestJet', country: 'CA', color: '#00529B' },
  QF: { iata: 'QF', icao: 'QFA', name: 'Qantas', country: 'AU', color: '#E0001B' },
  NZ: { iata: 'NZ', icao: 'ANZ', name: 'Air New Zealand', country: 'NZ', color: '#000000' },
  PR: { iata: 'PR', icao: 'PAL', name: 'Philippine Airlines', country: 'PH', color: '#004B87' },
  GA: { iata: 'GA', icao: 'GIA', name: 'Garuda Indonesia', country: 'ID', color: '#003B5C' },
  VN: { iata: 'VN', icao: 'HVN', name: 'Vietnam Airlines', country: 'VN', color: '#005A8C' },
  TG: { iata: 'TG', icao: 'THA', name: 'Thai Airways', country: 'TH', color: '#8E1925' },
  MH: { iata: 'MH', icao: 'MAS', name: 'Malaysia Airlines', country: 'MY', color: '#003B7B' },
  CA: { iata: 'CA', icao: 'CCA', name: 'Air China', country: 'CN', color: '#BE1E2D' },
  MU: { iata: 'MU', icao: 'CES', name: 'China Eastern', country: 'CN', color: '#004B87' },
  CZ: { iata: 'CZ', icao: 'CSN', name: 'China Southern', country: 'CN', color: '#0088CE' },
  HU: { iata: 'HU', icao: 'CHH', name: 'Hainan Airlines', country: 'CN', color: '#E31B23' },
  OZ: { iata: 'OZ', icao: 'AAR', name: 'Asiana Airlines', country: 'KR', color: '#004724' },
  SU: { iata: 'SU', icao: 'AFL', name: 'Aeroflot', country: 'RU', color: '#C4132B' },
  LO: { iata: 'LO', icao: 'LOT', name: 'LOT Polish Airlines', country: 'PL', color: '#8B1C1C' },
  OS: { iata: 'OS', icao: 'AUA', name: 'Austrian Airlines', country: 'AT', color: '#E30613' },
  LX: { iata: 'LX', icao: 'SWR', name: 'SWISS', country: 'CH', color: '#C8102E' },
  SN: { iata: 'SN', icao: 'BEL', name: 'Brussels Airlines', country: 'BE', color: '#002255' },
  BT: { iata: 'BT', icao: 'BTI', name: 'airBaltic', country: 'LV', color: '#00A2E0' },
  FI: { iata: 'FI', icao: 'ICE', name: 'Icelandair', country: 'IS', color: '#003F87' },
};

const byName: [string, string][] = [];
for (const [code, info] of Object.entries(AIRLINES)) {
  byName.push([info.name, code]);
}
byName.sort(([a], [b]) => a.localeCompare(b));

export const AIRLINE_NAMES: [string, string][] = byName;

export function getAirline(code: string): AirlineInfo {
  return AIRLINES[code] ?? { iata: code, icao: '', name: code, country: '', color: '#666' };
}
