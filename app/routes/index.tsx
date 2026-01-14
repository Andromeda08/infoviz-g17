import type { Route } from "./+types/index";
import { useEffect, useRef } from "react";
import * as d3 from 'd3';
import { loadEmissions, byIso3, latestYear, sourceSharesForYear } from "~/lib/emissions";
import { loadWorldBank } from "~/lib/worldBank";
import { useVisualizationSize } from "~/lib/useVisualizationSize";
import { lineChart } from "~/lib/vis/lineChart";

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

    // const a = 32;
    // const gap = 8;
    // [ "var(--color-emerald-400)", "var(--color-teal-400)", "var(--color-cyan-400)", "var(--color-sky-400)", "var(--color-blue-400)", "var(--color-indigo-400)", "var(--color-violet-400)"]
    //   .forEach((color, i) => {
    //     root
    //       .append("rect")
    //       .attr("x", 16 + i * (a + gap))
    //       .attr("y", 16)
    //       .attr("height", a)
    //       .attr("width", a)
    //       .attr("fill", color);
    //   });

    lineChart(root, { start: 0, end: 10 }, { start: 0, end: 15 }, 32, size);
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
