import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

import { themeTour } from "./theme-tour"

const script: AutoplayScript = ctx => themeTour(ctx, async () => [await ctx.find("button[aria-pressed]")])

export default script
