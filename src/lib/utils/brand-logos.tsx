import type { ReactNode } from "react";

/**
 * Brand marks for the account card.
 *
 * ------------------------------------------------------------------
 * MONOCHROME, AND WHY IT IS NOT OPTIONAL
 * ------------------------------------------------------------------
 *
 * Every path is `fill="currentColor"` and the mark inherits the card's text
 * token (`--brand-on`). One colour source per card, not two - which is what
 * keeps the scheme-independence invariant clean.
 *
 * A single non-currentColor path breaks the whole chain. If one path carries its
 * own fill, that path stops inheriting the card token, stops being
 * scheme-independent, and the logo becomes a second, unchecked colour source
 * sitting on the same surface as the text. That is the exact shape of the bug
 * this gate series exists to prevent, so the rule is absolute: no per-path
 * fills, no opacity variations, no gradients. `gate:brand` asserts the
 * rendered colour is identical in light and dark, which is the check that would
 * catch it - but a path that is *already* a fixed colour in both schemes would
 * pass that and still be wrong. The pure-currentColor rule is therefore a
 * SOURCE invariant enforced by review and by the assets, and the
 * scheme-independence check is the rendered proof of it.
 *
 * ------------------------------------------------------------------
 * ON-BASE, NOT ACCENT — a decision, not a shortcut
 * ------------------------------------------------------------------
 *
 * The marks render in the card's TEXT colour, not `brand.accent`. The base hue
 * is the brand channel; the mark is a uniform visual anchor across the grid,
 * which is what the reference design does — bank marks in one colour on
 * brand-coloured grounds.
 *
 * Note what this means and do not mistake it for a defect: `onBase` is a single
 * shared value across all eight brands, so the mark is the SAME colour on every
 * card. It does not, and is not meant to, differentiate brands. The
 * monogram fallback is therefore more brand-distinguishing than a wordmark —
 * which is fine, because it is a fallback and not a competitor to the mark.
 *
 * If a future pass wants accent-coloured marks, the contrast has to be measured
 * as accent-against-OWN-BRAND-BASE, per brand. A figure measured against
 * `#141b16` (the app's dark card surface) says nothing about a mark sitting on
 * `#34060F`, and must not be cited as if it did.
 *
 * ------------------------------------------------------------------
 * LOCKUP
 * ------------------------------------------------------------------
 *
 * The container is `height: LOGO_HEIGHT_PX; width: auto`. Height is fixed so
 * every mark and the monogram occupy the same vertical band and the bank name
 * sits on one line across the grid; width is intrinsic and is EXPECTED to vary
 * with each mark's natural aspect ratio. Nothing is padded to a square, nothing
 * is letterboxed, and no `viewBox` is stretched to match another brand — a
 * distorted mark is worse than a narrow one.
 *
 * `LOGO_HEIGHT_PX` is exported because the gate asserts rendered heights are
 * identical across cards. If the container height is set in CSS instead, the
 * assertion and the stylesheet can drift apart, which is the null-vs-null shape
 * with a stylesheet.
 */
export const LOGO_HEIGHT_PX = 18;

/** The natural aspect ratio of each mark, as `viewBox` width / height. */
type Mark = { w: number; h: number; paths: string };

/**
 * The seven marks, keyed by brand.
 *
 * Each entry is a MARK SLOT. The vector source is pending: the assets supplied
 * for this work were RENDERED IMAGES, which carry no path data, and tracing a
 * wordmark by hand would ship a logo that is not the logo. A slot left empty
 * resolves to `null`, which renders the monogram — the honest state for a brand
 * whose mark is unknown.
 *
 * To fill a slot: paste the mark's `<path>` elements, all with
 * `fill="currentColor"`, and set `w`/`h` to the asset's OWN viewBox. Do not pad
 * `w` or `h` to match another brand, and do not add a background field —
 * Maya's green field is a background and comes out, leaving the white
 * wordmark paths.
 */
const MARKS: Record<string, Mark> = {
  maribank: { w: 0, h: 0, paths: "" }, // TODO(brand-logos): awaiting vector source
  unionbank: { w: 0, h: 0, paths: "" }, // TODO(brand-logos): awaiting vector source
  gcash: { w: 0, h: 0, paths: "" }, // TODO(brand-logos): awaiting vector source
  maya: { w: 0, h: 0, paths: "" }, // TODO(brand-logos): awaiting vector source
  bpi: { w: 0, h: 0, paths: "" }, // TODO(brand-logos): awaiting vector source
  paypal: { w: 24, h: 24, paths: '<path fill="currentColor" d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"/>' }, // simple-icons paypal - PayPal; natural viewBox 0 0 24 24 (ratio 1.0000)
  wise: { w: 24, h: 24, paths: '<path fill="currentColor" d="M6.488 7.469 0 15.05h11.585l1.301-3.576H7.922l3.033-3.507.01-.092L8.993 4.48h8.873l-6.878 18.925h4.706L24 .595H2.543l3.945 6.874Z"/>' }, // simple-icons wise - Wise; natural viewBox 0 0 24 24 (ratio 1.0000)
};

/**
 * The mark for a brand, or `null` when the brand has none.
 *
 * `null` is a first-class return, not a failure: "we do not have this mark" is
 * a normal answer and the card has a designed answer for it. The gate asserts
 * the CALLER renders a monogram rather than an empty box, so a missing mark
 * cannot quietly become a hole in the card.
 */
export function resolveBrandLogo(brand: string): ReactNode | null {
  const mark = MARKS[brand];
  if (!mark || !mark.paths || !mark.w || !mark.h) return null;
  return (
    <svg
      data-brand-logo={brand}
      viewBox={`0 0 ${mark.w} ${mark.h}`}
      height="100%"
      width="auto"
      fill="currentColor"
      role="img"
      aria-label={`${brand} logo`}
      // paths are injected as source; every one carries fill="currentColor"
      dangerouslySetInnerHTML={{ __html: mark.paths }}
    />
  );
}
