import Link from "next/link"
import { redirect } from "next/navigation"
import { ShaderAnimation } from "@/components/ui/shader-animation"
import { SignInForm } from "@/components/sign-in-form"
import { getUser } from "@/server/auth"

export default async function SignInPage() {
  if (await getUser()) redirect("/dashboard")

  return (
    <>
      <ShaderAnimation />
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="flex justify-center pt-10">
          <Link
            href="/"
            className="text-white font-semibold tracking-[0.25em] uppercase text-sm hover:text-white/70 transition-colors duration-200"
          >
            axl
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm">
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] rounded-3xl p-8">
              <SignInForm />
            </div>

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
