import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, animate } from 'framer-motion';

/**
 * Premium fixed full-viewport background:
 * - Dominant base: #15382c (deep emerald)
 * - Subtle red "living light" — small, soft, drifts on scroll & route change
 * - Black depth wash for cinematic vignette / luxury feel
 *
 * All accents use soft-light / multiply blends with heavy blur so nothing
 * reads as a separate layer — just a single, breathing gradient.
 */
export default function AppBackground() {
  const location = useLocation();
  const sideRef = useRef<'right' | 'left'>('right');
  const transitioningRef = useRef(false);

  // Red glow position (% of viewport)
  const xPct = useMotionValue(75);
  const yPct = useMotionValue(30);

  const xSpring = useSpring(xPct, { stiffness: 40, damping: 22, mass: 0.9 });
  const ySpring = useSpring(yPct, { stiffness: 40, damping: 22, mass: 0.9 });

  const left = useTransform(xSpring, (v) => `${v}vw`);
  const top = useTransform(ySpring, (v) => `${v}vh`);

  // Secondary red ember on opposite side — even subtler
  const left2 = useTransform(xSpring, (v) => `${100 - v}vw`);
  const top2 = useTransform(ySpring, (v) => `${100 - v * 0.6}vh`);

  // Cinematic intensity pulse on route change
  const intensity = useMotionValue(1);
  const intensityOpacity = useTransform(intensity, [1, 1.6], [0.85, 1]);

  // Scroll choreography
  useEffect(() => {
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (transitioningRef.current) return;
        const scrollY = window.scrollY || 0;
        const baseX = sideRef.current === 'right' ? 75 : 25;
        const sway = Math.sin(scrollY / 380) * 5;
        const targetY = Math.min(72, Math.max(24, 24 + scrollY * 0.035));
        xPct.set(baseX + sway);
        yPct.set(targetY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [xPct, yPct]);

  // Route change: cinematic subtle motion
  useEffect(() => {
    const nextSide: 'right' | 'left' = sideRef.current === 'right' ? 'left' : 'right';
    const targetX = nextSide === 'right' ? 75 : 25;
    transitioningRef.current = true;

    const ease = [0.22, 1, 0.36, 1] as const; // cinematic easeOutQuint
    const flare = animate(intensity, [1, 1.6, 1], { duration: 1.2, ease });
    const dip = animate(yPct, 88, { duration: 0.45, ease });
    let cross: ReturnType<typeof animate> | null = null;
    let rise: ReturnType<typeof animate> | null = null;

    dip.then(() => {
      cross = animate(xPct, targetX, { duration: 0.55, ease });
      cross.then(() => {
        rise = animate(yPct, 28, { duration: 0.45, ease });
        rise.then(() => {
          sideRef.current = nextSide;
          transitioningRef.current = false;
        });
      });
    });

    return () => {
      flare.stop();
      dip.stop();
      cross?.stop();
      rise?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{
        zIndex: 0,
        background:
          'radial-gradient(140% 120% at 18% 14%, hsl(var(--background) / 0.96) 0%, hsl(var(--background)) 42%, hsl(var(--background-2) / 0.92) 100%), linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.98) 58%, hsl(var(--background-2) / 0.88) 100%)',
      }}
    >
      {/* Primary red living light — screen blend so it actually glows on dark green */}
      <motion.div
        className="absolute"
        style={{
          left,
          top,
          width: '85vmax',
          height: '85vmax',
          marginLeft: '-42.5vmax',
          marginTop: '-42.5vmax',
          mixBlendMode: 'screen',
          opacity: intensityOpacity,
          willChange: 'left, top, opacity',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle, hsl(var(--accent-red) / 0.52) 0%, hsl(var(--accent-red) / 0.24) 20%, hsl(var(--accent-red) / 0.08) 42%, transparent 68%)',
            filter: 'blur(120px)',
          }}
        />
      </motion.div>

      {/* Secondary faint red ember — mirrors the primary on opposite side */}
      <motion.div
        className="absolute"
        style={{
          left: left2,
          top: top2,
          width: '60vmax',
          height: '60vmax',
          marginLeft: '-30vmax',
          marginTop: '-30vmax',
          mixBlendMode: 'screen',
          opacity: 0.4,
          willChange: 'left, top',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle, hsl(var(--accent-red) / 0.22) 0%, hsl(var(--accent-red) / 0.10) 32%, transparent 62%)',
            filter: 'blur(140px)',
          }}
        />
      </motion.div>

      {/* Black depth wash — diagonal, adds luxurious depth without flatness */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(215deg, transparent 0%, transparent 55%, hsl(0 0% 0% / 0.40) 100%)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Final cinematic vignette */}
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
