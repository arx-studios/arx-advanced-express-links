"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import type { LinkJson } from "@/server/links/linkJson"
import { displayShortUrl, isExpired, relativeTime } from "@/lib/format"
import { CopyButton } from "./copy-button"

interface Props {
  link: LinkJson
  highlighted: boolean
  onDeleted: (code: string) => void
}

export function LinkRow({ link, highlighted, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/links/${encodeURIComponent(link.code)}`, { method: "DELETE" })
      if (res.status === 401) {
        window.location.href = "/signin"
        return
      }
      // 404 means it's already gone, which is what the user wanted.
      if (res.ok || res.status === 404) {
        onDeleted(link.code)
        return
      }
      setError("Couldn't delete. Try again.")
    } catch {
      setError("Couldn't reach the server.")
    }
    setDeleting(false)
    setConfirming(false)
  }

  const expired = isExpired(link.expiresAt)

  return (
    <li
      className={`group flex flex-col md:flex-row md:items-center gap-3 md:gap-6 px-5 py-4 rounded-2xl border transition-colors duration-700 ${highlighted ? "bg-white/[0.09] border-white/[0.22]" : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={link.shortUrl}
            target="_blank"
            rel="noreferrer"
            className={`font-mono text-sm md:text-base hover:text-white/70 transition-colors ${expired ? "text-white/40 line-through" : "text-white"}`}
          >
            {displayShortUrl(link.shortUrl)}
          </a>
          {link.expiresAt && (
            <span
              suppressHydrationWarning
              className={`text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${expired ? "text-red-300/70 border-red-300/20 bg-red-400/[0.06]" : "text-white/45 border-white/[0.12] bg-white/[0.04]"}`}
            >
              {expired ? "Expired" : `Expires ${relativeTime(link.expiresAt)}`}
            </span>
          )}
        </div>
        <p className="text-white/35 text-xs mt-1 truncate" title={link.longUrl}>
          {link.longUrl}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-white/40 shrink-0">
        <span className="whitespace-nowrap">
          <span className="text-white/80 text-sm font-medium tabular-nums">{link.clickCount.toLocaleString()}</span>{" "}
          {link.clickCount === 1 ? "click" : "clicks"}
        </span>
        <span className="whitespace-nowrap" suppressHydrationWarning title={new Date(link.createdAt).toLocaleString()}>
          {relativeTime(link.createdAt)}
        </span>

        <div className="flex items-center gap-2 ml-auto md:ml-0">
          {confirming ? (
            <>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3.5 py-2 rounded-full text-xs font-medium text-red-300 bg-red-400/[0.1] border border-red-300/20 hover:bg-red-400/[0.18] transition-all disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="px-3.5 py-2 rounded-full text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <CopyButton text={link.shortUrl} />
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label={`Delete ${link.code}`}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.12] text-white/45 hover:text-red-300 hover:border-red-300/30 hover:bg-red-400/[0.08] transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-red-400/85 text-xs md:basis-full" role="alert">{error}</p>}
    </li>
  )
}
