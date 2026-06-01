import React, { useRef, useState } from 'react'
import Antigravity from '../GridBackground/Antigravity'
import Stack from './Stack'
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { motion, AnimatePresence } from 'framer-motion' // ⚡ IMPORTED FOR TEXT SMOOTHNESS

import PdfManagerPhoto from '../Project/images/pdfMerger.png'
import WeatherAppPhoto from '../Project/images/weatherApp.png'
import LibraryManagementColorfulPhoto from '../Project/images/libraryManagementColorful.png'
import TodoListAppPhoto from '../Project/images/todoListApp.png'
import MovieTicketBookingPhoto from '../Project/images/movieTicketBooking.png'

export default function Project() {
  const stackRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
 
  useGSAP(() => {
    const e = stackRef.current
    const maxTilt = 15  
    gsap.fromTo(e, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.5, ease: "power3.out" })

    const onMouseMove = (event) => {
      const rect = e.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top
 
      const xPercent = (mouseX / rect.width - 0.5) * 2
      const yPercent = (mouseY / rect.height - 0.5) * 2
 
      gsap.to(e, {
        rotationY: xPercent * maxTilt,
        rotationX: yPercent * -maxTilt,
        duration: 0.5,
        ease: "power2.out",
        transformPerspective: 1000,
        overwrite: "auto"
      })
    }

    const onMouseLeave = () => {
      gsap.to(e, {
        rotationY: 0,
        rotationX: 0,
        duration: 1,
        ease: "elastic.out(1, 0.3)",  
        overwrite: "auto"
      })
    }

    e.addEventListener("mousemove", onMouseMove)
    e.addEventListener("mouseleave", onMouseLeave)

    return () => {
      e.removeEventListener("mousemove", onMouseMove)
      e.removeEventListener("mouseleave", onMouseLeave)
    }
  }, [])

  const githubProjects = [
    {
      title: "PDF Manager",
      description: "A powerful, pixel-perfect document conversion, PDF merging, editing, and image enhancement application built with React, Vite, and Express.",
      repoName: "React_Projects/tree/main/pdf-manager",
      image: PdfManagerPhoto
    },
    {
      title: "Weather App",
      description: "A clean and minimal weather application built with Vanilla JavaScript to fetch and display real-time weather data and forecasts.",
      repoName: "javascript_projects/tree/main/weatherApp",
      image: WeatherAppPhoto
    },
    {
      title: "Library Management System",
      description: "A C++ based terminal application to manage library inventory. Uses stylized ANSI colors and provides a streamlined CLI interface.",
      repoName: "Cpp-Projects/tree/main/Library",
      image: LibraryManagementColorfulPhoto
    },
    {
      title: "Modern Todo List",
      description: "A beautiful, responsive task management application utilizing local storage and advanced DOM manipulation for a seamless user experience.",
      repoName: "javascript_projects/tree/main/todo%20list",
      image: TodoListAppPhoto
    },
    {
      title: "Movie Ticket Booking Clone",
      description: "A full-stack movie ticket booking clone built to handle real-time seat reservations, secure payments, and user authentication. Provides a seamless UI inspired by modern booking platforms.",
      repoName: "movie-ticker-booking-clone",
      image: MovieTicketBookingPhoto
    }
  ]

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
        
        <div ref={stackRef} className="w-[300px] h-[400px]">
          <Stack
            randomRotation={true}
            sensitivity={150}
            sendToBackOnClick={true}
            autoplay={true}
            autoplayDelay={3500}
            pauseOnHover={true}
            onCardChange={(topCardIndex) => setActiveIndex(topCardIndex)}
            cards={githubProjects.map((project, i) => (
              <div key={i} className="w-full h-full rounded-3xl overflow-hidden border border-white/20 shadow-[0_0_40px_rgba(18,205,143,0.25)] transition-all duration-300">
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

        <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-[#12cd8f] text-xs tracking-widest uppercase mb-3 block">
          PROJECT MATRIX // 0{activeIndex + 1}
        </span>

         
        <div className="min-h-[200px]">  
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex} // Changing the key triggers the animation
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <h1 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.03em" }} className="text-white text-3xl sm:text-5xl font-bold mb-4">
                {currentProject.title}
              </h1>

              <p style={{ fontFamily: "'Inter', system-ui, sans-serif" }} className="text-slate-400 text-sm sm:text-lg font-light leading-relaxed mb-8 max-w-md">
                {currentProject.description}
              </p>

              <a
                href={`https://github.com/Dharmit-Parmar/${currentProject.repoName}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
                className="text-white bg-white/[0.03] border border-white/[0.08] hover:border-[#12cd8f]/50 px-6 py-3 rounded-xl font-mono text-xs tracking-wider uppercase transition-all hover:bg-white/[0.06] hover:shadow-[0_0_20px_rgba(18,205,143,0.15)] w-fit inline-flex items-center gap-2 pointer-events-auto"
              >
                Inspect Repository <span className="text-[#12cd8f]">↗</span>
              </a>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

    </div>
  )
}