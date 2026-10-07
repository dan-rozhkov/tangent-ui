import type { AutoplayScript } from "@/components/gallery/showcase-autoplay"

const script: AutoplayScript = async ctx => {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform)
  const mod = mac ? { key: "Meta", code: "MetaLeft", flag: { metaKey: true } } : { key: "Control", code: "ControlLeft", flag: { ctrlKey: true } }
  const code = (key: string) => `Key${key.toUpperCase()}`

  // Holding the main modifier lights every shortcut that uses it in the list.
  const hold = async (ms: number) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: mod.key, code: mod.code, bubbles: true, ...mod.flag }))
    await ctx.wait(ms)
    window.dispatchEvent(new KeyboardEvent("keyup", { key: mod.key, code: mod.code, bubbles: true }))
  }

  await ctx.wait(500)
  const recorder = await ctx.find("button[aria-pressed]")
  const record = async (key: string, shift = false) => {
    await ctx.tap(recorder)
    await ctx.wait(900)
    // Held modifiers appear as caps before the chord lands.
    ctx.press(mod.key, recorder, { code: mod.code, ...mod.flag })
    await ctx.wait(500)
    if (shift) {
      ctx.press("Shift", recorder, { code: "ShiftLeft", shiftKey: true, ...mod.flag })
      await ctx.wait(500)
    }
    ctx.press(key, recorder, { code: code(key), shiftKey: shift, ...mod.flag })
    await ctx.wait(1100)
  }

  await record("j", true)
  await hold(1400)

  // A taken chord asks before it replaces the other binding.
  await record("p")
  await ctx.tap(await ctx.findByText("Cancel", "button"))
  await ctx.wait(1000)

  // Reset puts the original back.
  await ctx.tap(await ctx.findByLabel(/^Reset to /))
  await ctx.wait(2000)
}

export default script
