import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(1800)
  // Replay the entrance a couple of times.
  for (let index = 0; index < 2; index++) {
    await ctx.tap(await ctx.findByText("Replay", "button"))
    await ctx.wait(2300)
  }
}

export default script
