import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)

  // A mistyped domain gets a suggestion.
  const email = (await ctx.find('input[type="email"]')) as HTMLInputElement
  await ctx.type(email, "ana.reyes@gmial.com", { delay: 50 })
  email.blur()
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByLabel(/^Use /))
  await ctx.wait(1000)
  await ctx.tap(await ctx.findByText("Continue", "button"))
  await ctx.wait(1800)

  // A wrong code shakes the row, then the right one signs in.
  const digits = async (value: string) => {
    const slots = Array.from(ctx.root.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]'))
    for (const [index, digit] of Array.from(value).entries()) await ctx.type(slots[index], digit, { delay: 0 })
  }
  await ctx.find('input[inputmode="numeric"]')
  await ctx.wait(500)
  await digits("111111")
  await ctx.wait(2000)
  await digits("123456")
  await ctx.wait(3000)

  await ctx.tap(await ctx.findByText("Sign out", "button"))
  await ctx.wait(1300)
}

export default script
