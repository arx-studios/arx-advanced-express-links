"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleSignOut = async () => {
    setPending(true)
    await createClient().auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={pending}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.12] text-white/70 text-xs font-medium hover:text-white hover:bg-white/[0.12] hover:border-white/[0.22] transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
    >
      <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  )
}
