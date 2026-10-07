import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // The badge morphs its tone, icon, and label through a deploy.
  const next = await ctx.findByText("Next status", "button")
  for (let step = 0; step < 4; step++) {
    await ctx.tap(next)
    await ctx.wait(1400)
  }
}

export default script
