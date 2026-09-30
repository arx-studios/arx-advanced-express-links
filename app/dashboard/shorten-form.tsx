"use client"

import { useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import type { LinkJson } from "@/server/links/linkJson"
import { CopyButton } from "./copy-button"
import { displayShortUrl } from "@/lib/format"

interface Props {
  onShortened: (link: LinkJson, created: boolean) => void
}

interface ErrorBody {
  error?: string
  issues?: { message: string }[]
}

// Same normalization the server applies, so "https://GitHub.com" and
// "https://github.com/" share one cache entry.
function cacheKey(value: string): string | null {
  try {
    return new URL(value.trim()).toString()
  } catch {
    return null
  }
}

export function ShortenForm({ onShortened }: Props) {
  const [url, setUrl] = useState("")
  const [alias, setAlias] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [showOptions, setShowOptions] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ link: LinkJson; created: boolean } | null>(null)

  // Plain links are deduplicated server-side, so a URL always maps to the same
  // short link: repeat submits are answered here without a request.
  const cache = useRef(new Map<string, LinkJson>())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) return

    const key = cacheKey(url)
    const plain = !alias.trim() && !expiresAt
    const cached = plain && key ? cache.current.get(key) : undefined
    if (cached) {
      setError(null)
      setResult({ link: cached, created: false })
      return
    }

    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          alias: alias.trim() || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      })

      if (res.status === 401) {
        window.location.href = "/signin"
        return
      }
      if (res.status === 429) {
        const wait = res.headers.get("retry-after")
        setError(`You're creating links too fast. Try again${wait ? ` in ${wait}s` : " in a minute"}.`)
        return
      }

      const data: LinkJson & ErrorBody = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.issues?.[0]?.message ?? data.error ?? "Something went wrong")
        return
      }

      const created = res.status === 201
      if (plain && key) cache.current.set(key, data)
      setResult({ link: data, created })
      setUrl("")
      setAlias("")
      setExpiresAt("")
      onShortened(data, created)
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-3xl p-5 md:p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1">
            <span className="sr-only">Long URL</span>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste a long URL…"
              required
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-full px-5 py-3.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/[0.25] focus:bg-white/[0.08] transition-all"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="px-8 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/85 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
          >
            {pending ? "Shortening…" : "Shorten"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowOptions(v => !v)}
          aria-expanded={showOptions}
          className="self-start flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 uppercase tracking-[0.15em] transition-colors"
        >
          More options
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOptions ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        <AnimatePresence initial={false}>
          {showOptions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="grid gap-3 sm:grid-cols-2 pb-1">
                <label className="block">
                  <span className="text-[10px] text-white/35 uppercase tracking-[0.12em] mb-2 block">Custom alias</span>
                  <input
                    value={alias}
                    onChange={e => setAlias(e.target.value)}
                    placeholder="my-link"
                    pattern="[A-Za-z0-9_\-]{3,32}"
                    title="3-32 characters: letters, digits, _ or -"
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/[0.25] focus:bg-white/[0.08] transition-all font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-white/35 uppercase tracking-[0.12em] mb-2 block">Expires</span>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={e => setExpiresAt(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-white/[0.25] focus:bg-white/[0.08] transition-all [color-scheme:dark]"
                  />
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <div aria-live="polite">
        {error && <p className="mt-4 text-red-400/85 text-sm" role="alert">{error}</p>}

        {result && !error && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3">
            <div className="min-w-0">
              <a
                href={result.link.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-white hover:text-white/75 transition-colors break-all"
              >
                {displayShortUrl(result.link.shortUrl)}
              </a>
              {!result.created && (
                <p className="text-white/35 text-xs mt-1">You already shortened this URL, here&apos;s your existing link.</p>
              )}
            </div>
            <CopyButton text={result.link.shortUrl} label />
          </div>
        )}
      </div>
    </div>
  )
}
