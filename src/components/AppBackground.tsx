import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * Premium fixed background:
 * - Base color #15382c (dominant green-black)
 * - Soft red blooms blended in
 * - Red bloom reacts to SCROLL VELOCITY: faster scroll => brighter, larger,
 *   more saturated glow (with subtle horizontal sway based on direction).
 */
export default function AppBackground() {
  // Vertical position (still tracks scroll position, but velocity drives intensity)
  // Use transform-based translateY to avoid CLS (changing `top` triggers layout
  // shifts that Lighthouse penalizes even though the layer is fixed/pointer-none).
  const yPct = useMotionValue(40);
  const ySpring = useSpring(yPct, { stiffness: 60, damping: 22, mass: 1 });
  const yTranslate = useTransform(ySpring, (v) => `${v - 40}vh`);

  // Velocity-driven values (0 = idle, 1 = fast scroll)
  const velocity = useMotionValue(0);
  const velocitySpring = useSpring(velocity, { stiffness: 120, damping: 18, mass: 0.6 });

  // Horizontal sway based on scroll direction (-1 up, +1 down)
  const sway = useMotionValue(0);
  const swaySpring = useSpring(sway, { stiffness: 80, damping: 20 });

  // Derived visual properties
  const opacity = useTransform(velocitySpring, [0, 1], [0.55, 1]);
  const scale = useTransform(velocitySpring, [0, 1], [1, 1.35]);
  const blurPx = useTransform(velocitySpring, [0, 1], [100, 60]);
  const filter = useTransform(blurPx, (v) => `blur(${v}px) saturate(${1 + (v < 100 ? (100 - v) / 60 : 0)})`);
  const xVw = useTransform(swaySpring, (v) => `${v * 6}vw`); // small horizontal drift

  useEffect(() => {
    let pending = false;
    let lastY = window.scrollY || 0;
    let lastT = performance.now();
    let decayRaf = 0;

    // Cache scrollable height to avoid forced reflows on every scroll frame.
    // We refresh it lazily on resize/orientationchange and via a low-frequency
    // interval, which is enough for our purely-decorative parallax effect.
    let cachedMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    let maxDirty = false;
    const refreshMax = () => {
      cachedMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      maxDirty = false;
    };
    const markDirty = () => { maxDirty = true; };

    const decay = () => {
      const cur = velocity.get();
      const next = cur * 0.92;
      velocity.set(next < 0.01 ? 0 : next);
      const curSway = sway.get();
      sway.set(curSway * 0.9);
      if (next > 0.01 || Math.abs(curSway) > 0.01) {
        decayRaf = requestAnimationFrame(decay);
      } else {
        decayRaf = 0;
      }
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const now = performance.now();
        const scrollY = window.scrollY || 0;
        const dt = Math.max(1, now - lastT);
        const dy = scrollY - lastY;
        // px per ms -> normalize: 3 px/ms ~= fast scroll
        const v = Math.min(1, Math.abs(dy) / dt / 3);
        velocity.set(Math.max(velocity.get(), v));
        sway.set(Math.sign(dy));

        // Use cached max; only re-measure when explicitly invalidated.
        if (maxDirty) refreshMax();
        const ratio = Math.min(1, scrollY / cachedMax);
        yPct.set(20 + ratio * 55);

        lastY = scrollY;
        lastT = now;
        if (!decayRaf) decayRaf = requestAnimationFrame(decay);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', markDirty, { passive: true });
    window.addEventListener('orientationchange', markDirty, { passive: true });
    // Periodic refresh to catch async content growth without per-frame reflow.
    const refreshTimer = window.setInterval(markDirty, 1500);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', markDirty);
      window.removeEventListener('orientationchange', markDirty);
      clearInterval(refreshTimer);
      if (decayRaf) cancelAnimationFrame(decayRaf);
    };
  }, [yPct, velocity, sway]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0, background: '#000000' }}
    >
      {/* Static blended green blooms — richer cinematic mixture */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 85% 70% at 88% 22%, hsl(160 45% 18% / 0.95) 0%, hsl(160 45% 15% / 0.55) 35%, transparent 70%),
            radial-gradient(ellipse 75% 65% at 12% 82%, hsl(160 45% 15% / 0.75) 0%, hsl(160 45% 12% / 0.35) 40%, transparent 75%),
            radial-gradient(ellipse 60% 50% at 50% 50%, hsl(160 45% 15% / 0.40) 0%, transparent 70%)
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

      {/* Velocity-reactive green LED bloom.
          NOTE: We intentionally do NOT wrap this in a clipping container with
          `contain: strict` / `overflow: hidden`. Hard clipping turns the soft
          radial gradient's faded edges into a visible rectangular boundary
          against the darker base — exactly the artifact users see. The outer
          fixed wrapper already has `overflow: hidden`, which is enough to keep
          paint inside the viewport. The radial gradient itself fades to
          `transparent 75%`, so its natural edges remain organic. */}
      <motion.div
        className="absolute top-0 pointer-events-none"
        style={{
          right: '-15vw',
          width: '90vw',
          height: '80vh',
          marginTop: '-40vh',
          x: xVw,
          y: yTranslate,
          scale,
          opacity,
          willChange: 'transform, opacity, filter',
          background:
            'radial-gradient(circle at center, hsl(160 50% 22% / 1) 0%, hsl(160 45% 15% / 0.65) 25%, hsl(160 45% 12% / 0.25) 55%, transparent 75%)',
          filter,
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
