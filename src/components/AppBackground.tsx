import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useMotionValue, useSpring, animate } from 'framer-motion';

/**
 * Fixed full-viewport background:
 * - Base: #15382c (≥75%) blended into near-black (≥20%)
 * - A red light orb (≤5%) drifts as the user scrolls (descends + sways)
 * - On route change, the orb travels along the bottom edge to the opposite
 *   side, climbs back up the opposite edge, and stays there.
 */
export default function AppBackground() {
  const location = useLocation();
  const sideRef = useRef<'right' | 'left'>('right');
  const transitioningRef = useRef(false);

  // Coordinates as percentages of the viewport (vw / vh)
  const xPct = useMotionValue(78); // start on the right
  const yPct = useMotionValue(28);

  const x = useSpring(xPct, { stiffness: 60, damping: 18, mass: 0.6 });
  const y = useSpring(yPct, { stiffness: 60, damping: 18, mass: 0.6 });

  // Scroll-driven motion (descends + sways around the current side)
  useEffect(() => {
    let frame = 0;
    let pending = false;

    const onScroll = () => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(() => {
        pending = false;
        if (transitioningRef.current) return;
        const scrollY = window.scrollY || 0;
        const baseX = sideRef.current === 'right' ? 78 : 22;
        const sway = Math.sin(scrollY / 300) * 4;
        const targetY = Math.min(75, Math.max(20, 22 + scrollY * 0.04));
        xPct.set(baseX + sway);
        yPct.set(targetY);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [xPct, yPct]);

  // Route-change choreography: travel along the edge to the opposite side
  useEffect(() => {
    const nextSide: 'right' | 'left' = sideRef.current === 'right' ? 'left' : 'right';
    const targetX = nextSide === 'right' ? 78 : 22;
    transitioningRef.current = true;

    const ease = [0.65, 0, 0.35, 1] as const;
    const ctrlY1 = animate(yPct, 92, { duration: 0.22, ease });
    ctrlY1.then(() => {
      const ctrlX = animate(xPct, targetX, { duration: 0.34, ease });
      ctrlX.then(() => {
        const ctrlY2 = animate(yPct, 22, { duration: 0.26, ease });
        ctrlY2.then(() => {
          sideRef.current = nextSide;
          transitioningRef.current = false;
        });
      });
    });

    return () => {
      ctrlY1.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 90% at 10% 100%, hsl(0 0% 3%) 0%, transparent 55%), linear-gradient(160deg, #15382c 0%, #15382c 65%, #0a0a0a 100%)',
      }}
    >
      {/* Subtle vignette to deepen edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 50%, transparent 55%, hsl(0 0% 0% / 0.55) 100%)',
        }}
      />

      {/* Red drifting orb */}
      <motion.div
        className="absolute"
        style={{
          left: x.get() + 'vw',
          top: y.get() + 'vh',
          x,
          y,
          width: '38vmax',
          height: '38vmax',
          marginLeft: '-19vmax',
          marginTop: '-19vmax',
          translateX: 0,
          translateY: 0,
          background:
            'radial-gradient(circle, hsl(0 80% 50% / 0.55) 0%, hsl(0 75% 40% / 0.25) 35%, transparent 65%)',
          filter: 'blur(60px)',
          mixBlendMode: 'screen',
          willChange: 'transform',
        }}
      />
    </div>
  );
}
