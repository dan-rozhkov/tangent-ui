import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  // The demo fetches for 1.5 s on its own; the placeholders fade into the real content.
  await ctx.wait(500)
  await ctx.findByText("Replay", "button")
  await ctx.wait(3200)
  // Replay to see it again.
  await ctx.tap(await ctx.findByText("Replay", "button"))
  await ctx.wait(4000)
}

export default script
