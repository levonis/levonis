import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, animate } from 'framer-motion';

/**
 * Fixed full-viewport background:
 * - Base: #15382c (≥75%) blended into near-black (≥20%)
 * - A red light orb (≤5%) drifts as the user scrolls (descends + sways)
 * - On route change, the orb travels along the bottom edge to the opposite
 *   side, climbs back up the opposite edge, and stays there.
 *
 * Coordinates are stored as percentages and converted to CSS via calc(% vw/vh).
 */
export default function AppBackground() {
  const location = useLocation();
  const sideRef = useRef<'right' | 'left'>('right');
  const transitioningRef = useRef(false);

  // Percentages of the viewport (0–100)
  const xPct = useMotionValue(78);
  const yPct = useMotionValue(28);

  const xSpring = useSpring(xPct, { stiffness: 60, damping: 18, mass: 0.6 });
  const ySpring = useSpring(yPct, { stiffness: 60, damping: 18, mass: 0.6 });

  // Convert % values to CSS strings for left/top
  const left = useTransform(xSpring, (v) => `${v}vw`);
  const top = useTransform(ySpring, (v) => `${v}vh`);
  // Black anchor — always on the opposite side of the red
  const blackLeft = useTransform(xSpring, (v) => `${100 - v}vw`);
  const blackTop = useTransform(ySpring, (v) => `${100 - v}vh`);

  // Scroll-driven motion (descends + sways around the current side)
  useEffect(() => {
    let pending = false;

    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (transitioningRef.current) return;
        const scrollY = window.scrollY || 0;
        const baseX = sideRef.current === 'right' ? 78 : 22;
        const sway = Math.sin(scrollY / 300) * 4;
        const targetY = Math.min(75, Math.max(22, 22 + scrollY * 0.04));
        xPct.set(baseX + sway);
        yPct.set(targetY);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [xPct, yPct]);

  // Route-change choreography: travel along the edge to the opposite side
  useEffect(() => {
    const nextSide: 'right' | 'left' = sideRef.current === 'right' ? 'left' : 'right';
    const targetX = nextSide === 'right' ? 78 : 22;
    transitioningRef.current = true;

    const ease = [0.65, 0, 0.35, 1] as const;
    const c1 = animate(yPct, 92, { duration: 0.22, ease });
    let c2: ReturnType<typeof animate> | null = null;
    let c3: ReturnType<typeof animate> | null = null;

    c1.then(() => {
      c2 = animate(xPct, targetX, { duration: 0.34, ease });
      c2.then(() => {
        c3 = animate(yPct, 24, { duration: 0.26, ease });
        c3.then(() => {
          sideRef.current = nextSide;
          transitioningRef.current = false;
        });
      });
    });

    return () => {
      c1.stop();
      c2?.stop();
      c3?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{
        zIndex: -1,
        backgroundColor: '#15382c',
      }}
    >
      {/* Black mass anchored opposite to the red — drifts with it */}
      <motion.div
        className="absolute"
        style={{
          left: blackLeft,
          top: blackTop,
          width: '180vmax',
          height: '180vmax',
          marginLeft: '-90vmax',
          marginTop: '-90vmax',
          willChange: 'left, top',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle, hsl(0 0% 0% / 0.85) 0%, hsl(0 0% 0% / 0.55) 18%, hsl(0 0% 0% / 0.30) 35%, hsl(0 0% 0% / 0.12) 55%, transparent 80%)',
            filter: 'blur(140px)',
          }}
        />
      </motion.div>

      {/* Concentrated red orb — smaller footprint, higher intensity, fully diffused */}
      <motion.div
        className="absolute"
        style={{
          left,
          top,
          width: '70vmax',
          height: '70vmax',
          marginLeft: '-35vmax',
          marginTop: '-35vmax',
          mixBlendMode: 'screen',
          willChange: 'left, top',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle, hsl(0 95% 52% / 0.95) 0%, hsl(0 90% 48% / 0.55) 14%, hsl(0 85% 42% / 0.25) 30%, hsl(0 75% 35% / 0.08) 50%, transparent 78%)',
            filter: 'blur(90px)',
          }}
        />
      </motion.div>

      {/* Final unifying veil to remove any remaining edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(150% 110% at 50% 50%, transparent 55%, hsl(0 0% 0% / 0.30) 100%)',
        }}
      />
    </div>
  );
}
