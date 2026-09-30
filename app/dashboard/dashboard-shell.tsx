import Link from "next/link"
import { Footer } from "@/components/footer"
import { SignOutButton } from "@/components/sign-out-button"
import type { LinkJson } from "@/server/links/linkJson"
import { Dashboard } from "./dashboard"

interface Props {
  email: string | null
  initialLinks: LinkJson[]
  initialCursor: string | null
}

export function DashboardShell({ email, initialLinks, initialCursor }: Props) {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Static glow instead of the WebGL shader: this page stays open, so it should stay cheap. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,255,255,0.08),transparent_70%)]"
      />

      <header className="sticky top-0 z-20 w-full h-16 flex items-center justify-between px-6 md:px-10 bg-black/40 backdrop-blur-md border-b border-white/[0.08]">
        <Link
          href="/dashboard"
          className="text-white font-semibold tracking-[0.25em] uppercase text-sm hover:text-white/70 transition-colors duration-200"
        >
          axl
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-white/40 text-xs truncate max-w-[16rem]">
            {email ?? "Signed in"}
          </span>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <div className="mb-8 md:mb-10">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tighter text-white leading-none">
            Shorten a link
          </h1>
          <p className="text-white/40 text-sm mt-3">
            Paste a URL to get a short link you can share anywhere.
          </p>
        </div>

        <Dashboard initialLinks={initialLinks} initialCursor={initialCursor} />
      </main>

      <Footer />
    </div>
  )
}
