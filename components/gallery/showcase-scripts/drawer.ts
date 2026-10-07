import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const open = async (name: string) => {
    await ctx.tap(await ctx.findByText(name, "button"))
    await ctx.wait(1200)
  }
  const dismiss = async () => {
    ctx.press("Escape", await ctx.find('[role="dialog"]', { global: true }))
    await ctx.wait(1000)
  }

  await ctx.wait(500)
  await open("Filters")
  await ctx.tap(await ctx.findByLabel("Include archived", { global: true }))
  await ctx.wait(800)
  await ctx.tap(await ctx.findByText("Apply", "button", { global: true }))
  await ctx.wait(1000)
  // The same drawer from other edges.
  await open("From the left")
  await dismiss()
  await open("From the bottom")
  await dismiss()
  // Anchored to a panel instead of the page.
  await open("Open in panel")
  await ctx.wait(500)
  await dismiss()
}

export default script
