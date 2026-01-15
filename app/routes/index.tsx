import type { Route } from "./+types/index";
import { useEffect, useRef, useState } from "react";
import * as d3 from 'd3';
import { loadEmissions, byIso3, latestYear, sourceSharesForYear } from "~/lib/emissions";
import { loadWorldBank, type WbSeries } from "~/lib/worldBank";
import { useVisualizationSize } from "~/lib/useVisualizationSize";
import { type Line, type Range, lineChart, type Point2D } from "~/lib/vis/lineChart";
import { maxElement, minElement } from "~/lib/math";
import { renderToString } from "react-dom/server";

type CountryData = {
  points: Point2D[];
  range: Range,
  domain: Range,
};

type CountryCustomData = {
  name: string;
  year: number;
  population: number;
}

// Vite "work-around" for react fast refresh to re-render d3 useEffect on source changes.
if (import.meta.hot) {
  import.meta.hot.invalidate();
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "InfoViz - Group 17" },
  ];
}

export default function Index() {
  const visRef = useRef<HTMLDivElement>(null);
  const { size } = useVisualizationSize(visRef);

  // console test emissionloader
  useEffect(() => {
    loadEmissions().then((data) => {
      console.log("Countries loaded:", data.length);

      const example = byIso3(data, "DEU") ?? data[0];
      console.log("Example country:", example.country, example.iso3);

      const years = example.points.map((p) => p.year);
      console.log("Year range:", Math.min(...years), "-", Math.max(...years));

      const yr = latestYear(example.points);
      console.log("Latest year:", yr);

      if (yr) {
        const shares = sourceSharesForYear(example.points, yr);
        console.log("Shares latest year:", shares);

        const sum = shares.reduce((s, d) => s + d.share, 0);
        console.log("Sum of shares (≈1):", sum);
      }
    });
  }, []);

  // console test worldbankloader
  const [isLoading, setLoading] = useState<boolean>(true);
  const [worldBankData, setWorldBankData] = useState<WbSeries[]>([]);
  useEffect(() => {
    loadWorldBank().then((wb) => {
      setWorldBankData(wb);
      setLoading(false);
    });
}, []);

  // d3 test
  useEffect(() => {

    d3.select(visRef.current).selectAll("*").remove();

    const root = d3
      .select(visRef.current)
      .append('svg')
      .attr('width', size.width)
      .attr('height', size.height);

    const _drawExampleLineChart = () => {
      const points1: Point2D[] = [];
      for (let i = -10; i < 11; i++) {
        points1.push({ x: i, y: 1/8 * i * i });
      }

      const points2: Point2D[] = [];
      for (let i = 0; i < 15; i++) {
        points2.push({ x: i, y: Math.sqrt(i) });
      }

      const points3: Point2D[] = [];
      for (let i = -12; i < 13; i++) {
        points3.push({ x: i, y: 4 * Math.sin(i) });
      }

      const indigoLine: Line = {
        data: points1,
        style: {
          size: 3,
        },
        marker: {
          size: 10,
        }
      };
      const tealLine: Line = {
        data: points2,
        style: {
          color: "var(--color-teal-600)",
          size: 3
        },
        marker: {
          shape: 'circle',
          color: "var(--color-teal-300)",
          size: 5,
        }
      };
      const amberLine: Line = {
        data: points3,
        style: {
          color: "var(--color-amber-600)",
          size: 3
        },
        marker: {
          shape: 'circle',
          color: "var(--color-amber-400)",
          size: 5,
        },
      };
      lineChart({
        selection: root,
        data: [ indigoLine, tealLine, amberLine ],
        size: size,
        xr: { start: -10, end: 10 },
        yr: { start: -10, end: 10 },
        normalize: false,
        margin: 32,
        axes: true,
      });
    };
    // _drawExampleLineChart();

    const drawPopulationComparisonChart = (a: string, b: string) => {
      const processCountry = (name: string): CountryData => {
        const country = worldBankData.find((d) => d.country.includes(name))!
        const points = country.points.filter((p) => p.population !== null);
        return {
          points: points.map((d): Point2D => {
            return {
              x: d.year,
              y: d.population ?? 0,
              customData: {
                name,
                year: d.year,
                population: d.population ?? 0,
              },
            };
          }),
          range: {
            start: minElement(points, (p) => p.year).year,
            end: maxElement(points, (p) => p.year).year,
          },
          domain: {
            start: minElement(points, (p) => p.population ?? 0).population ?? 0,
            end: maxElement(points, (p) => p.population ?? 0).population ?? 0,
          },
        };
      };

      const countryA = processCountry(a);
      const lineA: Line = {
        data: countryA.points,
        style: {
          color: "var(--color-rose-500)",
          size: 3,
        },
        marker: {
          shape: 'square',
          color: "var(--color-rose-400)",
          size: 10,
        },
      };

      const countryB = processCountry(b);
      const lineB: Line = {
        data: countryB.points,
        style: {
          color: "var(--color-indigo-500)",
          size: 3,
        },
        marker: {
          shape: 'circle',
          color: "var(--color-indigo-400)",
          size: 5,
        },
      };

      lineChart({
        selection: root,
        data: [ lineA, lineB ],
        size: size,
        normalize: true,
        margin: 64,
        tooltipRef: visRef,
        renderTooltip: (data: Point2D): string => {
          const customData = data.customData as CountryCustomData;
          if (!customData) {
            return "";
          }
          return renderToString(
            <div className="z-10 w-32 h-fit text-xs flex flex-col transition-opacity">
              <p className="font-bold">{customData.name}</p>
              <p><span className="text-zinc-400">Year:</span> {customData.year}</p>
              <p><span className="text-zinc-400">Population:</span> {customData.population}</p>
            </div>
          );
        }
      });
    };

    if (!isLoading) {
      drawPopulationComparisonChart("Germany", "France");
    }
  }, [size, worldBankData, isLoading]);

  return (
    <div className="p-16 h-screen flex flex-col gap-2">
      <p className="min-w-56 p-4 bg-zinc-900 rounded-xl border border-zinc-800">d3 test, size: [{size.width}, {size.height}]</p>
      <div
        ref={visRef}
        className="z-0 relative w-full min-h-0 flex-1 border border-zinc-900"
      />
    </div>
  )
}
