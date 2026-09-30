"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"

export function CopyButton({ text, label = false }: { text: string; label?: boolean }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Clipboard can be blocked (permissions, insecure context); the link is still selectable.
    }
  }

  const Icon = copied ? Check : Copy
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy link"}
      className={`shrink-0 flex items-center justify-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.12] text-white/60 hover:text-white hover:bg-white/[0.12] hover:border-white/[0.22] transition-all ${label ? "px-4 py-2 text-xs font-medium" : "w-9 h-9"}`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {label && (copied ? "Copied" : "Copy")}
    </button>
  )
}
