import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

import { themeTour } from "./theme-tour"

// The new theme opens from a seam down the middle.
const script: AutoplayScript = ctx => themeTour(ctx, async () => [await ctx.find('button[aria-label^="Switch to"]')])

export default script
