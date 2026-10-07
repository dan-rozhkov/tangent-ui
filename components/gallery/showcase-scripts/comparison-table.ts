import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const scroller = (await ctx.find('[role="table"]')).parentElement as HTMLElement
  const scrollTo = (top: number) => scroller.scrollTo({ top, behavior: "smooth" })

  await ctx.wait(500)
  // Rows and section titles that match fold away.
  const toggle = await ctx.find('input[role="switch"]')
  await ctx.click(toggle)
  await ctx.wait(1700)
  await ctx.click(toggle)
  await ctx.wait(1500)
  // The header stays pinned while the rows scroll under it.
  scrollTo(scroller.scrollHeight)
  await ctx.wait(1700)
  await ctx.tap(await ctx.findByText("Start free trial", "button"))
  await ctx.wait(1500)
  scrollTo(0)
  await ctx.wait(1500)
}

export default script
