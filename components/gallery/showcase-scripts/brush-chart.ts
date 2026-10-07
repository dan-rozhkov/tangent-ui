import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(1200)
  const plot = await ctx.find('[role="group"][aria-roledescription="chart"]')
  const box = plot.getBoundingClientRect()
  const y = box.height / 2
  // Scrub the readout across the current window.
  await ctx.trace(plot, [{ x: box.width * 0.95, y }, { x: box.width * 0.1, y }], { duration: 2200, pointerType: "mouse" })
  ctx.unhover(plot)
  await ctx.wait(700)
  // Pan the window back in time, then stretch it.
  const window = await ctx.findByLabel(/ window$/)
  await ctx.drag(window, { dx: -box.width * 0.45, duration: 1400 })
  await ctx.wait(1000)
  const start = await ctx.findByLabel("Window start")
  await ctx.drag(start, { dx: -box.width * 0.2, duration: 1000 })
  await ctx.wait(1000)
  // Double click resets to the whole span; then narrow back to the recent months.
  window.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
  await ctx.wait(1500)
  const begin = await ctx.findByLabel("Window start")
  await ctx.drag(begin, { dx: box.width * 0.87, duration: 1300 })
  await ctx.wait(1200)
}

export default script
