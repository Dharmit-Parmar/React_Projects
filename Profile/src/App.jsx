import { useState } from "react";
import "./App.css";
import Hero from "./components/Home/Hero";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Project from "./components/Project/Project";
import DeveloperProfile from "./components/DeveloperProfile";
import TechoSystem from "./components/TechoSystem/TechoSystem";
import Contact from "./components/Contact/Contact";
function App() {
  const HeroLoading = useRef(null);
  useGSAP(() => {
    gsap.from(HeroLoading.current, {
      y: 30,
      duration: 1,
    });
  });

  return (
     
    <div className="overflow-x-hidden">

      <Hero />
      <DeveloperProfile />
      <TechoSystem/>
      <Project/>
      <Contact/>
      </div>
   
  );
}

export default App;
