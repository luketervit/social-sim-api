"use client";

import * as React from "react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Fire once and stay visible. Default true. */
  once?: boolean;
  /** Top/bottom margin for IntersectionObserver. Default trigger when 15% in. */
  threshold?: number;
  as?: "div" | "h1" | "h2" | "h3" | "section" | "footer" | "span";
  style?: React.CSSProperties;
};

export default function Reveal({
  children,
  className = "",
  once = true,
  threshold = 0.15,
  as = "div",
  style,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) io.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold]);

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      className={`${className} ${visible ? "is-visible" : ""}`}
      style={style}
    >
      {children}
    </Tag>
  );
}
