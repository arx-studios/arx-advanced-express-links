import { redirect } from "next/navigation"
import { ShaderAnimation } from "@/components/ui/shader-animation"
import { SignOutButton } from "@/components/sign-out-button"
import { getUser } from "@/server/auth"

// Placeholder until the real dashboard lands (Phase 3).
export default async function DashboardPage() {
  const user = await getUser()
  if (!user) redirect("/signin")

  return (
    <>
      <ShaderAnimation />
      <main className="relative z-10 flex flex-col items-center justify-center gap-8 h-screen px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-6xl md:text-7xl font-semibold tracking-tighter text-white leading-none">
            Dashboard
          </h1>
          <p className="text-white/40 text-sm tracking-[0.3em] uppercase mt-1">
            Signed in as {user.email ?? user.id}
          </p>
        </div>
        <SignOutButton />
      </main>
    </>
  )
}
