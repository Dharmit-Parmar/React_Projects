import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'

const AntigravityInner = ({
    count = 150,
    magnetRadius = 8,
    ringRadius = 12,
    waveSpeed = 0.2,
    waveAmplitude = 0.8,
    particleSize = 1.2,
    lerpSpeed = 0.03,
    color = '#12cd8f',
    autoAnimate = true,
    particleVariance = 1,
    rotationSpeed = 0.05,
    depthFactor = 1.5,
    pulseSpeed = 1.5,
    particleShape = 'sphere',
    fieldStrength = 8
}) => {
    const meshRef = useRef(null)
    const { viewport } = useThree()

    const dummy = useMemo(() => new THREE.Object3D(), [])

    const lastMousePos = useRef({ x: 0, y: 0 })
    const lastMouseMoveTime = useRef(0)
    const virtualMouse = useRef({ x: 0, y: 0 })

    const particles = useMemo(() => {
        const temp = []
        const width = viewport.width || 100
        const height = viewport.height || 100

        for (let i = 0; i < count; i++) {
            temp.push({
                t: Math.random() * 100,
                factor: 20 + Math.random() * 100,
                speed: 0.005 + Math.random() / 300,
                mx: (Math.random() - 0.5) * width,
                my: (Math.random() - 0.5) * height,
                mz: (Math.random() - 0.5) * 20,
                cx: (Math.random() - 0.5) * width,
                cy: (Math.random() - 0.5) * height,
                cz: (Math.random() - 0.5) * 20,
                vx: 0, vy: 0, vz: 0,
                randomRadiusOffset: (Math.random() - 0.5) * 2
            })
        }
        return temp
    }, [count, viewport.width, viewport.height])

    useFrame((state) => {
        const mesh = meshRef.current
        if (!mesh) return

        const { viewport: v, pointer: m } = state

        const dxMouse = m.x - lastMousePos.current.x
        const dyMouse = m.y - lastMousePos.current.y
        const mouseDist = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse)

        if (mouseDist > 0.001) {
            lastMouseMoveTime.current = Date.now()
            lastMousePos.current.x = m.x
            lastMousePos.current.y = m.y
        }

        let destX = (m.x * v.width) / 2
        let destY = (m.y * v.height) / 2

        if (autoAnimate && Date.now() - lastMouseMoveTime.current > 2000) {
            const time = state.clock.getElapsedTime()
            destX = Math.sin(time * 0.3) * (v.width / 4)
            destY = Math.cos(time * 0.3 * 2) * (v.height / 4)
        }

        const smoothFactor = 0.05
        virtualMouse.current.x += (destX - virtualMouse.current.x) * smoothFactor
        virtualMouse.current.y += (destY - virtualMouse.current.y) * smoothFactor

        const targetX = virtualMouse.current.x
        const targetY = virtualMouse.current.y
        const globalRotation = state.clock.getElapsedTime() * rotationSpeed

        for (let i = 0; i < count; i++) {
            const particle = particles[i]

            particle.t += particle.speed

            const projectionFactor = 1 - particle.cz / 50
            const projectedTargetX = targetX * projectionFactor
            const projectedTargetY = targetY * projectionFactor

            const dx = particle.mx - projectedTargetX
            const dy = particle.my - projectedTargetY
            const dist = Math.sqrt(dx * dx + dy * dy)

            let tx = particle.mx
            let ty = particle.my
            let tz = particle.mz * depthFactor

            if (dist < magnetRadius) {
                const angle = Math.atan2(dy, dx) + globalRotation
                const wave = Math.sin(particle.t * waveSpeed + angle) * (0.5 * waveAmplitude)
                const deviation = particle.randomRadiusOffset * (5 / (fieldStrength + 0.1))
                const currentRingRadius = ringRadius + wave + deviation

                tx = projectedTargetX + currentRingRadius * Math.cos(angle)
                ty = projectedTargetY + currentRingRadius * Math.sin(angle)
                tz = particle.mz * depthFactor + Math.sin(particle.t) * (1 * waveAmplitude * depthFactor)
            }

            particle.cx += (tx - particle.cx) * lerpSpeed
            particle.cy += (ty - particle.cy) * lerpSpeed
            particle.cz += (tz - particle.cz) * lerpSpeed

            dummy.position.set(particle.cx, particle.cy, particle.cz)
            dummy.lookAt(projectedTargetX, projectedTargetY, particle.cz)
            dummy.rotateX(Math.PI / 2)

            const distX = particle.cx - projectedTargetX
            const distY = particle.cy - projectedTargetY
            const currentDistToMouse = Math.sqrt(distX * distX + distY * distY)

            const distFromRing = Math.abs(currentDistToMouse - ringRadius)
            let scaleFactor = 1 - distFromRing / 10
            if (scaleFactor < 0) scaleFactor = 0
            if (scaleFactor > 1) scaleFactor = 1

            const finalScale = scaleFactor * (0.8 + Math.sin(particle.t * pulseSpeed) * 0.2 * particleVariance) * particleSize
            const clampedScale = finalScale > (particleSize * 2) ? (particleSize * 2) : finalScale

            dummy.scale.set(clampedScale, clampedScale, clampedScale)
            dummy.updateMatrix()
            mesh.setMatrixAt(i, dummy.matrix)
        }

        mesh.instanceMatrix.needsUpdate = true
    })

    useEffect(() => {
        return () => {
            if (meshRef.current) {
                meshRef.current.geometry.dispose()
                meshRef.current.material.dispose()
            }
        }
    }, [])

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            {particleShape === 'capsule' && <capsuleGeometry args={[0.1, 0.4, 4, 8]} />}
            {particleShape === 'sphere' && <sphereGeometry args={[0.2, 16, 16]} />}
            {particleShape === 'box' && <boxGeometry args={[0.3, 0.3, 0.3]} />}
            {particleShape === 'tetrahedron' && <tetrahedronGeometry args={[0.3]} />}
            <meshBasicMaterial color={color} transparent opacity={0.8} />
        </instancedMesh>
    )
}

const Antigravity = (props) => {
    return (
        <Canvas
            camera={{ position: [0, 0, 50], fov: 35 }}
            dpr={[1, 1.5]}
            gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        >
            <AntigravityInner {...props} />
        </Canvas>
    )
}

export default Antigravity