import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * Premium fixed background:
 * - Base color #15382c (dominant green-black)
 * - Soft red gradient blooms blended in (secondary)
 * - A subtle red highlight that drifts vertically with scroll
 */
export default function AppBackground() {
  // Vertical position of the red bloom (in vh)
  const yPct = useMotionValue(40);
  const ySpring = useSpring(yPct, { stiffness: 50, damping: 22, mass: 1 });
  const top = useTransform(ySpring, (v) => `${v}vh`);

  useEffect(() => {
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const scrollY = window.scrollY || 0;
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const ratio = Math.min(1, scrollY / max);
        // Travel between 20vh and 75vh based on scroll
        yPct.set(20 + ratio * 55);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [yPct]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0, background: '#15382c' }}
    >
      {/* Static blended red blooms — richer cinematic mixture */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 85% 70% at 88% 22%, hsl(0 95% 55% / 0.85) 0%, hsl(355 90% 50% / 0.45) 35%, transparent 70%),
            radial-gradient(ellipse 75% 65% at 12% 82%, hsl(355 90% 50% / 0.65) 0%, hsl(0 85% 45% / 0.30) 40%, transparent 75%),
            radial-gradient(ellipse 60% 50% at 50% 50%, hsl(10 80% 45% / 0.35) 0%, transparent 70%)
          `,
          filter: 'blur(60px)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Deep green vignette to anchor the base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, hsl(160 45% 5% / 0.45) 100%)',
        }}
      />

      {/* Scroll-following red bloom — bigger & brighter */}
      <motion.div
        className="absolute"
        style={{
          top,
          right: '-15vw',
          width: '90vw',
          height: '80vh',
          marginTop: '-40vh',
          willChange: 'top',
          background:
            'radial-gradient(circle at center, hsl(0 95% 58% / 0.95) 0%, hsl(355 90% 50% / 0.55) 25%, hsl(350 80% 40% / 0.20) 55%, transparent 75%)',
          filter: 'blur(100px)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Subtle film grain via gradient noise */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(hsl(0 0% 100% / 0.6) 1px, transparent 1px)',
          backgroundSize: '3px 3px',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}
