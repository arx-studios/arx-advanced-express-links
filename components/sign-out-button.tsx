"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    await createClient().auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="px-6 py-3 rounded-full bg-white/[0.07] border border-white/[0.15] text-white/80 text-sm font-medium backdrop-blur-sm hover:bg-white/[0.12] hover:border-white/[0.25] transition-all duration-300 active:scale-[0.98]"
    >
      Sign out
    </button>
  )
}
