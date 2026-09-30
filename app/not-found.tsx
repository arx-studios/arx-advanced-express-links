import Link from "next/link"

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,255,255,0.08),transparent_70%)]">
      <div className="w-full max-w-md text-center bg-white/[0.04] border border-white/[0.08] rounded-3xl px-8 py-10">
        <p className="text-white/40 text-xs font-semibold tracking-[0.25em] uppercase">axl</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white mt-5 mb-2">Page not found</h1>
        <p className="text-white/45 text-sm leading-relaxed">There&apos;s nothing at this address.</p>
        <Link
          href="/"
          className="inline-block mt-7 px-7 py-3 rounded-full bg-white/[0.07] border border-white/[0.15] text-white text-sm font-medium hover:bg-white/[0.12] hover:border-white/[0.25] transition-all"
        >
          Go to axl
        </Link>
      </div>
    </main>
  )
}
