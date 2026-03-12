import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const COLORS = ["#f59e0b", "#a855f7", "#3b82f6", "#ef4444", "#10b981", "#ec4899"];

interface Particle {
  id: number;
  x: number;
  delay: number;
  color: string;
  size: number;
}

export default function Confetti() {
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 6,
    }))
  );

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: -10,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: "100vh", opacity: 0, rotate: 360 + Math.random() * 360 }}
          transition={{
            duration: 2 + Math.random(),
            delay: p.delay,
            ease: "easeIn",
          }}
        />
      ))}
    </div>
  );
}
