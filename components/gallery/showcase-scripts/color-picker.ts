import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const pad = async (label: string) => {
    const thumb = await ctx.findByLabel(label, { global: true })
    return thumb.parentElement as HTMLElement
  }

  await ctx.wait(500)
  await ctx.tap(await ctx.find('button[aria-haspopup="dialog"]'))
  await ctx.wait(1200)
  // The thumb follows the pointer across the field, and the hue slider recolors it.
  const area = await pad("Saturation and brightness")
  await ctx.drag(area, { from: { x: 120, y: 40 }, dx: -70, dy: 60, duration: 900 })
  await ctx.wait(700)
  const hue = await pad("Hue")
  const width = hue.getBoundingClientRect().width
  await ctx.drag(hue, { from: { x: width * 0.6, y: 11 }, dx: width * 0.25, duration: 800 })
  await ctx.wait(800)
  // The value field cycles through formats, and the color can be saved.
  await ctx.tap(await ctx.findByLabel(/^Format:/, { global: true }))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByLabel(/^Save #/, { global: true }))
  await ctx.wait(1100)
  await ctx.drag(hue, { from: { x: width * 0.85, y: 11 }, dx: -width * 0.55, duration: 800 })
  await ctx.wait(700)
  await ctx.tap(await ctx.findByLabel("Done", { global: true }))
  await ctx.wait(1000)
}

export default script
