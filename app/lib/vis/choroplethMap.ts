import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { RefObject } from "react";
import type { Size2D } from "~/lib/useVisualizationSize";

export type EmissionType = "total" | "coal" | "oil" | "gas";

export type CountryEmission = {
  iso3: string;
  country: string;
  value: number;
};

type ChoroplethMapParams<T extends d3.BaseType> = {
  selection: d3.Selection<T, unknown, null, undefined>;
  topology: Topology;
  data: Map<string, CountryEmission>;
  size: Size2D;
  colorRange?: [string, string];
  tooltipRef?: RefObject<HTMLDivElement | null>;
  renderTooltip?: (country: CountryEmission | null, isoA3: string) => string;
};

export async function loadWorldTopology(): Promise<Topology> {
  const response = await fetch(
    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
  );
  return response.json();
}

// Mapping from ISO numeric codes to ISO alpha-3 codes
export const ISO_NUMERIC_TO_ALPHA3: Record<string, string> = {
  "4": "AFG", "8": "ALB", "10": "ATA", "12": "DZA", "16": "ASM", "20": "AND",
  "24": "AGO", "28": "ATG", "31": "AZE", "32": "ARG", "36": "AUS", "40": "AUT",
  "44": "BHS", "48": "BHR", "50": "BGD", "51": "ARM", "52": "BRB", "56": "BEL",
  "60": "BMU", "64": "BTN", "68": "BOL", "70": "BIH", "72": "BWA", "74": "BVT",
  "76": "BRA", "84": "BLZ", "86": "IOT", "90": "SLB", "92": "VGB", "96": "BRN",
  "100": "BGR", "104": "MMR", "108": "BDI", "112": "BLR", "116": "KHM", "120": "CMR",
  "124": "CAN", "132": "CPV", "136": "CYM", "140": "CAF", "144": "LKA", "148": "TCD",
  "152": "CHL", "156": "CHN", "158": "TWN", "162": "CXR", "166": "CCK", "170": "COL",
  "174": "COM", "175": "MYT", "178": "COG", "180": "COD", "184": "COK", "188": "CRI",
  "191": "HRV", "192": "CUB", "196": "CYP", "203": "CZE", "204": "BEN", "208": "DNK",
  "212": "DMA", "214": "DOM", "218": "ECU", "222": "SLV", "226": "GNQ", "231": "ETH",
  "232": "ERI", "233": "EST", "234": "FRO", "238": "FLK", "239": "SGS", "242": "FJI",
  "246": "FIN", "248": "ALA", "250": "FRA", "254": "GUF", "258": "PYF", "260": "ATF",
  "262": "DJI", "266": "GAB", "268": "GEO", "270": "GMB", "275": "PSE", "276": "DEU",
  "288": "GHA", "292": "GIB", "296": "KIR", "300": "GRC", "304": "GRL", "308": "GRD",
  "312": "GLP", "316": "GUM", "320": "GTM", "324": "GIN", "328": "GUY", "332": "HTI",
  "334": "HMD", "336": "VAT", "340": "HND", "344": "HKG", "348": "HUN", "352": "ISL",
  "356": "IND", "360": "IDN", "364": "IRN", "368": "IRQ", "372": "IRL", "376": "ISR",
  "380": "ITA", "384": "CIV", "388": "JAM", "392": "JPN", "398": "KAZ", "400": "JOR",
  "404": "KEN", "408": "PRK", "410": "KOR", "414": "KWT", "417": "KGZ", "418": "LAO",
  "422": "LBN", "426": "LSO", "428": "LVA", "430": "LBR", "434": "LBY", "438": "LIE",
  "440": "LTU", "442": "LUX", "446": "MAC", "450": "MDG", "454": "MWI", "458": "MYS",
  "462": "MDV", "466": "MLI", "470": "MLT", "474": "MTQ", "478": "MRT", "480": "MUS",
  "484": "MEX", "492": "MCO", "496": "MNG", "498": "MDA", "499": "MNE", "500": "MSR",
  "504": "MAR", "508": "MOZ", "512": "OMN", "516": "NAM", "520": "NRU", "524": "NPL",
  "528": "NLD", "531": "CUW", "533": "ABW", "534": "SXM", "535": "BES", "540": "NCL",
  "548": "VUT", "554": "NZL", "558": "NIC", "562": "NER", "566": "NGA", "570": "NIU",
  "574": "NFK", "578": "NOR", "580": "MNP", "581": "UMI", "583": "FSM", "584": "MHL",
  "585": "PLW", "586": "PAK", "591": "PAN", "598": "PNG", "600": "PRY", "604": "PER",
  "608": "PHL", "612": "PCN", "616": "POL", "620": "PRT", "624": "GNB", "626": "TLS",
  "630": "PRI", "634": "QAT", "638": "REU", "642": "ROU", "643": "RUS", "646": "RWA",
  "652": "BLM", "654": "SHN", "659": "KNA", "660": "AIA", "662": "LCA", "666": "MAF",
  "670": "VCT", "674": "SMR", "678": "STP", "682": "SAU", "686": "SEN", "688": "SRB",
  "690": "SYC", "694": "SLE", "702": "SGP", "703": "SVK", "704": "VNM", "705": "SVN",
  "706": "SOM", "710": "ZAF", "716": "ZWE", "724": "ESP", "728": "SSD", "729": "SDN",
  "732": "ESH", "740": "SUR", "744": "SJM", "748": "SWZ", "752": "SWE", "756": "CHE",
  "760": "SYR", "762": "TJK", "764": "THA", "768": "TGO", "772": "TKL", "776": "TON",
  "780": "TTO", "784": "ARE", "788": "TUN", "792": "TUR", "795": "TKM", "796": "TCA",
  "798": "TUV", "800": "UGA", "804": "UKR", "807": "MKD", "818": "EGY", "826": "GBR",
  "831": "GGY", "832": "JEY", "833": "IMN", "834": "TZA", "840": "USA", "850": "VIR",
  "854": "BFA", "858": "URY", "860": "UZB", "862": "VEN", "876": "WLF", "882": "WSM",
  "887": "YEM", "894": "ZMB"
};

// Non-country entries to exclude from calculations
const EXCLUDED_ENTITIES = new Set([
  "World",
  "Global", 
  "International Transport",
]);

export function getIso3FromNumeric(numericId: string | number): string | null {
  const key = String(numericId).replace(/^0+/, "");
  return ISO_NUMERIC_TO_ALPHA3[key] ?? null;
}

// Check if a country name should be excluded (non-country aggregate)
export function isExcludedEntity(countryName: string): boolean {
  return EXCLUDED_ENTITIES.has(countryName);
}

export const choroplethMap = <T extends d3.BaseType>(
  params: ChoroplethMapParams<T>
) => {
  const { selection, topology, data, size, tooltipRef, renderTooltip } = params;
  const colorRange = params.colorRange ?? ["#ffffff", "#7f1d1d"];

  // Extract countries from topology
  const countries = topojson.feature(
    topology,
    topology.objects.countries as GeometryCollection
  );

  // Filter out non-country entities and get values > 0
  const countryValues = Array.from(data.entries())
    .filter(([, emission]) => !isExcludedEntity(emission.country) && emission.value > 0)
    .map(([, emission]) => emission.value);

  const maxValue = countryValues.length > 0 ? Math.max(...countryValues) : 1;
  const minValue = 0; // start from 0

  // Color scale: 0 -> white, maxValue -> dark red
  const colorScale = d3
    .scaleLinear<string>()
    .domain([0, maxValue])
    .range(colorRange)
    .clamp(true);

  // Projection
  const projection = d3
    .geoNaturalEarth1()
    .fitSize([size.width, size.height], countries);

  const pathGenerator = d3.geoPath().projection(projection);

  // Tooltip
  let tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;
  if (tooltipRef?.current) {
    tooltip = d3
      .select(tooltipRef.current)
      .append("div")
      .style("transition-property", "opacity")
      .style("transition-timing-function", "cubic-bezier(0.4, 0, 0.2, 1)")
      .style("transition-duration", "150ms")
      .style("position", "absolute")
      .style("padding", "12px")
      .style("background", "var(--color-zinc-800)")
      .style("color", "var(--color-zinc-50)")
      .style("border-radius", "8px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("top", "0px")
      .style("left", "0px")
      .style("z-index", "50");
  }

  // Define the feature type for proper typing
  type CountryFeature = {
    type: "Feature";
    id?: string | number;
    properties: Record<string, unknown>;
    geometry: GeoJSON.Geometry;
  };

  // Draw countries
  selection
    .selectAll("path")
    .data(countries.features as CountryFeature[])
    .enter()
    .append("path")
    .attr("d", pathGenerator as unknown as string)
    .attr("fill", (d: CountryFeature) => {
      const numericId = d.id;
      if (!numericId) {
        return colorScale(0);
      }
      const iso3 = getIso3FromNumeric(numericId);
      if (!iso3) {
        return colorScale(0);
      }
      const emission = data.get(iso3);
      if (!emission) {
        return colorScale(0);
      }
      return colorScale(Math.max(0, emission.value));
    })
    .attr("stroke", "var(--color-zinc-600)")
    .attr("stroke-width", 0.5)
    .style("cursor", "pointer")
    .on("mouseenter", function (event: MouseEvent, d: CountryFeature) {
      if (!tooltip || !renderTooltip) return;

      const numericId = d.id;
      const iso3 = numericId ? getIso3FromNumeric(numericId) : null;
      const emission = iso3 ? data.get(iso3) : null;

      d3.select(this)
        .attr("stroke", "var(--color-zinc-100)")
        .attr("stroke-width", 2);

      tooltip
        .style("opacity", 1)
        .html(renderTooltip(emission ?? null, iso3 ?? String(numericId ?? "unknown")));
    })
    .on("mousemove", function (event: MouseEvent) {
      if (!tooltip) return;

      const containerRect = tooltipRef?.current?.getBoundingClientRect();
      if (!containerRect) return;

      tooltip
        .style("left", `${event.clientX - containerRect.left + 16}px`)
        .style("top", `${event.clientY - containerRect.top + 16}px`);
    })
    .on("mouseleave", function () {
      if (!tooltip) return;

      d3.select(this)
        .attr("stroke", "var(--color-zinc-600)")
        .attr("stroke-width", 0.5);

      tooltip.style("opacity", 0);
    });

  return { colorScale, maxValue, minValue };
};

// Format number for legend display
function formatLegendValue(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  } else if (value >= 1) {
    return value.toFixed(1);
  } else if (value > 0) {
    return value.toFixed(2);
  }
  return "0";
}

// Render color legend
export const renderColorLegend = <T extends d3.BaseType>(
  selection: d3.Selection<T, unknown, null, undefined>,
  colorScale: d3.ScaleLinear<string, string>,
  maxValue: number,
  width: number,
  height: number = 20,
  _minValue: number = 0 // Always 0
) => {
  const legendWidth = width - 80;
  const legendHeight = height;
  const marginLeft = 40;

  // Gradient definition
  const defs = selection.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%");

  const numStops = 10;
  for (let i = 0; i <= numStops; i++) {
    const t = i / numStops;
    const value = t * maxValue; // From 0 to maxValue
    gradient
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", colorScale(value));
  }

  // Legend bar
  selection
    .append("rect")
    .attr("x", marginLeft)
    .attr("y", 0)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)")
    .attr("rx", 4);

  // Min label (always 0)
  selection
    .append("text")
    .attr("x", marginLeft)
    .attr("y", legendHeight + 14)
    .attr("text-anchor", "start")
    .attr("fill", "var(--color-zinc-400)")
    .attr("font-size", "11px")
    .text("0");

  // Max label (highest emitter value)
  selection
    .append("text")
    .attr("x", marginLeft + legendWidth)
    .attr("y", legendHeight + 14)
    .attr("text-anchor", "end")
    .attr("fill", "var(--color-zinc-400)")
    .attr("font-size", "11px")
    .text(formatLegendValue(maxValue));

  // Middle label for reference
  const midValue = maxValue / 2;
  selection
    .append("text")
    .attr("x", marginLeft + legendWidth / 2)
    .attr("y", legendHeight + 14)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--color-zinc-500)")
    .attr("font-size", "10px")
    .text(formatLegendValue(midValue));

  // Unit label
  selection
    .append("text")
    .attr("x", marginLeft + legendWidth + 8)
    .attr("y", legendHeight / 2 + 4)
    .attr("text-anchor", "start")
    .attr("fill", "var(--color-zinc-500)")
    .attr("font-size", "10px")
    .text("Mt");
};