import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const chip = (kind: string) => ctx.find(`button[data-kind="${kind}"]`)

  await ctx.wait(500)
  // Filtering regroups the feed and rolls the counts.
  await ctx.tap(await chip("fixed"))
  await ctx.wait(1300)
  await ctx.tap(await chip("new"))
  await ctx.wait(1300)
  await ctx.tap(await ctx.findByText("Show all", "button"))
  await ctx.wait(1000)
  // An entry unfolds in place.
  const row = await ctx.find("button[aria-expanded]")
  await ctx.tap(row)
  await ctx.wait(1500)
  await ctx.tap(row)
  await ctx.wait(800)
  // The month pill glides while the list scrolls.
  await ctx.tap(await ctx.findByLabel("Jump to July 2026"))
  await ctx.wait(1600)
  await ctx.tap(await ctx.findByLabel("Jump to September 2026"))
  await ctx.wait(1400)
  // Subscribe morphs into an email field, then a confirmation.
  await ctx.tap(await ctx.findByText("Subscribe", "button"))
  await ctx.wait(700)
  await ctx.type(await ctx.find('input[type="email"]'), "emma@northwind.example", { delay: 35 })
  await ctx.wait(500)
  await ctx.click(await ctx.findByLabel("Subscribe to release notes"))
  await ctx.wait(1600)
  await ctx.tap(await ctx.findByText("Undo", "button"))
  await ctx.wait(900)
}

export default script
