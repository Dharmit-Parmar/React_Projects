import { useEffect, useRef } from "react"

export default function PixelSnow({
    color = "#12cd8f",        // Your signature terminal emerald
    flakeSize = 0.02,        // Smaller, more delicate particles
    minFlakeSize = 0.5,
    pixelResolution = 235,
    speed = 0.6,             // Dropped from 0.60 to a slow, elegant ambient drift
    depthFade = 30,           // Softer fading into the background void
    farPlane = 65,            // Deeper 3D space
}) {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        // Disable alpha for maximum GPU optimization
        const ctx = canvas.getContext("2d", { alpha: false })
        let animationFrameId
        let particleData

        const STRIDE = 5
        const OFFSET_X = 0
        const OFFSET_Y = 1
        const OFFSET_Z = 2
        const OFFSET_SPEED_MOD = 3
        const OFFSET_X_DRIFT = 4

        let width, height, particleCount

        const initEngine = () => {
            const p = canvas.parentElement
            width = p ? p.clientWidth : window.innerWidth
            height = p ? p.clientHeight : window.innerHeight
            canvas.width = width
            canvas.height = height

            // LUXURY DENSITY: Changed divisor from 8000 to 14000. 
            // This creates a sparse, clean environment instead of a cluttered screen.
            particleCount = Math.floor((width * height) / 14000)

            particleData = new Float32Array(particleCount * STRIDE)

            for (let i = 0; i < particleCount; i++) {
                const index = i * STRIDE
                particleData[index + OFFSET_X] = (Math.random() - 0.5) * width * 2
                particleData[index + OFFSET_Y] = (Math.random() - 0.5) * height * 2
                particleData[index + OFFSET_Z] = Math.random() * farPlane
                particleData[index + OFFSET_SPEED_MOD] = Math.random() * 0.5 + 0.5

                // LUXURY DIRECTION: Almost zero horizontal wind drift. Just a gentle settling motion.
                particleData[index + OFFSET_X_DRIFT] = (Math.random() - 0.5) * 0.1
            }
        }

        initEngine()
        window.addEventListener("resize", initEngine)

        const render = () => {
            ctx.fillStyle = "#060512" // Your exact deep charcoal background
            ctx.fillRect(0, 0, width, height)

            const gridStep = Math.max(1, width / pixelResolution)
            const halfWidth = width / 2
            const halfHeight = height / 2

            ctx.fillStyle = color

            for (let i = 0; i < particleCount; i++) {
                const index = i * STRIDE

                let x = particleData[index + OFFSET_X]
                let y = particleData[index + OFFSET_Y]
                const z = particleData[index + OFFSET_Z]

                const scale = farPlane / (farPlane + z)
                const screenX = (x * scale) + halfWidth
                const screenY = (y * scale) + halfHeight

                if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
                    const fadeStart = Math.max(0, farPlane - depthFade)
                    let opacity = 1.0
                    if (z > fadeStart) {
                        opacity = 1.0 - ((z - fadeStart) / depthFade)
                    }

                    if (opacity > 0) {
                        // Cap maximum opacity to 0.6 so particles never distract from your text
                        ctx.globalAlpha = opacity * 0.6

                        const size = Math.max(minFlakeSize, (flakeSize * pixelResolution) * scale)
                        const snappedX = ((screenX / gridStep) | 0) * gridStep
                        const snappedY = ((screenY / gridStep) | 0) * gridStep

                        ctx.fillRect(snappedX, snappedY, size, size)
                    }
                }

                const speedMod = particleData[index + OFFSET_SPEED_MOD]
                const parallaxSpeed = speed * (scale * 2)

                particleData[index + OFFSET_Y] += parallaxSpeed * speedMod
                particleData[index + OFFSET_X] += particleData[index + OFFSET_X_DRIFT] * parallaxSpeed

                if (particleData[index + OFFSET_Y] > height) {
                    particleData[index + OFFSET_Y] = -height
                    particleData[index + OFFSET_X] = (Math.random() - 0.5) * width * 2
                    particleData[index + OFFSET_Z] = Math.random() * farPlane
                }
            }

            ctx.globalAlpha = 1.0
            animationFrameId = requestAnimationFrame(render)
        }

        animationFrameId = requestAnimationFrame(render)

        const handleVisibilityChange = () => {
            if (document.hidden) cancelAnimationFrame(animationFrameId)
            else animationFrameId = requestAnimationFrame(render)
        }
        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
            window.removeEventListener("resize", initEngine)
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            cancelAnimationFrame(animationFrameId)
        }
    }, [color, flakeSize, minFlakeSize, pixelResolution, speed, depthFade, farPlane])

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full block will-change-transform"
            style={{ background: "#060512" }}
        />
    )
}