import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function padRect(r, pad) {
  return {
    left: r.left - pad,
    top: r.top - pad,
    right: r.right + pad,
    bottom: r.bottom + pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

function rectFromEl(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r || !Number.isFinite(r.left)) return null;
  return {
    left: r.left,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  };
}

function unionRects(rects) {
  const rs = rects.filter(Boolean);
  if (rs.length === 0) return null;
  let left = rs[0].left;
  let top = rs[0].top;
  let right = rs[0].right;
  let bottom = rs[0].bottom;
  for (const r of rs.slice(1)) {
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/**
 * Interactive spotlight overlay.
 *
 * - Dims the entire app.
 * - Cuts out one or more rounded-rect "holes" around target elements.
 * - Shows a popover at a requested location.
 */
export function TutorialTour({
  active,
  step,
  totalSteps,
  targets = [],
  placement = 'auto',
  title,
  body,
  primaryActionLabel = 'Next',
  showBack = false,
  onNext,
  onBack,
  onClose,
}) {
  const popoverRef = useRef(null);
  const [viewport, setViewport] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  const [rects, setRects] = useState([]);
  const [popoverPos, setPopoverPos] = useState({ left: 0, top: 0 });

  const paddedRects = useMemo(() => {
    const PAD = 10;
    return rects.map((r) => padRect(r, PAD));
  }, [rects]);

  const spotlightUnion = useMemo(() => unionRects(paddedRects), [paddedRects]);

  useLayoutEffect(() => {
    if (!active) return;

    const update = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      const nextRects = targets
        .map((t) => {
          const el = t?.current ?? t;
          return rectFromEl(el);
        })
        .filter(Boolean);
      setRects(nextRects);
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    const ro = new ResizeObserver(update);
    for (const t of targets) {
      const el = t?.current ?? t;
      if (el) ro.observe(el);
    }

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      ro.disconnect();
    };
  }, [active, targets, step]);

  useLayoutEffect(() => {
    if (!active) return;
    const popEl = popoverRef.current;
    if (!popEl) return;

    const popW = popEl.getBoundingClientRect().width || 320;
    const popH = popEl.getBoundingClientRect().height || 140;
    const GAP = 12;

    const vw = viewport.w;
    const vh = viewport.h;

    let left = vw * 0.5 - popW * 0.5;
    let top = vh * 0.2;

    const r0 = paddedRects[0] ?? null;
    const r1 = paddedRects[1] ?? null;

    if (placement === 'between' && r0 && r1) {
      const gapLeft = Math.min(r0.right, r1.right);
      const gapRight = Math.max(r0.left, r1.left);
      const midX = (gapLeft + gapRight) / 2;
      left = midX - popW / 2;
      top = clamp(Math.min(r0.top, r1.top) + 24, 16, vh - popH - 16);
    } else if (placement === 'vizTopRight' && r0) {
      left = r0.right - popW - 16;
      top = r0.top + 16;
    } else if (placement === 'belowTarget' && r0) {
      left = r0.left + r0.width / 2 - popW / 2;
      top = r0.bottom + GAP;
    } else if (placement === 'leftOfTarget' && r0) {
      left = r0.left - popW - GAP;
      top = r0.top + Math.min(60, r0.height / 2);
    } else if (placement === 'overVizLeft' && r0 && spotlightUnion) {
      // Aimed at: "left of side panel, over the visualization panel".
      left = r0.left - popW - GAP;
      top = clamp(spotlightUnion.top + 32, 16, vh - popH - 16);
    } else {
      // auto: keep near top third
      if (spotlightUnion) {
        left = spotlightUnion.left + spotlightUnion.width / 2 - popW / 2;
        top = spotlightUnion.top - popH - GAP;
        if (top < 12) top = spotlightUnion.bottom + GAP;
      }
    }

    left = clamp(left, 16, vw - popW - 16);
    top = clamp(top, 16, vh - popH - 16);
    setPopoverPos({ left, top });
  }, [active, paddedRects, placement, spotlightUnion, viewport]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, onClose]);

  if (!active) return null;

  const holeRadius = 12;

  return (
    <div className="tour-overlay" role="presentation">
      <svg className="tour-overlay__svg" width={viewport.w} height={viewport.h} aria-hidden="true">
        <defs>
          <filter id="tourGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 0.65 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {paddedRects.map((r, idx) => (
          <rect
            key={idx}
            x={r.left}
            y={r.top}
            width={r.width}
            height={r.height}
            rx={holeRadius}
            ry={holeRadius}
            fill="transparent"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="2"
            filter="url(#tourGlow)"
            pointerEvents="none"
          />
        ))}
      </svg>

      <div
        ref={popoverRef}
        className="tour-popover"
        style={{ left: `${popoverPos.left}px`, top: `${popoverPos.top}px` }}
        role="dialog"
        aria-modal="true"
        aria-label="Tutorial"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tour-popover__top">
          <div className="tour-popover__step">
            Step {step + 1} / {totalSteps}
          </div>
          <button type="button" className="tour-popover__close" aria-label="Close tutorial" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="tour-popover__title">{title}</div>
        <div className="tour-popover__body">{body}</div>
        <div className="tour-popover__actions">
          {showBack && (
            <button type="button" className="tour-popover__btn" onClick={onBack}>
              Back
            </button>
          )}
          <button type="button" className="tour-popover__btn tour-popover__btn--primary" onClick={onNext}>
            {primaryActionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

