import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const tab = (name: string) => ctx.find(`[role="toolbar"] button[aria-label="${name}"]`)
  const row = (name: string) => ctx.findByText(name, '[role="menuitem"]')

  await ctx.wait(500)
  // Hovering an icon floats its label.
  for (const name of ["Home", "Discover", "Favorites"]) {
    ctx.hover(await tab(name))
    await ctx.wait(550)
    ctx.unhover(await tab(name))
  }
  await ctx.tap(await tab("Favorites"))
  await ctx.wait(900)

  // Notebooks opens a menu above the bar.
  await ctx.tap(await tab("Notebooks"))
  await ctx.wait(1200)
  await ctx.tap(await row("Work"))
  await ctx.wait(1400)

  // The overflow control holds the rest.
  await ctx.tap(await ctx.findByLabel(/^Open .* menu$/))
  await ctx.wait(1500)
  await ctx.press("Escape", await ctx.find('[role="menu"]'))
  await ctx.wait(1000)

  await ctx.tap(await tab("Discover"))
  await ctx.wait(1000)
}

export default script
