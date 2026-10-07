import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const input = () => ctx.find('input[role="combobox"]')
  const row = (name: string) => ctx.findByText(new RegExp(`^${name}`), '[role="option"]')

  await ctx.wait(500)
  // Arrow keys slide one highlight down the list.
  const field = await input()
  for (let step = 0; step < 3; step++) {
    ctx.press("ArrowDown", field)
    await ctx.wait(350)
  }
  await ctx.wait(500)
  // The pointer moves it with a spring.
  ctx.hover(await row("Manage members"))
  await ctx.wait(800)
  ctx.hover(await row("Open settings"))
  await ctx.wait(900)
  // Typing filters the groups and closes the gaps.
  await ctx.type(field, "inv", { delay: 150 })
  await ctx.wait(1300)
  ctx.press("Enter", field)
  await ctx.wait(1400)
  await ctx.type(field, "dark", { delay: 130 })
  await ctx.wait(1200)
  ctx.press("Escape", field)
  await ctx.wait(1200)
}

export default script
