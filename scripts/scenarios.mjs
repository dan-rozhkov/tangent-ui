// Interaction scripts for scripts/record-demo.mjs. Each one drives a demo the way a person would, with pauses to watch the motion.

/** Moves the cursor to an element in a few steps, so the pointer path is visible, then clicks it. */
async function press(page, locator, { hold = 0 } = {}) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`Not visible: ${locator}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 })
  await page.waitForTimeout(150)
  await page.mouse.down()
  await page.waitForTimeout(hold || 90)
  await page.mouse.up()
}

const pause = (page, ms) => page.waitForTimeout(ms)

/** Centre of an element's box. */
async function center(locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`Not visible: ${locator}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
}

/** Presses on a point, moves through intermediate steps while held, and releases. Used for drag and press-hold gestures. */
async function dragPath(page, from, points, { hold = 350, steps = 22, settle = 250, release = true } = {}) {
  await page.mouse.move(from.x, from.y, { steps: 14 })
  await page.waitForTimeout(150)
  await page.mouse.down()
  await page.waitForTimeout(hold)
  for (const point of points) {
    await page.mouse.move(point.x, point.y, { steps })
    await page.waitForTimeout(settle)
  }
  if (release) await page.mouse.up()
}

/** Hover without pressing: moves the cursor onto the element in steps. */
async function hover(page, locator) {
  const { x, y } = await center(locator)
  await page.mouse.move(x, y, { steps: 18 })
}

/** Types into the focused field the way a person would. */
const type = (page, text) => page.keyboard.type(text, { delay: 70 })

export const scenarios = {
  "float-tabs": async page => {
    const stage = page.locator("main")
    const tab = name => stage.getByRole("tab", { name })
    await pause(page, 600)
    // Glide to a far tab and back through a near one, so lift, stretch and icon scale show.
    await press(page, tab("Settings"))
    await pause(page, 1300)
    await press(page, tab(/^Plan/))
    await pause(page, 1200)
    // Drag the lens across the bar and let it snap.
    const from = await center(tab(/^Plan/))
    const to = await center(tab("Settings"))
    await dragPath(page, from, [{ x: (from.x + to.x) / 2, y: from.y }, { x: to.x + 10, y: from.y }], { hold: 300, steps: 30, settle: 300 })
    await pause(page, 1200)
    // The trailing bubble takes its own lens.
    await press(page, tab("New entry"))
    await pause(page, 1200)
    await press(page, tab("Today"))
    await pause(page, 1000)
    // Scroll the feed down: the bar folds into its compact pill; scroll up and it grows back.
    const feed = await center(stage.locator("[data-stage]"))
    await page.mouse.move(feed.x, feed.y - 120, { steps: 12 })
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 120); await pause(page, 90) }
    await pause(page, 1300)
    await press(page, tab(/^Chats/))
    await pause(page, 1300)
    await page.mouse.move(feed.x, feed.y - 120, { steps: 12 })
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -120); await pause(page, 90) }
    await pause(page, 1400)
  },

  "compose-fab": async page => {
    const stage = page.locator("main")
    const fab = stage.getByRole("button", { name: /^Quick add/ })
    await press(page, fab)
    await pause(page, 1200)
    await press(page, stage.getByRole("menuitem", { name: /Log expense/ }))
    await pause(page, 900)
    await page.keyboard.type("Standing desk from the sale", { delay: 45 })
    await pause(page, 400)
    await press(page, stage.getByRole("radio", { name: "Home" }))
    await pause(page, 600)
    await press(page, stage.getByRole("button", { name: /^Log$/ }))
    await pause(page, 3200)
    // Second round through the keyboard: open, go to the next entry, back out with Escape.
    await press(page, fab)
    await pause(page, 900)
    await page.keyboard.press("ArrowDown")
    await pause(page, 500)
    await page.keyboard.press("Enter")
    await pause(page, 1000)
    await page.keyboard.press("Escape")
    await pause(page, 900)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
  },

  "share-panel": async page => {
    await press(page, page.getByRole("button", { name: "Share", exact: true }))
    await pause(page, 1200)
    await press(page, page.getByRole("button", { name: /Anyone on the kitchen team/ }))
    await pause(page, 900)
    await press(page, page.getByRole("option", { name: /Anyone with the link/ }))
    await pause(page, 900)
    await press(page, page.getByRole("button", { name: "Copy URL" }))
    await pause(page, 1200)
    await press(page, page.getByRole("button", { name: "Chat" }))
    await pause(page, 1400)
    await press(page, page.getByRole("button", { name: "Emma Collins" }))
    await pause(page, 600)
    await press(page, page.getByRole("button", { name: "Marcus Johnson" }))
    await pause(page, 600)
    await press(page, page.getByRole("button", { name: "Olivia Bennett" }))
    await pause(page, 900)
    await press(page, page.getByRole("button", { name: /^Deliver to/ }))
    await pause(page, 2200)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
  },

  "fluid-header": async page => {
    const nav = page.getByRole("navigation", { name: "Site navigation" })
    await hover(page, nav.getByRole("button", { name: "Cook" }))
    await pause(page, 1500)
    await hover(page, nav.getByRole("button", { name: "Learn" }))
    await pause(page, 1200)
    await hover(page, nav.getByRole("button", { name: "Community" }))
    await pause(page, 1200)
    await hover(page, page.getByRole("link", { name: /^Help/ }))
    await pause(page, 900)
    await hover(page, page.locator("main").getByText("Hover a heading"))
    await pause(page, 1000)
    await press(page, nav.getByRole("button", { name: "Search" }))
    await pause(page, 1100)
    await type(page, "recip")
    await pause(page, 900)
    await page.keyboard.press("ArrowDown")
    await pause(page, 500)
    await page.keyboard.press("Enter")
    await pause(page, 1300)
    // Scroll the demo so the bar tightens, then back.
    await page.mouse.move(700, 600, { steps: 10 })
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 90); await pause(page, 90) }
    await pause(page, 1200)
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -90); await pause(page, 90) }
    await pause(page, 1200)
  },

  dock: async page => {
    const dock = page.getByRole("toolbar", { name: "Board tools" })
    await press(page, dock.getByRole("button", { name: /^Hand/ }))
    await pause(page, 800)
    await press(page, dock.getByRole("button", { name: /^Sticky note/ }))
    await pause(page, 800)
    // Open the Shapes tray, look through it, then pick another shape.
    await press(page, dock.getByRole("button", { name: /^Shapes/ }))
    await pause(page, 1400)
    await hover(page, page.getByRole("button", { name: /^Triangle/ }))
    await pause(page, 900)
    await hover(page, page.getByRole("button", { name: /^Ellipse/ }))
    await pause(page, 700)
    await press(page, page.getByRole("button", { name: /^Ellipse/ }))
    await pause(page, 1200)
    await press(page, dock.getByRole("button", { name: /^Comment/ }))
    await pause(page, 1200)
    // Drag Hand to the right to reorder the dock.
    const hand = await center(dock.getByRole("button", { name: /^Hand/ }))
    const text = await center(dock.getByRole("button", { name: /^Text/ }))
    await dragPath(page, hand, [{ x: hand.x + 30, y: hand.y }, { x: text.x + 20, y: text.y }], { hold: 250 })
    await pause(page, 1400)
    await press(page, dock.getByRole("button", { name: /^Move/ }))
    await pause(page, 1000)
  },

  "blob-tabs": async page => {
    const nav = page.getByRole("tablist", { name: "Dashboard views", exact: true })
    for (const name of [/^Orders/, /^Customers/, /^Billing/, /^Overview/]) {
      await press(page, nav.getByRole("tab", { name }))
      await pause(page, 1000)
    }
    const compact = page.getByRole("tablist", { name: "Drawing tools" })
    for (const name of ["Fill", "Pick color", "Draw", "Erase"]) {
      await press(page, compact.getByRole("tab", { name }))
      await pause(page, 900)
    }
    // Drag across the bar.
    const from = await center(nav.getByRole("tab", { name: /^Orders/ }))
    const to = await center(nav.getByRole("tab", { name: /^Billing/ }))
    await dragPath(page, from, [{ x: to.x, y: to.y }, { x: from.x, y: from.y }], { hold: 200, steps: 30 })
    await pause(page, 1200)
  },

  "radial-picker": async page => {
    const trigger = page.getByRole("button", { name: "Message options" })
    for (const name of ["Copy link", "Attach a note"]) {
      const from = await center(trigger)
      await page.mouse.move(from.x, from.y, { steps: 16 })
      await pause(page, 300)
      await page.mouse.down()
      await pause(page, 1300)
      const target = await center(page.getByRole("menuitem", { name }))
      await page.mouse.move(target.x, target.y, { steps: 20 })
      await pause(page, 900)
      await page.mouse.up()
      await pause(page, 2200)
    }
    // Hold, drag toward an action, then back out and release on nothing.
    const from = await center(trigger)
    await page.mouse.move(from.x, from.y, { steps: 10 })
    await page.mouse.down()
    await pause(page, 1300)
    const fav = await center(page.getByRole("menuitem", { name: "Save for later" }))
    await page.mouse.move(fav.x, fav.y, { steps: 20 })
    await pause(page, 700)
    await page.mouse.move(from.x, from.y + 60, { steps: 20 })
    await pause(page, 700)
    await page.mouse.up()
    await pause(page, 1500)
  },

  "reserve-pill": async page => {
    const pill = page.getByRole("group", { name: "Reserve a court" })
    // The idle pill does not take pointer events in this build, so the first open goes through the keyboard.
    await pill.getByRole("button", { name: "Reserve a court" }).focus()
    await page.keyboard.press("Enter")
    await pause(page, 1200)
    await press(page, pill.getByRole("button", { name: "More players" }))
    await pause(page, 500)
    await press(page, pill.getByRole("button", { name: "More players" }))
    await pause(page, 800)
    await press(page, pill.getByRole("button", { name: /^Next, choose a day/ }))
    await pause(page, 1200)
    const slider = pill.getByRole("slider", { name: "Day" })
    await slider.focus()
    for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowRight"); await pause(page, 450) }
    await pause(page, 600)
    await press(page, pill.getByRole("button", { name: /^Next, choose a slot/ }))
    await pause(page, 1200)
    await press(page, pill.getByRole("radio", { name: "5:00 PM" }))
    await pause(page, 800)
    await press(page, pill.getByRole("button", { name: "Review reservation" }))
    await pause(page, 1500)
    await press(page, pill.getByRole("button", { name: /Confirm reservation/ }))
    await pause(page, 3000)
  },

  "mini-player": async page => {
    const player = page.getByRole("region", { name: "Listening queue" })
    await press(page, player.getByRole("button", { name: /^Play/ }))
    await pause(page, 1200)
    await press(page, player.getByRole("button", { name: "Next track" }))
    await pause(page, 1200)
    await press(page, player.getByRole("button", { name: /^Expand player/ }))
    await pause(page, 1500)
    const slider = player.getByRole("slider", { name: "Position" })
    const bar = await center(slider)
    await dragPath(page, { x: bar.box.x + bar.box.width * 0.2, y: bar.y }, [{ x: bar.box.x + bar.box.width * 0.7, y: bar.y }], { hold: 150 })
    await pause(page, 1200)
    await press(page, player.getByRole("button", { name: "Next track" }))
    await pause(page, 1500)
    await press(page, player.getByRole("button", { name: "Previous track" }))
    await pause(page, 1500)
    await press(page, player.getByRole("button", { name: /^Pause/ }))
    await pause(page, 900)
    await press(page, player.getByRole("button", { name: "Collapse player" }))
    await pause(page, 1500)
  },

  "drill-sheets": async page => {
    await press(page, page.getByRole("button", { name: "Bottom" }))
    await pause(page, 600)
    await press(page, page.getByRole("button", { name: "Plant shelf", exact: true }))
    await pause(page, 1300)
    // If the sheet collapsed to zero height (seen in the dev build), stop here so the recording still finishes.
    if (!(await page.getByRole("dialog").boundingBox().then(box => box && box.height > 50))) {
      await pause(page, 2500)
      return
    }
    await press(page, page.getByRole("switch", { name: "Weekly check-in" }))
    await pause(page, 800)
    await press(page, page.getByRole("button", { name: /Monstera/ }))
    await pause(page, 1400)
    await press(page, page.getByRole("button", { name: /Watering plan/ }))
    await pause(page, 1400)
    // Drag the top sheet down by its title to dismiss it.
    let title = await center(page.getByRole("heading", { name: "Watering plan" }))
    await dragPath(page, title, [{ x: title.x, y: title.y + 120 }, { x: title.x, y: title.y + 330 }], { hold: 150, steps: 24, settle: 80 })
    await pause(page, 1400)
    title = await center(page.getByRole("heading", { name: "Monstera" }))
    await dragPath(page, title, [{ x: title.x, y: title.y + 120 }, { x: title.x, y: title.y + 330 }], { hold: 150, steps: 24, settle: 80 })
    await pause(page, 1400)
    await press(page, page.getByRole("button", { name: "Close" }))
    await pause(page, 1200)
  },

  "pass-deck": async page => {
    const cards = page.getByRole("group", { name: "Sam's passes" })
    await press(page, cards.getByRole("button", { name: /Metrolane/ }))
    await pause(page, 1800)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
    await press(page, cards.getByRole("button", { name: /Spoke/ }))
    await pause(page, 1800)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
    // Drag a card out of the stack and let it settle.
    const card = await center(cards.getByRole("button", { name: /Ironworks/ }))
    await dragPath(page, card, [{ x: card.x, y: card.y - 90 }, { x: card.x, y: card.y - 180 }], { hold: 150, steps: 24, settle: 200 })
    await pause(page, 1500)
    await page.keyboard.press("ArrowDown")
    await pause(page, 900)
    await page.keyboard.press("ArrowDown")
    await pause(page, 900)
    await page.keyboard.press("Enter")
    await pause(page, 1800)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
  },

  "shape-spinner": async page => {
    for (const name of ["Columns", "Orbit", "Frame", "Pulse"]) {
      await press(page, page.getByRole("button", { name, exact: true }))
      await pause(page, 1500)
    }
    await press(page, page.getByRole("button", { name: "Finish" }))
    await pause(page, 2800)
    await press(page, page.getByRole("button", { name: "Orbit", exact: true }))
    await pause(page, 1300)
    await press(page, page.getByRole("button", { name: "Break" }))
    await pause(page, 2800)
  },

  "confirm-morph": async page => {
    await press(page, page.getByRole("button", { name: "Delete" }))
    await pause(page, 1400)
    await press(page, page.getByRole("button", { name: "Cancel" }))
    await pause(page, 1400)
    await press(page, page.getByRole("button", { name: "Delete" }))
    await pause(page, 1200)
    await press(page, page.getByRole("group", { name: "Delete 3 files?" }).getByRole("button", { name: "Delete" }))
    await pause(page, 2200)
    const undo = page.getByRole("button", { name: /Undo/ })
    if (await undo.count()) { await press(page, undo.first()); await pause(page, 1800) }
    await press(page, page.getByRole("button", { name: "Revoke access" }))
    await pause(page, 1300)
    await press(page, page.getByRole("button", { name: "Revoke", exact: true }))
    await pause(page, 2500)
  },

  "morph-select": async page => {
    const zone = page.getByRole("combobox", { name: "Time zone" })
    await press(page, zone)
    await pause(page, 1400)
    await press(page, page.getByRole("option", { name: /New York/ }))
    await pause(page, 1500)
    const language = page.getByRole("combobox", { name: "Language", exact: true })
    await press(page, language)
    await pause(page, 1300)
    await type(page, "po")
    await pause(page, 1000)
    await page.keyboard.press("Enter")
    await pause(page, 1500)
    await press(page, language)
    await pause(page, 1200)
    await press(page, page.getByRole("option", { name: "Japanese" }))
    await pause(page, 1500)
  },

  "expandable-card": async page => {
    const card = page.getByRole("button", { name: /^Pro plan/ })
    await press(page, card)
    await pause(page, 1800)
    await press(page, card)
    await pause(page, 1500)
    await press(page, card)
    await pause(page, 1600)
    await press(page, card)
    await pause(page, 1400)
  },

  "expanding-search": async page => {
    await press(page, page.getByRole("button", { name: "Search projects and docs" }))
    await pause(page, 1400)
    await page.keyboard.press("ArrowDown")
    await pause(page, 600)
    await type(page, "motion")
    await pause(page, 1100)
    for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace")
    await type(page, "col")
    await pause(page, 1000)
    await page.keyboard.press("Enter")
    await pause(page, 1800)
    await press(page, page.getByRole("button", { name: "Search projects and docs" }))
    await pause(page, 1200)
    await page.keyboard.press("Escape")
    await pause(page, 1200)
  },

  "user-menu": async page => {
    await press(page, page.getByRole("button", { name: /Account menu, Maya/ }))
    await pause(page, 1400)
    await page.keyboard.press("ArrowDown")
    await pause(page, 500)
    await page.keyboard.press("ArrowDown")
    await pause(page, 500)
    await page.keyboard.press("Escape")
    await pause(page, 1000)
    await press(page, page.getByRole("button", { name: /Account menu, Jonas/ }))
    await pause(page, 1400)
    const status = page.getByRole("menuitemradio").first()
    if (await status.count()) { await press(page, status); await pause(page, 1200) }
    await page.keyboard.press("Escape")
    await pause(page, 1000)
    await press(page, page.getByRole("button", { name: /Account menu, Maya/ }))
    await pause(page, 1000)
    await press(page, page.getByRole("menuitem", { name: /Sign out/ }))
    await pause(page, 2500)
  },

  "card-stack": async page => {
    const top = () => page.getByRole("group", { name: /of 6$/ }).first()
    let c = await center(top())
    await dragPath(page, c, [{ x: c.x + 120, y: c.y + 10 }, { x: c.x + 330, y: c.y + 30 }], { hold: 150, steps: 20 })
    await pause(page, 1200)
    c = await center(top())
    await dragPath(page, c, [{ x: c.x - 120, y: c.y + 10 }, { x: c.x - 330, y: c.y + 30 }], { hold: 150, steps: 20 })
    await pause(page, 1200)
    await press(page, page.getByRole("button", { name: "Shortlist" }))
    await pause(page, 1200)
    await press(page, page.getByRole("button", { name: "Skip" }))
    await pause(page, 1200)
    await press(page, page.getByRole("button", { name: "Undo" }))
    await pause(page, 1200)
    await page.keyboard.press("ArrowRight")
    await pause(page, 1000)
    // A short drag that does not pass the threshold springs back.
    c = await center(top())
    await dragPath(page, c, [{ x: c.x + 60, y: c.y }], { hold: 150, steps: 12 })
    await pause(page, 1200)
  },
}
