import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const day = (name: RegExp) => ctx.findByLabel(name)
  const preset = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  const trigger = await ctx.findByLabel(/^Report period:/)
  await ctx.tap(trigger)
  await ctx.wait(1000)
  // Presets sweep the range across the calendar.
  await ctx.tap(await preset("Last 30 days"))
  await ctx.wait(1100)
  await ctx.tap(await preset("This month"))
  await ctx.wait(1100)
  // Then draw one by hand: click the start, preview while hovering, click the end.
  await ctx.tap(await day(/^\w+, September 21, 2026$/))
  await ctx.wait(600)
  for (const [month, date] of [["September", 28], ["October", 1], ["October", 4]] as const) {
    ctx.hover(await day(new RegExp(`^\\w+, ${month} ${date}, 2026$`)))
    await ctx.wait(450)
  }
  await ctx.tap(await day(/^\w+, October 4, 2026$/))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByText("Apply", "button"))
  await ctx.wait(1400)
}

export default script
