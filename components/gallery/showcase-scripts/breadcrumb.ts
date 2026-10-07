import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const crumb = (name: string) => ctx.findByText(name, 'nav[aria-label="Breadcrumb"] button')
  const toggle = () => ctx.findByText(/^Go (deeper|up)$/, "button")

  await ctx.wait(500)
  // A deeper path slides in; choosing an earlier crumb trims it back.
  await ctx.tap(await toggle())
  await ctx.wait(1300)
  const workspace = await crumb("Workspace")
  ctx.hover(workspace)
  await ctx.wait(600)
  await ctx.tap(workspace)
  ctx.unhover(workspace)
  await ctx.wait(1300)
  await ctx.tap(await toggle())
  await ctx.wait(1300)
  await ctx.tap(await toggle())
  await ctx.wait(1200)
}

export default script
