import { ShaderAnimation } from "@/components/ui/shader-animation"

// Placeholder until the real shortener UI lands (Phase 3).
export default function Page() {
  return (
    <>
      <ShaderAnimation />
      <main className="relative z-10 flex flex-col items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-7xl md:text-8xl font-semibold tracking-tighter text-white leading-none">
            axl
          </h1>
          <p className="text-white/40 text-sm tracking-[0.35em] uppercase mt-1">
            Short links by ARX Studios
          </p>
        </div>
      </main>
    </>
  )
}
