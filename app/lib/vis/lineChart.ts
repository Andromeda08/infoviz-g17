import * as d3 from 'd3';
import type { Size2D } from "~/lib/useVisualizationSize";
import { maxElement, minElement } from "~/lib/math";
import type {RefObject} from "react";

export type Range = {
  start: number;
  end: number;
};

export type Point2D = {
  x: number;
  y: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customData?: any;
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
  name?: string;
  style?: LineStyle;
  marker?: MarkerStyle;
}

export type LineChartData = Line[];

export const getRange = (data: LineChartData, axis: keyof Point2D): Range => {
  const points = data.flatMap((d) => d.data);
  return {
    start: minElement(points, (p) => p[axis])[axis],
    end: maxElement(points, (p) => p[axis])[axis],
  };
}

type LineChartParams<T extends d3.BaseType> = {
  selection: d3.Selection<T, unknown, null, undefined>,
  data: LineChartData,
  size: Size2D,
  xr?: Range,
  yr?: Range,
  normalize?: boolean,
  margin?: number,
  axes?: boolean,
  ticksX?: number;
  ticksY?: number;
  formatX?: (value: d3.NumberValue) => string;
  formatY?: (value: d3.NumberValue) => string;
  onPointClick?: (point: Point2D) => void;
  tooltipRef?: RefObject<HTMLDivElement | null>;
  renderTooltip?: (point: Point2D) => string;
}

export const lineChart = <T extends d3.BaseType>(
  params: LineChartParams<T>
) => {
  const { selection, data, size, tooltipRef, renderTooltip, onPointClick } = params;

  const margin:    number  = params.margin ?? 32;
  const normalize: boolean = params.normalize ?? false;
  const axes:      boolean = params.axes ?? false;

  const rangeX = params.xr ?? getRange(data, 'x');
  const rangeY = params.yr ?? getRange(data, 'y');

  const x: Range = normalize ? { start: 0, end: 1 } : rangeX;
  const y: Range = normalize ? { start: 0, end: 1 } : rangeY;

  const lines = data.map((line) => {
    return {
      ...line,
      data: line.data.map((point) => {
        if (normalize) {
          return {
            x: (point.x - rangeX.start) / (rangeX.end - rangeX.start),
            y: (point.y - rangeY.start) / (rangeY.end - rangeY.start),
            customData: point.customData,
          };
        }
        return point;
      }),
    }
  })

  // point -> chart X
  const dx = (size.width - 2 * margin) / (x.end - x.start);
  const getX = (point: Point2D) => {
    return margin + ((point.x + (-1 * x.start)) * dx);
  };

  // point -> chart Y
  const dy = (size.height - 2 * margin) / (y.end - y.start);
  const getY = (point: Point2D): number => {
    return size.height - margin - ((point.y + (-1 * y.start)) * dy);
  };

  // Tooltip setup
  let tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;
  if (tooltipRef) {
    tooltip = d3
      .select(tooltipRef?.current)
      .append("div")
      .style("transition-property", "opacity")
      .style("transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function)")
      .style("transition-duration", "var(--tw-duration, var(--default-transition-duration)")
      .style("position", "absolute")
      .style("padding", "12px")
      .style("background", "var(--color-zinc-800)")
      .style("color", "var(--color-zinc-50)")
      .style("border-radius", "8px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("top", "0px")
      .style("left", "0px");
  }

  // Line drawing utility fn
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
    const baseSize = line.marker?.size ?? 8;
    const shape = line.marker?.shape ?? 'square';

    sorted.forEach((point: Point2D): void => {

      const isSelected = Boolean(point.customData?.selected);
      const a = isSelected ? baseSize * 1.6 : baseSize;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let marker: any = undefined;
      switch (shape) {
        case "square": {
          marker = selection
            .append("rect")
            .attr("x", getX(point) - a / 2)
            .attr("y", getY(point) - a / 2)
            .attr("width", a)
            .attr("height", a)
            .attr("fill", line.marker?.color ?? "var(--color-indigo-400)")
            // when point selected
            .attr("stroke", isSelected ? "var(--color-zinc-100)" : "none")
            .attr("stroke-width", isSelected ? 2 : 0)
            // clickable cursor
            .style("cursor", onPointClick ? "pointer" : "default");
          break;
        }
        case "circle": {
          marker = selection
            .append("circle")
            .attr("cx", getX(point))
            .attr("cy", getY(point))
            .attr("r", a)
            .attr("fill", line.marker?.color ?? "var(--color-indigo-400)")
            // when selected
            .attr("stroke", isSelected ? "var(--color-zinc-100)" : "none")
            .attr("stroke-width", isSelected ? 2 : 0)
            // clickable cursor
            .style("cursor", onPointClick ? "pointer" : "default");
          break;
        }
      }
      
      // click handler
      if (marker && onPointClick) {
        marker.on("click", () => onPointClick(point));
      }

      // tooltip events
      if (marker && tooltip && renderTooltip) {
        marker
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on("mouseover", (event: any) => {
            d3.select(event.currentTarget).attr("fill", "var(--color-zinc-100)");
            tooltip
              .style("opacity", 1)
              .style("left", `${8 + getX(point) - (a / 2)}px`)
              .style("top", `${8 + getY(point) - (a / 2)}px`)
              .html(renderTooltip(point));
          })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on("mouseleave", (event: any) => {
            d3.select(event.currentTarget).attr("fill", line.marker?.color ?? "var(--color-indigo-400)");
            tooltip.style("opacity", 0);
          });
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
  lines.forEach((line: Line): void => drawLine(line));

  // Draw axes over lines
  const scaleX = d3
  .scaleLinear()
  .domain([x.start, x.end])
  .range([margin, size.width - margin]);

  const axisX = d3
  .axisBottom(scaleX)
  .ticks(params.ticksX ?? (normalize ? 10 : 8))
  .tickFormat((params.formatX ?? (d3.format("d") as any)) as any);

  selection
  .append("g")
  .attr("transform", `translate(0, ${size.height - margin})`)
  .call(axisX);

  const scaleY = d3
  .scaleLinear()
  // y-axis should go from high to low (top -> bottom)
  .domain([y.end, y.start])
  .range([margin, size.height - margin]);

  const axisY = d3
  .axisLeft(scaleY)
  .ticks(params.ticksY ?? 6)
  .tickFormat((params.formatY ?? (d3.format("~s") as any)) as any);

  selection
  .append("g")
  .attr("transform", `translate(${margin}, 0)`)
  .call(axisY);
};
