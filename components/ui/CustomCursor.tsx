'use client'

import { useEffect, useRef } from 'react'

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const dotRef    = useRef<HTMLDivElement>(null)
  const mouse     = useRef({ x: 0, y: 0 })
  const cursor    = useRef({ x: 0, y: 0 })
  // Stepped movement: position snaps every N frames instead of interpolating smoothly
  const frameCount = useRef(0)

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY }
      // Dot follows instantly (1:1) — feels like the hardware cursor
      if (dotRef.current) {
        dotRef.current.style.left = e.clientX + 'px'
        dotRef.current.style.top  = e.clientY + 'px'
      }
    }

    const animate = () => {
      frameCount.current++
      // Update the outer ring only every 3 frames → stepped / low-framerate trail feel
      if (frameCount.current % 3 === 0) {
        cursor.current.x += (mouse.current.x - cursor.current.x) * 0.35
        cursor.current.y += (mouse.current.y - cursor.current.y) * 0.35
        if (cursorRef.current) {
          cursorRef.current.style.left = cursor.current.x + 'px'
          cursorRef.current.style.top  = cursor.current.y + 'px'
        }
      }
      requestAnimationFrame(animate)
    }

    const handleEnter = () => {
      if (cursorRef.current) {
        cursorRef.current.style.width       = '40px'
        cursorRef.current.style.height      = '40px'
        cursorRef.current.style.borderColor = 'rgba(0,255,136,0.8)'
      }
    }

    const handleLeave = () => {
      if (cursorRef.current) {
        cursorRef.current.style.width       = '20px'
        cursorRef.current.style.height      = '20px'
        cursorRef.current.style.borderColor = 'var(--null-green)'
      }
    }

    document.addEventListener('mousemove', handleMove)

    const addListeners = () => {
      document.querySelectorAll('a, button, [data-cursor]').forEach(el => {
        el.addEventListener('mouseenter', handleEnter)
        el.addEventListener('mouseleave', handleLeave)
      })
    }

    const raf = requestAnimationFrame(animate)
    addListeners()

    const observer = new MutationObserver(addListeners)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      document.removeEventListener('mousemove', handleMove)
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  return (
    <>
      <div id="cursor"     ref={cursorRef} />
      <div id="cursor-dot" ref={dotRef}    />
    </>
  )
}
