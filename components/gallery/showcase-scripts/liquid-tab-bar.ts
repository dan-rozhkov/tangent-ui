import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const tab = (list: string, name: string) => ctx.find(`[role="tablist"][aria-label="${list}"] [role="tab"][aria-label^="${name}"]`)

  await ctx.wait(500)
  // The labelled bar: the lens stretches between tabs.
  await ctx.tap(await tab("Sections", "Saved"))
  await ctx.wait(900)
  await ctx.tap(await tab("Sections", "Inbox"))
  await ctx.wait(900)
  await ctx.tap(await tab("Sections", "Profile"))
  await ctx.wait(1000)
  // Grab the lens and throw it back across the bar.
  await ctx.drag(await tab("Sections", "Profile"), { dx: -170, duration: 900 })
  await ctx.wait(1200)
  // The icon-only bar.
  await ctx.tap(await tab("Compact sections", "Library"))
  await ctx.wait(800)
  await ctx.tap(await tab("Compact sections", "Search"))
  await ctx.wait(800)
  await ctx.drag(await tab("Compact sections", "Search"), { dx: -120, duration: 800 })
  await ctx.wait(1000)
  await ctx.tap(await tab("Sections", "Saved"))
  await ctx.wait(600)
}

export default script
