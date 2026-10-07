import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // The icon grows into a field and offers suggestions.
  await ctx.tap(await ctx.find('button[aria-label="Search projects and docs"]'))
  await ctx.wait(1400)
  const input = await ctx.find('input[role="combobox"]')
  await ctx.type(input, "tok", { delay: 130 })
  await ctx.wait(1200)
  ctx.press("ArrowDown", input)
  await ctx.wait(700)
  ctx.press("ArrowDown", input)
  await ctx.wait(800)
  ctx.press("Enter", input)
  await ctx.wait(1800)
}

export default script
