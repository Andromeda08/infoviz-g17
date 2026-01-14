import * as d3 from 'd3';
import type { Size2D } from "~/lib/useVisualizationSize";

export type Range = {
  start: number;
  end: number;
};

export type Point2D = {
  x: number;
  y: number;
};

export const lineChart = <T extends d3.BaseType>(
  selection: d3.Selection<T, unknown, null, undefined>,
  x: Range,
  y: Range,
  margin: number,
  size: Size2D,
  dataPoints: Point2D[] = [],
) => {
  const scaleX = d3
    .scaleLinear()
    .domain([x.start, x.end])
    .range([margin, size.width - margin]);
  const axisX = d3
    .axisBottom(scaleX)
    .ticks(x.end - x.start);

  selection
    .append('g')
    .attr("transform", `translate(0, ${size.height - margin})`)
    .call(axisX);

  const scaleY = d3
    .scaleLinear()
    .domain([y.end, y.start])
    .range([margin, size.height - margin]);
  const axisY = d3
    .axisLeft(scaleY)
    .ticks(y.end - y.start);

  selection
    .append('g')
    .attr("transform", `translate(${margin}, 0)`)
    .call(axisY);

  const dataSortedX = dataPoints
    .sort((a, b) => a.x - b.x);

  const a = 8;
  const dx = (size.width - 2 * margin) / (x.end - x.start);
  const dy = (size.height - 2 * margin) / (y.end - y.start);

  // Lines
  for (let i = 1; i < dataSortedX.length; i++) {
    const prev = dataSortedX[i - 1];
    const curr = dataSortedX[i];
    selection
      .append("line")
      .attr("x1",  margin + (prev.x * dx))
      .attr("y1", size.height - margin - (prev.y * dy))
      .attr("x2",  margin + (curr.x * dx))
      .attr("y2", size.height - margin - (curr.y * dy))
      .attr("stroke", "var(--color-indigo-600)")
      .attr("stroke-width", 2);
  }

  // Data point markers
  dataSortedX.forEach((point) => {
    selection
      .append("rect")
      .attr("x", margin + (point.x * dx) - (a / 2))
      .attr("y", size.height - margin - (point.y * dy) - (a / 2))
      .attr("height", a)
      .attr("width", a)
      .attr("fill", "var(--color-indigo-400)");
  });
};
