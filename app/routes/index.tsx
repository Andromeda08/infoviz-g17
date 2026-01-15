import type { Route } from "./+types/index";
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { renderToString } from "react-dom/server";

import { loadEmissions, type CountrySeries } from "~/lib/emissions";
import { loadWorldBank, type WbSeries } from "~/lib/worldBank";
import { useVisualizationSize } from "~/lib/useVisualizationSize";
import { type Line, type Range, lineChart, type Point2D } from "~/lib/vis/lineChart";
import { maxElement, minElement } from "~/lib/math";
import {line} from "d3";

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
  perCapita: number;
  selected?: boolean;
};

export default function Index() {
  const lineChartRef = useRef<HTMLDivElement>(null);
  const { size } = useVisualizationSize(lineChartRef);

  const barChartRef = useRef<HTMLDivElement>(null);
  const { size: barChartSize } = useVisualizationSize(barChartRef);

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

  // shared selected year
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // prepick 2021 if available
  useEffect(() => {
    // only set once
    if (selectedYear !== null) return;

    // wait until emissions are loaded
    if (emLoading) return;
    if (emissionsData.length === 0) return;

    const a = emissionsData.find((d) => d.iso3 === countryA);
    const b = emissionsData.find((d) => d.iso3 === countryB);

    const yearsA = a?.points.map((p) => p.year) ?? [];
    const yearsB = b?.points.map((p) => p.year) ?? [];

    const yearSetA = new Set(yearsA);
    const yearSetB = new Set(yearsB);

    // prefer 2021 if both have it
    const preferred = 2021;
    const bothHave2021 = yearSetA.has(preferred) && yearSetB.has(preferred);

    if (bothHave2021) {
      setSelectedYear(preferred);
      return;
    }

    // otherwise pick latest year that exists in BOTH series
    const commonYears = yearsA.filter((y) => yearSetB.has(y));
    if (commonYears.length > 0) {
      setSelectedYear(Math.max(...commonYears));
      return;
    }

    // last fallback: latest of countryA, otherwise latest of countryB
    if (yearsA.length > 0) {
      setSelectedYear(Math.max(...yearsA));
      return;
    }
    if (yearsB.length > 0) {
      setSelectedYear(Math.max(...yearsB));
      return;
    }
  }, [selectedYear, emLoading, emissionsData, countryA, countryB]);

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

  // console output when a year is selected
  useEffect(() => {
    if (selectedYear === null) return;
    const a = emissionsData.find((d) => d.iso3 === countryA);
    const b = emissionsData.find((d) => d.iso3 === countryB);

    console.log("Clicked year:", selectedYear);
    console.log("Country A:", a?.country ?? countryA, `(${countryA})`);
    console.log("Country B:", b?.country ?? countryB, `(${countryB})`);
  }, [selectedYear, countryA, countryB, emissionsData]);

  // emissiondata
  const processEmissionsCountry = (iso3: string, selectedYear: number | null): CountryData => {
    const country = emissionsData.find((d) => d.iso3 === iso3);
    if (!country) {
      return { points: [], range: { start: 0, end: 0 }, domain: { start: 0, end: 0 } };
    }

    // capped at year 1950
    const MIN_YEAR = 1950;

    // filter for perCapita for barchart
    const pointsRaw = country.points.filter(
      (p) => p.year >= MIN_YEAR && Number.isFinite(p.perCapita)
    );

    // points
    const points: Point2D[] = pointsRaw.map((d) => ({
      x: d.year,
      y: d.perCapita,
      customData: {
        iso3,
        name: country.country,
        year: d.year,
        co2: d.total,
        perCapita: d.perCapita,
        selected: selectedYear !== null && d.year === selectedYear,
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
        end: maxElement(pointsRaw, (p) => p.perCapita).perCapita,
      },
    };
  };

  // draw chart
  const drawEmissionsComparisonChart = (root: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    const countryAData = processEmissionsCountry(countryA, selectedYear);
    const countryBData = processEmissionsCountry(countryB, selectedYear);

    if (countryAData.points.length === 0 && countryBData.points.length === 0) return;

    const lineA: Line = {
      data: countryAData.points,
      name: countryA,
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
      name: countryB,
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

    const lines = [lineA, lineB];
    lineChart({
      selection: root,
      data: lines,
      size: size,
      normalize: false,
      margin: 32,
      axes: true,
      xr,
      yr,
      ticksX: 8,
      ticksY: 6,
      formatX: d3.format("d"),
      formatY: d3.format("~s"),
      // click handler
      onPointClick: (pt: Point2D) => {
        const cd = pt.customData as TooltipData | undefined;
        if (!cd) return;
        setSelectedYear(cd.year);
      },

      // tooltip with emission data and worldBank data
      tooltipRef: lineChartRef,
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
              <span className="text-zinc-400">CO₂ (total, Mt):</span> {fmtInt(cd.co2)}
            </p>
            <p>
              <span className="text-zinc-400">CO₂ (per capita):</span>{" "}
              {Number.isFinite(cd.perCapita) ? cd.perCapita.toFixed(2) : "n/a"}
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

            <div className="mt-2 pt-2 border-t border-zinc-800 text-zinc-500">
              Click a point to select a year.
            </div>
          </div>
        );
      },
    });

    // legend should redraw first
    d3.select(lineChartRef.current).selectAll(".chart-legend").remove();

    // Add Legend
    d3.select(lineChartRef?.current)
      .append("div")
      .attr("class", "chart-legend")
      .style("position", "absolute")
      .style("padding", "12px")
      .style("background", "var(--color-zinc-900)")
      .style("color", "var(--color-zinc-50)")
      .style("border-radius", "8px")
      .style("pointer-events", "none")
      .style("top", "16px")
      .style("right", "16px")
      .html(
        renderToString(
          <div className="min-w-16 flex flex-col gap-2">
            {lines.map((ln) => (
              <div key={ln.name} className="flex items-center gap-2">
                <div
                  className="w-2 h-2"
                  style={{ background: ln.style?.color ?? "var(--color-zinc-50)" }}
                />
                <p className="text-xs text-zinc-300">{ln.name ?? "Unknown"}</p>
              </div>
            ))}
          </div>
        )
      );
  };

  // draw if data is loaded
  useEffect(() => {
    if (!lineChartRef.current) return;
    if (!size.width || !size.height) return;
    if (emLoading || wbLoading) return;

    // clear + build svg
    d3.select(lineChartRef.current).selectAll("*").remove();

    const root = d3
      .select(lineChartRef.current)
      .append("svg")
      .attr("width", size.width)
      .attr("height", size.height);

    drawEmissionsComparisonChart(root);
  }, [size, emLoading, wbLoading, emissionsData, worldBankData, countryA, countryB, selectedYear]);

  // TODO: (Example chart for the other location) Remove this and implement barchart
  useEffect(() => {
    if (!barChartRef.current) {
      return;
    }

    d3.select(barChartRef.current).selectAll("*").remove();

    const root = d3
      .select(barChartRef.current)
      .append("svg")
      .attr("width", barChartSize.width)
      .attr("height", barChartSize.height);

    const points: Point2D[] = [];
    for (let i = -4; i < 5; i++) {
      points.push({ x: i, y: 0.5 * Math.sin(i)});
    }
    lineChart({
      selection: root,
      data: [{
        data: points,
        style: {
          color: "var(--color-amber-600)",
          size: 3,
        },
        marker: {
          shape: 'circle',
          color: "var(--color-amber-400)",
          size: 4,
        },
      }],
      size: barChartSize,
      axes: true,
      xr: { start: -4, end: 4 },
      yr: { start: -2, end: 2 },
      ticksY: 4,
    })
  }, [barChartSize]);

  return (
    <div className="h-screen w-screen p-8 flex flex-col gap-4 relative">
      <p className="w-full p-4 bg-zinc-900 rounded-xl border border-zinc-800">
        CO₂ Consumption Comparison (MtCO₂ Per Capita)
      </p>

      <div className="h-[85%] grid grid-cols-[auto_256px] gap-4">
        <div
          ref={lineChartRef}
          className="z-0 relative w-full min-h-0 rounded-xl border border-zinc-900 hover:border-zinc-800 transition-all"
        />

        <div className="w-64 h-full flex flex-col gap-4">
          <div className="flex flex-col gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3 w-64">
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

            <div className="text-xs text-zinc-400">
              Selected year:{" "}
              <span className="text-zinc-200">{selectedYear ?? "none"}</span>
            </div>
          </div>

          <div
            ref={barChartRef}
            className="w-full z-0 resize min-h-0 flex-1 rounded-xl border border-zinc-900 hover:border-zinc-800 transition-all"
          />
        </div>
      </div>
    </div>
  );
}