'use client';

import { useEffect, useRef, ReactNode } from "react";
import { MOTION } from "@/lib/motion/tokens";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  once?: boolean;
  threshold?: number;
}

const ScrollReveal = ({
  children,
  className = "",
  delay = 0,
  duration = MOTION.duration.reveal,
  direction = "up",
  distance = MOTION.distance.reveal,
  once = true,
  threshold = 0.2,
}: ScrollRevealProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const getTranslate = (resolvedDistance = distance) => {
    switch (direction) {
      case "up":    return `translateY(${resolvedDistance}px)`;
      case "down":  return `translateY(-${resolvedDistance}px)`;
      case "left":  return `translateX(${resolvedDistance}px)`;
      case "right": return `translateX(-${resolvedDistance}px)`;
      case "none":  return "none";
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect prefers-reduced-motion directly, not just via the global CSS
    // !important override in app/components.css (that override is kept as a
    // defense-in-depth backstop, but this check makes the behavior explicit
    // here where the animation is actually authored).
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      el.style.opacity = "1";
      el.style.transform = "none";
      return;
    }

    // Set initial hidden state
    const resolvedDistance = window.matchMedia('(max-width: 640px)').matches
      ? Math.min(distance, 8)
      : distance;
    const easing = `cubic-bezier(${MOTION.easing.standard.join(',')})`;
    el.style.opacity = "0";
    el.style.transform = getTranslate(resolvedDistance);
    el.style.transition = `opacity ${duration}s ${easing} ${delay}s, transform ${duration}s ${easing} ${delay}s`;
    el.style.willChange = "transform, opacity";

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.style.opacity = "1";
            el.style.transform = "none";
            if (once) observer.unobserve(el);
          } else if (!once) {
            el.style.opacity = "0";
            el.style.transform = getTranslate(resolvedDistance);
          }
        });
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className={`transform-gpu ${className}`}>
      {children}
    </div>
  );
};

export default ScrollReveal;
