import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const save = () => ctx.findByText("Save", "button")

  await ctx.wait(500)
  await ctx.tap(await save())
  await ctx.wait(1800)
  // Swipe it away.
  const toast = await ctx.find('[role="status"]')
  await ctx.drag(toast, { dx: 320, duration: 350 })
  await ctx.wait(1200)

  // The second one times out by itself.
  await ctx.tap(await save())
  await ctx.wait(5600)
}
export default script
