"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"

const GithubIcon   = (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.021C22 6.484 17.522 2 12 2z"/></svg>
const YoutubeIcon  = (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
const LinkedinIcon = (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
import { cn } from "@/lib/utils"

interface TeamMember {
  name: string
  title: string
  description: string
  imageUrl: string
  githubUrl?: string
  twitterUrl?: string
  youtubeUrl?: string
  linkedinUrl?: string
}

const team: TeamMember[] = [
  {
    name: "Ayushman Das",
    title: "Founder , ARX Studios",
    description:
      "Passionate about building the future of digital experiences. Previously led development at DRDO & TCrest. Now creating something new at the intersection of art and technology.",
    imageUrl: "/dinosaur.jpeg",
    githubUrl: "https://github.com/cyborgwastaken",
    youtubeUrl: "https://youtube.com/@cyborgwastaken",
    linkedinUrl: "https://linkedin.com/in/ayuxcyb",
  },
]

export interface TeamCarouselProps {
  className?: string
}

export function TeamCarousel({ className }: TeamCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleNext = () => setCurrentIndex((i) => (i + 1) % team.length)
  const handlePrevious = () => setCurrentIndex((i) => (i - 1 + team.length) % team.length)

  const member = team[currentIndex]

  const socialLinks = [
    { icon: GithubIcon,   url: member.githubUrl,   label: "GitHub" },
    { icon: YoutubeIcon,  url: member.youtubeUrl,  label: "YouTube" },
    { icon: LinkedinIcon, url: member.linkedinUrl, label: "LinkedIn" },
  ]

  return (
    <div className={cn("w-full max-w-5xl mx-auto px-4", className)}>

      {/* ── Desktop ─────────────────────────────────── */}
      <div className="hidden md:flex relative items-center">

        {/* Photo */}
        <div className="w-[420px] h-[420px] rounded-3xl overflow-hidden border border-white/[0.08] flex-shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={member.imageUrl}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="w-full h-full"
            >
              <Image
                src={member.imageUrl}
                alt={member.name}
                width={420}
                height={420}
                className="w-full h-full object-cover"
                draggable={false}
                priority
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Glass card */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] rounded-3xl p-8 ml-[-80px] z-10 max-w-xl flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={member.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              <div className="mb-5">
                <h2 className="text-2xl font-semibold text-white tracking-tight mb-1">
                  {member.name}
                </h2>
                <p className="text-sm text-white/40">{member.title}</p>
              </div>

              <p className="text-white/60 text-base leading-relaxed mb-8">
                {member.description}
              </p>

              <div className="flex gap-3">
                {socialLinks.map(({ icon: Icon, url, label }) => (
                  <Link
                    key={label}
                    href={url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-10 h-10 rounded-full bg-white/[0.07] border border-white/[0.12] flex items-center justify-center text-white/50 hover:bg-white/[0.14] hover:text-white/80 hover:border-white/[0.2] transition-all duration-200"
                  >
                    <Icon className="w-4 h-4" />
                  </Link>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile ──────────────────────────────────── */}
      <div className="md:hidden max-w-sm mx-auto">

        {/* Photo */}
        <div className="w-full aspect-square rounded-3xl overflow-hidden border border-white/[0.08] mb-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={member.imageUrl}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="w-full h-full"
            >
              <Image
                src={member.imageUrl}
                alt={member.name}
                width={400}
                height={400}
                className="w-full h-full object-cover"
                draggable={false}
                priority
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Glass card */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] rounded-3xl p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={member.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="flex flex-col gap-3"
            >
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight mb-1">
                  {member.name}
                </h2>
                <p className="text-xs text-white/40">{member.title}</p>
              </div>

              <p className="text-white/55 text-sm leading-relaxed">
                {member.description}
              </p>

              <div className="flex gap-3 pt-1">
                {socialLinks.map(({ icon: Icon, url, label }) => (
                  <Link
                    key={label}
                    href={url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-10 h-10 rounded-full bg-white/[0.07] border border-white/[0.12] flex items-center justify-center text-white/50 hover:bg-white/[0.14] hover:text-white/80 transition-all duration-200"
                  >
                    <Icon className="w-4 h-4" />
                  </Link>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────── */}
      {team.length > 1 && <div className="flex justify-center items-center gap-6 mt-8">
        <button
          onClick={handlePrevious}
          aria-label="Previous"
          className="w-11 h-11 rounded-full bg-white/[0.07] border border-white/[0.12] flex items-center justify-center text-white/50 hover:bg-white/[0.12] hover:text-white/80 hover:border-white/[0.2] transition-all duration-200 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex gap-2">
          {team.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              aria-label={`Go to member ${i + 1}`}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-200 cursor-pointer",
                i === currentIndex ? "bg-white/70" : "bg-white/20"
              )}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          aria-label="Next"
          className="w-11 h-11 rounded-full bg-white/[0.07] border border-white/[0.12] flex items-center justify-center text-white/50 hover:bg-white/[0.12] hover:text-white/80 hover:border-white/[0.2] transition-all duration-200 cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>}

    </div>
  )
}
