import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, animate } from 'framer-motion';

/**
 * Fixed full-viewport background:
 * - Base color: #15382c (dominant green, ~90%)
 * - A soft red glow (~10%) drifts on scroll & route change, blended seamlessly
 *   into the green using `mix-blend-mode: soft-light` and heavy blur — no
 *   visible edges, just a moving warm tint.
 */
export default function AppBackground() {
  const location = useLocation();
  const sideRef = useRef<'right' | 'left'>('right');
  const transitioningRef = useRef(false);

  const xPct = useMotionValue(78);
  const yPct = useMotionValue(28);

  const xSpring = useSpring(xPct, { stiffness: 60, damping: 18, mass: 0.6 });
  const ySpring = useSpring(yPct, { stiffness: 60, damping: 18, mass: 0.6 });

  const left = useTransform(xSpring, (v) => `${v}vw`);
  const top = useTransform(ySpring, (v) => `${v}vh`);

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
      {/* Moving red tint — small, soft, blended seamlessly into the green */}
      <motion.div
        className="absolute"
        style={{
          left,
          top,
          width: '90vmax',
          height: '90vmax',
          marginLeft: '-45vmax',
          marginTop: '-45vmax',
          mixBlendMode: 'soft-light',
          opacity: 0.9,
          willChange: 'left, top',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle, hsl(0 90% 50% / 0.95) 0%, hsl(0 80% 45% / 0.55) 12%, hsl(0 60% 35% / 0.20) 32%, transparent 60%)',
            filter: 'blur(120px)',
          }}
        />
      </motion.div>

      {/* Subtle green unifying veil — keeps #15382c dominant */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 50%, hsl(155 45% 16% / 0.35) 0%, hsl(155 45% 13% / 0.55) 100%)',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}
