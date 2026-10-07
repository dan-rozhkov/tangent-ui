import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // Prices roll when billing changes.
  await ctx.tap(await ctx.findByText("Yearly", "button"))
  await ctx.wait(1500)

  // Differences only folds the shared rows away.
  const differences = await ctx.find('[role="switch"]')
  await ctx.tap(differences)
  await ctx.wait(1600)
  await ctx.tap(differences)
  await ctx.wait(1400)

  await ctx.tap(await ctx.findByText("Select Studio", "button"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByText("Select Team", "button"))
  await ctx.wait(1300)

  await ctx.tap(await ctx.findByText("Monthly", "button"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByText("Selected", "button"))
  await ctx.wait(900)
}

export default script
