'use client';

import { useEffect, useRef, ReactNode } from "react";

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
  duration = 0.6,
  direction = "up",
  distance = 50,
  once = true,
  threshold = 0.2,
}: ScrollRevealProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const getTranslate = () => {
    switch (direction) {
      case "up":    return `translateY(${distance}px)`;
      case "down":  return `translateY(-${distance}px)`;
      case "left":  return `translateX(${distance}px)`;
      case "right": return `translateX(-${distance}px)`;
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
    el.style.opacity = "0";
    el.style.transform = getTranslate();
    el.style.transition = `opacity ${duration}s cubic-bezier(0.25,0.1,0.25,1) ${delay}s, transform ${duration}s cubic-bezier(0.25,0.1,0.25,1) ${delay}s`;
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
            el.style.transform = getTranslate();
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
