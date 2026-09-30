import Link from "next/link"
import { ShaderAnimation } from "@/components/ui/shader-animation"
import { Footer } from "@/components/footer"
import { PrivacyContent } from "@/components/privacy-content"

export const metadata = { title: "Privacy Policy | axl" }

export default function PrivacyPage() {
  return (
    <>
      <ShaderAnimation />
      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="flex justify-center pt-10">
          <Link
            href="/"
            className="text-white font-semibold tracking-[0.25em] uppercase text-sm hover:text-white/70 transition-colors duration-200"
          >
            axl
          </Link>
        </header>

        <main className="flex-1 px-6 py-16">
          <div className="max-w-2xl mx-auto bg-black/30 backdrop-blur-md border border-white/[0.08] rounded-2xl p-8 md:p-10">
            <PrivacyContent headingLevel="h1" />
          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}
