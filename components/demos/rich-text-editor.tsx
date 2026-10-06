"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { RichTextEditor, type RichTextValue } from "@/components/ui/rich-text-editor"

export default function Demo() {
  const [doc, setDoc] = useState<RichTextValue | null>(null)
  const [published, setPublished] = useState<string | null>(null)

  return (
    <div className="grid w-full max-w-xl gap-4">
      <RichTextEditor
        aria-label="Post body"
        placeholder="Write your update"
        defaultMarkdown={"# Release notes\n\n- Faster search\n- New **dark** theme"}
        onChange={setDoc}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-(length:--text-xs) text-text-muted">Select text to format it, or type / for blocks</span>
        <Button size="sm" disabled={!doc || doc.empty} onClick={() => setPublished(doc!.markdown)}>
          Publish
        </Button>
      </div>
      {published !== null && (
        <pre className="overflow-x-auto rounded-control border border-border bg-surface-muted p-3 font-mono text-(length:--text-xs) whitespace-pre-wrap text-text-secondary">
          {published}
        </pre>
      )}
    </div>
  )
}
