/**
 * Skillnex brand mark — the gradient "X" lifted from the design package.
 * Two crossing strokes, top-half warm (pink → orange), bottom-half cool
 * (cyan → blue). The unique gradient IDs let multiple copies of the logo
 * coexist on a page without colliding (each instance gets its own pair).
 */
let _id = 0;

export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  _id += 1;
  const top = `skn-grad-top-${_id}`;
  const bottom = `skn-grad-bottom-${_id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={top} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E91E63" />
          <stop offset="40%" stopColor="#FF5722" />
          <stop offset="100%" stopColor="#FF9800" />
        </linearGradient>
        <linearGradient id={bottom} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4DD0E1" />
          <stop offset="50%" stopColor="#29B6F6" />
          <stop offset="100%" stopColor="#42A5F5" />
        </linearGradient>
      </defs>
      <path d="M 35 45 L 100 120" stroke={`url(#${top})`} strokeWidth={14} strokeLinecap="round" />
      <path d="M 165 45 L 100 120" stroke={`url(#${top})`} strokeWidth={14} strokeLinecap="round" />
      <path
        d="M 35 155 L 100 80"
        stroke={`url(#${bottom})`}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <path
        d="M 165 155 L 100 80"
        stroke={`url(#${bottom})`}
        strokeWidth={14}
        strokeLinecap="round"
      />
    </svg>
  );
}
