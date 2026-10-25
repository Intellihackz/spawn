// The mark: three blocks in a row, linked, the last one lit. A chain, and the spawn point at its end.
export function Mark({ height = 16 }: { height?: number }) {
  return (
    <svg width={(height * 38) / 16} height={height} viewBox="0 0 38 16" aria-hidden="true">
      <rect className="b b1" x="0" y="3" width="10" height="10" />
      <rect x="10" y="7.2" width="4" height="1.6" fill="currentColor" opacity="0.5" />
      <rect className="b b2" x="14" y="3" width="10" height="10" />
      <rect x="24" y="7.2" width="4" height="1.6" fill="currentColor" opacity="0.5" />
      <rect className="b b3" x="28" y="3" width="10" height="10" />
    </svg>
  );
}
