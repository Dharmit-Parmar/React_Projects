import React from 'react';
import Antigravity from '../GridBackground/Antigravity';
import Stack from './Stack';

export default function Project() {
   
  const githubProjects = [
    {
      title: "Interactive React Dashboard",
      repoName: "your-react-repo-name",
      image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=500&auto=format"
    },
    {
      title: "Node.js Backend Pipeline",
      repoName: "your-node-repo-name",
      image: "https://images.unsplash.com/photo-1551033406-611cf9a28f67?q=80&w=500&auto=format"
    },
    {
      title: "C++ Low-Level Architecture",
      repoName: "your-cpp-repo-name",
      image: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=500&auto=format"
    },
    {
      title: "Python Machine Learning",
      repoName: "your-python-repo-name",
      image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=500&auto=format"
    }
  ];

  return (
    <div style={{
      background: ` 
  radial-gradient(circle at 75% 20%, rgba(88, 28, 135, 0.05) 10%, transparent 40%),
  radial-gradient(circle at 15% 40%, rgba(30, 58, 138, 0.05) 0%, transparent 40%),
  linear-gradient(135deg, #060512 0%, #020106 100%)
`
    }} className='relative w-screen h-screen flex flex-col sm:flex-row items-center justify-center select-none'>

      {/* ================= BACKGROUND ================= */}
      <div className=" absolute inset-0 z-0 opacity-50 pointer-events-none">
        <Antigravity
          color="#14b8a6"
          particleShape="capsule"
          magnetRadius={16}
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
          fieldStrength={10}
          autoAnimate={true}
        />
      </div>

      {/* ================= STACK COMPONENT ================= */}
      <div className="leftpart sm:w-1/2 sm:h-full  "></div>

      <div className="rightPart sm:w-1/2 sm:h-full   flex justify-center items-center  ">

        
      <div className="relative z-10 w-[300px] h-[400px] sm:h-[30vw] sm:w-[30vw]">
        <Stack
          randomRotation={true}
          sensitivity={150}
          sendToBackOnClick={true}
          autoplay={true}
          autoplayDelay={4000}
          pauseOnHover={true}

          // ⚡ Dynamic Card Generation
          cards={githubProjects.map((project, i) => (
            <div key={i} className="relative w-full h-full group">

              {/* Background Image */}
              <img
                src={project.image}
                alt={project.title}
                className="w-full h-full object-cover pointer-events-none"
              />

              {/* Dark Gradient Overlay for Text Readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#060512]/90 via-[#060512]/40 to-transparent pointer-events-none flex flex-col justify-end p-6">

                <h3 className="text-white font-bold text-xl mb-2 leading-tight">
                  {project.title}
                </h3>

                {/* Interactive GitHub Link 
                  pointer-events-auto allows it to be clicked without triggering the drag 
                  onPointerDown={e => e.stopPropagation()} prevents Framer Motion from grabbing the card when you click the link
                */}
                <a
                  href={`https://github.com/Dharmit-Parmar/${project.repoName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="pointer-events-auto text-[#14b8a6] text-sm font-mono tracking-wide hover:text-emerald-300 transition-colors inline-flex items-center gap-1.5 w-fit"
                >
                  GitHub.com ↗
                </a>

              </div>
            </div>
          ))}
        />
      </div>
      </div>

    </div>
  );
}