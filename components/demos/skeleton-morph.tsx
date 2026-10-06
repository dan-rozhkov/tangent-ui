"use client"

import { useEffect, useState } from "react"
import { RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MorphBlock, SkeletonMorph } from "@/components/ui/skeleton-morph"
import { avatar } from "@/lib/media"
import type { PersonId } from "@/lib/media"

const card = "flex w-full flex-col rounded-panel border border-border bg-surface p-5"

const payouts: { id: PersonId; name: string; note: string; amount: string; nameWidth: number; noteWidth: number }[] = [
  { id: "emma-collins", name: "Emma Collins", note: "Sent today", amount: "$980", nameWidth: 104, noteWidth: 76 },
  { id: "mateo-alvarez", name: "Mateo Alvarez", note: "Sent Oct 2", amount: "$1,460", nameWidth: 104, noteWidth: 76 },
  { id: "hannah-walsh", name: "Hannah Walsh", note: "Due Oct 14", amount: "$2,310", nameWidth: 104, noteWidth: 76 },
]

export default function Demo() {
  const [loading, setLoading] = useState(true)
  const [round, setRound] = useState(0)

  // Each round pretends to fetch for a moment, then resolves.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 1500)
    return () => window.clearTimeout(timer)
  }, [round])

  return (
    <div className="flex w-full max-w-[490px] flex-col items-center gap-4">
      <SkeletonMorph loading={loading} loadingLabel="Loading profile" as="article" className={card}>
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <MorphBlock radius="circle" width={52} height={52} className="flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar("jasmine-brooks")} alt="" width={52} height={52} className="block size-13 rounded-full object-cover" />
            </MorphBlock>
            <div className="flex min-w-0 flex-col gap-0.5">
              <MorphBlock width={124} lines={1} lineHeight={20}>
                <p className="m-0 text-[15px] leading-[20px] font-medium">Jasmine Brooks</p>
              </MorphBlock>
              <MorphBlock width={164} lines={1} lineHeight={18}>
                <p className="m-0 text-[13px] leading-[18px] text-text-secondary">Design lead, Lisbon studio</p>
              </MorphBlock>
            </div>
          </div>
          <MorphBlock lines={3} lineHeight={20}>
            <p className="m-0 text-sm leading-[20px] text-text-secondary">
              Shapes calm interfaces for home goods. This month: a quieter checkout and a lamp that keeps turning up in every moodboard.
            </p>
          </MorphBlock>
          <div className="flex items-center justify-between gap-3">
            <MorphBlock width={169} lines={1} lineHeight={20}>
              <p className="m-0 text-sm leading-[20px] text-text-secondary">
                <span className="text-foreground tabular-nums">3.1k</span> followers · <span className="text-foreground tabular-nums">96</span> posts
              </p>
            </MorphBlock>
            <MorphBlock width={90} height={36} radius={18} className="flex-none">
              <Button size="sm" className="w-[90px]">
                Follow
              </Button>
            </MorphBlock>
          </div>
        </div>
      </SkeletonMorph>
      <SkeletonMorph loading={loading} loadingLabel="Loading payouts" as="section" className={card}>
        <div className="grid gap-4">
          <MorphBlock width={101} lines={1} lineHeight={20}>
            <h3 className="m-0 text-sm leading-[20px] font-medium">Recent payouts</h3>
          </MorphBlock>
          <ul className="m-0 grid list-none gap-3.5 p-0">
            {payouts.map(item => (
              <li key={item.id} className="flex h-9 items-center gap-3">
                <MorphBlock radius="circle" width={36} height={36} className="flex-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatar(item.id)} alt="" width={36} height={36} className="block size-9 rounded-full object-cover" />
                </MorphBlock>
                <div className="flex min-w-0 flex-1 flex-col">
                  <MorphBlock width={item.nameWidth} lines={1} lineHeight={18}>
                    <p className="m-0 text-sm leading-[18px] font-medium">{item.name}</p>
                  </MorphBlock>
                  <MorphBlock width={item.noteWidth} lines={1} lineHeight={18}>
                    <p className="m-0 text-xs leading-[18px] text-text-muted">{item.note}</p>
                  </MorphBlock>
                </div>
                <MorphBlock width={44} lines={1} lineHeight={18} className="flex-none">
                  <p className="m-0 text-sm leading-[18px] tabular-nums">{item.amount}</p>
                </MorphBlock>
              </li>
            ))}
          </ul>
        </div>
      </SkeletonMorph>
      <Button
        size="sm"
        variant="secondary"
        className="px-3.5"
        onClick={() => {
          setLoading(true)
          setRound(value => value + 1)
        }}
      >
        <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />
        Reload
      </Button>
    </div>
  )
}
