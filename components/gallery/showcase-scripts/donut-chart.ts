import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const segment = (name: string) => ctx.findByLabel(new RegExp(`^${name},`))

  await ctx.wait(500)
  // Pointing at a legend row lifts its slice and swaps the total in the centre.
  for (const name of ["Search", "Direct", "Social", "Email"]) {
    const row = await segment(name)
    ctx.hover(row)
    await ctx.wait(900)
    ctx.unhover(row)
  }
  // Pressing a row hides the slice and the ring rebalances.
  const direct = await segment("Direct")
  await ctx.tap(direct)
  await ctx.wait(1400)
  await ctx.tap(await ctx.findByLabel(/^Social,/))
  await ctx.wait(1400)
  await ctx.tap(await ctx.findByLabel(/^Direct, hidden/))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByLabel(/^Social, hidden/))
  await ctx.wait(1000)
}

export default script
