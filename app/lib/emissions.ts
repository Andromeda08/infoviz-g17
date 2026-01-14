import * as d3 from "d3";

export type YearPoint = {
  year: number;
  total: number;
  coal: number;
  oil: number;
  gas: number;
  cement: number;
  flaring: number;
  other: number;
  perCapita: number;
};

export type CountrySeries = {
  iso3: string;
  country: string;
  points: YearPoint[];
};

export type SourceKey = "Coal" | "Oil" | "Gas" | "Cement" | "Flaring" | "Other";

export type SourceShare = {
  source: SourceKey;
  value: number;
  share: number;
};

function toNum(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// load data
export async function loadEmissions(): Promise<CountrySeries[]> {
  const rows = await d3.csv("/data/GCB2022v27_MtCO2_flat.csv");

  const cleaned = rows
    .map((r) => {
      const iso3 = (r["ISO 3166-1 alpha-3"] ?? "").trim();
      const country = (r.Country ?? "").trim();
      const year = toNum(r.Year);

      if (!iso3 || !country || !year) return null;

      const point: YearPoint = {
        year,
        total: toNum(r.Total),
        coal: toNum(r.Coal),
        oil: toNum(r.Oil),
        gas: toNum(r.Gas),
        cement: toNum(r.Cement),
        flaring: toNum(r.Flaring),
        other: toNum(r.Other),
        perCapita: toNum(r["Per Capita"]),
      };

      return { iso3, country, point };
    })
    .filter(
      (d): d is { iso3: string; country: string; point: YearPoint } => d !== null
    );

  const grouped = d3.group(cleaned, (d) => d.iso3);

  const series: CountrySeries[] = Array.from(grouped, ([iso3, arr]) => {
    const country = arr[0]?.country ?? iso3;
    const points = arr.map((d) => d.point).sort((a, b) => a.year - b.year);
    return { iso3, country, points };
  });

  // for dropdown
  series.sort((a, b) => a.country.localeCompare(b.country));

  return series;
}

export function countryOptions(data: CountrySeries[]) {
  return data.map((d) => ({ label: d.country, value: d.iso3 }));
}

// getter for a country by iso
export function byIso3(data: CountrySeries[], iso3: string) {
  return data.find((d) => d.iso3 === iso3) ?? null;
}

// latest year
export function latestYear(points: YearPoint[]) {
  return points.length ? points[points.length - 1].year : null;
}

// shares of emissions for bar chart
export function sourceSharesForYear(points: YearPoint[], year: number): SourceShare[] {
  const p = points.find((x) => x.year === year);
  if (!p) return [];

  const entries: { source: SourceKey; value: number }[] = [
    { source: "Coal", value: p.coal },
    { source: "Oil", value: p.oil },
    { source: "Gas", value: p.gas },
    { source: "Cement", value: p.cement },
    { source: "Flaring", value: p.flaring },
    { source: "Other", value: p.other },
  ];

  const total = p.total || entries.reduce((s, e) => s + e.value, 0);

  return entries.map((e) => ({
    ...e,
    share: total > 0 ? e.value / total : 0,
  }));
}