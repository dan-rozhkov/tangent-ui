import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  await ctx.find('[role="slider"]')
  const [low, high, volume, quality] = Array.from(ctx.root.querySelectorAll<HTMLElement>('[role="slider"]'))

  // Range: drag each end in; the value bubble rides along and the numbers roll.
  await ctx.drag(low, { dx: 70, duration: 900 })
  await ctx.wait(700)
  await ctx.drag(high, { dx: -60, duration: 900 })
  await ctx.wait(700)
  await ctx.drag(low, { dx: -45, duration: 700 })
  await ctx.wait(500)
  await ctx.drag(high, { dx: 80, duration: 800 })
  await ctx.wait(900)

  // Volume: a long pull, then a press on the track jumps the thumb there.
  await ctx.drag(volume, { dx: 110, duration: 900 })
  await ctx.wait(700)
  const row = volume.closest<HTMLElement>("[class*='cursor-pointer']")
  if (row) {
    const { width, height } = row.getBoundingClientRect()
    await ctx.drag(row, { from: { x: width * 0.2, y: height / 2 }, duration: 60 })
    await ctx.wait(1000)
  }

  // Stepped slider: tap a mark to jump, then nudge by key.
  await ctx.tap(await ctx.findByText("High", "span"))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByText("Low", "span"))
  await ctx.wait(1000)
  ctx.press("ArrowRight", quality)
  await ctx.wait(500)
  ctx.press("ArrowRight", quality)
  await ctx.wait(900)
}

export default script
