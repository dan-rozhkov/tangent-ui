import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  await ctx.wait(500)
  // The passkey request pulses while it waits; cancelling returns to the start.
  await ctx.tap(await ctx.findByText(/Sign in with passkey/, "button"))
  await ctx.wait(1500)
  await ctx.tap(await ctx.findByText("Cancel", "button"))
  await ctx.wait(900)

  // The email path slides to the next step each time.
  await ctx.tap(await ctx.findByText(/Use email instead/, "button"))
  await ctx.wait(1000)
  await ctx.type(await ctx.find('input[type="email"]'), "maya@northwind.studio", { delay: 45 })
  await ctx.wait(500)
  await ctx.tap(await ctx.findByText("Send code", "button"))

  // The six digits fill their cells one by one, then the code is checked.
  for (const [index, digit] of [...(await demoCode(ctx))].entries()) {
    const cell = await ctx.findByLabel(new RegExp(`digit ${index + 1} of`))
    await ctx.type(cell, digit, { delay: 40 })
    await ctx.wait(150)
  }
  await ctx.findByText("Sign out", "button", { timeout: 6000 })
  await ctx.wait(2400)
  await ctx.tap(await ctx.findByText("Sign out", "button"))
  await ctx.wait(1400)
}

/** The demo prints its code under the field: "Demo code: 482913". */
async function demoCode(ctx: Parameters<AutoplayScript>[0]) {
  const hint = await ctx.findByText(/^Demo code: \d{6}$/, "*", { timeout: 6000 })
  return hint.textContent!.match(/\d{6}/)![0]
}

export default script
