import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, useState } from "react";
import onlineSvg from "../../assets/avatar-people-profile-svgrepo-com.svg";

import DotGrid from "../GridBackground/DotGrid";
import SkillCards from "../Home/smallSkillCards/SkillCards";

export default function Hero() {
    const skillCard = useRef(null);
    const rotatingCircle = useRef(null);
    const shakingText = useRef(null);
    const heroContainer = useRef(null);
    const [IsFlip, setFlip] = useState(false);

    // 1. Tracks if the card is currently facing backward
    const isFlippedRef = useRef(false);
    // 2. NEW FIX: Tracks if the card is currently spinning, locking all mouse interactions
    const isAnimatingRef = useRef(false);

    useGSAP(() => {
        if (!heroContainer.current) return;

        gsap.to(heroContainer.current, {
            background: ` 
                  radial-gradient(circle at 75% 50%, rgba(88, 28, 135, 0.2) 30%, rgba(88, 28, 135, 0) 55%),
                  radial-gradient(circle at 15% 40%, rgba(30, 58, 138, 0.15) 0%, rgba(30, 88, 138, 0) 50%),
                  linear-gradient(135deg, #13111c 0%, #0b0914 100%)
                `,
            duration: 4,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut",
        });

        const e = skillCard.current;
        if (!e) return;
        const maxTilt = 25;
        gsap.fromTo(e, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 2 });

        const targets = {
            xPercent: 0,
            yPercent: 0,
            hue: 0,
            scale: 1,
        };

        const onMouseMove = (el) => {
            // FIX: If flipped OR currently spinning, ignore mouse moves entirely
            if (isFlippedRef.current || isAnimatingRef.current) return;

            const rect = e.getBoundingClientRect();
            const mouseX = el.clientX - rect.left;
            const mouseY = el.clientY - rect.top;
            targets.xPercent = mouseX / rect.width - 0.5;
            targets.yPercent = mouseY / rect.height - 0.5;
            const distanceFromCenter = Math.sqrt(
                targets.xPercent * targets.xPercent +
                targets.yPercent * targets.yPercent,
            );
            targets.scale = Math.min(1 - distanceFromCenter * 0.1, 0.95);
            const xProgress = mouseX / rect.width;
            const yProgress = mouseY / rect.height;
            targets.hue = Math.floor(xProgress * 240 + yProgress * 120);
        };

        const onMouseLeave = () => {
            if (isFlippedRef.current || isAnimatingRef.current) return;

            targets.xPercent = 0;
            targets.yPercent = 0;
            targets.scale = 1;

            gsap.to(e, {
                rotationY: 0,
                rotationX: 0,
                scale: 1,
                borderColor: "rgba(255, 255, 255, 1)",
                duration: 0.6,
                ease: "power3.out",
            });
        };

        const FlipTheCard = (event) => {
            if (event.target.closest(".infoBox")) return;

            // FIX: Prevent double-clicks from breaking the animation mid-spin
            if (isAnimatingRef.current) return;

            isAnimatingRef.current = true; // Lock the mouse tracker
            isFlippedRef.current = !isFlippedRef.current;
            const currentFlipState = isFlippedRef.current;

            setFlip(currentFlipState);

            gsap.killTweensOf(e);
            gsap.to(e, {
                duration: 0.6,
                rotateY: currentFlipState ? 180 : 0,
                rotationX: 0,
                scale: 1,
                borderColor: "rgba(255, 255, 255, 0.2)",
                ease: "power2.out",
                onComplete: () => {
                    // FIX: Unlock the mouse tracker ONLY after the 0.6s spin is completely finished
                    isAnimatingRef.current = false;

                    // Reset mouse targets so it doesn't instantly snap to an old angle
                    targets.xPercent = 0;
                    targets.yPercent = 0;
                },
            });
        };

        const handleCardTiltTick = () => {
            // FIX: Do not overwrite the flip animation!
            if (isFlippedRef.current || isAnimatingRef.current) return;

            gsap.to(e, {
                rotationY: targets.xPercent * maxTilt,
                rotationX: targets.yPercent * -maxTilt,
                scale: targets.scale,
                borderColor: `hsl(${targets.hue}, 80%, 60%)`,
                duration: 0.3,
                ease: "power1.out",
                overwrite: "auto",
            });
        };

        gsap.ticker.add(handleCardTiltTick);
        e.addEventListener("click", FlipTheCard);
        e.addEventListener("mousemove", onMouseMove);
        e.addEventListener("mouseleave", onMouseLeave);

        return () => {
            gsap.ticker.remove(handleCardTiltTick);
            e.removeEventListener("click", FlipTheCard);
            e.removeEventListener("mousemove", onMouseMove);
            e.removeEventListener("mouseleave", onMouseLeave);
        };
    }, []);

    useGSAP(() => {
        gsap.to(rotatingCircle.current, {
            rotation: 360,
            duration: 10,
            repeat: -1,
            ease: "none",
        });
    }, []);

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
                ease: "power2.out",
            });
    };

    return (
        <div
            style={{
                background: ` 
                    radial-gradient(circle at 75% 20%, rgba(88, 28, 135, 0.2) 30%, rgba(88, 28, 135, 0.05) 55%),
                    radial-gradient(circle at 15% 40%, rgba(30, 58, 138, 0.20) 0%, rgba(30, 88, 138, 0.05) 50%),
                    linear-gradient(135deg, #13111c 0%, #0b0914 100%)
                `,
            }}
            ref={heroContainer}
            className="w-screen h-auto md:h-screen bg-[#121214] relative flex flex-col md:flex-row p-4 sm:p-8 md:p-12 overflow-y-auto overflow-x-hidden gap-8"
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
                <div className="w-full max-w-5xl flex flex-wrap justify-center items-center gap-5 px-4 py-15 mt-4">
                    <SkillCards heading="C++" detail="High Performance" icon="🚀" />
                    <SkillCards heading="DSA" detail="Optimized Logic" icon="🧠" />
                    <SkillCards heading="React" detail="Interactive UI" icon="⚛️" />
                </div>
            </div>
            <div className="rightCardContainer relative z-10 flex-1 flex justify-center md:justify-center items-center perspective-[1200px] py-20">
                <div
                    ref={skillCard}
                    style={{
                        transformStyle: "preserve-3d",
                        background: `
              radial-gradient(circle at 50% 32%, rgba(255, 38, 0, 0.85) 0%, rgba(255, 77, 0, 0.3) 25%, rgba(255, 94, 0, 0) 55%),
              linear-gradient(135deg, rgba(6, 182, 212, 0.9) 0%, rgba(147, 51, 234, 0.85) 45%, rgba(236, 72, 153, 0.9) 100%)
            `,
                    }}
                    className="leftSkillCard relative flex flex-col w-full max-w-[400px] h-[520px] border border-white/20 rounded-3xl items-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7),0_0_40px_rgba(6,182,212,0.25)] cursor-pointer"
                >
                    <div
                        style={{ backfaceVisibility: "hidden" }}
                        className="absolute inset-0 w-full h-full flex flex-col items-center p-5 sm:p-6 select-none"
                    >
                        <div className="rotatingLogo w-full aspect-square max-h-[160px] sm:max-h-[180px] flex relative justify-center items-center overflow-hidden">
                            <div
                                style={{
                                    background:
                                        "radial-gradient(circle,rgba(237, 120, 2 , 0.05) 40%, rgba(224, 87, 229 , 0.08) 50%,rgba(129, 143, 223 , 0.04) 100%)",
                                }}
                                ref={rotatingCircle}
                                className="rotatingCircle h-[10rem] w-[10rem] border-4 rounded-full border-dotted border-white z-0"
                            ></div>

                            <div className="absolute inset-0 flex justify-center items-center z-10 pointer-events-none">
                                <img
                                    src={onlineSvg}
                                    alt="User Icon"
                                    className="w-[45%] h-[45%] object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                                    onError={(e) => {
                                        console.error(
                                            "The SVG file failed to load. Check your asset folder path configuration exactly!",
                                        );
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
                            `,
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
                            `,
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

                    <div
                        style={{
                            backfaceVisibility: "hidden",
                            transform: "rotateY(180deg)",
                            background:
                                "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)",
                        }}
                        className="absolute inset-0 w-full h-full rounded-3xl flex flex-col items-center justify-center p-5 sm:p-6 pointer-events-none select-none"
                    >
                        <div className="w-full h-full bg-black/40 rounded-2xl border border-white/10 flex flex-col justify-center items-center p-4">
                            <span className="text-white/40 font-mono text-xs tracking-widest uppercase mb-2">
                                [ Backend Data Node ]
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
