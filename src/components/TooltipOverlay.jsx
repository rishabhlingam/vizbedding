export function TooltipOverlay({ tooltip }) {
  if (!tooltip) return null;
  const { x, y, content, sub, wrap } = tooltip;
  return (
    <div
      className={`tooltip-overlay ${wrap ? 'tooltip-wrap' : ''}`}
      style={{
        left: x + 12,
        top: y + 12,
      }}
    >
      <div className="tooltip-content">{content}</div>
      {sub && <div className="tooltip-sub">{sub}</div>}
    </div>
  );
}
