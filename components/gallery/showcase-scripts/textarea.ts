import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const bio = (await ctx.find("textarea:not([disabled])")) as HTMLTextAreaElement

  await ctx.type(bio, "Product designer who loves small, careful motion.", { delay: 45 })
  await ctx.wait(900)
  // Past the limit the counter turns into an error.
  await ctx.type(bio, " Always sketching, shipping, and polishing the details that nobody notices until they are gone. ".repeat(3), { delay: 6 })
  await ctx.wait(1800)

  // Clear it again.
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(bio, "")
  bio.dispatchEvent(new Event("input", { bubbles: true }))
  await ctx.wait(900)
  bio.blur()
  await ctx.wait(500)
}

export default script
