import { useEffect, useRef, useState } from "react";

/**
 * Wraps a card/item and adds a scroll-in animation when it enters the viewport.
 * Use on individual cards or slides — not full page sections — so transforms do not
 * affect the hero or create extra scrollbars.
 */
export default function ScrollReveal({ children, className = "", as: Tag = "div" }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      {
        rootMargin: "0px 0px -40px 0px",
        threshold: 0.1,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={[className, "scroll-reveal-mobile", inView && "scroll-reveal-in"]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}
