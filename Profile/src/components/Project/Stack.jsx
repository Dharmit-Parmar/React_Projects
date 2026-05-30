import { motion, useMotionValue, useTransform } from 'framer-motion'
import { useState, useEffect, useRef, useMemo } from 'react'

function CardRotate({ children, onSendToBack, sensitivity, disableDrag = false }) {
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const rotateX = useTransform(y, [-100, 100], [60, -60])
    const rotateY = useTransform(x, [-100, 100], [-60, 60])

    function handleDragEnd(_, info) {
        if (Math.abs(info.offset.x) > sensitivity || Math.abs(info.offset.y) > sensitivity) {
            onSendToBack()
        } else {
            x.set(0)
            y.set(0)
        }
    }

    if (disableDrag) {
        return (
            <motion.div className="absolute inset-0 cursor-pointer" style={{ x: 0, y: 0 }}>
                {children}
            </motion.div>
        )
    }

    return (
        <motion.div
            className="absolute inset-0 cursor-grab active:cursor-grabbing will-change-transform"
            style={{ x, y, rotateX, rotateY }}
            drag
            dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
            dragElastic={0.6}
            onDragEnd={handleDragEnd}
        >
            {children}
        </motion.div>
    )
}

// ⚡ Added 'onCardChange' to the arguments block
export default function Stack({
    randomRotation = false,
    sensitivity = 200,
    cards = [],
    animationConfig = { stiffness: 260, damping: 20 },
    sendToBackOnClick = false,
    autoplay = false,
    autoplayDelay = 3000,
    pauseOnHover = false,
    mobileClickOnly = false,
    mobileBreakpoint = 768,
    onCardChange
}) {
    const [isMobile, setIsMobile] = useState(false)
    const [isPaused, setIsPaused] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < mobileBreakpoint)
        checkMobile()
        window.addEventListener('resize', checkMobile, { passive: true })
        return () => window.removeEventListener('resize', checkMobile)
    }, [mobileBreakpoint])

    const shouldDisableDrag = mobileClickOnly && isMobile
    const shouldEnableClick = sendToBackOnClick || shouldDisableDrag

    const initialStack = useMemo(() => {
        return cards.map((content, index) => ({
            id: index + 1,
            content,
            originalIndex: index, // ⚡ Store original position index to map your data cleanly
            rotationOffset: randomRotation ? Math.random() * 10 - 5 : 0
        }))
    }, [cards, randomRotation])

    const [stack, setStack] = useState(initialStack)

    const stackRef = useRef(stack)
    useEffect(() => {
        stackRef.current = stack
    }, [stack])

    // ⚡ Sync top card data on initial component mount
    useEffect(() => {
        if (onCardChange && stack.length > 0) {
            onCardChange(stack[stack.length - 1].originalIndex)
        }
    }, [])

    const sendToBack = (id) => {
        setStack((prev) => {
            const newStack = [...prev]
            const index = newStack.findIndex((card) => card.id === id)
            if (index === -1) return prev

            const [card] = newStack.splice(index, 1)
            newStack.unshift(card)

            // ⚡ Alert the parent layout exactly which dynamic project data array element is sitting on top
            if (onCardChange && newStack.length > 0) {
                onCardChange(newStack[newStack.length - 1].originalIndex)
            }

            return newStack
        })
    }

    useEffect(() => {
        if (!autoplay || isPaused) return

        const interval = setInterval(() => {
            const currentStack = stackRef.current
            if (currentStack.length > 1) {
                const topCardId = currentStack[currentStack.length - 1].id
                sendToBack(topCardId)
            }
        }, autoplayDelay)

        return () => clearInterval(interval)
    }, [autoplay, autoplayDelay, isPaused])

    return (
        <div
            className="relative w-full h-full perspective-[600px]"
            onMouseEnter={() => pauseOnHover && setIsPaused(true)}
            onMouseLeave={() => pauseOnHover && setIsPaused(false)}
        >
            {stack.map((card, index) => {
                const rotateZ = (stack.length - index - 1) * 4 + card.rotationOffset
                const scale = 1 + index * 0.06 - stack.length * 0.06

                return (
                    <CardRotate
                        key={card.id}
                        onSendToBack={() => sendToBack(card.id)}
                        sensitivity={sensitivity}
                        disableDrag={shouldDisableDrag}
                    >
                        <motion.div
                            className="rounded-3xl overflow-hidden w-full h-full border border-white/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                            onClick={() => shouldEnableClick && sendToBack(card.id)}
                            animate={{
                                rotateZ,
                                scale,
                                transformOrigin: '90% 90%',
                                opacity: index < stack.length - 3 ? 0 : 1
                            }}
                            initial={false}
                            transition={{
                                type: 'spring',
                                stiffness: animationConfig.stiffness,
                                damping: animationConfig.damping,
                                mass: 0.8
                            }}
                        >
                            {card.content}
                        </motion.div>
                    </CardRotate>
                )
            })}
        </div>
    )
}