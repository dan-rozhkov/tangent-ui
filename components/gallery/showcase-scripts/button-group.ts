import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const segment = (id: string) => ctx.find(`button[data-key="${id}"]`)
  const group = (label: string) => ctx.find(`[role="group"][aria-label="${label}"]`)

  await ctx.wait(500)
  // The highlight follows the pointer from segment to segment.
  const actions = await group("Document actions")
  const share = await segment("share")
  ctx.hover(share)
  await ctx.wait(600)
  ctx.hover(await segment("duplicate"))
  await ctx.wait(600)
  await ctx.tap(await segment("duplicate"))
  await ctx.wait(1000)
  await ctx.tap(share)
  await ctx.wait(1200)
  const archive = await segment("archive")
  ctx.hover(archive)
  await ctx.tap(archive)
  await ctx.wait(1100)
  await ctx.tap(await segment("archive"))
  ctx.unhover(actions)
  await ctx.wait(1000)
  // The overflow menu.
  await ctx.pressTap(await ctx.findByLabel("More actions"))
  await ctx.wait(1200)
  const pin = await ctx.findByText("Pin to sidebar", '[role="menuitem"]', { global: true })
  ctx.hover(pin)
  await ctx.wait(700)
  ctx.click(pin)
  await ctx.wait(900)
  // Zoom steps, with the buttons disabling at the ends.
  const zoomIn = await ctx.findByLabel("Zoom in")
  for (let step = 0; step < 3; step++) {
    await ctx.tap(zoomIn)
    await ctx.wait(450)
  }
  await ctx.tap(await ctx.findByLabel("Zoom out"))
  await ctx.wait(500)
  await ctx.tap(await ctx.findByLabel(/^Zoom \d+%$/))
  await ctx.wait(900)
  await ctx.tap(await ctx.findByLabel("Align center"))
  await ctx.wait(900)
}

export default script
