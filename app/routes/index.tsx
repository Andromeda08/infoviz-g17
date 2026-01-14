import type { Route } from "./+types/index";
import {useEffect, useRef} from "react";
import {useVisualizationSize} from "~/lib/useVisualizationSize";
import * as d3 from 'd3';

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

  // d3 test
  useEffect(() => {
    d3.select(visRef.current).selectAll("*").remove();

    const root = d3
      .select(visRef.current)
      .append('svg')
      .attr('width', size.width)
      .attr('height', size.height);

    const a = 32;
    const gap = 8;
    [ "var(--color-emerald-400)", "var(--color-teal-400)", "var(--color-cyan-400)", "var(--color-sky-400)", "var(--color-blue-400)", "var(--color-indigo-400)", "var(--color-violet-400)"]
      .forEach((color, i) => {
        root
          .append("rect")
          .attr("x", 16 + i * (a + gap))
          .attr("y", 16)
          .attr("height", a)
          .attr("width", a)
          .attr("fill", color);
      })
  }, [size]);

  return (
    <div className="p-16 min-h-screen flex flex-col gap-2">
      <p className="min-w-56 p-4 bg-zinc-900 rounded-xl border border-zinc-800">d3 test, size: [{size.width}, {size.height}]</p>
      <div
        ref={visRef}
        className="relative w-full min-h-0 flex-1 border border-zinc-900"
      />
    </div>
  )
}
