"use client"

import { TreeView, type TreeNode } from "@/components/ui/tree-view"

const files: TreeNode[] = [
  {
    id: "app",
    label: "app",
    children: [
      { id: "layout", label: "layout.tsx" },
      { id: "page", label: "page.tsx" },
      { id: "globals", label: "globals.css" },
      {
        id: "settings",
        label: "settings",
        children: [
          { id: "settings-page", label: "page.tsx" },
          { id: "settings-form", label: "profile-form.tsx" },
        ],
      },
    ],
  },
  {
    id: "components",
    label: "components",
    children: [
      { id: "button", label: "button.tsx" },
      { id: "dialog", label: "dialog.tsx" },
      { id: "tabs", label: "tabs.tsx" },
    ],
  },
  { id: "public", label: "public", children: [{ id: "logo", label: "logo.svg" }] },
  { id: "package", label: "package.json" },
  { id: "readme", label: "README.md" },
]

export default function Demo() {
  return (
    <div className="w-full max-w-xs">
      <TreeView nodes={files} defaultExpandedIds={["app", "settings"]} />
    </div>
  )
}
