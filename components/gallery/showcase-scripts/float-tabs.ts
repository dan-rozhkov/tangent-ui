import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  // Tabs with a badge carry it in their aria-label ("Saved, 3"), the rest are named by their text.
  const tab = (name: string) => (name === "Saved" ? ctx.find('[role="tab"][aria-label^="Saved"]') : ctx.findByText(name, '[role="tab"]'))
  const scroller = await ctx.find(".overflow-y-auto")

  await ctx.wait(500)
  // The glass lens slides to each tab and the feed behind it changes colour.
  for (const name of ["Explore", "Saved", "Profile"]) {
    await ctx.tap(await tab(name))
    await ctx.wait(1100)
  }
  // Drag the lens back across the bar, then let it snap.
  const profile = await tab("Profile")
  await ctx.drag(profile, { dx: -190, duration: 900 })
  await ctx.wait(1100)

  // Scrolling the feed shrinks the bar; scrolling back restores it.
  scroller.scrollTo({ top: 520, behavior: "smooth" })
  await ctx.wait(1500)
  ctx.hover(await tab("Saved"))
  await ctx.wait(700)
  scroller.scrollTo({ top: 0, behavior: "smooth" })
  await ctx.wait(1300)

  await ctx.tap(await ctx.findByLabel("Search"))
  await ctx.wait(1200)
  await ctx.tap(await tab("Home"))
  await ctx.wait(1200)
}

export default script
