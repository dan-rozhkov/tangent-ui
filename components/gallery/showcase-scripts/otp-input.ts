import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const slot = async (index: number) => (await ctx.findByLabel(new RegExp(`digit ${index} of 6$`))) as HTMLInputElement
  const enter = async (digits: string, from = 1) => {
    for (let index = 0; index < digits.length; index++) {
      await ctx.type(await slot(from + index), digits[index], { delay: 0 })
      await ctx.wait(220)
    }
  }

  await ctx.wait(500)
  // A wrong code shakes the row and turns the slots red.
  await enter("123450")
  await ctx.wait(1700)

  // Correcting the last digit clears the error.
  ctx.press("Delete", await slot(6))
  await ctx.wait(700)
  await enter("6", 6)
  await ctx.wait(2000)

  // Clear the row again.
  for (let index = 6; index >= 1; index--) {
    ctx.press("Delete", await slot(index))
    await ctx.wait(110)
  }
  await ctx.wait(500)
  ;(document.activeElement as HTMLElement | null)?.blur()
  await ctx.wait(700)
}

export default script
