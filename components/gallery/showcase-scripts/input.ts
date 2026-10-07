import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const email = await ctx.find('input[type="email"]')
  const inputs = () => Array.from(ctx.root.querySelectorAll<HTMLInputElement>("input"))

  // An address without an @ opens the error row; completing it swaps back to the helper.
  await ctx.type(email, "ada.lovelace", { delay: 70 })
  await ctx.wait(1400)
  await ctx.type(email, "@analytical.dev", { delay: 70 })
  await ctx.wait(1200)

  // The counter in the helper text ticks with each character.
  const name = inputs().find(input => input.value === "Ada Lovelace")!
  await ctx.type(name, " of Ockham", { delay: 80 })
  await ctx.wait(1500)
  ;(ctx.root.ownerDocument.activeElement as HTMLElement | null)?.blur()
  await ctx.wait(600)
}

export default script
