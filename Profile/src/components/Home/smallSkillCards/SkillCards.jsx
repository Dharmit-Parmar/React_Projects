import { useGSAP } from "@gsap/react";
import React, { useRef } from "react";
import { gsap } from "gsap";

export default function SkillCards({ heading, detail, icon }) {
    const rotatingCircle = useRef(null);

    const Rotatecircle = () => {
        if (!rotatingCircle.current) return;
        gsap.to(rotatingCircle.current, {
            rotation: 360,
            duration: 8,
            repeat: -1,
            ease: 'none'
        });
    };

    const Stopcircle = () => {
        if (!rotatingCircle.current) return;
        gsap.killTweensOf(rotatingCircle.current);
    };

    return (
        <div
            onMouseEnter={Rotatecircle}
            onMouseLeave={Stopcircle}
            style={{
                transformStyle: "preserve-3d",
                background: `
                  radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.12) 0%, transparent 50%),
                  linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.7) 100%)
                `,
                backdropFilter: "blur(12px)"
            }}
            // CHANGED: max-w-[140px] sets a compact boundary, and minimized padding to p-3
            className="w-full h-auto flex flex-col min-h-[120px] max-w-[140px] aspect-[4/3] items-center justify-center rounded-xl p-3 shadow-lg border border-transparent transition-colors duration-300 hover:border-slate-500/40"
        >
            <div className="w-full flex-1 flex relative justify-center items-center overflow-hidden">
                <div
                    ref={rotatingCircle}
                    // Your 3rem size works beautifully here! Reduced the border width to 2px for a finer look
                    className="h-[3rem] w-[3rem] border-2 rounded-full border-dashed border-slate-500/30 z-0"
                />
                {/* CHANGED: text-xl matches the smaller circle footprint cleanly */}
                <div className="absolute inset-0 flex justify-center items-center z-10 text-xl select-none">
                    {icon}
                </div>
            </div>

            <div className="w-full text-center mt-1">
                {/* CHANGED: Swapped the huge text-2xl out for text-sm so it looks compact and proportional */}
                <h3 className="text-slate-100 font-bold text-sm tracking-wide uppercase truncate px-1">{heading}</h3>
                {/* CHANGED: Scaled down detail font to text-[10px] to balance the hierarchy */}
                <p className="text-slate-500 text-[10px] font-light tracking-wider mt-0.5 truncate px-1">{detail}</p>
            </div>
        </div>
    );
}