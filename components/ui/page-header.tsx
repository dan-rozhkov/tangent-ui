"use client"

import { Fragment, useEffect, useId, useRef, useState } from "react"
import type { FocusEvent, ReactNode, UIEvent } from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { AnimatePresence, LayoutGroup, motion, type Transition, type Variants } from "motion/react"
import { ArchiveIcon, BellIcon, BellRingingIcon, BellSlashIcon, CalendarBlankIcon, CaretRightIcon, CheckCircleIcon, CheckIcon, CircleDashedIcon, CircleIcon, DotsThreeIcon, FileTextIcon, FilmStripIcon, type Icon as IconComponent, LinkIcon, PaperPlaneTiltIcon, PenIcon, PlusIcon, PresentationIcon, TableIcon, TrayArrowUpIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { AnimatedCounter } from "@/components/ui/animated-counter"
import { Avatar } from "@/components/ui/avatar"
import { AvatarGroup } from "@/components/ui/avatar-group"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

/** The header condenses past CONDENSE_AT and only opens again near the top, so it never flickers at the threshold. */
const CONDENSE_AT = 16
const EXPAND_AT = 4
/** Secondary actions fold into the overflow menu when the breadcrumbs would get less room than this, and return with a little slack. */
const LEAD_MIN = 240
const LEAD_RETURN = 272
const DONE_AT_START = 31
const PROJECT_URL = "https://northline.example/projects/checkout-redesign"

type PersonId = "emma" | "marcus" | "ava" | "sofia" | "jasmine"
const people: Record<PersonId, { name: string; src: string }> = {
  emma: { name: "Emma Collins", src: "/media/people/emma-collins.jpg" },
  marcus: { name: "Marcus Johnson", src: "/media/people/marcus-johnson.jpg" },
  ava: { name: "Ava Mitchell", src: "/media/people/ava-mitchell.jpg" },
  sofia: { name: "Sofia Ramirez", src: "/media/people/sofia-ramirez.jpg" },
  jasmine: { name: "Jasmine Brooks", src: "/media/people/jasmine-brooks.jpg" },
}
const members = (["emma", "marcus", "ava", "sofia", "jasmine"] as const).map(key => people[key])

type Section = "overview" | "issues" | "updates" | "files"
const sections: { value: Section; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "issues", label: "Issues" },
  { value: "updates", label: "Updates" },
  { value: "files", label: "Files" },
]
const order = (section: Section) => sections.findIndex(item => item.value === section)

type Issue = { id: string; title: string; owner: PersonId; label: string; fresh?: boolean }
const startingIssues: Issue[] = [
  { id: "CHK-138", title: "Saved card list clips the expiry date on small screens", owner: "sofia", label: "Bug" },
  { id: "CHK-136", title: "Add an edit link beside each section of the review step", owner: "emma", label: "Design" },
  { id: "CHK-135", title: "Wallet sheet opens twice after a failed card check", owner: "marcus", label: "Bug" },
  { id: "CHK-133", title: "Show the delivery estimate before payment", owner: "ava", label: "Research" },
  { id: "CHK-131", title: "Promo code field loses focus after an invalid code", owner: "sofia", label: "Bug" },
  { id: "CHK-129", title: "Track drop-off between review and pay", owner: "ava", label: "Analytics" },
  { id: "CHK-127", title: "Preselect the last used card for returning customers", owner: "marcus", label: "Feature" },
  { id: "CHK-124", title: "Write clearer copy for declined cards", owner: "emma", label: "Content" },
  { id: "CHK-122", title: "Address autocomplete drops apartment numbers", owner: "sofia", label: "Bug" },
]
const draftIssues = [
  "Keyboard focus skips the save card checkbox",
  "Recalculate tax when the shipping country changes",
  "Pay button needs a pressed and loading state",
  "Review totals wrap awkwardly at large text sizes",
]

type Update = { id: string; author: PersonId; date: string; tone: "success" | "warning"; status: string; body: string; fresh?: boolean }
const startingUpdates: Update[] = [
  {
    id: "u4",
    author: "emma",
    date: "Sep 19",
    tone: "success",
    status: "On track",
    body: "Saved payment methods reached every iOS customer on Thursday. Returning customers now finish checkout 3.1 points more often. The review step is next.",
  },
  {
    id: "u3",
    author: "ava",
    date: "Sep 12",
    tone: "success",
    status: "On track",
    body: "Five usability sessions are done. People trust a single review step as long as the total stays visible while they edit.",
  },
  {
    id: "u2",
    author: "marcus",
    date: "Sep 5",
    tone: "warning",
    status: "At risk",
    body: "Card tokenization is waiting on the payments team. We moved the review step ahead so the October date can hold.",
  },
  {
    id: "u1",
    author: "emma",
    date: "Aug 29",
    tone: "success",
    status: "On track",
    body: "Kickoff. Scope is saved cards, one review step, and a staged rollout starting October 14.",
  },
]
const draftUpdates = [
  "The review step is in staging behind a flag. If error rates hold through Friday, we open it to 10% of traffic on Monday.",
  "Declined card copy is final and with support for review. No change to the October 14 rollout.",
]

const files: { name: string; kind: string; size: string; owner: PersonId; date: string; icon: IconComponent }[] = [
  { name: "Checkout flows v3", kind: "Design file", size: "18.4 MB", owner: "emma", date: "Sep 20", icon: PenIcon },
  { name: "Review step walkthrough", kind: "Video", size: "46 MB", owner: "emma", date: "Sep 18", icon: FilmStripIcon },
  { name: "Payments API notes", kind: "Document", size: "96 KB", owner: "marcus", date: "Sep 16", icon: FileTextIcon },
  { name: "Usability findings, round two", kind: "PDF", size: "2.1 MB", owner: "ava", date: "Sep 13", icon: FileTextIcon },
  { name: "Rollout plan", kind: "Slides", size: "4.8 MB", owner: "sofia", date: "Sep 11", icon: PresentationIcon },
  { name: "Conversion baseline", kind: "Spreadsheet", size: "640 KB", owner: "ava", date: "Sep 9", icon: TableIcon },
  { name: "Empty and error states", kind: "Design file", size: "9.2 MB", owner: "emma", date: "Sep 6", icon: PenIcon },
  { name: "Launch checklist", kind: "Document", size: "54 KB", owner: "sofia", date: "Sep 2", icon: FileTextIcon },
]

const milestoneIcons = { done: CheckCircleIcon, active: CircleDashedIcon, planned: CircleIcon }
const milestones: { name: string; note: string; state: keyof typeof milestoneIcons }[] = [
  { name: "Saved payment methods", note: "Shipped Sep 18", state: "done" },
  { name: "Single review step", note: "In progress, due Oct 1", state: "active" },
  { name: "Staged rollout", note: "Planned for Oct 14", state: "planned" },
]
const activity: { who: PersonId; text: string; time: string }[] = [
  { who: "ava", text: "moved CHK-131 to review", time: "1h ago" },
  { who: "marcus", text: "merged the saved cards endpoint", time: "3h ago" },
  { who: "emma", text: "shared Checkout flows v3", time: "Yesterday" },
  { who: "sofia", text: "closed CHK-119, a double charge on retry", time: "Yesterday" },
  { who: "jasmine", text: "set the rollout date to October 14", time: "Sep 17" },
]

type Notice = { key: number; text: string; tone: "success" | "error" | "neutral" }
type MenuAction = { key: string; label: string; icon: ReactNode; onSelect: () => void; disabled?: boolean; separatorBefore?: boolean }

const still: Transition = { duration: 0 }
const quick: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }
const blur = (px: number) => `blur(${px}px)`
const icon = { size: 16, "aria-hidden": true } as const

/** Panels slide a few pixels in the direction of the tab that was chosen. */
const panelSlide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 12 }),
  center: {
    opacity: 1,
    x: 0,
    transition: { x: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -8,
    transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] },
  }),
}
const panelFade: Variants = {
  enter: { opacity: 0, x: 0 },
  center: { opacity: 1, x: 0, transition: { duration: motionTokens.duration.instant } },
  exit: { opacity: 0, x: 0, transition: { duration: motionTokens.duration.instant } },
}

/** Rows open and close their own height, so the list closes the gap instead of jumping. */
function rowMotion(reduce: boolean) {
  return reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: motionTokens.duration.instant } }
    : {
        initial: { opacity: 0, height: 0 },
        animate: { opacity: 1, height: "auto" },
        exit: { opacity: 0, height: 0 },
        transition: { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] } },
      }
}

/* Shared class strings. */
const note = "text-xs text-text-muted tabular-nums whitespace-nowrap"
const sectionTitle = "m-0 mb-2 text-sm font-medium"
const listReset = "m-0 list-none p-0"
const phone = "@max-[559px]/ph:"

/** A new row arrives lit and settles to the page, so it is easy to find without a lasting marker. */
function Arrived() {
  return (
    <motion.span
      className="pointer-events-none absolute inset-x-0 inset-y-[3px] -z-1 rounded-[10px] bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)]"
      aria-hidden="true"
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: 1.8, times: [0, 0.35, 1], ease: [...motionTokens.ease.standard] }}
    />
  )
}

function StatusDot() {
  return <span className="size-1.5 rounded-full bg-current" />
}

const menuClass = [
  "[--menu-x:0px] [--menu-y:-5px] data-[side=top]:[--menu-y:5px]",
  "relative max-w-(--available-width) min-w-[min(13rem,var(--available-width))] rounded-panel border border-border bg-surface-raised p-[5px] font-sans text-sm tracking-body text-foreground shadow-floating outline-none",
  "origin-(--transform-origin) [transition:opacity_var(--duration-fast)_var(--ease-enter),transform_var(--duration-spring)_var(--ease-spring)]",
  "data-starting-style:[transform:translate(var(--menu-x),var(--menu-y))_scale(.97)] data-starting-style:opacity-0",
  "data-ending-style:pointer-events-none data-ending-style:[transform:translate(calc(var(--menu-x)*.5),calc(var(--menu-y)*.5))_scale(.985)] data-ending-style:opacity-0",
  "data-ending-style:[transition:opacity_var(--duration-instant)_var(--ease-standard),transform_var(--duration-instant)_var(--ease-standard)]",
  "motion-reduce:[transform:none]! motion-reduce:[transition:opacity_var(--duration-instant)_linear]!",
].join(" ")

const itemClass =
  "relative flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[calc(var(--radius-panel)-6px)] px-[11px] outline-none select-none data-disabled:cursor-default data-disabled:opacity-45 [&>svg]:flex-none [&>svg]:text-text-secondary"

/** The overflow button never scales: it anchors the menu. A shared highlight glides between items under the pointer. */
function OverflowMenu({ actions, reduce }: { actions: MenuAction[]; reduce: boolean }) {
  const [highlight, setHighlight] = useState<{ top: number; height: number; glide: boolean } | null>(null)
  const pointer = useRef(false)
  const clearTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(clearTimer.current), [])
  function onFocus(event: FocusEvent<HTMLDivElement>) {
    const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[role="menuitem"]') : null
    window.clearTimeout(clearTimer.current)
    if (!item) {
      clearTimer.current = window.setTimeout(() => setHighlight(null), pointer.current ? 70 : 0)
      return
    }
    const glide = pointer.current
    setHighlight(current => ({ top: item.offsetTop, height: item.offsetHeight, glide: glide && current !== null }))
  }
  return (
    <MenuPrimitive.Root
      onOpenChange={open => {
        if (open) {
          window.clearTimeout(clearTimer.current)
          setHighlight(null)
        }
      }}
    >
      <MenuPrimitive.Trigger
        render={
          <Button variant="secondary" size="sm" className="w-control-sm px-0" aria-label="More actions">
            <DotsThreeIcon size={17} aria-hidden="true" />
          </Button>
        }
      />
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner className="z-60" align="end" sideOffset={6} collisionPadding={12}>
          <MenuPrimitive.Popup
            className={menuClass}
            onFocus={onFocus}
            onPointerMoveCapture={() => {
              pointer.current = true
            }}
            onKeyDownCapture={() => {
              pointer.current = false
            }}
          >
            <motion.span
              className="pointer-events-none absolute top-0 right-[5px] left-[5px] rounded-[calc(var(--radius-panel)-6px)] bg-surface-muted opacity-0"
              aria-hidden="true"
              initial={false}
              animate={highlight ? { y: highlight.top, height: highlight.height, opacity: 1 } : { opacity: 0 }}
              transition={{ default: highlight?.glide && !reduce ? motionTokens.spring.snappy : still, opacity: { duration: reduce ? 0 : 0.08 } }}
            />
            {actions.map(action => (
              <Fragment key={action.key}>
                {action.separatorBefore && <MenuPrimitive.Separator className="-mx-[5px] my-1 h-px bg-border-subtle" />}
                <MenuPrimitive.Item className={itemClass} disabled={action.disabled} onClick={action.onSelect}>
                  {action.icon}
                  {action.label}
                </MenuPrimitive.Item>
              </Fragment>
            ))}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

function OverviewPanel({ done, open }: { done: number; open: number }) {
  const total = done + open
  return (
    <div className="grid gap-9">
      <div className="max-w-[480px]">
        <Progress value={done} max={total} label={`${done} of ${total} issues done`} showValue />
      </div>
      <div>
        <h3 className={sectionTitle}>Milestones</h3>
        <ol className={listReset}>
          {milestones.map(item => {
            const Icon = milestoneIcons[item.state]
            return (
              <li
                key={item.name}
                className={cn(
                  "grid min-h-12 grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-border-subtle last:border-b-0",
                  "[&>svg]:text-text-muted data-[state=done]:[&>svg]:text-success data-[state=active]:[&>svg]:text-accent",
                  `${phone}grid-cols-[16px_minmax(0,1fr)] ${phone}py-2.5 ${phone}[&>span:last-child]:col-start-2`,
                )}
                data-state={item.state}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{item.name}</span>
                <span className={note}>{item.note}</span>
              </li>
            )
          })}
        </ol>
      </div>
      <div>
        <h3 className={sectionTitle}>Recent activity</h3>
        <ul className={listReset}>
          {activity.map(item => (
            <li
              key={`${item.who}-${item.text}`}
              className={cn(
                "grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border-subtle last:border-b-0",
                `${phone}grid-cols-[auto_minmax(0,1fr)] ${phone}py-2.5 ${phone}[&>span:last-child]:col-start-2 ${phone}[&>span:last-child]:-mt-2`,
              )}
            >
              <Avatar name={people[item.who].name} src={people[item.who].src} size="sm" />
              <p className="m-0 text-text-secondary">
                <strong className="font-medium text-foreground">{people[item.who].name}</strong> {item.text}
              </p>
              <span className={note}>{item.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function IssuesPanel({
  issues,
  closing,
  reduce,
  onComplete,
  onReset,
  register,
}: {
  issues: Issue[]
  closing: string[]
  reduce: boolean
  onComplete: (issue: Issue) => void
  onReset: () => void
  register: (id: string, node: HTMLButtonElement | null) => void
}) {
  const row = rowMotion(reduce)
  return (
    <>
      <ul className={listReset} aria-label="Open issues">
        <AnimatePresence initial={false}>
          {issues.map(issue => {
            const isClosing = closing.includes(issue.id)
            const owner = people[issue.owner]
            return (
              <motion.li
                key={issue.id}
                className="group/issue overflow-x-visible overflow-y-clip border-b border-border-subtle last:border-b-transparent"
                data-fresh={issue.fresh || undefined}
                data-closing={isClosing || undefined}
                {...row}
              >
                <div
                  className={cn(
                    "relative isolate -mx-2.5 grid min-h-[52px] grid-cols-[32px_minmax(0,1fr)_auto_auto] items-center gap-3 px-2.5 py-1",
                    `${phone}grid-cols-[32px_minmax(0,1fr)_auto] ${phone}items-start ${phone}py-2.5`,
                  )}
                >
                  {issue.fresh && <Arrived />}
                  <button
                    ref={node => register(issue.id, node)}
                    type="button"
                    className={cn(
                      "relative -ml-[7px] grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-text-muted",
                      "[transition:color_var(--duration-fast)_var(--ease-standard),background-color_var(--duration-fast)_var(--ease-standard)] motion-reduce:transition-none",
                      "pointer-fine:hover:bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)] pointer-fine:hover:text-foreground",
                      "group-data-[closing]/issue:cursor-default group-data-[closing]/issue:text-success",
                      "group-data-[closing]/issue:pointer-fine:hover:bg-transparent group-data-[closing]/issue:pointer-fine:hover:text-success",
                      `${phone}-mt-1.5`,
                    )}
                    aria-label={`Mark ${issue.id} done`}
                    aria-disabled={isClosing || undefined}
                    onClick={() => onComplete(issue)}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={isClosing ? "done" : "open"}
                        className="grid place-items-center"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: reduce ? 1 : 0.5, transition: quick }}
                        transition={reduce ? still : motionTokens.spring.snappy}
                      >
                        {isClosing ? <CheckCircleIcon size={18} aria-hidden="true" /> : <CircleIcon size={18} aria-hidden="true" />}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                  <span className={cn("flex min-w-0 items-baseline gap-3", `${phone}grid ${phone}gap-0.5`)}>
                    <span className="min-w-[60px] flex-none text-xs text-text-muted">{issue.id}</span>
                    <span
                      className={cn(
                        "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap line-through decoration-transparent",
                        "[transition:color_var(--duration-standard)_var(--ease-standard),text-decoration-color_var(--duration-standard)_var(--ease-standard)] motion-reduce:transition-none",
                        "group-data-[closing]/issue:text-text-muted group-data-[closing]/issue:decoration-current",
                        `${phone}overflow-visible ${phone}whitespace-normal`,
                      )}
                    >
                      {issue.title}
                    </span>
                  </span>
                  <span className={cn("text-xs text-text-muted", `${phone}hidden`)}>{issue.label}</span>
                  <Avatar name={owner.name} src={owner.src} size="sm" />
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
      {issues.length === 0 && (
        <motion.div
          className="grid justify-items-center gap-1 px-4 py-[72px] text-center [&_span]:text-text-muted [&>button]:mt-3.5"
          initial={{ opacity: 0, y: reduce ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: motionTokens.duration.instant } : motionTokens.spring.smooth}
        >
          <CheckCircleIcon className="mb-2 text-success" size={24} aria-hidden="true" />
          <p className="m-0 text-base font-medium">No open issues</p>
          <span>Everything in this project is done.</span>
          <Button variant="secondary" size="sm" onClick={onReset}>
            Restore sample issues
          </Button>
        </motion.div>
      )}
    </>
  )
}

function UpdatesPanel({ updates, reduce }: { updates: Update[]; reduce: boolean }) {
  const row = rowMotion(reduce)
  return (
    <ol className={listReset} aria-label="Project updates">
      <AnimatePresence initial={false}>
        {updates.map(update => {
          const author = people[update.author]
          return (
            <motion.li
              key={update.id}
              className="overflow-x-visible overflow-y-clip border-b border-border-subtle last:border-b-transparent"
              data-fresh={update.fresh || undefined}
              {...row}
            >
              <article className="relative isolate -mx-2.5 grid grid-cols-[auto_minmax(0,1fr)] gap-3.5 px-2.5 py-[18px]">
                {update.fresh && <Arrived />}
                <Avatar name={author.name} src={author.src} size="md" />
                <div>
                  <div className="flex min-h-[22px] flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-medium">{author.name}</span>
                    <span className={note}>{update.date}</span>
                    <Badge size="sm" tone={update.tone} icon={<StatusDot />}>
                      {update.status}
                    </Badge>
                  </div>
                  <p className="m-0 mt-1.5 max-w-[64ch] text-text-secondary text-pretty">{update.body}</p>
                </div>
              </article>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}

function FilesPanel() {
  return (
    <ul className={listReset} aria-label="Project files">
      {files.map(file => {
        const Icon = file.icon
        const owner = people[file.owner]
        return (
          <li
            key={file.name}
            className={cn(
              "grid min-h-14 grid-cols-[16px_minmax(0,1fr)_auto_52px] items-center gap-3.5 border-b border-border-subtle last:border-b-0 [&>svg]:text-text-secondary",
              `${phone}grid-cols-[16px_minmax(0,1fr)_auto]`,
            )}
          >
            <Icon size={16} aria-hidden="true" />
            <span className="grid min-w-0 [&>span:first-child]:overflow-hidden [&>span:first-child]:text-ellipsis [&>span:first-child]:whitespace-nowrap">
              <span>{file.name}</span>
              <span className={note}>
                {file.kind}, {file.size}
              </span>
            </span>
            <Avatar name={owner.name} src={owner.src} size="sm" />
            <span className={cn("text-right text-xs whitespace-nowrap text-text-muted", `${phone}hidden`)}>{file.date}</span>
          </li>
        )
      })}
    </ul>
  )
}

const crumb =
  "m-0 cursor-pointer rounded-lg border-0 bg-transparent px-0.5 py-1 text-text-muted [transition:color_var(--duration-fast)_var(--ease-standard)] pointer-fine:hover:text-foreground motion-reduce:transition-none"

export function PageHeader() {
  const id = useId()
  const reduce = useReducedMotion() ?? false
  const bar = useRef<HTMLDivElement>(null)
  const secondary = useRef<HTMLDivElement>(null)
  const trailing = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const tabList = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const toggles = useRef(new Map<string, HTMLButtonElement>())
  const timers = useRef(new Set<number>())
  const counters = useRef({ issue: 0, update: 0, notice: 0 })
  const [view, setView] = useState<{ section: Section; direction: number }>({ section: "overview", direction: 1 })
  const [condensed, setCondensed] = useState(false)
  const [layout, setLayout] = useState({ measured: false, collapsed: false, animate: false })
  const [following, setFollowing] = useState(false)
  const [archived, setArchived] = useState(false)
  const [sharing, setSharing] = useState<"idle" | "sending" | "sent">("idle")
  const [issues, setIssues] = useState(startingIssues)
  const [closing, setClosing] = useState<string[]>([])
  const [done, setDone] = useState(DONE_AT_START)
  const [updates, setUpdates] = useState(startingUpdates)
  const [notice, setNotice] = useState<Notice | null>(null)

  // Only the header width is observed, so a label that grows (Follow to Following) never folds the button you just pressed.
  // The first measurement applies at once; later width changes fold the actions with a spring.
  useEffect(() => {
    const row = bar.current,
      folded = secondary.current,
      fixed = trailing.current
    if (!row || !folded || !fixed || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      const room = row.clientWidth - folded.offsetWidth - fixed.offsetWidth - 16
      setLayout(current => {
        const collapsed = current.measured && current.collapsed ? room < LEAD_RETURN : room < LEAD_MIN
        return current.measured && current.collapsed === collapsed ? current : { measured: true, collapsed, animate: current.measured }
      })
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(handle => window.clearTimeout(handle))
  }, [])

  useEffect(() => {
    if (!notice) return
    const handle = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(handle)
  }, [notice])

  // Keep the chosen tab in view when the list scrolls sideways on narrow screens.
  useEffect(() => {
    const list = tabList.current
    const tab = list?.querySelector<HTMLElement>('[role="tab"][data-active]')
    if (!list || !tab) return
    const start = tab.offsetLeft - 12
    const end = tab.offsetLeft + tab.offsetWidth + 12 - list.clientWidth
    const behavior = reduce ? "auto" : "smooth"
    if (list.scrollLeft > start) list.scrollTo({ left: start, behavior })
    else if (list.scrollLeft < end) list.scrollTo({ left: end, behavior })
  }, [view.section, reduce])

  function later(run: () => void, delay: number) {
    const handle = window.setTimeout(() => {
      timers.current.delete(handle)
      run()
    }, delay)
    timers.current.add(handle)
  }

  function notify(text: string, tone: Notice["tone"] = "success") {
    counters.current.notice += 1
    setNotice({ key: counters.current.notice, text, tone })
  }

  /** Switching sections while condensed shows the top of the new panel and keeps the compact bar. */
  function selectSection(next: Section, reveal = false) {
    setView(current => (current.section === next ? current : { section: next, direction: order(next) > order(current.section) ? 1 : -1 }))
    const node = scroller.current
    if (node && (reveal || next !== view.section) && node.scrollTop > CONDENSE_AT + 1) node.scrollTop = CONDENSE_AT + 1
  }

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const top = event.currentTarget.scrollTop
    setCondensed(current => (current ? top > EXPAND_AT : top > CONDENSE_AT))
  }

  function backToTop() {
    scroller.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
    titleRef.current?.focus({ preventScroll: true })
  }

  function toggleFollow() {
    const next = !following
    setFollowing(next)
    notify(next ? "Following Checkout redesign" : "Stopped following Checkout redesign", next ? "success" : "neutral")
  }

  function shareUpdate() {
    if (archived || sharing !== "idle") return
    setSharing("sending")
    later(() => {
      const index = counters.current.update++
      const key = `draft-${index}`
      setUpdates(list => [
        { id: key, author: "jasmine", date: "Just now", tone: "success", status: "On track", body: draftUpdates[index % draftUpdates.length], fresh: true },
        ...list,
      ])
      setSharing("sent")
      selectSection("updates", true)
      notify("Update shared with the project team")
      later(() => setSharing("idle"), 1800)
      later(() => setUpdates(list => list.map(item => (item.id === key ? { ...item, fresh: false } : item))), 1800)
    }, 700)
  }

  function createIssue() {
    if (archived) return
    const index = counters.current.issue++
    const issue: Issue = { id: `CHK-${139 + index}`, title: draftIssues[index % draftIssues.length], owner: "jasmine", label: "Triage", fresh: true }
    setIssues(list => [issue, ...list])
    selectSection("issues", true)
    notify(`${issue.id} created and assigned to you`)
    later(() => setIssues(list => list.map(item => (item.id === issue.id ? { ...item, fresh: false } : item))), 1800)
  }

  function completeIssue(issue: Issue) {
    if (closing.includes(issue.id)) return
    const index = issues.findIndex(item => item.id === issue.id)
    const remaining = issues.filter(item => item.id !== issue.id && !closing.includes(item.id))
    const neighbor = remaining[Math.min(index, remaining.length - 1)]
    setClosing(list => [...list, issue.id])
    later(() => {
      const hadFocus = document.activeElement === toggles.current.get(issue.id)
      setIssues(list => list.filter(item => item.id !== issue.id))
      setClosing(list => list.filter(item => item !== issue.id))
      setDone(count => count + 1)
      notify(`${issue.id} marked done`)
      if (hadFocus)
        (neighbor ? toggles.current.get(neighbor.id) : scroller.current?.querySelector<HTMLElement>('[role="tabpanel"]:not([data-hidden])'))?.focus()
    }, 380)
  }

  function resetIssues() {
    setIssues(startingIssues)
    setDone(DONE_AT_START)
    notify("Sample issues restored", "neutral")
  }

  function toggleArchive() {
    const next = !archived
    setArchived(next)
    notify(next ? "Project archived. New issues and updates are paused." : "Project restored", "neutral")
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(PROJECT_URL)
      notify("Link copied")
    } catch {
      notify("Couldn't copy the link. Try again from the address bar.", "error")
    }
  }

  function openCrumb(label: string) {
    notify(`${label} would open here.`, "neutral")
  }

  const status = archived ? { tone: "neutral" as const, label: "Archived" } : { tone: "success" as const, label: "On track" }
  const menuActions: MenuAction[] = [
    ...(layout.collapsed
      ? [
          { key: "follow", label: following ? "Unfollow" : "Follow", icon: following ? <BellSlashIcon {...icon} /> : <BellIcon {...icon} />, onSelect: toggleFollow },
          { key: "share", label: "Share update", icon: <PaperPlaneTiltIcon {...icon} />, onSelect: shareUpdate, disabled: archived || sharing !== "idle" },
        ]
      : []),
    { key: "copy", label: "Copy link", icon: <LinkIcon {...icon} />, onSelect: copyLink, separatorBefore: layout.collapsed },
    {
      key: "archive",
      label: archived ? "Restore project" : "Archive project",
      icon: archived ? <TrayArrowUpIcon {...icon} /> : <ArchiveIcon {...icon} />,
      onSelect: toggleArchive,
    },
  ]

  /** Leaving copy fades fast; arriving copy settles on the smooth spring with a short blur. */
  const swap = (entering: boolean): Transition =>
    reduce
      ? still
      : {
          ...motionTokens.spring.smooth,
          opacity: { duration: entering ? motionTokens.duration.standard : motionTokens.duration.fast, ease: [...motionTokens.ease.standard], delay: entering ? 0.05 : 0 },
          filter: { duration: entering ? motionTokens.duration.standard : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
        }
  const shown = { opacity: 1, y: 0, scale: 1, filter: blur(0) }

  return (
    <TabsPrimitive.Root
      value={view.section}
      onValueChange={value => selectSection(value as Section)}
      render={
        // The frame is the page: a fixed header over a scrolling body. Breakpoints follow the frame width, not the viewport.
        <section
          className="group/frame @container/ph relative mx-auto flex h-[640px] w-[min(100%,980px)] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface font-sans text-sm leading-body tracking-body text-foreground max-[560px]:h-[clamp(560px,calc(100svh-48px),760px)] max-[560px]:rounded-[14px]"
          aria-labelledby={`${id}-title`}
          data-measured={layout.measured || undefined}
        />
      }
    >
      <header className="relative z-1 flex-none bg-surface px-(--pad) pt-4 shadow-[inset_0_-1px_0_var(--border)] [--pad:28px] @max-[559px]/ph:[--pad:18px]">
        <div ref={bar} className="grid min-h-control-sm grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          {/* Breadcrumbs and the compact title share one cell and trade places when the header condenses. */}
          <div className="grid min-w-0 items-center *:min-w-0 *:[grid-area:1/1]">
            <motion.nav
              aria-label="Breadcrumb"
              inert={condensed}
              initial={false}
              animate={condensed ? { opacity: 0, y: -8, filter: blur(motionTokens.blur.subtle) } : shown}
              transition={swap(!condensed)}
            >
              <ol className="m-0 flex min-w-0 list-none items-center gap-1.5 p-0">
                <li className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap text-text-muted @max-[559px]/ph:hidden [&>svg]:flex-none [&>svg]:text-border-strong">
                  <button type="button" className={crumb} onClick={() => openCrumb("Northline")}>
                    Northline
                  </button>
                  <CaretRightIcon size={14} aria-hidden="true" />
                </li>
                <li className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap text-text-muted [&>svg]:flex-none [&>svg]:text-border-strong">
                  <button type="button" className={crumb} onClick={() => openCrumb("Projects")}>
                    Projects
                  </button>
                  <CaretRightIcon size={14} aria-hidden="true" />
                </li>
                <li className="inline-flex min-w-0 flex-initial items-center gap-1.5 whitespace-nowrap text-text-muted">
                  <span className="block min-w-0 overflow-hidden text-ellipsis text-text-secondary" aria-current="page">
                    Checkout redesign
                  </span>
                </li>
              </ol>
            </motion.nav>
            <motion.button
              type="button"
              className="-ml-2 inline-flex max-w-[calc(100%+8px)] cursor-pointer items-center justify-self-start gap-2.5 rounded-lg border-0 bg-transparent px-2 py-[5px] text-left text-foreground [transition:background-color_var(--duration-fast)_var(--ease-standard)] pointer-fine:hover:bg-[color-mix(in_oklab,var(--foreground)_4.5%,transparent)] motion-reduce:transition-none"
              inert={!condensed}
              aria-label="Checkout redesign, back to top"
              onClick={backToTop}
              initial={false}
              animate={condensed ? shown : { opacity: 0, y: 14, filter: blur(motionTokens.blur.soft) }}
              transition={swap(condensed)}
            >
              <span className="min-w-0 overflow-hidden text-base font-medium text-ellipsis whitespace-nowrap">Checkout redesign</span>
              <Badge className="flex-none @max-[559px]/ph:hidden" size="sm" tone={status.tone} icon={<StatusDot />}>
                {status.label}
              </Badge>
            </motion.button>
          </div>

          <div className="flex items-center justify-end">
            {/* Secondary actions fold to the right, under the overflow button, as their slot narrows. Only the right edge clips. */}
            <motion.div
              className={cn(
                "flex flex-none [clip-path:inset(-8px_0_-8px_-8px)]",
                // Before the first measurement, narrow frames already hide the actions that will fold, so nothing flashes on load.
                !layout.measured && "@max-[719px]/ph:w-0! @max-[719px]/ph:opacity-0!",
              )}
              inert={layout.collapsed}
              initial={false}
              animate={layout.collapsed ? { width: 0, opacity: 0 } : { width: "auto", opacity: 1 }}
              transition={
                layout.animate && !reduce
                  ? {
                      width: motionTokens.spring.smooth,
                      opacity: {
                        duration: layout.collapsed ? motionTokens.duration.fast : motionTokens.duration.standard,
                        ease: [...motionTokens.ease.standard],
                        delay: layout.collapsed ? 0.04 : 0.08,
                      },
                    }
                  : still
              }
            >
              <div ref={secondary} className="flex flex-none gap-2 pr-2">
                <Button variant="secondary" size="sm" onClick={toggleFollow}>
                  {following ? (
                    <>
                      <BellRingingIcon {...icon} /> Following
                    </>
                  ) : (
                    <>
                      <BellIcon {...icon} /> Follow
                    </>
                  )}
                </Button>
                <Button variant="secondary" size="sm" loading={sharing === "sending"} disabled={archived} onClick={shareUpdate}>
                  {sharing === "sent" ? (
                    <>
                      <CheckIcon {...icon} /> Shared
                    </>
                  ) : (
                    <>
                      <PaperPlaneTiltIcon {...icon} /> Share update
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
            <div ref={trailing} className="flex flex-none items-center gap-2">
              <OverflowMenu actions={menuActions} reduce={reduce} />
              <Button className="@max-[459px]/ph:w-control-sm @max-[459px]/ph:px-0" size="sm" aria-label="New issue" disabled={archived} onClick={createIssue}>
                <PlusIcon {...icon} />
                <span className="@max-[459px]/ph:hidden">New issue</span>
              </Button>
            </div>
          </div>
        </div>

        <motion.div className="overflow-clip" initial={false} animate={{ height: condensed ? 0 : "auto" }} transition={reduce ? still : motionTokens.spring.smooth}>
          <div className="grid justify-items-start gap-2.5 pt-[18px] pb-5 @max-[559px]/ph:pt-4">
            <motion.div
              className="flex origin-top-left flex-wrap items-center gap-x-3.5 gap-y-2"
              initial={false}
              animate={condensed ? { opacity: 0, y: -10, scale: 0.62, filter: blur(motionTokens.blur.subtle) } : shown}
              transition={swap(!condensed)}
            >
              <h2
                ref={titleRef}
                id={`${id}-title`}
                className="m-0 font-display text-(length:--text-3xl) leading-display font-medium tracking-display focus:outline-none @max-[559px]/ph:text-(length:--text-2xl)"
                tabIndex={-1}
              >
                Checkout redesign
              </h2>
              <Badge tone={status.tone} icon={<StatusDot />}>
                {status.label}
              </Badge>
            </motion.div>
            <motion.div
              className="grid justify-items-start gap-3.5"
              initial={false}
              animate={condensed ? { opacity: 0, y: -6 } : { opacity: 1, y: 0 }}
              transition={swap(!condensed)}
            >
              <p className="m-0 max-w-[60ch] text-text-secondary text-pretty">
                Rebuilding mobile checkout around saved payment methods and a single review step, then rolling it out in stages from October 14.
              </p>
              <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 text-xs text-text-muted [&_strong]:font-medium [&_strong]:text-text-secondary">
                <AvatarGroup members={members} max={4} size="sm" label="Project members" />
                <span>
                  Led by <strong>Emma Collins</strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarBlankIcon size={14} aria-hidden="true" />
                  Target Oct 14
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Tabs bleed to the frame edges so the rule under them spans the page; the first label lines up with the title. */}
        <LayoutGroup id={id}>
          <TabsPrimitive.List
            ref={tabList}
            activateOnFocus
            aria-label="Project sections"
            className="relative mx-[calc(var(--pad)*-1)] mt-0.5 flex gap-0.5 overflow-x-auto overscroll-x-contain px-[calc(var(--pad)-10px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @max-[559px]/ph:pr-[calc(var(--pad)+14px)] @max-[559px]/ph:[mask-image:linear-gradient(to_right,#000_calc(100%_-_28px),transparent)]"
            render={<motion.div layoutScroll />}
          >
            {sections.map(item => {
              const count = item.value === "issues" ? issues.length : item.value === "updates" ? updates.length : item.value === "files" ? files.length : null
              return (
                <TabsPrimitive.Tab
                  key={item.value}
                  value={item.value}
                  className={cn(
                    "group/tab relative inline-flex h-11 flex-none cursor-pointer items-center gap-1.5 border-0 bg-transparent px-2.5 font-medium whitespace-nowrap text-text-secondary [-webkit-tap-highlight-color:transparent]",
                    "[transition:color_var(--duration-fast)_var(--ease-standard)] data-active:text-foreground pointer-fine:hover:text-foreground motion-reduce:transition-none",
                    "before:absolute before:inset-x-0 before:inset-y-2 before:rounded-lg before:bg-[color-mix(in_oklab,var(--foreground)_4.5%,transparent)] before:opacity-0 before:content-['']",
                    "before:[transition:opacity_var(--duration-fast)_var(--ease-standard)] pointer-fine:hover:before:opacity-100 motion-reduce:before:transition-none",
                  )}
                >
                  <span className="relative">{item.label}</span>
                  {count !== null && (
                    // The shared counter renders at display size by default; here it takes the tab's type.
                    <span className="relative text-text-muted tabular-nums group-data-[active]/tab:text-text-secondary [&>span]:[font:inherit] [&>span]:tracking-[inherit] [&>span]:text-inherit">
                      <AnimatedCounter value={count} />
                    </span>
                  )}
                  {view.section === item.value && (
                    <motion.span
                      className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-t-[2px] bg-accent"
                      layoutId="indicator"
                      layoutDependency={view.section}
                      transition={reduce ? still : motionTokens.spring.morph}
                      aria-hidden="true"
                    />
                  )}
                </TabsPrimitive.Tab>
              )
            })}
          </TabsPrimitive.List>
        </LayoutGroup>
      </header>

      <div
        ref={scroller}
        className="relative min-h-0 flex-[1_1_auto] overflow-x-hidden overflow-y-auto overscroll-contain px-(--pad) pt-7 pb-[84px] [scrollbar-color:var(--border-strong)_transparent] [scrollbar-width:thin] [--pad:28px] @max-[559px]/ph:[--pad:18px]"
        onScroll={onScroll}
      >
        <AnimatePresence initial={false} mode="popLayout" custom={view.direction}>
          <TabsPrimitive.Panel
            key={view.section}
            value={view.section}
            keepMounted
            hidden={false}
            className="min-h-[600px] outline-none"
            render={<motion.div custom={view.direction} variants={reduce ? panelFade : panelSlide} initial="enter" animate="center" exit="exit" />}
          >
            {view.section === "overview" && <OverviewPanel done={done} open={issues.length} />}
            {view.section === "issues" && (
              <IssuesPanel
                issues={issues}
                closing={closing}
                reduce={reduce}
                onComplete={completeIssue}
                onReset={resetIssues}
                register={(key, node) => {
                  if (node) toggles.current.set(key, node)
                  else toggles.current.delete(key)
                }}
              />
            )}
            {view.section === "updates" && <UpdatesPanel updates={updates} reduce={reduce} />}
            {view.section === "files" && <FilesPanel />}
          </TabsPrimitive.Panel>
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-3 flex justify-center" aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          {notice && (
            <motion.div
              key={notice.key}
              className="inline-flex max-w-full items-center gap-2 rounded-control border border-border bg-surface-raised px-3.5 py-[9px] text-sm text-foreground shadow-floating [&>svg]:flex-none [&>svg]:text-text-secondary data-[tone=success]:[&>svg]:text-success data-[tone=error]:[&>svg]:text-danger"
              data-tone={notice.tone}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: blur(motionTokens.blur.soft) }}
              animate={{ opacity: 1, y: 0, filter: blur(0) }}
              exit={reduce ? { opacity: 0, transition: still } : { opacity: 0, y: 8, filter: blur(motionTokens.blur.subtle), transition: quick }}
              transition={
                reduce
                  ? { duration: motionTokens.duration.instant }
                  : {
                      ...motionTokens.spring.snappy,
                      opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
                      filter: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
                    }
              }
            >
              {notice.tone === "success" ? <CheckIcon {...icon} /> : notice.tone === "error" ? <WarningCircleIcon {...icon} /> : null}
              <span>{notice.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {notice?.text}
      </p>
    </TabsPrimitive.Root>
  )
}

export default PageHeader
