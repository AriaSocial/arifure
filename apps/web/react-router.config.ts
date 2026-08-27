import type { Config } from "@react-router/dev/config"

export default {
  ssr: false,
  prerender: ["/", "/gp-calculator", "/quiz"],
} satisfies Config
