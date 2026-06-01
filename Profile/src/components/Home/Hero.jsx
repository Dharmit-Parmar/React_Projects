import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { useRef, useState } from "react"
import onlineSvg from "../../assets/avatar-people-profile-svgrepo-com.svg"
import ProfilePhoto from '../../assets/myphoto.png'
import DotGrid from "../GridBackground/DotGrid"
import SkillCards from "../Home/smallSkillCards/SkillCards"

export default function Hero() {
    const frontFace = useRef(null)
    const backFace = useRef(null)
    const scroolingFont = useRef(null)

    const rotatingCircle = useRef(null)
    const shakingText = useRef(null)
    const heroContainer = useRef(null)
    const bgTweenRef = useRef(null)
    const [IsFlip, setFlip] = useState(false)

    const isFlippedRef = useRef(false)
    const isAnimatingRef = useRef(false)

    useGSAP(() => {
        if (!heroContainer.current) return

        bgTweenRef.current = gsap.to(heroContainer.current, {
            background: ` 
                radial-gradient(circle at 75% 50%, rgba(88, 28, 135, 0.2) 30%, rgba(88, 28, 135, 0) 55%),
                radial-gradient(circle at 15% 40%, rgba(30, 58, 138, 0.15) 0%, rgba(30, 88, 138, 0) 50%),
                linear-gradient(135deg, #13111c 0%, #0b0914 100%)
            `,
            duration: 4,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut"
        })

        const f = frontFace.current
        const b = backFace.current
        if (!f || !b) return

        const maxTilt = 25
        gsap.fromTo([f, b], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 2 })

        gsap.set(b, { rotationY: 180 })

        const targets = {
            xPercent: 0,
            yPercent: 0,
            hue: 0,
            scale: 1
        }

        const onMouseMove = (el) => {
            if (isFlippedRef.current || isAnimatingRef.current) return

            const rect = f.getBoundingClientRect()
            const mouseX = el.clientX - rect.left
            const mouseY = el.clientY - rect.top
            targets.xPercent = mouseX / rect.width - 0.5
            targets.yPercent = mouseY / rect.height - 0.5
            const distanceFromCenter = Math.sqrt(
                targets.xPercent * targets.xPercent +
                targets.yPercent * targets.yPercent
            )
            targets.scale = Math.min(1 - distanceFromCenter * 0.1, 0.95)
            const xProgress = mouseX / rect.width
            const yProgress = mouseY / rect.height
            targets.hue = Math.floor(xProgress * 240 + yProgress * 120)
        }

        const onMouseLeave = () => {
            if (isFlippedRef.current || isAnimatingRef.current) return

            targets.xPercent = 0
            targets.yPercent = 0
            targets.scale = 1

            gsap.to(f, {
                rotationY: 0,
                rotationX: 0,
                scale: 1,
                borderColor: "rgba(255, 255, 255, 1)",
                duration: 0.6,
                ease: "power3.out"
            })
        }

        const handleBgTransition = (flipped) => {
            if (bgTweenRef.current) {
                bgTweenRef.current.kill()
            }

            const baseBg = flipped
                ? `radial-gradient(circle at 75% 20%, rgba(13, 148, 136, 0.2) 30%, rgba(13, 148, 136, 0.05) 55%), radial-gradient(circle at 15% 40%, rgba(217, 119, 6, 0.1) 0%, rgba(217, 119, 6, 0.02) 50%), linear-gradient(135deg, #0f172a 0%, #020617 100%)`
                : `radial-gradient(circle at 75% 20%, rgba(88, 28, 135, 0.2) 30%, rgba(88, 28, 135, 0.05) 55%), radial-gradient(circle at 15% 40%, rgba(30, 58, 138, 0.20) 0%, rgba(30, 88, 138, 0.05) 50%), linear-gradient(135deg, #13111c 0%, #0b0914 100%)`

            const targetBg = flipped
                ? `radial-gradient(circle at 75% 50%, rgba(13, 148, 136, 0.15) 30%, rgba(13, 148, 136, 0) 60%), radial-gradient(circle at 20% 30%, rgba(217, 119, 6, 0.08) 0%, rgba(217, 119, 6, 0) 50%), linear-gradient(135deg, #0f172a 0%, #020617 100%)`
                : `radial-gradient(circle at 75% 50%, rgba(88, 28, 135, 0.2) 30%, rgba(88, 28, 135, 0) 55%), radial-gradient(circle at 15% 40%, rgba(30, 58, 138, 0.15) 0%, rgba(30, 88, 138, 0) 50%), linear-gradient(135deg, #13111c 0%, #0b0914 100%)`

            gsap.to(heroContainer.current, {
                background: baseBg,
                duration: 0.6,
                ease: "power2.inOut",
                onComplete: () => {
                    bgTweenRef.current = gsap.to(heroContainer.current, {
                        background: targetBg,
                        duration: 5,
                        repeat: -1,
                        yoyo: true,
                        ease: "power1.inOut"
                    })
                }
            })
        }

        const FlipTheCard = (event) => {
            if (event.target.closest(".infoBox")) return
            if (isAnimatingRef.current) return

            isAnimatingRef.current = true
            isFlippedRef.current = !isFlippedRef.current
            const currentFlipState = isFlippedRef.current

            setFlip(currentFlipState)
            handleBgTransition(currentFlipState)

            gsap.killTweensOf([f, b])

            gsap.to(f, {
                duration: 0.6,
                rotationY: currentFlipState ? -180 : 0,
                rotationX: 0,
                scale: 1,
                borderColor: "rgba(255, 255, 255, 0.2)",
                ease: "power2.inOut"
            })

            gsap.to(b, {
                duration: 0.6,
                rotationY: currentFlipState ? 0 : 180,
                rotationX: 0,
                scale: 1,
                ease: "power2.inOut",
                onComplete: () => {
                    isAnimatingRef.current = false
                    targets.xPercent = 0
                    targets.yPercent = 0
                }
            })
        }

        const handleCardTiltTick = () => {
            if (isFlippedRef.current || isAnimatingRef.current) return

            gsap.to(f, {
                rotationY: targets.xPercent * maxTilt,
                rotationX: targets.yPercent * -maxTilt,
                scale: targets.scale,
                borderColor: `hsl(${targets.hue}, 80%, 60%)`,
                duration: 0.3,
                ease: "power1.out",
                overwrite: "auto"
            })
        }

        gsap.ticker.add(handleCardTiltTick)

        f.addEventListener('click', FlipTheCard)
        b.addEventListener('click', FlipTheCard)
        f.addEventListener("mousemove", onMouseMove)
        f.addEventListener("mouseleave", onMouseLeave)

        return () => {
            gsap.ticker.remove(handleCardTiltTick)
            f.removeEventListener('click', FlipTheCard)
            b.removeEventListener('click', FlipTheCard)
            f.removeEventListener("mousemove", onMouseMove)
            f.removeEventListener("mouseleave", onMouseLeave)
        }
    }, [])

    useGSAP(() => {
        gsap.to(rotatingCircle.current, {
            rotation: 360,
            duration: 10,
            repeat: -1,
            ease: "none"
        })

        const tl = gsap.timeline({repeat:-1}) 
            .to(scroolingFont.current, { y: -42, duration: 4 }, "+=1")   
            .to(scroolingFont.current, { y: -90, duration: 4 }, "+=1")
            .to(scroolingFont.current ,{ y: 0 , duration: 4})
    }, [])

    const handleShakingText = () => {
        gsap
            .timeline()
            .to(shakingText.current, { x: -4, y: 1, rotation: -0.5, duration: 0.04 })
            .to(shakingText.current, { x: 4, y: -1, rotation: 0.5, duration: 0.04 })
            .to(shakingText.current, { x: -3, y: -1, rotation: -0.5, duration: 0.04 })
            .to(shakingText.current, { x: 3, y: 1, rotation: 0.5, duration: 0.04 })
            .to(shakingText.current, {
                x: 0,
                y: 0,
                rotation: 0,
                duration: 0.04,
                ease: "power2.out"
            })
    }

    return (
        <div
            style={{
                background: ` 
                    radial-gradient(circle at 75% 20%, rgba(88, 28, 135, 0.2) 30%, rgba(88, 28, 135, 0.05) 55%),
                    radial-gradient(circle at 15% 40%, rgba(30, 58, 138, 0.20) 0%, rgba(30, 88, 138, 0.05) 50%),
                    linear-gradient(135deg, #13111c 0%, #0b0914 100%)
                `
            }}
            ref={heroContainer}
            className="w-screen h-auto sm:overflow-y-hidden sm:h-screen bg-[#121214] relative flex flex-col md:flex-row p-4 sm:p-8 md:p-12 overflow-y-auto overflow-x-hidden gap-8"
        >
            <div className="absolute inset-0 z-0 overflow-hidden">
                <DotGrid
                    dotSize={4}
                    gap={20}
                    baseColor="#1e293b"
                    activeColor="#14b8a6"
                    proximity={90}
                    shockRadius={100}
                    shockStrength={3}
                    resistance={750}
                    returnDuration={1.5}
                />
            </div>

            <div className="leftContentContainer relative z-10 flex-1 flex flex-col justify-center items-center min-w-[280px] py-5 top-21">
                <h2
                    ref={shakingText}
                    onMouseEnter={handleShakingText}
                    className="text-white text-4xl sm:text-7xl font-extrabold p-4 tracking-tight mb-4 select-none cursor-default"
                >
                    Dharmit Parmar
                </h2>
                <p className="text-white/60 text-base sm:text-lg font-light max-w-md leading-relaxed text-center">
                    Explore my technical profile, verified frameworks expertise, and core
                    engine performance optimization fields directly from the card deck
                    interface layout.
                </p>

                <div className="skillNamesSliding capitalize h-13   mt-4  overflow-hidden items-start justify-start gap:0 flex flex-col text-white text-2xl sm:text-4xl font-extrabold  tracking-tight select-none cursor-default ">
                    <div ref={scroolingFont} className="h-full" >

                        <h5 className="h-full p-2 px-2 font-light tracking-wide"><span className="w-3 h-3 bg-yellow-200  my-1 mx-2 rounded-full inline-block animate-pulse shadow-[0_0_10px_rgba(254,240,138,0.5)]"></span>Javascript Lover</h5>
                        <h5 className="h-full p-1 px-2 font-light tracking-wide"><span className="w-3 h-3 bg-[#12cd8f]  my-1 mx-2 rounded-full inline-block animate-pulse shadow-[0_0_10px_rgba(254,240,138,0.5)]"></span>frontend devloper</h5>
                    <h5 className=" h-full p-1 px-2 font-light tracking-wide"> <span className="w-3 h-3 bg-purple-400  my-1 mx-2 rounded-full inline-block animate-pulse shadow-[0_0_10px_rgba(254,240,138,0.5)]"> </span>  Creative Probelm solver</h5>
                </div>


                </div>
                <div className="w-full max-w-5xl flex flex-wrap justify-center items-center gap-5 px-4 py-15 mt-4">
                    <SkillCards heading="C++" detail="High Performance" icon="🚀" />
                    <SkillCards heading="DSA" detail="Optimized Logic" icon="🧠" />
                    <SkillCards heading="React" detail="Interactive UI" icon="⚛️" />
                </div>
            </div>

            <div className="rightCardContainer relative z-10 flex-1 flex justify-center md:justify-center items-center py-20">
                <div
                    style={{ perspective: "1200px" }}
                    className="relative w-full max-w-[400px] h-[520px]"
                >
                    {/* ======================= FRONT FACE ======================= */}
                    <div
                        ref={frontFace}
                        style={{
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            transformStyle: "preserve-3d",
                            background: `
                              radial-gradient(circle at 50% 32%, rgba(255, 38, 0, 0.85) 0%, rgba(255, 77, 0, 0.3) 25%, rgba(255, 94, 0, 0) 55%),
                              linear-gradient(135deg, rgba(6, 182, 212, 0.9) 0%, rgba(147, 51, 234, 0.85) 45%, rgba(236, 72, 153, 0.9) 100%)
                            `
                        }}
                        className="absolute inset-0 w-full h-full flex flex-col items-center p-5 sm:p-6 rounded-3xl border border-teal-500/20 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8),0_0_50px_rgba(13,148,136,0.15)] cursor-pointer select-none"
                    >
                        <div className="rotatingLogo w-full aspect-square max-h-[160px] sm:max-h-[180px] flex relative justify-center items-center overflow-hidden">
                            <div
                                style={{
                                    background:
                                        "radial-gradient(circle,rgba(237, 120, 2 , 0.05) 40%, rgba(224, 87, 229 , 0.08) 50%,rgba(129, 143, 223 , 0.04) 100%)"
                                }}
                                ref={rotatingCircle}
                                className="rotatingCircle h-[10rem] w-[10rem] border-4 rounded-full border-dotted border-white z-0"
                            ></div>

                            <div className="absolute inset-0 flex justify-center items-center z-10 pointer-events-none">
                                <img
                                    src={onlineSvg}
                                    alt="User Icon"
                                    className="w-[45%] h-[45%] object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                                    onError={() => {
                                        console.error("The SVG file failed to load.")
                                    }}
                                />
                            </div>
                        </div>

                        <div className="infoSection w-full flex flex-col justify-between mt-4">
                            <div className="heading w-full p-2 sm:p-4 text-white capitalize text-2xl sm:text-3xl">
                                Software Engineer
                                <div className="text-sm sm:text-base pt-2 text-white/80 font-light normal-case tracking-wide">
                                    Building scalable systems & algorithms
                                </div>
                            </div>

                            <div className="w-full flex justify-center items-center gap-4 text-white my-4 relative z-10 px-2 sm:px-4">
                                <div
                                    style={{
                                        background: `
                                          linear-gradient(rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.05) 100%) border-box,
                                          radial-gradient(circle at 15% 25%, rgba(255, 77, 0, 0.45) 0%, rgba(255, 77, 0, 0) 55%),
                                          radial-gradient(circle at 85% 75%, rgba(236, 72, 153, 0.55) 0%, rgba(236, 72, 153, 0) 100%),
                                          linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) padding-box
                                        `
                                    }}
                                    className="infoBox flex-1 min-w-[100px] aspect-[4/3] border border-transparent rounded-2xl flex flex-col overflow-hidden backdrop-blur-lg shadow-[0_8px_20px_rgba(0,0,0,0.3)]"
                                >
                                    <div className="w-full px-3 py-1.5 text-[9px] sm:text-[10px] tracking-widest uppercase font-bold text-slate-500 border-b border-black/[0.05] bg-black/[0.01]">
                                        Expert
                                    </div>
                                    <div className="flex-1 flex items-center px-3 text-xs sm:text-sm font-bold text-orange-600 drop-shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                                        🚀 C++
                                    </div>
                                </div>

                                <div
                                    style={{
                                        background: `
                                          linear-gradient(rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.05) 100%) border-box,
                                          radial-gradient(circle at 15% 25%, rgba(255, 77, 0, 0.45) 0%, rgba(255, 77, 0, 0) 55%),
                                          radial-gradient(circle at 85% 75%, rgba(236, 72, 153, 0.55) 0%, rgba(236, 72, 153, 0) 100%),
                                          linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) padding-box
                                        `
                                    }}
                                    className="infoBox flex-1 min-w-[100px] aspect-[4/3] border border-transparent rounded-2xl flex flex-col overflow-hidden backdrop-blur-lg shadow-[0_8px_20px_rgba(0,0,0,0.3)]"
                                >
                                    <div className="w-full px-3 py-1.5 text-[9px] sm:text-[10px] tracking-widest uppercase font-bold text-slate-500 border-b border-black/[0.05] bg-black/[0.01]">
                                        Focus
                                    </div>
                                    <div className="flex-1 flex items-center px-3 text-xs sm:text-sm font-bold text-cyan-600 drop-shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                                        ⚛️ React
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ======================= BACK FACE ======================= */}
                    <div
                        ref={backFace}
                        style={{
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            transformStyle: "preserve-3d",
                            background: `
                                radial-gradient(circle at 50% 25%, rgba(16, 185, 129, 0.45) 0%, rgba(4, 120, 87, 0.25) 40%, rgba(0, 0, 0, 0) 70%),
                                linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(31, 41, 55, 0.95) 100%)
                            `
                        }}
                        className="absolute inset-0 w-full h-full rounded-3xl border border-emerald-500/30 flex flex-col items-center justify-center p-5 sm:p-6 cursor-pointer select-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8),0_0_50px_rgba(16,185,129,0.2)]"
                    >
                        <div className="w-full h-full bg-black/50 rounded-2xl border border-emerald-500/20 flex flex-col p-4 gap-4 overflow-hidden">

                            <div className="w-full relative aspect-square max-h-[220px] rounded-xl overflow-hidden border border-emerald-500/30 flex-shrink-0  ">
                                <img
                                    src={ProfilePhoto}
                                    alt="Dharmit Parmar"
                                    className="w-full h-full object-cover opacity-90"
                                />
                                <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(4,120,87,0.5)] pointer-events-none"></div>
                            </div>

                            <div className="w-full flex-1 flex flex-col justify-center gap-3">

                                <a
                                    href="https://github.com/Dharmit-Parmar"
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-4 bg-emerald-950/40 hover:bg-emerald-900/60 transition-colors p-3.5 rounded-xl border border-emerald-500/20 group"
                                >
                                    <div className="text-emerald-400 group-hover:text-emerald-300 group-hover:scale-110 transition-all">
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                        </svg>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-emerald-100 text-sm font-bold tracking-wide">GitHub</span>
                                        <span className="text-emerald-500/70 text-xs font-mono mt-0.5">@Dharmit-Parmar</span>
                                    </div>
                                </a>

                                <a
                                    href="https://leetcode.com/u/Dharmit-Parmar/"
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-4 bg-emerald-950/40 hover:bg-emerald-900/60 transition-colors p-3.5 rounded-xl border border-emerald-500/20 group"
                                >
                                    <div className="text-emerald-400 group-hover:text-emerald-300 group-hover:scale-110 transition-all">
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                                            <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 3.497 3.743 5.64 5.64 0 0 0 2.686.423 5.711 5.711 0 0 0 2.04-.423l8.95-3.52a1.379 1.379 0 0 0 .58-1.85 1.38 1.38 0 0 0-1.853-.58l-8.948 3.521a3.33 3.33 0 0 1-1.207.246 3.23 3.23 0 0 1-1.532-.246 3.4 3.4 0 0 1-2.03-2.186 3.12 3.12 0 0 1-.036-1.374 3.01 3.01 0 0 1 .715-1.189l3.853-4.126 5.405-5.788a1.37 1.37 0 0 0 .19-1.503 1.374 1.374 0 0 0-1.144-.816h-.01zM22.64 15.006a1.375 1.375 0 0 0-.936 2.336l.01.01 1.377 1.472a1.442 1.442 0 0 1 0 1.944l-5.327 5.701a1.439 1.439 0 0 1-1.055.432 1.438 1.438 0 0 1-1.056-.432l-1.376-1.472a1.374 1.374 0 0 0-1.956.12 1.374 1.374 0 0 0 .12 1.956l1.375 1.472a4.195 4.195 0 0 0 3.064 1.258 4.195 4.195 0 0 0 3.063-1.258l5.328-5.7a4.19 4.19 0 0 0 0-5.834l-1.376-1.473a1.375 1.375 0 0 0-1.272-.533z" />
                                        </svg>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-emerald-100 text-sm font-bold tracking-wide">LeetCode</span>
                                        <span className="text-emerald-500/70 text-xs font-mono mt-0.5">@Dharmit-Parmar</span>
                                    </div>
                                </a>

                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

