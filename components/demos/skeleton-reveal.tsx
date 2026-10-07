"use client"

import { useEffect, useState } from "react"
import { ArrowsClockwiseIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { RevealBlock, SkeletonReveal } from "@/components/ui/skeleton-reveal"
import { avatar } from "@/lib/media"
import type { PersonId } from "@/lib/media"

const card = "flex w-full flex-col rounded-panel border border-border bg-surface p-5"

const shipments: { id: PersonId; name: string; note: string; amount: string; nameWidth: number; noteWidth: number }[] = [
  { id: "daniel-kim", name: "Daniel Kim", note: "Left the depot", amount: "12 crates", nameWidth: 96, noteWidth: 88 },
  { id: "chloe-nguyen", name: "Chloe Nguyen", note: "Arrives Nov 6", amount: "4 crates", nameWidth: 104, noteWidth: 84 },
  { id: "andre-williams", name: "Andre Williams", note: "Packing Nov 9", amount: "28 crates", nameWidth: 112, noteWidth: 80 },
]

export default function Demo() {
  const [ready, setReady] = useState(false)
  const [round, setRound] = useState(0)

  // Each round waits a moment, then reveals.
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 1600)
    return () => window.clearTimeout(timer)
  }, [round])

  return (
    <div className="flex w-full max-w-[490px] flex-col items-center gap-4">
      <SkeletonReveal ready={ready} busyLabel="Fetching vendor" as="article" className={card}>
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <RevealBlock shape="circle" width={52} height={52} className="flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar("sofia-ramirez")} alt="" width={52} height={52} className="block size-13 rounded-full object-cover" />
            </RevealBlock>
            <div className="flex min-w-0 flex-col gap-0.5">
              <RevealBlock width={124} rows={1} rowHeight={20}>
                <p className="m-0 text-[15px] leading-[20px] font-medium">Sofia Ramirez</p>
              </RevealBlock>
              <RevealBlock width={164} rows={1} rowHeight={18}>
                <p className="m-0 text-[13px] leading-[18px] text-text-secondary">Orchard grower, Valle Verde</p>
              </RevealBlock>
            </div>
          </div>
          <RevealBlock rows={2} rowHeight={20}>
            <p className="m-0 text-sm leading-[20px] text-text-secondary">
              Third-generation pear and quince farm. Picking wraps up this week, and the late russet crates ship in time for the first cold snap.
            </p>
          </RevealBlock>
          <div className="flex items-center justify-between gap-3">
            <RevealBlock width={169} rows={1} rowHeight={20}>
              <p className="m-0 text-sm leading-[20px] text-text-secondary">
                <span className="text-foreground tabular-nums">48</span> acres · <span className="text-foreground tabular-nums">7</span> varieties
              </p>
            </RevealBlock>
            <RevealBlock width={90} height={36} shape={18} className="flex-none">
              <Button size="sm" className="w-[90px]">
                Order
              </Button>
            </RevealBlock>
          </div>
        </div>
      </SkeletonReveal>
      <SkeletonReveal ready={ready} busyLabel="Fetching shipments" as="section" className={card}>
        <div className="grid gap-4">
          <RevealBlock width={128} rows={1} rowHeight={20}>
            <h3 className="m-0 text-sm leading-[20px] font-medium">Incoming shipments</h3>
          </RevealBlock>
          <ul className="m-0 grid list-none gap-3.5 p-0">
            {shipments.map(item => (
              <li key={item.id} className="flex h-9 items-center gap-3">
                <RevealBlock shape="circle" width={36} height={36} className="flex-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatar(item.id)} alt="" width={36} height={36} className="block size-9 rounded-full object-cover" />
                </RevealBlock>
                <div className="flex min-w-0 flex-1 flex-col">
                  <RevealBlock width={item.nameWidth} rows={1} rowHeight={18}>
                    <p className="m-0 text-sm leading-[18px] font-medium">{item.name}</p>
                  </RevealBlock>
                  <RevealBlock width={item.noteWidth} rows={1} rowHeight={18}>
                    <p className="m-0 text-xs leading-[18px] text-text-muted">{item.note}</p>
                  </RevealBlock>
                </div>
                <RevealBlock width={64} rows={1} rowHeight={18} className="flex-none">
                  <p className="m-0 text-sm leading-[18px] tabular-nums">{item.amount}</p>
                </RevealBlock>
              </li>
            ))}
          </ul>
        </div>
      </SkeletonReveal>
      <Button
        size="sm"
        variant="secondary"
        className="px-3.5"
        onClick={() => {
          setReady(false)
          setRound(value => value + 1)
        }}
      >
        <ArrowsClockwiseIcon size={16} aria-hidden="true" />
        Replay
      </Button>
    </div>
  )
}
