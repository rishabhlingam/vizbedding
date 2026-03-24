const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.35,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
};

export function IconPlanes(props) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden {...props}>
      <path {...stroke} d="M3.5 8.5l6-2.2 5.2 2.2-6 2.2z" />
      <path {...stroke} d="M4.5 12.5l6-2.2 5.2 2.2-6 2.2z" />
      <path {...stroke} d="M5.5 16.5l6-2.2 5.2 2.2-6 2.2z" />
    </svg>
  );
}

export function IconAxes(props) {
  const w = 1.2;
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      overflow="visible"
      aria-hidden
      {...props}
    >
      <path {...stroke} strokeWidth={w} d="M5.5 17.5V7" />
      <path {...stroke} strokeWidth={w} d="M5.5 17.5h11" />
      <path {...stroke} strokeWidth={w} d="M5.5 17.5l8-8" />
      <path {...stroke} strokeWidth={w} d="M4.05 8.35L5.5 7M6.95 8.35L5.5 7" />
      <path {...stroke} strokeWidth={w} d="M15.25 16.25L16.5 17.5M15.25 18.75L16.5 17.5" />
      <path {...stroke} strokeWidth={w} d="M12.38 9.94L13.5 9.5M13.02 10.58L13.5 9.5" />
    </svg>
  );
}

function hexVertices(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

export function IconEdgesBetweenPoints(props) {
  const pts = hexVertices(12, 12, 7.5);
  const perimeter =
    pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ') + ' Z';
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden {...props}>
      <path {...stroke} d={perimeter} />
      {[0, 1, 2].map((i) => (
        <line
          key={i}
          x1={pts[i][0]}
          y1={pts[i][1]}
          x2={pts[i + 3][0]}
          y2={pts[i + 3][1]}
          {...stroke}
        />
      ))}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={1.1} fill="currentColor" />
      ))}
    </svg>
  );
}

export function IconEdgesFromCenter(props) {
  const pts = hexVertices(12, 12, 7.5);
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden {...props}>
      {pts.map((p, i) => (
        <line key={i} x1={12} y1={12} x2={p[0]} y2={p[1]} {...stroke} />
      ))}
      {pts.map((p, i) => (
        <circle key={`o-${i}`} cx={p[0]} cy={p[1]} r={1} fill="currentColor" />
      ))}
      <circle cx={12} cy={12} r={1.35} fill="currentColor" />
    </svg>
  );
}
