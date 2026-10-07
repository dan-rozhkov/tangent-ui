import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  // Ticks by position rather than title, so the tour survives the demo's photos changing.
  const tick = (index: number) => ctx.find(`[aria-label$=' position'] > button:nth-of-type(${index + 1})`)

  await ctx.wait(500)
  const stage = await ctx.find("[tabindex='0']")

  // Swipe through the rail.
  await ctx.drag(stage, { dx: -170, duration: 500 })
  await ctx.wait(1000)
  await ctx.drag(stage, { dx: -170, duration: 500 })
  await ctx.wait(1000)

  // Tap a neighbour to bring it forward.
  await ctx.tap(await ctx.find("[role='group'][aria-label^='6 of 7']"))
  await ctx.wait(1100)

  // Jump with the position ticks.
  await ctx.tap(await tick(4))
  await ctx.wait(1300)
  await ctx.drag(stage, { dx: 170, duration: 500 })
  await ctx.wait(1000)
  await ctx.tap(await tick(2))
  await ctx.wait(1200)
}

export default script
