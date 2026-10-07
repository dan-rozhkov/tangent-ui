import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const item = (name: string) => ctx.findByText(new RegExp(`^${name}`), '[role="menuitem"]', { global: true })

  await ctx.wait(500)
  const sort = await ctx.findByText(/^Newest first/, "button")
  await ctx.pressTap(sort)
  await ctx.wait(900)
  // The highlight follows the pointer; picking an option relabels the trigger.
  ctx.hover(await item("Last edited"))
  await ctx.wait(500)
  ctx.hover(await item("Alphabetical"))
  await ctx.wait(600)
  await ctx.tap(await item("Alphabetical"))
  await ctx.wait(1200)
  const actions = await ctx.findByText(/^Actions/, "button")
  await ctx.pressTap(actions)
  await ctx.wait(900)
  for (const name of ["Rename", "Duplicate", "Share", "Delete"]) {
    ctx.hover(await item(name))
    await ctx.wait(550)
  }
  ctx.press("Escape", await ctx.find('[role="menu"]', { global: true }))
  await ctx.wait(900)
  // Back to the first sort.
  await ctx.pressTap(await ctx.findByText(/^Alphabetical/, "button"))
  await ctx.wait(800)
  await ctx.tap(await item("Newest first"))
  await ctx.wait(1000)
}

export default script
