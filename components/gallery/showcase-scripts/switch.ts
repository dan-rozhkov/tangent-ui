import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const toggle = (name: string) => ctx.findByText(name, "button")

  await ctx.wait(500)
  const notifications = await toggle("Notifications")
  const autoplay = await toggle("Autoplay previews")
  await ctx.pressTap(notifications)
  await ctx.wait(1000)
  await ctx.pressTap(autoplay)
  await ctx.wait(1100)
  await ctx.pressTap(notifications)
  await ctx.wait(1000)
  await ctx.pressTap(autoplay)
  await ctx.wait(1000)
  await ctx.pressTap(notifications)
  await ctx.wait(1000)
}

export default script
