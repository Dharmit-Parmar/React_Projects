import React from 'react'
import { motion } from 'framer-motion'

export default function TechCard({ title, icon: Icon, tags, iconBgClass, iconColorClass, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      whileHover={{ y: -8 }}
      className="relative group bg-[#131524]/60 backdrop-blur-2xl border border-white/[0.05] hover:border-white/[0.1] rounded-[32px] p-8 sm:p-10 shadow-2xl flex flex-col gap-8 w-full transition-colors duration-500 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative z-10 flex items-center gap-5">
        <div className={`p-4 rounded-2xl flex items-center justify-center ${iconBgClass}`}>
          <Icon className={`w-8 h-8 ${iconColorClass}`} />
        </div>
        <h3 className="text-white text-2xl sm:text-3xl font-bold tracking-wide">{title}</h3>
      </div>

      <div className="relative z-10 flex flex-wrap gap-3 mt-2">
        {tags.map((tag, index) =>
          tag.url ? (
            <motion.a
              key={index}
              href={tag.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
              className="bg-white/[0.04] border border-white/[0.05] text-slate-300 text-sm px-6 py-2.5 rounded-full font-medium transition-colors cursor-pointer no-underline hover:text-white"
            >
              {tag.name}
            </motion.a>
          ) : (
            <motion.span
              key={index}
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
              className="bg-white/[0.04] border border-white/[0.05] text-slate-300 text-sm px-6 py-2.5 rounded-full font-medium transition-colors cursor-default"
            >
              {tag.name}
            </motion.span>
          )
        )}
      </div>
    </motion.div>
  )
}