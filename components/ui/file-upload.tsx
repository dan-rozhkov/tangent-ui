"use client"

import { useEffect, useId, useRef, useState } from "react"
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type HTMLMotionProps,
  type MotionProps,
  type TargetAndTransition,
  type Transition,
} from "motion/react"
import { File, FileArchive, FileImage, FileText, RotateCw, UploadCloud, X } from "lucide-react"

import { motionTokens } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/lib/reduced-motion"

export type FileUploadItem = { id: string; file: File; error?: string }

export interface FileUploadProps {
  accept?: string
  disabled?: boolean
  label?: string
  description?: string
  multiple?: boolean
  maxSize?: number
  value?: FileUploadItem[]
  onChange?: (files: FileUploadItem[]) => void
  /** Uploads each accepted file. Report progress from 0 to 100, resolve when done, or reject to mark the file as failed. Removing a file aborts its signal. */
  onUpload?: (file: File, options: { onProgress: (percent: number) => void; signal: AbortSignal }) => Promise<void>
}

type Upload = { status: "uploading" | "done" | "failed"; progress: number }

const enter: Transition = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
const exitFast: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }
const instant: Transition = { duration: 0 }
const textIn: TargetAndTransition = { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }
const textOut: TargetAndTransition = { opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: exitFast }
const iconIn: TargetAndTransition = { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }
const shown: TargetAndTransition = { opacity: 1, y: "0em", scale: 1, filter: "blur(0px)" }
const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: motionTokens.duration.instant } }

/* Quick press, spring release: the resting transition carries the spring back, the pressed state swaps in a short one. */
const iconButton = cn(
  "grid size-[26px] flex-[0_0_auto] cursor-pointer place-items-center rounded-pill border-0 bg-transparent",
  "[transition:scale_var(--duration-spring)_var(--ease-spring),background-color_var(--duration-fast)_var(--ease-standard),color_var(--duration-fast)_var(--ease-standard)]",
  "active:scale-96 active:duration-120 active:ease-standard pointer-fine:hover:bg-surface pointer-fine:hover:text-foreground",
  "motion-reduce:[transition:none] motion-reduce:active:scale-100",
)

function FileTypeIcon({ file }: { file: File }) {
  const props = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const
  if (file.type.startsWith("image/")) return <FileImage {...props} />
  if (file.type.startsWith("text/")) return <FileText {...props} />
  if (file.type.includes("zip") || file.name.endsWith(".gz")) return <FileArchive {...props} />
  return <File {...props} />
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb >= 10 ? Math.round(mb) : Number(mb.toFixed(1))} MB`
}

/** Outgoing copies are hidden from assistive tech while they fade, so live text reads only the current message. */
function Swap(props: HTMLMotionProps<"span">) {
  const present = useIsPresent()
  return <motion.span {...props} aria-hidden={present ? props["aria-hidden"] : true} />
}

function FileRow({
  item,
  upload,
  reduce,
  onRemove,
  onRetry,
  removeRef,
}: {
  item: FileUploadItem
  upload?: Upload
  reduce: boolean | null
  onRemove: () => void
  onRetry: () => void
  removeRef: (node: HTMLButtonElement | null) => void
}) {
  const status = upload?.status
  // A finished upload keeps its bar until the spring reaches the end, so 100% is seen before the label turns to Uploaded.
  const [filled, setFilled] = useState(status !== "uploading")
  const [seen, setSeen] = useState(status)
  if (seen !== status) {
    setSeen(status)
    if (status === "uploading") setFilled(false)
  }
  const shownStatus = status === "done" && !filled && !reduce ? "uploading" : status
  const phase = item.error ? "invalid" : (shownStatus ?? "ready")
  // One spring drives the bar and the counted percentage, so both always agree.
  const progress = useMotionValue(upload?.progress ?? 0)
  // The fill slides in from the left instead of scaling, so its rounded end keeps its shape at every value.
  const x = useTransform(progress, (latest) => `${Math.min(Math.max(latest, 0), 100) - 100}%`)
  const percent = useTransform(progress, (latest) => `${Math.round(Math.min(Math.max(latest, 0), 100))}%`)
  const target = status === "done" ? 100 : (upload?.progress ?? 0)
  useEffect(() => {
    // Every upload starts from an empty bar, even a retry that failed halfway.
    if (reduce || (status === "uploading" && target === 0)) {
      progress.jump(target)
      return
    }
    const controls = animate(progress, target, {
      ...motionTokens.spring.smooth,
      onComplete: status === "done" ? () => setFilled(true) : undefined,
    })
    return () => controls.stop()
  }, [status, target, progress, reduce])
  // The label turns as soon as the count reads 100%, without waiting out the spring's last fraction of a pixel.
  useMotionValueEvent(progress, "change", (latest) => {
    if (status === "done" && latest >= 99.5) setFilled(true)
  })
  const swap: MotionProps = {
    initial: reduce ? { opacity: 0 } : textIn,
    animate: shown,
    exit: reduce ? fadeOut : textOut,
    transition: reduce ? instant : enter,
  }
  return (
    /* The gap lives inside the clipped row, so a collapsing row reaches zero height instead of stopping at its padding. */
    <div className="mt-1.5 flex min-w-0 items-center gap-3 rounded-control border border-border-subtle bg-surface-muted py-2.5 pr-2.5 pl-3">
      <span className="grid size-6 flex-[0_0_auto] place-items-center text-text-secondary">
        <FileTypeIcon file={item.file} />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <strong className="truncate text-(length:--text-sm) leading-body font-medium" title={item.file.name}>
          {item.file.name}
        </strong>
        <span className="flex min-w-0 text-(length:--text-xs) leading-body whitespace-nowrap text-text-muted tabular-nums">
          {formatSize(item.file.size)}
          {shownStatus ? (
            <>
              <span className="px-[5px]" aria-hidden="true">
                ·
              </span>
              <span className="relative inline-block">
                <AnimatePresence mode="popLayout" initial={false}>
                  <Swap key={shownStatus} className={cn("block", shownStatus === "failed" && "text-danger")} {...swap}>
                    {shownStatus === "uploading" ? (
                      <>
                        Uploading <motion.span className="inline-block min-w-[4ch]">{percent}</motion.span>
                      </>
                    ) : shownStatus === "done" ? (
                      "Uploaded"
                    ) : (
                      "Upload failed"
                    )}
                  </Swap>
                </AnimatePresence>
              </span>
            </>
          ) : null}
        </span>
        {item.error && <span className="text-(length:--text-xs) leading-body text-danger">{item.error}</span>}
        {/* The bar fills on a spring, then folds away once the file lands. */}
        <AnimatePresence initial={false}>
          {shownStatus === "uploading" && (
            <motion.span
              key="bar"
              className="block"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={
                reduce
                  ? fadeOut
                  : {
                      height: 0,
                      opacity: 0,
                      transition: { height: { ...motionTokens.spring.smooth, delay: 0.24 }, opacity: { ...exitFast, delay: 0.24 } },
                    }
              }
              transition={reduce ? instant : { height: motionTokens.spring.smooth, opacity: enter }}
            >
              <span className="mt-[5px] mb-px block h-[3px] overflow-hidden rounded-[99px] bg-border">
                <motion.span className="block size-full rounded-[inherit] bg-accent" style={{ x }} />
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="relative grid size-[26px] flex-[0_0_auto] place-items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {(phase === "ready" || phase === "done") && (
            <motion.span
              key="ready"
              className="grid size-[22px] place-items-center text-success"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={fadeOut}
              transition={reduce ? instant : motionTokens.spring.snappy}
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <motion.path
                  d="M4 12.5l5 5L20 6.5"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ ...enter, delay: 0.08 }}
                />
              </svg>
              <span className="sr-only">{phase === "done" ? "Uploaded" : "Ready"}</span>
            </motion.span>
          )}
          {/* The wrapper carries the entrance, so the button's own press scale never competes with it. */}
          {phase === "failed" && (
            <motion.span
              key="retry"
              className="grid place-items-center"
              initial={reduce ? { opacity: 0 } : iconIn}
              animate={shown}
              exit={reduce ? fadeOut : { ...iconIn, transition: exitFast }}
              transition={reduce ? instant : motionTokens.spring.snappy}
            >
              <button type="button" className={cn(iconButton, "text-text-secondary")} aria-label={`Retry ${item.file.name}`} onClick={onRetry}>
                <RotateCw size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <button ref={removeRef} type="button" className={cn(iconButton, "text-text-muted")} aria-label={`Remove ${item.file.name}`} onClick={onRemove}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

export function FileUpload({
  accept,
  disabled = false,
  label = "Upload files",
  description = "Drop files here or browse from your device.",
  multiple = true,
  maxSize,
  value,
  onChange,
  onUpload,
}: FileUploadProps) {
  const inputId = useId()
  const reduce = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropzoneRef = useRef<HTMLDivElement>(null)
  const [internalFiles, setInternalFiles] = useState<FileUploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState("")
  const [uploads, setUploads] = useState<Record<string, Upload>>({})
  const dragDepth = useRef(0)
  const nextId = useRef(0)
  const controllers = useRef(new Map<string, AbortController>())
  const removeRefs = useRef(new Map<string, HTMLButtonElement>())
  const files = value ?? internalFiles

  useEffect(() => {
    const active = controllers.current
    return () => active.forEach((controller) => controller.abort())
  }, [])

  function update(next: FileUploadItem[]) {
    if (value === undefined) setInternalFiles(next)
    onChange?.(next)
  }

  function startUpload(item: FileUploadItem) {
    if (!onUpload) return
    controllers.current.get(item.id)?.abort()
    const controller = new AbortController()
    controllers.current.set(item.id, controller)
    const set = (next: (current?: Upload) => Upload) =>
      setUploads((current) => ({ ...current, [item.id]: next(current[item.id]) }))
    set(() => ({ status: "uploading", progress: 0 }))
    onUpload(item.file, {
      signal: controller.signal,
      onProgress: (percent) => {
        if (!controller.signal.aborted)
          set((current) => ({ status: "uploading", progress: Math.min(Math.max(percent, current?.progress ?? 0), 100) }))
      },
    })
      .then(
        () => {
          if (controller.signal.aborted) return
          set(() => ({ status: "done", progress: 100 }))
          setStatus(`${item.file.name} uploaded.`)
        },
        () => {
          if (controller.signal.aborted) return
          set((current) => ({ status: "failed", progress: current?.progress ?? 0 }))
          setStatus(`${item.file.name} could not be uploaded.`)
        },
      )
      .finally(() => {
        if (controllers.current.get(item.id) === controller) controllers.current.delete(item.id)
      })
  }

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).slice(0, multiple ? undefined : 1)
    const acceptedTypes =
      accept
        ?.split(",")
        .map((type) => type.trim().toLowerCase())
        .filter(Boolean) ?? []
    const matchesAccept = (file: File) =>
      acceptedTypes.length === 0 ||
      acceptedTypes.some((type) =>
        type.startsWith(".")
          ? file.name.toLowerCase().endsWith(type)
          : type.endsWith("/*")
            ? file.type.startsWith(type.slice(0, -1))
            : file.type === type,
      )
    const accepted = incoming.map((file) => ({
      id: `${file.name}-${file.lastModified}-${nextId.current++}`,
      file,
      error: !matchesAccept(file)
        ? "This file type is not accepted."
        : maxSize && file.size > maxSize
          ? `File is larger than ${formatSize(maxSize)}.`
          : undefined,
    }))
    if (!multiple) controllers.current.forEach((controller) => controller.abort())
    update(multiple ? [...files, ...accepted] : accepted)
    const invalidCount = accepted.filter((item) => item.error).length
    const validCount = accepted.length - invalidCount
    const added = `${validCount} file${validCount === 1 ? "" : "s"} added.`
    const attention = `${invalidCount} file${invalidCount === 1 ? " needs" : "s need"} attention.`
    setStatus(!invalidCount ? added : validCount ? `${added} ${attention}` : attention)
    accepted.filter((item) => !item.error).forEach(startUpload)
  }

  function removeFile(item: FileUploadItem) {
    controllers.current.get(item.id)?.abort()
    controllers.current.delete(item.id)
    // Keep keyboard focus in the list: the next row's remove button, else the previous one, else the dropzone.
    const index = files.findIndex((file) => file.id === item.id)
    const neighbor = files[index + 1] ?? files[index - 1]
    update(files.filter((file) => file.id !== item.id))
    setStatus(`${item.file.name} removed.`)
    requestAnimationFrame(() => (neighbor ? removeRefs.current.get(neighbor.id) : dropzoneRef.current)?.focus())
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files)
    event.target.value = ""
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (!disabled && event.dataTransfer.files.length) addFiles(event.dataTransfer.files)
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!disabled) {
      dragDepth.current += 1
      setDragging(true)
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      inputRef.current?.click()
    }
  }

  const height: Transition = reduce ? instant : { height: motionTokens.spring.smooth, opacity: enter }
  return (
    <div className="grid w-full min-w-0 text-foreground">
      <input
        ref={inputRef}
        id={inputId}
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleInput}
      />
      {/* A full-width drop target: press feedback is color only, never a scale. */}
      <div
        ref={dropzoneRef}
        className={cn(
          "group/drop flex min-h-[92px] cursor-pointer items-center gap-3 rounded-panel border border-dashed border-border-strong bg-surface p-4",
          "transition-[border-color,background-color] duration-240 ease-standard motion-reduce:transition-none",
          "data-dragging:border-accent data-dragging:bg-accent-subtle",
          "not-aria-disabled:active:border-accent not-aria-disabled:active:bg-accent-subtle pointer-fine:not-aria-disabled:hover:border-accent pointer-fine:not-aria-disabled:hover:bg-accent-subtle",
          "aria-disabled:cursor-not-allowed aria-disabled:opacity-52",
        )}
        data-dragging={dragging || undefined}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby={`${inputId}-description`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* The cloud lifts toward the file while it hovers over the drop target. */}
        <span className="grid size-6 flex-[0_0_auto] place-items-center text-accent-strong transition-[translate] duration-(--duration-spring) ease-spring group-data-dragging/drop:-translate-y-[3px] motion-reduce:transition-none motion-reduce:group-data-dragging/drop:translate-y-0">
          <UploadCloud size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        {/* While a file hovers over the target the label says what releasing it will do. */}
        <span className="grid min-w-0 flex-1 gap-[3px]">
          <strong className="relative block min-w-0 text-(length:--text-sm) leading-body font-medium">
            <AnimatePresence mode="popLayout" initial={false}>
              <Swap
                key={dragging ? "drop" : "idle"}
                className="block"
                initial={reduce ? { opacity: 0 } : textIn}
                animate={shown}
                exit={reduce ? fadeOut : textOut}
                transition={reduce ? instant : enter}
              >
                {dragging ? `Drop to add ${multiple ? "files" : "a file"}` : label}
              </Swap>
            </AnimatePresence>
          </strong>
          <span id={`${inputId}-description`} className="text-(length:--text-xs) leading-body wrap-anywhere text-text-muted">
            {description}
          </span>
        </span>
        <span className="flex-[0_0_auto] text-(length:--text-xs) font-medium text-accent-strong">Browse</span>
      </div>
      {/* The live region stays mounted; its frame opens on the first message and each new message rises in. */}
      <motion.div className="overflow-hidden" initial={false} animate={{ height: status ? "auto" : 0 }} transition={height}>
        <p className="relative m-0 min-h-4 pt-2 text-(length:--text-xs) leading-body text-text-muted" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="popLayout" initial={false}>
            {status ? (
              <Swap
                key={status}
                className="block"
                initial={reduce ? { opacity: 0 } : textIn}
                animate={shown}
                exit={reduce ? fadeOut : textOut}
                transition={reduce ? instant : enter}
              >
                {status}
              </Swap>
            ) : null}
          </AnimatePresence>
        </p>
      </motion.div>
      {/* Rows open and close their own height, so the list closes the gap when a file is removed. */}
      <motion.ul
        className="m-0 grid list-none p-0"
        aria-label="Selected files"
        aria-hidden={files.length === 0 ? true : undefined}
        initial={false}
        animate={{ paddingTop: files.length ? 6 : 0 }}
        transition={reduce ? instant : motionTokens.spring.smooth}
      >
        <AnimatePresence initial={false}>
          {files.map((item) => (
            <motion.li
              key={item.id}
              className="overflow-hidden"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduce ? fadeOut : { height: 0, opacity: 0, transition: { height: motionTokens.spring.smooth, opacity: exitFast } }}
              transition={height}
            >
              <FileRow
                item={item}
                upload={uploads[item.id]}
                reduce={reduce}
                onRemove={() => removeFile(item)}
                onRetry={() => startUpload(item)}
                removeRef={(node) => {
                  if (node) removeRefs.current.set(item.id, node)
                  else removeRefs.current.delete(item.id)
                }}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  )
}

export default FileUpload
