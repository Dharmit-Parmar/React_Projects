import React from 'react'
import { motion } from 'framer-motion'
import { Cpu, LayoutTemplate } from 'lucide-react'
import TechCard from './TechCard'

export default function TechoSystem() {
  return (
    <section className="relative min-h-screen bg-[#060512] flex flex-col items-center justify-center px-6 py-24 font-sans select-none overflow-hidden">

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
        whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center max-w-3xl mb-24 relative z-10"
      >
        <h2 className="text-5xl sm:text-7xl font-extrabold text-white mb-6 tracking-tight">
          The Tech <span className="bg-gradient-to-r from-indigo-500 via-purple-400 to-orange-400 bg-clip-text text-transparent">Ecosystem</span>
        </h2>
        <p className="text-slate-400 text-base sm:text-xl leading-relaxed max-w-xl mx-auto font-light">
          A curated stack of technologies powering high-performance systems and immersive interfaces
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl relative z-10">
        <TechCard
          title="The Engine"
          icon={Cpu}
          iconBgClass="bg-orange-500/10 shadow-[0_0_30px_rgba(249,115,22,0.15)] border border-orange-500/20"
          iconColorClass="text-orange-400"
          tags={[
            { name: 'C++', url: 'https://github.com/Dharmit-Parmar/Cpp-Projects' },
            { name: 'DSA', url: 'https://github.com/Dharmit-Parmar/DSA-Blueprint' },
            { name: 'OOP', url: 'https://github.com/Dharmit-Parmar/Cpp-Projects' },
            { name: 'STL', url: 'https://github.com/Dharmit-Parmar/Cpp-Projects' },
          ]}
          delay={0.1}
        />

        <TechCard
          title="The Display"
          icon={LayoutTemplate}
          iconBgClass="bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.15)] border border-indigo-500/20"
          iconColorClass="text-indigo-400"
          tags={[
            { name: 'JavaScript', url: 'https://github.com/Dharmit-Parmar/javascript_projects' },
            { name: 'Web Development', url: 'https://github.com/Dharmit-Parmar/React_Projects' },
            { name: 'Git/GitHub', url: 'https://github.com/Dharmit-Parmar' },
          ]}
          delay={0.3}
        />
      </div>

    </section>
  )
}