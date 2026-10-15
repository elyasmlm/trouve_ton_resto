import { useEffect, useRef } from 'react'

// Défilement horizontal à la souris : on attrape la rangée et on la tire (la molette la fait aussi défiler).
// Un clic qui termine un glissement est ignoré pour ne pas activer une pastille par erreur.
export function useDragScroll() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let startX = 0
    let startLeft = 0
    let down = false
    let moved = false

    const onDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      down = true
      moved = false
      startX = e.clientX
      startLeft = el.scrollLeft
    }
    const onMove = (e) => {
      if (!down) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) < 5) return
      moved = true
      el.classList.add('is-dragging')
      el.scrollLeft = startLeft - dx
    }
    const onUp = () => {
      if (!down) return
      down = false
      el.classList.remove('is-dragging')
    }
    const onClick = (e) => {
      if (moved) {
        e.preventDefault()
        e.stopPropagation()
        moved = false
      }
    }
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('click', onClick, true)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  return ref
}
