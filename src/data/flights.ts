export interface Airport {
  code: string;
  city: string;
  name: string;
  timezone: string;
}

export interface Flight {
  id: string;
  airline: { name: string; code: string };
  number: number;
  aircraft: string;
  departure: {
    airport: Airport;
    scheduled: Date;
    estimated?: Date;
    actual?: Date;
    gate: string;
    terminal: string;
  };
  arrival: {
    airport: Airport;
    scheduled: Date;
    estimated?: Date;
    actual?: Date;
    gate: string;
    terminal: string;
  };
  status: "ontime" | "delayed" | "early" | "cancelled" | "landed";
  delayMinutes: number;
  delayProbability: number; // 0-1
  progressPercent: number;
  altitudeFt?: number;
  speedMph?: number;
  heading?: number;
}

const base = new Date();
base.setHours(7, 15, 0, 0);

export const flights: Flight[] = [
  {
    id: "aa184",
    airline: { name: "American", code: "AA" },
    number: 184,
    aircraft: "Boeing 777-300ER",
    departure: {
      airport: { code: "LAX", city: "Los Angeles", name: "Los Angeles Intl", timezone: "America/Los_Angeles" },
      scheduled: new Date(base),
      estimated: new Date(base.getTime() + 11 * 60000),
      gate: "42B",
      terminal: "4",
    },
    arrival: {
      airport: { code: "JFK", city: "New York", name: "John F. Kennedy Intl", timezone: "America/New_York" },
      scheduled: new Date(base.getTime() + 5.25 * 60 * 60000),
      estimated: new Date(base.getTime() + 5.35 * 60 * 60000),
      gate: "8",
      terminal: "8",
    },
    status: "delayed",
    delayMinutes: 11,
    delayProbability: 0.34,
    progressPercent: 0,
    altitudeFt: 0,
    speedMph: 0,
    heading: 45,
  },
  {
    id: "ua1205",
    airline: { name: "United", code: "UA" },
    number: 1205,
    aircraft: "Airbus A320",
    departure: {
      airport: { code: "SFO", city: "San Francisco", name: "San Francisco Intl", timezone: "America/Los_Angeles" },
      scheduled: new Date(base.getTime() + 28 * 60 * 60000),
      gate: "62",
      terminal: "3",
    },
    arrival: {
      airport: { code: "SEA", city: "Seattle", name: "Seattle-Tacoma Intl", timezone: "America/Los_Angeles" },
      scheduled: new Date(base.getTime() + 30.5 * 60 * 60000),
      gate: "N12",
      terminal: "N",
    },
    status: "ontime",
    delayMinutes: 0,
    delayProbability: 0.08,
    progressPercent: 0,
  },
  {
    id: "dl452",
    airline: { name: "Delta", code: "DL" },
    number: 452,
    aircraft: "Boeing 737-900ER",
    departure: {
      airport: { code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson", timezone: "America/New_York" },
      scheduled: new Date(base.getTime() + 50 * 60 * 60000),
      gate: "T2",
      terminal: "S",
    },
    arrival: {
      airport: { code: "DEN", city: "Denver", name: "Denver Intl", timezone: "America/Denver" },
      scheduled: new Date(base.getTime() + 53.25 * 60 * 60000),
      gate: "A32",
      terminal: "A",
    },
    status: "early",
    delayMinutes: -4,
    delayProbability: 0.12,
    progressPercent: 0,
  },
];
