import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  // Tabs with unread items carry the count in their aria-label ("Chats (4 unread)"), the rest are named by their text.
  const tab = (name: string) => (name === "Chats" ? ctx.find('[role="tab"][aria-label^="Chats"]') : ctx.findByText(name, '[role="tab"]'))
  const scroller = await ctx.find(".overflow-y-auto")

  await ctx.wait(500)
  // The glass lens slides to each tab and the feed behind it changes colour.
  for (const name of ["Plan", "Chats", "Settings"]) {
    await ctx.tap(await tab(name))
    await ctx.wait(1100)
  }
  // Drag the lens back across the bar, then let it snap.
  const last = await tab("Settings")
  await ctx.drag(last, { dx: -190, duration: 900 })
  await ctx.wait(1100)

  // Scrolling the feed shrinks the bar; scrolling back restores it.
  scroller.scrollTo({ top: 520, behavior: "smooth" })
  await ctx.wait(1500)
  ctx.hover(await tab("Chats"))
  await ctx.wait(700)
  scroller.scrollTo({ top: 0, behavior: "smooth" })
  await ctx.wait(1300)

  await ctx.tap(await ctx.findByLabel("New entry"))
  await ctx.wait(1200)
  await ctx.tap(await tab("Today"))
  await ctx.wait(1200)
}

export default script
