/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLayoutEffect, useRef, useState, useCallback, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

/**
 * Measures the container width, lays out children at that width,
 * then scales everything down proportionally if content height exceeds
 * the container height. Horizontal fit is always 1:1 (no h-scale).
 *
 * Portrait: content fits vertically → scale ≈ 1, no change.
 * Landscape: content too tall → scale < 1, everything shrinks uniformly.
 */
export function ViewportScaleFit({
  children,
  className = '',
  innerClassName = '',
}: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const [state, setState] = useState({ s: 1, cw: 0, ih: 0, ready: false });

  const update = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const cw = outer.clientWidth;
    const ch = outer.clientHeight;
    if (cw < 4 || ch < 4) return;

    inner.style.width = `${cw}px`;
    const ih = inner.scrollHeight;
    if (ih < 2) return;

    const s = Math.min(1, ch / ih);
    setState(prev => {
      if (prev.s === s && prev.cw === cw && prev.ih === ih && prev.ready) return prev;
      return { s, cw, ih, ready: true };
    });
  }, []);

  useLayoutEffect(() => {
    update();
    rafRef.current = requestAnimationFrame(update);
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    });
    if (outerRef.current) ro.observe(outerRef.current);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener('orientationchange', update);
    };
  }, [update]);

  const { s, cw, ih, ready } = state;

  return (
    <div
      ref={outerRef}
      className={`flex min-h-0 w-full items-center justify-center overflow-hidden ${className}`}
    >
      <div
        className="relative shrink-0"
        style={ready ? { width: cw * s, height: ih * s } : undefined}
      >
        <div
          ref={innerRef}
          className={innerClassName}
          style={
            ready
              ? {
                  position: 'absolute' as const,
                  left: 0,
                  top: 0,
                  width: cw,
                  transform: `scale(${s})`,
                  transformOrigin: 'top left',
                }
              : { visibility: 'hidden' as const, position: 'absolute' as const }
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
