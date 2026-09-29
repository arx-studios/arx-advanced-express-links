"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

export function Navbar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const pastHero   = window.scrollY > window.innerHeight * 0.5
      const atFooter   = window.scrollY + window.innerHeight >= document.body.scrollHeight - window.innerHeight * 0.15
      setVisible(pastHero && !atFooter)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-20 w-full h-16 flex items-center justify-center bg-black/20 backdrop-blur-md border-b border-white/[0.08]"
        >
          <Link
            href="/"
            className="text-white font-semibold tracking-[0.25em] uppercase text-sm hover:text-white/70 transition-colors duration-200"
          >
            ARX Studios
          </Link>
        </motion.header>
      )}
    </AnimatePresence>
  )
}
