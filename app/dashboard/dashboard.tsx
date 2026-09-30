"use client"

import { useEffect, useState } from "react"
import { Link2 } from "lucide-react"
import type { LinkJson } from "@/server/links/linkJson"
import { LinkRow } from "./link-row"
import { ShortenForm } from "./shorten-form"

interface Props {
  initialLinks: LinkJson[]
  initialCursor: string | null
}

export function Dashboard({ initialLinks, initialCursor }: Props) {
  const [links, setLinks] = useState(initialLinks)
  const [cursor, setCursor] = useState(initialCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [highlighted, setHighlighted] = useState<string | null>(null)

  useEffect(() => {
    if (!highlighted) return
    const timer = setTimeout(() => setHighlighted(null), 2000)
    return () => clearTimeout(timer)
  }, [highlighted])

  const handleShortened = (link: LinkJson) => {
    // New links go on top. An existing link (dedupe) stays where it is if it's
    // already on screen, and is highlighted either way.
    setLinks(prev => (prev.some(l => l.code === link.code) ? prev : [link, ...prev]))
    setHighlighted(link.code)
  }

  const handleDeleted = (code: string) => {
    setLinks(prev => prev.filter(l => l.code !== code))
  }

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/links?cursor=${cursor}`)
      if (res.status === 401) {
        window.location.href = "/signin"
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const page: { links: LinkJson[]; nextCursor: string | null } = await res.json()
      setLinks(prev => {
        const seen = new Set(prev.map(l => l.code))
        return [...prev, ...page.links.filter(l => !seen.has(l.code))]
      })
      setCursor(page.nextCursor)
    } catch {
      setLoadError("Couldn't load more links. Try again.")
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <ShortenForm onShortened={handleShortened} />

      <section className="flex flex-col gap-4" aria-labelledby="your-links">
        <div className="flex items-center gap-4">
          <h2 id="your-links" className="text-white/35 text-xs uppercase tracking-[0.2em]">Your links</h2>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        {links.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center py-16 bg-white/[0.02] border border-dashed border-white/[0.1] rounded-3xl">
            <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center">
              <Link2 className="w-5 h-5 text-white/45" aria-hidden="true" />
            </div>
            <p className="text-white/70 font-medium">No links yet</p>
            <p className="text-white/35 text-sm">Paste a URL above to create your first short link.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {links.map(link => (
              <LinkRow
                key={link.code}
                link={link}
                highlighted={highlighted === link.code}
                onDeleted={handleDeleted}
              />
            ))}
          </ul>
        )}

        {cursor && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="self-center mt-2 px-6 py-2.5 rounded-full bg-white/[0.05] border border-white/[0.12] text-white/60 text-sm hover:text-white hover:bg-white/[0.1] transition-all disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
        {loadError && <p className="self-center text-red-400/85 text-sm" role="alert">{loadError}</p>}
      </section>
    </div>
  )
}
