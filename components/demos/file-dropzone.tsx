"use client"

import { FileDropzone } from "@/components/ui/file-dropzone"

/** A stand-in upload: reports progress on a timer and honours the abort signal, so progress, cancel and retry all show. */
function simulateUpload(onProgress: (percent: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let percent = 0
    const timer = window.setInterval(() => {
      percent = Math.min(100, percent + 8 + Math.random() * 14)
      onProgress(percent)
      if (percent >= 100) {
        window.clearInterval(timer)
        resolve()
      }
    }, 220)
    signal.addEventListener("abort", () => {
      window.clearInterval(timer)
      reject(new Error("Upload cancelled"))
    })
  })
}

export default function Demo() {
  return (
    <div className="w-full max-w-md">
      <FileDropzone
        accept=".pdf,image/*"
        maxFiles={3}
        maxSize={10 * 1024 * 1024}
        onUpload={async (_item, { onProgress, signal }) => simulateUpload(onProgress, signal)}
      />
    </div>
  )
}
