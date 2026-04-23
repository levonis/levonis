import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * Premium fixed background:
 * - Solid #15382c base (dominant)
 * - Single red LED-like glow on the right edge that travels vertically with scroll
 */
export default function AppBackground() {
  // Vertical position of the LED glow (in vh)
  const yPct = useMotionValue(30);
  const ySpring = useSpring(yPct, { stiffness: 60, damping: 20, mass: 0.8 });
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
        // Travel between 15vh and 80vh based on scroll position
        yPct.set(15 + ratio * 65);
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
      style={{
        zIndex: 0,
        background: '#15382c',
      }}
    >
      {/* Red LED glow on the right edge — follows scroll */}
      <motion.div
        className="absolute"
        style={{
          top,
          right: 0,
          width: '40vw',
          height: '40vh',
          marginTop: '-20vh',
          marginRight: '-15vw',
          willChange: 'top',
        }}
      >
        {/* Outer soft halo */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, hsl(0 95% 55% / 0.45) 0%, hsl(0 90% 50% / 0.18) 30%, transparent 65%)',
            filter: 'blur(60px)',
            mixBlendMode: 'screen',
          }}
        />
        {/* Bright LED core */}
        <div
          className="absolute"
          style={{
            top: '50%',
            right: '15vw',
            width: '24px',
            height: '24px',
            marginTop: '-12px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, hsl(0 100% 65%) 0%, hsl(0 100% 55%) 40%, hsl(0 95% 45% / 0.6) 70%, transparent 100%)',
            boxShadow:
              '0 0 24px 8px hsl(0 100% 55% / 0.6), 0 0 60px 20px hsl(0 95% 50% / 0.35)',
            mixBlendMode: 'screen',
          }}
        />
      </motion.div>
    </div>
  );
}
