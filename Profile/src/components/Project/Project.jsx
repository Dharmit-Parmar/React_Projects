import React, { useState } from 'react'
import Antigravity from '../GridBackground/Antigravity'
import Stack from './Stack'
import PdfManagerPhoto from '../Project/images/pdfMerger.png'

export default function Project() {
  const githubProjects = [
    {
      title: "Algorithmic Routing Engine",
      description: "A high-performance C++ pipeline engineered to process low-level computational tasks and optimize structural time complexity matrices.",
      repoName: "algorithmic-rigor-v1",
      image:{PdfManagerPhoto}
    },
    {
      title: "Interactive Web Space",
      description: "A high-fidelity single page layout rendering smooth real-time visual spaces with optimized hardware memory controls.",
      repoName: "luxury-portfolio-engine",
      image: "https://images.unsplash.com/photo-1551033406-611cf9a28f67?q=80&w=500&auto=format"
    },
    {
      title: "Linux Memory Pipeline",
      description: "Low-level system architecture scripts managing cache optimization buffers and thread allocations across standard Unix nodes.",
      repoName: "linux-core-registry",
      image: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=500&auto=format"
    }
  ]

  const [activeIndex, setActiveIndex] = useState(0)
  const currentProject = githubProjects[activeIndex] || githubProjects[0]

  return (
    <div style={{

      background: ` 
        radial-gradient(circle at 75% 20%, rgba(18, 205, 143, 0.05) 10%, transparent 40%),
        radial-gradient(circle at 15% 40%, rgba(139, 92, 246, 0.04) 0%, transparent 40%),
        linear-gradient(135deg, #060512 0%, #020106 100%)
      `
    }} className="relative w-full min-h-screen sm:h-screen flex flex-col sm:flex-row overflow-hidden select-none">

      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <Antigravity
          color="#12cd8f"  
          particleShape="capsule"
          magnetRadius={26}
          ringRadius={12}
          waveSpeed={2.9}
          waveAmplitude={1.9}
          particleSize={1.5}
          particleVariance={0.8}
          lerpSpeed={0.05}
          count={300}
          rotationSpeed={0}
          depthFactor={1}
          pulseSpeed={3}
          fieldStrength={20}
          autoAnimate={true}
        />
      </div>

      
      <div className="leftSideOfPart w-full sm:w-1/2 max-h-[500px] sm:max-h-none sm:h-full relative flex z-20 justify-center items-center p-8 sm:p-12">
        <div className="w-[300px] h-[400px]">
          <Stack
            randomRotation={true}
            sensitivity={150}
            sendToBackOnClick={true}
            autoplay={true}
            autoplayDelay={2500}  
            pauseOnHover={true}
            onCardChange={(topCardIndex) => setActiveIndex(topCardIndex)}
            cards={githubProjects.map((project, i) => (
              <div key={i} className="w-full h-full rounded-3xl overflow-hidden border border-white/[0.08] shadow-2xl">
                <img
                  src={project.image}
                  alt={`project-card-${i}`}
                  className="w-full h-full object-cover pointer-events-none"
                />
              </div>
            ))}
          />
        </div>
      </div>
 
      <div className="rightSideOfPart w-full sm:w-1/2 sm:h-full relative z-20 flex flex-col justify-center text-left p-8 sm:pr-16 md:pr-24">

        {/* Dynamic Counter with Emerald Accent */}
        <span className="text-[#12cd8f] text-xs font-mono tracking-widest uppercase mb-3 block">
          PROJECT MATRIX // 0{activeIndex + 1}
        </span>

        
        <h1 className="text-white text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 transition-all duration-300">
          {currentProject.title}
        </h1>

       
        <p className="text-slate-400 text-sm sm:text-lg font-light leading-relaxed mb-8 transition-all duration-300 max-w-md">
          {currentProject.description}
        </p>

      
        <a
          href={`https://github.com/Dharmit-Parmar/${currentProject.repoName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white bg-white/[0.03] border border-white/[0.08] hover:border-[#12cd8f]/50 px-6 py-3 rounded-xl font-mono text-xs tracking-wider uppercase transition-all hover:bg-white/[0.06] hover:shadow-[0_0_20px_rgba(18,205,143,0.15)] w-fit inline-flex items-center gap-2"
        >
          Inspect Repository <span className="text-[#12cd8f]">↗</span>
        </a>
      </div>

    </div>
  )
}