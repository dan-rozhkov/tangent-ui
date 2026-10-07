import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

import { themeTour } from "./theme-tour"

// Reveal grows from the button; Rise lifts from the bottom edge.
const script: AutoplayScript = ctx =>
  themeTour(ctx, async () => {
    const buttons = Array.from(ctx.root.querySelectorAll<HTMLElement>("button[aria-pressed]"))
    return [buttons[0], buttons[3]]
  })

export default script
