import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const item = (name: string) => ctx.findByText(name, '[role="treeitem"]')

  await ctx.wait(500)
  await ctx.tap(await item("components"))
  await ctx.wait(1200)
  await ctx.tap(await item("button.tsx"))
  await ctx.wait(1000)
  // Collapse the nested folder, then the parent.
  await ctx.tap(await item("settings"))
  await ctx.wait(1000)
  await ctx.tap(await item("app"))
  await ctx.wait(1200)
  await ctx.tap(await item("app"))
  await ctx.wait(1200)
  await ctx.tap(await item("components"))
  await ctx.wait(1100)
  await ctx.tap(await item("layout.tsx"))
  await ctx.wait(1000)
}
export default script
