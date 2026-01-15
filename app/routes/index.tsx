import type { Route } from "./+types/index";
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { renderToString } from "react-dom/server";

import { loadEmissions, type CountrySeries } from "~/lib/emissions";
import { loadWorldBank, type WbSeries } from "~/lib/worldBank";
import { useVisualizationSize } from "~/lib/useVisualizationSize";
import { type Line, type Range, lineChart, type Point2D } from "~/lib/vis/lineChart";
import { maxElement, minElement } from "~/lib/math";

// Vite "work-around" for react fast refresh to re-render d3 useEffect on source changes.
if (import.meta.hot) {
  import.meta.hot.invalidate();
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "InfoViz - Group 17" }];
}

type CountryData = {
  points: Point2D[];
  range: Range;
  domain: Range;
};

type TooltipData = {
  iso3: string;
  name: string;
  year: number;
  co2: number;
};

export default function Index() {
  const visRef = useRef<HTMLDivElement>(null);
  const { size } = useVisualizationSize(visRef);

  // load emission data in state
  const [emLoading, setEmLoading] = useState(true);
  const [emissionsData, setEmissionsData] = useState<CountrySeries[]>([]);
  useEffect(() => {
    loadEmissions().then((em) => {
      setEmissionsData(em);
      setEmLoading(false);
    });
  }, []);

  // load worldBank data in state
  const [wbLoading, setWbLoading] = useState(true);
  const [worldBankData, setWorldBankData] = useState<WbSeries[]>([]);
  useEffect(() => {
    loadWorldBank().then((wb) => {
      setWorldBankData(wb);
      setWbLoading(false);
    });
  }, []);

  // two dropdown states
  const [countryA, setCountryA] = useState<string>("DEU");
  const [countryB, setCountryB] = useState<string>("FRA");

  // dropdown options
  const emissionOptions = useMemo(() => {
    return emissionsData.map((c) => ({ label: c.country, value: c.iso3 }));
  }, [emissionsData]);

  // finder for worldBank data
  function findWbPoint(emCountryName: string, year: number) {
    const wbSeries = worldBankData.find((w) => w.country === emCountryName);
    if (!wbSeries) return null;
    return wbSeries.points.find((p) => p.year === year) ?? null;
  }

  // emissiondata
  const processEmissionsCountry = (iso3: string): CountryData => {
    const country = emissionsData.find((d) => d.iso3 === iso3);
    if (!country) {
      return { points: [], range: { start: 0, end: 0 }, domain: { start: 0, end: 0 } };
    }

    // capped at year 1050
    const MIN_YEAR = 1950;

    const pointsRaw = country.points.filter(
      (p) => p.year >= MIN_YEAR && Number.isFinite(p.total)
    );

    const points: Point2D[] = pointsRaw.map((d) => ({
      x: d.year,
      y: d.total, 
      customData: {
        iso3,
        name: country.country,
        year: d.year,
        co2: d.total,
      } satisfies TooltipData,
    }));

    return {
      points,
      range: {
        start: minElement(pointsRaw, (p) => p.year).year,
        end: maxElement(pointsRaw, (p) => p.year).year,
      },
      domain: {
        start: 0,
        end: maxElement(pointsRaw, (p) => p.total).total,
      },
    };
  };

  // draw chart
  const drawEmissionsComparisonChart = (root: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    const countryAData = processEmissionsCountry(countryA);
    const countryBData = processEmissionsCountry(countryB);

    if (countryAData.points.length === 0 && countryBData.points.length === 0) return;

    const lineA: Line = {
      data: countryAData.points,
      style: {
        color: "var(--color-rose-500)",
        size: 3,
      },
      marker: {
        shape: "square",
        color: "var(--color-rose-400)",
        size: 8,
      },
    };

    const lineB: Line = {
      data: countryBData.points,
      style: {
        color: "var(--color-indigo-500)",
        size: 3,
      },
      marker: {
        shape: "circle",
        color: "var(--color-indigo-400)",
        size: 6,
      },
    };

    // global ranges/domains (so both lines share axes)
    const xr: Range = {
      start: Math.min(countryAData.range.start || Infinity, countryBData.range.start || Infinity),
      end: Math.max(countryAData.range.end || 0, countryBData.range.end || 0),
    };

    const yr: Range = {
      start: 0,
      end: Math.max(countryAData.domain.end || 0, countryBData.domain.end || 0),
    };

    lineChart({
      selection: root,
      data: [lineA, lineB],
      size: size,
      normalize: false,
      margin: 64,
      axes: true,
      xr,
      yr,

      ticksX: 8,              
      ticksY: 6,              
      formatX: d3.format("d"),
      formatY: d3.format("~s"),

      // tooltip with emission data and worldBank data
      tooltipRef: visRef,
      renderTooltip: (p: Point2D): string => {
        const cd = p.customData as TooltipData | undefined;
        if (!cd) return "";

        const wb = findWbPoint(cd.name, cd.year);

        const fmtInt = (n: number) => Math.round(n).toLocaleString();
        const fmtMaybe = (n: number | null) => (n === null ? "n/a" : fmtInt(n));
        const fmtMaybeFloat = (n: number | null) =>
          n === null ? "n/a" : Number.isFinite(n) ? n.toFixed(1) : "n/a";

        return renderToString(
          <div className="z-10 w-56 h-fit text-xs flex flex-col">
            <p className="font-bold">{cd.name}</p>
            <p>
              <span className="text-zinc-400">Year:</span> {cd.year}
            </p>
            <p>
              <span className="text-zinc-400">CO₂ (Mt):</span> {fmtInt(cd.co2)}
            </p>

            {wb && (
              <div className="mt-2 pt-2 border-t border-zinc-800 flex flex-col gap-1">
                <p>
                  <span className="text-zinc-400">Population:</span> {fmtMaybe(wb.population)}
                </p>
                <p>
                  <span className="text-zinc-400">GDP (US$):</span> {fmtMaybe(wb.gdp)}
                </p>
                <p>
                  <span className="text-zinc-400">Renewables %:</span>{" "}
                  {fmtMaybeFloat(wb.renewableShare)}
                </p>
                <p>
                  <span className="text-zinc-400">Electricity access %:</span>{" "}
                  {fmtMaybeFloat(wb.electricityAccess)}
                </p>
              </div>
            )}

            {!wb && (
              <div className="mt-2 pt-2 border-t border-zinc-800 text-zinc-500">
                No WB match for this country name.
              </div>
            )}
          </div>
        );
      },
    });
  };

  // draw if data is loaded
  useEffect(() => {
    if (!visRef.current) return;
    if (!size.width || !size.height) return;
    if (emLoading || wbLoading) return;

    // clear + build svg
    d3.select(visRef.current).selectAll("*").remove();

    const root = d3
      .select(visRef.current)
      .append("svg")
      .attr("width", size.width)
      .attr("height", size.height);

    drawEmissionsComparisonChart(root);
  }, [size, emLoading, wbLoading, emissionsData, worldBankData, countryA, countryB]);

  return (
    <div className="p-16 h-screen flex flex-col gap-2 relative">
      <p className="min-w-56 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
        CO₂ line chart (Total MtCO₂) — size: [{size.width}, {size.height}]
      </p>

      <div
        ref={visRef}
        className="z-0 relative w-full min-h-0 flex-1 border border-zinc-900"
      />

      {/* dropdown overlay */}
      <div className="absolute top-20 right-16 z-20 flex flex-col gap-3 bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 w-64">
        <div className="text-xs text-zinc-400">
          Select up to 2 countries (ISO3-based)
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Country A</label>
          <select
            className="bg-zinc-950 border border-zinc-700 rounded-md p-2 text-sm"
            value={countryA}
            onChange={(e) => setCountryA(e.target.value)}
            disabled={emLoading}
          >
            {emissionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Country B</label>
          <select
            className="bg-zinc-950 border border-zinc-700 rounded-md p-2 text-sm"
            value={countryB}
            onChange={(e) => setCountryB(e.target.value)}
            disabled={emLoading}
          >
            {emissionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-zinc-500">
          {emLoading || wbLoading
            ? "Loading datasets…"
            : `Emissions: ${emissionsData.length} | WB: ${worldBankData.length}`}
        </div>
      </div>
    </div>
  );
}