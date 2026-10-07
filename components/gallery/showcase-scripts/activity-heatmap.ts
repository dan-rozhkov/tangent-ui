import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const cells = () => Array.from(ctx.root.querySelectorAll<HTMLElement>('[role="gridcell"]'))
  const swatch = (index: number) => ctx.findByLabel(/^Highlight days with/).then(() => ctx.root.querySelectorAll<HTMLElement>("button[data-level-key]")[index])

  await ctx.wait(500)
  await ctx.find('[role="gridcell"]')
  const all = cells()
  // Hover days across the year: the bubble follows with the count and date.
  for (const fraction of [0.3, 0.34, 0.5, 0.62, 0.8]) {
    const cell = all[Math.floor(all.length * fraction)]
    ctx.hover(cell)
    await ctx.wait(900)
  }
  ctx.unhover(all[Math.floor(all.length * 0.8)])
  await ctx.wait(500)
  // The legend dims every day outside a level.
  const busiest = await swatch(4)
  ctx.hover(busiest)
  await ctx.wait(1100)
  await ctx.tap(busiest)
  ctx.unhover(busiest)
  await ctx.wait(1400)
  const low = await swatch(1)
  await ctx.tap(low)
  await ctx.wait(1400)
  await ctx.tap(low)
  ctx.unhover(low)
  await ctx.wait(1000)
}

export default script
