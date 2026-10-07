import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const maya = await ctx.findByText("@maya", "button")
  const jonas = await ctx.findByText("@jonas", "button")

  // The card opens after a short intent delay and stays up until the pointer leaves.
  ctx.hover(maya)
  await ctx.findByText(/Maya Chen/, "*", { global: true })
  await ctx.wait(2000)
  ctx.unhover(maya)
  await ctx.wait(900)

  // A second card opens above, quicker now that cards are warm.
  ctx.hover(jonas)
  await ctx.findByText(/Jonas Weber/, "*", { global: true })
  await ctx.wait(2000)
  ctx.unhover(jonas)
  await ctx.wait(1000)
}

export default script
