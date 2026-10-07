import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const trigger = async (index: number) => {
    await ctx.find('button[aria-haspopup="listbox"]')
    return ctx.root.querySelectorAll<HTMLElement>('button[aria-haspopup="listbox"]')[index]
  }
  const option = (text: string) => ctx.findByText(text, '[role="option"]', { global: true })

  await ctx.wait(500)
  await ctx.tap(await trigger(0))
  await ctx.wait(1000)
  ctx.hover(await option("4:00 PM"))
  await ctx.wait(600)
  await ctx.tap(await option("4:00 PM"))
  await ctx.wait(1200)

  // The second picker uses a 24-hour clock.
  await ctx.tap(await trigger(1))
  await ctx.wait(1000)
  await ctx.tap(await option("19:00"))
  await ctx.wait(1200)

  // Put the first one back.
  await ctx.tap(await trigger(0))
  await ctx.wait(900)
  await ctx.tap(await option("2:30 PM"))
  await ctx.wait(1000)
}
export default script
