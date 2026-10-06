"use client"

import { FileUpload } from "@/components/ui/file-upload"

const steps = [6, 14, 23, 35, 48, 57, 69, 78, 88, 96, 100]

/** A stand-in upload: reports fixed progress steps on a timer and honours the abort signal. Files with "fail" in the name stop halfway. */
function simulateUpload(file: File, onProgress: (percent: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const fails = file.name.toLowerCase().includes("fail")
    let step = 0
    const timer = window.setInterval(() => {
      const percent = steps[step++]
      onProgress(percent)
      if (fails && percent >= 48) {
        window.clearInterval(timer)
        reject(new Error("Upload failed"))
      } else if (percent >= 100) {
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
      <FileUpload
        accept="image/*,.pdf"
        maxSize={10 * 1024 * 1024}
        onUpload={(file, { onProgress, signal }) => simulateUpload(file, onProgress, signal)}
      />
    </div>
  )
}
