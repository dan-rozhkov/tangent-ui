import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  const input = (await ctx.find('input[name="password"]')) as HTMLInputElement
  // The meter and the checklist fill in as the password gets stronger.
  await ctx.type(input, "tangent", { delay: 90 })
  await ctx.wait(1000)
  await ctx.type(input, "Ui2", { delay: 140 })
  await ctx.wait(1000)
  await ctx.type(input, "-gallery!", { delay: 90 })
  await ctx.wait(1300)

  await ctx.tap(await ctx.findByLabel("Show password"))
  await ctx.wait(1400)
  await ctx.tap(await ctx.findByLabel("Show password"))
  await ctx.wait(800)

  // Clearing it empties the meter again.
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  while (input.value) {
    setValue?.call(input, input.value.slice(0, -1))
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await ctx.wait(45)
  }
  input.blur()
  await ctx.wait(500)
}

export default script
