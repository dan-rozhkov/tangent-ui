import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // Each tab swaps in its own illustration and copy.
  for (const name of ["Offline", "Caught up", "Not found", "No results"]) {
    await ctx.tap(await ctx.findByText(name, '[role="tab"]'))
    await ctx.wait(1500)
  }
}

export default script
