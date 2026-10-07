"use client"

import { useState } from "react"
import { ArchiveIcon, ArrowUUpLeftIcon, ClockIcon, EnvelopeOpenIcon } from "@phosphor-icons/react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { SwipeActions, SwipeActionsRow } from "@/components/ui/swipe-actions"
import { avatar, person, type PersonId } from "@/lib/media"

type Message = { id: string; from: PersonId; subject: string; preview: string; time: string }

const inbox: Message[] = [
  {
    id: "m1",
    from: "emma-collins",
    subject: "Checkout review",
    preview: "Left a few notes on the payment step.",
    time: "9:41",
  },
  {
    id: "m2",
    from: "marcus-johnson",
    subject: "Release notes",
    preview: "Draft is ready for a final read.",
    time: "9:12",
  },
  {
    id: "m3",
    from: "jasmine-brooks",
    subject: "Design crit on Friday",
    preview: "Bring the onboarding flow if you can.",
    time: "Yesterday",
  },
  {
    id: "m4",
    from: "olivia-bennett",
    subject: "Staging is back up",
    preview: "Deploys are unblocked again.",
    time: "Yesterday",
  },
]

export default function Demo() {
  const [messages, setMessages] = useState(inbox)
  const [unread, setUnread] = useState<Set<string>>(() => new Set(["m1", "m3"]))
  const remove = (id: string) => setMessages((current) => current.filter((message) => message.id !== id))
  const toggleUnread = (id: string) =>
    setUnread((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="grid w-full max-w-md gap-3">
      <SwipeActions label="Inbox" className="[--swipe-actions-inset:4rem]">
        {messages.map((message) => {
          const sender = person(message.from)
          const isUnread = unread.has(message.id)
          return (
            <SwipeActionsRow
              key={message.id}
              label={message.subject}
              leading={[
                {
                  label: isUnread ? "Read" : "Unread",
                  icon: <EnvelopeOpenIcon size={18} />,
                  tone: "accent",
                  keepRow: true,
                  onSelect: () => toggleUnread(message.id),
                },
              ]}
              trailing={[
                { label: "Snooze", icon: <ClockIcon size={18} />, onSelect: () => remove(message.id) },
                {
                  label: "Archive",
                  icon: <ArchiveIcon size={18} />,
                  tone: "danger",
                  onSelect: () => remove(message.id),
                },
              ]}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={avatar(message.from)} name={sender.name} />
                <div className="grid min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{sender.name}</span>
                    <span className="flex-none text-xs text-text-muted">{message.time}</span>
                  </div>
                  <span className="flex items-center gap-1.5 truncate text-sm">
                    {isUnread && <span className="size-1.5 flex-none rounded-pill bg-accent" aria-label="Unread" />}
                    <span className="truncate">{message.subject}</span>
                  </span>
                  <span className="truncate text-sm text-text-secondary">{message.preview}</span>
                </div>
              </div>
            </SwipeActionsRow>
          )
        })}
      </SwipeActions>
      {messages.length < inbox.length && (
        <Button variant="ghost" size="sm" className="justify-self-center" onClick={() => setMessages(inbox)}>
          <ArrowUUpLeftIcon size={16} aria-hidden="true" />
          Restore messages
        </Button>
      )}
    </div>
  )
}
