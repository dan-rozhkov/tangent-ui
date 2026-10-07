import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (label: string) => ctx.findByText(new RegExp(`^${label}`), "button")

  await ctx.wait(500)
  // Label, spinner, then a check: each button runs its own pending and success wording.
  await ctx.tap(await button("Save changes"))
  await ctx.wait(2600)
  await ctx.tap(await button("Publish"))
  await ctx.wait(3200)
  // The disabled one stays put.
  const deploy = await button("Deploy")
  ctx.hover(deploy)
  await ctx.tap(deploy)
  await ctx.wait(900)
  ctx.unhover(deploy)
}

export default script
