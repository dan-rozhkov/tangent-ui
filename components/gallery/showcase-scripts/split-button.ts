import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const menuItem = (name: string) => ctx.findByText(name, '[role="menuitem"]', { global: true })

  await ctx.wait(500)
  // Open the primary's menu and pick one.
  await ctx.tap(await ctx.findByLabel("Publish more actions"))
  await ctx.wait(1300)
  ctx.click(await menuItem("Save as draft"))
  await ctx.wait(1000)

  // The label and icon morph in place, then settle back.
  await ctx.tap(await ctx.findByText(/^Copy page/, "button[data-split-primary]"))
  await ctx.wait(2400)
  await ctx.tap(await ctx.findByLabel("Copy page more actions"))
  await ctx.wait(1300)
  ctx.click(await menuItem("Copy link"))
  await ctx.wait(2400)
}

export default script
