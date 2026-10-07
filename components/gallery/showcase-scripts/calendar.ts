import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const day = (key: string) => ctx.find(`[data-present] [data-date="${key}"]`)
  const nav = (label: string) => ctx.findByLabel(label)

  await ctx.wait(500)
  // The selection disc glides to a new day, then the month slides over.
  await ctx.tap(await day("2026-10-21"))
  await ctx.wait(1200)
  await ctx.tap(await nav("Next month"))
  await ctx.wait(1000)
  await ctx.tap(await day("2026-11-12"))
  await ctx.wait(1200)
  await ctx.tap(await nav("Next month"))
  await ctx.wait(1000)
  // Today jumps back across the months.
  await ctx.tap(await ctx.findByLabel(/^Today,/))
  await ctx.wait(1300)
  await ctx.tap(await day("2026-10-14"))
  await ctx.wait(1000)
}

export default script
