"use client"

import { useState } from "react"
import Link from "next/link"
import { ShaderAnimation } from "@/components/ui/shader-animation"
import { Navbar } from "@/components/navbar"
import { createClient } from "@/lib/client"

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <>
      <ShaderAnimation />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm">

            {/* Card */}
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] rounded-3xl p-8">

              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">
                  Welcome back
                </h1>
                <p className="text-sm text-white/40">
                  Sign in to your ARX Studios account
                </p>
              </div>

              {sent ? (
                /* Success state */
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mx-auto mb-4">
                    <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <p className="text-white/80 text-sm font-medium mb-1">Check your inbox</p>
                  <p className="text-white/40 text-xs leading-relaxed">
                    We sent a magic link to{" "}
                    <span className="text-white/60">{email}</span>
                  </p>
                  <button
                    onClick={() => { setSent(false); setEmail("") }}
                    className="mt-5 text-xs text-white/30 hover:text-white/50 transition-colors"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <>
                  {/* Email form */}
                  <form onSubmit={handleEmailSignIn} className="space-y-3">
                    <label className="block">
                      <span className="text-xs text-white/40 uppercase tracking-[0.1em] mb-2 block">Email</span>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/[0.25] focus:bg-white/[0.08] transition-all"
                      />
                    </label>

                    {error && (
                      <p className="text-red-400/80 text-xs px-1">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="w-full py-3 rounded-full bg-white/[0.1] border border-white/[0.18] text-white text-sm font-medium hover:bg-white/[0.16] hover:border-white/[0.28] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mt-1"
                    >
                      {loading ? "Sending…" : "Continue with email"}
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-white/[0.08]" />
                    <span className="text-white/25 text-[10px] uppercase tracking-[0.2em]">or</span>
                    <div className="flex-1 h-px bg-white/[0.08]" />
                  </div>

                  {/* Google */}
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-3 py-3 rounded-full bg-white/[0.05] border border-white/[0.12] text-white/70 text-sm font-medium hover:bg-white/[0.1] hover:border-white/[0.2] hover:text-white/90 transition-all duration-200 disabled:opacity-40"
                  >
                    <GoogleIcon />
                    {googleLoading ? "Redirecting…" : "Continue with Google"}
                  </button>
                </>
              )}

            </div>

            {/* Footer note */}
            <p className="text-center text-white/20 text-xs mt-6 leading-relaxed">
              By continuing, you agree to our{" "}
              <Link href="/privacy" className="text-white/35 hover:text-white/55 transition-colors underline underline-offset-2">
                Privacy Policy
              </Link>
            </p>

          </div>
        </div>
      </div>
    </>
  )
}
