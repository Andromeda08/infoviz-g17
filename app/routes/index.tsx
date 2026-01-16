import type { Route } from "./+types/index";
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { renderToString } from "react-dom/server";

import { loadEmissions, sourceSharesForYear, type CountrySeries } from "~/lib/emissions";
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

  // bar chart
  useEffect(() => {
    if (!barChartRef.current) return;
    if (emLoading) return;
    if (!barChartSize.width || !barChartSize.height) return;
    if (selectedYear === null) return;

    // clear
    d3.select(barChartRef.current).selectAll("*").remove();

    const svg = d3
      .select(barChartRef.current)
      .append("svg")
      .attr("width", barChartSize.width)
      .attr("height", barChartSize.height);

    // layout
    const margin = { top: 28, right: 16, bottom: 28, left: 16 };
    const W = barChartSize.width - margin.left - margin.right;
    const H = barChartSize.height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // title (minimal)
    g.append("text")
      .attr("x", 0)
      .attr("y", -10)
      .attr("fill", "var(--color-zinc-200)")
      .attr("font-size", 12)
      .text(`Emission sources share (${selectedYear})`);

    // helper: get shares for a country+year
    const getShares = (iso3: string) => {
      const c = emissionsData.find((d) => d.iso3 === iso3);
      if (!c) return [];
      // returns [{source, value, share}]
      const shares = sourceSharesForYear(c.points, selectedYear);
      // normalize defensively (in case rounding / missing)
      const sum = shares.reduce((s, d) => s + d.share, 0);
      if (sum <= 0) return [];
      return shares.map((d) => ({ ...d, share: d.share / sum }));
    };

    const sharesA = getShares(countryA);
    const sharesB = getShares(countryB);

    // if no data, show message
    if (sharesA.length === 0 && sharesB.length === 0) {
      g.append("text")
        .attr("x", 0)
        .attr("y", 16)
        .attr("fill", "var(--color-zinc-400)")
        .attr("font-size", 12)
        .text("No data for selected year.");
      return;
    }

    // color mapping (minimal + consistent)
    const colorBySource: Record<string, string> = {
      Coal: "var(--color-zinc-400)",
      Oil: "var(--color-amber-400)",
      Gas: "var(--color-sky-400)",
      Cement: "var(--color-stone-300)",
      Flaring: "var(--color-rose-400)",
      Other: "var(--color-violet-400)",
    };

    // x positions for 2 bars
    const x = d3
      .scaleBand<string>()
      .domain(["A", "B"])
      .range([0, W])
      .padding(0.4);

    const barW = x.bandwidth();

    // y scale is 0..1 (100% stacked)
    const y = d3.scaleLinear().domain([0, 1]).range([H, 0]);

    // draw one stacked bar
    const drawStack = (key: "A" | "B", shares: { source: string; share: number }[]) => {
      const x0 = x(key);
      if (x0 === undefined) return;

      let acc = 0; // bottom accumulator in [0..1]

      for (const s of shares) {
        const y0 = y(acc);
        const y1 = y(acc + s.share);

        g.append("rect")
          .attr("x", x0)
          .attr("y", y1)
          .attr("width", barW)
          .attr("height", Math.max(0, y0 - y1))
          .attr("fill", colorBySource[s.source] ?? "var(--color-zinc-500)");

        acc += s.share;
      }

      // label under bar
      g.append("text")
        .attr("x", x0 + barW / 2)
        .attr("y", H + 18)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--color-zinc-300)")
        .attr("font-size", 11)
        .text(key === "A" ? countryA : countryB);
    };

    drawStack("A", sharesA);
    drawStack("B", sharesB);

    // minimal outline for bars
    g.selectAll("rect")
      .attr("stroke", "var(--color-zinc-900)")
      .attr("stroke-width", 1);
  }, [barChartSize, emLoading, emissionsData, countryA, countryB, selectedYear]);

  return (
    <div className="h-screen w-screen p-8 flex flex-col gap-4 relative">
      <div className="flex items-center gap-4 ">
        <p className="w-full p-4 bg-zinc-900 rounded-xl border border-zinc-800">
          CO₂ Consumption Comparison (MtCO₂ Per Capita)
        </p>
        <a
          href="/map"
          className="min-w-fit h-full flex items-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm text-zinc-300 transition-colors"
        >
          ← Back to World Map
        </a>
      </div>

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

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-xs text-zinc-400 mb-2">
              Emission sources
            </p>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {[
                ["Coal", "#9ca3af"],
                ["Cement", "#e5e7eb"],
                ["Oil", "#facc15"],
                ["Flaring", "#fb7185"],
                ["Gas", "#38bdf8"],
                ["Other", "#a78bfa"],
              ].map(([label, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ background: color }}
                  />
                  <span className="text-zinc-300">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}