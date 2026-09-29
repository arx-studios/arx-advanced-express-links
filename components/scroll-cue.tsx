"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"

export function ScrollCue() {
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    const handleScroll = () => {
      // Fade out over the first 120px of scroll
      setOpacity(Math.max(0, 1 - window.scrollY / 120))
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
      animate={{ y: [0, 7, 0] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      style={{ opacity }}
    >
      <span className="text-white/20 text-[10px] uppercase tracking-[0.35em]">scroll</span>
      <ChevronDown className="w-4 h-4 text-white/25" />
    </motion.div>
  )
}
