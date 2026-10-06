"use client"

import type { ReactNode } from "react"
import { useDialKit } from "dialkit"

import { PageCurl } from "@/components/ui/page-curl"
import { photo } from "@/lib/media"
import type { PhotoId } from "@/lib/media"

function Photo({ id, className }: { id: PhotoId; className?: string }) {
  const item = photo(id)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.src} alt={item.alt} draggable={false} className={className ?? "absolute inset-0 size-full object-cover"} />
}

function Folio({ number, children }: { number: number; children?: ReactNode }) {
  return (
    <div className="absolute inset-x-4 bottom-3 flex items-center justify-between text-[9px] tracking-wide text-text-muted uppercase">
      <span>{children ?? "Quiet rooms"}</span>
      <span className="tabular-nums">{number}</span>
    </div>
  )
}

const pages = [
  <div key="cover" className="relative size-full">
    <Photo id="terracotta-waves" />
    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_55%,oklch(0%_0_0/.38))]" />
    <div className="absolute inset-x-5 bottom-5 flex flex-col gap-1 text-[oklch(98%_0_0)]">
      <span className="text-xs opacity-85">Issue 07</span>
      <h2 className="m-0 text-[22px] leading-tight font-medium">Quiet rooms</h2>
    </div>
  </div>,
  <div key="contents" className="relative flex size-full flex-col gap-4 p-6">
    <p className="m-0 text-[10px] tracking-wide text-text-muted uppercase">In this issue</p>
    <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
      {[
        ["Light that stays", 3],
        ["A room for one chair", 4],
        ["The sunroom table", 5],
        ["Linen, slowly", 6],
        ["Notes from Lisbon", 7],
      ].map(([title, page]) => (
        <li key={title} className="flex items-baseline gap-2 border-b border-border pb-1.5">
          <span className="flex-1">{title}</span>
          <span className="text-xs text-text-muted tabular-nums">{page}</span>
        </li>
      ))}
    </ol>
    <p className="m-0 mt-auto mb-5 text-xs leading-relaxed text-text-secondary">
      Seven rooms that ask very little of the people living in them, and give a lot back.
    </p>
    <Folio number={2} />
  </div>,
  <div key="living" className="relative size-full">
    <Photo id="living-room" />
    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,oklch(0%_0_0/.55),transparent)] px-5 pt-10 pb-8">
      <p className="m-0 font-display text-xl leading-tight font-medium text-[oklch(100%_0_0)]">Light that stays</p>
      <p className="m-0 mt-1 text-[11px] text-[oklch(100%_0_0/.8)]">Arched windows, pale timber, nothing on the walls.</p>
    </div>
  </div>,
  <div key="chair" className="relative flex size-full flex-col gap-3 p-6">
    <p className="m-0 text-[10px] tracking-wide text-text-muted uppercase">Objects</p>
    <h3 className="m-0 font-display text-2xl leading-tight font-medium tracking-display">A room for one chair</h3>
    <div className="relative h-[40%] overflow-hidden rounded-[10px]">
      <Photo id="lounge-chair" />
    </div>
    <p className="m-0 text-xs leading-relaxed text-text-secondary">
      Woven oak and a sheepskin. Give a good chair a corner of its own and it becomes the place everyone ends up.
    </p>
    <Folio number={4} />
  </div>,
  <div key="sunroom" className="relative size-full">
    <Photo id="sunroom" />
    <Folio number={5}>
      <span className="text-[oklch(100%_0_0/.85)]">The sunroom table</span>
    </Folio>
  </div>,
  <div key="linen" className="relative flex size-full flex-col gap-3 p-6">
    <div className="relative h-[52%] overflow-hidden rounded-[10px]">
      <Photo id="linen-throw" />
    </div>
    <h3 className="m-0 font-display text-2xl leading-tight font-medium tracking-display">Linen, slowly</h3>
    <p className="m-0 text-xs leading-relaxed text-text-secondary">
      Washed twice, never ironed. The fringe is the point: it says the throw is meant to be used.
    </p>
    <Folio number={6} />
  </div>,
  <div key="lisbon" className="relative size-full">
    <Photo id="lisbon-rooftops" />
    <div className="absolute inset-x-0 top-0 bg-[linear-gradient(to_bottom,oklch(0%_0_0/.5),transparent)] px-5 pt-5 pb-10">
      <p className="m-0 font-display text-xl leading-tight font-medium text-[oklch(100%_0_0)]">Notes from Lisbon</p>
    </div>
  </div>,
  <div key="back" className="relative flex size-full flex-col items-center justify-center gap-2 bg-surface-muted p-6 text-center">
    <p className="m-0 font-display text-lg font-medium tracking-display">Quiet rooms</p>
    <p className="m-0 text-[11px] text-text-muted">Issue 07 · Autumn</p>
  </div>,
]

export default function Demo() {
  const values = useDialKit(
    "Page Curl",
    {
      pageAspect: [0.72, 0.5, 1.1, 0.01],
      tease: true,
      controls: true,
      showHint: true,
      hint: "Drag the corner",
    },
    { id: "page-curl" },
  )

  return (
    <PageCurl
      label="Quiet rooms, issue 7"
      pages={pages}
      pageAspect={values.pageAspect}
      tease={values.tease}
      controls={values.controls}
      hint={values.showHint ? values.hint : null}
      style={{ width: 460, maxWidth: "100%" }}
    />
  )
}
