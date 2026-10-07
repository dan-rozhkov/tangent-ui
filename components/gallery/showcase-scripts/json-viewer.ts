import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // Collapse everything, then open it all again.
  await ctx.tap(await ctx.findByLabel("Collapse all"))
  await ctx.wait(1200)
  await ctx.tap(await ctx.findByLabel("Expand all"))
  await ctx.wait(1400)

  // Search expands the path to each match and steps through them.
  const search = await ctx.findByLabel("Search JSON")
  await ctx.type(search, "Lisbon", { delay: 90 })
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByLabel("Next match"))
  await ctx.wait(1000)

  // Clear the search and fold the tree back up.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(search, "")
  search.dispatchEvent(new Event("input", { bubbles: true }))
  await ctx.wait(900)
  await ctx.tap(await ctx.findByLabel("Collapse all"))
  await ctx.wait(1200)
  const root = await ctx.findByLabel(/^event, object/)
  if (root.getAttribute("aria-expanded") !== "true") {
    await ctx.tap(root)
    await ctx.wait(1200)
  }
}

export default script
