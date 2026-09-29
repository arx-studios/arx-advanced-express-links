import { createClient } from "@/lib/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { ShaderAnimation } from "@/components/ui/shader-animation"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/")

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "there"

  const firstName = name.split(" ")[0]

  return (
    <>
      <ShaderAnimation />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 flex flex-col items-center justify-center gap-10 px-6 py-20">

          {/* Greeting */}
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-6xl md:text-7xl font-semibold tracking-tighter text-white leading-none">
              Welcome, {firstName}.
            </h1>
            <p className="text-white/40 text-sm tracking-[0.3em] uppercase mt-1">
              You&apos;re on the list
            </p>
          </div>

          {/* Confirmation card */}
          <div className="w-full max-w-md bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white/60" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-white/80 font-medium text-base">
                You&apos;re officially signed up.
              </p>
              <p className="text-white/35 text-sm leading-relaxed">
                We&apos;ll send a notification to{" "}
                <span className="text-white/55">{user.email}</span>{" "}
                the moment ARX Studios goes live.
              </p>
            </div>
          </div>

          {/* Back link */}
          <Link
            href="/"
            className="text-white/30 hover:text-white/60 text-sm transition-colors duration-200"
          >
            ← Back to home
          </Link>

        </main>

        <Footer />
      </div>
    </>
  )
}
