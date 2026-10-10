import { useEffect, useState } from 'react'

/** Tailwind `md` breakpoint (768px). True below that. */
export function useIsMobile(breakpointPx = 768) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [breakpointPx])

  return mobile
}
