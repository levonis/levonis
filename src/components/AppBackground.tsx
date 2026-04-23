import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, animate } from 'framer-motion';

/**
 * Premium fixed full-viewport background:
 * - Dominant base: deep emerald (#15382c) blending into black
 * - Cinematic red light "ribbons" flowing along the edges (top-right & bottom-left)
 * - Soft drift on scroll & route change so the red feels alive
 */
export default function AppBackground() {
  const location = useLocation();
  const transitioningRef = useRef(false);

  // Drift offsets for the red ribbons (in %)
  const driftA = useMotionValue(0); // top-right ribbon
  const driftB = useMotionValue(0); // bottom-left ribbon

  const driftASpring = useSpring(driftA, { stiffness: 28, damping: 24, mass: 1 });
  const driftBSpring = useSpring(driftB, { stiffness: 28, damping: 24, mass: 1 });

  const ribbonATransform = useTransform(
    driftASpring,
    (v) => `translate3d(${v * 0.6}%, ${-v * 0.4}%, 0) rotate(${-8 + v * 0.05}deg)`
  );
  const ribbonBTransform = useTransform(
    driftBSpring,
    (v) => `translate3d(${-v * 0.6}%, ${v * 0.4}%, 0) rotate(${-8 - v * 0.05}deg)`
  );

  // Cinematic intensity pulse on route change
  const intensity = useMotionValue(1);
  const intensityOpacity = useTransform(intensity, [1, 1.6], [0.9, 1]);

  // Continuous gentle breathing
  useEffect(() => {
    const a = animate(driftA, [0, 6, -4, 0], {
      duration: 18,
      repeat: Infinity,
      ease: 'easeInOut',
    });
    const b = animate(driftB, [0, -5, 4, 0], {
      duration: 22,
      repeat: Infinity,
      ease: 'easeInOut',
    });
    return () => {
      a.stop();
      b.stop();
    };
  }, [driftA, driftB]);

  // Scroll: subtle parallax shift
  useEffect(() => {
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (transitioningRef.current) return;
        const scrollY = window.scrollY || 0;
        const sway = Math.sin(scrollY / 420) * 8;
        driftA.set(sway);
        driftB.set(-sway);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [driftA, driftB]);

  // Route change: cinematic flare
  useEffect(() => {
    transitioningRef.current = true;
    const ease = [0.22, 1, 0.36, 1] as const;
    const flare = animate(intensity, [1, 1.6, 1], { duration: 1.4, ease });
    flare.then(() => {
      transitioningRef.current = false;
    });
    return () => {
      flare.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // The red ribbon — an SVG curve with a soft red glow stroke
  const RedRibbon = ({ flip = false }: { flip?: boolean }) => (
    <svg
      viewBox="0 0 1000 600"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
      style={{ transform: flip ? 'scale(-1, -1)' : undefined }}
    >
      <defs>
        <linearGradient id={`ribbon-grad-${flip ? 'b' : 'a'}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(0 90% 55%)" stopOpacity="0" />
          <stop offset="35%" stopColor="hsl(0 95% 58%)" stopOpacity="0.85" />
          <stop offset="65%" stopColor="hsl(0 100% 62%)" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(0 90% 50%)" stopOpacity="0" />
        </linearGradient>
        <filter id={`ribbon-blur-${flip ? 'b' : 'a'}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id={`ribbon-glow-${flip ? 'b' : 'a'}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* Wide soft halo */}
      <path
        d="M 1100 80 C 850 180, 700 240, 520 300 S 200 420, -100 520"
        stroke={`url(#ribbon-grad-${flip ? 'b' : 'a'})`}
        strokeWidth="55"
        fill="none"
        opacity="0.35"
        filter={`url(#ribbon-glow-${flip ? 'b' : 'a'})`}
      />
      {/* Mid glow */}
      <path
        d="M 1100 80 C 850 180, 700 240, 520 300 S 200 420, -100 520"
        stroke={`url(#ribbon-grad-${flip ? 'b' : 'a'})`}
        strokeWidth="14"
        fill="none"
        opacity="0.7"
        filter={`url(#ribbon-blur-${flip ? 'b' : 'a'})`}
      />
      {/* Sharp core line */}
      <path
        d="M 1100 80 C 850 180, 700 240, 520 300 S 200 420, -100 520"
        stroke={`url(#ribbon-grad-${flip ? 'b' : 'a'})`}
        strokeWidth="2"
        fill="none"
        opacity="1"
      />
    </svg>
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{
        zIndex: 0,
        background:
          'radial-gradient(120% 100% at 30% 20%, hsl(160 45% 12%) 0%, hsl(160 40% 8%) 38%, hsl(0 0% 3%) 100%)',
      }}
    >
      {/* Subtle hex/dot texture overlay for depth (very faint) */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, hsl(160 40% 40% / 0.6) 1px, transparent 1.5px)',
          backgroundSize: '22px 22px',
          maskImage:
            'radial-gradient(ellipse at 15% 15%, black 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, black 0%, transparent 55%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at 15% 15%, black 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, black 0%, transparent 55%)',
        }}
      />

      {/* Top-right red ribbon */}
      <motion.div
        className="absolute"
        style={{
          top: '-10%',
          right: '-15%',
          width: '85vw',
          height: '85vh',
          transform: ribbonATransform,
          opacity: intensityOpacity,
          mixBlendMode: 'screen',
          willChange: 'transform, opacity',
        }}
      >
        <RedRibbon />
      </motion.div>

      {/* Bottom-left red ribbon (mirrored) */}
      <motion.div
        className="absolute"
        style={{
          bottom: '-10%',
          left: '-15%',
          width: '85vw',
          height: '85vh',
          transform: ribbonBTransform,
          opacity: intensityOpacity,
          mixBlendMode: 'screen',
          willChange: 'transform, opacity',
        }}
      >
        <RedRibbon flip />
      </motion.div>

      {/* Soft green light bloom at top-center for depth (matches reference) */}
      <div
        className="absolute"
        style={{
          top: '-20%',
          left: '20%',
          width: '60vw',
          height: '50vh',
          background:
            'radial-gradient(ellipse at center, hsl(155 50% 22% / 0.6) 0%, hsl(160 45% 14% / 0.3) 40%, transparent 70%)',
          filter: 'blur(40px)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Black depth wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, transparent 50%, hsl(0 0% 0% / 0.45) 100%)',
        }}
      />

      {/* Cinematic vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(140% 100% at 50% 50%, transparent 55%, hsl(0 0% 0% / 0.45) 100%)',
        }}
      />
    </div>
  );
}
