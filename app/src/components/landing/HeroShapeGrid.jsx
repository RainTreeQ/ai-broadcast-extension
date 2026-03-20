import { useEffect, useMemo, useRef, useState } from "react";
import ShapeGrid from "@/components/ShapeGrid";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function resolveCssColorToRgb(color) {
  if (typeof window === "undefined") return null;
  try {
    const probe = document.createElement("span");
    probe.style.color = color;
    probe.style.position = "absolute";
    probe.style.left = "-9999px";
    probe.style.top = "-9999px";
    document.body.appendChild(probe);
    const resolved = window.getComputedStyle(probe).color;
    document.body.removeChild(probe);
    return resolved || null;
  } catch {
    return null;
  }
}

/**
 * Hero background: subtle animated shape grid.
 * - Uses design tokens via CSS variables (no hardcoded colors).
 * - `color-mix` for soft contrast in both themes.
 * - Mouse parallax is gentle and bounded; auto-disables for reduced motion.
 */
export function HeroShapeGrid({ className }) {
  const rootRef = useRef(null);
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const [colors, setColors] = useState(() => ({
    border: "rgb(237, 237, 237)",
    hover: "rgb(237, 237, 237)",
  }));

  useEffect(() => {
    // Resolve token colors to rgb for canvas consistency (avoid color-mix/oklch parsing edge cases).
    const updateColors = () => {
      // 动态判断深浅色模式：浅色下我们用深一点点的透明色画网格，深色下用更浅的透明色。
      const isDark = document.documentElement.classList.contains("dark");
      
      let nextBorder, nextHover;
      
      if (isDark) {
        // Dark mode: very subtle light lines
        nextBorder = resolveCssColorToRgb("color-mix(in oklab, var(--foreground) 6%, transparent)") || "rgba(255,255,255,0.06)";
        nextHover = resolveCssColorToRgb("color-mix(in oklab, var(--foreground) 10%, transparent)") || "rgba(255,255,255,0.1)";
      } else {
        // Light mode: very subtle dark lines
        nextBorder = resolveCssColorToRgb("color-mix(in oklab, var(--foreground) 4%, transparent)") || "rgba(0,0,0,0.04)";
        nextHover = resolveCssColorToRgb("color-mix(in oklab, var(--foreground) 8%, transparent)") || "rgba(0,0,0,0.08)";
      }

      setColors((prev) => ({
        border: nextBorder || prev.border,
        hover: nextHover || prev.hover,
      }));
    };

    updateColors();
    
    // 监听暗黑模式切换
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "class") {
          updateColors();
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const el = rootRef.current;
    if (!el) return undefined;

    let raf = 0;
    const handleMove = (event) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const dx = clamp((x - 0.5) * 10, -6, 6);
        const dy = clamp((y - 0.5) * 10, -6, 6);
        el.style.setProperty("--aib-grid-x", `${dx}px`);
        el.style.setProperty("--aib-grid-y", `${dy}px`);
      });
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", handleMove);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={[
        "pointer-events-none absolute inset-0",
        "[--aib-grid-x:0px] [--aib-grid-y:0px]",
        className || "",
      ].join(" ")}
    >
      <div className="absolute inset-0">
          <div
          className={[
            "absolute inset-0",
            // 超平滑的渐隐：顶部清晰，向下非常柔和地过渡到完全透明
            "[mask-image:radial-gradient(1100px_800px_at_50%_10%,black_0%,rgba(0,0,0,0.6)_40%,transparent_80%)]",
            "opacity-80",
            "translate-x-[var(--aib-grid-x)] translate-y-[var(--aib-grid-y)]",
            "transition-transform duration-700 ease-out",
          ].join(" ")}
        >
          <ShapeGrid
            speed={prefersReducedMotion ? 0 : 0.2}
            squareSize={75}
            direction="diagonal"
            borderColor={colors.border}
            hoverFillColor={colors.hover}
            shape="square"
            hoverTrailAmount={2}
            listenOnWindow
          />
          {/* Soft top wash to blend into the hero lighting */}
          <div className="absolute inset-0 bg-linear-to-b from-background/35 via-transparent to-transparent" />
        </div>
      </div>
    </div>
  );
}

