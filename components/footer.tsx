import Link from "next/link"

export function Footer() {
  return (
    <footer className="w-full flex items-center justify-between px-6 md:px-10 py-4 bg-black/20 backdrop-blur-md border-t border-white/[0.08]">
      <span className="text-white/30 text-xs">
        © {new Date().getFullYear()} ARX Studios. All rights reserved.
      </span>
      <nav className="flex items-center gap-5">
        <Link
          href="/"
          className="text-white/40 hover:text-white/70 text-xs transition-colors duration-200"
        >
          Home
        </Link>
        <Link
          href="/privacy"
          className="text-white/40 hover:text-white/70 text-xs transition-colors duration-200"
        >
          Privacy Policy
        </Link>
      </nav>
    </footer>
  )
}
