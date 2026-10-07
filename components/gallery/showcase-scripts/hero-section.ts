import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const design = (name: string) => ctx.findByText(name, '[aria-label="Hero design"] button')

  await ctx.wait(500)
  // The screenshot design: the dashboard rises over the mesh; the call to action confirms in place.
  await ctx.wait(1800)
  await ctx.tap(await ctx.findByText(/^Start free trial/, "button"))
  await ctx.wait(1800)

  // The workflow design routes sample events node by node.
  await ctx.tap(await design("Workflow"))
  await ctx.wait(3200)
  await ctx.tap(await ctx.findByText("Send test event", "button"))
  await ctx.wait(3200)

  await ctx.tap(await design("Mesh"))
  await ctx.wait(2200)
  await ctx.tap(await ctx.findByText(/^Download for Mac/, "button"))
  await ctx.wait(1600)

  await ctx.tap(await design("Screenshot"))
  await ctx.wait(1800)
}

export default script
