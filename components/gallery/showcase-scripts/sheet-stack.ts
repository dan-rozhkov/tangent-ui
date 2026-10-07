import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const inSheet = (text: string | RegExp, selector: string) => ctx.findByText(text, selector, { global: true })

  await ctx.wait(500)
  // Bottom sheets: each level keeps its parent peeking behind it.
  await ctx.tap(await ctx.findByText("Sheets", '[role="group"] button'))
  await ctx.wait(900)
  await ctx.tap(await ctx.findByText("Settings", "button"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.find('[role="switch"][aria-label="Weekly summary"]', { global: true }))
  await ctx.wait(800)
  await ctx.tap(await inSheet(/Edit profile$/, "button"))
  await ctx.wait(1300)
  await ctx.tap(await inSheet(/^Blocked people$/, "button"))
  await ctx.wait(1300)
  await ctx.tap(await inSheet("Unblock", "button"))
  await ctx.wait(1200)
  await ctx.tap(await inSheet("Save", "button"))
  await ctx.wait(1300)

  // The same flow as dialogs.
  await ctx.tap(await ctx.findByText("Dialogs", '[role="group"] button'))
  await ctx.wait(900)
  await ctx.tap(await ctx.findByText("Settings", "button"))
  await ctx.wait(1300)
  await ctx.tap(await inSheet(/Edit profile$/, "button"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByLabel(/^Back to /, { global: true }))
  await ctx.wait(1100)
  await ctx.tap(await ctx.findByLabel(/^Close/, { global: true }))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByText("Auto", '[role="group"] button'))
  await ctx.wait(500)
}

export default script
