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

type MarkerShape = "square" | "circle";

type MarkerStyle = {
  shape?: MarkerShape;
  size?: number;
  color?: string;
}

type LineStyle = {
  size?: number;
  color?: string;
}

export type Line = {
  data: Point2D[];
  style?: LineStyle;
  marker?: MarkerStyle;
}

export type LineChartData = Line[];

export const lineChart = <T extends d3.BaseType>(
  selection: d3.Selection<T, unknown, null, undefined>,
  x: Range,
  y: Range,
  margin: number,
  size: Size2D,
  data: LineChartData,
  axes: boolean = false,
) => {
  const dx = (size.width - 2 * margin) / (x.end - x.start);
  const getX = (point: Point2D) => {
    return margin + ((point.x + (-1 * x.start)) * dx);
  };

  const dy = (size.height - 2 * margin) / (y.end - y.start);
  const getY = (point: Point2D): number => {
    return size.height - margin - ((point.y + (-1 * y.start)) * dy);
  };

  const drawLine = (line: Line): void => {
    const sorted = line.data.sort((a, b) => a.x - b.x);

    // Lines between points
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      selection
        .append("line")
        .attr("x1",  getX(prev))
        .attr("y1", getY(prev))
        .attr("x2",  getX(curr))
        .attr("y2", getY(curr))
        .attr("stroke", line.style?.color ?? "var(--color-indigo-600)")
        .attr("stroke-width", line.style?.size ?? 2);
    }

    // Data point markers
    const a= line.marker?.size ?? 8;
    const shape = line.marker?.shape ?? 'square';

    sorted.forEach((point: Point2D): void => {
      switch (shape) {
        case "square":
          selection
            .append("rect")
            .attr("x", getX(point) - (a / 2))
            .attr("y", getY(point) - (a / 2))
            .attr("width", a)
            .attr("height", a)
            .attr("fill", line.marker?.color ?? "var(--color-indigo-400)");
          break;
        case "circle":
          selection
            .append("circle")
            .attr("cx", getX(point))
            .attr("cy", getY(point))
            .attr("r", a)
            .attr("fill", line.marker?.color ?? "var(--color-indigo-400)");
          break;
      }
    });
  };

  // Render axes from origin (0,0)
  if (axes) {
    selection
      .append("line")
      .attr("x1",  getX({ x: x.start, y: 0 }))
      .attr("y1", getY({ x: x.start, y: 0 }))
      .attr("x2",  getX({ x: x.end, y: 0 }))
      .attr("y2", getY({ x: x.end, y: 0 }))
      .attr("stroke", "var(--color-zinc-600)")
      .attr("stroke-width", 2);

    selection
      .append("line")
      .attr("x1", getX({ x: 0, y: y.start }))
      .attr("y1", getY({ x: 0, y: y.start }))
      .attr("x2", getX({ x: 0, y: y.end }))
      .attr("y2", getY({ x: 0, y: y.end }))
      .attr("stroke", "var(--color-zinc-600)")
      .attr("stroke-width", 2);
  }

  // Draw each line
  data.forEach((line: Line): void => drawLine(line));

  // Draw axes over lines
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
};
