"use client"

import { Suspense, useCallback, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { PrivacyContent } from "@/components/privacy-content"
import { SignInForm } from "@/components/sign-in-form"

// Opens as an overlay on any page via ?modal=signin or ?modal=privacy.
function useModal() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const modal = searchParams.get("modal")

  const close = useCallback(() => router.push(pathname, { scroll: false }), [router, pathname])

  return { modal, close }
}

function ModalShell() {
  const { modal, close } = useModal()
  const isOpen = modal === "signin" || modal === "privacy"

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  // Lock body scroll while open, compensating for the scrollbar to avoid layout shift.
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
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="card"
              role="dialog"
              aria-modal="true"
              aria-label={modal === "privacy" ? "Privacy Policy" : "Sign in"}
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
                ${modal === "privacy" ? "max-w-2xl max-h-[80vh] flex flex-col" : "max-w-md"}
              `}
            >
              <button
                onClick={close}
                aria-label="Close"
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/[0.07] border border-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.12] transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {modal === "privacy" ? (
                <div className="overflow-y-auto p-8 md:p-10 flex-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                  <PrivacyContent />
                </div>
              ) : (
                <div className="p-8">
                  <SignInForm />
                  <p className="text-center text-white/20 text-xs mt-6">
                    By continuing, you agree to our{" "}
                    <a href="?modal=privacy" className="text-white/35 hover:text-white/55 transition-colors underline underline-offset-2">
                      Privacy Policy
                    </a>
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

// useSearchParams needs a Suspense boundary.
export function ModalPortal() {
  return (
    <Suspense>
      <ModalShell />
    </Suspense>
  )
}
