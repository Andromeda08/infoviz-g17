import * as d3 from 'd3';
import type { Size2D } from "~/lib/useVisualizationSize";

type Range = {
  start: number;
  end: number;
};

type Point2D = {
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
    .axisLeft(scaleY);

  selection
    .append('g')
    .attr("transform", `translate(${margin}, 0)`)
    .call(axisY);

  dataPoints.forEach((point) => console.log(`${point.x},${point.y}`));
}