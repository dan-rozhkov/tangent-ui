import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const stepper = (action: "Increase" | "Decrease", label: string) => ctx.findByLabel(`${action} ${label}`)
  // Holding a stepper repeats it, faster the longer it is held.
  const hold = async (button: HTMLElement, ms: number) => ctx.drag(button, { dx: 0, dy: 0, duration: 30, hold: ms })

  await ctx.wait(500)
  const seats = await stepper("Increase", "Seats")
  ctx.click(seats)
  await ctx.wait(500)
  ctx.click(seats)
  await ctx.wait(600)
  await hold(seats, 1400)
  await ctx.wait(900)

  // The label scrubs the value sideways.
  await ctx.drag(await ctx.findByText("Seats", "label"), { dx: -150, duration: 1100 })
  await ctx.wait(1000)

  // Arrow keys step the typed field.
  await ctx.find('input[role="spinbutton"]')
  const field = ctx.root.querySelectorAll<HTMLInputElement>('input[role="spinbutton"]')[1]
  if (field) {
    field.focus({ preventScroll: true })
    for (let index = 0; index < 4; index++) {
      ctx.press("ArrowUp", field)
      await ctx.wait(260)
    }
    await ctx.wait(500)
    for (let index = 0; index < 2; index++) {
      ctx.press("ArrowDown", field)
      await ctx.wait(260)
    }
    field.blur()
  }
  await ctx.wait(900)

  await hold(await stepper("Increase", "Seats"), 900)
  await ctx.wait(900)
}

export default script
