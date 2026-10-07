// Progressive blur: stacked backdrop blurs, each masked to an overlapping band, strongest at the top and gone by the bottom edge.
const blurs = [12, 6, 3, 1]
const step = 100 / (blurs.length + 2)
const blurLayers = blurs.map((blur, i) => {
  const mask = `linear-gradient(to bottom, ${i === 0 ? "black 0%" : `transparent ${i * step}%`}, black ${(i + 1) * step}%, black ${(i + 2) * step}%, transparent ${(i + 3) * step}%)`
  return { backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`, maskImage: mask, WebkitMaskImage: mask }
})

/** Place inside a positioned bar that forms a stacking context. Sits behind the bar and runs a little past it, so content blurs progressively as it scrolls under. */
export function HeaderBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-20">
      {blurLayers.map((style, i) => (
        <div key={i} className="absolute inset-0" style={style} />
      ))}
      <div className="absolute inset-0 bg-linear-to-b from-background/90 via-background/70 via-60% to-transparent" />
    </div>
  )
}
