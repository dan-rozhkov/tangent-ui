import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const day = (name: RegExp) => ctx.findByLabel(name)

  await ctx.wait(500)
  const trigger = await ctx.findByText(/^Oct 14, 2026/, "button")
  await ctx.tap(trigger)
  await ctx.wait(1000)
  // Pick a day: the field text rolls over to the new date.
  const next = await day(/^\w+, October 21, 2026$/)
  ctx.hover(next)
  await ctx.wait(500)
  await ctx.tap(next)
  await ctx.wait(1300)
  // Page forward a month, then pick again.
  await ctx.tap(await trigger)
  await ctx.wait(800)
  await ctx.tap(await ctx.findByLabel("Next month"))
  await ctx.wait(900)
  await ctx.tap(await day(/^\w+, November 12, 2026$/))
  await ctx.wait(1300)
  // Today jumps back to the current month.
  await ctx.tap(trigger)
  await ctx.wait(800)
  await ctx.tap(await ctx.findByLabel(/^Today,/))
  await ctx.wait(1300)
  // Back to the plan's start.
  await ctx.tap(trigger)
  await ctx.wait(800)
  await ctx.tap(await day(/^\w+, October 14, 2026$/))
  await ctx.wait(1200)
}

export default script
