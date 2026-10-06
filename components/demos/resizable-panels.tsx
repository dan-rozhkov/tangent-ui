"use client"

import { ResizablePanel, ResizablePanels } from "@/components/ui/resizable-panels"

const folders = ["Inbox", "Drafts", "Sent", "Archive", "Trash"]
const messages = [
  ["Maya Collins", "Checkout redesign is live"],
  ["Leo Martin", "Notes from Tuesday's review"],
  ["Priya Shah", "Invoice 2041 is ready"],
  ["Tomas Berg", "Can we move the sync?"],
  ["Ines Duarte", "New Lisbon photos"],
]

export default function Demo() {
  return (
    <div className="h-[360px] w-full max-w-3xl overflow-hidden rounded-panel border border-border bg-surface">
      <ResizablePanels label="Mail">
        <ResizablePanel id="folders" label="Folders" defaultSize={22} minSize={140} collapsible>
          <ul className="m-0 grid list-none gap-0.5 p-2">
            {folders.map(folder => (
              <li key={folder} className="truncate rounded-control px-3 py-2 text-sm text-text-secondary">
                {folder}
              </li>
            ))}
          </ul>
        </ResizablePanel>
        <ResizablePanel id="messages" label="Messages" defaultSize={38} minSize={180}>
          <ul className="m-0 grid list-none p-2">
            {messages.map(([sender, subject]) => (
              <li key={subject} className="grid gap-0.5 rounded-control px-3 py-2">
                <span className="truncate text-sm font-medium text-foreground">{sender}</span>
                <span className="truncate text-xs text-text-secondary">{subject}</span>
              </li>
            ))}
          </ul>
        </ResizablePanel>
        <ResizablePanel id="reader" label="Reader" defaultSize={40} minSize={200}>
          <div className="grid content-start gap-2 p-5">
            <h3 className="m-0 text-sm font-medium text-foreground">Checkout redesign is live</h3>
            <p className="m-0 text-sm text-text-secondary">
              The new flow shipped this morning. Drag the dividers to give the reader more room, or press Enter on one to hide the pane beside it.
            </p>
          </div>
        </ResizablePanel>
      </ResizablePanels>
    </div>
  )
}
