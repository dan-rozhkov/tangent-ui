import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const inSheet = (text: string | RegExp, selector: string) => ctx.findByText(text, selector, { global: true })

  await ctx.wait(500)
  // Bottom sheets: each level keeps its parent peeking behind it.
  await ctx.tap(await ctx.findByText("Bottom", '[role="group"] button'))
  await ctx.wait(900)
  await ctx.tap(await ctx.findByText("Plant shelf", "button"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.find('[role="switch"][aria-label="Weekly check-in"]', { global: true }))
  await ctx.wait(800)
  await ctx.tap(await inSheet(/Water on Friday$/, "button"))
  await ctx.wait(1300)
  await ctx.tap(await inSheet(/^Watering plan$/, "button"))
  await ctx.wait(1300)
  await ctx.tap(await inSheet("Stop sharing", "button"))
  await ctx.wait(1200)
  await ctx.tap(await inSheet("Save", "button"))
  await ctx.wait(1300)

  // The same flow as dialogs.
  await ctx.tap(await ctx.findByText("Centered", '[role="group"] button'))
  await ctx.wait(900)
  await ctx.tap(await ctx.findByText("Plant shelf", "button"))
  await ctx.wait(1300)
  await ctx.tap(await inSheet(/Water on Friday$/, "button"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByLabel(/^Back to /, { global: true }))
  await ctx.wait(1100)
  await ctx.tap(await ctx.findByLabel(/^Close/, { global: true }))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByText("Auto", '[role="group"] button'))
  await ctx.wait(500)
}

export default script
