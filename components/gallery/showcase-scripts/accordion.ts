import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  await ctx.findByText("Do you offer refunds?", "button")
  // The first list sits at the top of the demo, so it stays in view in a short tile.
  const triggers = Array.from(ctx.root.querySelectorAll<HTMLElement>("button")).slice(0, 4)
  // The panel springs open and the previous one closes; the first question starts open.
  for (const index of [1, 3, 2, 0]) {
    await ctx.tap(triggers[index])
    await ctx.wait(1400)
  }
  // The open question folds shut.
  await ctx.tap(triggers[0])
  await ctx.wait(1200)
  await ctx.tap(triggers[0])
  await ctx.wait(1000)
}

export default script
