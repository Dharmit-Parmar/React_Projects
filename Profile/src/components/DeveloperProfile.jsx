import React, { useRef } from 'react';
import PixelSnow from './GridBackground/PixelSnow'; 
import gsap from "gsap";

export default function DeveloperProfile() { 
    const cardContainerRef = useRef(null);

    const startProgress = () => {
        if (!cardContainerRef.current) return;
 
        gsap.fromTo(
            gsap.utils.toArray(".progress-fill-bar", cardContainerRef.current),
            { width: "0%" },
            {
                width: (i, target) => target.getAttribute('data-target-width'),  
                duration: 1,  
                stagger: 0.2,   
                ease: "power2.out"
            }
        );
    };

    return (
        <div style={{
            background: ` 
                      radial-gradient(circle at 75% 20%, rgba(88, 28, 135, 0.2) 30%, rgba(88, 28, 135, 0.05) 55%),
                      radial-gradient(circle at 15% 40%, rgba(30, 58, 138, 0.20) 0%, rgba(30, 88, 138, 0.05) 50%),
                      linear-gradient(135deg, #13111c 0%, #0b0914 100%)
                  `
        }} className='w-screen h-auto sm:gap-[10vw] flex flex-col sm:flex-row relative justify-around items-center sm:h-screen select-none'>
 
            <div className="leftSideOfPart w-full mt-10 sm:mt-none sm:w-1/2 max-h-[400px] sm:max-h-none sm:h-full relative z-20 flex flex-col justify-center text-left p-6  sm:p-12 md:p-16">
                <h1 className='text-white text-3xl  sm:text-6xl font-extrabold tracking-tight mb-6 px-5' >
                    The Dual-Wield <span className="bg-gradient-to-r from-purple-500 to-orange-500 bg-clip-text text-transparent p-3 block">Developer</span>
                </h1>
                <p className="text-sm sm:text-xl sm:text-start text-center px-5 py-3 font-semibold text-slate-200 mb-4 leading-relaxed">
                    I don't choose between structural logic and visual immersion. I build both.
                </p>
                <p className="text-base sm:text-xl px-5 text-slate-200 font-light leading-relaxed">
                    Backed by a rigorous engineering foundation from <span className="bg-gradient-to-r from-purple-500 to-orange-500 bg-clip-text text-transparent font-medium">BVM Engineering</span>,
                    I architect low-level computational pipelines using C++ and Linux while rendering highly interactive,
                    high-fidelity user experiences with modern frontend technologies.
                </p>
            </div>


            <div className='rightSideOfPart  h-full p-5 sm:p-2 max-h-[500px]sm:w-1/2 sm:h-full sm:max-h-none relative flex z-20  '>

            <div className="   max-h-[500px] sm:max-h-none  flex z-20 flex-1 max-w-[440px] justify-center items-center">
                
                    <div
                        ref={cardContainerRef}
                        onMouseEnter={startProgress}
                        className="w-full bg-[#131124]/40 border border-white/[0.06] backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] cursor-default"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-white text-lg font-bold tracking-wide">System Vectors</h3>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2 font-mono text-xs tracking-wider">
                                <span className="text-orange-400 font-bold">&lt;/&gt; Algorithmic Rigor</span>
                                <span className="text-orange-400">90%</span>
                            </div>
                            <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                {/* ⚡ Switched ref to shared class + data-target-width metric */}
                                <div
                                    data-target-width="90%"
                                    className="progress-fill-bar h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full w-[90%]"
                                />
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1.5 font-light">
                                Optimizing low-level execution data structures & time complexity loops.
                            </p>
                        </div>

                        {/* Bar 2 */}
                        <div className="mb-8">
                            <div className="flex justify-between items-center mb-2 font-mono text-xs tracking-wider">
                                <span className="text-purple-400 font-bold">🎨 Interactive Engineering</span>
                                <span className="text-purple-400">85%</span>
                            </div>
                            <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                {/* ⚡ Switched ref to shared class + data-target-width metric */}
                                <div
                                    data-target-width="85%"
                                    className="progress-fill-bar h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full w-[85%]"
                                />
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1.5 font-light">
                                Crafting premium responsive layouts, spatial motion, and luxury web spaces.
                            </p>
                        </div>

                        <div className="border-t border-white/[0.05] pt-4 font-mono text-[10px] text-slate-500 tracking-widest uppercase">
                            SYSTEM STATUS: ACTIVE // DEPLOYMENT: OPTIMAL
                        </div>
                    </div>
            </div>

            </div>
        </div>
    );
}