import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(600)
  // The pill opens into the participant card.
  await ctx.tap(await ctx.find('button[aria-expanded="false"][aria-controls]'))
  await ctx.wait(2600)

  // Join the call: the button flips to Leave and the status line under the pill changes.
  await ctx.tap(await ctx.findByText("Join Now", "button"))
  await ctx.wait(2200)

  // Fold back to the pill.
  await ctx.tap(await ctx.findByLabel(/^Close /))
  await ctx.wait(1500)
}

export default script
