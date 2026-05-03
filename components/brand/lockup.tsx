/**
 * Full Skillnex wordmark — gray "Skillnex" with the gradient X as the
 * final letter. Use anywhere a logo lockup is wanted (landing nav,
 * footer, auth shell logo, sidebar wordmark).
 *
 * Renders the PNG (high-DPI source) instead of inlining the wordmark
 * as SVG so the asset stays in one place — `public/brand/skillnex-
 * full-logo.png`. Drop a replacement file there and every surface
 * updates.
 *
 * For the icon-only mark (sidebars, favicons, OG images) keep using
 * components/brand/logo.tsx which is the inline gradient X.
 */
type LockupProps = {
  /** Width in px. Aspect ratio is preserved by Next/Image / CSS. */
  width?: number;
  /** Optional className to forward (margin, etc.). */
  className?: string;
};

const ASPECT = 4.05; // ~width / height of the source PNG

export function BrandLockup({ width = 140, className }: LockupProps) {
  const height = Math.round(width / ASPECT);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/skillnex-full-logo.png"
      alt="Skillnex"
      width={width}
      height={height}
      className={className}
      style={{
        display: "block",
        width,
        height,
        objectFit: "contain",
      }}
    />
  );
}
