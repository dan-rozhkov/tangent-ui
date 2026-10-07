import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const button = (name: RegExp) => ctx.findByText(name, "button")

  await ctx.wait(500)
  // The label swaps for a spinner, then returns.
  await ctx.tap(await button(/^Save changes$/))
  await ctx.wait(2400)
  // The icon and label swap to a confirmation, then back.
  await ctx.tap(await button(/^Copy$/))
  await ctx.wait(2200)
  const disabled = await button(/^Disabled$/)
  ctx.hover(disabled)
  await ctx.wait(700)
  ctx.unhover(disabled)
}

export default script
