"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import { X } from "lucide-react"
import { createClient } from "@/lib/client"

// ── helpers ───────────────────────────────────────────────────────────────

function useModal() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const modal = searchParams.get("modal") // "signin" | "privacy" | null

  const close = () => router.push(pathname, { scroll: false })

  return { modal, close }
}

// ── Sign-in form ──────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

function SignInContent() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-1">Welcome back</h2>
        <p className="text-sm text-white/40">Sign in to your ARX Studios account</p>
      </div>

      {sent ? (
        <div className="text-center py-2">
          <div className="w-12 h-12 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="text-white/80 text-sm font-medium mb-1">Check your inbox</p>
          <p className="text-white/40 text-xs leading-relaxed">
            We sent a magic link to <span className="text-white/60">{email}</span>
          </p>
          <button onClick={() => { setSent(false); setEmail("") }} className="mt-5 text-xs text-white/25 hover:text-white/45 transition-colors">
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={handleEmail} className="flex flex-col gap-3">
            <label className="block">
              <span className="text-[10px] text-white/35 uppercase tracking-[0.12em] mb-2 block">Email</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/[0.25] focus:bg-white/[0.08] transition-all"
              />
            </label>
            {error && <p className="text-red-400/80 text-xs px-1">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3 rounded-full bg-white/[0.1] border border-white/[0.18] text-white text-sm font-medium hover:bg-white/[0.16] hover:border-white/[0.28] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Sending…" : "Continue with email"}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-white/20 text-[10px] uppercase tracking-[0.2em]">or</span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-full bg-white/[0.05] border border-white/[0.1] text-white/65 text-sm font-medium hover:bg-white/[0.1] hover:border-white/[0.2] hover:text-white/90 transition-all duration-200 disabled:opacity-40"
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>
        </>
      )}

      <p className="text-center text-white/18 text-xs">
        By continuing, you agree to our{" "}
        <Link href="/?modal=privacy" scroll={false} className="text-white/35 hover:text-white/55 transition-colors underline underline-offset-2">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}

// ── Privacy policy ────────────────────────────────────────────────────────

function PrivacySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-white/75 font-medium text-sm">{title}</h3>
      <div className="text-white/35 text-xs leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

function PrivacyContent() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-1">Privacy Policy</h2>
        <p className="text-white/25 text-xs">Last updated: April 2026</p>
      </div>
      <div className="h-px bg-white/[0.06]" />
      <PrivacySection title="1. Information We Collect">
        <p>When you sign in with Google, we receive your name, email address, and profile picture from your Google account. We use this information solely to identify you within ARX Studios and to communicate updates about our launch.</p>
        <p>We may also collect standard usage data such as pages visited, time spent, and device type to improve the product experience.</p>
      </PrivacySection>
      <PrivacySection title="2. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>Notify you when ARX Studios launches</li>
          <li>Provide access to early features and beta programs</li>
          <li>Improve and personalise your experience</li>
          <li>Respond to support inquiries</li>
        </ul>
        <p>We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
      </PrivacySection>
      <PrivacySection title="3. Data Storage & Security">
        <p>Your data is stored securely using Supabase, hosted on infrastructure compliant with industry-standard security practices. We use HTTPS for all data in transit and enforce access controls to limit who can view your information.</p>
      </PrivacySection>
      <PrivacySection title="4. Cookies & Tracking">
        <p>We use session cookies to keep you signed in. We do not use third-party advertising cookies or tracking pixels. Basic analytics may be used to understand how visitors interact with the site.</p>
      </PrivacySection>
      <PrivacySection title="5. Your Rights">
        <p>You have the right to:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>Access the personal data we hold about you</li>
          <li>Request correction or deletion of your data</li>
          <li>Withdraw consent at any time by deleting your account</li>
        </ul>
        <p>To exercise any of these rights, contact us at the address below.</p>
      </PrivacySection>
      <PrivacySection title="6. Changes to This Policy">
        <p>We may update this policy from time to time. If we make significant changes, we will notify signed-up users by email before the changes take effect.</p>
      </PrivacySection>
      <PrivacySection title="7. Contact">
        <p>For any questions, contact us at <span className="text-white/50">privacy@arxstudios.com</span>.</p>
      </PrivacySection>
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────

function ModalShell() {
  const { modal, close } = useModal()
  const isOpen = modal === "signin" || modal === "privacy"

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  // Lock body scroll while open, compensate for scrollbar width to prevent layout shift
  useEffect(() => {
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = "hidden"
      document.body.style.paddingRight = `${scrollbarWidth}px`
    } else {
      document.body.style.overflow = ""
      document.body.style.paddingRight = ""
    }
    return () => {
      document.body.style.overflow = ""
      document.body.style.paddingRight = ""
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />

          {/* Card */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            onClick={e => e.stopPropagation()}
            style={{ backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}
            className={`
              w-full pointer-events-auto relative
              bg-white/[0.07] border border-white/[0.12]
              rounded-3xl overflow-hidden shadow-2xl
              ${modal === "privacy"
                ? "max-w-2xl max-h-[80vh] flex flex-col"
                : "max-w-md"
              }
            `}
          >
            {/* Close button */}
            <button
              onClick={close}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/[0.07] border border-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.12] transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Content */}
            {modal === "privacy" ? (
              <div className="overflow-y-auto p-8 md:p-10 flex-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                <PrivacyContent />
              </div>
            ) : (
              <div className="p-8">
                <SignInContent />
              </div>
            )}
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Export (wrapped in Suspense boundary for useSearchParams) ─────────────

import { Suspense } from "react"

export function ModalPortal() {
  return (
    <Suspense>
      <ModalShell />
    </Suspense>
  )
}
