import { index, route, type RouteConfig } from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("gp-calculator", "routes/gp-calculator.tsx"),
  route("quiz", "routes/quiz.tsx"),
] satisfies RouteConfig
