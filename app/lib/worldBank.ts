import * as d3 from "d3";

export type WbPoint = {
  year: number;

  // core causal variables
  population: number | null;
  gdp: number | null;

  // optional
  co2: number | null;
  renewableShare: number | null;
  electricityAccess: number | null;
};

export type WbSeries = {
  country: string;
  points: WbPoint[];
};

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "" || s === "NA" || s === "NaN") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function yearFromDate(value: unknown): number | null {
  
  const s = String(value ?? "").trim();
  if (!s) return null;
  const y = Number(s.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export async function loadWorldBank(): Promise<WbSeries[]> {
  const rows = await d3.csv("/data/world_bank_development_indicators.csv");
  if (rows.length === 0) return [];

  // sanity check
  const cols = rows.columns ?? Object.keys(rows[0] ?? {});
  const hasCountry = cols.includes("country");
  const hasDate = cols.includes("date");
  const hasGDP = cols.includes("GDP_current_US");
  const hasPop = cols.includes("population");

  if (!hasCountry || !hasDate || (!hasGDP && !hasPop)) {
    // unknown format
    return [];
  }

  type Tmp = {
    country: string;
    point: WbPoint;
  };

  const cleaned: Tmp[] = rows
    .map((r) => {
      const country = String(r["country"] ?? "").trim();
      const year = yearFromDate(r["date"]);

      if (!country || !year) return null;

      const point: WbPoint = {
        year,
        population: toNumOrNull(r["population"]),
        gdp: toNumOrNull(r["GDP_current_US"]),

        // optional extras
        co2: toNumOrNull(r["CO2_emisions"]),
        renewableShare: toNumOrNull(r["renewvable_energy_consumption%"]),
        electricityAccess: toNumOrNull(r["access_to_electricity%"]),
      };

      return { country, point };
    })
    .filter((x): x is Tmp => x !== null);

  const grouped = d3.group(cleaned, (d) => d.country);

  const series: WbSeries[] = Array.from(grouped, ([country, arr]) => {
    const points = arr.map((d) => d.point).sort((a, b) => a.year - b.year);
    return { country, points };
  });

  series.sort((a, b) => a.country.localeCompare(b.country));
  return series;
}

// Helpers
export function wbByCountry(data: WbSeries[], country: string) {
  return data.find((d) => d.country === country) ?? null;
}

export function wbLatestYear(points: WbPoint[]) {
  return points.length ? points[points.length - 1].year : null;
}