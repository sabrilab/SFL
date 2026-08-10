"use client";

// Apparition au scroll — chaque module du récap monte en fondu (fade + petite
// translation + défloutage) quand il entre dans le viewport, une seule fois.
// Respecte prefers-reduced-motion : dans ce cas le contenu est rendu tel quel.

import { motion, useReducedMotion } from "motion/react";

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.65, ease: [0.22, 0.9, 0.24, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
