import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const addFilter = async (field: string, value: string) => {
    await ctx.tap(await ctx.findByText("Add filter", "button"))
    await ctx.wait(900)
    const row = await ctx.findByText(new RegExp(`^${field}`), '[role="menuitem"]')
    ctx.hover(row)
    await ctx.wait(450)
    await ctx.tap(row)
    await ctx.wait(900)
    await ctx.tap(await ctx.findByText(new RegExp(`^${value}`), '[role="menuitemradio"]'))
    await ctx.wait(1200)
  }

  await ctx.wait(500)
  // A chip leaves and its neighbours close the gap.
  await ctx.tap(await ctx.findByLabel("Remove Owner: Maya"))
  await ctx.wait(1100)
  // The Add filter button grows into a field menu, then a value menu.
  await addFilter("Priority", "Urgent")
  await addFilter("Label", "Bug")
  await ctx.tap(await ctx.findByText("Clear all", "button"))
  await ctx.wait(1300)
  await addFilter("Status", "Open")
  await ctx.wait(500)
}

export default script
