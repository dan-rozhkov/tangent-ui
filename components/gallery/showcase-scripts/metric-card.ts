import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

// Display-only: the value counts up on entry and the card has no hover response, so the script waits for the count and
// rests the pointer on the card.
const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  await ctx.wait(2200)
  const card = (ctx.root.querySelector("[class*='rounded']") as HTMLElement | null) ?? ctx.root
  ctx.hover(card)
  await ctx.wait(1200)
  ctx.unhover(card)
  await ctx.wait(600)
}

export default script
