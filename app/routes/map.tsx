import type { Route } from "./+types/map";
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { renderToString } from "react-dom/server";
import type { Topology } from "topojson-specification";

import { loadEmissions, type CountrySeries, type YearPoint } from "~/lib/emissions";
import { useVisualizationSize } from "~/lib/useVisualizationSize";
import {
  choroplethMap,
  loadWorldTopology,
  renderColorLegend,
  isExcludedEntity,
  type CountryEmission,
  type EmissionType,
} from "~/lib/vis/choroplethMap";

if (import.meta.hot) {
  import.meta.hot.invalidate();
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Emissions Map - InfoViz G17" }];
}

const EMISSION_TYPES: { value: EmissionType; label: string }[] = [
  { value: "perCapita", label: "Per Capita (t/person)" },
  { value: "total", label: "Total (Mt)" },
  { value: "coal", label: "Coal (Mt)" },
  { value: "oil", label: "Oil (Mt)" },
  { value: "gas", label: "Gas (Mt)" },
];

function getEmissionValue(point: YearPoint, type: EmissionType): number {
  switch (type) {
    case "perCapita":
      return point.perCapita;
    case "coal":
      return point.coal;
    case "oil":
      return point.oil;
    case "gas":
      return point.gas;
    case "total":
    default:
      return point.total;
  }
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const { size } = useVisualizationSize(mapRef);

  // Data state
  const [emLoading, setEmLoading] = useState(true);
  const [emissionsData, setEmissionsData] = useState<CountrySeries[]>([]);
  const [topology, setTopology] = useState<Topology | null>(null);

  // Controls
  const [selectedYear, setSelectedYear] = useState(2021);
  const [emissionType, setEmissionType] = useState<EmissionType>("perCapita");

  // Load data
  useEffect(() => {
    Promise.all([loadEmissions(), loadWorldTopology()]).then(([em, topo]) => {
      setEmissionsData(em);
      setTopology(topo);
      setEmLoading(false);
    });
  }, []);

  // Year range from data
  const yearRange = useMemo(() => {
    if (emissionsData.length === 0) return { min: 1950, max: 2021 };
    const allYears = emissionsData.flatMap((c) => c.points.map((p) => p.year));
    return {
      min: Math.max(1950, d3.min(allYears) ?? 1950),
      max: d3.max(allYears) ?? 2021,
    };
  }, [emissionsData]);

  // Build emission data map for selected year
  const emissionDataMap = useMemo(() => {
    const map = new Map<string, CountryEmission>();
    for (const country of emissionsData) {
      // Skip non-country entities
      if (isExcludedEntity(country.country)) continue;
      
      const point = country.points.find((p) => p.year === selectedYear);
      if (point) {
        map.set(country.iso3, {
          iso3: country.iso3,
          country: country.country,
          value: getEmissionValue(point, emissionType),
        });
      }
    }
    return map;
  }, [emissionsData, selectedYear, emissionType]);

  // Compute current year's stats for display
  const currentYearStats = useMemo(() => {
    const values = Array.from(emissionDataMap.values())
      .map((d) => d.value)
      .filter((v) => v > 0);
    
    if (values.length === 0) return { min: 0, max: 0, topCountry: "" };
    
    const maxVal = Math.max(...values);
    
    // Find the country with the max value
    let topCountry = "";
    for (const [, emission] of emissionDataMap) {
      if (emission.value === maxVal) {
        topCountry = emission.country;
        break;
      }
    }
    
    return {
      min: Math.min(...values),
      max: maxVal,
      topCountry,
    };
  }, [emissionDataMap]);

  // Draw map
  useEffect(() => {
    if (!mapRef.current || !size.width || !size.height) return;
    if (emLoading || !topology) return;

    d3.select(mapRef.current).selectAll("*").remove();

    const root = d3
      .select(mapRef.current)
      .append("svg")
      .attr("width", size.width)
      .attr("height", size.height);

    const mapHeight = size.height - 60;

    const mapGroup = root.append("g");

    const { colorScale, maxValue, minValue } = choroplethMap({
      selection: mapGroup,
      topology,
      data: emissionDataMap,
      size: { width: size.width, height: mapHeight },
      colorRange: ["#fef2f2", "#7f1d1d"],
      tooltipRef: mapRef,
      renderTooltip: (emission, isoCode) => {
        if (!emission) {
          return renderToString(
            <div className="text-xs">
              <p className="text-zinc-400">No data available</p>
              <p className="text-zinc-500 text-[10px]">Code: {isoCode}</p>
            </div>
          );
        }

        const fmtNum = (n: number) =>
          n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(1);

        return renderToString(
          <div className="w-48 text-xs flex flex-col gap-1">
            <p className="font-bold">{emission.country}</p>
            <p>
              <span className="text-zinc-400">Year:</span> {selectedYear}
            </p>
            <p>
              <span className="text-zinc-400">
                {emissionType.charAt(0).toUpperCase() + emissionType.slice(1)} CO₂:
              </span>{" "}
              {emissionType === "perCapita"
                ? `${emission.value.toFixed(2)} t/person`
                : `${fmtNum(emission.value)} Mt`}
            </p>
          </div>
        );
      },
    });

    // Legend
    const legendGroup = root
      .append("g")
      .attr("transform", `translate(0, ${mapHeight + 10})`);
    
    const legendUnit = emissionType === "perCapita" ? "t/cap" : "Mt";
    renderColorLegend(legendGroup, colorScale, maxValue, size.width, 16, minValue, legendUnit);
  }, [size, emLoading, topology, emissionDataMap, selectedYear, emissionType]);

  // Format number for stats display
  const fmtStat = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    if (n >= 1) return n.toFixed(1);
    return n.toFixed(2);
  };

  return (
    <div className="h-screen w-screen p-8 flex flex-col gap-4 relative">
      <div className="flex items-center gap-4">
        <p className="w-full p-4 bg-zinc-900 rounded-xl border border-zinc-800">
          Global CO₂ Emissions Map ({selectedYear})
        </p>
        <a
          href="/"
          className="min-w-fit h-full flex items-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm text-zinc-300 transition-colors"
        >
          ← Back to Charts
        </a>
      </div>

      <div className="flex-1 grid grid-cols-[1fr_240px] gap-4 min-h-0">
        {/* Map container */}
        <div
          ref={mapRef}
          className="relative w-full h-full rounded-xl border border-zinc-900 hover:border-zinc-800 transition-all overflow-hidden"
        />

        {/* Controls */}
        <div className="flex flex-col gap-4">
          {/* Emission type selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <label className="text-xs text-zinc-400">Emission Type</label>
            <div className="flex flex-col gap-2">
              {EMISSION_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setEmissionType(type.value)}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    emissionType === type.value
                      ? "bg-rose-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Year slider */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <label className="text-xs text-zinc-400">
              Year: <span className="text-zinc-200 font-medium">{selectedYear}</span>
            </label>
            <input
              type="range"
              min={yearRange.min}
              max={yearRange.max}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{yearRange.min}</span>
              <span>{yearRange.max}</span>
            </div>
          </div>

          {/* Year Statistics */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
            <label className="text-xs text-zinc-400">
              {selectedYear} Statistics ({emissionType})
            </label>
            <div className="text-xs text-zinc-300 flex flex-col gap-1">
              <p>
                <span className="text-zinc-500">Min:</span> {fmtStat(currentYearStats.min)} Mt
              </p>
              <p>
                <span className="text-zinc-500">Max:</span> {fmtStat(currentYearStats.max)} Mt
              </p>
              {currentYearStats.topCountry && (
                <p>
                  <span className="text-zinc-500">Top:</span> {currentYearStats.topCountry}
                </p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500">
              {emLoading
                ? "Loading data…"
                : `${emissionDataMap.size} countries with data`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}