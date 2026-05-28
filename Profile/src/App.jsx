import { useState } from "react";
import "./App.css";
import Hero from "./components/Home/Hero";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Project from "./components/Project/Project";
function App() {
  const HeroLoading = useRef(null);
  useGSAP(() => {
    gsap.from(HeroLoading.current, {
      y: 30,
      duration: 1,
    });
  });

  return (
    <>
      <div ref={HeroLoading} className="w-screen h-screen ">
        <Hero />
      </div>

      {/* <Project/> */}
    </>
  );
}

export default App;
