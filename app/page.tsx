import Link from "next/link"
import { redirect } from "next/navigation"
import { BarChart3, Link2, Zap } from "lucide-react"
import { ShaderAnimation } from "@/components/ui/shader-animation"
import { CinematicFooter } from "@/components/ui/motion-footer"
import { Navbar } from "@/components/navbar"
import { ScrollCue } from "@/components/scroll-cue"
import { getUser } from "@/server/auth"

const FEATURES = [
  {
    icon: Link2,
    title: "Custom aliases",
    body: "Pick your own short code, or let axl generate one.",
  },
  {
    icon: Zap,
    title: "Instant redirects",
    body: "Links are served from a cache next to the servers, so they open fast.",
  },
  {
    icon: BarChart3,
    title: "Click counts",
    body: "See how many times each of your links has been opened.",
  },
]

export default async function Page() {
  if (await getUser()) redirect("/dashboard")

  return (
    <>
      <ShaderAnimation />
      <div className="relative z-10 flex flex-col">
        <Navbar />

        <section className="relative flex flex-col items-center justify-center h-screen px-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-8xl md:text-9xl font-semibold tracking-tighter text-white leading-none">
              axl
            </h1>
            {/* The name spelled out: the bright letters are the ones that make "axl". */}
            <p
              aria-label="ARX eXpress Links"
              className="text-white/45 text-xs sm:text-sm tracking-[0.3em] sm:tracking-[0.35em] uppercase mt-1 [text-shadow:0_1px_12px_rgba(0,0,0,0.9)]"
            >
              <span className="text-white">A</span>RX E<span className="text-white">X</span>PRESS{" "}
              <span className="text-white">L</span>INKS
            </p>
            <p className="text-white/55 text-xs tracking-[0.15em] [text-shadow:0_1px_12px_rgba(0,0,0,0.9)]">
              by ARX Studios
            </p>
          </div>

          <Link
            href="/?modal=signin"
            scroll={false}
            className="mt-12 flex items-center gap-3 px-9 py-4 rounded-full bg-white/[0.07] border border-white/[0.15] text-white text-base font-medium backdrop-blur-sm hover:bg-white/[0.12] hover:border-white/[0.25] transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.06)] active:scale-[0.98]"
          >
            Get Started
          </Link>

          <ScrollCue />
        </section>

        <section className="flex flex-col items-center gap-12 px-6 py-24">
          <div className="flex items-center gap-4 w-full max-w-sm">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-white/20 text-xs uppercase tracking-[0.2em]">Why axl</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          <div className="grid gap-4 w-full max-w-4xl md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 flex flex-col gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white/60" aria-hidden="true" />
                </div>
                <h2 className="text-white/85 font-medium">{title}</h2>
                <p className="text-white/40 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <CinematicFooter />
    </>
  )
}
