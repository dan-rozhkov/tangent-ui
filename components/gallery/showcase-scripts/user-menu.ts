import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const trigger = (name: string) => ctx.find(`button[aria-label^="Account menu, ${name}"]`)
  const item = (name: string) => ctx.findByText(new RegExp(`^${name}`), '[role="menuitem"]', { global: true })
  const radio = (name: string) => ctx.find(`[role="menuitemradio"][aria-label="${name}"]`, { global: true })

  await ctx.wait(500)
  await ctx.tap(await trigger("Maya"))
  await ctx.wait(1200)
  for (const name of ["Settings", "Billing"]) {
    ctx.hover(await item(name))
    await ctx.wait(600)
  }
  await ctx.tap(await item("Profile"))
  await ctx.wait(1200)

  // The second menu has a status switch that keeps the menu open.
  await ctx.tap(await trigger("Jonas"))
  await ctx.wait(1200)
  await ctx.tap(await radio("Away"))
  await ctx.wait(1000)
  await ctx.tap(await radio("Available"))
  await ctx.wait(1000)
  await ctx.tap(await radio("Busy"))
  await ctx.wait(900)
  await ctx.press("Escape", await ctx.find('[role="menu"]', { global: true }))
  await ctx.wait(1000)
}
export default script
