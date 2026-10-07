import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const input = () => ctx.find('input[role="combobox"]')
  const option = (name: string) => ctx.findByText(name, '[role="option"]', { global: true })

  await ctx.wait(500)
  await ctx.tap(await input())
  await ctx.wait(900)
  ctx.hover(await option("Pacific"))
  await ctx.wait(700)
  // Typing filters on labels and keywords.
  await ctx.type(await input(), "zur", { delay: 130 })
  await ctx.wait(1100)
  await ctx.tap(await option("Central European"))
  await ctx.wait(1200)
  // Clear, then choose from the full list.
  await ctx.tap(await ctx.findByLabel("Clear selection"))
  await ctx.wait(900)
  await ctx.tap(await input())
  await ctx.wait(800)
  await ctx.tap(await option("UTC"))
  await ctx.wait(1200)
  await ctx.tap(await ctx.findByLabel("Clear selection"))
  await ctx.wait(800)
  const field = await input()
  ctx.press("Escape", field)
  field.blur()
  await ctx.wait(500)
}

export default script
