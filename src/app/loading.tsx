/**
 * Root loading boundary. This is the ONLY fallback that covers the
 * `(dashboard)` layout's own awaits (`getUser`, shell data): a loading.tsx in
 * the same segment sits BELOW the layout and never shows for it. On a cold
 * iOS home-screen launch this is what renders during the 1-3s gap.
 *
 * The background is hardcoded #0e1410, NOT a theme token, because it must
 * pixel-match the apple-touch-startup-image PNGs (same value, generated from
 * the same constant). The theme-init script resolves .dark pre-paint, but the
 * launch image is static - so both are dark-branded and the transition is
 * invisible in dark mode, one branded step in light mode. If either side
 * changes shade, the launch flashes - which is worse than the black this
 * replaces.
 */
export default function Loading() {
  return (
    <div
      className="launch-surface flex h-dvh items-center justify-center"
      aria-label="Loading MoneyMap"
      role="status"
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 9c3-2.5 5-2.5 8 0s5 2.5 8 0 4-1.5 4-1.5"
          stroke="#2ed07a"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M2 17h20"
          stroke="#2ed07a"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.35"
        />
      </svg>
    </div>
  );
}
