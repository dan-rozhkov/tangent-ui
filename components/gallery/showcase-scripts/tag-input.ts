import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const input = (await ctx.find("input")) as HTMLInputElement

  for (const tag of ["craft", "details", "typography"]) {
    await ctx.type(input, tag, { delay: 70 })
    await ctx.wait(250)
    ctx.press("Enter", input)
    await ctx.wait(1000)
  }

  // Backspace picks the last tag, a second one removes it.
  ctx.press("Backspace", input)
  await ctx.wait(900)
  ctx.press("Backspace", input)
  await ctx.wait(1000)
  // Arrow back to an older tag and remove it with its button.
  await ctx.tap(await ctx.findByLabel("Remove details"))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByLabel("Remove craft"))
  await ctx.wait(1200)
  input.blur()
  await ctx.wait(400)
}

export default script
