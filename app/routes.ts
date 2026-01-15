import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("map", "routes/map.tsx"),
] satisfies RouteConfig;
