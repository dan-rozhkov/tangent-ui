import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const layout = (name: string) => ctx.findByText(name, '[role="group"][aria-label="Header layout"] button')
  const nav = (name: string) => ctx.findByText(name, "[data-nav-item]")

  await ctx.wait(500)
  // Mega menu: hovering a trigger opens its panel, and moving along the bar morphs it.
  const product = await nav("Product")
  ctx.hover(product)
  await ctx.wait(1500)
  const resources = await nav("Resources")
  ctx.unhover(product)
  ctx.hover(resources)
  await ctx.wait(1500)
  ctx.unhover(resources)
  await ctx.wait(1500)

  // Simple and centered layouts: the hover pill and the current marker glide between items.
  for (const name of ["Simple", "Centered"]) {
    await ctx.tap(await layout(name))
    await ctx.wait(1000)
    const pricing = await nav("Pricing")
    ctx.hover(pricing)
    await ctx.wait(700)
    ctx.unhover(pricing)
    await ctx.tap(pricing)
    await ctx.wait(1000)
    await ctx.tap(await nav("Customers"))
    await ctx.wait(1000)
  }
  await ctx.tap(await layout("Mega menu"))
  await ctx.wait(1200)
}

export default script
