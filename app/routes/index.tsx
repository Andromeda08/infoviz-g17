import type { Route } from "./+types/index";
import { useEffect, useRef } from "react";
import * as d3 from 'd3';
import { loadEmissions, byIso3, latestYear, sourceSharesForYear } from "~/lib/emissions";
import { loadWorldBank } from "~/lib/worldBank";
import { useVisualizationSize } from "~/lib/useVisualizationSize";
import {type Line, lineChart, type Point2D} from "~/lib/vis/lineChart";

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
  useEffect(() => {
    loadWorldBank().then((wb) => {
      console.log("WB series:", wb.length);
      const ex = wb.find((d) => d.country === "Germany") ?? wb[0];
      console.log("WB example:", ex?.country);
      console.log("WB points sample:", ex?.points.slice(0, 5));
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

    const drawExampleLineChart = () => {
      const points1: Point2D[] = [];
      for (let i = -10; i < 11; i++) {
        points1.push({ x: i, y: 1/8 * i * i });
      }

    const data: Point2D[] = [];
    for (let i = 0; i < 15; i++) {
      data.push({ x: i, y: 1/8 * i * i });
    }
    lineChart(root, { start: 0, end: 10 }, { start: 0, end: 15 }, 32, size, data);
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
      lineChart(root, { start: -10, end: 10 }, { start: -15, end: 15 }, 32, size, [
        indigoLine, tealLine, amberLine,
      ], true);
    };

    drawExampleLineChart();
  }, [size]);

  return (
    <div className="p-16 h-screen flex flex-col gap-2">
      <p className="min-w-56 p-4 bg-zinc-900 rounded-xl border border-zinc-800">d3 test, size: [{size.width}, {size.height}]</p>
      <div
        ref={visRef}
        className="relative w-full min-h-0 flex-1 border border-zinc-900"
      />
    </div>
  )
}
