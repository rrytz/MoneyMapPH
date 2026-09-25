import {
  Car,
  Bus,
  ShoppingCart,
  Pill,
  FlaskConical,
  Utensils,
  Lightbulb,
  House,
  Antenna,
  HandCoins,
  ShieldCheck,
  Bike,
  Landmark,
  Package,
  type LucideIcon,
} from "lucide-react";
import { resolveCategoryIcon, FALLBACK_ICON_KEY, type IconKey } from "@/lib/categories/icon-map";

/**
 * Slice 4 — the single render surface for category identity.
 *
 * Every place that used to print a raw emoji (`<span>{category.icon}</span>`)
 * now renders a monochrome, stroke-2 Lucide glyph resolved through the
 * read-time map. The color is applied by the caller (inline style or a tint
 * class) so the glyph inherits the category's data color.
 *
 * The component defaults to Package at this boundary independently of the map
 * lookup — a caller that passes something unresolvable still gets a defined
 * icon, never a blank and never a raw emoji text node.
 */

const LUCIDE_BY_KEY: Record<string, LucideIcon> = {
  Car,
  Bus,
  ShoppingCart,
  Pill,
  FlaskConical,
  Utensils,
  Lightbulb,
  House,
  Antenna,
  HandCoins,
  ShieldCheck,
  Bike,
  Landmark,
  Package,
};

function getLucideIcon(key: IconKey): LucideIcon {
  return LUCIDE_BY_KEY[key] ?? LUCIDE_BY_KEY[FALLBACK_ICON_KEY];
}

export interface CategoryIconProps {
  icon?: string | null;
  className?: string;
  /** px size shorthand; maps to a Tailwind size class. Defaults to 16 (h-4 w-4). */
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

export function CategoryIcon({ icon, className, size = "sm" }: CategoryIconProps) {
  const key = resolveCategoryIcon(icon);
  const Icon = getLucideIcon(key);
  return <Icon className={className ?? SIZE_CLASS[size]} strokeWidth={2} aria-hidden="true" />;
}
